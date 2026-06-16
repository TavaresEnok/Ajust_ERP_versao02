'use client';
/* eslint-disable react-hooks/exhaustive-deps */

import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Plus,
  Clock,
  MapPin,
  Link as LinkIcon,
  Users,
  Trash2,
  Edit2,
  ChevronLeft,
  ChevronRight,
  Globe,
  User as UserIcon,
  CalendarDays,
  Check,
  X,
  RotateCcw,
} from 'lucide-react';
import { cn } from '../../shared/shared-ui';

/* ----------------------------- Components ----------------------------- */
type EventType = 'REUNIAO' | 'REUNIAO_ONLINE' | 'LEMBRETE' | 'FERIADO' | 'OUTRO';
type RecurrencePreset = 'none' | 'daily' | 'weekly' | 'monthly' | 'custom';
type ViewMode = 'MES' | 'LISTA';

type CalendarEvent = {
  id: string;
  title: string;
  description?: string | null;
  type: EventType;
  isGlobal?: boolean;
  startAt: string;
  endAt?: string | null;
  allDay?: boolean;
  meetingLink?: string | null;
  location?: string | null;
  assigneeId?: string | null;
  color?: string | null;
  recurrenceRule?: string | null;
  recurrenceEnd?: string | null;
  occurrenceId?: string | null;
};

type CalendarUser = {
  id: string;
  name: string;
  role?: string | null;
};

type CalendarForm = {
  title: string;
  description: string;
  type: EventType;
  isGlobal: boolean;
  startAt: string;
  endAt: string;
  allDay: boolean;
  meetingLink: string;
  location: string;
  assigneeId: string;
  color: string;
  recurrencePreset: RecurrencePreset;
  recurrenceRule: string;
  recurrenceEnd: string;
};

const EVENT_TYPES = [
  { value: 'REUNIAO', label: 'Reunião', color: 'blue' },
  { value: 'REUNIAO_ONLINE', label: 'Reunião Online', color: 'purple' },
  { value: 'LEMBRETE', label: 'Lembrete', color: 'amber' },
  { value: 'FERIADO', label: 'Feriado', color: 'red' },
  { value: 'OUTRO', label: 'Outro', color: 'slate' },
];

const RECURRENCE_PRESETS: Array<{ value: RecurrencePreset; label: string }> = [
  { value: 'none', label: 'Nao repetir' },
  { value: 'daily', label: 'Diariamente' },
  { value: 'weekly', label: 'Semanalmente' },
  { value: 'monthly', label: 'Mensalmente' },
  { value: 'custom', label: 'RRULE manual' },
];

const recurrencePresetFromRule = (rule?: string | null): RecurrencePreset => {
  if (!rule) return 'none';
  if (rule === 'FREQ=DAILY') return 'daily';
  if (rule === 'FREQ=WEEKLY') return 'weekly';
  if (rule === 'FREQ=MONTHLY') return 'monthly';
  return 'custom';
};

const ruleFromPreset = (form: CalendarForm) => {
  if (form.recurrencePreset === 'daily') return 'FREQ=DAILY';
  if (form.recurrencePreset === 'weekly') return 'FREQ=WEEKLY';
  if (form.recurrencePreset === 'monthly') return 'FREQ=MONTHLY';
  if (form.recurrencePreset === 'custom') return form.recurrenceRule.trim();
  return '';
};

const normalizeDateOnly = (value?: string | null) =>
  value ? new Date(value).toISOString().slice(0, 10) : '';
const toDayKey = (value: Date | string) => new Date(value).toISOString().split('T')[0];
const formatEventDate = (value?: string | null) =>
  value ? new Date(value).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }) : '-';
const formatEventTime = (value?: string | null) =>
  value
    ? new Date(value).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    : '--:--';

