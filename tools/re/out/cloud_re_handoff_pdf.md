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

## Status after theory-vs-ROM pass (v10)

- **Retraction:** D200 / D978 remain retracted.
- **Runtime FE14 CAL bases:** RW68=`0xD002`, RW6A=`0xD106`, RW6C=`0xD28E`, RW6E=`0xE67E`
- **Coverage:** 98.55% absolute (68/69); exclusive geometry 100.0% (69/69); unproven absolute 1; FE14 CAL bases; D200/D978 retracted.
- **Absolute:** 68/69 — ['0xD030', '0xD032', '0xD06A', '0xD093', '0xD0FA', '0xD23E', '0xD240', '0xD244', '0xD256', '0xD257', '0xD25A', '0xD25B', '0xD27B', '0xD27D', '0xD27E', '0xD281', '0xD288', '0xD290', '0xD5A6', '0xD5E6', '0xD63A', '0xD67C', '0xD69E', '0xD6AE', '0xD6C6', '0xD6E8', '0xD6FA', '0xD722', '0xD734', '0xD75E', '0xD815', '0xD8B1', '0xD8EF', '0xD8FD', '0xD91F', '0xD970', '0xD984', '0xD9A6', '0xD9C8', '0xD9DA', '0xDAA8', '0xDABA', '0xDBC3', '0xDC21', '0xDC37', '0xDC47', '0xDC63', '0xDC79', '0xDCCF', '0xDCD9', '0xDCF3', '0xDD05', '0xDD0F', '0xDD21', '0xDD89', '0xDD9B', '0xDE6D', '0xDE7F', '0xDF4D', '0xDF5F', '0xE044', '0xE065', '0xE0B3', '0xE0DA', '0xE364', '0xE372', '0xE37E', '0xE388']
- **Unproven absolute:** [{'offsetHex': '0xD23D', 'name': '0xD23D[8bit] Air, MAF, RPM min threshold for MAF signal check', 'reason': 'No byte LOOKUP of 0xD23D. Adjacent word @0xD23C is read (CMP RW1C,0x136,TABLE[RW6A] @0x52E3 = RW6A+0x136); XDF 8-bit label appears to be the high byte of that word (0x01F4) — not a standalone absolute byte read of 0xD23D.'}]
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
- **Next:** ['Resolve leftover absolute (see unprovenAbsolute) or confirm XDF misalignment', 'Walk [RW4C] map bodies end-to-end for dwell E0DA / Alpha-N DBC3']
