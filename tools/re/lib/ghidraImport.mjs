/**
 * Merge Ghidra function-start CSV / listing into the byte-map (when exports exist).
 * Safe no-op if tools/re/out/ghidra/ghidra_functions.csv is missing.
 */
import fs from 'node:fs';
import path from 'node:path';

export function loadGhidraFunctions(ghidraOutDir) {
  const csvPath = path.join(ghidraOutDir, 'ghidra_functions.csv');
  if (!fs.existsSync(csvPath)) return null;
  const text = fs.readFileSync(csvPath, 'utf8');
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return { functions: [], meta: null };
  const functions = [];
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(',');
    if (parts.length < 3) continue;
    const entry = Number(parts[0]);
    if (!Number.isFinite(entry)) continue;
    functions.push({
      entry,
      name: parts[2].replace(/^"|"$/g, ''),
      bodySize: Number(parts[3] || 0),
    });
  }
  let meta = null;
  const metaPath = path.join(ghidraOutDir, 'ghidra_export_meta.json');
  if (fs.existsSync(metaPath)) {
    meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
  }
  return { functions, meta, csvPath };
}

/**
 * Parse exported listing lines into instruction addresses (CODE window only).
 * Accepts `4178  PUSHF` or `0000:4178  OUT ...`.
 */
export function loadGhidraInstructionAddresses(ghidraOutDir) {
  const listingPath = path.join(ghidraOutDir, 'ghidra_listing.txt');
  if (!fs.existsSync(listingPath)) return null;
  const text = fs.readFileSync(listingPath, 'utf8');
  const addrs = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line || line.startsWith(';')) continue;
    const m = line.match(/^(?:[0-9A-Fa-f]{4}:)?([0-9A-Fa-f]{1,4})\s+\S/);
    if (!m) continue;
    const off = parseInt(m[1], 16);
    if (!Number.isFinite(off) || off < 0x2000 || off > 0x7fff) continue;
    addrs.push(off);
  }
  return { listingPath, addresses: addrs, count: addrs.length };
}

export function ghidraStatusSummary(ghidraOutDir) {
  const loaded = loadGhidraFunctions(ghidraOutDir);
  if (!loaded) {
    return {
      present: false,
      detail:
        'No Ghidra exports yet — run bash tools/re/ghidra/run_headless.sh after installing Ghidra+JDK',
    };
  }
  const listing = loadGhidraInstructionAddresses(ghidraOutDir);
  return {
    present: true,
    functionCount: loaded.functions.length,
    instructionCount: loaded.meta?.instructionCount ?? listing?.count ?? null,
    language: loaded.meta?.language ?? null,
    csvPath: loaded.csvPath,
    verificationStatus: 'unverified',
  };
}
