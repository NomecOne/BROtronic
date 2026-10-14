/**
 * Agent-facing command handlers for the local RE shim.
 */
import {
  LANGUAGE,
  COMPILER,
  PROJECT_NAME,
  NAMING_NOTE,
  ROM_PATH,
  ROM_NAME,
  MEM,
  MEMORY_REGIONS,
  EXPORT_META,
  EXPORT_SANITY,
  PROGRESS_JSON,
  BYTE_MAP,
  GHIDRA_DIR,
  regionKindAt,
} from './paths.mjs';
import { readJson, parseAddr, hex } from './io.mjs';
import { artifactFreshness, disasmAt, xrefsAt, loadFunctions } from './artifacts.mjs';
import { runDetect, runHeadless, romPresent } from './headless.mjs';

function baseMeta() {
  return {
    shim: 'tools/re/shim',
    role: 'local_mcs96_agent_api',
    notRea: true,
    language: LANGUAGE,
    compiler: COMPILER,
    projectName: PROJECT_NAME,
    namingNote: NAMING_NOTE,
    codeWindow: {
      start: hex(MEM.CODE_START),
      endInclusive: hex(MEM.CODE_END),
      note: 'CODE 0x2000–0xB930 inclusive',
    },
  };
}

export function cmdOpenStatus() {
  const detect = runDetect();
  const freshness = artifactFreshness();
  const rom = romPresent();

  return {
    ok: true,
    command: 'status',
    ...baseMeta(),
    session: {
      open: freshness.fresh || Boolean(freshness.meta),
      romPresent: rom,
      romPath: ROM_PATH,
      romName: ROM_NAME,
      ghidraReady: detect.ready,
      artifactsFresh: freshness.fresh,
      ghidraOut: GHIDRA_DIR,
    },
    detect: {
      ready: detect.ready,
      installDir: detect.report?.ghidra?.installDir || null,
      headless: detect.report?.ghidra?.headless || null,
      java: detect.report?.java || null,
      blockers: detect.report?.blockers || [],
    },
    freshness: {
      fresh: freshness.fresh,
      languageOk: freshness.languageOk,
      staleVsRom: freshness.staleVsRom,
      reasons: freshness.reasons,
      instructionCount: freshness.meta?.instructionCount ?? null,
      functionCount: freshness.meta?.functionCount ?? null,
    },
    next: freshness.fresh
      ? ['overview', 'regions', 'disasm-at 0x2091', 'xrefs 0x4120', 'query-progress']
      : ['export-refresh  # needs GHIDRA_INSTALL_DIR + JDK if exports missing/stale'],
  };
}

export function cmdOverview() {
  const freshness = artifactFreshness();
  const meta = readJson(EXPORT_META);
  const sanity = readJson(EXPORT_SANITY);
  const functions = loadFunctions();
  const inCode = functions.filter(
    (f) => f.entry >= MEM.CODE_START && f.entry <= MEM.CODE_END,
  );

  return {
    ok: Boolean(meta),
    command: 'overview',
    ...baseMeta(),
    artifactsFresh: freshness.fresh,
    exportMeta: meta,
    sanity: sanity
      ? {
          language: sanity.language,
          instructionCount: sanity.instructionCount,
          functionCount: sanity.functionCount,
          sampleAt2000: sanity.sampleAt2000,
          sampleAt4178: sanity.sampleAt4178,
          sampleAt417C: sanity.sampleAt417C,
        }
      : null,
    functions: {
      total: functions.length,
      inCodeWindow: inCode.length,
      sample: functions.slice(0, 12).map((f) => ({
        entry: '0x' + f.entryHex,
        name: f.name,
        bodySize: f.bodySize,
        isThunk: f.isThunk,
      })),
    },
    error: meta ? undefined : 'Missing ghidra_export_meta.json — run export-refresh',
  };
}

export function cmdRegions() {
  const byteMap = readJson(BYTE_MAP);
  const coverage = byteMap?.coverage || byteMap?.summary || null;

  return {
    ok: true,
    command: 'regions',
    ...baseMeta(),
    regions: MEMORY_REGIONS.map((r) => ({
      kind: r.kind,
      start: hex(r.start),
      endInclusive: hex(r.endInclusive),
      confidence: r.confidence,
      note: r.note,
    })),
    lookupHelpers: {
      '0x0000': regionKindAt(0x0000),
      '0x2000': regionKindAt(0x2000),
      '0xB930': regionKindAt(0xB930),
      '0xB931': regionKindAt(0xB931),
      '0xFFFE': regionKindAt(0xfffe),
    },
    byteMapCoverage: coverage,
    note: 'VECTOR overlaps CODE start; prefer VECTOR for 0x2000–0x200F labeling.',
  };
}

export function cmdDisasmAt(addrRaw, opts = {}) {
  const addr = parseAddr(addrRaw);
  const count = Math.min(256, Math.max(1, Number(opts.count) || 16));
  const before = Math.min(32, Math.max(0, Number(opts.before) || 0));
  const result = disasmAt(addr, { count, before });
  return {
    command: 'disasm-at',
    ...baseMeta(),
    region: regionKindAt(addr),
    ...result,
  };
}

export function cmdXrefs(addrRaw) {
  const addr = parseAddr(addrRaw);
  const result = xrefsAt(addr);
  return {
    command: 'xrefs',
    ...baseMeta(),
    region: regionKindAt(addr),
    ...result,
  };
}

export function cmdExportRefresh({ force = false } = {}) {
  const result = runHeadless({ force });
  return {
    command: 'export-refresh',
    ...baseMeta(),
    ...result,
  };
}

export function cmdQueryProgress() {
  const progress = readJson(PROGRESS_JSON);
  const freshness = artifactFreshness();
  return {
    ok: Boolean(progress),
    command: 'query-progress',
    ...baseMeta(),
    artifactsFresh: freshness.fresh,
    progress,
    error: progress ? undefined : `Missing ${PROGRESS_JSON}`,
  };
}

export const COMMANDS = {
  open: cmdOpenStatus,
  status: cmdOpenStatus,
  overview: cmdOverview,
  regions: cmdRegions,
  'disasm-at': cmdDisasmAt,
  xrefs: cmdXrefs,
  'export-refresh': cmdExportRefresh,
  'query-progress': cmdQueryProgress,
};
