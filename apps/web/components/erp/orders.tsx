'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams, usePathname } from 'next/navigation';
import {
  ArrowLeft,
  ArrowDownToLine,
  Zap,
  Search,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  LayoutGrid,
  List,
  Clock3,
  MessageSquare,
  Paperclip,
  Send,
  CheckCircle2,
  ClipboardList,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Field, FieldLabel } from '@/components/ui/field';
import type { Order } from '@/lib/demo-data';
import { exportCsv, useOrders } from '@/lib/demo-store';
import { cn } from '@/lib/utils';
import {
  PageHeading,
  PanelHeading,
  Priority,
  StatusBadge,
  Avatar,
  SearchEmpty,
  Metric,
} from './primitives';
import { OrderForm } from './order-form';
import { useVisualSource, useRouteBase } from '@/lib/erp/visual-data';
import { useErp, useErpQuery } from '@/lib/erp/gateway';
import {
  nextStatusOptions,
  orderStatuses,
  orderTypes,
  priorities,
  queryPath,
} from '@/lib/erp/contracts';
const statuses = Object.values(orderStatuses);
import { RecordWorkspace } from './record-workspace';
import { OperationControl } from './operation-controls';
import { QueryState } from './contract-form';
import { QuickDispatchDialog } from './quick-dispatch-dialog';
import { downloadOrderPdf } from '@/lib/erp/order-pdf';
import { AnalystOrderWork } from './analyst-order-work';
import { deadlineSituation } from '@/lib/erp/analyst-workspace';

