
import React, { useMemo, useState } from 'react';
import { ROMFile, DMEMap } from '../../types';

interface ParserViewerProps {
  rom: ROMFile;
  onJumpToMap?: (mapId: string) => void;
}

const PageID = ({ id }: { id: string }) => (
  <div className="absolute top-2 right-2 z-[100] pointer-events-none select-none">
    <span className="text-[9px] font-mono font-black text-emerald-400 bg-black px-2 py-0.5 rounded border border-emerald-500/50 tracking-wider">
      DIAG_NODE::{id}
    </span>
  </div>
);

const ParserViewer: React.FC<ParserViewerProps> = ({ rom, onJumpToMap }) => {
  const [hoveredMapId, setHoveredMapId] = useState<string | null>(null);

  // Minimap logic: Calculate map byte spans
  const mapSpans = useMemo(() => {
    return rom.detectedMaps.map(m => {
      const byteSize = m.rows * m.cols * (m.dataSize / 8);
      const axisXSize = m.xAxis?.source === 'ROM Address' ? (m.xAxis.size * (m.xAxis.dataSize / 8)) : 0;
      const axisYSize = m.yAxis?.source === 'ROM Address' ? (m.yAxis.size * (m.yAxis.dataSize / 8)) : 0;
      
      const spans = [{ start: m.offset, end: m.offset + byteSize, type: 'data' }];
      if (m.xAxis?.source === 'ROM Address') spans.push({ start: m.xAxis.offset, end: m.xAxis.offset + axisXSize, type: 'axis' });
      if (m.yAxis?.source === 'ROM Address') spans.push({ start: m.yAxis.offset, end: m.yAxis.offset + axisYSize, type: 'axis' });
      
      return { id: m.id, name: m.name, spans };
    });
  }, [rom.detectedMaps]);

  // Render Minimap
  // We divide the ROM into blocks for performance and visualization
  // For 32KB/64KB, we can use a grid. Let's do 128 blocks wide.
  const blockSize = 64; // bytes per block
  const totalBlocks = Math.ceil(rom.size / blockSize);
  const blocksPerRow = 64;
  const rows = Math.ceil(totalBlocks / blocksPerRow);

  const getBlockStatus = (blockIdx: number) => {
    const blockStart = blockIdx * blockSize;
    const blockEnd = blockStart + blockSize;

    for (const m of mapSpans) {
      for (const span of m.spans) {
        if (span.start < blockEnd && span.end > blockStart) {
          return { mapId: m.id, type: span.type };
        }
      }
    }
    return null;
  };

  return (
    <div className="flex-1 flex flex-col p-6 space-y-6 overflow-hidden relative z-10">
      <PageID id="07" />
      
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6 flex-1 min-h-0">
        
        {/* Left Section: Minimap & Binary Statistics */}
        <div className="flex flex-col space-y-6 min-w-0">
          
          <div className="bg-slate-900/40 border border-slate-800 p-6 rounded-3xl flex flex-col space-y-4 shadow-inner backdrop-blur-md">
            <div className="flex justify-between items-center border-b border-slate-800 pb-4">
              <h3 className="text-xs font-black text-emerald-400 uppercase tracking-widest italic flex items-center">
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" /></svg>
                Memory Distribution Minimap
              </h3>
              <div className="flex space-x-4 text-[9px] font-black uppercase tracking-tighter italic">
                <div className="flex items-center text-emerald-500"><div className="w-2 h-2 bg-emerald-500 rounded-sm mr-1"></div> Map Data</div>
                <div className="flex items-center text-amber-500"><div className="w-2 h-2 bg-amber-500 rounded-sm mr-1"></div> Axis Reference</div>
                <div className="flex items-center text-slate-700"><div className="w-2 h-2 bg-slate-800 rounded-sm mr-1"></div> Empty/Code</div>
              </div>
            </div>

            <div className="flex-1 overflow-auto bg-black/40 rounded-2xl p-4 border border-slate-800 shadow-inner custom-scrollbar">
              <div 
                className="grid gap-px" 
                style={{ gridTemplateColumns: `repeat(${blocksPerRow}, 1fr)` }}
              >
                {Array.from({ length: totalBlocks }).map((_, i) => {
                  const status = getBlockStatus(i);
                  const isHovered = status?.mapId === hoveredMapId;
                  const addr = i * blockSize;

                  return (
                    <div 
                      key={i}
                      title={`Offset: 0x${addr.toString(16).toUpperCase()}${status ? ` - ${status.mapId}` : ''}`}
                      className={`aspect-square rounded-[1px] transition-all duration-300
                        ${status?.type === 'data' ? (isHovered ? 'bg-emerald-400 scale-125 z-10 shadow-[0_0_10px_rgba(52,211,153,0.5)]' : 'bg-emerald-600/60') : 
                          status?.type === 'axis' ? (isHovered ? 'bg-amber-400 scale-125 z-10 shadow-[0_0_10px_rgba(251,191,36,0.5)]' : 'bg-amber-600/40') : 
                          'bg-slate-900 hover:bg-slate-800'}`}
                      onMouseEnter={() => status && setHoveredMapId(status.mapId)}
                      onMouseLeave={() => setHoveredMapId(null)}
                      onClick={() => status && onJumpToMap?.(status.mapId)}
                    />
                  );
                })}
              </div>
            </div>

            <div className="flex justify-between items-center text-[10px] text-slate-500 font-bold uppercase italic mt-2">
              <span>0x0000</span>
              <div className="flex-1 border-t border-dashed border-slate-800 mx-4" />
              <span>0x{(rom.size - 1).toString(16).toUpperCase()}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
             {[
               { label: 'HW ID', val: rom.version?.hw || 'N/A', icon: 'M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2z' },
               { label: 'SW ID', val: rom.version?.sw || 'N/A', icon: 'M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4' },
               { label: 'LABEL', val: rom.version?.label || 'N/A', icon: 'M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z' },
               { label: 'SIZE', val: `${(rom.size / 1024).toFixed(0)} KB`, icon: 'M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4' }
             ].map((stat, i) => (
               <div key={i} className="bg-slate-900/60 border border-slate-800 p-4 rounded-2xl flex items-center space-x-4">
                  <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-400">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={stat.icon} /></svg>
                  </div>
                  <div>
                    <span className="text-[9px] font-black text-slate-500 uppercase block">{stat.label}</span>
                    <span className="text-xs font-black text-white font-mono">{stat.val}</span>
                  </div>
               </div>
             ))}
          </div>
        </div>

        {/* Right Section: Registry List */}
        <div className="bg-slate-950 border border-slate-800 rounded-3xl flex flex-col overflow-hidden shadow-2xl">
          <div className="p-6 bg-slate-900 border-b border-slate-800">
            <h3 className="text-xs font-black text-white uppercase tracking-widest italic">Parser Registry List</h3>
            <p className="text-[9px] text-slate-500 font-bold uppercase mt-1 italic">{rom.detectedMaps.length} Registered Structures</p>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
            {rom.detectedMaps.map((m) => {
              const isHovered = hoveredMapId === m.id;
              return (
                <button 
                  key={m.id}
                  onClick={() => onJumpToMap?.(m.id)}
                  onMouseEnter={() => setHoveredMapId(m.id)}
                  onMouseLeave={() => setHoveredMapId(null)}
                  className={`w-full text-left p-4 rounded-2xl border transition-all duration-300 group
                    ${isHovered ? 'bg-emerald-600/10 border-emerald-500/50 shadow-lg shadow-emerald-900/10 translate-x-1' : 'bg-slate-900 border-slate-800 hover:border-slate-700'}`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className={`text-xs font-black uppercase italic transition-colors ${isHovered ? 'text-emerald-400' : 'text-white group-hover:text-emerald-300'}`}>
                        {m.name}
                      </h4>
                      <div className="flex items-center space-x-2 mt-1">
                        <span className="text-[9px] font-mono text-slate-500">ADDR: 0x{m.offset.toString(16).toUpperCase()}</span>
                        <span className="text-[9px] font-bold text-slate-600 uppercase">[{m.rows}x{m.cols}]</span>
                      </div>
                    </div>
                    <div className="text-right">
                       <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded transition-colors ${isHovered ? 'bg-emerald-500 text-emerald-950' : 'bg-slate-800 text-slate-500'}`}>
                         {m.dataSize}BIT
                       </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="p-4 bg-slate-900 border-t border-slate-800">
             <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 uppercase italic">
                <span>Auto-Discovery:</span>
                <span className="text-emerald-500 font-black">Active</span>
             </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default ParserViewer;
