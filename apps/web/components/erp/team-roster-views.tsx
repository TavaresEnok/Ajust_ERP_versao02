'use client';

import {
  AlertCircle,
  CalendarDays,
  Check,
  ChevronRight,
  Clock3,
  Info,
  Pencil,
  Users,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import {
  rosterDateLabel as dateLabel,
  rosterWeekStart,
  type RosterDay,
  type RosterMember,
} from '@/lib/erp/team-roster';
import { Avatar } from './primitives';

export function MemberChips({
  ids,
  members,
  ownId,
  compact = false,
  onRemove,
}: {
  ids: string[];
  members: RosterMember[];
  ownId?: string;
  compact?: boolean;
  onRemove?: (id: string) => void;
}) {
  const byId = new Map(members.map((member) => [member.id, member]));
  if (!ids.length)
    return <span className="text-xs text-muted-foreground">Equipe ainda não definida</span>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {ids.map((id) => {
        const member = byId.get(id);
        const name = member?.name || 'Integrante indisponível';
        return (
          <span
            key={id}
            className={cn(
              'inline-flex max-w-full items-center gap-1.5 rounded-full border border-border bg-background/70 px-2 py-1 text-xs font-medium',
              ownId === id && 'border-primary/30 bg-primary/10 text-primary',
            )}
          >
            {!compact && <Avatar name={name} className="size-5 shrink-0 text-[9px]" />}
            <span className="min-w-0 break-words">{name}</span>
            {ownId === id && (
              <span className="shrink-0 rounded bg-primary/10 px-1 text-[9px] font-semibold">
                você
              </span>
            )}
            {member && !member.active && <span className="text-muted-foreground">(inativo)</span>}
            {onRemove && (
              <button
                type="button"
                aria-label={`Retirar ${name}`}
                onClick={() => onRemove(id)}
                className="ml-0.5 rounded-full p-0.5 text-muted-foreground hover:bg-secondary focus-visible:outline-2 focus-visible:outline-primary"
              >
                <X className="size-3" />
              </button>
            )}
          </span>
        );
      })}
    </div>
  );
}

function RosterStatus({ pending }: { pending: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2 py-1 text-[10px] font-semibold',
        pending
          ? 'border-warning/20 bg-warning/10 text-warning'
          : 'border-success/20 bg-success/10 text-success',
      )}
    >
      {pending ? <AlertCircle className="size-3" /> : <Check className="size-3" />}
      {pending ? 'A definir' : 'Programada'}
    </span>
  );
}

export function RosterSummary({
  days,
  today,
  members,
  ownId,
  personal,
  nextHoliday,
  onNext,
}: {
  days: RosterDay[];
  today: string;
  members: RosterMember[];
  ownId?: string;
  personal: boolean;
  nextHoliday: { date: string; name: string } | null;
  onNext: (date: string) => void;
}) {
  const upcoming = days.filter((day) => day.date >= today);
  const nextMine =
    personal && ownId ? upcoming.find((day) => day.dayUserIds.includes(ownId)) : undefined;
  const next = nextMine || upcoming[0];
  return (
    <div className="mb-5 grid gap-3 lg:grid-cols-2">
      <button
        type="button"
        onClick={() => next && onNext(next.date)}
        disabled={!next}
        className="panel group flex min-w-0 flex-col p-4 text-left transition-colors hover:border-primary/40 focus-visible:outline-2 focus-visible:outline-primary disabled:cursor-default"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {nextMine
                ? 'Meu próximo plantão'
                : next?.date === today
                  ? 'Plantão de hoje'
                  : 'Próxima data especial'}
            </p>
            <p className="mt-2 text-sm font-semibold capitalize">
              {next
                ? dateLabel(next.date, { weekday: 'long', day: '2-digit', month: 'long' })
                : 'Sem próximas datas neste período'}
            </p>
          </div>
          <span className="rounded-xl bg-primary/10 p-2.5 text-primary">
            <Clock3 className="size-4" />
          </span>
        </div>
        <div className="mt-3 flex-1">
          {next && <MemberChips ids={next.dayUserIds} members={members} ownId={ownId} compact />}
        </div>
        <div className="mt-4 flex items-center justify-between border-t pt-3 text-[11px] text-muted-foreground">
          <span>{next?.holidayName || 'Equipe diurna'}</span>
          {next && (
            <span className="inline-flex items-center gap-1 font-medium text-primary">
              Ver plantão <ChevronRight className="size-3" />
            </span>
          )}
        </div>
      </button>
      <section className="panel flex min-w-0 flex-col p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Próximo feriado
            </p>
            <p className="mt-2 text-sm font-semibold capitalize">
              {nextHoliday
                ? dateLabel(nextHoliday.date, {
                    weekday: 'long',
                    day: '2-digit',
                    month: 'long',
                    year: 'numeric',
                  })
                : 'Nenhum feriado cadastrado'}
            </p>
          </div>
          <span className="rounded-xl bg-info/10 p-2.5 text-info">
            <CalendarDays className="size-4" />
          </span>
        </div>
        <p className="mt-3 flex-1 text-xs text-muted-foreground">
          {nextHoliday
            ? nextHoliday.name
            : 'Os feriados aparecem aqui quando forem cadastrados no calendário da empresa.'}
        </p>
        <div className="mt-4 flex items-center justify-between border-t pt-3 text-[11px] text-muted-foreground">
          <span>{nextHoliday ? 'Calendário interno da empresa' : 'Sem datas cadastradas'}</span>
        </div>
      </section>
    </div>
  );
}

