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

## Status after theory-vs-ROM pass (v9)

- **Retraction:** D200 / D978 remain retracted (do not revive).
- **Runtime FE14 CAL bases:** RW68=`0xD002`, RW6A=`0xD106`, RW6C=`0xD28E`, RW6E=`0xE67E`
- **FE24 adjacent (not loaded):** `0x42EC/0x43F0/0x1A08/0x1E08`
- **Coverage:** 44.93% absolute (31/69); exclusive geometry 100.0% (69/69); FE14 CAL bases RW68=D002/RW6A=D106/RW6C=D28E/RW6E=E67E; D200/D978 retracted.
- **Absolute priority:** MAF `0xD290` @0xA53B; Ti `0xD030` @0xAFC7/0x9A82; ign WOT `0xDD0F` via RW1A=#0x9A
- **Absolute offsets (31):** ['0xD030', '0xD032', '0xD06A', '0xD093', '0xD23E', '0xD240', '0xD244', '0xD256', '0xD257', '0xD25A', '0xD25B', '0xD27B', '0xD27D', '0xD27E', '0xD281', '0xD288', '0xD290', '0xD5A6', '0xD67C', '0xD69E', '0xD6E8', '0xD6FA', '0xD75E', '0xD984', '0xD9A6', '0xD9C8', '0xDAA8', '0xDD0F', '0xDD89', '0xDE6D', '0xDF4D']
- **Exclusive geometry:** 69/69 retained
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
- **Early fuel/ign scalars (AFR, limiter Δzw, cyl trim):** `0xD06A`, `0xD093`, `0xD0FA`
- **MAF/sensor/speed/spark limit scalar block:** `0xD23D`, `0xD23E`, `0xD240`, `0xD244`, `0xD256`, `0xD257`, `0xD25A`, `0xD25B`, `0xD27B`, `0xD27D`, `0xD27E`, `0xD281`, `0xD288`
- **Warm-up enrich + knock sensitivity tables:** `0xD815`, `0xD8B1`
- **Knock-related block E044:** `0xE044`
- **Lambda OFF RPM tables 1–4:** `0xE364`, `0xE372`, `0xE37E`, `0xE388`
- **Next:** grow absolute beyond 31/69; fuel map body walks
