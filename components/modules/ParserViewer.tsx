
import React from 'react';
import { ROMFile, DiagnosticType, VersionInfo } from '../../types';

interface ParserViewerProps {
  rom: ROMFile;
  activeDefinition?: VersionInfo | null;
  onNavigate: (module: 'tuner' | 'hexEdit' | 'discovery', offset?: number, mapId?: string) => void;
}

const PageID = ({ id }: { id: string }) => (
  <div className="absolute top-2 right-2 z-[100] pointer-events-none select-none">
    <span className="text-[9px] font-mono font-black text-emerald-400 bg-black px-2 py-0.5 rounded border border-emerald-500/50 tracking-wider">
      DIAG_NODE::{id}
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

const ParserViewer: React.FC<ParserViewerProps> = ({ rom, activeDefinition, onNavigate }) => {
  const getTypeColor = (type: DiagnosticType) => {
    switch (type) {
      case 'identity': return 'text-blue-400 bg-blue-500/10 border-blue-500/20';
      case 'integrity': return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
      case 'structure': return 'text-purple-400 bg-purple-500/10 border-purple-500/20';
      case 'heuristic': return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
      default: return 'text-slate-400 bg-slate-500/10 border-slate-500/20';
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden relative z-10">
      <ActiveContextBar rom={rom} def={activeDefinition} />
      <div className="flex-1 flex flex-col p-6 space-y-6 overflow-hidden">
        <PageID id="07" />
        
        <div className="flex flex-col flex-1 min-h-0 bg-slate-950 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
          <header className="p-6 bg-slate-900 border-b border-slate-800 flex justify-between items-center">
            <div>
              <h3 className="text-sm font-black text-white uppercase tracking-widest italic">Dynamic Diagnostic Ledger</h3>
              <p className="text-[9px] text-slate-500 font-bold uppercase mt-1 italic">Heuristic Crawl Results & Identity Mapping</p>
            </div>
            <div className="flex items-center space-x-4">
               <div className="flex items-center space-x-2 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-400 text-[10px] font-black uppercase tracking-widest">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span>Registry Sync: ACTIVE</span>
               </div>
            </div>
          </header>

          <div className="flex-1 overflow-y-auto custom-scrollbar">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 bg-slate-900 z-20">
                <tr className="text-[10px] font-black text-slate-600 uppercase tracking-widest italic border-b border-slate-800">
                  <th className="p-4 pl-6">Diagnostic Class</th>
                  <th className="p-4">Finding / Parameter</th>
                  <th className="p-4">Offset</th>
                  <th className="p-4">Size</th>
                  <th className="p-4">Value / Descriptor</th>
                  <th className="p-4 text-right pr-6">Teleport Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {rom.diagnostics.map((diag) => {
                  const dataSize = diag.size;

                  return (
                    <tr key={diag.id} className="group hover:bg-white/5 transition-colors">
                      <td className="p-4 pl-6">
                        <span className={`px-2 py-0.5 rounded border text-[8px] font-black uppercase italic ${getTypeColor(diag.type)}`}>
                          {diag.type}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className="text-xs font-black text-white uppercase italic">{diag.label}</span>
                      </td>
                      <td className="p-4">
                        <span className="text-[10px] font-mono text-slate-500 italic">
                          {diag.offset !== undefined ? `0x${diag.offset.toString(16).toUpperCase()}` : '(Global)'}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className="text-[10px] font-mono text-amber-500/80 font-bold italic">
                          {dataSize !== undefined ? `${dataSize} B` : '--'}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className="text-xs font-mono text-cyan-400 font-bold">{diag.value}</span>
                      </td>
                      <td className="p-4 text-right pr-6">
                        <div className="flex justify-end space-x-2 opacity-60 group-hover:opacity-100 transition-opacity">
                          {diag.actions.map(action => (
                            <button 
                              key={action}
                              onClick={() => onNavigate(action === 'tuner' ? 'tuner' : action === 'hexEdit' ? 'hexEdit' : 'discovery', diag.offset, diag.type === 'heuristic' ? diag.id : undefined)}
                              className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase italic transition-all active:scale-95
                                ${action === 'hexEdit' ? 'bg-red-600/10 text-red-500 border border-red-500/20 hover:bg-red-600 hover:text-white' : 
                                  action === 'tuner' ? 'bg-cyan-600/10 text-cyan-500 border border-cyan-500/20 hover:bg-cyan-600 hover:text-white' : 
                                  'bg-lime-600/10 text-lime-500 border border-lime-500/20 hover:bg-lime-600 hover:text-white'}`}
                            >
                              {action === 'hexEdit' ? 'Surgery' : action === 'tuner' ? 'Tuner' : 'Browse'}
                            </button>
                          ))}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            
            {rom.diagnostics.length === 0 && (
              <div className="p-20 text-center text-slate-700 font-black uppercase italic tracking-[0.4em] opacity-20">
                No Forensics Detected
              </div>
            )}
          </div>

          <footer className="p-4 bg-slate-900 border-t border-slate-800 flex justify-between items-center text-[9px] font-bold text-slate-500 uppercase italic">
             <span>Heuristic Analysis Completed in 1.4ms</span>
             <span className="text-cyan-500">M3.3.1 Forensic Engine v1.0.2</span>
          </footer>
        </div>
      </div>
    </div>
  );
};

export default ParserViewer;
