'use client';
/* eslint-disable react-hooks/exhaustive-deps */
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Building2,
  RefreshCw,
  Search,
  TrendingUp,
  AlertTriangle,
  Clock,
  CheckCircle2,
  ShieldAlert,
  BarChart3,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

/* ──────────────────────────────────────────────────────── */
/* Types                                                    */
/* ──────────────────────────────────────────────────────── */
type OccurrenceOrder = {
  id: string;
  protocol: string;
  type: string;
  priority: string;
  status: string;
  deadlineAt: string | null;
  analystName: string | null;
};

type Occurrence = {
  id: string;
  provider: string;
  sector: string;
  status: string;
  createdAt: string;
  serviceOrders?: OccurrenceOrder[];
};

type ProviderStats = {
  name: string;
  total: number;
  active: number;
  closed: number;
  overdue: number;
  criticalActive: number;
  closureRate: number;
  byType: Record<string, number>;
  byStatus: Record<string, number>;
  latestActivity: string | null;
};

/* ──────────────────────────────────────────────────────── */
/* Constants                                               */
/* ──────────────────────────────────────────────────────── */
const STATUS_ACTIVE = new Set(['ABERTA', 'EM_ANALISE', 'AG_CAMPO', 'AG_TERCEIROS']);
const STATUS_CLOSED = new Set(['FECHADA', 'RESOLVIDA', 'CANCELADA']);

const STATUS_LABELS: Record<string, string> = {
  ABERTA: 'Aberta',
  EM_ANALISE: 'Em Análise',
  AG_CAMPO: 'Ag. Campo',
  AG_TERCEIROS: 'Ag. Terceiros',
  RESOLVIDA: 'Resolvida',
  FECHADA: 'Fechada',
  CANCELADA: 'Cancelada',
};

const TYPE_LABELS: Record<string, string> = {
  ROMPIMENTO: 'Rompimento',
  LENTIDAO: 'Lentidão',
  CONFIGURACAO_ONU: 'Config ONU',
  TROCA_SENHA: 'Troca Senha',
  CANCELAMENTO: 'Cancelamento',
  AUDITORIA: 'Auditoria',
  INSTALACAO: 'Instalação',
  BGP: 'BGP',
};

function cn(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(' ');
}

