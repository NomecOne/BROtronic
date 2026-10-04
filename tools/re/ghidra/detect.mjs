#!/usr/bin/env node
/**
 * Detect Ghidra + JDK for the offline RE pipeline.
 * Exit 0 if headless-ready; exit 2 if missing (still prints JSON report).
 *
 * Usage: node tools/re/ghidra/detect.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RE_ROOT = path.resolve(__dirname, '..');
const OUT = path.join(RE_ROOT, 'out');

function exists(p) {
  try {
    return p && fs.existsSync(p);
  } catch {
    return false;
  }
}

function findHeadless(root) {
  if (!root) return null;
  const candidates = [
    // Linux / macOS first
    path.join(root, 'support', 'analyzeHeadless'),
    path.join(root, 'analyzeHeadless'),
    // Windows
    path.join(root, 'support', 'analyzeHeadless.bat'),
    path.join(root, 'analyzeHeadless.bat'),
  ];
  for (const c of candidates) if (exists(c)) return c;
  return null;
}

function probeJava() {
  const r = spawnSync('java', ['-version'], { encoding: 'utf8' });
  const text = `${r.stderr || ''}${r.stdout || ''}`.trim();
  if (r.error || (r.status !== 0 && !text)) {
    return { ok: false, detail: r.error?.message || 'java not on PATH' };
  }
  return { ok: true, detail: text.split(/\r?\n/)[0] || 'java present' };
}

function discoverInstall() {
  const envDir = process.env.GHIDRA_INSTALL_DIR || process.env.GHIDRA_HOME || '';
  const home = process.env.HOME || process.env.USERPROFILE || '';
  const guesses = [
    envDir,
    path.join(home, 'tools', 'ghidra'),
    path.join(home, 'ghidra'),
    path.join(home, 'Tools', 'ghidra'),
    '/opt/ghidra',
    'C:\\ghidra',
    'C:\\Tools\\ghidra',
  ].filter(Boolean);

  // Scan HOME and HOME/tools for ghidra_* dirs
  for (const scanRoot of [home, path.join(home, 'tools'), path.join(home, 'Tools')]) {
    if (!scanRoot || !exists(scanRoot)) continue;
    try {
      for (const ent of fs.readdirSync(scanRoot, { withFileTypes: true })) {
        if (ent.isDirectory() && /^ghidra[_-]?/i.test(ent.name)) {
          guesses.push(path.join(scanRoot, ent.name));
        }
      }
    } catch {
      /* ignore */
    }
  }

  for (const g of guesses) {
    const headless = findHeadless(g);
    if (headless) return { installDir: path.resolve(g), headless };
  }
  return { installDir: null, headless: null };
}

const java = probeJava();
const ghidra = discoverInstall();
const ready = Boolean(java.ok && ghidra.headless);

const report = {
  schemaVersion: 1,
  ready,
  java,
  ghidra: {
    installDir: ghidra.installDir,
    headless: ghidra.headless,
    envGHIDRA_INSTALL_DIR: process.env.GHIDRA_INSTALL_DIR || null,
    envGHIDRA_HOME: process.env.GHIDRA_HOME || null,
  },
  processorCandidates: [
    {
      id: 'x86:LE:16:Real Mode',
      role: 'user_stated_first_attempt',
      note: 'First headless language (user-stated 8086 interest). On RedLabel, seeded disassembly at vector targets is incoherent — keep only as negative control.',
    },
    {
      id: 'MCS96:LE:16:default',
      role: 'evidence_preferred_canonical',
      note:
        'Stock Ghidra 11.3.2 ships MCS-96. Binary+sheet markers (E7 abs16 LJMP, FD≈NOP, vectors @0x2000) + coherent listing (LJMP/LCALL/JBS/INT_MASK) prefer this. Caveat: SLEIGH may mis-decode LJMP immediates as PC-relative.',
    },
    {
      id: 'x86:LE:16:Protected Mode',
      role: 'alternate_x86_16',
      note: 'Not useful once Real Mode fails sanity; do not prefer over MCS96.',
    },
  ],
  namingNote:
    'ROM filename C16x900A is checksum16=0x900A only — never use it to select a C166/C167 Ghidra language.',
  blockers: [
    !java.ok ? 'JDK/JRE not on PATH (Ghidra requires a compatible JDK, typically Temurin 21+ for recent Ghidra).' : null,
    !ghidra.headless
      ? 'Ghidra not found. Set GHIDRA_INSTALL_DIR to the extracted Ghidra root (folder containing support/analyzeHeadless or analyzeHeadless.bat).'
      : null,
  ].filter(Boolean),
};

fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'ghidra_detect.json'), JSON.stringify(report, null, 2) + '\n', 'utf8');
console.log(JSON.stringify(report, null, 2));
process.exit(ready ? 0 : 2);
