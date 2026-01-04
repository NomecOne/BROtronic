
import { DMEMap } from '../types';
import React, { useState, useEffect, useMemo, useRef } from 'react';

interface ManualHexEditorProps {
  data?: Uint8Array;
  detectedMaps?: DMEMap[];
  onUpdateByte: (offset: number, value: number) => void;
  onFileUpload?: (file: File) => void;
  initialOffset?: number;
}

const ManualHexEditor: React.FC<ManualHexEditorProps> = ({ data, detectedMaps, onUpdateByte, onFileUpload, initialOffset }) => {
  const [offset, setOffset] = useState(0);
  const [jumpAddr, setJumpAddr] = useState('');
  const [hoveredBlock, setHoveredBlock] = useState<number | null>(null);
  
  const rowsPerPage = 32;
  const bytesPerRow = 16;
  const viewWindow = rowsPerPage * bytesPerRow;
  const scrollRef = useRef<HTMLDivElement>(null);

  const calculatedMaxOffset = useMemo(() => {
    if (!data) return 0;
    const lastRowAddr = Math.floor((data.length - 1) / bytesPerRow) * bytesPerRow;
    return Math.max(0, lastRowAddr);
  }, [data, bytesPerRow]);

  useEffect(() => {
    if (initialOffset !== undefined) {
      const aligned = Math.floor(initialOffset / bytesPerRow) * bytesPerRow;
      setOffset(Math.max(0, Math.min(calculatedMaxOffset, aligned)));
    }
  }, [initialOffset, calculatedMaxOffset]);

  const handleScroll = (e: React.WheelEvent) => {
    if (!data) return;
    if (e.deltaY > 0) {
      setOffset(prev => Math.min(calculatedMaxOffset, prev + bytesPerRow));
    } else {
      setOffset(prev => Math.max(0, prev - bytesPerRow));
    }
  };

  const navigateTo = (addr: number) => {
    const aligned = Math.floor(addr / bytesPerRow) * bytesPerRow;
    setOffset(Math.max(0, Math.min(calculatedMaxOffset, aligned)));
  };

  const handleJump = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanAddr = jumpAddr.replace(/^0x/i, '');
    const addr = parseInt(cleanAddr, 16);
    if (!isNaN(addr)) {
      navigateTo(addr);
      setJumpAddr('');
    }
  };

  const toHex = (n: number) => n.toString(16).padStart(2, '0').toUpperCase();
  const toAddr = (n: number) => n.toString(16).padStart(4, '0').toUpperCase();

  const definedAddresses = useMemo(() => {
    const set = new Set<number>();
    if (!detectedMaps) return set;
    detectedMaps.forEach(map => {
      const size = map.rows * map.cols * (map.dataSize / 8);
      for (let i = 0; i < size; i++) {
        set.add(map.offset + i);
      }
    });
    return set;
  }, [detectedMaps]);

  // Layout Constants for Perfect Alignment
  const GRID_LAYOUT = "grid grid-cols-[80px_1fr_160px] gap-x-8";
  const HEX_GRID_LAYOUT = "grid grid-cols-16 gap-x-1";

  // Minimap Grid Definition
  const MINIMAP_COLS = 4;
  const MINIMAP_ROWS = 60; 
  const totalBlocks = MINIMAP_COLS * MINIMAP_ROWS;

  const minimapBlocks = useMemo(() => {
    if (!data) return [];
    const blocks = [];
    const blockSize = data.length / totalBlocks;
    const viewportStart = offset;
    const viewportEnd = offset + viewWindow;
    
    for (let i = 0; i < totalBlocks; i++) {
      const blockStart = Math.floor(i * blockSize);
      const blockEnd = Math.floor((i + 1) * blockSize);
      
      const hasMap = detectedMaps?.some(map => {
        const mapSize = (map.rows * map.cols * (map.dataSize / 8));
        const mapEnd = map.offset + mapSize;
        return (map.offset < blockEnd && mapEnd > blockStart);
      });

      const isInViewport = blockStart < viewportEnd && blockEnd > viewportStart;

      let density = 0;
      const limit = Math.min(blockEnd, data.length);
      for (let j = blockStart; j < limit; j += Math.max(1, Math.floor(blockSize / 8))) {
        if (data[j] !== 0) { density++; break; }
      }

      blocks.push({ hasMap, hasData: density > 0, isInViewport, start: blockStart });
    }
    return blocks;
  }, [data, detectedMaps, totalBlocks, offset, viewWindow]);

  if (!data) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-slate-900 border-2 border-dashed border-red-900/20 rounded-3xl p-12 text-center">
        <div className="w-20 h-20 bg-red-600/10 rounded-full flex items-center justify-center mb-6 border border-red-500/20">
          <svg className="w-10 h-10 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
        </div>
        <h3 className="text-xl font-black text-red-400 uppercase tracking-widest italic">Binary Surgery Terminal Offline</h3>
        <p className="text-slate-500 mt-2 text-sm max-w-xs">Load a ROM to begin direct byte surgery.</p>
        <label className="mt-8 px-6 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest cursor-pointer shadow-lg shadow-red-900/20 transition-all">
          Prepare Binary For Surgery
          <input type="file" className="hidden" onChange={(e) => {
             const file = e.target.files?.[0];
             if (file && onFileUpload) onFileUpload(file);
          }} />
        </label>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-slate-950 border border-red-900/30 rounded-2xl overflow-hidden shadow-2xl relative" onWheel={handleScroll}>
      <header className="p-4 bg-red-950/20 border-b border-red-900/40 flex flex-wrap justify-between items-center gap-4 shrink-0">
        <div className="flex items-center space-x-3">
          <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
          <h2 className="text-[11px] font-black text-red-400 uppercase tracking-widest italic text-nowrap">Surgery Terminal</h2>
        </div>
        <div className="flex items-center space-x-4">
           <div className="flex space-x-1 p-1 bg-black/40 border border-red-900/20 rounded-xl">
             <button onClick={() => navigateTo(0)} className="px-3 py-1.5 rounded-lg text-[9px] font-black uppercase italic text-red-500 hover:bg-red-500/10 transition-all">START</button>
             <button onClick={() => navigateTo(data.length - 1)} className="px-3 py-1.5 rounded-lg text-[9px] font-black uppercase italic text-red-500 hover:bg-red-500/10 transition-all">END</button>
           </div>
           <form onSubmit={handleJump} className="flex items-center space-x-2 bg-black/60 border border-red-900/30 rounded-xl px-2 py-1 focus-within:border-red-500/50 transition-all group">
             <span className="text-[10px] text-red-900 font-black italic">GOTO:</span>
             <input type="text" placeholder="0xADDR" className="bg-transparent border-none text-[10px] font-mono text-red-500 w-16 outline-none placeholder:text-red-950 uppercase" value={jumpAddr} onChange={e => setJumpAddr(e.target.value)} />
             <button type="submit" className="p-1 text-red-500 hover:text-white transition-colors">
               <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
             </button>
           </form>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 overflow-hidden p-6 font-mono text-[13px] relative flex justify-center" ref={scrollRef}>
          <div className="w-full max-w-[960px]">
            {/* Header Row */}
            <div className={`${GRID_LAYOUT} mb-4 text-[10px] text-red-500 font-black uppercase italic tracking-widest px-2 items-center`}>
              <div className="text-right pr-2">Offset</div>
              <div className={`${HEX_GRID_LAYOUT} px-2`}>
                {Array.from({ length: 16 }).map((_, i) => (
                  <span key={i} className="text-center block select-none">{i.toString(16).toUpperCase()}</span>
                ))}
              </div>
              <div className="flex items-center justify-center px-2">
                <span className="opacity-60 select-none">ASCII</span>
              </div>
            </div>

            <div className="space-y-[1px]">
              {Array.from({ length: rowsPerPage }).map((_, rowIdx) => {
                const rowOffset = offset + (rowIdx * bytesPerRow);
                const isOutOfBounds = rowOffset >= data.length;
                const rowData = isOutOfBounds ? new Uint8Array(bytesPerRow).fill(0) : data.slice(rowOffset, rowOffset + bytesPerRow);

                return (
                  <div key={rowIdx} className={`${GRID_LAYOUT} group transition-opacity duration-300 px-2 ${isOutOfBounds ? 'opacity-10' : 'opacity-100'} items-center`}>
                    <div className="text-red-700 font-bold text-right select-none py-1 pr-2">
                      {isOutOfBounds ? '------' : toAddr(rowOffset)}
                    </div>
                    
                    <div className={`${HEX_GRID_LAYOUT} bg-black/10 group-hover:bg-red-500/5 rounded transition-colors px-2 py-1`}>
                      {Array.from({ length: 16 }).map((_, colIdx) => {
                        const addr = rowOffset + colIdx;
                        const byte = rowData[colIdx];
                        const byteOutOfBounds = addr >= data.length;
                        const isDefined = definedAddresses.has(addr);
                        const isPrimary = initialOffset === addr;

                        return (
                          <input 
                            key={colIdx}
                            disabled={byteOutOfBounds}
                            className={`w-full text-center bg-transparent border-none focus:bg-red-600 focus:text-white outline-none rounded transition-all cursor-text selection:bg-red-500 hover:text-white font-mono
                              ${byteOutOfBounds ? 'text-red-950/20 cursor-default' : 
                                isPrimary ? 'bg-red-900/60 text-white ring-1 ring-red-500 shadow-xl z-20 scale-110' : 
                                isDefined ? 'bg-cyan-400/20 text-cyan-300 ring-1 ring-cyan-500/40 font-black shadow-[0_0_8px_rgba(34,211,238,0.2)]' : 
                                'text-slate-300'}`}
                            value={byteOutOfBounds ? '--' : toHex(byte)}
                            onChange={(e) => {
                              if (byteOutOfBounds) return;
                              const val = parseInt(e.target.value.slice(-2), 16);
                              if (!isNaN(val)) onUpdateByte(addr, val);
                            }}
                            maxLength={2}
                          />
                        );
                      })}
                    </div>

                    <div className="text-slate-400 font-mono tracking-tighter flex items-center justify-between select-none px-4 py-1 bg-black/5 rounded">
                      {Array.from({ length: 16 }).map((_, i) => {
                        const byte = rowData[i];
                        const addr = rowOffset + i;
                        const byteOutOfBounds = addr >= data.length;
                        const isDefined = definedAddresses.has(addr);
                        return (
                          <span key={i} className={`w-[1ch] text-center ${byteOutOfBounds ? 'text-slate-800/20' : 
                            initialOffset === addr ? 'text-red-500 font-bold scale-125' : 
                            isDefined ? 'text-cyan-400 font-black drop-shadow-[0_0_2px_rgba(34,211,238,0.5)]' : ''}`}>
                            {byteOutOfBounds ? '.' : (byte >= 32 && byte <= 126 ? String.fromCharCode(byte) : '.')}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Forensic Multi-Column Minimap Sidebar */}
        <div className="w-16 bg-black/60 border-l border-red-900/20 relative group/minimap overflow-hidden shrink-0 flex flex-col p-1">
          <div className="grid grid-cols-4 gap-[1px] flex-1">
            {minimapBlocks.map((block, i) => (
              <div 
                key={i} 
                onMouseEnter={() => setHoveredBlock(i)}
                onMouseLeave={() => setHoveredBlock(null)}
                onClick={() => navigateTo(block.start)}
                className={`w-full h-full transition-all duration-200 cursor-crosshair border border-transparent
                  ${block.isInViewport ? 'border-white/40 bg-white/10' : ''}
                  ${hoveredBlock === i ? 'scale-[1.15] z-30 border-red-500/50 bg-red-500/10' : ''}
                  ${block.hasMap ? 'bg-cyan-400/90 shadow-[0_0_6px_rgba(34,211,238,0.5)]' : 
                    block.hasData ? 'bg-red-900/40' : 'bg-slate-900/30'}`} 
                title={block.start !== undefined ? `0x${toAddr(block.start)}` : ''}
              />
            ))}
          </div>

          {/* Hover Address Preview */}
          {hoveredBlock !== null && (
            <div className="absolute bottom-2 left-0 right-0 text-center pointer-events-none">
               <span className="text-[8px] font-black text-red-500 bg-black/80 px-1 py-0.5 rounded border border-red-900/40">
                 0x{toAddr(minimapBlocks[hoveredBlock].start)}
               </span>
            </div>
          )}
        </div>
      </div>

      <footer className="p-4 bg-red-950/10 border-t border-red-900/20 text-[9px] text-red-700 font-black uppercase italic tracking-widest flex justify-between shrink-0">
         <div className="flex space-x-4">
           <span>Surgery Live @ 0x{toAddr(offset)}</span>
           <span className="text-red-900 opacity-40">/</span>
           <span className="text-cyan-600">Minimap: Forensic Block Interaction</span>
         </div>
         <div className="flex items-center space-x-2">
            <span className="text-red-900/40">GEO_RADAR::ACTIVE</span>
         </div>
      </footer>
    </div>
  );
};

export default ManualHexEditor;
