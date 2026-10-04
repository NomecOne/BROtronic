/**
 * @deprecated The old id:"NA" duplicate pack was removed.
 * Family matches now use FAMILY_TEMPLATES / definitionBuilder.
 * This file re-exports the shipping RedLabel pack for residual imports.
 */
import { DEFINITION_LIBRARY } from '../constants';
import { DMEMap, VersionInfo } from '../types';

export const M413_623_DEF: VersionInfo = DEFINITION_LIBRARY[0];
export const M413_623_MAPS: DMEMap[] = DEFINITION_LIBRARY[0]?.maps || [];
