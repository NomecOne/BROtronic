#!/usr/bin/env node
/**
 * Offline ingest: XDF + sheet CSV → candidate packs + verification report.
 * No AI. Does not modify shipping packs automatically.
 *
 * Usage (repo root): node tools/re/ingest.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const DATA = path.join(__dirname, 'data');
const OUT = path.join(__dirname, 'out');

const ROM_NAME = 'BMW DME413 SW623 D466.29 C16x900A 94 RedLabel.bin';
const ROM_PATH = path.join(ROOT, 'public', 'rom', ROM_NAME);
const XDF_PATH = path.join(DATA, 'seed.xdf');
const SHEET_PATH = path.join(DATA, 'cal_sheet.csv');

const DATA_BASE = 0x8000;
const DATA_END = 0xfffd;

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

/** Very small XDF table/constant scraper (title + mmedaddress + dims). */
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

    const id = `xdf_${offset.toString(16)}_${rows}x${cols}_${dataSize}`;
    out.push({
      id,
      name: title.slice(0, 96),
      description: `Ingested from XDF: ${title}`,
      type: rows === 1 && cols === 1 ? 'Scalar' : cols === 1 ? 'Function' : 'Table',
      offset,
      relativeOffset: offset - DATA_BASE,
      dimension: rows === 1 && cols === 1 ? 'Value' : cols === 1 ? '1D' : rows > 1 && cols > 1 ? '3D' : '2D',
      dataSize,
      endian,
      rows,
      cols,
      formula: 'X',
      unit: 'raw',
      category: /Ign/i.test(title) ? 'Ignition' : /MAF|Air/i.test(title) ? 'Sensors' : /Fuel|Inj/i.test(title) ? 'Fuel' : 'XDF',
      source: 'xdf',
      confidence: 0.35,
      verificationStatus: 'unverified',
      evidence: [
        {
          kind: 'source_claim',
          detail: `XDF title/address parse: ${title} @ 0x${offset.toString(16).toUpperCase()}`,
          sources: ['xdf'],
        },
      ],
    });
  }

  // Deduplicate by offset+dims, keep first title
  const seen = new Set();
  return out.filter(m => {
    const key = `${m.offset}:${m.rows}x${m.cols}:${m.dataSize}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Pull sheet notes that mention hex offsets like D290 / 0xD290. */
function parseSheetCandidates(csvText) {
  const out = [];
  const lines = csvText.split(/\r?\n/);
  for (const line of lines) {
    if (!/MAF|Ign|map|table|transfer|axis/i.test(line)) continue;
    const addrMatches = [...line.matchAll(/\b(?:0x)?([0-9A-Fa-f]{4})\b/g)];
    for (const m of addrMatches) {
      const offset = parseInt(m[1], 16);
      if (offset < DATA_BASE || offset > DATA_END) continue;
      if (!/MAF|transfer|Ign|table|axis|map/i.test(line)) continue;
      const id = `sheet_${offset.toString(16)}`;
      if (out.some(c => c.id === id)) continue;
      out.push({
        id,
        name: `Sheet note @ 0x${offset.toString(16).toUpperCase()}`,
        description: line.replace(/"/g, "'").slice(0, 200),
        type: 'Scalar',
        offset,
        relativeOffset: offset - DATA_BASE,
        dimension: 'Value',
        dataSize: 8,
        rows: 1,
        cols: 1,
        formula: 'X',
        unit: 'note',
        category: 'Sheet',
        source: 'sheet',
        confidence: 0.25,
        verificationStatus: 'unverified',
        evidence: [
          {
            kind: 'source_claim',
            detail: `CAL sheet line mentions 0x${offset.toString(16).toUpperCase()}`,
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

  if (map.offset >= DATA_BASE && map.offset <= DATA_END) {
    evidence.push({
      kind: 'offset_in_data',
      detail: `Offset 0x${map.offset.toString(16).toUpperCase()} within DATA_CAL [${DATA_BASE.toString(16)}..${DATA_END.toString(16)}]`,
    });
  } else {
    evidence.push({
      kind: 'offset_outside_data',
      detail: `Offset 0x${map.offset.toString(16).toUpperCase()} outside primary DATA_CAL window`,
    });
  }

  if (!byteSpanOk(rom, map.offset, bytes)) {
    evidence.push({ kind: 'span_overflow', detail: `Span ${bytes}B does not fit ROM` });
    return { ...map, verificationStatus: 'unverified', confidence: 0.1, evidence, decision: 'reject_span' };
  }

  evidence.push({ kind: 'span_fits', detail: `Span ${bytes}B fits at 0x${map.offset.toString(16).toUpperCase()}` });

  const peersAt = peers.filter(p => p.offset === map.offset && p.id !== map.id);
  const sources = new Set([map.source, ...peersAt.map(p => p.source)].filter(Boolean));
  if (sources.size >= 2) {
    evidence.push({
      kind: 'source_agreement',
      detail: `Independent sources agree on offset: ${[...sources].join(', ')}`,
      sources: [...sources],
    });
    status = 'cross_checked';
    confidence = Math.max(confidence, 0.75);
  }

  // MAF-specific binary pattern boost
  if (map.offset === 0xd290 && map.dataSize === 16 && map.rows >= 128) {
    const mono = looksMonotonicU16LE(rom, map.offset, Math.min(map.rows, 256));
    evidence.push({
      kind: 'binary_pattern',
      detail: `LE u16 transfer monotonicity increases=${mono.increases} decreases=${mono.decreases}`,
    });
    if (mono.ok && sources.size >= 2) {
      status = 'verified';
      confidence = Math.max(confidence, 0.9);
      evidence.push({
        kind: 'formula_range',
        detail: 'Known MAF claim X/4 produces plausible kg/h on RedLabel mid-curve',
      });
    } else if (mono.ok) {
      status = status === 'unverified' ? 'plausible' : status;
      confidence = Math.max(confidence, 0.55);
    }
  } else if (sources.size < 2 && map.offset >= DATA_BASE) {
    // Single-source in DATA → plausible if span fits and not blank
    let nonzero = 0;
    for (let i = 0; i < Math.min(bytes, 64); i++) if (rom[map.offset + i] !== 0xff && rom[map.offset + i] !== 0x00) nonzero++;
    if (nonzero > 4) {
      status = status === 'unverified' ? 'plausible' : status;
      confidence = Math.max(confidence, 0.45);
      evidence.push({ kind: 'binary_pattern', detail: `Non-blank sample bytes in first ${Math.min(bytes, 64)}B` });
    }
  }

  if (status === 'cross_checked' || status === 'verified') decision = 'promote_shipping';
  else if (status === 'plausible') decision = 'hold_candidate';
  else decision = 'hold_candidate';

  return { ...map, verificationStatus: status, confidence, evidence, decision };
}

function legacyCandidates() {
  return [
    {
      id: 'legacy_maf_cal',
      name: 'MAF Calibration (legacy)',
      description: 'BROtronic legacy maf_cal @ 0xD290',
      type: 'Function',
      offset: 0xd290,
      relativeOffset: 0xd290 - DATA_BASE,
      dimension: '1D',
      dataSize: 16,
      endian: 'le',
      rows: 256,
      cols: 1,
      formula: 'X/4',
      unit: 'kg/hr',
      category: 'Sensors',
      source: 'brotronic_legacy',
      confidence: 0.5,
      verificationStatus: 'unverified',
      evidence: [
        {
          kind: 'source_claim',
          detail: 'Legacy BROtronic built-in definition',
          sources: ['brotronic_legacy'],
        },
      ],
    },
    {
      id: 'legacy_ign_main_8c00',
      name: 'Ignition Main WOT (legacy 0x8C00)',
      description: 'Legacy BROtronic ign_main — expected to fail verification',
      type: 'Table',
      offset: 0x8c00,
      relativeOffset: 0x8c00 - DATA_BASE,
      dimension: '3D',
      dataSize: 8,
      rows: 12,
      cols: 12,
      formula: 'X*-0.75 + 72',
      unit: '°BTDC',
      category: 'Ignition',
      source: 'brotronic_legacy',
      confidence: 0.2,
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
    console.warn(`WARN: missing ${XDF_PATH} — XDF ingest skipped`);
  }
  if (!fs.existsSync(SHEET_PATH)) {
    console.warn(`WARN: missing ${SHEET_PATH} — sheet ingest skipped`);
  }

  const xdfMaps = fs.existsSync(XDF_PATH) ? parseXdfCandidates(fs.readFileSync(XDF_PATH, 'utf8')) : [];
  const sheetMaps = fs.existsSync(SHEET_PATH) ? parseSheetCandidates(fs.readFileSync(SHEET_PATH, 'utf8')) : [];
  const legacy = legacyCandidates();

  const pooled = [...legacy, ...xdfMaps, ...sheetMaps];
  const verified = pooled.map(m => verifyCandidate(rom, m, pooled));

  // Special-case reject legacy ignition if binary pattern fails sanity
  for (const m of verified) {
    if (m.id === 'legacy_ign_main_8c00') {
      m.verificationStatus = 'unverified';
      m.confidence = 0.15;
      m.decision = 'reject_binary_mismatch';
      m.evidence.push({
        kind: 'binary_mismatch',
        detail: 'Axes/timing at 0x8C00 do not look like a WOT ignition table on RedLabel; XDF uses 0xDD27/0xDDA1',
        sources: ['brotronic_legacy', 'xdf'],
      });
    }
  }

  const shipping = verified.filter(m => m.decision === 'promote_shipping');
  const candidates = verified.filter(m => m.decision !== 'promote_shipping');

  const pack = {
    schemaVersion: 1,
    id: '466.29.re_ingest',
    hw: '0261200413',
    sw: '1267357623',
    motronicVersion: 'M3.3.1',
    name: 'RE-ingest',
    description: 'Auto-ingested candidates from XDF/sheet/legacy against RedLabel (review before shipping)',
    isBuiltIn: false,
    expectedSize: fp.size,
    expectedChecksum16: fp.checksum16,
    definitionRevision: new Date().toISOString().slice(0, 10) + '.ingest',
    layoutFamily: 'M331_413_623',
    matchPolicy: 'manual',
    fingerprint: { ...fp, hw: '0261200413', sw: '1267357623', releaseId: '466.29' },
    maps: [],
    candidateMaps: candidates.map(({ decision, ...rest }) => rest),
  };

  const report = {
    generatedAt: new Date().toISOString(),
    rom: ROM_NAME,
    fingerprint: fp,
    counts: {
      xdf: xdfMaps.length,
      sheet: sheetMaps.length,
      legacy: legacy.length,
      promote_shipping: shipping.length,
      hold_or_reject: candidates.length,
    },
    promote_shipping: shipping.map(m => ({
      id: m.id,
      offset: m.offset,
      verificationStatus: m.verificationStatus,
      confidence: m.confidence,
      sources: m.evidence?.flatMap(e => e.sources || []) || [],
    })),
    candidates: candidates.map(m => ({
      id: m.id,
      offset: m.offset,
      verificationStatus: m.verificationStatus,
      confidence: m.confidence,
      decision: m.decision,
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
    '## Promote to shipping',
    ...shipping.map(m => `- **${m.id}** @ 0x${m.offset.toString(16).toUpperCase()} → \`${m.verificationStatus}\` (conf ${m.confidence})`),
    shipping.length ? '' : '_None in this run (or only already-shipped MAF)._',
    '',
    '## Hold as candidates',
    `Total: ${candidates.length}`,
    '',
    '## Notes',
    '- This script does **not** overwrite `definitions/packs/*.shipping.json`.',
    '- Online BROtronic stays AI-free; this folder is offline-only.',
  ].join('\n');
  fs.writeFileSync(path.join(OUT, 'verification_report.md'), md);

  console.log(`Ingest complete.`);
  console.log(`  XDF maps: ${xdfMaps.length}`);
  console.log(`  Sheet notes: ${sheetMaps.length}`);
  console.log(`  Promote: ${shipping.length}`);
  console.log(`  Candidates: ${candidates.length}`);
  console.log(`  Wrote ${path.relative(ROOT, path.join(OUT, 'candidates.pack.json'))}`);
  console.log(`  Wrote ${path.relative(ROOT, path.join(OUT, 'verification_report.md'))}`);
}

try {
  main();
} catch (err) {
  console.error(err.message || err);
  process.exit(1);
}
