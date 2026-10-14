#!/usr/bin/env python3
"""
Offline engine-control RE pass for RedLabel MCS-96 ROM.

Emits (under tools/re/out/):
  - control_loops.json / .md
  - ignition_fuel_dataflow.json / .md
  - updates code_verification_progress.json framing for ign+fuel CODE-read coverage

Hypotheses vs proven xrefs are labeled explicitly. Do not treat outputs as shipping.
"""

from __future__ import annotations

import csv
import json
import re
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]  # tools/re
OUT = ROOT / "out"
GHIDRA = OUT / "ghidra"
ROM_NAME = "BMW DME413 SW623 D466.29 C16x900A 94 RedLabel.bin"
CODE_START = 0x2000
CODE_END_INCL = 0xB930
DATA_START = 0xB931

IGN_FUEL_NAME_RE = re.compile(
    r"ign|fuel|spark|inj\.|injector|maf|lambda|vanos|knock|dwell|afr|"
    r"enrich|timing|wot|pt,|idle.*timing|coil|cranking",
    re.I,
)


def load_listing(path: Path) -> list[tuple[int, str]]:
    lines: list[tuple[int, str]] = []
    with path.open() as f:
        for line in f:
            m = re.match(r"^([0-9a-fA-F]+)\s+(.*)$", line.strip())
            if m:
                lines.append((int(m.group(1), 16), m.group(2)))
    return lines


def listing_index(lines: list[tuple[int, str]]) -> dict[int, str]:
    return {a: i for a, i in lines}


def nearby(lines: list[tuple[int, str]], addr: int, before: int = 0, after: int = 8) -> list[dict]:
    by = listing_index(lines)
    # find position
    addrs = [a for a, _ in lines]
    try:
        idx = addrs.index(addr)
    except ValueError:
        # nearest
        idx = min(range(len(addrs)), key=lambda i: abs(addrs[i] - addr), default=0)
    out = []
    for j in range(max(0, idx - before), min(len(lines), idx + after + 1)):
        a, i = lines[j]
        out.append({"addr": a, "addrHex": f"0x{a:04X}", "insn": i})
    return out


def page_lookup_sites(lines: list[tuple[int, str]]) -> dict[int, list[dict]]:
    """Map high-page byte -> CODE sites. Separates loads vs cmp touches."""
    load_pat = re.compile(
        r"^(?:LD|LDB|LDBZE|LDZE)\s+\w+,(0x[0-9a-fA-F]+),\s*(?:LOOKUP|TABLE)",
        re.I,
    )
    cmp_pat = re.compile(
        r"^(?:CMP|CMPB)\s+\w+,(0x[0-9a-fA-F]+),\s*(?:LOOKUP|TABLE)",
        re.I,
    )
    sites: dict[int, list[dict]] = defaultdict(list)
    for a, i in lines:
        m = load_pat.match(i)
        kind = "load"
        if not m:
            m = cmp_pat.match(i)
            kind = "cmp"
        if not m:
            continue
        imm = int(m.group(1), 16)
        if 0xB9 <= imm <= 0xFE:
            sites[imm].append(
                {"addr": a, "addrHex": f"0x{a:04X}", "insn": i, "kind": kind}
            )
    return sites


def scan_le16_in_code(rom: bytes, target: int) -> list[dict]:
    """Find LE16 immediate occurrences of target inside CODE window (raw bytes)."""
    lo = target & 0xFF
    hi = (target >> 8) & 0xFF
    hits = []
    for off in range(CODE_START, min(CODE_END_INCL, len(rom) - 1)):
        if rom[off] == lo and rom[off + 1] == hi:
            hits.append({"at": off, "atHex": f"0x{off:04X}"})
    return hits


def classify_item(name: str, category: str, rows: int, cols: int, data_size: int) -> tuple[str, str]:
    """Return (domain, role)."""
    cat = (category or "").lower()
    n = name.lower()

    fuelish = bool(
        re.search(
            r"fuel|inj\.|injector|maf|lambda|afr|enrich|alpha-n|cranking|overrun",
            n,
        )
    )
    ignish = bool(
        re.search(
            r"ign|spark|timing|dwell|vanos|knock|coil",
            n,
        )
    )

    if cat == "fuel" or (fuelish and not ignish):
        domain = "fuel"
    elif cat == "ignition" or (ignish and not fuelish):
        domain = "ignition"
    elif fuelish and ignish:
        domain = "both"
    elif cat in ("fuel", "ignition"):
        domain = cat
    else:
        domain = "both" if (fuelish or ignish) else "other"

    if "axis" in n or re.search(r"\|A\]", name):
        role = "axis"
    elif any(k in n for k in ("trim", "enrich", "correction", "delta", "attenuat", "fade")):
        role = "adjustment"
    elif rows * cols <= 1 and int(data_size or 8) in (8, 16) and "cal" not in n:
        role = "scalar"
    elif rows * cols > 1 or "map" in n or "table" in n or "cal" in n:
        role = "table"
    else:
        role = "scalar" if rows * cols <= 1 else "table"
    return domain, role


