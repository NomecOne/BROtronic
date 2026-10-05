#!/usr/bin/env python3
"""
Bosch M-Motronic TI theory-vs-ROM pass + register-base recovery.

PRIMARY theory: tools/re/out/ref_pdf_bosch_m_motronic_technical_instruction.md
Does NOT verify shipping from the book alone — CODE×XDF only.

v4 correction:
  Prior RW68=0xD200 / RW6A=0xD978 “exclusive XDF geometry” claims are RETRACTED.
  They were false positives against XDF address layout.

  ROM-proven bases from unique FE24 structure (hi/lo LDB layout) + CMP checks:
    RW68=0x42EC  (CODE parameter island)
    RW6A=0x43F0  (CODE index / fault-id island)
    RW6C=0x1A08  (descriptor RAM; CMP @0x4D60)
    RW6E=0x1E08  (descriptor RAM; CMP @0x481B/0x4D66)
"""

from __future__ import annotations

import json
import re
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "out"
GHIDRA = OUT / "ghidra"
ROM_PATH = Path(__file__).resolve().parents[3] / "public" / "rom" / (
    "BMW DME413 SW623 D466.29 C16x900A 94 RedLabel.bin"
)
ROM_NAME = "BMW DME413 SW623 D466.29 C16x900A 94 RedLabel.bin"

# ROM-proven (FE24 BE hi/lo pairs)
RW68_BASE = 0x42EC
RW6A_BASE = 0x43F0
RW6C_BASE = 0x1A08
RW6E_BASE = 0x1E08
FE24_STRUCT = 0xFE24


def load_listing():
    lines = []
    with (GHIDRA / "ghidra_listing.txt").open() as f:
        for line in f:
            m = re.match(r"^([0-9a-fA-F]+)\s+(.*)$", line.strip())
            if m:
                lines.append((int(m.group(1), 16), m.group(2)))
    return lines


def load_ign_items():
    data = json.loads((OUT / "ignition_fuel_dataflow.json").read_text())
    ign = {}

    def walk(o):
        if isinstance(o, dict):
            if isinstance(o.get("offset"), int):
                ign[o["offset"]] = {
                    "offset": o["offset"],
                    "name": o.get("name") or o.get("title") or o.get("id") or "?",
                    "category": o.get("category"),
                }
            for v in o.values():
                walk(v)
        elif isinstance(o, list):
            for v in o:
                walk(v)

    walk(data)
    return ign


def collect_indexed(lines, reg: str):
    sites = defaultdict(list)
    for a, i in lines:
        m = re.search(rf"(0x[0-9a-fA-F]+),\s*(LOOKUP|TABLE)\[{reg}\]", i)
        m2 = re.search(rf"(0x[0-9a-fA-F]+)\[{reg}\]", i)
        off = None
        if m:
            off = int(m.group(1), 16)
        elif m2:
            off = int(m2.group(1), 16)
        if off is not None:
            sites[off].append({"site": a, "siteHex": f"0x{a:04X}", "insn": i})
    return sites


def verify_fe24_structure(rom: bytes):
    """Unique BE quadruplet at FE24 must match CMP-proven RW6C/RW6E."""
    b = rom[FE24_STRUCT : FE24_STRUCT + 8]
    words = [(b[i] << 8) | b[i + 1] for i in range(0, 8, 2)]
    assert words == [RW68_BASE, RW6A_BASE, RW6C_BASE, RW6E_BASE], words
    # uniqueness
    pat = bytes(
        [
            RW68_BASE >> 8,
            RW68_BASE & 0xFF,
            RW6A_BASE >> 8,
            RW6A_BASE & 0xFF,
            RW6C_BASE >> 8,
            RW6C_BASE & 0xFF,
            RW6E_BASE >> 8,
            RW6E_BASE & 0xFF,
        ]
    )
    assert rom.find(pat) == FE24_STRUCT
    assert rom.find(pat, FE24_STRUCT + 1) < 0
    return {
        "structAt": f"0x{FE24_STRUCT:04X}",
        "layout": "LDB Rhi,-off-1[RW1C]; LDB Rlo,-off[RW1C] (hi byte at lower addr)",
        "words": {
            "RW68": f"0x{RW68_BASE:04X}",
            "RW6A": f"0x{RW6A_BASE:04X}",
            "RW6C": f"0x{RW6C_BASE:04X}",
            "RW6E": f"0x{RW6E_BASE:04X}",
        },
        "cmpCrossCheck": {
            "RW6C": "CMP RW6C,#0x1a08 @0x4D60",
            "RW6E": "CMP RW6E,#0x1e08 @0x481B/0x4D66",
        },
        "loader": "0x2EDB via trampoline 0x20B5 / LCALL 0x412C",
        "uniqueInRom": True,
    }


