import {
  DMEMap,
  MapDimension,
  MapType,
  ROMFile,
  VerificationStatus,
  VersionInfo,
} from '../../types';

export function makeMap(partial: Partial<DMEMap> & Pick<DMEMap, 'id'>): DMEMap {
  return {
    name: partial.name ?? partial.id,
    description: partial.description ?? '',
    type: partial.type ?? MapType.TABLE,
    offset: partial.offset ?? 0x9000,
    dimension: partial.dimension ?? MapDimension.Table2D,
    dataSize: partial.dataSize ?? 8,
    rows: partial.rows ?? 2,
    cols: partial.cols ?? 2,
    unit: partial.unit ?? 'raw',
    category: partial.category ?? 'Test',
    formula: partial.formula ?? 'X',
    ...partial,
  };
}

export function makePack(partial: Partial<VersionInfo> & Pick<VersionInfo, 'id'>): VersionInfo {
  return {
    schemaVersion: 1,
    hw: '0261200413',
    sw: '1267357623',
    description: partial.description ?? `fixture ${partial.id}`,
    maps: [],
    candidateMaps: [],
    matchPolicy: 'exact',
    ...partial,
  };
}

export function makeRom(partial: Partial<ROMFile> = {}): ROMFile {
  const size = partial.size ?? 0x4000;
  const data = partial.data ?? new Uint8Array(size);
  return {
    data,
    name: partial.name ?? 'fixture.bin',
    size: data.length,
    detectedMaps: partial.detectedMaps ?? [],
    checksum16: partial.checksum16 ?? 0,
    checksumValid: partial.checksumValid ?? false,
    diagnostics: partial.diagnostics ?? [],
    version: partial.version ?? {
      hw: '0261200413',
      sw: '1267357623',
      id: '466.29',
    },
  };
}

export function statusesOf(maps: DMEMap[]): VerificationStatus[] {
  return maps.map(m => m.verificationStatus!).filter(Boolean);
}
