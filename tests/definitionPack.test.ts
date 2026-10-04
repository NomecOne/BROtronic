import { describe, expect, it } from 'vitest';
import {
  DEFINITION_SCHEMA_VERSION,
  applyFamilyAnchors,
  enforceShippingGate,
  hydrateDefinitionPack,
  isShippingStatus,
} from '../services/definitionPack';
import shipping46629 from '../definitions/packs/m413_623_466_29_0x900A.shipping.json';
import candidates46629 from '../definitions/packs/m413_623_466_29_0x900A.candidates.json';
import family413623 from '../definitions/packs/family_M331_413_623.json';
import { makeMap, makePack, statusesOf } from './helpers/fixtures';

describe('definitionPack load + shipping gate', () => {
  it('isShippingStatus allows only cross_checked|verified', () => {
    expect(isShippingStatus('cross_checked')).toBe(true);
    expect(isShippingStatus('verified')).toBe(true);
    expect(isShippingStatus('unverified')).toBe(false);
    expect(isShippingStatus('plausible')).toBe(false);
    expect(isShippingStatus(undefined)).toBe(false);
  });

  it('hydrateDefinitionPack fills schemaVersion and typed enums', () => {
    const pack = hydrateDefinitionPack(shipping46629 as never);
    expect(pack.schemaVersion).toBe(DEFINITION_SCHEMA_VERSION);
    expect(pack.id).toBe('466.29');
    expect(pack.maps.length).toBeGreaterThan(0);
    expect(pack.maps.every(m => typeof m.type === 'string')).toBe(true);
    expect(pack.maps.every(m => m.dataSize === 8 || m.dataSize === 16)).toBe(true);
  });

  it('enforceShippingGate keeps only cross_checked|verified in maps[]', () => {
    const mixed = makePack({
      id: 'mixed',
      maps: [
        makeMap({ id: 'ship_v', verificationStatus: 'verified' }),
        makeMap({ id: 'ship_cc', verificationStatus: 'cross_checked' }),
        makeMap({ id: 'cand_u', verificationStatus: 'unverified' }),
        makeMap({ id: 'cand_p', verificationStatus: 'plausible' }),
        makeMap({ id: 'cand_missing' }),
      ],
      candidateMaps: [makeMap({ id: 'preexisting', verificationStatus: 'unverified' })],
    });

    const gated = enforceShippingGate(mixed);

    expect(gated.maps.map(m => m.id)).toEqual(['ship_v', 'ship_cc']);
    expect(statusesOf(gated.maps).every(s => s === 'cross_checked' || s === 'verified')).toBe(true);
    expect(gated.candidateMaps?.map(m => m.id)).toEqual([
      'preexisting',
      'cand_u',
      'cand_p',
      'cand_missing',
    ]);
  });

  it('shipped RedLabel pack exposes only shipping-grade maps after gate', () => {
    const raw = hydrateDefinitionPack(shipping46629 as never);
    // Inject a non-shipping map into maps[] to prove the gate does not trust pack authors.
    const polluted = {
      ...raw,
      maps: [
        ...raw.maps,
        makeMap({ id: 'sneaky_unverified', verificationStatus: 'unverified' }),
        makeMap({ id: 'sneaky_plausible', verificationStatus: 'plausible' }),
      ],
    };

    const gated = enforceShippingGate(polluted);
    expect(gated.maps.every(m => isShippingStatus(m.verificationStatus))).toBe(true);
    expect(gated.maps.some(m => m.id === 'sneaky_unverified')).toBe(false);
    expect(gated.candidateMaps?.some(m => m.id === 'sneaky_unverified')).toBe(true);
    expect(gated.candidateMaps?.some(m => m.id === 'sneaky_plausible')).toBe(true);
  });

  it('candidate pack maps stay out of shipping maps[]', () => {
    const candidates = hydrateDefinitionPack(candidates46629 as never);
    const gated = enforceShippingGate({
      ...candidates,
      // Pretend a bad ingest put candidates into maps[]
      maps: [...(candidates.candidateMaps || [])],
      candidateMaps: [],
    });

    expect(gated.maps).toEqual([]);
    expect((gated.candidateMaps || []).length).toBeGreaterThan(0);
    expect(
      (gated.candidateMaps || []).every(
        m => m.verificationStatus === 'unverified' || m.verificationStatus === 'plausible',
      ),
    ).toBe(true);
  });

  it('applyFamilyAnchors resolves relativeOffset from family dataBase', () => {
    const family = hydrateDefinitionPack(family413623 as never);
    const applied = applyFamilyAnchors(family, 0x8000);
    const maf = applied.maps.find(m => m.id === 'maf_cal');
    expect(maf).toBeTruthy();
    expect(maf!.relativeOffset).toBe(21136);
    expect(maf!.offset).toBe(0x8000 + 21136);
  });
});
