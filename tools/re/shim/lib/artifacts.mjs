/**
 * Read / freshness checks against tools/re/out Ghidra exports.
 */
import fs from 'node:fs';
import {
  REQUIRED_EXPORTS,
  EXPORT_META,
  LISTING,
  FUNCTIONS_CSV,
  SYMBOLS_CSV,
  CFG_EDGES,
  ROM_PATH,
  LANGUAGE,
  HEADLESS_STATUS,
} from './paths.mjs';
import { exists, readJson, mtimeMs, hex } from './io.mjs';

export function exportPresence() {
  const present = {};
  for (const p of REQUIRED_EXPORTS) present[p] = exists(p);
  present[SYMBOLS_CSV] = exists(SYMBOLS_CSV);
  present[CFG_EDGES] = exists(CFG_EDGES);
  return present;
}

/**
 * Prefer reusing artifacts when:
 * - required exports exist
 * - meta language is MCS96:LE:16:default
 * - listing mtime is not older than ROM (when ROM present)
 */
export function artifactFreshness() {
  const present = exportPresence();
  const missing = REQUIRED_EXPORTS.filter((p) => !present[p]);
  const meta = readJson(EXPORT_META);
  const languageOk = meta?.language === LANGUAGE;
  const romM = mtimeMs(ROM_PATH);
  const listingM = mtimeMs(LISTING);
  const metaM = mtimeMs(EXPORT_META);
  let staleVsRom = false;
  if (romM != null && listingM != null && listingM + 500 < romM) {
    staleVsRom = true;
  }

  const fresh =
    missing.length === 0 && languageOk && !staleVsRom && Boolean(meta?.instructionCount > 0);

  const reasons = [];
  if (missing.length) reasons.push(`missing exports: ${missing.map((p) => p.split(/[/\\]/).pop()).join(', ')}`);
  if (meta && !languageOk) {
    reasons.push(`language is ${meta.language}, expected ${LANGUAGE}`);
  }
  if (!meta && missing.length === 0) reasons.push('ghidra_export_meta.json unreadable');
  if (staleVsRom) reasons.push('listing older than ROM — refresh recommended');
  if (meta && !(meta.instructionCount > 0)) reasons.push('instructionCount is 0');

  return {
    fresh,
    languageOk,
    staleVsRom,
    missing,
    meta,
    present,
    listingMtime: listingM,
    romMtime: romM,
    metaMtime: metaM,
    reasons,
    headlessStatus: readJson(HEADLESS_STATUS),
  };
}

/** Parse ghidra_listing.txt lines into { addr, text, line }. */
export function loadListingIndex() {
  if (!exists(LISTING)) return { lines: [], byAddr: new Map(), sortedAddrs: [] };
  const text = fs.readFileSync(LISTING, 'utf8');
  const lines = [];
  const byAddr = new Map();
  for (const raw of text.split(/\r?\n/)) {
    if (!raw || raw.startsWith(';')) continue;
    const m = raw.match(/^([0-9a-fA-F]+)\s+(\S.*)$/);
    if (!m) continue;
    const addr = Number.parseInt(m[1], 16);
    const entry = { addr, text: m[2].trim(), raw };
    lines.push(entry);
    if (!byAddr.has(addr)) byAddr.set(addr, entry);
  }
  const sortedAddrs = [...byAddr.keys()].sort((a, b) => a - b);
  return { lines, byAddr, sortedAddrs };
}

export function disasmAt(addr, { count = 16, before = 0 } = {}) {
  const { byAddr, sortedAddrs } = loadListingIndex();
  if (!sortedAddrs.length) {
    return { ok: false, error: 'No listing loaded — run export-refresh first', address: hex(addr) };
  }

  let idx = sortedAddrs.findIndex((a) => a >= addr);
  if (idx < 0) idx = sortedAddrs.length - 1;
  // Prefer exact or nearest at/before when requesting a CODE site
  if (byAddr.has(addr)) {
    idx = sortedAddrs.indexOf(addr);
  } else if (idx > 0 && sortedAddrs[idx] !== addr) {
    // keep first >= addr
  }

  const start = Math.max(0, idx - before);
  const slice = sortedAddrs.slice(start, start + count);
  const instructions = slice.map((a) => {
    const e = byAddr.get(a);
    return { address: hex(a), addressRaw: a, text: e.text };
  });

  return {
    ok: true,
    address: hex(addr),
    hitExact: byAddr.has(addr),
    nearest: instructions[0] ? instructions[Math.min(before, instructions.length - 1)]?.address : null,
    count: instructions.length,
    instructions,
  };
}

export function loadFunctions() {
  if (!exists(FUNCTIONS_CSV)) return [];
  const text = fs.readFileSync(FUNCTIONS_CSV, 'utf8').trim().split(/\r?\n/);
  const out = [];
  for (let i = 1; i < text.length; i++) {
    const row = text[i];
    if (!row) continue;
    // entry,entry_hex,name,body_size,is_thunk
    const parts = row.split(',');
    if (parts.length < 5) continue;
    out.push({
      entry: Number(parts[0]),
      entryHex: parts[1],
      name: parts[2],
      bodySize: Number(parts[3]),
      isThunk: parts[4] === 'true',
    });
  }
  return out;
}

/**
 * Xrefs from PC-rel CFG edges + listing operand mentions + function entries.
 */
export function xrefsAt(addr) {
  const cfg = readJson(CFG_EDGES);
  const edges = Array.isArray(cfg?.edges) ? cfg.edges : [];
  const incoming = [];
  const outgoing = [];
  for (const e of edges) {
    if (e.to === addr) {
      incoming.push({
        kind: 'cfg',
        from: hex(e.from),
        to: hex(e.to),
        op: e.op,
        verificationStatus: e.verificationStatus,
      });
    }
    if (e.from === addr) {
      outgoing.push({
        kind: 'cfg',
        from: hex(e.from),
        to: hex(e.to),
        op: e.op,
        verificationStatus: e.verificationStatus,
      });
    }
  }

  const needle = addr.toString(16).toLowerCase();
  const needle0x = '0x' + needle;
  const { lines } = loadListingIndex();
  const listingRefs = [];
  for (const line of lines) {
    if (line.addr === addr) continue;
    const t = line.text.toLowerCase();
    // Match hex operands like 0x2091 or bare 2091 as whole token
    if (t.includes(needle0x) || new RegExp(`(?:^|[\\s,#\\[])${needle}(?:$|[\\s,\\]])`).test(t)) {
      listingRefs.push({
        kind: 'listing',
        from: hex(line.addr),
        text: line.text,
      });
      if (listingRefs.length >= 64) break;
    }
  }

  const functions = loadFunctions().filter((f) => f.entry === addr);

  return {
    ok: true,
    address: hex(addr),
    cfg: {
      edgeCount: edges.length,
      addressing: cfg?.addressing || null,
      verificationStatus: cfg?.verificationStatus || null,
      incoming,
      outgoing,
    },
    listingRefs,
    functions,
  };
}
