'use client';

import React, { useMemo, useState } from 'react';
import { Search, Sparkles } from 'lucide-react';
import { ErpBadge } from './shared-ui';

const cn = (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' ');
const DAY_MS = 24 * 60 * 60 * 1000;
const PERIODS = ['7d', '15d', '30d', 'Tudo'];

const periodStart = (period: string, now = Date.now()) => {
  if (period === 'Tudo') return null;
  if (period === '7d') return now - 7 * DAY_MS;
  if (period === '15d') return now - 15 * DAY_MS;
  return now - 30 * DAY_MS;
};

const filterByPeriod = (orders: any[], period: string) => {
  const start = periodStart(period);
  if (!start) return orders;
  return orders.filter((o) => Number(o?.createdAt) >= start);
};

const getStatusColor = (status: string) => {
  if (status === 'Fechada') return 'green';
  if (status === 'Aberta') return 'blue';
  if (status === 'Em Analise') return 'cyan';
  if (status === 'Ag. Campo') return 'orange';
  if (status === 'Ag. Terceiros') return 'purple';
  return 'slate';
};

const formatDateTime = (ts: number) => {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

type ProviderRow = {
  name: string;
  total: number;
  active: number;
  closed: number;
  delayed: number;
  orders: any[];
};

type Props = {
  dark?: boolean;
  orders: any[];
  onSelectOrder: (order: any) => void;
  onOpenProvider: (providerName: string) => void;
};

export function AnalystProvidersLabView({ dark = false, orders, onSelectOrder, onOpenProvider }: Props) {
  const [period, setPeriod] = useState('Tudo');
  const [search, setSearch] = useState('');

  const providerRows = useMemo<ProviderRow[]>(() => {
    const scoped = filterByPeriod(Array.isArray(orders) ? orders : [], period);
    const byProvider = new Map<string, ProviderRow>();
    const now = Date.now();

    scoped.forEach((order) => {
      const provider = String(order?.provider || 'Sem provedor');
      if (!byProvider.has(provider)) {
        byProvider.set(provider, { name: provider, total: 0, active: 0, closed: 0, delayed: 0, orders: [] });
      }
      const row = byProvider.get(provider)!;
      const isClosed = order?.status === 'Fechada';
      const isActive = !isClosed;
      const deadlineAt = Number(order?.deadlineAt || 0);
      const ref = Number(order?.closedAt || now);
      const delayed = isActive && deadlineAt > 0 && ref > deadlineAt;

      row.total += 1;
      if (isActive) row.active += 1;
      if (isClosed) row.closed += 1;
      if (delayed) row.delayed += 1;
      row.orders.push(order);
    });

    return Array.from(byProvider.values())
      .filter((row) => row.name.toLowerCase().includes(search.toLowerCase().trim()))
      .sort((a, b) => b.total - a.total);
  }, [orders, period, search]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <h2 className={cn('text-2xl font-bold flex items-center gap-2', dark ? 'text-slate-100' : 'text-slate-900')}>
            <Sparkles size={18} />
            Provedores Lab
          </h2>
          <p className={cn('text-sm', dark ? 'text-slate-400' : 'text-slate-500')}>
            Versao alternativa para comparar UX de leitura dos provedores.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className={cn('p-1 rounded-xl inline-flex gap-1', dark ? 'bg-[#1e293b]/60 border border-slate-700/50' : 'bg-slate-100')}>
            {PERIODS.map((item) => (
              <button
                key={item}
                onClick={() => setPeriod(item)}
                className={cn(
                  'px-3 py-1.5 text-xs rounded font-semibold transition-colors',
                  period === item
                    ? dark
                      ? 'bg-cyan-900/30 text-cyan-300'
                      : 'bg-slate-800 text-white'
                    : dark
                      ? 'text-slate-400 hover:bg-white/5'
                      : 'text-slate-500 hover:bg-slate-200'
                )}
              >
                {item}
              </button>
            ))}
          </div>
          <div className="relative">
            <Search size={14} className={cn('absolute left-3 top-1/2 -translate-y-1/2', dark ? 'text-slate-500' : 'text-slate-400')} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar provedor..."
              className={cn(
                'pl-9 pr-3 py-2 border rounded-lg text-sm w-[220px]',
                dark ? 'bg-[#0f172a]/80 border-slate-700/50 text-slate-200' : 'bg-white border-slate-300 text-slate-900'
              )}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {providerRows.map((row) => {
          const recentOrders = [...row.orders].sort((a, b) => Number(b?.createdAt || 0) - Number(a?.createdAt || 0)).slice(0, 5);
          const total = Math.max(row.total, 1);
          const activePct = Math.round((row.active / total) * 100);
          const delayedPct = Math.round((row.delayed / total) * 100);
          const closedPct = Math.round((row.closed / total) * 100);

          return (
            <div
              key={row.name}
              className={cn(
                'rounded-2xl border p-4 shadow-sm',
                dark
                  ? 'bg-gradient-to-br from-[#0f172a] via-[#111c34] to-[#0e2230] border-slate-700/50'
                  : 'bg-gradient-to-br from-white via-slate-50 to-cyan-50 border-slate-200'
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className={cn('text-xs uppercase tracking-wider', dark ? 'text-cyan-400' : 'text-cyan-700')}>Provedor</div>
                  <div className={cn('text-xl font-bold', dark ? 'text-slate-100' : 'text-slate-900')}>{row.name}</div>
                </div>
                <button
                  onClick={() => onOpenProvider(row.name)}
                  className={cn(
                    'px-3 py-1.5 rounded-lg border text-xs font-bold transition-colors',
                    dark
                      ? 'bg-cyan-900/30 border-cyan-700/50 text-cyan-300 hover:bg-cyan-900/50'
                      : 'bg-cyan-50 border-cyan-200 text-cyan-700 hover:bg-cyan-100'
                  )}
                >
                  Abrir detalhe
                </button>
              </div>

              <div className="grid grid-cols-4 gap-2 mt-4">
                <div className={cn('rounded-lg p-2 border', dark ? 'border-slate-700/50 bg-[#0b1328]' : 'border-slate-200 bg-white')}>
                  <div className="text-[11px] text-slate-500">Total</div>
                  <div className={cn('text-lg font-bold', dark ? 'text-slate-200' : 'text-slate-800')}>{row.total}</div>
                </div>
                <div className={cn('rounded-lg p-2 border', dark ? 'border-indigo-700/40 bg-[#0b1328]' : 'border-indigo-200 bg-indigo-50')}>
                  <div className="text-[11px] text-slate-500">Ativas</div>
                  <div className={cn('text-lg font-bold', dark ? 'text-indigo-300' : 'text-indigo-700')}>{row.active}</div>
                </div>
                <div className={cn('rounded-lg p-2 border', dark ? 'border-rose-700/40 bg-[#0b1328]' : 'border-rose-200 bg-rose-50')}>
                  <div className="text-[11px] text-slate-500">Atraso</div>
                  <div className="text-lg font-bold text-rose-500">{row.delayed}</div>
                </div>
                <div className={cn('rounded-lg p-2 border', dark ? 'border-emerald-700/40 bg-[#0b1328]' : 'border-emerald-200 bg-emerald-50')}>
                  <div className="text-[11px] text-slate-500">Fechadas</div>
                  <div className="text-lg font-bold text-emerald-500">{row.closed}</div>
                </div>
              </div>

              <div className="mt-4 space-y-2">
                <div>
                  <div className="text-[11px] uppercase text-slate-500 mb-1">Carga ativa ({activePct}%)</div>
                  <div className={cn('h-2 rounded-full', dark ? 'bg-slate-800' : 'bg-slate-200')}>
                    <div className="h-2 rounded-full bg-indigo-500" style={{ width: `${activePct}%` }} />
                  </div>
                </div>
                <div>
                  <div className="text-[11px] uppercase text-slate-500 mb-1">Risco atraso ({delayedPct}%)</div>
                  <div className={cn('h-2 rounded-full', dark ? 'bg-slate-800' : 'bg-slate-200')}>
                    <div className="h-2 rounded-full bg-rose-500" style={{ width: `${delayedPct}%` }} />
                  </div>
                </div>
                <div>
                  <div className="text-[11px] uppercase text-slate-500 mb-1">Resolucao ({closedPct}%)</div>
                  <div className={cn('h-2 rounded-full', dark ? 'bg-slate-800' : 'bg-slate-200')}>
                    <div className="h-2 rounded-full bg-emerald-500" style={{ width: `${closedPct}%` }} />
                  </div>
                </div>
              </div>

              <div className="mt-4">
                <div className="text-[11px] uppercase text-slate-500 mb-2">Ultimas O.S</div>
                <div className="space-y-2">
                  {recentOrders.map((order) => (
                    <button
                      key={String(order?.id || Math.random())}
                      onClick={() => onSelectOrder(order)}
                      className={cn(
                        'w-full text-left border rounded-lg p-2 transition-colors',
                        dark ? 'border-slate-700/50 bg-[#0b1328] hover:bg-[#13203d]' : 'border-slate-200 bg-white hover:bg-slate-50'
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className={cn('font-mono text-xs', dark ? 'text-slate-300' : 'text-slate-700')}>{String(order?.protocol || '-')}</span>
                        <ErpBadge color={getStatusColor(String(order?.status || ''))}>{String(order?.status || '-')}</ErpBadge>
                      </div>
                      <div className={cn('text-xs mt-1 truncate', dark ? 'text-slate-400' : 'text-slate-600')}>{String(order?.type || '-')}</div>
                      <div className="text-[11px] text-slate-500 mt-1">{formatDateTime(Number(order?.createdAt || Date.now()))}</div>
                    </button>
                  ))}
                  {recentOrders.length === 0 && <div className="text-xs text-slate-500">Sem O.S neste periodo.</div>}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {providerRows.length === 0 && (
        <div className={cn('border rounded-xl p-8 text-center text-sm', dark ? 'bg-[#1e293b]/60 border-slate-700/50 text-slate-400' : 'bg-white border-slate-200 text-slate-500')}>
          Nenhum provedor encontrado para os filtros atuais.
        </div>
      )}
    </div>
  );
}

export default AnalystProvidersLabView;
