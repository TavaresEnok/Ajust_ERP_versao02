'use client';
import React, { useEffect, useState } from 'react';
import { Phone, Plus, Trash2, RefreshCw, User, Clock, CheckCircle, AlertCircle } from 'lucide-react';

const cn = (...c: any[]) => c.filter(Boolean).join(' ');

const fmtDateTime = (d: string) => new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });

export function OnCallScheduleView({ dark, tenantId, onToast }: { dark: boolean; tenantId: string; onToast: (m: string) => void }) {
  const [schedules, setSchedules] = useState<any[]>([]);
  const [current, setCurrent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ userId: '', startsAt: '', endsAt: '', notes: '' });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [schedRes, curRes] = await Promise.all([
        fetch(`/api/on-call?tenantId=${encodeURIComponent(tenantId)}`, { cache: 'no-store' }),
        fetch(`/api/on-call/current?tenantId=${encodeURIComponent(tenantId)}`, { cache: 'no-store' }),
      ]);
      if (schedRes.ok) setSchedules(await schedRes.json());
      if (curRes.ok) { const data = await curRes.json(); setCurrent(data); }
    } catch { onToast('Falha ao carregar escalas.'); }
    finally { setLoading(false); }
  };

  const loadUsers = async () => {
    try {
      const res = await fetch(`/api/iam/users?tenantId=${encodeURIComponent(tenantId)}`, { cache: 'no-store' });
      if (res.ok) setUsers(await res.json());
    } catch {}
  };

  useEffect(() => { if (tenantId) { load(); loadUsers(); } }, [tenantId]);

  const save = async () => {
    if (!form.userId || !form.startsAt || !form.endsAt) { onToast('Preencha todos os campos.'); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/on-call', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...form, tenantId }),
      });
      if (!res.ok) throw new Error('Falha ao criar escala.');
      onToast('Escala criada!'); setShowForm(false);
      setForm({ userId: '', startsAt: '', endsAt: '', notes: '' }); load();
    } catch (e: any) { onToast(e.message); }
    finally { setSaving(false); }
  };

  const remove = async (id: string) => {
    if (!confirm('Remover esta escala?')) return;
    await fetch(`/api/on-call/${id}?tenantId=${tenantId}`, { method: 'DELETE' });
    onToast('Escala removida.'); load();
  };

  const inputCls = cn('w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40', dark ? 'bg-slate-900 border-slate-700 text-slate-200 placeholder-slate-500' : 'bg-white border-slate-300 text-slate-800');
  const now = new Date();

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className={cn('text-2xl font-bold', dark ? 'text-white' : 'text-slate-800')}>Escala de Plantão (On-Call)</h2>
          <p className={cn('text-sm mt-0.5', dark ? 'text-slate-400' : 'text-slate-500')}>Quem está de plantão agora? Configure a rotação de analistas para alertas críticos.</p>
        </div>
        <button onClick={() => setShowForm(true)} className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-sm font-semibold shadow-lg shadow-violet-500/20 transition-colors">
          <Plus size={16} /> Nova Escala
        </button>
      </div>

      {/* Current On-Call Banner */}
      <div className={cn('rounded-xl border-2 p-5 flex items-center gap-4', current ? (dark ? 'bg-emerald-900/20 border-emerald-500/40' : 'bg-emerald-50 border-emerald-300') : (dark ? 'bg-slate-800/40 border-slate-700/50' : 'bg-slate-50 border-slate-200'))}>
        <div className={cn('w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0', current ? 'bg-emerald-500/20 text-emerald-400' : (dark ? 'bg-slate-700 text-slate-500' : 'bg-slate-200 text-slate-400'))}>
          {current ? <CheckCircle size={24} /> : <AlertCircle size={24} />}
        </div>
        <div>
          <p className={cn('text-xs font-bold uppercase tracking-wider mb-0.5', current ? 'text-emerald-500' : (dark ? 'text-slate-500' : 'text-slate-400'))}>Plantão Atual</p>
          {current ? (
            <>
              <p className={cn('text-xl font-bold', dark ? 'text-white' : 'text-slate-800')}>{current.user?.name}</p>
              <p className={cn('text-xs', dark ? 'text-slate-400' : 'text-slate-500')}>Até {fmtDateTime(current.endsAt)}</p>
            </>
          ) : (
            <p className={cn('text-lg font-semibold', dark ? 'text-slate-500' : 'text-slate-400')}>Nenhum analista em plantão agora.</p>
          )}
        </div>
      </div>

      {/* Schedules List */}
      <div className={cn('rounded-xl border overflow-hidden', dark ? 'bg-slate-800/40 border-slate-700/50' : 'bg-white border-slate-200')}>
        <div className={cn('px-5 py-3 border-b text-xs font-bold uppercase tracking-wider', dark ? 'border-slate-700 text-slate-500 bg-slate-800/60' : 'border-slate-100 text-slate-400 bg-slate-50')}>
          Todas as Escalas
        </div>
        {loading ? (
          <div className="px-5 py-10 text-center text-sm text-slate-400">Carregando...</div>
        ) : schedules.length === 0 ? (
          <div className="px-5 py-14 text-center">
            <Phone size={32} className={cn('mx-auto mb-2', dark ? 'text-slate-600' : 'text-slate-300')} />
            <p className={cn('text-sm', dark ? 'text-slate-500' : 'text-slate-400')}>Nenhuma escala cadastrada.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-700/30">
            {schedules.map(s => {
              const isActive = new Date(s.startsAt) <= now && new Date(s.endsAt) >= now;
              const isPast = new Date(s.endsAt) < now;
              return (
                <div key={s.id} className={cn('px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-3 transition-colors', isActive ? (dark ? 'bg-emerald-900/10' : 'bg-emerald-50/50') : '')}>
                  <div className={cn('w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0', isActive ? 'bg-emerald-500/20 text-emerald-400' : isPast ? (dark ? 'bg-slate-700 text-slate-500' : 'bg-slate-100 text-slate-400') : (dark ? 'bg-blue-900/20 text-blue-400' : 'bg-blue-50 text-blue-500'))}>
                    <User size={15} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={cn('font-semibold text-sm', dark ? 'text-white' : 'text-slate-800')}>{s.user?.name}</span>
                      {isActive && <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold border border-emerald-500/30">● ATIVO</span>}
                      {isPast && <span className={cn('text-[10px] font-bold', dark ? 'text-slate-600' : 'text-slate-300')}>Encerrado</span>}
                    </div>
                    <p className={cn('text-xs mt-0.5 flex items-center gap-1', dark ? 'text-slate-400' : 'text-slate-500')}>
                      <Clock size={11} /> {fmtDateTime(s.startsAt)} → {fmtDateTime(s.endsAt)}
                    </p>
                    {s.notes && <p className={cn('text-xs mt-0.5 italic', dark ? 'text-slate-500' : 'text-slate-400')}>{s.notes}</p>}
                  </div>
                  <button onClick={() => remove(s.id)} className="text-rose-400 hover:text-rose-300 p-1.5 rounded-lg hover:bg-rose-500/10 transition-colors">
                    <Trash2 size={14} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowForm(false)} />
          <div className={cn('relative w-full max-w-md rounded-2xl border shadow-2xl', dark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200')}>
            <div className={cn('px-6 py-4 border-b flex items-center justify-between', dark ? 'border-slate-800' : 'border-slate-100')}>
              <h3 className={cn('font-bold text-lg', dark ? 'text-white' : 'text-slate-800')}>Nova Escala de Plantão</h3>
              <button onClick={() => setShowForm(false)} className={cn('p-1.5 rounded', dark ? 'text-slate-400 hover:bg-slate-800' : 'text-slate-400 hover:bg-slate-100')}>✕</button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className={cn('block text-xs font-semibold mb-1.5', dark ? 'text-slate-400' : 'text-slate-600')}>Analista *</label>
                <select value={form.userId} onChange={e => setForm({ ...form, userId: e.target.value })} className={cn(inputCls, 'cursor-pointer')}>
                  <option value="">Selecione...</option>
                  {users.map((u: any) => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
              <div><label className={cn('block text-xs font-semibold mb-1.5', dark ? 'text-slate-400' : 'text-slate-600')}>Início do Plantão *</label><input type="datetime-local" value={form.startsAt} onChange={e => setForm({ ...form, startsAt: e.target.value })} className={inputCls} /></div>
              <div><label className={cn('block text-xs font-semibold mb-1.5', dark ? 'text-slate-400' : 'text-slate-600')}>Fim do Plantão *</label><input type="datetime-local" value={form.endsAt} onChange={e => setForm({ ...form, endsAt: e.target.value })} className={inputCls} /></div>
              <div><label className={cn('block text-xs font-semibold mb-1.5', dark ? 'text-slate-400' : 'text-slate-600')}>Observações</label><input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Ex: Plantão noturno — NOC N2" className={inputCls} /></div>
            </div>
            <div className={cn('px-6 py-4 border-t flex justify-end gap-3', dark ? 'border-slate-800' : 'border-slate-100')}>
              <button onClick={() => setShowForm(false)} className={cn('px-4 py-2 rounded-lg text-sm border', dark ? 'border-slate-700 text-slate-400' : 'border-slate-200 text-slate-600')}>Cancelar</button>
              <button onClick={save} disabled={saving} className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-sm font-semibold disabled:opacity-60 flex items-center gap-2">
                {saving && <RefreshCw size={14} className="animate-spin" />} Criar Escala
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
