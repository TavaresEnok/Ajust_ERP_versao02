'use client';
import React, { useEffect, useState } from 'react';
import { Bell, Plus, Trash2, RefreshCw, Mail, Globe, MessageSquare, ToggleLeft, ToggleRight, Zap } from 'lucide-react';

const cn = (...c: any[]) => c.filter(Boolean).join(' ');

const CHANNELS = [
  { value: 'EMAIL', label: 'E-mail', icon: Mail, color: 'text-blue-400' },
  { value: 'WEBHOOK', label: 'Webhook HTTP', icon: Globe, color: 'text-purple-400' },
  { value: 'SLACK', label: 'Slack / Teams', icon: MessageSquare, color: 'text-amber-400' },
];
const TRIGGERS = [
  { value: 'ORDER_CREATED', label: 'O.S Criada' },
  { value: 'ORDER_ESCALATED', label: 'O.S Escalonada (SLA)' },
  { value: 'ORDER_CLOSED', label: 'O.S Fechada' },
  { value: 'SLA_BREACH_WARNING', label: 'Aviso de Violação de SLA' },
  { value: 'OCCURRENCE_CREATED', label: 'Ocorrência Criada' },
];

export function NotificationsConfigView({ dark, tenantId, onToast }: { dark: boolean; tenantId: string; onToast: (m: string) => void }) {
  const [configs, setConfigs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', channel: 'EMAIL', trigger: 'ORDER_CREATED', target: '' });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/notifications/config?tenantId=${encodeURIComponent(tenantId)}`, { cache: 'no-store' });
      if (res.ok) setConfigs(await res.json());
    } catch { onToast('Falha ao carregar configurações de notificação.'); }
    finally { setLoading(false); }
  };

  useEffect(() => { if (tenantId) load(); }, [tenantId]);

  const save = async () => {
    if (!form.name.trim() || !form.target.trim()) { onToast('Nome e destino são obrigatórios.'); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/notifications/config', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...form, tenantId }),
      });
      if (!res.ok) throw new Error('Falha ao criar notificação.');
      onToast('Notificação criada!'); setShowForm(false);
      setForm({ name: '', channel: 'EMAIL', trigger: 'ORDER_CREATED', target: '' });
      load();
    } catch (e: any) { onToast(e.message); }
    finally { setSaving(false); }
  };

  const toggle = async (cfg: any) => {
    await fetch(`/api/notifications/config/${cfg.id}?tenantId=${tenantId}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ active: !cfg.active }),
    });
    onToast(`Notificação ${cfg.active ? 'desativada' : 'ativada'}.`); load();
  };

  const remove = async (id: string) => {
    if (!confirm('Remover esta notificação?')) return;
    await fetch(`/api/notifications/config/${id}?tenantId=${tenantId}`, { method: 'DELETE' });
    onToast('Removida.'); load();
  };

  const inputCls = cn('w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40', dark ? 'bg-slate-900 border-slate-700 text-slate-200 placeholder-slate-500' : 'bg-white border-slate-300 text-slate-800');

  const targetPlaceholder = form.channel === 'EMAIL' ? 'noc@empresa.com.br' : form.channel === 'SLACK' ? 'https://hooks.slack.com/services/...' : 'https://sua-api.com/webhook';

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className={cn('text-2xl font-bold', dark ? 'text-white' : 'text-slate-800')}>Notificações Externas</h2>
          <p className={cn('text-sm mt-0.5', dark ? 'text-slate-400' : 'text-slate-500')}>Configure alertas automáticos por Email, Webhook ou Slack para eventos do NOC.</p>
        </div>
        <button onClick={() => setShowForm(true)} className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-semibold shadow-lg shadow-amber-500/20 transition-colors">
          <Plus size={16} /> Nova Notificação
        </button>
      </div>

      {/* How it works */}
      <div className={cn('rounded-xl border p-5 flex gap-4', dark ? 'bg-slate-800/30 border-slate-700/50' : 'bg-amber-50 border-amber-200')}>
        <Zap size={20} className="text-amber-500 flex-shrink-0 mt-0.5" />
        <div>
          <p className={cn('text-sm font-semibold mb-1', dark ? 'text-slate-200' : 'text-slate-800')}>Como funciona?</p>
          <p className={cn('text-xs leading-relaxed', dark ? 'text-slate-400' : 'text-slate-600')}>
            Configure um gatilho (ex: &quot;O.S Criada&quot;) + um canal (Email, Webhook ou Slack). Toda vez que o evento ocorrer no seu tenant, o Ajust ERP enviará automaticamente a notificação para o destino configurado.
          </p>
        </div>
      </div>

      {/* Config List */}
      <div className="space-y-3">
        {loading ? [1, 2].map(i => <div key={i} className={cn('h-20 rounded-xl animate-pulse', dark ? 'bg-slate-800/40' : 'bg-slate-100')} />) :
          configs.length === 0 ? (
            <div className={cn('flex flex-col items-center justify-center py-20 rounded-xl border', dark ? 'bg-slate-800/30 border-slate-700/50' : 'bg-slate-50 border-slate-200')}>
              <Bell size={36} className={cn('mb-3', dark ? 'text-slate-600' : 'text-slate-300')} />
              <p className={cn('text-sm font-medium', dark ? 'text-slate-400' : 'text-slate-500')}>Nenhuma notificação configurada.</p>
            </div>
          ) : configs.map(cfg => {
            const ch = CHANNELS.find(c => c.value === cfg.channel) || CHANNELS[0];
            const tr = TRIGGERS.find(t => t.value === cfg.trigger);
            const ChIcon = ch.icon;
            return (
              <div key={cfg.id} className={cn('rounded-xl border p-4 flex flex-col sm:flex-row sm:items-center gap-4 transition-all', cfg.active ? (dark ? 'bg-slate-800/40 border-slate-700/50' : 'bg-white border-slate-200') : (dark ? 'bg-slate-900/40 border-slate-800 opacity-60' : 'bg-slate-50 border-slate-100 opacity-60'))}>
                <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0', dark ? 'bg-slate-700/50' : 'bg-slate-100')}>
                  <ChIcon size={18} className={ch.color} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={cn('font-semibold text-sm', dark ? 'text-white' : 'text-slate-800')}>{cfg.name}</p>
                  <p className={cn('text-xs mt-0.5', dark ? 'text-slate-400' : 'text-slate-500')}>
                    <span className="font-medium">{tr?.label || cfg.trigger}</span> → <span className="font-mono text-[10px] truncate">{cfg.target}</span>
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => toggle(cfg)} className="text-slate-400 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-white/5">
                    {cfg.active ? <ToggleRight size={22} className="text-emerald-400" /> : <ToggleLeft size={22} />}
                  </button>
                  <button onClick={() => remove(cfg.id)} className="text-rose-400 hover:text-rose-300 p-1.5 rounded-lg hover:bg-rose-500/10 transition-colors">
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            );
          })}
      </div>

      {/* Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowForm(false)} />
          <div className={cn('relative w-full max-w-lg rounded-2xl border shadow-2xl', dark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200')}>
            <div className={cn('px-6 py-4 border-b flex items-center justify-between', dark ? 'border-slate-800' : 'border-slate-100')}>
              <h3 className={cn('font-bold text-lg', dark ? 'text-white' : 'text-slate-800')}>Nova Notificação</h3>
              <button onClick={() => setShowForm(false)} className={cn('p-1.5 rounded', dark ? 'text-slate-400 hover:bg-slate-800' : 'text-slate-400 hover:bg-slate-100')}>✕</button>
            </div>
            <div className="p-6 space-y-4">
              <div><label className={cn('block text-xs font-semibold mb-1.5', dark ? 'text-slate-400' : 'text-slate-600')}>Nome da Notificação *</label><input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Ex: Slack — O.S Crítica" className={inputCls} /></div>
              <div>
                <label className={cn('block text-xs font-semibold mb-2', dark ? 'text-slate-400' : 'text-slate-600')}>Canal</label>
                <div className="grid grid-cols-3 gap-2">
                  {CHANNELS.map(c => {
                    const CIcon = c.icon;
                    return (
                      <button key={c.value} onClick={() => setForm({ ...form, channel: c.value })} className={cn('p-3 rounded-xl border flex flex-col items-center gap-1.5 transition-all text-xs font-semibold', form.channel === c.value ? (dark ? 'bg-blue-600/20 border-blue-500 text-blue-300' : 'bg-blue-50 border-blue-400 text-blue-700') : (dark ? 'border-slate-700 text-slate-400 hover:bg-slate-800' : 'border-slate-200 text-slate-600 hover:bg-slate-50'))}>
                        <CIcon size={18} className={c.color} />
                        {c.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div><label className={cn('block text-xs font-semibold mb-1.5', dark ? 'text-slate-400' : 'text-slate-600')}>Gatilho</label>
                <select value={form.trigger} onChange={e => setForm({ ...form, trigger: e.target.value })} className={cn(inputCls, 'cursor-pointer')}>
                  {TRIGGERS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div><label className={cn('block text-xs font-semibold mb-1.5', dark ? 'text-slate-400' : 'text-slate-600')}>Destino *</label><input value={form.target} onChange={e => setForm({ ...form, target: e.target.value })} placeholder={targetPlaceholder} className={inputCls} /></div>
            </div>
            <div className={cn('px-6 py-4 border-t flex justify-end gap-3', dark ? 'border-slate-800' : 'border-slate-100')}>
              <button onClick={() => setShowForm(false)} className={cn('px-4 py-2 rounded-lg text-sm border', dark ? 'border-slate-700 text-slate-400' : 'border-slate-200 text-slate-600')}>Cancelar</button>
              <button onClick={save} disabled={saving} className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-semibold disabled:opacity-60 flex items-center gap-2">
                {saving && <RefreshCw size={14} className="animate-spin" />} Criar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
