# Theory vs ROM — Bosch M-Motronic TI (PRIMARY) × RedLabel

ROM: `BMW DME413 SW623 D466.29 C16x900A 94 RedLabel.bin`
Theory: [`ref_pdf_bosch_m_motronic_technical_instruction.md`](ref_pdf_bosch_m_motronic_technical_instruction.md)

> Book is PRIMARY family theory only. Do not verify or promote shipping maps from the PDF alone.

## Coverage (v8)

| Metric | Count | % of 69 |
|--------|------:|--------:|
| Absolute `LOOKUP[ZR]` proven (ea == XDF) | **0** | **0.0%** |
| CAL-content index-base cross_checked | **0** | **0.0%** |
| **Exclusive geometry** | **69** | **100.0%** |
| Structural split-ptr (`0xD030`) | 1 | 1.45% |
| ROM-proven register bases (FE24) | 4 | — |

0.0% absolute (0/69); 0% CAL-content index-base (D200/D978 retracted); 100.0% exclusive geometry (69/69); 4 ROM-proven FE24 bases.

> v8: exclusive geometry for all 69 ign/fuel XDF items via signature/span/twin methods. Absolute LOOKUP[ZR] still 0 (no path appeared). D200/D978 remain retracted. Unproven exclusive: none.

## ROM-proven register bases

Unique structure @ `0xFE24` (`LDB Rhi,-off-1[RW1C]; LDB Rlo,-off[RW1C] (hi byte at lower addr)`):

| Reg | Value | Role |
|-----|-------|------|
| RW68 | `0x42EC` | CODE parameter island |
| RW6A | `0x43F0` | CODE index / fault-id island |
| RW6C | `0x1A08` | Descriptor RAM (`CMP RW6C,#0x1a08 @0x4D60`) |
| RW6E | `0x1E08` | Descriptor RAM (`CMP RW6E,#0x1e08 @0x481B/0x4D66`) |

Loader: `0x2EDB via trampoline 0x20B5 / LCALL 0x412C`.

## Retraction (important)

- **Retracted:** RW68=0xD200 index-base cross_checked for 13 MAF/sensor XDF items
  - False positive: offsets under RW68 land in CODE island 0x42EC+, not CAL 0xD200+. CMP RW24,0x3e[RW68] reads island word 0xD000, not MAF high limit at 0xD23E.

- **Retracted:** RW6A=0xD978 exclusive geometry for 6 fuel PT/WOT axis XDF items
  - False positive: RW6A=0x43F0 island holds small fault/descriptor indices (e.g. +0x2E → 0x0006), not CAL addresses. Same sites feed LCALL 0x6efd/0x6f69 fault packaging.

RW24/RW20/RW38 ‘exclusive’ ign geometries rejected — those regs are scratch (e.g. ADD RW24,RW6A,#imm; LD RW38,RW6C).

## Fuel exclusive — Ti `0xD030`

- Target `0xD030` Inj. Constant(Ti)
- 0x432A (RW68+0x3E) = 0xD000; 0x432C (RW68+0x40) = 0x0030 → `0xD030`
- Exclusive split: `00D03000 unique @0x432A`
- CODE CMP page: `0x8B13`, `0x8C17`, `0x8C2E`
- CODE CMP off: `0x8BCC`
- Exclusive structural geometry: unique D000|0030 split under FE24 RW68, plus Ti body fragments that exist only as island↔CAL twins. CODE CMP @RW68+0x3E/+0x40 touches the split words (as bounds), not a content deref of 0xD030.

## VANOS RPM axes (8)

- Signature `050605070a05070b0909090f12130860` — exactly 8 hits:

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

## T1–T8 checklist

| ID | Theory | Status | Evidence |
|----|--------|--------|----------|
| T1 | Primary load = air-mass kg/h (HFM) | `exclusive_geometry_maf` | ADC @0x427A hyp intact. MAF exclusive BE↔LE twin 0xD28E @FE18/D28E → D290. Prior D200 index claim remains retracted. |
| T2 | Load = air mass per stroke from mass + speed | `partial_code` | 0x5AEB DIVU by 0x14CC → 0x1566; D5 axis link open. |
| T3 | ti_base = f(load, injector_constant), λ≈1 | `exclusive_structural` | Exclusive structural geometry: unique D000|0030 split under FE24 RW68, plus Ti body fragments that exist only as island↔CAL twins. CODE CMP @RW68+0x3E/+0x40 touches the split words (as bounds), not a content deref of 0xD030. Also: soft-fuel-cut twin D032; cold-enrich chain D8EF/D8FD; PT load axes D9DA/DABA. |
| T4 | Correction stack + Vbat + lambda + overrun cut | `partial_exclusive` | Cold enrich Manual/AT exclusive chain; accel stack CODE TBD. |
| T5 | zw_base = map(load, rpm) + corrections − knock | `exclusive_geometry_axes` | VANOS RPM axes @ 0xDD0F+sibs; PT load axes DE7F/DF5F; ign idle timing DCF3/DD05; idle cold DCCF/DCD9. |
| T6 | Dwell = f(Vbat, rpm) | `exclusive_geometry` | VANOS WOT dwell axes D67C/D69E; PT dwell tables D5E6/D63A; main dwell E0DA via PT/WOT load-map span. CODE deref still open. |
| T7 | TPS secondary / limp load | `exclusive_geometry` | Alpha-N DBC3 unique pre+header; fault-path CODE TBD. |
| T8 | Camshaft control expander | `exclusive_geometry_axes` | PT/WOT fuel+ign VANOS RPM + PT load + WOT dwell axes exclusive. Selector CODE TBD. |

## Key CODE sites

- FE24 loader: `0x2EDB via 0x20B5 / 0x412C`
- Map interp: `0x20C7 → 0x33C2 (RW6E descriptors)`
- Post-load slots: `0x5B06 RW1A=#0xD0`, `0x5B5B RW1A=#0x30`
- Ti CMPs: `0x8B13`, `0x8C17`, `0x8C2E`, `0x8BCC`
- MAF anchor: `BE 0xD28E @0xFE18`, `LE 0xD28E @0xD28E`, `MAF 0xD290`

## Next

1. Compose D000+|0030 and [deref] Ti content (first absolute fuel read)
1. Descriptor 0x42DF → 0xDxxx for absolute map-body LOOKUP
1. CODE-walk one exclusive VANOS/fuel/ign table via interp 0x20C7

---
Research-only. Verification gates unchanged.
