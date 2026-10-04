# Offline RE pipeline (`tools/re`)

Standalone (Node + **Ghidra**) tooling that **feeds** BROtronic definition packs. Nothing here runs inside the browser app — no LLM calls from BROtronic.

## Goals

1. Ingest XDF + CAL spreadsheet CSV as **candidate** map claims
2. Verify candidates against a reference binary (RedLabel)
3. Emit candidate JSON packs + a verification report
4. **Classify every byte** `0x0000–0xFFFF` (region / confidence / evidence)
5. **Disassemble CODE** with **Ghidra** (canonical) — headless when possible

## Naming note (important)

The RedLabel filename token **`C16x900A` means checksum16 = `0x900A`**, not Siemens/Infineon **C16x** CPU family. Never pick a C166/C167 Ghidra language from the filename.

## ISA conclusion (Ghidra-backed)

| Item | Value |
|------|--------|
| **Conclusion** | **MCS-96 / 80C196-class** |
| Ghidra language | `MCS96:LE:16:default` (stock in Ghidra 11.3.2) |
| First attempt | `x86:LE:16:Real Mode` — **rejected** (nonsense at vector stubs) |
| verificationStatus | `plausible` (not shipping) |
| Proof | `tools/re/out/isa_ghidra_conclusion.md` |

Caveat: stock MCS96 SLEIGH treats LJMP/LCALL immediates as PC-relative; use `node tools/re/ghidra/correct_ljmp_targets.mjs` for absolute targets.

## Quick start (Linux cloud — commands that worked)

```bash
# 0) JDK 21 already on PATH in this environment (OpenJDK 21). If missing:
#    sudo apt-get update && sudo apt-get install -y temurin-21-jdk   # or openjdk-21-jdk

# 1) Ghidra 11.3.2 → ~/tools (no root required)
mkdir -p "$HOME/tools" /tmp/ghidra-dl
curl -fL -o /tmp/ghidra-dl/ghidra.zip \
  "https://github.com/NationalSecurityAgency/ghidra/releases/download/Ghidra_11.3.2_build/ghidra_11.3.2_PUBLIC_20250415.zip"
unzip -q /tmp/ghidra-dl/ghidra.zip -d "$HOME/tools"
export GHIDRA_INSTALL_DIR="$HOME/tools/ghidra_11.3.2_PUBLIC"
# confirm:
"$GHIDRA_INSTALL_DIR/support/analyzeHeadless" 2>&1 | head -5
node tools/re/ghidra/detect.mjs   # ready:true

# 2) Fetch ROM + XDF + sheet (see tools/re/data/README.md)
mkdir -p public/rom tools/re/data
curl -fsSL -o "public/rom/BMW DME413 SW623 D466.29 C16x900A 94 RedLabel.bin" \
  "https://raw.githubusercontent.com/NomecOne/BMW-DME-M3.3.1/main/ROMs/BASEMAP/DME413-SW623-D466.29-C16x900A/BMW%20DME413%20SW623%20D466.29%20C16x900A%2094%20RedLabel.bin"
curl -fsSL -o tools/re/data/seed.xdf \
  "https://raw.githubusercontent.com/NomecOne/BMW-DME-M3.3.1/main/Definitions/TunerPro%20BMW%20OBD1%20Bosch%20M3.3.1%20HW413%20SW623%20D466.29%20C16x900A_BRO.xdf"
curl -fsSL -o tools/re/data/cal_sheet.csv \
  "https://docs.google.com/spreadsheets/d/1VseRUjv0rCux27Zhj9VFZbR-7iODh_PXcO4c1uwBE7c/export?format=csv&gid=408706323"

# 3) Negative control (user-stated 8086 path)
bash tools/re/ghidra/run_headless.sh --language 'x86:LE:16:Real Mode'
mkdir -p tools/re/out/ghidra/compare_x86_real
cp tools/re/out/ghidra/ghidra_* tools/re/out/ghidra/compare_x86_real/

# 4) Canonical MCS-96 headless + export
bash tools/re/ghidra/run_headless.sh --language 'MCS96:LE:16:default'

# 5) Absolute branch fixup + annotate/ingest
node tools/re/ghidra/correct_ljmp_targets.mjs
node tools/re/annotate.mjs
node tools/re/ingest.mjs
```

Windows: `pwsh -File tools/re/ghidra/run_headless.ps1 -Language 'MCS96:LE:16:default'` (or `npm run re:ghidra:win`).

npm aliases: `npm run re:ingest`, `npm run re:annotate`, `npm run re:ghidra:detect`, `npm run re:ghidra`, `npm run re:ghidra:win`.

