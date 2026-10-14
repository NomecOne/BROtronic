# MMIO `@0x440` injector-driver protocol (v16)

ROM: `BMW DME413 SW623 D466.29 C16x900A 94 RedLabel.bin`  
Method: `npm run re:shim -- disasm-at/xrefs` + `ghidra_listing.txt` scan

> Research note only. Absolute 69/69 unchanged. Do not auto-promote shipping.

## Verdict

| Claim | Status |
|-------|--------|
| Ti width → `@0x440` byte stream (not HSO_TIME) | **proven** |
| `R42`/`R43` = LE split of Ti word `RW42` / `0x1568` | **proven** |
| `PORT1.6` ready/busy; dual-STB; `PORT1.7`→`RW8C` | **proven** |
| Command-frame bitfield beyond `OR R8E` | **proven (masks)** |
| `RW8E` = phase counter mod 6; even/odd banks; sync anchors 0↔3 | **proven (CODE)** |
| OEM cylinder numbers 1..6 / connector pins | **open** |
| CH1 HSO edges software-gate `@0x440` accept | **rejected** |
| CH1 may still phase-align hardware externally | **open (HW)** |
| `@0x440` ASIC identity | **open** |

## Address map

| Addr | Role |
|------|------|
| `0x440` | External injector-driver FIFO/port (`RW74==#0x440`) |
| `0x441` | Status/readback |
| `0x480` | Companion (`RW74+0x40`) |
| `RW74` | Latched `#0x440` @`0x51F6` |

## Handshake (PORT1)

```
wait PORT1.6 == 1   ; ready (timeout DJNZ #-0x1c → ORB RC3,#0x1)
DI                  ; (Ti / command paths)
STB lo,[RW74] ×2
sample PORT1.7 → RW8C (SHL + ORB #1)
wait PORT1.6 == 0
STB hi,[RW74] ×2
EI
```

**Accept gate in CODE = PORT1.6/1.7 only** — no HSO/IOS1/CH1 bit test before any `STB [RW74]`.

## Ti final pulse — `0x1568` → `@0xB266`

| Byte | Reg | Meaning |
|------|-----|---------|
| 1st | `R42` | Ti `[7:0]` |
| 2nd | `R43` | Ti `[15:8]` |

## Command frame `@0xB10D` (opcode bits)

Builder:

```
wait PORT1.6 set
if RC3.5:                    ; "indexed" mode
  ORB RC3,#0x10
  R38 = (RC7 & 0xB8) | R8E   ; #-0x48 → keep RC7 bits 7,5,4 + cyl
  ANDB RC3,#-0x21            ; clear RC3.0 + RC3.5
else:
  R38 = RC7 & 0xA8           ; #-0x58 → RC7 bits 7,5,3 only (no R8E)
if (RC7 & 0x47) != 0:        ; bits 0|1|2|6 set
  ORB R38,#0x40
  ORB RB6,#0x8
DI; STB R38 ×2; sample P1.7
R38 = 0x154e[RW8E]           ; per-index data byte
wait PORT1.6 clear; STB R38 ×2; EI
```

### Select-byte bitfield (proven from masks)

| Bit | When present | Source |
|-----|--------------|--------|
| `[2:0]` (+ low nibble) | `RC3.5` path only | `R8E` cylinder/phase index 0..5 |
| `3` (`0x08`) | `!RC3.5` (`&0xA8`) | `RC7.3` (enrich path sets `@0x9D93`/`0xB0AC`) |
| `4` (`0x10`) | `RC3.5` (`&0xB8`) | `RC7.4` (period path `@0xAAAB`/`0xACF7`) |
| `5` (`0x20`) | both masks | `RC7.5` (mode vs CAL `@0x5573`) |
| `6` (`0x40`) | forced if `RC7&0x47` | Composite inhibit/fault family (also tested `@0x8A00`) |
| `7` (`0x80`) | both masks | `RC7.7` |

