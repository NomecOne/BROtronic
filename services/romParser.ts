
import { ROMFile, DMEMap, MapDimension, Axis, Endian, MapType, AxisSource, DiagnosticEntry } from '../types';
import { DEFAULT_MAPS } from '../constants';

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
      actions: []
    });

    // 2. Identity Discovery (Convert to Maps & Capture for version object)
    const identityPatterns = [
      { id: 'hw_id', label: 'Hardware ID', prefix: '0261', regex: null },
      { id: 'sw_id', label: 'Software ID', prefix: '1267', regex: null },
      { id: 'id_num', label: 'ID / Release', prefix: null, regex: /\d{3}\.\d{2}/ },
      { id: 'label_num', label: 'Production Label', prefix: null, regex: /\d{5}[A-Z]{2}\d{4}/ }
    ];

    identityPatterns.forEach(pattern => {
      let val: string | undefined;
      let offset = 0;
      
      if (pattern.prefix) {
        val = this.findBoschID(data, pattern.prefix) || this.findBoschID(data, pattern.prefix, true);
        const searchPrefix = pattern.prefix;
        for(let i=0; i<data.length-10; i++) {
          if (data[i] === searchPrefix.charCodeAt(0) && data[i+1] === searchPrefix.charCodeAt(1)) {
            offset = i;
            break;
          }
        }
      } else if (pattern.regex) {
        val = this.findPattern(data, pattern.regex);
        const textDecoder = new TextDecoder('ascii');
        const content = textDecoder.decode(data);
        const match = content.match(pattern.regex);
        if (match && match.index !== undefined) offset = match.index;
      }

      if (val) {
        // Update local state for the version object
        if (pattern.id === 'hw_id') detectedHW = val;
        if (pattern.id === 'sw_id') detectedSW = val;
        if (pattern.id === 'id_num') detectedID = val;
        if (pattern.id === 'label_num') detectedLabel = val;

        diagnostics.push({ id: pattern.id, label: pattern.label, value: val, type: 'identity', actions: ['hexEdit'] });
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

    // 3. Pointer Discovery (Convert to Maps)
    const selfPointers = this.findSelfPointers(data);
    selfPointers.forEach(sp => {
      diagnostics.push({
        id: `self_ptr_${sp.offset}`,
        label: `Self Pointer (${sp.endian.toUpperCase()})`,
        value: `Ptr @ 0x${sp.offset.toString(16).toUpperCase()}`,
        offset: sp.offset,
        type: 'structure',
        actions: ['hexEdit']
      });
      structuralMaps.push({
        id: `sp_${sp.offset.toString(16)}`,
        name: `Self-Ref @ 0x${sp.offset.toString(16).toUpperCase()}`,
        description: 'Common Bosch map-table initialization marker. Offset value equals stored value.',
        type: MapType.SCALAR,
        offset: sp.offset,
        dimension: MapDimension.Value,
        dataSize: 16,
        endian: sp.endian,
        rows: 1,
        cols: 1,
        unit: 'Addr',
        category: 'Structural Pointers',
        formula: 'X'
      });
    });

    const pointerLists = this.findPointerLists(data);
    pointerLists.forEach((list, idx) => {
      diagnostics.push({
        id: `ptr_list_${idx}`,
        label: `Pointer sequence (${list.endian.toUpperCase()})`,
        value: `${list.count} Pointers @ 0x${list.offset.toString(16).toUpperCase()}`,
        offset: list.offset,
        type: 'structure',
        actions: ['hexEdit', 'discovery']
      });
      structuralMaps.push({
        id: `plist_${list.offset.toString(16)}`,
        name: `Pointer List @ 0x${list.offset.toString(16).toUpperCase()}`,
        description: `Contiguous sequence of ${list.count} pointers found in ROM structural region.`,
        type: MapType.TABLE,
        offset: list.offset,
        dimension: MapDimension.Curve1D,
        dataSize: 16,
        endian: list.endian,
        rows: list.count,
        cols: 1,
        unit: 'Addr',
        category: 'Pointer Registry',
        formula: 'X'
      });
    });

    // 4. Heuristic Map Header Scan
    const heuristicMaps = this.crawlForMaps(data);
    heuristicMaps.forEach((m, idx) => {
      diagnostics.push({
        id: `heuristic_${idx}`,
        label: `Heuristic Candidate ${idx + 1}`,
        value: `${m.rows}x${m.cols} Map`,
        offset: m.offset,
        type: 'heuristic',
        actions: ['hexEdit', 'tuner', 'discovery']
      });
    });

    return {
      data,
      name: fileName,
      size: data.length,
      detectedMaps: [...structuralMaps, ...heuristicMaps], 
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

  private static findSelfPointers(data: Uint8Array): { offset: number; endian: Endian }[] {
    const results: { offset: number; endian: Endian }[] = [];
    for (let i = 0; i < data.length - 1; i += 2) {
      const valBE = (data[i] << 8) | data[i + 1];
      const valLE = data[i] | (data[i + 1] << 8);

      if (valBE === i) results.push({ offset: i, endian: 'be' });
      else if (valLE === i) results.push({ offset: i, endian: 'le' });
    }
    return results.slice(0, 10); 
  }

  private static findPointerLists(data: Uint8Array): { offset: number; count: number; endian: Endian }[] {
    const lists: { offset: number; count: number; endian: Endian }[] = [];
    const minSequence = 4;

    ['be', 'le'].forEach(endian => {
      let currentSequence: number[] = [];
      let startOffset = 0;

      for (let i = 0; i < data.length - 1; i += 2) {
        const val = (endian === 'be') 
          ? (data[i] << 8) | data[i + 1] 
          : data[i] | (data[i + 1] << 8);

        if (val > 0x1000 && val < data.length && val % 2 === 0) {
          if (currentSequence.length === 0) startOffset = i;
          currentSequence.push(val);
        } else {
          if (currentSequence.length >= minSequence) {
            lists.push({ offset: startOffset, count: currentSequence.length, endian: endian as Endian });
          }
          currentSequence = [];
        }
      }
      if (currentSequence.length >= minSequence) {
        lists.push({ offset: startOffset, count: currentSequence.length, endian: endian as Endian });
      }
    });

    return lists.sort((a, b) => b.count - a.count).slice(0, 8);
  }

  private static crawlForMaps(data: Uint8Array): DMEMap[] {
    const candidates: DMEMap[] = [];
    for (let i = 0; i < data.length - 64; i++) {
      if (data[i] === 0x02 && [8, 10, 12, 16].includes(data[i+1])) {
        candidates.push({
          id: `h_map_${i}`,
          name: `Discovered Map @ 0x${i.toString(16).toUpperCase()}`,
          description: 'Automatically detected map structure via heuristic signature scan.',
          type: MapType.TABLE,
          offset: i + 2,
          dimension: MapDimension.Table2D,
          dataSize: 8,
          rows: data[i+1],
          cols: 1,
          unit: 'Raw',
          category: 'Heuristic Findings',
          formula: 'X'
        });
        i += 16;
      }
    }
    return candidates.slice(0, 15);
  }

  private static findPattern(data: Uint8Array, regex: RegExp): string | undefined {
    const textDecoder = new TextDecoder('ascii');
    const content = textDecoder.decode(data);
    const matches = content.match(regex);
    return matches && matches.length > 0 ? matches[0] : undefined;
  }

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
          if (foundCount === 10) return tempString;
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
          if (foundCount === 10) return result;
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
