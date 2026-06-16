import { cn } from '@/lib/utils';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'neutral';
  size?: 'sm' | 'md';
  className?: string;
  dot?: boolean;
}

const variantStyles = {
  default: 'bg-accent-subtle text-accent-DEFAULT',
  success: 'bg-[#f0fdf4] text-[#16a34a]',
  warning: 'bg-[#fffbeb] text-[#d97706]',
  danger: 'bg-[#fef2f2] text-[#dc2626]',
  info: 'bg-[#eff6ff] text-[#2563eb]',
  neutral: 'bg-bg-subtle text-content-secondary',
};

const dotColors = {
  default: 'bg-accent-DEFAULT',
  success: 'bg-[#16a34a]',
  warning: 'bg-[#d97706]',
  danger: 'bg-[#dc2626]',
  info: 'bg-[#2563eb]',
  neutral: 'bg-content-tertiary',
};

export function Badge({
  children,
  variant = 'default',
  size = 'sm',
  className,
  dot = false,
}: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 font-medium rounded-full',
        variantStyles[variant],
        size === 'sm' ? 'px-2.5 py-0.5 text-2xs' : 'px-3 py-1 text-xs',
        className,
      )}
    >
      {dot && <span className={cn('w-1.5 h-1.5 rounded-full', dotColors[variant])} />}
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { variant: BadgeProps['variant']; label: string }> = {
    ABERTA: { variant: 'info', label: 'Aberta' },
    EM_ANALISE: { variant: 'warning', label: 'Em Análise' },
    AG_CAMPO: { variant: 'warning', label: 'Ag. Campo' },
    EM_EXECUCAO: { variant: 'info', label: 'Em Execução' },
    AG_TERCEIROS: { variant: 'neutral', label: 'Ag. Terceiros' },
    RESOLVIDA: { variant: 'success', label: 'Resolvida' },
    FECHADA: { variant: 'neutral', label: 'Fechada' },
    CANCELADA: { variant: 'danger', label: 'Cancelada' },
  };
  const cfg = config[status] || { variant: 'neutral' as const, label: status };
  return (
    <Badge variant={cfg.variant} dot>
      {cfg.label}
    </Badge>
  );
}

export function PriorityBadge({ priority }: { priority: string }) {
  const config: Record<string, { color: string; bg: string; label: string }> = {
    CRITICA: { color: '#dc2626', bg: '#fee2e2', label: 'Crítica' },
    ALTA: { color: '#ea580c', bg: '#ffedd5', label: 'Alta' },
    NORMAL: { color: '#2563eb', bg: '#dbeafe', label: 'Normal' },
    BAIXA: { color: '#6b7280', bg: '#f3f4f6', label: 'Baixa' },
  };
  const cfg = config[priority] || config.NORMAL;
  return (
    <span
      className="inline-flex items-center gap-1.5 text-2xs font-medium rounded-full px-2.5 py-0.5"
      style={{ backgroundColor: cfg.bg, color: cfg.color }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: cfg.color }} />
      {cfg.label}
    </span>
  );
}

export function SLABadge({ status }: { status: string }) {
  const config: Record<string, { variant: BadgeProps['variant']; label: string }> = {
    ok: { variant: 'success', label: 'No Prazo' },
    risk: { variant: 'warning', label: 'Em Risco' },
    breach: { variant: 'danger', label: 'Quebrado' },
  };
  const cfg = config[status] || config.ok;
  return (
    <Badge variant={cfg.variant} dot>
      {cfg.label}
    </Badge>
  );
}
