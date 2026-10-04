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

function findHeadlessBat(root) {
  if (!root) return null;
  const candidates = [
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
  const guesses = [
    envDir,
    path.join(process.env.USERPROFILE || '', 'ghidra'),
    path.join(process.env.USERPROFILE || '', 'Tools', 'ghidra'),
    'C:\\ghidra',
    'C:\\Tools\\ghidra',
  ].filter(Boolean);

  // Also scan shallow USERPROFILE for ghidra_* dirs
  const home = process.env.USERPROFILE || '';
  if (home && exists(home)) {
    try {
      for (const ent of fs.readdirSync(home, { withFileTypes: true })) {
        if (ent.isDirectory() && /^ghidra[_-]?/i.test(ent.name)) {
          guesses.push(path.join(home, ent.name));
        }
      }
    } catch {
      /* ignore */
    }
  }

  for (const g of guesses) {
    const bat = findHeadlessBat(g);
    if (bat) return { installDir: path.resolve(g), headless: bat };
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
      role: 'user_stated_primary',
      note: 'Ghidra language for classic 8086 real-mode — user-stated interest. Validate against binary (NOP/LJMP patterns) before trusting CODE.',
    },
    {
      id: 'x86:LE:16:Protected Mode',
      role: 'alternate_x86_16',
      note: 'Try only if Real Mode listing looks nonsensical.',
    },
    {
      id: 'MCS-96 / 80C196 (external module if available)',
      role: 'evidence_preferred_alternate',
      note:
        'Binary+sheet markers (E7 abs16 LJMP-like density, FD≈NOP, FF≈reset, vector table @0x2000) lean MCS-96-class. Stock Ghidra may lack this language — install a community processor module if Real Mode fails sanity checks.',
    },
  ],
  namingNote:
    'ROM filename C16x900A is checksum16=0x900A only — never use it to select a C166/C167 Ghidra language.',
  blockers: [
    !java.ok ? 'JDK/JRE not on PATH (Ghidra requires a compatible JDK, typically Temurin 21+ for recent Ghidra).' : null,
    !ghidra.headless
      ? 'Ghidra not found. Set GHIDRA_INSTALL_DIR to the extracted Ghidra root (folder containing support/analyzeHeadless.bat).'
      : null,
  ].filter(Boolean),
};

fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'ghidra_detect.json'), JSON.stringify(report, null, 2) + '\n', 'utf8');
console.log(JSON.stringify(report, null, 2));
process.exit(ready ? 0 : 2);