def select_ign_fuel_maps(maps: list[dict]) -> list[dict]:
    """Unique XDF-primary ignition/fuel-related maps by offset (DATA only)."""
    by_off: dict[int, dict] = {}
    for m in maps:
        name = m.get("name") or ""
        cat = m.get("category") or ""
        src = m.get("source") or ""
        trust = m.get("trustRank", 99)
        off = m.get("offset")
        if off is None:
            continue
        off = int(off)
        # DATA window only — exclude legacy mid-CODE claims (e.g. 0x8C00)
        if off < DATA_START:
            continue
        is_cat = cat.lower() in ("fuel", "ignition")
        is_name = bool(IGN_FUEL_NAME_RE.search(name))
        # Sensors/XDF categories only if clearly ign/fuel named
        if not is_cat and not is_name:
            continue
        if not is_cat and cat.lower() in ("sheet",):
            continue
        # Prefer xdf trustRank 1, then category Fuel/Ignition over name-only
        score = (0 if src == "xdf" else 1, trust, 0 if is_cat else 1)
        prev = by_off.get(off)
        if prev is None or score < prev["_score"]:
            rec = dict(m)
            rec["_score"] = score
            by_off[off] = rec
    out = []
    for off, m in sorted(by_off.items()):
        m.pop("_score", None)
        out.append(m)
    return out


