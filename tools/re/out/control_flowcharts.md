# Engine control flowcharts — RedLabel MCS-96

ROM: `BMW DME413 SW623 D466.29 C16x900A 94 RedLabel.bin`  
Addressing: FE14 CAL bases (`RW68=0xD002`, `RW6A=0xD106`, `RW6C=0xD28E`, `RW6E=0xE67E`)

> Research-only Mermaid views of proven CODE paths. Nodes carry absolute addresses. CAL reads link to [`tuning_data_catalog.md`](tuning_data_catalog.md). Do **not** invent unproven actuator pin maps. Do **not** auto-promote shipping packs.

**Legend:** solid edges = CODE-proven; dashed = hypothesis / open. Actuator close: **Ign → HSO.0 `#0x70`**; **Ti → MMIO `@0x440`** (not HSO width).

---

## 1. Boot → foreground init → enable IRQs

```mermaid
flowchart TD
  RST["VECTOR_Reset @0x2080<br/>TIMER1lo WDT kick"] --> SPIN{"spin until<br/>[0x4000]==0x5AA5"}
  SPIN --> LJ4120["LJMP 0x4120"]
  LJ4120 --> HW["LJMP 0x476B<br/>HW init: SP, IOS0/1, AD, HSI_*, PORT1/2"]
  HW --> LJ2097["LJMP 0x2097"]
  LJ2097 --> RAM["FUN_3679<br/>RAM copy / integrity"]
  RAM --> FG["FUN_4815 @0x4815<br/>watchdog, PORT mirror, HSI sync"]
  FG --> MASK["INT_MASK / clear INT_PEND<br/>schedule HSO channels"]
  MASK --> EI["EI @0x491F"]
  EI --> FORE["Foreground after EI<br/>hypothesis: task schedule ~0x4Axx"]
  FG -.-> CAL["FE14 CAL loader<br/>0x412C → 0x20B5 → 0x2EDB<br/>RW68/6A/6C/6E"]
  CAL --> BASES["RW68=0xD002 · RW6A=0xD106<br/>RW6C=0xD28E · RW6E=0xE67E"]
  FORE --> TRAMP["Trampolines 0x20C7 / 0x20CD<br/>map interp helpers"]
  TRAMP --> MAPH["0x33C2 / 0x343C<br/>shared axis/map interpolate"]
```

CAL catalog: all long-index / descriptor items depend on FE14 bases — see [tuning catalog](tuning_data_catalog.md).

---

## 2. Main control sketch (sensors → cal → actuators)

```mermaid
flowchart LR
  subgraph IRQ["IRQs"]
    V2["vec2 HSI @0xA88E<br/>period 0x14CC"]
    V5["vec5 ADC @0xA4AA<br/>MAF → RW64"]
  end
  subgraph CAL["CAL DATA"]
    MAF["MAF 0xD290"]
    TI["Ti 0xD030"]
    IGN["Ign maps<br/>e.g. 0xDD0F"]
    LIM["MAF limits<br/>0xD23C/E/0/4"]
  end
  subgraph RAM["Runtime RAM"]
    P["0x14CC period"]
    A["RW64 air sum"]
    TP["0x153A / 0x1540 Ti pulse"]
    IA["0x1502 / 0x1512 ign advance"]
  end
  subgraph OUT["Outputs proven"]
    HSO0["HSO.0 #0x70<br/>coil / spark"]
    MMIO["MMIO @0x440<br/>STB R42 Ti width"]
  end
  V2 --> P
  V5 --> MAF
  MAF --> A
  A --> TI
  P --> TI
  TI --> TP
  TP --> MMIO
  V5 --> LIM
  IGN --> IA
  IA --> HSO0
  MAP["interp 0x20CD"] -.-> IGN
```

---

## 3. Fuel path — MAF / load → Ti → `@0x440`

