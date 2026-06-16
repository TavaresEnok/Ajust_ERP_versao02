'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Plus, Clock, Users, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

interface AgendaItem {
  id: string;
  title: string;
  type: string;
  start: string;
  end: string;
  attendees: string[];
  source: 'calendar_event' | 'service_order' | 'change_window';
  refId: string;
}

interface AgendaResponse {
  weekStart: string;
  weekEnd: string;
  items: AgendaItem[];
}

const DAY_KEYS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab', 'Dom'] as const;
const DAY_LABELS: Record<(typeof DAY_KEYS)[number], string> = {
  Seg: 'Segunda',
  Ter: 'Terça',
  Qua: 'Quarta',
  Qui: 'Quinta',
  Sex: 'Sexta',
  Sab: 'Sábado',
  Dom: 'Domingo',
};
const DAY_SHORT: Record<(typeof DAY_KEYS)[number], string> = {
  Seg: 'SEG',
  Ter: 'TER',
  Qua: 'QUA',
  Qui: 'QUI',
  Sex: 'SEX',
  Sab: 'SAB',
  Dom: 'DOM',
};

const HOURS = Array.from({ length: 17 }, (_, i) => i + 6);

const TYPE_COLORS: Record<string, string> = {
  REUNIAO: '#2563eb',
  REUNIAO_ONLINE: '#7c3aed',
  LEMBRETE: '#16a34a',
  JANELA: '#ea580c',
  TREINAMENTO: '#d97706',
  REVISAO: '#4f46e5',
  REUNIAO_PRESENCIAL: '#2563eb',
  ATENDIMENTO: '#0891b2',
  OUTRO: '#6b7280',
  CHANGE_WINDOW: '#ea580c',
};

const TYPE_LABELS: Record<string, string> = {
  REUNIAO: 'Reunião',
  REUNIAO_ONLINE: 'Reunião Online',
  REUNIAO_PRESENCIAL: 'Reunião Presencial',
  ATENDIMENTO: 'Atendimento',
  LEMBRETE: 'Lembrete',
  JANELA: 'Janela',
  TREINAMENTO: 'Treinamento',
  REVISAO: 'Revisão',
  OUTRO: 'Outro',
  CHANGE_WINDOW: 'Janela de Mudança',
};

function toDayKey(d: Date): (typeof DAY_KEYS)[number] {
  const idx = d.getDay() === 0 ? 6 : d.getDay() - 1;
  return DAY_KEYS[idx];
}

