# Theory vs ROM — Bosch M-Motronic TI (PRIMARY) × RedLabel

ROM: `BMW DME413 SW623 D466.29 C16x900A 94 RedLabel.bin`
Theory: [`ref_pdf_bosch_m_motronic_technical_instruction.md`](ref_pdf_bosch_m_motronic_technical_instruction.md)

> Book is PRIMARY family theory only. Do not verify or promote shipping maps from the PDF alone.

## Coverage (v6)

| Metric | Count | % of 69 |
|--------|------:|--------:|
| Absolute `LOOKUP[ZR]` proven (ea == XDF) | **0** | **0.0%** |
| CAL-content index-base cross_checked | **0** | **0.0%** |
| **Exclusive geometry** | **23** | **33.33%** |
| Structural split-ptr (`0xD030`) | 1 | 1.45% |
| ROM-proven register bases (FE24) | 4 | — |

0.0% absolute (0/69); 0% CAL-content index-base (D200/D978 retracted); 33.33% exclusive geometry (23/69); 4 ROM-proven FE24 bases.

> v6: grew exclusive geometry via signature axes, island↔CAL twins, BE/LE unique immediates, and unique span chains. D200/D978 remain retracted. Absolute CODE content reads still 0.

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

**All exclusive offsets (23):** `0xD030`, `0xD032`, `0xD290`, `0xD67C`, `0xD69E`, `0xD8EF`, `0xD8FD`, `0xD984`, `0xD9A6`, `0xD9C8`, `0xD9DA`, `0xDAA8`, `0xDABA`, `0xDCCF`, `0xDCD9`, `0xDCF3`, `0xDD05`, `0xDD0F`, `0xDD89`, `0xDE6D`, `0xDE7F`, `0xDF4D`, `0xDF5F`

## T1–T8 checklist

| ID | Theory | Status | Evidence |
|----|--------|--------|----------|
| T1 | Primary load = air-mass kg/h (HFM) | `exclusive_geometry_maf` | ADC @0x427A hyp intact. MAF exclusive BE↔LE twin 0xD28E @FE18/D28E → D290. Prior D200 index claim remains retracted. |
| T2 | Load = air mass per stroke from mass + speed | `partial_code` | 0x5AEB DIVU by 0x14CC → 0x1566; D5 axis link open. |
| T3 | ti_base = f(load, injector_constant), λ≈1 | `exclusive_structural` | Exclusive structural geometry: unique D000|0030 split under FE24 RW68, plus Ti body fragments that exist only as island↔CAL twins. CODE CMP @RW68+0x3E/+0x40 touches the split words (as bounds), not a content deref of 0xD030. Also: soft-fuel-cut twin D032; cold-enrich chain D8EF/D8FD; PT load axes D9DA/DABA. |
| T4 | Correction stack + Vbat + lambda + overrun cut | `partial_exclusive` | Cold enrich Manual/AT exclusive chain; accel stack CODE TBD. |
| T5 | zw_base = map(load, rpm) + corrections − knock | `exclusive_geometry_axes` | VANOS RPM axes @ 0xDD0F+sibs; PT load axes DE7F/DF5F; ign idle timing DCF3/DD05; idle cold DCCF/DCD9. |
| T6 | Dwell = f(Vbat, rpm) | `partial_exclusive` | VANOS WOT dwell axes D67C/D69E exclusive sig; main dwell 0xE0DA body CODE read still open. |
| T7 | TPS secondary / limp load | `xdf_only` | Strong XDF; fault path CODE TBD. |
| T8 | Camshaft control expander | `exclusive_geometry_axes` | PT/WOT fuel+ign VANOS RPM + PT load + WOT dwell axes exclusive. Selector CODE TBD. |

## Key CODE sites

- FE24 loader: `0x2EDB via 0x20B5 / 0x412C`
- Map interp: `0x20C7 → 0x33C2 (RW6E descriptors)`
- Post-load slots: `0x5B06 RW1A=#0xD0`, `0x5B5B RW1A=#0x30`
- Ti CMPs: `0x8B13`, `0x8C17`, `0x8C2E`, `0x8BCC`
- MAF anchor: `BE 0xD28E @0xFE18`, `LE 0xD28E @0xD28E`, `MAF 0xD290`

## Next

1. Compose D000+|0030 and [deref] Ti; CODE-walk one VANOS RPM/load axis
1. Descriptor patches 0x42DF → 0xDxxx for main fuel/ign map bodies
1. Exclusive geometry for Alpha-N 0xDBC3, dwell 0xE0DA, accel stack
1. Absolute LOOKUP[ZR] for one fuel map body and one ign map body

---
Research-only. Verification gates unchanged.
