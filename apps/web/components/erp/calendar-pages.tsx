'use client';
import { useRouteBase } from '@/lib/erp/visual-data';
import { OrderForm } from './order-form';
import { OccurrenceAttendance } from './occurrence-attendance';
import { ScheduleWorkspace } from './schedule-workspace';
import { RosterCoverage } from './team-roster';
import { useErp, useErpQuery } from '@/lib/erp/gateway';
import { queryPath } from '@/lib/erp/contracts';
import { useVisualSource } from '@/lib/erp/visual-data';
import { QueryState } from './contract-form';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Users,
  MapPin,
  ArrowLeft,
  AlertTriangle,
  Activity,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeading, PanelHeading, StatusBadge, Avatar, Metric } from './primitives';
import { AgendaEventDialog } from './agenda-event-dialog';
import { agendaDay, agendaTime, agendaEventOnDay } from '@/lib/erp/agenda';
import type { ErpRecord } from '@/lib/erp/contracts';
import { cn } from '@/lib/utils';
import { OrdersTable } from './orders';
import { useOrders, useDemoCollection } from '@/lib/demo-store';
const eventTypes: Record<string, string> = {
  LEMBRETE: 'Lembrete',
  REUNIAO: 'Reunião',
  REUNIAO_ONLINE: 'Reunião online',
  PLANTAO: 'Plantão',
  FERIADO: 'Feriado',
  OUTRO: 'Outro compromisso',
};
export function CalendarPage() {
  const portalBase = useRouteBase();
  const { scope } = useErp();
  const params = useSearchParams();
  const today = agendaDay(new Date());
  const requestedDate = params.get('date') || '';
  const [day, setDay] = useState(
    /^\d{4}-\d{2}-\d{2}$/.test(requestedDate) &&
      Number.isFinite(new Date(`${requestedDate}T12:00:00-03:00`).getTime())
      ? requestedDate
      : today,
  );
  const year = Number(day.slice(0, 4)),
    month = Number(day.slice(5, 7)) - 1;
  const selected = Number(day.slice(8, 10));
  const manager = !!scope && ['super_admin', 'gerente'].includes(scope.role);
  const [view, setView] = useState(manager ? 'Equipe' : 'Lista');
  const [agendaScope, setAgendaScope] = useState(manager ? 'team' : 'mine');
  const [search, setSearch] = useState('');
  const [kind, setKind] = useState('all');
  const [assignee, setAssignee] = useState('');
  const [showPast, setShowPast] = useState(false);
  const [newAppointment, setNewAppointment] = useState(false);
  const [detail, setDetail] = useState<string | null>(null);
  const endpoint = queryPath(
    manager && agendaScope === 'team' ? '/calendar/events/all' : '/calendar/events',
    {
      from: `${year}-${String(month + 1).padStart(2, '0')}-01T03:00:00.000Z`,
      to: new Date(Date.UTC(year, month + 1, 1, 3)).toISOString(),
      assigneeId: manager && agendaScope === 'team' ? assignee || undefined : undefined,
    },
  );
  const source = useVisualSource('events', endpoint);
  const users = useErpQuery<{ id: string; name: string }[]>(manager ? '/calendar/users' : null);
  const refresh = source.mutate;
  useEffect(() => {
    const timer = setInterval(() => void refresh(), 60000);
    return () => clearInterval(timer);
  }, [refresh]);
  const normalize = (value: string) =>
    value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLocaleLowerCase('pt-BR');
  const events = source.raw.filter(
    (event) =>
      (kind === 'all' ||
        (kind === 'orders'
          ? !!event.serviceOrderId
          : kind === 'global'
            ? !!event.isGlobal
            : !event.isGlobal && !event.serviceOrderId)) &&
      normalize(
        `${event.title || ''} ${event.description || ''} ${event.location || ''} ${(event.assignee as { name?: string } | undefined)?.name || ''} ${(event.createdBy as { name?: string } | undefined)?.name || ''}`,
      ).includes(normalize(search.trim())),
  );
  const count = new Date(year, month + 1, 0).getDate();
  const start = new Date(year, month, 1).getDay();
  const dateKey = (number: number) =>
    `${year}-${String(month + 1).padStart(2, '0')}-${String(number).padStart(2, '0')}`;
  const onDay = (event: ErpRecord, target: string) =>
    agendaEventOnDay(
      { startAt: String(event.startAt), endAt: event.endAt ? String(event.endAt) : null },
      target,
    );
  const selectedEvents = events.filter((event) => onDay(event, day));
  const listed =
    view === 'Dia'
      ? selectedEvents
      : events.filter(
          (event) =>
            showPast ||
            dateKey(count) < today ||
            (event.endAt
              ? agendaDay(new Date(new Date(String(event.endAt)).getTime() - 1))
              : agendaDay(String(event.startAt))) >= today,
        );
  const detailRecord = source.raw.find((event) => event.id === detail);
  function selectDay(value: string) {
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
      !Number.isFinite(new Date(`${value}T12:00:00-03:00`).getTime())
    )
      return;
    setDay(value);
    const next = new URLSearchParams(window.location.search);
    next.set('date', value);
    window.history.replaceState(null, '', `${portalBase}/agenda?${next}`);
  }
  function move(diff: number) {
    const target = new Date(Date.UTC(year, month + diff, 1, 12));
    selectDay(target.toISOString().slice(0, 10));
  }
  async function appointmentSaved(record?: ErpRecord) {
    await source.mutate();
    if (record?.startAt) {
      const target = agendaDay(String(record.startAt));
      selectDay(target);
      setSearch('');
      setKind('all');
      if (target < today) setShowPast(true);
      if (assignee && record.assigneeId !== assignee) setAssignee('');
      if (view === 'Conflitos') setView('Dia');
    }
  }
  const timeLabel = (event: ErpRecord) =>
    event.allDay
      ? 'Dia inteiro'
      : `${agendaTime(String(event.startAt))}${event.endAt ? ` – ${agendaDay(String(event.endAt)) !== agendaDay(String(event.startAt)) ? agendaDay(String(event.endAt)).split('-').reverse().join('/') + ' ' : ''}${agendaTime(String(event.endAt))}` : ''}`;
  const personLabel = (event: ErpRecord) =>
    String(
      (event.assignee as { name?: string } | undefined)?.name ||
        (event.createdBy as { name?: string } | undefined)?.name ||
        '',
    );
  function eventButton(event: ErpRecord) {
    return (
      <button
        key={event.id}
        className="flex w-full flex-wrap items-start gap-3 border-b border-border py-4 text-left"
        onClick={() => setDetail(event.id)}
      >
        <CalendarDays className="mt-1 size-4 shrink-0 text-primary" />
        <span className="min-w-0 flex-1 space-y-1">
          <span className="block text-xs text-muted-foreground">
            {agendaDay(String(event.startAt)).split('-').reverse().join('/')} · {timeLabel(event)}
          </span>
          <span className="block break-words text-sm font-medium">{String(event.title)}</span>
          <span className="block text-xs text-muted-foreground">
            {eventTypes[String(event.type)] || String(event.type)}
            {personLabel(event) ? ` · ${personLabel(event)}` : ''}
          </span>
        </span>
        {Boolean(event.serviceOrderId) && (
          <span className="rounded bg-primary/10 px-2 py-1 text-[10px] text-primary">
            O.S. vinculada
          </span>
        )}
        {Boolean(event.isGlobal) && (
          <span className="rounded bg-secondary px-2 py-1 text-[10px]">Toda a equipe</span>
        )}
        <ChevronRight className="mt-1 size-4 shrink-0 text-muted-foreground" />
      </button>
    );
  }
  return (
    <>
      <PageHeading
        title="Agenda"
        description="Compromissos e execuções de O.S. Horários de Fortaleza."
      >
        <Button onClick={() => setNewAppointment(true)}>Novo compromisso</Button>
        <Link className="text-link" href={`${portalBase}/ordens`}>
          Escolher O.S. para agendar →
        </Link>
      </PageHeading>
      <div className="grid gap-5 xl:grid-cols-[1fr_280px]">
        <section className="panel min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-5">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="section-title capitalize">
                {new Date(year, month, 1).toLocaleDateString('pt-BR', {
                  month: 'long',
                  year: 'numeric',
                })}
              </h2>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Mês anterior"
                onClick={() => move(-1)}
              >
                <ChevronLeft />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Próximo mês"
                onClick={() => move(1)}
              >
                <ChevronRight />
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => selectDay(today)}>
                Hoje
              </Button>
              <select
                className="native-select"
                aria-label="Visualização da agenda"
                value={view}
                onChange={(event) => {
                  setView(event.target.value);
                  if (event.target.value === 'Equipe') setAgendaScope('team');
                }}
              >
                <option>Mês</option>
                <option>Lista</option>
                <option>Dia</option>
                {manager && <option>Equipe</option>}
                {manager && <option>Conflitos</option>}
              </select>
            </div>
          </div>
          <div className="flex flex-wrap gap-3 border-b border-border p-5">
            <input
              className="native-select min-w-0 flex-1"
              type="search"
              aria-label="Buscar compromissos"
              placeholder="Compromisso, descrição ou responsável"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <select
              className="native-select"
              aria-label="Filtrar compromissos"
              value={kind}
              onChange={(event) => setKind(event.target.value)}
            >
              <option value="all">Todos os compromissos</option>
              <option value="orders">O.S. vinculadas</option>
              <option value="personal">Compromissos pessoais</option>
              <option value="global">Toda a equipe</option>
            </select>
            {manager && (
              <select
                className="native-select"
                aria-label="Escopo da agenda"
                value={agendaScope}
                onChange={(event) => setAgendaScope(event.target.value)}
              >
                <option value="mine">Minha agenda</option>
                <option value="team">Agenda da equipe</option>
              </select>
            )}
            {manager && agendaScope === 'team' && (
              <select
                className="native-select"
                aria-label="Filtrar responsável da agenda"
                value={assignee}
                onChange={(event) => setAssignee(event.target.value)}
              >
                <option value="">Toda a equipe</option>
                {users.data?.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name}
                  </option>
                ))}
              </select>
            )}
          </div>
          <QueryState
            loading={source.isLoading}
            error={source.error}
            onRetry={() => void source.mutate()}
          />
          {!source.isLoading &&
            !source.error &&
            (view === 'Conflitos' ? (
              <ScheduleWorkspace initialTab="conflicts" />
            ) : view === 'Mês' ? (
              <div className="overflow-x-auto">
                <div className="calendar-grid border-t border-border">
                  {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((label) => (
                    <div
                      className="border-b border-border py-3 text-center text-[10px] text-muted-foreground"
                      key={label}
                    >
                      {label}
                    </div>
                  ))}
                  {Array.from({ length: Math.ceil((count + start) / 7) * 7 }, (_, index) => {
                    const number = index - start + 1,
                      valid = number > 0 && number <= count;
                    const dayEvents = valid
                      ? events.filter((event) => onDay(event, dateKey(number)))
                      : [];
                    return (
                      <div
                        key={index}
                        className={cn(
                          'calendar-cell',
                          !valid && 'bg-muted/40',
                          valid && number === selected && 'bg-secondary/35',
                        )}
                      >
                        <button
                          disabled={!valid}
                          aria-pressed={valid && number === selected}
                          aria-label={valid ? `Selecionar dia ${number}` : 'Fora do mês'}
                          className={cn(
                            'flex size-6 items-center justify-center rounded-full text-[11px]',
                            valid && dateKey(number) === today
                              ? 'bg-primary text-primary-foreground'
                              : 'text-muted-foreground',
                          )}
                          onClick={() => selectDay(dateKey(number))}
                        >
                          {valid ? number : ''}
                        </button>
                        {dayEvents.slice(0, 3).map((event) => (
                          <button
                            key={event.id}
                            className="calendar-event block w-full text-left"
                            onClick={() => {
                              selectDay(dateKey(number));
                              setDetail(event.id);
                            }}
                          >
                            <span className="block opacity-70">
                              {event.allDay ? 'Dia inteiro' : agendaTime(String(event.startAt))}
                            </span>
                            <span className="line-clamp-2">{String(event.title)}</span>
                          </button>
                        ))}
                        {dayEvents.length > 3 && (
                          <button
                            className="text-link text-xs"
                            onClick={() => {
                              selectDay(dateKey(number));
                              setView('Dia');
                            }}
                          >
                            Mais {dayEvents.length - 3} compromissos
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="px-5 pb-5">
                {view !== 'Dia' && (
                  <label className="my-4 flex items-center gap-2 text-xs text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={showPast}
                      onChange={(event) => setShowPast(event.target.checked)}
                    />
                    Mostrar compromissos anteriores deste mês
                  </label>
                )}
                <p className="my-3 text-xs text-muted-foreground">
                  {listed.length} compromissos
                  {view === 'Dia' ? ` em ${day.split('-').reverse().join('/')}` : ' neste período'}
                </p>
                {listed.length ? (
                  listed.map(eventButton)
                ) : (
                  <p role="status" className="py-8 text-sm text-muted-foreground">
                    Nenhum compromisso encontrado neste período.
                  </p>
                )}
              </div>
            ))}
        </section>
        <section className="panel h-fit min-w-0">
          <PanelHeading
            title={`Dia ${selected}`}
            description={day.split('-').reverse().join('/')}
          />
          <div className="space-y-4 px-5 pb-5">
            <label className="block text-xs text-muted-foreground">
              Ir para a data
              <input
                className="native-select mt-2 w-full"
                type="date"
                aria-label="Ir para a data"
                value={day}
                onChange={(event) => selectDay(event.target.value)}
              />
            </label>
            {!source.isLoading && !source.error && selectedEvents.map(eventButton)}
            <p className="text-xs text-muted-foreground">
              {source.isLoading
                ? 'Carregando compromissos…'
                : source.error
                  ? 'Não foi possível consultar os compromissos.'
                  : `${selectedEvents.length} compromissos nesta data.`}
            </p>
            <Button className="w-full" variant="outline" onClick={() => setNewAppointment(true)}>
              Agendar neste dia
            </Button>
          </div>
          <RosterCoverage date={day} />
        </section>
      </div>
      {(newAppointment || detailRecord) && (
        <AgendaEventDialog
          key={detailRecord?.id || 'new'}
          event={detailRecord}
          date={day}
          base={portalBase}
          onClose={() => {
            setNewAppointment(false);
            setDetail(null);
          }}
          onSaved={appointmentSaved}
        />
      )}
    </>
  );
}
const initialIncidents = [
  {
    id: 'INC-0018',
    title: 'Rompimento de fibra na região norte',
    provider: 'NetMais',
    priority: 'Crítica',
    status: 'Em análise',
    orders: 5,
    time: 'Hoje, 08:55',
  },
  {
    id: 'INC-0017',
    title: 'Instabilidade no backbone principal',
    provider: 'Conecta Telecom',
    priority: 'Alta',
    status: 'Aberta',
    orders: 3,
    time: 'Hoje, 07:40',
  },
  {
    id: 'INC-0016',
    title: 'Manutenção emergencial no POP Centro',
    provider: 'Veloz Fibra',
    priority: 'Alta',
    status: 'Aguardando campo',
    orders: 2,
    time: 'Ontem, 16:20',
  },
  {
    id: 'INC-0015',
    title: 'Oscilação de energia no datacenter',
    provider: 'Linknet',
    priority: 'Normal',
    status: 'Resolvida',
    orders: 4,
    time: 'Ontem, 10:15',
  },
];
export function OccurrencesPage({
  id,
  initialTab = 'Resumo',
}: {
  id?: string;
  initialTab?: string;
}) {
  const portalBase = useRouteBase();
  const [items] = useDemoCollection('incidents', initialIncidents);
  const { orders } = useOrders();
  if (id) return <OccurrenceAttendance id={id} initialTab={initialTab} />;
  return (
    <>
      <PageHeading
        title="Ocorrências"
        description="Do primeiro sinal à resolução. Incidentes sob controle."
      >
        <OrderForm />
      </PageHeading>
      <div className="metrics-grid mb-6 grid grid-cols-3 gap-4">
        <Metric
          label="Ocorrências ativas"
          value={String(items.filter((i) => i.status !== 'Encerrada').length)}
          icon={Activity}
          change={`${new Set(items.map((item) => item.provider)).size} provedores`}
          foot="com incidentes ativos"
        />
        <Metric
          label="Prioridade crítica"
          value={String(items.filter((item) => item.priority === 'Crítica').length)}
          icon={AlertTriangle}
          change="Atenção"
          foot="requer acompanhamento"
          warning
        />
        <Metric
          label="Ordens impactadas"
          value={String(items.reduce((sum, item) => sum + Number(item.orders || 0), 0))}
          icon={Activity}
          change="Em atendimento"
          foot="pela equipe técnica"
        />
      </div>
      <section className="panel">
        <PanelHeading
          title="Central de incidentes"
          description="Acompanhe eventos que impactam a operação"
        />
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Ocorrência</th>
                <th>Provedor</th>
                <th>Prioridade</th>
                <th>Status</th>
                <th>Ordens vinculadas</th>
                <th>Registro</th>
              </tr>
            </thead>
            <tbody>
              {items.map((i) => (
                <tr key={i.id}>
                  <td>
                    <Link href={portalBase + '/ocorrencias/' + i.id}>
                      <span className="block text-[9px] text-muted-foreground">{i.id}</span>
                      <strong className="mt-1 block font-medium">{i.title}</strong>
                    </Link>
                  </td>
                  <td>{i.provider}</td>
                  <td>
                    <StatusBadge status={i.priority} />
                  </td>
                  <td>
                    <StatusBadge status={i.status} />
                  </td>
                  <td>{i.orders} ordens</td>
                  <td className="text-muted-foreground">{i.time}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
function ClipboardIcon() {
  return <Activity />;
}