def build_ign_fuel(lines, maps, rom: bytes | None) -> dict:
    page_sites = page_lookup_sites(lines)
    by_insn = listing_index(lines)
    selected = select_ign_fuel_maps(maps)

    items = []
    for m in selected:
        off = int(m["offset"])
        name = m.get("name") or ""
        domain, role = classify_item(
            name,
            m.get("category") or "",
            int(m.get("rows") or 1),
            int(m.get("cols") or 1),
            int(m.get("dataSize") or 8),
        )
        if domain == "other":
            continue

        page = (off >> 8) & 0xFF
        page_hits = page_sites.get(page, [])[:8]
        page_loads = [h for h in page_hits if h.get("kind") == "load"]
        page_cmps = [h for h in page_hits if h.get("kind") == "cmp"]

        addr16 = []
        page_base_hits = []
        if rom is not None:
            raw_hits = scan_le16_in_code(rom, off)
            for h in raw_hits[:16]:
                at = h["at"]
                listing_at = by_insn.get(at) or by_insn.get(at - 1) or by_insn.get(at - 2)
                aligned = at in by_insn or (at - 1) in by_insn or (at - 2) in by_insn
                addr16.append(
                    {
                        **h,
                        "listingAt": listing_at,
                        "aligned": bool(aligned),
                    }
                )
            page_base = page << 8
            if page_base != off:
                for h in scan_le16_in_code(rom, page_base)[:8]:
                    at = h["at"]
                    listing_at = by_insn.get(at) or by_insn.get(at - 1) or by_insn.get(at - 2)
                    page_base_hits.append(
                        {
                            **h,
                            "listingAt": listing_at,
                            "pageBaseHex": f"0x{page_base:04X}",
                        }
                    )

        # Status tiers (strongest first)
        ghidra_proven = False  # reserved: direct operand decode of full 16-bit DATA addr
        if any(h.get("aligned") and h.get("listingAt") for h in addr16):
            status = "candidate_code_literal_near_insn"
            strength = "medium"
        elif addr16:
            status = "candidate_raw_literal"
            strength = "low"
        elif page_loads:
            status = "candidate_page_indexed"
            strength = "low"
        elif page_cmps:
            status = "candidate_page_cmp_lookup"
            strength = "low"
        elif page_base_hits:
            status = "candidate_page_base_literal"
            strength = "low"
        else:
            status = "unknown"
            strength = "none"

        items.append(
            {
                "offset": off,
                "offsetHex": f"0x{off:04X}",
                "name": name,
                "domain": domain,
                "role": role,
                "formula": m.get("formula"),
                "rows": m.get("rows"),
                "cols": m.get("cols"),
                "dataSize": m.get("dataSize"),
                "category": m.get("category"),
                "source": m.get("source"),
                "codeReadStatus": status,
                "evidenceStrength": strength,
                "ghidraProven": ghidra_proven,
                "addr16HitsAligned": [h for h in addr16 if h.get("aligned")][:8],
                "addr16HitCount": len(addr16),
                "pageIndexedSamples": page_loads[:4] or page_cmps[:4],
                "pageBaseLiteralSamples": page_base_hits[:4],
                "pageByte": page,
                "runtimeNote": (
                    "CAL DATA accessed primarily via high-page LOOKUP loads "
                    f"(page 0x{page:02X}), not absolute 16-bit DATA immediates in CODE."
                ),
            }
        )

    proven = sum(1 for i in items if i["ghidraProven"])
    any_candidate = sum(1 for i in items if i["codeReadStatus"] != "unknown")
    # "Read-ish" = load or literal (excludes cmp-only page touches)
    readish = sum(
        1
        for i in items
        if i["codeReadStatus"]
        in (
            "candidate_page_indexed",
            "candidate_code_literal_near_insn",
            "candidate_raw_literal",
            "candidate_page_base_literal",
        )
    )
    literalish = sum(
        1
        for i in items
        if i["codeReadStatus"]
        in (
            "candidate_code_literal_near_insn",
            "candidate_raw_literal",
            "candidate_page_base_literal",
        )
    )
    page_only = sum(1 for i in items if i["codeReadStatus"] == "candidate_page_indexed")
    cmp_only = sum(1 for i in items if i["codeReadStatus"] == "candidate_page_cmp_lookup")

    n = len(items) or 1
    return {
        "schemaVersion": 1,
        "id": "ignition_fuel_dataflow_v1",
        "rom": ROM_NAME,
        "isa": "mcs96_80c196_family",
        "codeBounds": {
            "start": CODE_START,
            "endInclusive": CODE_END_INCL,
            "dataStart": DATA_START,
        },
        "selection": {
            "note": (
                "Unique DATA offsets (>=0xB931) from candidates.pack with "
                "Fuel/Ignition category or ign/fuel-related XDF name."
            ),
            "itemCount": len(items),
            "domains": dict(Counter(i["domain"] for i in items)),
            "roles": dict(Counter(i["role"] for i in items)),
        },
        "coverage": {
            "items": len(items),
            "ghidraProvenCodeRead": proven,
            "ghidraProvenPct": round(100.0 * proven / n, 2),
            "readishCandidate": readish,
            "readishCandidatePct": round(100.0 * readish / n, 2),
            "anyCandidateCodeHint": any_candidate,
            "anyCandidateCodeHintPct": round(100.0 * any_candidate / n, 2),
            "literalNearInsnOrRaw": literalish,
            "literalNearInsnOrRawPct": round(100.0 * literalish / n, 2),
            "pageIndexedOnly": page_only,
            "pageIndexedOnlyPct": round(100.0 * page_only / n, 2),
            "pageCmpLookupOnly": cmp_only,
            "pageCmpLookupOnlyPct": round(100.0 * cmp_only / n, 2),
            "definitionOfProven": (
                "ghidraProven = listing operand decodes full DATA address "
                f"(>=0x{DATA_START:04X}) as immediate/base. Currently 0 — "
                "firmware uses page-indexed LOOKUP (high byte only)."
            ),
            "definitionOfCandidate": (
                "candidate_page_indexed = LD/LDB of high page byte via LOOKUP/TABLE; "
                "candidate_page_cmp_lookup = CMP/CMPB LOOKUP touch only (weaker); "
                "candidate_*_literal = LE16 of offset/page-base appears in CODE bytes."
            ),
            "headlineMetric": "ghidraProvenPct",
            "headlineNote": (
                "Track % with proven CODE read; also report readishCandidatePct "
                "(page load or literal) vs cmp-only touches."
            ),
        },
        "accessModelHypothesis": {
            "strength": "medium",
            "summary": (
                "Calibration bytes in 0xD000–0xEFFF are read via LOOKUP/TABLE with "
                "an 8-bit page immediate (e.g. LDB R56,0xd0, LOOKUP[ZR]), then indexed "
                "with ZR/RW pointer math — not via absolute 16-bit DATA immediates."
            ),
            "pageLoadCounts": {
                f"0x{p:02X}": len(v) for p, v in sorted(page_sites.items()) if 0xD0 <= p <= 0xEF
            },
            "absoluteDataLookupRefsInListing": 4,
            "note": "Absolute LOOKUP operands >=0xB931 are rare (FFCA/FE8x); not the primary map path.",
        },
        "items": items,
        "shippingNote": "Research-only. Do not promote into definitions/packs/*.shipping.json.",
    }


