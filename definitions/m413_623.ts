
import { DMEMap, MapDimension, MapType, AxisSource, VersionInfo } from '../types';

export const M413_623_MAPS: DMEMap[] = [
  {
    id: 'maf_cal',
    name: 'MAF Calibration',
    description: 'Mass Air Flow sensor transfer function (ADC Step to kg/hr)',
    type: MapType.FUNCTION,
    offset: 0xD290,
    dimension: MapDimension.Curve1D,
    dataSize: 16,
    endian: 'le',
    rows: 256,
    cols: 1,
    formula: 'X/4',
    unit: 'kg/hr',
    category: 'Sensors',
    yAxis: { 
      label: 'ADC Step', 
      unit: 'Step', 
      size: 256, 
      offset: 0, 
      source: AxisSource.STEP,
      stepValue: 1,
      dataSize: 8, 
      formula: 'X'
    }
  },
  {
    id: 'ign_main',
    name: 'Ignition Main (WOT)',
    description: 'Ignition timing advance at Wide Open Throttle',
    type: MapType.TABLE,
    offset: 0x8C00,
    dimension: MapDimension.Surface3D,
    dataSize: 8,
    rows: 12,
    cols: 12,
    xAxis: { 
      label: 'RPM', 
      unit: 'RPM', 
      size: 12, 
      offset: 0x8BC0, 
      source: AxisSource.ROM,
      dataSize: 8, 
      formula: 'X*40' 
    },
    yAxis: { 
      label: 'Load', 
      unit: 'ms', 
      size: 12, 
      offset: 0x8BE0, 
      source: AxisSource.ROM,
      dataSize: 8, 
      formula: 'X*0.05' 
    },
    formula: 'X*-0.75 + 72',
    unit: '°BTDC',
    category: 'Ignition'
  }
];

export const M413_623_DEF: VersionInfo = {
  id: 'NA',
  hw: '0261200413',
  sw: '1267357623',
  motronicVersion: 'M3.3.1',
  name: 'BRO',
  description: 'BMW E36 325i M50B25TU (Red Label)',
  maps: M413_623_MAPS,
  isBuiltIn: true,
  expectedSize: 65536,
  expectedChecksum16: 0x900A,
  expectedMotronicchecksum: 'TBD',
  expectedSwChecksum: 'TBD',
  definitionRevision: 'TBD'
};