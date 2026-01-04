
import React, { useMemo } from 'react';
import { ROMFile, VersionInfo, MapType } from '../../types';
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

  const inspectorData = useMemo(() => {
    if (!selectedMap || !rom.data) return null;
    const size = selectedMap.rows * selectedMap.cols * (selectedMap.dataSize / 8);
    const raw = rom.data.slice(selectedMap.offset, selectedMap.offset + size);
    
    const cat = selectedMap.category?.toLowerCase() || '';
    const unit = selectedMap.unit?.toLowerCase() || '';

    // Identity check - force ASCII representation for identification markers
    if (selectedMap.type === MapType.STRING || cat.includes('identity') || cat.includes('header')) {
      return { type: 'ascii', value: new TextDecoder().decode(raw) };
    }

    // Structural pointer check - force HEX table with location indices
    if (cat.includes('pointer') || unit === 'addr' || unit === 'ref') {
      const rows = [];
      for (let i = 0; i < raw.length; i += 2) {
        if (i + 1 < raw.length) {
          const val = selectedMap.endian === 'le' ? (raw[i] | (raw[i+1] << 8)) : ((raw[i] << 8) | raw[i+1]);
          rows.push({
            idx: (i / 2).toString(16).toUpperCase().padStart(2, '0'),
            addr: (selectedMap.offset + i).toString(16).toUpperCase().padStart(4, '0'),
            ref: val.toString(16).padStart(4, '0').toUpperCase()
          });
        }
      }
      return { type: 'selfref', value: rows };
    }

    return null;
  }, [selectedMap, rom.data]);

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

        {/* Forensic Interpretation Sidebar */}
        <aside className="w-80 bg-black/60 border-l border-slate-900/50 flex flex-col shrink-0 backdrop-blur-2xl">
           <div className="p-4 border-b border-slate-900/50 flex items-center space-x-2">
              <svg className="w-3 h-3 text-cyan-500 animate-pulse" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" /></svg>
              <h3 className="text-[10px] font-black text-cyan-500 uppercase tracking-[0.2em] italic">Forensic Interpreter</h3>
           </div>
           <div className="flex-1 overflow-y-auto p-5 space-y-6 scrollbar-hide">
              {selectedMap && inspectorData ? (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                  <div className="bg-cyan-950/10 p-4 rounded-2xl border border-cyan-500/20 shadow-inner">
                    <span className="text-[8px] font-black text-slate-500 uppercase italic">Register ID Card</span>
                    <div className="text-sm font-bold text-white mt-1 uppercase tracking-tight truncate">{selectedMap.name}</div>
                    <div className="text-[9px] text-cyan-600 font-mono mt-1 italic">0x{selectedMap.offset.toString(16).toUpperCase()} • {selectedMap.rows}x{selectedMap.cols} {selectedMap.dataSize}bit</div>
                  </div>

                  {inspectorData.type === 'ascii' && (
                    <div className="bg-black/60 p-5 rounded-2xl border border-cyan-500/30 shadow-2xl ring-1 ring-cyan-500/10">
                       <span className="text-[8px] font-black text-cyan-400 uppercase italic tracking-[0.3em] mb-3 block">Identity Marker (ASCII)</span>
                       <div className="mt-2 text-2xl font-mono text-cyan-500 font-black tracking-[0.2em] leading-none break-all drop-shadow-[0_0_10px_rgba(6,182,212,0.5)]">
                         "{inspectorData.value}"
                       </div>
                    </div>
                  )}

                  {inspectorData.type === 'selfref' && (
                    <div className="bg-black/60 border border-purple-500/30 rounded-2xl overflow-hidden shadow-2xl ring-1 ring-purple-500/10">
                       <div className="bg-purple-900/10 px-4 py-2 border-b border-purple-500/20">
                          <span className="text-[8px] font-black text-purple-400 uppercase italic tracking-[0.3em]">Structural Registry</span>
                       </div>
                       <div className="p-0">
                          <table className="w-full text-left border-collapse">
                             <thead>
                                <tr className="text-[7px] font-black text-slate-600 uppercase tracking-widest border-b border-purple-900/20 bg-purple-900/5">
                                   <th className="px-3 py-1.5">IDX</th>
                                   <th className="px-3 py-1.5">ADDR</th>
                                   <th className="px-3 py-1.5">REF</th>
                                </tr>
                             </thead>
                             <tbody className="divide-y divide-purple-900/10">
                                {(inspectorData.value as {idx: string, addr: string, ref: string}[]).map((row, i) => (
                                  <tr key={i} className="hover:bg-purple-900/20 transition-colors">
                                     <td className="px-3 py-1.5 font-mono text-[9px] text-slate-500">{row.idx}</td>
                                     <td className="px-3 py-1.5 font-mono text-[9px] text-purple-600">0x{row.addr}</td>
                                     <td className="px-3 py-1.5 font-mono text-[9px] text-purple-400 font-bold italic">0x{row.ref}</td>
                                  </tr>
                                ))}
                             </tbody>
                          </table>
                          {inspectorData.value.length === 0 && (
                            <div className="text-[10px] text-slate-700 italic py-6 text-center">Empty Registry Table</div>
                          )}
                       </div>
                    </div>
                  )}

                  <div className="p-4 border-t border-slate-900/50 mt-6 opacity-60">
                     <p className="text-[10px] text-slate-500 italic leading-relaxed font-medium">
                       {selectedMap.description || 'No surgical documentation provided for this register.'}
                     </p>
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-center opacity-30 mt-20 group">
                  <svg className="w-10 h-10 text-slate-700 mb-4 transition-transform group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                  <p className="text-[9px] font-black text-slate-700 uppercase italic leading-loose">Initialize register selection<br/>to begin forensic translation</p>
                </div>
              )}
           </div>
           <div className="p-4 bg-slate-900/30 border-t border-slate-900/50">
              <div className="flex justify-between items-center text-[8px] font-black text-slate-700 uppercase italic tracking-widest">
                 <span>Interpreter Mode: AUTO</span>
                 <span className="text-cyan-900/40">GEO_SYNC::OK</span>
              </div>
           </div>
        </aside>
      </div>
    </div>
  );
};

export default TunerModule;