def build_ti_structural(rom: bytes, lines):
    """Ti 0xD030 split lives at RW68+0x3E / +0x40; CODE reads D000 via +0x3E."""
    assert rom[0x432A] | (rom[0x432B] << 8) == 0xD000
    assert rom[0x432C] | (rom[0x432D] << 8) == 0x0030
    assert RW68_BASE + 0x3E == 0x432A
    assert RW68_BASE + 0x40 == 0x432C

    # Exclusive: LE words D000|0030 as bytes 00 D0 30 00 — unique in whole image
    split_pat = bytes([0x00, 0xD0, 0x30, 0x00])
    assert rom.find(split_pat) == 0x432A
    assert rom.find(split_pat, 0x432A + 1) < 0

    # Twin fragments: island copies Ti CAL neighborhood (exclusive pair)
    frag_a = bytes.fromhex("90655046")
    frag_b = bytes.fromhex("0080c05d00000020")
    assert rom.find(frag_a) == 0x431C and rom.find(frag_a, 0x431D) == 0xD032
    assert rom.find(frag_b) == 0x4322 and rom.find(frag_b, 0x4323) == 0xD038

    sites_3e = []
    sites_40 = []
    for a, i in lines:
        if re.search(r"0x3e,\s*(LOOKUP|TABLE)\[RW68\]|0x3e\[RW68\]", i):
            sites_3e.append({"siteHex": f"0x{a:04X}", "insn": i, "reads": "0xD000"})
        if re.search(r"0x40,\s*(LOOKUP|TABLE)\[RW68\]|0x40\[RW68\]", i):
            sites_40.append({"siteHex": f"0x{a:04X}", "insn": i, "reads": "0x0030"})

    return {
        "target": "0xD030",
        "xdfName": "Inj. Constant(Ti)",
        "domain": "fuel",
        "pageWordAt": "0x432A (RW68+0x3E) = 0xD000",
        "offsetWordAt": "0x432C (RW68+0x40) = 0x0030",
        "composed": "0xD030",
        "exclusiveSplitPattern": "00D03000 unique @0x432A",
        "exclusiveBodyTwins": {
            "90655046": ["0x431C (island)", "0xD032 (CAL)"],
            "0080c05d00000020": ["0x4322 (island)", "0xD038 (CAL)"],
        },
        "codeReadsPageVia": sites_3e,
        "codeReadsOffsetVia": sites_40,
        "contentDerefProven": False,
        "exclusiveGeometry": True,
        "note": (
            "Exclusive structural geometry: unique D000|0030 split under FE24 "
            "RW68, plus Ti body fragments that exist only as island↔CAL twins. "
            "CODE CMP @RW68+0x3E/+0x40 touches the split words (as bounds), not "
            "a content deref of 0xD030."
        ),
        "evidenceStrength": "high_structural_exclusive",
    }


def build_vanos_rpm_axis_exclusive(rom: bytes, ign: dict):
    """Shared 16-byte RPM axis signature — exclusive to 4 fuel + 4 ign VANOS axes."""
    sig = bytes.fromhex("050605070a05070b0909090f12130860")
    locs = []
    start = 0
    while True:
        p = rom.find(sig, start)
        if p < 0:
            break
        locs.append(p)
        start = p + 1
    expected = [0xD984, 0xD9A6, 0xD9C8, 0xDAA8, 0xDD0F, 0xDD89, 0xDE6D, 0xDF4D]
    assert locs == expected, (locs, expected)

    fuel = []
    ignition = []
    for p in locs:
        meta = ign.get(p, {})
        entry = {
            "offset": p,
            "offsetHex": f"0x{p:04X}",
            "name": meta.get("name", "?"),
            "category": meta.get("category"),
        }
        name = (meta.get("name") or "").lower()
        if "ignition" in name or "ign" in name:
            ignition.append(entry)
        else:
            fuel.append(entry)

    return {
        "id": "vanos_rpm_axis_sig_v1",
        "signatureHex": sig.hex(),
        "signatureLen": len(sig),
        "exclusiveLocations": [f"0x{p:04X}" for p in locs],
        "count": len(locs),
        "fuelAxes": fuel,
        "ignitionAxes": ignition,
        "representativeIgnition": ignition[0] if ignition else None,
        "representativeFuel": fuel[0] if fuel else None,
        "exclusiveGeometry": True,
        "codeDerefProven": False,
        "note": (
            "Exclusive content geometry: this 16-byte RPM-axis preamble appears "
            "exactly 8 times in the image — precisely the XDF Fuel/Ign PT|WOT "
            "VANOS RPM axes. Proves table geometry for ≥1 fuel and ≥1 ignition "
            "axis (all 8). Not a CODE LOOKUP[ZR] content read."
        ),
        "evidenceStrength": "high_content_exclusive",
    }


def build_retraction():
    return {
        "retractedClaims": [
            {
                "claim": "RW68=0xD200 index-base cross_checked for 13 MAF/sensor XDF items",
                "reason": (
                    "False positive: offsets under RW68 land in CODE island 0x42EC+, "
                    "not CAL 0xD200+. CMP RW24,0x3e[RW68] reads island word 0xD000, "
                    "not MAF high limit at 0xD23E."
                ),
            },
            {
                "claim": "RW6A=0xD978 exclusive geometry for 6 fuel PT/WOT axis XDF items",
                "reason": (
                    "False positive: RW6A=0x43F0 island holds small fault/descriptor "
                    "indices (e.g. +0x2E → 0x0006), not CAL addresses. Same sites feed "
                    "LCALL 0x6efd/0x6f69 fault packaging."
                ),
            },
        ],
        "scratchRegExclusivesAlsoRejected": (
            "RW24/RW20/RW38 ‘exclusive’ ign geometries rejected — those regs are "
            "scratch (e.g. ADD RW24,RW6A,#imm; LD RW38,RW6C)."
        ),
    }


