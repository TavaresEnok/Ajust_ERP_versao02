'use client';
/* eslint-disable react-hooks/exhaustive-deps */
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Sliders,
  RefreshCw,
  Search,
  BarChart3,
  AlertTriangle,
  Clock,
  CheckCircle2,
  TrendingUp,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

/* ─────────────────────────────────────────── */
/* Types                                       */
/* ─────────────────────────────────────────── */
type OrderItem = {
  id: string;
  status: string;
  priority: string;
  type: string;
  deadlineAt: string | null;
  createdAt: string;
  analystName: string | null;
};

type TypeStats = {
  type: string;
  label: string;
  total: number;
  active: number;
  closed: number;
  overdue: number;
  avgAgeHours: number;
  byPriority: Record<string, number>;
  byStatus: Record<string, number>;
};

/* ─────────────────────────────────────────── */
/* Constants                                   */
/* ─────────────────────────────────────────── */
const TYPE_LABELS: Record<string, string> = {
  ROMPIMENTO: 'Rompimento',
  LENTIDAO: 'Lentidão',
  CONFIGURACAO_ONU: 'Config. ONU',
  TROCA_SENHA: 'Troca de Senha',
  CANCELAMENTO: 'Cancelamento',
  AUDITORIA: 'Auditoria',
  INSTALACAO: 'Instalação',
  BGP: 'BGP',
  OUTROS: 'Outros',
};

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

const PRIORITY_COLORS: Record<string, string> = {
  CRITICA: 'bg-rose-500/20 text-rose-400',
  ALTA: 'bg-orange-500/20 text-orange-400',
  NORMAL: 'bg-blue-500/20 text-blue-400',
  BAIXA: 'bg-slate-500/20 text-slate-400',
};

function cn(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(' ');
}

function buildTypeStats(orders: OrderItem[]): TypeStats[] {
  const map = new Map<string, OrderItem[]>();
  for (const o of orders) {
    const type = o.type || 'OUTROS';
    if (!map.has(type)) map.set(type, []);
    map.get(type)!.push(o);
  }

  const now = Date.now();
  return Array.from(map.entries())
    .map(([type, items]) => {
      const active = items.filter((o) => STATUS_ACTIVE.has(o.status));
      const closed = items.filter((o) => STATUS_CLOSED.has(o.status));
      const overdue = active.filter((o) => o.deadlineAt && new Date(o.deadlineAt).getTime() < now);

      const totalAgeMs = items.reduce((s, o) => {
        const created = new Date(o.createdAt).getTime();
        const end = STATUS_CLOSED.has(o.status) ? now : now;
        return s + (end - created);
      }, 0);
      const avgAgeHours =
        items.length > 0 ? Math.round((totalAgeMs / items.length / 3600000) * 10) / 10 : 0;

      const byPriority: Record<string, number> = {};
      const byStatus: Record<string, number> = {};
      for (const o of items) {
        byPriority[o.priority] = (byPriority[o.priority] ?? 0) + 1;
        byStatus[o.status] = (byStatus[o.status] ?? 0) + 1;
      }

      return {
        type,
        label: TYPE_LABELS[type] || type,
        total: items.length,
        active: active.length,
        closed: closed.length,
        overdue: overdue.length,
        avgAgeHours,
        byPriority,
        byStatus,
      };
    })
    .sort((a, b) => b.total - a.total);
}

