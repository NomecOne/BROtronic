#!/usr/bin/env python3
"""
Bosch M-Motronic TI theory-vs-ROM pass + RW68 CAL index-base xrefs.

PRIMARY theory: tools/re/out/ref_pdf_bosch_m_motronic_technical_instruction.md
Does NOT verify shipping from the book alone — CODE×XDF only.
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

# MAF-related offsets under RW68 that uniquely force base 0xD200 against ign/fuel XDF.
MAF_QUARTET = (0x3E, 0x40, 0x44, 0x90)


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


def collect_rw68_sites(lines):
    sites = defaultdict(list)
    for a, i in lines:
        m = re.search(r"(0x[0-9a-fA-F]+),\s*(LOOKUP|TABLE)\[RW68\]", i)
        m2 = re.search(r"(0x[0-9a-fA-F]+)\[RW68\]", i)
        off = None
        if m:
            off = int(m.group(1), 16)
        elif m2:
            off = int(m2.group(1), 16)
        if off is not None:
            sites[off].append({"site": a, "siteHex": f"0x{a:04X}", "insn": i})
    return sites


def unique_bases_for_offsets(offsets, ign):
    """Return bases where every offset lands on an ign/fuel XDF item."""
    bases = []
    for base in range(0, 0x10000):
        if all((base + o) in ign for o in offsets):
            bases.append(base)
    return bases


def build_rw68_model(lines, ign):
    sites = collect_rw68_sites(lines)
    bases = unique_bases_for_offsets(MAF_QUARTET, ign)
    assert bases == [0xD200], f"expected unique base 0xD200, got {bases!r}"

    xrefs = []
    by_target = defaultdict(list)
    for off, sl in sites.items():
        ea = 0xD200 + off
        if ea not in ign:
            continue
        for s in sl:
            rec = {
                **s,
                "indexOffset": off,
                "indexOffsetHex": f"0x{off:02X}",
                "target": ea,
                "targetHex": f"0x{ea:04X}",
                "xdfName": ign[ea]["name"],
                "base": 0xD200,
                "baseHex": "0xD200",
                "baseRegister": "RW68",
                "proof": "unique_maf_offset_quartet",
                "ghidraProvenAbsolute": False,
                "indexBaseCrossChecked": True,
            }
            xrefs.append(rec)
            by_target[ea].append(rec)

    return {
        "schemaVersion": 1,
        "id": "rw68_cal_index_base_v1",
        "rom": ROM_NAME,
        "baseRegister": "RW68",
        "base": 0xD200,
        "baseHex": "0xD200",
        "proof": {
            "method": "unique_xdf_geometry",
            "constraintOffsets": [f"0x{o:02X}" for o in MAF_QUARTET],
            "constraintTargets": [f"0x{0xD200 + o:04X}" for o in MAF_QUARTET],
            "uniqueBases": ["0xD200"],
            "note": (
                "Only base 0xD200 makes RW68+{0x3E,0x40,0x44,0x90} land simultaneously "
                "on MAF high/low/ratio/cal XDF items. No LD RW68,#imm in external image "
                "(0x0000–0x1FFF erased); base is cross_checked by geometry, not by "
                "immediate load."
            ),
            "ldImmediateInExternalImage": False,
        },
        "xrefs": sorted(xrefs, key=lambda r: (r["target"], r["site"])),
        "uniqueTargets": sorted(by_target),
        "uniqueTargetCount": len(by_target),
        "siteCount": len(xrefs),
        "targets": {
            f"0x{ea:04X}": {
                "offset": ea,
                "name": ign[ea]["name"],
                "siteCount": len(by_target[ea]),
                "sites": [r["siteHex"] for r in by_target[ea]],
            }
            for ea in sorted(by_target)
        },
    }


def build_load_path(lines):
    """Bosch T1–T3 CODE chain fragments already traced."""
    adc_table = [
        {"channel": 0x0E, "dest": 0x129A},
        {"channel": 0x0B, "dest": 0x1453},
        {"channel": 0x0A, "dest": 0x1454},
        {"channel": 0x0D, "dest": 0x1451},
        {"channel": 0x09, "dest": 0x1452},
        {"channel": 0x0C, "dest": 0x12BE},
        {"channel": 0x0A, "dest": 0x1454},
        {"channel": 0x0A, "dest": 0x1454},
        {"channel": 0x0A, "dest": 0x1454},
        {"channel": 0x09, "dest": 0x1450},
    ]
    return {
        "t1_hfm_adc": {
            "scheduleBase": "0x427A",
            "scheduleEnd": "0x42A0",
            "isr": "0xA4AA",
            "mechanism": (
                "vec5 loads channel word then dest word from schedule; "
                "LDB AD_resultlo,R44 kicks channel; STB AD_resulthi,[RW44] stores sample."
            ),
            "entries": [
                {
                    "channel": f"0x{e['channel']:02X}",
                    "destHex": f"0x{e['dest']:04X}",
                    "note": (
                        "highest sample rate (×4)"
                        if e["channel"] == 0x0A
                        else None
                    ),
                }
                for e in adc_table
            ],
            "mafChannelHypothesis": {
                "channel": "0x0A",
                "dest": "0x1454",
                "reason": "most frequent schedule slot; consumers do range/fault checks",
                "evidenceStrength": "medium",
            },
        },
        "t2_load_per_stroke": {
            "periodPub": {"ram": "0x14CC", "writer": "0xAA8F (vec2)", "role": "derived_period_scale"},
            "divuSite": "0x5AEB",
            "divuInsn": "DIVU RL48,0x14cc, TABLE[ZR]",
            "productRam": "0x1566",
            "storeSite": "0x5AFD",
            "consumer": "0xB212 LD RW38,0x1566",
            "note": (
                "Foreground scales a quantity by 1/period (×0x9C40) into 0x1566 — "
                "candidate air-mass-per-stroke / load index (Bosch p.38). Not yet "
                "tied to XDF D5 filtered-load axis by CODE proof."
            ),
            "evidenceStrength": "medium",
        },
        "t3_interp_after_load": {
            "sites": [
                {"ld": "0x5B02", "index": "0xD0", "call": "0x5B06 LCALL 0x20C7"},
                {"ld": "0x5B57", "index": "0x30", "call": "0x5B5B LCALL 0x20C7"},
            ],
            "interp": "0x20C7 → 0x33C2; ADD RW1A,RW6E; LD RW4C,[RW1A]",
            "descriptorTable": "RW6E=0x1E08 (default fill 0x42DF @0x4ED9)",
            "note": (
                "Post-load interp indices 0xD0 / 0x30 are descriptor slots, not ROM "
                "page bytes. CAL target behind slot still unresolved in external image."
            ),
            "evidenceStrength": "high_for_mechanism",
        },
    }


def build_theory_checklist(rw68, load_path, ign):
    n = len(ign)
    idx_n = rw68["uniqueTargetCount"]
    rows = [
        {
            "id": "T1",
            "theory": "Primary load = air-mass kg/h (HFM)",
            "romTarget": "MAF 0xD290; ADC→lookup",
            "status": "partial_code",
            "evidence": (
                f"ADC schedule @0x427A (ch 0x0A→0x1454 high-rate hyp); "
                f"RW68+0x90→0xD290 CODE site @0x68CD (index-base cross_checked); "
                f"MAF fault limits 0xD23E/D240/D244 via RW68."
            ),
        },
        {
            "id": "T2",
            "theory": "Load = air mass per stroke from mass + speed",
            "romTarget": "D5 filtered load (inj-time referred)",
            "status": "partial_code",
            "evidence": (
                "vec2 0x14CC period → DIVU @0x5AEB → ST 0x1566 @0x5AFD; "
                "consumer @0xB212. XDF D5 axis link still open."
            ),
        },
        {
            "id": "T3",
            "theory": "ti_base = f(load, injector_constant), λ≈1",
            "romTarget": "Ti 0xD030 + PT/WOT fuel maps",
            "status": "structural_only",
            "evidence": (
                "Structural 0xD000+0x0030 @0x432A; post-load LCALL 0x20C7 "
                "RW1A=#0xD0/#0x30. No CODE deref of 0xD030 yet."
            ),
        },
        {
            "id": "T4",
            "theory": "Correction stack + Vbat + lambda + overrun cut",
            "romTarget": "Enrich / O2 / voltage / cut tables",
            "status": "xdf_only",
            "evidence": "Partial XDF; CODE stack order not mapped this pass.",
        },
        {
            "id": "T5",
            "theory": "zw_base = map(load, rpm) + corrections − knock",
            "romTarget": "PT/WOT ign VANOS maps; knock",
            "status": "partial_code",
            "evidence": (
                "Knock-related 0xD288 via RW68+0x88 @0x660C; spark-fault 0xD281 "
                "@0xB0AF. Main zw map reads still unresolved."
            ),
        },
        {
            "id": "T6",
            "theory": "Dwell = f(Vbat, rpm)",
            "romTarget": "0xE0DA",
            "status": "xdf_only",
            "evidence": "XDF named; no RW68/absolute CODE read this pass.",
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
            "romTarget": "VANOS dual fuel/ign maps",
            "status": "xdf_only",
            "evidence": "BMW app + XDF dual maps; selector CODE TBD.",
        },
    ]
    return {
        "schemaVersion": 1,
        "id": "bosch_ti_theory_vs_rom_v1",
        "rom": ROM_NAME,
        "primaryTheory": "tools/re/out/ref_pdf_bosch_m_motronic_technical_instruction.md",
        "shippingNote": (
            "Book is PRIMARY family theory only. Do not verify or promote shipping "
            "maps from the PDF alone."
        ),
        "coverage": {
            "ignFuelItems": n,
            "ghidraProvenAbsolute": 0,
            "ghidraProvenAbsolutePct": 0.0,
            "indexBaseCrossChecked": idx_n,
            "indexBaseCrossCheckedPct": round(100.0 * idx_n / n, 2),
            "structuralSplitPtr": 1,
            "headline": (
                f"0.0% absolute proven (0/{n}); "
                f"{round(100.0 * idx_n / n, 2)}% index-base cross_checked "
                f"({idx_n}/{n} via RW68=0xD200); 1 structural (0xD030)."
            ),
        },
        "checklist": rows,
        "loadPath": load_path,
        "rw68": {
            "baseHex": rw68["baseHex"],
            "uniqueTargetCount": rw68["uniqueTargetCount"],
            "siteCount": rw68["siteCount"],
            "targets": rw68["targets"],
            "proof": rw68["proof"],
        },
    }


def md_theory(doc):
    cov = doc["coverage"]
    lines = [
        "# Theory vs ROM — Bosch M-Motronic TI (PRIMARY) × RedLabel",
        "",
        f"ROM: `{doc['rom']}`",
        f"Theory: [`ref_pdf_bosch_m_motronic_technical_instruction.md`](ref_pdf_bosch_m_motronic_technical_instruction.md)",
        "",
        f"> {doc['shippingNote']}",
        "",
        "## Coverage",
        "",
        "| Metric | Count | % of 69 |",
        "|--------|------:|--------:|",
        f"| Absolute `LOOKUP[ZR]` proven (ea == XDF) | **{cov['ghidraProvenAbsolute']}** | **{cov['ghidraProvenAbsolutePct']}%** |",
        f"| Index-base cross_checked (`RW68`=`0xD200`) | **{cov['indexBaseCrossChecked']}** | **{cov['indexBaseCrossCheckedPct']}%** |",
        f"| Structural split-ptr (`0xD030`) | {cov['structuralSplitPtr']} | 1.45% |",
        "",
        cov["headline"],
        "",
        "## T1–T8 checklist",
        "",
        "| ID | Theory (Bosch TI) | ROM / XDF | Status | Evidence |",
        "|----|-------------------|-----------|--------|----------|",
    ]
    for r in doc["checklist"]:
        lines.append(
            f"| {r['id']} | {r['theory']} | {r['romTarget']} | `{r['status']}` | {r['evidence']} |"
        )

    rw = doc["rw68"]
    lines += [
        "",
        "## New index-base xrefs (`RW68` + `0xD200`)",
        "",
        f"**Proof:** {rw['proof']['note']}",
        "",
        f"**{rw['uniqueTargetCount']} unique / {rw['siteCount']} sites**",
        "",
        "| Target | Sites | XDF name |",
        "|--------|------:|----------|",
    ]
    for th, t in sorted(rw["targets"].items()):
        sites = ", ".join(f"`{s}`" for s in t["sites"][:6])
        lines.append(f"| `{th}` | {t['siteCount']} | {t['name']} |")
        lines.append(f"| | | {sites} |")

    lp = doc["loadPath"]
    lines += [
        "",
        "## Load path fragments (T1–T3)",
        "",
        "### ADC schedule (T1)",
        "",
        f"- Base `{lp['t1_hfm_adc']['scheduleBase']}` … `{lp['t1_hfm_adc']['scheduleEnd']}` in vec5 `{lp['t1_hfm_adc']['isr']}`",
        f"- {lp['t1_hfm_adc']['mechanism']}",
        f"- MAF channel hyp: **{lp['t1_hfm_adc']['mafChannelHypothesis']['channel']} → {lp['t1_hfm_adc']['mafChannelHypothesis']['dest']}** "
        f"({lp['t1_hfm_adc']['mafChannelHypothesis']['reason']})",
        "",
        "### Period → load candidate (T2)",
        "",
        f"- `{lp['t2_load_per_stroke']['divuSite']}` `{lp['t2_load_per_stroke']['divuInsn']}` → ST `{lp['t2_load_per_stroke']['productRam']}`",
        f"- {lp['t2_load_per_stroke']['note']}",
        "",
        "### Post-load interp (T3 mechanism)",
        "",
        f"- {lp['t3_interp_after_load']['interp']}",
        f"- {lp['t3_interp_after_load']['note']}",
        "",
        "## Not claimed",
        "",
        "- Shipping map promotion from Bosch PDF",
        "- Absolute `LOOKUP[ZR]` ign/fuel reads (still 0)",
        "- End-to-end HFM→ti→ign control",
        "",
        "---",
        "Research-only. Verification gates unchanged.",
        "",
    ]
    return "\n".join(lines)


def patch_progress(doc):
    path = OUT / "code_verification_progress.json"
    prog = json.loads(path.read_text())
    cov = doc["coverage"]
    prog["engineControl"]["ignitionFuelCoverage"] = {
        "items": cov["ignFuelItems"],
        "ghidraProvenCodeRead": cov["ghidraProvenAbsolute"],
        "ghidraProvenPct": cov["ghidraProvenAbsolutePct"],
        "indexBaseCrossChecked": cov["indexBaseCrossChecked"],
        "indexBaseCrossCheckedPct": cov["indexBaseCrossCheckedPct"],
        "structuralSplitPtr": cov["structuralSplitPtr"],
        "headline": cov["headline"],
        "note": (
            "v3: absolute proven still 0; new RW68=0xD200 index-base cross_checked "
            "xrefs (unique MAF offset quartet). Not shipping."
        ),
    }
    prog["engineControl"]["priorityTraces"]["boschTiTheoryVsRom"] = "done_v1"
    prog["engineControl"]["priorityTraces"]["rw68IndexBase"] = "cross_checked_d200"
    prog["engineControl"]["priorityTraces"]["firstProvenIgnFuelXref"] = False
    arts = prog["engineControl"].setdefault("artifacts", [])
    for a in [
        "tools/re/out/theory_vs_rom_bosch_ti.md",
        "tools/re/out/rw68_cal_index_base.md",
        "tools/re/out/ref_pdf_bosch_m_motronic_technical_instruction.md",
    ]:
        if a not in arts:
            arts.append(a)
    # refresh open follow-ups that are stale
    ofs = prog["codeVerification"]["openFollowUps"]
    prog["codeVerification"]["openFollowUps"] = [
        x
        for x in ofs
        if "0% ghidraProven" not in x and "page-index bases" not in x
    ] + [
        "Engine control: 0% absolute ign/fuel CODE reads; 18.84% RW68 index-base cross_checked — confirm LD RW68 in internal ROM",
        "Trace descriptor slot 0xD0/0x30 after load (0x1566) to Ti/fuel map pointers",
        "Do not claim full CODE+DATA control; verification gates unchanged",
    ]
    path.write_text(json.dumps(prog, indent=2) + "\n")


def md_rw68(rw68):
    lines = [
        "# RW68 CAL index base — cross_checked `0xD200`",
        "",
        f"ROM: `{rw68['rom']}`",
        "",
        f"**Base register:** `{rw68['baseRegister']}` = `{rw68['baseHex']}`",
        "",
        f"**Proof:** {rw68['proof']['note']}",
        "",
        f"Sites: **{rw68['siteCount']}** → unique ign/fuel XDF targets: **{rw68['uniqueTargetCount']}**",
        "",
        "| Target | # | Name | Example sites |",
        "|--------|--:|------|---------------|",
    ]
    for th, t in sorted(rw68["targets"].items()):
        ex = ", ".join(f"`{s}`" for s in t["sites"][:4])
        lines.append(f"| `{th}` | {t['siteCount']} | {t['name']} | {ex} |")
    lines += [
        "",
        "## Constraint quartet (uniqueness)",
        "",
        "| RW68+off | Target |",
        "|----------|--------|",
    ]
    for o, t in zip(rw68["proof"]["constraintOffsets"], rw68["proof"]["constraintTargets"]):
        lines.append(f"| `{rw68['baseRegister']}+{o}` | `{t}` |")
    lines += [
        "",
        "> Not absolute `LOOKUP[ZR]` proven. Do not promote shipping from this alone.",
        "",
    ]
    return "\n".join(lines)


def patch_ignition_md(doc):
    cov = doc["coverage"]
    path = OUT / "ignition_fuel_dataflow.md"
    text = path.read_text()
    # Replace coverage section simply by rewriting file header area
    new = f"""# Ignition & fuel dataflow — XDF → DATA → CODE

