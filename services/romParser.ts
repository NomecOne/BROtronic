
import { ROMFile, DMEMap, MapDimension, Axis, Endian, MapType, AxisSource, DiagnosticEntry } from '../types';

export class ROMParser {
  /**
   * Scans binary for Bosch Hardware/Software signatures and initializes ROM object
   * Specifically tuned for Motronic 3.1/3.3/3.3.1 identification.
   */
  static async parse(buffer: ArrayBuffer, fileName: string): Promise<ROMFile> {
    const data = new Uint8Array(buffer);
    const diagnostics: DiagnosticEntry[] = [];
    const structuralMaps: DMEMap[] = [];
    
    // Captured Identity Values
    let detectedHW: string = 'Unknown';
    let detectedSW: string = 'Unknown';
    let detectedID: string | undefined;
    let detectedLabel: string | undefined;

    // 1. Calculate Checksum-16
    const checksum16 = this.calculateSummation16(data);
    const checksumValid = this.verifyChecksum(data);
    diagnostics.push({
      id: 'checksum_16',
      label: 'Checksum (16-bit Sum)',
      value: `0x${checksum16.toString(16).toUpperCase()}`,
      type: 'integrity',
      actions: [],
      size: 2,
      offset: data.length - 2
    });

    // 2. Identity Discovery (Convert to Maps & Capture for version object)
    const identityPatterns = [
      { id: 'hw_id', label: 'Hardware ID', prefix: '0261', regex: null },
      { id: 'sw_id', label: 'Software ID', prefix: '1267', regex: null },
      { id: 'id_num', label: 'ID / Release', prefix: null, regex: /\d{3}\.\d{2}/ },
      { id: 'label1_num', label: 'Production Label1', prefix: null, regex: /\d{5}[A-Z]{2}\d{4}/ }
    ];

    identityPatterns.forEach(pattern => {
      let result: { val: string, offset: number } | undefined;
      
      if (pattern.prefix) {
        result = this.findBoschIDWithOffset(data, pattern.prefix) || this.findBoschIDWithOffset(data, pattern.prefix, true);
      } else if (pattern.regex) {
        result = this.findPatternWithOffset(data, pattern.regex);
      }

      if (result) {
        const { val, offset } = result;
        // Update local state for the version object
        if (pattern.id === 'hw_id') detectedHW = val;
        if (pattern.id === 'sw_id') detectedSW = val;
        if (pattern.id === 'id_num') detectedID = val;
        if (pattern.id === 'label1_num') detectedLabel = val;

        diagnostics.push({ 
          id: pattern.id, 
          label: pattern.label, 
          value: val, 
          offset: offset,
          size: val.length,
          type: 'identity', 
          actions: ['hexEdit'] 
        });
        structuralMaps.push({
          id: `ident_${pattern.id}`,
          name: pattern.label,
          description: `Extracted identification marker from ROM header area.`,
          type: MapType.STRING,
          offset: offset,
          dimension: MapDimension.Value,
          dataSize: 8,
          rows: 1,
          cols: val.length,
          unit: 'ASCII',
          category: 'Header / Identity',
          formula: 'X'
        });
      }
    });

    // 3. Self-Pointer Discovery
    const selfPointerBlocks = this.findSelfPointerBlocks(data);
    const discoveredAnchors = new Set<number>();

    selfPointerBlocks.forEach(block => {
      // Record individual anchor addresses for index search
      for (let i = 0; i < block.length; i++) {
        discoveredAnchors.add(block.offset + (i * 2));
      }

      diagnostics.push({
        id: `self_ptr_${block.offset}`,
        label: `Self-Pointer Anchor`,
        value: `${block.length} Refs @ 0x${block.offset.toString(16).toUpperCase()}`,
        offset: block.offset,
        size: block.length * 2,
        type: 'structure',
        actions: ['hexEdit', 'discovery']
      });
      structuralMaps.push({
        id: `sp_list_${block.offset.toString(16)}`,
        name: `Self-Ref Anchor @ 0x${block.offset.toString(16).toUpperCase()}`,
        description: `Detected sequence of ${block.length} self-referencing pointers. Often indicates map axis definition start.`,
        type: MapType.TABLE,
        offset: block.offset,
        dimension: MapDimension.Table2D,
        dataSize: 16,
        endian: block.endian,
        rows: block.length,
        cols: 1,
        unit: 'Addr',
        category: 'Structural Pointers',
        formula: 'X'
      });
    });

    // 4. Master Index List Discovery (Find lists referencing the anchors)
    const masterLists = this.findMasterIndexLists(data, discoveredAnchors);
    masterLists.forEach(list => {
      diagnostics.push({
        id: `master_list_${list.offset}`,
        label: `Location Index`,
        value: `${list.length} Pointers @ 0x${list.offset.toString(16).toUpperCase()}`,
        offset: list.offset,
        size: list.length * 2,
        type: 'structure',
        actions: ['hexEdit', 'discovery']
      });
      structuralMaps.push({
        id: `ml_list_${list.offset.toString(16)}`,
        name: `Location Index @ 0x${list.offset.toString(16).toUpperCase()}`,
        description: `Detected sequence of ${list.length} pointers referencing known structural anchors. Likely a map descriptor table.`,
        type: MapType.TABLE,
        offset: list.offset,
        dimension: MapDimension.Table2D,
        dataSize: 16,
        endian: 'be',
        rows: list.length,
        cols: 1,
        unit: 'Ref',
        category: 'Structural Pointers',
        formula: 'X'
      });
    });

    return {
      data,
      name: fileName,
      size: data.length,
      detectedMaps: structuralMaps, 
      checksum16,
      checksumValid,
      diagnostics,
      version: { 
        hw: detectedHW,
        sw: detectedSW,
        id: detectedID,
        label: detectedLabel
      }
    };
  }