### Expected inputs

| Path | Source |
|------|--------|
| `tools/re/data/seed.xdf` | NomecOne/BMW-DME-M3.3.1 TunerPro XDF |
| `tools/re/data/cal_sheet.csv` | Offline CAL sheet export |
| `public/rom/BMW DME413 SW623 D466.29 C16x900A 94 RedLabel.bin` | BASEMAP RedLabel (64KB) |

### Outputs

| Path | Contents |
|------|----------|
| `tools/re/out/candidates.pack.json` | Candidate definition pack |
| `tools/re/out/verification_report.{json,md}` | Map promote/hold report |
| `tools/re/out/byte_map.json` | Every-byte region runs + coverage |
| `tools/re/out/byte_map_runs.csv` | Run-length region table |
| `tools/re/out/gap_report.md` | Unknowns / coarse CODE gaps + ISA notes |
| `tools/re/out/isa_report.json` | ISA hypothesis + conflicts |
| `tools/re/out/isa_ghidra_conclusion.{json,md}` | Ghidra compare verdict |
| `tools/re/out/mcs96_absolute_branches.{json,csv}` | Absolute LJMP/LCALL targets |
| `tools/re/out/structural_code.json` | Pre-Ghidra structural markers (not canonical) |
| `tools/re/out/ghidra/*` | Canonical MCS-96 listing / functions / symbols |
| `tools/re/out/ghidra/compare_x86_real/*` | Rejected x86 Real Mode compare |
| `tools/re/out/ghidra_detect.json` | Install detection report |
| `tools/re/out/ghidra_headless_status.json` | Last headless status |

## Ghidra (canonical CODE disassembler)

**Ghidra is the required RE tool for CODE.** Prefer `analyzeHeadless` over ad-hoc opcode scorers. Node structural passes are scaffolding only until Ghidra exports exist.

Raw Binary imports need seeded disassembly — `ForceDisassembleRedLabel.java` runs as `-preScript` and seeds LE16 vectors at `0x2000` plus CODE landmarks.

### Exact headless command (Linux)

```bash
export GHIDRA_INSTALL_DIR="$HOME/tools/ghidra_11.3.2_PUBLIC"
"$GHIDRA_INSTALL_DIR/support/analyzeHeadless" \
  tools/re/ghidra/project RedLabel_M331 \
  -import "public/rom/BMW DME413 SW623 D466.29 C16x900A 94 RedLabel.bin" \
  -overwrite \
  -processor "MCS96:LE:16:default" \
  -cspec default \
  -loader BinaryLoader \
  -loader-baseAddr 0x0000 \
  -loader-blockName ROM \
  -scriptPath tools/re/ghidra \
  -preScript ForceDisassembleRedLabel.java \
  -postScript ExportRedLabel.java tools/re/out/ghidra
```

(`run_headless.sh` wraps this and writes `tools/re/out/ghidra_headless_status.json` + log.)

### Processor / language selection

| Candidate | Role | Notes |
|-----------|------|--------|
| `x86:LE:16:Real Mode` | First attempt (user-stated 8086) | **Rejected** on RedLabel — see compare tree. |
| `MCS96:LE:16:default` | **Canonical** | Stock Ghidra 11.3.2. Coherent CODE; fix LJMP targets via `correct_ljmp_targets.mjs`. |
| C166/C167 | **Do not select from filename** | `C16x900A` ≠ C16x CPU. |

## Memory map hypothesis (64KB)

| Range | Kind | Confidence | Basis |
|-------|------|------------|-------|
| `0x0000–0x1FFF` | PAD / missing internal window | high | All `0xFF` in external image; sheet note about internal 16KB |
| `0x2000–0x200F` | VECTOR | medium | LE u16 table; sheet “interrupt vectors?” |
| `0x2000–0x7FFF` | CODE (coarse) | medium | First non-`FF` @`0x2000`; shipping `CODE_LOW`; Ghidra MCS-96 listing |
| `0x8000–0xFFFD` | DATA_CAL | high | Shipping pack + XDF addresses |
| `0xFFFE–0xFFFF` | OTHER (CS16 trail) | high | Trailing checksum field; full-file sum `0x900A` |

## Promotion rule

Only maps with `cross_checked` or `verified` may be copied into `definitions/packs/*.shipping.json`. Offline scripts never silently overwrite the shipping pack. **Do not promote unverified Ghidra/CODE-derived maps into shipping.**

## Explicit non-goals

- No in-browser AI
- No automatic CODE feature patches (Phase 4 / deferred — see `CODE_PHASE_DEFERRED.md`)
- No claiming OEM dumps are verified until re-checked on that dump
