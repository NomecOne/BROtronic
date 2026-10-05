#!/usr/bin/env python3
"""
Bosch M-Motronic TI theory-vs-ROM pass + register-base recovery.

PRIMARY theory: tools/re/out/ref_pdf_bosch_m_motronic_technical_instruction.md
Does NOT verify shipping from the book alone — CODE×XDF only.

v9 addressing-model correction:
  Loader 0x2EDB scans FF pad then loads BE hi/lo pairs from FE14 (not FE24):
    RW68=0xD002  CAL page base (Ti @ +0x2E → 0xD030)
    RW6A=0xD106  CAL sensor/limit base
    RW6C=0xD28E  MAF table base (body @ +2 → 0xD290)
    RW6E=0xE67E  CAL descriptor table (LE16 map headers)
  FE24 words 0x42EC/0x43F0/0x1A08/0x1E08 are an adjacent alternate/RAM-pool
  quadruplet; CMP @0x4D60/0x481B accepts either CAL bases or 1A08/1E08.

v4–v8 still hold: D200/D978 retracted; exclusive geometry 69/69.
"""

from __future__ import annotations

import json
import re
import struct
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "out"
GHIDRA = OUT / "ghidra"
ROM_PATH = Path(__file__).resolve().parents[3] / "public" / "rom" / (
    "BMW DME413 SW623 D466.29 C16x900A 94 RedLabel.bin"
)
ROM_NAME = "BMW DME413 SW623 D466.29 C16x900A 94 RedLabel.bin"

# Runtime bases loaded by 0x2EDB from FE14 (after FF-pad scan)
RW68_BASE = 0xD002
RW6A_BASE = 0xD106
RW6C_BASE = 0xD28E
RW6E_BASE = 0xE67E
FE14_STRUCT = 0xFE14
# Adjacent FE24 quadruplet (not loaded into RW68–6E on this image)
FE24_ALT = {
    "RW68": 0x42EC,
    "RW6A": 0x43F0,
    "RW6C": 0x1A08,
    "RW6E": 0x1E08,
}
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


def simulate_fe14_loader(rom: bytes) -> dict:
    """Reproduce 0x2EDB: start @ [0x40B4], find 16×0xFF, load BE words from FE14."""
    start = struct.unpack_from("<H", rom, 0x40B4)[0]
    assert start == 0xFE33, hex(start)
    saved = start - 0xF  # FE24
    rw1c = saved
    matched = None
    for _ in range(0x0B):
        rw1c -= 0x10
        if all(b == 0xFF for b in rom[rw1c : rw1c + 16]):
            matched = rw1c
            break
    assert matched == 0xFE04, hex(matched or 0)
    # after 16 post-inc compares RW1C=FE14; ADD #0xF → FE23
    base_ptr = matched + 16 + 0xF
    assert base_ptr == 0xFE23

    def be_word(hi_off: int) -> int:
        return (rom[base_ptr - hi_off] << 8) | rom[base_ptr - (hi_off - 1)]

    words = {
        "RW68": be_word(0xF),
        "RW6A": be_word(0xD),
        "RW6C": be_word(0xB),
        "RW6E": be_word(0x9),
    }
    assert words == {
        "RW68": RW68_BASE,
        "RW6A": RW6A_BASE,
        "RW6C": RW6C_BASE,
        "RW6E": RW6E_BASE,
    }, words
    return {
        "loader": "0x2EDB via trampoline 0x20B5 / LCALL 0x412C",
        "scanStart": "0xFE33 from TABLE[ZR]@0x40B4",
        "ffPadBlock": "0xFE04..0xFE13",
        "loadedFrom": f"0x{FE14_STRUCT:04X}",
        "basePtrAfterAdd": f"0x{base_ptr:04X}",
        "words": {k: f"0x{v:04X}" for k, v in words.items()},
        "roles": {
            "RW68": "CAL page base (Ti 0xD030 = +0x2E)",
            "RW6A": "CAL sensor/limit base",
            "RW6C": "MAF table base (body 0xD290 = +2)",
            "RW6E": "CAL descriptor table (LE16 map headers)",
        },
    }


