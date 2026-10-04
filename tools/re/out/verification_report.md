# RedLabel verification report

Generated: 2026-10-04T22:02:08.833Z
ROM: BMW DME413 SW623 D466.29 C16x900A 94 RedLabel.bin (size=65536, CS16=0x900A)

## Promote to shipping
- **legacy_maf_cal** @ 0xD290 → `verified` (conf 0.9)
- **xdf_d290_256x1_16** @ 0xD290 → `verified` (conf 0.9)
- **xdf_d290_16x16_16** @ 0xD290 → `cross_checked` (conf 0.75)
- **xdf_e4b0_4x1_16** @ 0xE4B0 → `cross_checked` (conf 0.75)
- **sheet_d290** @ 0xD290 → `cross_checked` (conf 0.75)
- **sheet_e4b0** @ 0xE4B0 → `cross_checked` (conf 0.75)


## Hold as candidates
Total: 192

## Notes
- This script does **not** overwrite `definitions/packs/*.shipping.json`.
- Online BROtronic stays AI-free; this folder is offline-only.