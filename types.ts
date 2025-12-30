
export enum MapDimension {
  Value = 'Value',
  Curve1D = '1D',
  Table2D = '2D',
  Surface3D = '3D',
  Flag = 'Flag'
}

export enum MapType {
  SCALAR = 'Scalar',
  FUNCTION = 'Function', // 1D
  TABLE = 'Table',    // 2D/3D
  FLAG = 'Flag',
  STRING = 'String'
}

export enum AxisSource {
  STEP = 'Step',      // Hardcoded increments
  ROM = 'ROM Address', // Data stored in ROM
  NONE = 'None/Disabled' // Axis is disabled
}

export type Endian = 'le' | 'be';

export interface Axis {
  label: string;
  unit: string;
  size: number;
  offset: number;
  source: AxisSource;
  stepValue?: number; // For step-based axis: index * stepValue
  dataSize: 8 | 16; 
  endian?: Endian;
  formula?: string; 
  values?: number[];
}

export interface DMEMap {
  id: string;
  name: string;
  description: string;
  type: MapType;
  offset: number;
  dimension: MapDimension;
  dataSize: 8 | 16;
  endian?: Endian;
  rows: number;
  cols: number;
  xAxis?: Axis;
  yAxis?: Axis;
  formula?: string;
  unit: string;
  category: string;
  mask?: number;
}

export interface VersionInfo {
  id: string;
  hw: string;
  sw: string;
  description: string;
  maps: DMEMap[];
  isBuiltIn?: boolean; // Protects factory definitions from raw code editing
  version?: number; // Auto-incrementing version number for user edits
}

export interface ROMFile {
  data: Uint8Array;
  name: string;
  size: number;
  detectedMaps: DMEMap[];
  checksumValid: boolean;
  version?: { hw: string; sw: string };
}
