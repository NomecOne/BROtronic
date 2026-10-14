# RedLabel byte-map gap report

ROM: `BMW DME413 SW623 D466.29 C16x900A 94 RedLabel.bin`
Checksum16 (full-file byte sum): `0x900A` — filename token `C16x900A` means this fingerprint, **not** a C16x CPU.

## ISA

- User-stated path: **mcs96_80c196_family**
- Working hypothesis (tooling): **mcs96_80c196_family** (confidence 0.9)
- Evidence-preferred ISA: **mcs96_80c196_family**
- verificationStatus: `cross_checked`

### Conflicts
- MCS-96 / 80C196-class is the locked CODE ISA (Richard confirmation + Ghidra MCS96:LE:16:default). x86 Real Mode remains historical reject only. LJMP/LCALL are PC-relative disp16 (see blocker1_ljmp_lcall.md). Do not pick C16x from filename.

### Evidence bullets
- `[naming_clarification]` ROM filename token C16x900A denotes full-file byte-sum fingerprint 0x900A, not Siemens/Infineon C16x CPU family.
- `[memory_layout]` First non-0xFF byte at 0x2000; baseline CODE 0x2000–0xB930 inclusive (Richard); DATA_CAL from 0xB931. Bytes 0x0000-0x1FFF erased in external image. Legacy shipping pack CODE≤0x7FFF is superseded for region labeling.
- `[sheet_ida_note]` CAL sheet @0x2000: "Hard coded vector addresses for interupts ?"; @0x2010: "Internal 16kb of ROM Not always internal?". Community IDA notes treat some mid-CODE ranges as data.
- `[vector_table]` LE u16 table at 0x2000 -> 0x4178, 0x417C, 0x4180, 0x4184, 0x4188, 0x418C, 0x4190, 0x4194 (targets step +4).
- `[mcs96_opcode_pattern]` In CODE window: opcode 0xE7 (MCS-96 LJMP, PC-rel disp16) count=169; naive abs-in-window count=28 (use PC-rel CFG, not abs). Pad byte 0xFD count=174; sheet: 0xFD~=NOP / 0xFF~=reset — matches MCS-96.
- `[8086_opcode_pattern]` In CODE window: 0xE8 near-call-like bytes=38 (in-range targets=30); classic prologue 55 8B EC count=0; 0x90 (8086 NOP) count=70 vs 0xFD count=174.

## Coverage

- Classified (non-UNKNOWN region label): **100.00%** (65536/65536)
- UNKNOWN bytes: 0
- By region:
  - CODE: 38970 bytes (59.46%)
  - DATA: 18125 bytes (27.66%)
  - PAD: 8423 bytes (12.85%)
  - VECTOR: 16 bytes (0.02%)
  - OTHER: 2 bytes (0.00%)

## Structural CODE pass (pre-Ghidra, unverified)

- Vector LE16 entries: 8
- MCS-96 LJMP-like (E7 abs16) candidates: 28
- 8086 near-CALL-like (E8 rel16) candidates: 30
- Unique entrypoint targets: 65

## Ghidra (canonical CODE disassembler)

- Exports present: **yes**
- Language: `MCS96:LE:16:default`
- Functions: 213
- Locked language: `MCS96:LE:16:default` (MCS-96 / 80C196-class).
- LJMP/LCALL: PC-relative `disp16` — see `blocker1_ljmp_lcall.md` / `mcs96_cfg_edges.*`.
- Filename `C16x900A` is **CS16=0x900A only** — never select a C166/C167 language from it.

## Gap list (coarse CODE + UNKNOWN)

| Start | End | Len | Region | Reason |
|------:|----:|----:|:-------|:-------|

## Blockers

- Blocker 1 (LJMP/LCALL addressing) **resolved**: PC-relative; Ghidra SLEIGH correct (`blocker1_ljmp_lcall.md`).
- Baseline CODE ends at **0xB930 inclusive**; DATA_CAL starts at 0xB931. IRQ `0xAxxx` landings are inside CODE.
- Mid-CODE data islands (XDF claims / pads) still need separation; do not promote CODE-derived maps to shipping.
