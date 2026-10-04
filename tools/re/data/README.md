# Offline RE inputs (`tools/re/data`)

These files are often gitignored / not committed. Fetch before `npm run re:ingest` / `re:annotate`.

## Required

### RedLabel ROM (64KB)

Place at:

`public/rom/BMW DME413 SW623 D466.29 C16x900A 94 RedLabel.bin`

```bash
mkdir -p public/rom
curl -fsSL -o "public/rom/BMW DME413 SW623 D466.29 C16x900A 94 RedLabel.bin" \
  "https://raw.githubusercontent.com/NomecOne/BMW-DME-M3.3.1/main/ROMs/BASEMAP/DME413-SW623-D466.29-C16x900A/BMW%20DME413%20SW623%20D466.29%20C16x900A%2094%20RedLabel.bin"
# expect size 65536 and checksum16 0x900A (filename token C16x900A)
```

### TunerPro XDF → `seed.xdf`

```bash
mkdir -p tools/re/data
curl -fsSL -o tools/re/data/seed.xdf \
  "https://raw.githubusercontent.com/NomecOne/BMW-DME-M3.3.1/main/Definitions/TunerPro%20BMW%20OBD1%20Bosch%20M3.3.1%20HW413%20SW623%20D466.29%20C16x900A_BRO.xdf"
```

### CAL sheet CSV → `cal_sheet.csv`

Google sheet: https://docs.google.com/spreadsheets/d/1VseRUjv0rCux27Zhj9VFZbR-7iODh_PXcO4c1uwBE7c

```bash
# primary tab used by ingest (gid 408706323)
curl -fsSL -o tools/re/data/cal_sheet.csv \
  "https://docs.google.com/spreadsheets/d/1VseRUjv0rCux27Zhj9VFZbR-7iODh_PXcO4c1uwBE7c/export?format=csv&gid=408706323"
```

Optional extra tabs (offline evidence only):

```bash
for gid in 0 408706323; do
  curl -fsSL -o "tools/re/data/cal_sheet_gid${gid}.csv" \
    "https://docs.google.com/spreadsheets/d/1VseRUjv0rCux27Zhj9VFZbR-7iODh_PXcO4c1uwBE7c/export?format=csv&gid=${gid}"
done
```
