'use client';

import React, { useEffect, useState } from 'react';
import {
  CalendarClock,
  UserCheck,
  Plus,
  RefreshCw,
  Trash2,
  Clock,
  CheckCircle2,
  AlertCircle,
  Calendar,
  X,
  PhoneCall,
  Shield,
  User,
} from 'lucide-react';

export type OnCallEntry = {
  id: string;
  userId: string;
  startsAt: string;
  endsAt: string;
  notes?: string | null;
  user: {
    id: string;
    name: string;
  };
};

type UserOption = {
  id: string;
  name: string;
  email: string;
  role?: string;
};

type Props = {
  dark?: boolean;
  tenantId?: string;
  onToast?: (msg: string) => void;
};

export function OnCallView({ dark = false, tenantId, onToast }: Props) {
  const [schedules, setSchedules] = useState<OnCallEntry[]>([]);
  const [currentOnCall, setCurrentOnCall] = useState<OnCallEntry | null>(null);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [loading, setLoading] = useState(true);

  // New On-call modal
  const [showModal, setShowModal] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [schedRes, currentRes, usersRes] = await Promise.all([
        fetch('/api/on-call', { cache: 'no-store' }),
        fetch('/api/on-call/current', { cache: 'no-store' }),
        fetch(tenantId ? `/api/iam/users?tenantId=${encodeURIComponent(tenantId)}` : '/api/iam/users', {
          cache: 'no-store',
        }),
      ]);

      if (schedRes.ok) {
        const data = await schedRes.json();
        setSchedules(Array.isArray(data) ? data : []);
      }
      if (currentRes.ok) {
        const cur = await currentRes.json();
        setCurrentOnCall(cur && cur.id ? cur : null);
      }
      if (usersRes.ok) {
        const u = await usersRes.json();
        const list: UserOption[] = Array.isArray(u) ? u : [];
        setUsers(list);
        if (list.length > 0 && !selectedUserId) {
          setSelectedUserId(list[0].id);
        }
      }
    } catch (err: any) {
      onToast?.(err.message || 'Erro ao carregar escala de plantão');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [tenantId]);

  const handleCreateSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserId || !startsAt || !endsAt) {
      alert('Preencha o técnico e os horários de início e término.');
      return;
    }

    const startDate = new Date(startsAt);
    const endDate = new Date(endsAt);

    if (endDate <= startDate) {
      alert('A data de término deve ser posterior ao início.');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/on-call', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          userId: selectedUserId,
          startsAt: startDate.toISOString(),
          endsAt: endDate.toISOString(),
          notes: notes.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Falha ao agendar plantão');
      }

      onToast?.('Plantão agendado na escala com sucesso!');
      setShowModal(false);
      setStartsAt('');
      setEndsAt('');
      setNotes('');
      loadData();
    } catch (err: any) {
      alert(err.message || 'Erro ao agendar plantão');
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (id: string) => {
    if (!confirm('Deseja realmente remover este plantão da escala?')) return;
    try {
      const res = await fetch(`/api/on-call/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Falha ao remover plantão');
      }
      onToast?.('Plantão removido da escala');
      setSchedules((prev) => prev.filter((s) => s.id !== id));
      if (currentOnCall?.id === id) {
        setCurrentOnCall(null);
      }
    } catch (err: any) {
      alert(err.message || 'Erro ao remover');
    }
  };

  const formatDateTime = (iso: string) => {
    try {
      return new Date(iso).toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return iso;
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto p-4 md:p-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <CalendarClock className="w-7 h-7 text-emerald-500" />
            <h1 className="text-2xl font-bold tracking-tight">Escala de Plantão NOC (On-Call)</h1>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Gestão de plantonistas para noites, finais de semana e feriados. Roteamento automático de alertas críticos de SLA.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
              dark
                ? 'border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700'
                : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </button>

          <button
            type="button"
            onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4" />
            Agendar Plantão
          </button>
        </div>
      </div>

      {/* Active On-Call Highlight Banner */}
      <div
        className={`p-6 rounded-2xl border transition-all ${
          currentOnCall
            ? dark
              ? 'bg-gradient-to-r from-emerald-950/40 via-slate-900 to-slate-900 border-emerald-500/40'
              : 'bg-gradient-to-r from-emerald-50 via-white to-white border-emerald-300 shadow-sm'
            : dark
            ? 'bg-slate-900/60 border-slate-800'
            : 'bg-slate-50 border-slate-200'
        }`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div
              className={`p-3.5 rounded-2xl ${
                currentOnCall
                  ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20'
                  : 'bg-slate-200 dark:bg-slate-800 text-slate-400'
              }`}
            >
              <PhoneCall className="w-6 h-6" />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                  {currentOnCall ? 'Plantonista Ativo no Momento' : 'Sem Plantão Ativo'}
                </span>
                {currentOnCall && (
                  <span className="flex h-2 w-2 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                )}
              </div>

              <h2 className="text-xl font-bold mt-0.5">
                {currentOnCall ? currentOnCall.user.name : 'Nenhum técnico escalado para este horário'}
              </h2>

              {currentOnCall ? (
                <div className="flex items-center gap-3 mt-1 text-xs text-slate-500 dark:text-slate-400">
                  <span className="flex items-center gap-1 font-mono">
                    <Clock className="w-3.5 h-3.5 text-emerald-500" />
                    Turno: {formatDateTime(currentOnCall.startsAt)} até {formatDateTime(currentOnCall.endsAt)}
                  </span>
                  {currentOnCall.notes && (
                    <span className="truncate max-w-md italic">
                      • {currentOnCall.notes}
                    </span>
                  )}
                </div>
              ) : (
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Os atendimentos de emergência e alertas de SLA serão direcionados à equipe geral.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Schedule Table / List */}
      <div
        className={`rounded-2xl border overflow-hidden ${
          dark ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
        }`}
      >
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <h3 className="font-bold text-sm text-slate-800 dark:text-slate-200 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-emerald-500" />
            Próximos Plantões Cadastrados ({schedules.length})
          </h3>
        </div>

        {loading ? (
          <div className="p-12 text-center text-sm text-slate-500">Carregando escala...</div>
        ) : schedules.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            Nenhum plantão agendado na escala. Clique em &quot;Agendar Plantão&quot; para incluir um novo turno.
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {schedules.map((entry) => {
              const now = new Date();
              const isCurrent = new Date(entry.startsAt) <= now && new Date(entry.endsAt) >= now;
              const isPast = new Date(entry.endsAt) < now;

              return (
                <div
                  key={entry.id}
                  className={`p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors ${
                    isCurrent
                      ? dark
                        ? 'bg-emerald-950/20'
                        : 'bg-emerald-50/60'
                      : isPast
                      ? 'opacity-60'
                      : 'hover:bg-slate-50/50 dark:hover:bg-slate-800/30'
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div
                      className={`p-2.5 rounded-xl ${
                        isCurrent
                          ? 'bg-emerald-500/10 text-emerald-500'
                          : dark
                          ? 'bg-slate-800 text-slate-300'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      <User className="w-5 h-5" />
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-base">{entry.user.name}</span>
                        {isCurrent && (
                          <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                            Em Andamento
                          </span>
                        )}
                        {isPast && (
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium text-slate-400 border border-slate-300 dark:border-slate-700">
                            Concluído
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-4 mt-1 text-xs text-slate-500 dark:text-slate-400 flex-wrap">
                        <span className="flex items-center gap-1 font-mono">
                          <Clock className="w-3.5 h-3.5" />
                          {formatDateTime(entry.startsAt)} → {formatDateTime(entry.endsAt)}
                        </span>
                        {entry.notes && (
                          <span className="italic text-slate-600 dark:text-slate-300">
                            {entry.notes}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center">
                    <button
                      type="button"
                      onClick={() => handleRemove(entry.id)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Remover
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal: Add to On-Call Schedule */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div
            className={`w-full max-w-lg rounded-2xl shadow-2xl border overflow-hidden flex flex-col ${
              dark ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
            }`}
          >
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h3 className="font-bold text-lg flex items-center gap-2">
                <CalendarClock className="w-5 h-5 text-emerald-500" />
                Agendar Novo Plantão Técnico
              </h3>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSchedule} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold mb-1 text-slate-700 dark:text-slate-300">
                  Técnico / Analista de Plantão *
                </label>
                <select
                  required
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  className={`w-full text-sm px-3 py-2 rounded-lg border ${
                    dark ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-slate-50 border-slate-300'
                  }`}
                >
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.email})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold mb-1 text-slate-700 dark:text-slate-300">
                    Data & Hora de Início *
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={startsAt}
                    onChange={(e) => setStartsAt(e.target.value)}
                    className={`w-full text-sm px-3 py-2 rounded-lg border ${
                      dark ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-slate-50 border-slate-300'
                    }`}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1 text-slate-700 dark:text-slate-300">
                    Data & Hora de Término *
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={endsAt}
                    onChange={(e) => setEndsAt(e.target.value)}
                    className={`w-full text-sm px-3 py-2 rounded-lg border ${
                      dark ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-slate-50 border-slate-300'
                    }`}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1 text-slate-700 dark:text-slate-300">
                  Observações / Turno (opcional)
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ex: Plantão fim de semana - BGP e Rompimentos"
                  className={`w-full text-sm px-3 py-2 rounded-lg border ${
                    dark ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-slate-50 border-slate-300'
                  }`}
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-lg text-sm font-medium border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 rounded-lg text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm transition-colors disabled:opacity-50"
                >
                  {saving ? 'Agendando...' : 'Confirmar Plantão'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
