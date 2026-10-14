#!/usr/bin/env python3
"""
Priority RE traces for RedLabel engine control:
  1) IRQ vec2/vec5 → RAM publications
  2) CAL access-model correction + proven-xref attempt
  3) SFR HSO vs HSI audit

Emits tools/re/out/{irq_ram_publications,sfr_hso_hsi_audit,cal_access_model}.{json,md}
and refreshes ignition_fuel coverage framing.
"""

from __future__ import annotations

import json
import re
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "out"
GHIDRA = OUT / "ghidra"
ROM_NAME = "BMW DME413 SW623 D466.29 C16x900A 94 RedLabel.bin"
CODE_START, CODE_END, DATA_START = 0x2000, 0xB930, 0xB931


def load_listing():
    lines = []
    with (GHIDRA / "ghidra_listing.txt").open() as f:
        for line in f:
            m = re.match(r"^([0-9a-fA-F]+)\s+(.*)$", line.strip())
            if m:
                lines.append((int(m.group(1), 16), m.group(2)))
    return lines


def build_irq_pubs(lines):
    handlers = {
        "vec2_hsi_capture": {
            "vectorIndex": 2,
            "entry": 0xA88E,
            "end": 0xAB10,
            "roleHypothesis": "hsi_capture_crank_cam",
            "evidenceStrength": "high",
        },
        "vec5_adc_hso_schedule": {
            "vectorIndex": 5,
            "entry": 0xA4AA,
            "end": 0xA63F,
            "roleHypothesis": "adc_complete_plus_hso_schedule",
            "evidenceStrength": "high",
        },
    }
    out = {}
    for hid, meta in handlers.items():
        lo, hi = meta["entry"], meta["end"]
        ram, sfr, ports = [], [], []
        for a, i in lines:
            if not (lo <= a <= hi):
                continue
            m = re.search(
                r"^STB?\s+(\w+),(0x[0-9a-fA-F]+),\s*(LOOKUP|TABLE)", i
            )
            if m:
                ram.append(
                    {
                        "site": a,
                        "siteHex": f"0x{a:04X}",
                        "target": int(m.group(2), 16),
                        "targetHex": f"0x{int(m.group(2), 16):04X}",
                        "src": m.group(1),
                        "insn": i,
                    }
                )
            if re.match(
                r"^(LDB HSI_status|LD HSI_time|ADD HSI_time|ST TIMER2|"
                r"LDB AD_|STB AD_|ORB INT_PEND|ANDB INT_)",
                i,
            ):
                sfr.append({"site": a, "siteHex": f"0x{a:04X}", "insn": i})
            if re.match(r"^STB\s+\w+,PORT[12]\b", i) or re.match(
                r"^LDB\s+PORT[12]\b", i
            ):
                ports.append({"site": a, "siteHex": f"0x{a:04X}", "insn": i})
        # Dedupe RAM targets with roles
        role_guess = {
            0x14C0: "hsi_edge_timestamp",
            0x14C2: "period_hi_or_tooth_count",
            0x14C4: "period_shadow",
            0x14CA: "timer2_capture_copy",
            0x14CC: "derived_period_scale",
            0x15D8: "port1_low_ debounced_counters",
            0x17C2: "port2_high_debounced_counters",
            0x187C: "adc_sample_byte",
            0x1600: "scheduled_hso_flags_or_pattern",
            0x1602: "hso_command_pair_staging",
            0x101E: "run_mode_flags",
            0x18A5: "adc_isr_heartbeat_clear",
            0x08FE: "port_shadow_ra4",
            0x1455: "transient_clear",
            0x156A: "clear_pair_a",
            0x156C: "clear_pair_b",
            0x1606: "limit_or_timeout",
            0x0409: "small_state_byte",
            0x12EE: "clear_word",
        }
        for r in ram:
            r["roleHypothesis"] = role_guess.get(r["target"], "unknown_ram")
            r["roleEvidence"] = "low" if r["roleHypothesis"] == "unknown_ram" else "medium"

        out[hid] = {
            **meta,
            "entryHex": f"0x{meta['entry']:04X}",
            "ramPublications": ram,
            "sfrTouches": sfr,
            "portWrites": ports,
            "summary": None,
        }

    out["vec2_hsi_capture"]["summary"] = (
        "Reads HSI_time FIFO-style; publishes period/timestamp words at "
        "0x14C0/0x14C2/0x14C4/0x14CC; may ST TIMER2 capture to 0x14CA; "
        "schedules HSO via LDB HSI_status,#0x74 + ADD HSI_time; toggles PORT2."
    )
    out["vec5_adc_hso_schedule"]["summary"] = (
        "On IOS1.0: kicks AD channel, schedules HSO (#0x18/+0x1F4); samples "
        "AD_resulthi into 0x187C and channel ring via RW70; publishes port "
        "debounce counters 0x15D8/0x17C2; stages HSO cmds to 0x1600/0x1602; "
        "updates flags at 0x101E."
    )
    return {
        "schemaVersion": 1,
        "id": "irq_ram_publications_v1",
        "rom": ROM_NAME,
        "disclaimer": (
            "RAM target roles are hypotheses from access patterns. "
            "Addresses themselves are proven store sites in Ghidra listing."
        ),
        "handlers": out,
        "openQuestions": [
            "Map 0x14C2/0x14CC to RPM/period engineering units",
            "Which AD channel index in [RW70] ring is MAF vs TMOT vs IAT",
            "Decode HSO_COMMAND immediates (#0x18/#0x1A/#0x13/#0x22/#0x74) to spark vs inj channels",
        ],
    }


