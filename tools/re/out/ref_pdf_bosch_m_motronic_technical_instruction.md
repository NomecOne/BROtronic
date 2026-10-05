# Reference extract — Bosch *M-Motronic Engine Management* (Technical Instruction)

**Local PDF (canonical):** `tools/re/docs/Bosch-M-Motronic-Technical-Instruction.pdf`  
**Duplicate (same SHA-256):** `tools/re/docs/Bosch M-Motronic Engine Management 89403362.pdf`  
**Size:** 1,398,921 bytes (~1.33 MiB)  
**Pages:** 68  
**Title (PDF metadata):** `U217E_U1`  
**Cover title:** Gasoline-engine management — Technical Instruction — **M-Motronic Engine Management**  
**Publisher:** Robert Bosch GmbH, 2000 (4th Edition, February 2000; English from German Aug 1999)  
**Git policy:** **local-only** (copyrighted; do not commit). See `tools/re/data/refs/README.md`.

**Evidence tier:** **PRIMARY** for *family-level* M-Motronic control concepts.  
**Not** RedLabel / M3.3.1 CODE proof — use for theory → ROM hypothesis framing only. Cross-check against XDF + Ghidra.

Page citations below use **booklet page numbers** printed in the PDF footer (cover = PDF index 0; booklet p.N ≈ PDF index N+1 for body pages).

---

## Related local refs (same drop)

| File | Size | Role for RE |
|------|-----:|-------------|
| `BMW Product info  Vanos.pdf` | ~7.5 MiB | BMW Aftersales Training Product Information **VANOS** (June 2005). BMW application context for dual maps / cam control — not Bosch M-Motronic math. **Local-only** (large + copyrighted). |
| `bmw doc e36 gt1 training/*.pdf` | various | E36 GT1 coding / EPROM / Progman — diagnostic coding context, not fuel/ign calculation. **Local-only**. |

---

## 1. What this book is useful for

Bosch’s short **Technical Instruction** on **M-Motronic**: sensors → load → injection timing + ignition angle, including **hot-wire / hot-film air-mass** meters (HFM/HLM family), injector constant, correction stack, dwell, knock, lambda, idle, camshaft control as optional OEM expanders.

For RedLabel (MAF/HFM BMW M50 + VANOS), the critical chapters are:

