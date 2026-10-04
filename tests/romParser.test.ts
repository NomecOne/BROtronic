import { describe, expect, it } from 'vitest';
import { ROMParser } from '../services/romParser';
import { MapDimension, MapType } from '../types';
import { makeMap } from './helpers/fixtures';

/** Build a ≥16KB buffer with a valid trailing CS16 (BE over all-but-last-two). */
function romWithValidTrailingCs(size = 0x4000, fill = 0x11): Uint8Array {
  const data = new Uint8Array(size);
  data.fill(fill);
  data[size - 2] = 0;
  data[size - 1] = 0;
  ROMParser.writeTrailingChecksum16(data);
  return data;
}

describe('ROMParser CS16 verify + writeMapData + export rewrite', () => {
  it('verifyChecksum accepts matching trailing CS16 and rejects mismatch', () => {
    const good = romWithValidTrailingCs();
    expect(ROMParser.verifyChecksum(good)).toBe(true);

    const bad = new Uint8Array(good);
    bad[0] ^= 0xff; // corrupt payload without updating trailing CS16
    expect(ROMParser.verifyChecksum(bad)).toBe(false);
  });

  it('verifyChecksum rejects short images (< 0x4000)', () => {
    const tiny = new Uint8Array(100);
    ROMParser.writeTrailingChecksum16(tiny);
    expect(ROMParser.verifyChecksum(tiny)).toBe(false);
  });

  it('writeTrailingChecksum16 writes BE CS16 over all bytes except last two', () => {
    const data = new Uint8Array(0x4000);
    data.fill(0x22);
    data[0x3ffe] = 0xaa;
    data[0x3fff] = 0xbb;

    const written = ROMParser.writeTrailingChecksum16(data);
    const expected = ROMParser.calculateCorrectChecksum(data);
    expect(written).toBe(expected);
    expect(data[0x3ffe]).toBe((expected >> 8) & 0xff);
    expect(data[0x3fff]).toBe(expected & 0xff);
    expect(ROMParser.verifyChecksum(data)).toBe(true);
  });

  it('calculateSummation16Public is full-file byte sum (fingerprint / C16x naming)', () => {
    const data = new Uint8Array([1, 2, 3, 4]);
    expect(ROMParser.calculateSummation16Public(data)).toBe(10);

    const withTrail = romWithValidTrailingCs(0x4000, 1);
    const fullSum = ROMParser.calculateSummation16Public(withTrail);
    // Trailing bytes are part of the fingerprint sum (unlike verifyChecksum body).
    const body = ROMParser.calculateCorrectChecksum(withTrail);
    const trail =
      ((withTrail[withTrail.length - 2] << 8) | withTrail[withTrail.length - 1]) & 0xffff;
    // fullSum = sum(all bytes) = body + trail_high + trail_low (not body+trail as u16 word)
    let manual = 0;
    for (let i = 0; i < withTrail.length; i++) manual = (manual + withTrail[i]) & 0xffff;
    expect(fullSum).toBe(manual);
    expect(fullSum).not.toBe(body);
    expect(trail).toBe(body);
  });

  it('writeMapData encodes physical grid with reverseFormula (X/4) and round-trips', () => {
    const rom = new Uint8Array(0x4000);
    const map = makeMap({
      id: 'maf_cal',
      verificationStatus: 'verified',
      type: MapType.FUNCTION,
      dimension: MapDimension.Curve1D,
      offset: 0x100,
      dataSize: 16,
      endian: 'le',
      rows: 2,
      cols: 1,
      formula: 'X/4',
    });

    const physical = [[10], [20.25]]; // → raw 40, 81
    ROMParser.writeMapData(rom, map, physical);

    expect(rom[0x100]).toBe(40 & 0xff);
    expect(rom[0x101]).toBe((40 >> 8) & 0xff);
    expect(rom[0x102]).toBe(81 & 0xff);
    expect(rom[0x103]).toBe((81 >> 8) & 0xff);

    const extracted = ROMParser.extractMapData(rom, map);
    expect(extracted[0][0]).toBe(10);
    expect(extracted[1][0]).toBe(20.25);
  });

  it('export path: writeMapData then trailing CS16 rewrite restores verifyChecksum', () => {
    const data = romWithValidTrailingCs();
    expect(ROMParser.verifyChecksum(data)).toBe(true);

    const map = makeMap({
      id: 'cell',
      verificationStatus: 'verified',
      offset: 0x200,
      dataSize: 8,
      rows: 1,
      cols: 2,
      formula: 'X',
    });

    // Tuned values change payload → trailing CS16 becomes stale
    ROMParser.writeMapData(data, map, [[7, 9]]);
    expect(ROMParser.verifyChecksum(data)).toBe(false);

    // App handleSaveRom sequence
    const trailingCs = ROMParser.writeTrailingChecksum16(data);
    const fingerprintCs = ROMParser.calculateSummation16Public(data);

    expect(ROMParser.verifyChecksum(data)).toBe(true);
    expect(trailingCs).toBe(ROMParser.calculateCorrectChecksum(data));
    expect(fingerprintCs).toBe(ROMParser.calculateSummation16Public(data));
    expect(data[0x200]).toBe(7);
    expect(data[0x201]).toBe(9);
  });
});
