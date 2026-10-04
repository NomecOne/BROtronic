# Ignition & fuel dataflow — XDF → DATA → CODE

ROM: `BMW DME413 SW623 D466.29 C16x900A 94 RedLabel.bin`
ISA: `mcs96_80c196_family`
CODE `0x2000`–`0xB930`; DATA from `0xB931`.
XDF (BRO) = primary definition evidence for names/equations.

## Coverage (this pass)

| Metric | Count | % of 69 |
|--------|------:|--------------------:|
| **Ghidra-proven CODE read** (full DATA addr in operand) | **0** | **0.0%** |
| Readish candidate (page LD/LDB or LE16 literal) | 50 | 72.46% |
| Any CODE page/literal hint (incl. CMP LOOKUP) | 69 | 100.0% |
| Literal LE16 near/in insn (still unproven) | 5 | 7.25% |
| Page LD/LDB only | 45 | 65.22% |
| Page CMP LOOKUP only | 19 | 27.54% |

Proven definition: ghidraProven = listing operand decodes full DATA address (>=0xB931) as immediate/base. Currently 0 — firmware uses page-indexed LOOKUP (high byte only).

Candidate definition: candidate_page_indexed = LD/LDB of high page byte via LOOKUP/TABLE; candidate_page_cmp_lookup = CMP/CMPB LOOKUP touch only (weaker); candidate_*_literal = LE16 of offset/page-base appears in CODE bytes.

## Access model (hypothesis)

**medium:** Calibration bytes in 0xD000–0xEFFF are read via LOOKUP/TABLE with an 8-bit page immediate (e.g. LDB R56,0xd0, LOOKUP[ZR]), then indexed with ZR/RW pointer math — not via absolute 16-bit DATA immediates.

Page-load site counts (0xD0–0xEF):

- `0xD0`: 20
- `0xD1`: 1
- `0xD2`: 1
- `0xD3`: 2
- `0xD4`: 1
- `0xD5`: 4
- `0xD6`: 2
- `0xD7`: 17
- `0xD8`: 2
- `0xD9`: 2
- `0xDA`: 1
- `0xDB`: 1
- `0xDC`: 2
- `0xDD`: 1
- `0xDE`: 1
- `0xDF`: 1
- `0xE0`: 1
- `0xE1`: 1
- `0xE2`: 1
- `0xE3`: 1
- `0xE5`: 1
- `0xE6`: 1
- `0xE7`: 1
- `0xE8`: 1
- `0xEB`: 1
- `0xEC`: 1
- `0xEE`: 1
- `0xEF`: 1

## Items by domain / role

Domains: `{'fuel': 31, 'ignition': 38}`
Roles: `{'scalar': 16, 'adjustment': 13, 'table': 20, 'axis': 20}`