function getGradeColor(rate: number, dark: boolean) {
  if (rate >= 80) return dark ? 'text-emerald-400' : 'text-emerald-600';
  if (rate >= 50) return dark ? 'text-amber-400' : 'text-amber-600';
  return 'text-rose-500';
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

function buildStats(occurrences: Occurrence[]): ProviderStats[] {
  const map = new Map<
    string,
    {
      orders: OccurrenceOrder[];
      latestAt: string | null;
    }
  >();

  for (const occ of occurrences) {
    const name = occ.provider || 'Desconhecido';
    if (!map.has(name)) map.set(name, { orders: [], latestAt: null });
    const entry = map.get(name)!;
    for (const order of occ.serviceOrders ?? []) {
      entry.orders.push(order);
    }
    if (!entry.latestAt || occ.createdAt > entry.latestAt) {
      entry.latestAt = occ.createdAt;
    }
  }

  const now = new Date();
  const stats: ProviderStats[] = [];

  for (const [name, { orders, latestAt }] of map.entries()) {
    const total = orders.length;
    const active = orders.filter((o) => STATUS_ACTIVE.has(o.status)).length;
    const closed = orders.filter((o) => STATUS_CLOSED.has(o.status)).length;
    const overdue = orders.filter(
      (o) => STATUS_ACTIVE.has(o.status) && o.deadlineAt && new Date(o.deadlineAt) < now,
    ).length;
    const criticalActive = orders.filter(
      (o) => STATUS_ACTIVE.has(o.status) && o.priority === 'CRITICA',
    ).length;
    const closureRate = total > 0 ? Math.round((closed / total) * 100) : 0;

    const byType: Record<string, number> = {};
    const byStatus: Record<string, number> = {};
    for (const o of orders) {
      byType[o.type] = (byType[o.type] ?? 0) + 1;
      byStatus[o.status] = (byStatus[o.status] ?? 0) + 1;
    }

    stats.push({
      name,
      total,
      active,
      closed,
      overdue,
      criticalActive,
      closureRate,
      byType,
      byStatus,
      latestActivity: latestAt,
    });
  }

  return stats.sort((a, b) => b.total - a.total);
}

/* ──────────────────────────────────────────────────────── */
/* ExpandedRow                                             */
/* ──────────────────────────────────────────────────────── */
function ExpandedRow({ provider, dark }: { provider: ProviderStats; dark: boolean }) {
  const topTypes = Object.entries(provider.byType)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  const maxType = topTypes[0]?.[1] ?? 1;

  const statusEntries = Object.entries(provider.byStatus).sort((a, b) => b[1] - a[1]);

  return (
    <tr className={cn(dark ? 'bg-slate-900/40' : 'bg-slate-50/70')}>
      <td colSpan={8} className="px-6 py-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Por Tipo */}
          <div>
            <h4
              className={cn(
                'text-xs uppercase font-bold tracking-wider mb-3',
                dark ? 'text-slate-500' : 'text-slate-400',
              )}
            >
              Volume por Tipo de OS
            </h4>
            <div className="space-y-2">
              {topTypes.map(([type, count]) => (
                <div key={type}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className={dark ? 'text-slate-300' : 'text-slate-700'}>
                      {TYPE_LABELS[type] || type}
                    </span>
                    <span
                      className={cn(
                        'font-mono font-bold',
                        dark ? 'text-slate-400' : 'text-slate-600',
                      )}
                    >
                      {count}
                    </span>
                  </div>
                  <div
                    className={cn(
                      'h-1.5 rounded-full overflow-hidden',
                      dark ? 'bg-slate-700' : 'bg-slate-200',
                    )}
                  >
                    <div
                      className="h-full bg-indigo-500 rounded-full"
                      style={{ width: `${(count / maxType) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
              {topTypes.length === 0 && (
                <p className={cn('text-xs', dark ? 'text-slate-600' : 'text-slate-400')}>
                  Sem dados de tipo.
                </p>
              )}
            </div>
          </div>

          {/* Por Status */}
          <div>
            <h4
              className={cn(
                'text-xs uppercase font-bold tracking-wider mb-3',
                dark ? 'text-slate-500' : 'text-slate-400',
              )}
            >
              Distribuição por Status
            </h4>
            <div className="flex flex-wrap gap-2">
              {statusEntries.map(([status, count]) => (
                <div
                  key={status}
                  className={cn(
                    'rounded-lg px-2.5 py-1.5 text-xs font-semibold',
                    dark
                      ? 'bg-slate-800 text-slate-300'
                      : 'bg-white border border-slate-200 text-slate-700',
                  )}
                >
                  <span className={cn('font-bold', dark ? 'text-slate-200' : 'text-slate-800')}>
                    {count}×
                  </span>{' '}
                  {STATUS_LABELS[status] || status}
                </div>
              ))}
            </div>
          </div>
        </div>
      </td>
    </tr>
  );
}

/* ──────────────────────────────────────────────────────── */
/* Main View                                               */
/* ──────────────────────────────────────────────────────── */
export function ProvidersView({
  dark,
  tenantId,
  onToast,
}: {
  dark: boolean;
  tenantId: string;
  onToast: (m: string) => void;
}) {
  const [occurrences, setOccurrences] = useState<Occurrence[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'total' | 'active' | 'overdue' | 'rate'>('active');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [expandedProvider, setExpandedProvider] = useState<string | null>(null);
  const [minVolume, setMinVolume] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const params = new URLSearchParams({
        tenantId,
        includeOrders: 'true',
        limit: '500',
      });
      const res = await fetch(`/api/occurrences?${params.toString()}`, { cache: 'no-store' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Erro ${res.status}`);
      }
      const data = await res.json().catch(() => []);
      setOccurrences(Array.isArray(data) ? data : []);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Falha ao carregar provedores.';
      setLoadError(msg);
      onToast(msg);
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    if (tenantId) load();
  }, [tenantId]);

  const allStats = useMemo(() => buildStats(occurrences), [occurrences]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = allStats.filter((p) => {
      const matchQ = !q || p.name.toLowerCase().includes(q);
      const matchVol = p.total >= minVolume;
      return matchQ && matchVol;
    });

    list.sort((a, b) => {
      const factor = sortDir === 'desc' ? -1 : 1;
      if (sortBy === 'total') return (a.total - b.total) * factor;
      if (sortBy === 'active') return (a.active - b.active) * factor;
      if (sortBy === 'overdue') return (a.overdue - b.overdue) * factor;
      if (sortBy === 'rate') return (a.closureRate - b.closureRate) * factor;
      return 0;
    });

    return list;
  }, [allStats, search, sortBy, sortDir, minVolume]);

  const globalStats = useMemo(
    () => ({
      providers: allStats.length,
      total: allStats.reduce((s, p) => s + p.total, 0),
      active: allStats.reduce((s, p) => s + p.active, 0),
      overdue: allStats.reduce((s, p) => s + p.overdue, 0),
      critical: allStats.reduce((s, p) => s + p.criticalActive, 0),
    }),
    [allStats],
  );

  function toggleSort(col: typeof sortBy) {
    if (sortBy === col) setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
    else {
      setSortBy(col);
      setSortDir('desc');
    }
  }

  function SortIcon({ col }: { col: typeof sortBy }) {
    if (sortBy !== col) return null;
    return sortDir === 'desc' ? (
      <ChevronDown size={12} className="inline ml-0.5" />
    ) : (
      <ChevronUp size={12} className="inline ml-0.5" />
    );
  }

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
            <Building2 size={24} className="text-violet-500" />
            Análise de Provedores
          </h2>
          <p className={cn('text-sm mt-0.5', dark ? 'text-slate-400' : 'text-slate-500')}>
            Ranking de provedores por volume, atividade e performance operacional.
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className={cn(
            'px-4 py-2 rounded-lg border text-sm font-semibold flex items-center gap-2 disabled:opacity-50',
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

      {/* Global KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          {
            label: 'Provedores',
            value: globalStats.providers,
            icon: <Building2 size={16} />,
            color: dark ? 'text-violet-400' : 'text-violet-700',
          },
          {
            label: 'OS Total',
            value: globalStats.total,
            icon: <BarChart3 size={16} />,
            color: dark ? 'text-slate-300' : 'text-slate-700',
          },
          {
            label: 'OS Ativas',
            value: globalStats.active,
            icon: <Clock size={16} />,
            color: dark ? 'text-blue-400' : 'text-blue-700',
          },
          {
            label: 'Atrasadas',
            value: globalStats.overdue,
            icon: <AlertTriangle size={16} />,
            color:
              globalStats.overdue > 0
                ? 'text-rose-500'
                : dark
                  ? 'text-emerald-400'
                  : 'text-emerald-600',
          },
          {
            label: 'Críticas Ativas',
            value: globalStats.critical,
            icon: <ShieldAlert size={16} />,
            color:
              globalStats.critical > 0
                ? 'text-rose-500'
                : dark
                  ? 'text-emerald-400'
                  : 'text-emerald-600',
          },
        ].map((card, i) => (
          <div key={i} className={cn(panelCls, 'p-4')}>
            <div
              className={cn(
                'flex items-center gap-1.5 text-[10px] uppercase font-bold tracking-wider mb-1.5',
                dark ? 'text-slate-500' : 'text-slate-400',
              )}
            >
              <span className={card.color}>{card.icon}</span>
              {card.label}
            </div>
            <div className={cn('text-2xl font-black', card.color)}>
              {loading ? <span className="skeleton-box w-10 h-7 block" /> : card.value}
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className={cn('rounded-xl border p-4 flex flex-wrap gap-3', panelCls)}>
        <div className="relative flex-1 min-w-48">
          <Search
            size={15}
            className={cn(
              'absolute left-3 top-1/2 -translate-y-1/2',
              dark ? 'text-slate-500' : 'text-slate-400',
            )}
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Pesquisar provedor..."
            className={cn(
              'w-full pl-9 pr-3 py-2 border rounded-lg text-sm',
              dark
                ? 'bg-slate-700 border-slate-600 text-slate-200 placeholder:text-slate-500'
                : 'border-slate-300',
            )}
          />
        </div>
        <div className="flex items-center gap-2">
          <label className={cn('text-xs font-medium', dark ? 'text-slate-400' : 'text-slate-600')}>
            Vol. mínimo:
          </label>
          <input
            type="number"
            min="0"
            value={minVolume}
            onChange={(e) => setMinVolume(Number(e.target.value) || 0)}
            className={cn(
              'w-20 px-2 py-2 border rounded-lg text-sm',
              dark ? 'bg-slate-700 border-slate-600 text-slate-200' : 'border-slate-300',
            )}
          />
        </div>
        <div
          className={cn('text-xs flex items-center', dark ? 'text-slate-500' : 'text-slate-400')}
        >
          {!loading && (
            <span>
              {filtered.length} de {allStats.length} provedores
            </span>
          )}
        </div>
      </div>

      {/* Table */}
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
                <th className="px-5 py-3">Provedor</th>
                <th
                  className="px-5 py-3 text-center cursor-pointer select-none hover:opacity-80"
                  onClick={() => toggleSort('total')}
                >
                  Total <SortIcon col="total" />
                </th>
                <th
                  className="px-5 py-3 text-center cursor-pointer select-none hover:opacity-80"
                  onClick={() => toggleSort('active')}
                >
                  Ativas <SortIcon col="active" />
                </th>
                <th
                  className="px-5 py-3 text-center cursor-pointer select-none hover:opacity-80"
                  onClick={() => toggleSort('overdue')}
                >
                  Atrasadas <SortIcon col="overdue" />
                </th>
                <th className="px-5 py-3 text-center">Críticas</th>
                <th
                  className="px-5 py-3 text-center cursor-pointer select-none hover:opacity-80"
                  onClick={() => toggleSort('rate')}
                >
                  Taxa Conclusão <SortIcon col="rate" />
                </th>
                <th className="px-5 py-3 text-right">Última atividade</th>
                <th className="px-5 py-3 text-center">Detalhe</th>
              </tr>
            </thead>
            <tbody className={cn('divide-y', dark ? 'divide-slate-700/50' : 'divide-slate-100')}>
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
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
                    <Building2
                      size={32}
                      className={cn('mx-auto mb-2', dark ? 'text-slate-600' : 'text-slate-300')}
                    />
                    <p className={cn('text-sm', dark ? 'text-slate-500' : 'text-slate-400')}>
                      Nenhum provedor encontrado.
                    </p>
                  </td>
                </tr>
              ) : (
                filtered.map((provider, idx) => {
                  const isExpanded = expandedProvider === provider.name;
                  return (
                    <React.Fragment key={provider.name}>
                      <tr
                        className={cn(
                          'animate-stagger transition-colors',
                          isExpanded
                            ? dark
                              ? 'bg-indigo-900/10'
                              : 'bg-indigo-50/50'
                            : dark
                              ? 'hover:bg-white/[0.02]'
                              : 'hover:bg-slate-50',
                        )}
                        style={{ animationDelay: `${idx * 0.03}s` }}
                      >
                        {/* Name */}
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2">
                            <div
                              className={cn(
                                'w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0',
                                dark
                                  ? 'bg-violet-500/20 text-violet-300'
                                  : 'bg-violet-100 text-violet-700',
                              )}
                            >
                              {provider.name.charAt(0).toUpperCase()}
                            </div>
                            <span
                              className={cn(
                                'font-semibold',
                                dark ? 'text-slate-200' : 'text-slate-800',
                              )}
                            >
                              {provider.name}
                            </span>
                          </div>
                        </td>

                        {/* Total */}
                        <td
                          className={cn(
                            'px-5 py-3 text-center font-mono font-bold',
                            dark ? 'text-slate-300' : 'text-slate-700',
                          )}
                        >
                          {provider.total}
                        </td>

                        {/* Active */}
                        <td
                          className={cn(
                            'px-5 py-3 text-center font-mono',
                            dark ? 'text-blue-400' : 'text-blue-700',
                          )}
                        >
                          {provider.active > 0 ? (
                            <span className="font-bold">{provider.active}</span>
                          ) : (
                            <span
                              className={cn('text-xs', dark ? 'text-slate-600' : 'text-slate-400')}
                            >
                              —
                            </span>
                          )}
                        </td>

                        {/* Overdue */}
                        <td className="px-5 py-3 text-center">
                          {provider.overdue > 0 ? (
                            <span className="text-rose-500 font-bold flex items-center justify-center gap-1">
                              <AlertTriangle size={13} />
                              {provider.overdue}
                            </span>
                          ) : (
                            <CheckCircle2
                              size={15}
                              className={cn(
                                'mx-auto',
                                dark ? 'text-emerald-600' : 'text-emerald-500',
                              )}
                            />
                          )}
                        </td>

                        {/* Critical */}
                        <td className="px-5 py-3 text-center">
                          {provider.criticalActive > 0 ? (
                            <span className="text-rose-500 font-bold font-mono">
                              {provider.criticalActive}
                            </span>
                          ) : (
                            <span
                              className={cn('text-xs', dark ? 'text-slate-600' : 'text-slate-400')}
                            >
                              —
                            </span>
                          )}
                        </td>

                        {/* Closure rate */}
                        <td className="px-5 py-3 text-center">
                          <div className="flex flex-col items-center gap-1">
                            <div
                              className={cn(
                                'h-1.5 w-20 rounded-full overflow-hidden',
                                dark ? 'bg-slate-700' : 'bg-slate-200',
                              )}
                            >
                              <div
                                className={cn(
                                  'h-full rounded-full',
                                  provider.closureRate >= 70
                                    ? 'bg-emerald-500'
                                    : provider.closureRate >= 40
                                      ? 'bg-amber-500'
                                      : 'bg-rose-500',
                                )}
                                style={{ width: `${provider.closureRate}%` }}
                              />
                            </div>
                            <span
                              className={cn(
                                'text-xs font-bold',
                                getGradeColor(provider.closureRate, dark),
                              )}
                            >
                              {provider.closureRate}%
                            </span>
                          </div>
                        </td>

                        {/* Last activity */}
                        <td
                          className={cn(
                            'px-5 py-3 text-right text-xs font-mono',
                            dark ? 'text-slate-500' : 'text-slate-400',
                          )}
                        >
                          {provider.latestActivity ? formatDate(provider.latestActivity) : '—'}
                        </td>

                        {/* Expand */}
                        <td className="px-5 py-3 text-center">
                          <button
                            onClick={() => setExpandedProvider(isExpanded ? null : provider.name)}
                            className={cn(
                              'px-3 py-1 rounded text-[10px] font-bold border transition-colors',
                              isExpanded
                                ? dark
                                  ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30'
                                  : 'bg-indigo-100 text-indigo-700 border-indigo-300'
                                : dark
                                  ? 'bg-slate-700 text-slate-300 border-slate-600 hover:bg-slate-600'
                                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50',
                            )}
                          >
                            {isExpanded ? 'Fechar' : 'Ver'}
                          </button>
                        </td>
                      </tr>

                      {isExpanded && <ExpandedRow provider={provider} dark={dark} />}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        {!loading && filtered.length > 0 && (
          <div
            className={cn(
              'px-5 py-3 border-t flex justify-between items-center text-xs',
              dark ? 'border-slate-700/50 text-slate-500' : 'border-slate-200 text-slate-400',
            )}
          >
            <span>
              <TrendingUp size={12} className="inline mr-1" />
              {filtered.length} provedor{filtered.length !== 1 ? 'es' : ''}
              {' · '}
              {globalStats.total} OS total
            </span>
            <span>
              Taxa média de conclusão:{' '}
              <strong
                className={getGradeColor(
                  filtered.length > 0
                    ? Math.round(filtered.reduce((s, p) => s + p.closureRate, 0) / filtered.length)
                    : 0,
                  dark,
                )}
              >
                {filtered.length > 0
                  ? Math.round(filtered.reduce((s, p) => s + p.closureRate, 0) / filtered.length)
                  : 0}
                %
              </strong>
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
