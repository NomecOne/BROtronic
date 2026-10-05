# Register bases — ROM-proven (FE24)

ROM: `BMW DME413 SW623 D466.29 C16x900A 94 RedLabel.bin`

**Structure @ `0xFE24`** (unique in image):

| Reg | Value |
|-----|-------|
| `RW68` | `0x42EC` |
| `RW6A` | `0x43F0` |
| `RW6C` | `0x1A08` |
| `RW6E` | `0x1E08` |

Loader: `0x2EDB via trampoline 0x20B5 / LCALL 0x412C`. CMP cross-check: `CMP RW6C,#0x1a08 @0x4D60`; `CMP RW6E,#0x1e08 @0x481B/0x4D66`.

## Retraction

Do **not** use prior `RW68=0xD200` / `RW6A=0xD978` XDF-geometry tables — retracted in v4/v5.

## Exclusive geometry (v5)

- Fuel Ti `0xD030`: unique `D000|0030` @`0x432A` (RW68+0x3E/+0x40)
- VANOS RPM axes: signature `050605070a05070b0909090f12130860` @ `0xD984`, `0xD9A6`, `0xD9C8`, `0xDAA8`, `0xDD0F`, `0xDD89`, `0xDE6D`, `0xDF4D`

See `theory_vs_rom_bosch_ti.md`.
