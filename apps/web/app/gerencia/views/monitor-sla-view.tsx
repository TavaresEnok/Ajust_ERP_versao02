'use client';
/* eslint-disable react-hooks/exhaustive-deps */
import React, { useEffect, useState, useCallback } from 'react';
import {
  ShieldAlert,
  Clock,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  Timer,
  Zap,
  Eye,
} from 'lucide-react';

type SlaBreachOrder = {
  id: string;
  protocol: string;
  title: string;
  type: string;
  priority: string;
  status: string;
  analystName: string | null;
  deadlineAt: string;
  createdAt: string;
  delayMinutes?: number;
};

type SlaSummary = {
  total: number;
  breached: number;
  atRisk: number;
  onTime: number;
  breachRate: number;
};

type ManagerKpi = {
  overview: {
    totalOpen: number;
    totalClosed: number;
    slaBreaches: number;
  };
  performanceByAnalyst: Array<{
    name: string;
    open: number;
    closed: number;
    slaBreaches: number;
    tmrHours: number;
  }>;
};

const PRIORITY_COLORS: Record<string, string> = {
  CRITICA: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
  ALTA: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
  NORMAL: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  BAIXA: 'bg-slate-500/15 text-slate-400 border-slate-500/30',
};

const STATUS_LABELS: Record<string, string> = {
  ABERTA: 'Aberta',
  EM_ANALISE: 'Em Análise',
  AG_CAMPO: 'Ag. Campo',
  AG_TERCEIROS: 'Ag. Terceiros',
  RESOLVIDA: 'Resolvida',
  FECHADA: 'Fechada',
  CANCELADA: 'Cancelada',
};

function cn(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(' ');
}

function formatDelay(minutes: number): string {
  if (minutes < 60) return `${Math.round(minutes)}min`;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h < 24) return m > 0 ? `${h}h ${m}min` : `${h}h`;
  const d = Math.floor(h / 24);
  const rh = h % 24;
  return rh > 0 ? `${d}d ${rh}h` : `${d}d`;
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getDelayMinutes(order: SlaBreachOrder): number {
  if (order.delayMinutes != null) return order.delayMinutes;
  return Math.max(0, (Date.now() - new Date(order.deadlineAt).getTime()) / 60000);
}

