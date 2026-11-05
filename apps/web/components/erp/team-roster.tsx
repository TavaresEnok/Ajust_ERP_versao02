'use client';

import { useState } from 'react';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Download,
  Filter,
  History,
  LayoutGrid,
  List,
  Moon,
  Search,
  Settings2,
  Sun,
  Users,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { useErp, useErpAction, useErpQuery } from '@/lib/erp/gateway';
import { useRouteBase } from '@/lib/erp/visual-data';
import { cn } from '@/lib/utils';
import {
  addRosterDays as addDays,
  rosterWeekStart as monday,
  rosterDateLabel as dateLabel,
  buildRosterCalendar,
  countSpecialAssignments,
  type RosterMember as Member,
  type RosterDay as Day,
} from '@/lib/erp/team-roster';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Avatar, PageHeading, ViewLink } from './primitives';
import { QueryState } from './contract-form';
import {
  MemberChips,
  RosterSummary,
  RosterTable,
  RosterBoard,
  RosterDayDetails,
} from './team-roster-views';

type Policy = {
  effectiveFrom: string;
  dayUserIds: string[];
  nightUserIds: string[];
  version: number;
};
type Override = {
  date: string;
  userIds: string[];
  holidayName: string | null;
  notes: string | null;
  version: number;
};
type HistoryEntry = {
  id: string;
  createdAt: string;
  actorUser: { name: string } | null;
  metadata: {
    operation: string;
    date: string;
    previous: {
      userIds?: string[];
      dayUserIds?: string[];
      nightUserIds?: string[];
      holidayName?: string | null;
      notes?: string | null;
    } | null;
    next: {
      userIds?: string[];
      dayUserIds?: string[];
      nightUserIds?: string[];
      holidayName?: string | null;
      notes?: string | null;
    } | null;
  };
};
type Roster = {
  today: string;
  timezone: string;
  configured: boolean;
  policies: Policy[];
  overrides: Override[];
  members: Member[];
  days: Day[];
  todayRoster: Day;
  nextAssignment: { date: string; shifts: string[] } | null;
  nextHoliday: { date: string; name: string } | null;
  history: HistoryEntry[];
};

function demoRoster(
  from: string,
  today: string,
  actualDays: Day[] = [],
  nextHoliday: Roster['nextHoliday'] = null,
): Roster {
  const names = [
    'Cesar',
    'Audemario',
    'Laura',
    'Luiz',
    'François',
    'Renan',
    'Denilson',
    'Izes',
    'Fabio',
    'Vitor',
    'Analista noturno A',
    'Analista noturno B',
  ];
  const members = names.map((name, index) => ({ id: `demo-${index}`, name, active: true }));
  const nightUserIds = ['demo-10', 'demo-11'];
  const resolve = (date: string): Day => {
    const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
    const weekend = weekday === 0 || weekday === 6;
    const weekNumber = Math.floor(Date.parse(monday(date)) / (7 * 86400000));
    const dayUserIds =
      weekday === 6
        ? weekNumber % 2 === 0
          ? ['demo-0', 'demo-1', 'demo-2', 'demo-3', 'demo-4']
          : ['demo-5', 'demo-6', 'demo-7']
        : weekday === 0
          ? ['demo-6', 'demo-8', 'demo-9']
          : ['demo-0', 'demo-1', 'demo-2', 'demo-5'];
    return {
      date,
      weekend,
      holidayName: null,
      dayUserIds,
      nightUserIds,
      notes: weekend ? 'Equipe demonstrativa para esta data.' : null,
      daySource: weekend ? 'programmed' : 'fixed',
      dayPending: false,
      nightPending: false,
    };
  };
  return {
    today,
    timezone: 'America/Sao_Paulo',
    configured: false,
    members,
    policies: [],
    overrides: [],
    days: Array.from({ length: 28 }, (_, index) => {
      const date = addDays(from, index);
      const example = resolve(date);
      const actual = actualDays.find((day) => day.date === date);
      return actual?.holidayName ? { ...example, holidayName: actual.holidayName } : example;
    }),
    todayRoster: resolve(today),
    nextAssignment: null,
    nextHoliday,
    history: [],
  };
}

