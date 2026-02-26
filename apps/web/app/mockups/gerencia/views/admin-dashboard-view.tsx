'use client';

import React, { useMemo, useState } from 'react';

type AdminDashboardViewModuleProps = {
  orders: any[];
  tenants: any[];
  onSelectOS: (order: any) => void;
  loading: boolean;
  helpers: any;
};

export function AdminDashboardViewModule({ orders, tenants, onSelectOS, loading, helpers }: AdminDashboardViewModuleProps) {
  const {
    useTheme,
    toInputDate,
    DAY_MS,
    buildWindow,
    buildAdminAnalytics,
    cn,
    SkeletonKpiCards,
    SkeletonTable,
    formatNumber,
    formatPercent,
    WindowControls,
    DualAreaChart,
    TrendingUp,
    Shield,
    Badge,
    ServiceTypeBadge,
    getDelayHours,
  } = helpers;

  const { dark } = useTheme();
  const [period, setPeriod] = useState('30d');
  const [customRange, setCustomRange] = useState({ start: toInputDate(Date.now() - 30 * DAY_MS), end: toInputDate(Date.now()) });

  const [syncSettings, setSyncSettings] = useState({
    enabled: true,
    syncInterval: 20,
    heartbeatInterval: 20,
    lastSync: '10 min atras',
    lastHeartbeat: '2 min atras',
  });

  const now = Date.now();
  const window = useMemo(() => buildWindow(period, customRange), [period, customRange]);
  const data = useMemo(() => buildAdminAnalytics(orders, tenants, window, now), [orders, tenants, window, now]);
  const panelClass = cn('rounded-xl border shadow-sm', dark ? 'bg-[#111b2e]/75 border-slate-700/60 shadow-[0_12px_32px_rgba(2,6,23,0.35)]' : 'bg-white border-slate-200');
  const kpiClass = cn('rounded-xl border p-4', dark ? 'bg-[#111b2e]/75 border-slate-700/60' : 'bg-white border-slate-200');

  if (loading) return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <h2 className={cn('text-2xl font-bold', dark ? 'text-slate-100' : 'text-slate-900')}>War Room Admin</h2>
        <p className={cn('text-sm mt-1', dark ? 'text-slate-400' : 'text-slate-500')}>Carregando dados administrativos...</p>
      </div>
      <SkeletonKpiCards count={4} />
      <SkeletonTable rows={5} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4"><SkeletonTable rows={5} /><SkeletonTable rows={5} /></div>
    </div>
  );

  const maxSla = Math.max(1, data.sla_distribution.within_deadline + data.sla_distribution.overdue + data.sla_distribution.without_deadline);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
          <h2 className={cn('text-2xl font-bold tracking-tight', dark ? 'text-slate-100' : 'text-slate-900')}>War Room Admin</h2>
          <p className={cn('text-sm', dark ? 'text-slate-400' : 'text-slate-500')}>Painel executivo consolidado (v2+)</p>
        </div>
        <WindowControls period={period} setPeriod={setPeriod} customRange={customRange} setCustomRange={setCustomRange} />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-3">
        <div className={kpiClass}>
          <div className={cn('text-[10px] uppercase font-bold', dark ? 'text-slate-500' : 'text-slate-400')}>Tenants Totais</div>
          <div className={cn('text-2xl font-bold', dark ? 'text-slate-100' : 'text-slate-800')}>{formatNumber(data.kpis.tenants_total)}</div>
        </div>
        <div className={kpiClass}>
          <div className={cn('text-[10px] uppercase font-bold', dark ? 'text-slate-500' : 'text-slate-400')}>Provedores no Periodo</div>
          <div className={cn('text-2xl font-bold', dark ? 'text-indigo-300' : 'text-indigo-700')}>{formatNumber(data.kpis.providers_in_period)}</div>
        </div>
        <div className={kpiClass}>
          <div className={cn('text-[10px] uppercase font-bold', dark ? 'text-slate-500' : 'text-slate-400')}>Criadas</div>
          <div className={cn('text-2xl font-bold', dark ? 'text-cyan-300' : 'text-sky-700')}>{formatNumber(data.kpis.created_in_period)}</div>
        </div>
        <div className={kpiClass}>
          <div className={cn('text-[10px] uppercase font-bold', dark ? 'text-slate-500' : 'text-slate-400')}>Encerradas</div>
          <div className={cn('text-2xl font-bold', dark ? 'text-emerald-300' : 'text-emerald-700')}>{formatNumber(data.kpis.closed_in_period)}</div>
        </div>
        <div className={kpiClass}>
          <div className={cn('text-[10px] uppercase font-bold', dark ? 'text-slate-500' : 'text-slate-400')}>Taxa Conclusao</div>
          <div className={cn('text-2xl font-bold', dark ? 'text-slate-100' : 'text-slate-800')}>{formatPercent(data.kpis.closure_rate)}</div>
        </div>
        <div className={kpiClass}>
          <div className={cn('text-[10px] uppercase font-bold', dark ? 'text-slate-500' : 'text-slate-400')}>TMA</div>
          <div className={cn('text-2xl font-bold', dark ? 'text-amber-300' : 'text-amber-700')}>{data.kpis.avg_resolution_hours.toFixed(1)}h</div>
        </div>
        <div className={kpiClass}>
          <div className={cn('text-[10px] uppercase font-bold', dark ? 'text-slate-500' : 'text-slate-400')}>Backlog Ativo</div>
          <div className={cn('text-2xl font-bold', dark ? 'text-slate-100' : 'text-slate-800')}>{formatNumber(data.kpis.active_now)}</div>
        </div>
        <div className={cn(kpiClass, dark ? 'border-rose-500/30 bg-rose-500/10' : 'border-rose-200 bg-rose-50/30')}>
          <div className={cn('text-[10px] uppercase font-bold', dark ? 'text-rose-300' : 'text-rose-500')}>Atrasadas Ativas</div>
          <div className={cn('text-2xl font-bold', dark ? 'text-rose-300' : 'text-rose-700')}>{formatNumber(data.kpis.overdue_active_now)}</div>
        </div>
        <div className={cn(kpiClass, dark ? 'border-amber-500/30 bg-amber-500/10' : 'border-amber-200 bg-amber-50/30')}>
          <div className={cn('text-[10px] uppercase font-bold', dark ? 'text-amber-300' : 'text-amber-600')}>Vencem Hoje</div>
          <div className={cn('text-2xl font-bold', dark ? 'text-amber-300' : 'text-amber-700')}>{formatNumber(data.kpis.due_today_active)}</div>
        </div>
        <div className={kpiClass}>
          <div className={cn('text-[10px] uppercase font-bold', dark ? 'text-slate-500' : 'text-slate-400')}>Taxa Atraso Fechamento</div>
          <div className={cn('text-2xl font-bold', dark ? 'text-rose-300' : 'text-rose-600')}>{formatPercent(data.kpis.late_closed_rate)}</div>
        </div>
        <div className={kpiClass}>
          <div className={cn('text-[10px] uppercase font-bold', dark ? 'text-slate-500' : 'text-slate-400')}>Sem Prazo (janela)</div>
          <div className={cn('text-2xl font-bold', dark ? 'text-slate-200' : 'text-slate-700')}>{formatNumber(data.data_quality.missing_deadline_in_window)}</div>
        </div>
        <div className={kpiClass}>
          <div className={cn('text-[10px] uppercase font-bold', dark ? 'text-slate-500' : 'text-slate-400')}>Ativas sem Tecnico</div>
          <div className={cn('text-2xl font-bold', dark ? 'text-slate-200' : 'text-slate-700')}>{formatNumber(data.data_quality.missing_technician_active)}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        <div className={cn('xl:col-span-3 p-6', panelClass)}>
          <h3 className={cn('font-bold text-lg mb-4 flex items-center gap-2', dark ? 'text-slate-100' : 'text-slate-800')}>
            <TrendingUp size={16} className={cn(dark ? 'text-indigo-300' : 'text-indigo-600')} />
            Fluxo Diario Consolidado
          </h3>
          <DualAreaChart data={data.volume_chart} />
        </div>

        <div className={cn('p-6', panelClass)}>
          <h3 className={cn('font-bold mb-4 flex items-center gap-2', dark ? 'text-slate-100' : 'text-slate-800')}>
            <Shield size={16} className={cn(dark ? 'text-emerald-300' : 'text-emerald-600')} />
            Saude SLA (Ativas)
          </h3>
          <div className="space-y-3">
            <div>
              <div className={cn('flex justify-between text-xs mb-1', dark ? 'text-slate-300' : 'text-slate-600')}>
                <span>No prazo</span>
                <span>{formatNumber(data.sla_distribution.within_deadline)}</span>
              </div>
              <div className={cn('h-2 rounded-full overflow-hidden', dark ? 'bg-slate-800' : 'bg-slate-100')}>
                <div className="h-full bg-emerald-500" style={{ width: `${(data.sla_distribution.within_deadline / maxSla) * 100}%` }} />
              </div>
            </div>
            <div>
              <div className={cn('flex justify-between text-xs mb-1', dark ? 'text-slate-300' : 'text-slate-600')}>
                <span>Atrasadas</span>
                <span>{formatNumber(data.sla_distribution.overdue)}</span>
              </div>
              <div className={cn('h-2 rounded-full overflow-hidden', dark ? 'bg-slate-800' : 'bg-slate-100')}>
                <div className="h-full bg-rose-500" style={{ width: `${(data.sla_distribution.overdue / maxSla) * 100}%` }} />
              </div>
            </div>
            <div>
              <div className={cn('flex justify-between text-xs mb-1', dark ? 'text-slate-300' : 'text-slate-600')}>
                <span>Sem prazo</span>
                <span>{formatNumber(data.sla_distribution.without_deadline)}</span>
              </div>
              <div className={cn('h-2 rounded-full overflow-hidden', dark ? 'bg-slate-800' : 'bg-slate-100')}>
                <div className="h-full bg-slate-400" style={{ width: `${(data.sla_distribution.without_deadline / maxSla) * 100}%` }} />
              </div>
            </div>
          </div>

          <div className={cn('mt-6 pt-4 border-t text-xs space-y-1', dark ? 'border-slate-700/60 text-slate-400' : 'text-slate-500')}>
            <div>Sync: {syncSettings.enabled ? 'Ativo' : 'Desligado'}</div>
            <div>Intervalo Sync: {syncSettings.syncInterval} min</div>
            <div>Heartbeat: {syncSettings.heartbeatInterval} min</div>
            <div>Ultimo Sync: {syncSettings.lastSync}</div>
            <div>Ultimo Heartbeat: {syncSettings.lastHeartbeat}</div>
          </div>

          <div className="flex gap-2 mt-4">
            <button
              onClick={() => setSyncSettings((s: any) => ({ ...s, enabled: !s.enabled }))}
              className={cn('flex-1 px-3 py-2 border rounded-lg text-xs font-semibold', dark ? 'border-slate-700/60 text-slate-200 hover:bg-white/[0.04]' : 'border-slate-200 hover:bg-slate-50')}
            >
              {syncSettings.enabled ? 'Desativar' : 'Ativar'}
            </button>
            <button className="flex-1 px-3 py-2 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700">
              Salvar
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className={cn('rounded-xl border overflow-hidden', panelClass)}>
          <div className={cn('px-4 py-3 border-b font-bold text-sm', dark ? 'bg-[#0d1628]/80 border-slate-700/60 text-slate-200' : 'bg-slate-50 border-slate-200')}>Top Provedores</div>
          <div className={cn('divide-y', dark ? 'divide-slate-700/50' : 'divide-slate-200')}>
            {data.top_providers.map((p: any) => (
              <div key={p.name} className={cn('px-4 py-3 flex items-center justify-between', dark ? 'hover:bg-white/[0.03]' : '')}>
                <div>
                  <div className={cn('font-semibold', dark ? 'text-slate-100' : 'text-slate-800')}>{p.name}</div>
                  <div className={cn('text-xs', dark ? 'text-slate-400' : 'text-slate-500')}>{p.city}</div>
                </div>
                <Badge color="blue" dark={dark}>{p.total}</Badge>
              </div>
            ))}
          </div>
        </div>

        <div className={cn('rounded-xl border overflow-hidden', panelClass)}>
          <div className={cn('px-4 py-3 border-b font-bold text-sm', dark ? 'bg-[#0d1628]/80 border-slate-700/60 text-slate-200' : 'bg-slate-50 border-slate-200')}>Top Tecnicos</div>
          <div className={cn('divide-y', dark ? 'divide-slate-700/50' : 'divide-slate-200')}>
            {data.top_technicians.map((t: any) => (
              <div key={t.name} className={cn('px-4 py-3 flex items-center justify-between', dark ? 'hover:bg-white/[0.03]' : '')}>
                <div>
                  <div className={cn('font-semibold', dark ? 'text-slate-100' : 'text-slate-800')}>{t.name}</div>
                  <div className={cn('text-xs', dark ? 'text-slate-400' : 'text-slate-500')}>{t.specialization}</div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge color="cyan" dark={dark}>{t.created}</Badge>
                  <Badge color={t.delayed > 0 ? 'red' : 'green'} dark={dark}>{t.delayed}</Badge>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className={cn('rounded-xl border overflow-hidden', panelClass)}>
          <div className={cn('px-4 py-3 border-b font-bold text-sm', dark ? 'bg-[#0d1628]/80 border-slate-700/60 text-slate-200' : 'bg-slate-50 border-slate-200')}>Top Tipos de Servico</div>
          <div className={cn('divide-y', dark ? 'divide-slate-700/50' : 'divide-slate-200')}>
            {data.top_service_types.map((t: any) => (
              <div key={t.name} className={cn('px-4 py-3 flex items-center justify-between', dark ? 'hover:bg-white/[0.03]' : '')}>
                <ServiceTypeBadge type={t.name} />
                <Badge color="purple" dark={dark}>{t.total}</Badge>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className={cn('rounded-xl border overflow-hidden', panelClass)}>
        <div className={cn('px-6 py-3 border-b font-bold text-sm', dark ? 'bg-[#0d1628]/80 border-slate-700/60 text-slate-200' : 'bg-slate-50/50 text-slate-700 border-slate-200')}>
          Criticas em Risco (atrasadas)
        </div>
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-sm">
            <thead className={cn(dark ? 'bg-[#0d1628]/95 text-slate-400' : 'bg-slate-50 text-slate-500')}>
              <tr>
                <th className="px-6 py-3 text-left">Protocolo</th>
                <th className="px-6 py-3 text-left">Provedor</th>
                <th className="px-6 py-3 text-left">Tecnico</th>
                <th className="px-6 py-3 text-left">Tipo</th>
                <th className="px-6 py-3 text-right">Delay (h)</th>
                <th className="px-6 py-3 text-center">Acao</th>
              </tr>
            </thead>
            <tbody className={cn('divide-y', dark ? 'divide-slate-700/50' : 'divide-slate-200')}>
              {data.critical_overdue.map((o: any) => (
                <tr key={o.id} className={cn(dark ? 'hover:bg-white/[0.03]' : 'hover:bg-slate-50')}>
                  <td className={cn('px-6 py-3 font-mono', dark ? 'text-slate-200' : '')}>{o.protocol}</td>
                  <td className={cn('px-6 py-3', dark ? 'text-slate-200' : '')}>{o.provider}</td>
                  <td className={cn('px-6 py-3', dark ? 'text-slate-300' : '')}>{o.tech || '-'}</td>
                  <td className="px-6 py-3">
                    <ServiceTypeBadge type={o.type} />
                  </td>
                  <td className="px-6 py-3 text-right font-mono font-bold text-rose-600">{getDelayHours(o).toFixed(2)}</td>
                  <td className="px-6 py-3 text-center">
                    <button
                      onClick={() => onSelectOS(o)}
                      className={cn('px-3 py-1 rounded text-[10px] font-bold border', dark ? 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30 hover:bg-cyan-500/20' : 'bg-cyan-50 text-cyan-700 border-cyan-200 hover:bg-cyan-100')}
                    >
                      Ver
                    </button>
                  </td>
                </tr>
              ))}
              {data.critical_overdue.length === 0 && (
                <tr>
                  <td colSpan={6} className={cn('px-6 py-8 text-center', dark ? 'text-slate-500' : 'text-slate-400')}>
                    Nenhuma OS critica atrasada no momento.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