def build_control_loops(lines, irq: dict, cfg: dict, functions: list[dict]) -> dict:
    edges = cfg.get("edges") or []
    fanin = Counter(e["to"] for e in edges)
    top_targets = [
        {
            "addr": a,
            "addrHex": f"0x{a:04X}",
            "fanIn": c,
            "listing": listing_index(lines).get(a),
        }
        for a, c in fanin.most_common(12)
    ]

    irq_loops = []
    for s in irq.get("sites") or []:
        land = s.get("landing") or {}
        irq_loops.append(
            {
                "id": s.get("id"),
                "vectorIndex": s.get("vectorIndex"),
                "vectorAddrHex": s.get("vectorAddrHex"),
                "stubAddrHex": s.get("stubAddrHex"),
                "stubPrologue": s.get("stubPrologue"),
                "landingAddrHex": (s.get("cfg_edge_from") or {}).get("toHex"),
                "landingInsns": (land.get("ghidra_insns_nearby") or [])[:6],
                "verificationStatus": (s.get("cfg_edge_from") or {}).get("verificationStatus"),
                "hypothesis": None,  # filled below
                "evidenceStrength": "medium",
            }
        )

    # Fill IRQ hypotheses from known landings
    hyp_map = {
        0: {
            "name": "ios0_edge_timer_tick",
            "summary": "IOS0 XOR edge; may set INT_PEND bit0 / bump RW7A; POPF+RET. Candidate timer/port edge ISR.",
            "strength": "medium",
        },
        1: {
            "name": "unused_or_spurious_ret",
            "summary": "Landing is bare RET @0xA4A9 (same as vec4). Likely unused vector.",
            "strength": "high",
        },
        2: {
            "name": "hsi_capture_crank_cam",
            "summary": "FUN_a88e: ORB IOS1, read HSI_time repeatedly, TIMER2 store, period math into RAM. Strong candidate crank/cam HSI ISR.",
            "strength": "high",
        },
        3: {
            "name": "ios0_state_machine",
            "summary": "XOR IOS0 into RA1; conditional STB + LJMP into trampoline table (0x4145…). Candidate I/O edge / synch state ISR.",
            "strength": "medium",
        },
        4: {
            "name": "unused_or_spurious_ret",
            "summary": "Same bare RET @0xA4A9 as vec1.",
            "strength": "high",
        },
        5: {
            "name": "adc_hsi_schedule",
            "summary": "ORB IOS1; AD_resultlo write; HSI_status/HSI_time schedule (+0x1F4). Candidate ADC-complete / timed sample ISR.",
            "strength": "medium",
        },
        6: {
            "name": "serial_sbuf",
            "summary": "Stub → 0x20AF → FUN_2eaa: SBUF/SP_STAT path with POPF+RET. Candidate SCI/diagnostic IRQ.",
            "strength": "medium",
        },
        7: {
            "name": "counter_overflow_helper",
            "summary": "INCB RDB with saturate; POPF+RET. Small helper ISR / soft counter.",
            "strength": "medium",
        },
    }
    for entry in irq_loops:
        h = hyp_map.get(entry["vectorIndex"], {})
        entry["hypothesis"] = h.get("name")
        entry["hypothesisSummary"] = h.get("summary")
        entry["evidenceStrength"] = h.get("strength", "low")

    loops = [
        {
            "id": "boot_reset",
            "kind": "boot",
            "entryHex": "0x2080",
            "path": [
                "VECTOR_Reset @0x2080: TIMER1lo watchdog kick",
                "spin until [0x4000]==0x5AA5",
                "LJMP 0x4120 → LJMP 0x476B HW init (SP, IOS0/1, AD, HSI_*, PORT1/2)",
                "LJMP 0x2097 → FUN_3679 RAM copy / integrity",
                "eventually FUN_4815 → EI @0x491F",
            ],
            "evidenceStrength": "high",
            "status": "hypothesized_with_strong_listing",
            "openQuestions": [
                "Exact order of post-EI foreground vs IRQ-driven work",
                "Which RAM flags gate idle vs run",
            ],
        },
        {
            "id": "watchdog_kick",
            "kind": "timed_safety",
            "pattern": "LDB TIMER1lo,#0x1e ; LDB TIMER1lo,#-0x1f",
            "sitesSample": ["0x2080", "0x36AE", "0x4815", "0x528B", "0x916C"],
            "evidenceStrength": "high",
            "status": "proven_pattern",
            "note": "Repeated across large functions; MCS-96 WDT service via TIMER1 lo writes.",
        },
        {
            "id": "trampoline_dispatch",
            "kind": "foreground_dispatch",
            "entryHex": "0x2094-0x20D3",
            "note": (
                "Dense LJMP trampoline table. 0x20C7 (fan-in 93 LCALLs) → 0x33C2 "
                "table/interp helper; 0x20CD fan-in 31. Likely shared map-interp / "
                "service calls used by fuel+ign math."
            ),
            "hotTargets": top_targets[:6],
            "evidenceStrength": "medium",
            "status": "hypothesis",
        },
        {
            "id": "foreground_run_init",
            "kind": "foreground",
            "entryHex": "0x4815",
            "path": [
                "FUN_4815: watchdog, PORT1/2 mirror, HSI_time sync loop (JBS IOS1.7)",
                "INT_MASK load, clear INT_PEND, schedule HSI_status/HSI_time channels",
                "EI @0x491F then RAM clear / state init (continues in FUN_4815 body)",
            ],
            "evidenceStrength": "medium",
            "status": "hypothesis",
            "openQuestions": [
                "Locate tight idle spin vs cooperative task schedule after 0x4Axx",
                "Map LCALL 0x20C7 sites in this function to which cal pages",
            ],
        },
        {
            "id": "irq_vector_bank",
            "kind": "interrupt",
            "entryHex": "0x2000 vectors → 0x4178 stubs",
            "siteCount": irq.get("siteCount"),
            "sitesInsideCode": irq.get("sitesInsideCodeToB930"),
            "handlers": irq_loops,
            "evidenceStrength": "high",
            "status": "cross_checked_targets_hypothesized_roles",
        },
        {
            "id": "hso_schedule_outputs",
            "kind": "output_path",
            "note": (
                "Listing shows many LDB HSI_status,#imm + LD/ADD HSI_time sequences "
                "and PORT1/PORT2 stores. On 80C196, spark/injector pulses are often "
                "HSO-scheduled; Ghidra may be naming HSO command/time as HSI_*. "
                "Treat as output-scheduling hypothesis until SFR map is confirmed."
            ),
            "counts": {
                "HSI_statusRefs": sum(1 for _, i in lines if "HSI_status" in i),
                "HSI_timeRefs": sum(1 for _, i in lines if "HSI_time" in i),
                "PORT1Refs": sum(1 for _, i in lines if "PORT1" in i),
                "PORT2Refs": sum(1 for _, i in lines if "PORT2" in i),
            },
            "evidenceStrength": "low",
            "status": "hypothesis",
            "openQuestions": [
                "Confirm SFR addresses for HSO_COMMAND / HSO_TIME vs HSI_* in this Ghidra language",
                "Which channel bits fire coil vs injectors",
            ],
        },
        {
            "id": "map_interp_helper",
            "kind": "shared_runtime",
            "entryHex": "0x33C2",
            "note": (
                "Reached via trampoline 0x20C7. Body does pointer chase + DJNZ "
                "accumulate — classic axis/map interpolate. Not ignition/fuel "
                "specific; shared by many LCALL sites."
            ),
            "evidenceStrength": "medium",
            "status": "hypothesis",
        },
    ]

    largest = sorted(
        (
            {
                "entryHex": f"0x{int(f['entry']):04X}",
                "name": f["name"],
                "bodySize": int(f["body_size"]),
            }
            for f in functions
            if f.get("is_thunk") != "true"
        ),
        key=lambda x: -x["bodySize"],
    )[:12]

    return {
        "schemaVersion": 1,
        "id": "control_loops_v1",
        "rom": ROM_NAME,
        "isa": "mcs96_80c196_family",
        "ghidraLanguage": "MCS96:LE:16:default",
        "codeBounds": {
            "start": CODE_START,
            "endInclusive": CODE_END_INCL,
            "dataStart": DATA_START,
        },
        "disclaimer": (
            "Loop roles are hypotheses grounded in Ghidra listing + PC-rel CFG. "
            "IRQ stub targets are cross_checked; semantic labels are not proven. "
            "Do not claim full engine control yet."
        ),
        "loops": loops,
        "cfgSummary": {
            "pcRelEdgeCount": cfg.get("edgeCount") or len(edges),
            "topFanInTargets": top_targets,
        },
        "largestFunctions": largest,
        "endToEndControlSketch": {
            "status": "partial_hypothesis",
            "steps": [
                "Sensors/IRQ: HSI capture (vec2) + ADC schedule (vec5) + IOS edges update RAM timestamps/flags",
                "Foreground: FUN_4815+ tasks LCALL trampolines (0x20C7 interp) using page-indexed CAL in 0xDxxx–0xExxx",
                "Outputs: HSI_*/PORT1/PORT2 writes schedule or drive actuators (spark/fuel unproven which bits)",
                "Safety: TIMER1lo watchdog kicks throughout; soft/hard fuel cut scalars in XDF (CODE path TBD)",
            ],
        },
        "openQuestions": [
            "Identify spark vs injector HSO/PORT bit assignments",
            "Trace MAF table 0xD290 through page 0xD2 loads into final Ti / inj pulse",
            "Trace ign WOT/PT maps 0xDD27/0xDDA1/0xDE8B/0xDF6B to dwell/advance output",
            "Idle vs run mode flag(s) in RAM (candidates near 0x13ea test in FUN_4815)",
            "Promote any item to ghidraProven only after full address operand or proven index base",
        ],
        "nextSteps": [
            "Deep-trace IRQ vec2 (0xA88E) and vec5 (0xA4AA) to RAM variables they publish",
            "Build page-index resolver: when CODE loads 0xD0/D7/…, follow ZR/RW until table base lands on XDF offset",
            "SFR audit: dump Ghidra MCS96 register map for HSO vs HSI naming at used addresses",
            "From FUN_4815 post-EI, enumerate LCALL 0x20C7 call sites and preceding page loads",
            "For each ignition timing + fueling XDF table, find exclusive page+index path (not just page hit)",
        ],
        "shippingNote": "Research-only. Verification gates for promotion unchanged.",
    }


