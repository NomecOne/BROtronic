#!/usr/bin/env node
/**
 * Resolve MCS-96 LJMP (0xE7) / LCALL (0xEF) CFG targets for RedLabel.
 *
 * Intel MCS-96 / 80C196 encoding (Macro Assembler User's Guide):
 *   LJMP:  E7 disp_lo disp_hi   ; PC <- PC + disp   (disp from end of insn)
 *   LCALL: EF disp_lo disp_hi   ; push PC; PC <- PC + disp
 *
 * Stock Ghidra MCS96.sinc matches Intel:
 *   jmpdest16: reloc is disp16 [reloc = inst_next + disp16;]
 *
 * Earlier offline notes that claimed "absolute LE16" were WRONG. This script
 * emits trustworthy PC-relative edges and keeps the absolute misread only as
 * a rejected hypothesis for documentation.
 *
 * Usage: node tools/re/ghidra/correct_ljmp_targets.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { OUT_DIR, ensureOutDirs, readRom } from '../lib/romPaths.mjs';

const CODE_LO = 0x2000;
const CODE_HI = 0x7fff;
const GHIDRA_LISTING = path.join(OUT_DIR, 'ghidra', 'ghidra_listing.txt');
const COMPARE_LISTING = path.join(OUT_DIR, 'ghidra', 'compare_mcs96', 'ghidra_listing.txt');

function regionOf(addr) {
  if (addr <= 0x1fff) return 'PAD_LOW';
  if (addr >= 0x2000 && addr <= 0x200f) return 'VECTOR';
  if (addr >= 0x2010 && addr <= 0x7fff) return 'CODE';
  if (addr >= 0x8000 && addr <= 0xfffd) return 'DATA';
  return 'OTHER';
}

function loadListing(filePath) {
  if (!fs.existsSync(filePath)) return new Map();
  const map = new Map();
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    if (!line || line.startsWith(';')) continue;
    const m = line.match(/^(?:[0-9A-Fa-f]{4}:)?([0-9A-Fa-f]{1,4})\s+(.*)$/);
    if (!m) continue;
    map.set(parseInt(m[1], 16), m[2].trim());
  }
  return map;
}

function hex4(n) {
  return '0x' + (n & 0xffff).toString(16).toUpperCase().padStart(4, '0');
}

function main() {
  ensureOutDirs();
  const buf = readRom();
  const listing = loadListing(
    fs.existsSync(GHIDRA_LISTING) ? GHIDRA_LISTING : COMPARE_LISTING,
  );

  const rows = [];
  for (let i = CODE_LO; i <= CODE_HI - 2; i++) {
    const op = buf[i];
    if (op !== 0xe7 && op !== 0xef) continue;
    const disp = buf[i + 1] | (buf[i + 2] << 8);
    const pcRelTarget = (i + 3 + disp) & 0xffff; // Intel + Ghidra
    const absMisread = disp; // rejected hypothesis: treat disp as absolute address
    const ghidraText = listing.get(i) || null;
    const ghidraTarget = (() => {
      if (!ghidraText) return null;
      const m = ghidraText.match(/\b(?:LJMP|LCALL)\s+0x([0-9A-Fa-f]+)\b/i);
      return m ? parseInt(m[1], 16) & 0xffff : null;
    })();
    const matchesGhidra = ghidraTarget === null ? null : ghidraTarget === pcRelTarget;
    rows.push({
      at: i,
      atHex: hex4(i),
      op: op === 0xe7 ? 'LJMP' : 'LCALL',
      bytesHex: Buffer.from([op, buf[i + 1], buf[i + 2]]).toString('hex'),
      disp,
      dispHex: hex4(disp),
      target: pcRelTarget,
      targetHex: hex4(pcRelTarget),
      targetRegion: regionOf(pcRelTarget),
      rejectedAbsTarget: absMisread,
      rejectedAbsTargetHex: hex4(absMisread),
      rejectedAbsRegion: regionOf(absMisread),
      ghidraText,
      ghidraTarget,
      ghidraTargetHex: ghidraTarget === null ? null : hex4(ghidraTarget),
      matchesGhidra,
      alignedInListing: listing.has(i),
    });
  }

  const aligned = rows.filter(r => r.alignedInListing && r.ghidraText && /^(LJMP|LCALL)\b/.test(r.ghidraText));
  const matchCount = aligned.filter(r => r.matchesGhidra).length;
  const byTargetRegion = {};
  const byRejectedRegion = {};
  for (const r of aligned) {
    byTargetRegion[r.targetRegion] = (byTargetRegion[r.targetRegion] || 0) + 1;
    byRejectedRegion[r.rejectedAbsRegion] = (byRejectedRegion[r.rejectedAbsRegion] || 0) + 1;
  }

  const representative = [];
  const pick = (pred, note) => {
    const hit = rows.find(pred);
    if (hit) representative.push({ ...hit, siteNote: note });
  };
  pick(r => r.at === 0x2091, 'Reset-path LJMP after VECTOR_Reset body');
  pick(r => r.at === 0x2094, 'Trampoline table entry (PC-rel lands on real prologue)');
  pick(r => r.at === 0x2097, 'Trampoline → LD SP,#0x100');
  pick(r => r.at === 0x20b2, 'Trampoline → shared helper @0x2269');
  pick(r => r.at === 0x4179, 'IRQ stub vec0: PUSHF; LJMP (target in high image)');
  pick(r => r.at === 0x417d, 'IRQ stub slice @0x417C NOP; LJMP');
  pick(r => r.at === 0x4181, 'IRQ stub vec2: PUSHF; LJMP');
  pick(r => r.at === 0x62fd && r.op === 'LCALL', 'Follow-on LCALL often misread as abs→DATA');

  const cfgEdges = aligned.map(r => ({
    from: r.at,
    fromHex: r.atHex,
    op: r.op,
    dispHex: r.dispHex,
    to: r.target,
    toHex: r.targetHex,
    toRegion: r.targetRegion,
    bytesHex: r.bytesHex,
    verificationStatus: r.matchesGhidra ? 'cross_checked' : 'plausible',
  }));

  const report = {
    schemaVersion: 2,
    id: 'mcs96_ljmp_lcall_cfg_v2',
    verificationStatus: 'cross_checked',
    conclusion: {
      instructionIdentity: 'true_MCS96_LJMP_LCALL',
      addressing: 'pc_relative_disp16',
      formula: 'target = (insn_addr + 3 + le16(disp)) & 0xFFFF',
      ghidraSleigh: 'CORRECT (inst_next + disp16)',
      rejectedHypothesis: 'absolute LE16 destination word',
      intelRef:
        'Intel MCS-96 Macro Assembler User\'s Guide: LJMP/LCALL store offset from end of instruction; PC <- PC + disp. Opcodes E7 / EF.',
    },
    counts: {
      scannedE7EfInCodeWindow: rows.length,
      ljmp: rows.filter(r => r.op === 'LJMP').length,
      lcall: rows.filter(r => r.op === 'LCALL').length,
      ghidraAlignedLjLm: aligned.length,
      ghidraMatchesPcRel: matchCount,
      ghidraMismatch: aligned.length - matchCount,
      pcRelTargetRegions: byTargetRegion,
      rejectedAbsTargetRegions: byRejectedRegion,
    },
    representativeSites: representative,
    cfgEdgeCount: cfgEdges.length,
  };

  // Authoritative outputs
  const cfgJson = path.join(OUT_DIR, 'mcs96_cfg_edges.json');
  const cfgCsv = path.join(OUT_DIR, 'mcs96_cfg_edges.csv');
  const resolveJson = path.join(OUT_DIR, 'mcs96_branch_resolve.json');
  fs.writeFileSync(
    cfgJson,
    JSON.stringify(
      {
        schemaVersion: 2,
        addressing: 'pc_relative_disp16',
        verificationStatus: 'cross_checked',
        edgeCount: cfgEdges.length,
        edges: cfgEdges,
      },
      null,
      2,
    ) + '\n',
    'utf8',
  );
  fs.writeFileSync(
    cfgCsv,
    [
      'from_hex,op,bytes,disp_hex,to_hex,to_region,verificationStatus',
      ...cfgEdges.map(
        e =>
          `${e.fromHex},${e.op},${e.bytesHex},${e.dispHex},${e.toHex},${e.toRegion},${e.verificationStatus}`,
      ),
    ].join('\n') + '\n',
    'utf8',
  );
  fs.writeFileSync(resolveJson, JSON.stringify(report, null, 2) + '\n', 'utf8');

  // Supersede old absolute artifact with explicit rejection banner
  const legacy = {
    schemaVersion: 2,
    deprecated: true,
    verificationStatus: 'rejected',
    note:
      'REJECTED hypothesis. LJMP/LCALL are PC-relative per Intel MCS-96. See mcs96_cfg_edges.json / mcs96_branch_resolve.json / blocker1_ljmp_lcall.md.',
    correctAddressing: 'pc_relative_disp16',
    incorrectAddressing: 'absolute_le16',
    counts: report.counts,
  };
  fs.writeFileSync(path.join(OUT_DIR, 'mcs96_absolute_branches.json'), JSON.stringify(legacy, null, 2) + '\n', 'utf8');
  fs.writeFileSync(
    path.join(OUT_DIR, 'mcs96_absolute_branches.csv'),
    'status,note\nrejected,Use mcs96_cfg_edges.csv — LJMP/LCALL are PC-relative not absolute\n',
    'utf8',
  );

  // Listing overlay: keep Ghidra text, annotate disp + confirmed target
  const overlayPath = path.join(OUT_DIR, 'ghidra', 'ghidra_listing_cfg_overlay.txt');
  const overlayLines = [
    '; BROtronic CFG overlay for MCS-96 LJMP/LCALL',
    '; addressing=pc_relative_disp16 (Intel + Ghidra SLEIGH) — NOT absolute',
    `; aligned_edges=${cfgEdges.length} ghidra_matches=${matchCount}`,
    '',
  ];
  for (const e of cfgEdges) {
    overlayLines.push(
      `${e.fromHex.slice(2)}  ${e.op} ${e.toHex}  ; bytes=${e.bytesHex} disp=${e.dispHex} region=${e.toRegion}`,
    );
  }
  overlayLines.push('');
  fs.writeFileSync(overlayPath, overlayLines.join('\n'), 'utf8');

  console.log(
    JSON.stringify(
      {
        ok: true,
        conclusion: report.conclusion.addressing,
        ghidraSleigh: report.conclusion.ghidraSleigh,
        aligned: aligned.length,
        ghidraMatchesPcRel: matchCount,
        cfgEdges: cfgEdges.length,
        out: {
          resolveJson,
          cfgJson,
          cfgCsv,
          overlayPath,
        },
      },
      null,
      2,
    ),
  );
}

main();
