# Bosch Motronic 3.3.1 (M3.3.1) — MAF-based control concept (research note)

**Scope:** Offline RE context for BMW DME **HW413 / SW623 RedLabel** (MCS-96 CODE; DATA after `0xB930`).  
**Purpose:** Capture how Bosch describes Motronic fuel + ignition calculation (esp. **air-mass / HFM / HLM** systems), map that to expected ROM/XDF DATA categories, and list Ghidra CODE questions — without inventing RedLabel firmware facts.

**Evidence tiers used below**

| Label | Meaning |
|-------|---------|
| **PRIMARY** | Bosch publication / Bosch corporate history text |
| **SECONDARY** | Non-Bosch technical summaries (Wikipedia, tuner XDF notes) |
| **REPO** | This repo’s RedLabel XDF / ingest artifacts |
| **HYPOTHESIS** | Plausible Motronic structure not proven for RedLabel CODE |

Do **not** treat “general Motronic / ME-Motronic handbook” features as proven RedLabel implementations unless **REPO** or CODE confirms them.

---

## 1. Sources (cited)

### 1.1 Bosch / Bosch-adjacent books (preferred primary class)

Richard’s note that Bosch published short “how it works / what is calculated” books matches the Bosch **Technical Instruction** line, later collected into the **Gasoline-engine management** handbooks.

| Item | Specificity | Access / URL |
|------|-------------|--------------|
| Robert Bosch GmbH, *Gasoline-engine management* (1999). Foreword states it **combines manuals from the Bosch “Technical instruction” range** for gasoline-engine management. Cover callout: “New: ME-Motronic.” | **General Motronic / ME-era** (not 3.3.1-specific) | https://archive.org/details/gasolineenginema0000unse_u1b4 — metadata: https://archive.org/metadata/gasolineenginema0000unse_u1b4 |
| Robert Bosch GmbH, *Gasoline-engine management* (2006 ed.; Wiley). Cover: “New: bifuel-motronic” / “Systems and components.” | **General** (later than M3.3.1) | https://archive.org/details/gasolineenginema0000unse_d2u9 |
| Robert Bosch GmbH, *Gasoline-engine management : basics and components* (2001), ~87 pp. Short “basics” booklet in the same family. | **General** short book | https://archive.org/details/gasolineenginema0000unse (ISBN 3934584489) |
| Robert Bosch GmbH, *ME-Motronic engine management* (1999), Technical Instruction-style booklet. | **ME-Motronic** (successor architecture; useful for control *concepts*, not RedLabel CODE) | https://archive.org/details/isbn_3934584349 |
| Open Library work records for the same titles | Bibliographic cross-check | https://openlibrary.org/works/OL18345832W |

**Access note (research session):** Archive.org items above are **print-disabled / borrow-restricted**; full OCR download returned HTTP 401/403 from this environment. Citations below for *calculation equations inside those books* are therefore marked **HYPOTHESIS / book-family** unless a freely readable Bosch page is quoted.

### 1.2 Freely readable Bosch corporate text

| Item | Specificity | URL |
|------|-------------|-----|
| Bosch History / communications: **“25 years of Bosch Motronic: Think tank under the bonnet”** (May 2004). States Motronic combines ignition + gasoline injection; ECU memory holds data for **injection amount** and **ignition moment**; sensors supply **intake air amount**, **engine speed**, **crankshaft position**, **intake-air** and **engine temperatures**; processor compares sensors to program data and calculates next injection + ignition. | **General Motronic origin** (1979+), not 3.3.1-specific | Wayback: https://web.archive.org/web/20060623123242/http://www.bosch.com/content/language2/html/3074_3184.htm |
| Modern Bosch Mobility ECU overview (product page; not M3.3.1) | Marketing / architecture context only | https://www.bosch-mobility.com/en/solutions/control-units/engine-control-unit/ |

### 1.3 Secondary technical summaries

