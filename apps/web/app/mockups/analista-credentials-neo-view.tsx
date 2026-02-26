'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  AlignLeft,
  Clock,
  Copy,
  Eye,
  EyeOff,
  Filter,
  Globe,
  Key,
  Network,
  Search,
  Server,
  Shield,
  Cpu,
  AppWindow,
  ArrowRightLeft,
} from 'lucide-react';

const cn = (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' ');

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

const TYPE_META: Record<string, { icon: React.ComponentType<{ size?: number; className?: string }>; chip: string; iconColor: string }> = {
  DNS: { icon: Globe, chip: 'bg-purple-500/10 text-purple-300 border-purple-500/20', iconColor: 'text-purple-300' },
  OLT: { icon: Network, chip: 'bg-blue-500/10 text-blue-300 border-blue-500/20', iconColor: 'text-blue-300' },
  FIREWALL: { icon: Shield, chip: 'bg-red-500/10 text-red-300 border-red-500/20', iconColor: 'text-red-300' },
  ROUTER: { icon: Server, chip: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20', iconColor: 'text-emerald-300' },
  SW: { icon: ArrowRightLeft, chip: 'bg-cyan-500/10 text-cyan-300 border-cyan-500/20', iconColor: 'text-cyan-300' },
  SISTEMA: { icon: AppWindow, chip: 'bg-pink-500/10 text-pink-300 border-pink-500/20', iconColor: 'text-pink-300' },
  VM: { icon: Cpu, chip: 'bg-amber-500/10 text-amber-300 border-amber-500/20', iconColor: 'text-amber-300' },
  OUTROS: { icon: Server, chip: 'bg-slate-500/10 text-slate-200 border-slate-500/20', iconColor: 'text-slate-300' },
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

type Props = {
  dark: boolean;
  onToast: (message: string) => void;
};

export function AnalystCredentialsNeoView({ dark, onToast }: Props) {
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [items, setItems] = useState<CredentialItem[]>([]);
  const [providerFilter, setProviderFilter] = useState('Todos');
  const [typeFilter, setTypeFilter] = useState('Todos');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [visibleSecret, setVisibleSecret] = useState<Record<string, boolean>>({});
  const [revealedSecret, setRevealedSecret] = useState<Record<string, string>>({});

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const meRes = await fetch('/api/auth/me', { cache: 'no-store' });
        if (!meRes.ok) throw new Error('Falha ao obter sessão.');
        const me = await meRes.json();
        const tenant = String(me?.tenant?.id || '');
        if (!tenant) throw new Error('Tenant não encontrado.');
        if (!active) return;
        setTenantId(tenant);

        const mapRows = (rows: any[]) => rows.map((row: any) => ({
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
        })) as CredentialItem[];

        const normalizeList = (payload: any) => {
          if (Array.isArray(payload)) return payload;
          if (Array.isArray(payload?.items)) return payload.items;
          if (Array.isArray(payload?.data)) return payload.data;
          return [];
        };

        const providersRes = await fetch(
          `/api/knowledge/credentials/providers?tenantId=${encodeURIComponent(tenant)}&limit=500&offset=0`,
          { cache: 'no-store' }
        );
        const providersPayload = providersRes.ok ? await providersRes.json().catch(() => ({})) : {};
        const dynamicProviders = normalizeList(providersPayload)
          .map((p: any) => String(p?.provider || '').trim())
          .filter(Boolean);
        const providers = Array.from(new Set(['Meganet', 'UltraFibra', 'MaximaNet', ...dynamicProviders]));

        const fetchAllByProvider = async (provider: string) => {
          const acc: any[] = [];
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
            const response = await fetch(`/api/knowledge/credentials?${params.toString()}`, { cache: 'no-store' });
            if (!response.ok) break;
            const payload = await response.json().catch(() => ({}));
            const pageItems = normalizeList(payload);
            if (!pageItems.length) break;
            acc.push(...pageItems);
            if (pageItems.length < pageSize) break;
            offset += pageSize;
            loops += 1;
          }
          return acc;
        };

        const byProviderResponses = await Promise.all(
          providers.map(async (provider) => fetchAllByProvider(provider))
        );
        const mapped = mapRows(byProviderResponses.flat());

        if (!active) return;
        setItems(mapped);
      } catch (e: any) {
        if (!active) return;
        setError(e?.message || 'Falha ao carregar credenciais.');
        setItems([]);
      } finally {
        if (active) setLoading(false);
      }
    };

    load();
    return () => {
      active = false;
    };
  }, []);

  const providerOptions = useMemo(() => {
    const fixed = ['Meganet', 'UltraFibra', 'MaximaNet'];
    const dynamic = Array.from(new Set(items.map((item) => item.provider))).sort((a, b) => a.localeCompare(b, 'pt-BR'));
    const merged = Array.from(new Set([...fixed, ...dynamic]));
    return ['Todos', ...merged];
  }, [items]);
  const typeOptions = useMemo(() => ['Todos', ...Array.from(new Set(items.map((item) => item.equipmentType))).sort((a, b) => a.localeCompare(b, 'pt-BR'))], [items]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return items.filter((item) => {
      const byProvider = providerFilter === 'Todos' || item.provider === providerFilter;
      const byType = typeFilter === 'Todos' || item.equipmentType === typeFilter;
      const bySearch = !q || `${item.equipmentName} ${item.host} ${item.username} ${item.notes}`.toLowerCase().includes(q);
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

  const getSecretText = (credential: CredentialItem) => {
    if (visibleSecret[credential.id]) return revealedSecret[credential.id] || credential.secret || '';
    return '••••••••••••';
  };

  const copyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
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
    if (!revealedSecret[credential.id]) {
      const res = await fetch(`/api/knowledge/credentials/${encodeURIComponent(credential.id)}/reveal?tenantId=${encodeURIComponent(tenantId)}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        onToast(payload?.error || 'Falha ao revelar senha.');
        return;
      }
      setRevealedSecret((prev) => ({ ...prev, [credential.id]: String(payload?.secret || '') }));
    }
    setVisibleSecret((prev) => ({ ...prev, [credential.id]: true }));
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className={cn('text-3xl font-bold tracking-tight', dark ? 'text-white' : 'text-slate-900')}>Cofre de Credenciais Neo</h2>
        <p className={cn('text-base mt-1', dark ? 'text-slate-200' : 'text-slate-600')}>
          Terceira proposta de layout com cards por tipo e painel lateral fixo.
        </p>
      </div>

      <div className={cn('border rounded-2xl p-4 flex flex-col xl:flex-row gap-3', dark ? 'bg-[#0a0d1e]/80 border-[#2d3142]/70' : 'bg-white border-slate-200')}>
        <div className="relative flex-1">
          <Search size={18} className={cn('absolute left-3 top-1/2 -translate-y-1/2', dark ? 'text-slate-400' : 'text-slate-500')} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por equipamento, host ou usuário..."
            className={cn('w-full pl-10 pr-3 py-3 border rounded-xl text-sm', dark ? 'bg-[#111219] border-[#2d3142] text-white placeholder:text-slate-400' : 'bg-white border-slate-300 text-slate-900')}
          />
        </div>
        <select
          value={providerFilter}
          onChange={(e) => setProviderFilter(e.target.value)}
          className={cn('px-3 py-3 border rounded-xl text-sm min-w-[220px]', dark ? 'bg-[#111219] border-[#2d3142] text-slate-100' : 'bg-white border-slate-300 text-slate-700')}
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
          className={cn('px-3 py-3 border rounded-xl text-sm min-w-[170px]', dark ? 'bg-[#111219] border-[#2d3142] text-slate-100' : 'bg-white border-slate-300 text-slate-700')}
        >
          {typeOptions.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
        <button className={cn('px-4 py-3 rounded-xl border text-sm flex items-center gap-2', dark ? 'bg-[#111219] border-[#2d3142] text-slate-100' : 'bg-white border-slate-300 text-slate-700')}>
          <Filter size={16} />
          Mais Filtros
        </button>
      </div>

      {loading && <div className={cn('text-sm', dark ? 'text-slate-200' : 'text-slate-600')}>Carregando credenciais...</div>}
      {!loading && error && <div className="text-sm text-rose-400">{error}</div>}

      {!loading && !error && (
        <div className="grid grid-cols-1 2xl:grid-cols-[minmax(0,1fr)_430px] gap-6">
          <div className="space-y-8">
            <div className={cn('text-sm', dark ? 'text-slate-100' : 'text-slate-700')}>
              Mostrando <strong>{filtered.length}</strong> credenciais
            </div>

            {grouped.map(([type, groupItems]) => {
              const meta = TYPE_META[type] || TYPE_META.OUTROS;
              const Icon = meta.icon;
              return (
                <div key={type} className="space-y-4">
                  <div className={cn('flex items-center gap-3 border-b pb-3', dark ? 'border-[#2d3142]/60' : 'border-slate-200')}>
                    <div className={cn('p-2 rounded-lg border', dark ? 'bg-[#111219] border-[#2d3142]/70' : 'bg-slate-50 border-slate-200')}>
                      <Icon size={18} className={meta.iconColor} />
                    </div>
                    <h3 className={cn('text-xl font-bold', dark ? 'text-white' : 'text-slate-900')}>{type}</h3>
                    <span className={cn('text-xs px-2 py-0.5 rounded-full', dark ? 'bg-[#2d3142]/70 text-slate-100' : 'bg-slate-200 text-slate-700')}>
                      {groupItems.length}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {groupItems.map((credential) => {
                      const isSelected = credential.id === selectedId;
                      return (
                        <button
                          key={credential.id}
                          onClick={() => setSelectedId(credential.id)}
                          className={cn(
                            'text-left rounded-2xl border p-4 space-y-3 transition-all',
                            dark
                              ? (isSelected
                                  ? 'bg-[#121527] border-[#5a42f5]/70 shadow-[0_0_0_1px_rgba(90,66,245,0.4)]'
                                  : 'bg-[#111219] border-[#2d3142] hover:border-[#5a42f5]/40')
                              : 'bg-white border-slate-200 hover:border-blue-300'
                          )}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className={cn('font-semibold text-base', dark ? 'text-white' : 'text-slate-900')}>
                                {credential.equipmentName}
                              </div>
                              <div className={cn('text-xs mt-0.5', dark ? 'text-slate-300' : 'text-slate-600')}>
                                {credential.provider}
                              </div>
                            </div>
                            <span className={cn('px-2 py-1 rounded-md text-[10px] font-bold border', meta.chip)}>
                              {type}
                            </span>
                          </div>

                          <div className={cn('rounded-lg border p-2', dark ? 'bg-[#0a0d1e] border-[#2d3142]/70' : 'bg-slate-50 border-slate-200')}>
                            <div className={cn('text-[10px] uppercase mb-1', dark ? 'text-slate-300' : 'text-slate-500')}>Host / IP</div>
                            <div className={cn('text-xs font-mono break-all', dark ? 'text-slate-100' : 'text-slate-800')}>
                              {credential.host}
                            </div>
                          </div>

                          <div className={cn('rounded-lg border p-2', dark ? 'bg-[#0a0d1e] border-[#2d3142]/70' : 'bg-slate-50 border-slate-200')}>
                            <div className={cn('text-[10px] uppercase mb-1', dark ? 'text-slate-300' : 'text-slate-500')}>Usuário</div>
                            <div className={cn('text-xs font-mono', dark ? 'text-slate-100' : 'text-slate-800')}>
                              {credential.username || 'NAO_INFORMADO'}
                            </div>
                          </div>

                          <div className={cn('rounded-lg border p-2', dark ? 'bg-[#0a0d1e] border-[#2d3142]/70' : 'bg-slate-50 border-slate-200')}>
                            <div className={cn('text-[10px] uppercase mb-1', dark ? 'text-slate-300' : 'text-slate-500')}>Credencial</div>
                            <div className={cn('text-xs font-mono break-all', dark ? 'text-slate-100' : 'text-slate-800')}>
                              {visibleSecret[credential.id] ? (revealedSecret[credential.id] || '••••••••••••') : '••••••••••••'}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          <div className={cn('rounded-2xl border h-fit sticky top-4', dark ? 'bg-[#0a0d1e] border-[#2d3142]' : 'bg-white border-slate-200')}>
            {!selected && (
              <div className={cn('p-6 text-sm', dark ? 'text-slate-300' : 'text-slate-600')}>
                Selecione uma credencial para ver os detalhes.
              </div>
            )}

            {selected && (
              <>
                <div className={cn('p-5 border-b', dark ? 'bg-[#111219] border-[#2d3142]' : 'bg-slate-50 border-slate-200')}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className={cn('px-2 py-1 rounded-md text-[10px] font-bold border', (TYPE_META[selected.equipmentType] || TYPE_META.OUTROS).chip)}>
                      {selected.equipmentType}
                    </span>
                    <span className={cn('text-xs', dark ? 'text-slate-300' : 'text-slate-600')}>{selected.provider}</span>
                  </div>
                  <h3 className={cn('text-xl font-bold', dark ? 'text-white' : 'text-slate-900')}>{selected.equipmentName}</h3>
                </div>

                <div className="p-5 space-y-5">
                  <div>
                    <h4 className={cn('text-xs uppercase mb-2 flex items-center gap-2', dark ? 'text-slate-300' : 'text-slate-600')}>
                      <Key size={14} />
                      Dados de Acesso
                    </h4>
                    <div className={cn('rounded-xl border p-3 space-y-3', dark ? 'bg-[#111219] border-[#2d3142]' : 'bg-slate-50 border-slate-200')}>
                      <div>
                        <div className={cn('text-[10px] uppercase', dark ? 'text-slate-300' : 'text-slate-500')}>Host</div>
                        <div className="flex items-center justify-between gap-2">
                          <span className={cn('text-xs font-mono break-all', dark ? 'text-white' : 'text-slate-900')}>{selected.host}</span>
                          <button onClick={() => copyText(selected.host)} className={cn('p-1.5 rounded-md', dark ? 'text-slate-300 hover:bg-white/10' : 'text-slate-600 hover:bg-slate-200')}>
                            <Copy size={13} />
                          </button>
                        </div>
                      </div>

                      <div>
                        <div className={cn('text-[10px] uppercase', dark ? 'text-slate-300' : 'text-slate-500')}>Usuário</div>
                        <div className="flex items-center justify-between gap-2">
                          <span className={cn('text-xs font-mono', dark ? 'text-white' : 'text-slate-900')}>{selected.username || 'NAO_INFORMADO'}</span>
                          <button onClick={() => copyText(selected.username || '')} className={cn('p-1.5 rounded-md', dark ? 'text-slate-300 hover:bg-white/10' : 'text-slate-600 hover:bg-slate-200')}>
                            <Copy size={13} />
                          </button>
                        </div>
                      </div>

                      <div>
                        <div className={cn('text-[10px] uppercase', dark ? 'text-slate-300' : 'text-slate-500')}>Senha</div>
                        <div className="flex items-center justify-between gap-2">
                          <span className={cn('text-xs font-mono break-all', dark ? 'text-white' : 'text-slate-900')}>
                            {getSecretText(selected)}
                          </span>
                          <div className="flex items-center gap-1">
                            <button onClick={() => toggleSecret(selected)} className={cn('p-1.5 rounded-md', dark ? 'text-slate-300 hover:bg-white/10' : 'text-slate-600 hover:bg-slate-200')}>
                              {visibleSecret[selected.id] ? <EyeOff size={13} /> : <Eye size={13} />}
                            </button>
                            <button onClick={() => copyText(getSecretText(selected))} className={cn('p-1.5 rounded-md', dark ? 'text-slate-300 hover:bg-white/10' : 'text-slate-600 hover:bg-slate-200')}>
                              <Copy size={13} />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className={cn('text-xs uppercase mb-2 flex items-center gap-2', dark ? 'text-slate-300' : 'text-slate-600')}>
                      <AlignLeft size={14} />
                      Observações
                    </h4>
                    <div className={cn('rounded-xl border p-3 text-sm whitespace-pre-wrap break-words max-h-[280px] overflow-y-auto custom-scrollbar', dark ? 'bg-[#111219] border-[#2d3142] text-slate-100' : 'bg-slate-50 border-slate-200 text-slate-700')}>
                      {selected.notes || 'Nenhuma observação cadastrada.'}
                    </div>
                  </div>

                  <div>
                    <h4 className={cn('text-xs uppercase mb-2 flex items-center gap-2', dark ? 'text-slate-300' : 'text-slate-600')}>
                      <Clock size={14} />
                      Metadados
                    </h4>
                    <div className={cn('rounded-xl border p-3 text-sm space-y-2', dark ? 'bg-[#111219] border-[#2d3142]' : 'bg-slate-50 border-slate-200')}>
                      <div className="flex justify-between gap-3">
                        <span className={cn(dark ? 'text-slate-300' : 'text-slate-600')}>Criado em</span>
                        <span className={cn(dark ? 'text-slate-100' : 'text-slate-900')}>{formatDateTime(selected.createdAt)}</span>
                      </div>
                      <div className="flex justify-between gap-3">
                        <span className={cn(dark ? 'text-slate-300' : 'text-slate-600')}>Atualizado em</span>
                        <span className={cn(dark ? 'text-slate-100' : 'text-slate-900')}>{formatDateTime(selected.updatedAt)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default AnalystCredentialsNeoView;