const deadlineFilters = {
  overdue: 'Atrasadas',
  today: 'Vencem hoje',
  soon: 'Vencem em até 2h',
  paused: 'Pausadas',
  without: 'Sem prazo de SLA',
};
function filterDate(value: string) {
  if (!value) return undefined;
  const parsed = new Date(
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value) ? `${value}:00-03:00` : value,
  );
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : undefined;
}
const orderSorts = {
  recent: { label: 'Mais recentes', orderBy: 'createdAt', orderDir: 'desc' },
  deadline: { label: 'Menor prazo primeiro', orderBy: 'deadlineAt', orderDir: 'asc' },
  priority: { label: 'Maior prioridade primeiro', orderBy: 'priority', orderDir: 'desc' },
} as const;
export function OrdersTable({
  orders,
  compact = false,
  attention,
  listQuery,
}: {
  orders: Order[];
  compact?: boolean;
  listQuery?: string;
  attention?: Record<string, { label: string; tone: string }>;
}) {
  const pathname = usePathname();
  const orderBase = pathname.startsWith('/analista')
    ? '/analista'
    : pathname.startsWith('/cliente') || pathname.startsWith('/portal')
      ? '/cliente'
      : '/gerencia';
  const detailHref = (id: string) =>
    `${orderBase}/ordens/${id}${listQuery ? `?list=${encodeURIComponent(listQuery)}` : ''}`;
  return (
    <div className="table-wrap relative">
      <table className="data-table">
        <thead>
          <tr>
            <th>Ordem de serviço</th>
            <th>Provedor</th>
            <th>Status</th>
            <th>Prioridade</th>
            {attention && compact && <th>O que precisa de atenção</th>}
            {!compact && (
              <>
                <th>Responsável</th>
                <th>Prazo</th>
              </>
            )}
            <th>
              <span className="sr-only">Detalhes</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => (
            <tr key={o.id}>
              <td>
                <Link href={detailHref(o.id)} className="block">
                  <span className="mb-1 block text-[9px] text-muted-foreground">
                    #{o.protocol || o.id}
                  </span>
                  <span className="font-medium hover:text-primary">{o.title}</span>
                </Link>
              </td>
              <td>
                <span className="flex items-center gap-2">
                  <span
                    className={cn(
                      'flex size-6 items-center justify-center rounded-md text-[8px] font-medium',
                      o.initials === 'CT'
                        ? 'bg-secondary text-primary'
                        : o.initials === 'NM'
                          ? 'bg-warning/10 text-warning'
                          : 'bg-info/10 text-info',
                    )}
                  >
                    {o.initials}
                  </span>
                  {o.provider}
                </span>
              </td>
              <td>
                <StatusBadge status={o.status} />
              </td>
              <td>
                <Priority value={o.priority} />
              </td>
              {attention && compact && (
                <td>
                  <span
                    className={cn(
                      'text-xs',
                      attention[o.id]?.tone === 'danger'
                        ? 'text-rose-600 dark:text-rose-400'
                        : attention[o.id]?.tone === 'warning'
                          ? 'text-amber-600 dark:text-amber-300'
                          : 'text-muted-foreground',
                    )}
                  >
                    {attention[o.id]?.label || '—'}
                  </span>
                </td>
              )}
              {!compact && (
                <>
                  <td>
                    <span className="flex items-center gap-2">
                      <Avatar name={o.analyst} />
                      {o.analyst}
                    </span>
                  </td>
                  <td className="text-muted-foreground">
                    <span className="text-xs">{o.deadline}</span>
                    {attention?.[o.id] && (
                      <span
                        className={cn(
                          'mt-1 block text-[11px]',
                          attention[o.id].tone === 'danger'
                            ? 'text-rose-600 dark:text-rose-400'
                            : attention[o.id].tone === 'warning'
                              ? 'text-amber-600 dark:text-amber-400'
                              : 'text-muted-foreground',
                        )}
                      >
                        {attention[o.id].label}
                      </span>
                    )}
                  </td>
                </>
              )}
              <td>
                <Link
                  href={detailHref(o.id)}
                  className="text-muted-foreground hover:text-primary"
                  aria-label={'Ver ' + o.id}
                >
                  <ChevronRight className="size-4" />
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {orders.length === 0 && <SearchEmpty />}
    </div>
  );
}
export function OrdersPage({
  customer = false,
  analyst = false,
}: {
  customer?: boolean;
  analyst?: boolean;
}) {
  const orderBase = customer ? '/cliente' : analyst ? '/analista' : '/gerencia';
  const { scope } = useErp();
  const canQuickDispatch =
    !customer && !analyst && (!scope || ['super_admin', 'gerente'].includes(scope.role));
  const [quickDispatchOpen, setQuickDispatchOpen] = useState(false);
  const params = useSearchParams();
  const orderScope = params.get('scope') === 'operation' ? 'operation' : 'mine';
  function replaceFilters(changes: Record<string, string | null>, resetPage = true) {
    const next = new URLSearchParams(window.location.search);
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    if (resetPage) next.delete('page');
    window.history.replaceState(null, '', `${orderBase}/ordens${next.size ? `?${next}` : ''}`);
  }
  const setOrderScope = (value: string) => replaceFilters({ scope: value });
  const search = params.get('search') || '';
  const setSearch = (value: string) => replaceFilters({ search: value });
  const [searchQuery, setSearchQuery] = useState(search);
  useEffect(() => {
    const timer = setTimeout(() => setSearchQuery(search), 250);
    return () => clearTimeout(timer);
  }, [search]);
  const situation = params.get('situation') || 'all';
  const sortKey = Object.hasOwn(orderSorts, params.get('sort') || '')
    ? (params.get('sort') as keyof typeof orderSorts)
    : params.get('deadline')
      ? 'deadline'
      : 'recent';
  const sort = orderSorts[sortKey];
  const deadline = Object.hasOwn(deadlineFilters, params.get('deadline') || '')
    ? params.get('deadline')!
    : '';
  const setDeadline = (value: string) =>
    replaceFilters({ deadline: value, status: null, situation: 'all' });
  const [now, setNow] = useState(() => new Date());
  const statusParam = params.get('status') || '';
  const status: string =
    orderStatuses[statusParam as keyof typeof orderStatuses] || statusParam || 'Todos';
  const setStatus = (value: string) =>
    replaceFilters({ status: value === 'Todos' ? null : value, situation: 'all' });
  const provider = params.get('provider') || 'Todos';
  const setProvider = (value: string) =>
    replaceFilters({ customerId: null, provider: value === 'Todos' ? null : value });
  const priorityParam = params.get('priority') || '';
  const priority: string =
    priorities[priorityParam as keyof typeof priorities] || priorityParam || 'Todas';
  const setPriority = (value: string) =>
    replaceFilters({ priority: value === 'Todas' ? null : value });
  const [filters, setFilters] = useState(false);
  const [view, setView] = useState('list');
  const parsedPage = Number(params.get('page') || 1);
  const page = Number.isSafeInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;
  const setPage = (value: number) =>
    replaceFilters({ page: value === 1 ? null : String(value) }, false);
  const type = params.get('type') || '';
  const setType = (value: string) => replaceFilters({ type: value });
  const from = params.get('from') || '';
  const to = params.get('to') || '';
  const setFrom = (value: string) => replaceFilters({ from: value });
  const setTo = (value: string) => replaceFilters({ to: value });
  const invalidRange = Boolean(from && to && new Date(from).getTime() > new Date(to).getTime());
  function clearFilters() {
    window.history.replaceState(
      null,
      '',
      `${orderBase}/ordens${analyst ? `?scope=${orderScope}` : ''}`,
    );
  }
  const filterValues = {
    situation: !customer && ['active', 'completed'].includes(situation) ? situation : undefined,
    scope: analyst ? orderScope : undefined,
    deadline: !customer && deadline ? deadline : undefined,
    orderBy: analyst || deadline ? sort.orderBy : undefined,
    orderDir: analyst || deadline ? sort.orderDir : undefined,
    customerId: params.get('customerId') || undefined,
    provider: provider === 'Todos' ? undefined : provider,
    // O controller aceita `search` (mínimo de 2 caracteres) e paginação por offset.
    search: searchQuery.trim().length >= 2 ? searchQuery.trim() : undefined,
    status: Object.entries(orderStatuses).find(([, label]) => label === status)?.[0],
    priority: Object.entries(priorities).find(([, label]) => label === priority)?.[0],
    type: type || undefined,
    from: !invalidRange ? filterDate(from) : undefined,
    to: !invalidRange ? filterDate(to) : undefined,
  };
  const endpoint = queryPath('/service-orders', {
    ...filterValues,
    offset: (page - 1) * 8,
    limit: 8,
  });
  const { orders } = useOrders(endpoint);
  const source = useVisualSource('orders', endpoint);
  const summary = useErpQuery<{
    total: number;
    active: number;
    closed: number;
    byPriority: Record<string, number>;
  }>(!customer ? queryPath('/service-orders/summary', filterValues) : null);
  const refreshSummary = summary.mutate;
  const refreshOrders = source.mutate;
  useEffect(() => {
    if (customer) return;
    const timer = setInterval(() => {
      setNow(new Date());
      void refreshOrders();
      void refreshSummary();
    }, 60_000);
    return () => clearInterval(timer);
  }, [customer, refreshOrders, refreshSummary]);
  const attention = Object.fromEntries(
    source.raw.map((row) => {
      const label = deadlineSituation(row, now);
      return [
        row.id,
        {
          label:
            row.status === 'CANCELADA'
              ? 'Cancelada'
              : row.scheduledAt &&
                  !row.scheduleStartedAt &&
                  !row.pausedAt &&
                  !['FECHADA', 'RESOLVIDA'].includes(String(row.status))
                ? `${label} · agendada para ${new Date(String(row.scheduledAt)).toLocaleString('pt-BR', { timeZone: 'America/Fortaleza', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}`
                : label,
          tone: label === 'Atrasada' ? 'danger' : label === 'Vence em até 2h' ? 'warning' : 'muted',
        },
      ];
    }),
  );
  const customers = useErpQuery<{ tradeName: string; legalName: string }[]>(
    !customer ? '/customers' : null,
  );
  const providers = [
    ...new Set([
      ...orders.map((order) => order.provider),
      ...(customers.data || []).map((c) => c.tradeName || c.legalName),
    ]),
  ]
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, 'pt-BR'))
    .map((name) => ({
      id: name,
      name,
    }));
  const scoped = orders;
  const filtered = scoped;
  const total = !customer
    ? summary.data?.total
    : source.data && typeof source.data === 'object' && 'total' in source.data
      ? Number(source.data.total)
      : undefined;
  const pages = total !== undefined ? Math.max(1, Math.ceil(total / 8)) : page;
  const current = page;
  function download() {
    exportCsv(
      'ajust-ordens',
      ['Protocolo', 'Título', 'Provedor', 'Status', 'Prioridade', 'Responsável'],
      filtered.map((o) => [o.id, o.title, o.provider, o.status, o.priority, o.analyst]),
    );
    toast.success('Relatório CSV exportado');
  }
  return (
    <>
      <PageHeading
        title={
          customer
            ? 'Meus chamados'
            : analyst && orderScope === 'mine'
              ? 'Minhas ordens'
              : 'Ordens de serviço'
        }
        description={
          customer
            ? 'Acompanhe suas solicitações e o andamento de cada atendimento.'
            : analyst
              ? 'Encontre o atendimento, confira a etapa atual e registre o trabalho seguindo o fluxo da gestão.'
              : 'Cada atendimento no lugar certo. Sua operação em movimento.'
        }
      >
        <Link
          href={`${orderBase}/${analyst ? 'relatorios-turno' : 'relatorios'}`}
          className="text-link"
        >
          {analyst ? 'Relatórios de turno' : 'Relatórios e exportações'}
        </Link>
        {canQuickDispatch && (
          <Button variant="outline" onClick={() => setQuickDispatchOpen(true)}>
            <Zap data-icon="inline-start" />
            Atendimento rápido
          </Button>
        )}
        {!analyst && (
          <Button variant="outline" onClick={download}>
            <ArrowDownToLine data-icon="inline-start" />
            Exportar
          </Button>
        )}
        <OrderForm />
      </PageHeading>
      {analyst && (
        <div className="mb-5 flex flex-wrap gap-2" aria-label="Escopo das ordens">
          <Button
            variant={orderScope === 'mine' ? 'default' : 'outline'}
            aria-pressed={orderScope === 'mine'}
            onClick={() => {
              setOrderScope('mine');
              setPage(1);
            }}
          >
            Minhas ordens
          </Button>
          <Button
            variant={orderScope === 'operation' ? 'default' : 'outline'}
            aria-pressed={orderScope === 'operation'}
            onClick={() => {
              setOrderScope('operation');
              setPage(1);
            }}
          >
            Todas da Ajust
          </Button>
        </div>
      )}
      <div className="mb-5 grid grid-cols-4 gap-4 metrics-grid">
        {[
          {
            label: customer ? 'Ordens nesta página' : 'Ordens encontradas',
            value: customer ? scoped.length : summary.data?.total,
            icon: ClipboardList,
          },
          {
            label: 'Pendentes',
            value: !customer
              ? summary.data?.active
              : scoped.filter(
                  (o) => !['Concluída', 'Fechada', 'Resolvida', 'Cancelada'].includes(o.status),
                ).length,
            icon: Clock3,
          },
          {
            label: 'Concluídas',
            value: !customer
              ? summary.data?.closed
              : scoped.filter((o) => ['Concluída', 'Fechada', 'Resolvida'].includes(o.status))
                  .length,
            icon: CheckCircle2,
          },
          {
            label: 'Prioridade crítica',
            value: !customer
              ? summary.data?.byPriority.CRITICA
              : scoped.filter((o) => o.priority === 'Crítica').length,
            icon: SlidersHorizontal,
          },
        ].map((m) => (
          <Metric
            key={m.label}
            label={m.label}
            value={m.value === undefined || invalidRange ? '—' : String(m.value).padStart(2, '0')}
            icon={m.icon}
            change="Conforme os filtros"
            foot={customer ? 'registros desta página' : 'todas as páginas do resultado'}
          />
        ))}
      </div>
      {summary.error && <QueryState error={summary.error} onRetry={() => void summary.mutate()} />}
      <section className="panel">
        {!customer && (
          <div
            className="flex flex-wrap items-center gap-2 border-b border-border px-5 py-3"
            aria-label="Situação das ordens"
          >
            {Object.entries({
              active: 'Pendentes',
              completed: 'Concluídas',
              all: 'Todas as ordens',
            }).map(([key, label]) => (
              <Button
                key={key}
                size="sm"
                variant={situation === key ? 'secondary' : 'ghost'}
                aria-pressed={situation === key}
                onClick={() => replaceFilters({ situation: key, deadline: null, status: null })}
              >
                {label}
              </Button>
            ))}
          </div>
        )}
        {!customer && (
          <div
            className="flex flex-wrap items-center gap-2 border-b border-border px-5 py-3"
            aria-label="Filtrar ordens por prazo"
          >
            <span className="mr-1 text-xs text-muted-foreground">Prazo</span>
            {Object.entries({ '': 'Todas', ...deadlineFilters }).map(([key, label]) => (
              <Button
                key={key}
                size="sm"
                variant={deadline === key ? 'secondary' : 'ghost'}
                aria-pressed={deadline === key}
                onClick={() => {
                  setDeadline(key);
                  setStatus('Todos');
                  setPage(1);
                }}
              >
                {label}
              </Button>
            ))}
          </div>
        )}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 rounded-md border border-border px-3 py-2">
              <Search className="size-3.5 text-muted-foreground" />
              <input
                className="w-44 bg-transparent text-[11px] outline-none"
                placeholder="Buscar ordem ou provedor..."
                aria-label="Buscar ordens"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
              />
            </div>
            <select
              className="native-select"
              aria-label="Filtrar por status"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
            >
              <option value="Todos">Todos os status</option>
              {statuses.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
            <Button variant="outline" onClick={() => setFilters(!filters)}>
              <SlidersHorizontal data-icon="inline-start" />
              Filtros
            </Button>
            {analyst && (
              <label className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                Ordenar por
                <select
                  className="native-select"
                  aria-label="Ordenar ordens"
                  value={sortKey}
                  onChange={(event) => {
                    replaceFilters({ sort: event.target.value, scope: orderScope });
                  }}
                >
                  {Object.entries(orderSorts).map(([key, value]) => (
                    <option key={key} value={key}>
                      {value.label}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
          <div className="flex items-center gap-1">
            {!analyst && (
              <>
                <Button
                  variant={view === 'list' ? 'secondary' : 'ghost'}
                  size="icon"
                  aria-label="Visualização em lista"
                  onClick={() => setView('list')}
                >
                  <List />
                </Button>
                <Button
                  variant={view === 'board' ? 'secondary' : 'ghost'}
                  size="icon"
                  aria-label="Visualização Kanban"
                  onClick={() => setView('board')}
                >
                  <LayoutGrid />
                </Button>
              </>
            )}
          </div>
        </div>
        {filters && (
          <div className="flex flex-wrap gap-3 border-b border-border bg-muted/40 px-5 py-3">
            <select
              className="native-select"
              aria-label="Filtrar provedor"
              value={provider}
              onChange={(e) => {
                setProvider(e.target.value);
                setPage(1);
              }}
            >
              <option value="Todos">Todos os provedores</option>
              {providers.map((p) => (
                <option key={p.id}>{p.name}</option>
              ))}
            </select>
            <select
              className="native-select"
              aria-label="Filtrar prioridade"
              value={priority}
              onChange={(e) => {
                setPriority(e.target.value);
                setPage(1);
              }}
            >
              <option value="Todas">Todas as prioridades</option>
              {['Crítica', 'Alta', 'Normal', 'Baixa'].map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
            <select
              className="native-select"
              aria-label="Filtrar tipo de serviço"
              value={type}
              onChange={(event) => {
                setType(event.target.value);
                setPage(1);
              }}
            >
              <option value="">Todos os tipos</option>
              {Object.entries(orderTypes).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
            <label className="flex items-center gap-2 text-xs">
              Criada de
              <input
                type="datetime-local"
                className="native-select"
                value={from}
                onChange={(event) => {
                  setFrom(event.target.value);
                  setPage(1);
                }}
              />
            </label>
            <label className="flex items-center gap-2 text-xs">
              até
              <input
                type="datetime-local"
                className="native-select"
                value={to}
                onChange={(event) => {
                  setTo(event.target.value);
                  setPage(1);
                }}
              />
            </label>
            <Button variant="ghost" onClick={clearFilters}>
              Limpar filtros
            </Button>
          </div>
        )}
        <QueryState
          loading={source.isLoading}
          error={source.error}
          onRetry={() => void source.mutate()}
        />
        {(provider !== 'Todos' ||
          deadline ||
          situation !== 'all' ||
          search ||
          status !== 'Todos' ||
          priority !== 'Todas' ||
          type ||
          from ||
          to) && (
          <div className="flex flex-wrap items-center gap-3 border-b px-5 py-3 text-xs text-muted-foreground">
            <span>{provider !== 'Todos' ? `Provedor: ${provider} · ` : ''}Filtros aplicados</span>
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              Limpar todos
            </Button>
          </div>
        )}
        {invalidRange && (
          <p role="alert" className="px-5 py-3 text-sm text-danger">
            A data final precisa ser igual ou posterior à data inicial.
          </p>
        )}
        {search.trim().length === 1 && (
          <p className="px-5 py-2 text-xs text-muted-foreground">
            Digite pelo menos dois caracteres para buscar.
          </p>
        )}
        {source.isLoading || source.error || invalidRange ? null : view === 'list' || analyst ? (
          <OrdersTable
            orders={filtered}
            attention={!customer ? attention : undefined}
            listQuery={analyst ? params.toString() : undefined}
          />
        ) : (
          <div className="grid auto-cols-[240px] grid-flow-col gap-4 overflow-x-auto p-5">
            {statuses.map((s) => (
              <div key={s} className="rounded-lg bg-muted/60 p-3">
                <div className="mb-4 flex justify-between">
                  <StatusBadge status={s} />
                  <span className="text-xs text-muted-foreground">
                    {filtered.filter((o) => o.status === s).length}
                  </span>
                </div>
                {filtered
                  .filter((o) => o.status === s)
                  .map((o) => (
                    <Link
                      key={o.id}
                      href={orderBase + '/ordens/' + o.id}
                      className="mb-3 block rounded-lg border border-border bg-card p-4"
                    >
                      <p className="text-[9px] text-muted-foreground">{o.id}</p>
                      <p className="my-2 text-xs font-medium leading-relaxed">{o.title}</p>
                      <div className="flex items-center justify-between">
                        <Priority value={o.priority} />
                        <Avatar name={o.analyst} />
                      </div>
                    </Link>
                  ))}
              </div>
            ))}
          </div>
        )}
        <div className="flex items-center justify-between border-t border-border px-5 py-3">
          <span className="text-[10px] text-muted-foreground">
            {total !== undefined
              ? `${total} ordens · ${filtered.length} nesta página`
              : `${filtered.length} ordens nesta página`}
          </span>
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
            <Button
              variant="outline"
              size="icon-sm"
              disabled={current === 1 || source.isLoading}
              onClick={() =>
                setPage(Number(new URLSearchParams(window.location.search).get('page') || 1) - 1)
              }
              aria-label="Página anterior"
            >
              <ChevronLeft />
            </Button>
            {current} de {pages}
            <Button
              variant="outline"
              size="icon-sm"
              disabled={current >= pages || summary.isLoading || source.isLoading || invalidRange}
              onClick={() =>
                setPage(Number(new URLSearchParams(window.location.search).get('page') || 1) + 1)
              }
              aria-label="Próxima página"
            >
              <ChevronRight />
            </Button>
          </div>
        </div>
      </section>
      {canQuickDispatch && (
        <QuickDispatchDialog open={quickDispatchOpen} onOpenChange={setQuickDispatchOpen} />
      )}
    </>
  );
}
export function OrderDetail({
  id,
  initialTab = 'Encerramento',
}: {
  id: string;
  initialTab?: string;
}) {
  const source = useVisualSource('orders');
  const { scope } = useErp();
  const base = useRouteBase();
  const detailParams = useSearchParams();
  const returnHref = `${base}/ordens${detailParams.get('list') ? `?${new URLSearchParams(detailParams.get('list')!).toString()}` : ''}`;
  const [tab, setTab] = useState(
    scope?.role === 'analista' &&
      !['Encerramento', 'Anotações', 'Editar', 'Anexos', 'Histórico'].includes(initialTab)
      ? 'Encerramento'
      : initialTab,
  );
  const [exporting, setExporting] = useState(false);
  const order = source.rows.find((row) => row.id === id);
  const raw = source.raw.find((row) => row.id === id);
  if (source.isLoading) return <QueryState loading />;
  if (!order)
    return (
      <>
        <PageHeading title="Ordem indisponível" description={`Registro ${id}`} />
        <QueryState loading={source.isLoading} error={source.error} />
        <Link href={`${base}/ordens`} className="text-link">
          Voltar para ordens
        </Link>
      </>
    );
  return (
    <>
      <Link
        href={returnHref}
        className="mb-4 inline-flex items-center gap-2 text-xs text-muted-foreground"
      >
        <ArrowLeft className="size-3" />
        {scope?.role === 'analista' ? 'Minhas ordens' : 'Todas as ordens'}
      </Link>
      {raw?.occurrenceId ? (
        <nav aria-label="Contexto da O.S." className="mb-5 text-xs text-muted-foreground">
          <Link className="text-link" href={`${base}/ocorrencias/${raw.occurrenceId}/ordens`}>
            ← Voltar à ocorrência{' '}
            {String((raw.occurrence as { number?: string } | undefined)?.number || '')} ·{' '}
            {String(order.provider || '')}
          </Link>
        </nav>
      ) : (
        <p className="mb-5 text-xs text-muted-foreground">O.S. sem ocorrência vinculada.</p>
      )}
      <PageHeading
        title={String(order.title)}
        description={`#${order.protocol} · Criada em ${order.date}`}
      >
        <StatusBadge status={String(order.status)} />
        <Button
          variant="outline"
          disabled={exporting}
          onClick={async () => {
            if (!raw) return;
            setExporting(true);
            try {
              await downloadOrderPdf(raw);
            } catch {
              toast.error('Não foi possível gerar o PDF. Tente novamente.');
            } finally {
              setExporting(false);
            }
          }}
        >
          <ArrowDownToLine data-icon="inline-start" />
          {exporting ? 'Gerando PDF…' : 'Exportar PDF'}
        </Button>
      </PageHeading>
      <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
        <div className="flex min-w-0 flex-col gap-5">
          <section className="panel">
            <PanelHeading title="Sobre esta solicitação" />
            <div className="px-6 pb-6">
              <p className="max-h-48 overflow-y-auto whitespace-pre-wrap break-words text-sm leading-7 text-muted-foreground">
                {String(order.description)}
              </p>
              <div className="mt-5 flex gap-2">
                <span className="rounded-md bg-muted px-2 py-1 text-[10px]">
                  {String(order.type)}
                </span>
              </div>
            </div>
          </section>
          <section className="panel min-w-0 overflow-hidden">
            <RecordWorkspace
              key={id}
              kind="orders"
              id={id}
              base={base}
              embedded
              showTabs
              activeTab={tab}
              onTabChange={setTab}
              workControls={
                scope?.role !== 'cliente' && raw ? (
                  <AnalystOrderWork order={raw} refresh={source.mutate} compact />
                ) : undefined
              }
            />
          </section>
        </div>
        <aside className="panel h-fit">
          <PanelHeading title="Detalhes do atendimento" />
          <div className="flex flex-col gap-5 px-6 pb-6">
            <div>
              <p className="mini-label mb-2">Prioridade</p>
              <Priority value={String(order.priority)} />
            </div>
            {scope?.role !== 'analista' &&
              (!raw?.processInstanceId ? (
                <OperationControl
                  title="Alterar status"
                  description="Informe o próximo status e a justificativa. O ERP valida a transição e a versão atual."
                  path={`/service-orders/${encodeURIComponent(id)}/transition`}
                  method="PATCH"
                  body={{ expectedVersion: raw?.version }}
                  fields={[
                    {
                      name: 'toStatus',
                      label: 'Próximo status',
                      options: nextStatusOptions(raw?.status),
                      required: true,
                    },
                    {
                      name: 'reason',
                      label: 'Justificativa',
                      type: 'textarea',
                      required: true,
                      min: 3,
                    },
                  ]}
                  roles={['super_admin', 'gerente', 'analista']}
                  after={async () => {
                    await source.mutate();
                  }}
                />
              ) : (
                <Link
                  className="text-link"
                  href={`${base}/processos/${String(raw.processInstanceId)}`}
                >
                  Acompanhar e concluir pelo processo
                </Link>
              ))}
            <div>
              <p className="mini-label mb-2">Provedor</p>
              {scope?.role === 'cliente' ? (
                <span className="text-xs">{String(order.provider)}</span>
              ) : (
                <Link
                  className="text-link text-xs"
                  href={`${base}/provedores${(raw?.occurrence as { customerId?: string } | undefined)?.customerId ? `/${(raw!.occurrence as { customerId: string }).customerId}` : `?search=${encodeURIComponent(String(order.provider))}`}`}
                >
                  {String(order.provider)}
                </Link>
              )}
              {scope?.role !== 'cliente' && (
                <div className="mt-2">
                  <Link
                    className="text-link text-xs"
                    href={`${base}/credenciais?provider=${encodeURIComponent(String(order.provider))}`}
                  >
                    Acessos e orientações técnicas →
                  </Link>
                </div>
              )}
            </div>
            <div>
              <p className="mini-label mb-2">Responsável</p>
              <span className="flex items-center gap-2 text-xs">
                <Avatar name={String(order.analyst)} />
                {String(order.analyst)}
              </span>
            </div>
            <div>
              <p className="mini-label mb-2">Prazo de conclusão</p>
              <p className="flex items-center gap-2 text-xs">
                <Clock3 className="size-3.5 text-warning" />
                {String(order.deadline)}
              </p>
            </div>
            {Boolean(raw?.scheduledAt) && (
              <div>
                <p className="mini-label mb-2">Execução agendada</p>
                {scope?.role !== 'cliente' && (
                  <Link
                    className="text-link text-xs"
                    href={`${base}/agenda?date=${new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Fortaleza', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(String(raw?.scheduledAt)))}`}
                  >
                    Ver na agenda →
                  </Link>
                )}
                <p className="text-xs">
                  {new Date(String(raw?.scheduledAt)).toLocaleString('pt-BR', {
                    timeZone: 'America/Fortaleza',
                  })}
                </p>
              </div>
            )}
            <div>
              <p className="mini-label mb-2">Aberto por</p>
              <p className="text-xs">
                {String(
                  (raw?.owner as { name?: string } | undefined)?.name ||
                    raw?.ownerName ||
                    'Não informado',
                )}
              </p>
            </div>
            {scope?.role !== 'analista' && !raw?.processInstanceId && (
              <OperationControl
                title="Concluir atendimento"
                description="Confirme a resolução desta ordem. A transição será validada pelo ERP."
                path={`/service-orders/${encodeURIComponent(id)}/transition`}
                method="PATCH"
                body={{ toStatus: 'RESOLVIDA', expectedVersion: raw?.version }}
                fields={[
                  {
                    name: 'reason',
                    label: 'Solução aplicada',
                    type: 'textarea',
                    min: 3,
                    required: true,
                  },
                ]}
                roles={['super_admin', 'gerente', 'analista']}
                after={async () => {
                  await source.mutate();
                }}
              />
            )}
            {scope?.role !== 'analista' && (
              <OperationControl
                title="Emitir pesquisa CSAT"
                description="Emitir pesquisa para esta ordem."
                path="/csat/create-for-order"
                body={{ orderId: id }}
                roles={['super_admin', 'gerente', 'analista']}
              />
            )}
          </div>
        </aside>
      </div>
    </>
  );
}
