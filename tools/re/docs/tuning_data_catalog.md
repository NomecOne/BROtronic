# Tuning data catalog — XDF ↔ CODE reads

ROM: `BMW DME413 SW623 D466.29 C16x900A 94 RedLabel.bin`
Addressing: FE14 CAL bases (`RW68=0xD002`, `RW6A=0xD106`, `RW6C=0xD28E`, `RW6E=0xE67E`)

> Research-only. **69/69** entries have CODE read references. Absolute coverage 69/69. Do **not** auto-promote shipping packs. Purpose text labels **PROVEN** vs **HYPOTHESIS**. Machine-readable twin: [`tuning_data_catalog.json`](tuning_data_catalog.json). Flowcharts: [`control_flowcharts.md`](control_flowcharts.md).

## Coverage

| Metric | Value |
|--------|------:|
| Catalog entries | **69** |
| With CODE refs | **69** |
| Absolute CODE→XDF | **69/69** |
| Reconciled XDF mislabels | **1** (0xD23D→0xD23C) |

## How to read an entry

- **CODE refs** come from `absolute_code_reads.json` (long-index / MAF / chained-base / descriptor selectSites).
- **Purpose** combines BRO XDF names/equations, Bosch M-Motronic TI family theory, and `engine_control_dataflow` proven paths — marked PROVEN or HYPOTHESIS.
- **verificationStatus** `absolute` = CODE→EA proven; `absolute_reconciled_xdf_mislabel` = coverage only, do not ship.

## Domain: `fuel` (27)

### `0xD030` — 0xD030[16bit] Inj. Constant(Ti) lb/h@3.5B\|*DO NOT EDIT ALONE*

| Field | Value |
|-------|-------|
| Size | 16 bit (1×1) |
| Formula / units | `(17.16/x) * 43478` |
| Methods | long_index_or_maf |
| Status | `absolute` / `high_absolute` |

**Purpose:** PROVEN: Injector constant Ti: LD/DIVU via RW68+0x2E; combines with load×period to form pulse words 0x153A/0x1540 before MMIO @0x440.

**CODE reads:**

- `0x9A82` — DIVU RL1C,0x2e, TABLE[RW68]
- `0xAFC7` — LD RW40,0x2e[RW68]

> Research-only; do not auto-promote shipping packs.

### `0xD032` — 0xD032[16bit] RPM, Rev Limit, Soft Fuel Cut

| Field | Value |
|-------|-------|
| Size | 16 bit (1×1) |
| Formula / units | `x * 0.25` |
| Methods | long_index_or_maf |
| Status | `absolute` / `high_absolute` |

**Purpose:** PROVEN: Soft fuel-cut RPM threshold: CMP vs RW68+0x30 gates fuel cut when RPM exceeds limit.

**CODE reads:**

- `0xADD5` — CMP RW40,0x30, TABLE[RW68]

> Research-only; do not auto-promote shipping packs.

### `0xD06A` — 0xD06A[8bit] Fuel, Target AFR of Motronic system

| Field | Value |
|-------|-------|
| Size | 8 bit (1×1) |
| Formula / units | `1/(x/128)*14.7` |
| Methods | long_index_or_maf |
| Status | `absolute` / `high_absolute` |

**Purpose:** HYPOTHESIS: Closed-loop / enrichment target stoichiometric scalar (BRO XDF); Bosch TI: λ=1 setpoint for mixture control.

**CODE reads:**

- `0x5D67` — LDB R1F,0x68, LOOKUP[RW68]

> Research-only; do not auto-promote shipping packs.

### `0xD0FA` — 0xD0FA[8bit] Fuel, Trim, Individual Cylinder

| Field | Value |
|-------|-------|
| Size | 8 bit (8×1) |
| Formula / units | `X` |
| Methods | long_index_or_maf |
| Status | `absolute` / `high_absolute` |

**Purpose:** PROVEN: Per-cylinder fuel trim bytes: chained LOOKUP from RW68+0xF8; adjusts injector pulse before bank schedule.

**CODE reads:**

- `0x5B6B` — LDB R21,0xf8, LOOKUP[RW1E] ; RW1E=RW68, then INC×6

> Research-only; do not auto-promote shipping packs.

### `0xD5A6` — 0xD5A6[D0\|R6\|A]Fuel, Cranking, Axis, RPM

| Field | Value |
|-------|-------|
| Size | 16 bit (6×1) |
| Formula / units | `X` |
| Methods | descriptor_header |
| Status | `absolute` / `high_absolute_descriptor` |

**Purpose:** HYPOTHESIS: Cranking fuel RPM axis or cranking enrichment (BRO XDF); Bosch TI: start enrichment vs RPM.

**CODE reads:**

- `0x834E` — descriptor select → 0x20C7/0x20CD → ADD RW1A,RW6E; LD RW4C,[RW1A] → [0xE682]=0xD5A4 / XDF 0xD5A6

> Research-only; do not auto-promote shipping packs.

### `0xD75E` — 0xD75E[D8\|R5\|A]Fuel, Voltage, Axis, Voltage

| Field | Value |
|-------|-------|
| Size | 16 bit (5×1) |
| Formula / units | `X` |
| Methods | descriptor_header |
| Status | `absolute` / `high_absolute_descriptor` |

**Purpose:** HYPOTHESIS: Battery-voltage axis for injector dead-time / voltage correction (BRO XDF).

**CODE reads:**

- `0x5B1E` — descriptor select → 0x20C7/0x20CD → ADD RW1A,RW6E; LD RW4C,[RW1A] → [0xE6A6]=0xD75C / XDF 0xD75E

> Research-only; do not auto-promote shipping packs.

### `0xD815` — 0xD815[D7\|6x1] (suspect for warm up enrich?)

| Field | Value |
|-------|-------|
| Size | 8 bit (6×1) |
| Formula / units | `X` |
| Methods | descriptor_header |
| Status | `absolute` / `high_absolute_descriptor` |

**Purpose:** HYPOTHESIS: Fuel calibration item (BRO XDF name); confirm loop role via selectSites/long-index.

**CODE reads:**

- `0x5E4D` — descriptor select → 0x20C7/0x20CD → ADD RW1A,RW6E; LD RW4C,[RW1A] → [0xE6B4]=0xD80D / XDF 0xD815

> Research-only; do not auto-promote shipping packs.

### `0xD8EF` — 0xD8EF[D7\|6x1]Fuel, Cold Engine Enrich (Manual \| A/T in P\|N)

| Field | Value |
|-------|-------|
| Size | 8 bit (6×1) |
| Formula / units | `X` |
| Methods | descriptor_header |
| Status | `absolute` / `high_absolute_descriptor` |

**Purpose:** HYPOTHESIS: Cold/warm-up fuel enrichment vs temp (BRO XDF); Bosch TI: after-start / warm-up enrichment.

