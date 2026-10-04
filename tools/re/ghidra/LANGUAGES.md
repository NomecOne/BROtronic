# Ghidra language notes (RedLabel)

Filename `C16x900A` = **checksum16 0x900A only**. Do not select C166/C167 from it.

## First attempt (user-stated)

- Language ID: `x86:LE:16:Real Mode`
- Compiler: `default`
- Image base: `0x0000`
- File: `public/rom/BMW DME413 SW623 D466.29 C16x900A 94 RedLabel.bin`
- Requires `ForceDisassembleRedLabel.java` (raw binary has no natural entry).

Sanity result on RedLabel (cloud run): **FAIL**

| Check | Result |
|-------|--------|
| Coherent control flow near `0x4178` | No — `OUT 0xfd,AX` / `STD` |
| Instructions / functions | ~206 / 0 |
| Compare tree | `tools/re/out/ghidra/compare_x86_real/` |

## Canonical language (evidence + Ghidra)

- Language ID: `MCS96:LE:16:default` (**stock in Ghidra 11.3.2**)
- Compiler: `default`
- Same image base / file / force-disassemble seeds

Sanity result on RedLabel (cloud run): **PASS (plausible)**

| Check | Result |
|-------|--------|
| Mnemonics | Dense `LJMP`/`LCALL`/`SJMP`/`JBS`/`JBC`/`RET`, `INT_MASK`/`INT_PEND`/`TIMER1` |
| `0x4178` / `0x417C` | `PUSHF` / `NOP` (`F2` / `FD`) |
| Instructions / functions | ~5972 / ~213 |
| Canonical export | `tools/re/out/ghidra/` |
| Compare tree | `tools/re/out/ghidra/compare_mcs96/` |

### SLEIGH caveat (important)

Stock `MCS96.sinc` defines:

```text
jmpdest16: reloc is disp16 [reloc = inst_next + disp16;]
```

Intel MCS-96 **LJMP (`E7`) / LCALL (`EF`)** take an **absolute** 16-bit address. Ghidra listings therefore show wrong targets (PC+3+imm). Use:

```bash
node tools/re/ghidra/correct_ljmp_targets.mjs
# → tools/re/out/mcs96_absolute_branches.{json,csv}
```

Example: bytes `E7 FD 62` at `0x4179` → absolute `0x62FD` (Ghidra may display `0xA479`).

## Do not use

- C166/C167 from filename `C16x900A`
