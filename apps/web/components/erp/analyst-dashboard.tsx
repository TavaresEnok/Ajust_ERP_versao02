'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Area,
  AreaChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Pie,
  PieChart,
  Cell,
  Bar,
  BarChart,
} from 'recharts';
import { useOperationalOrders } from '@/lib/erp/use-operational-orders';
import { orderStatuses } from '@/lib/erp/contracts';
import {
  AlertTriangle,
  Building2,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Plus,
  Timer,
  BookOpen,
  KeyRound,
  ArrowRight,
} from 'lucide-react';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { Button } from '@/components/ui/button';
import { useErp, useErpQuery } from '@/lib/erp/gateway';
import type { ErpRecord } from '@/lib/erp/contracts';
import type { Order } from '@/lib/demo-data';
import { listRecords, useRouteBase, visualRecord } from '@/lib/erp/visual-data';
import {
  ANALYST_TIMEZONE,
  buildAnalystOverview,
  isOwnOrder,
  type OrderFocus,
} from '@/lib/erp/analyst-workspace';
import { Metric, PageHeading, PanelHeading, ViewLink } from './primitives';
import { QueryState } from './contract-form';
import { OrdersTable } from './orders';
import { OrderForm } from './order-form';

export function AnalystDashboard() {
  return <AnalystHistory />;
}
function AnalystHistory() {
  const { scope } = useErp();
  const base = useRouteBase();
  const [view, setView] = useState<'mine' | 'operation'>('mine');
  const [period, setPeriod] = useState('30');
  const [focus, setFocusState] = useState<OrderFocus>('active');
  const [orderPage, setOrderPage] = useState(0);
  function setFocus(value: OrderFocus) {
    setFocusState(value);
    setOrderPage(0);
  }
  const [orderOpen, setOrderOpen] = useState(false);
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);
  const orders = useOperationalOrders(view);
  const me = useErpQuery<{ user?: { name?: string }; name?: string }>('/auth/me');
  const calendar = useErpQuery<ErpRecord[]>('/calendar/events');
  const rows = listRecords(orders.data).filter(
    (r) => view === 'operation' || isOwnOrder(r, scope?.userId || ''),
  );
  const overview = buildAnalystOverview(rows, period === 'all' ? null : Number(period), now);
  const mine = view === 'mine';
  const name = (me.data?.user?.name || me.data?.name || '').split(' ')[0];
  const ready = orders.data !== undefined && !orders.error;
  const value = (n: number) => (orders.error ? 'Indisponível' : ready ? String(n) : '…');
  const selections = {
    active: overview.active,
    overdue: overview.overdue,
    today: overview.dueToday,
    soon: overview.dueSoon,
    closed: overview.closed,
    all: overview.ordered,
  };
  const selectedIds = new Set(selections[focus].map((r) => r.id));
  const selectedOrders = overview.ordered.filter((r) => selectedIds.has(r.id));
  const currentPage = Math.min(orderPage, Math.max(0, Math.ceil(selectedOrders.length / 8) - 1));
  const visibleOrders = selectedOrders
    .slice(currentPage * 8, currentPage * 8 + 8)
    .map((r) => visualRecord('orders', r)) as unknown as Order[];
  const nextEvents = listRecords(calendar.data)
    .filter((e) => {
      const start = new Date(String(e.startAt)).getTime();
      const end = e.endAt ? new Date(String(e.endAt)).getTime() : start;
      return end >= now.getTime() && start <= now.getTime() + 7 * 86_400_000;
    })
    .sort((a, b) => String(a.startAt).localeCompare(String(b.startAt)))
    .slice(0, 5);
  const prefix = mine ? 'Minhas' : 'Da Ajust ·';
  const statusSeries = Object.entries(orderStatuses)
    .map(([status, label], i) => ({
      status,
      label,
      count: overview.active.filter((row) => row.status === status).length,
      color:
        (
          {
            ABERTA: '#3b82f6',
            EM_ANALISE: '#818cf8',
            AG_CAMPO: '#fbbf24',
            AG_TERCEIROS: '#c084fc',
          } as Record<string, string>
        )[status] || `var(--chart-${(i % 5) + 1})`,
    }))
    .filter((row) => row.count > 0);
  const providerCounts = new Map<string, number>();
  for (const row of overview.active) {
    const provider = String(
      row.provider ||
        (row.occurrence as ErpRecord | undefined)?.provider ||
        'Sem provedor informado',
    );
    providerCounts.set(provider, (providerCounts.get(provider) || 0) + 1);
  }
  const providerSeries = [...providerCounts]
    .map(([provider, count]) => ({ provider, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);
  const overdueIds = new Set(overview.overdue.map((row) => row.id)),
    todayIds = new Set(overview.dueToday.map((row) => row.id));
  const attention = Object.fromEntries(
    selectedOrders.map((row) => [
      row.id,
      row.pausedAt
        ? { label: 'Pausada · aguardando retorno', tone: 'muted' }
        : row.scheduledAt && !row.scheduleStartedAt
          ? {
              label: `Agendada · ${new Date(String(row.scheduledAt)).toLocaleString('pt-BR', { timeZone: ANALYST_TIMEZONE, day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}`,
              tone: 'warning',
            }
          : overdueIds.has(row.id)
            ? { label: 'Prazo de SLA excedido', tone: 'danger' }
            : todayIds.has(row.id)
              ? { label: 'Prazo vence hoje', tone: 'warning' }
              : {
                  label: ['FECHADA', 'RESOLVIDA'].includes(String(row.status))
                    ? 'Atendimento concluído'
                    : row.deadlineAt
                      ? 'Dentro do prazo'
                      : 'Sem prazo informado',
                  tone: 'muted',
                },
    ]),
  );
  return (
    <>
      <PageHeading
        title={name ? `Seu dia começa por aqui, ${name}.` : 'Meu painel'}
        description="Suas demandas, seus prazos e os provedores que precisam de você."
      >
        <Button onClick={() => setOrderOpen(true)}>
          <Plus data-icon="inline-start" />
          Novo atendimento
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            void orders.mutate();
            void calendar.mutate();
          }}
        >
          Atualizar painel
        </Button>
      </PageHeading>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3">
        <div className="flex flex-wrap gap-2" aria-label="Escopo do painel">
          <Button
            variant={mine ? 'default' : 'outline'}
            aria-pressed={mine}
            onClick={() => {
              setView('mine');
              setFocus('active');
            }}
          >
            Meu trabalho
          </Button>
          <Button
            variant={!mine ? 'default' : 'outline'}
            aria-pressed={!mine}
            onClick={() => {
              setView('operation');
              setFocus('active');
            }}
          >
            Visão geral da Ajust
          </Button>
        </div>
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          Entregas e evolução
          <select
            className="native-select"
            aria-label="Período do painel do analista"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
          >
            <option value="7">Últimos 7 dias</option>
            <option value="30">Últimos 30 dias</option>
            <option value="90">Últimos 90 dias</option>
            <option value="all">Todo o histórico</option>
          </select>
        </label>
      </div>
      <p className="mb-4 text-xs leading-6 text-muted-foreground">
        Ativas e alertas mostram todas as pendências. O período selecionado filtra as aberturas e
        conclusões dos gráficos. Horário de Fortaleza.
      </p>
      <QueryState
        loading={orders.isLoading}
        error={orders.error}
        onRetry={() => void orders.mutate()}
      />
      <div className="metrics-grid mb-6 grid grid-cols-4 gap-4" data-testid="analyst-metrics">
        {[
          {
            label: `${prefix} ativas`,
            count: overview.active.length,
            icon: ClipboardList,
            foot: 'pendências de todo o histórico',
            focus: 'active',
            color: 'text-blue-600 dark:text-blue-300',
            bg: 'bg-blue-500/10',
          },
          {
            label: `${prefix} atrasadas`,
            count: overview.overdue.length,
            icon: AlertTriangle,
            foot: 'ativas com prazo de SLA excedido',
            focus: 'overdue',
            color: 'text-rose-600 dark:text-rose-400',
            bg: 'bg-rose-500/10',
          },
          {
            label: mine ? 'Minhas que vencem hoje' : 'Da Ajust · vencem hoje',
            count: overview.dueToday.length,
            icon: Timer,
            foot: 'prazos de hoje, inclusive já vencidos',
            focus: 'today',
            color: 'text-amber-600 dark:text-amber-300',
            bg: 'bg-amber-500/10',
          },
          {
            label: mine ? 'Minhas concluídas no período' : 'Da Ajust · concluídas no período',
            count: overview.closed.length,
            icon: CheckCircle2,
            foot: 'pela data de resolução ou encerramento',
            focus: 'closed',
            color: 'text-emerald-600 dark:text-emerald-300',
            bg: 'bg-emerald-500/10',
          },
        ].map((m) => (
          <button
            key={m.focus}
            className="rounded-2xl border border-border bg-card p-5 text-left transition hover:border-primary/40 focus-visible:outline-2 focus-visible:outline-primary"
            onClick={() => setFocus(m.focus as OrderFocus)}
            aria-pressed={focus === m.focus}
          >
            <div className="flex items-center justify-between gap-3">
              <span className={`text-[10px] font-semibold uppercase tracking-wider ${m.color}`}>
                {m.label}
              </span>
              <span className={`rounded-xl p-2 ${m.color} ${m.bg}`}>
                <m.icon className="size-4" />
              </span>
            </div>
            <p className={`metric-value mt-3 text-3xl font-semibold tabular-nums ${m.color}`}>
              {value(m.count)}
            </p>
            <p className="mt-2 text-[11px] text-muted-foreground">{m.foot}</p>
          </button>
        ))}
      </div>
      <div className="mb-6 grid gap-5 xl:grid-cols-[minmax(0,1.8fr)_minmax(280px,1fr)]">
        <section className="panel min-w-0">
          <PanelHeading
            title={mine ? 'Minhas O.S. · evolução' : 'O.S. da Ajust · evolução'}
            description="Aberturas e conclusões nas respectivas datas, sem contar cancelamentos como entregas."
          >
            <div className="flex gap-3 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <i className="size-2 rounded-full bg-chart-1" />
                Abertas
              </span>
              <span className="flex items-center gap-1">
                <i className="size-2 rounded-full bg-emerald-500" />
                Concluídas
              </span>
            </div>
          </PanelHeading>
          {ready && overview.series.some((r) => r.opened || r.closed) ? (
            <ChartContainer
              config={{
                opened: { label: 'Abertas', color: 'var(--chart-1)' },
                closed: { label: 'Concluídas', color: '#10b981' },
              }}
              className="h-[235px] w-full aspect-auto px-3"
            >
              <AreaChart
                data={overview.series.map((r) => ({
                  ...r,
                  timestamp: new Date(`${r.day}T12:00:00-03:00`).getTime(),
                }))}
                margin={{ top: 15, right: 12, left: -20, bottom: 5 }}
                accessibilityLayer
              >
                <CartesianGrid vertical={false} strokeDasharray="3 4" />
                <XAxis
                  dataKey="timestamp"
                  type="number"
                  scale="time"
                  domain={['dataMin', 'dataMax']}
                  tickFormatter={(s: number) =>
                    new Date(s).toLocaleDateString('pt-BR', {
                      timeZone: ANALYST_TIMEZONE,
                      ...(period === 'all'
                        ? { month: '2-digit', year: 'numeric' }
                        : { day: '2-digit', month: '2-digit' }),
                    })
                  }
                  tick={{ fontSize: 10 }}
                  minTickGap={28}
                />
                <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      labelFormatter={(s) =>
                        new Date(Number(s)).toLocaleDateString('pt-BR', {
                          timeZone: ANALYST_TIMEZONE,
                        })
                      }
                    />
                  }
                />
                <Area
                  dataKey="opened"
                  isAnimationActive={false}
                  type="monotone"
                  stroke="var(--color-opened)"
                  fill="var(--color-opened)"
                  fillOpacity={0.08}
                />
                <Area
                  dataKey="closed"
                  isAnimationActive={false}
                  type="monotone"
                  stroke="var(--color-closed)"
                  fill="var(--color-closed)"
                  fillOpacity={0.08}
                />
              </AreaChart>
            </ChartContainer>
          ) : (
            <p className="px-5 py-14 text-center text-sm text-muted-foreground">
              {ready
                ? 'Nenhuma abertura ou conclusão registrada neste período.'
                : 'A evolução será exibida após o carregamento dos dados.'}
            </p>
          )}
          <p className="px-5 py-4 text-xs text-muted-foreground">
            Abertas no período: {value(overview.opened)} · Concluídas:{' '}
            {value(overview.closed.length)}
          </p>
        </section>
        <section className="panel">
          <PanelHeading
            title="Prioridades e atalhos"
            description="O que precisa de atenção agora."
          />
          <div className="space-y-3 p-5 pt-0 text-xs">
            <button
              className="flex w-full items-center justify-between rounded-lg border border-border p-4 text-left hover:bg-muted/50"
              onClick={() => setFocus('soon')}
            >
              <span>Vencem nas próximas 2 horas</span>
              <strong>{value(overview.dueSoon.length)}</strong>
            </button>
            <p className="leading-6 text-muted-foreground">
              {ready
                ? `${overview.withoutSla} O.S. ativas sem prazo válido ou não elegíveis para SLA. Elas não são classificadas como atrasadas.`
                : 'Aguardando consulta dos prazos.'}
            </p>
            {ready && overview.missingCompletionDate > 0 && (
              <p className="leading-6 text-muted-foreground">
                {overview.missingCompletionDate} O.S. concluídas sem data de conclusão não entram no
                indicador por período.
              </p>
            )}
            <div className="flex flex-col items-start gap-2">
              <Link className="text-link flex items-center gap-2 py-2" href={`${base}/provedores`}>
                <Building2 className="size-4" />
                Provedores e seus atendimentos
              </Link>
              <Link className="text-link flex items-center gap-2 py-2" href={`${base}/ajustpedia`}>
                <BookOpen className="size-4" />
                Consultar Ajustpedia
              </Link>
              <Link className="text-link flex items-center gap-2 py-2" href={`${base}/credenciais`}>
                <KeyRound className="size-4" />
                Acessar cofre dos provedores
              </Link>
              <Link
                className="text-link block py-2"
                href={`${base}/ordens?scope=${view}&deadline=overdue`}
              >
                Ver O.S. atrasadas →
              </Link>
            </div>
          </div>
        </section>
      </div>
      <section className="panel mb-6">
        <PanelHeading
          title={mine ? 'Distribuição do meu trabalho' : 'Distribuição do trabalho da Ajust'}
          description="Pendências atuais, incluindo O.S. abertas antes do período selecionado."
        />
        <div className="grid gap-5 p-5 pt-0 lg:grid-cols-2">
          <section
            aria-label="Ordens ativas por status"
            className="min-w-0 rounded-xl border border-border p-4"
          >
            <h3 className="text-sm font-semibold">O.S. ativas por status</h3>
            {ready && statusSeries.length ? (
              <div className="grid items-center gap-3 sm:grid-cols-2">
                <div className="relative">
                  <ChartContainer
                    config={{ count: { label: 'O.S.' } }}
                    className="h-[210px] w-full aspect-auto"
                  >
                    <PieChart accessibilityLayer>
                      <Pie
                        data={statusSeries}
                        dataKey="count"
                        nameKey="label"
                        innerRadius={50}
                        outerRadius={78}
                        paddingAngle={3}
                        isAnimationActive={false}
                      >
                        {statusSeries.map((row) => (
                          <Cell key={row.status} fill={row.color} />
                        ))}
                      </Pie>
                      <ChartTooltip content={<ChartTooltipContent nameKey="label" />} />
                    </PieChart>
                  </ChartContainer>
                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-2xl font-semibold tabular-nums">
                      {overview.active.length}
                    </span>
                    <span className="text-[9px] uppercase tracking-wider text-muted-foreground">
                      Ativas
                    </span>
                  </div>
                </div>
                <ul className="space-y-3">
                  {statusSeries.map((row) => (
                    <li key={row.status}>
                      <button
                        className="flex w-full items-center gap-2 text-left text-xs"
                        onClick={() => setFocus('active')}
                      >
                        <span className="size-2 rounded-full" style={{ background: row.color }} />
                        <span className="flex-1">{row.label}</span>
                        <strong>{row.count}</strong>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="py-16 text-center text-sm text-muted-foreground">
                {ready ? 'Nenhuma O.S. ativa.' : 'Carregando distribuição...'}
              </p>
            )}
          </section>
          <section
            aria-label="Ordens ativas por provedor"
            className="min-w-0 rounded-xl border border-border p-4"
          >
            <h3 className="text-sm font-semibold">Provedores com mais pendências</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Até seis provedores no escopo selecionado.
            </p>
            {ready && providerSeries.length ? (
              <ChartContainer
                config={{ count: { label: 'O.S. ativas', color: 'var(--chart-1)' } }}
                className="mt-4 h-[210px] w-full aspect-auto"
              >
                <BarChart
                  data={providerSeries}
                  layout="vertical"
                  margin={{ left: 0, right: 15, top: 0, bottom: 0 }}
                  accessibilityLayer
                >
                  <CartesianGrid horizontal={false} strokeDasharray="3 4" />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10 }} />
                  <YAxis
                    type="category"
                    dataKey="provider"
                    width={100}
                    tick={{ fontSize: 10 }}
                    tickFormatter={(value) => String(value).slice(0, 15)}
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar
                    dataKey="count"
                    fill="var(--color-count)"
                    radius={[0, 5, 5, 0]}
                    isAnimationActive={false}
                  />
                </BarChart>
              </ChartContainer>
            ) : (
              <p className="py-16 text-center text-sm text-muted-foreground">
                {ready ? 'Nenhuma pendência por provedor.' : 'Carregando provedores...'}
              </p>
            )}
          </section>
        </div>
      </section>
      <section className="panel mb-6">
        <PanelHeading
          title={mine ? 'Minhas ordens de serviço' : 'Ordens de serviço da Ajust'}
          description="Ativas primeiro, ordenadas pelo prazo de SLA disponível."
        >
          <ViewLink href={`${base}/ordens?scope=${view}`}>Ver todas</ViewLink>
        </PanelHeading>
        <div className="flex flex-wrap gap-2 px-5 pb-4">
          {(
            [
              ['active', 'Ativas'],
              ['overdue', 'Atrasadas'],
              ['today', 'Vencem hoje'],
              ['soon', 'Próximas do prazo'],
              ['closed', 'Concluídas no período'],
              ['all', 'Todas'],
            ] as const
          ).map(([key, label]) => (
            <Button
              key={key}
              size="sm"
              variant={focus === key ? 'secondary' : 'ghost'}
              aria-pressed={focus === key}
              onClick={() => setFocus(key)}
            >
              {label}
            </Button>
          ))}
        </div>
        {ready && (
          <>
            <OrdersTable compact orders={visibleOrders} attention={attention} />
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-4 text-xs text-muted-foreground">
              <p>
                {visibleOrders.length} de {selectedOrders.length} O.S. · página {currentPage + 1} de{' '}
                {Math.max(1, Math.ceil(selectedOrders.length / 8))}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage === 0}
                  onClick={() => setOrderPage(currentPage - 1)}
                >
                  Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={(currentPage + 1) * 8 >= selectedOrders.length}
                  onClick={() => setOrderPage(currentPage + 1)}
                >
                  Próxima
                </Button>
              </div>
            </div>
          </>
        )}
      </section>
      <section className="panel">
        <PanelHeading
          title="Minha agenda · próximos 7 dias"
          description="Compromissos pessoais e eventos compartilhados com a equipe."
        >
          <ViewLink href={`${base}/agenda`}>Abrir agenda</ViewLink>
        </PanelHeading>
        <QueryState
          loading={calendar.isLoading}
          error={calendar.error}
          onRetry={() => void calendar.mutate()}
        />
        {!calendar.isLoading &&
          !calendar.error &&
          (nextEvents.length ? (
            <ul className="divide-y divide-border px-5">
              {nextEvents.map((e) => (
                <li key={String(e.id)} className="flex items-center gap-3 py-4 text-sm">
                  <CalendarDays className="size-4 text-primary" />
                  <div>
                    <p>{String(e.title)}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {new Date(String(e.startAt)).toLocaleString('pt-BR', {
                        timeZone: ANALYST_TIMEZONE,
                      })}
                      {e.isGlobal ? ' · Compartilhado com a equipe' : ''}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-5 pb-5 text-sm text-muted-foreground">
              Nenhum compromisso nos próximos 7 dias.
            </p>
          ))}
      </section>
      <OrderForm open={orderOpen} onOpenChange={setOrderOpen} />
    </>
  );
}
