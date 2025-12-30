
import { ROMFile, VersionInfo } from '../types';
import { ROMParser } from './romParser';

export class ROMLoaderService {
  /**
   * Fetches a binary from a web URL
   */
  static async fetchFromUrl(url: string): Promise<ArrayBuffer> {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to fetch ROM: ${response.statusText}`);
    return await response.arrayBuffer();
  }

  /**
   * Analyzes the ROM and returns suggested definitions from the library
   */
  static getSuggestedDefinitions(rom: ROMFile, library: VersionInfo[]): { 
    match: VersionInfo; 
    score: number;
    reason: string;
  }[] {
    if (!rom.version) return [];

    const { hw, sw } = rom.version;
    return library
      .map(def => {
        let score = 0;
        let reasons: string[] = [];

        if (def.hw === hw) {
          score += 50;
          reasons.push("HW Match");
        }
        if (def.sw === sw) {
          score += 50;
          reasons.push("SW Match");
        }

        return { match: def, score, reason: reasons.join(", ") };
      })
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score);
  }

  /**
   * Validates if the file size is standard for Motronic 3.x
   * 32KB (27C256) or 64KB (27C512) are common.
   */
  static getFileValidation(size: number): { valid: boolean; message: string } {
    const sizes = [32768, 65536];
    if (sizes.includes(size)) {
      return { valid: true, message: `Standard ${size / 1024}KB Binary` };
    }
    return { valid: false, message: `Non-standard size (${(size / 1024).toFixed(1)}KB)` };
  }
}