def render_control_md(doc: dict) -> str:
    lines = [
        "# Control loops (hypotheses) — RedLabel MCS-96",
        "",
        f"ROM: `{doc['rom']}`",
        f"ISA: **{doc['isa']}** / `{doc['ghidraLanguage']}`",
        f"CODE: `0x{CODE_START:04X}`–`0x{CODE_END_INCL:04X}` inclusive; DATA from `0x{DATA_START:04X}`.",
        "",
        f"> {doc['disclaimer']}",
        "",
        "## Loop inventory",
        "",
    ]
    for loop in doc["loops"]:
        lines.append(f"### `{loop['id']}` ({loop['kind']}) — evidence **{loop['evidenceStrength']}**")
        lines.append("")
        lines.append(f"- Status: `{loop.get('status')}`")
        if loop.get("entryHex"):
            lines.append(f"- Entry: `{loop['entryHex']}`")
        if loop.get("pattern"):
            lines.append(f"- Pattern: `{loop['pattern']}`")
        if loop.get("note"):
            lines.append(f"- Note: {loop['note']}")
        if loop.get("path"):
            lines.append("- Path:")
            for p in loop["path"]:
                lines.append(f"  - {p}")
        if loop.get("handlers"):
            lines.append("- IRQ handlers:")
            for h in loop["handlers"]:
                lines.append(
                    f"  - vec{h['vectorIndex']} `{h.get('vectorAddrHex')}` stub `{h.get('stubAddrHex')}` "
                    f"→ `{h.get('landingAddrHex')}` — **{h.get('hypothesis')}** "
                    f"({h.get('evidenceStrength')}): {h.get('hypothesisSummary')}"
                )
        if loop.get("openQuestions"):
            lines.append("- Open:")
            for q in loop["openQuestions"]:
                lines.append(f"  - {q}")
        if loop.get("counts"):
            lines.append(f"- Counts: `{loop['counts']}`")
        lines.append("")

    lines += [
        "## End-to-end engine control (sketch)",
        "",
        f"Status: `{doc['endToEndControlSketch']['status']}` — **not** complete control.",
        "",
    ]
    for s in doc["endToEndControlSketch"]["steps"]:
        lines.append(f"1. {s}")
    lines += ["", "## CFG hot targets (LJMP/LCALL only)", ""]
    for t in doc["cfgSummary"]["topFanInTargets"][:8]:
        lines.append(f"- `{t['addrHex']}` fan-in={t['fanIn']} — `{t.get('listing')}`")
    lines += ["", "## Largest non-thunk functions", ""]
    for f in doc["largestFunctions"]:
        lines.append(f"- `{f['entryHex']}` {f['name']} size={f['bodySize']}")
    lines += ["", "## Open questions", ""]
    for q in doc["openQuestions"]:
        lines.append(f"- {q}")
    lines += ["", "## Next concrete RE steps", ""]
    for s in doc["nextSteps"]:
        lines.append(f"1. {s}")
    lines += ["", "---", doc["shippingNote"], ""]
    return "\n".join(lines)


