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
  - vec2 `0x2004` stub `0x4180` → `0xA88E` — **hsi_capture_crank_cam** (high): FUN_a88e: ORB IOS1, read HSI_time repeatedly, TIMER2 store, period math into RAM. Strong candidate crank/cam HSI ISR.
  - vec3 `0x2006` stub `0x4184` → `0xA640` — **ios0_state_machine** (medium): XOR IOS0 into RA1; conditional STB + LJMP into trampoline table (0x4145…). Candidate I/O edge / synch state ISR.
  - vec4 `0x2008` stub `0x4188` → `0xA4A9` — **unused_or_spurious_ret** (high): Same bare RET @0xA4A9 as vec1.
  - vec5 `0x200A` stub `0x418C` → `0xA4AA` — **adc_hsi_schedule** (medium): ORB IOS1; AD_resultlo write; HSI_status/HSI_time schedule (+0x1F4). Candidate ADC-complete / timed sample ISR.
  - vec6 `0x200C` stub `0x4190` → `0x20AF` — **serial_sbuf** (medium): Stub → 0x20AF → FUN_2eaa: SBUF/SP_STAT path with POPF+RET. Candidate SCI/diagnostic IRQ.
  - vec7 `0x200E` stub `0x4194` → `0xA49E` — **counter_overflow_helper** (medium): INCB RDB with saturate; POPF+RET. Small helper ISR / soft counter.

### `hso_schedule_outputs` (output_path) — evidence **low**

- Status: `hypothesis`
- Note: Listing shows many LDB HSI_status,#imm + LD/ADD HSI_time sequences and PORT1/PORT2 stores. On 80C196, spark/injector pulses are often HSO-scheduled; Ghidra may be naming HSO command/time as HSI_*. Treat as output-scheduling hypothesis until SFR map is confirmed.
- Open:
  - Confirm SFR addresses for HSO_COMMAND / HSO_TIME vs HSI_* in this Ghidra language
  - Which channel bits fire coil vs injectors
- Counts: `{'HSI_statusRefs': 37, 'HSI_timeRefs': 49, 'PORT1Refs': 53, 'PORT2Refs': 26}`

### `map_interp_helper` (shared_runtime) — evidence **medium**

- Status: `hypothesis`
- Entry: `0x33C2`
- Note: Reached via trampoline 0x20C7. Body does pointer chase + DJNZ accumulate — classic axis/map interpolate. Not ignition/fuel specific; shared by many LCALL sites.

## End-to-end engine control (sketch)

Status: `partial_hypothesis` — **not** complete control.

1. Sensors/IRQ: HSI capture (vec2) + ADC schedule (vec5) + IOS edges update RAM timestamps/flags
1. Foreground: FUN_4815+ tasks LCALL trampolines (0x20C7 interp) using page-indexed CAL in 0xDxxx–0xExxx
1. Outputs: HSI_*/PORT1/PORT2 writes schedule or drive actuators (spark/fuel unproven which bits)
1. Safety: TIMER1lo watchdog kicks throughout; soft/hard fuel cut scalars in XDF (CODE path TBD)

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

- Identify spark vs injector HSO/PORT bit assignments
- Trace MAF table 0xD290 through page 0xD2 loads into final Ti / inj pulse
- Trace ign WOT/PT maps 0xDD27/0xDDA1/0xDE8B/0xDF6B to dwell/advance output
- Idle vs run mode flag(s) in RAM (candidates near 0x13ea test in FUN_4815)
- Promote any item to ghidraProven only after full address operand or proven index base

## Next concrete RE steps

1. Deep-trace IRQ vec2 (0xA88E) and vec5 (0xA4AA) to RAM variables they publish
1. Build page-index resolver: when CODE loads 0xD0/D7/…, follow ZR/RW until table base lands on XDF offset
1. SFR audit: dump Ghidra MCS96 register map for HSO vs HSI naming at used addresses
1. From FUN_4815 post-EI, enumerate LCALL 0x20C7 call sites and preceding page loads
1. For each ignition timing + fueling XDF table, find exclusive page+index path (not just page hit)

## Related follow-ups (priority traces)

- IRQ RAM pubs: `irq_ram_publications.md` (vec2 `@0xA88E`, vec5 `@0xA4AA`)
- SFR HSO/HSI audit: `sfr_hso_hsi_audit.md` (**cross_checked** — writes to Ghidra `HSI_*` are HSO schedules)
- CAL access model v2: `cal_access_model.md` (retracts false page-index xrefs; **0%** proven ign/fuel XDF CODE reads)
- Theory vs ROM: `motronic_331_function.md` §7

---
Research-only. Verification gates for promotion unchanged.