```mermaid
flowchart TD
  ADC["vec5 @0xA4AA<br/>AD_resulthi → 0x187C"] --> IDX["0xA52A..0xA53B<br/>RW46 = RW6C + 2·ADC"]
  IDX --> MAFR["ADD RW64, 0x2[RW46]<br/>CAL MAF table 0xD290"]
  MAFR --> ACC["RW64 air-mass accum"]
  V2R["vec2 @0xAA44<br/>CLR RW64 window reset"] -.-> ACC
  ACC --> AB["FUN_ab11<br/>ΔRW64 → cyl load proxy"]
  PER["period 0x14CC<br/>from vec2"] --> TIMATH["Ti math<br/>load × 0x32 × period / Ti"]
  AB --> TIMATH
  TIC["CAL Ti 0xD030<br/>@0x9A82 DIVU TABLE[RW68]<br/>@0xAFC7 LD 0x2e[RW68]"] --> TIMATH
  TIMATH --> R153A["ST pulse → 0x153A @0x9A92"]
  TIC2["@0xAFC7 path"] --> R1540["0x1540 alt pulse @0xAFDF"]
  TRIM["cyl trim 0xD0FA<br/>@0x5B6B LOOKUP"] -.-> R153A
  CUT["soft cut 0xD032<br/>@0xADD5 CMP"] -.-> TIMATH
  R153A --> AE18["0xAE18 → RW8A"]
  AE18 --> ENR["enrich / scale @0xAFC7.."]
  ENR --> B246["ST 0x1568 @0xB246"]
  B246 --> GATE{"RW74 == 0x440?<br/>PORT1.6 handshake"}
  GATE -->|yes| W440["STB R42 ×2 / R43 ×2<br/>@0xB266 / @0xB281<br/>LE Ti width → MMIO 0x440"]
  CH1["CH1 #0x71 @0xA7B1 / #0x51 @0xAF44<br/>angle sync only — NOT Ti width"] -.-> GATE
```

| CAL item | Catalog |
|----------|---------|
| `0xD290` MAF | [`tuning_data_catalog.md`](tuning_data_catalog.md) domain `sensor` |
| `0xD030` Ti | catalog domain `fuel` |
| `0xD0FA` cyl trim | catalog domain `fuel` |
| `0xD032` soft cut | catalog domain `fuel` |

Full fuel/ign axes: see catalog domains `fuel` / `ignition`.

---

## 4. Ignition path — maps → advance RAM → HSO.0

```mermaid
flowchart TD
  SEL["select LD RW1A,#0x9A<br/>@0x66EC"] --> CALL["→ 0x6987 → LCALL 0x20CD"]
  CALL --> TR["trampoline 0x20CD<br/>LJMP 0x343C"]
  TR --> DESC["ADD RW1A,RW6E<br/>LD RW4C,[RW1A]<br/>slot → ptr 0xDD0D / XDF 0xDD0F"]
  DESC --> BODY["map body walk via [RW4C]"]
  BODY --> ADV["publish advance<br/>0x1502 @0x6964<br/>shadows 0x150A/0x150C"]
  ADV --> CLAMP["clamp 0x1512<br/>@0xB48E …"]
  CLAMP --> CONS["consumer @0xB5B3<br/>LD from 0x1502"]
  CONS --> Q["queue 0x1480 / 0x14A0"]
  Q --> HSO["HSO_COMMAND #0x70 @0xB696<br/>T2CAM+SET+INT+CH0 = coil/spark"]
  Q -.-> HSO30["fallback #0x30 @ TIMER1+4"]
  DRAIN["drain @0x3E3A / #0x20 @0x3E43"] -.-> HSO
  OTHER["Other ign axes<br/>0xDD89 / 0xDE6D / 0xDF4D …<br/>via RW6E descriptors"] -.-> DESC
  DWELL["dwell E0DA / WOT dwell axes<br/>descriptor family"] -.-> BODY
```

| CAL item | Role | Catalog |
|----------|------|---------|
| `0xDD0F` | Ign WOT VANOS-ret RPM axis (**proven** select path) | [catalog](tuning_data_catalog.md) |
| `0xDD89` / `0xDE6D` / `0xDF4D` | Sibling ign RPM axes | catalog `ignition` |
| `0xE0DA` | Coil voltage/dwell table | catalog `ignition` |

