/**
 * Merge Ghidra function-start CSV into the byte-map runs (when exports exist).
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

export function ghidraStatusSummary(ghidraOutDir) {
  const loaded = loadGhidraFunctions(ghidraOutDir);
  if (!loaded) {
    return {
      present: false,
      detail: 'No Ghidra exports yet — run tools/re/ghidra/run_headless.ps1 after installing Ghidra+JDK',
    };
  }
  return {
    present: true,
    functionCount: loaded.functions.length,
    language: loaded.meta?.language ?? null,
    csvPath: loaded.csvPath,
    verificationStatus: 'unverified',
  };
}
