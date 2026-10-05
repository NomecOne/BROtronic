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


def _find_all(rom: bytes, pat: bytes):
    hits = []
    start = 0
    while True:
        p = rom.find(pat, start)
        if p < 0:
            break
        hits.append(p)
        start = p + 1
    return hits


def _entries(ign: dict, offsets):
    out = []
    for p in offsets:
        meta = ign.get(p, {})
        out.append(
            {
                "offset": p,
                "offsetHex": f"0x{p:04X}",
                "name": meta.get("name", "?"),
                "category": meta.get("category"),
                "domain": meta.get("domain")
                or (
                    "ignition"
                    if "ign" in (meta.get("name") or "").lower()
                    else "fuel"
                ),
            }
        )
    return out


def build_vanos_rpm_axis_exclusive(rom: bytes, ign: dict):
    """Shared 16-byte RPM axis signature — exclusive to 4 fuel + 4 ign VANOS axes."""
    sig = bytes.fromhex("050605070a05070b0909090f12130860")
    locs = _find_all(rom, sig)
    expected = [0xD984, 0xD9A6, 0xD9C8, 0xDAA8, 0xDD0F, 0xDD89, 0xDE6D, 0xDF4D]
    assert locs == expected, (locs, expected)
    entries = _entries(ign, locs)
    fuel = [e for e in entries if "ign" not in (e["name"] or "").lower()]
    ignition = [e for e in entries if "ign" in (e["name"] or "").lower()]
    return {
        "id": "vanos_rpm_axis_sig_v1",
        "method": "signature_axis",
        "signatureHex": sig.hex(),
        "signatureLen": len(sig),
        "exclusiveLocations": [f"0x{p:04X}" for p in locs],
        "offsets": locs,
        "count": len(locs),
        "fuelAxes": fuel,
        "ignitionAxes": ignition,
        "items": entries,
        "representativeIgnition": ignition[0] if ignition else None,
        "representativeFuel": fuel[0] if fuel else None,
        "exclusiveGeometry": True,
        "codeDerefProven": False,
        "note": (
            "Exclusive content geometry: 16-byte RPM-axis preamble appears "
            "exactly 8 times — XDF Fuel/Ign PT|WOT VANOS RPM axes."
        ),
        "evidenceStrength": "high_content_exclusive",
    }