| Off | Domain | Role | Status | Ev | Name |
|-----|--------|------|--------|----|------|
| `0xD030` | fuel | scalar | `candidate_page_indexed` | low | 0xD030[16bit] Inj. Constant(Ti) lb/h@3.5B/*DO NOT EDIT ALONE* |
| `0xD032` | fuel | scalar | `candidate_page_indexed` | low | 0xD032[16bit] RPM, Rev Limit, Soft Fuel Cut |
| `0xD06A` | fuel | scalar | `candidate_page_indexed` | low | 0xD06A[8bit] Fuel, Target AFR of Motronic system |
| `0xD093` | ignition | adjustment | `candidate_page_indexed` | low | 0xD093[8bit] Ign, Timing delta while in Speed Limiter fuel cut |
| `0xD0FA` | fuel | adjustment | `candidate_page_indexed` | low | 0xD0FA[8bit] Fuel, Trim, Individual Cylinder |
| `0xD23D` | ignition | scalar | `candidate_page_indexed` | low | 0xD23D[8bit] Air, MAF, RPM min threshold for MAF signal check |
| `0xD23E` | fuel | scalar | `candidate_page_indexed` | low | 0xD23E[16bit] Air, MAF, High Fault Limit kg/h |
| `0xD240` | fuel | scalar | `candidate_page_indexed` | low | 0xD240[16bit] Air, MAF, Low Fault Limit kg/h |
| `0xD244` | fuel | scalar | `candidate_page_indexed` | low | 0xD244[16bit] Air, MAF, MAF/RPM Ratio Limit |
| `0xD256` | ignition | scalar | `candidate_page_indexed` | low | 0xD256[8bit] Coolant Temp Sensor max signal@min volts RAW |
| `0xD257` | ignition | scalar | `candidate_page_indexed` | low | 0xD257[8bit] Coolant Temp Sensor min signal@max volts RAW |
| `0xD25A` | ignition | scalar | `candidate_page_indexed` | low | 0xD25A[8bit] Air, IAT max signal |
| `0xD25B` | ignition | scalar | `candidate_page_indexed` | low | 0xD25B[8bit] Air, IAT min signal |
| `0xD27B` | ignition | scalar | `candidate_page_indexed` | low | 0xD27B[8bit] Speed, RPM Threshold to activate speed signal check |
| `0xD27D` | ignition | scalar | `candidate_page_indexed` | low | 0xD27D[8bit] Speed, Counter? Threshold for speed signal check DT |
| `0xD27E` | ignition | scalar | `candidate_page_indexed` | low | 0xD27E[8bit] RPM, Rev Limit, IF no speed signal |
| `0xD281` | ignition | scalar | `candidate_page_indexed` | low | 0xD281[8bit] Ign., Spark Fault |
| `0xD288` | ignition | scalar | `candidate_page_indexed` | low | 0xD288 Knock Sensor DTC related |
| `0xD290` | fuel | table | `candidate_page_indexed` | low | 0xD290[Func/5V/256]MAF Cal. kg/h |
| `0xD5A6` | fuel | axis | `candidate_page_indexed` | low | 0xD5A6[D0/R6/A]Fuel, Cranking, Axis, RPM |
| `0xD5E6` | ignition | table | `candidate_page_indexed` | low | 0xD5E6[D0xD6/8x8] VANOS, PT, Dwell Retarded ? |
| `0xD63A` | ignition | table | `candidate_page_indexed` | low | 0xD63A[D0xD6/8x8] VANOS, PT, Dwell Advanced ? |
| `0xD67C` | ignition | axis | `candidate_page_indexed` | low | 0xD67C[D0/R16/A] VANOS, WOT, Dwell Retarded, Axis, RPM |
| `0xD69E` | ignition | axis | `candidate_page_indexed` | low | 0xD69E[D0/R16/A] VANOS, WOT, Dwell Advanced, Axis, RPM |
| `0xD6AE` | ignition | table | `candidate_page_indexed` | low | 0xD6AE[D0/16x1] VANOS, WOT, Dwell Advanced |
| `0xD6C6` | ignition | table | `candidate_page_indexed` | low | 0xD6C6[D7/6x1] VANOS, TMOT/ECT Engine temperature fak ?? |
| `0xD6E8` | ignition | axis | `candidate_page_indexed` | low | 0xD6E8[D0/R8/A] VANOS, Load MIN For Advance, Axis, RPM |
| `0xD6FA` | ignition | axis | `candidate_page_indexed` | low | 0xD6FA[D0/R8/A] VANOS, Load MAX For Retard, Axis, RPM |
| `0xD722` | ignition | table | `candidate_code_literal_near_insn` | medium | 0xD722[D0/8x1] VANOS, DK MIN For Override Retard ? |
| `0xD734` | ignition | table | `candidate_page_indexed` | low | 0xD734[D0/8x1] VANOS, DK MAX For NO Override Retard ?? |
| `0xD75E` | fuel | axis | `candidate_raw_literal` | low | 0xD75E[D8/R5/A]Fuel, Voltage, Axis, Voltage |
| `0xD815` | fuel | adjustment | `candidate_page_indexed` | low | 0xD815[D7/6x1] (suspect for warm up enrich?) |
| `0xD8B1` | ignition | table | `candidate_page_indexed` | low | 0xD8B1 D7xD4 Knock sensor sensitivity by Temp? |
| `0xD8EF` | fuel | adjustment | `candidate_code_literal_near_insn` | medium | 0xD8EF[D7/6x1]Fuel, Cold Engine Enrich (Manual / A/T in P/N) |
| `0xD8FD` | fuel | adjustment | `candidate_page_indexed` | low | 0xD8FD[D7/6x1] Fuel, Cold Engine Enrich (A/T in D/R) |
| `0xD91F` | fuel | adjustment | `candidate_page_indexed` | low | 0xD91F[D7/6x1] Fuel, Idle, Cold Lambda Correction |
| `0xD970` | fuel | table | `candidate_page_indexed` | low | 0xD970[D0xD5/6x3] Fuel, Idle, Base |
| `0xD984` | fuel | axis | `candidate_page_indexed` | low | 0xD984 RPM axis for Fuel, WOT, Vanos retarded |
| `0xD9A6` | fuel | axis | `candidate_page_indexed` | low | 0xD9A6 RPM axis for Fuel, WOT, Vanos advanced |
| `0xD9C8` | fuel | axis | `candidate_code_literal_near_insn` | medium | 0xD9C8 RPM axis for Fuel, PT, Vanos retarded |
| `0xD9DA` | fuel | axis | `candidate_page_indexed` | low | 0xD9DA Load axis for Fuel, PT, Vanos retarded |
| `0xDAA8` | fuel | axis | `candidate_page_cmp_lookup` | low | 0xDAA8 RPM axis for Fuel, PT, Vanos advanced |
| `0xDABA` | fuel | axis | `candidate_page_cmp_lookup` | low | 0xDABA Load axis for Fuel, PT, Vanos advanced |
| `0xDBC3` | fuel | table | `candidate_page_cmp_lookup` | low | 0xDBC3[D0xCC/6x7] Alpha-N to load translation, AKA MAF fault lim |
| `0xDC21` | fuel | adjustment | `candidate_page_indexed` | low | 0xDC21[D0xD5/4x4] Fuel, Accel Enrich, Lambda Correction |
| `0xDC37` | fuel | adjustment | `candidate_page_indexed` | low | 0xDC37[D7/4x1] Fuel, Accel Enrich, TMOT/ECT Lambda Correction |
| `0xDC47` | fuel | adjustment | `candidate_page_indexed` | low | 0xDC47[D0xD7/4x4] Fuel, Accel Enrich, Fade Out Rate |
| `0xDC63` | fuel | adjustment | `candidate_page_indexed` | low | 0xDC63[D0xD7/4x4] Fuel, Accel Enrich, Delta LOAD Attenuation |
| `0xDC79` | fuel | table | `candidate_page_indexed` | low | 0xDC79[D7/4x1] Fuel, Some kind table for overrun fuel cut? |
| `0xDCCF` | ignition | adjustment | `candidate_page_indexed` | low | 0xDCCF[/4x1] Ign., Idle, Cold Engine Timing Correction (Manual / |
| `0xDCD9` | ignition | adjustment | `candidate_page_indexed` | low | 0xDCD9[/4x1] Ign., Idle, Cold Engine Timing Correction (A/T in D |
| `0xDCF3` | ignition | table | `candidate_page_indexed` | low | 0XDCF3[/8x1] Ign., Idle, Timing (Manual / A/T in P/N) |
| `0xDD05` | ignition | table | `candidate_page_cmp_lookup` | low | 0xDD05[/8x1] Ign., Idle, Timing (A/T in D or R) |
| `0xDD0F` | ignition | axis | `candidate_page_cmp_lookup` | low | 0xDD0F RPM axis for Ignition, WOT, Vanos retarded |
| `0xDD21` | ignition | axis | `candidate_page_cmp_lookup` | low | 0xDD21 Load axis for Ignition, WOT, Vanos retarded |
| `0xDD89` | ignition | axis | `candidate_page_cmp_lookup` | low | 0xDD89 RPM axis for Ignition, WOT, Vanos advanced |
| `0xDD9B` | ignition | axis | `candidate_page_cmp_lookup` | low | 0xDD9B Load axis for Ignition, WOT, Vanos advanced |
| `0xDE6D` | ignition | axis | `candidate_page_cmp_lookup` | low | 0xDE6D RPM axis for Ignition, PT, Vanos retarded |
| `0xDE7F` | ignition | axis | `candidate_page_cmp_lookup` | low | 0xDE7F Load axis for Ignition, PT, Vanos retarded |
| `0xDF4D` | ignition | axis | `candidate_page_cmp_lookup` | low | 0xDF4D RPM axis for Ignition, PT, Vanos advanced |
| `0xDF5F` | ignition | axis | `candidate_page_cmp_lookup` | low | 0xDF5F Load axis for Ignition, PT, Vanos advanced |
| `0xE044` | ignition | table | `candidate_page_cmp_lookup` | low | 0xE044 D7xD3 3x4 knock related?likely not.. between vanos and Tr |
| `0xE065` | ignition | table | `candidate_page_cmp_lookup` | low | 0xE065 PT load map data to A/T OR WRONG AND POSSIBLY KNOCK RELAT |
| `0xE0B3` | ignition | table | `candidate_page_cmp_lookup` | low | 0xE0B3 WOT load map data to A/T OR WRONG AND POSSIBLY KNOCK RELA |
| `0xE0DA` | ignition | adjustment | `candidate_page_cmp_lookup` | low | 0xE0DA[D0xD8/17x7] Ign., Coil Voltage Correction (dwell) |
| `0xE364` | fuel | table | `candidate_page_cmp_lookup` | low | 0xE364[/6x1] Air, Lambda OFF 1 RPM* |
| `0xE372` | fuel | table | `candidate_page_cmp_lookup` | low | 0xE372[/6x1] Air, Lambda OFF 2 RPM* |
| `0xE37E` | fuel | table | `candidate_raw_literal` | low | 0xE37E[/4x1] Air, Lambda OFF 3 RPM* |
| `0xE388` | fuel | table | `candidate_page_cmp_lookup` | low | 0xE388[/4x1] Air, Lambda OFF 4 RPM* |

## Priority maps (control-relevant)

### Fueling

- `0xD030` **scalar** `candidate_page_indexed` — 0xD030[16bit] Inj. Constant(Ti) lb/h@3.5B|*DO NOT EDIT ALONE*
  - page `0xD0` CODE samples: `0x5331`, `0x539E`, `0x5553`
- `0xD032` **scalar** `candidate_page_indexed` — 0xD032[16bit] RPM, Rev Limit, Soft Fuel Cut
  - page `0xD0` CODE samples: `0x5331`, `0x539E`, `0x5553`
- `0xD06A` **scalar** `candidate_page_indexed` — 0xD06A[8bit] Fuel, Target AFR of Motronic system
  - page `0xD0` CODE samples: `0x5331`, `0x539E`, `0x5553`
- `0xD23E` **scalar** `candidate_page_indexed` — 0xD23E[16bit] Air, MAF, High Fault Limit kg/h
  - page `0xD2` CODE samples: `0x8E3C`
- `0xD240` **scalar** `candidate_page_indexed` — 0xD240[16bit] Air, MAF, Low Fault Limit kg/h
  - page `0xD2` CODE samples: `0x8E3C`
- `0xD244` **scalar** `candidate_page_indexed` — 0xD244[16bit] Air, MAF, MAF/RPM Ratio Limit
  - page `0xD2` CODE samples: `0x8E3C`
- `0xD290` **table** `candidate_page_indexed` — 0xD290[Func|5V|256]MAF Cal. kg/h
  - page `0xD2` CODE samples: `0x8E3C`
- `0xD8EF` **adjustment** `candidate_code_literal_near_insn` — 0xD8EF[D7|6x1]Fuel, Cold Engine Enrich (Manual | A/T in P|N)
  - page `0xD8` CODE samples: `0x9958`, `0xB3A1`
- `0xD970` **table** `candidate_page_indexed` — 0xD970[D0xD5|6x3] Fuel, Idle, Base
  - page `0xD9` CODE samples: `0x4B6C`, `0x69D4`
- `0xDBC3` **table** `candidate_page_cmp_lookup` — 0xDBC3[D0xCC|6x7] Alpha-N to load translation, AKA MAF fault limp mode
  - page `0xDB` CODE samples: `0xB87C`
- `0xDC21` **adjustment** `candidate_page_indexed` — 0xDC21[D0xD5|4x4] Fuel, Accel Enrich, Lambda Correction
  - page `0xDC` CODE samples: `0x9F98`

### Ignition timing

- `0xD093` **adjustment** `candidate_page_indexed` — 0xD093[8bit] Ign, Timing delta while in Speed Limiter fuel cut
  - page `0xD0` CODE samples: `0x5331`, `0x539E`, `0x5553`
- `0xDCF3` **table** `candidate_page_indexed` — 0XDCF3[|8x1] Ign., Idle, Timing (Manual | A/T in P|N)
  - page `0xDC` CODE samples: `0x9F98`
- `0xDD05` **table** `candidate_page_cmp_lookup` — 0xDD05[|8x1] Ign., Idle, Timing (A/T in D or R)
  - page `0xDD` CODE samples: `0x9F86`
- `0xDD21` **axis** `candidate_page_cmp_lookup` — 0xDD21 Load axis for Ignition, WOT, Vanos retarded
  - page `0xDD` CODE samples: `0x9F86`
- `0xDD9B` **axis** `candidate_page_cmp_lookup` — 0xDD9B Load axis for Ignition, WOT, Vanos advanced
  - page `0xDD` CODE samples: `0x9F86`
- `0xDE7F` **axis** `candidate_page_cmp_lookup` — 0xDE7F Load axis for Ignition, PT, Vanos retarded
  - page `0xDE` CODE samples: `0x9F7D`
- `0xDF5F` **axis** `candidate_page_cmp_lookup` — 0xDF5F Load axis for Ignition, PT, Vanos advanced
  - page `0xDF` CODE samples: `0x9F74`
- `0xE044` **table** `candidate_page_cmp_lookup` — 0xE044 D7xD3 3x4 knock related?likely not.. between vanos and Trans da
  - page `0xE0` CODE samples: `0x9F6D`
- `0xE065` **table** `candidate_page_cmp_lookup` — 0xE065 PT load map data to A/T OR WRONG AND POSSIBLY KNOCK RELATED
  - page `0xE0` CODE samples: `0x9F6D`
- `0xE0B3` **table** `candidate_page_cmp_lookup` — 0xE0B3 WOT load map data to A/T OR WRONG AND POSSIBLY KNOCK RELATED
  - page `0xE0` CODE samples: `0x9F6D`
- `0xE0DA` **adjustment** `candidate_page_cmp_lookup` — 0xE0DA[D0xD8|17x7] Ign., Coil Voltage Correction (dwell)
  - page `0xE0` CODE samples: `0x9F6D`

## CODE-local constants

No ignition/fuel conversion constants have been **proven** as CODE immediates tied to XDF formulas yet.
Watchdog immediates (`#0x1e` / `#-0x1f`) and HSI schedule deltas (`#0x1f4`, `#0xc8`, `#0x32`, `#0xfa`) are CODE-local but not yet mapped to XDF items.

## What is *not* claimed

- Complete spark/fuel output control path
- Proven per-map CODE xrefs (0 ghidraProven)
- Shipping definition updates

---
Research-only. Do not promote into definitions/packs/*.shipping.json.