def build_load_path():
    return {
        "t1_hfm_adc": {
            "scheduleBase": "0x427A",
            "isr": "0xA4AA",
            "mafChannelHypothesis": {
                "channel": "0x0A",
                "dest": "0x1454",
                "evidenceStrength": "medium",
            },
            "note": "ADC path unchanged; MAF transfer 0xD290 CODE read still unresolved.",
        },
        "t2_load_per_stroke": {
            "divuSite": "0x5AEB",
            "productRam": "0x1566",
            "evidenceStrength": "medium",
        },
        "t3_interp_after_load": {
            "sites": [
                {"index": "0xD0", "call": "0x5B06"},
                {"index": "0x30", "call": "0x5B5B"},
            ],
            "interp": "0x20C7 → 0x33C2 via RW6E=0x1E08 descriptors",
            "note": (
                "RW6A island values overlap many LD RW1A,#imm interp indices "
                "(fault/descriptor index table). CAL map targets behind descriptors "
                "still unresolved (default fill 0x42DF)."
            ),
        },
    }


def build_checklist(ti, vanos, load_path):
    ign_rep = vanos["representativeIgnition"]
    return [
        {
            "id": "T1",
            "theory": "Primary load = air-mass kg/h (HFM)",
            "romTarget": "MAF 0xD290; ADC→lookup",
            "status": "partial_code",
            "evidence": (
                "ADC schedule @0x427A (ch 0x0A→0x1454 hyp). Prior RW68→0xD290 claim "
                "retracted. MAF cal CODE read still open (descriptor path)."
            ),
        },
        {
            "id": "T2",
            "theory": "Load = air mass per stroke from mass + speed",
            "romTarget": "D5 filtered load",
            "status": "partial_code",
            "evidence": load_path["t2_load_per_stroke"]["divuSite"]
            + " DIVU by 0x14CC → 0x1566; D5 axis link open.",
        },
        {
            "id": "T3",
            "theory": "ti_base = f(load, injector_constant), λ≈1",
            "romTarget": "Ti 0xD030",
            "status": "exclusive_structural",
            "evidence": ti["note"],
        },
        {
            "id": "T4",
            "theory": "Correction stack + Vbat + lambda + overrun cut",
            "romTarget": "Enrich / O2 / voltage / cut",
            "status": "xdf_only",
            "evidence": "XDF present; CODE stack order TBD.",
        },
        {
            "id": "T5",
            "theory": "zw_base = map(load, rpm) + corrections − knock",
            "romTarget": "PT/WOT ign VANOS; knock",
            "status": "exclusive_geometry_axes",
            "evidence": (
                f"VANOS RPM axis signature exclusive @ {ign_rep['offsetHex']} "
                f"(+7 siblings). Main zw map body CODE read still open."
            ),
        },
        {
            "id": "T6",
            "theory": "Dwell = f(Vbat, rpm)",
            "romTarget": "0xE0DA",
            "status": "xdf_only",
            "evidence": "XDF named; no CODE read this pass.",
        },
        {
            "id": "T7",
            "theory": "TPS secondary / limp load",
            "romTarget": "Alpha-N 0xDBC3",
            "status": "xdf_only",
            "evidence": "Strong XDF; fault path CODE TBD.",
        },
        {
            "id": "T8",
            "theory": "Camshaft control expander",
            "romTarget": "VANOS dual maps",
            "status": "exclusive_geometry_axes",
            "evidence": (
                "PT/WOT fuel+ign VANOS RPM axes share exclusive 16-byte signature "
                "(8/8 XDF match). Selector CODE TBD."
            ),
        },
    ]