def build_sfr_audit(lines):
    # Ghidra MCS96.sinc RAM map offsets 0x00..
    ghidra_map = [
        (0x00, "ZRlo/ZR", "fixed"),
        (0x02, "AD_result", "R/W windowed on some parts"),
        (0x04, "HSI_time (Ghidra name)", "READ=HSI_TIME; WRITE=HSO_TIME (Intel)"),
        (0x06, "HSI_status (Ghidra name)", "READ=HSI_STATUS; WRITE=HSO_COMMAND (Intel)"),
        (0x07, "SBUF", "TX/RX windowed"),
        (0x08, "INT_MASK", ""),
        (0x09, "INT_PEND", ""),
        (0x0A, "TIMER1", "WDT kick uses TIMER1lo writes in this firmware"),
        (0x0C, "TIMER2", ""),
        (0x0E, "PORT0", ""),
        (0x0F, "PORT1", "GPIO; also sampled in vec5"),
        (0x10, "PORT2", "GPIO; crank/cam related bits hypothesized"),
        (0x11, "SP_STAT", ""),
        (0x14, "WSR", "window select — unused in listing (0 refs)"),
        (0x15, "IOS0", ""),
        (0x16, "IOS1", "HSO status bits on read; vec2/vec5 gate on IOS1"),
        (0x17, "IOS2", ""),
    ]

    hso_cmds = []
    hsi_reads = []
    for a, i in lines:
        if re.match(r"^LDB\s+HSI_status,#", i) or re.match(
            r"^LDB\s+HSI_status,0x", i
        ):
            hso_cmds.append({"site": a, "siteHex": f"0x{a:04X}", "insn": i})
        if re.match(r"^LD\s+\w+,HSI_time\b", i) or re.match(
            r"^LD\s+HSI_time\b", i
        ):
            # distinguish read vs write: "LD RWx,HSI_time" = read; "LD HSI_time,RWx" = write
            if re.match(r"^LD\s+HSI_time\b", i) or re.match(
                r"^ADD\s+HSI_time\b", i
            ):
                pass  # write path counted via cmds
            else:
                hsi_reads.append({"site": a, "siteHex": f"0x{a:04X}", "insn": i})
        if re.match(r"^(LD|ADD)\s+HSI_time\b", i):
            hso_cmds.append(
                {"site": a, "siteHex": f"0x{a:04X}", "insn": i, "kind": "hso_time_write"}
            )

    return {
        "schemaVersion": 1,
        "id": "sfr_hso_hsi_audit_v1",
        "rom": ROM_NAME,
        "ghidraLanguage": "MCS96:LE:16:default",
        "conclusion": {
            "status": "cross_checked",
            "summary": (
                "Ghidra names bytes 0x04/0x06 only as HSI_time/HSI_status. "
                "Per Intel 80C196KB, those addresses are R/W aliases: "
                "WRITE 0x06=HSO_COMMAND, WRITE 0x04=HSO_TIME; "
                "READ 0x06=HSI_STATUS, READ 0x04=HSI_TIME. "
                "Therefore LDB HSI_status,#imm + LD/ADD HSI_time in this ROM "
                "are High-Speed Output schedules (spark/inj/CAM candidates), "
                "while LD RWx,HSI_time are true HSI capture reads."
            ),
            "sources": [
                "Ghidra MCS96.sinc RAM SFR map @0x00",
                "Intel 80C196KB User's Guide (HSO_COMMAND/HSI_STATUS @06H; HSO_TIME/HSI_TIME @04H)",
                "Usage patterns in RedLabel listing (command-then-time write pairs)",
            ],
        },
        "ghidraSfrMap": [
            {"offset": o, "ghidraName": n, "note": note} for o, n, note in ghidra_map
        ],
        "counts": {
            "hsoCommandOrTimeWritesNamedHSI": len(hso_cmds),
            "hsiTimeReads": len(hsi_reads),
            "WSRRefsInListing": sum(1 for _, i in lines if "WSR" in i),
        },
        "hsoCommandImmediates": sorted(
            {
                re.search(r"#(0x[0-9a-fA-F]+)", e["insn"]).group(1)
                for e in hso_cmds
                if "HSI_status,#" in e["insn"] and re.search(r"#(0x[0-9a-fA-F]+)", e["insn"])
            }
        ),
        "sampleHsoSchedules": [e for e in hso_cmds if "HSI_status,#" in e.get("insn", "")][:12],
        "sampleHsiReads": hsi_reads[:8],
        "channelDecode": {
            "status": "open",
            "note": (
                "HSO_COMMAND bitfields select channel / set-clear / timer1|2 / interrupt. "
                "Observed immediates include 0x00,0x02,0x04,0x07,0x10,0x13,0x18,0x1A,0x20,"
                "0x21,0x22,0x27,0x30,0x33,0x51,0x70,0x71,0x74 — not yet mapped to "
                "coil vs injector vs VANOS vs fuel-pump."
            ),
        },
        "ios0WriteNote": (
            "Intel: writes to IOS0 (windowed) can also drive HSO pins directly; "
            "this ROM heavily uses HSI_status/HSI_time pairs instead."
        ),
    }


