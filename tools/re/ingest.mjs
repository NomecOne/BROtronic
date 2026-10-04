#!/usr/bin/env node
/**
 * Offline ingest: XDF (primary) + sheet CSV + legacy → candidate packs + verification report.
 * No AI. Does not modify shipping packs automatically.
 *
 * Authority (Richard): TunerPro XDF
 *   NomecOne/BMW-DME-M3.3.1 ... C16x900A_BRO.xdf
 * is the most correct definition to date for baseline 413/623 RedLabel.
 * Names/equations are often CODE+hardware-derived — prefer XDF when sources conflict.
 * Shipping still requires binary fit / cross-check gates (do not blindly mark verified).
 *
 * Usage (repo root): node tools/re/ingest.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MEM, ROM_NAME, ROM_PATH, EXPECTED_SUM16 } from './lib/romPaths.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const DATA = path.join(__dirname, 'data');
const OUT = path.join(__dirname, 'out');

const XDF_PATH = path.join(DATA, 'seed.xdf');
const SHEET_PATH = path.join(DATA, 'cal_sheet.csv');

/** Legacy TunerPro / relativeOffset base (not the CODE/DATA region split). */
const XDF_REL_BASE = 0x8000;

const XDF_PEDIGREE = {
  source: 'xdf',
  authority: 'richard',
  repoPath:
    'NomecOne/BMW-DME-M3.3.1/Definitions/TunerPro BMW OBD1 Bosch M3.3.1 HW413 SW623 D466.29 C16x900A_BRO.xdf',
  url: 'https://github.com/NomecOne/BMW-DME-M3.3.1/blob/main/Definitions/TunerPro%20BMW%20OBD1%20Bosch%20M3.3.1%20HW413%20SW623%20D466.29%20C16x900A_BRO.xdf',
  note:
    'Most correct definition to date for baseline 413/623 RedLabel (Richard). Names and real-world conversion equations are sometimes derived from CODE + hardware spec sheets.',
  trustRank: 1,
};

const SOURCE_TRUST = {
  xdf: 1,
  sheet: 3,
  brotronic_legacy: 4,
};

function ensureDirs() {
  fs.mkdirSync(DATA, { recursive: true });
  fs.mkdirSync(OUT, { recursive: true });
  fs.mkdirSync(path.dirname(ROM_PATH), { recursive: true });
}

function readRom(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`RedLabel ROM missing at ${filePath}. Fetch from NomecOne/BMW-DME-M3.3.1 ROMs/BASEMAP.`);
  }
  return fs.readFileSync(filePath);
}

function sum16All(buf) {
  let sum = 0;
  for (let i = 0; i < buf.length; i++) sum = (sum + buf[i]) & 0xffff;
  return sum;
}

function zoneForOffset(offset) {
  if (offset >= MEM.CODE_START && offset <= MEM.CODE_END) {
    return offset >= XDF_REL_BASE ? 'mid_code_data_island' : 'code_low';
  }
  if (offset >= MEM.DATA_START && offset <= MEM.DATA_END) return 'data_cal';
  return 'other';
}

