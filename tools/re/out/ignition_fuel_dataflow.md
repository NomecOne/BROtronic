# Ignition & fuel dataflow — XDF → DATA → CODE

ROM: `BMW DME413 SW623 D466.29 C16x900A 94 RedLabel.bin`
ISA: `mcs96_80c196_family`
CODE `0x2000`–`0xB930`; DATA from `0xB931`.
XDF (BRO) = primary definition evidence for names/equations.

## Coverage (v9 — exclusive 100%; absolute growing)

| Metric | Count | % of 69 |
|--------|------:|--------:|
| **Absolute CODE reads** (ea → XDF) | **31** | **44.93%** |
| **Exclusive geometry** | **69** | **100.0%** |
| **CAL-content index-base (D200/D978)** | **0** | **0%** (retracted) |
| Runtime FE14 CAL bases | 4 | — |

44.93% absolute (31/69); exclusive geometry 100.0% (69/69); FE14 CAL bases RW68=D002/RW6A=D106/RW6C=D28E/RW6E=E67E; D200/D978 retracted.

> **v9:** FE14 loader bases unlock absolute reads. Priority MAF/Ti/ign WOT proven.
> Exclusive geometry remains 69/69. D200/D978 stay retracted.

## How CAL is read (v9 addressing model)

1. **FE14 CAL bases** via loader `0x2EDB`: `RW68=0xD002`, `RW6A=0xD106`, `RW6C=0xD28E`, `RW6E=0xE67E`
2. **Long-index** `LOOKUP/TABLE[RWbase]` → direct CAL scalars/limits (Ti @ RW68+0x2E)
3. **MAF** ADC ISR: `RW46=RW6C+2·ADC`; `ADD RW64,0x2[RW46]` → word table @ `0xD290`
4. **Map interp** `0x20C7/0x20CD`: `ADD RW1A,RW6E; LD RW4C,[RW1A]` → descriptor headers in CAL
6. **Exclusive geometry** retained for all 69 (signatures/spans/twins)

## Priority absolute proofs

- **MAF `0xD290`:** `0xA53B ADD RW64,0x2[RW46] (RW46=RW6C+2·ADC)`
- **Ti `0xD030`:** `0x9A82`, `0xAFC7` — contentDeref **True**
- **Ign WOT `0xDD0F`:** `0x66EC LD RW1A,#0x9A → 0x6987 → 0x20CD → DD0D/DD0F`

Absolute offsets (31): `0xD030`, `0xD032`, `0xD06A`, `0xD093`, `0xD23E`, `0xD240`, `0xD244`, `0xD256`, `0xD257`, `0xD25A`, `0xD25B`, `0xD27B`, `0xD27D`, `0xD27E`, `0xD281`, `0xD288`, `0xD290`, `0xD5A6`, `0xD67C`, `0xD69E`, `0xD6E8`, `0xD6FA`, `0xD75E`, `0xD984`, `0xD9A6`, `0xD9C8`, `0xDAA8`, `0xDD0F`, `0xDD89`, `0xDE6D`, `0xDF4D`

## Fuel Ti `0xD030`

- Runtime EA `RW68+0x2E = 0xD030 (RW68=0xD002)`
- Split `00D03000 unique @0x432A` (exclusive island twin)
- Content deref: **True**

## Ignition (+fuel) — VANOS RPM axes

Signature `050605070a05070b0909090f12130860` — exactly 8 hits (exclusive); ign WOT/PT absolute via descriptors:

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

## Additional exclusive families

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

- FE14 loader `0x2EDB via 0x20B5 / 0x412C → FE14 CAL bases`
- Interp `0x20C7/0x20CD → ADD RW1A,RW6E; LD RW4C,[RW1A] (RW6E=0xE67E)`
- MAF absolute `0xA53B ADD RW64,0x2[RW46] (RW46=RW6C+2·ADC)`
- Ign WOT `0x66EC LD RW1A,#0x9A → 0x6987 → 0x20CD → DD0D/DD0F`

## Related artifacts

- `theory_vs_rom_bosch_ti.{md,json}` — T1–T8 + absolute + exclusive
- `register_bases_fe24.{md,json}` — FE14 runtime + FE24 adjacent
- `cal_access_model.{md,json}` — addressing model
- `irq_ram_publications.{md,json}` / `sfr_hso_hsi_audit.{md,json}`

## What is *not* claimed

- Shipping promotion from Bosch PDF or retracted geometry
- Absolute coverage of all 69 (currently 31/69)
- End-to-end HFM→ti→ign control closed-loop proof

---
Research-only. Verification gates for promotion unchanged.
