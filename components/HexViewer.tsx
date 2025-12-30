import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { DMEMap, MapDimension, MapType, AxisSource, Endian } from '../types';
import { ROMParser } from '../services/romParser';
import Visualizer from './Visualizer';

interface HexViewerProps {
  data?: Uint8Array;
  onAddDefinition?: (map: DMEMap) => void;
  onFileUpload?: (file: File) => void;
}

interface ScanResult {
  address: number;
  value: number;
  type: 'BE' | 'LE';
}

interface DiscoveryCandidate extends Partial<DMEMap> {
  id: string;
  isPointer?: boolean;
  isPointerList?: boolean;
  pointerValues?: number[];
  endian: Endian;
}

const HexViewer: React.FC<HexViewerProps> = ({ data, onAddDefinition, onFileUpload }) => {
  const [offset, setOffset] = useState(0);
  const [hoveredAddr, setHoveredAddr] = useState<number | null>(null);
  const [selection, setSelection] = useState<{ start: number, end: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  
  const [discoveryLibrary, setDiscoveryLibrary] = useState<DiscoveryCandidate[]>([]);
  const [activeDiscoveryId, setActiveDiscoveryId] = useState<string | null>(null);
  
  const [scanResults, setScanResults] = useState<ScanResult[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [isScrolling, setIsScrolling] = useState(false);

  const scrollTrackRef = useRef<HTMLDivElement>(null);
  
  const rowsPerPage = 28;
  const bytesPerRow = 16;
  const viewWindow = rowsPerPage * bytesPerRow;

  const toHex = (n: number | undefined) => {
    if (n === undefined) return '..';
    return n.toString(16).padStart(2, '0').toUpperCase();
  };
  
  const toAddr = (n: number) => n.toString(16).padStart(4, '0').toUpperCase();

  const maxOffset = useMemo(() => {
    if (!data) return 0;
    return Math.max(0, data.length - viewWindow);
  }, [data, viewWindow]);

  const activeDiscovery = useMemo(() => 
    discoveryLibrary.find(d => d.id === activeDiscoveryId) || null,
    [discoveryLibrary, activeDiscoveryId]
  );

  const handleScroll = (e: React.WheelEvent) => {
    if (!data) return;
    const delta = e.deltaY > 0 ? bytesPerRow * 2 : -bytesPerRow * 2;
    setOffset(prev => Math.max(0, Math.min(maxOffset, prev + delta)));
  };

  const jumpToOffset = (addr: number) => {
    const aligned = Math.floor(addr / bytesPerRow) * bytesPerRow;
    setOffset(Math.max(0, Math.min(maxOffset, aligned)));
    setHoveredAddr(addr);
  };

  const pinCandidate = () => {
    if (!selection) return;
    const start = Math.min(selection.start, selection.end);
    const size = Math.abs(selection.end - selection.start) + 1;
    
    const newId = `candidate_${Date.now()}`;
    const newCandidate: DiscoveryCandidate = {
      id: newId,
      name: `Candidate @ 0x${toAddr(start)}`,
      offset: start,
      rows: 1,
      cols: size,
      dataSize: 8,
      endian: 'be',
      type: MapType.TABLE,
      dimension: MapDimension.Table2D,
      unit: 'Raw',
      formula: 'X',
      category: 'Map Candidates',
      isPointer: false
    };
    
    setDiscoveryLibrary(prev => [...prev, newCandidate]);
    setActiveDiscoveryId(newId);
    setSelection(null);
  };

  const createPointerItem = (res: ScanResult) => {
    const newId = `ptr_${res.address}_${res.type}`;
    return {
      id: newId,
      name: `Self-Ref Ptr (${res.type})`,
      offset: res.address,
      rows: 1,
      cols: 1,
      dataSize: 16,
      endian: res.type === 'BE' ? 'be' : 'le',
      type: MapType.SCALAR,
      dimension: MapDimension.Value,
      unit: 'Address',
      formula: 'X',
      category: 'System Pointers',
      isPointer: true
    } as DiscoveryCandidate;
  };

  const removeDiscoveryItem = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setDiscoveryLibrary(prev => prev.filter(d => d.id !== id));
    if (activeDiscoveryId === id) setActiveDiscoveryId(null);
  };

  const updateActiveDiscovery = (updates: Partial<DiscoveryCandidate>) => {
    if (!activeDiscoveryId) return;
    setDiscoveryLibrary(prev => prev.map(d => d.id === activeDiscoveryId ? { ...d, ...updates } : d));
  };

  const discoveryPreviewData = useMemo(() => {
    if (!data || !activeDiscovery) return [[0]];
    try {
      const mockMap: DMEMap = {
        ...activeDiscovery as DMEMap,
        id: 'tmp',
        description: '',
        category: ''
      };
      return ROMParser.extractMapData(data, mockMap);
    } catch (e) {
      return [[0]];
    }
  }, [data, activeDiscovery]);

  const commitToProject = () => {
    if (!activeDiscovery || !onAddDefinition) return;
    const finalMap: DMEMap = {
      ...activeDiscovery as DMEMap,
      description: `Discovered in Hex Bro @ 0x${toAddr(activeDiscovery.offset || 0)}.`
    };
    onAddDefinition(finalMap);
    setDiscoveryLibrary(prev => prev.filter(d => d.id !== activeDiscoveryId));
    setActiveDiscoveryId(null);
  };

  const handleScrollbarClick = (e: React.MouseEvent | React.TouchEvent) => {
    if (!scrollTrackRef.current || !data) return;
    const rect = scrollTrackRef.current.getBoundingClientRect();
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const relativeY = clientY - rect.top;
    const percentage = Math.max(0, Math.min(1, relativeY / rect.height));
    const rawOffset = percentage * maxOffset;
    setOffset(Math.floor(rawOffset / bytesPerRow) * bytesPerRow);
  };

  useEffect(() => {
    const handleMove = (e: MouseEvent | TouchEvent) => {
      if (!isScrolling || !scrollTrackRef.current || !data) return;
      const rect = scrollTrackRef.current.getBoundingClientRect();
      const clientY = 'touches' in e ? (e as TouchEvent).touches[0].clientY : (e as MouseEvent).clientY;
      const percentage = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
      setOffset(Math.floor((percentage * maxOffset) / bytesPerRow) * bytesPerRow);
    };

    if (isScrolling) {
      window.addEventListener('mousemove', handleMove);
      window.addEventListener('mouseup', () => setIsScrolling(false));
      window.addEventListener('touchmove', handleMove);
      window.addEventListener('touchend', () => setIsScrolling(false));
    }
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('touchmove', handleMove);
    };
  }, [isScrolling, data, maxOffset]);

  const runPointerScan = () => {
    if (!data) return;
    setIsScanning(true);
    
    const selfRefAddresses: Set<number> = new Set();
    const results: ScanResult[] = [];
    const newItems: DiscoveryCandidate[] = [];

    // Phase 1: Self-Ref Scan
    for (let i = 0; i < data.length - 1; i++) {
      const valBE = (data[i] << 8) | data[i + 1];
      const valLE = data[i] | (data[i + 1] << 8);
      
      if (valBE === i) {
        selfRefAddresses.add(i);
        results.push({ address: i, value: valBE, type: 'BE' });
        newItems.push(createPointerItem({ address: i, value: valBE, type: 'BE' }));
      } else if (valLE === i) {
        selfRefAddresses.add(i);
        results.push({ address: i, value: valLE, type: 'LE' });
        newItems.push(createPointerItem({ address: i, value: valLE, type: 'LE' }));
      }
    }

    // Phase 2: Pointer List Scan
    if (selfRefAddresses.size > 0) {
      const scanForLists = (isBE: boolean) => {
        let currentStreak: number[] = [];
        let streakStart = -1;

        for (let i = 0; i < data.length - 1; i += 2) {
          const word = isBE ? (data[i] << 8) | data[i + 1] : data[i] | (data[i + 1] << 8);
          if (selfRefAddresses.has(word)) {
            if (currentStreak.length === 0) streakStart = i;
            currentStreak.push(word);
          } else {
            if (currentStreak.length >= 2) {
              newItems.push({
                id: `plist_${streakStart}_${isBE ? 'BE' : 'LE'}`,
                name: `Pointer List (${isBE ? 'BE' : 'LE'}) @ 0x${toAddr(streakStart)}`,
                offset: streakStart,
                rows: 1,
                cols: currentStreak.length,
                dataSize: 16,
                endian: isBE ? 'be' : 'le',
                type: MapType.SCALAR,
                category: 'System Lists',
                isPointerList: true,
                pointerValues: [...currentStreak]
              });
            }
            currentStreak = [];
          }
        }
      };
      scanForLists(true);
      scanForLists(false);
    }

    setScanResults(results);
    if (newItems.length > 0) {
      setDiscoveryLibrary(prev => {
        const existingIds = new Set(prev.map(p => p.id));
        return [...prev, ...newItems.filter(item => !existingIds.has(item.id))];
      });
    }
    setIsScanning(false);
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

  const scrollThumbTop = (maxOffset > 0) ? (offset / maxOffset) * 100 : 0;

  const registryGroups = useMemo(() => {
    return discoveryLibrary.reduce((acc, item) => {
      const group = item.isPointerList ? 'System Lists' : item.isPointer ? 'System Pointers' : 'Map Candidates';
      if (!acc[group]) acc[group] = [];
      acc[group].push(item);
      return acc;
    }, {} as Record<string, DiscoveryCandidate[]>);
  }, [discoveryLibrary]);

  if (!data) return <div className="flex-1 flex items-center justify-center bg-slate-900 rounded-3xl p-12 text-center text-slate-500 uppercase font-black italic">Load Binary To Begin Discovery</div>;

  return (
    <div className="flex-1 flex space-x-4 min-h-0 overflow-hidden" onWheel={handleScroll}>
      {/* LEFT: Discovery Registry Panel */}
      <aside className="w-64 flex flex-col bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
         <div className="p-4 bg-slate-900/50 border-b border-slate-800 flex justify-between items-center">
            <h3 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest italic">Discovery Registry</h3>
            <span className="bg-slate-800 text-slate-500 text-[9px] px-1.5 py-0.5 rounded font-bold">{discoveryLibrary.length}</span>
         </div>
         <div className="flex-1 overflow-y-auto p-2 space-y-4">
            {Object.entries(registryGroups).map(([group, items]) => (
              <div key={group} className="space-y-2">
                <div className="text-[9px] font-black text-slate-600 uppercase tracking-widest italic px-2">{group}</div>
                {items.map(d => (
                  <div key={d.id} className="relative group/item">
                    <button 
                      onClick={() => { setActiveDiscoveryId(d.id); jumpToOffset(d.offset || 0); }}
                      className={`w-full text-left p-2.5 rounded-xl border transition-all ${activeDiscoveryId === d.id ? (d.isPointerList ? 'bg-violet-600 border-violet-400 shadow-[0_0_15px_rgba(139,92,246,0.3)]' : d.isPointer ? 'bg-amber-600 border-amber-400' : 'bg-indigo-600 border-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.3)]') : 'bg-slate-900 border-slate-800 hover:border-slate-700'}`}
                    >
                      <div className={`text-[10px] font-black uppercase truncate mb-1 pr-4 ${activeDiscoveryId === d.id ? 'text-white' : 'text-slate-200'}`}>{d.name}</div>
                      <div className="flex justify-between items-center">
                        <span className={`text-[9px] font-mono ${activeDiscoveryId === d.id ? 'text-white/80' : 'text-slate-500'}`}>0x{toAddr(d.offset || 0)}</span>
                        <span className={`text-[8px] font-black uppercase px-1 rounded ${activeDiscoveryId === d.id ? 'bg-white/20' : 'bg-slate-800'}`}>{d.isPointerList ? 'LIST' : d.isPointer ? 'PTR' : `${d.rows}x${d.cols}`}</span>
                      </div>
                    </button>
                    <button onClick={(e) => removeDiscoveryItem(e, d.id)} className="absolute top-2 right-2 p-1 text-slate-500 hover:text-red-400 opacity-0 group-hover/item:opacity-100 transition-opacity"><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
                  </div>
                ))}
              </div>
            ))}
         </div>
      </aside>

      {/* CENTER: Main Hex Grid */}
      <div className="flex-1 flex flex-col bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl relative">
        <div className="p-4 bg-slate-900/80 border-b border-slate-800 flex justify-between items-center backdrop-blur-md z-20">
           <div className="flex items-center space-x-4">
              <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest italic animate-pulse">Binary Explorer</span>
              <div className="h-4 w-px bg-slate-800"></div>
              <div className="text-[10px] text-slate-500 font-mono uppercase tracking-widest">Ptr: <span className="text-emerald-400 font-black">0x{toAddr(hoveredAddr || 0)}</span></div>
           </div>
           {selection && <button onClick={pinCandidate} className="px-4 py-1.5 bg-indigo-600 text-white rounded-lg text-[9px] font-black uppercase tracking-widest shadow-lg italic transition-transform active:scale-95">Pin Selection</button>}
        </div>

        <div className="flex-1 flex overflow-hidden relative">
          <div className="flex-1 overflow-hidden p-6 font-mono select-none cursor-crosshair">
            {/* Strict Alignment Header - Optimized spacing */}
            <div className="grid grid-cols-[56px_16px_480px_1fr] gap-x-0 mb-4 text-[10px] text-slate-600 font-black uppercase italic tracking-[0.2em]">
              <div className="text-right pr-2">xOffset</div>
              <div className="text-center opacity-30">|</div>
              <div className="grid grid-cols-16 gap-x-1 pl-2">
                {Array.from({ length: 16 }).map((_, i) => <span key={i} className="text-center w-7">{i.toString(16).toUpperCase()}</span>)}
              </div>
              <div className="text-center">ASCII Data</div>
            </div>

            <div className="space-y-1">
              {Array.from({ length: rowsPerPage }).map((_, rowIdx) => {
                const rowOffset = offset + (rowIdx * bytesPerRow);
                if (rowOffset >= data.length) return null;
                const rowData = data.slice(rowOffset, rowOffset + bytesPerRow);

                return (
                  <div key={rowIdx} className="grid grid-cols-[56px_16px_480px_1fr] gap-x-0 group py-0.5 items-center">
                    <div className="text-emerald-500/50 font-black font-mono tracking-wider group-hover:text-emerald-400 transition-colors text-right pr-2">0x{toAddr(rowOffset)}</div>
                    
                    <div className="text-center text-slate-800 font-black">|</div>

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
                              ${isSelected ? 'bg-indigo-500 text-white shadow-lg scale-110 z-10' : 
                                activePin ? (activePin.id === activeDiscoveryId ? (activePin.isPointerList ? 'bg-violet-600 text-white' : activePin.isPointer ? 'bg-amber-600 text-white' : 'bg-indigo-600 text-white') : (activePin.isPointerList ? 'border border-violet-500/60 text-violet-400' : activePin.isPointer ? 'border border-amber-500/60 text-amber-400' : 'border border-indigo-500/40 text-indigo-300')) :
                                hoveredAddr === addr ? 'bg-slate-800 text-white' : 
                                byte === 0 ? 'text-slate-800 font-black' : 'text-slate-300'}`}
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

          <div ref={scrollTrackRef} onMouseDown={(e) => { setIsScrolling(true); handleScrollbarClick(e); }} className="w-3 h-full bg-slate-900 border-l border-slate-800 cursor-pointer relative">
            <div style={{ top: `${scrollThumbTop}%` }} className="absolute left-0.5 right-0.5 h-16 bg-emerald-600 rounded-full shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
          </div>
        </div>
      </div>

      {/* RIGHT: Discovery Lab & Logic Panel */}
      <aside className="w-96 flex flex-col space-y-4">
        <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 shadow-2xl flex-1 flex flex-col min-h-0">
          <h3 className="text-[11px] font-black text-indigo-400 uppercase tracking-widest italic border-b border-slate-800 pb-2 mb-4">Discovery Lab</h3>
          
          {activeDiscovery ? (
            <div className="flex-1 flex flex-col space-y-4 min-h-0">
              {activeDiscovery.isPointerList ? (
                <div className="p-4 bg-violet-900/20 border border-violet-500/20 rounded-xl space-y-2 overflow-hidden flex flex-col">
                  <div className="text-[10px] font-black text-violet-400 uppercase italic">Pointer Sequence</div>
                  <div className="overflow-y-auto space-y-1">
                    {activeDiscovery.pointerValues?.map((val, i) => (
                      <button key={i} onClick={() => jumpToOffset(val)} className="w-full flex justify-between p-2 bg-slate-900/50 hover:bg-violet-900/30 rounded border border-slate-800 text-[10px] font-mono group">
                        <span className="text-slate-500">Idx {i}</span>
                        <span className="text-violet-400 font-bold italic">-> 0x{toAddr(val)}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : activeDiscovery.isPointer ? (
                <div className="p-4 bg-amber-900/20 border border-amber-500/20 rounded-xl space-y-2">
                  <div className="text-[10px] font-black text-amber-500 uppercase italic">Self-Referencing Header</div>
                  <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                    <span className="text-slate-500">Address:</span><span className="text-white">0x{toAddr(activeDiscovery.offset || 0)}</span>
                    <span className="text-slate-500">Match Type:</span><span className="text-amber-400 font-bold">RECURSIVE</span>
                  </div>
                </div>
              ) : (
                <div className="h-40 bg-black rounded-xl border border-slate-800 overflow-hidden shadow-inner">
                   <Visualizer data={discoveryPreviewData} xAxis={Array.from({length: activeDiscovery.cols || 1}).map((_, i) => i)} yAxis={Array.from({length: activeDiscovery.rows || 1}).map((_, i) => i)} />
                </div>
              )}

              <div className="space-y-3 overflow-y-auto pr-1 flex-1">
                <div className="space-y-1">
                  <label className="text-[9px] text-slate-500 font-bold uppercase italic">Label</label>
                  <input className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-2 text-xs text-white" value={activeDiscovery.name} onChange={e => updateActiveDiscovery({name: e.target.value})} />
                </div>
                {!activeDiscovery.isPointer && !activeDiscovery.isPointerList && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1"><label className="text-[9px] text-slate-500 font-bold uppercase italic">Rows</label><input type="number" className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1.5 text-xs text-white" value={activeDiscovery.rows} onChange={e => updateActiveDiscovery({rows: parseInt(e.target.value) || 1})} /></div>
                    <div className="space-y-1"><label className="text-[9px] text-slate-500 font-bold uppercase italic">Cols</label><input type="number" className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1.5 text-xs text-white" value={activeDiscovery.cols} onChange={e => updateActiveDiscovery({cols: parseInt(e.target.value) || 1})} /></div>
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-slate-800 space-y-2">
                <button onClick={commitToProject} className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-xl italic transition-all">Commit To Project</button>
                <button onClick={() => { setDiscoveryLibrary(prev => prev.filter(d => d.id !== activeDiscoveryId)); setActiveDiscoveryId(null); }} className="w-full py-2 text-red-500 text-[9px] font-black uppercase hover:bg-red-500/10 rounded-lg transition-colors">Discard Discovery</button>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center space-y-4 opacity-30 text-center">
              <svg className="w-12 h-12 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
              <p className="text-[10px] font-black uppercase tracking-widest px-8">Highlight a range or select from Registry</p>
            </div>
          )}
        </div>

        <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 shadow-2xl space-y-3">
          <div className="flex justify-between items-center border-b border-slate-800 pb-2 mb-2">
             <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest italic">Deep Scanner</h3>
             {scanResults.length > 0 && <button onClick={() => { setScanResults([]); setDiscoveryLibrary([]); }} className="text-[8px] text-red-500 font-bold uppercase hover:underline">Reset</button>}
          </div>
          <button onClick={runPointerScan} disabled={isScanning} className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg text-[9px] font-black uppercase text-slate-400 flex items-center justify-center space-x-2">
            {isScanning ? <span className="animate-pulse text-indigo-400">Deep Scanning...</span> : <span>Run Full Discovery Scan</span>}
          </button>
          {scanResults.length > 0 && (
             <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
                <div className="text-[8px] font-black text-slate-600 uppercase mb-1">Found {scanResults.length} Recursions</div>
                {scanResults.slice(0, 50).map((r, i) => (
                  <button key={i} onClick={() => jumpToOffset(r.address)} className="w-full flex justify-between p-2 bg-slate-900/50 rounded-lg hover:bg-indigo-900/20 text-[10px] font-mono group border border-slate-800/50 transition-colors">
                    <span className="text-amber-500 font-black italic">0x{toAddr(r.address)}</span>
                    <span className="text-slate-600 group-hover:text-indigo-400">{r.type} match</span>
                  </button>
                ))}
             </div>
          )}
        </div>
      </aside>
    </div>
  );
};

export default HexViewer;