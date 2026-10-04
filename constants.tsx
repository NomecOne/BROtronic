import { VersionInfo } from './types';
import { enforceShippingGate, hydrateDefinitionPack } from './services/definitionPack';

import shipping46629 from './definitions/packs/m413_623_466_29_0x900A.shipping.json';
import candidates46629 from './definitions/packs/m413_623_466_29_0x900A.candidates.json';
import family413623 from './definitions/packs/family_M331_413_623.json';

const SHIPPING_466_29 = enforceShippingGate(hydrateDefinitionPack(shipping46629 as never));
const CANDIDATES_466_29 = hydrateDefinitionPack(candidates46629 as never);
const FAMILY_413_623 = enforceShippingGate(hydrateDefinitionPack(family413623 as never));

/**
 * Central registry of shipping definition packs (TuneDex).
 * Only cross_checked|verified maps are exposed via maps[].
 */
export const DEFINITION_LIBRARY: VersionInfo[] = [
  SHIPPING_466_29,
];

/** Layout-family templates used by the live definition builder */
export const FAMILY_TEMPLATES: VersionInfo[] = [
  FAMILY_413_623,
];

/** Candidate/research packs — Discovery / DEFman, not default TuneDex */
export const CANDIDATE_LIBRARY: VersionInfo[] = [
  CANDIDATES_466_29,
];

export const DEFAULT_MAPS = DEFINITION_LIBRARY[0]?.maps || [];

/** @deprecated Use DEFINITION_LIBRARY — kept for any residual imports */
export const LEGACY_DEFINITION_IDS = ['466.29', 'NA'] as const;
