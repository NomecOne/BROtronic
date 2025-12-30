
import React from 'react';

interface HexGridProps {
  data: Uint8Array;
  offset: number;
  bytesPerRow: number;
  rowsPerPage: number;
  hoveredAddr: number | null;
  selection: { start: number, end: number } | null;
  onMouseDown: (addr: number) => void;
  onMouseEnter: (addr: number) => void;
  discoveryLibrary: any[];
  activeDiscoveryId: string | null;
}

const HexGrid: React.FC<HexGridProps> = ({ 
  data, offset, bytesPerRow, rowsPerPage, 
  hoveredAddr, selection, onMouseDown, onMouseEnter,
  discoveryLibrary, activeDiscoveryId
}) => {
  const toHex = (n: number) => n.toString(16).padStart(2, '0').toUpperCase();
  const toAddr = (n: number) => n.toString(16).padStart(4, '0').toUpperCase();

  return (
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
                      onMouseDown={() => onMouseDown(addr)}
                      onMouseEnter={() => onMouseEnter(addr)}
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
  );
};

export default HexGrid;
