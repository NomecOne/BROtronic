# IRQ → RAM publications (vec2 / vec5)

ROM: `BMW DME413 SW623 D466.29 C16x900A 94 RedLabel.bin`

> RAM target roles are hypotheses from access patterns. Addresses themselves are proven store sites in Ghidra listing.

## `vec2_hsi_capture` @ `0xA88E` (vec2)

- Role hypothesis: **hsi_capture_crank_cam** (high)
- Reads HSI_time FIFO-style; publishes period/timestamp words at 0x14C0/0x14C2/0x14C4/0x14CC; may ST TIMER2 capture to 0x14CA; schedules HSO via LDB HSI_status,#0x74 + ADD HSI_time; toggles PORT2.

### RAM stores (proven sites)

| Site | Target | Role hypothesis | Insn |
|------|--------|-----------------|------|
| `0xA8FB` | `0x14C2` | period_hi_or_tooth_count | `ST RW60,0x14c2, TABLE[ZR]` |
| `0xA92B` | `0x14CA` | timer2_capture_copy | `ST TIMER2,0x14ca, TABLE[ZR]` |
| `0xA9B6` | `0x14C0` | hsi_edge_timestamp | `ST RW28,0x14c0, TABLE[ZR]` |
| `0xA9C0` | `0x14C4` | period_shadow | `ST RW5C,0x14c4, TABLE[ZR]` |
| `0xAA11` | `0x08FE` | port_shadow_ra4 | `STB RA4,0x8fe, LOOKUP[ZR]` |
| `0xAA26` | `0x12EE` | clear_word | `ST ZR,0x12ee, TABLE[ZR]` |
| `0xAA79` | `0x0409` | small_state_byte | `STB R43,0x409, LOOKUP[ZR]` |
| `0xAA8F` | `0x14CC` | derived_period_scale | `ST RW38,0x14cc, TABLE[ZR]` |
| `0xAADC` | `0x1455` | transient_clear | `STB ZRlo,0x1455, LOOKUP[ZR]` |
| `0xAAE1` | `0x156A` | clear_pair_a | `ST ZR,0x156a, TABLE[ZR]` |
| `0xAAE6` | `0x156C` | clear_pair_b | `ST ZR,0x156c, TABLE[ZR]` |
| `0xAAEB` | `0x1606` | limit_or_timeout | `ST RW8C,0x1606, TABLE[ZR]` |

### SFR / HSO schedule touches

- `0xA8BB` `ST TIMER2,RW80`
- `0xA8D3` `ST TIMER2,RW80`
- `0xA92B` `ST TIMER2,0x14ca, TABLE[ZR]`
- `0xA9C5` `LDB HSI_status,#0x74`
- `0xA9CB` `ADD HSI_time,RW7E,RW5C`

### PORT writes

- `0xA9D5` `STB RA3,PORT2`
- `0xAB0B` `STB RA3,PORT2`

## `vec5_adc_hso_schedule` @ `0xA4AA` (vec5)

- Role hypothesis: **adc_complete_plus_hso_schedule** (high)
- On IOS1.0: kicks AD channel, schedules HSO (#0x18/+0x1F4); samples AD_resulthi into 0x187C and channel ring via RW70; publishes port debounce counters 0x15D8/0x17C2; stages HSO cmds to 0x1600/0x1602; updates flags at 0x101E.

### RAM stores (proven sites)

| Site | Target | Role hypothesis | Insn |
|------|--------|-----------------|------|
| `0xA4E9` | `0x15D8` | port1_low_ debounced_counters | `ST RW46,0x15d8, TABLE[ZR]` |
| `0xA514` | `0x17C2` | port2_high_debounced_counters | `ST RW46,0x17c2, TABLE[ZR]` |
| `0xA522` | `0x18A5` | adc_isr_heartbeat_clear | `STB ZRlo,0x18a5, LOOKUP[ZR]` |
| `0xA530` | `0x187C` | adc_sample_byte | `STB R46,0x187c, LOOKUP[ZR]` |
| `0xA584` | `0x1600` | scheduled_hso_flags_or_pattern | `ST RW5C,0x1600, TABLE[ZR]` |
| `0xA5F0` | `0x1600` | scheduled_hso_flags_or_pattern | `ST ZR,0x1600, TABLE[ZR]` |
| `0xA5F8` | `0x1602` | hso_command_pair_staging | `ST RW44,0x1602, TABLE[ZR]` |
| `0xA5FF` | `0x1600` | scheduled_hso_flags_or_pattern | `ST ZR,0x1600, TABLE[ZR]` |
| `0xA610` | `0x1600` | scheduled_hso_flags_or_pattern | `ST ZR,0x1600, TABLE[ZR]` |
| `0xA639` | `0x101E` | run_mode_flags | `STB R5E,0x101e, LOOKUP[ZR]` |

### SFR / HSO schedule touches

- `0xA4B2` `LDB AD_resultlo,#0x8`
- `0xA4B5` `LDB HSI_status,#0x18`
- `0xA4BC` `LD HSI_time,RW86`
- `0xA52D` `LDB AD_resultlo,R44`
- `0xA557` `STB AD_resulthi,[RW44]`
- `0xA592` `LDB HSI_status,#0x1a`
- `0xA595` `ADD HSI_time,RW44,#0x32`
- `0xA5AC` `LDB HSI_status,#0x33`
- `0xA5AF` `LD HSI_time,RW44`
- `0xA5B3` `LDB HSI_status,#0x2`
- `0xA5B6` `LD HSI_time,RW44`
- `0xA606` `LDB HSI_status,0x1602, LOOKUP[ZR]`
- `0xA60B` `ADD HSI_time,TIMER1,#0x4`
- `0xA615` `LDB HSI_status,0x1603, LOOKUP[ZR]`
- `0xA61A` `ADD HSI_time,TIMER1,#0x4`

## Open questions

- Map 0x14C2/0x14CC to RPM/period engineering units
- Which AD channel index in [RW70] ring is MAF vs TMOT vs IAT
- Decode HSO_COMMAND immediates (#0x18/#0x1A/#0x13/#0x22/#0x74) to spark vs inj channels
