'use client';

import React, { useEffect, useMemo, useState } from 'react';

type GlobalOrdersViewModuleProps = {
  orders: any[];
  onSelectOS: (order: any) => void;
  title?: string;
  showTenantFilter?: boolean;
  helpers: any;
};

export function GlobalOrdersViewModule({
  orders,
  onSelectOS,
  title = 'Ordens Globais',
  showTenantFilter = false,
  helpers,
}: GlobalOrdersViewModuleProps) {
  const {
    useTheme,
    toInputDate,
    DAY_MS,
    buildWindow,
    filterOrdersByWindow,
    isActive,
    isClosed,
    STATUSES,
    PRIORITIES,
    getDelayHours,
    isOverdueActive,
    formatDateTime,
    cn,
    WindowControls,
    Search,
    ServiceTypeBadge,
    Badge,
    getPriorityColor,
    getStatusColor,
  } = helpers;

  const { dark } = useTheme();
  const [period, setPeriod] = useState('7d');
  const [customRange, setCustomRange] = useState({ start: toInputDate(Date.now() - 7 * DAY_MS), end: toInputDate(Date.now()) });

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('Todas');
  const [providerFilter, setProviderFilter] = useState('Todos');
  const [techFilter, setTechFilter] = useState('Todos');
  const [typeFilter, setTypeFilter] = useState('Todos');
  const [priorityFilter, setPriorityFilter] = useState('Todas');
  const [sgpFilter, setSgpFilter] = useState('Todos');
  const [page, setPage] = useState(1);

  const PAGE_SIZE = 50;
  const window = useMemo(() => buildWindow(period, customRange), [period, customRange]);
  const scoped = useMemo(() => filterOrdersByWindow(orders, window, 'createdAt'), [orders, window]);

  const providerOptions = useMemo(() => ['Todos', ...Array.from(new Set(orders.map((o) => o.provider))).sort()], [orders]);
  const techOptions = useMemo(() => ['Todos', 'Sem tecnico', ...Array.from(new Set(orders.map((o) => o.tech).filter(Boolean))).sort()], [orders]);
  const typeOptions = useMemo(() => ['Todos', ...Array.from(new Set(orders.map((o) => o.type))).sort()], [orders]);
  const sgpOptions = useMemo(() => ['Todos', ...Array.from(new Set(orders.map((o) => o.sgpStatus))).sort()], [orders]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();

    return scoped.filter((o: any) => {
      const matchSearch =
        !q ||
        o.protocol.toLowerCase().includes(q) ||
        o.provider.toLowerCase().includes(q) ||
        (o.tech || '').toLowerCase().includes(q) ||
        o.type.toLowerCase().includes(q) ||
        (o.clientName || '').toLowerCase().includes(q);

      const matchStatus =
        statusFilter === 'Todas'
          ? true
          : statusFilter === 'Ativas'
            ? isActive(o)
            : statusFilter === 'Fechadas'
              ? isClosed(o)
              : o.status === statusFilter;

      const matchProvider = providerFilter === 'Todos' ? true : o.provider === providerFilter;
      const matchTech = techFilter === 'Todos' ? true : techFilter === 'Sem tecnico' ? !o.tech : o.tech === techFilter;
      const matchType = typeFilter === 'Todos' ? true : o.type === typeFilter;
      const matchPriority = priorityFilter === 'Todas' ? true : o.priority === priorityFilter;
      const matchSgp = sgpFilter === 'Todos' ? true : o.sgpStatus === sgpFilter;

      return matchSearch && matchStatus && matchProvider && matchTech && matchType && matchPriority && matchSgp;
    });
  }, [scoped, search, statusFilter, providerFilter, techFilter, typeFilter, priorityFilter, sgpFilter]);

  useEffect(() => {
    setPage(1);
  }, [period, customRange, search, statusFilter, providerFilter, techFilter, typeFilter, priorityFilter, sgpFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const rows = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-end md:items-start gap-4">
        <div>
          <h2 className={cn('text-2xl font-bold tracking-tight', dark ? 'text-slate-100' : 'text-slate-900')}>{title}</h2>
          <p className={cn('text-sm', dark ? 'text-slate-400' : 'text-slate-500')}>Lista mestra de chamados com filtros avancados.</p>
        </div>
        <WindowControls period={period} setPeriod={setPeriod} customRange={customRange} setCustomRange={setCustomRange} />
      </div>

      <div className={cn('p-4 rounded-xl border shadow-sm grid grid-cols-1 md:grid-cols-12 gap-3', dark ? 'bg-[#111b2e]/75 border-slate-700/60 shadow-[0_12px_32px_rgba(2,6,23,0.35)]' : 'bg-white border-slate-200')}>
        <div className="md:col-span-4 relative">
          <Search className={cn('absolute left-3 top-1/2 -translate-y-1/2', dark ? 'text-slate-500' : 'text-slate-400')} size={16} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Pesquisar protocolo, provedor, tecnico..."
            className={cn('w-full pl-10 pr-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500', dark ? 'bg-[#0d1628]/80 border-slate-700/60 text-slate-200 placeholder:text-slate-500' : 'border-slate-200')}
          />
        </div>

        <div className="md:col-span-2">
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={cn('w-full px-3 py-2 border rounded-lg text-sm', dark ? 'bg-[#0d1628]/80 border-slate-700/60 text-slate-200' : 'border-slate-200')}>
            <option>Todas</option>
            <option>Ativas</option>
            <option>Fechadas</option>
            {STATUSES.map((s: string) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </div>

        <div className="md:col-span-2">
          <select value={providerFilter} onChange={(e) => setProviderFilter(e.target.value)} className={cn('w-full px-3 py-2 border rounded-lg text-sm', dark ? 'bg-[#0d1628]/80 border-slate-700/60 text-slate-200' : 'border-slate-200')}>
            {providerOptions.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </div>

        <div className="md:col-span-2">
          <select value={techFilter} onChange={(e) => setTechFilter(e.target.value)} className={cn('w-full px-3 py-2 border rounded-lg text-sm', dark ? 'bg-[#0d1628]/80 border-slate-700/60 text-slate-200' : 'border-slate-200')}>
            {techOptions.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </div>

        <div className="md:col-span-2">
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className={cn('w-full px-3 py-2 border rounded-lg text-sm', dark ? 'bg-[#0d1628]/80 border-slate-700/60 text-slate-200' : 'border-slate-200')}>
            {typeOptions.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </div>

        <div className="md:col-span-2">
          <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)} className={cn('w-full px-3 py-2 border rounded-lg text-sm', dark ? 'bg-[#0d1628]/80 border-slate-700/60 text-slate-200' : 'border-slate-200')}>
            <option>Todas</option>
            {PRIORITIES.map((p: string) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </div>

        <div className="md:col-span-2">
          <select value={sgpFilter} onChange={(e) => setSgpFilter(e.target.value)} className={cn('w-full px-3 py-2 border rounded-lg text-sm', dark ? 'bg-[#0d1628]/80 border-slate-700/60 text-slate-200' : 'border-slate-200')}>
            {sgpOptions.map((s: string) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </div>

        {showTenantFilter && (
          <div className={cn('md:col-span-4 flex items-center text-xs', dark ? 'text-slate-400' : 'text-slate-500')}>
            Modo admin: visualizando todos os tenants.
          </div>
        )}
      </div>

      <div className={cn('rounded-xl shadow-sm border overflow-hidden', dark ? 'bg-[#111b2e]/75 border-slate-700/60 shadow-[0_12px_32px_rgba(2,6,23,0.35)]' : 'bg-white border-slate-200')}>
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-sm">
            <thead className={cn('border-b', dark ? 'bg-[#0d1628]/95 text-slate-400 border-slate-700/60' : 'bg-slate-50 text-slate-500 border-slate-200')}>
              <tr>
                <th className="px-6 py-3 text-left text-xs uppercase font-mono">Protocolo</th>
                <th className="px-6 py-3 text-left text-xs uppercase font-mono">Provedor</th>
                <th className="px-6 py-3 text-left text-xs uppercase font-mono">Tecnico</th>
                <th className="px-6 py-3 text-left text-xs uppercase font-mono">Tipo</th>
                <th className="px-6 py-3 text-left text-xs uppercase font-mono">Prioridade</th>
                <th className="px-6 py-3 text-left text-xs uppercase font-mono">Status</th>
                <th className="px-6 py-3 text-left text-xs uppercase font-mono">SGP</th>
                <th className="px-6 py-3 text-right text-xs uppercase font-mono">Prazo</th>
                <th className="px-6 py-3 text-right text-xs uppercase font-mono">Delay</th>
                <th className="px-6 py-3 text-center text-xs uppercase font-mono">Acao</th>
              </tr>
            </thead>
            <tbody className={cn('divide-y', dark ? 'divide-slate-700/50' : 'divide-slate-100')}>
              {rows.map((o: any) => {
                const delay = getDelayHours(o).toFixed(2);
                return (
                  <tr key={o.id} className={cn(dark ? 'hover:bg-white/[0.03]' : 'hover:bg-slate-50/80')}>
                    <td className={cn('px-6 py-3 font-mono font-medium', dark ? 'text-slate-200' : 'text-slate-700')}>{o.protocol}</td>
                    <td className={cn('px-6 py-3', dark ? 'text-slate-200' : 'text-slate-700')}>{o.provider}</td>
                    <td className={cn('px-6 py-3', dark ? 'text-slate-400' : 'text-slate-600')}>{o.tech || '-'}</td>
                    <td className="px-6 py-3">
                      <ServiceTypeBadge type={o.type} />
                    </td>
                    <td className="px-6 py-3">
                      <Badge color={getPriorityColor(o.priority)} dark={dark}>{o.priority}</Badge>
                    </td>
                    <td className="px-6 py-3">
                      <Badge color={getStatusColor(o.status)} dark={dark}>{o.status}</Badge>
                    </td>
                    <td className={cn('px-6 py-3 text-xs', dark ? 'text-slate-400' : 'text-slate-600')}>{o.sgpStatus}</td>
                    <td className={cn('px-6 py-3 text-right font-mono text-xs', isOverdueActive(o) ? 'text-rose-600 font-bold' : dark ? 'text-slate-400' : 'text-slate-500')}>
                      {o.deadlineAt ? formatDateTime(o.deadlineAt) : 'Sem prazo'}
                    </td>
                    <td className={cn('px-6 py-3 text-right font-mono text-xs', parseFloat(delay) > 0 ? 'text-rose-600 font-bold' : 'text-slate-400')}>
                      {delay}
                    </td>
                    <td className="px-6 py-3 text-center">
                      <button
                        onClick={() => onSelectOS(o)}
                        className={cn('px-3 py-1 rounded text-[10px] font-bold border', dark ? 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30 hover:bg-cyan-500/20' : 'bg-cyan-50 text-cyan-700 border-cyan-200 hover:bg-cyan-100')}
                      >
                        Ver
                      </button>
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={10} className={cn('px-6 py-12 text-center', dark ? 'text-slate-500' : 'text-slate-400')}>
                    Nenhum registro encontrado com os filtros atuais.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className={cn('px-6 py-3 border-t flex justify-between items-center', dark ? 'bg-[#0d1628]/80 border-slate-700/60' : 'bg-slate-50 border-slate-200')}>
          <span className={cn('text-xs', dark ? 'text-slate-400' : 'text-slate-500')}>
            Pagina <strong>{currentPage}</strong> de <strong>{totalPages}</strong> ({filtered.length} registros)
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className={cn('px-3 py-1.5 border rounded text-xs font-medium disabled:opacity-40', dark ? 'bg-[#0c1528] border-slate-700/60 text-slate-300 hover:bg-white/[0.04]' : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-50')}
            >
              Anterior
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className={cn('px-3 py-1.5 border rounded text-xs font-medium disabled:opacity-40', dark ? 'bg-[#0c1528] border-slate-700/60 text-slate-300 hover:bg-white/[0.04]' : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-50')}
            >
              Proximo
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
