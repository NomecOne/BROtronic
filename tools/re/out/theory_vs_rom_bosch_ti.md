# Theory vs ROM — Bosch M-Motronic TI (PRIMARY) × RedLabel

ROM: `BMW DME413 SW623 D466.29 C16x900A 94 RedLabel.bin`
Theory: [`ref_pdf_bosch_m_motronic_technical_instruction.md`](ref_pdf_bosch_m_motronic_technical_instruction.md)

> Book is PRIMARY family theory only. Do not verify or promote shipping maps from the PDF alone.

## Coverage (v9)

| Metric | Count | % of 69 |
|--------|------:|--------:|
| **Absolute CODE reads** (ea → XDF) | **31** | **44.93%** |
| **Exclusive geometry** | **69** | **100.0%** |
| CAL-content index-base (D200/D978) | **0** | **0%** (retracted) |
| Runtime FE14 CAL bases | 4 | — |

44.93% absolute (31/69); exclusive geometry 100.0% (69/69); FE14 CAL bases RW68=D002/RW6A=D106/RW6C=D28E/RW6E=E67E; D200/D978 retracted.

> v9: corrected FE14 loader bases unlock absolute CODE reads. Priority: MAF D290, Ti D030, ign WOT DD0F. Absolute 31/69; exclusive 69/69. ZR LOOKUP immed≠XDF (indirect via RWbase). D200/D978 remain retracted.

## Addressing model (v9) — FE14 CAL bases

Loader `0x2EDB via trampoline 0x20B5 / LCALL 0x412C` scans FF pad then loads BE hi/lo from `0xFE14`:

| Reg | Value | Role |
|-----|-------|------|
| RW68 | `0xD002` | CAL page base (Ti 0xD030 = +0x2E) |
| RW6A | `0xD106` | CAL sensor/limit base |
| RW6C | `0xD28E` | MAF table base (body 0xD290 = +2) |
| RW6E | `0xE67E` | CAL descriptor table (LE16 map headers) |

FE24 adjacent (not loaded): `{'RW68': '0x42EC', 'RW6A': '0x43F0', 'RW6C': '0x1A08', 'RW6E': '0x1E08'}`.
CMP dual-config: With FE14 CAL bases, descriptor RAM fill @0x4ECC is skipped; interp uses ROM table at RW6E=0xE67E.

## Priority absolute proofs

### maf_D290: `0xD290` — `absolute`

- Method: `maf_adc_word_table`
- RW6C=0xD28E from FE14 loader; ADC ISR indexes word table at +2 (0xD290 + 2·ADC).

### ti_D030: `0xD030` — `absolute`

- Method: `long_index`
- RW68=0xD002; LD RW40,0x2e[RW68] @0xAFC7 and DIVU RL1C,0x2e,TABLE[RW68] @0x9A82 read injector constant.

### ign_WOT_DD0F: `0xDD0F` — `absolute`

- Method: `descriptor_header`
- Main ign WOT VANOS-retarded RPM axis via CAL descriptor table.
- Path: `0x66EC LD RW1A,#0x9A → (VANOS select) 0x6723 SCALL 0x6987 → LCALL 0x20CD → 0x343C ADD RW1A,RW6E; LD RW4C,[RW1A] → [0xE67E+0x9A]=0xDD0D (header) / XDF axis 0xDD0F`

**All absolute offsets (31):** `0xD030`, `0xD032`, `0xD06A`, `0xD093`, `0xD23E`, `0xD240`, `0xD244`, `0xD256`, `0xD257`, `0xD25A`, `0xD25B`, `0xD27B`, `0xD27D`, `0xD27E`, `0xD281`, `0xD288`, `0xD290`, `0xD5A6`, `0xD67C`, `0xD69E`, `0xD6E8`, `0xD6FA`, `0xD75E`, `0xD984`, `0xD9A6`, `0xD9C8`, `0xDAA8`, `0xDD0F`, `0xDD89`, `0xDE6D`, `0xDF4D`

## Retraction (important)