def render_ign_md(doc: dict) -> str:
    cov = doc["coverage"]
    lines = [
        "# Ignition & fuel dataflow — XDF → DATA → CODE",
        "",
        f"ROM: `{doc['rom']}`",
        f"ISA: `{doc['isa']}`",
        f"CODE `0x{CODE_START:04X}`–`0x{CODE_END_INCL:04X}`; DATA from `0x{DATA_START:04X}`.",
        "XDF (BRO) = primary definition evidence for names/equations.",
        "",
        "## Coverage (this pass)",
        "",
        f"| Metric | Count | % of {cov['items']} |",
        "|--------|------:|--------------------:|",
        f"| **Ghidra-proven CODE read** (full DATA addr in operand) | **{cov['ghidraProvenCodeRead']}** | **{cov['ghidraProvenPct']}%** |",
        f"| Readish candidate (page LD/LDB or LE16 literal) | {cov['readishCandidate']} | {cov['readishCandidatePct']}% |",
        f"| Any CODE page/literal hint (incl. CMP LOOKUP) | {cov['anyCandidateCodeHint']} | {cov['anyCandidateCodeHintPct']}% |",
        f"| Literal LE16 near/in insn (still unproven) | {cov['literalNearInsnOrRaw']} | {cov['literalNearInsnOrRawPct']}% |",
        f"| Page LD/LDB only | {cov['pageIndexedOnly']} | {cov['pageIndexedOnlyPct']}% |",
        f"| Page CMP LOOKUP only | {cov['pageCmpLookupOnly']} | {cov['pageCmpLookupOnlyPct']}% |",
        "",
        f"Proven definition: {cov['definitionOfProven']}",
        "",
        f"Candidate definition: {cov['definitionOfCandidate']}",
        "",
        "## Access model (hypothesis)",
        "",
        f"**{doc['accessModelHypothesis']['strength']}:** {doc['accessModelHypothesis']['summary']}",
        "",
        "Page-load site counts (0xD0–0xEF):",
        "",
    ]
    for k, v in sorted(doc["accessModelHypothesis"]["pageLoadCounts"].items()):
        lines.append(f"- `{k}`: {v}")
    lines += [
        "",
        "## Items by domain / role",
        "",
        f"Domains: `{doc['selection']['domains']}`",
        f"Roles: `{doc['selection']['roles']}`",
        "",
        "| Off | Domain | Role | Status | Ev | Name |",
        "|-----|--------|------|--------|----|------|",
    ]
    for i in doc["items"]:
        nm = (i["name"] or "").replace("|", "/")[:64]
        lines.append(
            f"| `{i['offsetHex']}` | {i['domain']} | {i['role']} | `{i['codeReadStatus']}` | "
            f"{i['evidenceStrength']} | {nm} |"
        )

    # Highlight key maps
    lines += [
        "",
        "## Priority maps (control-relevant)",
        "",
        "### Fueling",
        "",
    ]
    fuel_keys = ("D030", "D06A", "D290", "D970", "D8EF", "DBC3", "DC21")
    for i in doc["items"]:
        if any(k.lower() in i["offsetHex"].lower() for k in fuel_keys) or (
            i["domain"] == "fuel" and i["role"] in ("table", "scalar") and i["offset"] <= 0xD300
        ):
            samples = ", ".join(
                f"`{s['addrHex']}`" for s in (i.get("pageIndexedSamples") or [])[:3]
            ) or "—"
            lines.append(
                f"- `{i['offsetHex']}` **{i['role']}** `{i['codeReadStatus']}` — {i['name'][:70]}"
            )
            lines.append(f"  - page `0x{i['pageByte']:02X}` CODE samples: {samples}")

    lines += ["", "### Ignition timing", ""]
    ign_keys = ("DCF3", "DD05", "DD21", "DD9B", "DE7F", "DF5F", "E0DA", "D093")
    for i in doc["items"]:
        if any(k.lower() in i["offsetHex"].lower() for k in ign_keys) or (
            i["domain"] == "ignition" and i["role"] == "table" and i["offset"] >= 0xDCCF
        ):
            samples = ", ".join(
                f"`{s['addrHex']}`" for s in (i.get("pageIndexedSamples") or [])[:3]
            ) or "—"
            lines.append(
                f"- `{i['offsetHex']}` **{i['role']}** `{i['codeReadStatus']}` — {i['name'][:70]}"
            )
            lines.append(f"  - page `0x{i['pageByte']:02X}` CODE samples: {samples}")

    lines += [
        "",
        "## CODE-local constants",
        "",
        "No ignition/fuel conversion constants have been **proven** as CODE immediates tied to XDF formulas yet.",
        "Watchdog immediates (`#0x1e` / `#-0x1f`) and HSI schedule deltas (`#0x1f4`, `#0xc8`, `#0x32`, `#0xfa`) "
        "are CODE-local but not yet mapped to XDF items.",
        "",
        "## What is *not* claimed",
        "",
        "- Complete spark/fuel output control path",
        "- Proven per-map CODE xrefs (0 ghidraProven)",
        "- Shipping definition updates",
        "",
        "---",
        doc["shippingNote"],
        "",
    ]
    return "\n".join(lines)