  private static calculateSummation16(data: Uint8Array): number {
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      sum = (sum + data[i]) & 0xFFFF;
    }
    return sum;
  }

  /**
   * Scans binary for self-pointing addresses (pointers where value == offset).
   * Often indicates the start of map axis definitions or pointer tables.
   */
  private static findSelfPointerBlocks(data: Uint8Array): { offset: number; length: number; endian: Endian }[] {
    const blocks: { offset: number; length: number; endian: Endian }[] = [];

/*
    // Scan Big Endian (Standard for Bosch Motronic)
    for (let i = 0; i < data.length - 1; i += 2) {
      const valBE = (data[i] << 8) | data[i + 1];
      if (valBE === i) {
        const start = i;
        let count = 0;
        while (i < data.length - 1 && ((data[i] << 8) | data[i + 1]) === i) {
          count++;
          i += 2;
        }
        blocks.push({ offset: start, length: count, endian: 'be' });
        i -= 2;
      }
    }
*/

    // Scan Little Endian
    for (let i = 0; i < data.length - 1; i += 2) {
      const valLE = data[i] | (data[i + 1] << 8);
      if (valLE === i) {
        const start = i;
        let count = 0;
        while (i < data.length - 1 && (data[i] | (data[i + 1] << 8)) === i) {
          count++;
          i += 2;
        }
        if (!blocks.find(b => b.offset === start)) {
          blocks.push({ offset: start, length: count, endian: 'le' });
        }
        i -= 2;
      }
    }

    return blocks.sort((a, b) => b.length - a.length).slice(0, 15);
  }

  /**
   * Searches for sequences of 16-bit pointers that reference identified anchors.
   */
  private static findMasterIndexLists(data: Uint8Array, anchors: Set<number>): { offset: number, length: number }[] {
    const lists: { offset: number, length: number }[] = [];
    if (anchors.size === 0) return [];

    // Scan for Big Endian pointer blocks that contain many target references
    for (let i = 0; i < data.length - 1; i += 2) {
      const valBE = (data[i] << 8) | data[i + 1];
      
      if (anchors.has(valBE)) {
        const start = i;
        let count = 0;
        let misses = 0;
        
        // Allow a few "misses" (non-anchor pointers) to keep the list contiguous
        // since master lists often contain non-self-pointing map pointers too.
        while (i < data.length - 1 && misses < 2) {
          const currentVal = (data[i] << 8) | data[i + 1];
          if (anchors.has(currentVal)) {
            count++;
            misses = 0;
          } else if (currentVal > 0 && currentVal < data.length) {
            count++;
            misses++;
          } else {
            break;
          }
          i += 2;
        }

        if (count >= 4) {
          lists.push({ offset: start, length: count - misses });
        }
        i -= 2;
      }
    }

    return lists.sort((a, b) => b.length - a.length).slice(0, 10);
  }

  private static findPatternWithOffset(data: Uint8Array, regex: RegExp): { val: string, offset: number } | undefined {
    const textDecoder = new TextDecoder('ascii');
    const content = textDecoder.decode(data);
    const match = content.match(regex);
    if (match && match.index !== undefined) {
      return { val: match[0], offset: match.index };
    }
    return undefined;
  }

  private static findBoschIDWithOffset(data: Uint8Array, prefix: string, reversed: boolean = false): { val: string, offset: number } | undefined {
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
          let foundCount = 0;
          let tempString = "";
          let p = i + prefixBytes.length - 1;
          while (foundCount < 10 && p >= 0) {
            const charCode = data[p];
            if (charCode >= 48 && charCode <= 57) {
              tempString += String.fromCharCode(charCode);
              foundCount++;
            } else if (foundCount > 0) break;
            p--;
          }
          if (foundCount === 10) {
            // In reversed search, 'p+1' is the start of the 10-digit ID string
            return { val: tempString, offset: p + 1 };
          }
        } else {
          let result = prefix;
          let foundCount = prefix.length;
          let p = i + prefixBytes.length;
          while (foundCount < 10 && p < data.length) {
            const charCode = data[p];
            if (charCode >= 48 && charCode <= 57) {
              result += String.fromCharCode(charCode);
              foundCount++;
            } else if (charCode !== 32 && charCode !== 46 && charCode !== 45 && charCode !== 0) break;
            p++;
          }
          if (foundCount === 10) {
            return { val: result, offset: i };
          }
        }
      }
    }
    return undefined;
  }

  static evaluateFormula(formula: string | undefined, x: number): number {
    if (!formula) return x;
    const f = formula.trim().toUpperCase();
    if (f === 'X') return x;
    try {
      const expression = f.replace(/\bX\b/g, x.toString());
      const result = new Function(`"use strict"; return (${expression})`)();
      return typeof result === 'number' && !isNaN(result) ? result : x;
    } catch (e) { return x; }
  }

  static reverseFormula(formula: string | undefined, target: number, dataSize: 8 | 16 = 8): number {
    if (!formula || formula === 'X' || formula === 'x') return Math.round(target);
    const f = formula.trim().toUpperCase();
    if (f === 'X/4') return Math.round(target * 4);
    if (f === 'X/256') return Math.round(target * 256);
    if (f === 'X*0.05') return Math.round(target / 0.05);

    if (dataSize === 8) {
      let bestRaw = 0;
      let minDiff = Infinity;
      for (let i = 0; i < 256; i++) {
        const diff = Math.abs(this.evaluateFormula(formula, i) - target);
        if (diff < minDiff) { minDiff = diff; bestRaw = i; }
      }
      return bestRaw;
    } else {
      if (f.includes('*')) return Math.round(target / (parseFloat(f.split('*')[1]) || 1));
      if (f.includes('/')) return Math.round(target * (parseFloat(f.split('/')[1]) || 1));
    }
    return Math.round(target); 
  }

  static extractMapData(rom: Uint8Array, map: DMEMap): number[][] {
    const result: number[][] = [];
    const step = map.dataSize / 8;
    let currentOffset = map.offset;
    for (let r = 0; r < map.rows; r++) {
      const row: number[] = [];
      for (let c = 0; c < map.cols; c++) {
        let rawValue = 0;
        if (currentOffset + step > rom.length) { row.push(0); continue; }
        if (map.dataSize === 16) {
          if (map.endian === 'le') rawValue = rom[currentOffset] | (rom[currentOffset + 1] << 8);
          else rawValue = (rom[currentOffset] << 8) | rom[currentOffset + 1];
        } else rawValue = rom[currentOffset];
        currentOffset += step;
        row.push(Number(this.evaluateFormula(map.formula, rawValue).toFixed(3)));
      }
      result.push(row);
    }
    return result;
  }

  static calculateCorrectChecksum(data: Uint8Array): number {
    let sum = 0;
    const limit = data.length - 2;
    for (let i = 0; i < limit; i++) { sum = (sum + data[i]) & 0xFFFF; }
    return sum;
  }

  static verifyChecksum(data: Uint8Array): boolean {
    if (data.length < 0x4000) return false;
    const calculated = this.calculateCorrectChecksum(data);
    const lastByte = data.length - 1;
    const stored = (data[lastByte - 1] << 8) | data[lastByte];
    return calculated === stored;
  }

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
    if (offset + (size * step) > rom.length) return Array(size).fill(0);
    for (let i = 0; i < size; i++) {
      let raw = 0;
      if (axis.dataSize === 16) {
        if (axis.endian === 'le') raw = rom[offset] | (rom[offset + 1] << 8);
        else raw = (rom[offset] << 8) | rom[offset + 1];
      } else raw = rom[offset];
      offset += step;
      vals.push(this.evaluateFormula(axis.formula, raw));
    }
    return vals;
  }
}
