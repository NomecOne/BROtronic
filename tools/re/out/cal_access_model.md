# CAL access model (corrected) + proven-xref attempt

ROM: `BMW DME413 SW623 D466.29 C16x900A 94 RedLabel.bin`

## Correction

**Prior error:** v1 treated `LDB Rx,0xd0, LOOKUP[ZR]` as ROM page-0xD0 indexed CAL access.

**Correct semantics:** SLEIGH long-indexed: ea = RWbase + immed16. With ZR=0 and bytes `b3 01 d0 00 dest`, immed16=0x00D0 → register-file address 0x00D0 (RD0), not ROM 0xD000.

Examples:

- `0x5331` `LDB R56,0xd0, LOOKUP[ZR]` bytes `b301d00056` → immed16 `0x00D0` → register_file_0x00D0_not_rom_0xD000
- `0x539E` `LDB R56,0xd0, LOOKUP[ZR]` bytes `b301d00056` → immed16 `0x00D0` → register_file_0x00D0_not_rom_0xD000
- `0x5553` `LDB R56,0xd0, LOOKUP[ZR]` bytes `b301d00056` → immed16 `0x00D0` → register_file_0x00D0_not_rom_0xD000

## Descriptor / interp path (v9)

- Runtime **RW6E=`0xE67E`** (FE14-loaded CAL descriptor table), not RAM `0x1E08`.
- CMP @0x481B/0x4D66 is dual-config: when `RW6E≠0x1E08`, skip `0x4ECC` RAM fill to `0x42DF`.
- Interp: `ADD RW1A,RW6E; LD RW4C,[RW1A]`; then axis/map walk via `[RW4C]` / `[RW50]`.
- Descriptor slots hold LE16 map headers in CAL (e.g. `[E67E+0x9A]=0xDD0D` → ign WOT axis `0xDD0F`).

## Coverage (ign/fuel XDF items)

| Metric | Count | % |
|--------|------:|--:|
| **Absolute CODE reads (ea → XDF)** | **31** | **44.93%** |
| **Exclusive geometry** | **69** | **100.0%** |
| Structural split-ptr in data island | 1 | 1.45% |

44.93% absolute (31/69); exclusive 100% (69/69); FE14 CAL bases.

## Proven absolute DATA reads (any DATA, not necessarily ign/fuel XDF)

- `0x4D0E` → `0xFFCA` `LDB R1C,0xffca, LOOKUP[ZR]`
- `0x54D9` → `0xFE89` `LDB R20,0xfe89, LOOKUP[ZR]`
- `0x867E` → `0xFE85` `LDB R1D,0xfe85, LOOKUP[ZR]`
- `0x8686` → `0xFE87` `LDB R1D,0xfe87, LOOKUP[ZR]`
- `0xB440` → `0xFFCA` `LDB R3E,0xffca, LOOKUP[ZR]`

## Structural pointers

- `0x432A`: island exclusive `D000|0030` twin (geometry only).
- **Absolute Ti:** `RW68+0x2E` → `0xD030` via `LD` @`0xAFC7` / `DIVU` @`0x9A82` — CODE read proven: **True**.

## Index-base path — RETRACTED (v5)

Prior `RW68=0xD200` / `RW6A=0xD978` “exclusive XDF geometry” claims are **false positives**.

## Addressing model (v9) — absolute unlock

Loader `0x2EDB` loads **FE14** BE words (after FF-pad scan), **not FE24**:

| Reg | Value | Role |
|-----|-------|------|
| RW68 | `0xD002` | CAL page base (Ti `0xD030` = +0x2E) |
| RW6A | `0xD106` | CAL sensor/limit base |
| RW6C | `0xD28E` | MAF table base (body `0xD290` = +2) |
| RW6E | `0xE67E` | CAL descriptor table (LE16 headers) |

FE24 `42EC/43F0/1A08/1E08` is adjacent and **not** written into RW68–6E on this image.
CMP @0x4D60/0x481B is dual-config (CAL bases skip 0x4ECC RAM fill).

### Priority absolute proofs

1. **MAF `0xD290`:** ADC ISR `0xA53B` `ADD RW64,0x2[RW46]` with `RW46=RW6C+2·ADC`
2. **Ti `0xD030`:** `LD RW40,0x2e[RW68]` @0xAFC7; `DIVU …,0x2e,TABLE[RW68]` @0x9A82
3. **Ign WOT `0xDD0F`:** `LD RW1A,#0x9A` @0x66EC → `0x20CD` → `[E67E+9A]=DD0D`

**Coverage:** absolute **31/69** (44.93%); exclusive **69/69** (100%). D200/D978 remain retracted.

See `theory_vs_rom_bosch_ti.md` / `register_bases_fe24.md` / `absolute_code_reads.json`.

---
Research-only. Verification gates unchanged. No shipping promotion.
