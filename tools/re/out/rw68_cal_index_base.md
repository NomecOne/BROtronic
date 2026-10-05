# RW68 CAL index base — cross_checked `0xD200`

ROM: `BMW DME413 SW623 D466.29 C16x900A 94 RedLabel.bin`

**Base register:** `RW68` = `0xD200`

**Proof:** Only base 0xD200 makes RW68+{0x3E,0x40,0x44,0x90} land simultaneously on MAF high/low/ratio/cal XDF items. No LD RW68,#imm in external image (0x0000–0x1FFF erased); base is cross_checked by geometry, not by immediate load.

Sites: **19** → unique ign/fuel XDF targets: **13**

| Target | # | Name | Example sites |
|--------|--:|------|---------------|
| `0xD23E` | 3 | 0xD23E[16bit] Air, MAF, High Fault Limit kg/h | `0x8B13`, `0x8C17`, `0x8C2E` |
| `0xD240` | 1 | 0xD240[16bit] Air, MAF, Low Fault Limit kg/h | `0x8BCC` |
| `0xD244` | 2 | 0xD244[16bit] Air, MAF, MAF/RPM Ratio Limit | `0x8CD3`, `0x8CE7` |
| `0xD256` | 3 | 0xD256[8bit] Coolant Temp Sensor max signal@min volts RAW | `0x498E`, `0x5162`, `0xAFAD` |
| `0xD257` | 1 | 0xD257[8bit] Coolant Temp Sensor min signal@max volts RAW | `0x5A6C` |
| `0xD25A` | 1 | 0xD25A[8bit] Air, IAT max signal | `0x5C73` |
| `0xD25B` | 1 | 0xD25B[8bit] Air, IAT min signal | `0x5CEF` |
| `0xD27B` | 1 | 0xD27B[8bit] Speed, RPM Threshold to activate speed signal check | `0x99BE` |
| `0xD27D` | 1 | 0xD27D[8bit] Speed, Counter? Threshold for speed signal check DTC 42 | `0x9974` |
| `0xD27E` | 2 | 0xD27E[8bit] RPM, Rev Limit, IF no speed signal | `0x9758`, `0x9B7C` |
| `0xD281` | 1 | 0xD281[8bit] Ign., Spark Fault | `0xB0AF` |
| `0xD288` | 1 | 0xD288 Knock Sensor DTC related | `0x660C` |
| `0xD290` | 1 | 0xD290[Func|5V|256]MAF Cal. kg/h | `0x68CD` |

## Constraint quartet (uniqueness)

| RW68+off | Target |
|----------|--------|
| `RW68+0x3E` | `0xD23E` |
| `RW68+0x40` | `0xD240` |
| `RW68+0x44` | `0xD244` |
| `RW68+0x90` | `0xD290` |

> Not absolute `LOOKUP[ZR]` proven. Do not promote shipping from this alone.
