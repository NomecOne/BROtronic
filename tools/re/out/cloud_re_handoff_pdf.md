# Cloud RE handoff — new Bosch PDF evidence

**Date:** 2026-10-04  
**Branch:** `cursor/redlabel-ghidra-re-48cf` (PR #5)

## Signal

Richard added a **local PRIMARY** Bosch *M-Motronic Engine Management* Technical Instruction PDF under `tools/re/docs/`. Use it for **theory-vs-ROM** framing (HFM load → ti / zw / dwell / lambda). PDFs are **not** in git (copyright); notes are.

## Exact files

- `tools/re/docs/Bosch-M-Motronic-Technical-Instruction.pdf` (canonical)
- `tools/re/docs/Bosch M-Motronic Engine Management 89403362.pdf` (identical SHA-256 duplicate)
- Extract: `tools/re/out/ref_pdf_bosch_m_motronic_technical_instruction.md`
- Cross-links: `motronic_331_function.md`, `control_loops.md`, `ignition_fuel_dataflow.md`

## Resume directive

1. Prefer page cites from the extract (booklet pp. 28–30 load/HFM; 38–41 ti/zw/dwell) over Archive.org borrow.
2. Prove or refute T1–T8 / H1–H7 in MCS-96 CODE against RedLabel + XDF.
3. Do not promote shipping maps from the PDF alone.

## Status after theory-vs-ROM pass

- Checklist: `theory_vs_rom_bosch_ti.md` (T1–T8)
- **Coverage:** 0.0% absolute proven (0/69); **18.84%** index-base cross_checked (13/69 via `RW68=0xD200`); 1 structural (`0xD030`)
- New xrefs: `rw68_cal_index_base.md` (MAF `0xD290` @`0x68CD`, fault limits, IAT/coolant, knock)
- Next: confirm `LD RW68,#imm` in internal ROM; chase descriptor `#0xD0`/`#0x30` after `0x1566` load product
