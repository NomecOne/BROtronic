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
