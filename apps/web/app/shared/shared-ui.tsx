'use client';

import React from 'react';

/* ═══════════════════════════ cn helper ═══════════════════════════ */
export const cn = (...classes: Array<string | false | null | undefined>) =>
  classes.filter(Boolean).join(' ');

/* ═══════════════════════════ ERPBadge ═══════════════════════════ */

type BadgeColor =
  | 'green'
  | 'blue'
  | 'red'
  | 'orange'
  | 'slate'
  | 'purple'
  | 'cyan'
  | 'emerald'
  | 'amber';

const BADGE_COLOR_MAP: Record<BadgeColor, string> = {
  green: 'bg-[#dcfce7] text-[#166534] border-[#bbf7d0]',
  emerald: 'bg-[#dcfce7] text-[#166534] border-[#bbf7d0]',
  blue: 'bg-[#dbeafe] text-[#1d4ed8] border-[#bfdbfe]',
  red: 'bg-[#fee2e2] text-[#991b1b] border-[#fecaca]',
  orange: 'bg-[#ffedd5] text-[#9a3412] border-[#fed7aa]',
  amber: 'bg-[#fef3c7] text-[#92400e] border-[#fde68a]',
  slate: 'bg-[#f3f4f6] text-[#4b5563] border-[#e5e7eb]',
  purple: 'bg-[#ede9fe] text-[#5b21b6] border-[#ddd6fe]',
  cyan: 'bg-[#cffafe] text-[#155e75] border-[#a5f3fc]',
};

const BADGE_COLOR_MAP_DARK: Record<BadgeColor, string> = {
  green: 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400',
  emerald: 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400',
  blue: 'bg-blue-500/10 border-blue-500/25 text-blue-400',
  red: 'bg-rose-500/10 border-rose-500/25 text-rose-400',
  orange: 'bg-orange-500/10 border-orange-500/25 text-orange-400',
  amber: 'bg-amber-500/10 border-amber-500/25 text-amber-400',
  slate: 'bg-slate-500/10 border-slate-500/25 text-slate-400',
  purple: 'bg-purple-500/10 border-purple-500/25 text-purple-400',
  cyan: 'bg-cyan-500/10 border-cyan-500/25 text-cyan-400',
};

export function ErpBadge({
  children,
  color = 'slate',
  dark = false,
  className,
}: {
  children: React.ReactNode;
  color?: BadgeColor;
  dark?: boolean;
  className?: string;
}) {
  const palette = dark ? BADGE_COLOR_MAP_DARK : BADGE_COLOR_MAP;
  return (
    <span
      className={cn(
        'px-2.5 py-0.5 rounded-full text-xs font-medium border whitespace-nowrap',
        palette[color] || palette.slate,
        className,
      )}
    >
      {children}
    </span>
  );
}

/* ═══════════════════════════ ErpSidebarItem ═══════════════════════════ */

export function ErpSidebarItem({
  icon: Icon,
  label,
  active = false,
  onClick,
  compact = false,
  iconSize = 18,
  className,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  active?: boolean;
  onClick?: () => void;
  compact?: boolean;
  iconSize?: number;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-3 px-4 py-2.5 rounded-[10px] text-left transition-colors min-h-10',
        active
          ? 'bg-white/[0.07] text-white border border-white/10'
          : 'text-[var(--sidebar-text)] hover:bg-[var(--sidebar-hover)] hover:text-white',
        className,
      )}
    >
      <Icon
        size={iconSize}
        className={active ? 'text-[var(--sidebar-accent)]' : 'text-[var(--sidebar-text)]'}
      />
      {!compact && !!label && <span className="text-sm font-medium">{label}</span>}
    </button>
  );
}

/* ═══════════════════════════ Status Badge ═══════════════════════════ */