def build_doc(rom, lines, ign):
    fe24 = verify_fe24_structure(rom)
    ti = build_ti_structural(rom, lines)
    vanos = build_vanos_rpm_axis_exclusive(rom, ign)
    load_path = build_load_path()
    retraction = build_retraction()
    checklist = build_checklist(ti, vanos, load_path)
    n = len(ign)
    # Exclusive geometry items: Ti + 8 VANOS RPM axes
    exclusive_items = 1 + vanos["count"]
    exclusive_pct = round(100.0 * exclusive_items / n, 2)
    return {
        "schemaVersion": 5,
        "id": "bosch_ti_theory_vs_rom_v5",
        "rom": ROM_NAME,
        "primaryTheory": "tools/re/out/ref_pdf_bosch_m_motronic_technical_instruction.md",
        "shippingNote": (
            "Book is PRIMARY family theory only. Do not verify or promote shipping "
            "maps from the PDF alone."
        ),
        "registerBasesRomProven": fe24,
        "retraction": retraction,
        "tiStructural": ti,
        "vanosRpmAxisExclusive": vanos,
        "coverage": {
            "ignFuelItems": n,
            "ghidraProvenAbsolute": 0,
            "ghidraProvenAbsolutePct": 0.0,
            "indexBaseCrossCheckedCalContent": 0,
            "indexBaseCrossCheckedCalContentPct": 0.0,
            "exclusiveGeometry": exclusive_items,
            "exclusiveGeometryPct": exclusive_pct,
            "structuralSplitPtr": 1,
            "registerBasesRomProven": 4,
            "headline": (
                f"0.0% absolute (0/{n}); 0% CAL-content index-base (D200/D978 "
                f"retracted); {exclusive_pct}% exclusive geometry "
                f"({exclusive_items}/{n}: Ti structural + {vanos['count']} VANOS "
                f"RPM axes); 4 ROM-proven FE24 bases."
            ),
            "note": (
                "v5: retracted false D200/D978 XDF-geometry xrefs. Raised "
                "exclusive-geometry proofs for ≥1 fuel (Ti 0xD030) and ≥1 "
                "ignition (VANOS RPM axes e.g. 0xDD0F). Absolute CODE content "
                "reads still 0."
            ),
        },
        "checklist": checklist,
        "loadPath": load_path,
        "keyCodeSites": {
            "fe24Loader": "0x2EDB via 0x20B5 / 0x412C",
            "tiPageCmp": [s["siteHex"] for s in ti["codeReadsPageVia"]],
            "tiOffCmp": [s["siteHex"] for s in ti["codeReadsOffsetVia"]],
            "mapInterp": "0x20C7 → 0x33C2 (RW6E descriptors)",
            "postLoadTiSlots": ["0x5B06 RW1A=#0xD0", "0x5B5B RW1A=#0x30"],
            "vanosAxisRom": vanos["exclusiveLocations"],
        },
        "nextToProve": [
            "Compose D000+|0030 from island into a pointer and [deref] Ti content",
            "Find descriptor-table patches that replace 0x42DF with 0xDxxx map pointers",
            "CODE walk of one VANOS RPM axis (sig @0xDD0F family) via interp",
            "Absolute LOOKUP[ZR] for one fuel map body and one ign map body",
        ],
    }


def md_theory(doc):
    cov = doc["coverage"]
    rb = doc["registerBasesRomProven"]
    ti = doc["tiStructural"]
    vanos = doc["vanosRpmAxisExclusive"]
    sites = doc["keyCodeSites"]
    lines = [
        "# Theory vs ROM — Bosch M-Motronic TI (PRIMARY) × RedLabel",
        "",
        f"ROM: `{doc['rom']}`",
        f"Theory: [`ref_pdf_bosch_m_motronic_technical_instruction.md`](ref_pdf_bosch_m_motronic_technical_instruction.md)",
        "",
        f"> {doc['shippingNote']}",
        "",
        "## Coverage (v5)",
        "",
        "| Metric | Count | % of 69 |",
        "|--------|------:|--------:|",
        f"| Absolute `LOOKUP[ZR]` proven (ea == XDF) | **{cov['ghidraProvenAbsolute']}** | **{cov['ghidraProvenAbsolutePct']}%** |",
        f"| CAL-content index-base cross_checked | **{cov['indexBaseCrossCheckedCalContent']}** | **{cov['indexBaseCrossCheckedCalContentPct']}%** |",
        f"| **Exclusive geometry** (fuel Ti + VANOS RPM axes) | **{cov['exclusiveGeometry']}** | **{cov['exclusiveGeometryPct']}%** |",
        f"| Structural split-ptr (`0xD030`) | {cov['structuralSplitPtr']} | 1.45% |",
        f"| ROM-proven register bases (FE24) | {cov['registerBasesRomProven']} | — |",
        "",
        cov["headline"],
        "",
        f"> {cov['note']}",
        "",
        "## ROM-proven register bases",
        "",
        f"Unique structure @ `{rb['structAt']}` (`{rb['layout']}`):",
        "",
        "| Reg | Value | Role |",
        "|-----|-------|------|",
        f"| RW68 | `{rb['words']['RW68']}` | CODE parameter island |",
        f"| RW6A | `{rb['words']['RW6A']}` | CODE index / fault-id island |",
        f"| RW6C | `{rb['words']['RW6C']}` | Descriptor RAM (`{rb['cmpCrossCheck']['RW6C']}`) |",
        f"| RW6E | `{rb['words']['RW6E']}` | Descriptor RAM (`{rb['cmpCrossCheck']['RW6E']}`) |",
        "",
        f"Loader: `{rb['loader']}`.",
        "",
        "## Retraction (important)",
        "",
    ]
    for r in doc["retraction"]["retractedClaims"]:
        lines += [f"- **Retracted:** {r['claim']}", f"  - {r['reason']}", ""]
    lines += [
        doc["retraction"]["scratchRegExclusivesAlsoRejected"],
        "",
        "## Fuel exclusive geometry — Ti `0xD030`",
        "",
        f"- Target `{ti['target']}` {ti['xdfName']}",
        f"- {ti['pageWordAt']}; {ti['offsetWordAt']} → `{ti['composed']}`",
        f"- Exclusive split: `{ti['exclusiveSplitPattern']}`",
        f"- Body twins: `{list(ti['exclusiveBodyTwins'].keys())}` island↔CAL only",
        f"- CODE CMP of page `0xD000` via RW68+0x3E: "
        + ", ".join(f"`{s}`" for s in sites["tiPageCmp"]),
        f"- CODE CMP of offset `0x0030` via RW68+0x40: "
        + (", ".join(f"`{s}`" for s in sites["tiOffCmp"]) or "_none_"),
        f"- Content deref proven: **{ti['contentDerefProven']}**",
        f"- {ti['note']}",
        "",
        "## Ignition (+fuel) exclusive geometry — VANOS RPM axes",
        "",
        f"- Signature `{vanos['signatureHex']}` (len {vanos['signatureLen']}) — "
        f"**exactly {vanos['count']}** ROM hits, all XDF VANOS RPM axes:",
        "",
        "| Offset | Domain | Name |",
        "|--------|--------|------|",
    ]
    for e in vanos["fuelAxes"] + vanos["ignitionAxes"]:
        dom = "ign" if e in vanos["ignitionAxes"] else "fuel"
        lines.append(f"| `{e['offsetHex']}` | {dom} | {e['name'][:55]} |")
    lines += [
        "",
        f"- Representative ignition: `{vanos['representativeIgnition']['offsetHex']}`",
        f"- Representative fuel: `{vanos['representativeFuel']['offsetHex']}`",
        f"- CODE deref of axis body: **{vanos['codeDerefProven']}** (descriptor path open)",
        f"- {vanos['note']}",
        "",
        "## T1–T8 checklist",
        "",
        "| ID | Theory | Status | Evidence |",
        "|----|--------|--------|----------|",
    ]
    for r in doc["checklist"]:
        lines.append(
            f"| {r['id']} | {r['theory']} | `{r['status']}` | {r['evidence']} |"
        )
    lines += [
        "",
        "## Key CODE sites",
        "",
        f"- FE24 loader: `{sites['fe24Loader']}`",
        f"- Map interp: `{sites['mapInterp']}`",
        f"- Post-load Ti-related slots: {', '.join(f'`{s}`' for s in sites['postLoadTiSlots'])}",
        f"- Ti page/off CMPs: {', '.join(f'`{s}`' for s in sites['tiPageCmp'] + sites['tiOffCmp'])}",
        "",
        "## Next",
        "",
    ]
    for n in doc["nextToProve"]:
        lines.append(f"1. {n}")
    lines += ["", "---", "Research-only. Verification gates unchanged.", ""]
    return "\n".join(lines)


