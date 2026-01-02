
import React from 'react';
import { ROMFile, VersionInfo } from '../../types';
import { ROMParser } from '../../services/romParser';
import Visualizer from '../Visualizer';
import MapTableEditor from '../MapTableEditor';

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

interface TunerModuleProps {
  rom: ROMFile;
  activeDefinition?: VersionInfo | null;
  selectedMapId: string | null;
  setSelectedMapId: (id: string | null) => void;
  editingData: number[][] | null;
  onUpdateValue: (r: number, c: number, val: number) => void;
}

const TunerModule: React.FC<TunerModuleProps> = ({ 
  rom, 
  activeDefinition,
  selectedMapId, 
  setSelectedMapId, 
  editingData, 
  onUpdateValue 
}) => {
  const selectedMap = rom.detectedMaps.find(m => m.id === selectedMapId);

  return (
    <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative z-10">
      <ActiveContextBar rom={rom} def={activeDefinition} />
      <div className="flex-1 flex min-w-0 overflow-hidden">
        {/* Live Registers Panel */}
        <aside className="w-64 bg-black/40 border-r border-slate-900/50 flex flex-col shrink-0 backdrop-blur-xl">
          <div className="p-4 border-b border-slate-900/50 bg-black/20 flex flex-col">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest italic mb-1">Live Registers</span>
            <div className="flex items-center space-x-2 text-[10px] text-cyan-400/80 font-bold font-mono">
              <span className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse"></span>
              <span>{rom.detectedMaps.length} Active Profiles</span>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-1">
            {rom.detectedMaps.map(m => (
              <button 
                key={m.id} 
                onClick={() => setSelectedMapId(m.id)} 
                className={`w-full text-left px-3 py-2.5 text-[11px] font-bold rounded-lg truncate transition-all flex items-center justify-between group
                  ${selectedMapId === m.id ? 'bg-cyan-500/20 text-cyan-100 shadow-lg ring-1 ring-cyan-500/30' : 'text-slate-500 hover:bg-slate-900/50 hover:text-slate-300'}`}
              >
                <span className="truncate">{m.name}</span>
                <span className={`text-[8px] font-mono px-1.5 py-0.5 rounded shrink-0 ml-2 ${selectedMapId === m.id ? 'bg-cyan-400 text-cyan-950' : 'bg-slate-950 text-slate-600 group-hover:text-slate-400'}`}>0x{m.offset.toString(16).toUpperCase()}</span>
              </button>
            ))}
          </div>
        </aside>

        {/* Tuner Editor Area */}
        <div className="flex-1 flex flex-col p-6 space-y-4 overflow-hidden relative">
          <PageID id="02" />
          {selectedMap && editingData ? (
            <>
              <div className="h-64 flex flex-col shrink-0 bg-black/40 rounded-2xl border border-slate-800/50 overflow-hidden shadow-2xl backdrop-blur-md">
                <Visualizer data={editingData} xAxis={ROMParser.getAxisValues(rom.data, selectedMap.xAxis)} yAxis={ROMParser.getAxisValues(rom.data, selectedMap.yAxis)} />
              </div>
              <div className="flex-1 min-h-0">
                <MapTableEditor map={selectedMap} data={editingData} xAxis={ROMParser.getAxisValues(rom.data, selectedMap.xAxis)} yAxis={ROMParser.getAxisValues(rom.data, selectedMap.yAxis)} onUpdate={onUpdateValue} />
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center p-12 text-center">
              <div className="max-w-md space-y-4">
                <div className="w-20 h-20 bg-cyan-500/5 rounded-full flex items-center justify-center mx-auto border border-cyan-500/10 mb-6 drop-shadow-[0_0_20px_rgba(6,182,212,0.1)]">
                  <svg className="w-10 h-10 text-cyan-900/40" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                </div>
                <h3 className="text-xl font-black text-slate-400 uppercase tracking-widest italic">Register Standby</h3>
                <p className="text-slate-600 text-sm leading-relaxed">Select a map from the register explorer on the left to initialize the master tuning deck.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TunerModule;
