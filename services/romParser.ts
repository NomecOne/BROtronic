
import { ROMFile, DMEMap, MapDimension, Axis, Endian, MapType, AxisSource } from '../types';
import { DEFAULT_MAPS } from '../constants';

export class ROMParser {
  static async parse(buffer: ArrayBuffer, fileName: string): Promise<ROMFile> {
    const data = new Uint8Array(buffer);
    
    // Extract Bosch signatures (HW starts with 0261, SW starts with 1267)
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
   * Scans the binary for a 10-digit Bosch ID starting with a specific prefix
   */
  private static findBoschID(data: Uint8Array, prefix: string): string | undefined {
    // Convert buffer to string for pattern matching (inefficient for large files but fine for 32/64kb ROMs)
    let content = "";
    // Usually these signatures are in the last 20% of the file or at specific blocks
    // We scan the whole thing to be safe for M3.1 thru M3.3.1 variants
    for (let i = 0; i < data.length; i++) {
      const char = String.fromCharCode(data[i]);
      if (/[0-9]/.test(char)) {
        content += char;
      } else {
        if (content.length === 10 && content.startsWith(prefix)) {
          return content;
        }
        content = "";
      }
    }
    return undefined;
  }

  static evaluateFormula(formula: string | undefined, x: number): number {
    if (!formula) return x;
    const f = formula.trim().toUpperCase();
    if (f === 'X') return x;
    try {
      if (f.includes('CELL') || f.includes('ROW')) return x;
      const expression = f.replace(/\bX\b/g, x.toString());
      const result = new Function(`"use strict"; return (${expression})`)();
      return typeof result === 'number' && !isNaN(result) ? result : x;
    } catch (e) {
      return x;
    }
  }

  static reverseFormula(formula: string | undefined, target: number, dataSize: 8 | 16 = 8): number {
    if (!formula || formula === 'X' || formula === 'x') return target;
    const f = formula.trim().toUpperCase();
    if (f === 'X/4') return Math.round(target * 4);
    if (f === 'X/256') return Math.round(target * 256);
    if (dataSize === 8) {
      for (let i = 0; i < 256; i++) {
        if (Math.abs(this.evaluateFormula(formula, i) - target) < 0.001) return i;
      }
    } else {
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

  static parseXDF(xmlString: string): DMEMap[] {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlString, "application/xml");
    const maps: DMEMap[] = [];
    const tables = doc.querySelectorAll('XDFTABLE');
    tables.forEach(table => {
      const id = table.getAttribute('uniqueid') || Math.random().toString();
      const title = table.querySelector('title')?.textContent || 'Unnamed Table';
      const zAxis = table.querySelector('XDFAXIS[id="z"]');
      const xAxis = table.querySelector('XDFAXIS[id="x"]');
      const yAxis = table.querySelector('XDFAXIS[id="y"]');
      const embeddedZ = zAxis?.querySelector('EMBEDDEDDATA');
      const addrStr = embeddedZ?.getAttribute('mmedaddress');
      if (!addrStr) return;
      const offset = parseInt(addrStr, 16);
      const rows = parseInt(embeddedZ?.getAttribute('mmedrowcount') || '1');
      const cols = parseInt(embeddedZ?.getAttribute('mmedcolcount') || '1');
      const dataSize = (parseInt(embeddedZ?.getAttribute('mmedelementsizebits') || '8')) as 8 | 16;
      const flags = parseInt(embeddedZ?.getAttribute('mmedflags') || '0', 16);
      const endian: Endian = (flags & 0x01) ? 'le' : 'be';
      maps.push({
        id,
        name: title,
        description: table.querySelector('description')?.textContent || '',
        type: rows > 1 && cols > 1 ? MapType.TABLE : MapType.FUNCTION,
        offset,
        dataSize,
        endian,
        dimension: rows > 1 && cols > 1 ? MapDimension.Surface3D : (rows > 1 || cols > 1 ? MapDimension.Curve1D : MapDimension.Value),
        rows,
        cols,
        formula: zAxis?.querySelector('MATH equation')?.textContent || 'X',
        unit: table.querySelector('units')?.textContent || '',
        category: 'Imported',
        xAxis: this.parseAxis(xAxis),
        yAxis: this.parseAxis(yAxis)
      });
    });
    return maps;
  }

  private static parseAxis(el: Element | null): Axis | undefined {
    if (!el) return undefined;
    const embedded = el.querySelector('EMBEDDEDDATA');
    const labels = Array.from(el.querySelectorAll('LABEL')).map(l => l.getAttribute('value') || '');
    const addrAttr = embedded?.getAttribute('mmedaddress');
    const offset = addrAttr ? parseInt(addrAttr, 16) : 0;
    const dataSize = (parseInt(embedded?.getAttribute('mmedelementsizebits') || '8')) as 8 | 16;
    const flags = parseInt(embedded?.getAttribute('mmedflags') || '0', 16);
    const endian: Endian = (flags & 0x01) ? 'le' : 'be';
    return {
      label: el.querySelector('units')?.textContent || 'Axis',
      unit: el.querySelector('units')?.textContent || '',
      size: parseInt(el.querySelector('indexcount')?.textContent || '1'),
      offset: offset,
      source: offset === 0 ? AxisSource.STEP : AxisSource.ROM,
      stepValue: 1,
      dataSize,
      endian,
      formula: el.querySelector('MATH equation')?.textContent || 'X',
      values: labels.length > 0 ? labels.map(l => parseFloat(l)) : undefined
    };
  }

  static verifyChecksum(data: Uint8Array): boolean {
    if (data.length < 65536) return false;
    let sum = 0;
    for (let i = 0; i < 0xFFFE; i++) {
      sum = (sum + data[i]) & 0xFFFF;
    }
    const stored = (data[0xFFFE] << 8) | data[0xFFFF];
    return sum === stored;
  }

  static calculateCorrectChecksum(data: Uint8Array): number {
    let sum = 0;
    for (let i = 0; i < 0xFFFE; i++) {
      sum = (sum + data[i]) & 0xFFFF;
    }
    return sum;
  }

  static extractMapData(rom: Uint8Array, map: DMEMap): number[][] {
    const result: number[][] = [];
    const step = map.dataSize / 8;
    let currentOffset = map.offset;
    for (let r = 0; r < map.rows; r++) {
      const row: number[] = [];
      for (let c = 0; c < map.cols; c++) {
        let rawValue = 0;
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
