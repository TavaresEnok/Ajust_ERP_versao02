'use client';
import React, { useEffect, useState } from 'react';
import { Settings, Plus, Trash2, RefreshCw, Clock, AlertTriangle, ShieldCheck } from 'lucide-react';

const cn = (...c: any[]) => c.filter(Boolean).join(' ');

export function SlaBuilderView({ dark, tenantId, onToast }: { dark: boolean; tenantId: string; onToast: (m: string) => void }) {
  const [policies, setPolicies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ priority: 'NORMAL', serviceOrderType: '', hours: '4', isOverride: false });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/sla-policies?tenantId=${encodeURIComponent(tenantId)}`, { cache: 'no-store' });
      if (res.ok) setPolicies(await res.json());
    } catch { onToast('Falha ao carregar políticas de SLA.'); }
    finally { setLoading(false); }
  };

  useEffect(() => { if (tenantId) load(); }, [tenantId]);

  const save = async () => {
    if (!form.priority || !form.hours) { onToast('Prioridade e prazo são obrigatórios.'); return; }
    setSaving(true);
    try {
      const payload = {
        ...form,
        tenantId,
        hours: parseInt(form.hours),
        serviceOrderType: form.serviceOrderType || null,
      };
      const res = await fetch('/api/sla-policies', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Falha ao criar política de SLA.');
      onToast('Política de SLA criada!');
      setShowForm(false);
      setForm({ priority: 'NORMAL', serviceOrderType: '', hours: '4', isOverride: false });
      load();
    } catch (e: any) { onToast(e.message); }
    finally { setSaving(false); }
  };

  const remove = async (id: string) => {
    if (!confirm('Remover esta regra de SLA?')) return;
    await fetch(`/api/sla-policies/${id}?tenantId=${tenantId}`, { method: 'DELETE' });
    onToast('Regra removida.'); load();
  };

  const inputCls = cn('w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40', dark ? 'bg-slate-900 border-slate-700 text-slate-200 placeholder-slate-500' : 'bg-white border-slate-300 text-slate-800');

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className={cn('text-2xl font-bold', dark ? 'text-white' : 'text-slate-800')}>SLA Policy Builder</h2>
          <p className={cn('text-sm mt-0.5', dark ? 'text-slate-400' : 'text-slate-500')}>Crie regras visuais de tempo máximo de atendimento (SLA) para a sua operação.</p>
        </div>
        <button onClick={() => setShowForm(true)} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold shadow-lg shadow-indigo-500/20 transition-colors">
          <Plus size={16} /> Nova Regra
        </button>
      </div>

      <div className={cn('rounded-xl border p-5 flex gap-4', dark ? 'bg-slate-800/30 border-slate-700/50' : 'bg-indigo-50 border-indigo-200')}>
        <ShieldCheck size={20} className="text-indigo-500 flex-shrink-0 mt-0.5" />
        <div>
          <p className={cn('text-sm font-semibold mb-1', dark ? 'text-slate-200' : 'text-slate-800')}>Como as regras funcionam?</p>
          <p className={cn('text-xs leading-relaxed', dark ? 'text-slate-400' : 'text-slate-600')}>
            Por padrão, o SLA é calculado com base na <strong>Prioridade</strong> da O.S. Se você criar uma regra marcando <strong>Exceção de Tipo (Override)</strong>, essa regra terá peso maior e vai sobrepor a prioridade, baseada no Tipo de Serviço (ex: Rompimento).
          </p>
        </div>
      </div>

      <div className={cn('rounded-xl border overflow-hidden', dark ? 'bg-slate-800/40 border-slate-700/50' : 'bg-white border-slate-200')}>
        <table className="w-full text-sm">
          <thead>
            <tr className={cn('border-b text-xs uppercase font-bold tracking-wider', dark ? 'border-slate-700 text-slate-500 bg-slate-800/60' : 'border-slate-100 text-slate-400 bg-slate-50')}>
              <th className="px-5 py-3 text-left">Gatilho (Prioridade ou Tipo)</th>
              <th className="px-5 py-3 text-left">Prazo (SLA)</th>
              <th className="px-5 py-3 text-center">Exceção?</th>
              <th className="px-5 py-3 text-center">Status</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody className={cn('divide-y', dark ? 'divide-slate-700/50' : 'divide-slate-100')}>
            {loading ? (
              <tr><td colSpan={5} className="px-5 py-10 text-center text-sm text-slate-400">Carregando...</td></tr>
            ) : policies.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-5 py-14 text-center">
                  <Settings size={32} className={cn('mx-auto mb-2', dark ? 'text-slate-600' : 'text-slate-300')} />
                  <p className={cn('text-sm', dark ? 'text-slate-500' : 'text-slate-400')}>Nenhuma regra de SLA configurada.</p>
                </td>
              </tr>
            ) : policies.map(p => (
              <tr key={p.id} className={cn('transition-colors', dark ? 'hover:bg-slate-700/20' : 'hover:bg-slate-50')}>
                <td className="px-5 py-4">
                  <div className="flex flex-col">
                    <span className={cn('font-bold', dark ? 'text-white' : 'text-slate-800')}>
                      {p.isOverride ? `Tipo: ${p.serviceOrderType}` : `Prioridade: ${p.priority}`}
                    </span>
                    {p.isOverride && <span className={cn('text-[10px] uppercase font-bold tracking-wider mt-0.5', dark ? 'text-amber-400' : 'text-amber-600')}><AlertTriangle size={10} className="inline mr-1" />Override</span>}
                  </div>
                </td>
                <td className="px-5 py-4">
                  <div className="flex items-center gap-1.5 font-semibold text-indigo-500">
                    <Clock size={14} /> {p.hours} horas
                  </div>
                </td>
                <td className="px-5 py-4 text-center">
                  {p.isOverride ? <span className="px-2 py-1 rounded bg-amber-500/10 text-amber-500 text-[10px] font-bold">SIM</span> : <span className="text-slate-400 text-xs">—</span>}
                </td>
                <td className="px-5 py-4 text-center">
                  {p.active ? <span className="px-2 py-1 rounded bg-emerald-500/10 text-emerald-500 text-[10px] font-bold">ATIVO</span> : <span className="px-2 py-1 rounded bg-rose-500/10 text-rose-500 text-[10px] font-bold">INATIVO</span>}
                </td>
                <td className="px-5 py-4 text-right">
                  <button onClick={() => remove(p.id)} className="text-rose-400 hover:text-rose-300 p-1.5 rounded hover:bg-rose-500/10 transition-colors"><Trash2 size={15} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowForm(false)} />
          <div className={cn('relative w-full max-w-md rounded-2xl border shadow-2xl', dark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200')}>
            <div className={cn('px-6 py-4 border-b flex items-center justify-between', dark ? 'border-slate-800' : 'border-slate-100')}>
              <h3 className={cn('font-bold text-lg', dark ? 'text-white' : 'text-slate-800')}>Nova Regra de SLA</h3>
              <button onClick={() => setShowForm(false)} className={cn('p-1.5 rounded', dark ? 'text-slate-400 hover:bg-slate-800' : 'text-slate-400 hover:bg-slate-100')}>✕</button>
            </div>
            <div className="p-6 space-y-4">
              <label className={cn('flex items-center gap-2 cursor-pointer', dark ? 'text-slate-300' : 'text-slate-700')}>
                <input type="checkbox" checked={form.isOverride} onChange={e => setForm({ ...form, isOverride: e.target.checked, serviceOrderType: e.target.checked ? 'INSTALACAO' : '' })} className="w-4 h-4 rounded border" />
                <span className="text-sm font-semibold">Exceção por Tipo (Override)?</span>
              </label>

              {!form.isOverride ? (
                <div>
                  <label className={cn('block text-xs font-semibold mb-1.5', dark ? 'text-slate-400' : 'text-slate-600')}>Prioridade *</label>
                  <select value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })} className={cn(inputCls, 'cursor-pointer')}>
                    {['BAIXA', 'NORMAL', 'ALTA', 'CRITICA'].map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              ) : (
                <div>
                  <label className={cn('block text-xs font-semibold mb-1.5', dark ? 'text-slate-400' : 'text-slate-600')}>Tipo de Serviço *</label>
                  <select value={form.serviceOrderType} onChange={e => setForm({ ...form, serviceOrderType: e.target.value })} className={cn(inputCls, 'cursor-pointer')}>
                    <option value="">Selecione...</option>
                    {['INSTALACAO', 'MANUTENCAO', 'RETIRADA', 'MUDANCA_ENDERECO', 'VISITA_TECNICA'].map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              )}

              <div>
                <label className={cn('block text-xs font-semibold mb-1.5', dark ? 'text-slate-400' : 'text-slate-600')}>Prazo Máximo (Horas) *</label>
                <div className="flex gap-2">
                  {[2, 4, 8, 24, 48].map(h => (
                    <button key={h} onClick={() => setForm({ ...form, hours: String(h) })} className={cn('flex-1 py-2 rounded-lg border text-xs font-bold transition-colors', form.hours === String(h) ? 'bg-indigo-600 border-indigo-600 text-white' : (dark ? 'border-slate-700 text-slate-400 hover:bg-slate-800' : 'border-slate-200 text-slate-600 hover:bg-slate-50'))}>
                      {h}h
                    </button>
                  ))}
                </div>
                <input type="number" min="1" value={form.hours} onChange={e => setForm({ ...form, hours: e.target.value })} className={cn(inputCls, 'mt-2')} placeholder="Ou digite um valor..." />
              </div>
            </div>
            <div className={cn('px-6 py-4 border-t flex justify-end gap-3', dark ? 'border-slate-800' : 'border-slate-100')}>
              <button onClick={() => setShowForm(false)} className={cn('px-4 py-2 rounded-lg text-sm border', dark ? 'border-slate-700 text-slate-400' : 'border-slate-200 text-slate-600')}>Cancelar</button>
              <button onClick={save} disabled={saving} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold disabled:opacity-60 flex items-center gap-2">
                {saving && <RefreshCw size={14} className="animate-spin" />} Salvar Regra
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
