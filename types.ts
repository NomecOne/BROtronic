export enum MapDimension {
  Value = 'Value',
  Curve1D = '1D',
  Table2D = '2D',
  Surface3D = '3D',
  Flag = 'Flag'
}

export enum MapType {
  SCALAR = 'Scalar',
  FUNCTION = 'Function', // 1D
  TABLE = 'Table',    // 2D/3D
  FLAG = 'Flag',
  STRING = 'String'
}

export enum AxisSource {
  STEP = 'Step',      // Hardcoded increments
  ROM = 'ROM Address', // Data stored in ROM
  NONE = 'None/Disabled' // Axis is disabled
}

export type Endian = 'le' | 'be';

/** Provenance of a map/scalar claim — never treat unverified entries as ground truth. */
export type MapSource =
  | 'sheet'
  | 'xdf'
  | 'ida'
  | 'brotronic_legacy'
  | 'heuristic'
  | 're_pipeline';

/**
 * Verification ladder (Phase 0):
 * - unverified: single-source claim, not checked on binary
 * - plausible: binary region looks table-like / in DATA; dims/formula still unproven
 * - cross_checked: ≥2 independent sources agree AND offsets/size fit the reference image
 * - verified: cross_checked plus stronger proof (xref, axis linkage, or formula/units sanity)
 */
export type VerificationStatus = 'unverified' | 'plausible' | 'cross_checked' | 'verified';

export type MatchPolicy = 'exact' | 'family' | 'manual';

export type RegionKind = 'CODE' | 'DATA' | 'RAM' | 'VECTORS' | 'OTHER';

export interface EvidenceItem {
  /** Short machine-friendly tag, e.g. source_agreement, binary_pattern, formula_range */
  kind: string;
  detail: string;
  sources?: MapSource[];
}

export interface Axis {
  label: string;
  unit: string;
  size: number;
  offset: number;
  source: AxisSource;
  stepValue?: number; // For step-based axis: index * stepValue
  dataSize: 8 | 16;
  endian?: Endian;
  formula?: string;
  values?: number[];
  /** Optional offset relative to layoutFamily dataBase */
  relativeOffset?: number;
}

export interface DMEMap {
  id: string;
  name: string;
  description: string;
  type: MapType;
  offset: number;
  dimension: MapDimension;
  dataSize: 8 | 16;
  endian?: Endian;
  rows: number;
  cols: number;
  xAxis?: Axis;
  yAxis?: Axis;
  formula?: string;
  unit: string;
  category: string;
  mask?: number;
  /** Optional offset relative to layoutFamily dataBase */
  relativeOffset?: number;
  source?: MapSource;
  /** 0–1 confidence in the claim itself (independent of verificationStatus) */
  confidence?: number;
  verificationStatus?: VerificationStatus;
  evidence?: EvidenceItem[];
}

export interface RomFingerprint {
  size?: number;
  checksum16?: number;
  hw?: string;
  sw?: string;
  releaseId?: string;
  motronicChecksum?: string;
  swChecksum?: string;
}

export interface RomRegion {
  name: string;
  start: number;
  end: number;
  kind: RegionKind;
}

export interface VersionInfo {
  /** Artifact schema version for JSON packs */
  schemaVersion?: number;
  id: string;
  hw: string;
  sw: string;
  motronicVersion?: string;
  name?: string;
  description: string;
  /** Shipping / TuneDex maps — only cross_checked | verified belong in default packs */
  maps: DMEMap[];
  /** Research/Discovery layer — unverified | plausible stay here */
  candidateMaps?: DMEMap[];
  isBuiltIn?: boolean; // Protects factory definitions from raw code editing
  version?: number; // Auto-incrementing version number for user edits
  expectedSize?: number; // File size in bytes for validation
  expectedChecksum16?: number; // Full-file 16-bit summation fingerprint (e.g. C16x900A)
  expectedMotronicchecksum?: string;
  expectedSwChecksum?: string;
  definitionRevision?: string;
  layoutFamily?: string;
  fingerprint?: RomFingerprint;
  regions?: RomRegion[];
  matchPolicy?: MatchPolicy;
}

export type DiagnosticType = 'identity' | 'integrity' | 'structure' | 'heuristic';

export interface DiagnosticEntry {
  id: string;
  label: string;
  value: string;
  offset?: number;
  size?: number;
  type: DiagnosticType;
  actions: ('hexEdit' | 'tuner' | 'discovery')[];
}

export interface ROMFile {
  data: Uint8Array;
  name: string;
  size: number;
  detectedMaps: DMEMap[];
  checksum16: number;
  checksumValid: boolean;
  diagnostics: DiagnosticEntry[];
  version?: {
    hw: string;
    sw: string;
    id?: string;
    label?: string;
  };
}

/** Result of standalone (no-AI) live definition assembly */
export type DefinitionBuildKind = 'exact' | 'family' | 'unknown';

export interface DefinitionBuildResult {
  kind: DefinitionBuildKind;
  definition: VersionInfo;
  reason: string;
  fingerprint: RomFingerprint;
}
