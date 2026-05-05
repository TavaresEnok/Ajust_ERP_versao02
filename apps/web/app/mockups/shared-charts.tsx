import React from 'react';

const cn = (...c: any[]) => c.filter(Boolean).join(' ');

// Pure SVG Line Chart (Lightweight, No dependencies)
export const SvgLineChart = ({ data, color = '#3b82f6', height = 200 }: { data: number[]; color?: string; height?: number }) => {
  if (!data || data.length === 0) return <div style={{ height }} className="flex items-center justify-center text-slate-500 text-sm">Sem dados</div>;
  
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const padding = 20;
  
  const points = data.map((val, i) => {
    const x = (i / (data.length - 1)) * 100;
    const y = 100 - (((val - min) / range) * 100);
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg width="100%" height={height} viewBox={`0 -${padding} 100 ${100 + padding * 2}`} preserveAspectRatio="none" className="overflow-visible">
      {/* Grid Lines */}
      {[0, 25, 50, 75, 100].map(p => (
        <line key={p} x1="0" y1={p} x2="100" y2={p} stroke="currentColor" strokeWidth="0.2" className="text-slate-200 dark:text-slate-800" />
      ))}
      {/* Data Line */}
      <polyline fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" points={points} className="drop-shadow-sm" />
      {/* Data Points */}
      {data.map((val, i) => {
        const x = (i / (data.length - 1)) * 100;
        const y = 100 - (((val - min) / range) * 100);
        return <circle key={i} cx={x} cy={y} r="1.5" fill="white" stroke={color} strokeWidth="1" />;
      })}
    </svg>
  );
};

// Pure SVG Donut Chart
export const SvgDonutChart = ({ size = 150, value, max = 100, color = '#10b981', trackColor = '#e2e8f0', label = '' }: { size?: number, value: number, max?: number, color?: string, trackColor?: string, label?: string }) => {
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const percentage = Math.max(0, Math.min(100, (value / max) * 100));
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg className="transform -rotate-90 w-full h-full" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r={radius} fill="none" stroke={trackColor} strokeWidth="12" />
        <circle cx="50" cy="50" r={radius} fill="none" stroke={color} strokeWidth="12" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset} className="transition-all duration-1000 ease-out" />
      </svg>
      <div className="absolute flex flex-col items-center justify-center text-center">
        <span className="text-2xl font-black" style={{ color }}>{value}</span>
        {label && <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-1">{label}</span>}
      </div>
    </div>
  );
};

// Pure SVG Bar Chart
export const SvgBarChart = ({ data, color = '#6366f1', height = 150 }: { data: {label: string, value: number}[], color?: string, height?: number }) => {
  if (!data || data.length === 0) return null;
  const max = Math.max(...data.map(d => d.value)) || 1;
  
  return (
    <div style={{ height }} className="flex items-end gap-2 pt-4">
      {data.map((item, i) => {
        const h = Math.max(5, (item.value / max) * 100);
        return (
          <div key={i} className="flex-1 flex flex-col items-center group relative h-full justify-end">
            {/* Tooltip */}
            <div className="opacity-0 group-hover:opacity-100 absolute -top-8 bg-slate-800 text-white text-xs py-1 px-2 rounded font-bold transition-opacity whitespace-nowrap z-10 pointer-events-none">
              {item.value}
            </div>
            {/* Bar */}
            <div className="w-full rounded-t-sm transition-all duration-500 hover:brightness-110" style={{ height: `${h}%`, backgroundColor: color }} />
            {/* Label */}
            <span className="text-[9px] text-slate-500 mt-2 truncate w-full text-center font-semibold">{item.label}</span>
          </div>
        );
      })}
    </div>
  );
};
