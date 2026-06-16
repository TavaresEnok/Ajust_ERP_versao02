'use client';
/* eslint-disable react-hooks/exhaustive-deps */
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Ticket,
  Clock,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Search,
  ChevronRight,
  X,
  MessageSquare,
  Paperclip,
  Calendar,
  User,
  Tag,
  Activity,
  LogOut,
  Shield,
} from 'lucide-react';

/* ========================================================= */
/* Types                                                      */
/* ========================================================= */
type ServiceOrder = {
  id: string;
  protocol: string;
  title: string;
  description: string;
  type: string;
  priority: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  deadlineAt: string;
  analystName: string | null;
  tags: string[];
  occurrences: Array<{
    id: string;
    message: string;
    createdAt: string;
    isCustomerVisible: boolean;
    actorUser: { name: string; email: string } | null;
  }>;
  attachments: Array<{
    id: string;
    fileName: string;
    uploadedAt: string;
    isInternal: boolean;
  }>;
};

type UserInfo = {
  name: string;
  email: string;
  tenant: { tradeName: string };
};

/* ========================================================= */
/* Constants                                                  */
/* ========================================================= */
const STATUS_MAP: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  ABERTA: { label: 'Aberta', color: 'text-blue-600', bg: 'bg-blue-100', dot: 'bg-blue-500' },
  EM_ANALISE: {
    label: 'Em Análise',
    color: 'text-indigo-600',
    bg: 'bg-indigo-100',
    dot: 'bg-indigo-500',
  },
  AG_CAMPO: {
    label: 'Ag. Campo',
    color: 'text-amber-700',
    bg: 'bg-amber-100',
    dot: 'bg-amber-500',
  },
  AG_TERCEIROS: {
    label: 'Ag. Parceiro',
    color: 'text-orange-700',
    bg: 'bg-orange-100',
    dot: 'bg-orange-500',
  },
  RESOLVIDA: { label: 'Resolvida', color: 'text-teal-700', bg: 'bg-teal-100', dot: 'bg-teal-500' },
  FECHADA: {
    label: 'Fechada',
    color: 'text-emerald-700',
    bg: 'bg-emerald-100',
    dot: 'bg-emerald-500',
  },
  CANCELADA: {
    label: 'Cancelada',
    color: 'text-slate-600',
    bg: 'bg-slate-100',
    dot: 'bg-slate-400',
  },
};

const PRIORITY_MAP: Record<string, { label: string; color: string }> = {
  BAIXA: { label: 'Baixa', color: 'text-slate-500' },
  NORMAL: { label: 'Normal', color: 'text-blue-600' },
  ALTA: { label: 'Alta', color: 'text-orange-600' },
  CRITICA: { label: 'Crítica', color: 'text-rose-600' },
};

