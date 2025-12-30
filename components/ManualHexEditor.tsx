
import React, { useState, useEffect } from 'react';

interface ManualHexEditorProps {
  data?: Uint8Array;
  onUpdateByte: (offset: number, value: number) => void;
  onFileUpload?: (file: File) => void;
  initialOffset?: number;
}

const ManualHexEditor: React.FC<ManualHexEditorProps> = ({ data, onUpdateByte, onFileUpload, initialOffset }) => {
  const [offset, setOffset] = useState(0);
  const rowsPerPage = 32;
  const bytesPerRow = 16;

  useEffect(() => {
    if (initialOffset !== undefined) {
      // Align to row start
      const aligned = Math.floor(initialOffset / bytesPerRow) * bytesPerRow;
      setOffset(Math.max(0, aligned));
    }
  }, [initialOffset]);

  const handleScroll = (e: React.WheelEvent) => {
    if (!data) return;
    if (e.deltaY > 0) {
      setOffset(prev => Math.min(data.length - (rowsPerPage * bytesPerRow), prev + bytesPerRow));
    } else {
      setOffset(prev => Math.max(0, prev - bytesPerRow));
    }
  };

  const toHex = (n: number) => n.toString(16).padStart(2, '0').toUpperCase();
  const toAddr = (n: number) => n.toString(16).padStart(4, '0').toUpperCase();

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
      <header className="p-4 bg-red-950/20 border-b border-red-900/40 flex justify-between items-center">
        <div className="flex items-center space-x-3">
          <div className="w-2 h-2 bg-red-500 rounded-full animate-ping"></div>
          <h2 className="text-[11px] font-black text-red-400 uppercase tracking-widest italic">Binary Surgery Terminal (Direct Access)</h2>
        </div>
        <div className="text-[9px] text-red-900 font-black uppercase tracking-[0.3em] italic">Use Extreme Caution</div>
      </header>

      <div className="flex-1 overflow-hidden p-6 font-mono text-[13px]">
        <div className="grid grid-cols-[80px_1fr_180px] gap-x-8 mb-4 text-[10px] text-red-900 font-black uppercase italic tracking-widest">
          <div>Address</div>
          <div className="flex justify-between px-2">
            {Array.from({ length: 16 }).map((_, i) => <span key={i} className="w-7 text-center">{i.toString(16).toUpperCase()}</span>)}
          </div>
          <div className="text-center">ASCII Data</div>
        </div>

        <div className="space-y-1">
          {Array.from({ length: rowsPerPage }).map((_, rowIdx) => {
            const rowOffset = offset + (rowIdx * bytesPerRow);
            if (rowOffset >= data.length) return null;
            const rowData = data.slice(rowOffset, rowOffset + bytesPerRow);

            return (
              <div key={rowIdx} className="grid grid-cols-[80px_1fr_180px] gap-x-8 py-0.5">
                <div className="text-red-900 font-bold">{toAddr(rowOffset)}</div>
                <div className="flex justify-between px-2">
                  {Array.from({ length: 16 }).map((_, colIdx) => {
                    const addr = rowOffset + colIdx;
                    const byte = rowData[colIdx];
                    return (
                      <input 
                        key={colIdx}
                        className={`w-7 text-center bg-transparent border-none focus:bg-red-600 focus:text-white outline-none rounded transition-all cursor-text selection:bg-red-500 hover:text-white
                          ${initialOffset === addr ? 'bg-red-900/40 text-white ring-1 ring-red-500 shadow-xl scale-110 z-10' : 'text-slate-300'}`}
                        value={toHex(byte)}
                        onChange={(e) => {
                          const val = parseInt(e.target.value.slice(-2), 16);
                          if (!isNaN(val)) onUpdateByte(addr, val);
                        }}
                        maxLength={2}
                      />
                    );
                  })}
                </div>
                <div className="text-red-950 font-mono tracking-tighter flex justify-between">
                  {Array.from({ length: 16 }).map((_, i) => {
                    const byte = rowData[i];
                    return <span key={i} className={initialOffset === (rowOffset + i) ? 'text-red-500 font-bold scale-125' : ''}>{byte >= 32 && byte <= 126 ? String.fromCharCode(byte) : '.'}</span>;
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <footer className="p-4 bg-red-950/10 border-t border-red-900/20 text-[9px] text-red-700 font-black uppercase italic tracking-widest flex justify-between">
         <span>Surgery Live @ 0x{toAddr(offset)}</span>
         <span>Checksum Correction: MANUAL / EXTERNAL</span>
      </footer>
    </div>
  );
};

export default ManualHexEditor;