function MemberPicker({
  label,
  ids,
  onChange,
  members,
  assignmentCounts,
}: {
  label: string;
  ids: string[];
  onChange: (ids: string[]) => void;
  members: Member[];
  assignmentCounts?: Map<string, number>;
}) {
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('name');
  const normalized = (value: string) =>
    value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  const candidates = members
    .filter(
      (member) => member.active && normalized(member.name).includes(normalized(search.trim())),
    )
    .sort(
      (a, b) =>
        (sort === 'count'
          ? (assignmentCounts?.get(a.id) || 0) - (assignmentCounts?.get(b.id) || 0)
          : 0) || a.name.localeCompare(b.name, 'pt-BR'),
    );
  return (
    <fieldset className="min-w-0 space-y-3">
      <legend className="mb-2 text-sm font-semibold">
        {label}{' '}
        <span className="ml-1 text-xs font-normal text-muted-foreground">
          {ids.length} {ids.length === 1 ? 'selecionado' : 'selecionados'}
        </span>
      </legend>
      <div className="min-h-12 rounded-xl border bg-secondary/30 p-3">
        {ids.length ? (
          <MemberChips
            ids={ids}
            members={members}
            onRemove={(id) => onChange(ids.filter((selected) => selected !== id))}
          />
        ) : (
          <p className="text-xs text-muted-foreground">
            Selecione os integrantes da equipe abaixo.
          </p>
        )}
      </div>
      <label className="flex items-center gap-2 rounded-lg border bg-background px-3 py-2">
        <Search className="size-4 shrink-0 text-muted-foreground" />
        <input
          type="search"
          aria-label={`Pesquisar em ${label}`}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="min-w-0 flex-1 bg-transparent text-sm outline-none"
          placeholder="Pesquisar integrante pelo nome…"
        />
      </label>
      {assignmentCounts && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-[11px] text-muted-foreground">
            Plantões diurnos no período exibido
          </span>
          <select
            aria-label="Ordenar integrantes"
            className="native-select w-auto text-xs"
            value={sort}
            onChange={(event) => setSort(event.target.value)}
          >
            <option value="name">Nome</option>
            <option value="count">Menos plantões no período</option>
          </select>
        </div>
      )}
      <div className="max-h-56 overflow-y-auto rounded-xl border bg-background p-1">
        {candidates.map((member) => (
          <label
            key={member.id}
            className={cn(
              'flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors hover:bg-secondary',
              ids.includes(member.id) && 'bg-primary/5',
            )}
          >
            <input
              type="checkbox"
              checked={ids.includes(member.id)}
              onChange={(event) =>
                onChange(
                  event.target.checked ? [...ids, member.id] : ids.filter((id) => id !== member.id),
                )
              }
              className="size-4 accent-primary"
            />
            <Avatar name={member.name} className="size-6 text-[10px]" />
            <span className="min-w-0 flex-1 break-words text-xs font-medium">{member.name}</span>
            {assignmentCounts && (
              <span className="shrink-0 rounded-md bg-secondary px-2 py-1 text-[10px] text-muted-foreground">
                {assignmentCounts.get(member.id) || 0}{' '}
                {assignmentCounts.get(member.id) === 1 ? 'plantão' : 'plantões'}
              </span>
            )}
          </label>
        ))}
        {!candidates.length && (
          <p className="px-3 py-4 text-xs text-muted-foreground">
            Nenhum integrante ativo encontrado.
          </p>
        )}
      </div>
    </fieldset>
  );
}