const STATUS_STYLE_MAP: Record<string, { bg: string; border: string; text: string; dot: string }> =
  {
    Aberta: {
      bg: 'bg-[#eff6ff]',
      border: 'border-[#bfdbfe]',
      text: 'text-[#1d4ed8]',
      dot: 'bg-[#2563eb]',
    },
    'Em execução': {
      bg: 'bg-[#ecfeff]',
      border: 'border-[#a5f3fc]',
      text: 'text-[#0e7490]',
      dot: 'bg-[#0891b2]',
    },
    'Em Analise': {
      bg: 'bg-[#ecfeff]',
      border: 'border-[#a5f3fc]',
      text: 'text-[#0e7490]',
      dot: 'bg-[#0891b2]',
    },
    Pendente: {
      bg: 'bg-[#fffbeb]',
      border: 'border-[#fde68a]',
      text: 'text-[#92400e]',
      dot: 'bg-[#d97706]',
    },
    Encerrada: {
      bg: 'bg-[#f0fdf4]',
      border: 'border-[#bbf7d0]',
      text: 'text-[#166534]',
      dot: 'bg-[#16a34a]',
    },
    Fechada: {
      bg: 'bg-[#f0fdf4]',
      border: 'border-[#bbf7d0]',
      text: 'text-[#166534]',
      dot: 'bg-[#16a34a]',
    },
    Cancelada: {
      bg: 'bg-[#fef2f2]',
      border: 'border-[#fecaca]',
      text: 'text-[#991b1b]',
      dot: 'bg-[#dc2626]',
    },
    'Ag. Campo': {
      bg: 'bg-[#fff7ed]',
      border: 'border-[#fed7aa]',
      text: 'text-[#9a3412]',
      dot: 'bg-[#ea580c]',
    },
    'Ag. Terceiros': {
      bg: 'bg-[#eef2ff]',
      border: 'border-[#c7d2fe]',
      text: 'text-[#3730a3]',
      dot: 'bg-[#4f46e5]',
    },
    Resolvida: {
      bg: 'bg-[#f0fdfa]',
      border: 'border-[#99f6e4]',
      text: 'text-[#0f766e]',
      dot: 'bg-[#0d9488]',
    },
  };

export function ErpStatusBadge({ status, className }: { status: string; className?: string }) {
  const s = STATUS_STYLE_MAP[status] || STATUS_STYLE_MAP.Aberta;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-[0.02em] border whitespace-nowrap',
        s.bg,
        s.border,
        s.text,
        className,
      )}
    >
      <span className={cn('w-1.5 h-1.5 rounded-full', s.dot)} />
      {status}
    </span>
  );
}

/* ═══════════════════════════ KPI Card ═══════════════════════════ */

export function ErpKpiCard({
  label,
  value,
  icon: Icon,
  gradient,
  subtitle,
  dark = true,
  iconClassName,
  iconContainerClassName,
}: {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ size?: number; className?: string; strokeWidth?: number }>;
  gradient?: string;
  subtitle?: React.ReactNode;
  dark?: boolean;
  iconClassName?: string;
  iconContainerClassName?: string;
}) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-[18px] p-5 flex items-start justify-between transition-all duration-150 group',
        'hover:shadow-md',
        dark
          ? 'bg-[#161b22] border border-white/5'
          : 'bg-white border border-[var(--border-default)] shadow-sm',
      )}
    >
      {gradient && (
        <div
          className={cn(
            'absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500',
            gradient,
          )}
        />
      )}
      <div className="relative z-10">
        <p
          className={cn(
            'text-[11px] font-medium tracking-[0.02em] mb-2 uppercase',
            dark ? 'text-slate-500' : 'text-[var(--text-secondary)]',
          )}
        >
          {label}
        </p>
        <p
          className={cn(
            'text-[36px] leading-10 font-bold tabular-nums tracking-[-0.04em]',
            dark ? 'text-white' : 'text-[var(--text-primary)]',
          )}
        >
          {value}
        </p>
        {subtitle && (
          <p
            className={cn(
              'text-[11px] mt-1.5 flex items-center gap-1',
              dark ? 'text-slate-500' : 'text-slate-400',
            )}
          >
            {subtitle}
          </p>
        )}
      </div>
      <div
        className={cn(
          'relative z-10 p-2.5 rounded-[10px] border',
          iconContainerClassName ||
            (dark
              ? 'bg-white/[0.04] border-transparent'
              : 'bg-[var(--accent-50)] border-[var(--border-light)]'),
        )}
      >
        <Icon
          size={22}
          className={iconClassName || cn(dark ? 'text-slate-400' : 'text-slate-500')}
          strokeWidth={2}
        />
      </div>
    </div>
  );
}

/* ═══════════════════════════ Skeleton ═══════════════════════════ */

export function ErpSkeleton({
  rows = 4,
  dark = true,
  className,
}: {
  rows?: number;
  dark?: boolean;
  className?: string;
}) {
  return (
    <div className={cn('space-y-4', className)}>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className={cn('rounded-xl h-12 animate-pulse', dark ? 'bg-white/[0.04]' : 'bg-slate-100')}
        />
      ))}
    </div>
  );
}

