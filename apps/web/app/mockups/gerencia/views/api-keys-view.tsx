'use client';
import React, { useEffect, useState } from 'react';
import { Key, Plus, Trash2, RefreshCw, Copy, Eye, EyeOff, Shield, AlertTriangle } from 'lucide-react';

const cn = (...c: any[]) => c.filter(Boolean).join(' ');

const fmtDate = (d: string) => new Date(d).toLocaleDateString('pt-BR');

export function ApiKeysView({ dark, tenantId, onToast }: { dark: boolean; tenantId: string; onToast: (m: string) => void }) {
  const [keys, setKeys] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', expiresAt: '' });
  const [saving, setSaving] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [showNewKey, setShowNewKey] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/api-keys?tenantId=${encodeURIComponent(tenantId)}`, { cache: 'no-store' });
      if (res.ok) setKeys(await res.json());
    } catch { onToast('Falha ao carregar API Keys.'); }
    finally { setLoading(false); }
  };

  useEffect(() => { if (tenantId) load(); }, [tenantId]);

  const create = async () => {
    if (!form.name.trim()) { onToast('Nome é obrigatório.'); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/api-keys', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...form, tenantId }),
      });
      if (!res.ok) throw new Error('Falha ao criar API Key.');
      const data = await res.json();
      setNewKey(data.key);
      setShowForm(false);
      setForm({ name: '', expiresAt: '' });
      load();
    } catch (e: any) { onToast(e.message); }
    finally { setSaving(false); }
  };

  const revoke = async (id: string) => {
    await fetch(`/api/api-keys/${id}/revoke?tenantId=${tenantId}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: '{}' });
    onToast('API Key revogada.'); load();
  };

  const remove = async (id: string) => {
    if (!confirm('Remover esta API Key? Esta ação não pode ser desfeita.')) return;
    await fetch(`/api/api-keys/${id}?tenantId=${tenantId}`, { method: 'DELETE' });
    onToast('API Key removida.'); load();
  };

  const inputCls = cn('w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40', dark ? 'bg-slate-900 border-slate-700 text-slate-200 placeholder-slate-500' : 'bg-white border-slate-300 text-slate-800');

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className={cn('text-2xl font-bold', dark ? 'text-white' : 'text-slate-800')}>API Keys — Integração Pública</h2>
          <p className={cn('text-sm mt-0.5', dark ? 'text-slate-400' : 'text-slate-500')}>Gere chaves seguras para integrar sistemas externos ao Ajust ERP via REST API.</p>
        </div>
        <button onClick={() => setShowForm(true)} className="flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-sm font-semibold shadow-lg shadow-rose-500/20 transition-colors">
          <Plus size={16} /> Gerar Nova Chave
        </button>
      </div>

      {/* New Key reveal */}
      {newKey && (
        <div className={cn('rounded-xl border-2 p-5 space-y-3', dark ? 'bg-emerald-900/20 border-emerald-500/50' : 'bg-emerald-50 border-emerald-400')}>
          <div className="flex items-center gap-2">
            <Shield size={18} className="text-emerald-400" />
            <p className={cn('text-sm font-bold', dark ? 'text-emerald-300' : 'text-emerald-700')}>⚠️ Copie sua chave agora — ela NÃO será exibida novamente!</p>
          </div>
          <div className={cn('rounded-lg border p-3 font-mono text-sm flex items-center gap-3', dark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200')}>
            <span className={cn('flex-1 break-all', showNewKey ? (dark ? 'text-emerald-300' : 'text-emerald-700') : 'blur-sm')}>{newKey}</span>
            <button onClick={() => setShowNewKey(!showNewKey)} className={cn('p-1 rounded', dark ? 'text-slate-400' : 'text-slate-400')}>{showNewKey ? <EyeOff size={15} /> : <Eye size={15} />}</button>
            <button onClick={() => { navigator.clipboard.writeText(newKey); onToast('Chave copiada!'); }} className="p-1 rounded text-blue-400 hover:text-blue-300">
              <Copy size={15} />
            </button>
          </div>
          <button onClick={() => setNewKey(null)} className={cn('text-xs px-3 py-1.5 rounded border', dark ? 'border-emerald-700 text-emerald-400 hover:bg-emerald-900/30' : 'border-emerald-300 text-emerald-700')}>Confirmar que salvei</button>
        </div>
      )}

      {/* Docs hint */}
      <div className={cn('rounded-xl border p-5 flex gap-4', dark ? 'bg-slate-800/30 border-slate-700/50' : 'bg-blue-50 border-blue-200')}>
        <Key size={20} className="text-blue-400 flex-shrink-0 mt-0.5" />
        <div>
          <p className={cn('text-sm font-semibold mb-1', dark ? 'text-slate-200' : 'text-slate-800')}>Como usar sua API Key</p>
          <code className={cn('text-xs', dark ? 'text-slate-400' : 'text-slate-600')}>
            Authorization: Bearer ajust_xxxxxxxxxxxxx
          </code>
          <p className={cn('text-xs mt-1', dark ? 'text-slate-500' : 'text-slate-500')}>Adicione o header acima em todas as requisições para a API pública do Ajust ERP.</p>
        </div>
      </div>

      {/* Keys list */}
      <div className={cn('rounded-xl border overflow-hidden', dark ? 'bg-slate-800/40 border-slate-700/50' : 'bg-white border-slate-200')}>
        <div className={cn('px-5 py-3 border-b text-xs font-bold uppercase tracking-wider', dark ? 'border-slate-700 text-slate-500 bg-slate-800/60' : 'border-slate-100 text-slate-400 bg-slate-50')}>Chaves Ativas</div>
        {loading ? <div className="px-5 py-10 text-center text-slate-400 text-sm">Carregando...</div> :
          keys.length === 0 ? (
            <div className="px-5 py-14 text-center">
              <Key size={32} className={cn('mx-auto mb-2', dark ? 'text-slate-600' : 'text-slate-300')} />
              <p className={cn('text-sm', dark ? 'text-slate-500' : 'text-slate-400')}>Nenhuma chave gerada.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-700/30">
              {keys.map(k => (
                <div key={k.id} className={cn('px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-3', !k.active ? 'opacity-50' : '')}>
                  <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0', k.active ? (dark ? 'bg-rose-500/10 text-rose-400' : 'bg-rose-50 text-rose-500') : (dark ? 'bg-slate-700 text-slate-500' : 'bg-slate-100 text-slate-400'))}>
                    <Key size={14} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={cn('font-semibold text-sm', dark ? 'text-white' : 'text-slate-800')}>{k.name}</span>
                      {!k.active && <span className={cn('px-2 py-0.5 rounded text-[10px] font-bold', dark ? 'bg-slate-700 text-slate-400' : 'bg-slate-100 text-slate-500')}>REVOGADA</span>}
                      {k.expiresAt && new Date(k.expiresAt) < new Date() && <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-400">EXPIRADA</span>}
                    </div>
                    <p className={cn('text-xs mt-0.5', dark ? 'text-slate-500' : 'text-slate-400')}>
                      Prefixo: <code className="font-mono">{k.keyPrefix}...</code>
                      {' · '}Criada em {fmtDate(k.createdAt)}
                      {k.expiresAt && ` · Expira: ${fmtDate(k.expiresAt)}`}
                      {k.lastUsedAt && ` · Último uso: ${fmtDate(k.lastUsedAt)}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {k.active && (
                      <button onClick={() => revoke(k.id)} className={cn('px-3 py-1.5 rounded border text-xs font-medium transition-colors', dark ? 'border-amber-700/50 text-amber-400 hover:bg-amber-900/20' : 'border-amber-300 text-amber-600 hover:bg-amber-50')}>
                        Revogar
                      </button>
                    )}
                    <button onClick={() => remove(k.id)} className="text-rose-400 hover:text-rose-300 p-1.5 rounded-lg hover:bg-rose-500/10 transition-colors">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
      </div>

      {/* Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowForm(false)} />
          <div className={cn('relative w-full max-w-md rounded-2xl border shadow-2xl', dark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200')}>
            <div className={cn('px-6 py-4 border-b flex items-center justify-between', dark ? 'border-slate-800' : 'border-slate-100')}>
              <h3 className={cn('font-bold text-lg', dark ? 'text-white' : 'text-slate-800')}>Gerar Nova API Key</h3>
              <button onClick={() => setShowForm(false)} className={cn('p-1.5 rounded', dark ? 'text-slate-400 hover:bg-slate-800' : 'text-slate-400 hover:bg-slate-100')}>✕</button>
            </div>
            <div className="p-6 space-y-4">
              <div className={cn('rounded-lg border p-3 flex gap-2', dark ? 'bg-amber-900/10 border-amber-700/30' : 'bg-amber-50 border-amber-200')}>
                <AlertTriangle size={16} className="text-amber-400 flex-shrink-0 mt-0.5" />
                <p className={cn('text-xs', dark ? 'text-amber-300' : 'text-amber-700')}>A chave gerada será mostrada <strong>uma única vez</strong>. Guarde-a em local seguro.</p>
              </div>
              <div><label className={cn('block text-xs font-semibold mb-1.5', dark ? 'text-slate-400' : 'text-slate-600')}>Nome da Integração *</label><input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Ex: Zabbix Integration, Monitor Bot" className={inputCls} /></div>
              <div><label className={cn('block text-xs font-semibold mb-1.5', dark ? 'text-slate-400' : 'text-slate-600')}>Data de Expiração (opcional)</label><input type="date" value={form.expiresAt} onChange={e => setForm({ ...form, expiresAt: e.target.value })} className={inputCls} /></div>
            </div>
            <div className={cn('px-6 py-4 border-t flex justify-end gap-3', dark ? 'border-slate-800' : 'border-slate-100')}>
              <button onClick={() => setShowForm(false)} className={cn('px-4 py-2 rounded-lg text-sm border', dark ? 'border-slate-700 text-slate-400' : 'border-slate-200 text-slate-600')}>Cancelar</button>
              <button onClick={create} disabled={saving} className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-sm font-semibold disabled:opacity-60 flex items-center gap-2">
                {saving && <RefreshCw size={14} className="animate-spin" />} Gerar Chave
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
