'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Search,
  Activity,
  Wifi,
  WifiOff,
  AlertTriangle,
  Clock,
  Zap,
  Gauge,
  Bell,
  Server,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

interface TenantServiceItem {
  id: string;
  provider: string;
  location: string;
  service: string;
  status: 'online' | 'degraded' | 'offline';
  uptime: number | null;
  latencyMs: number | null;
  throughputMbps: number | null;
  alerts: number | null;
  lastCheck: string | null;
  updatedAt: string;
  alertMsg?: string;
}

const statusConfig: Record<
  TenantServiceItem['status'],
  { color: string; bg: string; border: string; icon: typeof Wifi; label: string }
> = {
  online: {
    color: '#16a34a',
    bg: 'bg-[#f0fdf4]',
    border: 'border-l-[3px] border-l-[#16a34a]',
    icon: Wifi,
    label: 'Ativo',
  },
  degraded: {
    color: '#d97706',
    bg: 'bg-[#fffbeb]',
    border: 'border-l-[3px] border-l-[#d97706]',
    icon: AlertTriangle,
    label: 'Em manutenção',
  },
  offline: {
    color: '#dc2626',
    bg: 'bg-[#fef2f2]',
    border: 'border-l-[3px] border-l-[#dc2626]',
    icon: WifiOff,
    label: 'Inativo',
  },
};

