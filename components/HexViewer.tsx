
import React, { useState, useMemo, useEffect } from 'react';
import { DMEMap, MapDimension, MapType, Endian } from '../types';
import { ROMParser } from '../services/romParser';
import Visualizer from './Visualizer';

interface HexViewerProps {
  data?: Uint8Array;
  onAddDefinition?: (map: DMEMap) => void;
  onFileUpload?: (file: File) => void;
  initialOffset?: number;
}

interface DiscoveryCandidate extends Partial<DMEMap> {
  id: string;
  endian: Endian;
}

const HexViewer: React.FC<HexViewerProps> = ({ data, onAddDefinition, initialOffset }) => {
  const [offset, setOffset] = useState(0);
  const [hoveredAddr, setHoveredAddr] = useState<number | null>(null);
  const [selection, setSelection] = useState<{ start: number, end: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [discoveryLibrary, setDiscoveryLibrary] = useState<DiscoveryCandidate[]>([]);
  const [activeDiscoveryId, setActiveDiscoveryId] = useState<string | null>(null);

  const rowsPerPage = 28;
  const bytesPerRow = 16;
  const viewWindow = rowsPerPage * bytesPerRow;

  const toHex = (n: number) => n.toString(16).padStart(2, '0').toUpperCase();
  const toAddr = (n: number) => n.toString(16).padStart(4, '0').toUpperCase();

  const maxOffset = useMemo(() => {
    if (!data) return 0;
    return Math.max(0, data.length - viewWindow);
  }, [data, viewWindow]);

  const activeDiscovery = useMemo(() => 
    discoveryLibrary.find(d => d.id === activeDiscoveryId) || null,
    [discoveryLibrary, activeDiscoveryId]
  );

  const jumpToOffset = (addr: number) => {
    const aligned = Math.floor(addr / bytesPerRow) * bytesPerRow;
    setOffset(Math.max(0, Math.min(maxOffset, aligned)));
    setHoveredAddr(addr);
  };

  useEffect(() => {
    if (initialOffset !== undefined) {
      jumpToOffset(initialOffset);
    }
  }, [initialOffset]);

  const pinCandidate = () => {
    if (!selection) return;
    const start = Math.min(selection.start, selection.end);
    const size = Math.abs(selection.end - selection.start) + 1;
    
    const newId = `candidate_${Date.now()}`;
    const newCandidate: DiscoveryCandidate = {
      id: newId,
      name: `Candidate @ 0x${toAddr(start)}`,
      offset: start, rows: 1, cols: size, dataSize: 8,
      endian: 'be', type: MapType.TABLE, dimension: MapDimension.Table2D,
      unit: 'Raw', formula: 'X', category: 'Map Candidates'
    };
    
    setDiscoveryLibrary(prev => [...prev, newCandidate]);
    setActiveDiscoveryId(newId);
    setSelection(null);
  };

  const handleMouseDown = (addr: number) => {
    setSelection({ start: addr, end: addr });
    setIsDragging(true);
    setActiveDiscoveryId(null);
  };

  const handleMouseEnter = (addr: number) => {
    if (isDragging) setSelection(prev => prev ? { ...prev, end: addr } : null);
    setHoveredAddr(addr);
  };

  useEffect(() => {
    const up = () => setIsDragging(false);
    window.addEventListener('mouseup', up);
    return () => window.removeEventListener('mouseup', up);
  }, []);

  const discoveryPreviewData = useMemo(() => {
    if (!data || !activeDiscovery) return [[0]];
    return ROMParser.extractMapData(data, activeDiscovery as DMEMap);
  }, [data, activeDiscovery]);

  if (!data) return <div className="flex-1 flex items-center justify-center text-slate-500 font-black italic">Load Binary To Begin Discovery</div>;

  return (
    <div className="flex-1 flex space-x-4 min-h-0 overflow-hidden">
      <aside className="w-64 flex flex-col bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
         <div className="p-4 bg-slate-900/50 border-b border-slate-800 flex justify-between items-center">
            <h3 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest italic">Registry</h3>
         </div>
         <div className="flex-1 overflow-y-auto p-2 space-y-4">
            {discoveryLibrary.map(d => (
              <button 
                key={d.id}
                onClick={() => { setActiveDiscoveryId(d.id); jumpToOffset(d.offset || 0); }}
                className={`w-full text-left p-2.5 rounded-xl border transition-all ${activeDiscoveryId === d.id ? 'bg-indigo-600' : 'bg-slate-900 border-slate-800 hover:border-slate-700'}`}
              >
                <div className="text-[10px] font-black uppercase truncate text-white">{d.name}</div>
                <div className="text-[9px] font-mono text-slate-500">0x{toAddr(d.offset || 0)}</div>
              </button>
            ))}
         </div>
      </aside>

      <div className="flex-1 flex flex-col bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl relative">
        <div className="p-4 bg-slate-900/80 border-b border-slate-800 flex justify-between items-center backdrop-blur-md z-20">
           <span className="text-[10px] font-black text-emerald-400 uppercase italic">Binary Explorer</span>
           {selection && <button onClick={pinCandidate} className="px-4 py-1.5 bg-indigo-600 text-white rounded-lg text-[9px] font-black uppercase italic transition-all active:scale-95">Pin Selection</button>}
        </div>

        <div className="flex-1 overflow-hidden p-6 font-mono select-none cursor-crosshair">
          <div className="grid grid-cols-[56px_16px_480px_1fr] gap-x-0 mb-4 text-[10px] text-slate-600 font-black uppercase italic tracking-[0.2em]">
            <div className="text-right pr-2">Offset</div>
            <div className="text-center opacity-30">|</div>
            <div className="grid grid-cols-16 gap-x-1 pl-2">
              {Array.from({ length: 16 }).map((_, i) => <span key={i} className="text-center w-7">{i.toString(16).toUpperCase()}</span>)}
            </div>
            <div className="text-center">ASCII</div>
          </div>

          <div className="space-y-1">
            {Array.from({ length: rowsPerPage }).map((_, rowIdx) => {
              const rowOffset = offset + (rowIdx * bytesPerRow);
              if (rowOffset >= data.length) return null;
              const rowData = data.slice(rowOffset, rowOffset + bytesPerRow);

              return (
                <div key={rowIdx} className="grid grid-cols-[56px_16px_480px_1fr] gap-x-0 group py-0.5 items-center">
                  <div className="text-emerald-500/50 font-black text-right pr-2">0x{toAddr(rowOffset)}</div>
                  <div className="text-center text-slate-800">|</div>

                  <div className="grid grid-cols-16 gap-x-1 pl-2">
                    {Array.from({ length: 16 }).map((_, colIdx) => {
                      const addr = rowOffset + colIdx;
                      const byte = rowData[colIdx];
                      const isSelected = selection && addr >= Math.min(selection.start, selection.end) && addr <= Math.max(selection.start, selection.end);
                      const activePin = discoveryLibrary.find(d => {
                         const start = d.offset || 0;
                         const length = (d.rows || 1) * (d.cols || 1) * ((d.dataSize || 8) / 8);
                         return addr >= start && addr < start + length;
                      });

                      return (
                        <span key={colIdx} 
                          onMouseDown={() => handleMouseDown(addr)}
                          onMouseEnter={() => handleMouseEnter(addr)}
                          className={`w-7 text-center rounded transition-all font-mono font-bold text-[13px]
                            ${isSelected ? 'bg-indigo-500 text-white shadow-lg z-10 scale-110' : 
                              activePin ? (activePin.id === activeDiscoveryId ? 'bg-indigo-600 text-white' : 'border border-indigo-500/40 text-indigo-300') :
                              hoveredAddr === addr ? 'bg-slate-800 text-white' : 
                              byte === 0 ? 'text-slate-800' : 'text-slate-300'}`}
                        >
                          {toHex(byte)}
                        </span>
                      );
                    })}
                  </div>

                  <div className="flex justify-between px-2 text-blue-500 border-l border-slate-800/50 h-full items-center opacity-60 text-[12px]">
                    {Array.from({ length: 16 }).map((_, i) => {
                      const byte = rowData[i];
                      return <span key={i} className="w-4 text-center">{byte >= 32 && byte <= 126 ? String.fromCharCode(byte) : '.'}</span>;
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <aside className="w-80 flex flex-col bg-slate-950 border border-slate-800 rounded-2xl p-5 shadow-2xl">
          <h3 className="text-[11px] font-black text-indigo-400 uppercase italic border-b border-slate-800 pb-2 mb-4">Discovery Lab</h3>
          {activeDiscovery ? (
            <div className="space-y-4 flex-1 flex flex-col overflow-hidden">
               <div className="h-40 bg-black rounded-xl border border-slate-800 overflow-hidden">
                  <Visualizer data={discoveryPreviewData} xAxis={Array.from({length: activeDiscovery.cols || 1}).map((_, i) => i)} yAxis={Array.from({length: activeDiscovery.rows || 1}).map((_, i) => i)} />
               </div>
               <div className="flex-1 overflow-y-auto space-y-3">
                  <div className="space-y-1">
                    <label className="text-[9px] text-slate-500 font-bold uppercase italic">Name</label>
                    <input className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-2 text-xs text-white focus:border-indigo-500" value={activeDiscovery.name} onChange={e => setDiscoveryLibrary(prev => prev.map(d => d.id === activeDiscoveryId ? {...d, name: e.target.value} : d))} />
                  </div>
               </div>
               <button onClick={() => onAddDefinition && onAddDefinition(activeDiscovery as DMEMap)} className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-[10px] font-black uppercase italic shadow-xl transition-all">Commit To Project</button>
            </div>
          ) : (
            <p className="text-[10px] text-slate-600 uppercase italic text-center mt-20">Select a range to analyze</p>
          )}
      </aside>
    </div>
  );
};

export default HexViewer;
