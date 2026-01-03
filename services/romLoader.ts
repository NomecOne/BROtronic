
import { ROMFile, VersionInfo } from '../types';

export class ROMLoaderService {
  /**
   * Fetches a binary from a web URL.
   * Resolves the path relative to the application's base URL.
   */
  static async fetchFromUrl(url: string): Promise<ArrayBuffer> {
    try {
      // Ensure the base URI has a trailing slash for correct relative resolution
      // especially on GitHub Pages where /BROtronic and /BROtronic/ resolve differently.
      let base = document.baseURI;
      if (!base.endsWith('/')) {
        base += '/';
      }
      
      const resolvedUrl = new URL(url, base).href;
      const response = await fetch(resolvedUrl);
      
      if (!response.ok) {
        throw new Error(`404 File Not Found: The server could not locate the ROM at ${resolvedUrl}. Verify the file is in your 'public/${url}' directory.`);
      }

      // Safeguard: Ensure we didn't get an HTML 404 or SPA fallback page instead of binary
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('text/html')) {
        throw new Error(`Invalid Data: The server returned an HTML page instead of a binary file. Check the path: ${resolvedUrl}`);
      }
      
      return await response.arrayBuffer();
    } catch (err: any) {
      if (err instanceof TypeError && err.message === 'Failed to fetch') {
        throw new Error(`Network Error: Verification of "${url}" failed. Ensure the file is present in the public repository.`);
      }
      throw err;
    }
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

        if (def.hw === hw) { score += 20; reasons.push("HW"); }
        if (def.sw === sw) { score += 20; reasons.push("SW"); }
        if (id && (def.id.includes(id) || def.description.includes(id))) { score += 20; reasons.push("ID#"); }
        if (def.expectedSize && def.expectedSize === size) { score += 20; reasons.push("SIZE"); }
        if (def.expectedChecksum16 && def.expectedChecksum16 === checksum16) { score += 20; reasons.push("CS16"); }

        return { match: def, score, reason: reasons.join(", ") };
      })
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score);
  }

  static getFileValidation(size: number): { valid: boolean; message: string } {
    const sizes = [32768, 65536];
    if (sizes.includes(size)) {
      return { valid: true, message: `Standard ${size / 1024}KB Binary` };
    }
    return { valid: false, message: `Non-standard size (${(size / 1024).toFixed(1)}KB)` };
  }
}
