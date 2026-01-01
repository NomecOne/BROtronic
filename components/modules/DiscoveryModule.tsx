
import React from 'react';
import { ROMFile, DMEMap, VersionInfo } from '../../types';
import HexViewer from '../HexViewer';

const PageID = ({ id }: { id: string }) => (
  <div className="absolute top-2 right-2 z-[100] pointer-events-none select-none">
    <span className="text-[9px] font-mono font-black text-lime-400 bg-black px-2 py-0.5 rounded border border-lime-500/50 tracking-wider">
      NODE_ID::{id}
    </span>
  </div>
);

const ActiveContextBar = ({ rom, def }: { rom: ROMFile, def?: VersionInfo | null }) => (
  <div className="flex items-center space-x-4 px-4 py-1 bg-slate-900 border-b border-slate-800 text-[9px] font-black uppercase tracking-widest italic shrink-0">
    <div className="flex items-center space-x-2">
      <span className="text-slate-600">ROM:</span>
      <span className="text-emerald-400">{rom.name}</span>
    </div>
    {def && (
      <div className="flex items-center space-x-2 border-l border-slate-800 pl-4">
        <span className="text-slate-600">Protocol:</span>
        <span className="text-indigo-400">{def.hw} / {def.sw}</span>
      </div>
    )}
  </div>
);

interface DiscoveryModuleProps {
  rom: ROMFile | null;
  activeDefinition?: VersionInfo | null;
  onAddMapDefinition: (map: DMEMap) => void;
}

const DiscoveryModule: React.FC<DiscoveryModuleProps> = ({ rom, activeDefinition, onAddMapDefinition }) => {
  return (
    <div className="flex-1 flex flex-col overflow-hidden relative z-10">
      {rom && <ActiveContextBar rom={rom} def={activeDefinition} />}
      <div className="flex-1 p-6 flex flex-col overflow-hidden">
        <PageID id="03" />
        <HexViewer data={rom?.data} onAddDefinition={onAddMapDefinition} />
      </div>
    </div>
  );
};

export default DiscoveryModule;
