'use client';

import React, { useState, useEffect } from 'react';
import { 
  Calendar, Plus, Clock, MapPin, Link as LinkIcon, 
  Users, Trash2, Edit2, ChevronLeft, ChevronRight,
  Globe, User as UserIcon, CalendarDays, Check, X
} from 'lucide-react';

/* ----------------------------- Components ----------------------------- */

const cn = (...classes: any[]) => classes.filter(Boolean).join(' ');

const EVENT_TYPES = [
  { value: 'REUNIAO', label: 'Reunião', color: 'blue' },
  { value: 'REUNIAO_ONLINE', label: 'Reunião Online', color: 'purple' },
  { value: 'PLANTAO', label: 'Plantão', color: 'amber' },
  { value: 'FERIADO', label: 'Feriado', color: 'red' },
  { value: 'LEMBRETE', label: 'Lembrete', color: 'emerald' },
  { value: 'OUTRO', label: 'Outro', color: 'slate' },
];

export const CalendarManageViewModule = ({ dark }: { dark: boolean }) => {
  const [events, setEvents] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [viewDate, setViewDate] = useState(new Date());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<any>(null);
  const [formData, setFormData] = useState({
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
    color: '#3b82f6'
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const startOfMonth = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1);
      const endOfMonth = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0, 23, 59, 59);

      const [evRes, usrRes] = await Promise.all([
        fetch(`/api/calendar/events/all?from=${encodeURIComponent(startOfMonth.toISOString())}&to=${encodeURIComponent(endOfMonth.toISOString())}`),
        fetch('/api/calendar/users')
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

  const resetForm = (event: any = null, initialDate: Date | null = null) => {
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
        color: event.color || '#3b82f6'
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
        color: '#3b82f6'
      });
      setEditingEvent(null);
    }
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const method = editingEvent ? 'PATCH' : 'POST';
    const url = editingEvent ? `/api/calendar/events/${editingEvent.id}` : '/api/calendar/events';

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          // If global, ensure assignee is null
          assigneeId: formData.isGlobal ? null : formData.assigneeId
        })
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
    if (!confirm('Deseja excluir este evento?')) return;
    try {
      const res = await fetch(`/api/calendar/events/${id}`, { method: 'DELETE' });
      if (res.ok) loadData();
    } catch (error) {
      console.error('Failed to delete event', error);
    }
  };

  const getEventStyle = (type: string) => {
    const found = EVENT_TYPES.find(t => t.value === type);
    const color = found ? found.color : 'slate';
    
    const colors: Record<string, string> = {
      blue: dark ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' : 'bg-blue-50 text-blue-700 border-blue-200',
      purple: dark ? 'bg-purple-500/20 text-purple-400 border-purple-500/30' : 'bg-purple-50 text-purple-700 border-purple-200',
      amber: dark ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' : 'bg-amber-50 text-amber-700 border-amber-200',
      red: dark ? 'bg-red-500/20 text-red-400 border-red-500/30' : 'bg-red-50 text-red-700 border-red-200',
      emerald: dark ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-emerald-50 text-emerald-700 border-emerald-200',
      slate: dark ? 'bg-slate-500/20 text-slate-400 border-slate-500/30' : 'bg-slate-50 text-slate-700 border-slate-200',
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

  return (
    <div className="space-y-6 h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className={cn("text-2xl font-bold", dark ? "text-slate-100" : "text-slate-900")}>Gestão do Calendário</h2>
          <p className={cn("text-sm", dark ? "text-slate-400" : "text-slate-500")}>Agende reuniões, plantões e eventos para a equipe</p>
        </div>
        <button
          onClick={() => resetForm()}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold transition-colors shadow-lg shadow-blue-600/20"
        >
          <Plus size={18} />
          Novo Evento
        </button>
      </div>

      {/* Main Content */}
      <div className={cn(
        "flex-1 border rounded-2xl overflow-hidden flex flex-col min-h-[700px]",
        dark ? "bg-[#1e293b]/60 backdrop-blur-md border-slate-700/50" : "bg-white border-slate-200 shadow-sm"
      )}>
        {/* Calendar Nav */}
        <div className={cn(
            "px-6 py-4 border-b flex items-center justify-between",
            dark ? "bg-white/[0.02] border-slate-700/50 text-slate-200" : "bg-slate-50/50 border-slate-100 text-slate-700"
        )}>
          <div className="flex items-center gap-4">
            <h3 className="text-lg font-bold min-w-[180px]">
              {viewDate.toLocaleString('pt-BR', { month: 'long', year: 'numeric' }).replace(/^\w/, c => c.toUpperCase())}
            </h3>
            <div className="flex gap-1">
              <button 
                onClick={() => changeMonth(-1)}
                className={cn("p-2 rounded-lg transition-colors", dark ? "hover:bg-white/5" : "hover:bg-slate-100")}
              >
                <ChevronLeft size={20} />
              </button>
              <button 
                onClick={() => setViewDate(new Date())}
                className={cn("px-3 py-1 text-xs font-bold rounded-lg transition-colors", dark ? "hover:bg-white/5" : "hover:bg-slate-100")}
              >
                Hoje
              </button>
              <button 
                onClick={() => changeMonth(1)}
                className={cn("p-2 rounded-lg transition-colors", dark ? "hover:bg-white/5" : "hover:bg-slate-100")}
              >
                <ChevronRight size={20} />
              </button>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <CalendarDays size={18} className="text-blue-500" />
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{events.length} Eventos</span>
          </div>
        </div>

        <div className="flex-1 flex flex-col bg-transparent">
          {/* Week Headers */}
          <div className={cn(
            "grid grid-cols-7 border-b text-center py-2 text-[10px] font-bold uppercase tracking-widest",
            dark ? "bg-black/20 border-slate-700/30 text-slate-500" : "bg-slate-50/50 border-slate-100 text-slate-400"
          )}>
            {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(d => <div key={d}>{d}</div>)}
          </div>

          {/* Grid */}
          <div className="flex-1 grid grid-cols-7 grid-rows-6">
            {gridDays.map((day, idx) => {
              const dayStr = day.date.toISOString().split('T')[0];
              const dayEvents = events.filter(e => e.startAt.startsWith(dayStr));
              const isToday = new Date().toISOString().split('T')[0] === dayStr;
              
              return (
                <div 
                  key={idx}
                  onClick={() => resetForm(null, day.date)}
                  className={cn(
                    "border-r border-b min-h-[110px] p-2 transition-all cursor-pointer relative group",
                    dark ? "border-slate-700/30 hover:bg-blue-500/[0.03]" : "border-slate-100 hover:bg-blue-50/30",
                    !day.isCurrent && "opacity-30",
                    isToday && (dark ? "bg-blue-500/5" : "bg-blue-50/50")
                  )}
                >
                  <div className="flex justify-between items-start mb-1">
                    <span className={cn(
                      "text-xs font-mono font-bold w-6 h-6 flex items-center justify-center rounded-full",
                      isToday 
                        ? "bg-blue-600 text-white" 
                        : (dark ? "text-slate-400" : "text-slate-500")
                    )}>
                      {day.date.getDate()}
                    </span>
                    <Plus size={12} className="text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>

                  <div className="space-y-1 overflow-hidden">
                    {dayEvents.slice(0, 3).map(event => (
                      <div 
                        key={event.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          resetForm(event);
                        }}
                        className={cn(
                          "px-1.5 py-0.5 rounded text-[10px] font-medium truncate border transition-transform hover:scale-[1.02]",
                          getEventStyle(event.type)
                        )}
                      >
                        {event.title}
                      </div>
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
        </div>
      </div>

      {/* Event Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsModalOpen(false)}></div>
          <div className={cn(
            "relative w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200",
            dark ? "bg-[#1e293b] border border-slate-700/50" : "bg-white border border-slate-200"
          )}>
            <div className={cn("px-6 py-4 border-b flex items-center justify-between", dark ? "border-slate-700/50" : "border-slate-100")}>
              <h3 className={cn("font-bold text-lg", dark ? "text-slate-100" : "text-slate-800")}>
                {editingEvent ? 'Editar Evento' : 'Novo Evento'}
              </h3>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="p-2 hover:bg-slate-500/10 rounded-full transition-colors"
              >
                <X size={20} className="text-slate-400" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto custom-scrollbar">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2 space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase">Título</label>
                  <input
                    required
                    type="text"
                    value={formData.title}
                    onChange={e => setFormData({...formData, title: e.target.value})}
                    placeholder="Ex: Reunião Semanal de Alinhamento"
                    className={cn(
                      "w-full px-4 py-2 rounded-xl outline-none border transition-all focus:ring-2 focus:ring-blue-500/20",
                      dark ? "bg-[#0f172a] border-slate-700 text-slate-100 focus:border-blue-500/50" : "bg-white border-slate-200 text-slate-800 focus:border-blue-300 shadow-sm"
                    )}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase">Tipo</label>
                  <select
                    value={formData.type}
                    onChange={e => setFormData({...formData, type: e.target.value})}
                    className={cn(
                      "w-full px-4 py-2 rounded-xl outline-none border transition-all",
                      dark ? "bg-[#0f172a] border-slate-700 text-slate-100" : "bg-white border-slate-200 text-slate-800 shadow-sm"
                    )}
                  >
                    {EVENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase">Visibilidade</label>
                  <div className="flex bg-slate-500/5 rounded-xl p-1 gap-1">
                    <button
                      type="button"
                      onClick={() => setFormData({...formData, isGlobal: false})}
                      className={cn(
                        "flex-1 py-1.5 text-xs font-bold rounded-lg transition-all",
                        !formData.isGlobal ? (dark ? "bg-blue-600 text-white" : "bg-white text-blue-600 shadow-sm") : "text-slate-500"
                      )}
                    >
                      Individual
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({...formData, isGlobal: true})}
                      className={cn(
                        "flex-1 py-1.5 text-xs font-bold rounded-lg transition-all",
                        formData.isGlobal ? (dark ? "bg-blue-600 text-white" : "bg-white text-blue-600 shadow-sm") : "text-slate-500"
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
                      onChange={e => setFormData({...formData, assigneeId: e.target.value})}
                      className={cn(
                        "w-full px-4 py-2 rounded-xl outline-none border transition-all",
                        dark ? "bg-[#0f172a] border-slate-700 text-slate-100" : "bg-white border-slate-200 text-slate-800 shadow-sm"
                      )}
                    >
                      <option value="">Selecione um analista...</option>
                      {users.map(u => <option key={u.id} value={u.id}>{u.name} ({u.role})</option>)}
                    </select>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase">Início</label>
                  <input
                    required
                    type="datetime-local"
                    value={formData.startAt}
                    onChange={e => setFormData({...formData, startAt: e.target.value})}
                    className={cn(
                      "w-full px-4 py-2 rounded-xl outline-none border transition-all",
                      dark ? "bg-[#0f172a] border-slate-700 text-slate-100" : "bg-white border-slate-200 text-slate-800 shadow-sm"
                    )}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase">Fim (Opcional)</label>
                  <input
                    type="datetime-local"
                    value={formData.endAt}
                    onChange={e => setFormData({...formData, endAt: e.target.value})}
                    className={cn(
                      "w-full px-4 py-2 rounded-xl outline-none border transition-all",
                      dark ? "bg-[#0f172a] border-slate-700 text-slate-100" : "bg-white border-slate-200 text-slate-800 shadow-sm"
                    )}
                  />
                </div>

                {formData.type === 'REUNIAO_ONLINE' && (
                  <div className="md:col-span-2 space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase">Link da Reunião</label>
                    <input
                      type="url"
                      value={formData.meetingLink}
                      onChange={e => setFormData({...formData, meetingLink: e.target.value})}
                      placeholder="https://meet.google.com/..."
                      className={cn(
                        "w-full px-4 py-2 rounded-xl outline-none border transition-all",
                        dark ? "bg-[#0f172a] border-slate-700 text-slate-100" : "bg-white border-slate-200 text-slate-800 shadow-sm"
                      )}
                    />
                  </div>
                )}

                <div className="md:col-span-2 space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase">Localização / Observação</label>
                  <input
                    type="text"
                    value={formData.location}
                    onChange={e => setFormData({...formData, location: e.target.value})}
                    placeholder="Ex: Sala de Reunião 1 ou Remoto"
                    className={cn(
                      "w-full px-4 py-2 rounded-xl outline-none border transition-all",
                      dark ? "bg-[#0f172a] border-slate-700 text-slate-100" : "bg-white border-slate-200 text-slate-800 shadow-sm"
                    )}
                  />
                </div>

                <div className="md:col-span-2 space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase">Descrição</label>
                  <textarea
                    rows={3}
                    value={formData.description}
                    onChange={e => setFormData({...formData, description: e.target.value})}
                    placeholder="Detalhes sobre o evento..."
                    className={cn(
                      "w-full px-4 py-2 rounded-xl outline-none border transition-all resize-none",
                      dark ? "bg-[#0f172a] border-slate-700 text-slate-100" : "bg-white border-slate-200 text-slate-800 shadow-sm"
                    )}
                  ></textarea>
                </div>
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className={cn(
                    "flex-1 py-2.5 rounded-xl font-bold transition-all border",
                    dark ? "border-slate-700 text-slate-400 hover:bg-white/5" : "border-slate-200 text-slate-500 hover:bg-slate-50"
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
