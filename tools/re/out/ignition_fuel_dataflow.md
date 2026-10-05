# Ignition & fuel dataflow — XDF → DATA → CODE

ROM: `BMW DME413 SW623 D466.29 C16x900A 94 RedLabel.bin`
ISA: `mcs96_80c196_family`
CODE `0x2000`–`0xB930`; DATA from `0xB931`.
XDF (BRO) = primary definition evidence for names/equations.

## Coverage (v5 — exclusive geometry; D200/D978 retracted)

| Metric | Count | % of 69 |
|--------|------:|--------:|
| **Absolute `LOOKUP[ZR]` proven** (ea == XDF offset) | **0** | **0.0%** |
| **CAL-content index-base cross_checked** | **0** | **0.0%** |
| **Exclusive geometry** (Ti + VANOS RPM axes) | **9** | **13.04%** |
| Structural split-ptr (`0xD000`+`0x0030`→`0xD030`) | 1 | 1.45% |
| ROM-proven register bases (FE24) | 4 | — |

0.0% absolute (0/69); 0% CAL-content index-base (D200/D978 retracted); 13.04% exclusive geometry (9/69: Ti structural + 8 VANOS RPM axes); 4 ROM-proven FE24 bases.

> **v5:** `RW68=0xD200` (13) and `RW6A=0xD978` (6) retracted as false positives.
> Real bases: `RW68=0x42EC`, `RW6A=0x43F0`, `RW6C=0x1A08`, `RW6E=0x1E08`.
> New: exclusive geometry for fuel Ti + ign/fuel VANOS RPM axes.

## How CAL is read (corrected model)

1. **Parameter island** `RW68=0x42EC` — scalars / page markers (incl. `D000`+`0030` at +0x3E/+0x40)
2. **Index island** `RW6A=0x43F0` — small fault / descriptor indices (feed `0x6efd` / `RW1A` interp)
3. **Map interp** `0x20C7`→`0x33C2` via descriptor table `RW6E=0x1E08` (targets still unresolved)
4. **Exclusive Ti** `0xD030` — unique island split + body twins; CODE CMP touches
5. **Exclusive VANOS RPM axes** — shared 16-byte signature at 8 XDF offsets (4 fuel + 4 ign)

## Fuel exclusive — Ti `0xD030`

- Split `00D03000 unique @0x432A`
- Body twins island↔CAL only
- CODE sites: `0x8B13`, `0x8C17`, `0x8C2E`, `0x8BCC`
- Content deref: **False**

## Ignition (+fuel) exclusive — VANOS RPM axes

Signature `050605070a05070b0909090f12130860` — exactly 8 hits:

| Offset | Domain | Name |
|--------|--------|------|
| `0xD984` | fuel | 0xD984 RPM axis for Fuel, WOT, Vanos retarded |
| `0xD9A6` | fuel | 0xD9A6 RPM axis for Fuel, WOT, Vanos advanced |
| `0xD9C8` | fuel | 0xD9C8 RPM axis for Fuel, PT, Vanos retarded |
| `0xDAA8` | fuel | 0xDAA8 RPM axis for Fuel, PT, Vanos advanced |
| `0xDD0F` | ign | 0xDD0F RPM axis for Ignition, WOT, Vanos retarded |
| `0xDD89` | ign | 0xDD89 RPM axis for Ignition, WOT, Vanos advanced |
| `0xDE6D` | ign | 0xDE6D RPM axis for Ignition, PT, Vanos retarded |
| `0xDF4D` | ign | 0xDF4D RPM axis for Ignition, PT, Vanos advanced |

Representative ign: `0xDD0F`; fuel: `0xD984`.
CODE axis deref: **False**.

## Key CODE sites

- FE24 loader `0x2EDB via 0x20B5 / 0x412C`
- Interp `0x20C7 → 0x33C2 (RW6E descriptors)`
- Post-load slots `0x5B06 RW1A=#0xD0`, `0x5B5B RW1A=#0x30`

## Related artifacts

- `theory_vs_rom_bosch_ti.{md,json}` — T1–T8 + retraction + exclusive geometry
- `register_bases_fe24.{md,json}` — FE24 proven bases
- `cal_access_model.{md,json}` — absolute-path attempt
- `irq_ram_publications.{md,json}` / `sfr_hso_hsi_audit.{md,json}`

## What is *not* claimed

- Shipping promotion from Bosch PDF or retracted geometry
- Absolute `LOOKUP[ZR]` CAL *content* reads of fuel/ign map bodies (still 0)
- End-to-end HFM→ti→ign control

---
Research-only. Verification gates for promotion unchanged.
