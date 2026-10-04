import { DEFINITION_LIBRARY, FAMILY_TEMPLATES, CANDIDATE_LIBRARY } from '../constants';
import {
  DefinitionBuildResult,
  DMEMap,
  ROMFile,
  RomFingerprint,
  VersionInfo,
} from '../types';
import {
  applyFamilyAnchors,
  cloneDefinition,
  enforceShippingGate,
  FAMILY_DATA_BASE,
} from './definitionPack';

/**
 * Standalone live definition builder (no AI).
 * Fingerprint → exact pack | family template | unknown structural scaffolding.
 */
export class DefinitionBuilder {
  static fingerprint(rom: ROMFile): RomFingerprint {
    return {
      size: rom.size,
      checksum16: rom.checksum16,
      hw: rom.version?.hw,
      sw: rom.version?.sw,
      releaseId: rom.version?.id,
    };
  }

  /**
   * Build a session definition for the uploaded ROM.
   * Shipping maps are always gated to cross_checked|verified.
   */
  static build(
    rom: ROMFile,
    library: VersionInfo[] = DEFINITION_LIBRARY,
    familyTemplates: VersionInfo[] = FAMILY_TEMPLATES,
  ): DefinitionBuildResult {
    const fp = this.fingerprint(rom);
    const exact = this.findExactMatch(rom, library);

    if (exact) {
      const gated = enforceShippingGate(cloneDefinition(exact));
      const withCandidates = this.mergeCandidates(gated, rom);
      return {
        kind: 'exact',
        definition: {
          ...withCandidates,
          matchPolicy: 'exact',
          fingerprint: { ...fp, ...(exact.fingerprint || {}) },
        },
        reason: `Exact match: HW/SW/size/CS16 → ${exact.id}`,
        fingerprint: fp,
      };
    }

    const family = this.findFamilyMatch(rom, familyTemplates);
    if (family) {
      const dataBase = FAMILY_DATA_BASE[family.layoutFamily || ''] ?? 0x8000;
      const applied = applyFamilyAnchors(cloneDefinition(family), dataBase);
      const gated = enforceShippingGate(applied);
      const withCandidates = this.mergeCandidates(gated, rom);
      return {
        kind: 'family',
        definition: {
          ...withCandidates,
          id: `family_${rom.version?.id || 'session'}_${Date.now()}`,
          expectedChecksum16: rom.checksum16,
          matchPolicy: 'family',
          fingerprint: fp,
          description: `Family ${family.layoutFamily} session for ${rom.name}`,
        },
        reason: `Family match: ${family.layoutFamily} (HW/SW)`,
        fingerprint: fp,
      };
    }

    return {
      kind: 'unknown',
      definition: this.buildUnknownScaffold(rom, fp),
      reason: 'No exact or family pack — structural scaffolding only',
      fingerprint: fp,
    };
  }

  /** Suggested registry entries for the ROMLoader review UI */
  static suggestFromLibrary(rom: ROMFile, library: VersionInfo[] = DEFINITION_LIBRARY): {
    match: VersionInfo;
    score: number;
    reason: string;
  }[] {
    if (!rom.version) return [];
    const { hw, sw, id } = rom.version;
    const { size, checksum16 } = rom;

    return library
      .map(def => {
        let score = 0;
        const reasons: string[] = [];
        if (def.hw === hw) { score += 20; reasons.push('HW'); }
        if (def.sw === sw) { score += 20; reasons.push('SW'); }
        if (id && (def.id.includes(id) || def.description.includes(id))) {
          score += 20;
          reasons.push('ID#');
        }
        if (def.expectedSize && def.expectedSize === size) { score += 20; reasons.push('SIZE'); }
        if (def.expectedChecksum16 && def.expectedChecksum16 === checksum16) {
          score += 20;
          reasons.push('CS16');
        }
        return { match: def, score, reason: reasons.join(', ') };
      })
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score);
  }

  private static findExactMatch(rom: ROMFile, library: VersionInfo[]): VersionInfo | undefined {
    if (!rom.version) return undefined;
    const { hw, sw, id } = rom.version;

    return library.find(def => {
      if (def.matchPolicy === 'family') return false;
      const hwOk = def.hw === hw;
      const swOk = def.sw === sw;
      const sizeOk = !def.expectedSize || def.expectedSize === rom.size;
      const csOk = !def.expectedChecksum16 || def.expectedChecksum16 === rom.checksum16;
      const idOk = !id || def.id.includes(id) || !!def.fingerprint?.releaseId?.includes(id);
      return hwOk && swOk && sizeOk && csOk && idOk;
    });
  }

  private static findFamilyMatch(rom: ROMFile, templates: VersionInfo[]): VersionInfo | undefined {
    if (!rom.version) return undefined;
    const { hw, sw } = rom.version;
    return templates.find(t => t.hw === hw && t.sw === sw);
  }

  private static mergeCandidates(def: VersionInfo, rom: ROMFile): VersionInfo {
    const extras = CANDIDATE_LIBRARY.filter(
      c => c.hw === (rom.version?.hw || def.hw) && c.sw === (rom.version?.sw || def.sw)
    );
    const merged = [...(def.candidateMaps || [])];
    for (const pack of extras) {
      for (const map of pack.candidateMaps || []) {
        if (!merged.some(m => m.id === map.id) && !def.maps.some(m => m.id === map.id)) {
          merged.push(map);
        }
      }
    }
    return { ...def, candidateMaps: merged };
  }

  private static buildUnknownScaffold(rom: ROMFile, fp: RomFingerprint): VersionInfo {
    const structural: DMEMap[] = JSON.parse(JSON.stringify(rom.detectedMaps || []));
    for (const map of structural) {
      map.source = map.source || 'heuristic';
      map.confidence = map.confidence ?? 0.2;
      map.verificationStatus = map.verificationStatus || 'unverified';
      map.evidence = map.evidence || [{
        kind: 'heuristic',
        detail: 'Structural discovery only — not a verified tune parameter.',
        sources: ['heuristic'],
      }];
    }

    return {
      schemaVersion: 1,
      id: `unknown_${Date.now()}`,
      hw: rom.version?.hw || 'Unknown',
      sw: rom.version?.sw || 'Unknown',
      description: `Unknown ROM scaffold: ${rom.name}`,
      maps: [],
      candidateMaps: structural,
      isBuiltIn: false,
      version: 1,
      matchPolicy: 'manual',
      fingerprint: fp,
      layoutFamily: undefined,
    };
  }
}