def build_exclusive_families(rom: bytes, ign: dict):
    """Additional exclusive-geometry families beyond Ti + VANOS RPM axes."""
    families = []

    # VANOS WOT dwell axes (near-RPM sig, distinct tail 0b5d)
    sig = bytes.fromhex("050605070a05070b0909090f12130b5d")
    locs = _find_all(rom, sig)
    assert locs == [0xD67C, 0xD69E], locs
    families.append(
        {
            "id": "vanos_wot_dwell_axis_sig_v1",
            "method": "signature_axis",
            "title": "VANOS WOT dwell RPM axes",
            "signatureHex": sig.hex(),
            "offsets": locs,
            "items": _entries(ign, locs),
            "note": "Exclusive 16-byte axis sig — exactly D67C/D69E (WOT dwell ret/adv).",
        }
    )

    # PT load axes (fuel + ign)
    sig = bytes.fromhex("0a0a0c0c0e0e0e0e0c10105c")
    locs = _find_all(rom, sig)
    assert locs == [0xD9DA, 0xDABA, 0xDE7F, 0xDF5F], locs
    families.append(
        {
            "id": "vanos_pt_load_axis_sig_v1",
            "method": "signature_axis",
            "title": "VANOS PT load axes (fuel+ign)",
            "signatureHex": sig.hex(),
            "offsets": locs,
            "items": _entries(ign, locs),
            "note": "Exclusive 12-byte load-axis preamble — fuel PT + ign PT load axes.",
        }
    )

    # Ign idle timing Manual/AT — exclusive mid-sig at +2
    sig = bytes.fromhex("505051555a5d")
    locs = _find_all(rom, sig)
    assert locs == [0xDCF5, 0xDD07], locs
    table_offs = [0xDCF3, 0xDD05]
    families.append(
        {
            "id": "ign_idle_timing_sig_v1",
            "method": "signature_axis",
            "title": "Ign idle timing (Manual / A/T)",
            "signatureHex": sig.hex(),
            "signatureAt": [f"0x{p:04X} (+2 into table)" for p in locs],
            "offsets": table_offs,
            "items": _entries(ign, table_offs),
            "note": "Exclusive 6-byte mid-table sig at DCF3+2 / DD05+2 only.",
        }
    )

    # Soft fuel cut — island↔CAL twin (shares Ti neighborhood frag)
    frag = bytes.fromhex("90655046")
    locs = _find_all(rom, frag)
    assert locs == [0x431C, 0xD032], locs
    families.append(
        {
            "id": "soft_fuel_cut_island_twin_v1",
            "method": "island_cal_twin",
            "title": "Soft fuel cut (Ti neighborhood twin)",
            "signatureHex": frag.hex(),
            "offsets": [0xD032],
            "items": _entries(ign, [0xD032]),
            "twins": ["0x431C (island)", "0xD032 (CAL)"],
            "note": "Exclusive island↔CAL twin of D032 Soft Fuel Cut header bytes.",
        }
    )

    # MAF transfer — unique BE@FE18 ↔ LE@D28E anchor (D28E+2 = D290)
    be = bytes([0xD2, 0x8E])
    le = bytes([0x8E, 0xD2])
    assert _find_all(rom, be) == [0xFE18]
    assert _find_all(rom, le) == [0xD28E]
    assert 0xD28E + 2 == 0xD290
    families.append(
        {
            "id": "maf_d28e_be_le_twin_v1",
            "method": "unique_immediate_twin",
            "title": "MAF transfer anchor (D28E BE↔LE)",
            "offsets": [0xD290],
            "items": _entries(ign, [0xD290]),
            "twins": ["BE 0xD28E @0xFE18 (unique)", "LE 0xD28E @0xD28E (unique)"],
            "composed": "0xD28E+2 → 0xD290 MAF Cal",
            "note": (
                "Exclusive BE/LE twin of 0xD28E anchors MAF cal at D290 "
                "(FE struct region + CAL self-word)."
            ),
        }
    )

    # Ign idle cold Manual/AT — unique chained span covering both tables
    span = rom[0xDCCF : 0xDCE1]
    assert _find_all(rom, span) == [0xDCCF]
    offs = [0xDCCF, 0xDCD9]
    families.append(
        {
            "id": "ign_idle_cold_chain_v1",
            "method": "unique_span_chain",
            "title": "Ign idle cold timing corrections",
            "signatureHex": span.hex(),
            "offsets": offs,
            "items": _entries(ign, offs),
            "note": "Unique contiguous span DCCF..DCD9+8 chains both cold-idle ign tables.",
        }
    )

    # Cold engine enrich Manual/AT — unique chained span
    span = rom[0xD8EF : 0xD901]
    assert _find_all(rom, span) == [0xD8EF]
    offs = [0xD8EF, 0xD8FD]
    families.append(
        {
            "id": "fuel_cold_enrich_chain_v1",
            "method": "unique_span_chain",
            "title": "Fuel cold engine enrich (Manual / A/T)",
            "signatureHex": span.hex(),
            "offsets": offs,
            "items": _entries(ign, offs),
            "note": "Unique contiguous span D8EF..D8FD+4 chains both cold-enrich tables.",
        }
    )

    return families


def collect_exclusive_offsets(ti, vanos, families):
    offs = {0xD030}
    offs.update(vanos["offsets"])
    for fam in families:
        offs.update(fam["offsets"])
    return sorted(offs)


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


