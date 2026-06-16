import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

interface KPICardProps {
  label: string;
  value: string;
  delta?: string;
  trend?: 'up' | 'down';
  icon: LucideIcon;
  className?: string;
}

export function KPICard({ label, value, delta, trend, icon: Icon, className }: KPICardProps) {
  return (
    <div
      className={cn(
        'bg-white rounded-xl shadow-sm border border-[rgba(0,0,0,0.06)] p-5',
        className,
      )}
    >
      <div className="flex items-start justify-between mb-3">
        <span className="text-xs font-medium text-content-secondary uppercase tracking-wide">
          {label}
        </span>
        <Icon className="w-4 h-4 text-content-tertiary" />
      </div>
      <div className="text-[28px] font-bold text-content-primary tabular-nums tracking-[-0.03em] leading-none mb-2">
        {value}
      </div>
      {delta && (
        <div className="flex items-center gap-1">
          <span
            className={cn(
              'text-xs font-medium',
              trend === 'up'
                ? 'text-[#16a34a]'
                : trend === 'down'
                  ? 'text-[#dc2626]'
                  : 'text-content-tertiary',
            )}
          >
            {trend === 'up' ? '↑' : trend === 'down' ? '↓' : ''} {delta}
          </span>
          <span className="text-2xs text-content-tertiary">vs período anterior</span>
        </div>
      )}
    </div>
  );
}