def md_bases(doc):
    rb = doc["registerBasesRomProven"]
    vanos = doc["vanosRpmAxisExclusive"]
    lines = [
        "# Register bases — ROM-proven (FE24)",
        "",
        f"ROM: `{doc['rom']}`",
        "",
        f"**Structure @ `{rb['structAt']}`** (unique in image):",
        "",
        "| Reg | Value |",
        "|-----|-------|",
    ]
    for k, v in rb["words"].items():
        lines.append(f"| `{k}` | `{v}` |")
    lines += [
        "",
        f"Loader: `{rb['loader']}`. CMP cross-check: "
        f"`{rb['cmpCrossCheck']['RW6C']}`; `{rb['cmpCrossCheck']['RW6E']}`.",
        "",
        "## Retraction",
        "",
        "Do **not** use prior `RW68=0xD200` / `RW6A=0xD978` XDF-geometry tables — retracted in v4/v5.",
        "",
        "## Exclusive geometry (v5)",
        "",
        "- Fuel Ti `0xD030`: unique `D000|0030` @`0x432A` (RW68+0x3E/+0x40)",
        f"- VANOS RPM axes: signature `{vanos['signatureHex']}` @ "
        + ", ".join(f"`{x}`" for x in vanos["exclusiveLocations"]),
        "",
        "See `theory_vs_rom_bosch_ti.md`.",
        "",
    ]
    return "\n".join(lines)


def patch_progress(doc):
    path = OUT / "code_verification_progress.json"
    prog = json.loads(path.read_text())
    cov = doc["coverage"]
    # Deduplicate openFollowUps
    follows = prog.get("codeVerification", {}).get("openFollowUps", [])
    seen = set()
    deduped = []
    for f in follows:
        if f not in seen:
            seen.add(f)
            deduped.append(f)
    # Replace stale D200 follow-ups
    deduped = [
        f
        for f in deduped
        if "RW68 index-base" not in f and "0xD200" not in f and "18.84%" not in f
    ]
    deduped.extend(
        [
            "Engine control: 0% absolute; exclusive geometry 9/69 (Ti+VANOS axes) — chase descriptor→0xDxxx deref",
            "Compose island D000+|0030 and [deref] Ti; CODE-walk one VANOS RPM axis",
        ]
    )
    # dedupe again
    seen = set()
    final = []
    for f in deduped:
        if f not in seen:
            seen.add(f)
            final.append(f)
    prog["codeVerification"]["openFollowUps"] = final
    prog["engineControl"]["ignitionFuelCoverage"] = {
        "items": cov["ignFuelItems"],
        "ghidraProvenCodeRead": cov["ghidraProvenAbsolute"],
        "ghidraProvenPct": cov["ghidraProvenAbsolutePct"],
        "indexBaseCrossCheckedCalContent": cov["indexBaseCrossCheckedCalContent"],
        "indexBaseCrossCheckedCalContentPct": cov["indexBaseCrossCheckedCalContentPct"],
        "exclusiveGeometry": cov["exclusiveGeometry"],
        "exclusiveGeometryPct": cov["exclusiveGeometryPct"],
        "structuralSplitPtr": cov["structuralSplitPtr"],
        "registerBasesRomProven": cov["registerBasesRomProven"],
        "headline": cov["headline"],
        "note": cov["note"],
    }
    if "register_bases_fe24.md" not in prog["engineControl"]["artifacts"]:
        prog["engineControl"]["artifacts"].append("tools/re/out/register_bases_fe24.md")
    prog["engineControl"]["priorityTraces"]["boschTiTheoryVsRom"] = "done_v5_exclusive_geometry"
    prog["engineControl"]["priorityTraces"]["rw68IndexBase"] = "retracted_d200_false_positive"
    prog["engineControl"]["priorityTraces"]["registerBasesFe24"] = "rom_proven"
    prog["engineControl"]["priorityTraces"]["firstProvenIgnFuelXref"] = False
    prog["engineControl"]["priorityTraces"]["exclusiveGeometryFuelIgn"] = "ti_plus_vanos_rpm_axes"
    path.write_text(json.dumps(prog, indent=2) + "\n")