def build_checklist(ti, vanos, families, load_path):
    ign_rep = vanos["representativeIgnition"]
    return [
        {
            "id": "T1",
            "theory": "Primary load = air-mass kg/h (HFM)",
            "romTarget": "MAF 0xD290; ADC→lookup",
            "status": "exclusive_geometry_maf",
            "evidence": (
                "ADC @0x427A hyp intact. MAF exclusive BE↔LE twin 0xD28E "
                "@FE18/D28E → D290. Prior D200 index claim remains retracted."
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
            "romTarget": "Ti 0xD030 + fuel maps",
            "status": "exclusive_structural",
            "evidence": (
                ti["note"]
                + " Also: soft-fuel-cut twin D032; cold-enrich chain D8EF/D8FD; "
                "PT load axes D9DA/DABA."
            ),
        },
        {
            "id": "T4",
            "theory": "Correction stack + Vbat + lambda + overrun cut",
            "romTarget": "Enrich / O2 / voltage / cut",
            "status": "partial_exclusive",
            "evidence": "Cold enrich Manual/AT exclusive chain; accel stack CODE TBD.",
        },
        {
            "id": "T5",
            "theory": "zw_base = map(load, rpm) + corrections − knock",
            "romTarget": "PT/WOT ign VANOS; knock",
            "status": "exclusive_geometry_axes",
            "evidence": (
                f"VANOS RPM axes @ {ign_rep['offsetHex']}+sibs; PT load axes "
                f"DE7F/DF5F; ign idle timing DCF3/DD05; idle cold DCCF/DCD9."
            ),
        },
        {
            "id": "T6",
            "theory": "Dwell = f(Vbat, rpm)",
            "romTarget": "0xE0DA + VANOS dwell",
            "status": "partial_exclusive",
            "evidence": (
                "VANOS WOT dwell axes D67C/D69E exclusive sig; main dwell "
                "0xE0DA body CODE read still open."
            ),
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
                "PT/WOT fuel+ign VANOS RPM + PT load + WOT dwell axes exclusive. "
                "Selector CODE TBD."
            ),
        },
    ]


def build_doc(rom, lines, ign):
    fe24 = verify_fe24_structure(rom)
    ti = build_ti_structural(rom, lines)
    vanos = build_vanos_rpm_axis_exclusive(rom, ign)
    families = build_exclusive_families(rom, ign)
    exclusive_offs = collect_exclusive_offsets(ti, vanos, families)
    load_path = build_load_path()
    retraction = build_retraction()
    checklist = build_checklist(ti, vanos, families, load_path)
    n = len(ign)
    exclusive_items = len(exclusive_offs)
    exclusive_pct = round(100.0 * exclusive_items / n, 2)
    new_families = [
        {
            "id": f["id"],
            "title": f["title"],
            "method": f["method"],
            "offsets": [f"0x{o:04X}" for o in f["offsets"]],
            "note": f["note"],
        }
        for f in families
    ]
    return {
        "schemaVersion": 6,
        "id": "bosch_ti_theory_vs_rom_v6",
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
        "exclusiveFamilies": families,
        "exclusiveOffsets": [f"0x{o:04X}" for o in exclusive_offs],
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
                f"({exclusive_items}/{n}); 4 ROM-proven FE24 bases."
            ),
            "note": (
                "v6: grew exclusive geometry via signature axes, island↔CAL "
                "twins, BE/LE unique immediates, and unique span chains. "
                "D200/D978 remain retracted. Absolute CODE content reads still 0."
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
            "mafAnchor": ["BE 0xD28E @0xFE18", "LE 0xD28E @0xD28E", "MAF 0xD290"],
            "newFamilySummaries": new_families,
        },
        "nextToProve": [
            "Compose D000+|0030 and [deref] Ti; CODE-walk one VANOS RPM/load axis",
            "Descriptor patches 0x42DF → 0xDxxx for main fuel/ign map bodies",
            "Exclusive geometry for Alpha-N 0xDBC3, dwell 0xE0DA, accel stack",
            "Absolute LOOKUP[ZR] for one fuel map body and one ign map body",
        ],
    }



