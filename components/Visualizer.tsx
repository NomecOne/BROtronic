
import React, { useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface VisualizerProps {
  data: number[][];
  xAxis: number[];
  yAxis: number[];
}

const Visualizer: React.FC<VisualizerProps> = ({ data, xAxis, yAxis }) => {
  const is1DVertical = data.length > 1 && data[0].length === 1;
  const is1DHorizontal = data.length === 1 && data[0].length > 1;

  const chartData = useMemo(() => {
    if (is1DVertical) {
      return yAxis.map((val, r) => ({
        index: val,
        value: data[r][0]
      }));
    } else if (is1DHorizontal) {
      return xAxis.map((val, c) => ({
        index: val,
        value: data[0][c]
      }));
    } else {
      return xAxis.map((xVal, c) => {
        const entry: any = { index: xVal };
        data.forEach((row, r) => {
          entry[`row_${r}`] = row[c];
        });
        return entry;
      });
    }
  }, [data, xAxis, yAxis, is1DVertical, is1DHorizontal]);

  return (
    <div className="h-64 bg-slate-950 rounded-lg border border-slate-800 p-2">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData}>
          <defs>
            <linearGradient id="colorVal" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
          <XAxis 
            dataKey="index" 
            stroke="#94a3b8" 
            fontSize={10} 
            // Better tick formatting for decimal axes like Voltage
            tickFormatter={(v) => typeof v === 'number' ? (v % 1 === 0 ? v.toString() : v.toFixed(2)) : v}
          />
          <YAxis 
            stroke="#94a3b8" 
            fontSize={10} 
            domain={['auto', 'auto']}
            tickFormatter={(v) => typeof v === 'number' ? (v > 1000 ? (v/1000).toFixed(1) + 'k' : v.toFixed(0)) : v}
          />
          <Tooltip 
            contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', fontSize: '12px' }}
            itemStyle={{ color: '#f1f5f9' }}
            formatter={(value: number) => [value.toFixed(2), "Value"]}
            labelFormatter={(label) => `Input: ${label}`}
          />
          {is1DVertical || is1DHorizontal ? (
            <Area 
              type="monotone" 
              dataKey="value" 
              stroke="#3b82f6" 
              fillOpacity={1} 
              fill="url(#colorVal)" 
              strokeWidth={2}
              isAnimationActive={false}
            />
          ) : (
            data.map((_, r) => (
              <Area 
                key={r}
                type="monotone" 
                dataKey={`row_${r}`} 
                stroke="#3b82f6" 
                fillOpacity={0.1} 
                fill="#3b82f6" 
                strokeWidth={1}
                isAnimationActive={false}
              />
            ))
          )}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

export default Visualizer;
