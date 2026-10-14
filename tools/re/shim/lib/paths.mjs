/**
 * Paths and constants for the local MCS-96 RE shim (option B).
 * Wraps tools/re Ghidra headless — does not patch REA.
 */
import path from 'node:path';
import {
  RE_ROOT,
  REPO_ROOT,
  OUT_DIR,
  ROM_PATH,
  ROM_NAME,
  MEM,
  regionKindAt,
} from '../../lib/romPaths.mjs';

export { RE_ROOT, REPO_ROOT, OUT_DIR, ROM_PATH, ROM_NAME, MEM, regionKindAt };

export const LANGUAGE = 'MCS96:LE:16:default';
export const COMPILER = 'default';
export const PROJECT_NAME = 'RedLabel_M331';

/** Filename token C16x900A = CS16 fingerprint only — never a C16x CPU language. */
export const NAMING_NOTE =
  'C16x900A in the RedLabel filename means checksum16=0x900A only; never select C166/C167 from it.';

export const GHIDRA_DIR = path.join(OUT_DIR, 'ghidra');
export const DETECT_JSON = path.join(OUT_DIR, 'ghidra_detect.json');
export const HEADLESS_STATUS = path.join(OUT_DIR, 'ghidra_headless_status.json');
export const EXPORT_META = path.join(GHIDRA_DIR, 'ghidra_export_meta.json');
export const EXPORT_SANITY = path.join(GHIDRA_DIR, 'ghidra_sanity.json');
export const LISTING = path.join(GHIDRA_DIR, 'ghidra_listing.txt');
export const FUNCTIONS_CSV = path.join(GHIDRA_DIR, 'ghidra_functions.csv');
export const SYMBOLS_CSV = path.join(GHIDRA_DIR, 'ghidra_symbols.csv');
export const CFG_EDGES = path.join(OUT_DIR, 'mcs96_cfg_edges.json');
export const PROGRESS_JSON = path.join(OUT_DIR, 'code_verification_progress.json');
export const BYTE_MAP = path.join(OUT_DIR, 'byte_map.json');

export const REQUIRED_EXPORTS = [EXPORT_META, LISTING, FUNCTIONS_CSV];

export const MEMORY_REGIONS = [
  {
    kind: 'PAD',
    start: 0x0000,
    endInclusive: MEM.LOW_PAD_END,
    confidence: 'high',
    note: 'All 0xFF in external image',
  },
  {
    kind: 'VECTOR',
    start: MEM.VECTOR_START,
    endInclusive: MEM.VECTOR_END,
    confidence: 'medium',
    note: 'LE16 interrupt vector table',
  },
  {
    kind: 'CODE',
    start: MEM.CODE_START,
    endInclusive: MEM.CODE_END,
    confidence: 'high',
    note: 'Baseline CODE through 0xB930 inclusive (Richard)',
  },
  {
    kind: 'DATA_CAL',
    start: MEM.DATA_START,
    endInclusive: MEM.DATA_END,
    confidence: 'high',
    note: 'Calibration / data after CODE',
  },
  {
    kind: 'OTHER',
    start: MEM.CS16_START,
    endInclusive: 0xffff,
    confidence: 'high',
    note: 'Trailing CS16 (full-file sum 0x900A)',
  },
];