export const CalendarManageViewModule = ({ dark }: { dark: boolean }) => {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [users, setUsers] = useState<CalendarUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [viewDate, setViewDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('MES');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [selectedDay, setSelectedDay] = useState<string>(toDayKey(new Date()));
  const [formData, setFormData] = useState<CalendarForm>({
    title: '',
    description: '',
    type: 'REUNIAO',
    isGlobal: false,
    startAt: '',
    endAt: '',
    allDay: false,
    meetingLink: '',
    location: '',
    assigneeId: '',
    color: '#3b82f6',
    recurrencePreset: 'none',
    recurrenceRule: '',
    recurrenceEnd: '',
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const startOfMonth = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1);
      const endOfMonth = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0, 23, 59, 59);

      const [evRes, usrRes] = await Promise.all([
        fetch(
          `/api/calendar/events/all?from=${encodeURIComponent(startOfMonth.toISOString())}&to=${encodeURIComponent(endOfMonth.toISOString())}`,
        ),
        fetch('/api/calendar/users'),
      ]);
      const evData = await evRes.json();
      const usrData = await usrRes.json();
      setEvents(evData);
      setUsers(usrData);
    } catch (error) {
      console.error('Failed to load calendar data', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [viewDate]);

  const resetForm = (event: CalendarEvent | null = null, initialDate: Date | null = null) => {
    if (event) {
      setFormData({
        title: event.title || '',
        description: event.description || '',
        type: event.type || 'REUNIAO',
        isGlobal: event.isGlobal || false,
        startAt: event.startAt ? new Date(event.startAt).toISOString().slice(0, 16) : '',
        endAt: event.endAt ? new Date(event.endAt).toISOString().slice(0, 16) : '',
        allDay: event.allDay || false,
        meetingLink: event.meetingLink || '',
        location: event.location || '',
        assigneeId: event.assigneeId || '',
        color: event.color || '#3b82f6',
        recurrencePreset: recurrencePresetFromRule(event.recurrenceRule),
        recurrenceRule:
          recurrencePresetFromRule(event.recurrenceRule) === 'custom'
            ? event.recurrenceRule || ''
            : '',
        recurrenceEnd: normalizeDateOnly(event.recurrenceEnd),
      });
      setEditingEvent(event);
    } else {
      const dateToUse = initialDate || new Date();
      // Ensure we set the time to 09:00 for new events if just a date is clicked
      if (initialDate) {
        dateToUse.setHours(9, 0, 0, 0);
      }

      setFormData({
        title: '',
        description: '',
        type: 'REUNIAO',
        isGlobal: false,
        startAt: dateToUse.toISOString().slice(0, 16),
        endAt: '',
        allDay: false,
        meetingLink: '',
        location: '',
        assigneeId: '',
        color: '#3b82f6',
        recurrencePreset: 'none',
        recurrenceRule: '',
        recurrenceEnd: '',
      });
      setEditingEvent(null);
    }
    if (initialDate) {
      setSelectedDay(toDayKey(initialDate));
    }
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const method = editingEvent ? 'PATCH' : 'POST';
    let url = editingEvent ? `/api/calendar/events/${editingEvent.id}` : '/api/calendar/events';
    const recurrenceRule = ruleFromPreset(formData);

    try {
      if (editingEvent?.recurrenceRule) {
        const applySingle = window.confirm(
          'Aplicar alteração somente nesta ocorrência?\n\nOK = apenas esta ocorrência\nCancelar = série inteira',
        );
        if (applySingle) {
          const params = new URLSearchParams({
            scope: 'single',
            occurrenceId: editingEvent.occurrenceId || '',
            occurrenceDate: editingEvent.startAt,
          });
          url = `${url}?${params.toString()}`;
        }
      }
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          // If global, ensure assignee is null
          assigneeId: formData.isGlobal ? null : formData.assigneeId,
          recurrenceRule: recurrenceRule || null,
          recurrenceEnd:
            formData.recurrencePreset === 'none' || !formData.recurrenceEnd
              ? null
              : new Date(`${formData.recurrenceEnd}T23:59:59`).toISOString(),
        }),
      });

      if (res.ok) {
        setIsModalOpen(false);
        loadData();
      }
    } catch (error) {
      console.error('Failed to save event', error);
    }
  };

  const handleDelete = async (id: string) => {
    const event = events.find((item) => item.id === id);
    if (!event) return;
    if (!confirm('Deseja excluir este evento?')) return;
    try {
      let url = `/api/calendar/events/${id}`;
      if (event.recurrenceRule) {
        const deleteSingle = window.confirm(
          'Excluir somente esta ocorrência?\n\nOK = apenas esta ocorrência\nCancelar = série inteira',
        );
        if (deleteSingle) {
          const params = new URLSearchParams({
            scope: 'single',
            occurrenceId: event.occurrenceId || '',
            occurrenceDate: event.startAt,
          });
          url = `${url}?${params.toString()}`;
        }
      }
      const res = await fetch(url, { method: 'DELETE' });
      if (res.ok) loadData();
    } catch (error) {
      console.error('Failed to delete event', error);
    }
  };

  const getEventStyle = (type: EventType | string) => {
    const found = EVENT_TYPES.find((t) => t.value === type);
    const color = found ? found.color : 'slate';

    const colors: Record<string, string> = {
      blue: dark
        ? 'bg-blue-500/20 text-blue-400 border-blue-500/30'
        : 'bg-blue-50 text-blue-700 border-blue-200',
      purple: dark
        ? 'bg-purple-500/20 text-purple-400 border-purple-500/30'
        : 'bg-purple-50 text-purple-700 border-purple-200',
      amber: dark
        ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
        : 'bg-amber-50 text-amber-700 border-amber-200',
      red: dark
        ? 'bg-red-500/20 text-red-400 border-red-500/30'
        : 'bg-red-50 text-red-700 border-red-200',
      emerald: dark
        ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
        : 'bg-emerald-50 text-emerald-700 border-emerald-200',
      slate: dark
        ? 'bg-slate-500/20 text-slate-400 border-slate-500/30'
        : 'bg-slate-50 text-slate-700 border-slate-200',
    };

    return colors[color] || colors.slate;
  };

  const gridDays = React.useMemo(() => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    const days = [];
    const startDay = firstDay.getDay(); // 0-6 (dom-sab)

    // Prev month padding
    for (let i = startDay; i > 0; i--) {
      days.push({ date: new Date(year, month, 1 - i), isCurrent: false });
    }

    // Current month
    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push({ date: new Date(year, month, i), isCurrent: true });
    }

    // Next month padding
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      days.push({ date: new Date(year, month + 1, i), isCurrent: false });
    }

    return days;
  }, [viewDate]);

  const changeMonth = (offset: number) => {
    const next = new Date(viewDate);
    next.setMonth(next.getMonth() + offset);
    setViewDate(next);
  };

  const monthLabel = viewDate
    .toLocaleString('pt-BR', { month: 'long', year: 'numeric' })
    .replace(/^\w/, (c) => c.toUpperCase());
  const todayKey = toDayKey(new Date());
  const recurringCount = events.filter((event) => Boolean(event.recurrenceRule)).length;
  const selectedDayEvents = events
    .filter((event) => toDayKey(event.startAt) === selectedDay)
    .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
  const monthEvents = events
    .slice()
    .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
  const selectedDateLabel = new Date(`${selectedDay}T00:00:00`).toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className={cn('text-2xl font-bold', dark ? 'text-slate-100' : 'text-slate-900')}>
            Calendário
          </h2>
          <p className={cn('text-sm', dark ? 'text-slate-400' : 'text-slate-500')}>
            Agenda operacional com eventos recorrentes, reuniões e lembretes.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div
            className={cn(
              'flex items-center gap-1.5 rounded-lg p-0.5',
              dark
                ? 'bg-[#0f172a]/80 border border-slate-700/50'
                : 'bg-slate-100 border border-slate-200',
            )}
          >
            {(['MES', 'LISTA'] as ViewMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={cn(
                  'px-3 py-1.5 text-xs font-medium rounded-md transition-all',
                  viewMode === mode
                    ? dark
                      ? 'bg-slate-800 text-white shadow-sm'
                      : 'bg-white text-slate-900 shadow-sm'
                    : dark
                      ? 'text-slate-400 hover:text-slate-200'
                      : 'text-slate-500 hover:text-slate-700',
                )}
              >
                {mode === 'MES' ? 'Mês' : 'Lista'}
              </button>
            ))}
          </div>
          <button
            onClick={() => resetForm()}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold transition-colors shadow-lg shadow-blue-600/20"
          >
            <Plus size={18} />
            Novo Evento
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-4 min-h-[720px]">
        <div
          className={cn(
            'border rounded-2xl overflow-hidden flex flex-col',
            dark
              ? 'bg-[#1e293b]/60 backdrop-blur-md border-slate-700/50'
              : 'bg-white border-slate-200 shadow-sm',
          )}
        >
          <div
            className={cn(
              'px-6 py-4 border-b flex items-center justify-between',
              dark
                ? 'bg-white/[0.02] border-slate-700/50 text-slate-200'
                : 'bg-slate-50/50 border-slate-100 text-slate-700',
            )}
          >
            <div className="flex items-center gap-3">
              <CalendarDays size={18} className="text-blue-500" />
              <div>
                <h3 className="text-lg font-bold">{monthLabel}</h3>
                <p
                  className={cn(
                    'text-xs uppercase tracking-wider',
                    dark ? 'text-slate-500' : 'text-slate-400',
                  )}
                >
                  {events.length} eventos • {recurringCount} recorrentes
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => changeMonth(-1)}
                className={cn(
                  'p-2 rounded-lg transition-colors',
                  dark ? 'hover:bg-white/5' : 'hover:bg-slate-100',
                )}
              >
                <ChevronLeft size={20} />
              </button>
              <button
                onClick={() => setViewDate(new Date())}
                className={cn(
                  'px-3 py-1 text-xs font-bold rounded-lg transition-colors',
                  dark ? 'hover:bg-white/5' : 'hover:bg-slate-100',
                )}
              >
                Hoje
              </button>
              <button
                onClick={() => changeMonth(1)}
                className={cn(
                  'p-2 rounded-lg transition-colors',
                  dark ? 'hover:bg-white/5' : 'hover:bg-slate-100',
                )}
              >
                <ChevronRight size={20} />
              </button>
            </div>
          </div>

          {viewMode === 'MES' ? (
            <>
              <div
                className={cn(
                  'grid grid-cols-7 border-b text-center py-2 text-[10px] font-bold uppercase tracking-widest',
                  dark
                    ? 'bg-black/20 border-slate-700/30 text-slate-500'
                    : 'bg-slate-50/50 border-slate-100 text-slate-400',
                )}
              >
                {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((d) => (
                  <div key={d}>{d}</div>
                ))}
              </div>

              <div className="flex-1 grid grid-cols-7 grid-rows-6">
                {gridDays.map((day, idx) => {
                  const dayStr = toDayKey(day.date);
                  const dayEvents = events.filter((e) => e.startAt.startsWith(dayStr));
                  const isToday = todayKey === dayStr;
                  const isSelected = selectedDay === dayStr;

                  return (
                    <div
                      key={idx}
                      onClick={() => setSelectedDay(dayStr)}
                      className={cn(
                        'border-r border-b min-h-[110px] p-2 transition-all cursor-pointer relative group',
                        dark
                          ? 'border-slate-700/30 hover:bg-blue-500/[0.03]'
                          : 'border-slate-100 hover:bg-blue-50/30',
                        !day.isCurrent && 'opacity-35',
                        isSelected && (dark ? 'bg-blue-500/10' : 'bg-blue-50/70'),
                        isToday && (dark ? 'ring-1 ring-blue-500/40' : 'ring-1 ring-blue-300'),
                      )}
                    >
                      <div className="flex justify-between items-start mb-1">
                        <span
                          className={cn(
                            'text-xs font-mono font-bold w-7 h-7 flex items-center justify-center rounded-full',
                            isToday
                              ? 'bg-blue-600 text-white'
                              : dark
                                ? 'text-slate-400'
                                : 'text-slate-500',
                          )}
                        >
                          {day.date.getDate()}
                        </span>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            resetForm(null, day.date);
                          }}
                          className="text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded"
                        >
                          <Plus size={12} />
                        </button>
                      </div>

                      <div className="space-y-1 overflow-hidden">
                        {dayEvents.slice(0, 3).map((event) => (
                          <button
                            type="button"
                            key={event.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              resetForm(event);
                            }}
                            className={cn(
                              'w-full px-1.5 py-1 rounded text-[10px] font-medium truncate border text-left transition-transform hover:scale-[1.02]',
                              getEventStyle(event.type),
                            )}
                            title={
                              event.recurrenceRule
                                ? `Recorrente: ${event.recurrenceRule}`
                                : undefined
                            }
                          >
                            <span className="inline-flex items-center gap-1">
                              {event.recurrenceRule && <RotateCcw size={10} />}
                              {event.title}
                            </span>
                          </button>
                        ))}
                        {dayEvents.length > 3 && (
                          <div className="text-[9px] font-bold text-slate-500 pl-1">
                            + {dayEvents.length - 3} mais
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="divide-y divide-[rgba(0,0,0,0.06)]">
              {monthEvents.length === 0 ? (
                <p className="text-sm text-center py-20 text-slate-400">
                  Nenhum evento neste período.
                </p>
              ) : (
                monthEvents.map((event) => (
                  <button
                    type="button"
                    key={event.id}
                    onClick={() => resetForm(event)}
                    className={cn(
                      'w-full flex items-center gap-4 p-4 text-left transition-colors',
                      dark ? 'hover:bg-white/[0.03]' : 'hover:bg-slate-50',
                    )}
                  >
                    <div className="text-center flex-shrink-0 w-14">
                      <p
                        className={cn(
                          'text-[10px] uppercase',
                          dark ? 'text-slate-500' : 'text-slate-400',
                        )}
                      >
                        {formatEventDate(event.startAt)}
                      </p>
                      <p
                        className={cn(
                          'text-xs font-semibold',
                          dark ? 'text-slate-200' : 'text-slate-700',
                        )}
                      >
                        {formatEventTime(event.startAt)}
                      </p>
                    </div>
                    <div
                      className={cn(
                        'px-2 py-1 rounded-lg border text-[10px] font-semibold',
                        getEventStyle(event.type),
                      )}
                    >
                      {event.type}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p
                        className={cn(
                          'text-sm font-semibold truncate',
                          dark ? 'text-slate-100' : 'text-slate-800',
                        )}
                      >
                        {event.title}
                      </p>
                      <p
                        className={cn(
                          'text-xs truncate',
                          dark ? 'text-slate-400' : 'text-slate-500',
                        )}
                      >
                        {event.description || event.location || 'Sem detalhes adicionais.'}
                      </p>
                    </div>
                    {event.recurrenceRule && <RotateCcw size={14} className="text-blue-500" />}
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        <div
          className={cn(
            'border rounded-2xl overflow-hidden flex flex-col',
            dark
              ? 'bg-[#1e293b]/60 backdrop-blur-md border-slate-700/50'
              : 'bg-white border-slate-200 shadow-sm',
          )}
        >
          <div className="flex items-center gap-4">
            <div
              className={cn(
                'px-5 py-4 border-b',
                dark ? 'border-slate-700/50' : 'border-slate-100',
              )}
            >
              <h3 className={cn('font-bold', dark ? 'text-slate-100' : 'text-slate-800')}>
                {selectedDateLabel}
              </h3>
              <p className={cn('text-xs mt-1', dark ? 'text-slate-500' : 'text-slate-400')}>
                {selectedDayEvents.length} evento(s) neste dia
              </p>
            </div>
          </div>
          <div className="p-4">
            <button
              type="button"
              onClick={() => resetForm(null, new Date(`${selectedDay}T09:00:00`))}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold shadow-lg shadow-blue-600/20 transition-colors"
            >
              <Plus size={16} />
              Novo evento neste dia
            </button>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-3">
            {selectedDayEvents.length === 0 ? (
              <div
                className={cn(
                  'rounded-xl border border-dashed p-8 text-center',
                  dark ? 'border-slate-700/50 text-slate-500' : 'border-slate-200 text-slate-400',
                )}
              >
                <Calendar size={24} className="mx-auto mb-3 opacity-50" />
                <p className="text-sm">Nenhum evento neste dia.</p>
              </div>
            ) : (
              selectedDayEvents.map((event) => (
                <div
                  key={event.id}
                  className={cn(
                    'rounded-xl border p-3 space-y-2',
                    dark ? 'bg-[#0f172a]/80 border-slate-700/50' : 'bg-slate-50 border-slate-200',
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p
                        className={cn(
                          'text-sm font-semibold truncate',
                          dark ? 'text-slate-100' : 'text-slate-800',
                        )}
                      >
                        {event.title}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span
                          className={cn(
                            'px-2 py-0.5 rounded-full border text-[10px] font-bold',
                            getEventStyle(event.type),
                          )}
                        >
                          {event.type}
                        </span>
                        {event.recurrenceRule && <RotateCcw size={12} className="text-blue-500" />}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => resetForm(event)}
                        className={cn(
                          'p-2 rounded-lg',
                          dark
                            ? 'hover:bg-white/5 text-slate-400'
                            : 'hover:bg-white text-slate-500',
                        )}
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(event.id)}
                        className={cn(
                          'p-2 rounded-lg',
                          dark
                            ? 'hover:bg-rose-500/10 text-rose-400'
                            : 'hover:bg-rose-50 text-rose-500',
                        )}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  <div
                    className={cn('text-xs space-y-1', dark ? 'text-slate-400' : 'text-slate-500')}
                  >
                    <div className="flex items-center gap-2">
                      <Clock size={12} /> {formatEventTime(event.startAt)}
                      {event.endAt ? ` - ${formatEventTime(event.endAt)}` : ''}
                    </div>
                    {event.location && (
                      <div className="flex items-center gap-2">
                        <MapPin size={12} /> {event.location}
                      </div>
                    )}
                    {event.meetingLink && (
                      <div className="flex items-center gap-2 truncate">
                        <LinkIcon size={12} /> {event.meetingLink}
                      </div>
                    )}
                    {!event.isGlobal && event.assigneeId && (
                      <div className="flex items-center gap-2">
                        <Users size={12} />
                        {users.find((user) => user.id === event.assigneeId)?.name ||
                          'Analista vinculado'}
                      </div>
                    )}
                  </div>

                  {event.description && (
                    <p
                      className={cn(
                        'text-xs leading-relaxed',
                        dark ? 'text-slate-300' : 'text-slate-600',
                      )}
                    >
                      {event.description}
                    </p>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Event Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setIsModalOpen(false)}
          ></div>
          <div
            className={cn(
              'relative w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200',
              dark ? 'bg-[#1e293b] border border-slate-700/50' : 'bg-white border border-slate-200',
            )}
          >
            <div
              className={cn(
                'px-6 py-4 border-b flex items-center justify-between',
                dark ? 'border-slate-700/50' : 'border-slate-100',
              )}
            >
              <h3 className={cn('font-bold text-lg', dark ? 'text-slate-100' : 'text-slate-800')}>
                {editingEvent ? 'Editar Evento' : 'Novo Evento'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-2 hover:bg-slate-500/10 rounded-full transition-colors"
              >
                <X size={20} className="text-slate-400" />
              </button>
            </div>

            <form
              onSubmit={handleSave}
              className="p-6 space-y-4 max-h-[80vh] overflow-y-auto custom-scrollbar"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2 space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase">Título</label>
                  <input
                    required
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="Ex: Reunião Semanal de Alinhamento"
                    className={cn(
                      'w-full px-4 py-2 rounded-xl outline-none border transition-all focus:ring-2 focus:ring-blue-500/20',
                      dark
                        ? 'bg-[#0f172a] border-slate-700 text-slate-100 focus:border-blue-500/50'
                        : 'bg-white border-slate-200 text-slate-800 focus:border-blue-300 shadow-sm',
                    )}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase">Tipo</label>
                  <select
                    value={formData.type}
                    onChange={(e) =>
                      setFormData({ ...formData, type: e.target.value as EventType })
                    }
                    className={cn(
                      'w-full px-4 py-2 rounded-xl outline-none border transition-all',
                      dark
                        ? 'bg-[#0f172a] border-slate-700 text-slate-100'
                        : 'bg-white border-slate-200 text-slate-800 shadow-sm',
                    )}
                  >
                    {EVENT_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase">Visibilidade</label>
                  <div className="flex bg-slate-500/5 rounded-xl p-1 gap-1">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, isGlobal: false })}
                      className={cn(
                        'flex-1 py-1.5 text-xs font-bold rounded-lg transition-all',
                        !formData.isGlobal
                          ? dark
                            ? 'bg-blue-600 text-white'
                            : 'bg-white text-blue-600 shadow-sm'
                          : 'text-slate-500',
                      )}
                    >
                      Individual
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, isGlobal: true })}
                      className={cn(
                        'flex-1 py-1.5 text-xs font-bold rounded-lg transition-all',
                        formData.isGlobal
                          ? dark
                            ? 'bg-blue-600 text-white'
                            : 'bg-white text-blue-600 shadow-sm'
                          : 'text-slate-500',
                      )}
                    >
                      Global
                    </button>
                  </div>
                </div>

                {!formData.isGlobal && (
                  <div className="md:col-span-2 space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase">Analista</label>
                    <select
                      required={!formData.isGlobal}
                      value={formData.assigneeId}
                      onChange={(e) => setFormData({ ...formData, assigneeId: e.target.value })}
                      className={cn(
                        'w-full px-4 py-2 rounded-xl outline-none border transition-all',
                        dark
                          ? 'bg-[#0f172a] border-slate-700 text-slate-100'
                          : 'bg-white border-slate-200 text-slate-800 shadow-sm',
                      )}
                    >
                      <option value="">Selecione um analista...</option>
                      {users.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name} ({u.role})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase">Início</label>
                  <input
                    required
                    type="datetime-local"
                    value={formData.startAt}
                    onChange={(e) => setFormData({ ...formData, startAt: e.target.value })}
                    className={cn(
                      'w-full px-4 py-2 rounded-xl outline-none border transition-all',
                      dark
                        ? 'bg-[#0f172a] border-slate-700 text-slate-100'
                        : 'bg-white border-slate-200 text-slate-800 shadow-sm',
                    )}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase">
                    Fim (Opcional)
                  </label>
                  <input
                    type="datetime-local"
                    value={formData.endAt}
                    onChange={(e) => setFormData({ ...formData, endAt: e.target.value })}
                    className={cn(
                      'w-full px-4 py-2 rounded-xl outline-none border transition-all',
                      dark
                        ? 'bg-[#0f172a] border-slate-700 text-slate-100'
                        : 'bg-white border-slate-200 text-slate-800 shadow-sm',
                    )}
                  />
                </div>

                {formData.type === 'REUNIAO_ONLINE' && (
                  <div className="md:col-span-2 space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase">
                      Link da Reunião
                    </label>
                    <input
                      type="url"
                      value={formData.meetingLink}
                      onChange={(e) => setFormData({ ...formData, meetingLink: e.target.value })}
                      placeholder="https://meet.google.com/..."
                      className={cn(
                        'w-full px-4 py-2 rounded-xl outline-none border transition-all',
                        dark
                          ? 'bg-[#0f172a] border-slate-700 text-slate-100'
                          : 'bg-white border-slate-200 text-slate-800 shadow-sm',
                      )}
                    />
                  </div>
                )}

                <div className="md:col-span-2 space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase">
                    Localização / Observação
                  </label>
                  <input
                    type="text"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    placeholder="Ex: Sala de Reunião 1 ou Remoto"
                    className={cn(
                      'w-full px-4 py-2 rounded-xl outline-none border transition-all',
                      dark
                        ? 'bg-[#0f172a] border-slate-700 text-slate-100'
                        : 'bg-white border-slate-200 text-slate-800 shadow-sm',
                    )}
                  />
                </div>

                <div className="md:col-span-2 space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase">Descrição</label>
                  <textarea
                    rows={3}
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Detalhes sobre o evento..."
                    className={cn(
                      'w-full px-4 py-2 rounded-xl outline-none border transition-all resize-none',
                      dark
                        ? 'bg-[#0f172a] border-slate-700 text-slate-100'
                        : 'bg-white border-slate-200 text-slate-800 shadow-sm',
                    )}
                  ></textarea>
                </div>

                <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase">
                      Recorrência
                    </label>
                    <select
                      value={formData.recurrencePreset}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          recurrencePreset: e.target.value as RecurrencePreset,
                        })
                      }
                      className={cn(
                        'w-full px-4 py-2 rounded-xl outline-none border transition-all',
                        dark
                          ? 'bg-[#0f172a] border-slate-700 text-slate-100'
                          : 'bg-white border-slate-200 text-slate-800 shadow-sm',
                      )}
                    >
                      {RECURRENCE_PRESETS.map((preset) => (
                        <option key={preset.value} value={preset.value}>
                          {preset.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {formData.recurrencePreset === 'custom' && (
                    <div className="md:col-span-2 space-y-1.5">
                      <label className="text-xs font-bold text-slate-500 uppercase">
                        Regra RRULE
                      </label>
                      <input
                        value={formData.recurrenceRule}
                        onChange={(e) =>
                          setFormData({ ...formData, recurrenceRule: e.target.value })
                        }
                        placeholder="FREQ=WEEKLY;BYDAY=MO,WE"
                        className={cn(
                          'w-full px-4 py-2 rounded-xl outline-none border transition-all',
                          dark
                            ? 'bg-[#0f172a] border-slate-700 text-slate-100'
                            : 'bg-white border-slate-200 text-slate-800 shadow-sm',
                        )}
                      />
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase">
                      Recorrer até
                    </label>
                    <input
                      type="date"
                      disabled={formData.recurrencePreset === 'none'}
                      value={formData.recurrenceEnd}
                      onChange={(e) => setFormData({ ...formData, recurrenceEnd: e.target.value })}
                      className={cn(
                        'w-full px-4 py-2 rounded-xl outline-none border transition-all disabled:opacity-50',
                        dark
                          ? 'bg-[#0f172a] border-slate-700 text-slate-100'
                          : 'bg-white border-slate-200 text-slate-800 shadow-sm',
                      )}
                    />
                  </div>
                </div>
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className={cn(
                    'flex-1 py-2.5 rounded-xl font-bold transition-all border',
                    dark
                      ? 'border-slate-700 text-slate-400 hover:bg-white/5'
                      : 'border-slate-200 text-slate-500 hover:bg-slate-50',
                  )}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-[2] py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold transition-all shadow-lg shadow-blue-600/20"
                >
                  {editingEvent ? 'Salvar Alterações' : 'Criar Evento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
