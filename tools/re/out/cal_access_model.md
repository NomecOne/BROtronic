# CAL access model (corrected) + proven-xref attempt

ROM: `BMW DME413 SW623 D466.29 C16x900A 94 RedLabel.bin`

## Correction

**Prior error:** v1 treated `LDB Rx,0xd0, LOOKUP[ZR]` as ROM page-0xD0 indexed CAL access.

**Correct semantics:** SLEIGH long-indexed: ea = RWbase + immed16. With ZR=0 and bytes `b3 01 d0 00 dest`, immed16=0x00D0 → register-file address 0x00D0 (RD0), not ROM 0xD000.

Examples:

- `0x5331` `LDB R56,0xd0, LOOKUP[ZR]` bytes `b301d00056` → immed16 `0x00D0` → register_file_0x00D0_not_rom_0xD000
- `0x539E` `LDB R56,0xd0, LOOKUP[ZR]` bytes `b301d00056` → immed16 `0x00D0` → register_file_0x00D0_not_rom_0xD000
- `0x5553` `LDB R56,0xd0, LOOKUP[ZR]` bytes `b301d00056` → immed16 `0x00D0` → register_file_0x00D0_not_rom_0xD000

## Descriptor / interp path

- RW6E expected **`0x1E08`** (CMP sites @0x481B/0x4D66)
- Init `@ 0x4ED9`: LD RW1C,#0x1E08; fill through 0x1F34 with pointer 0x42DF (and related 0x42E9) — template/default descriptors in mid-CODE island.
- Interp: ADD RW1A,RW6E; LD RW4C,[RW1A]; then axis/map walk via [RW4C]/[RW50].
- Blocker: External RedLabel image has 0x0000–0x1FFF erased (0xFF). If production uses internal ROM content at 0x1E08 beyond the 0x4ED9 fill, those CAL pointers are invisible in this dump.

## Coverage (ign/fuel XDF items)

| Metric | Count | % |
|--------|------:|--:|
| **Ghidra-proven CODE read of XDF offset** | **0** | **0.0%** |
| Structural split-ptr in data island | 1 | 1.45% |
| Access path unresolved | 68 | — |

0.0% proven CODE reads (0/69); 1 structural split-ptr (0xD030); page-index candidates retracted.

## Proven absolute DATA reads (any DATA, not necessarily ign/fuel XDF)

- `0x4D0E` → `0xFFCA` `LDB R1C,0xffca, LOOKUP[ZR]`
- `0x54D9` → `0xFE89` `LDB R20,0xfe89, LOOKUP[ZR]`
- `0x867E` → `0xFE85` `LDB R1D,0xfe85, LOOKUP[ZR]`
- `0x8686` → `0xFE87` `LDB R1D,0xfe87, LOOKUP[ZR]`
- `0xB440` → `0xFFCA` `LDB R3E,0xffca, LOOKUP[ZR]`

## Structural pointers

- `0x432A`: `0xD000` + `0x0030` → `0xD030` (0xD030[16bit] Inj. Constant(Ti) lb/h@3.5B|*DO NOT EDIT ALONE) — CODE read proven: **False**
  - Mid-CODE data island holds LE16 0xD000 then 0x0030 (= Inj Constant 0xD030). No CODE site yet shown loading this pair into a pointer and dereferencing — structural only.

## Index-base path (v3 addendum)

`LOOKUP/TABLE[RW68]` with **`RW68 = 0xD200`** is **cross_checked** by unique XDF geometry (MAF quartet). See `rw68_cal_index_base.md` — **13/69** ign/fuel targets, **not** absolute `LOOKUP[ZR]` proven.

## Next to prove first *absolute* XDF CODE read

1. Recover `LD RW68,#0xD200` (likely in erased `0x0000–0x1FFF`) or otherwise lock the base by immediate
1. Find CODE that loads 0xD000 from 0x432A (or descriptor) into RWxx and ADDs 0x0030, then [RWxx]
1. Trace one 0x20C7 interp call with known RW1A index (`#0xD0` / `#0x30` after load) through [RW4C] to a 0xDxxx pointer

---
Research-only. Verification gates unchanged. No shipping promotion.