def build_cal_access_model(lines, rom: bytes, ign_items: list):
    """Correct the false page-index model; attempt proven xrefs."""
    # Prove: LDB R56,0xd0,LOOKUP[ZR] bytes are imm16=0x00D0
    examples = []
    for a, i in lines:
        if re.search(r"0xd0,\s*LOOKUP\[ZR\]", i):
            b = rom[a : a + 5]
            imm = b[2] | (b[3] << 8)
            examples.append(
                {
                    "site": a,
                    "siteHex": f"0x{a:04X}",
                    "insn": i,
                    "bytesHex": b.hex(),
                    "immed16": imm,
                    "immed16Hex": f"0x{imm:04X}",
                    "effectiveAddressIfZR0": imm,
                    "interpretation": "register_file_0x00D0_not_rom_0xD000",
                }
            )
            if len(examples) >= 3:
                break

    # Absolute DATA reads that ARE proven (high ROM)
    proven_abs = []
    for a, i in lines:
        m = re.search(r"(0x[0-9a-fA-F]+),\s*LOOKUP\[ZR\]", i)
        if not m:
            continue
        imm = int(m.group(1), 16)
        if imm >= DATA_START:
            proven_abs.append(
                {
                    "site": a,
                    "siteHex": f"0x{a:04X}",
                    "insn": i,
                    "target": imm,
                    "targetHex": f"0x{imm:04X}",
                    "ghidraProven": True,
                    "ignFuelXdfHit": any(it["offset"] == imm for it in ign_items),
                }
            )

    # Structural split ptr 0xD000 + 0x0030 at mid-CODE island
    structural = []
    if rom[0x432A] == 0x00 and rom[0x432B] == 0xD0 and rom[0x432C] == 0x30 and rom[0x432D] == 0x00:
        structural.append(
            {
                "kind": "split_base_plus_offset",
                "baseAt": 0x432A,
                "baseHex": "0x432A",
                "baseValue": 0xD000,
                "offsetAt": 0x432C,
                "offsetValue": 0x0030,
                "composed": 0xD030,
                "composedHex": "0xD030",
                "xdfName": next(
                    (it["name"] for it in ign_items if it["offset"] == 0xD030), None
                ),
                "codeReadProven": False,
                "note": (
                    "Mid-CODE data island holds LE16 0xD000 then 0x0030 (= Inj Constant "
                    "0xD030). No CODE site yet shown loading this pair into a pointer "
                    "and dereferencing — structural only."
                ),
            }
        )

    # Descriptor table
    descriptor = {
        "ramTable": "0x1E08",
        "expectedInRw6E": True,
        "initSite": "0x4ED9",
        "initBehavior": (
            "LD RW1C,#0x1E08; fill through 0x1F34 with pointer 0x42DF "
            "(and related 0x42E9) — template/default descriptors in mid-CODE island."
        ),
        "interpEntry": "0x33C2 via trampoline 0x20C7",
        "interpMechanism": (
            "ADD RW1A,RW6E; LD RW4C,[RW1A]; then axis/map walk via [RW4C]/[RW50]."
        ),
        "blocker": (
            "External RedLabel image has 0x0000–0x1FFF erased (0xFF). "
            "If production uses internal ROM content at 0x1E08 beyond the "
            "0x4ED9 fill, those CAL pointers are invisible in this dump."
        ),
        "evidenceStrength": "high_for_mechanism_medium_for_cal_targets",
    }

    # Reclassify ign/fuel items under corrected model
    regfile_hits = 0
    proven = 0
    structural_hits = 0
    unknown = 0
    updated = []
    for it in ign_items:
        off = it["offset"]
        page = (off >> 8) & 0xFF
        status = "unknown"
        strength = "none"
        notes = []
        # Exact absolute proven
        if any(p["target"] == off and p["ghidraProven"] for p in proven_abs):
            status = "ghidra_proven_absolute"
            strength = "high"
            proven += 1
            notes.append("LOOKUP[ZR] absolute immed16 matches XDF offset")
        elif any(s["composed"] == off for s in structural):
            status = "structural_split_ptr_in_data_island"
            strength = "medium"
            structural_hits += 1
            notes.append("0xD000+offset adjacent in mid-CODE island; CODE deref TBD")
        elif 0xD0 <= page <= 0xEF:
            # Prior false page model — now register-file related only if low imm used
            status = "access_path_unresolved"
            strength = "low"
            unknown += 1
            notes.append(
                "ROM file offset in 0xDxxx–0xExxx; no absolute LOOKUP[ZR] immed16 "
                "found. Likely reached via descriptor/indirect (RW6E/@0x1E08) — unproven."
            )
            # Keep prior register-file confusion note
            if any(
                re.search(rf"0x{page:02x},\s*LOOKUP\[ZR\]", i, re.I) for _, i in lines
            ):
                notes.append(
                    f"CODE has LOOKUP[ZR] immed 0x00{page:02X} (= register R{page:02X}), "
                    "NOT ROM page — do not treat as CAL read."
                )
                regfile_hits += 1
        else:
            status = "access_path_unresolved"
            strength = "low"
            unknown += 1

        updated.append(
            {
                **{k: it[k] for k in it if k not in ("pageIndexedSamples", "pageBaseLiteralSamples", "addr16HitsAligned")},
                "codeReadStatus": status,
                "evidenceStrength": strength,
                "ghidraProven": status == "ghidra_proven_absolute",
                "notes": notes,
                "pageByte": page,
            }
        )

    n = len(updated) or 1
    return {
        "schemaVersion": 2,
        "id": "cal_access_model_v2",
        "rom": ROM_NAME,
        "correction": {
            "priorError": (
                "v1 treated `LDB Rx,0xd0, LOOKUP[ZR]` as ROM page-0xD0 indexed CAL access."
            ),
            "correctedSemantics": (
                "SLEIGH long-indexed: ea = RWbase + immed16. With ZR=0 and bytes "
                "`b3 01 d0 00 dest`, immed16=0x00D0 → register-file address 0x00D0 "
                "(RD0), not ROM 0xD000."
            ),
            "examples": examples,
        },
        "descriptorPath": descriptor,
        "provenAbsoluteDataReads": proven_abs,
        "structuralPointers": structural,
        "coverage": {
            "items": len(updated),
            "ghidraProvenCodeRead": proven,
            "ghidraProvenPct": round(100.0 * proven / n, 2),
            "structuralSplitPtr": structural_hits,
            "structuralSplitPtrPct": round(100.0 * structural_hits / n, 2),
            "accessPathUnresolved": unknown,
            "registerFileConfusionSitesNoted": regfile_hits,
            "headline": (
                f"{round(100.0 * proven / n, 2)}% proven CODE reads "
                f"({proven}/{len(updated)}); "
                f"{structural_hits} structural split-ptr (0xD030); "
                "page-index candidates retracted."
            ),
        },
        "items": updated,
        "nextToProve": [
            "Find CODE that loads 0xD000 from 0x432A (or descriptor) into RWxx and ADDs 0x0030, then [RWxx]",
            "Dump/recover internal ROM 0x0000–0x1FFF or instrument RAM 0x1E08 descriptor contents after boot",
            "Trace one 0x20C7 interp call with known RW1A index through [RW4C] to a 0xDxxx pointer",
        ],
        "shippingNote": "Research-only. Verification gates unchanged. No shipping promotion.",
    }


