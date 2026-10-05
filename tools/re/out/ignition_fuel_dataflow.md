# Ignition & fuel dataflow — XDF → DATA → CODE

ROM: `BMW DME413 SW623 D466.29 C16x900A 94 RedLabel.bin`
ISA: `mcs96_80c196_family`
CODE `0x2000`–`0xB930`; DATA from `0xB931`.
XDF (BRO) = primary definition evidence for names/equations.

## Coverage (v8 — all 69 exclusive where proven; D200/D978 retracted)

| Metric | Count | % of 69 |
|--------|------:|--------:|
| **Absolute `LOOKUP[ZR]` proven** (ea == XDF offset) | **0** | **0.0%** |
| **CAL-content index-base cross_checked** | **0** | **0.0%** |
| **Exclusive geometry** | **69** | **100.0%** |
| Structural split-ptr (`0xD000`+`0x0030`→`0xD030`) | 1 | 1.45% |
| ROM-proven register bases (FE24) | 4 | — |

0.0% absolute (0/69); 0% CAL-content index-base (D200/D978 retracted); 100.0% exclusive geometry (69/69); 4 ROM-proven FE24 bases.

> **v8:** D200/D978 remain retracted. FE24 bases unchanged.
> Exclusive geometry complete for all 69 ign/fuel XDF items (absolute still 0).

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

### Ignition WOT VANOS load axes

- Method: `signature_axis`
- Offsets: `0xDD21`, `0xDD9B`
- Exclusive d506||0e0e0c10105c tag immediately before both Ign WOT Vanos load axes (ret/adv).

### Fuel cranking axis + VANOS PT dwell tables

- Method: `unique_span_chain`
- Offsets: `0xD5A6`, `0xD5E6`, `0xD63A`
- Unique span covers cranking RPM axis and both VANOS PT dwell 8x8 tables (retarded/advanced).

### VANOS WOT dwell/control block

- Method: `unique_span_chain`
- Offsets: `0xD6AE`, `0xD6C6`, `0xD6E8`, `0xD6FA`, `0xD722`, `0xD734`
- Unique span: WOT dwell advanced table, TMOT fak, load MIN/MAX axes, DK min/max override tables.

### Fuel voltage axis (after VANOS DK)

- Method: `unique_span_chain`
- Offsets: `0xD75E`
- Unique span from DK tables through Fuel Voltage axis D75E.

### PT/WOT load maps + ign coil dwell

- Method: `unique_span_chain`
- Offsets: `0xE065`, `0xE0B3`, `0xE0DA`
- Unique span chains XDF PT/WOT load map blocks into main ignition coil voltage/dwell table E0DA.

### Fuel idle base + cold lambda correction

- Method: `unique_span_chain`
- Offsets: `0xD91F`, `0xD970`
- Unique span: Idle Cold Lambda Correction → Fuel Idle Base 6x3.

### Fuel accel enrich stack

- Method: `unique_span_chain`
- Offsets: `0xDC21`, `0xDC37`, `0xDC47`, `0xDC63`, `0xDC79`
- Unique contiguous accel-enrich stack (lambda, TMOT, fade, delta-load, overrun-related).

### Alpha-N limp load map

- Method: `unique_immediate_twin`
- Offsets: `0xDBC3`
- Unique 4-byte pre + 8-byte header immediately before Alpha-N DBC3.

### Early fuel/ign scalars (AFR, limiter Δzw, cyl trim)

- Method: `unique_span_chain`
- Offsets: `0xD06A`, `0xD093`, `0xD0FA`
- Unique span covering Target AFR, speed-limiter ign delta, cyl trim.

### MAF/sensor/speed/spark limit scalar block

- Method: `unique_span_chain`
- Offsets: `0xD23D`, `0xD23E`, `0xD240`, `0xD244`, `0xD256`, `0xD257`, `0xD25A`, `0xD25B`, `0xD27B`, `0xD27D`, `0xD27E`, `0xD281`, `0xD288`
- Unique contiguous CAL block: MAF fault limits, coolant/IAT bounds, speed-signal thresholds, spark fault, knock DTC scalar.

### Warm-up enrich + knock sensitivity tables

- Method: `unique_span_chain`
- Offsets: `0xD815`, `0xD8B1`
- Unique span from warm-up enrich suspect through knock-by-temp table.

### Knock-related block E044

- Method: `unique_span_chain`
- Offsets: `0xE044`
- Unique span from E044 knock block into proven PT load-map region.

### Lambda OFF RPM tables 1–4

- Method: `unique_span_chain`
- Offsets: `0xE364`, `0xE372`, `0xE37E`, `0xE388`
- Unique span covering all four Air Lambda OFF RPM tables.


**All exclusive offsets (69):** `0xD030`, `0xD032`, `0xD06A`, `0xD093`, `0xD0FA`, `0xD23D`, `0xD23E`, `0xD240`, `0xD244`, `0xD256`, `0xD257`, `0xD25A`, `0xD25B`, `0xD27B`, `0xD27D`, `0xD27E`, `0xD281`, `0xD288`, `0xD290`, `0xD5A6`, `0xD5E6`, `0xD63A`, `0xD67C`, `0xD69E`, `0xD6AE`, `0xD6C6`, `0xD6E8`, `0xD6FA`, `0xD722`, `0xD734`, `0xD75E`, `0xD815`, `0xD8B1`, `0xD8EF`, `0xD8FD`, `0xD91F`, `0xD970`, `0xD984`, `0xD9A6`, `0xD9C8`, `0xD9DA`, `0xDAA8`, `0xDABA`, `0xDBC3`, `0xDC21`, `0xDC37`, `0xDC47`, `0xDC63`, `0xDC79`, `0xDCCF`, `0xDCD9`, `0xDCF3`, `0xDD05`, `0xDD0F`, `0xDD21`, `0xDD89`, `0xDD9B`, `0xDE6D`, `0xDE7F`, `0xDF4D`, `0xDF5F`, `0xE044`, `0xE065`, `0xE0B3`, `0xE0DA`, `0xE364`, `0xE372`, `0xE37E`, `0xE388`

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
