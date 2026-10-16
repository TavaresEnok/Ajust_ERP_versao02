'use client';

import React, { useEffect, useState, useMemo } from 'react';
import {
  Building2,
  Server,
  Network,
  Cpu,
  Key,
  FileText,
  Search,
  Plus,
  ArrowLeft,
  ExternalLink,
  ShieldCheck,
  HardDrive,
  Copy,
  Check,
  RefreshCw,
  Clock,
  Layers,
  Globe,
  Radio,
  Share2,
} from 'lucide-react';

export type ProviderTechnicalProfile = {
  id: string;
  name: string;
  tradeName?: string;
  cnpj?: string;
  city?: string;
  state?: string;
  asNumber?: string;
  ipv4Prefixes?: string[];
  ipv6Prefixes?: string[];
  bgpUpstreams?: string[];
  cgnatType?: string;
  virtualization?: string; // Proxmox, VMware, KVM
  proxmoxNodes?: Array<{ nodeName: string; ip: string; status: string }>;
  oltVendors?: string[];
  routerVendors?: string[];
  erpSystem?: string; // IXC, SGP, MK-Auth, TopSapp
  notes?: string;
};

export type AssetCMDB = {
  id: string;
  name: string;
  category: string;
  status: string;
  description?: string | null;
  location?: string | null;
  serialNumber?: string | null;
  vendor?: string | null;
  tags?: string[];
};

export type KnowledgeCredentialItem = {
  id: string;
  provider: string;
  equipmentType: string;
  equipmentName: string;
  environment: string;
  host: string;
  username: string;
  secretMasked?: string;
  notes?: string | null;
};

type Props = {
  providerName: string;
  onBack: () => void;
  dark?: boolean;
  onOpenOrder?: (orderId: string) => void;
};

