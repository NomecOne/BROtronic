# Offline RE pipeline (`tools/re`)

Standalone (Node + **Ghidra**) tooling that **feeds** BROtronic definition packs. Nothing here runs inside the browser app — no LLM calls from BROtronic.

## Goals

1. Ingest XDF + CAL spreadsheet CSV as **candidate** map claims
2. Verify candidates against a reference binary (RedLabel)
3. Emit candidate JSON packs + a verification report
4. **Classify every byte** `0x0000–0xFFFF` (region / confidence / evidence)
5. **Disassemble CODE** with **Ghidra** (canonical) — headless when possible
6. **Engine control understanding** (elevated): control loop inventory + ignition/fuel XDF→CODE dataflow — still offline; **no unverified shipping**; do not claim full CODE+DATA control yet

Regenerate engine-control artifacts (after Ghidra + ingest):

```bash
python3 tools/re/scripts/analyze_engine_control.py
python3 tools/re/scripts/analyze_priority_traces.py   # IRQ RAM pubs, HSO/HSI SFR audit, CAL access model v2
python3 tools/re/scripts/analyze_bosch_theory_rom.py  # Bosch TI T1–T8 + FE24 bases + exclusive Ti/VANOS geometry
```

Priority-trace outputs: `irq_ram_publications.*`, `sfr_hso_hsi_audit.*`, `cal_access_model.*`, `register_bases_fe24.*`, `theory_vs_rom_bosch_ti.*`; theory checklist in `motronic_331_function.md` §7.

> **Note:** Prior `RW68=0xD200` “13/69 index-base” claim is **retracted** (false positive). Real bases from unique FE24 structure: `RW68=0x42EC`, `RW6A=0x43F0`, `RW6C=0x1A08`, `RW6E=0x1E08`. Exclusive geometry: **23/69** (Ti, VANOS RPM/load/dwell axes, MAF, ign idle, cold enrich, soft fuel cut).

## Definition evidence (XDF-primary)

| Source | Trust | Role |
|--------|-------|------|
| **TunerPro XDF** `…C16x900A_BRO.xdf` | **Primary** | Richard: most correct definition to date for 413/623 RedLabel. Names/equations often CODE+hw-derived. |
| CAL sheet CSV | Secondary | Offline notes; demoted when conflicting with XDF |
| Legacy BROtronic packs | Lowest | Historical 2-map claims; XDF wins on conflict |

Shipping packs still require binary fit / cross-check — ingest does **not** blindly mark maps `verified` or overwrite `definitions/packs/*.shipping.json`.

Fetch: see `tools/re/data/README.md`. Ingest provenance lands in `tools/re/out/verification_report.*` + `candidates.pack.json`.

## Naming note (important)

The RedLabel filename token **`C16x900A` means checksum16 = `0x900A`**, not Siemens/Infineon **C16x** CPU family. Never pick a C166/C167 Ghidra language from the filename.

## ISA conclusion (locked)

| Item | Value |
|------|--------|
| **CODE ISA** | **MCS-96 / 80C196-class** (canonical going forward) |
| Ghidra language | `MCS96:LE:16:default` (default in `run_headless.sh` / `.ps1`) |
| LJMP/LCALL | PC-relative `disp16` — Intel + Ghidra SLEIGH agree (`blocker1_ljmp_lcall.md`) |
| x86 Real Mode | Historical reject only (`compare_x86_real/`) — do not re-evaluate |
| verificationStatus | ISA locked; CODE maps still gated (not shipping) |
| Proof | `tools/re/out/isa_ghidra_conclusion.md`, `blocker1_ljmp_lcall.md` |

## Quick start (Linux cloud — MCS-96 default)

```bash
# 0) JDK 21 on PATH (OpenJDK 21 in this cloud image)

# 1) Ghidra 11.3.2 → ~/tools
mkdir -p "$HOME/tools" /tmp/ghidra-dl
curl -fL -o /tmp/ghidra-dl/ghidra.zip \
  "https://github.com/NationalSecurityAgency/ghidra/releases/download/Ghidra_11.3.2_build/ghidra_11.3.2_PUBLIC_20250415.zip"
unzip -q /tmp/ghidra-dl/ghidra.zip -d "$HOME/tools"
export GHIDRA_INSTALL_DIR="$HOME/tools/ghidra_11.3.2_PUBLIC"
node tools/re/ghidra/detect.mjs   # ready:true

# 2) Fetch ROM + XDF + sheet (see tools/re/data/README.md)
mkdir -p public/rom tools/re/data
curl -fsSL -o "public/rom/BMW DME413 SW623 D466.29 C16x900A 94 RedLabel.bin" \
  "https://raw.githubusercontent.com/NomecOne/BMW-DME-M3.3.1/main/ROMs/BASEMAP/DME413-SW623-D466.29-C16x900A/BMW%20DME413%20SW623%20D466.29%20C16x900A%2094%20RedLabel.bin"
curl -fsSL -o tools/re/data/seed.xdf \
  "https://raw.githubusercontent.com/NomecOne/BMW-DME-M3.3.1/main/Definitions/TunerPro%20BMW%20OBD1%20Bosch%20M3.3.1%20HW413%20SW623%20D466.29%20C16x900A_BRO.xdf"
curl -fsSL -o tools/re/data/cal_sheet.csv \
  "https://docs.google.com/spreadsheets/d/1VseRUjv0rCux27Zhj9VFZbR-7iODh_PXcO4c1uwBE7c/export?format=csv&gid=408706323"

# 3) Canonical MCS-96 headless (default language) + CFG edges + annotate/ingest
bash tools/re/ghidra/run_headless.sh
node tools/re/ghidra/correct_ljmp_targets.mjs   # PC-rel CFG → mcs96_cfg_edges.*
node tools/re/annotate.mjs
node tools/re/ingest.mjs
```