| Item | Specificity | URL |
|------|-------------|-----|
| Wikipedia *Motronic* — family overview; **M3.x = i196**; **M3.3.1 = BMW M50B25 with VANOS** | Secondary; useful for model placement | https://en.wikipedia.org/wiki/Motronic |
| Springer / Bosch handbook chapter listings (e.g. “Motormanagement M-Motronic”) | Bibliographic pointers to German Bosch handbook chapters | https://doi.org/10.1007/978-3-322-93840-4_8 ; https://doi.org/10.1007/978-3-322-93929-6_14 |
| NomecOne / BRO XDF definition pack (community + hardware/CODE-informed names) | **M3.3.1 HW413 SW623 RedLabel–specific DATA naming** | https://github.com/NomecOne/BMW-DME-M3.3.1 — XDF path in `tools/re/data/README.md` |

### 1.4 Repo definition evidence (RedLabel)

| Artifact | Role |
|----------|------|
| `tools/re/data/seed.xdf` (BRO XDF from NomecOne) | **Best def evidence** for map names, axes, MAF transfer, fuel/ign tables |
| `tools/re/out/candidates.pack.json` / `verification_report.md` | Ingest of XDF claims vs binary |
| `tools/re/README.md` | CODE through `0xB930` inclusive; DATA_CAL from `0xB931`; ISA MCS-96 |

---

## 2. What M3.3.1 is (placement)

| Claim | Tier | Notes |
|-------|------|-------|
| Motronic = combined digital **fuel injection + ignition** control | PRIMARY (Bosch 2004 history) | Core product definition |
| M3.x family uses Intel **196-class** MCU | SECONDARY (Wikipedia) | Aligns with this repo’s **MCS-96** conclusion for RedLabel |
| **M3.3.1** used on BMW **M50B25 + VANOS** | SECONDARY (Wikipedia) | Matches RedLabel / BRO XDF product framing |
| RedLabel bin is **MAF (HFM)-based**, not flapper AFM | REPO (XDF MAF cal `0xD290`, MAF fault limits, Alpha-N limp) | Treat as ECU-specific evidence |
| Exact Bosch marketing name “HLM” vs “HFM” for this car | HYPOTHESIS | German literature often uses *Heißfilm-Luftmassenmesser* (HFM); older texts also say HLM. XDF uses **MAF** / kg/h |

**3.3.1-specific vs general Motronic:** Almost all Bosch short-book calculation narrative is **family-level** (M-Motronic / air-mass systems). VANOS dual maps, BMW EWS, and this XDF’s exact table layout are **application / RedLabel** concerns — verify in CODE/DATA, do not assume from ME-Motronic books.

---

## 3. Control concept (sensors → load → fuel → spark → corrections)

### 3.1 High-level chain (Bosch-described + MAF application)

```
Sensors
  ├─ Air mass (HFM/MAF voltage)     ──► mass-flow transfer (kg/h)
  ├─ Crank speed / position         ──► RPM, timing reference
  ├─ Cam / cylinder ID (if present) ──► sequential phasing  [HYPOTHESIS for exact RedLabel use]
  ├─ Coolant temp (TMOT)
  ├─ Intake air temp (IAT; often in MAF housing)
  ├─ Throttle position (DK/TPS)
  ├─ Lambda / O2                    ──► closed-loop fuel trim when enabled
  ├─ Knock sensor(s)                ──► ignition retard  [present in XDF; CODE TBD]
  ├─ Battery voltage                ──► injector + coil dead-time/dwell
  └─ Vehicle speed / switches       ──► limits, idle modes, A/T states
        │
        ▼
Load (relative charge)
  Bosch narrative: air quantity + speed (+ temps) drive injection quantity & spark angle.
  RedLabel XDF: filtered load on axis D5, “in terms of injection time [ms *scaled*]”
  and tied to Inj. Constant (Ti) at 0xD030.
        │
        ├──────────────────────────────┐
        ▼                              ▼
Fuel injection pulsewidth (ti)     Ignition advance (zw)
  base from load×RPM maps            base from load×RPM maps
  × mode maps (PT / WOT /            × PT/WOT and idle tables
    VANOS adv/ret variants)          + cold/idle corrections
  × enrichment / lambda factors      − knock retard
  + voltage/latency correction       + coil dwell vs voltage/RPM
        │                              │
        ▼                              ▼
Injector drivers                   Ignition drivers
(+ idle air valve, VANOS, pump, lamps, diagnostics, immobilizer link…)
```

