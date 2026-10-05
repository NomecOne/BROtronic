# ISA conclusion (Ghidra-backed, locked)

- **CODE ISA (locked):** `MCS96 / 80C196-class` via Ghidra language `MCS96:LE:16:default`
- **verificationStatus:** `cross_checked` for ISA identity (CODE maps still gated / not shipping)
- **Historical reject:** `x86:LE:16:Real Mode` — do not re-evaluate

## Compare (historical)

| Language | Instructions | Functions | sample@0x4178 |
|---|---:|---:|---|
| x86:LE:16:Real Mode | 206 | 0 | `OUT 0xfd,AX` (reject) |
| MCS96:LE:16:default | 5972 | 213 | `PUSHF` / `NOP` (canonical) |

## Blocker 1 (LJMP/LCALL)

**Resolved under MCS-96 semantics:** instructions are true `LJMP`/`LCALL` with **PC-relative** `disp16`. Stock Ghidra SLEIGH is correct. Absolute-LE16 overlay was a misread.

See `tools/re/out/blocker1_ljmp_lcall.md` and `mcs96_cfg_edges.*` (385/385 Ghidra-aligned edges match PC-rel).

## Defaults

- `bash tools/re/ghidra/run_headless.sh` → `MCS96:LE:16:default`
- `npm run re:ghidra:branches` → PC-rel CFG export
