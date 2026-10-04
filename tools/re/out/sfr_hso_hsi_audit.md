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

## Channel decode

HSO_COMMAND bitfields select channel / set-clear / timer1|2 / interrupt. Observed immediates include 0x00,0x02,0x04,0x07,0x10,0x13,0x18,0x1A,0x20,0x21,0x22,0x27,0x30,0x33,0x51,0x70,0x71,0x74 — not yet mapped to coil vs injector vs VANOS vs fuel-pump.

Intel: writes to IOS0 (windowed) can also drive HSO pins directly; this ROM heavily uses HSI_status/HSI_time pairs instead.
