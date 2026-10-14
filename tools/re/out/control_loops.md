# Control loops (hypotheses) — RedLabel MCS-96

ROM: `BMW DME413 SW623 D466.29 C16x900A 94 RedLabel.bin`
ISA: **mcs96_80c196_family** / `MCS96:LE:16:default`
CODE: `0x2000`–`0xB930` inclusive; DATA from `0xB931`.

> Loop roles are hypotheses grounded in Ghidra listing + PC-rel CFG. IRQ stub targets are cross_checked; semantic labels are not proven. Do not claim full engine control yet.

## Loop inventory

### `boot_reset` (boot) — evidence **high**

- Status: `hypothesized_with_strong_listing`
- Entry: `0x2080`
- Path:
  - VECTOR_Reset @0x2080: TIMER1lo watchdog kick
  - spin until [0x4000]==0x5AA5
  - LJMP 0x4120 → LJMP 0x476B HW init (SP, IOS0/1, AD, HSI_*, PORT1/2)
  - LJMP 0x2097 → FUN_3679 RAM copy / integrity
  - eventually FUN_4815 → EI @0x491F
- Open:
  - Exact order of post-EI foreground vs IRQ-driven work
  - Which RAM flags gate idle vs run

### `watchdog_kick` (timed_safety) — evidence **high**

- Status: `proven_pattern`
- Pattern: `LDB TIMER1lo,#0x1e ; LDB TIMER1lo,#-0x1f`
- Note: Repeated across large functions; MCS-96 WDT service via TIMER1 lo writes.

### `trampoline_dispatch` (foreground_dispatch) — evidence **medium**

- Status: `hypothesis`
- Entry: `0x2094-0x20D3`
- Note: Dense LJMP trampoline table. 0x20C7 (fan-in 93 LCALLs) → 0x33C2 table/interp helper; 0x20CD fan-in 31. Likely shared map-interp / service calls used by fuel+ign math.

### `foreground_run_init` (foreground) — evidence **medium**

- Status: `hypothesis`
- Entry: `0x4815`
- Path:
  - FUN_4815: watchdog, PORT1/2 mirror, HSI_time sync loop (JBS IOS1.7)
  - INT_MASK load, clear INT_PEND, schedule HSI_status/HSI_time channels
  - EI @0x491F then RAM clear / state init (continues in FUN_4815 body)
- Open:
  - Locate tight idle spin vs cooperative task schedule after 0x4Axx
  - Map LCALL 0x20C7 sites in this function to which cal pages

### `irq_vector_bank` (interrupt) — evidence **high**

- Status: `cross_checked_targets_hypothesized_roles`
- Entry: `0x2000 vectors → 0x4178 stubs`
- IRQ handlers:
  - vec0 `0x2000` stub `0x4178` → `0xA479` — **ios0_edge_timer_tick** (medium): IOS0 XOR edge; may set INT_PEND bit0 / bump RW7A; POPF+RET. Candidate timer/port edge ISR.
  - vec1 `0x2002` stub `0x417C` → `0xA4A9` — **unused_or_spurious_ret** (high): Landing is bare RET @0xA4A9 (same as vec4). Likely unused vector.
  - vec2 `0x2004` stub `0x4180` → `0xA88E` — **hsi_capture_crank_cam** (high): FUN_a88e: ORB IOS1, read HSI_time repeatedly, TIMER2 store, period math into RAM (`0x14C0/14C2/14C4/14CC`). Also `CMP …,0x14,TABLE[RW68]` period gate, HSO `#0x74`, `CLR RW64` air-window reset, `STB RA3,PORT2`.
  - vec3 `0x2006` stub `0x4184` → `0xA640` — **ios0_state_machine** (medium): XOR IOS0 into RA1; conditional STB + LJMP into trampoline table (0x4145…). Candidate I/O edge / synch state ISR.
  - vec4 `0x2008` stub `0x4188` → `0xA4A9` — **unused_or_spurious_ret** (high): Same bare RET @0xA4A9 as vec1.
  - vec5 `0x200A` stub `0x418C` → `0xA4AA` — **adc_hsi_schedule** (high): ORB IOS1; AD kick + HSO `#0x18/+0x1F4`; sample `AD_resulthi→0x187C`; **MAF absolute** `ADD RW46,RW6C; ADD RW64,0x2[RW46]`; further HSO `#0x1A/#0x33/#0x2/#0x13/#0x22`; flag `0x101E`.
  - vec6 `0x200C` stub `0x4190` → `0x20AF` — **serial_sbuf** (medium): Stub → 0x20AF → FUN_2eaa: SBUF/SP_STAT path with POPF+RET. Candidate SCI/diagnostic IRQ.
  - vec7 `0x200E` stub `0x4194` → `0xA49E` — **counter_overflow_helper** (medium): INCB RDB with saturate; POPF+RET. Small helper ISR / soft counter.