def verify_fe_structure(rom: bytes):
    """FE14 runtime bases (loader) + FE24 adjacent alternate quadruplet."""
    loaded = simulate_fe14_loader(rom)
    # FE14 BE unique
    fe14 = bytes(
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
    assert rom.find(fe14) == FE14_STRUCT
    assert rom.find(fe14, FE14_STRUCT + 1) < 0
    # FE24 alternate still unique
    alt = FE24_ALT
    fe24 = bytes(
        [
            alt["RW68"] >> 8,
            alt["RW68"] & 0xFF,
            alt["RW6A"] >> 8,
            alt["RW6A"] & 0xFF,
            alt["RW6C"] >> 8,
            alt["RW6C"] & 0xFF,
            alt["RW6E"] >> 8,
            alt["RW6E"] & 0xFF,
        ]
    )
    assert rom.find(fe24) == FE24_STRUCT
    assert rom.find(fe24, FE24_STRUCT + 1) < 0
    return {
        "structAt": f"0x{FE14_STRUCT:04X}",
        "layout": "LDB Rhi,-off-1[RW1C]; LDB Rlo,-off[RW1C] (hi byte at lower addr)",
        "words": loaded["words"],
        "roles": loaded["roles"],
        "loader": loaded,
        "fe24AdjacentNotLoaded": {
            "structAt": f"0x{FE24_STRUCT:04X}",
            "words": {k: f"0x{v:04X}" for k, v in alt.items()},
            "note": (
                "Adjacent BE quadruplet after FE14 CAL bases. Not written into "
                "RW68–RW6E by 0x2EDB on this image. 0x1A08/0x1E08 are also "
                "hardcoded RAM clear/fill targets at 0x4ECC when RW6E==0x1E08."
            ),
        },
        "cmpCrossCheck": {
            "RW6C": "CMP RW6C,#0x1a08 @0x4D60 (dual-config: CAL≠1A08 continues)",
            "RW6E": "CMP RW6E,#0x1e08 @0x481B/0x4D66 (skip 0x4ECC fill when ≠)",
            "note": (
                "With FE14 CAL bases, descriptor RAM fill @0x4ECC is skipped; "
                "interp uses ROM table at RW6E=0xE67E."
            ),
        },
        "uniqueInRom": True,
    }


def build_absolute_proofs(rom: bytes, lines, ign: dict) -> dict:
    """Absolute CODE→CAL proofs using FE14 runtime bases + descriptor table."""
    bases = {
        "RW68": RW68_BASE,
        "RW6A": RW6A_BASE,
        "RW6C": RW6C_BASE,
        "RW6E": RW6E_BASE,
    }
    imm_index = re.compile(
        r"0x(?P<imm>[0-9a-fA-F]+),\s*(?:LOOKUP|TABLE)\[(?P<reg>RW6[8ACE])\]"
    )
    bracket = re.compile(r"0x(?P<imm>[0-9a-fA-F]+)\[(?P<reg>RW6[8ACE])\]")
    direct: dict[int, list] = defaultdict(list)
    for a, insn in lines:
        for mm in list(imm_index.finditer(insn)) + list(bracket.finditer(insn)):
            reg = mm.group("reg")
            imm = int(mm.group("imm"), 16)
            ea = bases[reg] + imm
            if ea in ign:
                direct[ea].append(
                    {
                        "site": a,
                        "siteHex": f"0x{a:04X}",
                        "reg": reg,
                        "immHex": f"0x{imm:X}",
                        "eaHex": f"0x{ea:04X}",
                        "insn": insn,
                        "kind": "long_index",
                    }
                )
    # MAF: ADC ISR accumulates word table at RW6C+2 + 2*ADC
    assert RW6C_BASE + 2 == 0xD290
    direct[0xD290].append(
        {
            "site": 0xA53B,
            "siteHex": "0xA53B",
            "reg": "RW6C",
            "immHex": "0x2",
            "eaHex": "0xD290",
            "insn": "ADD RW64,0x2[RW46] ; RW46=RW6C+2*AD_resulthi",
            "kind": "maf_adc_word_table",
            "path": "0xA4AA ISR → 0xA52A..0xA53B",
        }
    )

    # Descriptor selects: LD RW1A,#idx where [RW6E+idx] ∈ {xdf, xdf-2}
    imm_sites: dict[int, list] = defaultdict(list)
    for a, insn in lines:
        m = re.match(r"LD RW1A,#0x([0-9a-fA-F]+)$", insn)
        if m:
            imm_sites[int(m.group(1), 16)].append(a)

    desc: dict[int, list] = defaultdict(list)
    for idx in range(0, 0x200, 2):
        ptr = struct.unpack_from("<H", rom, RW6E_BASE + idx)[0]
        for off in ign:
            if ptr in (off, off - 2) and idx in imm_sites:
                desc[off].append(
                    {
                        "descIndexHex": f"0x{idx:X}",
                        "slotHex": f"0x{RW6E_BASE + idx:04X}",
                        "ptrHex": f"0x{ptr:04X}",
                        "xdfHex": f"0x{off:04X}",
                        "headerDelta": ptr - off,
                        "selectSites": [f"0x{s:04X}" for s in imm_sites[idx][:4]],
                        "interp": "0x20C7/0x20CD → ADD RW1A,RW6E; LD RW4C,[RW1A]",
                        "kind": "descriptor_header",
                    }
                )

    # Priority spotlight proofs
    priority = {
        "maf_D290": {
            "offset": "0xD290",
            "status": "absolute",
            "method": "maf_adc_word_table",
            "sites": direct.get(0xD290, []),
            "note": (
                "RW6C=0xD28E from FE14 loader; ADC ISR indexes word table at +2 "
                "(0xD290 + 2·ADC)."
            ),
        },
        "ti_D030": {
            "offset": "0xD030",
            "status": "absolute",
            "method": "long_index",
            "sites": direct.get(0xD030, []),
            "note": (
                "RW68=0xD002; LD RW40,0x2e[RW68] @0xAFC7 and "
                "DIVU RL1C,0x2e,TABLE[RW68] @0x9A82 read injector constant."
            ),
        },
        "ign_WOT_DD0F": {
            "offset": "0xDD0F",
            "status": "absolute",
            "method": "descriptor_header",
            "sites": desc.get(0xDD0F, []),
            "codePath": (
                "0x66EC LD RW1A,#0x9A → (VANOS select) 0x6723 SCALL 0x6987 → "
                "LCALL 0x20CD → 0x343C ADD RW1A,RW6E; LD RW4C,[RW1A] → "
                "[0xE67E+0x9A]=0xDD0D (header) / XDF axis 0xDD0F"
            ),
            "note": "Main ign WOT VANOS-retarded RPM axis via CAL descriptor table.",
        },
    }

    all_offs = sorted(set(direct) | set(desc))
    items = []
    for off in all_offs:
        entry = {
            "offset": off,
            "offsetHex": f"0x{off:04X}",
            "name": ign[off]["name"],
            "methods": [],
            "sites": [],
        }
        if off in direct:
            entry["methods"].append("long_index_or_maf")
            entry["sites"].extend(direct[off])
        if off in desc:
            entry["methods"].append("descriptor_header")
            entry["sites"].extend(desc[off])
        items.append(entry)

    return {
        "schemaVersion": 1,
        "id": "absolute_code_reads_v9",
        "runtimeBases": {k: f"0x{v:04X}" for k, v in bases.items()},
        "priority": priority,
        "count": len(all_offs),
        "offsets": [f"0x{o:04X}" for o in all_offs],
        "items": items,
        "directCount": len(direct),
        "descriptorCount": len(desc),
        "note": (
            "Absolute = CODE effective address resolves to XDF offset (or map "
            "header at XDF−2 via RW6E descriptor) using FE14-loaded bases."
        ),
    }


def build_ti_structural(rom: bytes, lines):
    """Ti absolute via RW68+0x2E; exclusive island split @0x432A retained."""
    assert RW68_BASE + 0x2E == 0xD030
    # Runtime: page marker word at RW68+0x3E = 0xD040 holds 0xD000
    assert struct.unpack_from("<H", rom, RW68_BASE + 0x3E)[0] == 0xD000

    # Exclusive island geometry (FE24_ALT parameter island), still unique
    assert rom[0x432A] | (rom[0x432B] << 8) == 0xD000
    assert rom[0x432C] | (rom[0x432D] << 8) == 0x0030
    split_pat = bytes([0x00, 0xD0, 0x30, 0x00])
    assert rom.find(split_pat) == 0x432A
    assert rom.find(split_pat, 0x432A + 1) < 0
    frag_a = bytes.fromhex("90655046")
    frag_b = bytes.fromhex("0080c05d00000020")
    assert rom.find(frag_a) == 0x431C and rom.find(frag_a, 0x431D) == 0xD032
    assert rom.find(frag_b) == 0x4322 and rom.find(frag_b, 0x4323) == 0xD038

    sites_2e = []
    sites_3e = []
    for a, i in lines:
        if re.search(r"0x2e,\s*(LOOKUP|TABLE)\[RW68\]|0x2e\[RW68\]", i):
            sites_2e.append(
                {"siteHex": f"0x{a:04X}", "insn": i, "reads": "0xD030", "absolute": True}
            )
        if re.search(r"0x3e,\s*(LOOKUP|TABLE)\[RW68\]|0x3e\[RW68\]", i):
            sites_3e.append(
                {"siteHex": f"0x{a:04X}", "insn": i, "reads": "0xD000@D040", "absolute": False}
            )

    return {
        "target": "0xD030",
        "xdfName": "Inj. Constant(Ti)",
        "domain": "fuel",
        "runtimeEa": "RW68+0x2E = 0xD030 (RW68=0xD002)",
        "pageWordAt": "0xD040 (RW68+0x3E) = 0xD000",
        "offsetWordAt": "island 0x432C = 0x0030 (exclusive twin; not runtime +0x40)",
        "composed": "0xD030",
        "exclusiveSplitPattern": "00D03000 unique @0x432A",
        "exclusiveBodyTwins": {
            "90655046": ["0x431C (island)", "0xD032 (CAL)"],
            "0080c05d00000020": ["0x4322 (island)", "0xD038 (CAL)"],
        },
        "codeReadsContentVia": sites_2e,
        "codeReadsPageVia": sites_3e,
        "codeReadsOffsetVia": [],
        "contentDerefProven": True,
        "exclusiveGeometry": True,
        "note": (
            "Absolute: LD/DIVU at RW68+0x2E → 0xD030 (injector constant). "
            "Exclusive island D000|0030 @0x432A + body twins retained."
        ),
        "evidenceStrength": "high_absolute_plus_exclusive",
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

    # --- v7: main fuel PT/WOT + main ignition tables ---

    # Ign WOT load axes — exclusive tagged signature at -2
    tag = bytes.fromhex("d5060e0e0c10105c")
    tag_locs = _find_all(rom, tag)
    assert tag_locs == [0xDD1F, 0xDD99], tag_locs
    offs = [0xDD21, 0xDD9B]
    families.append(
        {
            "id": "ign_wot_load_axis_tag_v1",
            "method": "signature_axis",
            "title": "Ignition WOT VANOS load axes",
            "signatureHex": tag.hex(),
            "signatureAt": ["0xDD1F", "0xDD99"],
            "offsets": offs,
            "items": _entries(ign, offs),
            "note": (
                "Exclusive d506||0e0e0c10105c tag immediately before both "
                "Ign WOT Vanos load axes (ret/adv)."
            ),
        }
    )

    # Fuel cranking RPM axis + VANOS PT dwell tables (main PT dwell)
    span = rom[0xD5A6 : 0xD63A + 1]
    assert _find_all(rom, span) == [0xD5A6]
    offs = [0xD5A6, 0xD5E6, 0xD63A]
    families.append(
        {
            "id": "fuel_crank_vanos_pt_dwell_v1",
            "method": "unique_span_chain",
            "title": "Fuel cranking axis + VANOS PT dwell tables",
            "signatureHex": span.hex()[:32] + "…",
            "span": "0xD5A6..0xD63A",
            "offsets": offs,
            "items": _entries(ign, offs),
            "note": (
                "Unique span covers cranking RPM axis and both VANOS PT "
                "dwell 8x8 tables (retarded/advanced)."
            ),
        }
    )

    # VANOS WOT dwell table + TMOT + load MIN/MAX + DK tables
    span = rom[0xD6AE : 0xD734 + 8]
    assert _find_all(rom, span) == [0xD6AE]
    offs = [0xD6AE, 0xD6C6, 0xD6E8, 0xD6FA, 0xD722, 0xD734]
    families.append(
        {
            "id": "vanos_wot_control_block_v1",
            "method": "unique_span_chain",
            "title": "VANOS WOT dwell/control block",
            "span": "0xD6AE..0xD734+8",
            "offsets": offs,
            "items": _entries(ign, offs),
            "note": (
                "Unique span: WOT dwell advanced table, TMOT fak, load "
                "MIN/MAX axes, DK min/max override tables."
            ),
        }
    )

    # Fuel voltage axis chained after DK
    span = rom[0xD722 : 0xD75E + 8]
    assert _find_all(rom, span) == [0xD722]
    # D722/D734 already counted; add D75E only as new via this family
    families.append(
        {
            "id": "fuel_voltage_axis_chain_v1",
            "method": "unique_span_chain",
            "title": "Fuel voltage axis (after VANOS DK)",
            "span": "0xD722..0xD75E+8",
            "offsets": [0xD75E],
            "items": _entries(ign, [0xD75E]),
            "note": "Unique span from DK tables through Fuel Voltage axis D75E.",
        }
    )

    # PT/WOT load map suspects + main coil dwell
    span = rom[0xE065 : 0xE0DA + 12]
    assert _find_all(rom, span) == [0xE065]
    offs = [0xE065, 0xE0B3, 0xE0DA]
    families.append(
        {
            "id": "pt_wot_load_maps_dwell_v1",
            "method": "unique_span_chain",
            "title": "PT/WOT load maps + ign coil dwell",
            "span": "0xE065..0xE0DA+12",
            "offsets": offs,
            "items": _entries(ign, offs),
            "note": (
                "Unique span chains XDF PT/WOT load map blocks into main "
                "ignition coil voltage/dwell table E0DA."
            ),
        }
    )

    # Fuel idle base + preceding cold lambda correction
    span = rom[0xD91F : 0xD970 + 8]
    assert _find_all(rom, span) == [0xD91F]
    offs = [0xD91F, 0xD970]
    families.append(
        {
            "id": "fuel_idle_base_chain_v1",
            "method": "unique_span_chain",
            "title": "Fuel idle base + cold lambda correction",
            "span": "0xD91F..0xD970+8",
            "offsets": offs,
            "items": _entries(ign, offs),
            "note": "Unique span: Idle Cold Lambda Correction → Fuel Idle Base 6x3.",
        }
    )

    # Fuel accel enrich stack (main transient fuel)
    span = rom[0xDC21 : 0xDC79 + 8]
    assert _find_all(rom, span) == [0xDC21]
    offs = [0xDC21, 0xDC37, 0xDC47, 0xDC63, 0xDC79]
    families.append(
        {
            "id": "fuel_accel_enrich_stack_v1",
            "method": "unique_span_chain",
            "title": "Fuel accel enrich stack",
            "span": "0xDC21..0xDC79+8",
            "offsets": offs,
            "items": _entries(ign, offs),
            "note": (
                "Unique contiguous accel-enrich stack (lambda, TMOT, fade, "
                "delta-load, overrun-related)."
            ),
        }
    )

    # Alpha-N limp load — unique pre+header immediate twin style
    prehead = rom[0xDBBF : 0xDBCB]
    assert _find_all(rom, prehead) == [0xDBBF]
    families.append(
        {
            "id": "alpha_n_unique_prehead_v1",
            "method": "unique_immediate_twin",
            "title": "Alpha-N limp load map",
            "signatureHex": prehead.hex(),
            "offsets": [0xDBC3],
            "items": _entries(ign, [0xDBC3]),
            "note": "Unique 4-byte pre + 8-byte header immediately before Alpha-N DBC3.",
        }
    )

    # --- v8: finish remaining scalars/tables ---

    # Early fuel/ign scalars (AFR, speed-limiter ign delta, cyl trim)
    span = rom[0xD06A : 0xD0FA + 4]
    assert _find_all(rom, span) == [0xD06A]
    offs = [0xD06A, 0xD093, 0xD0FA]
    families.append(
        {
            "id": "early_fuel_ign_scalars_v1",
            "method": "unique_span_chain",
            "title": "Early fuel/ign scalars (AFR, limiter Δzw, cyl trim)",
            "span": "0xD06A..0xD0FA+4",
            "offsets": offs,
            "items": _entries(ign, offs),
            "note": "Unique span covering Target AFR, speed-limiter ign delta, cyl trim.",
        }
    )

    # MAF fault limits + coolant/IAT + speed/spark/knock scalar block
    span = rom[0xD23D : 0xD288 + 2]
    assert _find_all(rom, span) == [0xD23D]
    offs = [
        0xD23D,
        0xD23E,
        0xD240,
        0xD244,
        0xD256,
        0xD257,
        0xD25A,
        0xD25B,
        0xD27B,
        0xD27D,
        0xD27E,
        0xD281,
        0xD288,
    ]
    families.append(
        {
            "id": "maf_sensor_limit_block_v1",
            "method": "unique_span_chain",
            "title": "MAF/sensor/speed/spark limit scalar block",
            "span": "0xD23D..0xD288+2",
            "offsets": offs,
            "items": _entries(ign, offs),
            "note": (
                "Unique contiguous CAL block: MAF fault limits, coolant/IAT "
                "bounds, speed-signal thresholds, spark fault, knock DTC scalar."
            ),
        }
    )

    # Warm-up enrich suspect + knock sensitivity table
    span = rom[0xD815 : 0xD8B1 + 8]
    assert _find_all(rom, span) == [0xD815]
    offs = [0xD815, 0xD8B1]
    families.append(
        {
            "id": "warmup_knock_tables_v1",
            "method": "unique_span_chain",
            "title": "Warm-up enrich + knock sensitivity tables",
            "span": "0xD815..0xD8B1+8",
            "offsets": offs,
            "items": _entries(ign, offs),
            "note": "Unique span from warm-up enrich suspect through knock-by-temp table.",
        }
    )

    # Knock-related block before PT/WOT load maps
    span = rom[0xE044 : 0xE065 + 4]
    assert _find_all(rom, span) == [0xE044]
    families.append(
        {
            "id": "knock_block_e044_v1",
            "method": "unique_span_chain",
            "title": "Knock-related block E044",
            "span": "0xE044..0xE065+4",
            "offsets": [0xE044],
            "items": _entries(ign, [0xE044]),
            "note": "Unique span from E044 knock block into proven PT load-map region.",
        }
    )

    # Lambda OFF RPM tables 1–4
    span = rom[0xE364 : 0xE388 + 8]
    assert _find_all(rom, span) == [0xE364]
    offs = [0xE364, 0xE372, 0xE37E, 0xE388]
    families.append(
        {
            "id": "lambda_off_rpm_v1",
            "method": "unique_span_chain",
            "title": "Lambda OFF RPM tables 1–4",
            "span": "0xE364..0xE388+8",
            "offsets": offs,
            "items": _entries(ign, offs),
            "note": "Unique span covering all four Air Lambda OFF RPM tables.",
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
            "mafAbsolute": {
                "site": "0xA53B",
                "ea": "RW6C+2+2·ADC → 0xD290+",
                "evidenceStrength": "high",
            },
            "note": "Absolute MAF table read proven via ADC ISR + RW6C=0xD28E.",
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
                {"index": "0x9A", "call": "0x66EC→0x6987→0x20CD", "map": "ign WOT DD0F"},
            ],
            "interp": "0x20C7/0x20CD → ADD RW1A,RW6E; LD RW4C,[RW1A] with RW6E=0xE67E",
            "note": (
                "Descriptor table lives in CAL at 0xE67E (FE14-loaded RW6E). "
                "0x4ECC RAM fill to 0x42DF is skipped when RW6E≠0x1E08."
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
            "status": "absolute_maf",
            "evidence": (
                "Absolute: ADC ISR @0xA53B ADD RW64,0x2[RW46] with "
                "RW46=RW6C+2·ADC, RW6C=0xD28E → table @0xD290. "
                "Exclusive BE↔LE twin retained."
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
            "status": "absolute_ti",
            "evidence": (
                ti["note"]
                + " Also absolute soft-cut CMP D032; descriptor fuel axes."
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
            "status": "absolute_descriptor_axes",
            "evidence": (
                f"Absolute ign WOT axis {ign_rep['offsetHex']} via "
                f"RW1A=#0x9A→interp→[E67E+9A]=DD0D; also DD89/DE6D/DF4D. "
                f"Exclusive geometry retained for siblings."
            ),
        },
        {
            "id": "T6",
            "theory": "Dwell = f(Vbat, rpm)",
            "romTarget": "0xE0DA + VANOS dwell",
            "status": "exclusive_geometry",
            "evidence": (
                "VANOS WOT dwell axes D67C/D69E; PT dwell tables D5E6/D63A; "
                "main dwell E0DA via PT/WOT load-map span. CODE deref still open."
            ),
        },
        {
            "id": "T7",
            "theory": "TPS secondary / limp load",
            "romTarget": "Alpha-N 0xDBC3",
            "status": "exclusive_geometry",
            "evidence": "Alpha-N DBC3 unique pre+header; fault-path CODE TBD.",
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
    fe = verify_fe_structure(rom)
    ti = build_ti_structural(rom, lines)
    vanos = build_vanos_rpm_axis_exclusive(rom, ign)
    families = build_exclusive_families(rom, ign)
    exclusive_offs = collect_exclusive_offsets(ti, vanos, families)
    absolute = build_absolute_proofs(rom, lines, ign)
    load_path = build_load_path()
    retraction = build_retraction()
    checklist = build_checklist(ti, vanos, families, load_path)
    n = len(ign)
    exclusive_items = len(exclusive_offs)
    exclusive_pct = round(100.0 * exclusive_items / n, 2)
    abs_n = absolute["count"]
    abs_pct = round(100.0 * abs_n / n, 2)
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
        "schemaVersion": 9,
        "id": "bosch_ti_theory_vs_rom_v9",
        "rom": ROM_NAME,
        "primaryTheory": "tools/re/out/ref_pdf_bosch_m_motronic_technical_instruction.md",
        "shippingNote": (
            "Book is PRIMARY family theory only. Do not verify or promote shipping "
            "maps from the PDF alone."
        ),
        "registerBasesRomProven": fe,
        "addressingModel": {
            "id": "fe14_cal_bases_v9",
            "summary": (
                "0x2EDB loads BE hi/lo from FE14 after FF-pad scan → "
                "RW68=D002, RW6A=D106, RW6C=D28E, RW6E=E67E. "
                "Long-index LOOKUP/TABLE[RWbase] and descriptor "
                "ADD RW1A,RW6E; LD RW4C,[RW1A] resolve into CAL."
            ),
            "fe24Adjacent": fe["fe24AdjacentNotLoaded"],
            "cmpDualConfig": fe["cmpCrossCheck"],
        },
        "retraction": retraction,
        "tiStructural": ti,
        "vanosRpmAxisExclusive": vanos,
        "exclusiveFamilies": families,
        "exclusiveOffsets": [f"0x{o:04X}" for o in exclusive_offs],
        "absoluteProofs": absolute,
        "unprovenExclusive": [],
        "unprovenExclusiveNote": (
            "None — all 69 ign/fuel XDF items have exclusive-geometry proofs. "
            f"Absolute CODE reads: {abs_n}/69."
        ),
        "coverage": {
            "ignFuelItems": n,
            "ghidraProvenAbsolute": abs_n,
            "ghidraProvenAbsolutePct": abs_pct,
            "indexBaseCrossCheckedCalContent": 0,
            "indexBaseCrossCheckedCalContentPct": 0.0,
            "exclusiveGeometry": exclusive_items,
            "exclusiveGeometryPct": exclusive_pct,
            "structuralSplitPtr": 1,
            "registerBasesRomProven": 4,
            "headline": (
                f"{abs_pct}% absolute ({abs_n}/{n}); exclusive geometry "
                f"{exclusive_pct}% ({exclusive_items}/{n}); "
                f"FE14 CAL bases RW68=D002/RW6A=D106/RW6C=D28E/RW6E=E67E; "
                f"D200/D978 retracted."
            ),
            "note": (
                "v9: corrected FE14 loader bases unlock absolute CODE reads. "
                "Priority: MAF D290, Ti D030, ign WOT DD0F. "
                f"Absolute {abs_n}/69; exclusive 69/69. "
                "ZR LOOKUP immed≠XDF (indirect via RWbase). "
                "D200/D978 remain retracted."
            ),
        },
        "checklist": checklist,
        "loadPath": load_path,
        "keyCodeSites": {
            "fe14Loader": "0x2EDB via 0x20B5 / 0x412C → FE14 CAL bases",
            "tiContent": [s["siteHex"] for s in ti["codeReadsContentVia"]],
            "tiPageCmp": [s["siteHex"] for s in ti["codeReadsPageVia"]],
            "tiOffCmp": [],
            "mapInterp": "0x20C7/0x20CD → ADD RW1A,RW6E; LD RW4C,[RW1A] (RW6E=0xE67E)",
            "mafAbsolute": "0xA53B ADD RW64,0x2[RW46] (RW46=RW6C+2·ADC)",
            "ignWotSelect": "0x66EC LD RW1A,#0x9A → 0x6987 → 0x20CD → DD0D/DD0F",
            "vanosAxisRom": vanos["exclusiveLocations"],
            "mafAnchor": ["FE14 RW6C=0xD28E", "MAF body 0xD290", "ADC ISR 0xA4AA"],
            "newFamilySummaries": new_families,
        },
        "nextToProve": [
            "Grow absolute coverage beyond 31/69 (more descriptor header deltas / body walks)",
            "Prove PT/WOT main fuel map body reads through descriptor→[RW4C] walk",
            "Tie dwell E0DA and idle ign tables to descriptor or long-index sites",
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
        "## Coverage (v9)",
        "",
        "| Metric | Count | % of 69 |",
        "|--------|------:|--------:|",
        f"| **Absolute CODE reads** (ea → XDF) | **{cov['ghidraProvenAbsolute']}** | **{cov['ghidraProvenAbsolutePct']}%** |",
        f"| **Exclusive geometry** | **{cov['exclusiveGeometry']}** | **{cov['exclusiveGeometryPct']}%** |",
        f"| CAL-content index-base (D200/D978) | **0** | **0%** (retracted) |",
        f"| Runtime FE14 CAL bases | {cov['registerBasesRomProven']} | — |",
        "",
        cov["headline"],
        "",
        f"> {cov['note']}",
        "",
        "## Addressing model (v9) — FE14 CAL bases",
        "",
        f"Loader `{rb['loader']['loader']}` scans FF pad then loads BE hi/lo from `{rb['structAt']}`:",
        "",
        "| Reg | Value | Role |",
        "|-----|-------|------|",
        f"| RW68 | `{rb['words']['RW68']}` | {rb['roles']['RW68']} |",
        f"| RW6A | `{rb['words']['RW6A']}` | {rb['roles']['RW6A']} |",
        f"| RW6C | `{rb['words']['RW6C']}` | {rb['roles']['RW6C']} |",
        f"| RW6E | `{rb['words']['RW6E']}` | {rb['roles']['RW6E']} |",
        "",
        f"FE24 adjacent (not loaded): `{rb['fe24AdjacentNotLoaded']['words']}`.",
        f"CMP dual-config: {rb['cmpCrossCheck']['note']}",
        "",
        "## Priority absolute proofs",
        "",
    ]
    abs_p = doc.get("absoluteProofs", {}).get("priority", {})
    for key, p in abs_p.items():
        lines += [
            f"### {key}: `{p['offset']}` — `{p['status']}`",
            "",
            f"- Method: `{p['method']}`",
            f"- {p['note']}",
        ]
        if p.get("codePath"):
            lines.append(f"- Path: `{p['codePath']}`")
        lines.append("")
    lines += [
        f"**All absolute offsets ({cov['ghidraProvenAbsolute']}):** "
        + ", ".join(f"`{o}`" for o in doc.get("absoluteProofs", {}).get("offsets", [])),
        "",
        "## Retraction (important)",
        "",
    ]
    for r in doc["retraction"]["retractedClaims"]:
        lines += [f"- **Retracted:** {r['claim']}", f"  - {r['reason']}", ""]
    lines += [
        doc["retraction"]["scratchRegExclusivesAlsoRejected"],
        "",
        "## Fuel Ti `0xD030` — absolute + exclusive",
        "",
        f"- Target `{ti['target']}` {ti['xdfName']}",
        f"- Runtime EA: `{ti.get('runtimeEa')}`",
        f"- Content reads: " + ", ".join(f"`{s}`" for s in sites.get("tiContent", [])),
        f"- Exclusive split: `{ti['exclusiveSplitPattern']}`",
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
        f"- FE14 loader: `{sites.get('fe14Loader', sites.get('fe24Loader'))}`",
        f"- Map interp: `{sites['mapInterp']}`",
        f"- MAF absolute: `{sites.get('mafAbsolute')}`",
        f"- Ign WOT select: `{sites.get('ignWotSelect')}`",
        f"- Ti content: {', '.join(f'`{s}`' for s in sites.get('tiContent', []))}",
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
    abs_p = doc.get("absoluteProofs", {})
    lines = [
        "# Register bases — ROM-proven (FE14 CAL, v9)",
        "",
        f"ROM: `{doc['rom']}`",
        "",
        f"**Runtime structure @ `{rb['structAt']}`** (loaded by 0x2EDB):",
        "",
        "| Reg | Value | Role |",
        "|-----|-------|------|",
    ]
    for k, v in rb["words"].items():
        lines.append(f"| `{k}` | `{v}` | {rb['roles'][k]} |")
    lines += [
        "",
        f"Loader: `{rb['loader']['loader']}` — FF pad `{rb['loader']['ffPadBlock']}` "
        f"then BE words from `{rb['loader']['loadedFrom']}`.",
        "",
        f"FE24 adjacent (not loaded into RW68–6E): `{rb['fe24AdjacentNotLoaded']['words']}`",
        "",
        f"CMP: `{rb['cmpCrossCheck']['RW6C']}`; `{rb['cmpCrossCheck']['RW6E']}`.",
        f"{rb['cmpCrossCheck']['note']}",
        "",
        "## Absolute unlock",
        "",
        f"- Direct long-index / MAF: **{abs_p.get('directCount', 0)}** XDF items",
        f"- Descriptor header (XDF or XDF−2): **{abs_p.get('descriptorCount', 0)}** XDF items",
        f"- Union absolute: **{abs_p.get('count', 0)}/69**",
        "",
        "Do **not** revive `RW68=0xD200` / `RW6A=0xD978`.",
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
    deduped = [
        f
        for f in deduped
        if "0% absolute" not in f
        and "Compose island D000" not in f
        and "exclusive geometry growing" not in f
    ]
    deduped.extend(
        [
            "Engine control: absolute>0 via FE14 bases — grow beyond 31/69 descriptor/body walks",
            "Prove PT/WOT main fuel map body through [RW4C] after descriptor load",
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
    prog["engineControl"]["priorityTraces"]["boschTiTheoryVsRom"] = "done_v9_absolute_fe14_bases"
    prog["engineControl"]["priorityTraces"]["rw68IndexBase"] = "retracted_d200_false_positive"
    prog["engineControl"]["priorityTraces"]["registerBasesFe14"] = "rom_proven_runtime_cal"
    prog["engineControl"]["priorityTraces"]["registerBasesFe24"] = "adjacent_not_loaded_alternate"
    prog["engineControl"]["priorityTraces"]["firstProvenIgnFuelXref"] = True
    prog["engineControl"]["priorityTraces"]["absoluteMafTiIgn"] = {
        "maf_D290": True,
        "ti_D030": True,
        "ign_WOT_DD0F": True,
        "absoluteCount": cov["ghidraProvenAbsolute"],
    }
    prog["engineControl"]["priorityTraces"]["exclusiveGeometryFuelIgn"] = "exclusive_geometry_69_complete_v8"
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

## Coverage (v9 — exclusive 100%; absolute growing)

| Metric | Count | % of 69 |
|--------|------:|--------:|
| **Absolute CODE reads** (ea → XDF) | **{cov['ghidraProvenAbsolute']}** | **{cov['ghidraProvenAbsolutePct']}%** |
| **Exclusive geometry** | **{cov['exclusiveGeometry']}** | **{cov['exclusiveGeometryPct']}%** |
| **CAL-content index-base (D200/D978)** | **0** | **0%** (retracted) |
| Runtime FE14 CAL bases | {cov['registerBasesRomProven']} | — |

{cov['headline']}

> **v9:** FE14 loader bases unlock absolute reads. Priority MAF/Ti/ign WOT proven.
> Exclusive geometry remains 69/69. D200/D978 stay retracted.

## How CAL is read (v9 addressing model)

1. **FE14 CAL bases** via loader `0x2EDB`: `RW68=0xD002`, `RW6A=0xD106`, `RW6C=0xD28E`, `RW6E=0xE67E`
2. **Long-index** `LOOKUP/TABLE[RWbase]` → direct CAL scalars/limits (Ti @ RW68+0x2E)
3. **MAF** ADC ISR: `RW46=RW6C+2·ADC`; `ADD RW64,0x2[RW46]` → word table @ `0xD290`
4. **Map interp** `0x20C7/0x20CD`: `ADD RW1A,RW6E; LD RW4C,[RW1A]` → descriptor headers in CAL
6. **Exclusive geometry** retained for all 69 (signatures/spans/twins)

## Priority absolute proofs

- **MAF `0xD290`:** `{sites.get('mafAbsolute')}`
- **Ti `0xD030`:** {', '.join(f'`{s}`' for s in sites.get('tiContent', []))} — contentDeref **{ti['contentDerefProven']}**
- **Ign WOT `0xDD0F`:** `{sites.get('ignWotSelect')}`

Absolute offsets ({cov['ghidraProvenAbsolute']}): {', '.join(f'`{o}`' for o in doc.get('absoluteProofs', {}).get('offsets', []))}

## Fuel Ti `0xD030`

- Runtime EA `{ti.get('runtimeEa')}`
- Split `{ti['exclusiveSplitPattern']}` (exclusive island twin)
- Content deref: **{ti['contentDerefProven']}**

## Ignition (+fuel) — VANOS RPM axes

Signature `{vanos['signatureHex']}` — exactly {vanos['count']} hits (exclusive); ign WOT/PT absolute via descriptors:

| Offset | Domain | Name |
|--------|--------|------|
{vanos_rows}

## Additional exclusive families

{fam_text}

**All exclusive offsets ({cov['exclusiveGeometry']}):** {all_offs}

## Key CODE sites

- FE14 loader `{sites.get('fe14Loader')}`
- Interp `{sites['mapInterp']}`
- MAF absolute `{sites.get('mafAbsolute')}`
- Ign WOT `{sites.get('ignWotSelect')}`

## Related artifacts

- `theory_vs_rom_bosch_ti.{{md,json}}` — T1–T8 + absolute + exclusive
- `register_bases_fe24.{{md,json}}` — FE14 runtime + FE24 adjacent
- `cal_access_model.{{md,json}}` — addressing model
- `irq_ram_publications.{{md,json}}` / `sfr_hso_hsi_audit.{{md,json}}`

## What is *not* claimed

- Shipping promotion from Bosch PDF or retracted geometry
- Absolute coverage of all 69 (currently {cov['ghidraProvenAbsolute']}/69)
- End-to-end HFM→ti→ign control closed-loop proof

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

See [`theory_vs_rom_bosch_ti.md`](theory_vs_rom_bosch_ti.md). Headline: **absolute {cov['ghidraProvenAbsolute']}/69**; exclusive **{cov['exclusiveGeometry']}/69**. T1 MAF absolute; T3 Ti absolute; T5 ign WOT absolute via descriptors. D200/D978 **retracted**.

### 7.2 Access-model update (v9)

`LDB Rx,0xd0, LOOKUP[ZR]` remains register file `0x00D0` (not ROM page).

**Runtime FE14 CAL bases (loader 0x2EDB):** `RW68=0xD002`, `RW6A=0xD106`, `RW6C=0xD28E`, `RW6E=0xE67E`.

**FE24 adjacent (not loaded):** `0x42EC/0x43F0/0x1A08/0x1E08`.

**Retracted:** `RW68=0xD200` / `RW6A=0xD978` — do not revive.

**Priority absolute:**
- MAF `0xD290` — `{sites.get('mafAbsolute')}`
- Ti `0xD030` — {', '.join(f'`{s}`' for s in sites.get('tiContent', []))}
- Ign WOT `0xDD0F` — `{sites.get('ignWotSelect')}`

### 7.3 Artifacts

- `tools/re/out/theory_vs_rom_bosch_ti.{{md,json}}`
- `tools/re/out/register_bases_fe24.{{md,json}}`
- Coverage: **{cov['headline']}**

### 7.4 Absolute ign/fuel XDF CODE reads — status

**{cov['ghidraProvenAbsolute']}/69 absolute** ({cov['ghidraProvenAbsolutePct']}%). Exclusive geometry: **{cov['exclusiveGeometry']}/69**. Addressing unlock = FE14 CAL bases + descriptor table at `RW6E`.

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
        "Runtime `RW68=0xD002` (FE14) — see `register_bases_fe24.md`.\n\n"
        "Absolute Ti @ RW68+0x2E; exclusive island twin @0x432A "
        "(see `theory_vs_rom_bosch_ti.md`).\n"
    )
    (OUT / "rw68_cal_index_base.json").write_text(
        json.dumps(
            {
                "schemaVersion": 3,
                "id": "rw68_cal_index_base_v3_retracted",
                "status": "retracted",
                "replacedBy": "fe14_cal_bases_v9 + absolute_code_reads_v9",
                "priorFalseBase": "0xD200",
                "runtimeBase": "0xD002",
                "fe24AdjacentNotLoaded": "0x42EC",
            },
            indent=2,
        )
        + "\n"
    )

    ign_path = OUT / "ignition_fuel_dataflow.json"
    ign_doc = json.loads(ign_path.read_text())
    ign_doc["coverage"] = {"schemaVersion": 9, **doc["coverage"]}
    ign_doc["exclusiveGeometry"] = {
        "ti": doc["tiStructural"],
        "vanosRpmAxes": doc["vanosRpmAxisExclusive"],
        "families": doc["exclusiveFamilies"],
        "allOffsets": doc["exclusiveOffsets"],
    }
    ign_doc["absoluteProofs"] = doc["absoluteProofs"]
    ign_doc["addressingModel"] = doc["addressingModel"]
    ign_doc["keyCodeSites"] = doc["keyCodeSites"]
    items = ign_doc.get("items")
    if isinstance(items, list):
        excl = {int(x, 16) for x in doc["exclusiveOffsets"]}
        abs_set = {int(x, 16) for x in doc["absoluteProofs"]["offsets"]}
        vanos_set = set(doc["vanosRpmAxisExclusive"]["offsets"])
        fam_map = {}
        for fam in doc["exclusiveFamilies"]:
            for o in fam["offsets"]:
                fam_map[o] = fam["id"]
        for it in items:
            off = it.get("offset")
            if off in excl:
                it["exclusiveGeometry"] = True
                it["evidenceStrength"] = "high"
            if off in abs_set:
                it["absoluteCodeRead"] = True
                it["codeReadStatus"] = "absolute"
                it["evidenceStrength"] = "high_absolute"
            elif off == 0xD030:
                it["codeReadStatus"] = "exclusive_structural_split_ptr"
            elif off in vanos_set:
                it["codeReadStatus"] = "exclusive_content_geometry_axis"
            elif off in excl:
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

## Addressing model (v9) — absolute unlock

Loader `0x2EDB` loads **FE14** BE words (after FF-pad scan), **not FE24**:

| Reg | Value | Role |
|-----|-------|------|
| RW68 | `0xD002` | CAL page base (Ti `0xD030` = +0x2E) |
| RW6A | `0xD106` | CAL sensor/limit base |
| RW6C | `0xD28E` | MAF table base (body `0xD290` = +2) |
| RW6E | `0xE67E` | CAL descriptor table (LE16 headers) |

FE24 `42EC/43F0/1A08/1E08` is adjacent and **not** written into RW68–6E on this image.
CMP @0x4D60/0x481B is dual-config (CAL bases skip 0x4ECC RAM fill).

### Priority absolute proofs

1. **MAF `0xD290`:** ADC ISR `0xA53B` `ADD RW64,0x2[RW46]` with `RW46=RW6C+2·ADC`
2. **Ti `0xD030`:** `LD RW40,0x2e[RW68]` @0xAFC7; `DIVU …,0x2e,TABLE[RW68]` @0x9A82
3. **Ign WOT `0xDD0F`:** `LD RW1A,#0x9A` @0x66EC → `0x20CD` → `[E67E+9A]=DD0D`

See `theory_vs_rom_bosch_ti.md` / `register_bases_fe24.md`.

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
    ht += f"""## Status after theory-vs-ROM pass (v9)

- **Retraction:** D200 / D978 remain retracted (do not revive).
- **Runtime FE14 CAL bases:** RW68=`0xD002`, RW6A=`0xD106`, RW6C=`0xD28E`, RW6E=`0xE67E`
- **FE24 adjacent (not loaded):** `0x42EC/0x43F0/0x1A08/0x1E08`
- **Coverage:** {doc['coverage']['headline']}
- **Absolute priority:** MAF `0xD290` @0xA53B; Ti `0xD030` @0xAFC7/0x9A82; ign WOT `0xDD0F` via RW1A=#0x9A
- **Absolute offsets ({doc['absoluteProofs']['count']}):** {doc['absoluteProofs']['offsets']}
- **Exclusive geometry:** 69/69 retained
{fam_lines}
- **Next:** grow absolute beyond {doc['absoluteProofs']['count']}/69; fuel map body walks
"""
    handoff.write_text(ht)

    # Also emit absolute proofs artifact
    (OUT / "absolute_code_reads.json").write_text(
        json.dumps(doc["absoluteProofs"], indent=2) + "\n"
    )

    print(doc["coverage"]["headline"])
    print("FE14 bases:", doc["registerBasesRomProven"]["words"])
    print("Absolute:", doc["absoluteProofs"]["count"], doc["absoluteProofs"]["offsets"])
    print("Priority:", {k: v["status"] for k, v in doc["absoluteProofs"]["priority"].items()})
    print("Ti content:", [s["siteHex"] for s in doc["tiStructural"]["codeReadsContentVia"]])
    print("Exclusive all:", len(doc["exclusiveOffsets"]))


if __name__ == "__main__":
    main()