def md_irq(doc):
    lines = [
        "# IRQ → RAM publications (vec2 / vec5)",
        "",
        f"ROM: `{doc['rom']}`",
        "",
        f"> {doc['disclaimer']}",
        "",
    ]
    for hid, h in doc["handlers"].items():
        lines += [
            f"## `{hid}` @ `{h['entryHex']}` (vec{h['vectorIndex']})",
            "",
            f"- Role hypothesis: **{h['roleHypothesis']}** ({h['evidenceStrength']})",
            f"- {h['summary']}",
            "",
            "### RAM stores (proven sites)",
            "",
            "| Site | Target | Role hypothesis | Insn |",
            "|------|--------|-----------------|------|",
        ]
        for r in h["ramPublications"]:
            lines.append(
                f"| `{r['siteHex']}` | `{r['targetHex']}` | {r['roleHypothesis']} | `{r['insn']}` |"
            )
        lines += ["", "### SFR / HSO schedule touches", ""]
        for s in h["sfrTouches"][:15]:
            lines.append(f"- `{s['siteHex']}` `{s['insn']}`")
        if h["portWrites"]:
            lines += ["", "### PORT writes", ""]
            for p in h["portWrites"]:
                lines.append(f"- `{p['siteHex']}` `{p['insn']}`")
        lines.append("")
    lines += ["## Open questions", ""]
    for q in doc["openQuestions"]:
        lines.append(f"- {q}")
    lines.append("")
    return "\n".join(lines)


