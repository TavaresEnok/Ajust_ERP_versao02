'use client';
import React, { useEffect, useState, useMemo } from 'react';
import { Server, Plus, Pencil, Trash2, Link2, CheckCircle, XCircle, AlertTriangle, Clock, RefreshCw, Tag, Building2, Search } from 'lucide-react';

const cn = (...c: any[]) => c.filter(Boolean).join(' ');

const CATEGORY_LABELS: Record<string, string> = {
  SERVIDOR: 'Servidor', SWITCH: 'Switch', ROTEADOR: 'Roteador',
  LINK_TRANSIT: 'Link Trânsito', FIREWALL: 'Firewall',
  SOFTWARE: 'Software', CONTRATO: 'Contrato', OUTRO: 'Outro',
};
const STATUS_COLORS: Record<string, string> = {
  ATIVO: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/30',
  INATIVO: 'text-slate-400 bg-slate-400/10 border-slate-400/30',
  MANUTENCAO: 'text-amber-400 bg-amber-400/10 border-amber-400/30',
  DESATIVADO: 'text-rose-400 bg-rose-400/10 border-rose-400/30',
};

export function CmdbView({ dark, tenantId, onToast }: { dark: boolean; tenantId: string; onToast: (m: string) => void }) {
  const [assets, setAssets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('Todas');
  const [showForm, setShowForm] = useState(false);
  const [editAsset, setEditAsset] = useState<any>(null);
  const [form, setForm] = useState({ name: '', category: 'OUTRO', status: 'ATIVO', description: '', location: '', vendor: '', serialNumber: '', contractEnd: '', tags: '' });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/cmdb/assets?tenantId=${encodeURIComponent(tenantId)}`, { cache: 'no-store' });
      if (!res.ok) throw new Error('Falha ao carregar ativos.');
      setAssets(await res.json());
    } catch (e: any) { onToast(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { if (tenantId) load(); }, [tenantId]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return assets.filter(a =>
      (catFilter === 'Todas' || a.category === catFilter) &&
      (!q || a.name.toLowerCase().includes(q) || (a.vendor || '').toLowerCase().includes(q))
    );
  }, [assets, search, catFilter]);

  const save = async () => {
    if (!form.name.trim()) { onToast('Nome é obrigatório.'); return; }
    setSaving(true);
    try {
      const body = { ...form, tenantId, tags: form.tags.split(',').map((t: string) => t.trim()).filter(Boolean) };
      const url = editAsset ? `/api/cmdb/assets/${editAsset.id}?tenantId=${tenantId}` : '/api/cmdb/assets';
      const method = editAsset ? 'PATCH' : 'POST';
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!res.ok) throw new Error('Falha ao salvar ativo.');
      onToast(editAsset ? 'Ativo atualizado!' : 'Ativo criado!');
      setShowForm(false); setEditAsset(null);
      setForm({ name: '', category: 'OUTRO', status: 'ATIVO', description: '', location: '', vendor: '', serialNumber: '', contractEnd: '', tags: '' });
      load();
    } catch (e: any) { onToast(e.message); }
    finally { setSaving(false); }
  };

  const remove = async (id: string) => {
    if (!confirm('Remover este ativo?')) return;
    await fetch(`/api/cmdb/assets/${id}?tenantId=${tenantId}`, { method: 'DELETE' });
    onToast('Ativo removido.'); load();
  };

  const startEdit = (a: any) => {
    setEditAsset(a);
    setForm({ name: a.name, category: a.category, status: a.status, description: a.description || '', location: a.location || '', vendor: a.vendor || '', serialNumber: a.serialNumber || '', contractEnd: a.contractEnd ? a.contractEnd.substring(0, 10) : '', tags: (a.tags || []).join(', ') });
    setShowForm(true);
  };

  const inputCls = cn('w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50', dark ? 'bg-slate-900/80 border-slate-700 text-slate-200 placeholder-slate-500' : 'bg-white border-slate-300 text-slate-800');
  const selectCls = cn(inputCls, 'cursor-pointer');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className={cn('text-2xl font-bold', dark ? 'text-white' : 'text-slate-800')}>CMDB — Repositório de Ativos</h2>
          <p className={cn('text-sm mt-0.5', dark ? 'text-slate-400' : 'text-slate-500')}>Gerencie servidores, links, contratos e qualquer ativo crítico da operação.</p>
        </div>
        <button onClick={() => { setShowForm(true); setEditAsset(null); }} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition-colors shadow-lg shadow-blue-500/20">
          <Plus size={16} /> Novo Ativo
        </button>
      </div>

      {/* Filters */}
      <div className={cn('flex flex-col sm:flex-row gap-3 p-4 rounded-xl border', dark ? 'bg-slate-800/40 border-slate-700/50' : 'bg-white border-slate-200')}>
        <div className="relative flex-1">
          <Search size={14} className={cn('absolute left-3 top-1/2 -translate-y-1/2', dark ? 'text-slate-500' : 'text-slate-400')} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nome ou fornecedor..." className={cn(inputCls, 'pl-8')} />
        </div>
        <select value={catFilter} onChange={e => setCatFilter(e.target.value)} className={cn(selectCls, 'sm:w-48')}>
          <option value="Todas">Todas as categorias</option>
          {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <button onClick={load} className={cn('px-3 py-2 rounded-lg border text-sm flex items-center gap-2 transition-colors', dark ? 'border-slate-700 text-slate-400 hover:bg-slate-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50')}>
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Atualizar
        </button>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total', value: assets.length, color: dark ? 'text-white' : 'text-slate-800' },
          { label: 'Ativos', value: assets.filter(a => a.status === 'ATIVO').length, color: 'text-emerald-400' },
          { label: 'Manutenção', value: assets.filter(a => a.status === 'MANUTENCAO').length, color: 'text-amber-400' },
          { label: 'Inativos', value: assets.filter(a => a.status === 'INATIVO' || a.status === 'DESATIVADO').length, color: 'text-rose-400' },
        ].map(kpi => (
          <div key={kpi.label} className={cn('rounded-xl border p-4', dark ? 'bg-slate-800/40 border-slate-700/50' : 'bg-white border-slate-200')}>
            <p className={cn('text-xs uppercase font-bold tracking-wider', dark ? 'text-slate-500' : 'text-slate-400')}>{kpi.label}</p>
            <p className={cn('text-3xl font-bold mt-1', kpi.color)}>{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Asset Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1,2,3].map(i => <div key={i} className={cn('h-40 rounded-xl animate-pulse', dark ? 'bg-slate-800/40' : 'bg-slate-100')} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className={cn('flex flex-col items-center justify-center py-20 rounded-xl border', dark ? 'bg-slate-800/30 border-slate-700/50' : 'bg-slate-50 border-slate-200')}>
          <Server size={40} className={cn('mb-3', dark ? 'text-slate-600' : 'text-slate-300')} />
          <p className={cn('font-medium', dark ? 'text-slate-400' : 'text-slate-500')}>Nenhum ativo encontrado.</p>
          <p className={cn('text-sm', dark ? 'text-slate-500' : 'text-slate-400')}>Clique em &quot;Novo Ativo&quot; para adicionar.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(asset => (
            <div key={asset.id} className={cn('rounded-xl border p-5 flex flex-col gap-3 group transition-all hover:shadow-lg', dark ? 'bg-slate-800/40 border-slate-700/50 hover:border-blue-500/30 hover:shadow-blue-500/5' : 'bg-white border-slate-200 hover:border-blue-300')}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center', dark ? 'bg-blue-500/10 text-blue-400' : 'bg-blue-50 text-blue-600')}>
                    <Server size={18} />
                  </div>
                  <div>
                    <h3 className={cn('font-bold text-sm leading-tight', dark ? 'text-white' : 'text-slate-800')}>{asset.name}</h3>
                    <p className={cn('text-xs', dark ? 'text-slate-500' : 'text-slate-400')}>{CATEGORY_LABELS[asset.category] || asset.category}</p>
                  </div>
                </div>
                <span className={cn('px-2 py-0.5 rounded border text-xs font-bold', STATUS_COLORS[asset.status] || 'text-slate-400')}>{asset.status}</span>
              </div>

              {asset.description && <p className={cn('text-xs line-clamp-2', dark ? 'text-slate-400' : 'text-slate-500')}>{asset.description}</p>}

              <div className="grid grid-cols-2 gap-2 text-xs">
                {asset.location && <div className={cn('flex items-center gap-1', dark ? 'text-slate-500' : 'text-slate-400')}><Building2 size={11} />{asset.location}</div>}
                {asset.vendor && <div className={cn('flex items-center gap-1', dark ? 'text-slate-500' : 'text-slate-400')}><Tag size={11} />{asset.vendor}</div>}
              </div>

              {(asset.tags || []).length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {asset.tags.map((t: string) => (
                    <span key={t} className={cn('px-2 py-0.5 rounded-full text-[10px] font-medium border', dark ? 'border-slate-600 text-slate-400' : 'border-slate-200 text-slate-500')}>{t}</span>
                  ))}
                </div>
              )}

              <div className="flex gap-2 mt-auto opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => startEdit(asset)} className={cn('flex items-center gap-1 px-3 py-1.5 rounded border text-xs font-medium transition-colors', dark ? 'border-slate-600 text-slate-400 hover:bg-slate-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50')}>
                  <Pencil size={12} /> Editar
                </button>
                <button onClick={() => remove(asset.id)} className="flex items-center gap-1 px-3 py-1.5 rounded border border-rose-500/30 text-rose-400 text-xs font-medium hover:bg-rose-500/10 transition-colors">
                  <Trash2 size={12} /> Remover
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowForm(false)} />
          <div className={cn('relative w-full max-w-2xl rounded-2xl border shadow-2xl overflow-hidden', dark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200')}>
            <div className={cn('px-6 py-4 border-b flex items-center justify-between', dark ? 'border-slate-800' : 'border-slate-100')}>
              <h3 className={cn('font-bold text-lg', dark ? 'text-white' : 'text-slate-800')}>{editAsset ? 'Editar Ativo' : 'Novo Ativo (CMDB)'}</h3>
              <button onClick={() => setShowForm(false)} className={cn('p-1.5 rounded-lg transition-colors', dark ? 'text-slate-400 hover:bg-slate-800' : 'text-slate-400 hover:bg-slate-100')}>✕</button>
            </div>
            <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[70vh] overflow-y-auto">
              <div className="sm:col-span-2">
                <label className={cn('block text-xs font-semibold mb-1.5', dark ? 'text-slate-400' : 'text-slate-600')}>Nome do Ativo *</label>
                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Ex: Servidor Core BGP" className={inputCls} />
              </div>
              <div>
                <label className={cn('block text-xs font-semibold mb-1.5', dark ? 'text-slate-400' : 'text-slate-600')}>Categoria</label>
                <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} className={selectCls}>
                  {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div>
                <label className={cn('block text-xs font-semibold mb-1.5', dark ? 'text-slate-400' : 'text-slate-600')}>Status</label>
                <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} className={selectCls}>
                  {['ATIVO', 'INATIVO', 'MANUTENCAO', 'DESATIVADO'].map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div><label className={cn('block text-xs font-semibold mb-1.5', dark ? 'text-slate-400' : 'text-slate-600')}>Localização</label><input value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} placeholder="Rack A3 / Datacenter SP" className={inputCls} /></div>
              <div><label className={cn('block text-xs font-semibold mb-1.5', dark ? 'text-slate-400' : 'text-slate-600')}>Fornecedor / Fabricante</label><input value={form.vendor} onChange={e => setForm({ ...form, vendor: e.target.value })} placeholder="Cisco, Dell, Vivo..." className={inputCls} /></div>
              <div><label className={cn('block text-xs font-semibold mb-1.5', dark ? 'text-slate-400' : 'text-slate-600')}>Número de Série</label><input value={form.serialNumber} onChange={e => setForm({ ...form, serialNumber: e.target.value })} className={inputCls} /></div>
              <div><label className={cn('block text-xs font-semibold mb-1.5', dark ? 'text-slate-400' : 'text-slate-600')}>Vencimento do Contrato</label><input type="date" value={form.contractEnd} onChange={e => setForm({ ...form, contractEnd: e.target.value })} className={inputCls} /></div>
              <div className="sm:col-span-2"><label className={cn('block text-xs font-semibold mb-1.5', dark ? 'text-slate-400' : 'text-slate-600')}>Descrição</label><textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={3} className={cn(inputCls, 'resize-none')} /></div>
              <div className="sm:col-span-2"><label className={cn('block text-xs font-semibold mb-1.5', dark ? 'text-slate-400' : 'text-slate-600')}>Tags (separadas por vírgula)</label><input value={form.tags} onChange={e => setForm({ ...form, tags: e.target.value })} placeholder="bgp, core, producao" className={inputCls} /></div>
            </div>
            <div className={cn('px-6 py-4 border-t flex justify-end gap-3', dark ? 'border-slate-800' : 'border-slate-100')}>
              <button onClick={() => setShowForm(false)} className={cn('px-4 py-2 rounded-lg text-sm border transition-colors', dark ? 'border-slate-700 text-slate-400 hover:bg-slate-800' : 'border-slate-200 text-slate-600 hover:bg-slate-50')}>Cancelar</button>
              <button onClick={save} disabled={saving} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-60 flex items-center gap-2">
                {saving && <RefreshCw size={14} className="animate-spin" />} {editAsset ? 'Atualizar' : 'Criar Ativo'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
