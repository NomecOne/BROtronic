import { describe, expect, it } from 'vitest';
import { DefinitionBuilder } from '../services/definitionBuilder';
import { isShippingStatus } from '../services/definitionPack';
import { makeMap, makePack, makeRom } from './helpers/fixtures';

const HW = '0261200413';
const SW = '1267357623';

function exactPack() {
  return makePack({
    id: '466.29',
    hw: HW,
    sw: SW,
    matchPolicy: 'exact',
    expectedSize: 0x4000,
    expectedChecksum16: 0x1234,
    fingerprint: { releaseId: '466.29', size: 0x4000, checksum16: 0x1234, hw: HW, sw: SW },
    maps: [
      makeMap({ id: 'verified_map', verificationStatus: 'verified' }),
      makeMap({ id: 'should_demote', verificationStatus: 'unverified' }),
    ],
    candidateMaps: [],
  });
}

function familyTemplate() {
  return makePack({
    id: 'family_M331_413_623',
    hw: HW,
    sw: SW,
    matchPolicy: 'family',
    layoutFamily: 'M331_413_623',
    maps: [
      makeMap({
        id: 'maf_cal',
        verificationStatus: 'verified',
        relativeOffset: 21136,
        offset: 0,
      }),
      makeMap({ id: 'family_noise', verificationStatus: 'plausible', relativeOffset: 100 }),
    ],
    candidateMaps: [],
  });
}

describe('DefinitionBuilder fingerprint → exact|family|unknown', () => {
  it('fingerprint copies size/CS16/hw/sw/releaseId from ROM', () => {
    const rom = makeRom({
      size: 0x4000,
      checksum16: 0xabcd,
      version: { hw: HW, sw: SW, id: '466.29' },
    });
    expect(DefinitionBuilder.fingerprint(rom)).toEqual({
      size: 0x4000,
      checksum16: 0xabcd,
      hw: HW,
      sw: SW,
      releaseId: '466.29',
    });
  });

  it('returns exact when HW/SW/size/CS16/id align — and still gates shipping maps', () => {
    const rom = makeRom({
      size: 0x4000,
      checksum16: 0x1234,
      version: { hw: HW, sw: SW, id: '466.29' },
    });
    const result = DefinitionBuilder.build(rom, [exactPack()], []);

    expect(result.kind).toBe('exact');
    expect(result.definition.matchPolicy).toBe('exact');
    expect(result.definition.maps.map(m => m.id)).toEqual(['verified_map']);
    expect(result.definition.maps.every(m => isShippingStatus(m.verificationStatus))).toBe(true);
    expect(result.definition.candidateMaps?.some(m => m.id === 'should_demote')).toBe(true);
    expect(result.reason).toContain('Exact match');
    expect(result.fingerprint.checksum16).toBe(0x1234);
  });

  it('does not treat family template as exact even with matching HW/SW', () => {
    const rom = makeRom({
      size: 0x4000,
      checksum16: 0x9999,
      version: { hw: HW, sw: SW, id: '999.99' },
    });
    // Family pack in the exact library must be ignored by findExactMatch
    const result = DefinitionBuilder.build(rom, [familyTemplate()], [familyTemplate()]);
    expect(result.kind).toBe('family');
  });

  it('returns family when no exact pack but HW/SW match a template', () => {
    const rom = makeRom({
      size: 0x4000,
      checksum16: 0x5555,
      version: { hw: HW, sw: SW, id: 'other.rel' },
    });
    const wrongExact = makePack({
      id: 'other.exact',
      hw: HW,
      sw: SW,
      matchPolicy: 'exact',
      expectedSize: 0x4000,
      expectedChecksum16: 0x0001, // CS16 mismatch → not exact
      fingerprint: { releaseId: 'other.exact' },
      maps: [makeMap({ id: 'keep', verificationStatus: 'verified' })],
    });

    const result = DefinitionBuilder.build(rom, [wrongExact], [familyTemplate()]);

    expect(result.kind).toBe('family');
    expect(result.definition.matchPolicy).toBe('family');
    expect(result.definition.layoutFamily).toBe('M331_413_623');
    expect(result.definition.expectedChecksum16).toBe(0x5555);
    expect(result.definition.maps.map(m => m.id)).toEqual(['maf_cal']);
    expect(result.definition.maps[0].offset).toBe(0x8000 + 21136);
    expect(result.definition.candidateMaps?.some(m => m.id === 'family_noise')).toBe(true);
    expect(result.reason).toContain('Family match');
  });

  it('returns unknown scaffold when neither exact nor family match', () => {
    const rom = makeRom({
      version: { hw: '0000000000', sw: '1111111111', id: 'nope' },
      detectedMaps: [
        makeMap({
          id: 'heuristic_blob',
          verificationStatus: 'unverified',
          name: 'Heuristic',
        }),
      ],
    });

    const result = DefinitionBuilder.build(rom, [exactPack()], [familyTemplate()]);

    expect(result.kind).toBe('unknown');
    expect(result.definition.matchPolicy).toBe('manual');
    expect(result.definition.maps).toEqual([]);
    expect(result.definition.candidateMaps?.map(m => m.id)).toEqual(['heuristic_blob']);
    expect(result.definition.candidateMaps?.[0].source).toBe('heuristic');
    expect(result.reason).toContain('structural scaffolding');
  });

  it('exact match rejects CS16 mismatch (defs are not assumed correct by fingerprint alone)', () => {
    const rom = makeRom({
      size: 0x4000,
      checksum16: 0xdead, // does not match pack expectedChecksum16
      version: { hw: HW, sw: SW, id: '466.29' },
    });
    const result = DefinitionBuilder.build(rom, [exactPack()], [familyTemplate()]);
    expect(result.kind).not.toBe('exact');
    expect(result.kind).toBe('family');
  });
});