def md_sfr(doc):
    c = doc["conclusion"]
    lines = [
        "# SFR audit: HSO vs HSI (spark/inj scheduling)",
        "",
        f"ROM: `{doc['rom']}` / `{doc['ghidraLanguage']}`",
        "",
        f"**Status: `{c['status']}`** — {c['summary']}",
        "",
        "## Sources",
        "",
    ]
    for s in c["sources"]:
        lines.append(f"- {s}")
    lines += [
        "",
        "## Ghidra SFR byte map (relevant)",
        "",
        "| Off | Ghidra name | Intel note |",
        "|-----|-------------|------------|",
    ]
    for e in doc["ghidraSfrMap"]:
        lines.append(f"| `0x{e['offset']:02X}` | {e['ghidraName']} | {e['note']} |")
    lines += [
        "",
        f"## Counts",
        "",
        f"- HSO command/time writes (named HSI_* in listing): **{doc['counts']['hsoCommandOrTimeWritesNamedHSI']}**",
        f"- True HSI_time reads (`LD RWx,HSI_time`): **{doc['counts']['hsiTimeReads']}**",
        f"- WSR refs: **{doc['counts']['WSRRefsInListing']}** (windowing not used in visible CODE)",
        "",
        f"## Observed HSO_COMMAND immediates",
        "",
        ", ".join(f"`{x}`" for x in doc["hsoCommandImmediates"]),
        "",
        f"## Channel decode",
        "",
        doc["channelDecode"]["note"],
        "",
        doc["ios0WriteNote"],
        "",
    ]
    return "\n".join(lines)


