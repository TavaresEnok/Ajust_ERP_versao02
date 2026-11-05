'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, Clock3, Plus, Timer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useErpQuery } from '@/lib/erp/gateway';
import { listRecords, useRouteBase } from '@/lib/erp/visual-data';
import { useOperationalOrders } from '@/lib/erp/use-operational-orders';
import { isDemonstration, type ManagementOverview } from '@/lib/erp/management';
import {
  ANALYST_TIMEZONE,
  deadlineSituation,
  isActiveOrder,
  localDay,
  orderDeadline,
} from '@/lib/erp/analyst-workspace';
import { orderStatuses, priorities, type ErpRecord } from '@/lib/erp/contracts';
import { cn } from '@/lib/utils';
import { QueryState } from './contract-form';
import { PageHeading, PanelHeading, Metric, Priority, StatusBadge, ViewLink } from './primitives';
import { OrderForm } from './order-form';
import { StatusChart, useStatusData, VolumeChart } from './dashboard-charts';

const date = (value: unknown) =>
  value
    ? new Date(String(value)).toLocaleString('pt-BR', {
        timeZone: ANALYST_TIMEZONE,
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })
    : 'Sem data';
const focuses = {
  active: {
    label: 'Pendentes agora',
    metric: 'totalOpen',
    help: 'Inclui ordens antigas ainda em atendimento.',
  },
  overdue: {
    label: 'Atrasadas',
    metric: 'overdue',
    help: 'Prazo vencido; pausadas ficam fora desta contagem.',
  },
  soon: {
    label: 'Vencem em até 2h',
    metric: 'dueSoon',
    help: 'Prazos que exigem atenção nas próximas horas.',
  },
  unassigned: {
    label: 'Sem responsável',
    metric: 'unassigned',
    help: 'Sem vínculo com um responsável no ERP.',
  },
  paused: {
    label: 'Pausadas',
    metric: 'paused',
    help: 'Consulte o motivo para remover o impedimento.',
  },
  scheduled: {
    label: 'Execuções agendadas',
    metric: 'scheduled',
    help: 'Com horário combinado e início ainda não registrado.',
  },
} as const;
type Focus = keyof typeof focuses;

