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
5. Ign WOT/PT maps via RW6E descriptors (e.g. 0xDD0F) → spark/dwell outputs.
6. HSO/PORT scheduling drives injectors/coils (bit assignment still open).

## Control-loop deepen (shim run — proven vs hypothesis)

> Shim disasm-at / xrefs over existing MCS96 listing. Absolute CAL coverage unchanged (69/69). New notes deepen **runtime RAM / HSO glue** between proven CAL reads and outputs.

### Proven (listing + CFG)

| Link | Sites | What |
|------|-------|------|
| FE14 loader call chain | `0x412C → 0x20B5 → 0x2EDB` | Loads RW68/6A/6C/6E byte-pairs from FE14 struct; RET @0x2F37 |
| MAF accumulate window | vec5 `0xA52A…0xA53B`; reset vec2 `0xAA44` | `AD_resulthi → ×2 + RW6C → ADD RW64,0x2[RW46]`; tooth edge `CLR RW64/RW66/RW88` |
| Period publish | vec2 `0xA8FB/A9B6/A9C0/AA8F` | `0x14C2/14C0/14C4/14CC` period/timestamp words |
| Period × CAL gate | vec2 `0xA911` | `CMP RW92,0x14,TABLE[RW68]` → RW68+0x14 = `0xD016` (IRQ uses FE14 base) |
| Ti → pulse RAM | `0x9A76…0x9A92`, alt `0x9A60` | `load×0x32 × 0x14CC ÷ Ti[RW68+0x2E] → ST 0x153A` |
| Ti × period (2nd form) | `0xAFC7…0xAFDF` | `LD Ti; MULU RW8A; DIVU 0x14CC → ST 0x1540` |
| Air Δ / Ti consume | `0xADED…0xAE62` (in FUN_ab11) | `ΔRW64→0x17da[cyl]`; `LD 0x153A→RW8A`; history `0x17da/17e6/17f2` |
| Map body walk | `0x20CD → 0x343C` | `ADD RW1A,RW6E; LD RW4C,[RW1A]` then `[RW4C]+` axis/body walk (fan-in 31) |
| Ign advance RAM | `0x6987` ret path; `0x6964/69A8/69B6` | Interp result → `0x1502`; shadows `0x150A/0x150C` |
| Ign consumers | `0xB5B3`, `0xA067…0xA0B5` | `SUB …,0x1502`; clamp/blend into `0x1510/0x1512` |
| Crank-synced HSO+PORT | vec2 `0xA9C5…0xA9D5`; FUN_ab11 `0xAF44` | HSO_COMMAND `#0x74` / `#0x51` + `STB RA3,PORT2` |

### Hypothesis (not yet channel-proven)

- Post-interp `ADD RW20,#0x3c; SUB RW20,RW1C` @0x698A = 60° reference (Bosch-style); strong pattern, not SFR-proven.
- HSO immediates `#0x18/#0x1A/#0x33/#0x2/#0x13/#0x22/#0x51/#0x74` → coil vs injector vs cam — **open**.
- Which `[RW70]` AD ring slot is MAF vs TMOT/IAT — **open**.
- Idle vs run gate candidates (`0x101E` vec5 store; `0x13ea` in FUN_4815) — **open**.

## D23D verdict

- **Verdict:** `xdf_mislabel`
- **Status:** `absolute_reconciled_xdf_mislabel`
- **True read:** `0xD23C[16bit] via CMP @0x52E3 (RW6A+0x136)` (ROM `0x01F4`)
- **Rationale:** No byte LOOKUP of 0xD23D. CODE reads LE16 @0xD23C=0x01F4. XDF 8-bit@0xD23D MATH x*40 yields nonsense (raw 1 → 40 RPM) vs word neighbors that are proven 16-bit long-index. Count as reconciled absolute; do not auto-promote shipping.
- **Shipping:** Do not auto-promote. Reconciled coverage only — wait for XDF retarget to 0xD23C[16bit] (or confirmed byte proof) before shipping promotion.

## Open (next RE value) — gaps for “control the engine”

- **HSO channel decode:** map `#0x18/#0x1A/#0x33/#0x51/#0x74/…` + PORT1/2 bits to coil vs injector vs VANOS
- **Close Ti → HSO:** prove which schedule after `0x153A`/`0x1540`/`RW8A` programs injector on-time (not only RAM publish)
- **Close ign → HSO:** prove which schedule after `0x1502`/`0x1512` programs spark (FUN_ab11 / vec2 `#0x74` candidates)
- End-to-end dwell `0xE0DA` / Alpha-N `0xDBC3` body walks via `[RW4C]`
- Idle vs run mode RAM flags (`0x101E`, post-EI FUN_4815)
- Optional seed.xdf retarget `0xD23D → 0xD23C[16bit]` before shipping

## Related

- `tools/re/out/absolute_code_reads.json`
- `tools/re/out/ignition_fuel_dataflow.md`
- `tools/re/out/control_loops.md`
- `tools/re/out/irq_ram_publications.md`
- `tools/re/out/theory_vs_rom_bosch_ti.md`
- `tools/re/out/cal_access_model.md`

---
Research-only. Verification gates for promotion unchanged.