type RosterViewProps = {
  days: RosterDay[];
  members: RosterMember[];
  today: string;
  ownId?: string;
  canEdit: boolean;
  onEdit: (day: RosterDay) => void;
  onDetails: (day: RosterDay) => void;
};

export function RosterTable({
  days,
  members,
  today,
  ownId,
  canEdit,
  onEdit,
  onDetails,
}: RosterViewProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[660px] text-left text-xs">
        <thead className="border-b bg-secondary/40 text-[10px] uppercase tracking-wider text-muted-foreground">
          <tr>
            <th className="w-44 px-5 py-3 font-semibold">Data especial</th>
            <th className="px-4 py-3 font-semibold">Equipe diurna</th>
            <th className="w-32 px-4 py-3 font-semibold">Situação</th>
            <th className="w-44 px-5 py-3 text-right font-semibold">Ações</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {days.map((day) => (
            <tr
              key={day.date}
              id={`plantao-${day.date}`}
              className={cn(
                'scroll-mt-24 transition-colors hover:bg-secondary/25',
                day.date === today && 'bg-primary/5',
                day.dayPending && day.date !== today && 'bg-warning/[0.025]',
              )}
            >
              <td
                className={cn(
                  'border-l-[3px] px-4 py-4 align-middle',
                  day.date === today ? 'border-l-primary' : 'border-l-transparent',
                )}
              >
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-sm font-semibold tabular-nums">
                    {dateLabel(day.date, { day: '2-digit', month: '2-digit' })}
                  </span>
                  {day.date === today && (
                    <span className="rounded bg-primary px-1.5 py-0.5 text-[9px] font-semibold text-primary-foreground">
                      Hoje
                    </span>
                  )}
                  {day.holidayName && (
                    <span className="rounded border border-info/20 bg-info/10 px-1.5 py-0.5 text-[9px] font-medium text-info">
                      Feriado
                    </span>
                  )}
                </div>
                <p className="mt-1 text-[11px] capitalize text-muted-foreground">
                  {dateLabel(day.date, { weekday: 'long' })}
                </p>
                {day.holidayName && (
                  <p className="mt-1 max-w-40 text-[10px] text-info">{day.holidayName}</p>
                )}
              </td>
              <td className="max-w-lg px-4 py-4 align-middle">
                {day.dayPending ? (
                  <span className="inline-flex items-center gap-1.5 rounded-md border border-dashed border-warning/25 bg-warning/5 px-2.5 py-1.5 text-[11px] text-warning">
                    <AlertCircle className="size-3.5" />
                    Aguardando programação
                  </span>
                ) : (
                  <MemberChips ids={day.dayUserIds} members={members} ownId={ownId} />
                )}
                {day.notes && (
                  <p className="mt-2 line-clamp-1 text-[11px] text-muted-foreground">{day.notes}</p>
                )}
              </td>
              <td className="px-4 py-4 align-middle">
                <RosterStatus pending={day.dayPending} />
              </td>
              <td className="px-5 py-4 align-middle">
                <div className="flex items-center justify-end gap-1.5">
                  {canEdit && (
                    <Button
                      size="sm"
                      variant="outline"
                      aria-label={`Programar equipe diurna de ${day.date}`}
                      onClick={() => onEdit(day)}
                    >
                      <Pencil className="size-3.5" />
                      {day.dayPending ? 'Programar equipe' : 'Editar'}
                    </Button>
                  )}
                  <Button
                    size={canEdit ? 'icon' : 'sm'}
                    variant="ghost"
                    aria-label={`Ver orientações de ${day.date}`}
                    onClick={() => onDetails(day)}
                  >
                    <Info className="size-3.5" />
                    {!canEdit && 'Detalhes'}
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Groups only weekends and holidays; ordinary weekdays do not get empty cells. */
export function RosterBoard({
  days,
  members,
  today,
  ownId,
  canEdit,
  onEdit,
  onDetails,
}: RosterViewProps) {
  const groups = new Map<string, RosterDay[]>();
  for (const day of days) {
    const key = rosterWeekStart(day.date);
    const entries = groups.get(key) || [];
    entries.push(day);
    groups.set(key, entries);
  }
  return (
    <div className="grid gap-4 bg-secondary/15 p-4 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from(groups, ([week, entries]) => (
        <section key={week} aria-label={`Semana de ${dateLabel(week)}`} className="min-w-0">
          <div className="mb-3 flex items-center justify-between gap-2 px-1">
            <h3 className="text-[11px] font-semibold text-muted-foreground">
              Semana de {dateLabel(week)}
            </h3>
            <span className="text-[10px] text-muted-foreground">
              {entries.length} {entries.length === 1 ? 'data' : 'datas'}
            </span>
          </div>
          <div className="space-y-3">
            {entries.map((day) => (
              <button
                type="button"
                id={`plantao-${day.date}`}
                key={day.date}
                aria-label={
                  canEdit
                    ? `Programar equipe diurna de ${day.date}`
                    : `Ver orientações de ${day.date}`
                }
                onClick={() => (canEdit ? onEdit(day) : onDetails(day))}
                className={cn(
                  'group block w-full scroll-mt-24 rounded-xl border bg-card p-3.5 text-left transition-colors hover:border-primary/50 focus-visible:outline-2 focus-visible:outline-primary',
                  day.date === today
                    ? 'border-primary/50 ring-1 ring-primary/10'
                    : day.dayPending
                      ? 'border-warning/20'
                      : 'border-success/20',
                )}
              >
                <div className="flex items-start justify-between gap-1">
                  <div>
                    <p className="text-xs font-semibold capitalize">
                      {dateLabel(day.date, { weekday: 'long' })}
                    </p>
                    <p className="mt-1 text-lg font-semibold tabular-nums">
                      {dateLabel(day.date, { day: '2-digit', month: '2-digit' })}
                    </p>
                  </div>
                  {day.date === today ? (
                    <span className="rounded bg-primary px-1.5 py-0.5 text-[9px] font-semibold text-primary-foreground">
                      Hoje
                    </span>
                  ) : (
                    <RosterStatus pending={day.dayPending} />
                  )}
                </div>
                {day.holidayName && (
                  <p className="mt-2 text-[10px] font-medium text-info">{day.holidayName}</p>
                )}
                <div className="my-3 min-h-10">
                  {day.dayPending ? (
                    <p className="text-[11px] text-warning">Equipe a definir</p>
                  ) : (
                    <MemberChips ids={day.dayUserIds} members={members} ownId={ownId} compact />
                  )}
                </div>
                {day.notes && (
                  <p className="mb-3 line-clamp-2 text-[11px] text-muted-foreground">{day.notes}</p>
                )}
                <div className="flex items-center justify-between border-t pt-2.5 text-[10px]">
                  <span className="text-muted-foreground">
                    {day.dayUserIds.length
                      ? `${day.dayUserIds.length} na equipe`
                      : 'Sem programação'}
                  </span>
                  <span className="inline-flex items-center gap-1 font-medium text-primary">
                    {canEdit ? (day.dayPending ? 'Programar' : 'Editar') : 'Ver detalhes'}
                    <ChevronRight className="size-3" />
                  </span>
                </div>
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

export function RosterDayDetails({
  day,
  members,
  ownId,
  onClose,
}: {
  day: RosterDay;
  members: RosterMember[];
  ownId?: string;
  onClose: () => void;
}) {
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            Plantão · {dateLabel(day.date, { day: '2-digit', month: 'long' })}
          </DialogTitle>
          <DialogDescription className="capitalize">
            {dateLabel(day.date, { weekday: 'long', year: 'numeric' })}
            {day.holidayName ? ` · ${day.holidayName}` : ''}
          </DialogDescription>
        </DialogHeader>
        <section className="rounded-xl border bg-secondary/20 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-xs font-semibold">Equipe diurna</h3>
            <RosterStatus pending={day.dayPending} />
          </div>
          <MemberChips ids={day.dayUserIds} members={members} ownId={ownId} />
        </section>
        <section>
          <h3 className="mb-2 text-xs font-semibold">Orientações para a equipe</h3>
          <p className="whitespace-pre-wrap break-words rounded-xl border p-4 text-sm leading-relaxed text-muted-foreground">
            {day.notes || 'Nenhuma orientação registrada para esta data.'}
          </p>
        </section>
        <div className="flex justify-end border-t pt-4">
          <Button variant="outline" onClick={onClose}>
            Fechar detalhes
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