export function Dashboard() {
  const base = useRouteBase();
  const [days, setDays] = useState(30);
  const [focus, setFocus] = useState<Focus>('active');
  const [page, setPage] = useState(0);
  const [orderOpen, setOrderOpen] = useState(false);
  const report = useErpQuery<ManagementOverview>(`/reports/management-overview?daysBack=${days}`);
  const orders = useOperationalOrders('operation');
  const overview = !report.error ? report.data : undefined;
  const now = overview ? new Date(overview.generatedAt) : null;
  const agenda = useErpQuery<unknown>(
    overview
      ? `/calendar/events/all?from=${encodeURIComponent(overview.generatedAt)}&to=${encodeURIComponent(new Date(new Date(overview.generatedAt).getTime() + 7 * 86_400_000).toISOString())}`
      : null,
  );
  const rows = (orders.data || []).filter((row) => !isDemonstration(row));
  const active = rows.filter(isActiveOrder);
  const statuses = useStatusData(active);
  const demoIds = new Set((orders.data || []).filter(isDemonstration).map((row) => row.id));
  const upcoming = listRecords(agenda.data)
    .filter((row) => {
      const end = new Date(String(row.endAt || row.startAt)).getTime();
      return now && end >= now.getTime() && !demoIds.has(String(row.serviceOrderId));
    })
    .sort((a, b) => new Date(String(a.startAt)).getTime() - new Date(String(b.startAt)).getTime());
  const selected = active
    .filter((row) => {
      if (!now) return false;
      if (focus === 'overdue') return deadlineSituation(row, now) === 'Atrasada';
      if (focus === 'soon') return deadlineSituation(row, now) === 'Vence em até 2h';
      if (focus === 'unassigned') return !row.assigneeUserId;
      if (focus === 'paused') return !!row.pausedAt;
      if (focus === 'scheduled') return !!row.scheduledAt && !row.scheduleStartedAt;
      return true;
    })
    .sort((a, b) => {
      const rank = (row: ErpRecord) =>
        row.pausedAt
          ? 3
          : deadlineSituation(row, now!) === 'Atrasada'
            ? 0
            : row.priority === 'CRITICA'
              ? 1
              : 2;
      return (
        rank(a) - rank(b) ||
        (orderDeadline(a) ?? Infinity) - (orderDeadline(b) ?? Infinity) ||
        String(a.id).localeCompare(String(b.id))
      );
    });
  const pages = Math.max(1, Math.ceil(selected.length / 8));
  const currentPage = Math.min(page, pages - 1);
  const results = overview?.results;
  const usableList = Boolean(orders.data && !orders.error && overview);
  const reportMutate = report.mutate;
  const agendaMutate = agenda.mutate;
  async function refresh() {
    await Promise.allSettled([reportMutate(), orders.mutate(), agendaMutate()]);
  }
  useEffect(() => {
    const interval = setInterval(() => {
      void reportMutate();
      void agendaMutate();
    }, 60_000);
    return () => clearInterval(interval);
  }, [reportMutate, agendaMutate]);

  return (
    <>
      <PageHeading
        title="Painel da gerência"
        description="Priorize pendências, distribua o trabalho e acompanhe as entregas."
      >
        <Button variant="outline" disabled={report.isValidating} onClick={() => void refresh()}>
          Atualizar
        </Button>
        <Button onClick={() => setOrderOpen(true)}>
          <Plus data-icon="inline-start" />
          Novo atendimento
        </Button>
      </PageHeading>
      <QueryState
        loading={report.isLoading}
        error={report.error}
        onRetry={() => void reportMutate()}
      />
      <div className="mb-5 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <p>
          Indicadores sem registros marcados como demonstração.{' '}
          {overview &&
            `${overview.population.excludedDemonstrations} desconsiderados no recorte consultado.`}
        </p>
        {overview && <p>Atualizado em {date(overview.generatedAt)} · Fortaleza</p>}
      </div>
      <section aria-labelledby="operation-now" className="mb-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 id="operation-now" className="section-title">
              Operação agora
            </h2>
            <p className="section-subtitle">
              Todas as pendências, independentemente da data de criação. Selecione um grupo para ver
              os atendimentos.
            </p>
          </div>
          <ViewLink href={`${base}/plantao`}>Ver cobertura de plantão</ViewLink>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Object.entries(focuses).map(([key, item]) => (
            <button
              key={key}
              aria-pressed={focus === key}
              onClick={() => {
                setFocus(key as Focus);
                setPage(0);
              }}
              className={cn(
                'panel p-4 text-left focus-visible:outline-2 focus-visible:outline-primary',
                focus === key && 'border-primary',
              )}
            >
              <span className="text-xs text-muted-foreground">{item.label}</span>
              <strong className="mt-2 block text-3xl">
                {overview?.operation[item.metric] ?? '—'}
              </strong>
              <span className="mt-2 block text-xs text-muted-foreground">{item.help}</span>
            </button>
          ))}
        </div>
      </section>
      <section className="panel mb-6 min-w-0" aria-labelledby="attention-queue">
        <PanelHeading
          title={focuses[focus].label}
          description="Atrasadas e críticas primeiro; pausadas ao final. Abra o atendimento para agir conforme o fluxo publicado."
        >
          <ViewLink href={`${base}/ordens?situation=active`}>Consultar ordens</ViewLink>
        </PanelHeading>
        <QueryState
          loading={orders.isLoading}
          error={orders.error}
          onRetry={() => void orders.mutate()}
        />
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th id="attention-queue">Atendimento</th>
                <th>Responsável</th>
                <th>Etapa e prioridade</th>
                <th>Atenção</th>
                <th>
                  <span className="sr-only">Ação</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {usableList &&
                selected.slice(currentPage * 8, currentPage * 8 + 8).map((row) => (
                  <tr key={row.id}>
                    <td>
                      <Link className="text-link" href={`${base}/ordens/${row.id}`}>
                        {String(row.protocol)}
                      </Link>
                      <p className="mt-1 max-w-sm whitespace-normal">{String(row.title)}</p>
                      <p className="text-xs text-muted-foreground">{String(row.requester || '')}</p>
                    </td>
                    <td>
                      {String(row.analystName || 'Sem responsável')}
                      {!row.assigneeUserId && !!row.analystName && (
                        <p className="text-xs text-muted-foreground">Sem vínculo com usuário</p>
                      )}
                    </td>
                    <td>
                      <StatusBadge
                        status={
                          orderStatuses[String(row.status) as keyof typeof orderStatuses] ||
                          String(row.status)
                        }
                      />
                      <div className="mt-2">
                        <Priority
                          value={
                            priorities[String(row.priority) as keyof typeof priorities] ||
                            String(row.priority)
                          }
                        />
                      </div>
                    </td>
                    <td className="max-w-sm whitespace-normal">
                      {row.pausedAt
                        ? String(row.pauseReason || 'Pausada; consulte a justificativa')
                        : `${deadlineSituation(row, now!)} · ${date(row.deadlineAt)}`}
                      {!!row.scheduledAt && !row.scheduleStartedAt && (
                        <p className="mt-1 text-xs">Execução: {date(row.scheduledAt)}</p>
                      )}
                    </td>
                    <td>
                      <Link
                        className="text-link whitespace-nowrap"
                        href={`${base}/ordens/${row.id}`}
                      >
                        Abrir atendimento →
                      </Link>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        {usableList && !selected.length && (
          <p className="p-5 text-sm text-muted-foreground">Nenhum atendimento neste grupo.</p>
        )}
        {usableList && (
          <div className="flex flex-wrap items-center justify-between gap-3 p-4 text-xs">
            <span>
              {selected.length} atendimentos · página {currentPage + 1} de {pages}
            </span>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={!currentPage}
                onClick={() => setPage(currentPage - 1)}
              >
                Anterior
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={currentPage + 1 >= pages}
                onClick={() => setPage(currentPage + 1)}
              >
                Próxima
              </Button>
            </div>
          </div>
        )}
      </section>
      <div className="mb-6 grid gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <section className="panel min-w-0">
          <PanelHeading
            title="Distribuição do trabalho"
            description="Pendências atuais e entregas no período selecionado abaixo. Quantidade de ordens não mede esforço ou disponibilidade."
          >
            <ViewLink href={`${base}/tecnicos`}>Abrir equipe</ViewLink>
          </PanelHeading>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Integrante</th>
                  <th>Pendentes</th>
                  <th>Atrasadas</th>
                  <th>Pausadas</th>
                  <th>Entregas</th>
                </tr>
              </thead>
              <tbody>
                {overview?.team.map((person) => (
                  <tr key={person.id}>
                    <td>
                      {person.userId ? (
                        <Link className="text-link" href={`${base}/tecnicos/${person.userId}`}>
                          {person.name}
                        </Link>
                      ) : (
                        <span>
                          {person.name}
                          <span className="block text-xs text-muted-foreground">
                            Sem vínculo com usuário
                          </span>
                        </span>
                      )}
                    </td>
                    <td>{person.open}</td>
                    <td>{person.slaBreaches}</td>
                    <td>{person.paused}</td>
                    <td>{person.closed}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {overview && !overview.team.length && (
            <p className="p-5 text-sm text-muted-foreground">
              Nenhuma pendência ou entrega neste recorte.
            </p>
          )}
          <div className="p-4 text-xs text-muted-foreground">
            Para redistribuir, abra o atendimento e confira responsáveis, impedimentos e escala da
            equipe.
          </div>
        </section>
        <section className="panel min-w-0">
          <PanelHeading
            title="Agenda da equipe"
            description="Compromissos em andamento e dos próximos 7 dias. Prazos de SLA aparecem na fila de atenção."
          >
            <ViewLink href={`${base}/agenda`}>Abrir agenda</ViewLink>
          </PanelHeading>
          <QueryState
            loading={agenda.isLoading}
            error={agenda.error}
            onRetry={() => void agendaMutate()}
          />
          <div className="flex flex-col gap-4 px-5 pb-5">
            {!agenda.error &&
              upcoming.slice(0, 5).map((event) => (
                <Link
                  key={event.id}
                  className="rounded-lg border border-border p-3"
                  href={
                    event.serviceOrderId
                      ? `${base}/ordens/${encodeURIComponent(String(event.serviceOrderId))}`
                      : event.changeRequestId
                        ? `${base}/operacoes/changes/${encodeURIComponent(String(event.changeRequestId))}`
                        : `${base}/agenda?date=${localDay(new Date(String(event.startAt)))}`
                  }
                >
                  <p className="text-xs font-medium">{String(event.title)}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {date(event.startAt)}
                    {event.endAt ? ` até ${date(event.endAt)}` : ''}
                  </p>
                </Link>
              ))}
            {overview && !agenda.isLoading && !agenda.error && !upcoming.length && (
              <p className="text-sm text-muted-foreground">
                Nenhum compromisso nos próximos 7 dias.
              </p>
            )}
          </div>
        </section>
      </div>
      <section aria-labelledby="period-results" className="mb-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 id="period-results" className="section-title">
              Entregas e qualidade no período
            </h2>
            <p className="section-subtitle">
              Entradas por criação; entregas por resolução ou fechamento efetivo. Dias de Fortaleza.
            </p>
          </div>
          <select
            className="native-select"
            aria-label="Período dos resultados"
            value={days}
            onChange={(event) => setDays(Number(event.target.value))}
          >
            <option value={7}>Últimos 7 dias</option>
            <option value={30}>Últimos 30 dias</option>
            <option value={90}>Últimos 90 dias</option>
          </select>
        </div>
        <div className="metrics-grid grid grid-cols-4 gap-4">
          <Metric
            label="Novos atendimentos"
            value={String(results?.opened ?? '—')}
            icon={Plus}
            foot="criados no período"
          />
          <Metric
            label="Entregas no período"
            value={String(results?.closed ?? '—')}
            icon={CheckCircle2}
            foot="inclui ordens criadas antes do período"
          />
          <Metric
            label="Tempo médio de resolução"
            value={
              results ? (results.tmrHours === null ? 'Sem base' : `${results.tmrHours} h`) : '—'
            }
            icon={Clock3}
            foot={`${results?.measuredClosed ?? 0} entregas com datas válidas; tempo decorrido`}
          />
          <Metric
            label="Cumprimento de SLA"
            value={
              results
                ? results.slaPercentage === null
                  ? 'Sem base'
                  : `${results.slaPercentage}%`
                : '—'
            }
            icon={Timer}
            foot={`${results?.slaMet ?? 0} no prazo de ${results?.slaEvaluated ?? 0} entregas elegíveis`}
          />
        </div>
        {!!results?.missingCompletionDate && (
          <p role="status" className="mt-3 text-xs text-warning">
            {results.missingCompletionDate} ordens criadas no período estão concluídas sem data de
            conclusão e ficaram fora das medições.
          </p>
        )}
        <p className="mt-3 text-xs text-muted-foreground">
          Tempo de resolução inclui esperas e não equivale a horas trabalhadas. A avaliação da
          equipe também precisa considerar tipo, complexidade e jornada.{' '}
          <Link className="text-link" href={`${base}/relatorios?tab=satisfaction`}>
            Ver satisfação e quantidade de respostas
          </Link>
        </p>
      </section>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <section className="panel min-w-0">
          <PanelHeading
            title="Entradas e entregas"
            description="Eventos por dia no período dos resultados."
          />
          <QueryState
            loading={orders.isLoading}
            error={orders.error}
            onRetry={() => void orders.mutate()}
          />
          {usableList && (
            <div className="px-5 pb-5">
              <VolumeChart
                rows={rows}
                period={days === 7 ? 'week' : days === 90 ? 'quarter' : 'month'}
              />
            </div>
          )}
        </section>
        <section className="panel min-w-0">
          <PanelHeading
            title="Pendências por etapa"
            description="Todas as ordens ainda ativas; o período dos resultados não reduz esta fila."
          />
          {usableList && (
            <>
              <StatusChart rows={active} caption="pendências atuais" />
              <div className="grid grid-cols-2 gap-3 p-5">
                {statuses.map((item) => (
                  <Link
                    key={item.status}
                    className="flex items-center gap-2 text-xs"
                    href={`${base}/ordens?status=${item.status}`}
                  >
                    <span className="size-2 rounded-full" style={{ background: item.color }} />
                    {item.name}
                    <strong className="ml-auto">{item.value}</strong>
                  </Link>
                ))}
              </div>
            </>
          )}
        </section>
      </div>
      <OrderForm open={orderOpen} onOpenChange={setOrderOpen} />
    </>
  );
}