### `hso_schedule_outputs` (output_path) — evidence **high** (ign); fuel via MMIO

- Status: `ign_ch0_proven_ti_via_mmio_0x440`
- Note: **Ign → HSO.0 `#0x70`.** **Ti → injector via `0x440` MMIO** (not HSO_TIME). CH1 `#0x71/#0x51` are tooth-angle sync only.
- Proven:
  - Ign: `0x1502`/`0x1512` → `0x1480` → `@0xB696 #0x70`; drain `@0x3E3A`
  - Fuel: `0x153A`→`0x1540`→`0x1568`→`STB R42,[0x440]` @`0xB266` (`PORT1.6` handshake)
  - CH1 `@0xA7B1 #0x71` time=`RW5E` tooth-rel; `@0xAF44 #0x51` tooth+`0x1A` — **rejected as Ti width**
- Open: 0x440 byte protocol; CH2/3/4 connector roles
- Counts: `{'HSI_statusRefs': 37, 'HSI_timeRefs': 49, 'PORT1Refs': 53, 'PORT2Refs': 26}`

### `map_interp_helper` (shared_runtime) — evidence **medium**

- Status: `hypothesis`
- Entry: `0x33C2`
- Note: Reached via trampoline 0x20C7. Body does pointer chase + DJNZ accumulate — classic axis/map interpolate. Not ignition/fuel specific; shared by many LCALL sites.

## End-to-end engine control (sketch)

Status: `partial_proven_cal_partial_output` — **not** complete control.

1. Sensors/IRQ: HSI capture (vec2) + ADC/MAF (vec5) publish period `0x14CC` + air sum `RW64` + sample `0x187C`
1. Foreground: FE14 bases via `0x412C→0x20B5→0x2EDB`; FUN_4815+ LCALL `0x20C7/0x20CD` map interp (`RW6E` descriptors)
1. Fuel Ti: `DIVU/LD Ti@RW68+0x2E` → RAM `0x153A`/`0x1540`; FUN_ab11 consumes with period for pulse math
1. Ign: descriptor `0x9A→DD0D/DD0F` via `0x20CD`; advance RAM `0x1502`/`0x150A`/`0x150C` → consumers `0xB5B3`/`0xA067`
1. Outputs: HSO schedules + PORT2 in vec2/vec5/FUN_ab11 — **channel bits still open**
1. Safety: TIMER1lo watchdog; soft/hard fuel cut scalars (XDF absolute; actuator path TBD)

## Runtime RAM glue (proven sites)

