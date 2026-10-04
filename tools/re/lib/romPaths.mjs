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