**CODE reads:**

- `0x5EB2` — descriptor select → 0x20C7/0x20CD → ADD RW1A,RW6E; LD RW4C,[RW1A] → [0xE6C4]=0xD8E7 / XDF 0xD8EF

> Research-only; do not auto-promote shipping packs.

### `0xD8FD` — 0xD8FD[D7\|6x1] Fuel, Cold Engine Enrich (A/T in D\|R)

| Field | Value |
|-------|-------|
| Size | 8 bit (6×1) |
| Formula / units | `X` |
| Methods | descriptor_header |
| Status | `absolute` / `high_absolute_descriptor` |

**Purpose:** HYPOTHESIS: Cold/warm-up fuel enrichment vs temp (BRO XDF); Bosch TI: after-start / warm-up enrichment.

**CODE reads:**

- `0x5ED2` — descriptor select → 0x20C7/0x20CD → ADD RW1A,RW6E; LD RW4C,[RW1A] → [0xE6C6]=0xD8F5 / XDF 0xD8FD

> Research-only; do not auto-promote shipping packs.

### `0xD91F` — 0xD91F[D7\|6x1] Fuel, Idle, Cold Lambda Correction

| Field | Value |
|-------|-------|
| Size | 8 bit (1×6) |
| Formula / units | `X` |
| Methods | descriptor_header |
| Status | `absolute` / `high_absolute_descriptor` |

**Purpose:** HYPOTHESIS: Cold-engine lambda correction at idle (BRO XDF).

**CODE reads:**

- `0x5F01` — descriptor select → 0x20C7/0x20CD → ADD RW1A,RW6E; LD RW4C,[RW1A] → [0xE6CC]=0xD917 / XDF 0xD91F

> Research-only; do not auto-promote shipping packs.

### `0xD970` — 0xD970[D0xD5\|6x3] Fuel, Idle, Base

| Field | Value |
|-------|-------|
| Size | 16 bit (6×3) |
| Formula / units | `X` |
| Methods | descriptor_header |
| Status | `absolute` / `high_absolute_descriptor` |

**Purpose:** HYPOTHESIS: Fuel idle base map (BRO XDF); Bosch TI: idle mixture / Ti at idle.

**CODE reads:**

- `0x5F4A` — descriptor select → 0x20C7/0x20CD → ADD RW1A,RW6E; LD RW4C,[RW1A] → [0xE6DA]=0xD963 / XDF 0xD970

> Research-only; do not auto-promote shipping packs.

### `0xD984` — 0xD984 RPM axis for Fuel, WOT, Vanos retarded

| Field | Value |
|-------|-------|
| Size | 8 bit (16×1) |
| Formula / units | `X` |
| Methods | descriptor_header |
| Status | `absolute` / `high_absolute_descriptor` |

**Purpose:** HYPOTHESIS: Fuel map RPM axis (WOT/PT × VANOS ret/adv) — BRO XDF; descriptor → map interp.

**CODE reads:**

- `0x5F69` — descriptor select → 0x20C7/0x20CD → ADD RW1A,RW6E; LD RW4C,[RW1A] → [0xE6DC]=0xD982 / XDF 0xD984

> Research-only; do not auto-promote shipping packs.

### `0xD9A6` — 0xD9A6 RPM axis for Fuel, WOT, Vanos advanced

| Field | Value |
|-------|-------|
| Size | 8 bit (16×1) |
| Formula / units | `X` |
| Methods | descriptor_header |
| Status | `absolute` / `high_absolute_descriptor` |

**Purpose:** HYPOTHESIS: Fuel map RPM axis (WOT/PT × VANOS ret/adv) — BRO XDF; descriptor → map interp.

**CODE reads:**

- `0x5F73` — descriptor select → 0x20C7/0x20CD → ADD RW1A,RW6E; LD RW4C,[RW1A] → [0xE6DE]=0xD9A4 / XDF 0xD9A6
- `0x5F7C` — descriptor select → 0x20C7/0x20CD → ADD RW1A,RW6E; LD RW4C,[RW1A] → [0xE6DE]=0xD9A4 / XDF 0xD9A6

> Research-only; do not auto-promote shipping packs.

### `0xD9C8` — 0xD9C8 RPM axis for Fuel, PT, Vanos retarded

| Field | Value |
|-------|-------|
| Size | 8 bit (16×1) |
| Formula / units | `X` |
| Methods | descriptor_header |
| Status | `absolute` / `high_absolute_descriptor` |

**Purpose:** HYPOTHESIS: Fuel map RPM axis (WOT/PT × VANOS ret/adv) — BRO XDF; descriptor → map interp.

**CODE reads:**

- `0x5F83` — descriptor select → 0x20C7/0x20CD → ADD RW1A,RW6E; LD RW4C,[RW1A] → [0xE6E0]=0xD9C6 / XDF 0xD9C8

> Research-only; do not auto-promote shipping packs.

### `0xD9DA` — 0xD9DA Load axis for Fuel, PT, Vanos retarded

| Field | Value |
|-------|-------|
| Size | 8 bit (1×12) |
| Formula / units | `X` |
| Methods | descriptor_header, descriptor_map_member |
| Status | `absolute` / `high_absolute_descriptor` |

**Purpose:** HYPOTHESIS: Fuel/ign load axis (BRO XDF); typically injection-time scaled load.

**CODE reads:**

- `0x5F83` — descriptor select → 0x20C7/0x20CD → ADD RW1A,RW6E; LD RW4C,[RW1A] → [0xE6E0]=0xD9C6 / XDF 0xD9DA
- `0x5F83` — descriptor select → 0x20C7/0x20CD → [0xE6E0]=0xD9C6 / XDF 0xD9DA

> Research-only; do not auto-promote shipping packs.

### `0xDAA8` — 0xDAA8 RPM axis for Fuel, PT, Vanos advanced

| Field | Value |
|-------|-------|
| Size | 8 bit (16×1) |
| Formula / units | `X` |
| Methods | descriptor_header |
| Status | `absolute` / `high_absolute_descriptor` |

**Purpose:** HYPOTHESIS: Fuel map RPM axis (WOT/PT × VANOS ret/adv) — BRO XDF; descriptor → map interp.

**CODE reads:**

- `0x5F8D` — descriptor select → 0x20C7/0x20CD → ADD RW1A,RW6E; LD RW4C,[RW1A] → [0xE6E2]=0xDAA6 / XDF 0xDAA8
- `0x5F96` — descriptor select → 0x20C7/0x20CD → ADD RW1A,RW6E; LD RW4C,[RW1A] → [0xE6E2]=0xDAA6 / XDF 0xDAA8

> Research-only; do not auto-promote shipping packs.

### `0xDABA` — 0xDABA Load axis for Fuel, PT, Vanos advanced

