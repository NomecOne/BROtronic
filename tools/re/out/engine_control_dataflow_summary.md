# Engine-control dataflow summary — absolute MAF / Ti / ign

ROM: `BMW DME413 SW623 D466.29 C16x900A 94 RedLabel.bin`
Addressing: FE14 CAL bases (`RW68=0xD002`, `RW6A=0xD106`, `RW6C=0xD28E`, `RW6E=0xE67E`)

> Research summary only. Absolute CODE→CAL paths proven under FE14. Do not auto-promote shipping maps. D23D is XDF-mislabel reconcile only.

## Coverage

| Metric | Value |
|--------|------:|
| Absolute CODE→XDF | **69/69** |
| Exclusive geometry | **69/69** |
| Unproven absolute | **0** |
| Reconciled XDF mislabels | **1** |

100.0% absolute (69/69); exclusive geometry 100.0% (69/69); unproven absolute 0; resolved XDF mislabels 1; FE14 CAL bases; D200/D978 retracted.

## Control-loop dataflow (proven absolute paths)

### `air_maf` — air_mass_input (`absolute`)

- XDF: `0xD290`
- CODE: `0xA53B ADD RW64,0x2[RW46] (RW46=RW6C+2·ADC)`
- Dataflow: ADC ISR vec5 @0xA4AA → index word table at RW6C+2 (RW6C=0xD28E → body 0xD290). Publishes air-mass proxy for fuel/ign load axes.
- Feeds: `fuel_ti`, `ign_maps`, `maf_limits`
### `maf_limits` — air_plausibility_gates (`absolute`)

- XDF: `0xD23E`, `0xD240`, `0xD244`, `0xD23D(reconciled→D23C)`
- CODE: `CMP/MULU long-index RW6A+0x138/13A/13E; D23D reconcile CMP RW6A+0x136 @0x52E3 → LE16@0xD23C`
- Dataflow: Sensor/limit block under RW6A=0xD106 gates MAF high/low faults and MAF/RPM ratio. D23D XDF byte is mislabel of word threshold at 0xD23C (do not auto-promote).
- Feeds: `diagnostic_flags`
### `fuel_ti` — injector_constant_base (`absolute`)

- XDF: `0xD030`
- CODE: `['0x9A82', '0xAFC7']`
- Dataflow: RW68=0xD002; LD/DIVU at +0x2E → Ti injector constant 0xD030. Used with load (MAF-derived) to form injection pulse width before HSO/PORT scheduling.
- Feeds: `injector_pulse`
### `cylinder_trim` — per_cylinder_fuel_trim (`absolute`)

- XDF: `0xD0FA`
- CODE: `0x5B65 LD RW1E,RW68; 0x5B6B LDB …,0xf8,LOOKUP[RW1E] → D0FA`
- Dataflow: Chained base: LD RW1E,RW68 then LDB …,0xf8,LOOKUP[RW1E] (+ INC×6) reads per-cylinder trim bytes at 0xD0FA.
- Feeds: `injector_pulse`
### `ign_wot` — main_ignition_wot_axis (`absolute`)

- XDF: `0xDD0F`
- CODE: `0x66EC LD RW1A,#0x9A → 0x6987 → 0x20CD → DD0D/DD0F`
- Dataflow: Select index 0x9A → interp 0x20CD → descriptor [RW6E+0x9A]=0xDD0D → XDF ign WOT VANOS-retarded RPM axis 0xDD0F. Map body walked via [RW4C].
- Feeds: `spark_advance`, `dwell`
### `map_interp` — shared_cal_interp (`absolute_helper`)

- XDF: _helper_
- CODE: `0x20C7/0x20CD → ADD RW1A,RW6E; LD RW4C,[RW1A] (RW6E=0xE67E)`
- Dataflow: Trampoline 0x20C7/0x20CD: ADD RW1A,RW6E; LD RW4C,[RW1A]. Shared by fuel and ignition map consumers.
- Feeds: `fuel_maps`, `ign_maps`, `dwell_maps`

## End-to-end sketch

1. Crank/cam HSI ISR (vec2) + ADC ISR (vec5) publish RPM/air samples to RAM.
2. Foreground loads FE14 CAL bases (RW68/6A/6C/6E) once via 0x2EDB.
3. MAF word table 0xD290 scales ADC → air mass; RW6A limits gate plausibility.
4. Ti 0xD030 (+ cylinder trim 0xD0FA) combines with load for injection timing.
5. Ign WOT/PT maps → advance RAM → **HSO.0 `#0x70`**.
6. Ti pulse → **`0x1568` → MMIO `0x440`** (LE `R42`/`R43` + PORT1.6 handshake). CH1 `#0x71/#0x51` are angle-sync only (not Ti width).

## Actuator close (shim v15)

> Intel 80C196KB `HSO_COMMAND`: `T2RST|T2CAM|SET|INT|CH[3:0]`. Writes named `HSI_status` are HSO_COMMAND (SFR audit cross_checked).

### HSO channel decode (priority immediates)