---

## 5. IRQ vector bank

```mermaid
flowchart TD
  VEC["IRQ vectors @0x2000"] --> STUB["stubs @0x4178+"]
  STUB --> V0["vec0 → 0xA479<br/>ios0_edge_timer_tick<br/>hypothesis medium"]
  STUB --> V1["vec1 → 0xA4A9 RET<br/>unused proven"]
  STUB --> V2["vec2 → 0xA88E<br/>hsi_capture_crank_cam<br/>HIGH"]
  STUB --> V3["vec3 → 0xA640<br/>ios0_state_machine<br/>hypothesis medium"]
  STUB --> V4["vec4 → 0xA4A9 RET<br/>unused proven"]
  STUB --> V5["vec5 → 0xA4AA<br/>adc_hsi_schedule + MAF<br/>HIGH"]
  STUB --> V6["vec6 → 0x20AF → FUN_2eaa<br/>serial_sbuf hypothesis"]
  STUB --> V7["vec7 → 0xA49E<br/>counter_overflow_helper"]

  V2 --> P14["period RAM 0x14C0..0x14CC"]
  V2 --> H74["HSO #0x74 crank/cam sync"]
  V2 --> CLR["CLR RW64 air window"]
  V5 --> ADK["AD kick + HSO #0x18"]
  V5 --> MAF2["MAF ADD @0xA53B → 0xD290"]
  V5 --> H1A["HSO #0x1A / #0x33 / #0x22 …"]
```

IRQ roles for vec0/3/6/7 are **hypotheses**; vec2/vec5 targets and MAF absolute read are **proven**. Details: [`irq_ram_publications.md`](irq_ram_publications.md), [`control_loops.md`](control_loops.md).

---

## 6. CAL read mechanisms (how catalog CODE refs work)

```mermaid
flowchart LR
  subgraph Long["Long-index / LOOKUP"]
    L1["RW68/6A + imm<br/>e.g. Ti @0x9A82"]
  end
  subgraph MAF["MAF word table"]
    M1["RW6C + 2·ADC<br/>@0xA53B → 0xD290"]
  end
  subgraph Desc["Descriptor header"]
    D1["LD RW1A,#idx<br/>selectSites"]
    D2["0x20C7/0x20CD<br/>ADD RW1A,RW6E"]
    D3["LD RW4C,[RW1A]<br/>ptr → XDF body"]
    D1 --> D2 --> D3
  end
  Long --> CAT["tuning_data_catalog<br/>69 CODE-ref entries"]
  MAF --> CAT
  Desc --> CAT
```

---

## Flowchart index

| # | Diagram | Focus |
|---|---------|--------|
| 1 | Boot → EI | Reset, HW init, FE14 bases |
| 2 | End-to-end sketch | Sensors → CAL → HSO.0 / 0x440 |
| 3 | Fuel path | MAF → Ti → MMIO 0x440 |
| 4 | Ignition path | Descriptor → advance → HSO.0 |
| 5 | IRQ bank | Vectors + proven vec2/vec5 pubs |
| 6 | CAL mechanisms | Long-index / MAF / descriptor |

**Flowchart count: 6**

---

## Related

- [`tuning_data_catalog.md`](tuning_data_catalog.md) / [`tuning_data_catalog.json`](tuning_data_catalog.json)
- [`engine_control_dataflow_summary.md`](engine_control_dataflow_summary.md) — summary + actuator close
- [`mmio_440_injector_protocol.md`](mmio_440_injector_protocol.md)
- [`absolute_code_reads.json`](absolute_code_reads.json)
- [`ignition_fuel_dataflow.md`](ignition_fuel_dataflow.md)
- [`sfr_hso_hsi_audit.md`](sfr_hso_hsi_audit.md)

---
Research-only. Verification gates for promotion unchanged.