def md_cal(doc):
    cov = doc["coverage"]
    lines = [
        "# CAL access model (corrected) + proven-xref attempt",
        "",
        f"ROM: `{doc['rom']}`",
        "",
        "## Correction",
        "",
        f"**Prior error:** {doc['correction']['priorError']}",
        "",
        f"**Correct semantics:** {doc['correction']['correctedSemantics']}",
        "",
        "Examples:",
        "",
    ]
    for e in doc["correction"]["examples"]:
        lines.append(
            f"- `{e['siteHex']}` `{e['insn']}` bytes `{e['bytesHex']}` → immed16 `{e['immed16Hex']}` → {e['interpretation']}"
        )
    lines += [
        "",
        "## Descriptor / interp path",
        "",
        f"- RW6E expected **`{doc['descriptorPath']['ramTable']}`** (CMP sites @0x481B/0x4D66)",
        f"- Init `@ {doc['descriptorPath']['initSite']}`: {doc['descriptorPath']['initBehavior']}",
        f"- Interp: {doc['descriptorPath']['interpMechanism']}",
        f"- Blocker: {doc['descriptorPath']['blocker']}",
        "",
        "## Coverage (ign/fuel XDF items)",
        "",
        f"| Metric | Count | % |",
        f"|--------|------:|--:|",
        f"| **Ghidra-proven CODE read of XDF offset** | **{cov['ghidraProvenCodeRead']}** | **{cov['ghidraProvenPct']}%** |",
        f"| Structural split-ptr in data island | {cov['structuralSplitPtr']} | {cov['structuralSplitPtrPct']}% |",
        f"| Access path unresolved | {cov['accessPathUnresolved']} | — |",
        "",
        cov["headline"],
        "",
        "## Proven absolute DATA reads (any DATA, not necessarily ign/fuel XDF)",
        "",
    ]
    for p in doc["provenAbsoluteDataReads"]:
        hit = " YES" if p["ignFuelXdfHit"] else ""
        lines.append(f"- `{p['siteHex']}` → `{p['targetHex']}` `{p['insn']}`{hit}")
    if not doc["provenAbsoluteDataReads"]:
        lines.append("- (none)")
    lines += ["", "## Structural pointers", ""]
    for s in doc["structuralPointers"]:
        lines.append(
            f"- `{s['baseHex']}`: `0x{s['baseValue']:04X}` + `0x{s['offsetValue']:04X}` → `{s['composedHex']}` "
            f"({s.get('xdfName','')[:60]}) — CODE read proven: **{s['codeReadProven']}**"
        )
        lines.append(f"  - {s['note']}")
    lines += ["", "## Next to prove first XDF CODE read", ""]
    for s in doc["nextToProve"]:
        lines.append(f"1. {s}")
    lines += ["", "---", doc["shippingNote"], ""]
    return "\n".join(lines)


