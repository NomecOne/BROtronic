# Theory vs ROM — Bosch M-Motronic TI (PRIMARY) × RedLabel

ROM: `BMW DME413 SW623 D466.29 C16x900A 94 RedLabel.bin`
Theory: [`ref_pdf_bosch_m_motronic_technical_instruction.md`](ref_pdf_bosch_m_motronic_technical_instruction.md)

> Book is PRIMARY family theory only. Do not verify or promote shipping maps from the PDF alone.

## Coverage

| Metric | Count | % of 69 |
|--------|------:|--------:|
| Absolute `LOOKUP[ZR]` proven (ea == XDF) | **0** | **0.0%** |
| Index-base cross_checked (`RW68`=`0xD200`) | **13** | **18.84%** |
| Structural split-ptr (`0xD030`) | 1 | 1.45% |

0.0% absolute proven (0/69); 18.84% index-base cross_checked (13/69 via RW68=0xD200); 1 structural (0xD030).

## T1–T8 checklist

| ID | Theory (Bosch TI) | ROM / XDF | Status | Evidence |
|----|-------------------|-----------|--------|----------|
| T1 | Primary load = air-mass kg/h (HFM) | MAF 0xD290; ADC→lookup | `partial_code` | ADC schedule @0x427A (ch 0x0A→0x1454 high-rate hyp); RW68+0x90→0xD290 CODE site @0x68CD (index-base cross_checked); MAF fault limits 0xD23E/D240/D244 via RW68. |
| T2 | Load = air mass per stroke from mass + speed | D5 filtered load (inj-time referred) | `partial_code` | vec2 0x14CC period → DIVU @0x5AEB → ST 0x1566 @0x5AFD; consumer @0xB212. XDF D5 axis link still open. |
| T3 | ti_base = f(load, injector_constant), λ≈1 | Ti 0xD030 + PT/WOT fuel maps | `structural_only` | Structural 0xD000+0x0030 @0x432A; post-load LCALL 0x20C7 RW1A=#0xD0/#0x30. No CODE deref of 0xD030 yet. |
| T4 | Correction stack + Vbat + lambda + overrun cut | Enrich / O2 / voltage / cut tables | `xdf_only` | Partial XDF; CODE stack order not mapped this pass. |
| T5 | zw_base = map(load, rpm) + corrections − knock | PT/WOT ign VANOS maps; knock | `partial_code` | Knock-related 0xD288 via RW68+0x88 @0x660C; spark-fault 0xD281 @0xB0AF. Main zw map reads still unresolved. |
| T6 | Dwell = f(Vbat, rpm) | 0xE0DA | `xdf_only` | XDF named; no RW68/absolute CODE read this pass. |
| T7 | TPS secondary / limp load | Alpha-N 0xDBC3 | `xdf_only` | Strong XDF; fault path CODE TBD. |
| T8 | Camshaft control expander | VANOS dual fuel/ign maps | `xdf_only` | BMW app + XDF dual maps; selector CODE TBD. |

## New index-base xrefs (`RW68` + `0xD200`)

**Proof:** Only base 0xD200 makes RW68+{0x3E,0x40,0x44,0x90} land simultaneously on MAF high/low/ratio/cal XDF items. No LD RW68,#imm in external image (0x0000–0x1FFF erased); base is cross_checked by geometry, not by immediate load.

**13 unique / 19 sites**

| Target | Sites | XDF name |
|--------|------:|----------|
| `0xD23E` | 3 | 0xD23E[16bit] Air, MAF, High Fault Limit kg/h |
| | | `0x8B13`, `0x8C17`, `0x8C2E` |
| `0xD240` | 1 | 0xD240[16bit] Air, MAF, Low Fault Limit kg/h |
| | | `0x8BCC` |
| `0xD244` | 2 | 0xD244[16bit] Air, MAF, MAF/RPM Ratio Limit |
| | | `0x8CD3`, `0x8CE7` |
| `0xD256` | 3 | 0xD256[8bit] Coolant Temp Sensor max signal@min volts RAW |
| | | `0x498E`, `0x5162`, `0xAFAD` |
| `0xD257` | 1 | 0xD257[8bit] Coolant Temp Sensor min signal@max volts RAW |
| | | `0x5A6C` |
| `0xD25A` | 1 | 0xD25A[8bit] Air, IAT max signal |
| | | `0x5C73` |
| `0xD25B` | 1 | 0xD25B[8bit] Air, IAT min signal |
| | | `0x5CEF` |
| `0xD27B` | 1 | 0xD27B[8bit] Speed, RPM Threshold to activate speed signal check |
| | | `0x99BE` |
| `0xD27D` | 1 | 0xD27D[8bit] Speed, Counter? Threshold for speed signal check DTC 42 |
| | | `0x9974` |
| `0xD27E` | 2 | 0xD27E[8bit] RPM, Rev Limit, IF no speed signal |
| | | `0x9758`, `0x9B7C` |
| `0xD281` | 1 | 0xD281[8bit] Ign., Spark Fault |
| | | `0xB0AF` |
| `0xD288` | 1 | 0xD288 Knock Sensor DTC related |
| | | `0x660C` |
| `0xD290` | 1 | 0xD290[Func|5V|256]MAF Cal. kg/h |
| | | `0x68CD` |

## Load path fragments (T1–T3)

### ADC schedule (T1)

- Base `0x427A` … `0x42A0` in vec5 `0xA4AA`
- vec5 loads channel word then dest word from schedule; LDB AD_resultlo,R44 kicks channel; STB AD_resulthi,[RW44] stores sample.
- MAF channel hyp: **0x0A → 0x1454** (most frequent schedule slot; consumers do range/fault checks)

### Period → load candidate (T2)

- `0x5AEB` `DIVU RL48,0x14cc, TABLE[ZR]` → ST `0x1566`
- Foreground scales a quantity by 1/period (×0x9C40) into 0x1566 — candidate air-mass-per-stroke / load index (Bosch p.38). Not yet tied to XDF D5 filtered-load axis by CODE proof.

### Post-load interp (T3 mechanism)

- 0x20C7 → 0x33C2; ADD RW1A,RW6E; LD RW4C,[RW1A]
- Post-load interp indices 0xD0 / 0x30 are descriptor slots, not ROM page bytes. CAL target behind slot still unresolved in external image.

## Not claimed

- Shipping map promotion from Bosch PDF
- Absolute `LOOKUP[ZR]` ign/fuel reads (still 0)
- End-to-end HFM→ti→ign control

---
Research-only. Verification gates unchanged.
