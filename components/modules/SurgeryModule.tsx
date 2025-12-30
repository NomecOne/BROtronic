
import React from 'react';
import { ROMFile } from '../../types';
import ManualHexEditor from '../ManualHexEditor';

const PageID = ({ id }: { id: string }) => (
  <div className="absolute top-2 right-2 z-[100] pointer-events-none select-none">
    <span className="text-[9px] font-mono font-black text-lime-400 bg-black px-2 py-0.5 rounded border border-lime-500/50 tracking-wider">
      NODE_ID::{id}
    </span>
  </div>
);

interface SurgeryModuleProps {
  rom: ROMFile | null;
  onUpdateByte: (offset: number, value: number) => void;
}

const SurgeryModule: React.FC<SurgeryModuleProps> = ({ rom, onUpdateByte }) => {
  return (
    <div className="flex-1 p-6 flex flex-col overflow-hidden relative z-10">
      <PageID id="04" />
      <ManualHexEditor data={rom?.data} onUpdateByte={onUpdateByte} />
    </div>
  );
};

export default SurgeryModule;