Windows: `pwsh -File tools/re/ghidra/run_headless.ps1` (defaults to MCS96) or `npm run re:ghidra:win`.

npm aliases: `npm run re:ingest`, `npm run re:annotate`, `npm run re:ghidra:detect`, `npm run re:ghidra`, `npm run re:ghidra:branches`, `npm run re:ghidra:win`.

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
| `tools/re/out/isa_ghidra_conclusion.{json,md}` | Ghidra ISA verdict (MCS-96 locked) |
| `tools/re/out/blocker1_ljmp_lcall.md` | LJMP/LCALL PC-rel analysis |
| `tools/re/out/mcs96_cfg_edges.{json,csv}` | Trustworthy PC-rel CFG edges |
| `tools/re/out/mcs96_branch_resolve.json` | Branch resolve summary |
| `tools/re/out/structural_code.json` | Pre-Ghidra structural markers (not canonical) |
| `tools/re/out/control_loops.{json,md}` | Hypothesized control loops (boot/IRQ/foreground) — not proven semantics |
| `tools/re/out/ignition_fuel_dataflow.{json,md}` | Ignition/fuel XDF → DATA → CODE xref status (v3: RW68 index-base) |
| `tools/re/out/irq_ram_publications.{json,md}` | vec2/vec5 IRQ → RAM publication map |
| `tools/re/out/sfr_hso_hsi_audit.{json,md}` | HSO_COMMAND/HSO_TIME vs HSI_* R/W alias (cross_checked) |
| `tools/re/out/cal_access_model.{json,md}` | CAL access model correction + proven-xref attempt |
| `tools/re/out/rw68_cal_index_base.{json,md}` | RW68=0xD200 index-base cross_checked ign/fuel xrefs |
| `tools/re/out/theory_vs_rom_bosch_ti.{json,md}` | Bosch TI T1–T8 theory-vs-ROM checklist + load path |
| `tools/re/out/motronic_331_function.md` | Motronic 3.3.1 MAF theory + §7 theory-vs-ROM |
| `tools/re/out/ref_pdf_bosch_m_motronic_technical_instruction.md` | Page-cited extract from local Bosch M-Motronic TI PDF |
| `tools/re/out/code_verification_progress.json` | CODE verification + engine-control coverage framing |
| `tools/re/out/ghidra/*` | Canonical MCS-96 listing / functions / symbols |
| `tools/re/out/ghidra/compare_x86_real/*` | Historical x86 reject only |
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

| Language | Role | Notes |
|----------|------|--------|
| `MCS96:LE:16:default` | **Default / locked** | CODE ISA for RedLabel. LJMP/LCALL = PC-rel; CFG via `re:ghidra:branches`. |
| `x86:LE:16:Real Mode` | Historical reject only | Do not re-run as ISA candidate; keep `compare_x86_real/`. |
| C166/C167 | Never | `C16x900A` is checksum fingerprint, not CPU. |

## Memory map hypothesis (64KB)

Bounds below use **inclusive** end addresses.

| Range | Kind | Confidence | Basis |
|-------|------|------------|-------|
| `0x0000–0x1FFF` | PAD / missing internal window | high | All `0xFF` in external image |
| `0x2000–0x200F` | VECTOR | medium | LE u16 table; sheet “interrupt vectors?” |
| `0x2000–0xB930` | CODE | high | **Baseline fact (Richard):** CODE runs through `0xB930` inclusive |
| `0xB931–0xFFFD` | DATA_CAL | high | Starts immediately after CODE; XDF may also claim mid-CODE islands |
| `0xFFFE–0xFFFF` | OTHER (CS16 trail) | high | Trailing checksum; full-file sum `0x900A` |

Note: legacy shipping `CODE_LOW ≤0x7FFF` / `DATA≥0x8000` is superseded for offline region labeling. IRQ stub PC-rel landings in `0xAxxx` are **inside CODE** (≤`0xB930`).

## Promotion rule

Only maps with `cross_checked` or `verified` may be copied into `definitions/packs/*.shipping.json`. Offline scripts never silently overwrite the shipping pack. **Do not promote unverified Ghidra/CODE-derived maps into shipping.**

## Explicit non-goals

- No in-browser AI
- No automatic CODE feature patches (Phase 4 / deferred — see `CODE_PHASE_DEFERRED.md`)
- No claiming OEM dumps are verified until re-checked on that dump