### 3.2 Calculated quantities Bosch describes (family-level)

From **PRIMARY** Bosch 2004 history text (explicit):

1. **Injection amount** (fuel quantity / pulse for the next injection event)
2. **Ignition moment** (spark advance timing)
3. Continuous recomputation from **sensor inputs vs stored program/data** (many discrete ignition possibilities stored)

From **Bosch Technical Instruction / Gasoline-engine management book family** (standard Motronic teaching; treat equations as **HYPOTHESIS** until a page quote is attached, but these are the usual calculated intermediates):

| Quantity | Typical role | Notes |
|----------|--------------|-------|
| Air mass flow \(\dot{m}_L\) | From HFM transfer | Voltage → kg/h (or mg/stroke after /n) |
| Relative load / air charge | Air per combustion cycle | Often normalized; RedLabel XDF presents load as **injection-time-scaled** |
| Basic injection time \(t_i\) | Stoichiometric fuel for measured air | Scaled by injector constant |
| Correction factors | Warm-up, accel, WOT, lambda, etc. | Multiplicative and/or additive |
| Battery voltage correction | Injector opening delay | Additive time |
| Ignition angle | Base map + corrections − knock | Degrees relative to TDC |
| Dwell / coil charge time | Energy for spark | Voltage & RPM dependent |
| Idle air setpoint / duty | Closed-loop idle | IAC / ZWD style actuator |
| Lambda controller output | Closed-loop AFR | Enabled only in defined windows |

**REPO alignment (RedLabel XDF):** “Inj. Constant Factor (Ti)” is described as a multiplication factor for **theoretical pulsewidth** when changing injectors/MAF; **all LOAD-axis tables must be rescaled** with it — strong evidence that this ECU’s “load” is **injection-time-referred**, consistent with air-mass Motronic practice.

### 3.3 Correction / mode structure (what to expect)

| Function | General Motronic | RedLabel evidence (XDF) | Status |
|----------|------------------|-------------------------|--------|
| Cold / warm-up enrich | Yes (family) | Cold engine enrich tables; cranking lambda; warm-up suspect tables | REPO map names |
| Acceleration enrich | Yes | Delta-LOAD transfer; accel enrich lambda / fade / attenuation | REPO |
| WOT enrich / open-loop | Yes | Fuel WOT VANOS adv/ret; Lambda OFF RPM/load thresholds | REPO |
| Part-throttle base fuel | Yes | Fuel PT VANOS adv/ret 16×12 | REPO |
| Idle fuel / timing | Yes | Idle base fuel; idle ignition; idle RPM targets vs TMOT | REPO |
| Lambda / O2 closed loop | Optional by market | O2 adaptation enable; target AFR/lambda; OFF thresholds | REPO |
| Voltage correction | Yes | Fuel voltage correction (injector latency); coil dwell map | REPO |
| Knock retard | Common on M3.x | Knock DTC; sensitivity; knock-related tables (some uncertain) | REPO partial |
| Overrun fuel cut | Common | Suspect overrun cut table near `0xDC79` | HYPOTHESIS (XDF uncertain) |
| MAF fault limp (Alpha-N) | Common failsafe | `0xDBC3` Alpha-N → load translation | REPO |
| VANOS | BMW application | Many VANOS dwell / load threshold / dual fuel+ign maps | REPO (BMW-specific) |
| EWS / immobilizer | BMW application | **Not established from Bosch books**; may be BMW wiring/CODE | **OPEN / HYPOTHESIS** — do not claim without CODE |
| Adaptive long-term trim | Common on later Motronic | O2 adaptation flag; adaptation tables TBD in CODE | Partial |