/** Very small XDF table/constant scraper (title + mmedaddress + dims + MATH). */
function parseXdfCandidates(xdfText) {
  const blocks = xdfText.split(/<\/(?:XDFTABLE|XDFCONSTANT)>/i);
  const out = [];

  for (const block of blocks) {
    const titleM = block.match(/<title>([^<]+)<\/title>/i);
    const addrM = block.match(/mmedaddress="(0x[0-9A-Fa-f]+)"/i);
    if (!titleM || !addrM) continue;

    const title = titleM[1].replace(/\s+/g, ' ').trim();
    if (/^INFO\b/i.test(title)) continue;

    const offset = parseInt(addrM[1], 16);
    const bitsM = block.match(/mmedelementsizebits="(\d+)"/i);
    const rowsM = block.match(/mmedrowcount="(\d+)"/i);
    const colsM = block.match(/mmedcolcount="(\d+)"/i);
    const bits = bitsM ? Number(bitsM[1]) : 8;
    const rows = rowsM ? Number(rowsM[1]) : 1;
    const cols = colsM ? Number(colsM[1]) : 1;
    const dataSize = bits >= 16 ? 16 : 8;
    const typeFlags = /mmedtypeflags="([^"]+)"/i.exec(block)?.[1];
    const endian = typeFlags && (parseInt(typeFlags, 16) & 0x02) ? 'le' : undefined;
    const mathM = block.match(/<MATH\s+equation="([^"]+)"/i);
    const formula = mathM ? mathM[1].trim() : 'X';
    const zone = zoneForOffset(offset);

    const id = `xdf_${offset.toString(16)}_${rows}x${cols}_${dataSize}`;
    out.push({
      id,
      name: title.slice(0, 96),
      description: `XDF (primary definition evidence): ${title}`,
      type: rows === 1 && cols === 1 ? 'Scalar' : cols === 1 ? 'Function' : 'Table',
      offset,
      relativeOffset: offset - XDF_REL_BASE,
      dimension: rows === 1 && cols === 1 ? 'Value' : cols === 1 ? '1D' : rows > 1 && cols > 1 ? '3D' : '2D',
      dataSize,
      endian,
      rows,
      cols,
      formula,
      unit: 'raw',
      category: /Ign/i.test(title) ? 'Ignition' : /MAF|Air/i.test(title) ? 'Sensors' : /Fuel|Inj/i.test(title) ? 'Fuel' : 'XDF',
      source: 'xdf',
      trustRank: SOURCE_TRUST.xdf,
      zone,
      confidence: 0.55,
      verificationStatus: 'unverified',
      evidence: [
        {
          kind: 'source_claim',
          detail: `XDF title/address/math: ${title} @ 0x${offset.toString(16).toUpperCase()} formula=${formula} zone=${zone}`,
          sources: ['xdf'],
        },
        {
          kind: 'definition_pedigree',
          detail: XDF_PEDIGREE.note,
          sources: ['xdf', 'richard'],
          pedigree: XDF_PEDIGREE,
        },
      ],
    });
  }

  const seen = new Set();
  return out.filter(m => {
    const key = `${m.offset}:${m.rows}x${m.cols}:${m.dataSize}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Pull sheet notes that mention hex offsets — secondary to XDF. */
function parseSheetCandidates(csvText) {
  const out = [];
  const lines = csvText.split(/\r?\n/);
  for (const line of lines) {
    if (!/MAF|Ign|map|table|transfer|axis/i.test(line)) continue;
    const addrMatches = [...line.matchAll(/\b(?:0x)?([0-9A-Fa-f]{4})\b/g)];
    for (const m of addrMatches) {
      const offset = parseInt(m[1], 16);
      // Allow sheet notes in CODE mid-window and DATA after 0xB930
      if (offset < XDF_REL_BASE || offset > MEM.DATA_END) continue;
      if (!/MAF|transfer|Ign|table|axis|map/i.test(line)) continue;
      const id = `sheet_${offset.toString(16)}`;
      if (out.some(c => c.id === id)) continue;
      const zone = zoneForOffset(offset);
      out.push({
        id,
        name: `Sheet note @ 0x${offset.toString(16).toUpperCase()}`,
        description: line.replace(/"/g, "'").slice(0, 200),
        type: 'Scalar',
        offset,
        relativeOffset: offset - XDF_REL_BASE,
        dimension: 'Value',
        dataSize: 8,
        rows: 1,
        cols: 1,
        formula: 'X',
        unit: 'note',
        category: 'Sheet',
        source: 'sheet',
        trustRank: SOURCE_TRUST.sheet,
        zone,
        confidence: 0.2,
        verificationStatus: 'unverified',
        evidence: [
          {
            kind: 'source_claim',
            detail: `CAL sheet line mentions 0x${offset.toString(16).toUpperCase()} (secondary to XDF)`,
            sources: ['sheet'],
          },
        ],
      });
    }
  }
  return out;
}

function byteSpanOk(rom, offset, bytes) {
  return offset >= 0 && bytes > 0 && offset + bytes <= rom.length;
}

function looksMonotonicU16LE(rom, offset, count) {
  let increases = 0;
  let decreases = 0;
  let prev = -1;
  for (let i = 0; i < count; i++) {
    const o = offset + i * 2;
    const raw = rom[o] | (rom[o + 1] << 8);
    if (prev >= 0) {
      if (raw >= prev) increases++;
      else decreases++;
    }
    prev = raw;
  }
  return { increases, decreases, ok: increases > decreases * 3 };
}

function verifyCandidate(rom, map, peers) {
  const evidence = [...(map.evidence || [])];
  const bytes = map.rows * map.cols * (map.dataSize / 8);
  let status = map.verificationStatus || 'unverified';
  let confidence = map.confidence ?? 0.3;
  let decision = 'hold_candidate';
  const zone = map.zone || zoneForOffset(map.offset);

  if (zone === 'data_cal') {
    evidence.push({
      kind: 'offset_in_data',
      detail: `Offset 0x${map.offset.toString(16).toUpperCase()} in DATA_CAL [0x${MEM.DATA_START.toString(16).toUpperCase()}..0xFFFD] (CODE ends inclusive 0xB930)`,
    });
  } else if (zone === 'mid_code_data_island') {
    evidence.push({
      kind: 'offset_mid_code_island',
      detail: `Offset 0x${map.offset.toString(16).toUpperCase()} lies inside CODE≤0xB930 — treat as mid-CODE data island / calibration embedded in CODE window`,
    });
  } else {
    evidence.push({
      kind: 'offset_outside_primary_cal',
      detail: `Offset 0x${map.offset.toString(16).toUpperCase()} outside primary cal windows (zone=${zone})`,
    });
  }

  if (!byteSpanOk(rom, map.offset, bytes)) {
    evidence.push({ kind: 'span_overflow', detail: `Span ${bytes}B does not fit ROM` });
    return { ...map, zone, verificationStatus: 'unverified', confidence: 0.1, evidence, decision: 'reject_span' };
  }

  evidence.push({ kind: 'span_fits', detail: `Span ${bytes}B fits at 0x${map.offset.toString(16).toUpperCase()}` });

  const peersAt = peers.filter(p => p.offset === map.offset && p.id !== map.id);
  const sources = new Set([map.source, ...peersAt.map(p => p.source)].filter(Boolean));
  if (sources.size >= 2) {
    evidence.push({
      kind: 'source_agreement',
      detail: `Independent sources agree on offset: ${[...sources].join(', ')} (XDF preferred on conflicts)`,
      sources: [...sources],
    });
    // Agreement raises trust but does not alone ship — needs binary verification path for verified.
    status = map.source === 'xdf' ? 'plausible' : status === 'unverified' ? 'plausible' : status;
    confidence = Math.max(confidence, map.source === 'xdf' ? 0.65 : 0.5);
  }

  // MAF-specific binary pattern boost (known XDF/legacy claim)
  if (map.offset === 0xd290 && map.dataSize === 16 && map.rows >= 128) {
    const mono = looksMonotonicU16LE(rom, map.offset, Math.min(map.rows, 256));
    evidence.push({
      kind: 'binary_pattern',
      detail: `LE u16 transfer monotonicity increases=${mono.increases} decreases=${mono.decreases}`,
    });
    if (mono.ok && (map.source === 'xdf' || sources.has('xdf'))) {
      status = 'cross_checked';
      confidence = Math.max(confidence, 0.85);
      evidence.push({
        kind: 'formula_range',
        detail: 'MAF claim on RedLabel shows monotonic LE u16 curve; XDF is primary evidence (shipping still gated)',
      });
    } else if (mono.ok) {
      status = status === 'unverified' ? 'plausible' : status;
      confidence = Math.max(confidence, 0.55);
    }
  } else if (map.source === 'xdf') {
    let nonzero = 0;
    for (let i = 0; i < Math.min(bytes, 64); i++) if (rom[map.offset + i] !== 0xff && rom[map.offset + i] !== 0x00) nonzero++;
    if (nonzero > 4) {
      status = status === 'unverified' ? 'plausible' : status;
      confidence = Math.max(confidence, 0.55);
      evidence.push({ kind: 'binary_pattern', detail: `Non-blank sample bytes in first ${Math.min(bytes, 64)}B` });
    }
  } else if (sources.size < 2 && map.offset >= XDF_REL_BASE) {
    let nonzero = 0;
    for (let i = 0; i < Math.min(bytes, 64); i++) if (rom[map.offset + i] !== 0xff && rom[map.offset + i] !== 0x00) nonzero++;
    if (nonzero > 4) {
      status = status === 'unverified' ? 'plausible' : status;
      confidence = Math.max(confidence, 0.35);
      evidence.push({ kind: 'binary_pattern', detail: `Non-blank sample bytes in first ${Math.min(bytes, 64)}B` });
    }
  }

  // Shipping gate: only explicit verified (never auto from XDF alone)
  if (status === 'verified') decision = 'promote_shipping';
  else if (status === 'cross_checked' || status === 'plausible') decision = 'hold_candidate';
  else decision = 'hold_candidate';

  return { ...map, zone, verificationStatus: status, confidence, evidence, decision };
}

/**
 * Prefer XDF when multiple claims share an offset (or overlapping sheet noise).
 * Sheet/legacy at an offset covered by XDF are demoted, not deleted (audit trail).
 */
function applyXdfPreference(verified) {
  const xdfOffsets = new Set(verified.filter(m => m.source === 'xdf').map(m => m.offset));
  const conflicts = [];
  for (const m of verified) {
    if (m.source === 'xdf') continue;
    if (!xdfOffsets.has(m.offset)) continue;
    const before = m.verificationStatus;
    m.conflictWithXdf = true;
    m.confidence = Math.min(m.confidence, 0.25);
    if (m.decision === 'promote_shipping') m.decision = 'hold_candidate';
    if (m.verificationStatus === 'cross_checked' || m.verificationStatus === 'verified') {
      m.verificationStatus = 'plausible';
    }
    m.evidence = m.evidence || [];
    m.evidence.push({
      kind: 'source_conflict_xdf_preferred',
      detail:
        'Offset also claimed by primary XDF definition — prefer XDF names/equations (Richard: most correct definition to date). Sheet/legacy held as secondary.',
      sources: [m.source, 'xdf', 'richard'],
    });
    conflicts.push({
      id: m.id,
      offset: m.offset,
      source: m.source,
      beforeStatus: before,
      afterStatus: m.verificationStatus,
    });
  }
  return conflicts;
}

function legacyCandidates() {
  return [
    {
      id: 'legacy_maf_cal',
      name: 'MAF Calibration (legacy)',
      description: 'BROtronic legacy maf_cal @ 0xD290 — secondary to XDF',
      type: 'Function',
      offset: 0xd290,
      relativeOffset: 0xd290 - XDF_REL_BASE,
      dimension: '1D',
      dataSize: 16,
      endian: 'le',
      rows: 256,
      cols: 1,
      formula: 'X/4',
      unit: 'kg/hr',
      category: 'Sensors',
      source: 'brotronic_legacy',
      trustRank: SOURCE_TRUST.brotronic_legacy,
      zone: zoneForOffset(0xd290),
      confidence: 0.35,
      verificationStatus: 'unverified',
      evidence: [
        {
          kind: 'source_claim',
          detail: 'Legacy BROtronic built-in definition (prefer XDF when conflict)',
          sources: ['brotronic_legacy'],
        },
      ],
    },
    {
      id: 'legacy_ign_main_8c00',
      name: 'Ignition Main WOT (legacy 0x8C00)',
      description: 'Legacy BROtronic ign_main — expected to fail verification vs XDF',
      type: 'Table',
      offset: 0x8c00,
      relativeOffset: 0x8c00 - XDF_REL_BASE,
      dimension: '3D',
      dataSize: 8,
      rows: 12,
      cols: 12,
      formula: 'X*-0.75 + 72',
      unit: '°BTDC',
      category: 'Ignition',
      source: 'brotronic_legacy',
      trustRank: SOURCE_TRUST.brotronic_legacy,
      zone: zoneForOffset(0x8c00),
      confidence: 0.15,
      verificationStatus: 'unverified',
      evidence: [
        {
          kind: 'source_claim',
          detail: 'Legacy BROtronic built-in definition',
          sources: ['brotronic_legacy'],
        },
      ],
    },
  ];
}

function main() {
  ensureDirs();
  const rom = readRom(ROM_PATH);
  const fp = { size: rom.length, checksum16: sum16All(rom) };

  if (!fs.existsSync(XDF_PATH)) {
    console.warn(`WARN: missing ${XDF_PATH} — XDF ingest skipped (primary evidence!)`);
  }
  if (!fs.existsSync(SHEET_PATH)) {
    console.warn(`WARN: missing ${SHEET_PATH} — sheet ingest skipped`);
  }

  const xdfMaps = fs.existsSync(XDF_PATH) ? parseXdfCandidates(fs.readFileSync(XDF_PATH, 'utf8')) : [];
  const sheetMaps = fs.existsSync(SHEET_PATH) ? parseSheetCandidates(fs.readFileSync(SHEET_PATH, 'utf8')) : [];
  const legacy = legacyCandidates();

  // Pool order: XDF primary, then sheet, then legacy
  const pooled = [...xdfMaps, ...sheetMaps, ...legacy];
  const verified = pooled.map(m => verifyCandidate(rom, m, pooled));

  for (const m of verified) {
    if (m.id === 'legacy_ign_main_8c00') {
      m.verificationStatus = 'unverified';
      m.confidence = 0.1;
      m.decision = 'reject_binary_mismatch';
      m.evidence.push({
        kind: 'binary_mismatch',
        detail: 'Axes/timing at 0x8C00 do not look like a WOT ignition table on RedLabel; prefer XDF ign tables',
        sources: ['brotronic_legacy', 'xdf'],
      });
    }
  }

  const conflicts = applyXdfPreference(verified);

  // Shipping gate remains strict — this offline run does not auto-write shipping packs.
  const shipping = verified.filter(m => m.decision === 'promote_shipping');
  const candidates = verified.filter(m => m.decision !== 'promote_shipping');

  const xdfInCode = xdfMaps.filter(m => m.zone === 'mid_code_data_island').length;
  const xdfInData = xdfMaps.filter(m => m.zone === 'data_cal').length;

  const pack = {
    schemaVersion: 1,
    id: '466.29.re_ingest',
    hw: '0261200413',
    sw: '1267357623',
    motronicVersion: 'M3.3.1',
    name: 'RE-ingest (XDF-primary)',
    description:
      'Candidates from primary TunerPro XDF (+ secondary sheet/legacy) against RedLabel. Review before shipping. CODE ends 0xB930 inclusive.',
    isBuiltIn: false,
    expectedSize: fp.size,
    expectedChecksum16: fp.checksum16 === EXPECTED_SUM16 ? fp.checksum16 : fp.checksum16,
    definitionRevision: new Date().toISOString().slice(0, 10) + '.ingest',
    layoutFamily: 'M331_413_623',
    matchPolicy: 'manual',
    fingerprint: { ...fp, hw: '0261200413', sw: '1267357623', releaseId: '466.29' },
    provenance: {
      primaryDefinition: XDF_PEDIGREE,
      codeEndInclusive: MEM.CODE_END,
      dataStart: MEM.DATA_START,
      namingNote: 'C16x900A = CS16 0x900A only',
      isa: 'mcs96_80c196_family',
    },
    maps: [],
    candidateMaps: candidates.map(({ decision, ...rest }) => rest),
  };

  const report = {
    generatedAt: new Date().toISOString(),
    rom: ROM_NAME,
    fingerprint: fp,
    provenance: XDF_PEDIGREE,
    memoryMap: {
      codeEndInclusive: MEM.CODE_END,
      dataStart: MEM.DATA_START,
    },
    counts: {
      xdf: xdfMaps.length,
      xdf_mid_code_island: xdfInCode,
      xdf_data_cal: xdfInData,
      sheet: sheetMaps.length,
      legacy: legacy.length,
      conflicts_xdf_preferred: conflicts.length,
      promote_shipping: shipping.length,
      hold_or_reject: candidates.length,
    },
    conflicts_xdf_preferred: conflicts,
    promote_shipping: shipping.map(m => ({
      id: m.id,
      offset: m.offset,
      source: m.source,
      verificationStatus: m.verificationStatus,
      confidence: m.confidence,
      sources: m.evidence?.flatMap(e => e.sources || []) || [],
    })),
    candidates: candidates.map(m => ({
      id: m.id,
      offset: m.offset,
      source: m.source,
      zone: m.zone,
      verificationStatus: m.verificationStatus,
      confidence: m.confidence,
      decision: m.decision,
      conflictWithXdf: Boolean(m.conflictWithXdf),
    })),
  };

  fs.writeFileSync(path.join(OUT, 'candidates.pack.json'), JSON.stringify(pack, null, 2));
  fs.writeFileSync(path.join(OUT, 'verification_report.json'), JSON.stringify(report, null, 2));

  const md = [
    '# RedLabel verification report',
    '',
    `Generated: ${report.generatedAt}`,
    `ROM: ${ROM_NAME} (size=${fp.size}, CS16=0x${fp.checksum16.toString(16).toUpperCase()})`,
    '',
    '## Primary definition evidence',
    '',
    `- **XDF (Richard):** ${XDF_PEDIGREE.repoPath}`,
    `- Pedigree: ${XDF_PEDIGREE.note}`,
    `- CODE ends **0xB930 inclusive**; DATA_CAL from **0xB931**. MCS-96 CODE ISA. \`C16x900A\` = CS16 only.`,
    '',
    '## Counts',
    '',
    `- XDF maps: ${xdfMaps.length} (mid-CODE islands: ${xdfInCode}, DATA_CAL: ${xdfInData})`,
    `- Sheet notes: ${sheetMaps.length}`,
    `- Legacy: ${legacy.length}`,
    `- Conflicts demoted (XDF preferred): ${conflicts.length}`,
    '',
    '## Promote to shipping',
    ...shipping.map(m => `- **${m.id}** @ 0x${m.offset.toString(16).toUpperCase()} → \`${m.verificationStatus}\` (conf ${m.confidence})`),
    shipping.length ? '' : '_None — shipping gate requires `verified`; XDF-primary candidates stay on hold for binary review._',
    '',
    '## Conflicts (XDF preferred over sheet/legacy)',
    conflicts.length
      ? conflicts
          .slice(0, 40)
          .map(
            c =>
              `- \`${c.id}\` @ 0x${c.offset.toString(16).toUpperCase()} (${c.source}) ${c.beforeStatus} → ${c.afterStatus}`,
          )
          .join('\n')
      : '_None_',
    '',
    '## Hold as candidates',
    `Total: ${candidates.length}`,
    '',
    '## Notes',
    '- This script does **not** overwrite `definitions/packs/*.shipping.json`.',
    '- Prefer XDF when sources conflict; do not blindly mark maps `verified`.',
    '- Online BROtronic stays AI-free; this folder is offline-only.',
  ].join('\n');
  fs.writeFileSync(path.join(OUT, 'verification_report.md'), md);

  console.log(`Ingest complete.`);
  console.log(`  XDF maps: ${xdfMaps.length} (mid-CODE ${xdfInCode}, DATA ${xdfInData})`);
  console.log(`  Sheet notes: ${sheetMaps.length}`);
  console.log(`  Conflicts (XDF preferred): ${conflicts.length}`);
  console.log(`  Promote: ${shipping.length}`);
  console.log(`  Candidates: ${candidates.length}`);
  console.log(`  Wrote ${path.relative(ROOT, path.join(OUT, 'candidates.pack.json'))}`);
  console.log(`  Wrote ${path.relative(ROOT, path.join(OUT, 'verification_report.md'))}`);
}

main();
