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

## Quick start

```bash
# From repo root (PowerShell / bash)
node tools/re/ingest.mjs          # XDF/sheet → candidates + verification
node tools/re/annotate.mjs        # every-byte region map + ISA/gap report
node tools/re/ghidra/detect.mjs   # is Ghidra+JDK ready?
pwsh -File tools/re/ghidra/run_headless.ps1   # after Ghidra install
# Windows PowerShell 5.1:
# powershell -NoProfile -ExecutionPolicy Bypass -File tools/re/ghidra/run_headless.ps1
```

npm aliases: `npm run re:ingest`, `npm run re:annotate`, `npm run re:ghidra:detect`, `npm run re:ghidra`.

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
| `tools/re/out/structural_code.json` | Pre-Ghidra structural markers (not canonical) |
| `tools/re/out/ghidra/*` | Ghidra listing / functions / symbols (after headless) |
| `tools/re/out/ghidra_detect.json` | Install detection report |

## Ghidra (canonical CODE disassembler)

**Ghidra is the required RE tool for CODE.** Prefer `analyzeHeadless` over ad-hoc opcode scorers. Node structural passes are scaffolding only until Ghidra exports exist.

### Install (this machine was missing Ghidra + Java on PATH)

1. Install a JDK compatible with your Ghidra release (**Temurin 21** recommended for Ghidra 11.x). Confirm `java -version`.
2. Download Ghidra from [https://ghidra-sre.org/](https://ghidra-sre.org/) and extract (no installer).
3. Set the install root (folder that contains `support\analyzeHeadless.bat`):

```powershell
$env:GHIDRA_INSTALL_DIR = 'C:\Tools\ghidra_XX_PUBLIC'   # adjust
# optional user-permanent:
# [System.Environment]::SetEnvironmentVariable('GHIDRA_INSTALL_DIR', $env:GHIDRA_INSTALL_DIR, 'User')
```

4. Run headless import/analyze + export:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tools/re/ghidra/run_headless.ps1 -Language 'x86:LE:16:Real Mode'
```

5. Re-run annotation to pick up function starts:

```bash
node tools/re/annotate.mjs
```

### Exact headless command (equivalent)

```text
%GHIDRA_INSTALL_DIR%\support\analyzeHeadless.bat ^
  tools\re\ghidra\project RedLabel_M331 ^
  -import "public\rom\BMW DME413 SW623 D466.29 C16x900A 94 RedLabel.bin" ^
  -overwrite ^
  -processor "x86:LE:16:Real Mode" ^
  -cspec default ^
  -scriptPath tools\re\ghidra ^
  -postScript ExportRedLabel.java tools\re\out\ghidra
```

(`run_headless.ps1` wraps this and writes `tools/re/out/ghidra_headless_status.json` + log.)

### Processor / language selection

| Candidate | Role | Notes |
|-----------|------|--------|
| `x86:LE:16:Real Mode` | **Default attempt** (user-stated 8086 interest) | First headless language. Judge listing sanity before trusting. |
| `x86:LE:16:Protected Mode` | Alternate x86-16 | Only if Real Mode is clearly wrong. |
| MCS-96 / 80C196 module | Evidence-preferred alternate | Sheet+binary: `E7` abs16 LJMP-like density, `FD`≈NOP / `FF`≈reset, vector table `@0x2000`, low `0x0000–0x1FFF` erased (“internal 16KB?”). Stock Ghidra may need a **community processor module**. |
| C166/C167 | **Do not select from filename** | `C16x900A` ≠ C16x CPU. |

Working policy: keep the **8086 / x86-16 Real Mode** path as the first Ghidra run; if the listing is nonsensical, record the failure in `out/ghidra/` and switch languages with evidence — do not assume C16x from the ROM name.

### GUI workflow (optional)

1. Open Ghidra → import the RedLabel `.bin` as raw binary, base `0x0000`, language as above.
2. Add `tools/re/ghidra` to Script Manager path → run `ExportRedLabel.java` with args = absolute `tools/re/out/ghidra`.

## Memory map hypothesis (64KB)

| Range | Kind | Confidence | Basis |
|-------|------|------------|-------|
| `0x0000–0x1FFF` | PAD / missing internal window | high | All `0xFF` in external image; sheet note about internal 16KB |
| `0x2000–0x200F` | VECTOR | medium | LE u16 table; sheet “interrupt vectors?” |
| `0x2000–0x7FFF` | CODE (coarse) | medium | First non-`FF` @`0x2000`; shipping `CODE_LOW` |
| `0x8000–0xFFFD` | DATA_CAL | high | Shipping pack + XDF addresses |
| `0xFFFE–0xFFFF` | OTHER (CS16 trail) | high | Trailing checksum field; full-file sum `0x900A` |

## Promotion rule

Only maps with `cross_checked` or `verified` may be copied into `definitions/packs/*.shipping.json`. Offline scripts never silently overwrite the shipping pack. **Do not promote unverified Ghidra/CODE-derived maps into shipping.**

## Explicit non-goals

- No in-browser AI
- No automatic CODE feature patches (Phase 4 / deferred — see `CODE_PHASE_DEFERRED.md`)
- No claiming OEM dumps are verified until re-checked on that dump