def md_theory(doc):
    cov = doc["coverage"]
    rb = doc["registerBasesRomProven"]
    ti = doc["tiStructural"]
    vanos = doc["vanosRpmAxisExclusive"]
    families = doc.get("exclusiveFamilies", [])
    sites = doc["keyCodeSites"]
    lines = [
        "# Theory vs ROM — Bosch M-Motronic TI (PRIMARY) × RedLabel",
        "",
        f"ROM: `{doc['rom']}`",
        f"Theory: [`ref_pdf_bosch_m_motronic_technical_instruction.md`](ref_pdf_bosch_m_motronic_technical_instruction.md)",
        "",
        f"> {doc['shippingNote']}",
        "",
        "## Coverage (v6)",
        "",
        "| Metric | Count | % of 69 |",
        "|--------|------:|--------:|",
        f"| Absolute `LOOKUP[ZR]` proven (ea == XDF) | **{cov['ghidraProvenAbsolute']}** | **{cov['ghidraProvenAbsolutePct']}%** |",
        f"| CAL-content index-base cross_checked | **{cov['indexBaseCrossCheckedCalContent']}** | **{cov['indexBaseCrossCheckedCalContentPct']}%** |",
        f"| **Exclusive geometry** | **{cov['exclusiveGeometry']}** | **{cov['exclusiveGeometryPct']}%** |",
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
        "## Fuel exclusive — Ti `0xD030`",
        "",
        f"- Target `{ti['target']}` {ti['xdfName']}",
        f"- {ti['pageWordAt']}; {ti['offsetWordAt']} → `{ti['composed']}`",
        f"- Exclusive split: `{ti['exclusiveSplitPattern']}`",
        f"- CODE CMP page: " + ", ".join(f"`{s}`" for s in sites["tiPageCmp"]),
        f"- CODE CMP off: " + (", ".join(f"`{s}`" for s in sites["tiOffCmp"]) or "_none_"),
        f"- {ti['note']}",
        "",
        "## VANOS RPM axes (8)",
        "",
        f"- Signature `{vanos['signatureHex']}` — exactly {vanos['count']} hits:",
        "",
        "| Offset | Domain | Name |",
        "|--------|--------|------|",
    ]
    for e in vanos["fuelAxes"] + vanos["ignitionAxes"]:
        dom = "ign" if e in vanos["ignitionAxes"] else "fuel"
        lines.append(f"| `{e['offsetHex']}` | {dom} | {e['name'][:55]} |")
    lines += ["", "## Additional exclusive families (v6)", ""]
    for fam in families:
        offs = ", ".join(f"`0x{o:04X}`" for o in fam["offsets"])
        lines += [
            f"### {fam['title']}",
            "",
            f"- Method: `{fam['method']}`",
            f"- Offsets: {offs}",
            f"- {fam['note']}",
            "",
        ]
    lines += [
        f"**All exclusive offsets ({cov['exclusiveGeometry']}):** "
        + ", ".join(f"`{o}`" for o in doc.get("exclusiveOffsets", [])),
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
        f"- Post-load slots: {', '.join(f'`{s}`' for s in sites['postLoadTiSlots'])}",
        f"- Ti CMPs: {', '.join(f'`{s}`' for s in sites['tiPageCmp'] + sites['tiOffCmp'])}",
        f"- MAF anchor: {', '.join(f'`{s}`' for s in sites.get('mafAnchor', []))}",
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
            "Engine control: 0% absolute; exclusive geometry growing — chase descriptor→0xDxxx deref",
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
    prog["engineControl"]["priorityTraces"]["boschTiTheoryVsRom"] = "done_v6_exclusive_geometry"
    prog["engineControl"]["priorityTraces"]["rw68IndexBase"] = "retracted_d200_false_positive"
    prog["engineControl"]["priorityTraces"]["registerBasesFe24"] = "rom_proven"
    prog["engineControl"]["priorityTraces"]["firstProvenIgnFuelXref"] = False
    prog["engineControl"]["priorityTraces"]["exclusiveGeometryFuelIgn"] = "ti_vanos_maf_idle_enrich_v6"
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
    fam_blocks = []
    for f in doc.get("exclusiveFamilies", []):
        offs = ", ".join(f"`0x{o:04X}`" for o in f["offsets"])
        fam_blocks.append(
            f"### {f['title']}\n\n"
            f"- Method: `{f['method']}`\n"
            f"- Offsets: {offs}\n"
            f"- {f['note']}\n"
        )
    fam_text = "\n".join(fam_blocks)
    all_offs = ", ".join(f"`{o}`" for o in doc.get("exclusiveOffsets", []))
    path.write_text(
        f"""# Ignition & fuel dataflow — XDF → DATA → CODE

ROM: `BMW DME413 SW623 D466.29 C16x900A 94 RedLabel.bin`
ISA: `mcs96_80c196_family`
CODE `0x2000`–`0xB930`; DATA from `0xB931`.
XDF (BRO) = primary definition evidence for names/equations.

## Coverage (v6 — exclusive geometry grown; D200/D978 retracted)

| Metric | Count | % of 69 |
|--------|------:|--------:|
| **Absolute `LOOKUP[ZR]` proven** (ea == XDF offset) | **{cov['ghidraProvenAbsolute']}** | **{cov['ghidraProvenAbsolutePct']}%** |
| **CAL-content index-base cross_checked** | **{cov['indexBaseCrossCheckedCalContent']}** | **{cov['indexBaseCrossCheckedCalContentPct']}%** |
| **Exclusive geometry** | **{cov['exclusiveGeometry']}** | **{cov['exclusiveGeometryPct']}%** |
| Structural split-ptr (`0xD000`+`0x0030`→`0xD030`) | {cov['structuralSplitPtr']} | 1.45% |
| ROM-proven register bases (FE24) | {cov['registerBasesRomProven']} | — |

{cov['headline']}

> **v6:** D200/D978 remain retracted. FE24 bases unchanged.
> Exclusive geometry grown: Ti, VANOS RPM/load/dwell axes, MAF, ign idle,
> cold enrich, soft fuel cut.

## How CAL is read (corrected model)

1. **Parameter island** `RW68=0x42EC` — scalars / page markers (incl. `D000`+`0030` at +0x3E/+0x40)
2. **Index island** `RW6A=0x43F0` — small fault / descriptor indices (feed `0x6efd` / `RW1A` interp)
3. **Map interp** `0x20C7`→`0x33C2` via descriptor table `RW6E=0x1E08` (targets still unresolved)
4. **Exclusive Ti** `0xD030` — unique island split + body twins; CODE CMP touches
5. **Exclusive VANOS RPM axes** — shared 16-byte signature at 8 XDF offsets
6. **More exclusive families** — see below (MAF, load/dwell axes, idle, enrich)

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

## Additional exclusive families (v6)

{fam_text}

**All exclusive offsets ({cov['exclusiveGeometry']}):** {all_offs}

## Key CODE sites

- FE24 loader `{sites['fe24Loader']}`
- Interp `{sites['mapInterp']}`
- Post-load slots {', '.join(f'`{s}`' for s in sites['postLoadTiSlots'])}
- MAF anchor: {', '.join(f'`{s}`' for s in sites.get('mafAnchor', []))}

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

See [`theory_vs_rom_bosch_ti.md`](theory_vs_rom_bosch_ti.md). Headline: exclusive geometry **{cov['exclusiveGeometry']}/69**; T1 MAF exclusive; T3 Ti exclusive; T5/T8 VANOS axes; D200/D978 **retracted**.

### 7.2 Access-model update (v6)

`LDB Rx,0xd0, LOOKUP[ZR]` remains register file `0x00D0`.

**ROM-proven bases (FE24):** `RW68=0x42EC`, `RW6A=0x43F0`, `RW6C=0x1A08`, `RW6E=0x1E08`.

**Retracted:** `RW68=0xD200` / `RW6A=0xD978` — do not revive.

**Exclusive geometry ({cov['exclusiveGeometry']}/69):**
- Fuel Ti `0xD030` — unique split @`0x432A`; CODE CMP `{', '.join(sites['tiPageCmp'])}`
- VANOS RPM axes — `{vanos['signatureHex']}` @ 8 offsets
- Plus: WOT dwell axes, PT load axes, MAF D28E twin, ign idle timing/cold, soft fuel cut, cold enrich

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
                "exclusiveFamilies": [
                    {"id": f["id"], "title": f["title"], "offsets": [f"0x{o:04X}" for o in f["offsets"]]}
                    for f in doc["exclusiveFamilies"]
                ],
                "exclusiveOffsets": doc["exclusiveOffsets"],
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
    ign_doc["coverage"] = {"schemaVersion": 6, **doc["coverage"]}
    ign_doc["exclusiveGeometry"] = {
        "ti": doc["tiStructural"],
        "vanosRpmAxes": doc["vanosRpmAxisExclusive"],
        "families": doc["exclusiveFamilies"],
        "allOffsets": doc["exclusiveOffsets"],
    }
    ign_doc["keyCodeSites"] = doc["keyCodeSites"]
    # Mark exclusive items in items list if present
    items = ign_doc.get("items")
    if isinstance(items, list):
        excl = {int(x, 16) for x in doc["exclusiveOffsets"]}
        vanos_set = set(doc["vanosRpmAxisExclusive"]["offsets"])
        fam_map = {}
        for fam in doc["exclusiveFamilies"]:
            for o in fam["offsets"]:
                fam_map[o] = fam["id"]
        for it in items:
            off = it.get("offset")
            if off not in excl:
                continue
            it["exclusiveGeometry"] = True
            it["evidenceStrength"] = "high"
            if off == 0xD030:
                it["codeReadStatus"] = "exclusive_structural_split_ptr"
            elif off in vanos_set:
                it["codeReadStatus"] = "exclusive_content_geometry_axis"
            else:
                it["codeReadStatus"] = f"exclusive_{fam_map.get(off, 'family')}"
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
    fam_lines = "\n".join(
        f"- **{f['title']}:** " + ", ".join(f"`0x{o:04X}`" for o in f["offsets"])
        for f in doc["exclusiveFamilies"]
    )
    ht += f"""## Status after theory-vs-ROM pass (v6)

- **Retraction:** D200 (13) / D978 (6) remain retracted (do not revive).
- **ROM-proven bases (FE24):** RW68=`0x42EC`, RW6A=`0x43F0`, RW6C=`0x1A08`, RW6E=`0x1E08`
- **Coverage:** {doc['coverage']['headline']}
- **Fuel exclusive:** Ti `0xD030` — unique split @`0x432A`; CODE CMP {doc['keyCodeSites']['tiPageCmp']}
- **VANOS RPM axes:** {doc['vanosRpmAxisExclusive']['exclusiveLocations']}
{fam_lines}
- **Next:** descriptor → 0xDxxx deref; compose+deref Ti; CODE-walk one VANOS axis
"""
    handoff.write_text(ht)

    print(doc["coverage"]["headline"])
    print("FE24 bases:", doc["registerBasesRomProven"]["words"])
    print("Ti sites +3E:", [s["siteHex"] for s in doc["tiStructural"]["codeReadsPageVia"]])
    print("VANOS axes:", doc["vanosRpmAxisExclusive"]["exclusiveLocations"])
    print("Exclusive all:", doc["exclusiveOffsets"])
    print("New families:", [f["id"] for f in doc["exclusiveFamilies"]])


if __name__ == "__main__":
    main()