def patch_ignition_md(doc):
    cov = doc["coverage"]
    ti = doc["tiStructural"]
    vanos = doc["vanosRpmAxisExclusive"]
    sites = doc["keyCodeSites"]
    path = OUT / "ignition_fuel_dataflow.md"
    vanos_rows = "\n".join(
        f"| `{e['offsetHex']}` | {'ign' if e in vanos['ignitionAxes'] else 'fuel'} | {e['name'][:50]} |"
        for e in vanos["fuelAxes"] + vanos["ignitionAxes"]
    )
    path.write_text(
        f"""# Ignition & fuel dataflow — XDF → DATA → CODE

ROM: `BMW DME413 SW623 D466.29 C16x900A 94 RedLabel.bin`
ISA: `mcs96_80c196_family`
CODE `0x2000`–`0xB930`; DATA from `0xB931`.
XDF (BRO) = primary definition evidence for names/equations.

## Coverage (v5 — exclusive geometry; D200/D978 retracted)

| Metric | Count | % of 69 |
|--------|------:|--------:|
| **Absolute `LOOKUP[ZR]` proven** (ea == XDF offset) | **{cov['ghidraProvenAbsolute']}** | **{cov['ghidraProvenAbsolutePct']}%** |
| **CAL-content index-base cross_checked** | **{cov['indexBaseCrossCheckedCalContent']}** | **{cov['indexBaseCrossCheckedCalContentPct']}%** |
| **Exclusive geometry** (Ti + VANOS RPM axes) | **{cov['exclusiveGeometry']}** | **{cov['exclusiveGeometryPct']}%** |
| Structural split-ptr (`0xD000`+`0x0030`→`0xD030`) | {cov['structuralSplitPtr']} | 1.45% |
| ROM-proven register bases (FE24) | {cov['registerBasesRomProven']} | — |

{cov['headline']}

> **v5:** `RW68=0xD200` (13) and `RW6A=0xD978` (6) retracted as false positives.
> Real bases: `RW68=0x42EC`, `RW6A=0x43F0`, `RW6C=0x1A08`, `RW6E=0x1E08`.
> New: exclusive geometry for fuel Ti + ign/fuel VANOS RPM axes.

## How CAL is read (corrected model)

1. **Parameter island** `RW68=0x42EC` — scalars / page markers (incl. `D000`+`0030` at +0x3E/+0x40)
2. **Index island** `RW6A=0x43F0` — small fault / descriptor indices (feed `0x6efd` / `RW1A` interp)
3. **Map interp** `0x20C7`→`0x33C2` via descriptor table `RW6E=0x1E08` (targets still unresolved)
4. **Exclusive Ti** `0xD030` — unique island split + body twins; CODE CMP touches
5. **Exclusive VANOS RPM axes** — shared 16-byte signature at 8 XDF offsets (4 fuel + 4 ign)

## Fuel exclusive — Ti `0xD030`

- Split `{ti['exclusiveSplitPattern']}`
- Body twins island↔CAL only
- CODE sites: {', '.join(f'`{s}`' for s in sites['tiPageCmp'] + sites['tiOffCmp'])}
- Content deref: **{ti['contentDerefProven']}**

## Ignition (+fuel) exclusive — VANOS RPM axes

Signature `{vanos['signatureHex']}` — exactly {vanos['count']} hits:

| Offset | Domain | Name |
|--------|--------|------|
{vanos_rows}

Representative ign: `{vanos['representativeIgnition']['offsetHex']}`; fuel: `{vanos['representativeFuel']['offsetHex']}`.
CODE axis deref: **{vanos['codeDerefProven']}**.

## Key CODE sites

- FE24 loader `{sites['fe24Loader']}`
- Interp `{sites['mapInterp']}`
- Post-load slots {', '.join(f'`{s}`' for s in sites['postLoadTiSlots'])}

## Related artifacts

- `theory_vs_rom_bosch_ti.{{md,json}}` — T1–T8 + retraction + exclusive geometry
- `register_bases_fe24.{{md,json}}` — FE24 proven bases
- `cal_access_model.{{md,json}}` — absolute-path attempt
- `irq_ram_publications.{{md,json}}` / `sfr_hso_hsi_audit.{{md,json}}`

## What is *not* claimed

- Shipping promotion from Bosch PDF or retracted geometry
- Absolute `LOOKUP[ZR]` CAL *content* reads of fuel/ign map bodies (still 0)
- End-to-end HFM→ti→ign control

---
Research-only. Verification gates for promotion unchanged.
"""
    )