export function ErpSkeletonCards({ count = 4, dark = true }: { count?: number; dark?: boolean }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className={cn(
            'rounded-[18px] h-28 animate-pulse',
            dark
              ? 'bg-[#161b22] border border-white/[0.06]'
              : 'bg-white border border-[var(--border-default)] shadow-sm',
          )}
        >
          <div className="p-5 space-y-3">
            <div className={cn('h-3 w-20 rounded', dark ? 'bg-white/[0.06]' : 'bg-slate-100')} />
            <div className={cn('h-8 w-14 rounded', dark ? 'bg-white/[0.06]' : 'bg-slate-100')} />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ═══════════════════════════ Empty State ═══════════════════════════ */

export function ErpEmptyState({
  icon: Icon,
  title = 'Nenhum registro encontrado.',
  description,
  action,
  dark = true,
  className,
}: {
  icon?: React.ComponentType<{ size?: number; className?: string }>;
  title?: string;
  description?: string;
  action?: React.ReactNode;
  dark?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center py-16 px-6 text-center',
        dark ? 'text-slate-500' : 'text-slate-400',
        className,
      )}
    >
      {Icon && (
        <Icon
          size={36}
          className={cn('mb-4 opacity-40', dark ? 'text-slate-600' : 'text-slate-300')}
        />
      )}
      <p className={cn('text-sm font-medium mb-1', dark ? 'text-slate-400' : 'text-slate-500')}>
        {title}
      </p>
      {description && (
        <p className={cn('text-xs', dark ? 'text-slate-600' : 'text-slate-400')}>{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/* ═══════════════════════════ Modal ═══════════════════════════ */

export function ErpModal({
  title,
  subtitle,
  badge,
  children,
  onClose,
  actions,
  maxWidth = 'max-w-2xl',
  dark = true,
}: {
  title: string;
  subtitle?: string;
  badge?: React.ReactNode;
  children: React.ReactNode;
  onClose: () => void;
  actions?: React.ReactNode;
  maxWidth?: string;
  dark?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/35 backdrop-blur-[8px] animate-fade-in">
      <div
        className={cn(
          'w-full rounded-[24px] shadow-2xl overflow-hidden border',
          maxWidth,
          dark ? 'bg-[#11151c] border-white/10' : 'bg-white border-[var(--border-default)]',
        )}
      >
        <div
          className={cn(
            'p-6 flex items-start justify-between border-b',
            dark ? 'border-white/5' : 'border-slate-100',
          )}
        >
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h2
                className={cn(
                  'text-xl font-bold tracking-tight',
                  dark ? 'text-white' : 'text-slate-900',
                )}
              >
                {title}
              </h2>
              {badge}
            </div>
            {subtitle && (
              <p className={cn('text-xs', dark ? 'text-slate-500' : 'text-slate-400')}>
                {subtitle}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className={cn(
              'p-1.5 rounded-lg transition-colors',
              dark
                ? 'text-slate-500 hover:text-white hover:bg-white/5'
                : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100',
            )}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto custom-scrollbar">
          {children}
        </div>
        {actions && (
          <div
            className={cn(
              'px-6 py-4 flex justify-start gap-3 border-t',
              dark ? 'border-white/5' : 'border-slate-100',
            )}
          >
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════ Toast ═══════════════════════════ */

type ToastType = 'info' | 'success' | 'error' | 'warning';

const TOAST_STYLES: Record<ToastType, { dark: string; light: string; icon: string }> = {
  info: {
    dark: 'bg-[#161b22] border-blue-500/30 text-white',
    light: 'bg-white border-blue-200 text-slate-800',
    icon: 'ℹ️',
  },
  success: {
    dark: 'bg-emerald-950/90 border-emerald-500/40 text-emerald-100',
    light: 'bg-emerald-50 border-emerald-300 text-emerald-900',
    icon: '✓',
  },
  error: {
    dark: 'bg-rose-950/90 border-rose-500/40 text-rose-100',
    light: 'bg-rose-50 border-rose-300 text-rose-900',
    icon: '✕',
  },
  warning: {
    dark: 'bg-amber-950/90 border-amber-500/40 text-amber-100',
    light: 'bg-amber-50 border-amber-300 text-amber-900',
    icon: '⚠',
  },
};

const TOAST_ICON_COLOR: Record<ToastType, string> = {
  info: 'text-blue-400',
  success: 'text-emerald-400',
  error: 'text-rose-400',
  warning: 'text-amber-400',
};

const TOAST_BAR_COLOR: Record<ToastType, string> = {
  info: 'bg-blue-500',
  success: 'bg-emerald-500',
  error: 'bg-rose-500',
  warning: 'bg-amber-500',
};

export function ErpToast({
  message,
  dark = true,
  type = 'info',
  duration = 2500,
}: {
  message: string;
  dark?: boolean;
  type?: ToastType;
  duration?: number;
}) {
  if (!message) return null;
  const styles = TOAST_STYLES[type] || TOAST_STYLES.info;
  return (
    <div
      className={cn(
        'fixed bottom-5 right-5 z-[95] min-w-[260px] max-w-sm rounded-[14px] text-sm shadow-2xl backdrop-blur-md animate-slide-up border overflow-hidden',
        dark ? styles.dark : styles.light,
      )}
    >
      <div className="flex items-start gap-3 px-4 py-3">
        <span className={cn('text-base font-bold shrink-0 mt-px', TOAST_ICON_COLOR[type])}>
          {styles.icon}
        </span>
        <span className="flex-1 leading-snug">{message}</span>
      </div>
      <div className="relative h-[3px] w-full overflow-hidden opacity-60">
        <div
          className={cn('absolute left-0 top-0 h-full', TOAST_BAR_COLOR[type])}
          style={{ animation: `toastBar ${duration}ms linear forwards` }}
        />
      </div>
    </div>
  );
}

/* ═══════════════════════════ Form Field ═══════════════════════════ */

export function ErpFormField({
  label,
  required = false,
  error,
  children,
  dark = true,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
  dark?: boolean;
}) {
  return (
    <div>
      <label
        className={cn(
          'text-[10px] uppercase tracking-widest font-bold mb-1.5 block',
          dark ? 'text-slate-500' : 'text-slate-400',
        )}
      >
        {label}
        {required && <span className="text-rose-400 ml-0.5">*</span>}
      </label>
      {children}
      {error && <p className="text-[11px] text-rose-400 mt-1">{error}</p>}
    </div>
  );
}

/* ═══════════════════════════ Data Table ═══════════════════════════ */

type ErpDataTableColumn<T> = {
  key: string;
  header: React.ReactNode;
  className?: string;
  cellClassName?: string;
  render: (row: T) => React.ReactNode;
};

export function ErpDataTable<T>({
  columns,
  rows,
  rowKey,
  onRowClick,
  emptyTitle = 'Nao existem dados nessa lista.',
  emptyDescription,
  dark = true,
  className,
}: {
  columns: Array<ErpDataTableColumn<T>>;
  rows: T[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  emptyTitle?: string;
  emptyDescription?: string;
  dark?: boolean;
  className?: string;
}) {
  return (
    <div className={cn('overflow-x-auto custom-scrollbar', className)}>
      <table className="w-full text-left">
        <thead>
          <tr
            className={cn(
              'border-b text-[11px] font-medium uppercase tracking-[0.02em]',
              dark
                ? 'border-white/5 text-slate-500'
                : 'border-[var(--border-light)] text-[var(--text-secondary)]',
            )}
          >
            {columns.map((column) => (
              <th key={column.key} className={cn('px-6 py-3', column.className)}>
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody
          className={cn(dark ? 'divide-y divide-white/5' : 'divide-y divide-[var(--border-light)]')}
        >
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-6 py-10">
                <ErpEmptyState dark={dark} title={emptyTitle} description={emptyDescription} />
              </td>
            </tr>
          ) : (
            rows.map((row) => {
              const key = rowKey(row);
              return (
                <tr
                  key={key}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={cn(
                    'min-h-[52px]',
                    onRowClick && 'cursor-pointer transition-colors',
                    onRowClick && (dark ? 'hover:bg-white/[0.04]' : 'hover:bg-[var(--bg-hover)]'),
                  )}
                >
                  {columns.map((column) => (
                    <td
                      key={`${key}-${column.key}`}
                      className={cn('px-6 py-3.5', column.cellClassName)}
                    >
                      {column.render(row)}
                    </td>
                  ))}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}

/* ═══════════════════════════ CSS Animations ═══════════════════════════ */

export const SHARED_CSS = `
  @keyframes fadeIn{from{opacity:0}to{opacity:1}}
  .animate-fade-in{animation:fadeIn .2s ease}
  @keyframes slideUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
  .animate-slide-up{animation:slideUp .25s ease}
  @keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}
  .animate-pulse{animation:pulse 2s cubic-bezier(.4,0,.6,1) infinite}
  @keyframes toastBar{from{width:100%}to{width:0}}
  @keyframes spin{to{transform:rotate(360deg)}}
  .animate-spin{animation:spin 1s linear infinite}
  .custom-scrollbar::-webkit-scrollbar{width:6px;height:6px}
  .custom-scrollbar::-webkit-scrollbar-track{background:transparent}
  .custom-scrollbar::-webkit-scrollbar-thumb{border-radius:3px}
`;
