#!/usr/bin/env node
/**
 * Offline every-byte annotation pass for RedLabel 64KB ROM.
 * No AI. No shipping-pack promotion. Does not touch the online app.
 *
 * Usage (repo root): node tools/re/annotate.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIR, OUT_DIR, ROM_NAME, ROM_PATH, EXPECTED_SUM16, ensureOutDirs, readRom, sum16All } from './lib/romPaths.mjs';
import { probeIsa } from './lib/isaProbe.mjs';
import { classifyRom } from './lib/byteClassifier.mjs';
import { structuralCodePass } from './lib/structuralPass.mjs';
import {
  ghidraStatusSummary,
  loadGhidraFunctions,
  loadGhidraInstructionAddresses,
} from './lib/ghidraImport.mjs';

function writeJson(filePath, obj) {
  fs.writeFileSync(filePath, JSON.stringify(obj, null, 2) + '\n', 'utf8');
}

function runsToCsv(runs) {
  const header = 'start_hex,end_hex,start,end,length,region,confidence,verificationStatus,source,note,evidence';
  const lines = runs.map(r => {
    const esc = s => `"${String(s ?? '').replaceAll('"', '""')}"`;
    return [
      `0x${r.start.toString(16).toUpperCase().padStart(4, '0')}`,
      `0x${r.end.toString(16).toUpperCase().padStart(4, '0')}`,
      r.start,
      r.end,
      r.length,
      r.region,
      r.confidence,
      r.verificationStatus,
      r.source,
      esc(r.note),
      esc(r.evidence),
    ].join(',');
  });
  return [header, ...lines].join('\n') + '\n';
}

function buildGapReport({ isa, classification, structural, sum16, romName, ghidra }) {
  const lines = [];
  lines.push('# RedLabel byte-map gap report');
  lines.push('');
  lines.push(`ROM: \`${romName}\``);
  lines.push(`Checksum16 (full-file byte sum): \`0x${sum16.toString(16).toUpperCase()}\` — filename token \`C16x900A\` means this fingerprint, **not** a C16x CPU.`);
  lines.push('');
  lines.push('## ISA');
  lines.push('');
  lines.push(`- User-stated path: **${isa.userStatedIsa}**`);
  lines.push(`- Working hypothesis (tooling): **${isa.workingHypothesis}** (confidence ${isa.confidence})`);
  lines.push(`- Evidence-preferred ISA: **${isa.evidencePreferredIsa}**`);
  lines.push(`- verificationStatus: \`${isa.verificationStatus}\``);
  if (isa.conflicts?.length) {
    lines.push('');
    lines.push('### Conflicts');
    for (const c of isa.conflicts) {
      lines.push(`- ${c.detail}`);
    }
  }
  lines.push('');
  lines.push('### Evidence bullets');
  for (const e of isa.evidence) {
    lines.push(`- \`[${e.kind}]\` ${e.detail}`);
  }
  lines.push('');
  lines.push('## Coverage');
  lines.push('');
  lines.push(`- Classified (non-UNKNOWN region label): **${classification.classifiedPct.toFixed(2)}%** (${classification.classifiedBytes}/65536)`);
  lines.push(`- UNKNOWN bytes: ${classification.unknownBytes}`);
  lines.push('- By region:');
  for (const [k, v] of Object.entries(classification.byRegion).sort((a, b) => b[1] - a[1])) {
    lines.push(`  - ${k}: ${v} bytes (${((100 * v) / 65536).toFixed(2)}%)`);
  }
  lines.push('');
  lines.push('## Structural CODE pass (pre-Ghidra, unverified)');
  lines.push('');
  lines.push(`- Vector LE16 entries: ${structural.counts.vectors}`);
  lines.push(`- MCS-96 LJMP-like (E7 abs16) candidates: ${structural.counts.ljmpCandidates}`);
  lines.push(`- 8086 near-CALL-like (E8 rel16) candidates: ${structural.counts.nearCallCandidates}`);
  lines.push(`- Unique entrypoint targets: ${structural.counts.uniqueEntrypoints}`);
  lines.push('');
  lines.push('## Ghidra (canonical CODE disassembler)');
  lines.push('');
  lines.push(`- Exports present: **${ghidra?.present ? 'yes' : 'no'}**`);
  if (ghidra?.present) {
    lines.push(`- Language: \`${ghidra.language ?? 'unknown'}\``);
    lines.push(`- Functions: ${ghidra.functionCount}`);
  } else {
    lines.push(`- ${ghidra?.detail ?? 'Run tools/re/ghidra/run_headless.ps1 after installing Ghidra+JDK'}`);
  }
  lines.push('- Locked language: `MCS96:LE:16:default` (MCS-96 / 80C196-class).');
  lines.push('- LJMP/LCALL: PC-relative `disp16` — see `blocker1_ljmp_lcall.md` / `mcs96_cfg_edges.*`.');
  lines.push('- Filename `C16x900A` is **CS16=0x900A only** — never select a C166/C167 language from it.');
  lines.push('');
  lines.push('## Gap list (coarse CODE + UNKNOWN)');
  lines.push('');
  lines.push('| Start | End | Len | Region | Reason |');
  lines.push('|------:|----:|----:|:-------|:-------|');
  const topGaps = [...classification.gaps].sort((a, b) => b.length - a.length).slice(0, 40);
  for (const g of topGaps) {
    lines.push(
      `| 0x${g.start.toString(16).toUpperCase().padStart(4, '0')} | 0x${g.end.toString(16).toUpperCase().padStart(4, '0')} | ${g.length} | ${g.region} | ${g.reason} |`,
    );
  }
  lines.push('');
  lines.push('## Blockers');
  lines.push('');
  lines.push('- Blocker 1 (LJMP/LCALL addressing) **resolved**: PC-relative; Ghidra SLEIGH correct (`blocker1_ljmp_lcall.md`).');
  lines.push('- IRQ stub targets in high `0xAxxx` (region-labeled DATA) need follow-up under MCS-96 CFG — not an encoding bug.');
  lines.push('- Mid-CODE data islands still need manual separation; do not promote CODE-derived maps to shipping.');
  lines.push('');
  return lines.join('\n');
}

function main() {
  ensureOutDirs();
  const buf = readRom();
  const sum16 = sum16All(buf);
  if (sum16 !== EXPECTED_SUM16) {
    console.warn(
      `WARN: sum16=0x${sum16.toString(16)} expected 0x${EXPECTED_SUM16.toString(16)} — still annotating.`,
    );
  }

  const xdfPath = path.join(DATA_DIR, 'seed.xdf');
  const xdfText = fs.existsSync(xdfPath) ? fs.readFileSync(xdfPath, 'utf8') : '';

  const isa = probeIsa(buf);
  const ghidraOut = path.join(OUT_DIR, 'ghidra');
  const ghidra = ghidraStatusSummary(ghidraOut);
  const ghidraFns = loadGhidraFunctions(ghidraOut);
  const ghidraInsns = loadGhidraInstructionAddresses(ghidraOut);
  const classification = classifyRom(buf, {
    xdfText,
    ghidraInsnAddrs: ghidraInsns?.addresses ?? [],
    ghidraLanguage: ghidra?.language ?? null,
  });
  const structural = structuralCodePass(buf);

  const artifact = {
    schemaVersion: 1,
    id: 'redlabel_byte_map_v1',
    rom: ROM_NAME,
    romPath: 'public/rom/' + ROM_NAME,
    size: buf.length,
    checksum16: sum16,
    namingNote:
      'Filename C16x900A = checksum16 0x900A fingerprint only; not Siemens/Infineon C16x ISA evidence.',
    generatedAt: new Date().toISOString(),
    isa,
    memoryMapHypothesis: [
      { name: 'LOW_PAD_OR_INTERNAL_HOLE', start: 0, end: 0x1fff, kind: 'PAD', confidence: 0.9 },
      { name: 'VECTOR_0x2000', start: 0x2000, end: 0x200f, kind: 'VECTOR', confidence: 0.7 },
      { name: 'CODE_WINDOW', start: 0x2000, end: 0x7fff, kind: 'CODE', confidence: 0.55 },
      { name: 'DATA_CAL', start: 0x8000, end: 0xfffd, kind: 'DATA', confidence: 0.85 },
      { name: 'CS16_TRAIL', start: 0xfffe, end: 0xffff, kind: 'OTHER', confidence: 0.95 },
    ],
    coverage: {
      classifiedBytes: classification.classifiedBytes,
      unknownBytes: classification.unknownBytes,
      classifiedPct: classification.classifiedPct,
      byRegion: classification.byRegion,
    },
    runs: classification.runs,
    gaps: classification.gaps,
    structural,
    ghidra,
    ghidraFunctionStarts: ghidraFns?.functions?.slice(0, 512) ?? [],
    verificationStatus: 'plausible',
    evidence: [
      {
        kind: 'pipeline_artifact',
        detail:
          'Initial every-byte region annotation from binary structure + sheet/XDF overlays. CODE disasm deferred to Ghidra exports. Not shipping.',
        sources: ['re_pipeline'],
      },
    ],
  };

  // Slim JSON without huge regionStream by default; store stream separately
  writeJson(path.join(OUT_DIR, 'isa_report.json'), {
    schemaVersion: 1,
    rom: ROM_NAME,
    checksum16: sum16,
    namingNote: artifact.namingNote,
    ...isa,
  });
  writeJson(path.join(OUT_DIR, 'byte_map.json'), artifact);
  writeJson(path.join(OUT_DIR, 'structural_code.json'), {
    schemaVersion: 1,
    rom: ROM_NAME,
    ...structural,
  });
  fs.writeFileSync(path.join(OUT_DIR, 'byte_map_runs.csv'), runsToCsv(classification.runs), 'utf8');
  fs.writeFileSync(
    path.join(OUT_DIR, 'byte_region_stream.txt'),
    classification.regionStream + '\n',
    'utf8',
  );
  fs.writeFileSync(
    path.join(OUT_DIR, 'gap_report.md'),
    buildGapReport({ isa, classification, structural, sum16, romName: ROM_NAME, ghidra }),
    'utf8',
  );

  // Definition-pack-compatible candidate stub (regions only — no unverified maps promoted)
  writeJson(path.join(OUT_DIR, 'byte_map.candidates.json'), {
    schemaVersion: 1,
    id: '466.29.byte_map_regions',
    hw: '0261200413',
    sw: '1267357623',
    motronicVersion: 'M3.3.1',
    name: 'RedLabel byte-map regions (research)',
    description:
      'Offline region classification artifact. Research only — do not copy into shipping TuneDex packs without review.',
    isBuiltIn: false,
    expectedSize: 65536,
    expectedChecksum16: EXPECTED_SUM16,
    definitionRevision: '2026-10-04.annotate',
    layoutFamily: 'M331_413_623',
    matchPolicy: 'manual',
    fingerprint: { size: 65536, checksum16: EXPECTED_SUM16, releaseId: '466.29' },
    regions: artifact.memoryMapHypothesis.map(r => ({
      name: r.name,
      start: r.start,
      end: r.end,
      kind: r.kind === 'VECTOR' || r.kind === 'PAD' ? (r.kind === 'VECTOR' ? 'VECTORS' : 'OTHER') : r.kind,
    })),
    maps: [],
    candidateMaps: [],
  });

  console.log(
    JSON.stringify(
      {
        ok: true,
        checksum16: '0x' + sum16.toString(16).toUpperCase(),
        classifiedPct: Number(classification.classifiedPct.toFixed(3)),
        byRegion: classification.byRegion,
        evidencePreferredIsa: isa.evidencePreferredIsa,
        workingHypothesis: isa.workingHypothesis,
        ghidra,
        out: OUT_DIR,
      },
      null,
      2,
    ),
  );
}

main();