def patch_ref_pdf(doc):
    path = OUT / "ref_pdf_bosch_m_motronic_technical_instruction.md"
    text = path.read_text()
    start = text.find("## 5. Theory → RedLabel ROM checklist")
    end = text.find("## 6. Cloud RE handoff note")
    if start < 0 or end < 0:
        return
    cov = doc["coverage"]
    rows = doc["checklist"]
    block = [
        "## 5. Theory → RedLabel ROM checklist (use in cloud/local RE)",
        "",
        "Use this PDF as **expected structure**; prove or refute in MCS-96 CODE:",
        "",
        "| # | Theory (this PDF) | ROM / XDF target | Status |",
        "|---|-------------------|------------------|--------|",
    ]
    for r in rows:
        block.append(
            f"| {r['id']} | {r['theory']} | {r['romTarget']} | `{r['status']}` — {r['evidence']} |"
        )
    block += [
        "",
        f"**Coverage (CODE×XDF, not book):** {cov['headline']}",
        "",
        "**Do not** promote shipping maps from this PDF alone.",
        "",
        "Detail: [`theory_vs_rom_bosch_ti.md`](theory_vs_rom_bosch_ti.md). "
        "v4 retracted false D200/D978 index-base claims.",
        "",
        "---",
        "",
    ]
    path.write_text(text[:start] + "\n".join(block) + text[end:])


def patch_motronic(doc):
    cov = doc["coverage"]
    vanos = doc["vanosRpmAxisExclusive"]
    sites = doc["keyCodeSites"]
    section = f"""## 7. Theory vs RedLabel ROM (this RE pass)

Cross-check of Bosch M-Motronic TI (PRIMARY extract) against MCS-96 listing / XDF.
**Still not end-to-end CODE+DATA control. Book alone does not verify shipping.**

### 7.1 Bosch T1–T8 checklist

See [`theory_vs_rom_bosch_ti.md`](theory_vs_rom_bosch_ti.md). Headline: T3 Ti = `exclusive_structural`; T5/T8 VANOS axes = `exclusive_geometry_axes`; prior D200/D978 index-base claims **retracted**.

### 7.2 Access-model update (v5)

`LDB Rx,0xd0, LOOKUP[ZR]` remains register file `0x00D0`.

**ROM-proven bases (FE24):** `RW68=0x42EC`, `RW6A=0x43F0`, `RW6C=0x1A08`, `RW6E=0x1E08`.

**Retracted:** `RW68=0xD200` (13 items) and `RW6A=0xD978` (6 fuel axes) — false XDF-geometry positives.

**Exclusive geometry:**
- Fuel Ti `0xD030` — unique `D000|0030` @`0x432A` + island↔CAL body twins; CODE CMP `{', '.join(sites['tiPageCmp'])}`
- Ign/fuel VANOS RPM axes — signature `{vanos['signatureHex']}` at exactly 8 XDF offsets (rep ign `{vanos['representativeIgnition']['offsetHex']}`)

### 7.3 Artifacts

- `tools/re/out/theory_vs_rom_bosch_ti.{{md,json}}`
- `tools/re/out/register_bases_fe24.{{md,json}}`
- Coverage: **{cov['headline']}**

### 7.4 First absolute / CAL-content ign/fuel XDF CODE read — status

**None yet** (`0/69` absolute; `0/69` CAL-content index-base after retraction). Exclusive geometry: **{cov['exclusiveGeometry']}/69**. Closest CODE: Ti split CMPs + interp `0x20C7`.

"""
    for path in [OUT / "motronic_331_function.md", ROOT / "docs" / "motronic_331_function.md"]:
        if not path.exists():
            continue
        text = path.read_text()
        marker = "## 7. Theory vs RedLabel ROM (this RE pass)"
        end = text.find("## 8. Research session notes")
        start = text.find(marker)
        if start < 0 or end < 0:
            continue
        path.write_text(text[:start] + section + text[end:])


