/**
 * @deprecated Prefer JSON packs under definitions/packs/.
 * Re-exports the shipping RedLabel pack for residual TS imports.
 */
import { DEFINITION_LIBRARY } from '../constants';
import { DMEMap, VersionInfo } from '../types';

export const M413_623_DEF: VersionInfo = DEFINITION_LIBRARY[0];
export const M413_623_MAPS: DMEMap[] = DEFINITION_LIBRARY[0]?.maps || [];
