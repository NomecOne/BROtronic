
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { DMEMap } from '../types';

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

  // Minimap Settings - Reduced rows by half and increased width to make squares 2x larger
  const MINIMAP_COLS = 4;
  const MINIMAP_ROWS = 60; 
  const totalBlocks = MINIMAP_COLS * MINIMAP_ROWS;

  const minimapBlocks = useMemo(() => {
    if (!data) return [];
    const blocks = [];
    const blockSize = Math.ceil(data.length / totalBlocks);
    
    for (let i = 0; i < totalBlocks; i++) {
      const start = i * blockSize;
      const end = start + blockSize;
      
      // Check if any map overlaps this block
      const hasMap = detectedMaps?.some(map => {
        const mapSize = (map.rows * map.cols * (map.dataSize / 8));
        const mapEnd = map.offset + mapSize;
        return (map.offset < end && mapEnd > start);
      });

      // Check for non-zero data (density)
      let density = 0;
      const limit = Math.min(end, data.length);
      for (let j = start; j < limit; j += Math.max(1, Math.floor(blockSize / 8))) {
        if (data[j] !== 0) { density++; break; }
      }

      blocks.push({ hasMap, hasData: density > 0, start });
    }
    return blocks;
  }, [data, detectedMaps, totalBlocks]);

  const handleMinimapClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!data) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const ratio = y / rect.height;
    const targetAddr = Math.floor(ratio * data.length);
    navigateTo(targetAddr);
  };

  if (!data) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-slate-900 border-2 border-dashed border-red-900/20 rounded-3xl p-12 text-center">
        <div className="w-20 h-20 bg-red-600/10 rounded-full flex items-center justify-center mb-6 border border-red-500/20">
          <svg className="w-10 h-10 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
        </div>
        <h3 className="text-xl font-black text-red-400 uppercase tracking-widest italic">Binary Surgery Terminal Offline</h3>
        <p className="text-slate-500 mt-2 text-sm max-w-xs">Manual hex manipulation requires an active binary context. Load a ROM to begin direct byte surgery.</p>
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
             <input 
               type="text" 
               placeholder="0xADDR" 
               className="bg-transparent border-none text-[10px] font-mono text-red-500 w-16 outline-none placeholder:text-red-950" 
               value={jumpAddr}
               onChange={e => setJumpAddr(e.target.value)}
             />
             <button type="submit" className="p-1 text-red-500 hover:text-white transition-colors">
               <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
             </button>
           </form>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Main Editor Surface */}
        <div className="flex-1 overflow-hidden p-6 font-mono text-[13px] relative flex justify-center" ref={scrollRef}>
          <div className="inline-block">
            {/* Header Row */}
            <div className="grid grid-cols-[auto_auto_auto] gap-x-[1ch] mb-4 text-[10px] text-red-900 font-black uppercase italic tracking-widest">
              <div className="text-right">Address</div>
              <div className="flex gap-x-[1ch] justify-between">
                {Array.from({ length: 16 }).map((_, i) => <span key={i} className="w-[2ch] text-center">{i.toString(16).toUpperCase()}</span>)}
              </div>
              <div className="text-center px-2">ASCII</div>
            </div>

            <div className="space-y-[1px]">
              {Array.from({ length: rowsPerPage }).map((_, rowIdx) => {
                const rowOffset = offset + (rowIdx * bytesPerRow);
                const isOutOfBounds = rowOffset >= data.length;
                const rowData = isOutOfBounds ? new Uint8Array(bytesPerRow).fill(0) : data.slice(rowOffset, rowOffset + bytesPerRow);

                return (
                  <div key={rowIdx} className={`grid grid-cols-[auto_auto_auto] gap-x-[1ch] group transition-opacity duration-300 ${isOutOfBounds ? 'opacity-10' : 'opacity-100'}`}>
                    {/* Address Col */}
                    <div className="text-red-900 font-bold text-right select-none">{isOutOfBounds ? '------' : toAddr(rowOffset)}</div>
                    
                    {/* Hex Col */}
                    <div className="flex gap-x-[1ch] items-center bg-black/10 group-hover:bg-red-500/5 rounded transition-colors px-1">
                      {Array.from({ length: 16 }).map((_, colIdx) => {
                        const addr = rowOffset + colIdx;
                        const byte = rowData[colIdx];
                        const byteOutOfBounds = addr >= data.length;

                        return (
                          <input 
                            key={colIdx}
                            disabled={byteOutOfBounds}
                            className={`w-[2ch] text-center bg-transparent border-none focus:bg-red-600 focus:text-white outline-none rounded transition-all cursor-text selection:bg-red-500 hover:text-white
                              ${byteOutOfBounds ? 'text-red-950/20 cursor-default' : 
                                initialOffset === addr ? 'bg-red-900/40 text-white ring-1 ring-red-500 shadow-xl z-10' : 'text-slate-300'}`}
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

                    {/* ASCII Col */}
                    <div className="text-red-950 font-mono tracking-tighter flex items-center justify-between select-none">
                      {Array.from({ length: 16 }).map((_, i) => {
                        const byte = rowData[i];
                        const addr = rowOffset + i;
                        const byteOutOfBounds = addr >= data.length;
                        return (
                          <span key={i} className={`w-[1ch] text-center ${byteOutOfBounds ? 'text-red-950/10' : initialOffset === addr ? 'text-red-500 font-bold scale-125' : ''}`}>
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

        {/* High-Density Structural Minimap - Width increased to w-16 for 2x square size */}
        <div 
          className="w-16 bg-black/60 border-l border-red-900/20 cursor-crosshair relative group/minimap overflow-hidden shrink-0 flex flex-col p-1 gap-[1px]"
          onClick={handleMinimapClick}
          title="Geography Radar"
        >
          <div className="grid grid-cols-4 gap-[1.5px] flex-1">
            {minimapBlocks.map((block, i) => (
              <div 
                key={i}
                className={`w-full h-full rounded-[1px] transition-colors duration-300
                  ${block.hasMap ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.4)]' : block.hasData ? 'bg-red-900/40' : 'bg-red-950/10'}`}
              />
            ))}
          </div>

          {/* Viewport Indicator Overlay */}
          <div 
            className="absolute left-0 right-0 bg-white/20 border-y border-white/50 z-20 pointer-events-none transition-all duration-75 shadow-[0_0_20px_rgba(255,255,255,0.25)]"
            style={{ 
              top: `${(offset / data.length) * 100}%`, 
              height: `${Math.max(4, (viewWindow / data.length) * 100)}%`,
            }}
          />
        </div>
      </div>

      <footer className="p-4 bg-red-950/10 border-t border-red-900/20 text-[9px] text-red-700 font-black uppercase italic tracking-widest flex justify-between shrink-0">
         <div className="flex space-x-4">
           <span>Surgery Live @ 0x{toAddr(offset)}</span>
           <span className="text-red-900 opacity-40">/</span>
           <span>File Size: {(data.length / 1024).toFixed(0)}KB</span>
         </div>
         <div className="flex items-center space-x-2">
            <span className="text-red-900/40">GEO_RADAR::ACTIVE</span>
            <span className="w-1 h-1 bg-red-900/40 rounded-full"></span>
            <span>Checksum Correction: MANUAL</span>
         </div>
      </footer>
    </div>
  );
};

export default ManualHexEditor;
