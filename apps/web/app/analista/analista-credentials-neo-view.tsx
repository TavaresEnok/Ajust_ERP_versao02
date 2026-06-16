'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  AlignLeft,
  Clock,
  Copy,
  Eye,
  EyeOff,
  Globe,
  Key,
  Network,
  Search,
  Server,
  Shield,
  Cpu,
  AppWindow,
  ArrowRightLeft,
  Edit2,
  X,
} from 'lucide-react';

const cn = (...classes: Array<string | false | null | undefined>) =>
  classes.filter(Boolean).join(' ');

type CredentialItem = {
  id: string;
  provider: string;
  equipmentType: string;
  equipmentName: string;
  host: string;
  username: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
  secret?: string;
};

type SessionMeResponse = {
  tenant?: {
    id?: string | number | null;
  } | null;
};

type CredentialApiRow = {
  id: string | number;
  provider?: string | null;
  equipmentType?: string | null;
  equipmentName?: string | null;
  host?: string | null;
  username?: string | null;
  user?: string | null;
  notes?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

type CredentialListPayload =
  | CredentialApiRow[]
  | { items?: CredentialApiRow[]; data?: CredentialApiRow[] };

type ProviderApiRow = {
  provider?: string | null;
};

type RevealSecretResponse = {
  secret?: string | null;
  error?: string | null;
};

const TYPE_META: Record<
  string,
  {
    icon: React.ComponentType<{ size?: number; className?: string }>;
    chip: string;
    iconColor: string;
  }
> = {
  DNS: {
    icon: Globe,
    chip: 'bg-purple-500/10 text-purple-300 border-purple-500/20',
    iconColor: 'text-purple-300',
  },
  OLT: {
    icon: Network,
    chip: 'bg-blue-500/10 text-blue-300 border-blue-500/20',
    iconColor: 'text-blue-300',
  },
  FIREWALL: {
    icon: Shield,
    chip: 'bg-red-500/10 text-red-300 border-red-500/20',
    iconColor: 'text-red-300',
  },
  ROUTER: {
    icon: Server,
    chip: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
    iconColor: 'text-emerald-300',
  },
  SW: {
    icon: ArrowRightLeft,
    chip: 'bg-cyan-500/10 text-cyan-300 border-cyan-500/20',
    iconColor: 'text-cyan-300',
  },
  SISTEMA: {
    icon: AppWindow,
    chip: 'bg-pink-500/10 text-pink-300 border-pink-500/20',
    iconColor: 'text-pink-300',
  },
  VM: {
    icon: Cpu,
    chip: 'bg-amber-500/10 text-amber-300 border-amber-500/20',
    iconColor: 'text-amber-300',
  },
  OUTROS: {
    icon: Server,
    chip: 'bg-slate-500/10 text-slate-200 border-slate-500/20',
    iconColor: 'text-slate-300',
  },
};

const mapType = (value: string) => {
  const normalized = String(value || '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();
  if (!normalized) return 'OUTROS';
  if (normalized.includes('SWITCH')) return 'SW';
  if (normalized.includes('ROTEADOR')) return 'ROUTER';
  return TYPE_META[normalized] ? normalized : 'OUTROS';
};

const formatDateTime = (iso?: string) => {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleString('pt-BR');
};

const createNeoDemoCredentials = (): CredentialItem[] => {
  const now = Date.now();
  const hour = 60 * 60 * 1000;
  const rows: Array<Omit<CredentialItem, 'createdAt' | 'updatedAt'>> = [
    {
      id: 'demo-neo-001',
      provider: 'Meganet',
      equipmentType: 'ROUTER',
      equipmentName: 'RTR-BORDA-REC-01',
      host: '10.10.0.1',
      username: 'noc-admin',
      secret: 'Demo@Borda2026',
      notes:
        'Borda principal Recife. Validar rotas BGP antes de aplicar alteracoes em horario comercial.',
    },
    {
      id: 'demo-neo-002',
      provider: 'Meganet',
      equipmentType: 'DNS',
      equipmentName: 'DNS-AUTH-01',
      host: '10.10.2.10',
      username: 'dnsops',
      secret: 'Dns#Meganet26',
      notes: 'Servidor autoritativo. Reiniciar named somente apos validar serial da zona.',
    },
    {
      id: 'demo-neo-003',
      provider: 'Meganet',
      equipmentType: 'SW',
      equipmentName: 'SW-CORE-POP-BOA-VISTA',
      host: '10.10.4.2',
      username: 'admin',
      secret: 'SwCore@2605',
      notes: 'Switch core do POP Boa Vista. Uplinks nas portas 47/48.',
    },
    {
      id: 'demo-neo-004',
      provider: 'UltraFibra',
      equipmentType: 'FIREWALL',
      equipmentName: 'FW-EDGE-JAB-01',
      host: '172.16.10.1',
      username: 'secops',
      secret: 'UltraFW#2026',
      notes: 'Firewall de borda. Backup de configuracao automatico todo domingo.',
    },
    {
      id: 'demo-neo-005',
      provider: 'UltraFibra',
      equipmentType: 'OLT',
      equipmentName: 'OLT-POP-CANDEIAS-01',
      host: '172.16.20.10',
      username: 'admin',
      secret: 'OltUltra@01',
      notes:
        'Credencial tecnica para consulta. Alteracoes de provisionamento devem seguir O.S aprovada.',
    },
    {
      id: 'demo-neo-006',
      provider: 'UltraFibra',
      equipmentType: 'SISTEMA',
      equipmentName: 'Zabbix UltraFibra',
      host: 'monitor.ultrafibra.local',
      username: 'ajust-noc',
      secret: 'ZbxUltra#2605',
      notes: 'Usar para validacao de triggers, mapas e manutencoes planejadas.',
    },
    {
      id: 'demo-neo-007',
      provider: 'MaximaNet',
      equipmentType: 'ROUTER',
      equipmentName: 'RTR-CGNAT-CABO-01',
      host: '10.30.0.5',
      username: 'netadmin',
      secret: 'CgnatMax@26',
      notes: 'Equipamento CGNAT. Conferir consumo de pools antes de reiniciar servicos.',
    },
    {
      id: 'demo-neo-008',
      provider: 'MaximaNet',
      equipmentType: 'VM',
      equipmentName: 'VM-BACKUP-CONFIGS',
      host: '10.30.9.20',
      username: 'backup',
      secret: 'BkpCfg#Max26',
      notes: 'Armazena backups automaticos de roteadores, switches e firewalls.',
    },
    {
      id: 'demo-neo-009',
      provider: 'MaximaNet',
      equipmentType: 'SISTEMA',
      equipmentName: 'Jump Server NOC',
      host: 'jump.maximanet.local',
      username: 'ajust.ops',
      secret: 'Jump@Maxima2605',
      notes: 'Acesso intermediario para equipamentos restritos. Registrar atividade na O.S.',
    },
    {
      id: 'demo-neo-010',
      provider: 'Meganet',
      equipmentType: 'VM',
      equipmentName: 'VM-LOGS-RSYSLOG',
      host: '10.10.9.15',
      username: 'logops',
      secret: 'Logs@Mega26',
      notes: 'Servidor de logs centralizados. Consultar antes de escalonar incidentes recorrentes.',
    },
  ];

  return rows.map((row, index) => ({
    ...row,
    createdAt: new Date(now - (index + 12) * hour).toISOString(),
    updatedAt: new Date(now - (index + 1) * hour).toISOString(),
  }));
};

type Props = {
  dark: boolean;
  onToast: (message: string) => void;
  allowDemoData?: boolean;
};

export function AnalystCredentialsNeoView({ dark, onToast, allowDemoData = false }: Props) {
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [demoData, setDemoData] = useState(false);
  const [items, setItems] = useState<CredentialItem[]>([]);
  const [providerFilter, setProviderFilter] = useState('Todos');
  const [typeFilter, setTypeFilter] = useState('Todos');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [visibleSecret, setVisibleSecret] = useState<Record<string, boolean>>({});
  const [revealedSecret, setRevealedSecret] = useState<Record<string, string>>({});
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showModalSecret, setShowModalSecret] = useState(false);
  const [fetchingSecret, setFetchingSecret] = useState(false);
  const [formData, setFormData] = useState({
    id: '',
    equipmentName: '',
    host: '',
    username: '',
    secret: '',
    notes: '',
  });

  useEffect(() => {
    let active = true;
    const mapRows = (rows: CredentialApiRow[]): CredentialItem[] =>
      rows.map((row) => ({
        id: String(row.id),
        provider: String(row.provider || 'Sem provedor'),
        equipmentType: mapType(String(row.equipmentType || 'OUTROS')),
        equipmentName: String(row.equipmentName || row.host || '-'),
        host: String(row.host || '-'),
        username: String(row.username || row.user || 'NAO_INFORMADO'),
        notes: String(row.notes || ''),
        createdAt: String(row.createdAt || ''),
        updatedAt: String(row.updatedAt || ''),
        secret: '••••••••••••',
      }));

    const normalizeList = (
      payload: CredentialListPayload | ProviderApiRow[] | null | undefined,
    ): Array<CredentialApiRow | ProviderApiRow> => {
      if (Array.isArray(payload)) return payload;
      if (Array.isArray(payload?.items)) return payload.items;
      if (Array.isArray(payload?.data)) return payload.data;
      return [];
    };

    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const meRes = await fetch('/api/auth/me', { cache: 'no-store' });
        if (!meRes.ok) throw new Error('Falha ao obter sessão.');
        const me: SessionMeResponse = await meRes.json();
        const tenant = String(me?.tenant?.id || '');
        if (!tenant) throw new Error('Tenant não encontrado.');
        if (!active) return;
        setTenantId(tenant);

        const providersRes = await fetch(
          `/api/knowledge/credentials/providers?tenantId=${encodeURIComponent(tenant)}&limit=500&offset=0`,
          { cache: 'no-store' },
        );
        const providersPayload: ProviderApiRow[] | CredentialListPayload = providersRes.ok
          ? await providersRes.json().catch(() => ({}) as CredentialListPayload)
          : [];
        const dynamicProviders = normalizeList(providersPayload)
          .map((p) => String(p?.provider || '').trim())
          .filter(Boolean);
        const providers = Array.from(
          new Set(['Meganet', 'UltraFibra', 'MaximaNet', ...dynamicProviders]),
        );

        const fetchAllByProvider = async (provider: string) => {
          const acc: CredentialApiRow[] = [];
          const pageSize = 200;
          let offset = 0;
          let loops = 0;
          while (loops < 20) {
            const params = new URLSearchParams({
              tenantId: tenant,
              provider,
              sortBy: 'equipmentName',
              sortDir: 'asc',
              limit: String(pageSize),
              offset: String(offset),
            });
            const response = await fetch(`/api/knowledge/credentials?${params.toString()}`, {
              cache: 'no-store',
            });
            if (!response.ok) break;
            const payload: CredentialListPayload = await response
              .json()
              .catch(() => ({}) as CredentialListPayload);
            const pageItems = normalizeList(payload) as CredentialApiRow[];
            if (!pageItems.length) break;
            acc.push(...pageItems);
            if (pageItems.length < pageSize) break;
            offset += pageSize;
            loops += 1;
          }
          return acc;
        };

        const byProviderResponses = await Promise.all(
          providers.map(async (provider) => fetchAllByProvider(provider)),
        );
        const mapped = mapRows(byProviderResponses.flat());

        if (!active) return;
        if (mapped.length > 0) {
          setItems(mapped);
          setDemoData(false);
          return;
        }
        if (allowDemoData) {
          setItems(createNeoDemoCredentials());
          setDemoData(true);
        } else {
          setItems([]);
          setDemoData(false);
        }
      } catch (e: unknown) {
        if (!active) return;
        const message = e instanceof Error ? e.message : 'Falha ao carregar credenciais.';
        setError(message);
        onToast(message);
        if (allowDemoData) {
          setItems(createNeoDemoCredentials());
          setDemoData(true);
        } else {
          setItems([]);
          setDemoData(false);
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    load();
    return () => {
      active = false;
    };
  }, [allowDemoData, onToast]);

  const providerOptions = useMemo(() => {
    const fixed = ['Meganet', 'UltraFibra', 'MaximaNet'];
    const dynamic = Array.from(new Set(items.map((item) => item.provider))).sort((a, b) =>
      a.localeCompare(b, 'pt-BR'),
    );
    const merged = Array.from(new Set([...fixed, ...dynamic]));
    return ['Todos', ...merged];
  }, [items]);
  const typeOptions = useMemo(
    () => [
      'Todos',
      ...Array.from(new Set(items.map((item) => item.equipmentType))).sort((a, b) =>
        a.localeCompare(b, 'pt-BR'),
      ),
    ],
    [items],
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return items.filter((item) => {
      const byProvider = providerFilter === 'Todos' || item.provider === providerFilter;
      const byType = typeFilter === 'Todos' || item.equipmentType === typeFilter;
      const bySearch =
        !q ||
        `${item.equipmentName} ${item.host} ${item.username} ${item.notes}`
          .toLowerCase()
          .includes(q);
      return byProvider && byType && bySearch;
    });
  }, [items, providerFilter, typeFilter, search]);

  const grouped = useMemo(() => {
    const map = new Map<string, CredentialItem[]>();
    filtered.forEach((item) => {
      if (!map.has(item.equipmentType)) map.set(item.equipmentType, []);
      map.get(item.equipmentType)!.push(item);
    });
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered]);

  useEffect(() => {
    if (!filtered.length) {
      setSelectedId(null);
      return;
    }
    if (!selectedId || !filtered.some((item) => item.id === selectedId)) {
      setSelectedId(filtered[0].id);
    }
  }, [filtered, selectedId]);

  const selected = filtered.find((item) => item.id === selectedId) || null;

  const summary = useMemo(() => {
    const providers = new Set(items.map((item) => item.provider));
    const types = new Set(items.map((item) => item.equipmentType));
    const visibleProviders = new Set(filtered.map((item) => item.provider));
    const latest = items
      .map((item) => new Date(item.updatedAt).getTime())
      .filter((ts) => Number.isFinite(ts))
      .sort((a, b) => b - a)[0];

    return {
      total: items.length,
      visible: filtered.length,
      providers: providers.size,
      visibleProviders: visibleProviders.size,
      types: types.size,
      latest: latest ? formatDateTime(new Date(latest).toISOString()) : '-',
    };
  }, [items, filtered]);

  const clearFilters = () => {
    setSearch('');
    setProviderFilter('Todos');
    setTypeFilter('Todos');
  };

  const getSecretText = (credential: CredentialItem) => {
    if (visibleSecret[credential.id])
      return revealedSecret[credential.id] || credential.secret || '';
    return '••••••••••••';
  };

  const copyText = async (rawText: string) => {
    const text = String(rawText || '');
    if (!text) return;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        textArea.remove();
      }
      onToast('Copiado para área de transferência.');
    } catch {
      onToast('Não foi possível copiar.');
    }
  };

  const toggleSecret = async (credential: CredentialItem) => {
    if (!tenantId) return;
    if (visibleSecret[credential.id]) {
      setVisibleSecret((prev) => ({ ...prev, [credential.id]: false }));
      return;
    }
    if (credential.id.startsWith('demo-')) {
      setRevealedSecret((prev) => ({ ...prev, [credential.id]: credential.secret || '' }));
      setVisibleSecret((prev) => ({ ...prev, [credential.id]: true }));
      return;
    }
    if (!revealedSecret[credential.id]) {
      const res = await fetch(
        `/api/knowledge/credentials/${encodeURIComponent(credential.id)}/reveal?tenantId=${encodeURIComponent(tenantId)}`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
        },
      );
      const payload: RevealSecretResponse = await res.json().catch(() => ({}));
      if (!res.ok) {
        onToast(payload?.error || 'Falha ao revelar senha.');
        return;
      }
      setRevealedSecret((prev) => ({ ...prev, [credential.id]: String(payload?.secret || '') }));
    }
    setVisibleSecret((prev) => ({ ...prev, [credential.id]: true }));
  };

  const openEditModal = (credential: CredentialItem) => {
    setFormData({
      id: credential.id,
      equipmentName: credential.equipmentName,
      host: credential.host,
      username: credential.username === 'NAO_INFORMADO' ? '' : credential.username || '',
      secret: '••••••••••••',
      notes: credential.notes || '',
    });
    setShowModalSecret(false);
    setIsEditModalOpen(true);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantId) return;
    setSaving(true);
    const secretToSave = formData.secret === '••••••••••••' ? undefined : formData.secret;

    try {
      const url = `/api/knowledge/credentials/${formData.id}`;
      const res = await fetch(url, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          tenantId,
          equipmentName: formData.equipmentName,
          host: formData.host,
          username: formData.username,
          secret: secretToSave,
          notes: formData.notes,
        }),
      });

      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        onToast(payload?.error || 'Erro ao salvar alterações na credencial.');
      } else {
        onToast('Credencial atualizada com sucesso!');
        setIsEditModalOpen(false);
        setItems((prev) =>
          prev.map((item) => {
            if (item.id === formData.id) {
              return {
                ...item,
                equipmentName: formData.equipmentName,
                host: formData.host,
                username: formData.username || 'NAO_INFORMADO',
                notes: formData.notes,
                updatedAt: new Date().toISOString(),
              };
            }
            return item;
          }),
        );
        if (formData.secret) {
          setRevealedSecret((prev) => ({ ...prev, [formData.id]: formData.secret }));
          setVisibleSecret((prev) => ({ ...prev, [formData.id]: true }));
        }
      }
    } catch (err) {
      onToast('Falha na comunicação.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col xl:flex-row xl:items-end xl:justify-between gap-4">
        <div>
          <h2
            className={cn(
              'text-2xl font-bold tracking-tight',
              dark ? 'text-white' : 'text-slate-900',
            )}
          >
            Cofre Neo
          </h2>
          <p className={cn('text-sm mt-1', dark ? 'text-slate-300' : 'text-slate-600')}>
            Credenciais operacionais organizadas por provedor, tipo de ativo e equipamento.
          </p>
        </div>
        <div
          className={cn(
            'inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs',
            dark
              ? 'bg-[#111827] border-slate-700 text-slate-300'
              : 'bg-white border-slate-200 text-slate-600',
          )}
        >
          <Key size={14} />
          {demoData ? 'Modo demonstracao' : 'Base real'}
        </div>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-5 gap-3">
        {[
          { label: 'Credenciais', value: summary.total },
          { label: 'Visiveis', value: summary.visible },
          { label: 'Provedores', value: summary.providers },
          { label: 'Tipos', value: summary.types },
          {
            label: 'Ultima atualização',
            value: summary.latest === '-' ? '-' : summary.latest.slice(0, 16),
          },
        ].map((item) => (
          <div
            key={item.label}
            className={cn(
              'rounded-xl border p-4',
              dark ? 'bg-[#111827] border-slate-700' : 'bg-white border-slate-200 shadow-sm',
            )}
          >
            <div
              className={cn(
                'text-[11px] font-bold uppercase tracking-wide',
                dark ? 'text-slate-400' : 'text-slate-500',
              )}
            >
              {item.label}
            </div>
            <div
              className={cn(
                'mt-1 text-2xl font-bold tabular-nums break-words',
                dark ? 'text-white' : 'text-slate-900',
              )}
            >
              {item.value}
            </div>
          </div>
        ))}
      </div>

      <div
        className={cn(
          'border rounded-2xl p-4 space-y-4',
          dark ? 'bg-[#111827] border-slate-700' : 'bg-white border-slate-200 shadow-sm',
        )}
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div>
            <div
              className={cn('text-sm font-semibold', dark ? 'text-slate-100' : 'text-slate-800')}
            >
              Busca e segmentação
            </div>
            <div className={cn('text-xs mt-1', dark ? 'text-slate-400' : 'text-slate-500')}>
              Filtre por provedor, tipo de ativo e texto livre.
            </div>
          </div>
          <div
            className={cn(
              'inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs border',
              dark
                ? 'bg-[#0f172a] border-slate-700 text-slate-300'
                : 'bg-slate-50 border-slate-200 text-slate-600',
            )}
          >
            <Shield size={12} />
            Inventário operacional centralizado
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_220px_170px_auto] gap-3">
          <div className="relative">
            <Search
              size={16}
              className={cn(
                'absolute left-3 top-1/2 -translate-y-1/2',
                dark ? 'text-slate-400' : 'text-slate-500',
              )}
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar equipamento, host, usuário ou observação..."
              className={cn(
                'w-full pl-9 pr-3 py-2.5 border rounded-lg text-sm outline-none',
                dark
                  ? 'bg-[#0f172a] border-slate-700 text-white placeholder:text-slate-500 focus:border-blue-500'
                  : 'bg-white border-slate-300 text-slate-900 focus:border-blue-500',
              )}
            />
          </div>
          <select
            value={providerFilter}
            onChange={(e) => setProviderFilter(e.target.value)}
            className={cn(
              'px-3 py-2.5 border rounded-lg text-sm outline-none',
              dark
                ? 'bg-[#0f172a] border-slate-700 text-slate-100 focus:border-blue-500'
                : 'bg-white border-slate-300 text-slate-700 focus:border-blue-500',
            )}
          >
            {providerOptions.map((provider) => (
              <option key={provider} value={provider}>
                {provider}
              </option>
            ))}
          </select>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className={cn(
              'px-3 py-2.5 border rounded-lg text-sm outline-none',
              dark
                ? 'bg-[#0f172a] border-slate-700 text-slate-100 focus:border-blue-500'
                : 'bg-white border-slate-300 text-slate-700 focus:border-blue-500',
            )}
          >
            {typeOptions.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={clearFilters}
            className={cn(
              'px-3 py-2.5 rounded-lg border text-sm font-semibold',
              dark
                ? 'border-slate-700 text-slate-300 hover:bg-white/5'
                : 'border-slate-300 text-slate-700 hover:bg-slate-50',
            )}
          >
            Limpar
          </button>
        </div>
        <div
          className={cn('flex flex-wrap gap-2 text-xs', dark ? 'text-slate-400' : 'text-slate-500')}
        >
          <span>{summary.visibleProviders} provedores na seleção</span>
          <span>•</span>
          <span>Última atualização: {summary.latest}</span>
        </div>
      </div>

      {loading && (
        <div className={cn('text-sm', dark ? 'text-slate-200' : 'text-slate-600')}>
          Carregando credenciais...
        </div>
      )}
      {!loading && error && <div className="text-sm text-rose-400">{error}</div>}
      {!loading && demoData && (
        <div
          className={cn(
            'rounded-xl border px-4 py-3 text-sm',
            dark
              ? 'bg-amber-500/10 border-amber-500/20 text-amber-200'
              : 'bg-amber-50 border-amber-200 text-amber-800',
          )}
        >
          Exibindo dados ficticios para avaliacao visual do Cofre Neo. Credenciais reais continuam
          tendo prioridade quando a API retornar registros.
        </div>
      )}

      {!loading && !error && (
        <div className="grid grid-cols-1 2xl:grid-cols-[minmax(0,1fr)_420px] gap-5 items-start">
          <div
            className={cn(
              'rounded-2xl border overflow-hidden',
              dark ? 'bg-[#111827] border-slate-700' : 'bg-white border-slate-200 shadow-sm',
            )}
          >
            <div
              className={cn(
                'px-4 py-3 border-b flex items-center justify-between gap-3',
                dark ? 'border-slate-700' : 'border-slate-100',
              )}
            >
              <div>
                <div
                  className={cn('text-sm font-bold', dark ? 'text-slate-100' : 'text-slate-800')}
                >
                  Inventario de credenciais
                </div>
                <div className={cn('text-xs', dark ? 'text-slate-400' : 'text-slate-500')}>
                  Selecione uma linha para ver acesso, observacoes e metadados.
                </div>
              </div>
              <div className={cn('text-xs font-mono', dark ? 'text-slate-400' : 'text-slate-500')}>
                {filtered.length} registros
              </div>
            </div>

            {filtered.length === 0 && (
              <div
                className={cn(
                  'px-4 py-14 text-center text-sm',
                  dark ? 'text-slate-400' : 'text-slate-500',
                )}
              >
                Nenhuma credencial encontrada com os filtros atuais.
              </div>
            )}

            {grouped.map(([type, groupItems]) => {
              const meta = TYPE_META[type] || TYPE_META.OUTROS;
              const Icon = meta.icon;
              return (
                <div
                  key={type}
                  className={cn(
                    'border-b last:border-b-0',
                    dark ? 'border-slate-700' : 'border-slate-100',
                  )}
                >
                  <div
                    className={cn(
                      'px-4 py-2.5 flex items-center gap-2',
                      dark ? 'bg-[#0f172a]/70' : 'bg-slate-50',
                    )}
                  >
                    <Icon size={16} className={meta.iconColor} />
                    <h3
                      className={cn(
                        'text-sm font-bold',
                        dark ? 'text-slate-100' : 'text-slate-800',
                      )}
                    >
                      {type}
                    </h3>
                    <span
                      className={cn(
                        'text-[11px] px-2 py-0.5 rounded-full border',
                        dark
                          ? 'bg-slate-900 border-slate-700 text-slate-300'
                          : 'bg-white border-slate-200 text-slate-600',
                      )}
                    >
                      {groupItems.length} itens
                    </span>
                  </div>

                  <div className={cn('divide-y', dark ? 'divide-slate-800' : 'divide-slate-100')}>
                    {groupItems.map((credential) => {
                      const isSelected = credential.id === selectedId;
                      return (
                        <div
                          key={credential.id}
                          role="button"
                          tabIndex={0}
                          onClick={() => setSelectedId(credential.id)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              setSelectedId(credential.id);
                            }
                          }}
                          className={cn(
                            'w-full text-left px-4 py-3 grid grid-cols-1 lg:grid-cols-[minmax(180px,1.25fr)_140px_minmax(160px,0.9fr)_120px] gap-3 items-center transition-colors border-l-[3px] cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500/30',
                            isSelected
                              ? dark
                                ? 'bg-blue-500/10 border-l-blue-400'
                                : 'bg-blue-50 border-l-blue-500'
                              : dark
                                ? 'hover:bg-white/5 border-l-transparent'
                                : 'hover:bg-slate-50 border-l-transparent',
                          )}
                        >
                          <div className="min-w-0">
                            <div
                              className={cn(
                                'font-semibold text-sm truncate',
                                dark ? 'text-white' : 'text-slate-900',
                              )}
                            >
                              {credential.equipmentName}
                            </div>
                            <div
                              className={cn(
                                'text-xs truncate',
                                dark ? 'text-slate-400' : 'text-slate-500',
                              )}
                            >
                              {credential.provider}
                            </div>
                          </div>
                          <div
                            className={cn(
                              'font-mono text-xs truncate',
                              dark ? 'text-slate-300' : 'text-slate-700',
                            )}
                          >
                            {credential.host}
                          </div>
                          <div
                            className={cn(
                              'font-mono text-xs truncate',
                              dark ? 'text-slate-300' : 'text-slate-700',
                            )}
                          >
                            {credential.username || 'NAO_INFORMADO'}
                          </div>
                          <div className="flex items-center justify-start lg:justify-end gap-1">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                copyText(credential.host);
                              }}
                              className={cn(
                                'p-1.5 rounded border',
                                dark
                                  ? 'border-slate-700 text-slate-300 hover:bg-white/5'
                                  : 'border-slate-200 text-slate-600 hover:bg-slate-100',
                              )}
                              title="Copiar Host/IP"
                            >
                              <Copy size={13} />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleSecret(credential);
                              }}
                              className={cn(
                                'p-1.5 rounded border',
                                dark
                                  ? 'border-slate-700 text-slate-300 hover:bg-white/5'
                                  : 'border-slate-200 text-slate-600 hover:bg-slate-100',
                              )}
                              title={
                                visibleSecret[credential.id] ? 'Ocultar senha' : 'Revelar senha'
                              }
                            >
                              {visibleSecret[credential.id] ? (
                                <EyeOff size={13} />
                              ) : (
                                <Eye size={13} />
                              )}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          <div
            className={cn(
              'rounded-2xl border h-fit sticky top-4 overflow-hidden',
              dark ? 'bg-[#111827] border-slate-700' : 'bg-white border-slate-200 shadow-sm',
            )}
          >
            {!selected && (
              <div
                className={cn(
                  'p-10 text-sm flex flex-col items-center gap-3 text-center',
                  dark ? 'text-slate-300' : 'text-slate-600',
                )}
              >
                <div
                  className={cn(
                    'w-12 h-12 rounded-2xl flex items-center justify-center',
                    dark
                      ? 'bg-[#0f172a] border border-slate-700'
                      : 'bg-slate-50 border border-slate-200',
                  )}
                >
                  <Key size={20} />
                </div>
                <div>Selecione uma credencial para ver os detalhes.</div>
              </div>
            )}

            {selected && (
              <>
                <div
                  className={cn(
                    'p-5 border-b',
                    dark ? 'bg-[#111219] border-[#2d3142]' : 'bg-slate-50 border-slate-200',
                  )}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={cn(
                          'px-2 py-1 rounded-md text-[10px] font-bold border',
                          (TYPE_META[selected.equipmentType] || TYPE_META.OUTROS).chip,
                        )}
                      >
                        {selected.equipmentType}
                      </span>
                      <span className={cn('text-xs', dark ? 'text-slate-300' : 'text-slate-600')}>
                        {selected.provider}
                      </span>
                    </div>
                    <button
                      onClick={() => openEditModal(selected)}
                      className={cn(
                        'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors shrink-0',
                        dark
                          ? 'bg-[#0a0d1e] border-[#2d3142]/70 text-slate-300 hover:text-white hover:border-[#5a42f5]/50'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-blue-300',
                      )}
                    >
                      <Edit2 size={13} />
                      Editar
                    </button>
                  </div>
                  <h3 className={cn('text-xl font-bold', dark ? 'text-white' : 'text-slate-900')}>
                    {selected.equipmentName}
                  </h3>
                </div>

                <div className="p-5 space-y-5">
                  <div>
                    <h4
                      className={cn(
                        'text-xs uppercase mb-2 flex items-center gap-2',
                        dark ? 'text-slate-300' : 'text-slate-600',
                      )}
                    >
                      <Key size={14} />
                      Dados de Acesso
                    </h4>
                    <div
                      className={cn(
                        'rounded-xl border p-3 space-y-3',
                        dark ? 'bg-[#111219] border-[#2d3142]' : 'bg-slate-50 border-slate-200',
                      )}
                    >
                      <div>
                        <div
                          className={cn(
                            'text-[10px] uppercase',
                            dark ? 'text-slate-300' : 'text-slate-500',
                          )}
                        >
                          Host
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className={cn(
                              'text-xs font-mono break-all',
                              dark ? 'text-white' : 'text-slate-900',
                            )}
                          >
                            {selected.host}
                          </span>
                          <button
                            onClick={() => copyText(selected.host)}
                            className={cn(
                              'p-1.5 rounded-md',
                              dark
                                ? 'text-slate-300 hover:bg-white/10'
                                : 'text-slate-600 hover:bg-slate-200',
                            )}
                          >
                            <Copy size={13} />
                          </button>
                        </div>
                      </div>

                      <div>
                        <div
                          className={cn(
                            'text-[10px] uppercase',
                            dark ? 'text-slate-300' : 'text-slate-500',
                          )}
                        >
                          Usuário
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className={cn(
                              'text-xs font-mono',
                              dark ? 'text-white' : 'text-slate-900',
                            )}
                          >
                            {selected.username || 'NAO_INFORMADO'}
                          </span>
                          <button
                            onClick={() => copyText(selected.username || '')}
                            className={cn(
                              'p-1.5 rounded-md',
                              dark
                                ? 'text-slate-300 hover:bg-white/10'
                                : 'text-slate-600 hover:bg-slate-200',
                            )}
                          >
                            <Copy size={13} />
                          </button>
                        </div>
                      </div>

                      <div>
                        <div
                          className={cn(
                            'text-[10px] uppercase',
                            dark ? 'text-slate-300' : 'text-slate-500',
                          )}
                        >
                          Senha
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className={cn(
                              'text-xs font-mono break-all',
                              dark ? 'text-white' : 'text-slate-900',
                            )}
                          >
                            {getSecretText(selected)}
                          </span>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => toggleSecret(selected)}
                              className={cn(
                                'p-1.5 rounded-md',
                                dark
                                  ? 'text-slate-300 hover:bg-white/10'
                                  : 'text-slate-600 hover:bg-slate-200',
                              )}
                            >
                              {visibleSecret[selected.id] ? (
                                <EyeOff size={13} />
                              ) : (
                                <Eye size={13} />
                              )}
                            </button>
                            <button
                              onClick={() => copyText(getSecretText(selected))}
                              className={cn(
                                'p-1.5 rounded-md',
                                dark
                                  ? 'text-slate-300 hover:bg-white/10'
                                  : 'text-slate-600 hover:bg-slate-200',
                              )}
                            >
                              <Copy size={13} />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4
                      className={cn(
                        'text-xs uppercase mb-2 flex items-center gap-2',
                        dark ? 'text-slate-300' : 'text-slate-600',
                      )}
                    >
                      <AlignLeft size={14} />
                      Observações
                    </h4>
                    <div
                      className={cn(
                        'rounded-xl border p-3 text-sm whitespace-pre-wrap break-words max-h-[280px] overflow-y-auto custom-scrollbar',
                        dark
                          ? 'bg-[#111219] border-[#2d3142] text-slate-100'
                          : 'bg-slate-50 border-slate-200 text-slate-700',
                      )}
                    >
                      {selected.notes || 'Nenhuma observação cadastrada.'}
                    </div>
                  </div>

                  <div>
                    <h4
                      className={cn(
                        'text-xs uppercase mb-2 flex items-center gap-2',
                        dark ? 'text-slate-300' : 'text-slate-600',
                      )}
                    >
                      <Clock size={14} />
                      Metadados
                    </h4>
                    <div
                      className={cn(
                        'rounded-xl border p-3 text-sm space-y-2',
                        dark ? 'bg-[#111219] border-[#2d3142]' : 'bg-slate-50 border-slate-200',
                      )}
                    >
                      <div className="flex justify-between gap-3">
                        <span className={cn(dark ? 'text-slate-300' : 'text-slate-600')}>
                          Criado em
                        </span>
                        <span className={cn(dark ? 'text-slate-100' : 'text-slate-900')}>
                          {formatDateTime(selected.createdAt)}
                        </span>
                      </div>
                      <div className="flex justify-between gap-3">
                        <span className={cn(dark ? 'text-slate-300' : 'text-slate-600')}>
                          Atualizado em
                        </span>
                        <span className={cn(dark ? 'text-slate-100' : 'text-slate-900')}>
                          {formatDateTime(selected.updatedAt)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {isEditModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => !saving && setIsEditModalOpen(false)}
          ></div>
          <div
            className={cn(
              'relative w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200',
              dark ? 'bg-[#1e293b] border border-slate-700/50' : 'bg-white border border-slate-200',
            )}
          >
            <div
              className={cn(
                'px-6 py-4 border-b flex items-center justify-between',
                dark ? 'border-slate-700/50' : 'border-slate-100',
              )}
            >
              <h3
                className={cn(
                  'font-bold text-lg flex items-center gap-2',
                  dark ? 'text-slate-100' : 'text-slate-800',
                )}
              >
                <Edit2 size={18} />
                Editar Credencial
              </h3>
              <button
                onClick={() => !saving && setIsEditModalOpen(false)}
                className="p-2 hover:bg-slate-500/10 rounded-full transition-colors"
              >
                <X size={20} className="text-slate-400" />
              </button>
            </div>

            <form
              onSubmit={handleSaveEdit}
              className="p-6 space-y-4 max-h-[80vh] overflow-y-auto custom-scrollbar"
            >
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase">
                  Identificação (Nome do Equipamento)
                </label>
                <input
                  required
                  type="text"
                  value={formData.equipmentName}
                  onChange={(e) => setFormData({ ...formData, equipmentName: e.target.value })}
                  className={cn(
                    'w-full px-4 py-2 rounded-xl outline-none border transition-all',
                    dark
                      ? 'bg-[#0f172a] border-slate-700 text-slate-100 focus:border-blue-500/50'
                      : 'bg-white border-slate-200 text-slate-800 focus:border-blue-300 shadow-sm',
                  )}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase">IP / Host</label>
                <input
                  required
                  type="text"
                  value={formData.host}
                  onChange={(e) => setFormData({ ...formData, host: e.target.value })}
                  className={cn(
                    'w-full px-4 py-2 rounded-xl outline-none border transition-all font-mono',
                    dark
                      ? 'bg-[#0f172a] border-slate-700 text-slate-100 focus:border-blue-500/50'
                      : 'bg-white border-slate-200 text-slate-800 focus:border-blue-300 shadow-sm',
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase">Usuário</label>
                  <input
                    type="text"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    placeholder="Opcional"
                    className={cn(
                      'w-full px-4 py-2 rounded-xl outline-none border transition-all font-mono',
                      dark
                        ? 'bg-[#0f172a] border-slate-700 text-slate-100 focus:border-blue-500/50'
                        : 'bg-white border-slate-200 text-slate-800 focus:border-blue-300 shadow-sm',
                    )}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase">Senha</label>
                  <div className="relative">
                    <input
                      type={showModalSecret ? 'text' : 'password'}
                      value={formData.secret}
                      onChange={(e) => setFormData({ ...formData, secret: e.target.value })}
                      placeholder="Nova senha..."
                      className={cn(
                        'w-full pl-4 pr-10 py-2 rounded-xl outline-none border transition-all font-mono',
                        dark
                          ? 'bg-[#0f172a] border-slate-700 text-slate-100 focus:border-blue-500/50'
                          : 'bg-white border-slate-200 text-slate-800 focus:border-blue-300 shadow-sm',
                      )}
                    />
                    <button
                      type="button"
                      disabled={fetchingSecret}
                      onClick={async () => {
                        if (showModalSecret) {
                          setShowModalSecret(false);
                          return;
                        }
                        if (formData.secret === '••••••••••••') {
                          setFetchingSecret(true);
                          try {
                            if (revealedSecret[formData.id]) {
                              setFormData((prev) => ({
                                ...prev,
                                secret: revealedSecret[formData.id],
                              }));
                              setShowModalSecret(true);
                            } else {
                              const res = await fetch(
                                `/api/knowledge/credentials/${encodeURIComponent(formData.id)}/reveal?tenantId=${encodeURIComponent(tenantId || '')}`,
                                { method: 'POST' },
                              );
                              if (res.ok) {
                                const payload = await res.json();
                                const dec = payload.secret || '';
                                setRevealedSecret((prev) => ({ ...prev, [formData.id]: dec }));
                                setFormData((prev) => ({ ...prev, secret: dec }));
                                setShowModalSecret(true);
                              } else {
                                onToast('Falha ao revelar senha.');
                              }
                            }
                          } finally {
                            setFetchingSecret(false);
                          }
                        } else {
                          setShowModalSecret(true);
                        }
                      }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                    >
                      {fetchingSecret ? (
                        <div className="w-4 h-4 rounded-full border-2 border-slate-400 border-t-transparent animate-spin" />
                      ) : showModalSecret ? (
                        <EyeOff size={16} />
                      ) : (
                        <Eye size={16} />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase">Observações</label>
                <textarea
                  rows={6}
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className={cn(
                    'w-full px-4 py-3 rounded-xl outline-none border transition-all resize-y min-h-[140px] max-h-[350px]',
                    dark
                      ? 'bg-[#0f172a] border-slate-700 text-slate-100 focus:border-blue-500/50'
                      : 'bg-white border-slate-200 text-slate-800 focus:border-blue-300 shadow-sm',
                  )}
                ></textarea>
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => setIsEditModalOpen(false)}
                  className={cn(
                    'flex-1 py-2.5 rounded-xl font-bold transition-all border',
                    dark
                      ? 'border-slate-700 text-slate-400 hover:bg-white/5'
                      : 'border-slate-200 text-slate-500 hover:bg-slate-50',
                  )}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-[2] py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold transition-all shadow-lg shadow-blue-600/20 disabled:opacity-50"
                >
                  {saving ? 'Gravando...' : 'Salvar Alterações'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default AnalystCredentialsNeoView;