ROM: `BMW DME413 SW623 D466.29 C16x900A 94 RedLabel.bin`
ISA: `mcs96_80c196_family`
CODE `0x2000`–`0xB930`; DATA from `0xB931`.
XDF (BRO) = primary definition evidence for names/equations.

## Coverage (v3 — RW68 index base)

| Metric | Count | % of 69 |
|--------|------:|--------:|
| **Absolute `LOOKUP[ZR]` proven** (ea == XDF offset) | **{cov['ghidraProvenAbsolute']}** | **{cov['ghidraProvenAbsolutePct']}%** |
| **Index-base cross_checked** (`RW68`=`0xD200`) | **{cov['indexBaseCrossChecked']}** | **{cov['indexBaseCrossCheckedPct']}%** |
| Structural split-ptr (`0xD000`+`0x0030`→`0xD030`) | {cov['structuralSplitPtr']} | 1.45% |

{cov['headline']}

> **Absolute proven** still requires `LOOKUP[ZR]`/`TABLE[ZR]` with ea == XDF offset.
> **Index-base cross_checked:** only base `0xD200` makes `RW68+{{0x3E,0x40,0x44,0x90}}` hit MAF high/low/ratio/cal together. See `rw68_cal_index_base.md`.

## How CAL is read (current model)

1. **Indexed scalar/limit path:** `LOOKUP/TABLE[RW68]` with `RW68=0xD200` (cross_checked) → MAF/sensor/knock region `0xD23E`–`0xD290`
2. **Map-interp trampoline** `0x20C7` → `0x33C2` via descriptor table `RW6E=0x1E08` (CAL map targets still unresolved)
3. **Structural** `0xD000`+`0x0030` @`0x432A` → Ti `0xD030` (no CODE deref yet)