| Field | Value |
|-------|-------|
| Size | 8 bit (1×12) |
| Formula / units | `X` |
| Methods | descriptor_header, descriptor_map_member |
| Status | `absolute` / `high_absolute_descriptor` |

**Purpose:** HYPOTHESIS: Fuel/ign load axis (BRO XDF); typically injection-time scaled load.

**CODE reads:**

- `0x5F8D` — descriptor select → 0x20C7/0x20CD → ADD RW1A,RW6E; LD RW4C,[RW1A] → [0xE6E2]=0xDAA6 / XDF 0xDABA
- `0x5F96` — descriptor select → 0x20C7/0x20CD → ADD RW1A,RW6E; LD RW4C,[RW1A] → [0xE6E2]=0xDAA6 / XDF 0xDABA
- `0x5F8D` — descriptor select → 0x20C7/0x20CD → [0xE6E2]=0xDAA6 / XDF 0xDABA
- `0x5F96` — descriptor select → 0x20C7/0x20CD → [0xE6E2]=0xDAA6 / XDF 0xDABA

> Research-only; do not auto-promote shipping packs.

### `0xDBC3` — 0xDBC3[D0xCC\|6x7] Alpha-N to load translation, AKA MAF fault limp mode

| Field | Value |
|-------|-------|
| Size | 8 bit (6×7) |
| Formula / units | `X` |
| Methods | descriptor_header |
| Status | `absolute` / `high_absolute_descriptor` |

**Purpose:** HYPOTHESIS: MAF sensor plausibility / fault gate (BRO XDF + RW6A limit block).

**CODE reads:**

- `0x9A4A` — descriptor select → 0x20C7/0x20CD → ADD RW1A,RW6E; LD RW4C,[RW1A] → [0xE6EE]=0xDBB2 / XDF 0xDBC3

> Research-only; do not auto-promote shipping packs.

### `0xDC21` — 0xDC21[D0xD5\|4x4] Fuel, Accel Enrich, Lambda Correction

| Field | Value |
|-------|-------|
| Size | 8 bit (4×4) |
| Formula / units | `X` |
| Methods | descriptor_header |
| Status | `absolute` / `high_absolute_descriptor` |

**Purpose:** HYPOTHESIS: Transient fuel (accel enrich / fade / overrun-related) stack (BRO XDF); Bosch TI: acceleration enrichment.

**CODE reads:**

- `0x5BE8` — descriptor select → 0x20C7/0x20CD → ADD RW1A,RW6E; LD RW4C,[RW1A] → [0xE6F4]=0xDC15 / XDF 0xDC21

> Research-only; do not auto-promote shipping packs.

### `0xDC37` — 0xDC37[D7\|4x1] Fuel, Accel Enrich, TMOT/ECT Lambda Correction

| Field | Value |
|-------|-------|
| Size | 8 bit (4×1) |
| Formula / units | `X` |
| Methods | descriptor_header |
| Status | `absolute` / `high_absolute_descriptor` |

**Purpose:** HYPOTHESIS: Temperature sensor bound or temp-dependent correction (BRO XDF Sensors).

**CODE reads:**

- `0x5BF2` — descriptor select → 0x20C7/0x20CD → ADD RW1A,RW6E; LD RW4C,[RW1A] → [0xE6F6]=0xDC31 / XDF 0xDC37

> Research-only; do not auto-promote shipping packs.

### `0xDC47` — 0xDC47[D0xD7\|4x4] Fuel, Accel Enrich, Fade Out Rate

| Field | Value |
|-------|-------|
| Size | 8 bit (4×4) |
| Formula / units | `X` |
| Methods | descriptor_header |
| Status | `absolute` / `high_absolute_descriptor` |

**Purpose:** HYPOTHESIS: Transient fuel (accel enrich / fade / overrun-related) stack (BRO XDF); Bosch TI: acceleration enrichment.

**CODE reads:**

- `0x5C0B` — descriptor select → 0x20C7/0x20CD → ADD RW1A,RW6E; LD RW4C,[RW1A] → [0xE6F8]=0xDC3B / XDF 0xDC47

> Research-only; do not auto-promote shipping packs.

### `0xDC63` — 0xDC63[D0xD7\|4x4] Fuel, Accel Enrich, Delta LOAD Attenuation

| Field | Value |
|-------|-------|
| Size | 8 bit (4×4) |
| Formula / units | `X` |
| Methods | descriptor_header |
| Status | `absolute` / `high_absolute_descriptor` |

**Purpose:** HYPOTHESIS: Transient fuel (accel enrich / fade / overrun-related) stack (BRO XDF); Bosch TI: acceleration enrichment.

**CODE reads:**

- `0x5C17` — descriptor select → 0x20C7/0x20CD → ADD RW1A,RW6E; LD RW4C,[RW1A] → [0xE6FA]=0xDC57 / XDF 0xDC63

> Research-only; do not auto-promote shipping packs.

### `0xDC79` — 0xDC79[D7\|4x1] Fuel, Some kind table for overrun fuel cut?

| Field | Value |
|-------|-------|
| Size | 8 bit (4×1) |
| Formula / units | `X` |
| Methods | descriptor_header |
| Status | `absolute` / `high_absolute_descriptor` |

**Purpose:** HYPOTHESIS: Transient fuel (accel enrich / fade / overrun-related) stack (BRO XDF); Bosch TI: acceleration enrichment.

**CODE reads:**

- `0x65C9` — descriptor select → 0x20C7/0x20CD → ADD RW1A,RW6E; LD RW4C,[RW1A] → [0xE6FC]=0xDC73 / XDF 0xDC79

> Research-only; do not auto-promote shipping packs.

### `0xE364` — 0xE364[\|6x1] Air, Lambda OFF 1 RPM*

| Field | Value |
|-------|-------|
| Size | 8 bit (6×1) |
| Formula / units | `X` |
| Methods | descriptor_header |
| Status | `absolute` / `high_absolute_descriptor` |

**Purpose:** HYPOTHESIS: RPM tables for open-loop (λ control off) regions (BRO XDF).

**CODE reads:**

- `0x6106` — descriptor select → 0x20C7/0x20CD → ADD RW1A,RW6E; LD RW4C,[RW1A] → [0xE74C]=0xE35C / XDF 0xE364

> Research-only; do not auto-promote shipping packs.

### `0xE372` — 0xE372[\|6x1] Air, Lambda OFF 2 RPM*

| Field | Value |
|-------|-------|
| Size | 8 bit (6×1) |
| Formula / units | `X` |
| Methods | descriptor_header |
| Status | `absolute` / `high_absolute_descriptor` |

**Purpose:** HYPOTHESIS: RPM tables for open-loop (λ control off) regions (BRO XDF).

**CODE reads:**