`RC7&0x47` family (bits 0,1,2,6): treated as a unit — any set forces command `0x40` and `RB6.3`. Exact per-bit OEM names still medium; composite role = **inhibit/special** (gate @`0x8A00`).

2nd byte = `0x154e[RW8E]` (per-index payload), not further opcode.

## `RW8E` → bank / cylinder (as far as CODE allows)

| Fact | Evidence | Confidence |
|------|----------|------------|
| Counter range **0..5** (6 phases) | `INC`; wrap `CLR` when `>5` (unless `==8` or `RC3.5`) @`0xAB5E` | **proven** |
| Expected next = `(R8E+1) mod 6` | `ADDB RB5,R8E,#1`; `CMPB #6`→`CLRB` @`0x9CE0` | **proven** |
| Sync anchors **0** and **3** | After HSO `#0x74` @`0xA9C5`: `RW8E/RB5 ← 0` or `3` via `PORT2.3` + tooth window `#0x74` @`0xA9D8`…; twin @`0xAEED`/`0xAF0C`; pattern lock `RA9==0x55→0`, `RA9==0xAA→3` @`0xAF21` | **proven** |
| Even/odd = two banks | `R8E.0`: `0x155e` vs `0x1560` @`0xAF69` | **proven** |
| Ign uses `(R8E+RB0) mod 6` | `@0xB6B4` / `@0xB41A` | **proven** |
| Companion index `(R8E−2) mod 6` | `@0xB6E9` | **proven** |
| Per-cyl air word index `2×RW8E` | `ADD RW3E,RW8E,RW8E` → `0x17da`… @`0xADE4` | **proven** |

**Interpretation:** `RW8E` is a **mod-6 phase/cylinder slot** with half-engine sync at 0 vs 3 (opposite bank). Even/odd selects bank pulse words. CODE does **not** label OEM cylinder numbers 1–6 or connector pins — that needs firing-order / pinout beyond these indices.

## CH1 HSO vs `@0x440` accept — test result

| Test | Result |
|------|--------|
| Does any `@0x440`/`[RW74]` write wait on CH1 / HSO / IOS1 bit? | **No** — only `PORT1.6`/`PORT1.7` |
| `#0x71` path (`0xA7B1`/`0xA7DD`) followed by MMIO write? | **No** — routine returns |
| `#0x51` @`0xAF44` then bank preload @`0xAF52`? | **Yes, adjacent** — but `EI` then **PORT1.6** wait; no CH1 status poll |

**CODE verdict:** CH1 does **not** software-gate `@0x440` accept. `#0x51` before bank word is **phase scheduling** (angle sync), not an accept handshake. Whether the external ASIC also watches the CH1 pin is **hardware-open**.

## Related write families

| Family | Entry | Payload |
|--------|-------|---------|
| Ti width | `0xB253` | `R42`/`R43` = `0x1568` |
| Bank preload | `0xAF52` | `0x155e`/`0x1560` via `R8E.0` (after `#0x51`) |
| Command + data | `0xB10D` | select(RC7,R8E) + `0x154e[RW8E]` |
| Per-cyl dual | `0xAB8F` | `0x1457/145d` + `0x1556[RW8E]` |
| Sync seed | `0xAA33` | `0x1457[RW8E]` then `#0xFF` |
| Init stream | `0x51CA` / `0x90CE` | Absolute `STB …,0x440` |

## Still open

- Per-bit OEM names inside `RC7` (beyond mask roles)
- OEM cyl 1..6 / connector pin map for `RW8E` 0..5
- `@0x440` ASIC identity
- Hardware CH1-pin ↔ ASIC accept (not visible in CODE)
- CH2/CH3/CH4 HSO connector roles

## Related

- `tools/re/out/mmio_440_injector_protocol.json`
- `tools/re/out/engine_control_dataflow_summary.md`
- `tools/re/out/irq_ram_publications.md`
- `tools/re/out/sfr_hso_hsi_audit.md`
