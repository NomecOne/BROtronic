
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
   * Analyzes the ROM and returns suggested definitions from the library.
   * Matching logic uses HW, SW, ID#, File Size, and 16-bit Checksum.
   */
  static getSuggestedDefinitions(rom: ROMFile, library: VersionInfo[]): { 
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
        let reasons: string[] = [];

        // 1. Hardware ID Match (20%)
        if (def.hw === hw) {
          score += 20;
          reasons.push("HW");
        }
        
        // 2. Software ID Match (20%)
        if (def.sw === sw) {
          score += 20;
          reasons.push("SW");
        }

        // 3. Version ID# Match (20%)
        // Check if extracted binary ID exists within definition ID or description
        if (id && (def.id.includes(id) || def.description.includes(id))) {
          score += 20;
          reasons.push("ID#");
        }

        // 4. File Size Match (20%)
        if (def.expectedSize && def.expectedSize === size) {
          score += 20;
          reasons.push("SIZE");
        }

        // 5. Checksum-16 Match (20%)
        if (def.expectedChecksum16 && def.expectedChecksum16 === checksum16) {
          score += 20;
          reasons.push("CS16");
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