# Ghidra language notes (RedLabel)

Filename `C16x900A` = **checksum16 0x900A only**. Do not select C166/C167 from it.

## First attempt (user-stated)

- Language ID: `x86:LE:16:Real Mode`
- Compiler: `default`
- Image base: `0x0000`
- File: `public/rom/BMW DME413 SW623 D466.29 C16x900A 94 RedLabel.bin`

Sanity checks after import:

1. Does CODE around `0x2100+` look like coherent control flow?
2. Are `0xFD` runs treated like pad/NOP filler rather than dense nonsense?
3. Do vector targets at `0x2000` (→ `0x4178`…) land on plausible entry stubs?

If Real Mode fails those checks, record failure under `tools/re/out/ghidra/` and try evidence-preferred MCS-96/80C196 support (community module), not a C16x language guessed from the filename.
