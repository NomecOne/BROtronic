# Theory vs ROM — Bosch M-Motronic TI (PRIMARY) × RedLabel

ROM: `BMW DME413 SW623 D466.29 C16x900A 94 RedLabel.bin`
Theory: [`ref_pdf_bosch_m_motronic_technical_instruction.md`](ref_pdf_bosch_m_motronic_technical_instruction.md)

> Book is PRIMARY family theory only. Do not verify or promote shipping maps from the PDF alone.

## Coverage (v5)

| Metric | Count | % of 69 |
|--------|------:|--------:|
| Absolute `LOOKUP[ZR]` proven (ea == XDF) | **0** | **0.0%** |
| CAL-content index-base cross_checked | **0** | **0.0%** |
| **Exclusive geometry** (fuel Ti + VANOS RPM axes) | **9** | **13.04%** |
| Structural split-ptr (`0xD030`) | 1 | 1.45% |
| ROM-proven register bases (FE24) | 4 | — |

0.0% absolute (0/69); 0% CAL-content index-base (D200/D978 retracted); 13.04% exclusive geometry (9/69: Ti structural + 8 VANOS RPM axes); 4 ROM-proven FE24 bases.

> v5: retracted false D200/D978 XDF-geometry xrefs. Raised exclusive-geometry proofs for ≥1 fuel (Ti 0xD030) and ≥1 ignition (VANOS RPM axes e.g. 0xDD0F). Absolute CODE content reads still 0.

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

## Fuel exclusive geometry — Ti `0xD030`

- Target `0xD030` Inj. Constant(Ti)
- 0x432A (RW68+0x3E) = 0xD000; 0x432C (RW68+0x40) = 0x0030 → `0xD030`
- Exclusive split: `00D03000 unique @0x432A`
- Body twins: `['90655046', '0080c05d00000020']` island↔CAL only
- CODE CMP of page `0xD000` via RW68+0x3E: `0x8B13`, `0x8C17`, `0x8C2E`
- CODE CMP of offset `0x0030` via RW68+0x40: `0x8BCC`
- Content deref proven: **False**
- Exclusive structural geometry: unique D000|0030 split under FE24 RW68, plus Ti body fragments that exist only as island↔CAL twins. CODE CMP @RW68+0x3E/+0x40 touches the split words (as bounds), not a content deref of 0xD030.

## Ignition (+fuel) exclusive geometry — VANOS RPM axes

- Signature `050605070a05070b0909090f12130860` (len 16) — **exactly 8** ROM hits, all XDF VANOS RPM axes:

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

- Representative ignition: `0xDD0F`
- Representative fuel: `0xD984`
- CODE deref of axis body: **False** (descriptor path open)
- Exclusive content geometry: this 16-byte RPM-axis preamble appears exactly 8 times in the image — precisely the XDF Fuel/Ign PT|WOT VANOS RPM axes. Proves table geometry for ≥1 fuel and ≥1 ignition axis (all 8). Not a CODE LOOKUP[ZR] content read.

## T1–T8 checklist

| ID | Theory | Status | Evidence |
|----|--------|--------|----------|
| T1 | Primary load = air-mass kg/h (HFM) | `partial_code` | ADC schedule @0x427A (ch 0x0A→0x1454 hyp). Prior RW68→0xD290 claim retracted. MAF cal CODE read still open (descriptor path). |
| T2 | Load = air mass per stroke from mass + speed | `partial_code` | 0x5AEB DIVU by 0x14CC → 0x1566; D5 axis link open. |
| T3 | ti_base = f(load, injector_constant), λ≈1 | `exclusive_structural` | Exclusive structural geometry: unique D000|0030 split under FE24 RW68, plus Ti body fragments that exist only as island↔CAL twins. CODE CMP @RW68+0x3E/+0x40 touches the split words (as bounds), not a content deref of 0xD030. |
| T4 | Correction stack + Vbat + lambda + overrun cut | `xdf_only` | XDF present; CODE stack order TBD. |
| T5 | zw_base = map(load, rpm) + corrections − knock | `exclusive_geometry_axes` | VANOS RPM axis signature exclusive @ 0xDD0F (+7 siblings). Main zw map body CODE read still open. |
| T6 | Dwell = f(Vbat, rpm) | `xdf_only` | XDF named; no CODE read this pass. |
| T7 | TPS secondary / limp load | `xdf_only` | Strong XDF; fault path CODE TBD. |
| T8 | Camshaft control expander | `exclusive_geometry_axes` | PT/WOT fuel+ign VANOS RPM axes share exclusive 16-byte signature (8/8 XDF match). Selector CODE TBD. |

## Key CODE sites

- FE24 loader: `0x2EDB via 0x20B5 / 0x412C`
- Map interp: `0x20C7 → 0x33C2 (RW6E descriptors)`
- Post-load Ti-related slots: `0x5B06 RW1A=#0xD0`, `0x5B5B RW1A=#0x30`
- Ti page/off CMPs: `0x8B13`, `0x8C17`, `0x8C2E`, `0x8BCC`

## Next

1. Compose D000+|0030 from island into a pointer and [deref] Ti content
1. Find descriptor-table patches that replace 0x42DF with 0xDxxx map pointers
1. CODE walk of one VANOS RPM axis (sig @0xDD0F family) via interp
1. Absolute LOOKUP[ZR] for one fuel map body and one ign map body

---
Research-only. Verification gates unchanged.
