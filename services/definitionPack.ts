import {
  Axis,
  AxisSource,
  DMEMap,
  MapDimension,
  MapType,
  VerificationStatus,
  VersionInfo,
} from '../types';

/** Maps allowed in default TuneDex / shipping packs */
export const SHIPPING_STATUSES: readonly VerificationStatus[] = ['cross_checked', 'verified'];

export const CANDIDATE_STATUSES: readonly VerificationStatus[] = ['unverified', 'plausible'];

export const DEFINITION_SCHEMA_VERSION = 1;

/** DATA base used by M331_413_623 family relative anchors */
export const FAMILY_DATA_BASE: Record<string, number> = {
  M331_413_623: 0x8000,
};

type JsonAxis = Omit<Axis, 'source' | 'dataSize'> & {
  source: string;
  dataSize: number;
};

type JsonMap = Omit<DMEMap, 'type' | 'dimension' | 'dataSize' | 'xAxis' | 'yAxis'> & {
  type: string;
  dimension: string;
  dataSize: number;
  xAxis?: JsonAxis;
  yAxis?: JsonAxis;
};

type JsonPack = Omit<VersionInfo, 'maps' | 'candidateMaps'> & {
  maps: JsonMap[];
  candidateMaps?: JsonMap[];
};

function parseAxisSource(value: string): AxisSource {
  if (value === AxisSource.STEP || value === 'Step') return AxisSource.STEP;
  if (value === AxisSource.ROM || value === 'ROM Address') return AxisSource.ROM;
  return AxisSource.NONE;
}

function parseMapType(value: string): MapType {
  const found = Object.values(MapType).find(v => v === value);
  return found ?? MapType.TABLE;
}

function parseDimension(value: string): MapDimension {
  const found = Object.values(MapDimension).find(v => v === value);
  return found ?? MapDimension.Table2D;
}

function hydrateAxis(axis?: JsonAxis): Axis | undefined {
  if (!axis) return undefined;
  return {
    ...axis,
    source: parseAxisSource(axis.source),
    dataSize: (axis.dataSize === 16 ? 16 : 8) as 8 | 16,
  };
}

function hydrateMap(map: JsonMap): DMEMap {
  return {
    ...map,
    type: parseMapType(map.type),
    dimension: parseDimension(map.dimension),
    dataSize: (map.dataSize === 16 ? 16 : 8) as 8 | 16,
    xAxis: hydrateAxis(map.xAxis),
    yAxis: hydrateAxis(map.yAxis),
  };
}

/** Hydrate a raw JSON pack into typed VersionInfo */
export function hydrateDefinitionPack(raw: JsonPack): VersionInfo {
  return {
    ...raw,
    schemaVersion: raw.schemaVersion ?? DEFINITION_SCHEMA_VERSION,
    maps: (raw.maps || []).map(hydrateMap),
    candidateMaps: (raw.candidateMaps || []).map(hydrateMap),
  };
}

export function isShippingStatus(status?: VerificationStatus): boolean {
  return !!status && SHIPPING_STATUSES.includes(status);
}

/** Keep only cross_checked|verified in maps[]; move the rest into candidateMaps */
export function enforceShippingGate(pack: VersionInfo): VersionInfo {
  const shipping: DMEMap[] = [];
  const candidates: DMEMap[] = [...(pack.candidateMaps || [])];

  for (const map of pack.maps) {
    if (isShippingStatus(map.verificationStatus)) {
      shipping.push(map);
    } else {
      candidates.push(map);
    }
  }

  return { ...pack, maps: shipping, candidateMaps: candidates };
}

/** Deep clone a definition for a live editing session */
export function cloneDefinition(def: VersionInfo): VersionInfo {
  return JSON.parse(JSON.stringify(def)) as VersionInfo;
}

/**
 * Apply family relative anchors: absolute offset = dataBase + relativeOffset when relativeOffset is set.
 */
export function applyFamilyAnchors(def: VersionInfo, dataBase?: number): VersionInfo {
  const base = dataBase ?? FAMILY_DATA_BASE[def.layoutFamily || ''] ?? 0x8000;
  const rewrite = (map: DMEMap): DMEMap => {
    const next: DMEMap = { ...map };
    if (typeof map.relativeOffset === 'number') {
      next.offset = base + map.relativeOffset;
    }
    if (map.xAxis && typeof map.xAxis.relativeOffset === 'number') {
      next.xAxis = { ...map.xAxis, offset: base + map.xAxis.relativeOffset };
    }
    if (map.yAxis && typeof map.yAxis.relativeOffset === 'number') {
      next.yAxis = { ...map.yAxis, offset: base + map.yAxis.relativeOffset };
    }
    return next;
  };

  return {
    ...def,
    maps: def.maps.map(rewrite),
    candidateMaps: (def.candidateMaps || []).map(rewrite),
  };
}