/* ─────────────────────────────────────────── */
/* Expanded Row                                */
/* ─────────────────────────────────────────── */
function ExpandedRow({ stats, dark }: { stats: TypeStats; dark: boolean }) {
  const priorityEntries = Object.entries(stats.byPriority).sort((a, b) => b[1] - a[1]);
  const statusEntries = Object.entries(stats.byStatus).sort((a, b) => b[1] - a[1]);
  const maxP = priorityEntries[0]?.[1] ?? 1;

  return (
    <tr className={cn(dark ? 'bg-slate-900/40' : 'bg-indigo-50/40')}>
      <td colSpan={7} className="px-6 py-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Por Prioridade */}
          <div>
            <h4
              className={cn(
                'text-[10px] uppercase font-bold tracking-wider mb-2.5',
                dark ? 'text-slate-500' : 'text-slate-400',
              )}
            >
              Distribuição por Prioridade
            </h4>
            <div className="space-y-2">
              {priorityEntries.map(([priority, count]) => (
                <div key={priority}>
                  <div className="flex justify-between text-xs mb-1">
                    <span
                      className={cn(
                        'px-1.5 py-0.5 rounded text-[10px] font-bold',
                        PRIORITY_COLORS[priority] || PRIORITY_COLORS.NORMAL,
                      )}
                    >
                      {priority}
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
                      className={cn(
                        'h-full rounded-full',
                        priority === 'CRITICA'
                          ? 'bg-rose-500'
                          : priority === 'ALTA'
                            ? 'bg-orange-500'
                            : priority === 'NORMAL'
                              ? 'bg-blue-500'
                              : 'bg-slate-400',
                      )}
                      style={{ width: `${(count / maxP) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Por Status */}
          <div>
            <h4
              className={cn(
                'text-[10px] uppercase font-bold tracking-wider mb-2.5',
                dark ? 'text-slate-500' : 'text-slate-400',
              )}
            >
              Distribuição por Status
            </h4>
            <div className="flex flex-wrap gap-1.5">
              {statusEntries.map(([status, count]) => (
                <div
                  key={status}
                  className={cn(
                    'rounded-lg px-2 py-1.5 text-xs',
                    dark
                      ? 'bg-slate-800 border border-slate-700 text-slate-300'
                      : 'bg-white border border-slate-200 text-slate-700',
                  )}
                >
                  <span className="font-bold">{count}×</span> {STATUS_LABELS[status] || status}
                </div>
              ))}
            </div>

            {/* Avg Age */}
            <div
              className={cn(
                'mt-3 flex items-center gap-1.5 text-xs',
                dark ? 'text-slate-500' : 'text-slate-400',
              )}
            >
              <Clock size={12} />
              Idade média das ordens: <span className="font-bold">{stats.avgAgeHours}h</span>
            </div>
          </div>
        </div>
      </td>
    </tr>
  );
}

/* ─────────────────────────────────────────── */
/* Main View                                   */
/* ─────────────────────────────────────────── */
export function ServiceTypesView({
  dark,
  tenantId,
  onToast,
}: {
  dark: boolean;
  tenantId: string;
  onToast: (m: string) => void;
}) {
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'total' | 'active' | 'overdue' | 'avgAge'>('total');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [expandedType, setExpandedType] = useState<string | null>(null);
  const [period, setPeriod] = useState('all');

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const params = new URLSearchParams({ tenantId, limit: '2000' });
      if (period !== 'all') {
        params.set('periodStart', new Date(Date.now() - parseInt(period) * 86400000).toISOString());
      }
      const res = await fetch(`/api/reports/service-order-flow?${params.toString()}`, {
        cache: 'no-store',
      });
      if (!res.ok) throw new Error(`Erro ${res.status}`);
      const data = await res.json();
      // The flow endpoint returns {nodes, edges, totalOrders} — we reconstruct from nodes
      const rawOrders: OrderItem[] = [];
      if (data?.nodes) {
        for (const node of data.nodes) {
          for (const o of node.orders ?? []) {
            rawOrders.push(o as OrderItem);
          }
        }
      }
      setOrders(rawOrders);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Falha ao carregar tipos de serviço.';
      setLoadError(msg);
      onToast(msg);
    } finally {
      setLoading(false);
    }
  }, [tenantId, period]);

  useEffect(() => {
    if (tenantId) load();
  }, [tenantId, period]);

  const allStats = useMemo(() => buildTypeStats(orders), [orders]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = allStats.filter(
      (s) => !q || s.label.toLowerCase().includes(q) || s.type.toLowerCase().includes(q),
    );
    list.sort((a, b) => {
      const f = sortDir === 'desc' ? -1 : 1;
      if (sortBy === 'total') return (a.total - b.total) * f;
      if (sortBy === 'active') return (a.active - b.active) * f;
      if (sortBy === 'overdue') return (a.overdue - b.overdue) * f;
      if (sortBy === 'avgAge') return (a.avgAgeHours - b.avgAgeHours) * f;
      return 0;
    });
    return list;
  }, [allStats, search, sortBy, sortDir]);

  const totals = useMemo(
    () => ({
      types: allStats.length,
      total: allStats.reduce((s, t) => s + t.total, 0),
      active: allStats.reduce((s, t) => s + t.active, 0),
      overdue: allStats.reduce((s, t) => s + t.overdue, 0),
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
            <Sliders size={24} className="text-teal-500" />
            Tipos de Serviço
          </h2>
          <p className={cn('text-sm mt-0.5', dark ? 'text-slate-400' : 'text-slate-500')}>
            Volume e desempenho por categoria de serviço.
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
            <option value="7">7 dias</option>
            <option value="30">30 dias</option>
            <option value="90">90 dias</option>
            <option value="all">Todo período</option>
          </select>
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

      {/* KPI summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          {
            label: 'Tipos Ativos',
            value: totals.types,
            icon: <Sliders size={16} />,
            color: dark ? 'text-teal-400' : 'text-teal-700',
          },
          {
            label: 'OS Total',
            value: totals.total,
            icon: <BarChart3 size={16} />,
            color: dark ? 'text-slate-300' : 'text-slate-700',
          },
          {
            label: 'OS Ativas',
            value: totals.active,
            icon: <Clock size={16} />,
            color: dark ? 'text-blue-400' : 'text-blue-700',
          },
          {
            label: 'Atrasadas',
            value: totals.overdue,
            icon: <AlertTriangle size={16} />,
            color:
              totals.overdue > 0 ? 'text-rose-500' : dark ? 'text-emerald-400' : 'text-emerald-600',
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

      {/* Filter */}
      <div className="flex gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search
            size={14}
            className={cn(
              'absolute left-3 top-1/2 -translate-y-1/2',
              dark ? 'text-slate-500' : 'text-slate-400',
            )}
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Pesquisar tipo..."
            className={cn(
              'w-full pl-9 pr-3 py-2 border rounded-lg text-sm',
              dark
                ? 'bg-slate-700 border-slate-600 text-slate-200 placeholder:text-slate-500'
                : 'border-slate-300',
            )}
          />
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
                <th className="px-5 py-3">Tipo de Serviço</th>
                <th
                  className="px-5 py-3 text-center cursor-pointer select-none"
                  onClick={() => toggleSort('total')}
                >
                  Total <SortIcon col="total" />
                </th>
                <th
                  className="px-5 py-3 text-center cursor-pointer select-none"
                  onClick={() => toggleSort('active')}
                >
                  Ativas <SortIcon col="active" />
                </th>
                <th className="px-5 py-3 text-center">Fechadas</th>
                <th
                  className="px-5 py-3 text-center cursor-pointer select-none"
                  onClick={() => toggleSort('overdue')}
                >
                  Atrasadas <SortIcon col="overdue" />
                </th>
                <th
                  className="px-5 py-3 text-center cursor-pointer select-none"
                  onClick={() => toggleSort('avgAge')}
                >
                  Idade Média <SortIcon col="avgAge" />
                </th>
                <th className="px-5 py-3 text-center">Detalhe</th>
              </tr>
            </thead>
            <tbody className={cn('divide-y', dark ? 'divide-slate-700/50' : 'divide-slate-100')}>
              {loading ? (
                Array.from({ length: 7 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 7 }).map((__, j) => (
                      <td key={j} className="px-5 py-3">
                        <div className="skeleton-box w-full h-4" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-14 text-center">
                    <BarChart3
                      size={32}
                      className={cn('mx-auto mb-2', dark ? 'text-slate-600' : 'text-slate-300')}
                    />
                    <p className={cn('text-sm', dark ? 'text-slate-500' : 'text-slate-400')}>
                      Nenhum tipo de serviço encontrado para o período.
                    </p>
                  </td>
                </tr>
              ) : (
                filtered.map((stats, idx) => {
                  const isExpanded = expandedType === stats.type;
                  const closureRate =
                    stats.total > 0 ? Math.round((stats.closed / stats.total) * 100) : 0;
                  return (
                    <React.Fragment key={stats.type}>
                      <tr
                        className={cn(
                          'animate-stagger transition-colors',
                          isExpanded
                            ? dark
                              ? 'bg-teal-900/10'
                              : 'bg-teal-50/50'
                            : dark
                              ? 'hover:bg-white/[0.02]'
                              : 'hover:bg-slate-50',
                        )}
                        style={{ animationDelay: `${idx * 0.03}s` }}
                      >
                        {/* Type Name */}
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2">
                            <div
                              className={cn(
                                'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0',
                                dark ? 'bg-teal-500/15 text-teal-400' : 'bg-teal-100 text-teal-700',
                              )}
                            >
                              <Sliders size={14} />
                            </div>
                            <div>
                              <div
                                className={cn(
                                  'font-semibold',
                                  dark ? 'text-slate-200' : 'text-slate-800',
                                )}
                              >
                                {stats.label}
                              </div>
                              <div
                                className={cn(
                                  'text-[10px] font-mono',
                                  dark ? 'text-slate-600' : 'text-slate-400',
                                )}
                              >
                                {stats.type}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Total */}
                        <td
                          className={cn(
                            'px-5 py-3 text-center font-mono font-bold',
                            dark ? 'text-slate-300' : 'text-slate-700',
                          )}
                        >
                          {stats.total}
                        </td>

                        {/* Active */}
                        <td
                          className={cn(
                            'px-5 py-3 text-center font-mono',
                            dark ? 'text-blue-400' : 'text-blue-700',
                          )}
                        >
                          {stats.active > 0 ? (
                            <span className="font-bold">{stats.active}</span>
                          ) : (
                            <span
                              className={cn('text-xs', dark ? 'text-slate-600' : 'text-slate-400')}
                            >
                              —
                            </span>
                          )}
                        </td>

                        {/* Closed + closure rate */}
                        <td className="px-5 py-3 text-center">
                          <div className="flex flex-col items-center gap-1">
                            <span
                              className={cn(
                                'font-mono',
                                dark ? 'text-emerald-400' : 'text-emerald-700',
                              )}
                            >
                              {stats.closed}
                            </span>
                            <div
                              className={cn(
                                'h-1 w-12 rounded-full overflow-hidden',
                                dark ? 'bg-slate-700' : 'bg-slate-200',
                              )}
                            >
                              <div
                                className={cn(
                                  'h-full rounded-full',
                                  closureRate >= 70
                                    ? 'bg-emerald-500'
                                    : closureRate >= 40
                                      ? 'bg-amber-500'
                                      : 'bg-rose-500',
                                )}
                                style={{ width: `${closureRate}%` }}
                              />
                            </div>
                          </div>
                        </td>

                        {/* Overdue */}
                        <td className="px-5 py-3 text-center">
                          {stats.overdue > 0 ? (
                            <span className="flex items-center justify-center gap-1 text-rose-500 font-bold">
                              <AlertTriangle size={12} /> {stats.overdue}
                            </span>
                          ) : (
                            <CheckCircle2
                              size={14}
                              className={cn(
                                'mx-auto',
                                dark ? 'text-emerald-600' : 'text-emerald-500',
                              )}
                            />
                          )}
                        </td>

                        {/* Avg Age */}
                        <td
                          className={cn(
                            'px-5 py-3 text-center font-mono text-xs',
                            dark ? 'text-slate-400' : 'text-slate-600',
                          )}
                        >
                          {stats.avgAgeHours > 0 ? `${stats.avgAgeHours}h` : '—'}
                        </td>

                        {/* Expand */}
                        <td className="px-5 py-3 text-center">
                          <button
                            onClick={() => setExpandedType(isExpanded ? null : stats.type)}
                            className={cn(
                              'px-3 py-1 rounded text-[10px] font-bold border transition-colors',
                              isExpanded
                                ? dark
                                  ? 'bg-teal-500/20 text-teal-300 border-teal-500/30'
                                  : 'bg-teal-100 text-teal-700 border-teal-300'
                                : dark
                                  ? 'bg-slate-700 text-slate-300 border-slate-600 hover:bg-slate-600'
                                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50',
                            )}
                          >
                            {isExpanded ? 'Fechar' : 'Ver'}
                          </button>
                        </td>
                      </tr>

                      {isExpanded && <ExpandedRow stats={stats} dark={dark} />}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {!loading && filtered.length > 0 && (
          <div
            className={cn(
              'px-5 py-3 border-t flex justify-between items-center text-xs',
              dark ? 'border-slate-700/50 text-slate-500' : 'border-slate-200 text-slate-400',
            )}
          >
            <span>
              <TrendingUp size={12} className="inline mr-1" />
              {filtered.length} tipo{filtered.length !== 1 ? 's' : ''} · {totals.total} OS total
            </span>
            <span>
              Taxa global de conclusão:{' '}
              <strong
                className={
                  totals.total > 0 &&
                  allStats.reduce((s, t) => s + t.closed, 0) / totals.total >= 0.7
                    ? dark
                      ? 'text-emerald-400'
                      : 'text-emerald-600'
                    : 'text-rose-500'
                }
              >
                {totals.total > 0
                  ? Math.round((allStats.reduce((s, t) => s + t.closed, 0) / totals.total) * 100)
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