def main():
    lines = load_listing()
    ign = load_ign_items()
    assert ROM_PATH.exists(), ROM_PATH
    rom = ROM_PATH.read_bytes()
    doc = build_doc(rom, lines, ign)

    (OUT / "theory_vs_rom_bosch_ti.json").write_text(json.dumps(doc, indent=2) + "\n")
    (OUT / "theory_vs_rom_bosch_ti.md").write_text(md_theory(doc))
    (OUT / "register_bases_fe24.json").write_text(
        json.dumps(
            {
                "schemaVersion": 1,
                "id": "register_bases_fe24_v1",
                "rom": ROM_NAME,
                **doc["registerBasesRomProven"],
                "retraction": doc["retraction"],
                "tiStructural": doc["tiStructural"],
                "vanosRpmAxisExclusive": doc["vanosRpmAxisExclusive"],
            },
            indent=2,
        )
        + "\n"
    )
    (OUT / "register_bases_fe24.md").write_text(md_bases(doc))

    # Replace old rw68_cal_index_base with retraction stub
    (OUT / "rw68_cal_index_base.md").write_text(
        "# RW68 CAL index base — RETRACTED\n\n"
        "Prior `RW68=0xD200` cross_checked table is **retracted** (v4/v5 false positive).\n\n"
        "Real `RW68=0x42EC` — see `register_bases_fe24.md`.\n\n"
        "Replacement exclusive proofs: Ti `0xD030` structural + VANOS RPM axis signature "
        "(see `theory_vs_rom_bosch_ti.md`).\n"
    )
    (OUT / "rw68_cal_index_base.json").write_text(
        json.dumps(
            {
                "schemaVersion": 2,
                "id": "rw68_cal_index_base_v2_retracted",
                "status": "retracted",
                "replacedBy": "register_bases_fe24_v1 + vanos_rpm_axis_sig_v1",
                "priorFalseBase": "0xD200",
                "provenBase": "0x42EC",
            },
            indent=2,
        )
        + "\n"
    )

    ign_path = OUT / "ignition_fuel_dataflow.json"
    ign_doc = json.loads(ign_path.read_text())
    ign_doc["coverage"] = {"schemaVersion": 5, **doc["coverage"]}
    ign_doc["exclusiveGeometry"] = {
        "ti": doc["tiStructural"],
        "vanosRpmAxes": doc["vanosRpmAxisExclusive"],
    }
    ign_doc["keyCodeSites"] = doc["keyCodeSites"]
    # Mark exclusive items in items list if present
    items = ign_doc.get("items")
    if isinstance(items, list):
        vanos_set = {int(x, 16) for x in doc["vanosRpmAxisExclusive"]["exclusiveLocations"]}
        for it in items:
            off = it.get("offset")
            if off == 0xD030:
                it["codeReadStatus"] = "exclusive_structural_split_ptr"
                it["evidenceStrength"] = "high"
                it["exclusiveGeometry"] = True
            elif off in vanos_set:
                it["codeReadStatus"] = "exclusive_content_geometry_axis"
                it["evidenceStrength"] = "high"
                it["exclusiveGeometry"] = True
    ign_path.write_text(json.dumps(ign_doc, indent=2) + "\n")

    patch_ignition_md(doc)
    patch_progress(doc)
    patch_ref_pdf(doc)
    patch_motronic(doc)

    # cal_access_model.md quick patch
    cal_md = OUT / "cal_access_model.md"
    if cal_md.exists():
        text = cal_md.read_text()
        marker = "## Index-base path (v3 addendum)"
        if marker in text:
            text = text.split(marker)[0].rstrip() + "\n\n"
            text += """## Index-base path — RETRACTED (v5)

Prior `RW68=0xD200` / `RW6A=0xD978` “exclusive XDF geometry” claims are **false positives**.
ROM-proven bases from FE24: `RW68=0x42EC`, `RW6A=0x43F0`, `RW6C=0x1A08`, `RW6E=0x1E08`.

## Exclusive geometry (v5 replacement)

1. **Fuel Ti `0xD030`:** unique `D000|0030` @`0x432A` (RW68+0x3E/+0x40) + island↔CAL body twins
2. **Ign/fuel VANOS RPM axes:** 16-byte signature exclusive to 8 XDF axis starts (rep ign `0xDD0F`)

See `theory_vs_rom_bosch_ti.md` / `register_bases_fe24.md`.

## Next to prove first *absolute* XDF CODE read

1. Compose D000+|0030 from island and `[deref]` Ti content
1. Trace one `0x20C7` interp call through `[RW4C]` to a `0xDxxx` pointer
1. CODE-walk one VANOS RPM axis from the exclusive signature set

---
Research-only. Verification gates unchanged. No shipping promotion.
"""
            cal_md.write_text(text)

    # handoff
    handoff = OUT / "cloud_re_handoff_pdf.md"
    ht = handoff.read_text()
    if "## Status after theory-vs-ROM pass" in ht:
        ht = ht.split("## Status after theory-vs-ROM pass")[0].rstrip() + "\n\n"
    ht += f"""## Status after theory-vs-ROM pass (v5)

- **Retraction:** D200 (13) / D978 (6) index-base claims were false positives.
- **ROM-proven bases (FE24):** RW68=`0x42EC`, RW6A=`0x43F0`, RW6C=`0x1A08`, RW6E=`0x1E08`
- **Coverage:** {doc['coverage']['headline']}
- **Fuel exclusive:** Ti `0xD030` — unique split @`0x432A`; CODE CMP {doc['keyCodeSites']['tiPageCmp']}
- **Ign exclusive:** VANOS RPM axes sig @ {doc['vanosRpmAxisExclusive']['exclusiveLocations']} (rep `{doc['vanosRpmAxisExclusive']['representativeIgnition']['offsetHex']}`)
- **Next:** descriptor → 0xDxxx deref; compose+deref Ti; CODE-walk one VANOS axis
"""
    handoff.write_text(ht)

    print(doc["coverage"]["headline"])
    print("FE24 bases:", doc["registerBasesRomProven"]["words"])
    print("Ti sites +3E:", [s["siteHex"] for s in doc["tiStructural"]["codeReadsPageVia"]])
    print("VANOS axes:", doc["vanosRpmAxisExclusive"]["exclusiveLocations"])


if __name__ == "__main__":
    main()
