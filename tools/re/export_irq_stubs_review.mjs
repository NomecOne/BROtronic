#!/usr/bin/env node
/**
 * Export IRQ stub visual-review package for RedLabel.
 * Uses baseline CODE through 0xB930 inclusive (Richard).
 *
 * Usage: node tools/re/export_irq_stubs_review.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import {
  OUT_DIR,
  MEM,
  ensureOutDirs,
  readRom,
  regionKindAt,
  ROM_NAME,
} from './lib/romPaths.mjs';

function hexWindow(buf, addr, before = 4, after = 16) {
  const lo = Math.max(0, addr - before);
  const hi = Math.min(buf.length, addr + after);
  return {
    start: lo,
    endExclusive: hi,
    hex: Buffer.from(buf.subarray(lo, hi)).toString('hex'),
    focusOffset: addr - lo,
  };
}

function loadListing() {
  const p = path.join(OUT_DIR, 'ghidra', 'ghidra_listing.txt');
  const map = new Map();
  if (!fs.existsSync(p)) return map;
  for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
    if (!line || line.startsWith(';')) continue;
    const m = line.match(/^(?:[0-9A-Fa-f]{4}:)?([0-9A-Fa-f]{1,4})\s+(.*)$/);
    if (!m) continue;
    map.set(parseInt(m[1], 16), m[2].trim());
  }
  return map;
}

function loadCfgEdges() {
  const p = path.join(OUT_DIR, 'mcs96_cfg_edges.json');
  if (!fs.existsSync(p)) return new Map();
  const j = JSON.parse(fs.readFileSync(p, 'utf8'));
  const m = new Map();
  for (const e of j.edges || []) m.set(e.from, e);
  return m;
}

function main() {
  ensureOutDirs();
  const buf = readRom();
  const listing = loadListing();
  const edges = loadCfgEdges();

  const sites = [];
  for (let i = 0; i < 8; i++) {
    const vectorAddr = 0x2000 + i * 2;
    const stubAddr = buf[vectorAddr] | (buf[vectorAddr + 1] << 8);
    let ljmpAddr = null;
    if (buf[stubAddr] === 0xe7) ljmpAddr = stubAddr;
    else if (stubAddr + 1 < buf.length && buf[stubAddr + 1] === 0xe7) ljmpAddr = stubAddr + 1;

    const edge = ljmpAddr != null ? edges.get(ljmpAddr) : null;
    let target = edge?.to ?? null;
    if (target == null && ljmpAddr != null) {
      const disp = buf[ljmpAddr + 1] | (buf[ljmpAddr + 2] << 8);
      target = (ljmpAddr + 3 + disp) & 0xffff;
    }

    const stubRegion = regionKindAt(stubAddr);
    const landRegion = target != null ? regionKindAt(target) : null;
    const insideBaselineCode = target != null && target >= MEM.CODE_START && target <= MEM.CODE_END;
    const prologue = { 0xf2: 'PUSHF', 0xfd: 'NOP' }[buf[stubAddr]] || `OP_${buf[stubAddr].toString(16)}`;

    const destInsns = [];
    if (target != null) {
      for (let a = target; a < Math.min(target + 24, 0x10000); a++) {
        if (listing.has(a)) destInsns.push({ addr: a, addrHex: '0x' + a.toString(16).toUpperCase().padStart(4, '0'), insn: listing.get(a) });
      }
    }

    let explanation =
      `Vector[${i}] @0x${vectorAddr.toString(16).toUpperCase().padStart(4, '0')} -> stub 0x${stubAddr.toString(16).toUpperCase().padStart(4, '0')} (${prologue}` +
      (ljmpAddr != null ? ` + LJMP @0x${ljmpAddr.toString(16).toUpperCase().padStart(4, '0')})` : ')');
    if (edge) {
      explanation += ` PC-rel CFG: ${edge.op} disp ${edge.dispHex} -> ${edge.toHex} (region ${landRegion}).`;
    }
    if (insideBaselineCode) {
      explanation +=
        ' Landing is inside baseline CODE (≤0xB930 inclusive). Prior DATA label at 0xAxxx was a classifier boundary error; remaining question is mid-CODE executable vs data-island.';
    } else if (landRegion === 'DATA') {
      explanation += ' Landing is after CODE end (0xB931+ DATA_CAL).';
    }

    sites.push({
      id: `vec${i}_stub`,
      vectorIndex: i,
      addr: ljmpAddr ?? stubAddr,
      addrHex: '0x' + (ljmpAddr ?? stubAddr).toString(16).toUpperCase().padStart(4, '0'),
      vectorAddr,
      vectorAddrHex: '0x' + vectorAddr.toString(16).toUpperCase().padStart(4, '0'),
      stubAddr,
      stubAddrHex: '0x' + stubAddr.toString(16).toUpperCase().padStart(4, '0'),
      stubPrologue: prologue,
      bytes: hexWindow(buf, ljmpAddr ?? stubAddr, 4, 16),
      stubBytes: hexWindow(buf, stubAddr, 0, 8),
      ghidra_insn: listing.get(ljmpAddr ?? stubAddr) || null,
      ghidra_insn_at_stub: listing.get(stubAddr) || null,
      region_label: stubRegion,
      cfg_edge_from: {
        from: edge?.from ?? ljmpAddr,
        fromHex: edge?.fromHex ?? (ljmpAddr != null ? '0x' + ljmpAddr.toString(16).toUpperCase().padStart(4, '0') : null),
        op: edge?.op ?? 'LJMP',
        bytesHex: edge?.bytesHex ?? null,
        dispHex: edge?.dispHex ?? null,
        to: edge?.to ?? target,
        toHex: edge?.toHex ?? (target != null ? '0x' + target.toString(16).toUpperCase().padStart(4, '0') : null),
        toRegion: landRegion,
        toInsideBaselineCode: insideBaselineCode,
        verificationStatus: edge?.verificationStatus ?? 'plausible',
      },
      landing: {
        addr: target,
        addrHex: target != null ? '0x' + target.toString(16).toUpperCase().padStart(4, '0') : null,
        region_label: landRegion,
        insideBaselineCode,
        inHighAxxx: target != null && target >= 0xa000 && target <= 0xafff,
        bytes: target != null ? hexWindow(buf, target, 0, 24) : null,
        ghidra_insns_nearby: destInsns.slice(0, 8),
      },
      explanation,
    });
  }

  const pkg = {
    schemaVersion: 2,
    id: 'irq_stubs_review_v2',
    purpose: 'Human visual review of IRQ stub PC-rel landings under baseline CODE≤0xB930',
    rom: ROM_NAME,
    isa: 'mcs96_80c196_family',
    ghidraLanguage: 'MCS96:LE:16:default',
    codeBounds: {
      start: MEM.CODE_START,
      endInclusive: MEM.CODE_END,
      endExclusive: MEM.CODE_END_EXCLUSIVE,
      dataStart: MEM.DATA_START,
      note: 'CODE ends at 0xB930 inclusive (Richard). 0xAxxx landings are inside CODE.',
    },
    addressingNote: 'LJMP/LCALL are PC-relative disp16; Ghidra SLEIGH correct.',
    siteCount: sites.length,
    sitesInsideCodeToB930: sites.filter(s => s.landing.insideBaselineCode).length,
    axxxLandingCount: sites.filter(s => s.landing.inHighAxxx).length,
    sites,
    shippingNote: 'Review-only. Do not promote into definitions/packs/*.shipping.json.',
  };

  const out = path.join(OUT_DIR, 'irq_stubs_review.json');
  fs.writeFileSync(out, JSON.stringify(pkg, null, 2) + '\n');
  console.log(
    JSON.stringify(
      {
        ok: true,
        out,
        siteCount: pkg.siteCount,
        sitesInsideCodeToB930: pkg.sitesInsideCodeToB930,
        axxxLandingCount: pkg.axxxLandingCount,
      },
      null,
      2,
    ),
  );
}

main();