## Related artifacts

- `theory_vs_rom_bosch_ti.{{md,json}}` — Bosch T1–T8 checklist + load path
- `rw68_cal_index_base.{{md,json}}` — 13 index-base xrefs
- `cal_access_model.{{md,json}}` — absolute-path attempt + descriptor model
- `irq_ram_publications.{{md,json}}` — vec2/vec5 RAM pubs
- `sfr_hso_hsi_audit.{{md,json}}` — HSO write alias
- `motronic_331_function.md` §7 — sibling theory checklist

## What is *not* claimed

- Complete spark/fuel output control path
- Absolute `LOOKUP[ZR]` per-map CODE xrefs (still 0)
- Shipping definition updates from Bosch PDF or index-base geometry alone

## Theory reference (Bosch M-Motronic TI)

Expected fuel/ign math (HFM load → base ti + corrections; zw map(load,rpm); dwell vs Vbat/rpm) is page-cited in [`ref_pdf_bosch_m_motronic_technical_instruction.md`](ref_pdf_bosch_m_motronic_technical_instruction.md). Checklist: [`theory_vs_rom_bosch_ti.md`](theory_vs_rom_bosch_ti.md).

---
Research-only. Verification gates for promotion unchanged.
"""
    path.write_text(new)


def patch_ref_pdf_checklist(doc):
    path = OUT / "ref_pdf_bosch_m_motronic_technical_instruction.md"
    text = path.read_text()
    start = text.find("## 5. Theory → RedLabel ROM checklist")
    end = text.find("## 6. Cloud RE handoff note")
    if start < 0 or end < 0:
        return
    rows = doc["checklist"]
    cov = doc["coverage"]
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
        "Detail: [`theory_vs_rom_bosch_ti.md`](theory_vs_rom_bosch_ti.md), [`rw68_cal_index_base.md`](rw68_cal_index_base.md).",
        "",
        "---",
        "",
    ]
    path.write_text(text[:start] + "\n".join(block) + text[end:])


def patch_motronic_section(doc):
    for path in [OUT / "motronic_331_function.md", ROOT / "docs" / "motronic_331_function.md"]:
        if not path.exists():
            continue
        text = path.read_text()
        marker = "## 7. Theory vs RedLabel ROM (this RE pass)"
        if marker not in text:
            continue
        # Replace from marker through end of §7.4 (before ## 8)
        start = text.find(marker)
        end = text.find("## 8. Research session notes")
        if start < 0 or end < 0:
            continue
        cov = doc["coverage"]
        rw = doc["rw68"]
        section = f"""## 7. Theory vs RedLabel ROM (this RE pass)