| RAM | Role hypothesis | Publish | Consume |
|-----|-----------------|---------|---------|
| `0x14CC` | period_scale | vec2 | Ti math `0x9A7A`, `0xAFD1`; air/Ti `0xAE20` |
| `RW64/66` | maf_accum | vec5 `0xA53B` | FUN_ab11 `0xADED`; reset vec2 `0xAA44` |
| `0x153A` | ti_pulse_word | `0x9A92`/`0x9A60`/`0x4966` | `0xAE18` → RW8A |
| `0x1540` | ti_alt_pulse | `0xAFDF` | (follow) |
| `0x1502` | ign_advance | `0x6964` | `0xB5B3` |
| `0x150A/0x150C` | ign_shadows | `0x69A8`/`0x69B6` | `0xA067`/`0xA092` |
| `0x1510/0x1512` | ign_clamped | `0xA0B5`/`0xA0F0` | (HSO path TBD) |

## CFG hot targets (LJMP/LCALL only)

- `0x20C7` fan-in=93 — `LJMP 0x33c2`
- `0x6F69` fan-in=38 — `LD RW58,#0x1038`
- `0x6EFD` fan-in=36 — `LD RW58,#0x1038`
- `0x20CD` fan-in=31 — `LJMP 0x343c`
- `0x916C` fan-in=13 — `LDB TIMER1lo,#0x1e`
- `0x2E81` fan-in=6 — `LDB R1C,#0x3`
- `0x412C` fan-in=6 — `LJMP 0x20b5`
- `0x6875` fan-in=6 — `JBS RB6,0x2,0x6895`

## Largest non-thunk functions

- `0xAB11` FUN_ab11 size=3626
- `0x528B` FUN_528b size=1924
- `0x916C` FUN_916c size=1417
- `0x4815` FUN_4815 size=1355
- `0x7A5B` FUN_7a5b size=1206
- `0x7387` FUN_7387 size=1148
- `0x612B` FUN_612b size=1141
- `0x96F5` FUN_96f5 size=1137
- `0x5C46` FUN_5c46 size=1120
- `0xA0F6` FUN_a0f6 size=899
- `0x4D60` FUN_4d60 size=818
- `0x6684` FUN_6684 size=753

## Theory reference (Bosch M-Motronic TI)

Family expected loops (load → ti / zw / dwell / lambda / idle) from local PDF — see [`ref_pdf_bosch_m_motronic_technical_instruction.md`](ref_pdf_bosch_m_motronic_technical_instruction.md) and [`motronic_331_function.md`](motronic_331_function.md). Use as theory-vs-ROM targets only; IRQ roles above remain CODE hypotheses.

## Open questions

- Identify spark vs injector HSO/PORT bit assignments (immediates listed; decode open)
- Close Ti RAM → injector HSO schedule (0x153A/0x1540 → which HSO_COMMAND)
- Close ign advance RAM → spark HSO (0x1502/0x1512 → which HSO_COMMAND)
- Dwell E0DA / Alpha-N DBC3 body walks via [RW4C]
- Idle vs run mode flag(s) in RAM (candidates `0x101E`, `0x13ea` in FUN_4815)
- Which AD ring slot is MAF vs other sensors

## Next concrete RE steps

1. From FUN_ab11 after `0xAE18`/`0xAF44`, walk every HSO_COMMAND write and tag channel bits
1. From `0xB5B3`/`0xA0F0` ign consumers, find next HSO/PORT schedule (spark path)
1. Decode Intel HSO_COMMAND bitfields for observed immediates vs pin map
1. Optional: retarget seed.xdf 0xD23D → 0xD23C[16bit] before shipping promote
1. Optional: deeper [RW4C] walks for dwell/Alpha-N semantics

## Related follow-ups (priority traces)

- IRQ RAM pubs: `irq_ram_publications.md` (vec2 `@0xA88E`, vec5 `@0xA4AA`)
- SFR HSO/HSI audit: `sfr_hso_hsi_audit.md` (**cross_checked** — writes to Ghidra `HSI_*` are HSO schedules)
- CAL access model v2: `cal_access_model.md` (retracts false page-index xrefs; **0%** proven ign/fuel XDF CODE reads)
- Theory vs ROM: `motronic_331_function.md` §7

---
Research-only. Verification gates for promotion unchanged.
