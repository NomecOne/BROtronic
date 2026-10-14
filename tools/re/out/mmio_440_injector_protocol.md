# MMIO `@0x440` injector-driver protocol (v15)

ROM: `BMW DME413 SW623 D466.29 C16x900A 94 RedLabel.bin`  
Method: `npm run re:shim -- disasm-at/xrefs` (local MCS-96 shim)

> Research note only. Absolute 69/69 unchanged. Do not auto-promote shipping.

## Verdict

| Claim | Status |
|-------|--------|
| Ti width → `@0x440` byte stream (not HSO_TIME) | **proven** |
| `R42`/`R43` = LE split of Ti word `RW42` / `0x1568` | **proven** |
| `PORT1.6` ready/busy handshake; dual-STB per byte | **proven** |
| `PORT1.7` → status shift into `RW8C` (fault timeout → `RC3.0`) | **proven** |
| Cylinder/bank via `RW8E` / `R8E.0` (not separate MMIO addrs for Ti) | **proven (index)** |
| Physical bank↔pin / ASIC ID / command opcode bits | **open** |
| HSO CH1 `#0x71/#0x51` = Ti width | **rejected** (phase/angle only) |

## Address map

| Addr | Role |
|------|------|
| `0x440` | External injector-driver FIFO/port (writes gated when `RW74==#0x440`) |
| `0x441` | Adjacent status/readback (`LDB` @`0x9172`/`0x9177`, XOR vs CAL) |
| `0x480` | Companion (`LOOKUP[RW74+0x40]` when `RW74=0x440`; init read @`0x9131`) |
| `RW74` | Latched `#0x440` @`0x51F6` (init); all fuel ISR writes check `CMP RW74,#0x440` |

## Handshake (PORT1)

```
wait PORT1.6 == 1   ; ready (timeout DJNZ #-0x1c → ORB RC3,#0x1)
DI                  ; (Ti path)
STB lo,[RW74] ×2    ; dual write
sample PORT1.7 → RW8C (SHL + ORB #1)  ; status bit
wait PORT1.6 == 0   ; accept / next-byte
STB hi,[RW74] ×2
EI
```

Init/diag path `@0x90CE` toggles the same `PORT1.6` sense between successive absolute `STB …,0x440` bytes (multi-byte program sequence).

## Ti final pulse — `0x1568` → `@0xB266`

Sites: enrich/clamp → `ST RW42,0x1568` @`0xB246` → gate @`0xB253`.

| Byte | Reg | Meaning |
|------|-----|---------|
| 1st | `R42` = `RW42[7:0]` | Ti pulse **low** |
| 2nd | `R43` = `RW42[15:8]` | Ti pulse **high** |

**Not** bank-select opcodes — pure little-endian on-time word after enrich.

## Bank / cylinder protocol

| Mechanism | Sites | Meaning |
|-----------|-------|---------|
| `RW8E` cylinder/phase index | `INC RW8E` @`0xAB5E`; wrap `CLR` when `>5` (unless `==8` or `RC3.5`); optional `XORB RC3,#0x40` | 6-cyl style counter |
| `R8E.0` bank bit | `@0xAF69`: `0x155e` vs `0x1560` preload into `RW40` before dual-byte xfer | Even/odd bank pulse words |
| Command + per-cyl data | `@0xB10D`: build `R38` with `ORB R38,R8E` (+ `RC7` masks / `#0x40` flag); then `0x154e[RW8E]` as 2nd byte | Cylinder in **data** select byte, same `@0x440` |
| Per-cyl dual-byte | `@0xAB8F`: `0x1457`/`0x145d[RW8E]` then `0x1556[RW8E]` (or `#0xFF` if `RC3.5`) | Indexed tables, not HSO |

**Hypothesis (medium):** external driver is a single FIFO; bank/cylinder selection is encoded in preceding command/index frames and/or even-odd `R8E.0` preload, while the Ti path only streams width.

## vs HSO CH1 (phase-only)

| Path | Imm / target | Carries Ti width? | Role |
|------|--------------|-------------------|------|
| HSO CH1 set | `#0x71` @`0xA7B1` | **No** (`RW5E` tooth-rel) | Angle sync |
| HSO CH1 clear | `#0x51` @`0xAF44` | **No** (tooth+`0x1A`) | Angle sync |
| MMIO `@0x440` | `R42`/`R43` from `0x1568` | **Yes** | Injector on-time |

CH1 does **not** program pulse width. Whether CH1 edges *gate acceptance* of `@0x440` transfers by the external ASIC is still open (no CODE proof either way).

## Related write families (same port)

| Family | Entry | Payload |
|--------|-------|---------|
| Ti width | `0xB253` | `R42`/`R43` = `0x1568` |
| Bank preload | `0xAF52` | `0x155e`/`0x1560` via `R8E.0` → `R40`/`R41` |
| Cyl command | `0xB10D` | select(`R8E`) + `0x154e[RW8E]` |
| Cyl tables | `0xAB8F` | `0x1457/145d` + `0x1556[RW8E]` |
| Init stream | `0x51CA` / `0x90CE` | Absolute `STB …,0x440` with P1.6 waits |

## Still open

- Exact command opcode bitfields in the `0xB10D` select byte (beyond `OR R8E`)
- Physical mapping of `RW8E` 0..5 → banks/cylinders/pins
- Identity of the `@0x440` ASIC / connector
- CH1 phase edge vs `@0x440` accept coupling
- CH2/CH3/CH4 HSO connector roles (unrelated to this FIFO)

## Related

- `tools/re/out/engine_control_dataflow_summary.md`
- `tools/re/out/irq_ram_publications.md`
- `tools/re/out/sfr_hso_hsi_audit.md`