- `0x5B02` — descriptor select → 0x20C7/0x20CD → ADD RW1A,RW6E; LD RW4C,[RW1A] → [0xE74E]=0xE36A / XDF 0xE372

> Research-only; do not auto-promote shipping packs.

### `0xE37E` — 0xE37E[\|4x1] Air, Lambda OFF 3 RPM*

| Field | Value |
|-------|-------|
| Size | 8 bit (4×1) |
| Formula / units | `X` |
| Methods | descriptor_header |
| Status | `absolute` / `high_absolute_descriptor` |

**Purpose:** HYPOTHESIS: RPM tables for open-loop (λ control off) regions (BRO XDF).

**CODE reads:**

- `0x6112` — descriptor select → 0x20C7/0x20CD → ADD RW1A,RW6E; LD RW4C,[RW1A] → [0xE750]=0xE378 / XDF 0xE37E

> Research-only; do not auto-promote shipping packs.

### `0xE388` — 0xE388[\|4x1] Air, Lambda OFF 4 RPM*

| Field | Value |
|-------|-------|
| Size | 8 bit (4×1) |
| Formula / units | `X` |
| Methods | descriptor_header |
| Status | `absolute` / `high_absolute_descriptor` |

**Purpose:** HYPOTHESIS: RPM tables for open-loop (λ control off) regions (BRO XDF).

**CODE reads:**

- `0x565F` — descriptor select → 0x20C7/0x20CD → ADD RW1A,RW6E; LD RW4C,[RW1A] → [0xE752]=0xE382 / XDF 0xE388

> Research-only; do not auto-promote shipping packs.

## Domain: `ignition` (26)

### `0xD093` — 0xD093[8bit] Ign, Timing delta while in Speed Limiter fuel cut

| Field | Value |
|-------|-------|
| Size | 8 bit (1×1) |
| Formula / units | `(x - 60) * 0.75` |
| Methods | long_index_or_maf |
| Status | `absolute` / `high_absolute` |

**Purpose:** HYPOTHESIS: Ignition retard/advance delta while speed-limiter fuel cut is active (BRO XDF).

**CODE reads:**

- `0x68DF` — LDB R1F,0x91, LOOKUP[RW68]
- `0x9322` — LDB R1D,0x91, LOOKUP[RW68]

> Research-only; do not auto-promote shipping packs.

### `0xD5E6` — 0xD5E6[D0xD6\|8x8] VANOS, PT, Dwell Retarded ?

| Field | Value |
|-------|-------|
| Size | 8 bit (8×8) |
| Formula / units | `X` |
| Methods | descriptor_header |
| Status | `absolute` / `high_absolute_descriptor` |

**Purpose:** HYPOTHESIS: Coil dwell (charge time) map/axis — VANOS PT/WOT variants (BRO XDF); feeds dwell before spark HSO.0.

**CODE reads:**

- `0x8374` — descriptor select → 0x20C7/0x20CD → ADD RW1A,RW6E; LD RW4C,[RW1A] → [0xE686]=0xD5D2 / XDF 0xD5E6

> Research-only; do not auto-promote shipping packs.

### `0xD63A` — 0xD63A[D0xD6\|8x8] VANOS, PT, Dwell Advanced ?

| Field | Value |
|-------|-------|
| Size | 8 bit (8×8) |
| Formula / units | `X` |
| Methods | descriptor_header |
| Status | `absolute` / `high_absolute_descriptor` |

**Purpose:** HYPOTHESIS: Coil dwell (charge time) map/axis — VANOS PT/WOT variants (BRO XDF); feeds dwell before spark HSO.0.

**CODE reads:**

- `0x837E` — descriptor select → 0x20C7/0x20CD → ADD RW1A,RW6E; LD RW4C,[RW1A] → [0xE688]=0xD626 / XDF 0xD63A
- `0x8387` — descriptor select → 0x20C7/0x20CD → ADD RW1A,RW6E; LD RW4C,[RW1A] → [0xE688]=0xD626 / XDF 0xD63A

> Research-only; do not auto-promote shipping packs.

### `0xD67C` — 0xD67C[D0\|R16\|A] VANOS, WOT, Dwell Retarded, Axis, RPM

| Field | Value |
|-------|-------|
| Size | 8 bit (16×1) |
| Formula / units | `X` |
| Methods | descriptor_header |
| Status | `absolute` / `high_absolute_descriptor` |

**Purpose:** HYPOTHESIS: Coil dwell (charge time) map/axis — VANOS PT/WOT variants (BRO XDF); feeds dwell before spark HSO.0.

**CODE reads:**

- `0x835A` — descriptor select → 0x20C7/0x20CD → ADD RW1A,RW6E; LD RW4C,[RW1A] → [0xE68A]=0xD67A / XDF 0xD67C

> Research-only; do not auto-promote shipping packs.

### `0xD69E` — 0xD69E[D0\|R16\|A] VANOS, WOT, Dwell Advanced, Axis, RPM

| Field | Value |
|-------|-------|
| Size | 8 bit (16×1) |
| Formula / units | `X` |
| Methods | descriptor_header |
| Status | `absolute` / `high_absolute_descriptor` |

**Purpose:** HYPOTHESIS: Coil dwell (charge time) map/axis — VANOS PT/WOT variants (BRO XDF); feeds dwell before spark HSO.0.

**CODE reads:**

- `0x8364` — descriptor select → 0x20C7/0x20CD → ADD RW1A,RW6E; LD RW4C,[RW1A] → [0xE68C]=0xD69C / XDF 0xD69E
- `0x836D` — descriptor select → 0x20C7/0x20CD → ADD RW1A,RW6E; LD RW4C,[RW1A] → [0xE68C]=0xD69C / XDF 0xD69E

> Research-only; do not auto-promote shipping packs.

### `0xD6AE` — 0xD6AE[D0\|16x1] VANOS, WOT, Dwell Advanced

| Field | Value |
|-------|-------|
| Size | 16 bit (16×1) |
| Formula / units | `X` |
| Methods | descriptor_header, descriptor_map_member |
| Status | `absolute` / `high_absolute_descriptor` |

**Purpose:** HYPOTHESIS: Coil dwell (charge time) map/axis — VANOS PT/WOT variants (BRO XDF); feeds dwell before spark HSO.0.

**CODE reads:**

- `0x8364` — descriptor select → 0x20C7/0x20CD → ADD RW1A,RW6E; LD RW4C,[RW1A] → [0xE68C]=0xD69C / XDF 0xD6AE
- `0x836D` — descriptor select → 0x20C7/0x20CD → ADD RW1A,RW6E; LD RW4C,[RW1A] → [0xE68C]=0xD69C / XDF 0xD6AE
- `0x8364` — descriptor select → 0x20C7/0x20CD → [0xE68C]=0xD69C / XDF 0xD6AE
- `0x836D` — descriptor select → 0x20C7/0x20CD → [0xE68C]=0xD69C / XDF 0xD6AE

