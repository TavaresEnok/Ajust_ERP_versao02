'use client';

import React, { useState } from 'react';
import {
  Zap,
  Clock,
  AlertTriangle,
  Building2,
  User,
  FileText,
  Calendar,
  X,
  CheckCircle,
  HelpCircle,
} from 'lucide-react';

export type QuickDispatchPayload = {
  provider: string;
  type: string;
  priority: 'BAIXA' | 'NORMAL' | 'ALTA' | 'CRITICA';
  urgencyLevel: 'EMERGENCIAL' | '24H' | '48H' | '72H' | 'CUSTOM';
  analystResponsible: string;
  description: string;
  openedByName: string;
  origin: string;
  sector: string;
  directResolution?: boolean;
};

type Props = {
  providersList: string[];
  analystsList: string[];
  currentUser: string;
  onClose: () => void;
  onSubmit: (payload: QuickDispatchPayload) => Promise<void>;
  dark?: boolean;
};

type CatalogItem = {
  id: string;
  name: string;
  category: string;
  description?: string;
  estimatedMinutes?: number;
  defaultPriority?: string;
  checklist?: string[];
  active: boolean;
};

const SERVICE_TEMPLATES = [
  { type: 'DNS', label: 'Servidor DNS Recursivo (Unbound/Bind)', defaultUrgency: '24H', priority: 'ALTA' },
  { type: 'PROXMOX', label: 'Cluster Proxmox VE (HA / ZFS / Storage)', defaultUrgency: '48H', priority: 'ALTA' },
  { type: 'BGP', label: 'Incidente / Sessão BGP Down', defaultUrgency: 'EMERGENCIAL', priority: 'CRITICA' },
  { type: 'FIREWALL', label: 'Firewall de Borda / Proteção DDoS', defaultUrgency: '24H', priority: 'ALTA' },
  { type: 'ROTEAMENTO_CGNAT', label: 'Implantação / Otimização CGNAT', defaultUrgency: '24H', priority: 'ALTA' },
  { type: 'ROMPIMENTO', label: 'Rompimento de Fibra / Link', defaultUrgency: 'EMERGENCIAL', priority: 'CRITICA' },
  { type: 'LENTIDAO', label: 'Lentidão Massiva / Degradação', defaultUrgency: '24H', priority: 'ALTA' },
  { type: 'CONFIGURACAO_ONU', label: 'Provisionamento OLT & ONU', defaultUrgency: '48H', priority: 'NORMAL' },
  { type: 'AUDITORIA', label: 'Auditoria Geral de Topologia', defaultUrgency: '72H', priority: 'NORMAL' },
  { type: 'INFRAESTRUTURA', label: 'Infraestrutura / Datacenter / Nobreak', defaultUrgency: '24H', priority: 'NORMAL' },
  { type: 'CONSULTORIA_GERAL', label: 'Consultoria Especializada ISP', defaultUrgency: '72H', priority: 'NORMAL' },
  { type: 'TROCA_SENHA', label: 'Atendimento Rápido / Suporte N1', defaultUrgency: '24H', priority: 'NORMAL' },
] as const;

