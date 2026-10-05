# Ignition & fuel dataflow — XDF → DATA → CODE

ROM: `BMW DME413 SW623 D466.29 C16x900A 94 RedLabel.bin`
ISA: `mcs96_80c196_family`
CODE `0x2000`–`0xB930`; DATA from `0xB931`.
XDF (BRO) = primary definition evidence for names/equations.

## Coverage (v2 — corrected access model)

| Metric | Count | % of 69 |
|--------|------:|--------------------:|
| **Ghidra-proven CODE read** (ea == XDF offset) | **0** | **0.0%** |
| Structural split-ptr (`0xD000`+`0x0030`→`0xD030`) | 1 | 1.45% |
| Access path unresolved | 68 | — |

0.0% proven CODE reads (0/69); 1 structural split-ptr (0xD030); page-index candidates retracted.

> **Correction:** `LDB Rx,0xd0, LOOKUP[ZR]` addresses **register `0x00D0`**, not ROM page `0xD0`.
> Prior “page-indexed” candidate counts are **retracted**. See `cal_access_model.md`.

## How CAL is likely read

1. Map-interp trampoline `0x20C7` → `0x33C2`
2. Descriptor base **RW6E = `0x1E08`** (filled/templated @`0x4ED9`)
3. Indirect `[descriptor]` → axis/map pointers into `0xDxxx` (**targets not yet proven** in this external image)

## Related artifacts

- `cal_access_model.{md,json}` — full per-item v2 statuses
- `irq_ram_publications.{md,json}` — vec2/vec5 RAM pubs
- `sfr_hso_hsi_audit.{md,json}` — HSO write alias
- `motronic_331_function.md` §7 — theory vs ROM checklist

## What is *not* claimed

- Complete spark/fuel output control path
- Proven per-map CODE xrefs (still 0 ghidraProven on XDF ign/fuel offsets)
- Shipping definition updates

## Theory reference (Bosch M-Motronic TI)

Expected fuel/ign math (HFM load → base ti + corrections; zw map(load,rpm); dwell vs Vbat/rpm) is page-cited in [`ref_pdf_bosch_m_motronic_technical_instruction.md`](ref_pdf_bosch_m_motronic_technical_instruction.md). Control-concept framing: [`motronic_331_function.md`](motronic_331_function.md). This dataflow file remains XDF→CODE evidence only.

---
Research-only. Verification gates for promotion unchanged.
