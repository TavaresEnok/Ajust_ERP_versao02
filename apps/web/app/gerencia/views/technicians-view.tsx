'use client';
/* eslint-disable react-hooks/exhaustive-deps */
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Users,
  RefreshCw,
  Search,
  UserCheck,
  ShieldAlert,
  Clock,
  CheckCircle2,
  Mail,
  MoreVertical,
  UserX,
} from 'lucide-react';

type Analyst = {
  id: string;
  name: string;
  email: string;
  role: string;
  sector?: string | null;
  status: string;
  lastLoginAt?: string | null;
};

type AnalystKpi = {
  name: string;
  open: number;
  closed: number;
  slaBreaches: number;
  tmrHours: number;
};

function cn(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(' ');
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function formatRelativeTime(isoDate: string | null | undefined): string {
  if (!isoDate) return 'Nunca logou';
  const diff = Date.now() - new Date(isoDate).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `${minutes}min atrás`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h atrás`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d atrás`;
  return new Date(isoDate).toLocaleDateString('pt-BR');
}

const ROLE_LABELS: Record<string, string> = {
  gerente: 'Gerente',
  analista: 'Analista',
  tecnico: 'Técnico',
  super_admin: 'Super Admin',
  cliente: 'Cliente',
  leitura: 'Leitura',
};

const ROLE_COLORS: Record<string, string> = {
  gerente: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
  analista: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  tecnico: 'bg-teal-500/15 text-teal-400 border-teal-500/30',
  super_admin: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
  cliente: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  leitura: 'bg-slate-500/15 text-slate-400 border-slate-500/30',
};

const AVATAR_COLORS = [
  'bg-indigo-500',
  'bg-violet-500',
  'bg-blue-500',
  'bg-teal-500',
  'bg-emerald-500',
  'bg-amber-500',
  'bg-rose-500',
  'bg-pink-500',
];

function getAvatarColor(name: string): string {
  let hash = 0;
  for (const c of name) hash = (hash << 5) - hash + c.charCodeAt(0);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export function TechniciansView({
  dark,
  tenantId,
  onToast,
}: {
  dark: boolean;
  tenantId: string;
  onToast: (m: string) => void;
}) {
  const [analysts, setAnalysts] = useState<Analyst[]>([]);
  const [kpiData, setKpiData] = useState<AnalystKpi[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [sortBy, setSortBy] = useState<'name' | 'open' | 'closed' | 'breaches'>('open');
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [usersRes, kpiRes] = await Promise.all([
        fetch(`/api/iam/users?tenantId=${encodeURIComponent(tenantId)}`, { cache: 'no-store' }),
        fetch(`/api/reports/manager-kpi?tenantId=${encodeURIComponent(tenantId)}`, {
          cache: 'no-store',
        }),
      ]);

      const [usersData, kpiRaw] = await Promise.all([
        usersRes.ok ? usersRes.json().catch(() => []) : [],
        kpiRes.ok ? kpiRes.json().catch(() => null) : null,
      ]);

      const mapped: Analyst[] = (Array.isArray(usersData) ? usersData : []).map(
        (u: Record<string, unknown>) => ({
          id: String(u.id || ''),
          name: String(u.name || ''),
          email: String(u.email || ''),
          role: String(u.role || u.roleCode || 'analista'),
          sector: u.sector ? String(u.sector) : null,
          status: String(u.status || 'ACTIVE'),
          lastLoginAt: u.lastLoginAt ? String(u.lastLoginAt) : null,
        }),
      );

      setAnalysts(mapped);
      setKpiData(kpiRaw?.performanceByAnalyst ?? []);
    } catch {
      const msg = 'Falha ao carregar equipe.';
      setLoadError(msg);
      onToast(msg);
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    if (tenantId) load();
  }, [tenantId]);

  const kpiByName = useMemo(() => {
    const map: Record<string, AnalystKpi> = {};
    for (const k of kpiData) map[k.name] = k;
    return map;
  }, [kpiData]);

  const enriched = useMemo(
    () => analysts.map((a) => ({ ...a, kpi: kpiByName[a.name] || null })),
    [analysts, kpiByName],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = enriched.filter((a) => {
      const matchQ = !q || a.name.toLowerCase().includes(q) || a.email.toLowerCase().includes(q);
      const matchRole = roleFilter === 'all' || a.role === roleFilter;
      return matchQ && matchRole;
    });

    if (sortBy === 'name') list.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
    if (sortBy === 'open') list.sort((a, b) => (b.kpi?.open ?? 0) - (a.kpi?.open ?? 0));
    if (sortBy === 'closed') list.sort((a, b) => (b.kpi?.closed ?? 0) - (a.kpi?.closed ?? 0));
    if (sortBy === 'breaches')
      list.sort((a, b) => (b.kpi?.slaBreaches ?? 0) - (a.kpi?.slaBreaches ?? 0));

    return list;
  }, [enriched, search, roleFilter, sortBy]);

  const stats = useMemo(
    () => ({
      total: analysts.length,
      active: analysts.filter((a) => a.status === 'ACTIVE').length,
      analysts: analysts.filter((a) => ['analista', 'tecnico'].includes(a.role)).length,
      withOpenOrders: enriched.filter((a) => (a.kpi?.open ?? 0) > 0).length,
    }),
    [analysts, enriched],
  );

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
            <Users size={24} className="text-blue-500" />
            Equipe — Técnicos e Analistas
          </h2>
          <p className={cn('text-sm mt-0.5', dark ? 'text-slate-400' : 'text-slate-500')}>
            Gestão da equipe e acompanhamento de carga de trabalho em tempo real.
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

      {/* KPI Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: 'Total na Equipe',
            value: stats.total,
            icon: <Users size={18} />,
            color: dark ? 'text-slate-300' : 'text-slate-700',
          },
          {
            label: 'Ativos',
            value: stats.active,
            icon: <UserCheck size={18} />,
            color: dark ? 'text-emerald-400' : 'text-emerald-600',
          },
          {
            label: 'Analistas/Técnicos',
            value: stats.analysts,
            icon: <Users size={18} />,
            color: dark ? 'text-blue-400' : 'text-blue-600',
          },
          {
            label: 'Com OS Abertas',
            value: stats.withOpenOrders,
            icon: <Clock size={18} />,
            color: dark ? 'text-amber-400' : 'text-amber-600',
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
              {loading ? <span className="skeleton-box w-12 h-8 block" /> : card.value}
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className={cn('rounded-xl border p-4 grid grid-cols-1 md:grid-cols-3 gap-3', panelCls)}>
        <div className="relative">
          <Search
            size={16}
            className={cn(
              'absolute left-3 top-1/2 -translate-y-1/2',
              dark ? 'text-slate-500' : 'text-slate-400',
            )}
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Pesquisar por nome ou e-mail..."
            className={cn(
              'w-full pl-10 pr-3 py-2 border rounded-lg text-sm',
              dark
                ? 'bg-slate-700 border-slate-600 text-slate-200 placeholder:text-slate-500'
                : 'border-slate-300',
            )}
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className={cn(
            'w-full px-3 py-2 border rounded-lg text-sm',
            dark ? 'bg-slate-700 border-slate-600 text-slate-200' : 'border-slate-300',
          )}
        >
          <option value="all">Todos os Perfis</option>
          {['gerente', 'analista', 'tecnico', 'super_admin', 'cliente', 'leitura'].map((r) => (
            <option key={r} value={r}>
              {ROLE_LABELS[r] || r}
            </option>
          ))}
        </select>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
          className={cn(
            'w-full px-3 py-2 border rounded-lg text-sm',
            dark ? 'bg-slate-700 border-slate-600 text-slate-200' : 'border-slate-300',
          )}
        >
          <option value="open">Maior carga (OS abertas)</option>
          <option value="closed">Mais fechamentos</option>
          <option value="breaches">Mais breaches SLA</option>
          <option value="name">Nome A-Z</option>
        </select>
      </div>

      {/* Cards Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className={cn(panelCls, 'p-5')}>
              <div className="flex items-center gap-3 mb-4">
                <div className="skeleton-box w-12 h-12 rounded-full" />
                <div className="flex-1 space-y-2">
                  <div className="skeleton-box w-28 h-4" />
                  <div className="skeleton-box w-20 h-3" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {Array.from({ length: 3 }).map((__, j) => (
                  <div key={j} className="skeleton-box h-12 rounded-lg" />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className={cn('rounded-xl border px-5 py-14 text-center', panelCls)}>
          <UserX
            size={32}
            className={cn('mx-auto mb-2', dark ? 'text-slate-600' : 'text-slate-300')}
          />
          <p className={cn('text-sm', dark ? 'text-slate-500' : 'text-slate-400')}>
            Nenhum membro da equipe encontrado.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((analyst, idx) => {
            const avatarBg = getAvatarColor(analyst.name);
            const kpi = analyst.kpi;
            const total = (kpi?.open ?? 0) + (kpi?.closed ?? 0);
            const rate = total > 0 ? Math.round(((kpi?.closed ?? 0) / total) * 100) : null;
            const isInactive = analyst.status !== 'ACTIVE';
            const roleColor = ROLE_COLORS[analyst.role] || ROLE_COLORS.leitura;
            return (
              <div
                key={analyst.id}
                className={cn(
                  'animate-stagger rounded-xl border p-5 flex flex-col gap-4 relative transition-shadow hover:shadow-md',
                  isInactive ? 'opacity-50' : '',
                  dark
                    ? 'bg-slate-800/40 border-slate-700/50 shadow-black/20'
                    : 'bg-white border-slate-200',
                )}
                style={{ animationDelay: `${idx * 0.04}s` }}
              >
                {/* Menu */}
                <div className="absolute top-3 right-3">
                  <button
                    onClick={() => setOpenMenuId(openMenuId === analyst.id ? null : analyst.id)}
                    className={cn(
                      'p-1 rounded',
                      dark
                        ? 'text-slate-600 hover:text-slate-400'
                        : 'text-slate-300 hover:text-slate-500',
                    )}
                  >
                    <MoreVertical size={14} />
                  </button>
                  {openMenuId === analyst.id && (
                    <div
                      className={cn(
                        'absolute right-0 top-6 z-10 rounded-lg border shadow-lg py-1 min-w-[120px] text-xs',
                        dark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200',
                      )}
                    >
                      <a
                        href={`mailto:${analyst.email}`}
                        className={cn(
                          'flex items-center gap-2 px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-700',
                          dark ? 'text-slate-300' : 'text-slate-700',
                        )}
                      >
                        <Mail size={12} /> Enviar email
                      </a>
                    </div>
                  )}
                </div>

                {/* Avatar + Info */}
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      'w-11 h-11 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0',
                      avatarBg,
                    )}
                  >
                    {getInitials(analyst.name)}
                  </div>
                  <div className="min-w-0">
                    <div
                      className={cn(
                        'font-bold text-sm truncate',
                        dark ? 'text-slate-100' : 'text-slate-800',
                      )}
                    >
                      {analyst.name}
                    </div>
                    <div
                      className={cn('text-xs truncate', dark ? 'text-slate-500' : 'text-slate-500')}
                    >
                      {analyst.email}
                    </div>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span
                        className={cn(
                          'text-[10px] px-1.5 py-0.5 rounded border font-bold',
                          roleColor,
                        )}
                      >
                        {ROLE_LABELS[analyst.role] || analyst.role}
                      </span>
                      {analyst.sector && (
                        <span
                          className={cn('text-[10px]', dark ? 'text-slate-500' : 'text-slate-400')}
                        >
                          · {analyst.sector}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* KPI Mini */}
                {kpi ? (
                  <div className="grid grid-cols-3 gap-2">
                    <div
                      className={cn(
                        'rounded-lg p-2 text-center',
                        dark ? 'bg-blue-500/10' : 'bg-blue-50',
                      )}
                    >
                      <div
                        className={cn(
                          'text-xs font-black',
                          dark ? 'text-blue-400' : 'text-blue-600',
                        )}
                      >
                        {kpi.open}
                      </div>
                      <div
                        className={cn(
                          'text-[9px] uppercase font-bold',
                          dark ? 'text-slate-600' : 'text-slate-400',
                        )}
                      >
                        Abertas
                      </div>
                    </div>
                    <div
                      className={cn(
                        'rounded-lg p-2 text-center',
                        dark ? 'bg-emerald-500/10' : 'bg-emerald-50',
                      )}
                    >
                      <div
                        className={cn(
                          'text-xs font-black',
                          dark ? 'text-emerald-400' : 'text-emerald-600',
                        )}
                      >
                        {kpi.closed}
                      </div>
                      <div
                        className={cn(
                          'text-[9px] uppercase font-bold',
                          dark ? 'text-slate-600' : 'text-slate-400',
                        )}
                      >
                        Fechadas
                      </div>
                    </div>
                    <div
                      className={cn(
                        'rounded-lg p-2 text-center',
                        kpi.slaBreaches > 0
                          ? dark
                            ? 'bg-rose-500/10'
                            : 'bg-rose-50'
                          : dark
                            ? 'bg-slate-700/40'
                            : 'bg-slate-50',
                      )}
                    >
                      <div
                        className={cn(
                          'text-xs font-black',
                          kpi.slaBreaches > 0
                            ? 'text-rose-500'
                            : dark
                              ? 'text-slate-400'
                              : 'text-slate-500',
                        )}
                      >
                        {kpi.slaBreaches}
                      </div>
                      <div
                        className={cn(
                          'text-[9px] uppercase font-bold',
                          dark ? 'text-slate-600' : 'text-slate-400',
                        )}
                      >
                        Breaches
                      </div>
                    </div>
                  </div>
                ) : (
                  <div
                    className={cn(
                      'text-xs text-center py-2',
                      dark ? 'text-slate-600' : 'text-slate-400',
                    )}
                  >
                    Sem dados de performance
                  </div>
                )}

                {/* Footer */}
                <div className="flex items-center justify-between">
                  {rate !== null ? (
                    <div className="flex items-center gap-1.5">
                      <div
                        className={cn(
                          'h-1 w-12 rounded-full overflow-hidden',
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
                          'text-[10px] font-bold',
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
                  ) : (
                    <div />
                  )}
                  <div className="flex items-center gap-1">
                    {isInactive ? (
                      <UserX size={12} className="text-rose-500" />
                    ) : (
                      <div className="w-2 h-2 rounded-full bg-emerald-500" />
                    )}
                    <span className={cn('text-[10px]', dark ? 'text-slate-500' : 'text-slate-400')}>
                      {formatRelativeTime(analyst.lastLoginAt)}
                    </span>
                  </div>
                </div>

                {/* TMA */}
                {kpi && kpi.tmrHours > 0 && (
                  <div
                    className={cn(
                      'flex items-center gap-1.5 text-[10px] border-t pt-2',
                      dark
                        ? 'border-slate-700/50 text-slate-500'
                        : 'border-slate-100 text-slate-400',
                    )}
                  >
                    <Clock size={11} />
                    TMA: <span className="font-bold">{kpi.tmrHours}h</span> por ordem
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Summary footer */}
      {!loading && filtered.length > 0 && (
        <div
          className={cn(
            'rounded-xl border px-5 py-3 flex items-center justify-between',
            dark ? 'bg-slate-800/20 border-slate-700/30' : 'bg-slate-50 border-slate-200',
          )}
        >
          <span className={cn('text-xs', dark ? 'text-slate-500' : 'text-slate-500')}>
            Mostrando <strong>{filtered.length}</strong> de <strong>{analysts.length}</strong>{' '}
            membros
          </span>
          <div className="flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1">
              <CheckCircle2 size={12} className={dark ? 'text-emerald-500' : 'text-emerald-600'} />
              <span className={dark ? 'text-slate-500' : 'text-slate-500'}>
                Ativos: {stats.active}
              </span>
            </span>
            <span className="flex items-center gap-1">
              <ShieldAlert size={12} className="text-rose-500" />
              <span className={dark ? 'text-slate-500' : 'text-slate-500'}>
                Breaches: {kpiData.reduce((s, k) => s + k.slaBreaches, 0)}
              </span>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