export function MonitorSlaView({
  dark,
  tenantId,
  onToast,
}: {
  dark: boolean;
  tenantId: string;
  onToast: (m: string) => void;
}) {
  const [breaches, setBreaches] = useState<SlaBreachOrder[]>([]);
  const [kpi, setKpi] = useState<ManagerKpi | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedPriority, setSelectedPriority] = useState('Todas');
  const [sortBy, setSortBy] = useState<'delay' | 'priority' | 'deadline'>('delay');

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [breachRes, kpiRes] = await Promise.all([
        fetch(`/api/sla/breaches?tenantId=${encodeURIComponent(tenantId)}`, { cache: 'no-store' }),
        fetch(`/api/reports/manager-kpi?tenantId=${encodeURIComponent(tenantId)}`, {
          cache: 'no-store',
        }),
      ]);

      const [breachData, kpiData] = await Promise.all([
        breachRes.ok ? breachRes.json().catch(() => []) : [],
        kpiRes.ok ? kpiRes.json().catch(() => null) : null,
      ]);

      setBreaches(Array.isArray(breachData) ? breachData : []);
      setKpi(kpiData);
    } catch {
      const msg = 'Falha ao carregar dados de SLA.';
      setLoadError(msg);
      onToast(msg);
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    if (tenantId) load();
  }, [tenantId]);

  const filtered = React.useMemo(() => {
    let list = [...breaches];
    if (selectedPriority !== 'Todas') list = list.filter((o) => o.priority === selectedPriority);
    if (sortBy === 'delay') list.sort((a, b) => getDelayMinutes(b) - getDelayMinutes(a));
    if (sortBy === 'priority') {
      const order = ['CRITICA', 'ALTA', 'NORMAL', 'BAIXA'];
      list.sort((a, b) => order.indexOf(a.priority) - order.indexOf(b.priority));
    }
    if (sortBy === 'deadline')
      list.sort((a, b) => new Date(a.deadlineAt).getTime() - new Date(b.deadlineAt).getTime());
    return list;
  }, [breaches, selectedPriority, sortBy]);

  const summary: SlaSummary = React.useMemo(() => {
    const total = kpi?.overview.totalOpen ?? 0;
    const breached = breaches.length;
    const atRisk = 0; // pode ser calculado se houver dados
    const onTime = Math.max(0, total - breached - atRisk);
    const breachRate = total > 0 ? Math.round((breached / total) * 100) : 0;
    return { total, breached, atRisk, onTime, breachRate };
  }, [breaches, kpi]);

  const panelCls = cn(
    'rounded-xl border',
    dark ? 'bg-slate-800/40 border-slate-700/50' : 'bg-white border-slate-200',
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2
            className={cn(
              'text-2xl font-bold flex items-center gap-2',
              dark ? 'text-white' : 'text-slate-800',
            )}
          >
            <ShieldAlert size={24} className="text-rose-500" />
            Monitor de SLA
          </h2>
          <p className={cn('text-sm mt-0.5', dark ? 'text-slate-400' : 'text-slate-500')}>
            Ordens com SLA violado em tempo real. Atualiza a cada refresh.
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className={cn(
            'px-4 py-2 rounded-lg border text-sm font-semibold transition-colors flex items-center gap-2 disabled:opacity-50',
            dark
              ? 'border-slate-700 text-slate-400 hover:bg-slate-800'
              : 'border-slate-200 text-slate-600 hover:bg-slate-50',
          )}
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Atualizar
        </button>
      </div>

      {loadError && (
        <div
          className={cn(
            'rounded-xl border px-4 py-3 text-sm',
            dark
              ? 'bg-rose-900/20 border-rose-700/40 text-rose-300'
              : 'bg-rose-50 border-rose-200 text-rose-700',
          )}
        >
          {loadError}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: 'OS Abertas',
            value: loading ? '—' : String(summary.total),
            icon: <Clock size={18} />,
            color: dark ? 'text-blue-400' : 'text-blue-600',
          },
          {
            label: 'SLA Violado',
            value: loading ? '—' : String(summary.breached),
            icon: <ShieldAlert size={18} />,
            color: 'text-rose-500',
          },
          {
            label: 'Taxa de Breach',
            value: loading ? '—' : `${summary.breachRate}%`,
            icon: <TrendingUp size={18} />,
            color:
              summary.breachRate > 20
                ? 'text-rose-500'
                : dark
                  ? 'text-emerald-400'
                  : 'text-emerald-600',
          },
          {
            label: 'Fechadas (30d)',
            value: loading ? '—' : String(kpi?.overview.totalClosed ?? 0),
            icon: <CheckCircle2 size={18} />,
            color: dark ? 'text-emerald-400' : 'text-emerald-600',
          },
        ].map((card, i) => (
          <div key={i} className={cn(panelCls, 'p-5 flex flex-col gap-2')}>
            <div
              className={cn(
                'flex items-center gap-2 text-xs uppercase font-bold tracking-wider',
                dark ? 'text-slate-500' : 'text-slate-400',
              )}
            >
              <span className={card.color}>{card.icon}</span>
              {card.label}
            </div>
            <div className={cn('text-3xl font-black', card.color)}>
              {loading ? <span className="skeleton-box w-12 h-8 block" /> : card.value}
            </div>
          </div>
        ))}
      </div>

      {/* Filtros + Tabela de Breaches */}
      <div
        className={cn(
          'rounded-xl border overflow-hidden',
          dark ? 'bg-slate-800/40 border-slate-700/50' : 'bg-white border-slate-200',
        )}
      >
        {/* Toolbar */}
        <div
          className={cn(
            'px-5 py-3 border-b flex flex-wrap items-center justify-between gap-3',
            dark ? 'bg-slate-800/60 border-slate-700/50' : 'bg-slate-50 border-slate-200',
          )}
        >
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} className="text-rose-500" />
            <span className={cn('font-bold text-sm', dark ? 'text-white' : 'text-slate-800')}>
              Ordens com SLA Violado{!loading && ` (${filtered.length})`}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={selectedPriority}
              onChange={(e) => setSelectedPriority(e.target.value)}
              className={cn(
                'text-xs px-2 py-1.5 rounded-lg border',
                dark
                  ? 'bg-slate-700 border-slate-600 text-slate-200'
                  : 'border-slate-300 text-slate-700',
              )}
            >
              {['Todas', 'CRITICA', 'ALTA', 'NORMAL', 'BAIXA'].map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'delay' | 'priority' | 'deadline')}
              className={cn(
                'text-xs px-2 py-1.5 rounded-lg border',
                dark
                  ? 'bg-slate-700 border-slate-600 text-slate-200'
                  : 'border-slate-300 text-slate-700',
              )}
            >
              <option value="delay">Maior atraso</option>
              <option value="priority">Prioridade</option>
              <option value="deadline">Prazo</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr
                className={cn(
                  'border-b text-[10px] uppercase font-bold tracking-wider text-left',
                  dark
                    ? 'border-slate-700 text-slate-500 bg-slate-800/60'
                    : 'border-slate-100 text-slate-400 bg-slate-50',
                )}
              >
                <th className="px-5 py-3">Protocolo</th>
                <th className="px-5 py-3">Título</th>
                <th className="px-5 py-3">Tipo</th>
                <th className="px-5 py-3 text-center">Prioridade</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Analista</th>
                <th className="px-5 py-3">Prazo</th>
                <th className="px-5 py-3 text-right text-rose-500">Atraso</th>
              </tr>
            </thead>
            <tbody className={cn('divide-y', dark ? 'divide-slate-700/50' : 'divide-slate-100')}>
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 8 }).map((__, j) => (
                      <td key={j} className="px-5 py-3">
                        <div className="skeleton-box w-full h-4" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-14 text-center">
                    <CheckCircle2
                      size={32}
                      className={cn('mx-auto mb-2', dark ? 'text-emerald-600' : 'text-emerald-400')}
                    />
                    <p
                      className={cn(
                        'text-sm font-medium',
                        dark ? 'text-emerald-400' : 'text-emerald-600',
                      )}
                    >
                      Nenhuma violação de SLA encontrada!
                    </p>
                    <p className={cn('text-xs mt-1', dark ? 'text-slate-500' : 'text-slate-400')}>
                      {selectedPriority !== 'Todas'
                        ? `Sem breaches para prioridade ${selectedPriority}.`
                        : 'Todas as ordens estão dentro do prazo.'}
                    </p>
                  </td>
                </tr>
              ) : (
                filtered.map((order, idx) => {
                  const delayMin = getDelayMinutes(order);
                  const isCritical = order.priority === 'CRITICA';
                  return (
                    <tr
                      key={order.id}
                      className={cn(
                        'animate-stagger transition-colors',
                        isCritical && (dark ? 'bg-rose-900/10' : 'bg-rose-50/50'),
                        dark ? 'hover:bg-white/[0.02]' : 'hover:bg-slate-50',
                      )}
                      style={{ animationDelay: `${idx * 0.03}s` }}
                    >
                      <td className="px-5 py-3">
                        <span
                          className={cn(
                            'font-mono font-bold text-xs',
                            dark ? 'text-slate-300' : 'text-slate-700',
                          )}
                        >
                          {order.protocol}
                        </span>
                      </td>
                      <td className="px-5 py-3 max-w-[200px]">
                        <span
                          className={cn(
                            'text-xs truncate block',
                            dark ? 'text-slate-300' : 'text-slate-700',
                          )}
                          title={order.title}
                        >
                          {order.title}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <span
                          className={cn(
                            'text-xs px-2 py-0.5 rounded font-medium',
                            dark ? 'bg-slate-700 text-slate-300' : 'bg-slate-100 text-slate-600',
                          )}
                        >
                          {order.type?.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-center">
                        <span
                          className={cn(
                            'text-xs px-2 py-0.5 rounded-md border font-bold',
                            PRIORITY_COLORS[order.priority] || PRIORITY_COLORS.NORMAL,
                          )}
                        >
                          {order.priority}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <span className={cn('text-xs', dark ? 'text-slate-400' : 'text-slate-600')}>
                          {STATUS_LABELS[order.status] || order.status}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <span className={cn('text-xs', dark ? 'text-slate-400' : 'text-slate-600')}>
                          {order.analystName || (
                            <span className="text-slate-400 italic">Não atribuído</span>
                          )}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <span
                          className={cn(
                            'text-xs font-mono',
                            dark ? 'text-slate-400' : 'text-slate-500',
                          )}
                        >
                          {formatDateTime(order.deadlineAt)}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <span
                          className={cn(
                            'text-xs font-bold font-mono',
                            delayMin > 120 ? 'text-rose-500' : 'text-orange-500',
                          )}
                        >
                          +{formatDelay(delayMin)}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Performance por Analista */}
      {kpi && kpi.performanceByAnalyst.length > 0 && (
        <div
          className={cn(
            'rounded-xl border overflow-hidden',
            dark ? 'bg-slate-800/40 border-slate-700/50' : 'bg-white border-slate-200',
          )}
        >
          <div
            className={cn(
              'px-5 py-3 border-b flex items-center gap-2',
              dark ? 'bg-slate-800/60 border-slate-700/50' : 'bg-slate-50 border-slate-200',
            )}
          >
            <Zap size={15} className={dark ? 'text-indigo-400' : 'text-indigo-600'} />
            <span className={cn('font-bold text-sm', dark ? 'text-white' : 'text-slate-800')}>
              Performance por Analista — Últimos 30 dias
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr
                  className={cn(
                    'border-b text-[10px] uppercase font-bold tracking-wider text-left',
                    dark
                      ? 'border-slate-700 text-slate-500 bg-slate-800/60'
                      : 'border-slate-100 text-slate-400 bg-slate-50',
                  )}
                >
                  <th className="px-5 py-3">Analista</th>
                  <th className="px-5 py-3 text-center">Abertas</th>
                  <th className="px-5 py-3 text-center">Fechadas</th>
                  <th className="px-5 py-3 text-center text-rose-500">Breaches</th>
                  <th className="px-5 py-3 text-right">TMA</th>
                </tr>
              </thead>
              <tbody className={cn('divide-y', dark ? 'divide-slate-700/50' : 'divide-slate-100')}>
                {kpi.performanceByAnalyst
                  .sort((a, b) => b.slaBreaches - a.slaBreaches)
                  .map((analyst, idx) => (
                    <tr
                      key={analyst.name}
                      className={cn(
                        'animate-stagger transition-colors',
                        dark ? 'hover:bg-white/[0.02]' : 'hover:bg-slate-50',
                      )}
                      style={{ animationDelay: `${0.3 + idx * 0.04}s` }}
                    >
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <div
                            className={cn(
                              'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold',
                              dark
                                ? 'bg-indigo-500/20 text-indigo-300'
                                : 'bg-indigo-100 text-indigo-700',
                            )}
                          >
                            {analyst.name.charAt(0).toUpperCase()}
                          </div>
                          <span
                            className={cn(
                              'font-medium text-sm',
                              dark ? 'text-slate-200' : 'text-slate-800',
                            )}
                          >
                            {analyst.name}
                          </span>
                        </div>
                      </td>
                      <td
                        className={cn(
                          'px-5 py-3 text-center font-mono',
                          dark ? 'text-blue-400' : 'text-blue-600',
                        )}
                      >
                        {analyst.open}
                      </td>
                      <td
                        className={cn(
                          'px-5 py-3 text-center font-mono',
                          dark ? 'text-emerald-400' : 'text-emerald-600',
                        )}
                      >
                        {analyst.closed}
                      </td>
                      <td className="px-5 py-3 text-center">
                        <span
                          className={cn(
                            'font-mono font-bold text-sm',
                            analyst.slaBreaches > 0
                              ? 'text-rose-500'
                              : dark
                                ? 'text-emerald-400'
                                : 'text-emerald-600',
                          )}
                        >
                          {analyst.slaBreaches}
                        </span>
                      </td>
                      <td
                        className={cn(
                          'px-5 py-3 text-right font-mono text-xs',
                          dark ? 'text-slate-400' : 'text-slate-600',
                        )}
                      >
                        {analyst.tmrHours > 0 ? `${analyst.tmrHours}h` : '—'}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Legenda */}
      <div
        className={cn(
          'rounded-xl border px-5 py-4 flex flex-wrap gap-4 items-center',
          dark ? 'bg-slate-800/20 border-slate-700/30' : 'bg-slate-50 border-slate-200',
        )}
      >
        <div className="flex items-center gap-1.5">
          <Eye size={13} className={dark ? 'text-slate-500' : 'text-slate-400'} />
          <span className={cn('text-xs', dark ? 'text-slate-500' : 'text-slate-500')}>
            Exibindo apenas ordens com status ativo e prazo vencido. Ordens fechadas/canceladas não
            aparecem.
          </span>
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <Timer size={13} className={dark ? 'text-slate-500' : 'text-slate-400'} />
          <span className={cn('text-xs', dark ? 'text-slate-500' : 'text-slate-400')}>
            Atraso calculado desde o deadline original.
          </span>
        </div>
      </div>
    </div>
  );
}