def update_progress(ign: dict) -> None:
    path = OUT / "code_verification_progress.json"
    doc = json.loads(path.read_text()) if path.exists() else {"schemaVersion": 2}
    cov = ign["coverage"]
    doc["engineControl"] = {
        "goal": "control_loops_plus_ignition_fuel_dataflow",
        "completeControlClaimed": False,
        "artifacts": [
            "tools/re/out/control_loops.md",
            "tools/re/out/control_loops.json",
            "tools/re/out/ignition_fuel_dataflow.md",
            "tools/re/out/ignition_fuel_dataflow.json",
        ],
        "ignitionFuelCoverage": {
            "items": cov["items"],
            "ghidraProvenCodeRead": cov["ghidraProvenCodeRead"],
            "ghidraProvenPct": cov["ghidraProvenPct"],
            "readishCandidate": cov["readishCandidate"],
            "readishCandidatePct": cov["readishCandidatePct"],
            "anyCandidateCodeHint": cov["anyCandidateCodeHint"],
            "anyCandidateCodeHintPct": cov["anyCandidateCodeHintPct"],
            "literalNearInsnOrRaw": cov["literalNearInsnOrRaw"],
            "pageIndexedOnly": cov["pageIndexedOnly"],
            "pageCmpLookupOnly": cov["pageCmpLookupOnly"],
            "headline": (
                f"{cov['ghidraProvenPct']}% proven CODE reads "
                f"({cov['ghidraProvenCodeRead']}/{cov['items']}); "
                f"{cov['readishCandidatePct']}% readish candidates "
                f"(page LD/LDB or literal); "
                f"{cov['anyCandidateCodeHintPct']}% any CODE page/literal hint "
                f"(includes CMP LOOKUP)."
            ),
        },
    }
    # keep prior open follow-ups and extend
    cv = doc.setdefault("codeVerification", {})
    follows = list(cv.get("openFollowUps") or [])
    extra = [
        "Engine control: 0% ghidraProven ign/fuel CODE reads — resolve page-index bases to XDF offsets",
        "Trace HSI_*/PORT outputs to spark vs injector (SFR naming audit)",
        "Do not claim full CODE+DATA control; verification gates unchanged",
    ]
    for e in extra:
        if e not in follows:
            follows.append(e)
    cv["openFollowUps"] = follows
    path.write_text(json.dumps(doc, indent=2) + "\n")