| Imm | Decode | Role | Confidence |
|-----|--------|------|------------|
| `#0x70` | T2CAM+SET+INT+**CH0** | **Coil / spark schedule** | **proven** (ign RAM → queue → HSO) |
| `#0x30` | SET+INT+CH0 | Ign arm via TIMER1+4 | proven (same path fallback) |
| `#0x20` | SET+CH0 | Ign queue drain fallback | proven (`0x3E43`) |
| `#0x10` | INT+CH0 (clear) | CH0 end / related IRQ | medium |
| `#0x71` | T2CAM+SET+INT+**CH1** | Injector-bank candidate | medium (no Ti→time yet) |
| `#0x51` | T2CAM+INT+CH1 (clear) | CH1 end/sync @ tooth+`0x1A` | medium |
| `#0x74` | T2CAM+SET+INT+**CH4** | Crank-sync / cam-side + PORT2 | medium |
| `#0x18` | INT+CH8 | ADC ISR period timer | behavior proven; CH id odd vs KB map |
| `#0x1A` | INT+CH10 | Timed sample / companion timer | behavior proven |
| `#0x33`/`#0x13` | SET+INT / INT **CH3** | Aux output pair | low–medium |
| `#0x22`/`#0x02` | SET / clear **CH2** | Aux output pair | low–medium |

### Proven actuator links

| Link | Path |
|------|------|
| **Ign → HSO.0** | `0x1502` @`0xB5B3` → queue `0x1480`/`0x14a0` → `#0x70` @`0xB696` (or `#0x30`). Drain `@0x3E3A`/`0x3E43`. |
| **Ign clamp** | `0x1512` @`0xB48E`… clamps advance before queue fill. |
| **Ti → injector (MMIO, not HSO)** | `0x153A`→RW8A @`0xAE18` → `0x1540` @`0xAFC7` → enrich → **`ST 0x1568`** @`0xB246` → **`STB R42`×2 / `STB R43`×2** @`0xB266`/`0xB281` when `RW74==0x440` (`PORT1.6`↑ then ↓; `PORT1.7`→`RW8C`). |

### MMIO `@0x440` protocol (v15 — see `mmio_440_injector_protocol.md`)

| Element | Proven meaning |
|---------|----------------|
| `R42` / `R43` | LE split of Ti word (`RW42` / `0x1568`) — width bytes, not bank opcodes |
| `PORT1.6` | Ready/busy: wait SET before lo, CLEAR before hi; timeout → `RC3.0` |
| `PORT1.7` | Status bit shifted into `RW8C` |
| Dual-STB | Each byte written twice |
| `RW8E` / `R8E.0` | Cylinder/phase index; even/odd selects `0x155e` vs `0x1560`; command frames `OR R8E` + `0x154e[RW8E]` |
| `0x441` / `0x480` | Status/readback companions |

### CH1 `#0x71`/`#0x51` verdict (Ti pulse test)

| Imm | HSO_TIME source | Ti link? | Role |
|-----|-----------------|----------|------|
| `#0x71` | `RW5E` = tooth±angle (`ADD RW5E,RW7E,#0x28` / `MULU…RW92`) @`0xA7B1` | **No** | CH1 set, crank-angle sync |
| `#0x51` | tooth+`#0x1A` (`ADD HSI_time,RW38,RW7E`) @`0xAF44` | **No** | CH1 clear/sync |

**Rejected:** Ti pulse width does **not** program CH1 `HSO_TIME`. Injector on-time is the **0x440** LE word stream. CH1 remains **phase-only** vs width on `@0x440`.

### Still open

- Command opcode bits beyond `OR R8E`; physical `RW8E`→pin/bank map; `@0x440` ASIC ID
- Whether CH1 edges gate ASIC accept of `@0x440` transfers
- CH2/CH3/CH4 connector roles; AD ring ID; idle/run flags

## Control-loop deepen (v12 sites, retained)

| Link | Sites | What |
|------|-------|------|
| FE14 loader | `0x412C → 0x20B5 → 0x2EDB` | RW68/6A/6C/6E |
| MAF window | `0xA53B` / reset `0xAA44` | `RW64` accumulate |
| Ti pulse RAM | `0x9A82` / `0xAFC7` | `0x153A` / `0x1540` |
| Ign advance RAM | `0x6987` → `0x1502` | + shadows / clamps |

## D23D verdict

- **Verdict:** `xdf_mislabel`
- **Status:** `absolute_reconciled_xdf_mislabel`
- **True read:** `0xD23C[16bit] via CMP @0x52E3 (RW6A+0x136)` (ROM `0x01F4`)
- **Rationale:** No byte LOOKUP of 0xD23D. CODE reads LE16 @0xD23C=0x01F4. XDF 8-bit@0xD23D MATH x*40 yields nonsense (raw 1 → 40 RPM) vs word neighbors that are proven 16-bit long-index. Count as reconciled absolute; do not auto-promote shipping.
- **Shipping:** Do not auto-promote. Reconciled coverage only — wait for XDF retarget to 0xD23C[16bit] (or confirmed byte proof) before shipping promotion.

## Open (next RE value) — gaps for “control the engine”

- Map `RW8E` indices / command opcodes to physical banks & pins; identify `@0x440` ASIC
- CH1 edge vs `@0x440` accept coupling (phase proven separate from width)
- CH2/CH3/CH4 connector roles; dwell `E0DA` / Alpha-N `DBC3`; idle/run flags; AD ring ID
- Optional seed.xdf retarget `0xD23D → 0xD23C[16bit]`

## Related

- `tools/re/out/mmio_440_injector_protocol.md`
- `tools/re/out/absolute_code_reads.json`
- `tools/re/out/ignition_fuel_dataflow.md`
- `tools/re/out/control_loops.md`
- `tools/re/out/irq_ram_publications.md`
- `tools/re/out/sfr_hso_hsi_audit.md`
- `tools/re/out/theory_vs_rom_bosch_ti.md`
- `tools/re/out/cal_access_model.md`

---
Research-only. Verification gates for promotion unchanged.
