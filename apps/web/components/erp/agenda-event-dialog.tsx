'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { useErp, useErpAction, useErpQuery } from '@/lib/erp/gateway';
import { errorMessage, type ErpRecord } from '@/lib/erp/contracts';
import { agendaDay, agendaInput, agendaInterval, managedOrderEvent } from '@/lib/erp/agenda';

export function AgendaEventDialog({
  event,
  date,
  onClose,
  onSaved,
  base = '/analista',
}: {
  event?: ErpRecord;
  date: string;
  onClose: () => void;
  onSaved: (event?: ErpRecord) => Promise<void>;
  base?: string;
}) {
  const { scope } = useErp();
  const action = useErpAction();
  const users = useErpQuery<{ id: string; name: string; role: string }[]>('/calendar/users');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [conflicts, setConflicts] = useState<ErpRecord[]>([]);
  const manager = !!scope && ['super_admin', 'gerente'].includes(scope.role);
  const [isGlobal, setIsGlobal] = useState(Boolean(event?.isGlobal));
  const inFlight = useRef(false);
  const [allDay, setAllDay] = useState(Boolean(event?.allDay));
  const [assigneeId, setAssigneeId] = useState(String(event?.assigneeId || scope?.userId || ''));
  const generated = event && managedOrderEvent(event);
  const editable =
    !event || (!generated && (manager || (!event.isGlobal && event.createdById === scope?.userId)));
  const end = event?.endAt ? String(event.endAt) : null;
  const endDay = end && event?.allDay ? agendaDay(new Date(new Date(end).getTime() - 1)) : null;
  const [startAt, setStartAt] = useState(
    event ? agendaInput(String(event.startAt)) : `${date}T09:00`,
  );
  const [endAt, setEndAt] = useState(
    event?.allDay && endDay ? `${endDay}T10:00` : end ? agendaInput(end) : '',
  );
  const busy = saving || action.pending;
  async function saved(record?: ErpRecord) {
    try {
      await onSaved(record);
    } catch {
      toast.info(
        'A alteração foi salva, mas a agenda não pôde ser atualizada. Recarregue a página para consultar os dados atuais.',
      );
    }
    onClose();
  }
  const people = (users.data || []).filter((person) =>
    ['analista', 'gerente', 'super_admin'].includes(person.role),
  );
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{event ? 'Compromisso da agenda' : 'Novo compromisso'}</DialogTitle>
          <DialogDescription>
            {generated
              ? 'Este agendamento acompanha uma O.S. Abra a ordem para executar ou reagendar o trabalho.'
              : 'Horários de Fortaleza. Agendamentos de O.S. são feitos dentro da própria ordem.'}
          </DialogDescription>
        </DialogHeader>
        {event?.serviceOrderId ? (
          <Link className="text-link" href={`${base}/ordens/${event.serviceOrderId}`}>
            Abrir ordem de serviço →
          </Link>
        ) : null}
        {!editable && event ? (
          <div className="space-y-4 text-sm">
            <h3 className="font-semibold">{String(event.title)}</h3>
            <p>
              {Boolean(event.allDay)
                ? `${agendaDay(String(event.startAt)).split('-').reverse().join('/')} · Dia inteiro`
                : new Date(String(event.startAt)).toLocaleString('pt-BR', {
                    timeZone: 'America/Fortaleza',
                  })}
            </p>
            <p className="whitespace-pre-wrap">{String(event.description || '')}</p>
            {Boolean(event.endAt) && (
              <p>
                Término:{' '}
                {event.allDay
                  ? agendaDay(new Date(new Date(String(event.endAt)).getTime() - 1))
                      .split('-')
                      .reverse()
                      .join('/')
                  : new Date(String(event.endAt)).toLocaleString('pt-BR', {
                      timeZone: 'America/Fortaleza',
                    })}
              </p>
            )}
            <p className="text-muted-foreground">
              Responsável:{' '}
              {String(
                (event.assignee as { name?: string } | undefined)?.name ||
                  (event.createdBy as { name?: string } | undefined)?.name ||
                  'Equipe Ajust',
              )}
            </p>
            {Boolean(event.location) && <p>Local: {String(event.location)}</p>}
            {typeof event.meetingLink === 'string' && /^https?:\/\//.test(event.meetingLink) && (
              <a
                className="text-link"
                href={event.meetingLink}
                target="_blank"
                rel="noopener noreferrer"
              >
                Entrar na reunião →
              </a>
            )}
          </div>
        ) : (
          <form
            className="space-y-4"
            onSubmit={async (submit) => {
              submit.preventDefault();
              if (inFlight.current) return;
              inFlight.current = true;
              setSaving(true);
              setError('');
              setConflicts([]);
              const form = new FormData(submit.currentTarget);
              try {
                const interval = agendaInterval(
                  allDay ? startAt.slice(0, 10) : startAt,
                  allDay ? endAt.slice(0, 10) : endAt,
                  allDay,
                );
                if (!isGlobal) {
                  const conflict = await action.execute<{
                    hasConflict: boolean;
                    conflictingEvents: ErpRecord[];
                  }>({
                    path: '/calendar/events/check-conflict',
                    method: 'POST',
                    body: {
                      userId: assigneeId || scope?.userId,
                      ...interval,
                      endAt: interval.endAt || interval.startAt,
                      ...(event ? { excludeEventId: event.id } : {}),
                    },
                  });
                  if (conflict.hasConflict) {
                    setConflicts(conflict.conflictingEvents);
                    setError(
                      'Este horário coincide com outro compromisso. Ajuste o período antes de salvar.',
                    );
                    return;
                  }
                }
                const result = await action.execute<ErpRecord>({
                  path: `/calendar/events${event ? `/${event.id}` : ''}`,
                  method: event ? 'PATCH' : 'POST',
                  body: {
                    title: String(form.get('title')).trim(),
                    type: form.get('type'),
                    description: String(form.get('description') || ''),
                    location: String(form.get('location') || ''),
                    meetingLink: String(form.get('meetingLink') || '') || null,
                    ...(isGlobal ? {} : { assigneeId: assigneeId || scope?.userId }),
                    ...(manager
                      ? {
                          isGlobal,
                          recurrenceRule: String(form.get('recurrenceRule') || ''),
                          color: String(form.get('color') || event?.color || '#3b82f6'),
                          ...(form.get('recurrenceEnd')
                            ? {
                                recurrenceEnd: new Date(
                                  `${form.get('recurrenceEnd')}:00-03:00`,
                                ).toISOString(),
                              }
                            : {}),
                        }
                      : {}),
                    allDay,
                    ...interval,
                  },
                });
                toast.success('Compromisso salvo.');
                await saved(result);
              } catch (reason) {
                const message = errorMessage(reason);
                setError(
                  /conflict/i.test(message)
                    ? 'Já existe um compromisso neste horário. Escolha outro horário ou consulte sua agenda.'
                    : message,
                );
              } finally {
                inFlight.current = false;
                setSaving(false);
              }
            }}
          >
            <label className="block text-xs">
              Título *
              <Input
                className="mt-2 w-full"
                name="title"
                required
                maxLength={200}
                defaultValue={String(event?.title || '')}
              />
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-xs">
                Tipo
                <select
                  className="native-select mt-2 w-full"
                  name="type"
                  defaultValue={String(event?.type || 'LEMBRETE')}
                >
                  <option value="LEMBRETE">Lembrete</option>
                  <option value="REUNIAO">Reunião</option>
                  <option value="REUNIAO_ONLINE">Reunião online</option>
                  <option value="OUTRO">Outro compromisso</option>
                  {manager && (
                    <>
                      <option value="PLANTAO">Plantão</option>
                      <option value="FERIADO">Feriado</option>
                    </>
                  )}
                  {!manager && event && ['PLANTAO', 'FERIADO'].includes(String(event.type)) && (
                    <option value={String(event.type)}>
                      {event.type === 'PLANTAO' ? 'Plantão' : 'Feriado'}
                    </option>
                  )}
                </select>
              </label>
              <label className="block text-xs">
                Responsável
                <select
                  className="native-select mt-2 w-full"
                  name="assigneeId"
                  disabled={isGlobal || users.isLoading || !!users.error}
                  aria-label="Responsável"
                  value={assigneeId}
                  onChange={(change) => setAssigneeId(change.target.value)}
                >
                  <option value={scope?.userId}>
                    {people.find((person) => person.id === scope?.userId)?.name || 'Minha agenda'}{' '}
                    (eu)
                  </option>
                  {people
                    .filter((person) => person.id !== scope?.userId)
                    .map((person) => (
                      <option key={person.id} value={person.id}>
                        {person.name}
                        {person.id === scope?.userId ? ' (eu)' : ''}
                      </option>
                    ))}
                  {assigneeId !== scope?.userId &&
                    !people.some((person) => person.id === assigneeId) && (
                      <option value={assigneeId}>
                        {String(
                          (event?.assignee as { name?: string } | undefined)?.name ||
                            'Responsável cadastrado',
                        )}
                      </option>
                    )}
                </select>
              </label>
            </div>
            {manager && (
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={isGlobal}
                  onChange={(event) => setIsGlobal(event.target.checked)}
                />
                Visível para toda a equipe
              </label>
            )}
            {users.error && (
              <p role="alert" className="text-xs text-danger">
                Não foi possível consultar os responsáveis.{' '}
                <button type="button" className="text-link" onClick={() => void users.mutate()}>
                  Tentar novamente
                </button>
              </p>
            )}
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={allDay}
                onChange={(change) => setAllDay(change.target.checked)}
              />
              Dia inteiro
            </label>
            <div className="grid gap-4 sm:grid-cols-2" key={String(allDay)}>
              <label className="block text-xs">
                Início *
                <Input
                  className="mt-2 w-full"
                  name="startAt"
                  type={allDay ? 'date' : 'datetime-local'}
                  required
                  value={allDay ? startAt.slice(0, 10) : startAt}
                  onChange={(change) =>
                    setStartAt(
                      allDay
                        ? `${change.target.value}T${startAt.slice(11) || '09:00'}`
                        : change.target.value,
                    )
                  }
                />
              </label>
              <label className="block text-xs">
                Término (opcional)
                <Input
                  className="mt-2 w-full"
                  name="endAt"
                  type={allDay ? 'date' : 'datetime-local'}
                  value={allDay ? endAt.slice(0, 10) : endAt}
                  onChange={(change) =>
                    setEndAt(
                      allDay && change.target.value
                        ? `${change.target.value}T${endAt.slice(11) || '10:00'}`
                        : change.target.value,
                    )
                  }
                />
              </label>
            </div>
            <label className="block text-xs">
              Descrição
              <Textarea
                className="mt-2 min-h-24 w-full"
                name="description"
                maxLength={10000}
                defaultValue={String(event?.description || '')}
              />
            </label>
            <details className="rounded-lg border p-3 text-xs">
              <summary className="cursor-pointer">Local e link da reunião</summary>
              <div className="mt-3 space-y-3">
                <label className="block">
                  Local
                  <Input
                    className="mt-2 w-full"
                    name="location"
                    maxLength={500}
                    defaultValue={String(event?.location || '')}
                  />
                </label>
                <label className="block">
                  Link da reunião
                  <Input
                    className="mt-2 w-full"
                    name="meetingLink"
                    type="url"
                    pattern="https?://.*"
                    maxLength={2048}
                    defaultValue={String(event?.meetingLink || '')}
                  />
                </label>
              </div>
            </details>
            {manager && (
              <details className="rounded-lg border p-3 text-xs">
                <summary className="cursor-pointer">Repetição</summary>
                <label className="mt-3 block">
                  Regra de repetição
                  <Input
                    className="mt-2"
                    name="recurrenceRule"
                    maxLength={1000}
                    defaultValue={String(event?.recurrenceRule || '')}
                    placeholder="Ex.: FREQ=WEEKLY;BYDAY=MO"
                  />
                </label>
                <label className="mt-3 block">
                  Fim da repetição (opcional)
                  <Input
                    className="mt-2"
                    name="recurrenceEnd"
                    type="datetime-local"
                    defaultValue={
                      event?.recurrenceEnd ? agendaInput(String(event.recurrenceEnd)) : ''
                    }
                  />
                </label>
                <label className="mt-3 block">
                  Cor
                  <Input
                    className="mt-2"
                    name="color"
                    type="color"
                    defaultValue={String(event?.color || '#3b82f6')}
                  />
                </label>
              </details>
            )}
            {conflicts.length > 0 && (
              <ul
                className="space-y-2 rounded-lg border border-warning/30 p-3 text-xs"
                aria-label="Compromissos em conflito"
              >
                {conflicts.map((item) => (
                  <li key={item.id}>
                    {String(item.title)} ·{' '}
                    {new Date(String(item.startAt)).toLocaleString('pt-BR', {
                      timeZone: 'America/Fortaleza',
                    })}
                  </li>
                ))}
              </ul>
            )}
            {error && (
              <p role="alert" className="text-xs text-danger">
                {error}
              </p>
            )}
            <div className="flex flex-wrap justify-end gap-2 border-t pt-4">
              <Button type="button" variant="ghost" disabled={busy} onClick={onClose}>
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={busy || (!isGlobal && (!!users.error || users.isLoading))}
              >
                {busy ? 'Salvando…' : 'Salvar compromisso'}
              </Button>
            </div>
          </form>
        )}
        {editable && event && (
          <Button
            variant="destructive"
            disabled={busy}
            onClick={async () => {
              if (inFlight.current || !window.confirm('Excluir este compromisso da agenda?'))
                return;
              inFlight.current = true;
              setSaving(true);
              setError('');
              try {
                await action.execute({ path: `/calendar/events/${event.id}`, method: 'DELETE' });
                toast.success('Compromisso excluído.');
                await saved();
              } catch (reason) {
                setError(errorMessage(reason));
              } finally {
                inFlight.current = false;
                setSaving(false);
              }
            }}
          >
            Excluir compromisso
          </Button>
        )}
        {!editable && (
          <Button variant="outline" onClick={onClose}>
            Fechar
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
}