export function QuickDispatchModal({
  providersList,
  analystsList,
  currentUser,
  onClose,
  onSubmit,
  dark = false,
}: Props) {
  const [provider, setProvider] = useState(providersList[0] || '');
  const [customProvider, setCustomProvider] = useState('');
  const [type, setType] = useState('DNS');
  const [urgency, setUrgency] = useState<'EMERGENCIAL' | '24H' | '48H' | '72H' | 'CUSTOM'>('24H');
  const [priority, setPriority] = useState<'BAIXA' | 'NORMAL' | 'ALTA' | 'CRITICA'>('ALTA');
  const [analyst, setAnalyst] = useState(analystsList[0] || '');
  const [description, setDescription] = useState('');
  const [isDirectResolution, setIsDirectResolution] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([]);
  const [selectedCatalogId, setSelectedCatalogId] = useState('');

  // Carrega catálogo de serviços configurável
  React.useEffect(() => {
    fetch('/api/service-catalog')
      .then((r) => (r.ok ? r.json() : []))
      .then((items) => {
        if (Array.isArray(items)) setCatalogItems(items);
      })
      .catch(() => {});
  }, []);

  const handleTemplateSelect = (tmpl: (typeof SERVICE_TEMPLATES)[number]) => {
    setType(tmpl.type);
    setUrgency(tmpl.defaultUrgency as any);
    setPriority(tmpl.priority as any);
  };

  const handleCatalogSelect = (item: CatalogItem) => {
    setSelectedCatalogId(item.id);
    setType(item.category || 'CONSULTORIA_GERAL');
    setPriority((item.defaultPriority as any) || 'NORMAL');
    setUrgency('24H');
    let desc = item.description ? `${item.description}\n\n` : '';
    if (item.checklist && item.checklist.length > 0) {
      desc += 'Checklist Técnico:\n' + item.checklist.map((c) => `- [ ] ${c}`).join('\n');
    }
    setDescription(desc);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalProvider = provider === '__CUSTOM__' ? customProvider.trim() : provider;
    if (!finalProvider) return alert('Por favor, informe o provedor solicitante.');
    if (!description.trim()) return alert('Por favor, descreva a atividade.');

    setIsSubmitting(true);
    try {
      await onSubmit({
        provider: finalProvider,
        type,
        priority,
        urgencyLevel: urgency,
        analystResponsible: isDirectResolution ? currentUser : analyst,
        description,
        openedByName: currentUser || 'Atendente NOC',
        origin: 'Chat NOC',
        sector: 'Suporte Avançado',
        directResolution: isDirectResolution,
      });
      onClose();
    } catch (err: any) {
      alert(`Falha ao registrar: ${err?.message || 'Erro desconhecido'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm overflow-y-auto">
      <div
        className={`relative w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden my-8 ${
          dark ? 'bg-slate-900 border border-slate-700 text-slate-100' : 'bg-white text-slate-900'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60">
          <div className="flex items-center gap-2">
            <Zap className="text-amber-500" size={20} />
            <div>
              <h3 className="font-bold text-base">Nova Triagem de Atendimento & O.S.</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Atendimento N1 imediato ou abertura com SLA automático
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="p-2 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-700 transition"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Alternador N1 Imediato vs Ordem de Serviço */}
          <div className="flex p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setIsDirectResolution(false)}
              className={`flex-1 py-2.5 rounded-lg flex items-center justify-center gap-2 transition ${
                !isDirectResolution
                  ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <FileText size={15} />
              Demanda Especializada / Abrir O.S.
            </button>
            <button
              type="button"
              onClick={() => setIsDirectResolution(true)}
              className={`flex-1 py-2.5 rounded-lg flex items-center justify-center gap-2 transition ${
                isDirectResolution
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <CheckCircle size={15} />
              Atendimento Simples (Resolvido Imediatamente)
            </button>
          </div>

          {/* Provedor Solicitante */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
              Provedor Solicitante
            </label>
            <select
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {providersList.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
              <option value="__CUSTOM__">+ Outro Provedor...</option>
            </select>
            {provider === '__CUSTOM__' && (
              <input
                type="text"
                placeholder="Nome do provedor..."
                value={customProvider}
                onChange={(e) => setCustomProvider(e.target.value)}
                className="mt-2 w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                required
              />
            )}
          </div>

          {/* Tipos pré-mapeados (Templates com SLA) */}
          {!isDirectResolution && (
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                Modelos de Procedimento & Prazos Pré-Mapeados
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {SERVICE_TEMPLATES.map((tmpl) => (
                  <button
                    key={tmpl.type}
                    type="button"
                    onClick={() => handleTemplateSelect(tmpl)}
                    className={`text-left p-2.5 rounded-xl border text-xs transition ${
                      type === tmpl.type
                        ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300 font-semibold'
                        : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <div className="truncate">{tmpl.label}</div>
                    <span className="text-[10px] text-slate-400 block mt-0.5 font-mono">
                      {tmpl.defaultUrgency} • {tmpl.priority}
                    </span>
                  </button>
                ))}
              </div>

              {/* Catálogo de Serviços Padronizados (Consultoria de ISPs) */}
              {catalogItems.length > 0 && (
                <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                      ⚡ Catálogo Especializado para Provedores
                    </label>
                    <span className="text-[10px] text-slate-400">
                      Preenche checklist e SLA automaticamente
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {catalogItems.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => handleCatalogSelect(c)}
                        className={`text-xs px-2.5 py-1.5 rounded-lg border transition ${
                          selectedCatalogId === c.id
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                            : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-indigo-400 text-slate-700 dark:text-slate-200'
                        }`}
                      >
                        {c.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* SLA e Prazo */}
          {!isDirectResolution && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                  Prazo de Execução (SLA)
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  {(['EMERGENCIAL', '24H', '48H', '72H'] as const).map((u) => (
                    <button
                      key={u}
                      type="button"
                      onClick={() => setUrgency(u)}
                      className={`py-2 px-3 rounded-lg border text-xs font-semibold transition ${
                        urgency === u
                          ? u === 'EMERGENCIAL'
                            ? 'bg-red-500 text-white border-red-500 shadow-sm'
                            : 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                          : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      {u === 'EMERGENCIAL' ? '🚨 Emergencial' : u}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                  Analista Responsável
                </label>
                <select
                  value={analyst}
                  onChange={(e) => setAnalyst(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">A definir / Fila Geral</option>
                  {analystsList.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Descrição Detalhada */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
              {isDirectResolution
                ? 'Procedimento Realizado (Registro do Atendimento N1)'
                : 'Descrição Completa da Demanda / Problema'}
            </label>
            <textarea
              rows={4}
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={
                isDirectResolution
                  ? 'Ex: Cliente informou lentidão na ONU 1/2. Realizada verificação de potência óptica (-18 dBm) e reinicializado o perfil via console. Normalizado.'
                  : 'Descreva detalhadamente o problema ou solicitação, equipamentos envolvidos, IPs e escopo para que o analista execute sem dúvidas.'
              }
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 leading-relaxed font-sans"
            />
          </div>

          {/* Footer Actions */}
          <div className="flex justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className={`px-5 py-2.5 rounded-xl text-xs font-bold text-white shadow-md transition flex items-center gap-2 ${
                isDirectResolution
                  ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20'
                  : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-500/20'
              }`}
            >
              {isSubmitting ? (
                <span>Gravando...</span>
              ) : isDirectResolution ? (
                <>
                  <CheckCircle size={15} />
                  Concluir Atendimento N1
                </>
              ) : (
                <>
                  <Zap size={15} />
                  Gerar Ordem de Serviço
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
