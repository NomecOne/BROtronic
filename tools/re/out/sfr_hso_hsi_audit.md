# SFR audit: HSO vs HSI (spark/inj scheduling)

ROM: `BMW DME413 SW623 D466.29 C16x900A 94 RedLabel.bin` / `MCS96:LE:16:default`

**Status: `cross_checked`** — Ghidra names bytes 0x04/0x06 only as HSI_time/HSI_status. Per Intel 80C196KB, those addresses are R/W aliases: WRITE 0x06=HSO_COMMAND, WRITE 0x04=HSO_TIME; READ 0x06=HSI_STATUS, READ 0x04=HSI_TIME. Therefore LDB HSI_status,#imm + LD/ADD HSI_time in this ROM are High-Speed Output schedules (spark/inj/CAM candidates), while LD RWx,HSI_time are true HSI capture reads.

## Sources

- Ghidra MCS96.sinc RAM SFR map @0x00
- Intel 80C196KB User's Guide (HSO_COMMAND/HSI_STATUS @06H; HSO_TIME/HSI_TIME @04H)
- Usage patterns in RedLabel listing (command-then-time write pairs)

## Ghidra SFR byte map (relevant)

| Off | Ghidra name | Intel note |
|-----|-------------|------------|
| `0x00` | ZRlo/ZR | fixed |
| `0x02` | AD_result | R/W windowed on some parts |
| `0x04` | HSI_time (Ghidra name) | READ=HSI_TIME; WRITE=HSO_TIME (Intel) |
| `0x06` | HSI_status (Ghidra name) | READ=HSI_STATUS; WRITE=HSO_COMMAND (Intel) |
| `0x07` | SBUF | TX/RX windowed |
| `0x08` | INT_MASK |  |
| `0x09` | INT_PEND |  |
| `0x0A` | TIMER1 | WDT kick uses TIMER1lo writes in this firmware |
| `0x0C` | TIMER2 |  |
| `0x0E` | PORT0 |  |
| `0x0F` | PORT1 | GPIO; also sampled in vec5 |
| `0x10` | PORT2 | GPIO; crank/cam related bits hypothesized |
| `0x11` | SP_STAT |  |
| `0x14` | WSR | window select — unused in listing (0 refs) |
| `0x15` | IOS0 |  |
| `0x16` | IOS1 | HSO status bits on read; vec2/vec5 gate on IOS1 |
| `0x17` | IOS2 |  |

## Counts

- HSO command/time writes (named HSI_* in listing): **66**
- True HSI_time reads (`LD RWx,HSI_time`): **13**
- WSR refs: **0** (windowing not used in visible CODE)

## Observed HSO_COMMAND immediates

`0x0`, `0x10`, `0x13`, `0x18`, `0x1a`, `0x2`, `0x20`, `0x21`, `0x22`, `0x27`, `0x30`, `0x33`, `0x4`, `0x51`, `0x7`, `0x70`, `0x71`, `0x74`

## Channel decode (v13)

Intel `HSO_COMMAND` bitfield: `7:T2RST 6:T2CAM 5:SET 4:INT 3–0:CHANNEL`  
Channels: `0–5` = HSO.0–.5; `6` = HSO.0+.1; `7` = software timer; `E` = start A/D; `F` = reset Timer2.

| Imm | Bitfield | Role | Evidence |
|-----|----------|------|----------|
| `#0x70` | T2CAM+SET+INT+**CH0** | **Coil/spark** | `0x1502`→`0x1480` queue→`0xB696`; drain `0x3E3A` |
| `#0x30` | SET+INT+CH0 | Ign TIMER1 arm | `0xB69F` same ign path |
| `#0x20` | SET+CH0 | Ign drain fallback | `0x3E43` |
| `#0x10` | INT+CH0 | CH0 clear+IRQ | `0x3F38`/`0x3F61` |
| `#0x71` | T2CAM+SET+INT+**CH1** | Injector-bank **candidate** | `0xA7B1`/`0xA7DD` (tooth-relative; Ti link open) |
| `#0x51` | T2CAM+INT+CH1 | CH1 clear/sync | `0xAF44` tooth+`0x1A` (not Ti width) |
| `#0x74` | T2CAM+SET+INT+**CH4** | Crank-sync / cam-side | vec2 `0xA9C5` + `STB RA3,PORT2` |
| `#0x18` | INT+CH8 | ADC period timer | vec5 `0xA4B5` (+`0x1F4`) |
| `#0x1A` | INT+CH10 | Timed companion | vec5 `0xA592`/`0xA621` |
| `#0x33`/`#0x13` | CH3 set+int / int | Aux pair | vec5 |
| `#0x22`/`#0x02` | CH2 set / clear | Aux pair | vec5 / init |

**Proven actuator:** ignition advance RAM → **HSO.0**.  
**Open:** Ti pulse RAM → injector on-time (CH1 hypothesized). CH2/3/4 connector identity.

Intel: writes to IOS0 (windowed) can also drive HSO pins directly; this ROM heavily uses HSI_status/HSI_time pairs instead.
