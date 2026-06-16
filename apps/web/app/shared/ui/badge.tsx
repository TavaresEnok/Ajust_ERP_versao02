const STATUS_STYLE: Record<string, string> = {
  ABERTA:
    'bg-yellow-100 text-yellow-700 dark:bg-yellow-500/12 dark:text-yellow-300 dark:border-yellow-500/25',
  EM_ANALISE:
    'bg-blue-100 text-blue-700 dark:bg-blue-500/12 dark:text-blue-300 dark:border-blue-500/25',
  AG_CAMPO:
    'bg-orange-100 text-orange-700 dark:bg-orange-500/12 dark:text-orange-300 dark:border-orange-500/25',
  AG_TERCEIROS:
    'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/12 dark:text-indigo-300 dark:border-indigo-500/25',
  RESOLVIDA:
    'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/12 dark:text-emerald-300 dark:border-emerald-500/25',
  FECHADA:
    'bg-gray-100 text-gray-600 dark:bg-slate-500/12 dark:text-slate-300 dark:border-slate-500/25',
  CANCELADA: 'bg-red-100 text-red-600 dark:bg-red-500/12 dark:text-red-300 dark:border-red-500/25',
};

const STATUS_LABEL: Record<string, string> = {
  ABERTA: 'Aberta',
  EM_ANALISE: 'Em Análise',
  AG_CAMPO: 'Ag. Campo',
  AG_TERCEIROS: 'Ag. Terceiros',
  RESOLVIDA: 'Resolvida',
  FECHADA: 'Fechada',
  CANCELADA: 'Cancelada',
};

const PRIORITY_STYLE: Record<string, string> = {
  BAIXA:
    'bg-gray-100 text-gray-600 dark:bg-slate-500/12 dark:text-slate-300 dark:border-slate-500/25',
  NORMAL:
    'bg-blue-100 text-blue-700 dark:bg-blue-500/12 dark:text-blue-300 dark:border-blue-500/25',
  ALTA: 'bg-orange-100 text-orange-700 dark:bg-orange-500/12 dark:text-orange-300 dark:border-orange-500/25',
  CRITICA: 'bg-red-100 text-red-700 dark:bg-red-500/12 dark:text-red-300 dark:border-red-500/25',
};

const SLA_STYLE: Record<string, string> = {
  ok: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/12 dark:text-emerald-300 dark:border-emerald-500/25',
  risk: 'bg-amber-100 text-amber-700 dark:bg-amber-500/12 dark:text-amber-300 dark:border-amber-500/25',
  breach: 'bg-red-100 text-red-700 dark:bg-red-500/12 dark:text-red-300 dark:border-red-500/25',
};

export function StatusBadge({ status, className = '' }: { status: string; className?: string }) {
  const normalized = status
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\./g, '')
    .replace(/\s+/g, '_')
    .toUpperCase();

  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 text-[11px] rounded-full font-semibold border whitespace-nowrap ${STATUS_STYLE[normalized] || 'bg-gray-100 text-gray-600 dark:bg-slate-500/12 dark:text-slate-300 dark:border-slate-500/25'} ${className}`}
    >
      {STATUS_LABEL[normalized] || status}
    </span>
  );
}

export function PriorityBadge({
  priority,
  className = '',
}: {
  priority: string;
  className?: string;
}) {
  const normalized = priority
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();

  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 text-[11px] rounded-full font-semibold border whitespace-nowrap ${PRIORITY_STYLE[normalized] || 'bg-gray-100 text-gray-600 dark:bg-slate-500/12 dark:text-slate-300 dark:border-slate-500/25'} ${className}`}
    >
      {priority}
    </span>
  );
}

export function SLABadge({
  state,
  children,
  className = '',
}: {
  state: 'ok' | 'risk' | 'breach';
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 text-[11px] rounded-full font-semibold border whitespace-nowrap ${SLA_STYLE[state]} ${className}`}
    >
      {children || state.toUpperCase()}
    </span>
  );
}
