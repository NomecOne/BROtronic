# ISA conclusion (Ghidra-backed)

- **Conclusion:** `MCS96 / 80C196-class` via Ghidra language `MCS96:LE:16:default`
- **verificationStatus:** `plausible` (confidence 0.82)
- **Rejected:** `x86:LE:16:Real Mode` (nonsense at vector stubs) and C166-from-filename

## Compare

| Language | Instructions | Functions | sample@0x4178 |
|---|---:|---:|---|
| x86:LE:16:Real Mode | 206 | 0 | `0000:4178  OUT 0xfd,AX` |
| MCS96:LE:16:default | 5972 | 213 | `4178  PUSHF` / `417c  NOP` |

## Proof bullets

- Tried x86:LE:16:Real Mode first with ForceDisassembleRedLabel seeds at LE16 vectors @0x2000.
- x86 @0x4178 decodes as OUT 0xfd,AX / STD — incoherent interrupt stub (~206 insn, 0 functions).
- MCS96:LE:16:default (stock Ghidra 11.3.2) yields ~5972 instructions / ~213 functions with LJMP/LCALL/SJMP/JBS/INT_MASK/TIMER1.
- MCS96 @0x4178/@0x417C: PUSHF / NOP matching bytes F2 / FD.
- Binary markers: E7 abs16 density + FD pad in CODE window align with MCS-96 LJMP/NOP.
- Caveat: stock MCS96.sinc adds inst_next to LJMP/LCALL immediates; absolute targets from bytes are authoritative.
- Filename C16x900A is CS16=0x900A only — not C16x CPU evidence.

## SLEIGH caveat

- Rule: `jmpdest16: reloc is disp16 [reloc = inst_next + disp16;]`
- Correct: absolute disp16 (Intel MCS-96 LJMP/LCALL)
- Example: E7 FD 62 @0x4179 -> abs 0x62FD; Ghidra may show 0xA479
- Fixup: `node tools/re/ghidra/correct_ljmp_targets.mjs`

Canonical exports: `tools/re/out/ghidra/` (MCS-96). Compare trees under `compare_x86_real/` and `compare_mcs96/`.
