# Ignition & fuel dataflow — XDF → DATA → CODE

ROM: `BMW DME413 SW623 D466.29 C16x900A 94 RedLabel.bin`
ISA: `mcs96_80c196_family`
CODE `0x2000`–`0xB930`; DATA from `0xB931`.
XDF (BRO) = primary definition evidence for names/equations.

## Coverage (v6 — exclusive geometry grown; D200/D978 retracted)

| Metric | Count | % of 69 |
|--------|------:|--------:|
| **Absolute `LOOKUP[ZR]` proven** (ea == XDF offset) | **0** | **0.0%** |
| **CAL-content index-base cross_checked** | **0** | **0.0%** |
| **Exclusive geometry** | **23** | **33.33%** |
| Structural split-ptr (`0xD000`+`0x0030`→`0xD030`) | 1 | 1.45% |
| ROM-proven register bases (FE24) | 4 | — |

0.0% absolute (0/69); 0% CAL-content index-base (D200/D978 retracted); 33.33% exclusive geometry (23/69); 4 ROM-proven FE24 bases.

> **v6:** D200/D978 remain retracted. FE24 bases unchanged.
> Exclusive geometry grown: Ti, VANOS RPM/load/dwell axes, MAF, ign idle,
> cold enrich, soft fuel cut.

## How CAL is read (corrected model)

1. **Parameter island** `RW68=0x42EC` — scalars / page markers (incl. `D000`+`0030` at +0x3E/+0x40)
2. **Index island** `RW6A=0x43F0` — small fault / descriptor indices (feed `0x6efd` / `RW1A` interp)
3. **Map interp** `0x20C7`→`0x33C2` via descriptor table `RW6E=0x1E08` (targets still unresolved)
4. **Exclusive Ti** `0xD030` — unique island split + body twins; CODE CMP touches
5. **Exclusive VANOS RPM axes** — shared 16-byte signature at 8 XDF offsets
6. **More exclusive families** — see below (MAF, load/dwell axes, idle, enrich)

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

## Additional exclusive families (v6)

### VANOS WOT dwell RPM axes

- Method: `signature_axis`
- Offsets: `0xD67C`, `0xD69E`
- Exclusive 16-byte axis sig — exactly D67C/D69E (WOT dwell ret/adv).

### VANOS PT load axes (fuel+ign)

- Method: `signature_axis`
- Offsets: `0xD9DA`, `0xDABA`, `0xDE7F`, `0xDF5F`
- Exclusive 12-byte load-axis preamble — fuel PT + ign PT load axes.

### Ign idle timing (Manual / A/T)

- Method: `signature_axis`
- Offsets: `0xDCF3`, `0xDD05`
- Exclusive 6-byte mid-table sig at DCF3+2 / DD05+2 only.

### Soft fuel cut (Ti neighborhood twin)

- Method: `island_cal_twin`
- Offsets: `0xD032`
- Exclusive island↔CAL twin of D032 Soft Fuel Cut header bytes.

### MAF transfer anchor (D28E BE↔LE)

- Method: `unique_immediate_twin`
- Offsets: `0xD290`
- Exclusive BE/LE twin of 0xD28E anchors MAF cal at D290 (FE struct region + CAL self-word).

### Ign idle cold timing corrections

- Method: `unique_span_chain`
- Offsets: `0xDCCF`, `0xDCD9`
- Unique contiguous span DCCF..DCD9+8 chains both cold-idle ign tables.

### Fuel cold engine enrich (Manual / A/T)

- Method: `unique_span_chain`
- Offsets: `0xD8EF`, `0xD8FD`
- Unique contiguous span D8EF..D8FD+4 chains both cold-enrich tables.


**All exclusive offsets (23):** `0xD030`, `0xD032`, `0xD290`, `0xD67C`, `0xD69E`, `0xD8EF`, `0xD8FD`, `0xD984`, `0xD9A6`, `0xD9C8`, `0xD9DA`, `0xDAA8`, `0xDABA`, `0xDCCF`, `0xDCD9`, `0xDCF3`, `0xDD05`, `0xDD0F`, `0xDD89`, `0xDE6D`, `0xDE7F`, `0xDF4D`, `0xDF5F`

## Key CODE sites

- FE24 loader `0x2EDB via 0x20B5 / 0x412C`
- Interp `0x20C7 → 0x33C2 (RW6E descriptors)`
- Post-load slots `0x5B06 RW1A=#0xD0`, `0x5B5B RW1A=#0x30`
- MAF anchor: `BE 0xD28E @0xFE18`, `LE 0xD28E @0xD28E`, `MAF 0xD290`

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