> Research-only; do not auto-promote shipping packs.

### `0xD6C6` — 0xD6C6[D7\|6x1] VANOS, TMOT/ECT Engine temperature fak ??

| Field | Value |
|-------|-------|
| Size | 8 bit (6×1) |
| Formula / units | `X` |
| Methods | descriptor_header |
| Status | `absolute` / `high_absolute_descriptor` |

**Purpose:** HYPOTHESIS: Temperature sensor bound or temp-dependent correction (BRO XDF Sensors).

**CODE reads:**

- `0x83A5` — descriptor select → 0x20C7/0x20CD → ADD RW1A,RW6E; LD RW4C,[RW1A] → [0xE68E]=0xD6BE / XDF 0xD6C6

> Research-only; do not auto-promote shipping packs.

### `0xD6E8` — 0xD6E8[D0\|R8\|A] VANOS, Load MIN For Advance, Axis, RPM

| Field | Value |
|-------|-------|
| Size | 8 bit (8×1) |
| Formula / units | `X` |
| Methods | descriptor_header |
| Status | `absolute` / `high_absolute_descriptor` |

**Purpose:** HYPOTHESIS: RPM axis for VANOS-gated table (BRO XDF).

**CODE reads:**

- `0x58D2` — descriptor select → 0x20C7/0x20CD → ADD RW1A,RW6E; LD RW4C,[RW1A] → [0xE696]=0xD6E6 / XDF 0xD6E8

> Research-only; do not auto-promote shipping packs.

### `0xD6FA` — 0xD6FA[D0\|R8\|A] VANOS, Load MAX For Retard, Axis, RPM

| Field | Value |
|-------|-------|
| Size | 8 bit (8×1) |
| Formula / units | `X` |
| Methods | descriptor_header |
| Status | `absolute` / `high_absolute_descriptor` |

**Purpose:** HYPOTHESIS: RPM axis for VANOS-gated table (BRO XDF).

**CODE reads:**

- `0x590E` — descriptor select → 0x20C7/0x20CD → ADD RW1A,RW6E; LD RW4C,[RW1A] → [0xE698]=0xD6F8 / XDF 0xD6FA

> Research-only; do not auto-promote shipping packs.

### `0xD722` — 0xD722[D0\|8x1] VANOS, DK MIN For Override Retard ?

| Field | Value |
|-------|-------|
| Size | 8 bit (8×1) |
| Formula / units | `X` |
| Methods | descriptor_header |
| Status | `absolute` / `high_absolute_descriptor` |

**Purpose:** HYPOTHESIS: RPM axis for VANOS-gated table (BRO XDF).

**CODE reads:**

- `0x5924` — descriptor select → 0x20C7/0x20CD → ADD RW1A,RW6E; LD RW4C,[RW1A] → [0xE69C]=0xD718 / XDF 0xD722

> Research-only; do not auto-promote shipping packs.

### `0xD734` — 0xD734[D0\|8x1] VANOS, DK MAX For NO Override Retard ??

| Field | Value |
|-------|-------|
| Size | 8 bit (8×1) |
| Formula / units | `X` |
| Methods | descriptor_header |
| Status | `absolute` / `high_absolute_descriptor` |

**Purpose:** HYPOTHESIS: RPM axis for VANOS-gated table (BRO XDF).

**CODE reads:**

- `0x58F4` — descriptor select → 0x20C7/0x20CD → ADD RW1A,RW6E; LD RW4C,[RW1A] → [0xE69E]=0xD72A / XDF 0xD734

> Research-only; do not auto-promote shipping packs.

### `0xDCCF` — 0xDCCF[\|4x1] Ign., Idle, Cold Engine Timing Correction (Manual \| A/T in P or N)

| Field | Value |
|-------|-------|
| Size | 8 bit (1×4) |
| Formula / units | `X` |
| Methods | descriptor_header |
| Status | `absolute` / `high_absolute_descriptor` |

**Purpose:** HYPOTHESIS: Idle spark timing table Manual/A/T or cold-idle correction (BRO XDF).

**CODE reads:**

- `0x685B` — descriptor select → 0x20C7/0x20CD → ADD RW1A,RW6E; LD RW4C,[RW1A] → [0xE70E]=0xDCC9 / XDF 0xDCCF

> Research-only; do not auto-promote shipping packs.

### `0xDCD9` — 0xDCD9[\|4x1] Ign., Idle, Cold Engine Timing Correction (A/T in D or R)

| Field | Value |
|-------|-------|
| Size | 16 bit (1×4) |
| Formula / units | `X` |
| Methods | descriptor_header |
| Status | `absolute` / `high_absolute_descriptor` |

**Purpose:** HYPOTHESIS: Idle spark timing table Manual/A/T or cold-idle correction (BRO XDF).

**CODE reads:**

- `0x6864` — descriptor select → 0x20C7/0x20CD → ADD RW1A,RW6E; LD RW4C,[RW1A] → [0xE710]=0xDCD3 / XDF 0xDCD9

> Research-only; do not auto-promote shipping packs.

### `0xDCF3` — 0XDCF3[\|8x1] Ign., Idle, Timing (Manual \| A/T in P\|N)

| Field | Value |
|-------|-------|
| Size | 8 bit (1×8) |
| Formula / units | `X` |
| Methods | descriptor_header |
| Status | `absolute` / `high_absolute_descriptor` |

**Purpose:** HYPOTHESIS: Idle spark timing table Manual/A/T or cold-idle correction (BRO XDF).

**CODE reads:**

- `0x66C5` — descriptor select → 0x20C7/0x20CD → ADD RW1A,RW6E; LD RW4C,[RW1A] → [0xE714]=0xDCE9 / XDF 0xDCF3

> Research-only; do not auto-promote shipping packs.

### `0xDD05` — 0xDD05[\|8x1] Ign., Idle, Timing (A/T in D or R)

| Field | Value |
|-------|-------|
| Size | 8 bit (1×8) |
| Formula / units | `X` |
| Methods | descriptor_header |
| Status | `absolute` / `high_absolute_descriptor` |

**Purpose:** HYPOTHESIS: Idle spark timing table Manual/A/T or cold-idle correction (BRO XDF).

**CODE reads:**

- `0x66CC` — descriptor select → 0x20C7/0x20CD → ADD RW1A,RW6E; LD RW4C,[RW1A] → [0xE716]=0xDCFB / XDF 0xDD05

> Research-only; do not auto-promote shipping packs.

### `0xDD0F` — 0xDD0F RPM axis for Ignition, WOT, Vanos retarded

| Field | Value |
|-------|-------|
| Size | 8 bit (16×1) |
| Formula / units | `X` |
| Methods | descriptor_header |
| Status | `absolute` / `high_absolute_descriptor` |