Cross-check of Bosch M-Motronic TI (PRIMARY extract) + §§3–5 against MCS-96 listing / XDF.
**Still not end-to-end CODE+DATA control. Book alone does not verify shipping.**

### 7.1 Bosch T1–T8 checklist

See [`theory_vs_rom_bosch_ti.md`](theory_vs_rom_bosch_ti.md) for full table. Headline statuses:

| ID | Status |
|----|--------|
| T1 HFM/MAF | `partial_code` — ADC schedule + RW68→MAF region |
| T2 load/stroke | `partial_code` — 0x14CC→DIVU→0x1566 |
| T3 ti_base | `structural_only` — 0xD030 island; interp #0xD0/#0x30 |
| T4 corrections | `xdf_only` |
| T5 zw/knock | `partial_code` — 0xD288/0xD281 via RW68 |
| T6 dwell | `xdf_only` |
| T7 Alpha-N | `xdf_only` |
| T8 VANOS | `xdf_only` |

### 7.2 Access-model update (RW68 index base)

`LDB Rx,0xd0, LOOKUP[ZR]` remains **register file `0x00D0`**, not ROM page `0xD0`.

**New:** `LOOKUP/TABLE[RW68]` with base **`RW68 = 0xD200`** is **cross_checked** by unique XDF geometry (MAF offset quartet `+0x3E/+0x40/+0x44/+0x90` → `0xD23E/D240/D244/D290` only for that base). External image has no `LD RW68,#imm` (low ROM erased).

