
import React, { useState, useRef, useEffect } from 'react';
import { DMEMap } from '../types';
import { ROMParser } from '../services/romParser';

interface MapTableEditorProps {
  map: DMEMap;
  data: number[][];
  xAxis: number[];
  yAxis: number[];
  onUpdate: (r: number, c: number, val: number) => void;
}

const MapTableEditor: React.FC<MapTableEditorProps> = ({ map, data, xAxis, yAxis, onUpdate }) => {
  const [colWidths, setColWidths] = useState<Record<number, number>>({});
  const resizingRef = useRef<{ index: number; startX: number; startWidth: number } | null>(null);

  const getColor = (val: number, min: number, max: number) => {
    if (max === min) return 'bg-slate-800';
    const percent = (val - min) / (max - min);
    if (percent < 0.25) return 'bg-blue-900/40 text-blue-100';
    if (percent < 0.5) return 'bg-green-900/40 text-green-100';
    if (percent < 0.75) return 'bg-orange-900/40 text-orange-100';
    return 'bg-red-900/40 text-red-100';
  };

  const allVals = data.flat();
  const min = Math.min(...allVals);
  const max = Math.max(...allVals);
  const is1DVertical = data.length > 1 && data[0].length === 1;

  const startResizing = (index: number, e: React.MouseEvent) => {
    e.preventDefault();
    const th = (e.target as HTMLElement).parentElement;
    if (!th) return;
    
    resizingRef.current = {
      index,
      startX: e.clientX,
      startWidth: th.offsetWidth
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', stopResizing);
    document.body.style.cursor = 'col-resize';
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!resizingRef.current) return;
    const { index, startX, startWidth } = resizingRef.current;
    const delta = e.clientX - startX;
    const newWidth = Math.max(60, startWidth + delta);
    
    setColWidths(prev => ({
      ...prev,
      [index]: newWidth
    }));
  };

  const stopResizing = () => {
    resizingRef.current = null;
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', stopResizing);
    document.body.style.cursor = 'default';
  };

  const getColStyle = (index: number) => {
    const width = colWidths[index];
    return width ? { width: `${width}px`, minWidth: `${width}px` } : {};
  };

  return (
    <div className="relative bg-slate-950 border border-slate-800 rounded-xl overflow-hidden shadow-2xl flex flex-col h-[500px]">
      <div className="overflow-auto flex-1">
        <table className="w-full text-[11px] mono border-separate border-spacing-0 table-fixed">
          <thead className="sticky top-0 z-20">
            <tr>
              <th 
                style={getColStyle(-1)}
                className="relative p-2 bg-slate-900 border-b border-r border-slate-700 text-slate-500 font-bold uppercase tracking-tighter text-[9px] w-24 sticky left-0 z-30"
              >
                {map.yAxis?.label || 'In'} ({map.yAxis?.unit || 'V'})
                <div 
                  onMouseDown={(e) => startResizing(-1, e)}
                  className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500/50 transition-colors z-40"
                />
              </th>
              {is1DVertical ? (
                <>
                  <th 
                    style={getColStyle(0)}
                    className="relative p-2 bg-slate-900 border-b border-r border-slate-700 text-amber-500 font-bold min-w-[120px]"
                  >
                    RAW (Dec)
                    <div 
                      onMouseDown={(e) => startResizing(0, e)}
                      className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500/50 transition-colors z-40"
                    />
                  </th>
                  <th 
                    style={getColStyle(1)}
                    className="relative p-2 bg-slate-900 border-b border-slate-700 text-blue-400 font-bold min-w-[120px]"
                  >
                    {map.unit || 'Calculated'}
                    <div 
                      onMouseDown={(e) => startResizing(1, e)}
                      className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500/50 transition-colors z-40"
                    />
                  </th>
                </>
              ) : (
                xAxis.map((v, i) => (
                  <th 
                    key={i} 
                    style={getColStyle(i)}
                    className="relative p-2 bg-slate-900 border-b border-slate-700 text-blue-400 font-bold min-w-[100px]"
                  >
                    {v.toFixed(0)} {map.xAxis?.unit}
                    <div 
                      onMouseDown={(e) => startResizing(i, e)}
                      className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500/50 transition-colors z-40"
                    />
                  </th>
                ))
              )}
            </tr>
          </thead>
          <tbody>
            {data.map((row, r) => (
              <tr key={r} className="hover:bg-white/5 transition-colors">
                <td 
                  style={getColStyle(-1)}
                  className="p-2 bg-slate-900 border-r border-b border-slate-800 text-slate-400 font-bold text-center sticky left-0 z-10 shadow-[2px_0_5px_rgba(0,0,0,0.3)] truncate"
                >
                  {yAxis[r] !== undefined ? yAxis[r].toFixed(3) : r}
                </td>
                {is1DVertical ? (
                  <>
                    <td 
                      style={getColStyle(0)}
                      className="p-0 border-b border-r border-slate-800/50"
                    >
                      <input
                        type="number"
                        className="w-full h-full p-2.5 bg-transparent focus:outline-none focus:bg-blue-600 focus:text-white transition-all text-center border-none text-amber-200"
                        value={ROMParser.reverseFormula(map.formula, row[0], map.dataSize)}
                        onChange={(e) => {
                          const raw = parseInt(e.target.value) || 0;
                          const scaled = ROMParser.evaluateFormula(map.formula, raw);
                          onUpdate(r, 0, scaled);
                        }}
                      />
                    </td>
                    <td 
                      style={getColStyle(1)}
                      className={`p-2.5 border-b border-slate-800/50 text-center font-bold truncate ${getColor(row[0], min, max)}`}
                    >
                      {row[0].toFixed(2)}
                    </td>
                  </>
                ) : (
                  row.map((val, c) => (
                    <td 
                      key={c} 
                      style={getColStyle(c)}
                      className="p-0 border-b border-r border-slate-800/50 last:border-r-0"
                    >
                      <input
                        type="number"
                        step="0.01"
                        className={`w-full h-full p-2.5 bg-transparent focus:outline-none focus:bg-blue-600 focus:text-white transition-all text-center border-none ${getColor(val, min, max)}`}
                        value={val}
                        onChange={(e) => onUpdate(r, c, parseFloat(e.target.value) || 0)}
                      />
                    </td>
                  ))
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="p-2 bg-slate-900 border-t border-slate-800 flex justify-between text-[9px] text-slate-500 uppercase tracking-widest font-bold">
        <span>Min: {min.toFixed(2)} {map.unit}</span>
        <span>Map: {map.name}</span>
        <span>Max: {max.toFixed(2)} {map.unit}</span>
      </div>
    </div>
  );
};

export default MapTableEditor;