**Purpose:** PROVEN: Ign WOT VANOS-retarded RPM axis: descriptor index 0x9A → interp 0x20CD → advance path toward RAM 0x1502 → HSO.0 #0x70. HYPOTHESIS: Ignition map RPM axis (WOT/PT × VANOS ret/adv) — BRO XDF; selectSites → shared interp 0x20C7/0x20CD.

**CODE reads:**

- `0x66EC` — descriptor select → 0x20C7/0x20CD → ADD RW1A,RW6E; LD RW4C,[RW1A] → [0xE718]=0xDD0D / XDF 0xDD0F

> Research-only; do not auto-promote shipping packs.

### `0xDD21` — 0xDD21 Load axis for Ignition, WOT, Vanos retarded

| Field | Value |
|-------|-------|
| Size | 8 bit (1×6) |
| Formula / units | `X` |
| Methods | descriptor_header, descriptor_map_member |
| Status | `absolute` / `high_absolute_descriptor` |

**Purpose:** HYPOTHESIS: Ignition map load axis (BRO XDF); load from MAF-derived Ti proxy.

**CODE reads:**

- `0x66EC` — descriptor select → 0x20C7/0x20CD → ADD RW1A,RW6E; LD RW4C,[RW1A] → [0xE718]=0xDD0D / XDF 0xDD21
- `0x66EC` — descriptor select → 0x20C7/0x20CD → [0xE718]=0xDD0D / XDF 0xDD21

> Research-only; do not auto-promote shipping packs.

### `0xDD89` — 0xDD89 RPM axis for Ignition, WOT, Vanos advanced

| Field | Value |
|-------|-------|
| Size | 8 bit (16×1) |
| Formula / units | `X` |
| Methods | descriptor_header |
| Status | `absolute` / `high_absolute_descriptor` |

**Purpose:** HYPOTHESIS: Ignition map RPM axis (WOT/PT × VANOS ret/adv) — BRO XDF; selectSites → shared interp 0x20C7/0x20CD.

**CODE reads:**

- `0x66F6` — descriptor select → 0x20C7/0x20CD → ADD RW1A,RW6E; LD RW4C,[RW1A] → [0xE71A]=0xDD87 / XDF 0xDD89
- `0x66FF` — descriptor select → 0x20C7/0x20CD → ADD RW1A,RW6E; LD RW4C,[RW1A] → [0xE71A]=0xDD87 / XDF 0xDD89

> Research-only; do not auto-promote shipping packs.

### `0xDD9B` — 0xDD9B Load axis for Ignition, WOT, Vanos advanced

| Field | Value |
|-------|-------|
| Size | 8 bit (1×6) |
| Formula / units | `X` |
| Methods | descriptor_header, descriptor_map_member |
| Status | `absolute` / `high_absolute_descriptor` |

**Purpose:** HYPOTHESIS: Ignition map load axis (BRO XDF); load from MAF-derived Ti proxy.

**CODE reads:**

- `0x66F6` — descriptor select → 0x20C7/0x20CD → ADD RW1A,RW6E; LD RW4C,[RW1A] → [0xE71A]=0xDD87 / XDF 0xDD9B
- `0x66FF` — descriptor select → 0x20C7/0x20CD → ADD RW1A,RW6E; LD RW4C,[RW1A] → [0xE71A]=0xDD87 / XDF 0xDD9B
- `0x66F6` — descriptor select → 0x20C7/0x20CD → [0xE71A]=0xDD87 / XDF 0xDD9B
- `0x66FF` — descriptor select → 0x20C7/0x20CD → [0xE71A]=0xDD87 / XDF 0xDD9B

> Research-only; do not auto-promote shipping packs.

### `0xDE6D` — 0xDE6D RPM axis for Ignition, PT, Vanos retarded

| Field | Value |
|-------|-------|
| Size | 8 bit (16×1) |
| Formula / units | `X` |
| Methods | descriptor_header |
| Status | `absolute` / `high_absolute_descriptor` |

**Purpose:** HYPOTHESIS: Ignition map RPM axis (WOT/PT × VANOS ret/adv) — BRO XDF; selectSites → shared interp 0x20C7/0x20CD.

**CODE reads:**

- `0x6706` — descriptor select → 0x20C7/0x20CD → ADD RW1A,RW6E; LD RW4C,[RW1A] → [0xE726]=0xDE6B / XDF 0xDE6D

> Research-only; do not auto-promote shipping packs.

### `0xDE7F` — 0xDE7F Load axis for Ignition, PT, Vanos retarded

| Field | Value |
|-------|-------|
| Size | 8 bit (1×12) |
| Formula / units | `X` |
| Methods | descriptor_header, descriptor_map_member |
| Status | `absolute` / `high_absolute_descriptor` |

**Purpose:** HYPOTHESIS: Ignition map load axis (BRO XDF); load from MAF-derived Ti proxy.

**CODE reads:**

- `0x6706` — descriptor select → 0x20C7/0x20CD → ADD RW1A,RW6E; LD RW4C,[RW1A] → [0xE726]=0xDE6B / XDF 0xDE7F
- `0x6706` — descriptor select → 0x20C7/0x20CD → [0xE726]=0xDE6B / XDF 0xDE7F

> Research-only; do not auto-promote shipping packs.

### `0xDF4D` — 0xDF4D RPM axis for Ignition, PT, Vanos advanced

| Field | Value |
|-------|-------|
| Size | 8 bit (16×1) |
| Formula / units | `X` |
| Methods | descriptor_header |
| Status | `absolute` / `high_absolute_descriptor` |

**Purpose:** HYPOTHESIS: Ignition map RPM axis (WOT/PT × VANOS ret/adv) — BRO XDF; selectSites → shared interp 0x20C7/0x20CD.

**CODE reads:**

- `0x6710` — descriptor select → 0x20C7/0x20CD → ADD RW1A,RW6E; LD RW4C,[RW1A] → [0xE728]=0xDF4B / XDF 0xDF4D
- `0x6719` — descriptor select → 0x20C7/0x20CD → ADD RW1A,RW6E; LD RW4C,[RW1A] → [0xE728]=0xDF4B / XDF 0xDF4D

> Research-only; do not auto-promote shipping packs.

### `0xDF5F` — 0xDF5F Load axis for Ignition, PT, Vanos advanced

| Field | Value |
|-------|-------|
| Size | 8 bit (1×12) |
| Formula / units | `X` |
| Methods | descriptor_header, descriptor_map_member |
| Status | `absolute` / `high_absolute_descriptor` |

**Purpose:** HYPOTHESIS: Ignition map load axis (BRO XDF); load from MAF-derived Ti proxy.

**CODE reads:**