| Booklet pp. | Topic |
|------------:|-------|
| 18–19 | M-Motronic system overview + max config (air-mass meter #11) |
| 20–27 | Fuel system / injectors (pulsewidth = quantity) |
| **28–34** | **Operating-data acquisition — load sensors (AFM / HLM / HFM / MAP / TPS)** |
| **38–41** | **Operating-data processing — load signal → ti / zw / dwell** |
| 42+ | Operating conditions (start, warm-up, idle, lambda, overrun, …) |

---

## 2. Load sensing (MAF / HFM) — booklet pp. 28–30

**Claim (PRIMARY):** Engine **load state** is one of the most important variables for **injection quantity** and **ignition advance angle** (p. 28).

Motronic load sensors listed (p. 28):

1. Air-flow sensor (flapper / volumetric m³/h)  
2. **Hot-wire air-mass meter**  
3. **Hot-film air-mass meter**  
4. Intake-manifold pressure sensor  
5. Throttle-valve sensor  

Throttle-valve sensor is usually **secondary** limp/supplement; sometimes primary in isolated cases (p. 28) — aligns with RedLabel **Alpha-N limp** (`0xDBC3`) as failsafe, not primary load.

### Hot-wire / hot-film principle (pp. 28–30)

- Heated element in intake stream; control circuit holds ΔT vs intake air constant.  
- Heating current / heater voltage → **mass flow [kg/h]** index; **automatically compensates air density** (p. 29).  
- Hot-wire: platinum wire; burn-off after engine off to clear deposits (p. 30).  
- Hot-film: platinum film on ceramic; **no burn-off**; deposits collect on leading edge so sensing elements sit downstream (p. 30).  
- Signal conditioned to ECU-usable voltage (p. 30).

**REPO mapping:** RedLabel XDF MAF transfer `0xD290` (voltage → kg/h) is the calibration of this thermal air-mass path — theory matches Bosch HFM narrative.

---

## 3. Load signal → injection / ignition — booklet pp. 38–41

### Load signal (p. 38)

ECU uses **load + engine speed** to compute a load signal = **air mass inducted per stroke**. That signal:

- is the basis for **injection duration**, and  
- **addresses** programmed ignition-advance response curves.

Hot-wire/hot-film measure air mass **directly** → suitable for load-signal calculation. Air-flow (flapper) needs **density correction**. Pulsation may get a **pulsation correction** (p. 38).

Throttle-angle load path (p. 39): load from **speed + throttle angle**, with temp + ambient pressure density compensation — the Alpha-N / limp mental model.

### Base injection timing (p. 39) — key equation narrative

> Base injection timing is calculated **directly from the load signal and from the injector constants**, defining the relationship between activation duration and injector flow quantity.  
> Multiplying injection duration by the injector constant yields a **fuel mass corresponding to a particular air mass for each stroke**.  
> Base setting selected for **λ = 1**.

Also (p. 39):

- λ correction map when fuel–manifold ΔP varies  
- **Battery-voltage corrector** for injector open/close time  
- **Effective** injection time = base + correction factors (individual or combined)

**REPO mapping:** XDF **Inj. Constant Factor (Ti) `0xD030`** + load-referred axes match this Bosch “injector constant × load” framing. Treat exact firmware algebra as still **CODE-unproven**.

### Injection calculation flowchart (p. 38 Fig. 1)

Order shown (family teaching; confirm in CODE):

1. Basic injection timing from load signal  
2. Injection timing for starting (separate)  
3. Post-start and warm-up correction  
4. Operating-point-dependent injection correction  
5. Lambda controller correction (when active)  
6. Overrun / engine or vehicle speed limiter → may switch injection **off**  
7. Transition compensation  
8. Correction at switch-in  
9. Battery voltage correction  
→ **Effective injection timing**

### Injection modes (p. 40)

Simultaneous / group / sequential — sequential has freest timing latitude. RedLabel sequential vs bank is a CODE question (do not assume from book alone).

### Dwell (p. 40)

Dwell varies coil current-flow period by **engine speed + battery voltage**; charge time from battery voltage with dynamic reserve for sudden high RPM; restricted at high RPM for arcing time.

**REPO mapping:** coil dwell / voltage correction table `0xE0DA`.

### Ignition advance (p. 41)

- Program map of **basic ignition timing vs load × speed** in ECU memory  
- Corrections: engine + intake-air temperature; other maps/conditions (idle / PT / WOT / start / warm-up); EGR / secondary air / dynamic accel; transmission adjustment; overrun; knock; idle-specific angle; advance limit  

Flow (p. 41 Fig. 4): base from load+rpm → temp / post-start / warm-up / overrun / switch-in / operating-point / knock / idle corrections → ignition point.

---

## 4. Operating conditions (selected) — booklet p. 42+

| Mode | Bosch teaching (p. 42) | RedLabel XDF hint |
|------|------------------------|-------------------|
| Start | Special injection quantity (temp-augmented wall film); special ignition vs temp+speed | Cranking fuel / cold tables |
| Post-start | Decay of enrich vs temp + time; ignition adjusted | Warm-up / post-start maps |
| Warm-up | Lean+retard **or** rich+secondary air strategies; higher idle possible | Cold enrich + idle RPM targets |
| (later chapters) | Idle control, lambda, overrun cut, knock, diagnosis | Matching XDF categories |

**Camshaft control** listed as OEM expander for emissions/consumption/output (pp. 18–19) — Bosch-level support for **VANOS dual map** application without specifying BMW tables.

---

## 5. Theory → RedLabel ROM checklist (use in cloud/local RE)

Use this PDF as **expected structure**; prove or refute in MCS-96 CODE:

| # | Theory (this PDF) | ROM / XDF target | Status |
|---|-------------------|------------------|--------|
| T1 | Primary load = air-mass kg/h (HFM) | MAF `0xD290`; ADC→lookup | Theory **PRIMARY**; CODE TBD |
| T2 | Load = air mass per stroke from mass + speed | D5 filtered load (inj-time referred) | Strong XDF; CODE TBD |
| T3 | `ti_base = f(load, injector_constant)`, λ≈1 | Ti `0xD030` + PT/WOT fuel maps | Strong XDF; CODE TBD |
| T4 | Correction stack + Vbat + lambda + overrun cut | Enrich / O2 / voltage / cut tables | Partial XDF |
| T5 | `zw_base = map(load, rpm)` + corrections − knock | PT/WOT ign VANOS maps; knock | Partial |
| T6 | Dwell = f(Vbat, rpm) | `0xE0DA` | XDF named; CODE TBD |
| T7 | TPS secondary / limp load | Alpha-N `0xDBC3` | Strong XDF |
| T8 | Camshaft control expander | VANOS dual fuel/ign maps | BMW app + XDF; CODE selector TBD |

**Do not** promote shipping maps from this PDF alone.

---

## 6. Cloud RE handoff note

**New evidence available locally:** Bosch M-Motronic Technical Instruction PDF under `tools/re/docs/`.  
Prior `motronic_331_function.md` treated book equations as HYPOTHESIS pending OCR — **H7 can now attach page cites** from §3 (booklet pp. 38–39).  
Prefer theory-vs-ROM work against this extract + XDF; do not re-borrow Archive.org for the same M-Motronic TI content.

Scratch OCR dump (gitignored): `tools/re/out/_pdf_extract/`.

---

*Extracted for BROtronic offline RE. Citations are booklet page numbers from the local PDF.*
