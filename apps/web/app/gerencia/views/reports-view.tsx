'use client';
/* eslint-disable react-hooks/exhaustive-deps */
import React, { useEffect, useState, useCallback } from 'react';
import {
  BarChart2,
  TrendingUp,
  Users,
  Clock,
  RefreshCw,
  ArrowRight,
  Award,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';

type FlowNode = {
  status: string;
  total: number;
  overdue: number;
  avgAgeMinutes: number;
  priorityBreakdown: Record<string, number>;
};

type FlowEdge = {
  from: string;
  to: string;
  count: number;
  avgTransitionMinutes: number;
};

type ServiceOrderFlow = {
  nodes: FlowNode[];
  edges: FlowEdge[];
  totalOrders: number;
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

function cn(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(' ');
}

function formatMinutes(minutes: number): string {
  if (!minutes || minutes <= 0) return '—';
  if (minutes < 60) return `${Math.round(minutes)}min`;
  const h = Math.floor(minutes / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

const STATUS_LABELS: Record<string, string> = {
  ABERTA: 'Abertas',
  EM_ANALISE: 'Em Análise',
  AG_CAMPO: 'Ag. Campo',
  AG_TERCEIROS: 'Ag. Terceiros',
  RESOLVIDA: 'Resolvidas',
  FECHADA: 'Fechadas',
  CANCELADA: 'Canceladas',
};

const STATUS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  ABERTA: { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/30' },
  EM_ANALISE: { bg: 'bg-indigo-500/10', text: 'text-indigo-400', border: 'border-indigo-500/30' },
  AG_CAMPO: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/30' },
  AG_TERCEIROS: { bg: 'bg-orange-500/10', text: 'text-orange-400', border: 'border-orange-500/30' },
  RESOLVIDA: { bg: 'bg-teal-500/10', text: 'text-teal-400', border: 'border-teal-500/30' },
  FECHADA: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/30' },
  CANCELADA: { bg: 'bg-slate-500/10', text: 'text-slate-400', border: 'border-slate-500/30' },
};

function getScoreColor(score: number, dark: boolean): string {
  if (score >= 80) return dark ? 'text-emerald-400' : 'text-emerald-600';
  if (score >= 60) return dark ? 'text-amber-400' : 'text-amber-600';
  return 'text-rose-500';
}

export function ReportsView({
  dark,
  tenantId,
  onToast,
}: {
  dark: boolean;
  tenantId: string;
  onToast: (m: string) => void;
}) {
  const [flow, setFlow] = useState<ServiceOrderFlow | null>(null);
  const [kpi, setKpi] = useState<ManagerKpi | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [period, setPeriod] = useState('30d');
  const [activeTab, setActiveTab] = useState<'flow' | 'analysts'>('flow');

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const periodStart =
        period !== 'all'
          ? new Date(Date.now() - parseInt(period) * 86400000).toISOString()
          : undefined;

      const flowUrl = `/api/reports/service-order-flow?tenantId=${encodeURIComponent(tenantId)}${periodStart ? `&periodStart=${periodStart}` : ''}`;
      const kpiUrl = `/api/reports/manager-kpi?tenantId=${encodeURIComponent(tenantId)}`;

      const [flowRes, kpiRes] = await Promise.all([
        fetch(flowUrl, { cache: 'no-store' }),
        fetch(kpiUrl, { cache: 'no-store' }),
      ]);

      const [flowData, kpiData] = await Promise.all([
        flowRes.ok ? flowRes.json().catch(() => null) : null,
        kpiRes.ok ? kpiRes.json().catch(() => null) : null,
      ]);

      setFlow(flowData);
      setKpi(kpiData);
    } catch {
      const msg = 'Falha ao carregar relatórios.';
      setLoadError(msg);
      onToast(msg);
    } finally {
      setLoading(false);
    }
  }, [tenantId, period]);

  useEffect(() => {
    if (tenantId) load();
  }, [tenantId, period]);

  const panelCls = cn(
    'rounded-xl border',
    dark ? 'bg-slate-800/40 border-slate-700/50' : 'bg-white border-slate-200',
  );

  const closureRate = kpi
    ? kpi.overview.totalClosed + kpi.overview.totalOpen > 0
      ? Math.round(
          (kpi.overview.totalClosed / (kpi.overview.totalClosed + kpi.overview.totalOpen)) * 100,
        )
      : 0
    : 0;

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
            <BarChart2 size={24} className="text-indigo-500" />
            Relatórios Operacionais
          </h2>
          <p className={cn('text-sm mt-0.5', dark ? 'text-slate-400' : 'text-slate-500')}>
            Fluxo de ordens de serviço, KPIs e performance por analista.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className={cn(
              'text-sm px-3 py-2 rounded-lg border',
              dark
                ? 'bg-slate-700 border-slate-600 text-slate-200'
                : 'border-slate-300 text-slate-700',
            )}
          >
            <option value="7">Últimos 7 dias</option>
            <option value="30">Últimos 30 dias</option>
            <option value="90">Últimos 90 dias</option>
            <option value="all">Todo o período</option>
          </select>
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
            label: 'Abertas',
            value: loading ? '—' : String(kpi?.overview.totalOpen ?? 0),
            icon: <Clock size={18} />,
            color: dark ? 'text-blue-400' : 'text-blue-600',
          },
          {
            label: 'Fechadas (30d)',
            value: loading ? '—' : String(kpi?.overview.totalClosed ?? 0),
            icon: <CheckCircle2 size={18} />,
            color: dark ? 'text-emerald-400' : 'text-emerald-600',
          },
          {
            label: 'Taxa de Conclusão',
            value: loading ? '—' : `${closureRate}%`,
            icon: <TrendingUp size={18} />,
            color:
              closureRate >= 70
                ? dark
                  ? 'text-emerald-400'
                  : 'text-emerald-600'
                : 'text-rose-500',
          },
          {
            label: 'Breaches de SLA',
            value: loading ? '—' : String(kpi?.overview.slaBreaches ?? 0),
            icon: <AlertTriangle size={18} />,
            color:
              (kpi?.overview.slaBreaches ?? 0) > 0
                ? 'text-rose-500'
                : dark
                  ? 'text-emerald-400'
                  : 'text-emerald-600',
          },
        ].map((card, i) => (
          <div key={i} className={cn(panelCls, 'p-5')}>
            <div
              className={cn(
                'flex items-center gap-2 text-xs uppercase font-bold tracking-wider mb-2',
                dark ? 'text-slate-500' : 'text-slate-400',
              )}
            >
              <span className={card.color}>{card.icon}</span>
              {card.label}
            </div>
            <div className={cn('text-3xl font-black', card.color)}>
              {loading ? <span className="skeleton-box w-16 h-8 block" /> : card.value}
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div
        className="flex gap-1 border-b"
        style={{ borderColor: dark ? 'rgba(51,65,85,0.5)' : '#e2e8f0' }}
      >
        {(
          [
            ['flow', 'Fluxo de Status', BarChart2],
            ['analysts', 'Por Analista', Users],
          ] as const
        ).map(([tab, label, Icon]) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              'flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors',
              activeTab === tab
                ? dark
                  ? 'border-indigo-400 text-indigo-400'
                  : 'border-indigo-600 text-indigo-600'
                : dark
                  ? 'border-transparent text-slate-500 hover:text-slate-300'
                  : 'border-transparent text-slate-500 hover:text-slate-700',
            )}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {/* Tab: Fluxo de Status */}
      {activeTab === 'flow' && (
        <div className="space-y-4">
          {/* Status Nodes Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {loading
              ? Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className={cn(panelCls, 'p-4')}>
                    <div className="skeleton-box w-24 h-4 mb-2" />
                    <div className="skeleton-box w-12 h-8" />
                  </div>
                ))
              : flow?.nodes.map((node) => {
                  const colors = STATUS_COLORS[node.status] || STATUS_COLORS.ABERTA;
                  return (
                    <div key={node.status} className={cn(panelCls, 'p-4 border', colors.border)}>
                      <div
                        className={cn(
                          'text-[10px] uppercase font-bold tracking-wider mb-2',
                          colors.text,
                        )}
                      >
                        {STATUS_LABELS[node.status] || node.status}
                      </div>
                      <div className={cn('text-2xl font-black', colors.text)}>{node.total}</div>
                      <div
                        className={cn(
                          'flex items-center justify-between mt-2 text-xs',
                          dark ? 'text-slate-500' : 'text-slate-400',
                        )}
                      >
                        <span>Idade média: {formatMinutes(node.avgAgeMinutes)}</span>
                        {node.overdue > 0 && (
                          <span className="text-rose-500 font-bold">{node.overdue} atrasadas</span>
                        )}
                      </div>
                      {/* Priority Breakdown mini-bar */}
                      {Object.keys(node.priorityBreakdown).length > 0 && (
                        <div className="mt-2 flex gap-1">
                          {(['CRITICA', 'ALTA', 'NORMAL', 'BAIXA'] as const)
                            .filter((p) => node.priorityBreakdown[p] > 0)
                            .map((p) => (
                              <div
                                key={p}
                                className={cn(
                                  'text-[9px] px-1.5 py-0.5 rounded font-bold',
                                  PRIORITY_MINI[p],
                                )}
                              >
                                {p.charAt(0)}: {node.priorityBreakdown[p]}
                              </div>
                            ))}
                        </div>
                      )}
                    </div>
                  );
                })}
          </div>

          {/* Transições */}
          {!loading && flow && flow.edges.length > 0 && (
            <div
              className={cn(
                'rounded-xl border overflow-hidden',
                dark ? 'bg-slate-800/40 border-slate-700/50' : 'bg-white border-slate-200',
              )}
            >
              <div
                className={cn(
                  'px-5 py-3 border-b font-bold text-sm flex items-center gap-2',
                  dark
                    ? 'bg-slate-800/60 border-slate-700/50 text-slate-200'
                    : 'bg-slate-50 border-slate-200 text-slate-700',
                )}
              >
                <ArrowRight size={15} className={dark ? 'text-indigo-400' : 'text-indigo-600'} />
                Transições de Status — Tempos Médios
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
                      <th className="px-5 py-3">De</th>
                      <th className="px-5 py-3">Para</th>
                      <th className="px-5 py-3 text-center">Ocorrências</th>
                      <th className="px-5 py-3 text-right">Tempo Médio</th>
                    </tr>
                  </thead>
                  <tbody
                    className={cn('divide-y', dark ? 'divide-slate-700/50' : 'divide-slate-100')}
                  >
                    {flow.edges
                      .sort((a, b) => b.count - a.count)
                      .slice(0, 12)
                      .map((edge, i) => (
                        <tr
                          key={i}
                          className={cn(
                            'transition-colors',
                            dark ? 'hover:bg-white/[0.02]' : 'hover:bg-slate-50',
                          )}
                        >
                          <td className="px-5 py-3">
                            <span
                              className={cn(
                                'text-xs px-2 py-1 rounded font-medium',
                                (STATUS_COLORS[edge.from] || STATUS_COLORS.ABERTA).bg,
                                (STATUS_COLORS[edge.from] || STATUS_COLORS.ABERTA).text,
                              )}
                            >
                              {STATUS_LABELS[edge.from] || edge.from}
                            </span>
                          </td>
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-1.5">
                              <ArrowRight
                                size={12}
                                className={dark ? 'text-slate-600' : 'text-slate-400'}
                              />
                              <span
                                className={cn(
                                  'text-xs px-2 py-1 rounded font-medium',
                                  (STATUS_COLORS[edge.to] || STATUS_COLORS.ABERTA).bg,
                                  (STATUS_COLORS[edge.to] || STATUS_COLORS.ABERTA).text,
                                )}
                              >
                                {STATUS_LABELS[edge.to] || edge.to}
                              </span>
                            </div>
                          </td>
                          <td
                            className={cn(
                              'px-5 py-3 text-center font-mono font-bold',
                              dark ? 'text-slate-300' : 'text-slate-700',
                            )}
                          >
                            {edge.count}
                          </td>
                          <td
                            className={cn(
                              'px-5 py-3 text-right font-mono text-xs',
                              dark ? 'text-slate-400' : 'text-slate-600',
                            )}
                          >
                            {formatMinutes(edge.avgTransitionMinutes)}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {!loading && (!flow || flow.totalOrders === 0) && (
            <div
              className={cn(
                'rounded-xl border px-5 py-14 text-center',
                dark ? 'bg-slate-800/40 border-slate-700/50' : 'bg-white border-slate-200',
              )}
            >
              <BarChart2
                size={32}
                className={cn('mx-auto mb-2', dark ? 'text-slate-600' : 'text-slate-300')}
              />
              <p className={cn('text-sm', dark ? 'text-slate-500' : 'text-slate-400')}>
                Nenhum dado de fluxo para o período selecionado.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Tab: Por Analista */}
      {activeTab === 'analysts' && (
        <div
          className={cn(
            'rounded-xl border overflow-hidden',
            dark ? 'bg-slate-800/40 border-slate-700/50' : 'bg-white border-slate-200',
          )}
        >
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
                  <th className="px-5 py-3 text-center">Taxa Fechamento</th>
                  <th className="px-5 py-3 text-center text-rose-500">SLA Breaches</th>
                  <th className="px-5 py-3 text-right">TMA</th>
                  <th className="px-5 py-3 text-center">Score</th>
                </tr>
              </thead>
              <tbody className={cn('divide-y', dark ? 'divide-slate-700/50' : 'divide-slate-100')}>
                {loading
                  ? Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i}>
                        {Array.from({ length: 7 }).map((__, j) => (
                          <td key={j} className="px-5 py-3">
                            <div className="skeleton-box w-full h-4" />
                          </td>
                        ))}
                      </tr>
                    ))
                  : (kpi?.performanceByAnalyst ?? [])
                      .sort((a, b) => b.closed + b.open - (a.closed + a.open))
                      .map((analyst, idx) => {
                        const total = analyst.closed + analyst.open;
                        const rate = total > 0 ? Math.round((analyst.closed / total) * 100) : 0;
                        const score = Math.max(0, Math.min(100, rate - analyst.slaBreaches * 5));
                        return (
                          <tr
                            key={analyst.name}
                            className={cn(
                              'animate-stagger transition-colors',
                              dark ? 'hover:bg-white/[0.02]' : 'hover:bg-slate-50',
                            )}
                            style={{ animationDelay: `${idx * 0.04}s` }}
                          >
                            <td className="px-5 py-3">
                              <div className="flex items-center gap-2.5">
                                <div
                                  className={cn(
                                    'w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold',
                                    dark
                                      ? 'bg-indigo-500/20 text-indigo-300'
                                      : 'bg-indigo-100 text-indigo-700',
                                  )}
                                >
                                  {analyst.name.charAt(0).toUpperCase()}
                                </div>
                                <span
                                  className={cn(
                                    'font-semibold',
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
                                dark ? 'text-blue-400' : 'text-blue-700',
                              )}
                            >
                              {analyst.open}
                            </td>
                            <td
                              className={cn(
                                'px-5 py-3 text-center font-mono',
                                dark ? 'text-emerald-400' : 'text-emerald-700',
                              )}
                            >
                              {analyst.closed}
                            </td>
                            <td className="px-5 py-3 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                <div
                                  className={cn(
                                    'h-1.5 w-16 rounded-full overflow-hidden',
                                    dark ? 'bg-slate-700' : 'bg-slate-200',
                                  )}
                                >
                                  <div
                                    className={cn(
                                      'h-full rounded-full',
                                      rate >= 70
                                        ? 'bg-emerald-500'
                                        : rate >= 40
                                          ? 'bg-amber-500'
                                          : 'bg-rose-500',
                                    )}
                                    style={{ width: `${rate}%` }}
                                  />
                                </div>
                                <span
                                  className={cn(
                                    'text-xs font-bold',
                                    rate >= 70
                                      ? dark
                                        ? 'text-emerald-400'
                                        : 'text-emerald-600'
                                      : 'text-rose-500',
                                  )}
                                >
                                  {rate}%
                                </span>
                              </div>
                            </td>
                            <td className="px-5 py-3 text-center">
                              <span
                                className={cn(
                                  'font-mono font-bold',
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
                            <td className="px-5 py-3 text-center">
                              <div className="flex items-center justify-center">
                                {score >= 80 ? (
                                  <Award
                                    size={16}
                                    className={dark ? 'text-amber-400' : 'text-amber-500'}
                                  />
                                ) : null}
                                <span
                                  className={cn(
                                    'font-bold text-sm ml-1',
                                    getScoreColor(score, dark),
                                  )}
                                >
                                  {score}
                                </span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                {!loading && (kpi?.performanceByAnalyst ?? []).length === 0 && (
                  <tr>
                    <td
                      colSpan={7}
                      className={cn(
                        'px-5 py-12 text-center',
                        dark ? 'text-slate-500' : 'text-slate-400',
                      )}
                    >
                      <Users size={28} className="mx-auto mb-2 opacity-40" />
                      Nenhum dado de analista para o período.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

const PRIORITY_MINI: Record<string, string> = {
  CRITICA: 'bg-rose-500/20 text-rose-400',
  ALTA: 'bg-orange-500/20 text-orange-400',
  NORMAL: 'bg-blue-500/20 text-blue-400',
  BAIXA: 'bg-slate-500/20 text-slate-400',
};
