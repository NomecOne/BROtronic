
import { ROMFile, VersionInfo } from '../types';

export class ROMLoaderService {
  /**
   * Fetches a binary from a web URL.
   * Resolves the path relative to the application's current directory to support subpath deployments (GitHub Pages).
   */
  static async fetchFromUrl(url: string): Promise<ArrayBuffer> {
    try {
      // 1. Calculate the base directory of the current application
      const origin = window.location.origin;
      const pathname = window.location.pathname;
      // Get the directory part: /folder/subfolder/index.html -> /folder/subfolder/
      const directory = pathname.substring(0, pathname.lastIndexOf('/') + 1);
      const baseUrl = origin + directory;
      
      const resolvedUrl = new URL(url, baseUrl).href;
      
      const response = await fetch(resolvedUrl);
      
      if (!response.ok) {
        throw new Error(`404: The ROM could not be found at ${resolvedUrl}. Ensure it exists in the 'public/rom' folder.`);
      }

      // 2. Validate Content-Type
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('text/html') || contentType.includes('application/xhtml+xml')) {
        throw new Error(`Integrity Error: Server returned a web page instead of a binary file. Check the repository path.`);
      }

      const buffer = await response.arrayBuffer();

      // 3. Binary Signature Check (Prevent loading HTML source code as a ROM)
      if (buffer.byteLength < 100) {
         // Too small to be a Motronic ROM, likely a short error message
         throw new Error('Data Transfer Error: File size is too small to be a valid ROM.');
      }

      const checkSlice = new Uint8Array(buffer.slice(0, 50));
      const decoder = new TextDecoder();
      const textCheck = decoder.decode(checkSlice).toLowerCase();
      
      if (textCheck.includes('<!doc') || textCheck.includes('<html') || textCheck.includes('<script')) {
        throw new Error(`Data Corruption: The fetched file contains HTML/Script tags. The server likely redirected a 404 to the home page.`);
      }
      
      return buffer;
    } catch (err: any) {
      console.error('[ROMLoader] Failed to fetch:', err.message);
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
