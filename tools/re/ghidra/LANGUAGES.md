# Ghidra language notes (RedLabel)

Filename `C16x900A` = **checksum16 0x900A only**. Do not select C166/C167 from it.

## Canonical ISA (locked)

**MCS-96 / 80C196-class** is the ROM’s CODE ISA (Richard confirmation + Ghidra evidence).

| Field | Value |
|-------|--------|
| Ghidra language | `MCS96:LE:16:default` (stock Ghidra 11.3.2) |
| Compiler | `default` |
| Image base | `0x0000` |
| ROM | `public/rom/BMW DME413 SW623 D466.29 C16x900A 94 RedLabel.bin` |
| Seed script | `ForceDisassembleRedLabel.java` (raw binary has no natural entry) |

Default headless path:

```bash
export GHIDRA_INSTALL_DIR="$HOME/tools/ghidra_11.3.2_PUBLIC"
bash tools/re/ghidra/run_headless.sh   # defaults to MCS96:LE:16:default
node tools/re/ghidra/correct_ljmp_targets.mjs   # PC-rel CFG edges
```

### Sanity (cloud run)

| Check | Result |
|-------|--------|
| Mnemonics | Dense `LJMP`/`LCALL`/`SJMP`/`JBS`/`JBC`/`RET`, `INT_MASK`/`INT_PEND`/`TIMER1` |
| `0x4178` / `0x417C` | `PUSHF` / `NOP` (`F2` / `FD`) |
| Instructions / functions | ~5972 / ~213 |
| Canonical export | `tools/re/out/ghidra/` |

### LJMP / LCALL addressing (Blocker 1 resolved)

Intel MCS-96 + stock Ghidra SLEIGH agree: **PC-relative** `disp16`.

```text
jmpdest16: reloc is disp16 [reloc = inst_next + disp16;]
target = (insn_addr + 3 + le16(disp)) & 0xFFFF
```

A prior offline note that claimed “absolute LE16” is **rejected**. See `tools/re/out/blocker1_ljmp_lcall.md` and `mcs96_cfg_edges.*`.

## Historical reject only (do not re-evaluate)

`x86:LE:16:Real Mode` was tried once and **rejected** (nonsense at vector stubs; ~206 insn / 0 functions). Evidence kept under `tools/re/out/ghidra/compare_x86_real/` for history — not a candidate ISA going forward.

## Do not use

- C166/C167 from filename `C16x900A`
- Further x86 Real/Protected Mode ISA exploration
