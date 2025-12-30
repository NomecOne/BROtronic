
import React from 'react';
import { ROMFile, DMEMap } from '../../types';
import HexViewer from '../HexViewer';

const PageID = ({ id }: { id: string }) => (
  <div className="absolute top-2 right-2 z-[100] pointer-events-none select-none">
    <span className="text-[9px] font-mono font-black text-lime-400 bg-black px-2 py-0.5 rounded border border-lime-500/50 tracking-wider">
      NODE_ID::{id}
    </span>
  </div>
);

interface DiscoveryModuleProps {
  rom: ROMFile | null;
  onAddMapDefinition: (map: DMEMap) => void;
}

const DiscoveryModule: React.FC<DiscoveryModuleProps> = ({ rom, onAddMapDefinition }) => {
  return (
    <div className="flex-1 p-6 flex flex-col overflow-hidden relative z-10">
      <PageID id="03" />
      <HexViewer data={rom?.data} onAddDefinition={onAddMapDefinition} />
    </div>
  );
};

export default DiscoveryModule;
