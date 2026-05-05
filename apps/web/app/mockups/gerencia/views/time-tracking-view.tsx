'use client';
import React, { useEffect, useState, useMemo } from 'react';
import { Clock, Plus, Trash2, RefreshCw, DollarSign, Timer, User, TrendingUp, Search } from 'lucide-react';

const cn = (...c: any[]) => c.filter(Boolean).join(' ');

const fmtMin = (m: number) => {
  const h = Math.floor(m / 60);
  const min = m % 60;
  return h > 0 ? `${h}h ${min}min` : `${min}min`;
};

export function TimeTrackingView({ dark, tenantId, onToast }: { dark: boolean; tenantId: string; onToast: (m: string) => void }) {
  const [entries, setEntries] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ orderId: '', minutes: '60', description: '', billable: true });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [entriesRes, summaryRes] = await Promise.all([
        fetch(`/api/time-entries?tenantId=${encodeURIComponent(tenantId)}`, { cache: 'no-store' }),
        fetch(`/api/time-entries/summary?tenantId=${encodeURIComponent(tenantId)}`, { cache: 'no-store' }),
      ]);
      if (entriesRes.ok) setEntries(await entriesRes.json());
      if (summaryRes.ok) setSummary(await summaryRes.json());
    } catch { onToast('Falha ao carregar entradas de tempo.'); }
    finally { setLoading(false); }
  };

  useEffect(() => { if (tenantId) load(); }, [tenantId]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return entries.filter(e =>
      !q ||
      (e.order?.protocol || '').toLowerCase().includes(q) ||
      (e.user?.name || '').toLowerCase().includes(q) ||
      (e.description || '').toLowerCase().includes(q)
    );
  }, [entries, search]);

  const save = async () => {
    if (!form.orderId.trim()) { onToast('Protocolo da O.S é obrigatório.'); return; }
    const minutes = parseInt(form.minutes);
    if (isNaN(minutes) || minutes < 1) { onToast('Tempo mínimo: 1 minuto.'); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/time-entries', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...form, minutes, tenantId }),
      });
      if (!res.ok) throw new Error('Falha ao registrar tempo.');
      onToast('Tempo registrado!');
      setShowForm(false);
      setForm({ orderId: '', minutes: '60', description: '', billable: true });
      load();
    } catch (e: any) { onToast(e.message); }
    finally { setSaving(false); }
  };

  const remove = async (id: string) => {
    if (!confirm('Remover esta entrada?')) return;
    await fetch(`/api/time-entries/${id}?tenantId=${tenantId}`, { method: 'DELETE' });
    onToast('Entrada removida.'); load();
  };

  const inputCls = cn('w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40', dark ? 'bg-slate-900 border-slate-700 text-slate-200 placeholder-slate-500' : 'bg-white border-slate-300 text-slate-800');

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className={cn('text-2xl font-bold', dark ? 'text-white' : 'text-slate-800')}>Time Tracking — Horas por O.S</h2>
          <p className={cn('text-sm mt-0.5', dark ? 'text-slate-400' : 'text-slate-500')}>Registre e acompanhe horas trabalhadas por ordem de serviço.</p>
        </div>
        <button onClick={() => setShowForm(true)} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-semibold shadow-lg shadow-emerald-500/20 transition-colors">
          <Plus size={16} /> Registrar Tempo
        </button>
      </div>

      {/* KPIs */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { icon: Timer, label: 'Total Trabalhado', value: fmtMin(summary.totalMinutes || 0), color: dark ? 'text-blue-400' : 'text-blue-600' },
            { icon: DollarSign, label: 'Horas Cobráveis', value: fmtMin(summary.billableMinutes || 0), color: 'text-emerald-400' },
            { icon: User, label: 'Analistas', value: String((summary.byUser || []).length), color: dark ? 'text-purple-400' : 'text-purple-600' },
            { icon: TrendingUp, label: 'Registros', value: String(entries.length), color: dark ? 'text-amber-400' : 'text-amber-600' },
          ].map(kpi => (
            <div key={kpi.label} className={cn('rounded-xl border p-4 flex items-center gap-3', dark ? 'bg-slate-800/40 border-slate-700/50' : 'bg-white border-slate-200')}>
              <div className={cn('p-2 rounded-lg', dark ? 'bg-slate-700/50' : 'bg-slate-50')}>
                <kpi.icon size={18} className={kpi.color} />
              </div>
              <div>
                <p className={cn('text-[10px] uppercase font-bold tracking-wider', dark ? 'text-slate-500' : 'text-slate-400')}>{kpi.label}</p>
                <p className={cn('text-lg font-bold', kpi.color)}>{kpi.value}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Por Analista */}
      {summary?.byUser?.length > 0 && (
        <div className={cn('rounded-xl border p-5', dark ? 'bg-slate-800/40 border-slate-700/50' : 'bg-white border-slate-200')}>
          <h3 className={cn('text-sm font-bold mb-3', dark ? 'text-slate-300' : 'text-slate-700')}>Ranking por Analista</h3>
          <div className="space-y-2">
            {[...summary.byUser].sort((a: any, b: any) => b.minutes - a.minutes).map((u: any) => {
              const pct = summary.totalMinutes > 0 ? (u.minutes / summary.totalMinutes) * 100 : 0;
              return (
                <div key={u.id} className="flex items-center gap-3">
                  <span className={cn('text-xs font-medium w-28 truncate', dark ? 'text-slate-300' : 'text-slate-700')}>{u.name}</span>
                  <div className={cn('flex-1 rounded-full h-2 overflow-hidden', dark ? 'bg-slate-700' : 'bg-slate-100')}>
                    <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                  </div>
                  <span className={cn('text-xs font-mono w-20 text-right', dark ? 'text-slate-400' : 'text-slate-500')}>{fmtMin(u.minutes)}</span>
                  <span className={cn('text-xs w-16 text-right', 'text-emerald-500')}>{fmtMin(u.billable)} 💰</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Filters + Table */}
      <div className={cn('flex items-center gap-3 p-3 rounded-xl border', dark ? 'bg-slate-800/40 border-slate-700/50' : 'bg-white border-slate-200')}>
        <div className="relative flex-1">
          <Search size={13} className={cn('absolute left-3 top-1/2 -translate-y-1/2', dark ? 'text-slate-500' : 'text-slate-400')} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por O.S, analista ou descrição..." className={cn(inputCls, 'pl-8')} />
        </div>
        <button onClick={load} className={cn('px-3 py-2 rounded-lg border text-sm flex items-center gap-1', dark ? 'border-slate-700 text-slate-400 hover:bg-slate-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50')}>
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className={cn('rounded-xl border overflow-hidden', dark ? 'bg-slate-800/40 border-slate-700/50' : 'bg-white border-slate-200')}>
        <table className="w-full text-sm">
          <thead>
            <tr className={cn('border-b text-xs uppercase font-bold tracking-wider', dark ? 'border-slate-700 text-slate-500 bg-slate-800/60' : 'border-slate-100 text-slate-400 bg-slate-50')}>
              <th className="px-4 py-3 text-left">O.S</th>
              <th className="px-4 py-3 text-left">Analista</th>
              <th className="px-4 py-3 text-left">Descrição</th>
              <th className="px-4 py-3 text-right">Tempo</th>
              <th className="px-4 py-3 text-center">Cobrável</th>
              <th className="px-4 py-3 text-left">Data</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className={cn('divide-y', dark ? 'divide-slate-700/50' : 'divide-slate-100')}>
            {loading ? (
              <tr><td colSpan={7} className={cn('px-4 py-10 text-center text-sm', dark ? 'text-slate-500' : 'text-slate-400')}>Carregando...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7} className={cn('px-4 py-14 text-center text-sm', dark ? 'text-slate-500' : 'text-slate-400')}>
                <Clock size={28} className="mx-auto mb-2 opacity-40" />
                Nenhuma entrada registrada.
              </td></tr>
            ) : filtered.map(e => (
              <tr key={e.id} className={cn('transition-colors', dark ? 'hover:bg-slate-700/20' : 'hover:bg-slate-50')}>
                <td className={cn('px-4 py-3 font-mono text-xs font-bold', dark ? 'text-blue-400' : 'text-blue-600')}>{e.order?.protocol || e.orderId.substring(0, 8)}</td>
                <td className={cn('px-4 py-3 text-xs', dark ? 'text-slate-300' : 'text-slate-700')}>{e.user?.name || '—'}</td>
                <td className={cn('px-4 py-3 text-xs max-w-[180px] truncate', dark ? 'text-slate-400' : 'text-slate-500')}>{e.description || '—'}</td>
                <td className={cn('px-4 py-3 text-right font-bold text-xs', dark ? 'text-emerald-400' : 'text-emerald-600')}>{fmtMin(e.minutes)}</td>
                <td className="px-4 py-3 text-center text-xs">{e.billable ? '✅' : '—'}</td>
                <td className={cn('px-4 py-3 text-xs', dark ? 'text-slate-500' : 'text-slate-400')}>{new Date(e.loggedAt).toLocaleDateString('pt-BR')}</td>
                <td className="px-4 py-3">
                  <button onClick={() => remove(e.id)} className="text-rose-400 hover:text-rose-300 transition-colors p-1 rounded">
                    <Trash2 size={13} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowForm(false)} />
          <div className={cn('relative w-full max-w-md rounded-2xl border shadow-2xl overflow-hidden', dark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200')}>
            <div className={cn('px-6 py-4 border-b flex items-center justify-between', dark ? 'border-slate-800' : 'border-slate-100')}>
              <h3 className={cn('font-bold text-lg', dark ? 'text-white' : 'text-slate-800')}>Registrar Tempo</h3>
              <button onClick={() => setShowForm(false)} className={cn('p-1.5 rounded', dark ? 'text-slate-400 hover:bg-slate-800' : 'text-slate-400 hover:bg-slate-100')}>✕</button>
            </div>
            <div className="p-6 space-y-4">
              <div><label className={cn('block text-xs font-semibold mb-1.5', dark ? 'text-slate-400' : 'text-slate-600')}>ID ou Protocolo da O.S *</label><input value={form.orderId} onChange={e => setForm({ ...form, orderId: e.target.value })} placeholder="UUID da O.S" className={inputCls} /></div>
              <div><label className={cn('block text-xs font-semibold mb-1.5', dark ? 'text-slate-400' : 'text-slate-600')}>Tempo Trabalhado (minutos) *</label>
                <div className="flex gap-2">
                  {[30, 60, 90, 120].map(m => (
                    <button key={m} onClick={() => setForm({ ...form, minutes: String(m) })} className={cn('px-3 py-2 rounded-lg border text-xs font-bold transition-colors', form.minutes === String(m) ? 'bg-emerald-600 border-emerald-600 text-white' : (dark ? 'border-slate-700 text-slate-400 hover:bg-slate-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'))}>
                      {m < 60 ? `${m}min` : `${m / 60}h`}
                    </button>
                  ))}
                  <input type="number" value={form.minutes} onChange={e => setForm({ ...form, minutes: e.target.value })} className={cn(inputCls, 'w-20')} min="1" />
                </div>
              </div>
              <div><label className={cn('block text-xs font-semibold mb-1.5', dark ? 'text-slate-400' : 'text-slate-600')}>Descrição do que foi feito</label><textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={3} className={cn(inputCls, 'resize-none')} /></div>
              <label className={cn('flex items-center gap-2 cursor-pointer', dark ? 'text-slate-300' : 'text-slate-700')}>
                <input type="checkbox" checked={form.billable} onChange={e => setForm({ ...form, billable: e.target.checked })} className="w-4 h-4 rounded border" />
                <span className="text-sm">Horas cobráveis (billable)</span>
              </label>
            </div>
            <div className={cn('px-6 py-4 border-t flex justify-end gap-3', dark ? 'border-slate-800' : 'border-slate-100')}>
              <button onClick={() => setShowForm(false)} className={cn('px-4 py-2 rounded-lg text-sm border', dark ? 'border-slate-700 text-slate-400' : 'border-slate-200 text-slate-600')}>Cancelar</button>
              <button onClick={save} disabled={saving} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-semibold disabled:opacity-60 flex items-center gap-2">
                {saving && <RefreshCw size={14} className="animate-spin" />} Registrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