- `0x6710` — descriptor select → 0x20C7/0x20CD → ADD RW1A,RW6E; LD RW4C,[RW1A] → [0xE728]=0xDF4B / XDF 0xDF5F
- `0x6719` — descriptor select → 0x20C7/0x20CD → ADD RW1A,RW6E; LD RW4C,[RW1A] → [0xE728]=0xDF4B / XDF 0xDF5F
- `0x6710` — descriptor select → 0x20C7/0x20CD → [0xE728]=0xDF4B / XDF 0xDF5F
- `0x6719` — descriptor select → 0x20C7/0x20CD → [0xE728]=0xDF4B / XDF 0xDF5F

> Research-only; do not auto-promote shipping packs.

### `0xE065` — 0xE065 PT load map data to A/T OR WRONG AND POSSIBLY KNOCK RELATED

| Field | Value |
|-------|-------|
| Size | 8 bit (12×5) |
| Formula / units | `X` |
| Methods | descriptor_header |
| Status | `absolute` / `high_absolute_descriptor` |

**Purpose:** HYPOTHESIS: Knock / spark-fault diagnostic scalar or sensitivity table (BRO XDF Knock).

**CODE reads:**

- `0x6C5D` — descriptor select → 0x20C7/0x20CD → ADD RW1A,RW6E; LD RW4C,[RW1A] → [0xE72E]=0xE050 / XDF 0xE065

> Research-only; do not auto-promote shipping packs.

### `0xE0B3` — 0xE0B3 WOT load map data to A/T OR WRONG AND POSSIBLY KNOCK RELATED

| Field | Value |
|-------|-------|
| Size | 16 bit (16×1) |
| Formula / units | `X` |
| Methods | descriptor_header |
| Status | `absolute` / `high_absolute_descriptor` |

**Purpose:** HYPOTHESIS: Knock / spark-fault diagnostic scalar or sensitivity table (BRO XDF Knock).

**CODE reads:**

- `0x6C54` — descriptor select → 0x20C7/0x20CD → ADD RW1A,RW6E; LD RW4C,[RW1A] → [0xE730]=0xE0A1 / XDF 0xE0B3

> Research-only; do not auto-promote shipping packs.

### `0xE0DA` — 0xE0DA[D0xD8\|17x7] Ign., Coil Voltage Correction (dwell)

| Field | Value |
|-------|-------|
| Size | 16 bit (12×7) |
| Formula / units | `X` |
| Methods | descriptor_header |
| Status | `absolute` / `high_absolute_descriptor` |

**Purpose:** HYPOTHESIS: Coil dwell (charge time) map/axis — VANOS PT/WOT variants (BRO XDF); feeds dwell before spark HSO.0.

**CODE reads:**

- `0x692A` — descriptor select → 0x20C7/0x20CD → ADD RW1A,RW6E; LD RW4C,[RW1A] → [0xE732]=0xE0C3 / XDF 0xE0DA

> Research-only; do not auto-promote shipping packs.

## Domain: `knock` (2)

### `0xD8B1` — 0xD8B1 D7xD4 Knock sensor sensitivity by Temp?

| Field | Value |
|-------|-------|
| Size | 8 bit (6×6) |
| Formula / units | `X` |
| Methods | descriptor_header |
| Status | `absolute` / `high_absolute_descriptor` |

**Purpose:** HYPOTHESIS: Temperature sensor bound or temp-dependent correction (BRO XDF Sensors).

**CODE reads:**

- `0x5E93` — descriptor select → 0x20C7/0x20CD → ADD RW1A,RW6E; LD RW4C,[RW1A] → [0xE6C0]=0xD8A1 / XDF 0xD8B1

> Research-only; do not auto-promote shipping packs.

### `0xE044` — 0xE044 D7xD3 3x4 knock related?likely not.. between vanos and Trans data

| Field | Value |
|-------|-------|
| Size | 8 bit (3×4) |
| Formula / units | `X` |
| Methods | descriptor_header |
| Status | `absolute` / `high_absolute_descriptor` |

**Purpose:** HYPOTHESIS: Knock / spark-fault diagnostic scalar or sensitivity table (BRO XDF Knock).

**CODE reads:**

- `0x6C47` — descriptor select → 0x20C7/0x20CD → ADD RW1A,RW6E; LD RW4C,[RW1A] → [0xE72C]=0xE039 / XDF 0xE044

> Research-only; do not auto-promote shipping packs.

## Domain: `sensor` (14)

### `0xD23D` — 0xD23D[8bit] Air, MAF, RPM min threshold for MAF signal check

| Field | Value |
|-------|-------|
| Size | 8 bit (1×1) |
| Formula / units | `x * 40` |
| Methods | xdf_mislabel_word_reconcile |
| Status | `absolute_reconciled_xdf_mislabel` / `high_reconciled_do_not_ship` |

**Purpose:** PROVEN: XDF mislabel: CODE reads LE16 @0xD23C (RW6A+0x136) as MAF/RPM plausibility threshold — not a standalone 8-bit @0xD23D. HYPOTHESIS: BRO XDF labels this as RPM min for MAF signal check; retarget XDF to 0xD23C[16bit] before shipping.

**CODE reads:**

- `0x52E3` — CMP RW1C,0x136, TABLE[RW6A]

> Do not auto-promote. Wait for XDF retarget to 0xD23C[16bit].

### `0xD23E` — 0xD23E[16bit] Air, MAF, High Fault Limit kg/h

| Field | Value |
|-------|-------|
| Size | 16 bit (1×1) |
| Formula / units | `x * 0.25` |
| Methods | long_index_or_maf |
| Status | `absolute` / `high_absolute` |

**Purpose:** PROVEN: MAF plausibility / limit scalar under RW6A sensor block; CMP/MULU long-index gates MAF high/low or ratio faults.

**CODE reads:**

- `0x9AA2` — CMP RW24,0x138, TABLE[RW6A]

> Research-only; do not auto-promote shipping packs.

### `0xD240` — 0xD240[16bit] Air, MAF, Low Fault Limit kg/h

| Field | Value |
|-------|-------|
| Size | 16 bit (1×1) |
| Formula / units | `x * 0.25` |
| Methods | long_index_or_maf |
| Status | `absolute` / `high_absolute` |

**Purpose:** PROVEN: MAF plausibility / limit scalar under RW6A sensor block; CMP/MULU long-index gates MAF high/low or ratio faults.

**CODE reads:**

- `0x9AC4` — CMP RW24,0x13a, TABLE[RW6A]

> Research-only; do not auto-promote shipping packs.

### `0xD244` — 0xD244[16bit] Air, MAF, MAF/RPM Ratio Limit

| Field | Value |
|-------|-------|
| Size | 16 bit (1×1) |
| Formula / units | `x * 0.00001` |
| Methods | long_index_or_maf |
| Status | `absolute` / `high_absolute` |

