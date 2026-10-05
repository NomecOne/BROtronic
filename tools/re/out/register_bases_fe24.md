# Register bases — ROM-proven (FE14 CAL, v9)

ROM: `BMW DME413 SW623 D466.29 C16x900A 94 RedLabel.bin`

**Runtime structure @ `0xFE14`** (loaded by 0x2EDB):

| Reg | Value | Role |
|-----|-------|------|
| `RW68` | `0xD002` | CAL page base (Ti 0xD030 = +0x2E) |
| `RW6A` | `0xD106` | CAL sensor/limit base |
| `RW6C` | `0xD28E` | MAF table base (body 0xD290 = +2) |
| `RW6E` | `0xE67E` | CAL descriptor table (LE16 map headers) |

Loader: `0x2EDB via trampoline 0x20B5 / LCALL 0x412C` — FF pad `0xFE04..0xFE13` then BE words from `0xFE14`.

FE24 adjacent (not loaded into RW68–6E): `{'RW68': '0x42EC', 'RW6A': '0x43F0', 'RW6C': '0x1A08', 'RW6E': '0x1E08'}`

CMP: `CMP RW6C,#0x1a08 @0x4D60 (dual-config: CAL≠1A08 continues)`; `CMP RW6E,#0x1e08 @0x481B/0x4D66 (skip 0x4ECC fill when ≠)`.
With FE14 CAL bases, descriptor RAM fill @0x4ECC is skipped; interp uses ROM table at RW6E=0xE67E.

## Absolute unlock

- Direct long-index / MAF: **17** XDF items
- Descriptor header (XDF or XDF−2): **14** XDF items
- Union absolute: **31/69**

Do **not** revive `RW68=0xD200` / `RW6A=0xD978`.

See `theory_vs_rom_bosch_ti.md`.
