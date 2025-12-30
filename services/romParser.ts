import { ROMFile, DMEMap, MapDimension, Axis, Endian, MapType, AxisSource } from '../types';
import { DEFAULT_MAPS } from '../constants';

export class ROMParser {
  /**
   * Scans binary for Bosch Hardware/Software signatures and initializes ROM object
   * Specifically tuned for Motronic 3.1/3.3/3.3.1 identification.
   */
  static async parse(buffer: ArrayBuffer, fileName: string): Promise<ROMFile> {
    const data = new Uint8Array(buffer);
    
    // Bosch Motronic IDs are stored as ASCII strings
    // HW typically starts with 0261 (e.g., 0261200413)
    // SW typically starts with 1267 (e.g., 1267357623)
    const hw = this.findBoschID(data, "0261");
    const sw = this.findBoschID(data, "1267");

    return {
      data,
      name: fileName,
      size: data.length,
      detectedMaps: [...DEFAULT_MAPS],
      checksumValid: this.verifyChecksum(data),
      version: hw && sw ? { hw, sw } : undefined
    };
  }

  /**
   * Robust scanner for Bosch IDs. 
   * Handles tight sequences (0261200413) and common delimited formats 
   * like "0 261 200 413" or "0.261.200.413" found in M3.x ROMs.
   */
  private static findBoschID(data: Uint8Array, prefix: string): string | undefined {
    // Decode binary as ASCII for scanning
    const textDecoder = new TextDecoder('ascii');
    const content = textDecoder.decode(data);
    
    // Strategy: Remove common delimiters (spaces, dots, dashes) and search for 10-digit code
    const normalized = content.replace(/[\s\.\-]/g, '');
    const regex = new RegExp(`${prefix}\\d{6}`, 'g');
    const matches = normalized.match(regex);
    
    if (matches && matches.length > 0) {
      return matches[0];
    }

    // Fallback: Raw byte scan for prefix if ASCII normalization fails due to encoding noise
    const prefixBytes = Array.from(prefix).map(c => c.charCodeAt(0));
    for (let i = 0; i < data.length - 15; i++) {
      let match = true;
      for (let j = 0; j < prefixBytes.length; j++) {
        if (data[i + j] !== prefixBytes[j]) {
          match = false;
          break;
        }
      }
      if (match) {
        // Gather next 6 digits, skipping spaces/noise
        let result = prefix;
        let count = 0;
        let k = i + prefixBytes.length;
        while (count < 6 && k < data.length) {
          const charCode = data[k];
          if (charCode >= 48 && charCode <= 57) { // ASCII 0-9
            result += String.fromCharCode(charCode);
            count++;
          } else if (charCode === 32 || charCode === 46 || charCode === 45 || charCode === 0) {
            // Skip space, dot, dash, or null
          } else {
            if (count > 0) break;
          }
          k++;
        }
        if (result.length === 10) return result;
      }
    }

    return undefined;
  }

  /**
   * Applies scaling formula to raw hex values using high-performance evaluation
   */
  static evaluateFormula(formula: string | undefined, x: number): number {
    if (!formula) return x;
    const f = formula.trim().toUpperCase();
    if (f === 'X') return x;
    try {
      const expression = f.replace(/\bX\b/g, x.toString());
      // eslint-disable-next-line no-new-func
      const result = new Function(`"use strict"; return (${expression})`)();
      return typeof result === 'number' && !isNaN(result) ? result : x;
    } catch (e) {
      return x;
    }
  }

  /**
   * Converts engineering values back to raw hex bytes for ROM writing
   */
  static reverseFormula(formula: string | undefined, target: number, dataSize: 8 | 16 = 8): number {
    if (!formula || formula === 'X' || formula === 'x') return Math.round(target);
    const f = formula.trim().toUpperCase();
    
    // Optimized inversions for standard Bosch linear scaling
    if (f === 'X/4') return Math.round(target * 4);
    if (f === 'X/256') return Math.round(target * 256);
    if (f === 'X*0.05') return Math.round(target / 0.05);

    // Iterative reverse lookup for non-trivial 8-bit functions
    if (dataSize === 8) {
      let bestRaw = 0;
      let minDiff = Infinity;
      for (let i = 0; i < 256; i++) {
        const diff = Math.abs(this.evaluateFormula(formula, i) - target);
        if (diff < minDiff) {
          minDiff = diff;
          bestRaw = i;
        }
      }
      return bestRaw;
    } else {
      // Analytical inversion for basic 16-bit patterns
      if (f.includes('*')) {
        const factor = parseFloat(f.split('*')[1]) || 1;
        return Math.round(target / factor);
      }
      if (f.includes('/')) {
        const divisor = parseFloat(f.split('/')[1]) || 1;
        return Math.round(target * divisor);
      }
    }
    return Math.round(target); 
  }

  /**
   * Extracts a structured 2D array of data from the binary block
   */
  static extractMapData(rom: Uint8Array, map: DMEMap): number[][] {
    const result: number[][] = [];
    const step = map.dataSize / 8;
    let currentOffset = map.offset;

    for (let r = 0; r < map.rows; r++) {
      const row: number[] = [];
      for (let c = 0; c < map.cols; c++) {
        let rawValue = 0;
        if (currentOffset + step > rom.length) {
          row.push(0);
          continue;
        }

        if (map.dataSize === 16) {
          if (map.endian === 'le') rawValue = rom[currentOffset] | (rom[currentOffset + 1] << 8);
          else rawValue = (rom[currentOffset] << 8) | rom[currentOffset + 1];
        } else {
          rawValue = rom[currentOffset];
        }
        currentOffset += step;
        let converted = this.evaluateFormula(map.formula, rawValue);
        row.push(Number(converted.toFixed(3)));
      }
      result.push(row);
    }
    return result;
  }

  /**
   * Standard Bosch 16-bit summation checksum.
   * Calculations cover the entire file except the final 2 bytes.
   */
  static calculateCorrectChecksum(data: Uint8Array): number {
    let sum = 0;
    const limit = data.length - 2;
    for (let i = 0; i < limit; i++) {
      sum = (sum + data[i]) & 0xFFFF;
    }
    return sum;
  }

  /**
   * Verifies the 16-bit stored checksum against calculated sum
   */
  static verifyChecksum(data: Uint8Array): boolean {
    if (data.length < 0x4000) return false;
    const calculated = this.calculateCorrectChecksum(data);
    const lastByte = data.length - 1;
    const stored = (data[lastByte - 1] << 8) | data[lastByte];
    return calculated === stored;
  }

  /**
   * Resolves axis values from ROM or hardcoded steps
   */
  static getAxisValues(rom: Uint8Array, axis?: Axis): number[] {
    if (!axis || axis.source === AxisSource.NONE) return [];
    if (axis.values && axis.values.length > 0) return axis.values;

    const size = axis.size || 1;
    if (axis.source === AxisSource.STEP) {
      const step = axis.stepValue || 1;
      return Array.from({ length: size }).map((_, i) => this.evaluateFormula(axis.formula, i * step));
    }

    const vals: number[] = [];
    const step = axis.dataSize / 8;
    let offset = axis.offset;

    if (offset + (size * step) > rom.length) {
      return Array(size).fill(0);
    }

    for (let i = 0; i < size; i++) {
      let raw = 0;
      if (axis.dataSize === 16) {
        if (axis.endian === 'le') raw = rom[offset] | (rom[offset + 1] << 8);
        else raw = (rom[offset] << 8) | rom[offset + 1];
      } else {
        raw = rom[offset];
      }
      offset += step;
      vals.push(this.evaluateFormula(axis.formula, raw));
    }
    return vals;
  }
}