**Purpose:** PROVEN: MAF plausibility / limit scalar under RW6A sensor block; CMP/MULU long-index gates MAF high/low or ratio faults.

**CODE reads:**

- `0x9AAE` — MULU RL20,0x13e, TABLE[RW6A]

> Research-only; do not auto-promote shipping packs.

### `0xD256` — 0xD256[8bit] Coolant Temp Sensor max signal@min volts RAW

| Field | Value |
|-------|-------|
| Size | 8 bit (1×1) |
| Formula / units | `X` |
| Methods | long_index_or_maf |
| Status | `absolute` / `high_absolute` |

**Purpose:** HYPOTHESIS: Temperature sensor bound or temp-dependent correction (BRO XDF Sensors).

**CODE reads:**

- `0x5358` — CMPB R49,0x150, LOOKUP[RW6A]

> Research-only; do not auto-promote shipping packs.

### `0xD257` — 0xD257[8bit] Coolant Temp Sensor min signal@max volts RAW

| Field | Value |
|-------|-------|
| Size | 8 bit (1×1) |
| Formula / units | `X` |
| Methods | long_index_or_maf |
| Status | `absolute` / `high_absolute` |

**Purpose:** HYPOTHESIS: Temperature sensor bound or temp-dependent correction (BRO XDF Sensors).

**CODE reads:**

- `0x535F` — CMPB R49,0x151, LOOKUP[RW6A]

> Research-only; do not auto-promote shipping packs.

### `0xD25A` — 0xD25A[8bit] Air, IAT max signal

| Field | Value |
|-------|-------|
| Size | 8 bit (1×1) |
| Formula / units | `X` |
| Methods | long_index_or_maf |
| Status | `absolute` / `high_absolute` |

**Purpose:** HYPOTHESIS: Temperature sensor bound or temp-dependent correction (BRO XDF Sensors).

**CODE reads:**

- `0x52F5` — CMPB R49,0x154, LOOKUP[RW6A]

> Research-only; do not auto-promote shipping packs.

### `0xD25B` — 0xD25B[8bit] Air, IAT min signal

| Field | Value |
|-------|-------|
| Size | 8 bit (1×1) |
| Formula / units | `X` |
| Methods | long_index_or_maf |
| Status | `absolute` / `high_absolute` |

**Purpose:** HYPOTHESIS: Temperature sensor bound or temp-dependent correction (BRO XDF Sensors).

**CODE reads:**

- `0x52FC` — CMPB R49,0x155, LOOKUP[RW6A]

> Research-only; do not auto-promote shipping packs.

### `0xD27B` — 0xD27B[8bit] Speed, RPM Threshold to activate speed signal check

| Field | Value |
|-------|-------|
| Size | 8 bit (1×1) |
| Formula / units | `x * 40` |
| Methods | long_index_or_maf |
| Status | `absolute` / `high_absolute` |

**Purpose:** HYPOTHESIS: Vehicle-speed signal plausibility or limiter threshold (BRO XDF).

**CODE reads:**

- `0x92B0` — CMPB RD0,0x175, LOOKUP[RW6A]

> Research-only; do not auto-promote shipping packs.

### `0xD27D` — 0xD27D[8bit] Speed, Counter? Threshold for speed signal check DTC 42

| Field | Value |
|-------|-------|
| Size | 8 bit (1×1) |
| Formula / units | `x` |
| Methods | long_index_or_maf |
| Status | `absolute` / `high_absolute` |

**Purpose:** HYPOTHESIS: Vehicle-speed signal plausibility or limiter threshold (BRO XDF).

**CODE reads:**

- `0x92BD` — CMPB R1C,0x177, LOOKUP[RW6A]

> Research-only; do not auto-promote shipping packs.

### `0xD27E` — 0xD27E[8bit] RPM, Rev Limit, IF no speed signal

| Field | Value |
|-------|-------|
| Size | 8 bit (1×1) |
| Formula / units | `x * 40` |
| Methods | long_index_or_maf |
| Status | `absolute` / `high_absolute` |

**Purpose:** PROVEN: RPM threshold for soft fuel cut / rev-limit behavior. HYPOTHESIS: Part of contiguous MAF/sensor/speed/spark-limit scalar block under RW6A (BRO XDF).

**CODE reads:**

- `0x934D` — CMPB RD0,0x27c, LOOKUP[RW68]
- `0x9369` — CMPB RD0,0x27c, LOOKUP[RW68]

> Research-only; do not auto-promote shipping packs.

### `0xD281` — 0xD281[8bit] Ign., Spark Fault

| Field | Value |
|-------|-------|
| Size | 8 bit (1×1) |
| Formula / units | `X` |
| Methods | long_index_or_maf |
| Status | `absolute` / `high_absolute` |

**Purpose:** HYPOTHESIS: Knock / spark-fault diagnostic scalar or sensitivity table (BRO XDF Knock).

**CODE reads:**

- `0xAB3B` — CMPB R38,0x17b, LOOKUP[RW6A]

> Research-only; do not auto-promote shipping packs.

### `0xD288` — 0xD288 Knock Sensor DTC related

| Field | Value |
|-------|-------|
| Size | 8 bit (1×1) |
| Formula / units | `X` |
| Methods | long_index_or_maf |
| Status | `absolute` / `high_absolute` |

**Purpose:** HYPOTHESIS: Knock / spark-fault diagnostic scalar or sensitivity table (BRO XDF Knock).

**CODE reads:**

- `0x6AAF` — CMPB RD0,0x182, LOOKUP[RW6A]

> Research-only; do not auto-promote shipping packs.

### `0xD290` — 0xD290[Func\|5V\|256]MAF Cal. kg/h

| Field | Value |
|-------|-------|
| Size | 16 bit (256×1) |
| Formula / units | `X` |
| Methods | long_index_or_maf |
| Status | `absolute` / `high_absolute` |

**Purpose:** PROVEN: ADC ISR (vec5) word table: scales AD_resulthi → air-mass proxy (RW64 accumulate). Feeds fuel/ign load axes.

**CODE reads:**

- `0xA53B` — ADD RW64,0x2[RW46] ; RW46=RW6C+2*AD_resulthi

> Research-only; do not auto-promote shipping packs.

## Related

- [`control_flowcharts.md`](control_flowcharts.md) — Mermaid boot/fuel/ign/IRQ
- [`engine_control_dataflow_summary.md`](engine_control_dataflow_summary.md)
- [`absolute_code_reads.json`](absolute_code_reads.json)
- [`ignition_fuel_dataflow.md`](ignition_fuel_dataflow.md)
- [`theory_vs_rom_bosch_ti.md`](theory_vs_rom_bosch_ti.md)

---
Research-only. Verification gates for promotion unchanged.
