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

## Index-base path — RETRACTED (v5)

Prior `RW68=0xD200` / `RW6A=0xD978` “exclusive XDF geometry” claims are **false positives**.
ROM-proven bases from FE24: `RW68=0x42EC`, `RW6A=0x43F0`, `RW6C=0x1A08`, `RW6E=0x1E08`.

## Exclusive geometry (v6)

1. **Fuel Ti `0xD030`:** unique `D000|0030` @`0x432A` (RW68+0x3E/+0x40) + island↔CAL body twins
2. **VANOS RPM axes (8):** signature `05060507…0860`
3. **VANOS WOT dwell axes:** `0xD67C`/`0xD69E`
4. **PT load axes (4):** fuel+ign `0xD9DA`/`DABA`/`DE7F`/`DF5F`
5. **MAF `0xD290`:** unique BE↔LE twin of `0xD28E` (@FE18 / @D28E)
6. **Ign idle timing/cold + fuel cold enrich + soft fuel cut** — signature/span/twin methods

**Count: 46/69 exclusive geometry.** Absolute CODE reads still 0. D200/D978 remain retracted.

See `theory_vs_rom_bosch_ti.md` / `register_bases_fe24.md`.

## Next to prove first *absolute* XDF CODE read

1. Compose D000+|0030 from island and `[deref]` Ti content
1. Trace one `0x20C7` interp call through `[RW4C]` to a `0xDxxx` pointer
1. CODE-walk one VANOS RPM/load axis from the exclusive signature set

---
Research-only. Verification gates unchanged. No shipping promotion.
