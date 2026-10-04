import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const RE_ROOT = path.resolve(__dirname, '..');
export const REPO_ROOT = path.resolve(RE_ROOT, '../..');
export const DATA_DIR = path.join(RE_ROOT, 'data');
export const OUT_DIR = path.join(RE_ROOT, 'out');

export const ROM_NAME = 'BMW DME413 SW623 D466.29 C16x900A 94 RedLabel.bin';
export const ROM_PATH = path.join(REPO_ROOT, 'public', 'rom', ROM_NAME);

/** Filename token "C16x900A" = full-file 16-bit byte-sum fingerprint 0x900A — NOT a CPU family. */
export const EXPECTED_SUM16 = 0x900a;

/**
 * Baseline RedLabel 413/623 memory map (Richard):
 * CODE section runs through offset 0xB930 inclusive.
 * All bounds below are inclusive end addresses unless noted.
 */
export const MEM = {
  LOW_PAD_END: 0x1fff,
  VECTOR_START: 0x2000,
  VECTOR_END: 0x200f,
  /** First executable CODE byte in external image (after erased low window). */
  CODE_START: 0x2000,
  /** Inclusive end of CODE section (baseline fact). */
  CODE_END: 0xb930,
  /** Exclusive end helper (= CODE_END + 1). */
  get CODE_END_EXCLUSIVE() {
    return this.CODE_END + 1;
  },
  /** DATA_CAL starts immediately after CODE. */
  get DATA_START() {
    return this.CODE_END + 1; // 0xB931
  },
  DATA_END: 0xfffd,
  CS16_START: 0xfffe,
};

/** @deprecated Prefer MEM.CODE_*; kept for older call sites. */
export const CODE_LO = MEM.CODE_START;
export const CODE_HI = MEM.CODE_END;

export function regionKindAt(addr) {
  if (addr < 0 || addr > 0xffff) return 'OTHER';
  if (addr <= MEM.LOW_PAD_END) return 'PAD';
  if (addr >= MEM.VECTOR_START && addr <= MEM.VECTOR_END) return 'VECTOR';
  if (addr >= MEM.CODE_START && addr <= MEM.CODE_END) return 'CODE';
  if (addr >= MEM.DATA_START && addr <= MEM.DATA_END) return 'DATA';
  return 'OTHER';
}

export function ensureOutDirs() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

export function readRom(filePath = ROM_PATH) {
  if (!fs.existsSync(filePath)) {
    throw new Error(
      `RedLabel ROM missing at ${filePath}. Place BASEMAP binary under public/rom/ (NomecOne/BMW-DME-M3.3.1).`,
    );
  }
  const buf = fs.readFileSync(filePath);
  if (buf.length !== 65536) {
    throw new Error(`Expected 64KB ROM, got ${buf.length} bytes`);
  }
  return buf;
}

export function sum16All(buf) {
  let sum = 0;
  for (let i = 0; i < buf.length; i++) sum = (sum + buf[i]) & 0xffff;
  return sum;
}
