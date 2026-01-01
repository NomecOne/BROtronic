
import React from 'react';
import { ROMFile, VersionInfo } from '../../types';

const PageID = ({ id }: { id: string }) => (
  <div className="absolute top-2 right-2 z-[100] pointer-events-none select-none">
    <span className="text-[9px] font-mono font-black text-lime-400 bg-black px-2 py-0.5 rounded border border-lime-500/50 tracking-wider">
      NODE_ID::{id}
    </span>
  </div>
);

const ActiveContextBar = ({ rom, def }: { rom: ROMFile, def?: VersionInfo | null }) => (
  <div className="flex items-center space-x-4 px-4 py-1 bg-slate-900 border-b border-slate-800 text-[9px] font-black uppercase tracking-widest italic shrink-0 w-full">
    <div className="flex items-center space-x-2">
      <span className="text-slate-600">Active ROM:</span>
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

interface CompareModuleProps {
  rom: ROMFile;
  activeDefinition?: VersionInfo | null;
}

const CompareModule: React.FC<CompareModuleProps> = ({ rom, activeDefinition }) => {
  return (
    <div className="flex-1 flex flex-col relative z-10">
      <ActiveContextBar rom={rom} def={activeDefinition} />
      <div className="flex-1 p-6 flex flex-col items-center justify-center text-slate-500">
        <PageID id="06" />
        <div className="max-w-md text-center space-y-4">
          <svg className="w-16 h-16 mx-auto opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
          </svg>
          <h2 className="text-xl font-black uppercase italic tracking-widest">Binary Differential Analysis</h2>
          <p className="text-sm">Compare module is currently under hardware evaluation. Add a secondary ROM to begin bitwise difference analysis.</p>
        </div>
      </div>
    </div>
  );
};

export default CompareModule;