const TYPE_LABELS: Record<string, string> = {
  ROMPIMENTO: 'Rompimento',
  LENTIDAO: 'Lentidão',
  CONFIGURACAO_ONU: 'Config. ONU',
  TROCA_SENHA: 'Troca de Senha',
  CANCELAMENTO: 'Cancelamento',
  AUDITORIA: 'Auditoria',
  INSTALACAO: 'Instalação',
  BGP: 'BGP',
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function isActive(s: string): boolean {
  return ['ABERTA', 'EM_ANALISE', 'AG_CAMPO', 'AG_TERCEIROS'].includes(s);
}

function isOverdue(order: ServiceOrder): boolean {
  return isActive(order.status) && !!order.deadlineAt && new Date(order.deadlineAt) < new Date();
}

/* ========================================================= */
/* StatusBadge                                               */
/* ========================================================= */
function StatusBadge({ status }: { status: string }) {
  const s = STATUS_MAP[status] || {
    label: status,
    color: 'text-slate-600',
    bg: 'bg-slate-100',
    dot: 'bg-slate-400',
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${s.bg} ${s.color}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}

/* ========================================================= */
/* OrderDetail Drawer                                         */
/* ========================================================= */
function OrderDetail({ order, onClose }: { order: ServiceOrder; onClose: () => void }) {
  const overdue = isOverdue(order);
  const publicOccurrences = order.occurrences.filter((o) => o.isCustomerVisible);

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div className="flex-1 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="w-full max-w-lg bg-white shadow-2xl overflow-y-auto flex flex-col">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-start justify-between gap-3 z-10">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <StatusBadge status={order.status} />
              {overdue && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-700">
                  <AlertTriangle size={11} /> Atrasado
                </span>
              )}
            </div>
            <h2 className="text-lg font-bold text-slate-900 leading-snug">{order.title}</h2>
            <p className="text-xs text-slate-500 mt-0.5 font-mono">#{order.protocol}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 flex-shrink-0"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-6 flex-1">
          {/* Meta */}
          <div className="grid grid-cols-2 gap-3">
            {[
              {
                label: 'Tipo',
                value: TYPE_LABELS[order.type] || order.type,
                icon: <Tag size={13} />,
              },
              {
                label: 'Prioridade',
                value: PRIORITY_MAP[order.priority]?.label || order.priority,
                icon: <Shield size={13} />,
                color: PRIORITY_MAP[order.priority]?.color,
              },
              {
                label: 'Criado em',
                value: formatDate(order.createdAt),
                icon: <Calendar size={13} />,
              },
              {
                label: 'Prazo SLA',
                value: order.deadlineAt ? formatDateTime(order.deadlineAt) : '—',
                icon: <Clock size={13} />,
                color: overdue ? 'text-rose-600 font-semibold' : undefined,
              },
              {
                label: 'Responsável',
                value: order.analystName || 'Não atribuído',
                icon: <User size={13} />,
              },
            ].map((item, i) => (
              <div key={i} className="bg-slate-50 rounded-lg px-3 py-2.5">
                <div className="flex items-center gap-1.5 text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1">
                  {item.icon}
                  {item.label}
                </div>
                <div className={`text-sm font-semibold ${item.color || 'text-slate-800'}`}>
                  {item.value}
                </div>
              </div>
            ))}
          </div>

          {/* Description */}
          <div>
            <h3 className="text-xs uppercase font-bold text-slate-400 tracking-wider mb-2">
              Descrição
            </h3>
            <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
              {order.description}
            </p>
          </div>

          {/* Tags */}
          {order.tags.length > 0 && (
            <div>
              <h3 className="text-xs uppercase font-bold text-slate-400 tracking-wider mb-2">
                Tags
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {order.tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-2 py-0.5 bg-slate-100 text-slate-600 text-xs rounded-md font-medium"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Timeline de ocorrências */}
          <div>
            <h3 className="text-xs uppercase font-bold text-slate-400 tracking-wider mb-3 flex items-center gap-1.5">
              <MessageSquare size={12} />
              Histórico de Atualizações
            </h3>
            {publicOccurrences.length === 0 ? (
              <p className="text-sm text-slate-400 italic">Sem atualizações públicas ainda.</p>
            ) : (
              <div className="space-y-3">
                {publicOccurrences.map((occ) => (
                  <div key={occ.id} className="flex gap-3">
                    <div className="flex-shrink-0 w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 text-xs font-bold">
                      {(occ.actorUser?.name || 'S').charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 bg-slate-50 rounded-xl px-3 py-2.5 border border-slate-100">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-semibold text-slate-700">
                          {occ.actorUser?.name || 'Sistema'}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {formatDateTime(occ.createdAt)}
                        </span>
                      </div>
                      <p className="text-sm text-slate-700 leading-relaxed">{occ.message}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Attachments */}
          {order.attachments.filter((a) => !a.isInternal).length > 0 && (
            <div>
              <h3 className="text-xs uppercase font-bold text-slate-400 tracking-wider mb-2 flex items-center gap-1.5">
                <Paperclip size={12} />
                Anexos
              </h3>
              <div className="space-y-2">
                {order.attachments
                  .filter((a) => !a.isInternal)
                  .map((att) => (
                    <div
                      key={att.id}
                      className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-lg border border-slate-200"
                    >
                      <Paperclip size={13} className="text-slate-400 flex-shrink-0" />
                      <span className="text-sm text-slate-700 truncate">{att.fileName}</span>
                      <span className="text-[10px] text-slate-400 ml-auto flex-shrink-0">
                        {formatDate(att.uploadedAt)}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>

        <div className="sticky bottom-0 bg-white border-t border-slate-200 px-6 py-4">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg text-sm text-slate-700 hover:bg-slate-50 font-medium"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}

/* ========================================================= */
/* Main Portal Page                                           */
/* ========================================================= */
export default function CustomerPortalPage() {
  const [orders, setOrders] = useState<ServiceOrder[]>([]);
  const [user, setUser] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'closed'>('all');
  const [selected, setSelected] = useState<ServiceOrder | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [meRes, ordersRes] = await Promise.all([
        fetch('/api/auth/me', { cache: 'no-store' }),
        fetch('/api/service-orders', { cache: 'no-store' }),
      ]);

      if (meRes.status === 401 || ordersRes.status === 401) {
        window.location.href = '/login';
        return;
      }

      const [meData, ordersData] = await Promise.all([
        meRes.ok ? meRes.json() : null,
        ordersRes.ok ? ordersRes.json() : [],
      ]);

      setUser(meData);
      setOrders(Array.isArray(ordersData) ? ordersData : []);
    } catch {
      setLoadError('Não foi possível carregar seus chamados. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, []);

  const stats = useMemo(() => {
    const active = orders.filter((o) => isActive(o.status));
    const closed = orders.filter((o) => ['FECHADA', 'CANCELADA', 'RESOLVIDA'].includes(o.status));
    const overdue = active.filter((o) => isOverdue(o));
    return {
      total: orders.length,
      active: active.length,
      closed: closed.length,
      overdue: overdue.length,
    };
  }, [orders]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return orders
      .filter((o) => {
        const matchQ =
          !q || o.protocol.toLowerCase().includes(q) || o.title.toLowerCase().includes(q);
        const matchStatus =
          statusFilter === 'all'
            ? true
            : statusFilter === 'active'
              ? isActive(o.status)
              : ['FECHADA', 'CANCELADA', 'RESOLVIDA'].includes(o.status);
        return matchQ && matchStatus;
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [orders, search, statusFilter]);

  const handleLogout = useCallback(async () => {
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    window.location.href = '/login';
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20">
      {/* Header */}
      <header className="bg-white/90 backdrop-blur-sm border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center">
              <Ticket size={18} className="text-white" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-slate-900">Portal do Cliente</h1>
              {user && <p className="text-xs text-slate-500">{user.tenant?.tradeName}</p>}
            </div>
          </div>
          <div className="flex items-center gap-3">
            {user && (
              <span className="text-xs text-slate-600 hidden sm:block">
                Olá, <strong>{user.name.split(' ')[0]}</strong>
              </span>
            )}
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-600 hover:bg-slate-50"
            >
              <LogOut size={12} />
              Sair
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {/* Welcome */}
        {!loading && user && (
          <div className="bg-gradient-to-r from-indigo-600 to-blue-600 rounded-2xl p-6 text-white">
            <h2 className="text-xl font-bold mb-1">Bem-vindo, {user.name.split(' ')[0]}!</h2>
            <p className="text-indigo-200 text-sm">
              Acompanhe aqui o status dos seus chamados e interações com nossa equipe técnica.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
              {[
                { label: 'Total de Chamados', value: stats.total, color: 'bg-white/20' },
                { label: 'Em Andamento', value: stats.active, color: 'bg-amber-400/30' },
                { label: 'Concluídos', value: stats.closed, color: 'bg-emerald-400/30' },
                {
                  label: 'Com Atraso',
                  value: stats.overdue,
                  color: stats.overdue > 0 ? 'bg-rose-400/30' : 'bg-white/10',
                },
              ].map((s, i) => (
                <div key={i} className={`${s.color} rounded-xl p-3 text-center`}>
                  <div className="text-2xl font-black">{loading ? '…' : s.value}</div>
                  <div className="text-xs text-indigo-200 mt-0.5">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {loadError && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-rose-700 text-sm flex items-center gap-2">
            <AlertTriangle size={16} />
            {loadError}
            <button onClick={load} className="ml-auto underline text-xs">
              Tentar novamente
            </button>
          </div>
        )}

        {/* Filter Bar */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Pesquisar por protocolo ou título..."
              className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
          <div className="flex gap-1 bg-white border border-slate-200 rounded-lg p-1">
            {(
              [
                ['all', 'Todos'],
                ['active', 'Em andamento'],
                ['closed', 'Concluídos'],
              ] as const
            ).map(([val, label]) => (
              <button
                key={val}
                onClick={() => setStatusFilter(val)}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                  statusFilter === val
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 border border-slate-200 bg-white rounded-lg text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>

        {/* Orders List */}
        <div className="space-y-3">
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="bg-white rounded-xl border border-slate-200 p-4 flex items-start gap-4 animate-pulse"
              >
                <div className="w-10 h-10 rounded-xl bg-slate-100" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-slate-100 rounded w-1/3" />
                  <div className="h-3 bg-slate-100 rounded w-2/3" />
                </div>
              </div>
            ))
          ) : filtered.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 px-6 py-14 text-center">
              <Activity size={36} className="mx-auto mb-3 text-slate-300" />
              <p className="text-slate-500 font-medium">
                {search || statusFilter !== 'all'
                  ? 'Nenhum chamado encontrado para os filtros selecionados.'
                  : 'Você ainda não possui chamados.'}
              </p>
              <p className="text-slate-400 text-sm mt-1">
                Entre em contato com o suporte se precisar abrir um chamado.
              </p>
            </div>
          ) : (
            filtered.map((order) => {
              const overdue = isOverdue(order);
              const status = STATUS_MAP[order.status] || STATUS_MAP.ABERTA;
              const active = isActive(order.status);
              return (
                <button
                  key={order.id}
                  onClick={() => setSelected(order)}
                  className={`w-full bg-white rounded-xl border text-left p-4 transition-all hover:shadow-md hover:border-indigo-300 group ${
                    overdue ? 'border-rose-200 bg-rose-50/30' : 'border-slate-200'
                  }`}
                >
                  <div className="flex items-start gap-4">
                    {/* Icon */}
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                        overdue ? 'bg-rose-100' : active ? 'bg-indigo-100' : 'bg-slate-100'
                      }`}
                    >
                      {overdue ? (
                        <AlertTriangle size={18} className="text-rose-600" />
                      ) : active ? (
                        <Clock size={18} className="text-indigo-600" />
                      ) : (
                        <CheckCircle2 size={18} className="text-emerald-600" />
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                            <span className="font-mono text-xs text-slate-500">
                              #{order.protocol}
                            </span>
                            <StatusBadge status={order.status} />
                            {overdue && (
                              <span className="text-[10px] font-bold text-rose-600 bg-rose-100 px-2 py-0.5 rounded-full">
                                ⚠ Prazo expirado
                              </span>
                            )}
                          </div>
                          <h3 className="font-semibold text-slate-900 truncate">{order.title}</h3>
                          <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">
                            {order.description}
                          </p>
                        </div>
                        <ChevronRight
                          size={16}
                          className="text-slate-400 group-hover:text-indigo-600 flex-shrink-0 mt-1 transition-colors"
                        />
                      </div>

                      <div className="flex items-center gap-3 mt-2 text-[11px] text-slate-400 flex-wrap">
                        <span>{TYPE_LABELS[order.type] || order.type}</span>
                        <span>·</span>
                        <span className={PRIORITY_MAP[order.priority]?.color}>
                          {PRIORITY_MAP[order.priority]?.label}
                        </span>
                        {order.deadlineAt && (
                          <>
                            <span>·</span>
                            <span className={overdue ? 'text-rose-600 font-semibold' : ''}>
                              Prazo: {formatDate(order.deadlineAt)}
                            </span>
                          </>
                        )}
                        {order.analystName && (
                          <>
                            <span>·</span>
                            <span>Resp: {order.analystName}</span>
                          </>
                        )}
                        <span className="ml-auto">{formatDate(order.createdAt)}</span>
                      </div>

                      {order.occurrences.filter((o) => o.isCustomerVisible).length > 0 && (
                        <div className="mt-2 bg-slate-50 rounded-lg px-3 py-2 border border-slate-100">
                          <p className="text-xs text-slate-500">
                            <MessageSquare size={11} className="inline mr-1" />
                            <strong>Última atualização:</strong>{' '}
                            {order.occurrences
                              .filter((o) => o.isCustomerVisible)[0]
                              ?.message?.slice(0, 80)}
                            {(order.occurrences.filter((o) => o.isCustomerVisible)[0]?.message
                              ?.length ?? 0) > 80
                              ? '…'
                              : ''}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>

        {!loading && filtered.length > 0 && (
          <p className="text-center text-xs text-slate-400">
            {filtered.length} chamado{filtered.length !== 1 ? 's' : ''} exibido
            {filtered.length !== 1 ? 's' : ''}
            {orders.length !== filtered.length && ` de ${orders.length} total`}
          </p>
        )}
      </main>

      {/* Drawer */}
      {selected && <OrderDetail order={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
