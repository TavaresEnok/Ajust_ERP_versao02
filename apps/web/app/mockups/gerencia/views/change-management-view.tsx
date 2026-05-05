'use client';
import React, { useEffect, useState, useMemo } from 'react';
import { GitBranch, Plus, CheckCircle, XCircle, Clock, AlertTriangle, ChevronRight, RefreshCw, Search, Calendar, User, Shield } from 'lucide-react';

const cn = (...c: any[]) => c.filter(Boolean).join(' ');

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  RASCUNHO:             { label: 'Rascunho',            color: 'text-slate-400 bg-slate-400/10 border-slate-400/30',    icon: Clock },
  AGUARDANDO_APROVACAO: { label: 'Aguard. Aprovação',   color: 'text-amber-400 bg-amber-400/10 border-amber-400/30',   icon: AlertTriangle },
  APROVADO:             { label: 'Aprovado',             color: 'text-blue-400 bg-blue-400/10 border-blue-400/30',      icon: CheckCircle },
  EM_EXECUCAO:          { label: 'Em Execução',          color: 'text-purple-400 bg-purple-400/10 border-purple-400/30', icon: RefreshCw },
  CONCLUIDO:            { label: 'Concluído',            color: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/30', icon: CheckCircle },
  CANCELADO:            { label: 'Cancelado',            color: 'text-slate-500 bg-slate-500/10 border-slate-500/30',   icon: XCircle },
  REJEITADO:            { label: 'Rejeitado',            color: 'text-rose-400 bg-rose-400/10 border-rose-400/30',      icon: XCircle },
};
const RISK_COLORS: Record<string, string> = {
  BAIXO: 'text-emerald-400', MEDIO: 'text-amber-400', ALTO: 'text-orange-500', CRITICO: 'text-rose-500',
};
const TRANSITIONS: Record<string, { toStatus: string; label: string; cls: string }[]> = {
  RASCUNHO:             [{ toStatus: 'AGUARDANDO_APROVACAO', label: 'Enviar p/ Aprovação', cls: 'bg-amber-500 hover:bg-amber-600' }],
  AGUARDANDO_APROVACAO: [{ toStatus: 'APROVADO', label: 'Aprovar', cls: 'bg-blue-600 hover:bg-blue-700' }, { toStatus: 'REJEITADO', label: 'Rejeitar', cls: 'bg-rose-600 hover:bg-rose-700' }],
  APROVADO:             [{ toStatus: 'EM_EXECUCAO', label: 'Iniciar Execução', cls: 'bg-purple-600 hover:bg-purple-700' }],
  EM_EXECUCAO:          [{ toStatus: 'CONCLUIDO', label: 'Marcar Concluído', cls: 'bg-emerald-600 hover:bg-emerald-700' }, { toStatus: 'CANCELADO', label: 'Cancelar', cls: 'bg-slate-600 hover:bg-slate-700' }],
};

const formatDate = (d: string) => d ? new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

