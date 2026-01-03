
import { ROMFile, VersionInfo } from '../types';

export class ROMLoaderService {
  /**
   * Fetches a binary from a web URL.
   * Resolves the path relative to the application's base directory.
   */
  static async fetchFromUrl(url: string): Promise<ArrayBuffer> {
    try {
      // document.baseURI respects the <base> tag in index.html.
      // We ensure it ends with a slash if it doesn't look like a file,
      // which is critical for GitHub Pages subpath resolution.
      let base = document.baseURI;
      const urlObj = new URL(base);
      if (!urlObj.pathname.endsWith('/') && !urlObj.pathname.split('/').pop()?.includes('.')) {
        urlObj.pathname += '/';
        base = urlObj.toString();
      }
      
      const resolvedUrl = new URL(url, base).href;
      const response = await fetch(resolvedUrl);
      
      if (!response.ok) {
        throw new Error(`Server Error (${response.status}): The ROM could not be found at ${resolvedUrl}.`);
      }

      // Check content type to ensure we didn't get an HTML 404 page redirect
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('text/html')) {
        throw new Error(`Integrity Error: The server returned a web page instead of a binary file. Check the path: ${resolvedUrl}`);
      }

      const buffer = await response.arrayBuffer();

      // Basic signature check to ensure it's not a short text error disguised as a binary
      if (buffer.byteLength < 100) {
         throw new Error('Data Transfer Error: The fetched file is too small to be a valid ROM.');
      }

      const checkSlice = new Uint8Array(buffer.slice(0, 50));
      const decoder = new TextDecoder();
      const textCheck = decoder.decode(checkSlice).toLowerCase();
      
      if (textCheck.includes('<!doc') || textCheck.includes('<html') || textCheck.includes('<script')) {
        throw new Error(`Data Corruption: The fetched file contains HTML tags. Verify the repository path.`);
      }
      
      return buffer;
    } catch (err: any) {
      // Re-wrap to ensure the error message is clean for the UI
      if (err.message === 'Failed to fetch') {
        throw new Error('Network Error: Could not connect to the repository. Ensure you are online and the path is correct.');
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