export function Provider360Cockpit({
  providerName,
  onBack,
  dark = false,
  onOpenOrder,
}: Props) {
  const [activeTab, setActiveTab] = useState<'infra' | 'assets' | 'credentials' | 'history' | 'notes'>('infra');
  const [loading, setLoading] = useState(false);
  const [assets, setAssets] = useState<AssetCMDB[]>([]);
  const [credentials, setCredentials] = useState<KnowledgeCredentialItem[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Perfil Técnico Mock / Carregado
  const [profile, setProfile] = useState<ProviderTechnicalProfile>({
    id: 'prov-1',
    name: providerName,
    asNumber: 'AS268999',
    ipv4Prefixes: ['187.16.20.0/22', '45.178.4.0/22'],
    ipv6Prefixes: ['2804:4a80::/32'],
    bgpUpstreams: ['Lumen (Trânsito)', 'Telebras (Trânsito)', 'IX.br São Paulo (PTT)'],
    cgnatType: 'A10 Networks Thunder CGNAT (100.64.0.0/10)',
    virtualization: 'Cluster Proxmox VE 8.2 (3 Nodes)',
    proxmoxNodes: [
      { nodeName: 'pve-node-01', ip: '10.100.0.11', status: 'ONLINE' },
      { nodeName: 'pve-node-02', ip: '10.100.0.12', status: 'ONLINE' },
      { nodeName: 'pve-node-03', ip: '10.100.0.13', status: 'ONLINE' },
    ],
    oltVendors: ['Huawei SmartAX MA5800-X7', 'ZTE C300', 'FiberHome AN5516'],
    routerVendors: ['Mikrotik CCR2116-12G-4S+', 'Cisco ASR-1001-X', 'Huawei NE40E'],
    erpSystem: 'IXC Soft (API Integrada)',
    notes: 'Provedor com forte atuação regional em FTTH. Janela de manutenção padrão: 01:00 às 05:00.',
  });

  // Carregar dados de Ativos CMDB e Credenciais
  const loadProviderData = async () => {
    setLoading(true);
    try {
      // 1. Ativos CMDB
      const resAssets = await fetch('/api/cmdb/assets').catch(() => null);
      if (resAssets && resAssets.ok) {
        const data = await resAssets.json();
        if (Array.isArray(data)) {
          setAssets(data);
        }
      }

      // 2. Credenciais Seguras
      const resCreds = await fetch(`/api/knowledge/credentials?provider=${encodeURIComponent(providerName)}`).catch(() => null);
      if (resCreds && resCreds.ok) {
        const data = await resCreds.json();
        if (Array.isArray(data)) {
          setCredentials(data);
        }
      }

      // 3. Ocorrências / Histórico de OS
      const resOcc = await fetch(`/api/occurrences?provider=${encodeURIComponent(providerName)}&includeOrders=true`).catch(() => null);
      if (resOcc && resOcc.ok) {
        const data = await resOcc.json();
        if (Array.isArray(data)) {
          const allOrders = data.flatMap((o) => o.serviceOrders || []);
          setOrders(allOrders);
        }
      }
    } catch (err) {
      console.error('Erro ao carregar dados do provedor:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProviderData();
  }, [providerName]);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(id);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Header com Navegação e Identificação */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold text-lg shadow-md shadow-indigo-500/20">
            {providerName.charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                {providerName}
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                CARTEIRA ATIVA
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              ASN: <span className="font-mono font-semibold text-slate-700 dark:text-slate-300">{profile.asNumber}</span> • ERP:{' '}
              <span className="font-semibold text-slate-700 dark:text-slate-300">{profile.erpSystem}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadProviderData}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Atualizar
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200 dark:border-slate-800 pb-2 text-xs font-semibold overflow-x-auto">
        {[
          { id: 'infra', label: 'Infraestrutura & BGP', icon: Network },
          { id: 'assets', label: `Ativos CMDB (${assets.length})`, icon: Server },
          { id: 'credentials', label: `Cofre de Acessos (${credentials.length})`, icon: Key },
          { id: 'history', label: `Histórico de O.S. (${orders.length})`, icon: Clock },
          { id: 'notes', label: 'Documentação & Notas', icon: FileText },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl transition ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Icon size={15} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab 1: Infraestrutura & BGP */}
      {activeTab === 'infra' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Card Roteamento e ASN */}
          <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/50 space-y-4">
            <div className="flex items-center gap-2 font-bold text-sm text-slate-900 dark:text-slate-100">
              <Globe size={18} className="text-indigo-600 dark:text-indigo-400" />
              Roteamento BGP & Blocos IP
            </div>
            <div className="space-y-3 text-xs">
              <div>
                <span className="text-slate-400 block font-medium">ASN Autônomo:</span>
                <span className="font-mono text-sm font-bold text-indigo-600 dark:text-indigo-400">
                  {profile.asNumber}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block font-medium">Blocos IPv4 Anunciados:</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {profile.ipv4Prefixes?.map((p, i) => (
                    <span key={i} className="font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200">
                      {p}
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <span className="text-slate-400 block font-medium">Bloco IPv6:</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {profile.ipv6Prefixes?.map((p, i) => (
                    <span key={i} className="font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200">
                      {p}
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <span className="text-slate-400 block font-medium">Trânsito IP / PTT:</span>
                <ul className="list-disc list-inside mt-1 space-y-0.5 text-slate-700 dark:text-slate-300">
                  {profile.bgpUpstreams?.map((u, i) => (
                    <li key={i}>{u}</li>
                  ))}
                </ul>
              </div>
              <div>
                <span className="text-slate-400 block font-medium">CGNAT:</span>
                <span className="font-mono text-slate-700 dark:text-slate-300">{profile.cgnatType}</span>
              </div>
            </div>
          </div>

          {/* Card Virtualização Proxmox & Acesso */}
          <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/50 space-y-4">
            <div className="flex items-center gap-2 font-bold text-sm text-slate-900 dark:text-slate-100">
              <Cpu size={18} className="text-indigo-600 dark:text-indigo-400" />
              Ambiente de Virtualização (Proxmox VE)
            </div>
            <div className="space-y-3 text-xs">
              <div>
                <span className="text-slate-400 block font-medium">Topologia:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">{profile.virtualization}</span>
              </div>
              <div className="space-y-1.5">
                <span className="text-slate-400 block font-medium">Nodes do Cluster:</span>
                {profile.proxmoxNodes?.map((node, i) => (
                  <div key={i} className="flex justify-between items-center p-2 rounded-lg bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-700">
                    <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">{node.nodeName}</span>
                    <span className="font-mono text-slate-500">{node.ip}</span>
                    <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                      {node.status}
                    </span>
                  </div>
                ))}
              </div>
              <div>
                <span className="text-slate-400 block font-medium">Fabricantes de OLT / FTTH:</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {profile.oltVendors?.map((v, i) => (
                    <span key={i} className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200">
                      {v}
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <span className="text-slate-400 block font-medium">Roteadores de Borda / Concentradores:</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {profile.routerVendors?.map((v, i) => (
                    <span key={i} className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200">
                      {v}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Ativos CMDB */}
      {activeTab === 'assets' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
              Equipamentos e Serviços Registrados
            </h3>
          </div>
          {assets.length === 0 ? (
            <div className="p-8 text-center border border-dashed rounded-2xl border-slate-300 dark:border-slate-700 text-slate-500 text-sm">
              Nenhum ativo CMDB vinculado a este provedor no momento.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {assets.map((a) => (
                <div key={a.id} className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/40 space-y-2">
                  <div className="flex justify-between items-start">
                    <span className="font-bold text-sm text-slate-900 dark:text-slate-100">{a.name}</span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                      {a.category}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    {a.description || 'Sem descrição cadastrada.'}
                  </p>
                  <div className="text-[11px] text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-700 flex justify-between">
                    <span>Local: {a.location || 'POP Central'}</span>
                    <span>Status: {a.status}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Cofre de Credenciais */}
      {activeTab === 'credentials' && (
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 text-xs text-amber-900 dark:text-amber-200 flex items-center gap-2">
            <ShieldCheck size={16} />
            <span>
              Acessos protegidos com criptografia AES-256. Todo acesso aos segredos é auditado pelo sistema.
            </span>
          </div>

          {credentials.length === 0 ? (
            <div className="p-8 text-center border border-dashed rounded-2xl border-slate-300 dark:border-slate-700 text-slate-500 text-sm">
              Nenhuma credencial segura cadastrada para este provedor.
            </div>
          ) : (
            <div className="divide-y divide-slate-200 dark:divide-slate-800 border rounded-2xl overflow-hidden bg-white dark:bg-slate-800/40">
              {credentials.map((c) => (
                <div key={c.id} className="p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 text-xs">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-slate-900 dark:text-slate-100">
                        {c.equipmentName || c.equipmentType}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-[10px] font-mono text-slate-600 dark:text-slate-300">
                        {c.environment}
                      </span>
                    </div>
                    <div className="text-slate-500 mt-1 font-mono">
                      Host: {c.host} • Usuário: <span className="font-bold text-slate-700 dark:text-slate-200">{c.username}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => copyToClipboard(c.host, c.id)}
                      className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 text-[11px] font-semibold flex items-center gap-1"
                    >
                      {copiedKey === c.id ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
                      Copiar Host
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 4: Histórico de O.S. */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          {orders.length === 0 ? (
            <div className="p-8 text-center border border-dashed rounded-2xl border-slate-300 dark:border-slate-700 text-slate-500 text-sm">
              Nenhuma ordem de serviço registrada para este provedor.
            </div>
          ) : (
            <div className="border rounded-2xl overflow-hidden divide-y divide-slate-200 dark:divide-slate-800 bg-white dark:bg-slate-800/40">
              {orders.map((o) => (
                <div
                  key={o.id}
                  onClick={() => onOpenOrder && onOpenOrder(o.id)}
                  className="p-4 hover:bg-slate-50 dark:hover:bg-slate-700/30 cursor-pointer transition flex justify-between items-center text-xs"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
                        #{o.protocol}
                      </span>
                      <span className="font-semibold text-slate-900 dark:text-slate-100">
                        {o.type}
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                        {o.status}
                      </span>
                    </div>
                    <p className="text-slate-500 mt-1 line-clamp-1">{o.description}</p>
                  </div>
                  <div className="text-right text-slate-400">
                    <div>{o.analystName || 'Sem analista'}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 5: Documentação & Notas */}
      {activeTab === 'notes' && (
        <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/50 space-y-4">
          <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <FileText size={18} className="text-indigo-600" />
            Anotações Livres & Procedimentos Específicos
          </h3>
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-sm leading-relaxed text-slate-800 dark:text-slate-200 whitespace-pre-wrap font-sans">
            {profile.notes}
          </div>
        </div>
      )}
    </div>
  );
}
