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
- `[memory_layout]` First non-0xFF byte at 0x2000; shipping pack maps CODE 0x0000-0x7FFF / DATA 0x8000-0xFFFD. Bytes 0x0000-0x1FFF are erased (0xFF) in this external image.
- `[sheet_ida_note]` CAL sheet @0x2000: "Hard coded vector addresses for interupts ?"; @0x2010: "Internal 16kb of ROM Not always internal?". Community IDA notes treat some mid-CODE ranges as data.
- `[vector_table]` LE u16 table at 0x2000 -> 0x4178, 0x417C, 0x4180, 0x4184, 0x4188, 0x418C, 0x4190, 0x4194 (targets step +4).
- `[mcs96_opcode_pattern]` In CODE window: opcode 0xE7 (MCS-96 LJMP, PC-rel disp16) count=142; naive abs-in-window count=22 (use PC-rel CFG, not abs). Pad byte 0xFD count=144; sheet: 0xFD~=NOP / 0xFF~=reset — matches MCS-96.
- `[8086_opcode_pattern]` In CODE window: 0xE8 near-call-like bytes=27 (in-range targets=18); classic prologue 55 8B EC count=0; 0x90 (8086 NOP) count=42 vs 0xFD count=144.

## Coverage

- Classified (non-UNKNOWN region label): **100.00%** (65536/65536)
- UNKNOWN bytes: 0
- By region:
  - DATA: 32766 bytes (50.00%)
  - CODE: 24329 bytes (37.12%)
  - PAD: 8423 bytes (12.85%)
  - VECTOR: 16 bytes (0.02%)
  - OTHER: 2 bytes (0.00%)

## Structural CODE pass (pre-Ghidra, unverified)

- Vector LE16 entries: 8
- MCS-96 LJMP-like (E7 abs16) candidates: 22
- 8086 near-CALL-like (E8 rel16) candidates: 18
- Unique entrypoint targets: 47

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
| 0x2BAF | 0x2E80 | 722 | CODE | CODE window only coarsely classified — needs ISA-locked disasm/xrefs |
| 0x41C6 | 0x4463 | 670 | CODE | CODE window only coarsely classified — needs ISA-locked disasm/xrefs |
| 0x20F1 | 0x2268 | 376 | CODE | CODE window only coarsely classified — needs ISA-locked disasm/xrefs |
| 0x4516 | 0x466B | 342 | CODE | CODE window only coarsely classified — needs ISA-locked disasm/xrefs |
| 0x2A27 | 0x2B7B | 341 | CODE | CODE window only coarsely classified — needs ISA-locked disasm/xrefs |
| 0x3FDF | 0x411F | 321 | CODE | CODE window only coarsely classified — needs ISA-locked disasm/xrefs |
| 0x7797 | 0x78A4 | 270 | CODE | CODE window only coarsely classified — needs ISA-locked disasm/xrefs |
| 0x7003 | 0x70F7 | 245 | CODE | CODE window only coarsely classified — needs ISA-locked disasm/xrefs |
| 0x2909 | 0x29D6 | 206 | CODE | CODE window only coarsely classified — needs ISA-locked disasm/xrefs |
| 0x2647 | 0x26F4 | 174 | CODE | CODE window only coarsely classified — needs ISA-locked disasm/xrefs |
| 0x72ED | 0x7386 | 154 | CODE | CODE window only coarsely classified — needs ISA-locked disasm/xrefs |
| 0x4484 | 0x44F5 | 114 | CODE | CODE window only coarsely classified — needs ISA-locked disasm/xrefs |
| 0x3F6B | 0x3FC9 | 95 | CODE | CODE window only coarsely classified — needs ISA-locked disasm/xrefs |
| 0x287F | 0x2888 | 10 | CODE | CODE window only coarsely classified — needs ISA-locked disasm/xrefs |
| 0x6003 | 0x600B | 9 | CODE | CODE window only coarsely classified — needs ISA-locked disasm/xrefs |
| 0x277C | 0x2783 | 8 | CODE | CODE window only coarsely classified — needs ISA-locked disasm/xrefs |
| 0x4132 | 0x4139 | 8 | CODE | CODE window only coarsely classified — needs ISA-locked disasm/xrefs |
| 0x413D | 0x4144 | 8 | CODE | CODE window only coarsely classified — needs ISA-locked disasm/xrefs |
| 0x2014 | 0x2018 | 5 | CODE | CODE window only coarsely classified — needs ISA-locked disasm/xrefs |
| 0x20D6 | 0x20D8 | 3 | CODE | CODE window only coarsely classified — needs ISA-locked disasm/xrefs |
| 0x20E5 | 0x20E7 | 3 | CODE | CODE window only coarsely classified — needs ISA-locked disasm/xrefs |
| 0x302A | 0x302C | 3 | CODE | CODE window only coarsely classified — needs ISA-locked disasm/xrefs |
| 0x35AD | 0x35AF | 3 | CODE | CODE window only coarsely classified — needs ISA-locked disasm/xrefs |
| 0x3B10 | 0x3B12 | 3 | CODE | CODE window only coarsely classified — needs ISA-locked disasm/xrefs |
| 0x3B26 | 0x3B28 | 3 | CODE | CODE window only coarsely classified — needs ISA-locked disasm/xrefs |
| 0x3BB4 | 0x3BB6 | 3 | CODE | CODE window only coarsely classified — needs ISA-locked disasm/xrefs |
| 0x3DFF | 0x3E01 | 3 | CODE | CODE window only coarsely classified — needs ISA-locked disasm/xrefs |
| 0x3E71 | 0x3E73 | 3 | CODE | CODE window only coarsely classified — needs ISA-locked disasm/xrefs |
| 0x3F11 | 0x3F13 | 3 | CODE | CODE window only coarsely classified — needs ISA-locked disasm/xrefs |
| 0x4E23 | 0x4E25 | 3 | CODE | CODE window only coarsely classified — needs ISA-locked disasm/xrefs |
| 0x4FFA | 0x4FFC | 3 | CODE | CODE window only coarsely classified — needs ISA-locked disasm/xrefs |
| 0x5015 | 0x5017 | 3 | CODE | CODE window only coarsely classified — needs ISA-locked disasm/xrefs |
| 0x5025 | 0x5027 | 3 | CODE | CODE window only coarsely classified — needs ISA-locked disasm/xrefs |
| 0x503F | 0x5041 | 3 | CODE | CODE window only coarsely classified — needs ISA-locked disasm/xrefs |
| 0x5065 | 0x5067 | 3 | CODE | CODE window only coarsely classified — needs ISA-locked disasm/xrefs |
| 0x517C | 0x517E | 3 | CODE | CODE window only coarsely classified — needs ISA-locked disasm/xrefs |
| 0x53DD | 0x53DF | 3 | CODE | CODE window only coarsely classified — needs ISA-locked disasm/xrefs |
| 0x5694 | 0x5696 | 3 | CODE | CODE window only coarsely classified — needs ISA-locked disasm/xrefs |
| 0x56BC | 0x56BE | 3 | CODE | CODE window only coarsely classified — needs ISA-locked disasm/xrefs |
| 0x574E | 0x5750 | 3 | CODE | CODE window only coarsely classified — needs ISA-locked disasm/xrefs |

## Blockers

- Blocker 1 (LJMP/LCALL addressing) **resolved**: PC-relative; Ghidra SLEIGH correct (`blocker1_ljmp_lcall.md`).
- IRQ stub targets in high `0xAxxx` (region-labeled DATA) need follow-up under MCS-96 CFG — not an encoding bug.
- Mid-CODE data islands still need manual separation; do not promote CODE-derived maps to shipping.