function fmtLastCheck(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function SaudePage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [providerFilter, setProviderFilter] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [items, setItems] = useState<TenantServiceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/dashboards/tenant-services', { signal, cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { items: TenantServiceItem[] };
      setItems(Array.isArray(data.items) ? data.items : []);
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const ac = new AbortController();
    void load(ac.signal);
    return () => ac.abort();
  }, [load]);

  const providers = useMemo(() => {
    const set = new Set(items.map((s) => s.provider).filter((p) => p && p !== '—'));
    return Array.from(set).sort();
  }, [items]);

  const filtered = useMemo(() => {
    let results = [...items];
    if (search) {
      const s = search.toLowerCase();
      results = results.filter(
        (svc) =>
          svc.provider.toLowerCase().includes(s) ||
          svc.location.toLowerCase().includes(s) ||
          svc.service.toLowerCase().includes(s),
      );
    }
    if (statusFilter) results = results.filter((svc) => svc.status === statusFilter);
    if (providerFilter) results = results.filter((svc) => svc.provider === providerFilter);
    return results;
  }, [items, search, statusFilter, providerFilter]);

  const summary = useMemo(() => {
    return {
      total: items.length,
      online: items.filter((s) => s.status === 'online').length,
      degraded: items.filter((s) => s.status === 'degraded').length,
      offline: items.filter((s) => s.status === 'offline').length,
    };
  }, [items]);

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-content-primary tracking-[-0.03em]">
            Saúde dos Serviços
          </h1>
          <p className="text-sm text-content-secondary mt-0.5">
            Situação cadastral dos ativos; telemetria depende de integração de monitoramento
          </p>
        </div>
        <button
          onClick={() => load()}
          className="p-2 rounded-md text-content-tertiary hover:text-content-primary hover:bg-bg-hover transition-colors"
          aria-label="Recarregar saúde"
        >
          <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
        </button>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          Falha ao carregar saúde: {error}.{' '}
          <button onClick={() => load()} className="underline">
            Tentar novamente
          </button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px] max-w-[360px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-content-tertiary" />
          <input
            type="text"
            placeholder="Buscar por provedor, localização..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-[rgba(0,0,0,0.08)] rounded-lg placeholder-content-tertiary focus:outline-none focus:ring-2 focus:ring-accent-DEFAULT/20 focus:border-accent-DEFAULT transition-all"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 text-sm bg-white border border-[rgba(0,0,0,0.08)] rounded-lg text-content-secondary focus:outline-none focus:ring-2 focus:ring-accent-DEFAULT/20 focus:border-accent-DEFAULT appearance-auto"
        >
          <option value="">Todos status</option>
          <option value="online">Ativo</option>
          <option value="degraded">Em manutenção</option>
          <option value="offline">Inativo</option>
        </select>
        <select
          value={providerFilter}
          onChange={(e) => setProviderFilter(e.target.value)}
          className="px-3 py-2 text-sm bg-white border border-[rgba(0,0,0,0.08)] rounded-lg text-content-secondary focus:outline-none focus:ring-2 focus:ring-accent-DEFAULT/20 focus:border-accent-DEFAULT appearance-auto"
        >
          <option value="">Todos provedores</option>
          {providers.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-44 w-full" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filtered.map((svc) => {
            const cfg = statusConfig[svc.status];
            const isExpanded = expandedId === svc.id;
            const statusDot = (
              <span
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: cfg.color }}
              />
            );

            return (
              <div
                key={svc.id}
                className={cn(
                  'bg-bg-surface rounded-xl shadow-sm border border-[rgba(0,0,0,0.06)] overflow-hidden transition-all cursor-pointer',
                  cfg.border,
                )}
                onClick={() => toggleExpand(svc.id)}
              >
                <div className="p-5">
                  <div className="flex items-center gap-2 mb-1.5">
                    {statusDot}
                    <span className="text-sm font-semibold text-content-primary">
                      {svc.provider} - {svc.location}
                    </span>
                    <span
                      className="text-2xs font-medium rounded-full px-2 py-0.5 ml-auto"
                      style={{ backgroundColor: cfg.bg, color: cfg.color }}
                    >
                      {cfg.label}
                    </span>
                  </div>
                  <p className="text-xs text-content-tertiary mb-4">{svc.service}</p>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-bg-subtle rounded-lg p-3">
                      <div className="flex items-center gap-1 text-2xs text-content-tertiary mb-1">
                        <Activity className="w-3 h-3" />
                        Uptime
                      </div>
                      <span className="text-sm font-bold text-content-primary">
                        {svc.uptime === null ? 'Não disponível' : `${svc.uptime}%`}
                      </span>
                    </div>
                    <div className="bg-bg-subtle rounded-lg p-3">
                      <div className="flex items-center gap-1 text-2xs text-content-tertiary mb-1">
                        <Clock className="w-3 h-3" />
                        Latência
                      </div>
                      <span className="text-sm font-bold text-content-primary">
                        {svc.latencyMs === null ? 'Não disponível' : `${svc.latencyMs}ms`}
                      </span>
                    </div>
                    <div className="bg-bg-subtle rounded-lg p-3">
                      <div className="flex items-center gap-1 text-2xs text-content-tertiary mb-1">
                        <Gauge className="w-3 h-3" />
                        Throughput
                      </div>
                      <span className="text-sm font-bold text-content-primary">
                        {svc.throughputMbps === null
                          ? 'Não disponível'
                          : `${svc.throughputMbps} Mbps`}
                      </span>
                    </div>
                    <div
                      className={cn(
                        'bg-bg-subtle rounded-lg p-3',
                        svc.alerts !== null && svc.alerts > 0 && 'bg-[#fef2f2]',
                      )}
                    >
                      <div className="flex items-center gap-1 text-2xs text-content-tertiary mb-1">
                        <Bell className="w-3 h-3" />
                        Alertas
                      </div>
                      <span
                        className={cn(
                          'text-sm font-bold',
                          svc.alerts !== null && svc.alerts > 0
                            ? 'text-[#dc2626]'
                            : 'text-content-primary',
                        )}
                      >
                        {svc.alerts === null ? 'Não disponível' : svc.alerts}
                        {svc.alertMsg && (
                          <span className="block text-2xs font-normal text-[#dc2626] mt-0.5">
                            {svc.alertMsg}
                          </span>
                        )}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 mt-4 pt-3 border-t border-[rgba(0,0,0,0.04)]">
                    <Zap className="w-3 h-3 text-content-tertiary" />
                    <span className="text-2xs text-content-tertiary">
                      Cadastro atualizado: {fmtLastCheck(svc.updatedAt)}
                    </span>
                  </div>
                </div>

                {isExpanded && (
                  <div className="px-5 pb-5 border-t border-[rgba(0,0,0,0.04)] pt-4">
                    <p className="text-xs text-content-tertiary">
                      Histórico de telemetria indisponível. Configure uma integração de
                      monitoramento para coletar uptime, latência, throughput e alertas reais.
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <div className="bg-bg-surface rounded-xl shadow-sm border border-[rgba(0,0,0,0.06)] p-12 text-center">
          <Server className="w-8 h-8 text-content-tertiary mx-auto mb-3" />
          <p className="text-content-tertiary text-sm">
            {items.length === 0
              ? 'Nenhum ativo cadastrado para este tenant. Cadastre ativos em CMDB para visualizar a saúde.'
              : 'Nenhum serviço encontrado com os filtros aplicados.'}
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Serviços', value: summary.total, icon: Server, color: '#2563eb' },
          { label: 'Ativos', value: summary.online, icon: CheckCircle2, color: '#16a34a' },
          { label: 'Em manutenção', value: summary.degraded, icon: AlertCircle, color: '#d97706' },
          { label: 'Inativos', value: summary.offline, icon: XCircle, color: '#dc2626' },
        ].map((stat) => (
          <div
            key={stat.label}
            className="bg-bg-surface rounded-xl shadow-sm border border-[rgba(0,0,0,0.06)] p-4"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-2xs font-medium text-content-tertiary uppercase tracking-wide">
                {stat.label}
              </span>
              <stat.icon className="w-4 h-4" style={{ color: stat.color }} />
            </div>
            <div className="text-2xl font-bold text-content-primary tabular-nums tracking-[-0.03em]">
              {stat.value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
