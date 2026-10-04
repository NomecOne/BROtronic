# Offline RE inputs (`tools/re/data`)

These files are often gitignored / not committed. Fetch before `npm run re:ingest` / `re:annotate`.

## Primary definition evidence (Richard)

**TunerPro XDF** is the **most correct definition to date** for baseline 413/623 RedLabel:

`NomecOne/BMW-DME-M3.3.1/Definitions/TunerPro BMW OBD1 Bosch M3.3.1 HW413 SW623 D466.29 C16x900A_BRO.xdf`

- Prefer this XDF over CAL-sheet guesses and legacy BROtronic 2-map packs when sources conflict.
- Names / real-world conversion equations are sometimes derived from studying CODE + hardware spec sheets (not pure guesswork).
- Shipping BROtronic packs still need binary fit / cross-check — do **not** blindly mark maps `verified`.

```bash
mkdir -p tools/re/data
curl -fsSL -o tools/re/data/seed.xdf \
  "https://raw.githubusercontent.com/NomecOne/BMW-DME-M3.3.1/main/Definitions/TunerPro%20BMW%20OBD1%20Bosch%20M3.3.1%20HW413%20SW623%20D466.29%20C16x900A_BRO.xdf"
```

## RedLabel ROM (64KB)

Place at:

`public/rom/BMW DME413 SW623 D466.29 C16x900A 94 RedLabel.bin`

```bash
mkdir -p public/rom
curl -fsSL -o "public/rom/BMW DME413 SW623 D466.29 C16x900A 94 RedLabel.bin" \
  "https://raw.githubusercontent.com/NomecOne/BMW-DME-M3.3.1/main/ROMs/BASEMAP/DME413-SW623-D466.29-C16x900A/BMW%20DME413%20SW623%20D466.29%20C16x900A%2094%20RedLabel.bin"
# expect size 65536 and checksum16 0x900A (filename token C16x900A)
```

## CAL sheet CSV → `cal_sheet.csv` (secondary)

Google sheet: https://docs.google.com/spreadsheets/d/1VseRUjv0rCux27Zhj9VFZbR-7iODh_PXcO4c1uwBE7c

Secondary to XDF for map claims.

```bash
curl -fsSL -o tools/re/data/cal_sheet.csv \
  "https://docs.google.com/spreadsheets/d/1VseRUjv0rCux27Zhj9VFZbR-7iODh_PXcO4c1uwBE7c/export?format=csv&gid=408706323"
```

## Memory map reminder

- CODE ISA: MCS-96 (`MCS96:LE:16:default`)
- CODE through **0xB930 inclusive**; DATA_CAL from **0xB931**
- `C16x900A` = CS16 fingerprint only