---

## 4. Expected DATA categories in ROM / XDF (RedLabel)

Memory reminder (**REPO**): CODE through **`0xB930` inclusive**; calibration DATA typically from **`0xB931`**.

### 4.1 XDF category taxonomy (seed.xdf)

Theory, Unknown, **Fuel**, **Ignition**, **Air Related**, **Sensors**, RPM and Speed Limits, **Knock**, BIN Info, **Vanos**, RPM Axis D0, **Load Axis D5**, **Alpha N / MAF limp**, A/T, Danger Zone, Voltage Axis D8, Deprecated, Temp Axis D7, Axis NON-Pure.

### 4.2 Axis / runtime register hints (XDF INFO — REPO, still partially hypothesised)

| Tag | XDF meaning |
|-----|-------------|
| D0 | Engine RPM |
| D5 | Load filtered? in injection-time ms (scaled) |
| D6 | Load unfiltered? / TPS-related? |
| D7 | Coolant temp TMOT |
| D8 | Battery voltage |
| D4 | IAT °C |
| CC | TPS-derived (Alpha-N limp) |
| 46–47 | Mass air 16-bit raw? (**HYPOTHESIS** in XDF itself) |

### 4.3 Priority DATA tables to find / verify

**Air / MAF**

- MAF transfer **voltage → kg/h** (`0xD290`, 256-point)
- MAF plausibility: high/low kg/h limits, MAF/RPM ratio, RPM enable for check
- IAT / CLT transfer + fault substitute values
- TPS min/max diagnostic limits
- Alpha-N limp load synthesis (`0xDBC3`)

**Fuel**

- Injector constant / Ti (`0xD030`) — global scale for load-referred system
- Target lambda / AFR (`0xD06A`)
- Cranking fuel
- Cold enrich (manual vs A/T)
- Idle fuel base
- PT fuel maps (VANOS retarded / advanced), axes RPM×Load
- WOT fuel maps (VANOS retarded / advanced)
- Accel enrich pack (delta load TF, lambda corr, fade, attenuation)
- Voltage / injector latency correction
- Individual cylinder trim (if used)
- Soft rev-limit fuel cut; speed limiter interaction

**Ignition**

- PT timing maps (VANOS ret/adv), RPM×Load
- WOT timing maps (VANOS ret/adv)
- Idle timing + cold idle timing corrections
- Coil dwell vs voltage/RPM
- Timing delta during speed-limiter fuel cut
- Knock correction / sensitivity / enable thresholds

**Idle / air path**

- Idle RPM targets vs TMOT (multiple gearbox/AC modes)
- Idle control valve airflow / overrun duty tables

**Lambda / diagnostics**

- Lambda enable/disable windows (RPM/load)
- O2 adaptation on/off
- O2 DTC thresholds; MAF/TPS/temp/speed DTC parameters
- Stomp / flash codes tables

**VANOS / drivability extras**

- VANOS advance/retard dwell vs RPM/load/temp
- Load thresholds for VANOS state

---

## 5. Open questions for Ghidra RE (what CODE must implement)

Use these as search targets in MCS-96 listing / CFG (`tools/re/out/ghidra/`, `mcs96_cfg_edges.*`). Prefer proving **callers of DATA addresses** over assuming handbook features.

### 5.1 Air → load pipeline

1. Where is ADC MAF voltage read, filtered, and looked up through **`0xD290`**?
2. How is **kg/h → load (D5)** computed (divide by RPM? scale by Ti constant `0xD030`?)?
3. Exact filter: raw vs filtered load (D5 vs D6); accel path using **`0xD4F8`** delta-LOAD TF.
4. MAF fault detection vs limp: when is **`0xDBC3` Alpha-N** substituted for HFM load?

### 5.2 Fuel pulsewidth

5. Compose equation for final injector ON time:  
   `ti = f(base_map(load,rpm,vanos), enrichments, lambda, + voltage_corr)` — confirm operator order in CODE.
