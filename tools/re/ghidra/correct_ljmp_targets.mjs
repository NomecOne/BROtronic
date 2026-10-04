#!/usr/bin/env node
/**
 * Emit absolute LJMP/LCALL targets from RedLabel bytes.
 *
 * Stock Ghidra MCS96.sinc defines:
 *   jmpdest16: reloc is disp16 [reloc = inst_next + disp16;]
 * but Intel MCS-96 LJMP (0xE7) / LCALL (0xEF) take an absolute 16-bit address.
 * Use this report when following control flow from Ghidra listings.
 *
 * Usage: node tools/re/ghidra/correct_ljmp_targets.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { OUT_DIR, ensureOutDirs, readRom } from '../lib/romPaths.mjs';

const CODE_LO = 0x2000;
const CODE_HI = 0x7fff;

function main() {
  ensureOutDirs();
  const buf = readRom();
  const rows = [];
  for (let i = CODE_LO; i <= CODE_HI - 2; i++) {
    const op = buf[i];
    if (op !== 0xe7 && op !== 0xef) continue;
    const abs = buf[i + 1] | (buf[i + 2] << 8);
    const ghidraRel = (i + 3 + abs) & 0xffff; // what stock SLEIGH displays
    rows.push({
      at: i,
      atHex: '0x' + i.toString(16).toUpperCase().padStart(4, '0'),
      op: op === 0xe7 ? 'LJMP' : 'LCALL',
      absTarget: abs,
      absTargetHex: '0x' + abs.toString(16).toUpperCase().padStart(4, '0'),
      ghidraDisplayedIfPcRel: ghidraRel,
      ghidraDisplayedHex: '0x' + ghidraRel.toString(16).toUpperCase().padStart(4, '0'),
      absInCodeWindow: abs >= CODE_LO && abs <= CODE_HI,
    });
  }

  const inCode = rows.filter(r => r.absInCodeWindow).length;
  const report = {
    schemaVersion: 1,
    verificationStatus: 'plausible',
    note:
      'Absolute LE16 targets for MCS-96 LJMP/LCALL. Stock Ghidra MCS96 language adds inst_next (PC-relative) — incorrect for these opcodes.',
    codeWindow: { start: CODE_LO, end: CODE_HI },
    counts: {
      total: rows.length,
      ljmp: rows.filter(r => r.op === 'LJMP').length,
      lcall: rows.filter(r => r.op === 'LCALL').length,
      absTargetInCodeWindow: inCode,
    },
    sampleVectorStubs: rows.filter(r => r.at >= 0x4178 && r.at <= 0x4197),
    entries: rows,
  };

  const outJson = path.join(OUT_DIR, 'mcs96_absolute_branches.json');
  const outCsv = path.join(OUT_DIR, 'mcs96_absolute_branches.csv');
  fs.writeFileSync(outJson, JSON.stringify(report, null, 2) + '\n', 'utf8');
  const csv = [
    'at_hex,op,abs_target_hex,ghidra_pc_rel_display_hex,abs_in_code',
    ...rows.map(
      r =>
        `${r.atHex},${r.op},${r.absTargetHex},${r.ghidraDisplayedHex},${r.absInCodeWindow}`,
    ),
  ].join('\n');
  fs.writeFileSync(outCsv, csv + '\n', 'utf8');
  console.log(
    JSON.stringify(
      {
        ok: true,
        total: report.counts.total,
        absTargetInCodeWindow: inCode,
        sampleVectorStubs: report.sampleVectorStubs,
        outJson,
        outCsv,
      },
      null,
      2,
    ),
  );
}

main();
