'use client';
import { useState, useMemo } from 'react';

export interface CalendarViewEvent {
  id: string;
  title: string;
  startAt: string;
  endAt?: string;
  type?: string;
  assigneeName?: string;
}

type ViewMode = 'month' | 'week' | 'day';

export function CalendarView({
  events,
  onEventClick,
}: {
  events: CalendarViewEvent[];
  onEventClick?: (event: CalendarViewEvent) => void;
}) {
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [currentDate, setCurrentDate] = useState(new Date());

  const navigate = (dir: -1 | 1) => {
    const next = new Date(currentDate);
    if (viewMode === 'month') next.setMonth(next.getMonth() + dir);
    else if (viewMode === 'week') next.setDate(next.getDate() + dir * 7);
    else next.setDate(next.getDate() + dir);
    setCurrentDate(next);
  };

  const headerLabel = useMemo(() => {
    if (viewMode === 'month') {
      return currentDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    }
    if (viewMode === 'day') {
      return currentDate.toLocaleDateString('pt-BR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      });
    }
    const start = new Date(currentDate);
    start.setDate(start.getDate() - start.getDay() + 1);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    return `${start.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })} — ${end.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })}`;
  }, [viewMode, currentDate]);

  const filteredEvents = useMemo(() => {
    return events.filter((e) => {
      const d = new Date(e.startAt);
      if (viewMode === 'month')
        return (
          d.getMonth() === currentDate.getMonth() && d.getFullYear() === currentDate.getFullYear()
        );
      if (viewMode === 'day') return d.toDateString() === currentDate.toDateString();
      const start = new Date(currentDate);
      start.setDate(start.getDate() - start.getDay() + 1);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(end.getDate() + 7);
      return d >= start && d < end;
    });
  }, [events, viewMode, currentDate]);

  const typeColor: Record<string, string> = {
    REUNIAO: 'bg-blue-500',
    REUNIAO_ONLINE: 'bg-indigo-500',
    FERIADO: 'bg-red-500',
    LEMBRETE: 'bg-yellow-500',
    OUTRO: 'bg-gray-500',
  };

  const monthDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days: (number | null)[] = [];
    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let d = 1; d <= daysInMonth; d++) days.push(d);
    return days;
  }, [currentDate]);

  const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700">
      <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate(-1)}
            className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-gray-500"
          >
            ←
          </button>
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 capitalize">
            {headerLabel}
          </h3>
          <button
            onClick={() => navigate(1)}
            className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-gray-500"
          >
            →
          </button>
        </div>
        <div className="flex gap-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
          {(['month', 'week', 'day'] as ViewMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`px-3 py-1 text-xs rounded-md font-medium transition-colors ${
                viewMode === mode
                  ? 'bg-white dark:bg-gray-600 text-gray-800 dark:text-gray-100 shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'
              }`}
            >
              {mode === 'month' ? 'Mês' : mode === 'week' ? 'Semana' : 'Dia'}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4">
        {viewMode === 'month' && (
          <div className="grid grid-cols-7 gap-px bg-gray-200 dark:bg-gray-700 rounded-lg overflow-hidden">
            {dayNames.map((name) => (
              <div
                key={name}
                className="bg-gray-50 dark:bg-gray-800 p-2 text-center text-xs font-medium text-gray-500 dark:text-gray-400"
              >
                {name}
              </div>
            ))}
            {monthDays.map((day, i) => {
              if (day === null)
                return <div key={`e${i}`} className="bg-white dark:bg-gray-800 p-2 min-h-[80px]" />;
              const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
              const dayEvents = filteredEvents.filter(
                (e) => new Date(e.startAt).toDateString() === date.toDateString(),
              );
              const isToday = date.toDateString() === new Date().toDateString();
              return (
                <div
                  key={day}
                  className={`bg-white dark:bg-gray-800 p-1 min-h-[80px] ${isToday ? 'ring-2 ring-blue-500 ring-inset' : ''}`}
                >
                  <span
                    className={`text-xs font-medium ${isToday ? 'text-blue-600' : 'text-gray-700 dark:text-gray-300'}`}
                  >
                    {day}
                  </span>
                  <div className="space-y-0.5 mt-0.5">
                    {dayEvents.slice(0, 3).map((ev) => (
                      <button
                        key={ev.id}
                        onClick={() => onEventClick?.(ev)}
                        className="w-full text-left text-[10px] px-1 py-0.5 rounded truncate text-white"
                        style={{
                          backgroundColor: typeColor[ev.type || 'OUTRO'] ? undefined : '#6b7280',
                        }}
                      >
                        <span
                          className={
                            typeColor[ev.type || 'OUTRO']
                              ? 'inline-block w-1.5 h-1.5 rounded-full mr-0.5'
                              : ''
                          }
                        />
                        {ev.title}
                      </button>
                    ))}
                    {dayEvents.length > 3 && (
                      <span className="text-[10px] text-gray-400">+{dayEvents.length - 3}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {viewMode === 'week' && (
          <div className="grid grid-cols-7 gap-px bg-gray-200 dark:bg-gray-700 rounded-lg overflow-hidden">
            {Array.from({ length: 7 }).map((_, i) => {
              const start = new Date(currentDate);
              start.setDate(start.getDate() - start.getDay() + 1 + i);
              const dayEvents = filteredEvents.filter(
                (e) => new Date(e.startAt).toDateString() === start.toDateString(),
              );
              const isToday = start.toDateString() === new Date().toDateString();
              return (
                <div
                  key={i}
                  className={`bg-white dark:bg-gray-800 p-2 min-h-[120px] ${isToday ? 'ring-2 ring-blue-500 ring-inset' : ''}`}
                >
                  <div className="text-center mb-1">
                    <div className="text-xs text-gray-500">{dayNames[i]}</div>
                    <div
                      className={`text-lg font-bold ${isToday ? 'text-blue-600' : 'text-gray-700 dark:text-gray-300'}`}
                    >
                      {start.getDate()}
                    </div>
                  </div>
                  <div className="space-y-1">
                    {dayEvents.map((ev) => (
                      <button
                        key={ev.id}
                        onClick={() => onEventClick?.(ev)}
                        className="w-full text-left text-[10px] px-1 py-0.5 rounded truncate text-white"
                        style={{ backgroundColor: typeColor[ev.type || 'OUTRO'] || '#6b7280' }}
                      >
                        {ev.title}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {viewMode === 'day' && (
          <div className="space-y-1">
            {filteredEvents.length === 0 ? (
              <div className="text-center py-8 text-gray-400">Nenhum evento neste dia</div>
            ) : (
              filteredEvents
                .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())
                .map((ev) => (
                  <button
                    key={ev.id}
                    onClick={() => onEventClick?.(ev)}
                    className="w-full text-left p-3 rounded-lg border border-gray-100 dark:border-gray-700 hover:shadow-sm transition-shadow"
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-2 h-2 rounded-full ${typeColor[ev.type || 'OUTRO'] || 'bg-gray-500'}`}
                      />
                      <div>
                        <p className="text-sm font-medium text-gray-800 dark:text-gray-100">
                          {ev.title}
                        </p>
                        <p className="text-xs text-gray-500">
                          {new Date(ev.startAt).toLocaleTimeString('pt-BR', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                          {ev.endAt &&
                            ` — ${new Date(ev.endAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`}
                          {ev.assigneeName && ` • ${ev.assigneeName}`}
                        </p>
                      </div>
                    </div>
                  </button>
                ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