- **Retracted:** RW68=0xD200 index-base cross_checked for 13 MAF/sensor XDF items
  - False positive: offsets under RW68 land in CODE island 0x42EC+, not CAL 0xD200+. CMP RW24,0x3e[RW68] reads island word 0xD000, not MAF high limit at 0xD23E.

- **Retracted:** RW6A=0xD978 exclusive geometry for 6 fuel PT/WOT axis XDF items
  - False positive: RW6A=0x43F0 island holds small fault/descriptor indices (e.g. +0x2E → 0x0006), not CAL addresses. Same sites feed LCALL 0x6efd/0x6f69 fault packaging.

RW24/RW20/RW38 ‘exclusive’ ign geometries rejected — those regs are scratch (e.g. ADD RW24,RW6A,#imm; LD RW38,RW6C).

## Fuel Ti `0xD030` — absolute + exclusive

- Target `0xD030` Inj. Constant(Ti)
- Runtime EA: `RW68+0x2E = 0xD030 (RW68=0xD002)`
- Content reads: `0x9A82`, `0xAFC7`
- Exclusive split: `00D03000 unique @0x432A`
- Absolute: LD/DIVU at RW68+0x2E → 0xD030 (injector constant). Exclusive island D000|0030 @0x432A + body twins retained.

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
| T1 | Primary load = air-mass kg/h (HFM) | `absolute_maf` | Absolute: ADC ISR @0xA53B ADD RW64,0x2[RW46] with RW46=RW6C+2·ADC, RW6C=0xD28E → table @0xD290. Exclusive BE↔LE twin retained. |
| T2 | Load = air mass per stroke from mass + speed | `partial_code` | 0x5AEB DIVU by 0x14CC → 0x1566; D5 axis link open. |
| T3 | ti_base = f(load, injector_constant), λ≈1 | `absolute_ti` | Absolute: LD/DIVU at RW68+0x2E → 0xD030 (injector constant). Exclusive island D000|0030 @0x432A + body twins retained. Also absolute soft-cut CMP D032; descriptor fuel axes. |
| T4 | Correction stack + Vbat + lambda + overrun cut | `partial_exclusive` | Cold enrich Manual/AT exclusive chain; accel stack CODE TBD. |
| T5 | zw_base = map(load, rpm) + corrections − knock | `absolute_descriptor_axes` | Absolute ign WOT axis 0xDD0F via RW1A=#0x9A→interp→[E67E+9A]=DD0D; also DD89/DE6D/DF4D. Exclusive geometry retained for siblings. |
| T6 | Dwell = f(Vbat, rpm) | `exclusive_geometry` | VANOS WOT dwell axes D67C/D69E; PT dwell tables D5E6/D63A; main dwell E0DA via PT/WOT load-map span. CODE deref still open. |
| T7 | TPS secondary / limp load | `exclusive_geometry` | Alpha-N DBC3 unique pre+header; fault-path CODE TBD. |
| T8 | Camshaft control expander | `exclusive_geometry_axes` | PT/WOT fuel+ign VANOS RPM + PT load + WOT dwell axes exclusive. Selector CODE TBD. |

## Key CODE sites

- FE14 loader: `0x2EDB via 0x20B5 / 0x412C → FE14 CAL bases`
- Map interp: `0x20C7/0x20CD → ADD RW1A,RW6E; LD RW4C,[RW1A] (RW6E=0xE67E)`
- MAF absolute: `0xA53B ADD RW64,0x2[RW46] (RW46=RW6C+2·ADC)`
- Ign WOT select: `0x66EC LD RW1A,#0x9A → 0x6987 → 0x20CD → DD0D/DD0F`
- Ti content: `0x9A82`, `0xAFC7`
- MAF anchor: `FE14 RW6C=0xD28E`, `MAF body 0xD290`, `ADC ISR 0xA4AA`

## Next

1. Grow absolute coverage beyond 31/69 (more descriptor header deltas / body walks)
1. Prove PT/WOT main fuel map body reads through descriptor→[RW4C] walk
1. Tie dwell E0DA and idle ign tables to descriptor or long-index sites

---
Research-only. Verification gates unchanged.