def main() -> None:
    lines = load_listing(GHIDRA / "ghidra_listing.txt")
    irq = json.loads((OUT / "irq_stubs_review.json").read_text())
    cfg = json.loads((OUT / "mcs96_cfg_edges.json").read_text())
    pack = json.loads((OUT / "candidates.pack.json").read_text())
    maps = pack.get("candidateMaps") or []

    functions = []
    with (GHIDRA / "ghidra_functions.csv").open() as f:
        for row in csv.DictReader(f):
            functions.append(row)

    rom = None
    rom_path = ROOT.parent.parent / "public" / "rom" / ROM_NAME
    if rom_path.exists():
        rom = rom_path.read_bytes()

    control = build_control_loops(lines, irq, cfg, functions)
    ign = build_ign_fuel(lines, maps, rom)

    (OUT / "control_loops.json").write_text(json.dumps(control, indent=2) + "\n")
    (OUT / "control_loops.md").write_text(render_control_md(control))
    (OUT / "ignition_fuel_dataflow.json").write_text(json.dumps(ign, indent=2) + "\n")
    (OUT / "ignition_fuel_dataflow.md").write_text(render_ign_md(ign))
    update_progress(ign)

    print(
        json.dumps(
            {
                "controlLoops": len(control["loops"]),
                "ignFuelItems": ign["coverage"]["items"],
                "provenPct": ign["coverage"]["ghidraProvenPct"],
                "readishPct": ign["coverage"]["readishCandidatePct"],
                "anyHintPct": ign["coverage"]["anyCandidateCodeHintPct"],
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