6. Confirm bank/sequential injection scheduling and any end-of-injection angle tables (XDF notes on SOI/EOI).
7. Cranking vs run mode switch; overrun cut enable logic (`0xDC79` **uncertain**).
8. Closed-loop lambda: PID/adaptation RAM, enable gates (`0xE364`…), interaction with WOT maps (XDF rumor: O2 path related to WOT map selection — **verify**).

### 5.3 Ignition

9. Base angle interpolation from PT/WOT VANOS maps; conversion using 60-2 / 0.75° factor documented in XDF INFO.
10. Dwell calculation from **`0xE0DA`** (and related); coil charge scheduling vs RPM.
11. Knock: ADC path, retard accumulator, which tables actually multiply into spark (and fuel) — several XDF knock labels are explicitly uncertain.

### 5.4 Modes & BMW application

12. Idle controller: target RPM tables → IAC duty (`0xE3CC` etc.).
13. VANOS solenoid strategy vs dual map selection (how CODE chooses adv vs ret fuel/ign maps).
14. **EWS / immobilizer**: is there a handshake / fuel-enable gate in this SW623 image? (**Do not assume**; search COM/SPI/UART and enable flags.)
15. A/T load signal maps (`0xE065` / `0xE0B3`) — transmission vs knock mislabel.

### 5.5 Structural RE hygiene

16. Map every XDF cal address to CODE xrefs (read-only table walks).
17. Identify main 10 ms / ignition-sync tasks vs background diagnostics.
18. Separate **checksum / coding** regions from live cal.

---

## 6. Hypotheses checklist (keep labeled)

| ID | Statement | Status |
|----|-----------|--------|
| H1 | RedLabel implements classic Bosch **HFM → load → ti / zw** structure | **Likely** (XDF); not CODE-proven end-to-end |
| H2 | Load axis is **injection-time-referred** and scaled by Ti constant | **Strong REPO** (XDF text); confirm math in CODE |
| H3 | Dual PT/WOT maps selected by VANOS state | **Strong REPO**; confirm selector in CODE |
| H4 | Alpha-N map is MAF-fail limp load generator | **Strong REPO**; confirm fault path |
| H5 | Full ME-Motronic / torque-structure features exist here | **Unlikely / do not assume** (ME books are later) |
| H6 | EWS fuel lock present in this binary | **Unknown** |
| H7 | Exact Bosch book equation \(t_i = \frac{m_L}{n}\cdot c_{\mathrm{inj}}\cdot\prod k_i + t_{\mathrm{bat}}\) | **Family HYPOTHESIS** — attach page cite when OCR available |

---

## 7. Practical reading order for offline RE

1. Bosch 2004 Motronic history page (intuition: sensors → injection + ignition).  
2. Bibliographic Bosch Technical Instruction / *Gasoline-engine management* (family calculations — borrow locally if needed).  
3. This repo XDF (`seed.xdf`) for **what tables exist on RedLabel**.  
4. Ghidra MCS-96: prove CODE chains for MAF→load→ti and load→zw.

---

## 8. Research session notes

- Web search tool was unavailable in this subagent turn; discovery used Wikipedia API, Archive.org metadata/search, Crossref DOIs, Wayback Bosch history page, and local XDF/ingest.
- Temporary fetch artifacts under `tools/re/out/_*` (if present) are scratch only and should not be treated as sources of truth.
- **Best freely readable primary link found:** Bosch “25 years of Motronic” history text (Wayback URL in §1.2).  
- **Best book-family primary targets:** Archive.org *Gasoline-engine management* (1999 combined Technical Instruction) + short *basics and components* (2001) + *ME-Motronic engine management* (1999).  
- **Best ECU-specific def evidence:** BRO XDF from NomecOne/BMW-DME-M3.3.1.

---

*Generated for BROtronic offline RE (`tools/re`). Update this file when CODE xrefs confirm or refute H1–H7.*
