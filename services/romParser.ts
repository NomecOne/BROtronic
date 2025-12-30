
import { ROMFile, DMEMap, MapDimension, Axis, Endian, MapType, AxisSource } from '../types';
import { DEFAULT_MAPS } from '../constants';

export class ROMParser {
  /**
   * Scans binary for Bosch Hardware/Software signatures and initializes ROM object
   * Specifically tuned for Motronic 3.1/3.3/3.3.1 identification.
   */
  static async parse(buffer: ArrayBuffer, fileName: string): Promise<ROMFile> {
    const data = new Uint8Array(buffer);
    
    // Bosch Motronic IDs are often stored as ASCII strings
    // HW typically starts with 0261 (e.g., 0261200413)
    // SW typically starts with 1267 (e.g., 1267357623)
    // Note: In many M3.3.1 ROMs, these are stored backwards in ASCII.
    const hw = this.findBoschID(data, "0261") || this.findBoschID(data, "0261", true);
    const sw = this.findBoschID(data, "1267") || this.findBoschID(data, "1267", true);
    
    // Specific M3.3.1 patterns: ID# like 466.29 and Label# like 07826RT4361
    const id = this.findPattern(data, /\d{3}\.\d{2}/);
    const label = this.findPattern(data, /\d{5}[A-Z]{2}\d{4}/);

    return {
      data,
      name: fileName,
      size: data.length,
      detectedMaps: [...DEFAULT_MAPS],
      checksumValid: this.verifyChecksum(data),
      version: hw && sw ? { hw, sw, id, label } : undefined
    };
  }

  /**
   * Generic pattern matcher for ASCII strings in binary
   */
  private static findPattern(data: Uint8Array, regex: RegExp): string | undefined {
    const textDecoder = new TextDecoder('ascii');
    // Motronic ROMs are small enough (32-64KB) to decode fully for string scanning
    const content = textDecoder.decode(data);
    const matches = content.match(regex);
    return matches && matches.length > 0 ? matches[0] : undefined;
  }

  /**
   * Robust scanner for Bosch IDs. 
   * Now supports reversed storage common in Motronic 3.3.1 (e.g., "3140021620").
   */
  private static findBoschID(data: Uint8Array, prefix: string, reversed: boolean = false): string | undefined {
    const searchPrefix = reversed ? prefix.split('').reverse().join('') : prefix;
    const prefixBytes = Array.from(searchPrefix).map(c => c.charCodeAt(0));

    for (let i = 0; i < data.length - 15; i++) {
      let match = true;
      for (let j = 0; j < prefixBytes.length; j++) {
        if (data[i + j] !== prefixBytes[j]) {
          match = false;
          break;
        }
      }
      
      if (match) {
        if (reversed) {
          // In reversed mode, the number string looks like "3140021620"
          // We found the "1620" part at index i.
          // Because we scan backwards from the detected end of the block,
          // tempString is reconstructed in the correct forward order.
          let foundCount = 0;
          let tempString = "";
          
          // Determine where the 10-digit block likely ends. 
          // If the prefix "1620" is at index i, the whole 10-digit block "3140021620" 
          // ends at i + 3.
          let p = i + prefixBytes.length - 1;
          
          // Scan backwards from the end of the digit block to find all 10 digits.
          // In Motronic 3.3.1, reversed strings are usually stored as fixed blocks.
          while (foundCount < 10 && p >= 0) {
            const charCode = data[p];
            if (charCode >= 48 && charCode <= 57) {
              tempString += String.fromCharCode(charCode);
              foundCount++;
            } else if (foundCount > 0) {
              break;
            }
            p--;
          }
          
          if (foundCount === 10) {
            // tempString is now "0261200413" (already forward-oriented by the p-- scan)
            return tempString;
          }
        } else {
          // Standard Forward scan
          let result = prefix;
          let foundCount = prefix.length;
          let p = i + prefixBytes.length;
          while (foundCount < 10 && p < data.length) {
            const charCode = data[p];
            if (charCode >= 48 && charCode <= 57) {
              result += String.fromCharCode(charCode);
              foundCount++;
            } else if (charCode !== 32 && charCode !== 46 && charCode !== 45 && charCode !== 0) {
               break;
            }
            p++;
          }
          if (foundCount === 10) return result;
        }
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