function PolicyEditor({
  roster,
  onSaved,
  onClose,
}: {
  roster: Roster;
  onSaved: () => Promise<unknown>;
  onClose: () => void;
}) {
  const action = useErpAction();
  const initial = [...roster.policies]
    .reverse()
    .find((policy) => policy.effectiveFrom <= roster.today);
  const [effectiveFrom, setEffectiveFrom] = useState(roster.today);
  const [dayIds, setDayIds] = useState(initial?.dayUserIds || []);
  const [nightIds, setNightIds] = useState(initial?.nightUserIds || []);
  const [error, setError] = useState('');
  const [expectedVersion, setExpectedVersion] = useState(
    roster.policies.find((policy) => policy.effectiveFrom === roster.today)?.version ?? 0,
  );
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !action.pending) onClose();
      }}
    >
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Equipes fixas</DialogTitle>
          <DialogDescription>
            A equipe diurna se repete nos dias úteis. A noturna se repete todos os dias, inclusive
            fins de semana e feriados.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-5"
          onSubmit={async (event) => {
            event.preventDefault();
            setError('');
            try {
              await action.execute({
                path: '/on-call/roster/policy',
                method: 'PUT',
                body: {
                  effectiveFrom,
                  dayUserIds: dayIds,
                  nightUserIds: nightIds,
                  expectedVersion,
                },
              });
              toast.success('Equipes fixas atualizadas.');
              await onSaved();
              onClose();
            } catch (reason) {
              setError(reason instanceof Error ? reason.message : 'Não foi possível salvar.');
            }
          }}
        >
          <label className="grid gap-2 text-sm font-medium">
            Válida a partir de
            <input
              type="date"
              required
              value={effectiveFrom}
              className="native-input w-fit"
              onChange={(event) => {
                const date = event.target.value;
                setEffectiveFrom(date);
                const policy = [...roster.policies]
                  .reverse()
                  .find((entry) => entry.effectiveFrom <= date);
                setDayIds(policy?.dayUserIds || []);
                setNightIds(policy?.nightUserIds || []);
                setExpectedVersion(
                  roster.policies.find((entry) => entry.effectiveFrom === date)?.version ?? 0,
                );
              }}
            />
          </label>
          <p className="text-xs text-muted-foreground">
            A alteração vale a partir dessa data até a próxima configuração. Dias com programação
            própria mantêm a equipe diurna escolhida.
          </p>
          <div className="grid gap-5 sm:grid-cols-2">
            <MemberPicker
              label="Dia · segunda a sexta"
              ids={dayIds}
              onChange={setDayIds}
              members={roster.members}
            />
            <MemberPicker
              label="Noite · todos os dias"
              ids={nightIds}
              onChange={setNightIds}
              members={roster.members}
            />
          </div>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2 border-t pt-4">
            <Button type="button" variant="outline" disabled={action.pending} onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={action.pending || !effectiveFrom}>
              {action.pending ? 'Salvando…' : 'Salvar equipes fixas'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DayEditor({
  day,
  roster,
  onSaved,
  onClose,
}: {
  day: Day;
  roster: Roster;
  onSaved: () => Promise<unknown>;
  onClose: () => void;
}) {
  const action = useErpAction();
  const [override] = useState(() => roster.overrides.find((entry) => entry.date === day.date));
  const [ids, setIds] = useState(day.dayUserIds);
  const [holidayName, setHolidayName] = useState(override?.holidayName || '');
  const [holiday, setHoliday] = useState(
    Boolean(override?.holidayName) || (!day.weekend && !day.holidayName),
  );
  const [notes, setNotes] = useState(day.notes || '');
  const [error, setError] = useState('');
  const [confirmRestore, setConfirmRestore] = useState(false);
  const finish = async () => {
    await onSaved();
    onClose();
  };
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !action.pending) onClose();
      }}
    >
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            Equipe diurna ·{' '}
            {dateLabel(day.date, { day: '2-digit', month: 'long', year: 'numeric' })}
          </DialogTitle>
          <DialogDescription>
            Selecione quem trabalha nesta data. Para uma troca, desmarque quem sai e marque quem
            entra.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={async (event) => {
            event.preventDefault();
            setError('');
            if (!day.weekend && !day.holidayName && !holiday) {
              setError('Marque esta data como feriado para incluí-la na escala especial.');
              return;
            }
            try {
              await action.execute({
                path: `/on-call/roster/days/${day.date}`,
                method: 'PUT',
                body: {
                  userIds: ids,
                  holidayName: holiday ? holidayName : null,
                  notes,
                  expectedVersion: override?.version ?? 0,
                },
              });
              toast.success(
                ids.length ? 'Equipe da data atualizada.' : 'Data salva como pendente de equipe.',
              );
              await finish();
            } catch (reason) {
              setError(reason instanceof Error ? reason.message : 'Não foi possível salvar.');
            }
          }}
        >
          <MemberPicker
            label="Quem vai trabalhar de dia?"
            ids={ids}
            onChange={setIds}
            members={roster.members}
            assignmentCounts={countSpecialAssignments(roster.days)}
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={holiday}
              onChange={(event) => setHoliday(event.target.checked)}
              className="size-4 accent-primary"
            />
            Marcar como feriado na escala
          </label>
          {holiday && (
            <label className="grid gap-1 text-xs text-muted-foreground">
              Nome do feriado
              <input
                className="native-input"
                required
                maxLength={120}
                value={holidayName}
                onChange={(event) => setHolidayName(event.target.value)}
                placeholder="Ex.: feriado municipal"
              />
            </label>
          )}
          {day.holidayName && !override?.holidayName && (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              Feriado cadastrado no calendário: {day.holidayName}
            </p>
          )}
          <label className="grid gap-2 text-sm">
            Orientações para esta data{' '}
            <span className="text-xs text-muted-foreground">Opcional</span>
            <textarea
              className="native-input min-h-20 resize-y"
              maxLength={1000}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Orientações para a equipe…"
            />
            <span className="text-right text-[10px] tabular-nums text-muted-foreground">
              {notes.length} / 1.000 caracteres
            </span>
          </label>
          <p className="text-xs text-muted-foreground">
            A equipe noturna continua seguindo a configuração fixa.
          </p>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          {override && (
            <div className="border-t pt-3">
              {confirmRestore ? (
                <div className="space-y-2 rounded-lg bg-secondary p-3 text-xs">
                  <p>
                    Remover a programação e o feriado manual desta data? A equipe diurna volta ao
                    padrão; fins de semana e feriados ficam sem equipe definida.
                  </p>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={action.pending}
                      onClick={() => setConfirmRestore(false)}
                    >
                      Manter programação
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      disabled={action.pending}
                      onClick={async () => {
                        setError('');
                        try {
                          await action.execute({
                            path: `/on-call/roster/days/${day.date}?version=${override.version}`,
                            method: 'DELETE',
                          });
                          toast.success('Programação removida.');
                          await finish();
                        } catch (reason) {
                          setError(
                            reason instanceof Error
                              ? reason.message
                              : 'Não foi possível restaurar.',
                          );
                        }
                      }}
                    >
                      Restaurar padrão
                    </Button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  className="text-xs text-muted-foreground underline underline-offset-4"
                  onClick={() => setConfirmRestore(true)}
                >
                  Remover programação e restaurar padrão
                </button>
              )}
            </div>
          )}
          <div className="flex justify-end gap-2 border-t pt-4">
            <Button type="button" variant="outline" disabled={action.pending} onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={action.pending || (holiday && !holidayName.trim())}>
              {action.pending ? 'Salvando…' : 'Salvar equipe da data'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function RosterHistory({
  history,
  members,
  timezone,
}: {
  history: HistoryEntry[];
  members: Member[];
  timezone: string;
}) {
  const names = (ids: string[] = []) =>
    ids
      .map((id) => members.find((member) => member.id === id)?.name || 'Integrante indisponível')
      .join(', ') || 'Nenhum';
  return (
    <details className="panel mt-5 p-5">
      <summary className="flex cursor-pointer items-center gap-2 text-sm font-semibold">
        <History className="size-4 text-muted-foreground" />
        Histórico de alterações{' '}
        <span className="text-xs font-normal text-muted-foreground">Últimas {history.length}</span>
      </summary>
      <div className="mt-4 space-y-3">
        {!history.length && (
          <p className="text-sm text-muted-foreground">
            As programações e trocas da equipe aparecerão aqui.
          </p>
        )}
        {history.map((entry) => {
          const { previous, next, operation, date } = entry.metadata;
          const removed = previous?.userIds?.filter((id) => !next?.userIds?.includes(id)) || [];
          const added = next?.userIds?.filter((id) => !previous?.userIds?.includes(id)) || [];
          return (
            <div key={entry.id} className="rounded-lg border px-4 py-3 text-xs">
              <div className="flex flex-wrap justify-between gap-2">
                <p className="font-medium">
                  {operation === 'fixed-teams'
                    ? 'Equipes fixas válidas a partir de'
                    : operation === 'restore-day'
                      ? 'Programação removida em'
                      : 'Equipe diurna de'}{' '}
                  {dateLabel(date, { day: '2-digit', month: '2-digit', year: 'numeric' })}
                </p>
                <span className="text-muted-foreground">
                  {entry.actorUser?.name || 'Equipe Ajust'} ·{' '}
                  {new Date(entry.createdAt).toLocaleString('pt-BR', { timeZone: timezone })}
                </span>
              </div>
              {operation === 'fixed-teams' ? (
                <div className="mt-2 space-y-1 text-muted-foreground">
                  <p>
                    Dia: {names(previous?.dayUserIds)} → {names(next?.dayUserIds)}
                  </p>
                  <p>
                    Noite: {names(previous?.nightUserIds)} → {names(next?.nightUserIds)}
                  </p>
                </div>
              ) : operation === 'restore-day' ? (
                <p className="mt-2 text-muted-foreground">
                  Equipe anterior: {names(previous?.userIds)}. Voltou ao padrão da data.
                </p>
              ) : (
                <div className="mt-2 space-y-1 text-muted-foreground">
                  {removed.length > 0 && <p>Saiu: {names(removed)}</p>}
                  {added.length > 0 && <p>Entrou: {names(added)}</p>}
                  {!added.length && !removed.length && (
                    <p>Orientações ou indicação de feriado atualizadas.</p>
                  )}
                  {previous?.notes !== next?.notes && (
                    <p>Orientações: {next?.notes || 'Removidas'}</p>
                  )}
                  {previous?.holidayName !== next?.holidayName && (
                    <p>Feriado: {next?.holidayName || 'Removido'}</p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </details>
  );
}

export function TeamRosterPage() {
  const { scope } = useErp();
  const manager = Boolean(scope && ['super_admin', 'gerente'].includes(scope.role));
  const base = useRouteBase();
  const [initialToday] = useState(() =>
    new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date()),
  );
  const [from, setFrom] = useState(() => monday(initialToday));
  const [example, setExample] = useState(false);
  const [editor, setEditor] = useState<Day | 'policy' | null>(null);
  const [detailDate, setDetailDate] = useState<string | null>(null);
  const [holidayDate, setHolidayDate] = useState('');
  const [showHolidayPicker, setShowHolidayPicker] = useState(false);
  const [view, setView] = useState<'table' | 'calendar'>('table');
  const [pendingOnly, setPendingOnly] = useState(false);
  const [mineOnly, setMineOnly] = useState(false);
  const periodEnd = addDays(from, 27);
  const query = useErpQuery<Roster>('/on-call/roster?from=' + from + '&to=' + periodEnd);
  const real = query.data;
  const demo = Boolean(real && example);
  const roster = real && demo ? demoRoster(from, real.today, real.days, real.nextHoliday) : real;
  const ownId = demo ? undefined : scope?.userId;
  const days = roster?.days.filter((day) => day.weekend || day.holidayName) || [];
  const visibleDays = days.filter(
    (day) =>
      (!pendingOnly || day.dayPending) &&
      (!mineOnly || Boolean(ownId && day.dayUserIds.includes(ownId))),
  );
  const today = roster?.today || initialToday;
  const detail = roster?.days.find((day) => day.date === detailDate);
  const exportDays = demo
    ? []
    : days.filter(
        (day) =>
          day.dayUserIds.length > 0 &&
          (manager || Boolean(ownId && day.dayUserIds.includes(ownId))),
      );
  function clearFilters() {
    setPendingOnly(false);
    setMineOnly(false);
  }
  function goToPeriod(date: string) {
    setFrom(monday(date));
    setShowHolidayPicker(false);
    setDetailDate(null);
  }
  function goToDay(date: string) {
    clearFilters();
    requestAnimationFrame(() =>
      document
        .getElementById('plantao-' + date)
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' }),
    );
  }
  function downloadCalendar() {
    if (!roster || !scope || demo || !exportDays.length) return;
    const content = buildRosterCalendar({
      days: exportDays,
      members: roster.members,
      tenantId: scope.tenantId,
      userId: manager ? undefined : ownId,
    });
    const url = URL.createObjectURL(new Blob([content], { type: 'text/calendar;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'ajust-plantoes-' + from + '.ics';
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast.success('Calendário de plantões baixado.');
  }
  const viewProps = roster
    ? {
        days: visibleDays,
        members: roster.members,
        today,
        ownId,
        canEdit: manager && !demo,
        onEdit: (day: Day) => setEditor(day),
        onDetails: (day: Day) => setDetailDate(day.date),
      }
    : null;
  return (
    <>
      <PageHeading
        title="Escala de plantão"
        description={
          manager
            ? 'Organize a equipe diurna dos sábados, domingos e feriados.'
            : 'Confira a equipe, seus próximos plantões e as orientações de cada data.'
        }
      >
        <ViewLink href={base + '/agenda'}>Abrir agenda</ViewLink>
        {real && (
          <Button
            variant="ghost"
            onClick={() => {
              setExample((value) => !value);
              clearFilters();
              setDetailDate(null);
              setShowHolidayPicker(false);
            }}
          >
            {demo ? 'Ver escala real' : 'Ver exemplo'}
          </Button>
        )}
        {exportDays.length > 0 && (
          <Button
            variant="outline"
            onClick={downloadCalendar}
            title="Baixa as datas programadas do período em um arquivo .ics"
          >
            <Download className="size-3.5" />
            {manager ? 'Baixar calendário' : 'Baixar meus plantões'}
          </Button>
        )}
        {manager && real && (
          <Button variant="outline" onClick={() => setEditor('policy')}>
            <Settings2 className="size-3.5" />
            Equipes padrão
          </Button>
        )}
        {manager && real && !demo && (
          <Button
            onClick={() => {
              setHolidayDate('');
              setShowHolidayPicker((visible) => !visible);
            }}
          >
            <CalendarDays className="size-3.5" />
            Adicionar feriado
          </Button>
        )}
      </PageHeading>
      <QueryState
        loading={query.isLoading}
        error={query.error}
        onRetry={() => void query.mutate()}
      />
      {manager && real && !demo && showHolidayPicker && (
        <div className="panel mb-5 flex flex-wrap items-center gap-3 p-4">
          <CalendarDays className="size-4 text-primary" />
          <label className="flex flex-wrap items-center gap-3 text-xs">
            Selecione a data do feriado neste período
            <input
              type="date"
              aria-label="Programar feriado local"
              min={from}
              max={periodEnd}
              value={holidayDate}
              className="native-input w-auto text-xs"
              onChange={(event) => {
                const value = event.target.value;
                setHolidayDate(value);
                const selected = real.days.find((day) => day.date === value);
                if (selected) {
                  setShowHolidayPicker(false);
                  setEditor(selected);
                }
              }}
            />
          </label>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Fechar seleção de feriado"
            onClick={() => setShowHolidayPicker(false)}
          >
            <X className="size-3.5" />
          </Button>
        </div>
      )}
      {roster && viewProps && (
        <>
          <RosterSummary
            days={days}
            today={today}
            members={roster.members}
            ownId={ownId}
            personal={!manager}
            nextHoliday={roster.nextHoliday}
            onNext={goToDay}
          />
          <section className="panel overflow-hidden" aria-label="Escala do período">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b bg-secondary/20 px-4 py-4">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="inline-flex items-center rounded-lg border bg-background p-0.5">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Período anterior"
                      onClick={() => goToPeriod(addDays(from, -28))}
                    >
                      <ChevronLeft className="size-4" />
                    </Button>
                    <span className="px-2 text-xs font-semibold tabular-nums">
                      {dateLabel(from)} a{' '}
                      {dateLabel(periodEnd, { day: '2-digit', month: 'short', year: 'numeric' })}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Próximo período"
                      onClick={() => goToPeriod(addDays(from, 28))}
                    >
                      <ChevronRight className="size-4" />
                    </Button>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => goToPeriod(today)}>
                    Este período
                  </Button>
                  <input
                    type="date"
                    aria-label="Ir para o período da data"
                    className="native-input w-auto text-xs"
                    value={from}
                    onChange={(event) => {
                      if (event.target.value) goToPeriod(event.target.value);
                    }}
                  />
                </div>
                <p className="mt-2 text-[10px] text-muted-foreground">
                  Sábados, domingos e feriados · {roster.timezone}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  variant={pendingOnly ? 'outline' : 'ghost'}
                  size="sm"
                  aria-pressed={pendingOnly}
                  onClick={() => {
                    setPendingOnly((active) => !active);
                    setMineOnly(false);
                  }}
                >
                  <Filter className="size-3.5" />
                  Pendentes ({days.filter((day) => day.dayPending).length})
                </Button>
                {!demo && !manager && ownId && (
                  <label className="flex cursor-pointer items-center gap-2 rounded-lg border bg-background px-3 py-2 text-xs font-medium">
                    <input
                      type="checkbox"
                      className="size-3.5 accent-primary"
                      checked={mineOnly}
                      onChange={(event) => {
                        setMineOnly(event.target.checked);
                        setPendingOnly(false);
                      }}
                    />
                    Apenas meus plantões
                  </label>
                )}
                <div
                  role="group"
                  aria-label="Visualização da escala"
                  className="inline-flex gap-0.5 rounded-lg border bg-secondary/50 p-0.5"
                >
                  <Button
                    variant={view === 'table' ? 'outline' : 'ghost'}
                    size="sm"
                    aria-pressed={view === 'table'}
                    onClick={() => setView('table')}
                  >
                    <List className="size-3.5" />
                    Tabela
                  </Button>
                  <Button
                    variant={view === 'calendar' ? 'outline' : 'ghost'}
                    size="sm"
                    aria-pressed={view === 'calendar'}
                    onClick={() => setView('calendar')}
                  >
                    <LayoutGrid className="size-3.5" />
                    Calendário
                  </Button>
                </div>
              </div>
            </div>
            {(pendingOnly || mineOnly) && (
              <div className="flex flex-wrap items-center gap-2 border-b bg-secondary/10 px-5 py-2.5 text-[11px]">
                <Filter className="size-3 text-muted-foreground" />
                <span className="font-medium">
                  {pendingOnly ? 'Apenas datas sem equipe' : 'Apenas meus plantões diurnos'}
                </span>
                <Button variant="ghost" size="xs" onClick={clearFilters}>
                  <X className="size-3" />
                  Limpar filtro
                </Button>
              </div>
            )}
            {visibleDays.length > 0 ? (
              view === 'table' ? (
                <RosterTable {...viewProps} />
              ) : (
                <RosterBoard {...viewProps} />
              )
            ) : (
              <div className="px-5 py-14 text-center">
                <Users className="mx-auto mb-3 size-7 text-muted-foreground" />
                <p className="text-sm font-medium">
                  {mineOnly
                    ? 'Você não tem plantões diurnos neste período.'
                    : pendingOnly
                      ? 'Todas as datas do período têm equipe definida.'
                      : 'Nenhuma data especial neste período.'}
                </p>
                {(pendingOnly || mineOnly) && (
                  <Button variant="outline" size="sm" className="mt-4" onClick={clearFilters}>
                    Ver toda a escala
                  </Button>
                )}
              </div>
            )}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t bg-secondary/10 px-5 py-3 text-[10px] text-muted-foreground">
              <span aria-live="polite">
                {visibleDays.length} de {days.length} datas especiais
              </span>
              <div className="flex flex-wrap gap-4">
                <span className="inline-flex items-center gap-1.5">
                  <span className="size-1.5 rounded-full bg-primary" />
                  Hoje
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="size-1.5 rounded-full bg-emerald-500" />
                  Programada
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="size-1.5 rounded-full bg-amber-500" />A definir
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="size-1.5 rounded-full bg-violet-500" />
                  Feriado
                </span>
              </div>
            </div>
          </section>
          {!demo && (
            <RosterHistory
              history={roster.history}
              members={roster.members}
              timezone={roster.timezone}
            />
          )}
        </>
      )}
      {detail && roster && (
        <RosterDayDetails
          day={detail}
          members={roster.members}
          ownId={ownId}
          onClose={() => setDetailDate(null)}
        />
      )}
      {manager && real && editor === 'policy' && (
        <PolicyEditor
          roster={real}
          onClose={() => setEditor(null)}
          onSaved={async () => {
            setExample(false);
            await query.mutate();
          }}
        />
      )}
      {manager && real && editor && editor !== 'policy' && !demo && (
        <DayEditor
          key={editor.date}
          day={editor}
          roster={real}
          onClose={() => setEditor(null)}
          onSaved={() => query.mutate()}
        />
      )}
    </>
  );
}

export function RosterCoverage({ date }: { date: string }) {
  const base = useRouteBase();
  const { scope } = useErp();
  const query = useErpQuery<Roster>(`/on-call/roster?from=${date}&to=${date}`);
  const day = query.data?.days[0];
  return (
    <section aria-label="Equipe na data selecionada" className="border-t px-5 py-4">
      <div className="mb-3 flex items-center gap-2 text-xs font-semibold">
        <Users className="size-4 text-primary" />
        Equipe em {dateLabel(date, { day: '2-digit', month: '2-digit' })}
      </div>
      <QueryState
        loading={query.isLoading}
        error={query.error}
        onRetry={() => void query.mutate()}
      />
      {day && query.data && (
        <div className="space-y-4">
          <div>
            <p className="mb-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Sun className="size-3" />
              Dia{day.holidayName ? ` · ${day.holidayName}` : ''}
            </p>
            <MemberChips
              ids={day.dayUserIds}
              members={query.data.members}
              ownId={scope?.userId}
              compact
            />
          </div>
          <div>
            <p className="mb-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Moon className="size-3" />
              Noite
            </p>
            <MemberChips
              ids={day.nightUserIds}
              members={query.data.members}
              ownId={scope?.userId}
              compact
            />
          </div>
        </div>
      )}
      <div className="mt-4">
        <ViewLink href={`${base}/plantao`}>Consultar escala de plantão</ViewLink>
      </div>
    </section>
  );
}
