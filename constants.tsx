import { VersionInfo } from './types';
import { M413_623_DEF as DEF_BASE } from './definitions/m413_623';
import { M413_623_DEF as DEF_466_29 } from './definitions/m413_623_466_29_0x900A';

/**
 * The DEFINITION_LIBRARY acts as the central registry for all supported ECU definitions.
 * Since the current environment does not support build-time macros like import.meta.glob,
 * we explicitly import and register each definition file here.
 */
export const DEFINITION_LIBRARY: VersionInfo[] = [
  DEF_BASE,
  DEF_466_29
];

/**
 * Fallback map set for initialization when no ROM is yet contextually matched.
 * We use the first discovered definition in the library as the baseline.
 */
export const DEFAULT_MAPS = DEFINITION_LIBRARY[0]?.maps || [];