def theory_vs_rom_section(cal, irq, sfr) -> str:
    cov = cal["coverage"]
    return f"""

---

## 7. Theory vs RedLabel ROM (this RE pass)

Cross-check of §3–§5 control concept against MCS-96 listing / CFG / XDF (offline).  
**Still not end-to-end CODE+DATA control.**

### 7.1 Checklist

| Theory element (from §§3–5) | ROM / RE status | Evidence |
|----------------------------|-----------------|----------|
| HFM/MAF → load → ti / zw chain (H1) | **Partial** | XDF maps present; **0%** proven CODE reads of those offsets (`{cov['ghidraProvenPct']}%`) |
| MAF transfer `0xD290` | DATA present; CODE path **unresolved** | No absolute `LOOKUP[ZR]` to `0xD290`; likely descriptor/indirect via RW6E=`0x1E08` |
| Ti constant `0xD030` scales load (H2) | **Structural hit** | Mid-CODE island `@0x432A`: LE16 `0xD000` then `0x0030` (=`0xD030`); CODE deref **not** proven |
| Crank speed / position | **Strong IRQ** | vec2 `@0xA88E` reads `HSI_time`, publishes `0x14C0/0x14C2/0x14C4/0x14CC` |
| ADC sensor sampling (MAF/temps) | **Strong IRQ** | vec5 `@0xA4AA` AD kick + `AD_resulthi` → `0x187C` / RW70 ring |
| Injector / spark drivers | **HSO path identified** | Writes named `HSI_status`/`HSI_time` are Intel **HSO_COMMAND/HSO_TIME** aliases (SFR audit `cross_checked`); channel bits **open** |
| Dual VANOS fuel/ign maps (H3) | REPO only | XDF dual tables; selector CODE TBD |
| Alpha-N limp `0xDBC3` (H4) | REPO only | Fault path CODE TBD |
| 10 ms / ignition-sync tasks | **Partial** | Foreground `FUN_4815`+EI; HSI/HSO sync in IRQ; exact 10 ms tick TBD |
| EWS fuel lock (H6) | **Unknown** | No claim |

### 7.2 Access-model correction (blocks false “page” xrefs)

`LDB Rx,0xd0, LOOKUP[ZR]` is **register file `0x00D0`**, not ROM page `0xD0`.  
Prior ign/fuel “page-indexed” candidates are **retracted**. Real CAL reads likely go:
`RW6E(=0x1E08) → descriptor → [ptr]` into `0xDxxx`, with internal/low ROM visibility limited (`0x0000–0x1FFF` erased in external image).

### 7.3 Artifacts

- `tools/re/out/irq_ram_publications.{{md,json}}`
- `tools/re/out/sfr_hso_hsi_audit.{{md,json}}`
- `tools/re/out/cal_access_model.{{md,json}}`
- Coverage headline: **{cov['headline']}**

### 7.4 First proven ign/fuel XDF CODE read — status

**None yet** (`{cov['ghidraProvenCodeRead']}/{cov['items']}`). Closest: structural `0xD030` split-ptr in data island; next work is pointer-chase from `@0x432A` / descriptor walk through `0x20C7` interp.
"""


def update_progress(cal, irq, sfr):
    path = OUT / "code_verification_progress.json"
    doc = json.loads(path.read_text()) if path.exists() else {"schemaVersion": 2}
    cov = cal["coverage"]
    doc["engineControl"] = {
        "goal": "control_loops_plus_ignition_fuel_dataflow",
        "completeControlClaimed": False,
        "artifacts": [
            "tools/re/out/control_loops.md",
            "tools/re/out/ignition_fuel_dataflow.md",
            "tools/re/out/irq_ram_publications.md",
            "tools/re/out/sfr_hso_hsi_audit.md",
            "tools/re/out/cal_access_model.md",
            "tools/re/out/motronic_331_function.md",
        ],
        "ignitionFuelCoverage": {
            "items": cov["items"],
            "ghidraProvenCodeRead": cov["ghidraProvenCodeRead"],
            "ghidraProvenPct": cov["ghidraProvenPct"],
            "structuralSplitPtr": cov["structuralSplitPtr"],
            "headline": cov["headline"],
            "note": (
                "v2: retracted false page-index candidates; "
                "proven still requires absolute/indirect ea == XDF offset."
            ),
        },
        "priorityTraces": {
            "irqRamPublications": "done_v1",
            "sfrHsoHsiAudit": "cross_checked",
            "calAccessModel": "corrected_v2",
            "firstProvenIgnFuelXref": False,
        },
    }
    path.write_text(json.dumps(doc, indent=2) + "\n")


def patch_theory_files(section: str):
    for path in (
        OUT / "motronic_331_function.md",
        ROOT / "docs" / "motronic_331_function.md",
    ):
        if not path.exists():
            continue
        text = path.read_text()
        marker = "## 7. Theory vs RedLabel ROM"
        if marker in text:
            # replace from marker to EOF
            text = text.split(marker)[0].rstrip() + "\n" + section.lstrip()
        else:
            # insert before final shipping/see-also if present
            if "## 8." in text:
                text = text.replace("## 8.", section.lstrip() + "\n## 8.")
            else:
                text = text.rstrip() + "\n" + section
        path.write_text(text if text.endswith("\n") else text + "\n")