### 7.3 Artifacts

- `tools/re/out/theory_vs_rom_bosch_ti.{{md,json}}`
- `tools/re/out/rw68_cal_index_base.{{md,json}}`
- `tools/re/out/irq_ram_publications.{{md,json}}`
- `tools/re/out/sfr_hso_hsi_audit.{{md,json}}`
- `tools/re/out/cal_access_model.{{md,json}}`
- Coverage: **{cov['headline']}**

### 7.4 First absolute ign/fuel XDF CODE read — status

**None yet** (`0/69` absolute). **New cross_checked index-base xrefs:** {rw['uniqueTargetCount']} targets / {rw['siteCount']} sites via `RW68+0xD200` (includes MAF cal `0xD290` @`0x68CD`, MAF fault limits, IAT/coolant mins/maxes, knock `0xD288`).

"""
        path.write_text(text[:start] + section + text[end:])


def main():
    lines = load_listing()
    ign = load_ign_items()
    assert ROM_PATH.exists(), ROM_PATH
    rw68 = build_rw68_model(lines, ign)
    load_path = build_load_path(lines)
    doc = build_theory_checklist(rw68, load_path, ign)

    (OUT / "rw68_cal_index_base.json").write_text(json.dumps(rw68, indent=2) + "\n")
    (OUT / "rw68_cal_index_base.md").write_text(md_rw68(rw68))
    (OUT / "theory_vs_rom_bosch_ti.json").write_text(json.dumps(doc, indent=2) + "\n")
    (OUT / "theory_vs_rom_bosch_ti.md").write_text(md_theory(doc))

    # also refresh ignition json coverage block if present
    ign_path = OUT / "ignition_fuel_dataflow.json"
    ign_doc = json.loads(ign_path.read_text())
    ign_doc["coverage"] = {
        "schemaVersion": 3,
        **doc["coverage"],
        "accessModel": "v3_rw68_index_base",
    }
    ign_path.write_text(json.dumps(ign_doc, indent=2) + "\n")

    patch_ignition_md(doc)
    patch_progress(doc)
    patch_ref_pdf_checklist(doc)
    patch_motronic_section(doc)

    print(doc["coverage"]["headline"])
    print(f"RW68 targets: {rw68['uniqueTargetCount']} / sites {rw68['siteCount']}")
    for t in rw68["uniqueTargets"]:
        print(f"  0x{t:04X} {ign[t]['name']}")


if __name__ == "__main__":
    main()