export function ChangeManagementView({ dark, tenantId, onToast }: { dark: boolean; tenantId: string; onToast: (m: string) => void }) {
  const [rfcs, setRfcs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('Todos');
  const [selected, setSelected] = useState<any>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', justification: '', rollbackPlan: '', risk: 'MEDIO', plannedStart: '', plannedEnd: '', affectedSystems: '' });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/change-management?tenantId=${encodeURIComponent(tenantId)}`, { cache: 'no-store' });
      if (!res.ok) throw new Error('Falha ao carregar RFCs.');
      setRfcs(await res.json());
    } catch (e: any) { onToast(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { if (tenantId) load(); }, [tenantId]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return rfcs.filter(r =>
      (statusFilter === 'Todos' || r.status === statusFilter) &&
      (!q || r.title.toLowerCase().includes(q) || r.number.toLowerCase().includes(q))
    );
  }, [rfcs, search, statusFilter]);

  const create = async () => {
    if (!form.title.trim() || !form.description.trim() || !form.justification.trim()) { onToast('Título, descrição e justificativa são obrigatórios.'); return; }
    setSaving(true);
    try {
      const body = { ...form, tenantId, affectedSystems: form.affectedSystems.split(',').map((s: string) => s.trim()).filter(Boolean) };
      const res = await fetch('/api/change-management', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!res.ok) throw new Error('Falha ao criar RFC.');
      onToast('RFC criada com sucesso!');
      setShowForm(false);
      setForm({ title: '', description: '', justification: '', rollbackPlan: '', risk: 'MEDIO', plannedStart: '', plannedEnd: '', affectedSystems: '' });
      load();
    } catch (e: any) { onToast(e.message); }
    finally { setSaving(false); }
  };

  const transition = async (id: string, toStatus: string) => {
    const res = await fetch(`/api/change-management/${id}/transition?tenantId=${tenantId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ toStatus }) });
    if (!res.ok) { onToast('Falha ao atualizar status.'); return; }
    onToast('Status atualizado!'); load(); if (selected?.id === id) setSelected(null);
  };

  const inputCls = cn('w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50', dark ? 'bg-slate-900/80 border-slate-700 text-slate-200 placeholder-slate-500' : 'bg-white border-slate-300 text-slate-800');

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className={cn('text-2xl font-bold', dark ? 'text-white' : 'text-slate-800')}>Gestão de Mudanças (RFC / ITIL)</h2>
          <p className={cn('text-sm mt-0.5', dark ? 'text-slate-400' : 'text-slate-500')}>Controle e aprovação de mudanças planejadas na operação.</p>
        </div>
        <button onClick={() => setShowForm(true)} className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-semibold shadow-lg shadow-purple-500/20 transition-colors">
          <Plus size={16} /> Nova RFC
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total', value: rfcs.length, color: dark ? 'text-white' : 'text-slate-800' },
          { label: 'Aguardando', value: rfcs.filter(r => r.status === 'AGUARDANDO_APROVACAO').length, color: 'text-amber-400' },
          { label: 'Em Execução', value: rfcs.filter(r => r.status === 'EM_EXECUCAO').length, color: 'text-purple-400' },
          { label: 'Concluídas', value: rfcs.filter(r => r.status === 'CONCLUIDO').length, color: 'text-emerald-400' },
        ].map(kpi => (
          <div key={kpi.label} className={cn('rounded-xl border p-4', dark ? 'bg-slate-800/40 border-slate-700/50' : 'bg-white border-slate-200')}>
            <p className={cn('text-xs uppercase font-bold tracking-wider', dark ? 'text-slate-500' : 'text-slate-400')}>{kpi.label}</p>
            <p className={cn('text-3xl font-bold mt-1', kpi.color)}>{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className={cn('flex flex-col sm:flex-row gap-3 p-4 rounded-xl border', dark ? 'bg-slate-800/40 border-slate-700/50' : 'bg-white border-slate-200')}>
        <div className="relative flex-1">
          <Search size={14} className={cn('absolute left-3 top-1/2 -translate-y-1/2', dark ? 'text-slate-500' : 'text-slate-400')} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por título ou número..." className={cn(inputCls, 'pl-8')} />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className={cn(inputCls, 'sm:w-52 cursor-pointer')}>
          <option value="Todos">Todos os status</option>
          {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>

      {/* RFC List */}
      <div className="space-y-3">
        {loading ? [1,2,3].map(i => <div key={i} className={cn('h-24 rounded-xl animate-pulse', dark ? 'bg-slate-800/40' : 'bg-slate-100')} />) :
          filtered.length === 0 ? (
            <div className={cn('flex flex-col items-center justify-center py-20 rounded-xl border', dark ? 'bg-slate-800/30 border-slate-700/50' : 'bg-slate-50 border-slate-200')}>
              <GitBranch size={40} className={cn('mb-3', dark ? 'text-slate-600' : 'text-slate-300')} />
              <p className={cn('font-medium', dark ? 'text-slate-400' : 'text-slate-500')}>Nenhuma RFC encontrada.</p>
            </div>
          ) : filtered.map(rfc => {
            const s = STATUS_CONFIG[rfc.status] || STATUS_CONFIG.RASCUNHO;
            const StatusIcon = s.icon;
            const trans = TRANSITIONS[rfc.status] || [];
            return (
              <div key={rfc.id} className={cn('rounded-xl border p-5 transition-all cursor-pointer', dark ? 'bg-slate-800/40 border-slate-700/50 hover:border-purple-500/30' : 'bg-white border-slate-200 hover:border-purple-300', selected?.id === rfc.id ? (dark ? 'border-purple-500/50 bg-slate-800/70' : 'border-purple-400') : '')} onClick={() => setSelected(selected?.id === rfc.id ? null : rfc)}>
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={cn('text-xs font-mono font-bold', dark ? 'text-purple-400' : 'text-purple-600')}>{rfc.number}</span>
                      <span className={cn('px-2 py-0.5 rounded border text-xs font-bold flex items-center gap-1', s.color)}><StatusIcon size={10} />{s.label}</span>
                      <span className={cn('text-xs font-bold', RISK_COLORS[rfc.risk])}>Risco: {rfc.risk}</span>
                    </div>
                    <h3 className={cn('font-semibold mt-1', dark ? 'text-white' : 'text-slate-800')}>{rfc.title}</h3>
                    <p className={cn('text-xs mt-0.5 line-clamp-1', dark ? 'text-slate-400' : 'text-slate-500')}>{rfc.description}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {trans.map(t => (
                      <button key={t.toStatus} onClick={e => { e.stopPropagation(); transition(rfc.id, t.toStatus); }} className={cn('px-3 py-1.5 rounded-lg text-xs font-bold text-white transition-colors whitespace-nowrap', t.cls)}>
                        {t.label}
                      </button>
                    ))}
                    <ChevronRight size={16} className={cn('transition-transform', selected?.id === rfc.id ? 'rotate-90' : '', dark ? 'text-slate-600' : 'text-slate-300')} />
                  </div>
                </div>
                {selected?.id === rfc.id && (
                  <div className={cn('mt-4 pt-4 border-t grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm', dark ? 'border-slate-700/50' : 'border-slate-100')}>
                    <div>
                      <p className={cn('text-xs font-bold uppercase mb-1', dark ? 'text-slate-500' : 'text-slate-400')}>Justificativa</p>
                      <p className={cn(dark ? 'text-slate-300' : 'text-slate-600')}>{rfc.justification || '—'}</p>
                    </div>
                    {rfc.rollbackPlan && <div>
                      <p className={cn('text-xs font-bold uppercase mb-1', dark ? 'text-slate-500' : 'text-slate-400')}>Plano de Rollback</p>
                      <p className={cn(dark ? 'text-slate-300' : 'text-slate-600')}>{rfc.rollbackPlan}</p>
                    </div>}
                    {rfc.plannedStart && <div>
                      <p className={cn('text-xs font-bold uppercase mb-1', dark ? 'text-slate-500' : 'text-slate-400')}>Janela Planejada</p>
                      <p className={cn(dark ? 'text-slate-300' : 'text-slate-600')}>{formatDate(rfc.plannedStart)} → {formatDate(rfc.plannedEnd)}</p>
                    </div>}
                    {rfc.requestedBy && <div>
                      <p className={cn('text-xs font-bold uppercase mb-1', dark ? 'text-slate-500' : 'text-slate-400')}>Solicitante</p>
                      <p className={cn(dark ? 'text-slate-300' : 'text-slate-600')}>{rfc.requestedBy.name}</p>
                    </div>}
                    {(rfc.affectedSystems || []).length > 0 && <div className="sm:col-span-2">
                      <p className={cn('text-xs font-bold uppercase mb-1', dark ? 'text-slate-500' : 'text-slate-400')}>Sistemas Afetados</p>
                      <div className="flex flex-wrap gap-1">{rfc.affectedSystems.map((s: string) => <span key={s} className={cn('px-2 py-0.5 rounded border text-xs', dark ? 'border-slate-600 text-slate-400' : 'border-slate-200 text-slate-500')}>{s}</span>)}</div>
                    </div>}
                  </div>
                )}
              </div>
            );
          })}
      </div>

      {/* New RFC Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowForm(false)} />
          <div className={cn('relative w-full max-w-2xl rounded-2xl border shadow-2xl overflow-hidden', dark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200')}>
            <div className={cn('px-6 py-4 border-b flex items-center justify-between', dark ? 'border-slate-800' : 'border-slate-100')}>
              <h3 className={cn('font-bold text-lg', dark ? 'text-white' : 'text-slate-800')}>Nova RFC — Request For Change</h3>
              <button onClick={() => setShowForm(false)} className={cn('p-1.5 rounded-lg', dark ? 'text-slate-400 hover:bg-slate-800' : 'text-slate-400 hover:bg-slate-100')}>✕</button>
            </div>
            <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[70vh] overflow-y-auto">
              <div className="sm:col-span-2"><label className={cn('block text-xs font-semibold mb-1.5', dark ? 'text-slate-400' : 'text-slate-600')}>Título da Mudança *</label><input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Ex: Substituição do Firewall Core" className={inputCls} /></div>
              <div className="sm:col-span-2"><label className={cn('block text-xs font-semibold mb-1.5', dark ? 'text-slate-400' : 'text-slate-600')}>Descrição *</label><textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={3} className={cn(inputCls, 'resize-none')} /></div>
              <div className="sm:col-span-2"><label className={cn('block text-xs font-semibold mb-1.5', dark ? 'text-slate-400' : 'text-slate-600')}>Justificativa *</label><textarea value={form.justification} onChange={e => setForm({ ...form, justification: e.target.value })} rows={2} className={cn(inputCls, 'resize-none')} /></div>
              <div className="sm:col-span-2"><label className={cn('block text-xs font-semibold mb-1.5', dark ? 'text-slate-400' : 'text-slate-600')}>Plano de Rollback</label><textarea value={form.rollbackPlan} onChange={e => setForm({ ...form, rollbackPlan: e.target.value })} rows={2} className={cn(inputCls, 'resize-none')} /></div>
              <div>
                <label className={cn('block text-xs font-semibold mb-1.5', dark ? 'text-slate-400' : 'text-slate-600')}>Nível de Risco</label>
                <select value={form.risk} onChange={e => setForm({ ...form, risk: e.target.value })} className={cn(inputCls, 'cursor-pointer')}>
                  {['BAIXO', 'MEDIO', 'ALTO', 'CRITICO'].map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div><label className={cn('block text-xs font-semibold mb-1.5', dark ? 'text-slate-400' : 'text-slate-600')}>Sistemas Afetados (vírgula)</label><input value={form.affectedSystems} onChange={e => setForm({ ...form, affectedSystems: e.target.value })} placeholder="Firewall, BGP, DNS" className={inputCls} /></div>
              <div><label className={cn('block text-xs font-semibold mb-1.5', dark ? 'text-slate-400' : 'text-slate-600')}>Início Planejado</label><input type="datetime-local" value={form.plannedStart} onChange={e => setForm({ ...form, plannedStart: e.target.value })} className={inputCls} /></div>
              <div><label className={cn('block text-xs font-semibold mb-1.5', dark ? 'text-slate-400' : 'text-slate-600')}>Fim Planejado</label><input type="datetime-local" value={form.plannedEnd} onChange={e => setForm({ ...form, plannedEnd: e.target.value })} className={inputCls} /></div>
            </div>
            <div className={cn('px-6 py-4 border-t flex justify-end gap-3', dark ? 'border-slate-800' : 'border-slate-100')}>
              <button onClick={() => setShowForm(false)} className={cn('px-4 py-2 rounded-lg text-sm border', dark ? 'border-slate-700 text-slate-400' : 'border-slate-200 text-slate-600')}>Cancelar</button>
              <button onClick={create} disabled={saving} className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-60 flex items-center gap-2">
                {saving && <RefreshCw size={14} className="animate-spin" />} Criar RFC
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