def refresh_ign_fuel_md(cal):
    """Rewrite ignition_fuel_dataflow coverage section to match v2 model."""
    path = OUT / "ignition_fuel_dataflow.md"
    # Keep a short pointer doc; full item table lives in cal_access_model + json
    cov = cal["coverage"]
    body = f"""# Ignition & fuel dataflow — XDF → DATA → CODE

ROM: `{ROM_NAME}`
ISA: `mcs96_80c196_family`
CODE `0x{CODE_START:04X}`–`0x{CODE_END:04X}`; DATA from `0x{DATA_START:04X}`.
XDF (BRO) = primary definition evidence for names/equations.

## Coverage (v2 — corrected access model)

| Metric | Count | % of {cov['items']} |
|--------|------:|--------------------:|
| **Ghidra-proven CODE read** (ea == XDF offset) | **{cov['ghidraProvenCodeRead']}** | **{cov['ghidraProvenPct']}%** |
| Structural split-ptr (`0xD000`+`0x0030`→`0xD030`) | {cov['structuralSplitPtr']} | {cov['structuralSplitPtrPct']}% |
| Access path unresolved | {cov['accessPathUnresolved']} | — |

{cov['headline']}

> **Correction:** `LDB Rx,0xd0, LOOKUP[ZR]` addresses **register `0x00D0`**, not ROM page `0xD0`.
> Prior “page-indexed” candidate counts are **retracted**. See `cal_access_model.md`.

## How CAL is likely read

1. Map-interp trampoline `0x20C7` → `0x33C2`
2. Descriptor base **RW6E = `0x1E08`** (filled/templated @`0x4ED9`)
3. Indirect `[descriptor]` → axis/map pointers into `0xDxxx` (**targets not yet proven** in this external image)

## Related artifacts

- `cal_access_model.{{md,json}}` — full per-item v2 statuses
- `irq_ram_publications.{{md,json}}` — vec2/vec5 RAM pubs
- `sfr_hso_hsi_audit.{{md,json}}` — HSO write alias
- `motronic_331_function.md` §7 — theory vs ROM checklist

## What is *not* claimed

- Complete spark/fuel output control path
- Proven per-map CODE xrefs (still 0 ghidraProven on XDF ign/fuel offsets)
- Shipping definition updates

---
Research-only. Verification gates for promotion unchanged.
"""
    path.write_text(body)
    # JSON: store v2 items summary
    ign_json = {
        "schemaVersion": 2,
        "id": "ignition_fuel_dataflow_v2",
        "rom": ROM_NAME,
        "coverage": cov,
        "seeAlso": [
            "tools/re/out/cal_access_model.json",
            "tools/re/out/irq_ram_publications.json",
            "tools/re/out/sfr_hso_hsi_audit.json",
        ],
        "items": cal["items"],
        "shippingNote": "Research-only. Do not promote into definitions/packs/*.shipping.json.",
    }
    (OUT / "ignition_fuel_dataflow.json").write_text(json.dumps(ign_json, indent=2) + "\n")


def main():
    lines = load_listing()
    rom_path = ROOT.parent.parent / "public" / "rom" / ROM_NAME
    rom = rom_path.read_bytes() if rom_path.exists() else b""

    # Prefer v1 items list if present for continuity
    prev = json.loads((OUT / "ignition_fuel_dataflow.json").read_text())
    items = prev.get("items") or []

    irq = build_irq_pubs(lines)
    sfr = build_sfr_audit(lines)
    cal = build_cal_access_model(lines, rom, items)

    (OUT / "irq_ram_publications.json").write_text(json.dumps(irq, indent=2) + "\n")
    (OUT / "irq_ram_publications.md").write_text(md_irq(irq))
    (OUT / "sfr_hso_hsi_audit.json").write_text(json.dumps(sfr, indent=2) + "\n")
    (OUT / "sfr_hso_hsi_audit.md").write_text(md_sfr(sfr))
    (OUT / "cal_access_model.json").write_text(json.dumps(cal, indent=2) + "\n")
    (OUT / "cal_access_model.md").write_text(md_cal(cal))

    refresh_ign_fuel_md(cal)
    update_progress(cal, irq, sfr)
    patch_theory_files(theory_vs_rom_section(cal, irq, sfr))

    print(
        json.dumps(
            {
                "provenIgnFuelPct": cal["coverage"]["ghidraProvenPct"],
                "provenCount": cal["coverage"]["ghidraProvenCodeRead"],
                "structuralD030": cal["coverage"]["structuralSplitPtr"],
                "hsoAudit": sfr["conclusion"]["status"],
                "irqHandlers": list(irq["handlers"].keys()),
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
