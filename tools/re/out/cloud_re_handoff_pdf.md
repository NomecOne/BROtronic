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

## Status after theory-vs-ROM pass (v7)

- **Retraction:** D200 (13) / D978 (6) remain retracted (do not revive).
- **ROM-proven bases (FE24):** RW68=`0x42EC`, RW6A=`0x43F0`, RW6C=`0x1A08`, RW6E=`0x1E08`
- **Coverage:** 0.0% absolute (0/69); 0% CAL-content index-base (D200/D978 retracted); 66.67% exclusive geometry (46/69); 4 ROM-proven FE24 bases.
- **Fuel exclusive:** Ti `0xD030` — unique split @`0x432A`; CODE CMP ['0x8B13', '0x8C17', '0x8C2E']
- **VANOS RPM axes:** ['0xD984', '0xD9A6', '0xD9C8', '0xDAA8', '0xDD0F', '0xDD89', '0xDE6D', '0xDF4D']
- **VANOS WOT dwell RPM axes:** `0xD67C`, `0xD69E`
- **VANOS PT load axes (fuel+ign):** `0xD9DA`, `0xDABA`, `0xDE7F`, `0xDF5F`
- **Ign idle timing (Manual / A/T):** `0xDCF3`, `0xDD05`
- **Soft fuel cut (Ti neighborhood twin):** `0xD032`
- **MAF transfer anchor (D28E BE↔LE):** `0xD290`
- **Ign idle cold timing corrections:** `0xDCCF`, `0xDCD9`
- **Fuel cold engine enrich (Manual / A/T):** `0xD8EF`, `0xD8FD`
- **Ignition WOT VANOS load axes:** `0xDD21`, `0xDD9B`
- **Fuel cranking axis + VANOS PT dwell tables:** `0xD5A6`, `0xD5E6`, `0xD63A`
- **VANOS WOT dwell/control block:** `0xD6AE`, `0xD6C6`, `0xD6E8`, `0xD6FA`, `0xD722`, `0xD734`
- **Fuel voltage axis (after VANOS DK):** `0xD75E`
- **PT/WOT load maps + ign coil dwell:** `0xE065`, `0xE0B3`, `0xE0DA`
- **Fuel idle base + cold lambda correction:** `0xD91F`, `0xD970`
- **Fuel accel enrich stack:** `0xDC21`, `0xDC37`, `0xDC47`, `0xDC63`, `0xDC79`
- **Alpha-N limp load map:** `0xDBC3`
- **Next:** descriptor → 0xDxxx deref; compose+deref Ti; CODE-walk one VANOS axis
