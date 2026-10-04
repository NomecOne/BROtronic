# RedLabel verification report

Generated: 2026-10-04T22:26:17.733Z
ROM: BMW DME413 SW623 D466.29 C16x900A 94 RedLabel.bin (size=65536, CS16=0x900A)

## Primary definition evidence

- **XDF (Richard):** NomecOne/BMW-DME-M3.3.1/Definitions/TunerPro BMW OBD1 Bosch M3.3.1 HW413 SW623 D466.29 C16x900A_BRO.xdf
- Pedigree: Most correct definition to date for baseline 413/623 RedLabel (Richard). Names and real-world conversion equations are sometimes derived from CODE + hardware spec sheets.
- CODE ends **0xB930 inclusive**; DATA_CAL from **0xB931**. MCS-96 CODE ISA. `C16x900A` = CS16 only.

## Counts

- XDF maps: 157 (mid-CODE islands: 0, DATA_CAL: 157)
- Sheet notes: 39
- Legacy: 2
- Conflicts demoted (XDF preferred): 3

## Promote to shipping
_None — shipping gate requires `verified`; XDF-primary candidates stay on hold for binary review._

## Conflicts (XDF preferred over sheet/legacy)
- `sheet_d290` @ 0xD290 (sheet) plausible → plausible
- `sheet_e4b0` @ 0xE4B0 (sheet) plausible → plausible
- `legacy_maf_cal` @ 0xD290 (brotronic_legacy) cross_checked → plausible

## Hold as candidates
Total: 198

## Notes
- This script does **not** overwrite `definitions/packs/*.shipping.json`.
- Prefer XDF when sources conflict; do not blindly mark maps `verified`.
- Online BROtronic stays AI-free; this folder is offline-only.