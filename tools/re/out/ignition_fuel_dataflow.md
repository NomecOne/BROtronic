# Ignition & fuel dataflow — XDF → DATA → CODE

ROM: `BMW DME413 SW623 D466.29 C16x900A 94 RedLabel.bin`
ISA: `mcs96_80c196_family`
CODE `0x2000`–`0xB930`; DATA from `0xB931`.
XDF (BRO) = primary definition evidence for names/equations.

## Coverage (v3 — RW68 index base)

| Metric | Count | % of 69 |
|--------|------:|--------:|
| **Absolute `LOOKUP[ZR]` proven** (ea == XDF offset) | **0** | **0.0%** |
| **Index-base cross_checked** (`RW68`=`0xD200`) | **13** | **18.84%** |
| Structural split-ptr (`0xD000`+`0x0030`→`0xD030`) | 1 | 1.45% |

0.0% absolute proven (0/69); 18.84% index-base cross_checked (13/69 via RW68=0xD200); 1 structural (0xD030).

> **Absolute proven** still requires `LOOKUP[ZR]`/`TABLE[ZR]` with ea == XDF offset.
> **Index-base cross_checked:** only base `0xD200` makes `RW68+{0x3E,0x40,0x44,0x90}` hit MAF high/low/ratio/cal together. See `rw68_cal_index_base.md`.

## How CAL is read (current model)

1. **Indexed scalar/limit path:** `LOOKUP/TABLE[RW68]` with `RW68=0xD200` (cross_checked) → MAF/sensor/knock region `0xD23E`–`0xD290`
2. **Map-interp trampoline** `0x20C7` → `0x33C2` via descriptor table `RW6E=0x1E08` (CAL map targets still unresolved)
3. **Structural** `0xD000`+`0x0030` @`0x432A` → Ti `0xD030` (no CODE deref yet)

## Related artifacts

- `theory_vs_rom_bosch_ti.{md,json}` — Bosch T1–T8 checklist + load path
- `rw68_cal_index_base.{md,json}` — 13 index-base xrefs
- `cal_access_model.{md,json}` — absolute-path attempt + descriptor model
- `irq_ram_publications.{md,json}` — vec2/vec5 RAM pubs
- `sfr_hso_hsi_audit.{md,json}` — HSO write alias
- `motronic_331_function.md` §7 — sibling theory checklist

## What is *not* claimed

- Complete spark/fuel output control path
- Absolute `LOOKUP[ZR]` per-map CODE xrefs (still 0)
- Shipping definition updates from Bosch PDF or index-base geometry alone

## Theory reference (Bosch M-Motronic TI)

Expected fuel/ign math (HFM load → base ti + corrections; zw map(load,rpm); dwell vs Vbat/rpm) is page-cited in [`ref_pdf_bosch_m_motronic_technical_instruction.md`](ref_pdf_bosch_m_motronic_technical_instruction.md). Checklist: [`theory_vs_rom_bosch_ti.md`](theory_vs_rom_bosch_ti.md).

---
Research-only. Verification gates for promotion unchanged.
