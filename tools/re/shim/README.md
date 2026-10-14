# Local MCS-96 RE shim (option B)

Thin **CLI / agent API** over the existing `tools/re` Ghidra headless pipeline.  
Agents call this instead of waiting on REA to admit raw `.bin` + `MCS96`.

| This shim | REA MCP |
|-----------|---------|
| Drives **local** `analyzeHeadless` + `ForceDisassembleRedLabel` / `ExportRedLabel` | Interactive reverse-engineering product (pseudo, live xrefs, …) |
| Works on **headerless 64KB RedLabel** today | `open_binary` does not admit arbitrary MCU ROM / force `MCS96` (see feasibility doc) |
| Listing / CFG / CSV oriented | Full decompiler UX when admission works |
| **Does not patch REA** | Upstream change would be option A (deferred) |

Online BROtronic stays **AI-free**. No new SLEIGH — language is stock **`MCS96:LE:16:default`**.

**Filename note:** `C16x900A` = checksum16 `0x900A` only — never pick C166/C167.

## Setup

1. JDK on `PATH` (Temurin 21+ for Ghidra 11.x).
2. Extract Ghidra; set install root:

```powershell
$env:GHIDRA_INSTALL_DIR = 'C:\Tools\ghidra_11.3.2_PUBLIC'
```

```bash
export GHIDRA_INSTALL_DIR="$HOME/tools/ghidra_11.3.2_PUBLIC"
```

3. RedLabel ROM at  
   `public/rom/BMW DME413 SW623 D466.29 C16x900A 94 RedLabel.bin`  
   (see `tools/re/data/README.md`).
4. Optional: if `tools/re/out/ghidra/*` already exists and is fresh, the shim **reuses** it and does not re-run headless.

Verify:

```bash
npm run re:ghidra:detect
npm run re:shim -- status
```

## Invoke

From repo root (JSON on stdout):

```bash
npm run re:shim -- status
npm run re:shim -- overview
npm run re:shim -- regions
npm run re:shim -- disasm-at 0x2091 --count 16
npm run re:shim -- xrefs 0x4120
npm run re:shim -- export-refresh          # headless only if stale/missing
npm run re:shim -- export-refresh --force  # always re-run headless
npm run re:shim -- query-progress
```

Equivalent:

```bash
node tools/re/shim/cli.mjs status
```

### Constants (locked)

| Item | Value |
|------|--------|
| Language | `MCS96:LE:16:default` |
| CODE window | `0x2000`–`0xB930` inclusive |
| Loader | BinaryLoader @ `0x0000`, block `ROM` |
| Seeds / export | `ForceDisassembleRedLabel` + `ExportRedLabel` |

## Example agent calls

Typical agent loop:

```text
1. re:shim status          → ghidraReady? artifactsFresh?
2. re:shim export-refresh  → only if not fresh (needs Ghidra locally)
3. re:shim overview        → insn/fn counts, sanity samples
4. re:shim regions         → PAD / VECTOR / CODE / DATA_CAL
5. re:shim disasm-at 0x4178 --count 32
6. re:shim xrefs 0x4120    → PC-rel CFG + listing mentions
7. re:shim query-progress  → CODE verification + engine-control framing
```

PowerShell one-liners:

```powershell
npm run re:shim -- status
npm run re:shim -- disasm-at 0x2091 --count 20
npm run re:shim -- xrefs 0xB930
```

## Freshness policy

`export-refresh` **skips** headless when:

- `ghidra_export_meta.json`, `ghidra_listing.txt`, `ghidra_functions.csv` exist
- meta `language` is `MCS96:LE:16:default`
- listing is not older than the ROM
- `instructionCount > 0`

Use `--force` to re-import/analyze anyway.

## Layout

```text
tools/re/shim/
  cli.mjs           # entry
  README.md         # this file
  lib/
    paths.mjs       # language + CODE window + out paths
    io.mjs
    artifacts.mjs   # listing/CFG query + freshness
    headless.mjs    # wraps run_headless.ps1 / .sh
    commands.mjs    # open/status, overview, …
```

Upstream pipeline docs: `tools/re/README.md`.  
Feasibility ranking (B recommended): `tools/re/out/mcs96_language_path_feasibility.md`.