function fmtTime(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function getEventPosition(item: AgendaItem) {
  const start = fmtTime(item.start);
  const end = fmtTime(item.end);
  const startMin = timeToMinutes(start);
  const endMin = Math.max(startMin + 30, timeToMinutes(end));
  const gridStart = 6 * 60;
  const gridEnd = 23 * 60;
  const totalGrid = gridEnd - gridStart;
  const top = ((startMin - gridStart) / totalGrid) * 100;
  const height = ((endMin - startMin) / totalGrid) * 100;
  return { top: Math.max(0, top), height: Math.max(2, height), start, end };
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function AgendaPage() {
  const [tab, setTab] = useState<'Semana' | 'Dia'>('Semana');
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedDay, setSelectedDay] = useState<(typeof DAY_KEYS)[number] | null>(null);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [items, setItems] = useState<AgendaItem[]>([]);
  const [weekStart, setWeekStart] = useState<string | null>(null);
  const [weekEnd, setWeekEnd] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/dashboards/agenda-overview', { signal, cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as AgendaResponse;
      setItems(Array.isArray(data.items) ? data.items : []);
      setWeekStart(data.weekStart);
      setWeekEnd(data.weekEnd);
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const ac = new AbortController();
    void load(ac.signal);
    return () => ac.abort();
  }, [load]);

  const weekLabel = useMemo(() => {
    if (!weekStart) return '—';
    const s = new Date(weekStart);
    const e = new Date(weekEnd!);
    return `${fmtDate(s)} - ${fmtDate(e)}`;
  }, [weekStart, weekEnd]);

  const dayName = useMemo(() => {
    if (!weekStart) return '';
    const base = new Date(weekStart);
    if (selectedDay) {
      const idx = DAY_KEYS.indexOf(selectedDay);
      if (idx >= 0) base.setDate(base.getDate() + idx);
    }
    return base.toLocaleDateString('pt-BR', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  }, [weekStart, selectedDay]);

  const itemsByDay = useMemo(() => {
    const map = new Map<(typeof DAY_KEYS)[number], AgendaItem[]>();
    for (const k of DAY_KEYS) map.set(k, []);
    for (const item of items) {
      const day = toDayKey(new Date(item.start));
      map.get(day)!.push(item);
    }
    return map;
  }, [items]);

  const dayEvents = useMemo(() => {
    const k = selectedDay ?? DAY_KEYS[0];
    return itemsByDay.get(k) ?? [];
  }, [itemsByDay, selectedDay]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-content-primary tracking-[-0.03em]">Agenda</h1>
          <p className="text-sm text-content-secondary mt-0.5">Visão semanal e diária</p>
        </div>
        <button
          onClick={() => load()}
          className="p-2 rounded-md text-content-tertiary hover:text-content-primary hover:bg-bg-hover transition-colors"
          aria-label="Recarregar agenda"
        >
          <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
        </button>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          Falha ao carregar agenda: {error}.{' '}
          <button onClick={() => load()} className="underline">
            Tentar novamente
          </button>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setWeekOffset((w) => w - 1)}
            className="p-1.5 rounded-md text-content-tertiary hover:text-content-primary hover:bg-bg-hover transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-semibold text-content-primary tabular-nums min-w-[200px] text-center">
            {weekLabel}
          </span>
          <button
            onClick={() => setWeekOffset((w) => w + 1)}
            className="p-1.5 rounded-md text-content-tertiary hover:text-content-primary hover:bg-bg-hover transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <button
            onClick={() => setWeekOffset(0)}
            className="px-3 py-1.5 text-xs font-medium text-accent-DEFAULT bg-accent-subtle rounded-lg hover:bg-accent-muted transition-colors"
          >
            Hoje
          </button>
        </div>

        <div className="flex items-center">
          <div className="flex bg-bg-subtle rounded-lg p-0.5">
            <button
              onClick={() => setTab('Semana')}
              className={cn(
                'px-4 py-1.5 text-xs font-medium rounded-md transition-colors',
                tab === 'Semana'
                  ? 'bg-bg-surface text-content-primary shadow-sm'
                  : 'text-content-tertiary hover:text-content-secondary',
              )}
            >
              Semana
            </button>
            <button
              onClick={() => {
                setTab('Dia');
                setSelectedDay(selectedDay ?? 'Seg');
              }}
              className={cn(
                'px-4 py-1.5 text-xs font-medium rounded-md transition-colors',
                tab === 'Dia'
                  ? 'bg-bg-surface text-content-primary shadow-sm'
                  : 'text-content-tertiary hover:text-content-secondary',
              )}
            >
              Dia
            </button>
          </div>
        </div>
      </div>

      {tab === 'Semana' ? (
        <div className="flex gap-4">
          <div className="flex-1 bg-bg-surface rounded-xl shadow-sm border border-[rgba(0,0,0,0.06)] overflow-hidden">
            <div className="grid grid-cols-7 border-b border-[rgba(0,0,0,0.06)]">
              {DAY_KEYS.map((day) => (
                <div
                  key={day}
                  className={cn(
                    'text-center py-2.5 border-r border-[rgba(0,0,0,0.06)] last:border-r-0 cursor-pointer hover:bg-bg-hover transition-colors',
                    selectedDay === day && 'bg-accent-subtle',
                    day === 'Seg' && !selectedDay && 'bg-accent-subtle',
                  )}
                  onClick={() => setSelectedDay(day)}
                >
                  <span className="text-2xs font-semibold text-content-tertiary uppercase tracking-[0.05em]">
                    {DAY_SHORT[day]}
                  </span>
                  <span className="block text-sm font-semibold text-content-primary mt-0.5">
                    {DAY_LABELS[day].slice(0, 3)}
                  </span>
                </div>
              ))}
            </div>

            <div className="overflow-y-auto" style={{ maxHeight: 'calc(100vh - 260px)' }}>
              {loading ? (
                <div className="p-4 space-y-2">
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                </div>
              ) : (
                <div className="grid grid-cols-7 relative">
                  {DAY_KEYS.map((day) => (
                    <div
                      key={day}
                      className={cn(
                        'border-r border-[rgba(0,0,0,0.06)] last:border-r-0 relative',
                        'min-h-[1020px]',
                      )}
                    >
                      {HOURS.map((hour) => (
                        <div
                          key={hour}
                          className="border-b border-[rgba(0,0,0,0.03)] h-[60px] relative"
                        />
                      ))}
                      {(itemsByDay.get(day) ?? []).map((item) => {
                        const pos = getEventPosition(item);
                        const color = TYPE_COLORS[item.type] || '#6b7280';
                        return (
                          <div
                            key={item.id}
                            className="absolute left-1 right-1 rounded-md px-2 py-1 overflow-hidden cursor-pointer hover:brightness-90 transition-all z-10"
                            style={{
                              top: `${pos.top}%`,
                              height: `${pos.height}%`,
                              backgroundColor: color,
                              minHeight: '24px',
                            }}
                            title={`${item.title}\n${pos.start} - ${pos.end}`}
                          >
                            <p className="text-2xs font-semibold text-white leading-tight truncate">
                              {item.title}
                            </p>
                            <p className="text-[10px] text-white/80 leading-tight truncate">
                              {pos.start} - {pos.end}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="w-[280px] flex-shrink-0 space-y-4">
            <div className="bg-bg-surface rounded-xl shadow-sm border border-[rgba(0,0,0,0.06)] p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-content-primary">
                  {selectedDay ? DAY_LABELS[selectedDay] : DAY_LABELS.Seg}
                </h3>
                <span className="text-2xs text-content-tertiary">{dayEvents.length} evento(s)</span>
              </div>
              <div className="space-y-2">
                {dayEvents.length === 0 && (
                  <p className="text-sm text-content-tertiary">Nenhum evento neste dia.</p>
                )}
                {dayEvents.map((item) => {
                  const color = TYPE_COLORS[item.type] || '#6b7280';
                  const pos = getEventPosition(item);
                  return (
                    <div
                      key={item.id}
                      className="rounded-lg p-3"
                      style={{ backgroundColor: `${color}12` }}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{ backgroundColor: color }}
                        />
                        <span className="text-2xs font-medium" style={{ color }}>
                          {TYPE_LABELS[item.type] || item.type}
                        </span>
                      </div>
                      <p className="text-sm font-medium text-content-primary mb-1">{item.title}</p>
                      <div className="flex items-center gap-3 text-2xs text-content-tertiary">
                        <span className="inline-flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {pos.start} - {pos.end}
                        </span>
                        {item.attendees.length > 0 && (
                          <span className="inline-flex items-center gap-1">
                            <Users className="w-3 h-3" />
                            {item.attendees.length}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="bg-bg-surface rounded-xl shadow-sm border border-[rgba(0,0,0,0.06)] p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-content-primary">Adicionar</h3>
                <button
                  onClick={() => setShowQuickAdd(!showQuickAdd)}
                  className="p-1 rounded-md text-content-tertiary hover:text-accent-DEFAULT hover:bg-accent-subtle transition-colors"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              {showQuickAdd && (
                <p className="text-xs text-content-tertiary">
                  O cadastro de eventos do calendário é feito pela página{' '}
                  <strong>Calendário</strong> da gerência.
                </p>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex gap-4">
          <div className="flex-1 bg-bg-surface rounded-xl shadow-sm border border-[rgba(0,0,0,0.06)] overflow-hidden">
            <div className="flex items-center border-b border-[rgba(0,0,0,0.06)]">
              {DAY_KEYS.map((day) => (
                <button
                  key={day}
                  onClick={() => setSelectedDay(day)}
                  className={cn(
                    'flex-1 text-center py-2.5 text-xs font-medium transition-colors border-r border-[rgba(0,0,0,0.06)] last:border-r-0',
                    selectedDay === day
                      ? 'bg-accent-subtle text-accent-DEFAULT'
                      : 'text-content-tertiary hover:text-content-secondary hover:bg-bg-hover',
                  )}
                >
                  {DAY_SHORT[day]}
                </button>
              ))}
            </div>
            <div className="overflow-y-auto" style={{ maxHeight: 'calc(100vh - 260px)' }}>
              {loading ? (
                <div className="p-4 space-y-2">
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                </div>
              ) : (
                <div className="relative min-h-[1020px]">
                  {HOURS.map((hour) => (
                    <div
                      key={hour}
                      className="border-b border-[rgba(0,0,0,0.03)] h-[60px] flex items-start"
                    >
                      <span className="text-2xs text-content-tertiary w-14 pl-3 py-0.5 flex-shrink-0 text-right pr-3">
                        {hour}:00
                      </span>
                      <div className="flex-1 h-full border-l border-[rgba(0,0,0,0.06)] relative">
                        {dayEvents
                          .filter((e) => new Date(e.start).getHours() === hour)
                          .map((item) => {
                            const pos = getEventPosition(item);
                            const color = TYPE_COLORS[item.type] || '#6b7280';
                            const duration = Math.max(
                              1,
                              timeToMinutes(pos.end) - timeToMinutes(pos.start),
                            );
                            return (
                              <div
                                key={item.id}
                                className="absolute left-2 right-2 rounded-md px-3 py-1.5 cursor-pointer hover:brightness-90 transition-all z-10"
                                style={{
                                  top: '0px',
                                  height: `${duration}px`,
                                  backgroundColor: color,
                                }}
                                title={`${item.title}\n${pos.start} - ${pos.end}`}
                              >
                                <p className="text-xs font-semibold text-white leading-tight">
                                  {item.title}
                                </p>
                                <p className="text-[10px] text-white/80 leading-tight">
                                  {pos.start} - {pos.end}
                                </p>
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="w-[280px] flex-shrink-0 space-y-4">
            <div className="bg-bg-surface rounded-xl shadow-sm border border-[rgba(0,0,0,0.06)] p-4">
              <h3 className="text-sm font-semibold text-content-primary mb-1">{dayName}</h3>
              <p className="text-2xs text-content-tertiary mb-3">{dayEvents.length} evento(s)</p>
              <div className="space-y-2">
                {dayEvents.length === 0 && (
                  <p className="text-sm text-content-tertiary">Nenhum evento neste dia.</p>
                )}
                {dayEvents.map((item) => {
                  const color = TYPE_COLORS[item.type] || '#6b7280';
                  const pos = getEventPosition(item);
                  return (
                    <div
                      key={item.id}
                      className="rounded-lg p-3"
                      style={{ backgroundColor: `${color}12` }}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                        <span className="text-2xs font-medium" style={{ color }}>
                          {TYPE_LABELS[item.type] || item.type}
                        </span>
                      </div>
                      <p className="text-sm font-medium text-content-primary mb-1">{item.title}</p>
                      <div className="flex items-center gap-3 text-2xs text-content-tertiary">
                        <span className="inline-flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {pos.start} - {pos.end}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
