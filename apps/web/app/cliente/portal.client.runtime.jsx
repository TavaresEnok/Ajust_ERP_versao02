'use client';

import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from 'react/jsx-runtime';
import React, { useState, useEffect, useMemo, createContext, useContext } from 'react';
import {
  LayoutDashboard,
  Settings,
  Search,
  Eye,
  FileText,
  Calendar,
  CheckCircle2,
  Clock,
  Copy,
  Plus,
  UploadCloud,
  RefreshCw,
  Activity,
} from 'lucide-react';
import { SharedPortalShell } from '../shared/shared-portal-shell';
import {
  ErpStatusBadge,
  ErpKpiCard,
  ErpSkeletonCards,
  ErpToast,
  ErpModal,
  ErpDataTable,
  cn,
} from '../shared/shared-ui';
import ClientPortalFallback from './client-portal-fallback';
/* ═══════════════════════════════ THEME ═══════════════════════════════ */
const ThemeCtx = createContext({ dark: false, toggle: () => {} });
const useTheme = () => useContext(ThemeCtx);
const t = (dark, dVal, lVal) => (dark ? dVal : lVal);
/* ═══════════════════════════════ HELPERS ═══════════════════════════════ */
const CLIENT_NAME = 'TONYNET';
const CLIENT_DOC = '16.893.178/0001-49';
const STATUS_API_TO_UI = {
  ABERTA: 'Aberta',
  EM_EXECUCAO: 'Em execução',
  PENDENTE: 'Pendente',
  ENCERRADA: 'Encerrada',
};
const TYPE_API_TO_UI = {
  ROMPIMENTO: 'Rompimento',
  LENTIDAO: 'Lentidão',
  CONFIGURACAO_ONU: 'Config. ONU',
  TROCA_SENHA: 'Troca de Senha',
  CANCELAMENTO: 'Cancelamento',
  AUDITORIA: 'Auditoria',
  INSTALACAO: 'Instalação',
  BGP: 'BGP',
};
const ROLE_CODE_TO_LABEL = {
  super_admin: 'Super Admin',
  gerente: 'Gerente',
  analista: 'Analista',
  tecnico: 'Técnico',
  cliente: 'Cliente',
  leitura: 'Leitura',
};
const pad = (n) => String(n).padStart(2, '0');
const fmtDt = (d) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
const toTs = (v, fb = Date.now()) => {
  if (!v) return fb;
  const x = new Date(v).getTime();
  return Number.isFinite(x) ? x : fb;
};
const parseDT = (v) => new Date(v.replace(' ', 'T'));
const isClosed = (s) => s === 'Encerrada';
const toBr = (v) => {
  if (!v) return '-';
  const [d, time] = v.split(' ');
  const [y, m, dd] = d.split('-');
  return `${dd}/${m}/${y}${time ? `, ${time}` : ''}`;
};
const copyText = async (v) => {
  if (!v) return false;
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(v);
      return true;
    } catch {}
  }
  if (typeof document === 'undefined') return false;
  const a = document.createElement('textarea');
  a.value = v;
  a.setAttribute('readonly', '');
  a.style.cssText = 'position:fixed;left:-9999px';
  document.body.appendChild(a);
  a.focus();
  a.select();
  let ok = false;
  try {
    ok = document.execCommand('copy');
  } catch {}
  document.body.removeChild(a);
  return ok;
};
const apiErr = async (r, fb) => {
  const p = await r.json().catch(() => null);
  if (!p) return fb;
  if (typeof p === 'string') return p || fb;
  if (typeof p.error === 'string') return p.error || fb;
  return fb;
};
const mapUser = (m) => ({
  id: m.user?.id || m.id,
  name: m.user?.name || '-',
  email: m.user?.email || '-',
  roleCode: m.role?.code || 'leitura',
  role: ROLE_CODE_TO_LABEL[m.role?.code] || m.role?.name || 'Leitura',
  active: m.user?.status === 'ACTIVE',
  status: m.user?.status || 'INACTIVE',
});
const mapOcc = (a) => {
  const ct = toTs(a?.createdAt),
    ut = toTs(a?.updatedAt, ct);
  const st = STATUS_API_TO_UI[a?.status] || 'Aberta';
  const notes = Array.isArray(a?.annotations)
    ? a.annotations
        .map((n) => ({
          id: n.id,
          user: n.actorUser?.name || 'Sistema',
          message: n.message || '',
          createdAt: fmtDt(new Date(toTs(n.createdAt, ut))),
        }))
        .sort((x, y) => toTs(y.createdAt) - toTs(x.createdAt))
    : [];
  const os =
    Array.isArray(a?.serviceOrders) && a.serviceOrders.length > 0 ? a.serviceOrders[0] : null;
  const forecast = os?.deadlineAt ? fmtDt(new Date(toTs(os.deadlineAt))) : '-';
  const osComment = os?.internalNotes || '-';
  return {
    id: a?.id,
    protocol: a?.number || '-',
    provider: a?.provider || CLIENT_NAME,
    type: TYPE_API_TO_UI[a?.type] || a?.type || '-',
    status: st,
    forecast,
    osComment,
    created_at: fmtDt(new Date(ct)),
    updated_at: fmtDt(new Date(ut)),
    description: os?.description || a?.description || '-',
    annotations: notes,
  };
};
const mapOccs = (arr) =>
  Array.isArray(arr) ? arr.map(mapOcc).sort((a, b) => toTs(b.created_at) - toTs(a.created_at)) : [];
const createClientMockOccurrencesPayload = () => {
  const now = Date.now();
  return [
    {
      id: 'mock-client-occ-1',
      number: '20260002001',
      provider: CLIENT_NAME,
      type: 'ROMPIMENTO',
      status: 'EM_EXECUCAO',
      createdAt: new Date(now - 7 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(now - 30 * 60 * 1000).toISOString(),
      description: 'Intermitência em enlace principal.',
      annotations: [
        {
          id: 'c-an-1',
          message: 'Equipe em deslocamento.',
          createdAt: new Date(now - 40 * 60 * 1000).toISOString(),
          actorUser: { name: 'NOC' },
        },
      ],
      serviceOrders: [
        {
          id: 'c-os-1',
          deadlineAt: new Date(now + 4 * 60 * 60 * 1000).toISOString(),
          internalNotes: 'Janela técnica em andamento.',
          description: 'Recomposição de rota com contingência.',
        },
      ],
    },
    {
      id: 'mock-client-occ-2',
      number: '20260002002',
      provider: CLIENT_NAME,
      type: 'LENTIDAO',
      status: 'ABERTA',
      createdAt: new Date(now - 20 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(now - 2 * 60 * 60 * 1000).toISOString(),
      description: 'Lentidão em horário de pico no bairro central.',
      annotations: [],
      serviceOrders: [
        {
          id: 'c-os-2',
          deadlineAt: new Date(now + 10 * 60 * 60 * 1000).toISOString(),
          internalNotes: 'Aguardando validação.',
          description: 'Análise de tráfego por POP.',
        },
      ],
    },
    {
      id: 'mock-client-occ-3',
      number: '20260002003',
      provider: CLIENT_NAME,
      type: 'AUDITORIA',
      status: 'ENCERRADA',
      createdAt: new Date(now - 72 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(now - 48 * 60 * 60 * 1000).toISOString(),
      description: 'Auditoria preventiva concluída.',
      annotations: [
        {
          id: 'c-an-3',
          message: 'Sem desvios críticos.',
          createdAt: new Date(now - 50 * 60 * 60 * 1000).toISOString(),
          actorUser: { name: 'Gerência' },
        },
      ],
      serviceOrders: [
        {
          id: 'c-os-3',
          deadlineAt: new Date(now - 49 * 60 * 60 * 1000).toISOString(),
          internalNotes: 'Fechada com êxito.',
          description: 'Checklist final executado.',
        },
      ],
    },
  ];
};
/* ═══════════════════════════════ OCCURRENCE DETAIL ═══════════════════════════════ */
const OccurrenceDetailModal = ({ occurrence: occ, onClose, onCopyProtocol }) => {
  const { dark } = useTheme();
  useEffect(() => {
    if (!occ) return;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [occ]);
  if (!occ) return null;
  const infos = [
    { label: 'Previsão de finalização', value: occ.forecast },
    { label: 'Última atualização', value: occ.updated_at },
  ];
  return _jsxs(ErpModal, {
    title: `#${occ.protocol}`,
    subtitle: `Criado em ${toBr(occ.created_at)}`,
    badge: _jsx(ErpStatusBadge, { status: occ.status }),
    onClose: onClose,
    maxWidth: 'max-w-3xl',
    dark: dark,
    actions: _jsxs(_Fragment, {
      children: [
        _jsxs('button', {
          onClick: () => onCopyProtocol(occ.protocol),
          className: cn(
            'inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors border',
            dark
              ? 'bg-white/5 border-slate-700/50 text-white hover:bg-white/10'
              : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200',
          ),
          children: [_jsx(Copy, { size: 14 }), ' Copiar protocolo'],
        }),
        _jsx('button', {
          onClick: onClose,
          className: cn(
            'px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors border',
            dark
              ? 'bg-white/5 border-slate-700/50 text-slate-400 hover:bg-white/10'
              : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100',
          ),
          children: 'Fechar',
        }),
      ],
    }),
    children: [
      _jsxs('div', {
        children: [
          _jsx('label', {
            className: cn(
              'text-[10px] font-bold uppercase tracking-widest block mb-2',
              dark ? 'text-slate-500' : 'text-slate-400',
            ),
            children: 'Descri\u00E7\u00E3o da Ocorr\u00EAncia/O.S.',
          }),
          _jsx('div', {
            className: cn(
              'rounded-xl p-4 text-sm leading-relaxed border font-medium',
              dark
                ? 'bg-[#0d1628]/80 border-slate-700/60 text-slate-300'
                : 'bg-slate-50 border-slate-200 text-slate-800',
            ),
            children: occ.description || '-',
          }),
        ],
      }),
      _jsxs('div', {
        className: 'grid grid-cols-2 gap-4',
        children: [
          _jsxs('div', {
            className: cn(
              'rounded-xl p-4 border',
              dark ? 'bg-[#0f172a]/80 border-slate-700/60' : 'bg-slate-50/80 border-slate-200',
            ),
            children: [
              _jsx('label', {
                className: cn(
                  'text-[10px] font-bold uppercase tracking-widest block mb-1',
                  dark ? 'text-slate-600' : 'text-slate-400',
                ),
                children: 'Previs\u00E3o de finaliza\u00E7\u00E3o',
              }),
              _jsx('p', {
                className: cn('text-lg font-bold', dark ? 'text-slate-400' : 'text-indigo-900'),
                children: occ.forecast || '-',
              }),
            ],
          }),
          _jsxs('div', {
            className: cn(
              'rounded-xl p-4 border',
              dark ? 'bg-[#0f172a]/80 border-slate-700/60' : 'bg-slate-50/80 border-slate-200',
            ),
            children: [
              _jsx('label', {
                className: cn(
                  'text-[10px] font-bold uppercase tracking-widest block mb-1',
                  dark ? 'text-slate-600' : 'text-slate-400',
                ),
                children: '\u00DAltima atualiza\u00E7\u00E3o',
              }),
              _jsx('p', {
                className: cn('text-lg font-bold', dark ? 'text-white' : 'text-cyan-900'),
                children: occ.updated_at || '-',
              }),
            ],
          }),
        ],
      }),
      _jsxs('div', {
        children: [
          _jsxs('div', {
            className: 'flex items-center justify-between mb-2',
            children: [
              _jsx('label', {
                className: cn(
                  'text-[10px] font-bold uppercase tracking-widest',
                  dark ? 'text-slate-500' : 'text-slate-400',
                ),
                children: 'Hist\u00F3rico de Anota\u00E7\u00F5es',
              }),
              occ.annotations.length > 0 &&
                _jsxs('span', {
                  className:
                    'bg-blue-600/20 text-blue-400 text-[9px] font-bold px-2 py-0.5 rounded border border-blue-500/20 uppercase',
                  children: [
                    occ.annotations.length,
                    ' ',
                    occ.annotations.length === 1 ? 'registro' : 'registros',
                  ],
                }),
            ],
          }),
          occ.annotations.length === 0
            ? _jsx('div', {
                className: cn(
                  'border border-dashed rounded-xl p-10 flex flex-col items-center justify-center',
                  dark ? 'border-slate-700/60 bg-[#0f172a]/60' : 'border-slate-200 bg-slate-50/50',
                ),
                children: _jsx('p', {
                  className: cn('text-sm italic', dark ? 'text-slate-600' : 'text-slate-400'),
                  children: 'Sem hist\u00F3rico de anota\u00E7\u00F5es',
                }),
              })
            : _jsx('div', {
                className: 'space-y-2.5',
                children: occ.annotations.map((note) =>
                  _jsxs(
                    'div',
                    {
                      className: cn(
                        'rounded-xl p-4 border',
                        dark
                          ? 'bg-[#0d1628]/80 border-slate-700/60'
                          : 'bg-slate-50 border-slate-200',
                      ),
                      children: [
                        _jsxs('div', {
                          className: 'flex items-center justify-between mb-2',
                          children: [
                            _jsx('span', {
                              className: cn(
                                'text-[10px] uppercase font-bold tracking-widest',
                                dark ? 'text-slate-500' : 'text-slate-400',
                              ),
                              children: 'Anota\u00E7\u00E3o',
                            }),
                            _jsx('span', {
                              className: cn(
                                'text-[10px]',
                                dark ? 'text-slate-600' : 'text-slate-400',
                              ),
                              children: toBr(note.createdAt),
                            }),
                          ],
                        }),
                        _jsx('p', {
                          className: cn(
                            'text-sm leading-relaxed',
                            dark ? 'text-slate-300' : 'text-slate-600',
                          ),
                          children: note.message,
                        }),
                      ],
                    },
                    note.id,
                  ),
                ),
              }),
        ],
      }),
    ],
  });
};
/* ═══════════════════════════════ SKELETON ═══════════════════════════════ */
const SkeletonTable = ({ dark, rows = 6 }) =>
  _jsxs('div', {
    className: cn(
      'rounded-2xl overflow-hidden border',
      dark ? 'bg-[#111b2e]/75 border-slate-700/60' : 'bg-white border-slate-200 shadow-sm',
    ),
    children: [
      _jsx('div', {
        className: cn('p-4 border-b', dark ? 'border-slate-700/50' : 'border-slate-100'),
        children: _jsx('div', {
          className: cn(
            'h-9 w-60 rounded-xl animate-pulse',
            dark ? 'bg-[#1e293b]/60 backdrop-blur-md' : 'bg-slate-100',
          ),
        }),
      }),
      _jsx('div', {
        className: 'p-2',
        children: Array.from({ length: rows }).map((_, i) =>
          _jsx(
            'div',
            {
              className: cn(
                'h-14 rounded-lg mb-1 animate-pulse',
                dark ? 'bg-white/[0.02]' : 'bg-slate-50',
              ),
            },
            i,
          ),
        ),
      }),
    ],
  });
/* ═══════════════════════════════ DASHBOARD ═══════════════════════════════ */
const ClientDashboardView = ({ occurrences, onOpen, onCopy, onSync, syncing, loading }) => {
  const { dark } = useTheme();
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState('ativas');
  const [page, setPage] = useState(1);
  const perPage = 12;
  const kpis = useMemo(() => {
    const active = occurrences.filter((o) => !isClosed(o.status)).length;
    const mk = new Date().toISOString().slice(0, 7);
    const opened = occurrences.filter((o) => o.created_at.slice(0, 7) === mk).length;
    const closed = occurrences.filter(
      (o) => isClosed(o.status) && o.updated_at.slice(0, 7) === mk,
    ).length;
    return { active, total: occurrences.length, opened, closed };
  }, [occurrences]);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return occurrences
      .filter((o) => {
        const byTab = tab === 'ativas' ? !isClosed(o.status) : isClosed(o.status);
        const byQ =
          !q ||
          o.protocol.toLowerCase().includes(q) ||
          o.description.toLowerCase().includes(q) ||
          o.type.toLowerCase().includes(q);
        return byTab && byQ;
      })
      .sort((a, b) => parseDT(b.created_at) - parseDT(a.created_at));
  }, [occurrences, search, tab]);
  useEffect(() => {
    setPage(1);
  }, [search, tab]);
  const tp = Math.max(1, Math.ceil(filtered.length / perPage));
  const cp = Math.min(page, tp);
  const rows = filtered.slice((cp - 1) * perPage, cp * perPage);
  const ativasN = occurrences.filter((o) => !isClosed(o.status)).length;
  const encerradasN = occurrences.filter((o) => isClosed(o.status)).length;
  return _jsxs(_Fragment, {
    children: [
      _jsxs('div', {
        className: 'flex items-end justify-between mb-8',
        children: [
          _jsxs('div', {
            children: [
              _jsx('h1', {
                className: cn('text-2xl font-bold mb-1', dark ? 'text-white' : 'text-slate-900'),
                children: 'Painel de Ocorr\u00EAncias',
              }),
              _jsx('p', {
                className: cn('text-sm', dark ? 'text-slate-500' : 'text-slate-400'),
                children: 'Vis\u00E3o geral das demandas ativas e hist\u00F3rico.',
              }),
            ],
          }),
          _jsxs('button', {
            onClick: onSync,
            disabled: syncing || loading,
            className: cn(
              'inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all border',
              dark
                ? 'border-slate-700/50 text-slate-400 hover:bg-white/5 disabled:opacity-40'
                : 'border-slate-200 text-slate-500 hover:bg-slate-100 disabled:opacity-40',
            ),
            children: [
              _jsx(RefreshCw, { size: 14, className: syncing ? 'animate-spin' : '' }),
              syncing ? 'Sincronizando...' : 'Atualizar',
            ],
          }),
        ],
      }),
      loading
        ? _jsx(ErpSkeletonCards, { dark: dark })
        : _jsxs('div', {
            className: 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8',
            children: [
              _jsx(ErpKpiCard, {
                dark: dark,
                label: 'TOTAL ABERTAS',
                value: kpis.active,
                icon: Clock,
                iconContainerClassName: dark ? 'bg-blue-900/20 border-blue-500/30' : '',
                iconClassName: dark ? 'text-blue-400' : '',
              }),
              _jsx(ErpKpiCard, {
                dark: dark,
                label: 'TOTAIS DE O.S',
                value: kpis.total,
                icon: FileText,
                iconContainerClassName: dark ? 'bg-purple-900/20 border-purple-500/30' : '',
                iconClassName: dark ? 'text-purple-400' : '',
              }),
              _jsx(ErpKpiCard, {
                dark: dark,
                label: 'ENTRADAS (M\u00CAS)',
                value: kpis.opened,
                icon: Calendar,
                iconContainerClassName: dark ? 'bg-orange-900/20 border-orange-500/30' : '',
                iconClassName: dark ? 'text-orange-400' : '',
              }),
              _jsx(ErpKpiCard, {
                dark: dark,
                label: 'CONCLU\u00CDDAS (M\u00CAS)',
                value: kpis.closed,
                icon: CheckCircle2,
                iconContainerClassName: dark ? 'bg-emerald-900/20 border-emerald-500/30' : '',
                iconClassName: dark ? 'text-emerald-400' : '',
              }),
            ],
          }),
      loading
        ? _jsx(SkeletonTable, { dark: dark })
        : _jsxs('div', {
            className: cn(
              'rounded-2xl overflow-hidden border',
              dark ? 'bg-[#111b2e]/75 border-slate-700/60' : 'bg-white border-slate-200 shadow-sm',
            ),
            children: [
              _jsxs('div', {
                className: cn(
                  'p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b',
                  dark ? 'border-slate-700/60' : 'border-slate-100',
                ),
                children: [
                  _jsx('div', {
                    className: cn(
                      'flex gap-2 p-1 rounded-lg',
                      dark ? 'bg-[#0d1628]/80' : 'bg-slate-100',
                    ),
                    children: [
                      {
                        key: 'ativas',
                        label: 'Ativas',
                        count: ativasN,
                        Icon: Clock,
                        activeThemeClass: dark
                          ? 'bg-[#0d1628] text-white shadow-lg'
                          : 'bg-white text-slate-900 shadow-sm',
                      },
                      {
                        key: 'encerradas',
                        label: 'Fechadas',
                        count: encerradasN,
                        Icon: FileText,
                        activeThemeClass: dark
                          ? 'bg-[#0d1628] text-emerald-500 shadow-lg border-b-2 border-emerald-500'
                          : 'bg-white text-emerald-600 shadow-sm border-b-2 border-emerald-500',
                      },
                    ].map(({ key, label, count, Icon, activeThemeClass }) =>
                      _jsxs(
                        'button',
                        {
                          onClick: () => setTab(key),
                          className: cn(
                            'flex items-center gap-2 px-6 py-2 rounded-md text-xs font-bold transition-all',
                            tab === key
                              ? activeThemeClass
                              : cn(
                                  dark
                                    ? 'text-slate-500 hover:text-slate-300'
                                    : 'text-slate-500 hover:text-slate-700',
                                ),
                          ),
                          children: [
                            _jsx(Icon, { size: 14 }),
                            label,
                            _jsx('span', {
                              className: 'opacity-50 font-normal ml-0.5',
                              children: count,
                            }),
                          ],
                        },
                        key,
                      ),
                    ),
                  }),
                  _jsxs('div', {
                    className: 'relative group',
                    children: [
                      _jsx(Search, {
                        className: cn(
                          'absolute left-3 top-1/2 -translate-y-1/2 transition-colors',
                          dark ? 'text-slate-600 group-hover:text-slate-400' : 'text-slate-400',
                        ),
                        size: 16,
                      }),
                      _jsx('input', {
                        value: search,
                        onChange: (e) => setSearch(e.target.value),
                        placeholder: 'Buscar protocolo ou texto...',
                        className: cn(
                          'rounded-lg py-2 pl-10 pr-4 text-xs w-64 focus:outline-none transition-all border',
                          dark
                            ? 'bg-[#0d1628]/80 border-slate-700/60 text-white placeholder:text-slate-600 focus:border-blue-500'
                            : 'bg-slate-50 border-slate-200 text-slate-700 placeholder:text-slate-400 focus:border-blue-400',
                        ),
                      }),
                    ],
                  }),
                ],
              }),
              _jsx(ErpDataTable, {
                dark: dark,
                rows: rows,
                rowKey: (o) => String(o.id),
                onRowClick: (o) => onOpen(o),
                emptyTitle: 'Nenhuma ocorr\u00EAncia encontrada.',
                emptyDescription:
                  tab === 'ativas'
                    ? 'Nenhuma demanda ativa no momento.'
                    : 'Nenhuma demanda encerrada ainda.',
                columns: [
                  {
                    key: 'protocol',
                    header: 'Protocolo',
                    render: (o) =>
                      _jsxs('div', {
                        children: [
                          _jsx('p', {
                            className: cn(
                              'text-xs font-bold mb-0.5',
                              dark ? 'text-slate-300' : 'text-slate-700',
                            ),
                            children: o.protocol,
                          }),
                          _jsx('p', {
                            className: cn(
                              'text-[10px]',
                              dark ? 'text-slate-600' : 'text-slate-400',
                            ),
                            children: toBr(o.created_at),
                          }),
                        ],
                      }),
                  },
                  {
                    key: 'description',
                    header: 'Descrição',
                    render: (o) =>
                      _jsx('p', {
                        className: cn(
                          'text-xs max-w-md truncate font-medium',
                          dark ? 'text-white' : 'text-slate-700',
                        ),
                        children: o.description,
                      }),
                  },
                  {
                    key: 'type',
                    header: 'Tipo',
                    render: (o) => {
                      const typeStr = o.type.toUpperCase();
                      const typeColorMap = {
                        ROMPIMENTO: 'bg-fuchsia-500/10 text-fuchsia-400 border-fuchsia-500/20',
                        LENTIDÃO: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
                        'CONFIG. ONU': 'bg-purple-500/10 text-purple-400 border-purple-500/20',
                        'TROCA DE SENHA': 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
                        CANCELAMENTO: 'bg-pink-500/10 text-pink-400 border-pink-500/20',
                        AUDITORIA: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
                        INSTALAÇÃO: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
                        BGP: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
                      };
                      const fallbackColors = [
                        'bg-purple-500/10 text-purple-400 border-purple-500/20',
                        'bg-orange-500/10 text-orange-400 border-orange-500/20',
                        'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
                        'bg-pink-500/10 text-pink-400 border-pink-500/20',
                      ];
                      const typeColors =
                        typeColorMap[typeStr] ||
                        fallbackColors[typeStr.length % fallbackColors.length];
                      return _jsx('span', {
                        className: cn(
                          'text-[10px] font-bold px-2 py-1 rounded-md border uppercase',
                          typeColors,
                        ),
                        children: o.type,
                      });
                    },
                  },
                  {
                    key: 'status',
                    header: 'Status',
                    render: (o) => _jsx(ErpStatusBadge, { status: o.status }),
                  },
                  {
                    key: 'action',
                    header: _jsx('span', {
                      className: 'w-full inline-block text-center',
                      children: 'A\u00E7\u00E3o',
                    }),
                    render: (o) =>
                      _jsxs('div', {
                        className: 'inline-flex items-center gap-1',
                        children: [
                          _jsx('button', {
                            onClick: (e) => {
                              e.stopPropagation();
                              onCopy(o.protocol);
                            },
                            className: cn(
                              'p-1.5 rounded-lg transition-colors',
                              dark
                                ? 'text-slate-600 hover:text-white'
                                : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100',
                            ),
                            title: 'Copiar',
                            children: _jsx(Copy, { size: 16 }),
                          }),
                          _jsx('button', {
                            className: cn(
                              'p-1.5 rounded-lg transition-colors',
                              dark
                                ? 'text-slate-600 hover:text-white'
                                : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100',
                            ),
                            title: 'Ver detalhes',
                            children: _jsx(Eye, { size: 16 }),
                          }),
                        ],
                      }),
                    className: 'text-center',
                    cellClassName: 'text-center',
                  },
                ],
              }),
              filtered.length > perPage &&
                _jsxs('div', {
                  className: cn(
                    'px-6 py-3 flex items-center justify-between border-t',
                    dark ? 'border-slate-700/50' : 'border-slate-100',
                  ),
                  children: [
                    _jsxs('span', {
                      className: cn('text-[11px]', dark ? 'text-slate-600' : 'text-slate-400'),
                      children: [
                        'P\u00E1gina ',
                        cp,
                        ' de ',
                        tp,
                        ' \u00B7 ',
                        filtered.length,
                        ' registros',
                      ],
                    }),
                    _jsx('div', {
                      className: 'flex gap-2',
                      children: ['Anterior', 'Próximo'].map((lbl, i) =>
                        _jsx(
                          'button',
                          {
                            onClick: () =>
                              setPage((p) => (i === 0 ? Math.max(1, p - 1) : Math.min(tp, p + 1))),
                            disabled: i === 0 ? cp === 1 : cp === tp,
                            className: cn(
                              'px-3 py-1.5 text-xs rounded-lg transition-colors border disabled:opacity-25',
                              dark
                                ? 'border-slate-700/50 text-slate-400 hover:bg-white/5'
                                : 'border-slate-200 text-slate-500 hover:bg-slate-100',
                            ),
                            children: lbl,
                          },
                          lbl,
                        ),
                      ),
                    }),
                  ],
                }),
            ],
          }),
    ],
  });
};
/* ═══════════════════════════════ SETTINGS ═══════════════════════════════ */
const ClientSettingsView = ({
  logo,
  users,
  roles,
  tenantId,
  userRole,
  notify,
  onUsersRefresh,
  onLogoRefresh,
}) => {
  const { dark } = useTheme();
  const [showAdd, setShowAdd] = useState(false);
  const [nu, setNu] = useState({ name: '', email: '', password: '', roleCode: 'leitura' });
  const [fieldErrors, setFieldErrors] = useState({});
  const [err, setErr] = useState('');
  const [submitting, setSub] = useState(false);
  const [uploading, setUploading] = useState(false);
  const canManage = ['super_admin', 'gerente'].includes(userRole || '');
  useEffect(() => {
    if (roles.length) setNu((p) => ({ ...p, roleCode: p.roleCode || roles[0].code }));
  }, [roles]);
  const onLogo = (e) => {
    const f = e.target.files?.[0];
    if (!f || !tenantId) return;
    const fd = new FormData();
    fd.set('file', f);
    (async () => {
      setUploading(true);
      try {
        const r = await fetch(`/api/iam/tenants/${encodeURIComponent(tenantId)}/logo`, {
          method: 'POST',
          body: fd,
        });
        if (!r.ok) throw new Error(await apiErr(r, 'Erro.'));
        notify('Logo atualizada.');
        await onLogoRefresh?.();
      } catch (e) {
        notify(e.message);
      } finally {
        setUploading(false);
      }
    })();
  };
  const validateFields = () => {
    const errs = {};
    if (!nu.name.trim()) errs.name = 'Nome é obrigatório.';
    if (!nu.email.trim()) errs.email = 'E-mail é obrigatório.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nu.email.trim())) errs.email = 'E-mail inválido.';
    if (!nu.password.trim()) errs.password = 'Senha é obrigatória.';
    else if (nu.password.length < 8) errs.password = 'Mínimo de 8 caracteres.';
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };
  const add = () => {
    if (!tenantId || submitting) return;
    if (!validateFields()) return;
    (async () => {
      setSub(true);
      try {
        const r = await fetch('/api/iam/users', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            tenantId,
            name: nu.name.trim(),
            email: nu.email.trim(),
            password: nu.password,
            roleCode: nu.roleCode,
          }),
        });
        if (!r.ok) throw new Error(await apiErr(r, 'Erro.'));
        notify('Usuário criado.');
        setNu({ name: '', email: '', password: '', roleCode: roles[0]?.code || 'leitura' });
        setErr('');
        setFieldErrors({});
        setShowAdd(false);
        await onUsersRefresh?.();
      } catch (e) {
        setErr(e.message);
      } finally {
        setSub(false);
      }
    })();
  };
  const toggle = (u) => {
    if (!tenantId) return;
    (async () => {
      try {
        const r = await fetch(`/api/iam/users/${encodeURIComponent(u.id)}`, {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ tenantId, status: u.active ? 'INACTIVE' : 'ACTIVE' }),
        });
        if (!r.ok) throw new Error(await apiErr(r, 'Erro.'));
        await onUsersRefresh?.();
      } catch (e) {
        notify(e.message);
      }
    })();
  };
  const remove = (u) => {
    if (!tenantId) return;
    (async () => {
      try {
        const r = await fetch(
          `/api/iam/users/${encodeURIComponent(u.id)}?tenantId=${encodeURIComponent(tenantId)}`,
          { method: 'DELETE' },
        );
        if (!r.ok) throw new Error(await apiErr(r, 'Erro.'));
        notify('Removido.');
        await onUsersRefresh?.();
      } catch (e) {
        notify(e.message);
      }
    })();
  };
  const cardCls = cn(
    'rounded-2xl p-6 border',
    dark
      ? 'bg-[#1e293b]/60 backdrop-blur-md border-slate-700/60'
      : 'bg-white border-slate-200 shadow-sm',
  );
  const headCls = cn(
    'text-[10px] font-bold uppercase tracking-widest mb-4',
    dark ? 'text-slate-500' : 'text-slate-400',
  );
  const inputCls = cn(
    'w-full rounded-xl p-2.5 text-sm border focus:outline-none transition-colors',
    dark
      ? 'bg-[#0f172a]/80 backdrop-blur-xl border-slate-700/50 text-white placeholder:text-slate-600 focus:border-blue-500/40'
      : 'bg-slate-50 border-slate-200 text-slate-700 placeholder:text-slate-400 focus:border-blue-400',
  );
  return _jsxs(_Fragment, {
    children: [
      _jsxs('div', {
        className: 'mb-8',
        children: [
          _jsx('h1', {
            className: cn('text-2xl font-bold mb-1', dark ? 'text-white' : 'text-slate-900'),
            children: 'Configura\u00E7\u00F5es',
          }),
          _jsx('p', {
            className: cn('text-sm', dark ? 'text-slate-500' : 'text-slate-400'),
            children: 'Identidade visual e gest\u00E3o de usu\u00E1rios.',
          }),
        ],
      }),
      _jsxs('div', {
        className: cn(cardCls, 'mb-6'),
        children: [
          _jsx('h3', { className: headCls, children: 'Identidade Visual' }),
          _jsxs('div', {
            className: 'grid grid-cols-1 md:grid-cols-[200px_1fr] gap-5 items-start',
            children: [
              _jsx('div', {
                className: cn(
                  'h-28 rounded-xl flex items-center justify-center overflow-hidden border',
                  dark
                    ? 'border-slate-700/50 bg-[#0f172a]/80 backdrop-blur-xl'
                    : 'border-slate-200 bg-slate-50',
                ),
                children: logo.preview
                  ? _jsx('img', {
                      src: logo.preview,
                      alt: 'Logo',
                      className: 'max-h-20 object-contain',
                    })
                  : _jsx('span', {
                      className: cn('text-sm', dark ? 'text-slate-600' : 'text-slate-400'),
                      children: 'Sem logo',
                    }),
              }),
              _jsxs('div', {
                className: 'space-y-3',
                children: [
                  _jsxs('p', {
                    className: cn('text-sm', dark ? 'text-slate-400' : 'text-slate-500'),
                    children: [
                      'Arquivo: ',
                      _jsx('span', {
                        className: dark ? 'text-slate-500' : 'text-slate-400',
                        children: logo.name || 'não definido',
                      }),
                    ],
                  }),
                  _jsxs('label', {
                    className: cn(
                      'inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold cursor-pointer transition-colors border',
                      dark
                        ? 'border-slate-700/50 text-slate-300 hover:bg-white/5'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-100',
                    ),
                    children: [
                      _jsx(UploadCloud, { size: 15 }),
                      ' ',
                      uploading ? 'Enviando...' : 'Alterar logo',
                      _jsx('input', {
                        type: 'file',
                        accept: 'image/*',
                        className: 'hidden',
                        onChange: onLogo,
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
      _jsxs('div', {
        className: cardCls,
        children: [
          _jsxs('div', {
            className: 'flex items-center justify-between mb-4',
            children: [
              _jsx('h3', {
                className: headCls,
                style: { marginBottom: 0 },
                children: 'Usu\u00E1rios',
              }),
              canManage &&
                _jsxs('button', {
                  onClick: () => setShowAdd(true),
                  className:
                    'inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-xl text-xs font-semibold text-white transition-colors',
                  children: [_jsx(Plus, { size: 14 }), ' Adicionar'],
                }),
            ],
          }),
          _jsxs('div', {
            className: cn(
              'rounded-xl overflow-hidden border',
              dark ? 'border-slate-700/60' : 'border-slate-200',
            ),
            children: [
              _jsxs('div', {
                className: cn(
                  'grid grid-cols-12 px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider border-b',
                  dark
                    ? 'bg-[#0f172a]/80 backdrop-blur-xl border-slate-700/50 text-slate-500'
                    : 'bg-slate-50 border-slate-100 text-slate-400',
                ),
                children: [
                  _jsx('div', { className: 'col-span-3', children: 'Nome' }),
                  _jsx('div', { className: 'col-span-4', children: 'E-mail' }),
                  _jsx('div', { className: 'col-span-2 text-center', children: 'Perfil' }),
                  _jsx('div', { className: 'col-span-1 text-center', children: 'Status' }),
                  _jsx('div', { className: 'col-span-2 text-right', children: 'A\u00E7\u00F5es' }),
                ],
              }),
              users.map((u) =>
                _jsxs(
                  'div',
                  {
                    className: cn(
                      'grid grid-cols-12 px-4 py-3 items-center border-b last:border-b-0 transition-colors',
                      dark
                        ? 'border-white/[0.04] hover:bg-white/[0.02]'
                        : 'border-slate-100 hover:bg-slate-50',
                    ),
                    children: [
                      _jsx('div', {
                        className: cn(
                          'col-span-3 text-sm',
                          dark ? 'text-slate-300' : 'text-slate-700',
                        ),
                        children: u.name,
                      }),
                      _jsx('div', {
                        className: cn(
                          'col-span-4 text-sm',
                          dark ? 'text-slate-500' : 'text-slate-500',
                        ),
                        children: u.email,
                      }),
                      _jsx('div', {
                        className: 'col-span-2 text-center',
                        children: _jsx('span', {
                          className: cn(
                            'text-[10px] px-2 py-1 rounded-full font-bold uppercase border',
                            dark
                              ? 'bg-slate-500/10 border-slate-500/20 text-slate-400'
                              : 'bg-slate-100 border-slate-200 text-slate-500',
                          ),
                          children: u.role,
                        }),
                      }),
                      _jsx('div', {
                        className: 'col-span-1 text-center',
                        children: _jsx('span', {
                          className: cn(
                            'text-[10px] px-2 py-1 rounded-full font-bold uppercase border',
                            u.active
                              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                              : 'bg-amber-500/10 border-amber-500/20 text-amber-400',
                          ),
                          children: u.active ? 'Ativo' : 'Inativo',
                        }),
                      }),
                      _jsx('div', {
                        className: 'col-span-2 flex justify-end gap-2',
                        children: canManage
                          ? _jsxs(_Fragment, {
                              children: [
                                _jsx('button', {
                                  onClick: () => toggle(u),
                                  className: cn(
                                    'px-2.5 py-1 text-xs rounded-lg transition-colors border',
                                    dark
                                      ? 'border-slate-700/50 text-slate-400 hover:bg-white/5'
                                      : 'border-slate-200 text-slate-500 hover:bg-slate-100',
                                  ),
                                  children: u.active ? 'Desativar' : 'Ativar',
                                }),
                                _jsx('button', {
                                  onClick: () => remove(u),
                                  className:
                                    'px-2.5 py-1 text-xs rounded-lg border border-rose-500/20 text-rose-400 hover:bg-rose-500/10 transition-colors',
                                  children: 'Remover',
                                }),
                              ],
                            })
                          : _jsx('span', {
                              className: cn(
                                'text-[10px]',
                                dark ? 'text-slate-600' : 'text-slate-400',
                              ),
                              children: '\u2014',
                            }),
                      }),
                    ],
                  },
                  u.id,
                ),
              ),
              users.length === 0 &&
                _jsx('div', {
                  className: cn(
                    'px-4 py-10 text-sm text-center',
                    dark ? 'text-slate-600' : 'text-slate-400',
                  ),
                  children: 'Nenhum usu\u00E1rio carregado.',
                }),
            ],
          }),
        ],
      }),
      showAdd &&
        _jsx(DarkModal, {
          title: 'Adicionar Usu\u00E1rio',
          onClose: () => {
            setShowAdd(false);
            setErr('');
          },
          actions: _jsxs(_Fragment, {
            children: [
              _jsx('button', {
                onClick: () => setShowAdd(false),
                className: cn(
                  'px-4 py-2.5 rounded-xl text-sm font-semibold border transition-colors',
                  dark
                    ? 'border-slate-700/50 text-slate-400 hover:bg-white/5'
                    : 'border-slate-200 text-slate-500 hover:bg-slate-100',
                ),
                children: 'Cancelar',
              }),
              _jsx('button', {
                onClick: add,
                disabled: submitting,
                className:
                  'px-5 py-2.5 bg-blue-600 hover:bg-blue-500 rounded-xl text-sm font-semibold text-white disabled:opacity-50 transition-colors',
                children: submitting ? 'Salvando...' : 'Salvar',
              }),
            ],
          }),
          children: _jsxs('div', {
            className: 'space-y-4',
            children: [
              [
                { l: 'Nome', t: 'text', f: 'name', p: 'Nome do usuário' },
                { l: 'E-mail', t: 'email', f: 'email', p: 'usuario@cliente.com.br' },
                { l: 'Senha', t: 'password', f: 'password', p: 'Mínimo 8 caracteres' },
              ].map((x) =>
                _jsxs(
                  'div',
                  {
                    children: [
                      _jsxs('label', {
                        className: cn(
                          'text-[10px] uppercase tracking-widest font-bold mb-1.5 block',
                          dark ? 'text-slate-500' : 'text-slate-400',
                        ),
                        children: [
                          x.l,
                          _jsx('span', { className: 'text-rose-400 ml-0.5', children: '*' }),
                        ],
                      }),
                      _jsx('input', {
                        type: x.t,
                        value: nu[x.f],
                        onChange: (e) => {
                          setNu((p) => ({ ...p, [x.f]: e.target.value }));
                          setFieldErrors((p) => ({ ...p, [x.f]: undefined }));
                        },
                        className: cn(inputCls, fieldErrors[x.f] && 'border-rose-500/50'),
                        placeholder: x.p,
                      }),
                      fieldErrors[x.f] &&
                        _jsx('p', {
                          className: 'text-[11px] text-rose-400 mt-1',
                          children: fieldErrors[x.f],
                        }),
                    ],
                  },
                  x.f,
                ),
              ),
              _jsxs('div', {
                children: [
                  _jsx('label', {
                    className: cn(
                      'text-[10px] uppercase tracking-widest font-bold mb-1.5 block',
                      dark ? 'text-slate-500' : 'text-slate-400',
                    ),
                    children: 'Perfil',
                  }),
                  _jsx('select', {
                    value: nu.roleCode,
                    onChange: (e) => setNu((p) => ({ ...p, roleCode: e.target.value })),
                    className: inputCls,
                    children: (roles.length ? roles : [{ code: 'leitura', name: 'Leitura' }]).map(
                      (r) =>
                        _jsx(
                          'option',
                          { value: r.code, children: ROLE_CODE_TO_LABEL[r.code] || r.name },
                          r.code,
                        ),
                    ),
                  }),
                ],
              }),
              err &&
                _jsx('div', {
                  className:
                    'text-sm text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-xl px-3 py-2',
                  children: err,
                }),
            ],
          }),
        }),
    ],
  });
};
/* ═══════════════════════════════ MAIN APP ═══════════════════════════════ */
export default function App() {
  const [mounted, setMounted] = useState(false);
  const [dark, setDark] = useState(false);
  const [view, setView] = useState('dashboard');
  const [occs, setOccs] = useState([]);
  const [tenantId, setTenantId] = useState(null);
  const [userRole, setUserRole] = useState('cliente');
  const [tp, setTp] = useState({ tradeName: CLIENT_NAME, taxId: CLIENT_DOC });
  const [syncing, setSyncing] = useState(false);
  const [syncErr, setSyncErr] = useState('');
  const [initialLoading, setInitialLoading] = useState(true);
  const [selOcc, setSelOcc] = useState(null);
  const [logo, setLogo] = useState({ name: '', preview: '' });
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [toast, setToast] = useState('');
  const notify = (t) => setToast(t);
  const toggleTheme = () => setDark((d) => !d);
  useEffect(() => {
    setMounted(true);
  }, []);
  useEffect(() => {
    document.documentElement.classList.remove('erp-dark');
    document.documentElement.classList.remove('dark');
  }, []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 2300);
    return () => clearTimeout(t);
  }, [toast]);
  useEffect(
    () => () => {
      if (logo.preview?.startsWith('blob:')) URL.revokeObjectURL(logo.preview);
    },
    [logo.preview],
  );
  const loadOccs = async (tid) => {
    if (!tid) return;
    setSyncing(true);
    setSyncErr('');
    try {
      const r = await fetch(
        `/api/occurrences?${new URLSearchParams({ tenantId: tid, limit: '200', includeOrders: 'true' })}`,
        { cache: 'no-store' },
      );
      if (!r.ok) throw new Error(await apiErr(r, 'Falha.'));
      const mapped = mapOccs(await r.json());
      setOccs(mapped);
      setSelOcc(null);
    } catch (e) {
      setSyncErr(e.message || 'Falha ao carregar ocorrências.');
    } finally {
      setSyncing(false);
    }
  };
  const loadUsers = async (tid) => {
    if (!tid) return;
    try {
      const r = await fetch(`/api/iam/users?tenantId=${encodeURIComponent(tid)}`, {
        cache: 'no-store',
      });
      if (!r.ok) throw new Error('Erro.');
      setUsers((await r.json()).map(mapUser));
    } catch {
      setUsers([]);
    }
  };
  const loadRoles = async () => {
    try {
      const r = await fetch('/api/iam/roles', { cache: 'no-store' });
      if (!r.ok) return;
      setRoles(
        (await r.json()).map((x) => ({
          code: x.code,
          name: ROLE_CODE_TO_LABEL[x.code] || x.name || x.code,
        })),
      );
    } catch {
      setRoles([
        { code: 'cliente', name: 'Cliente' },
        { code: 'leitura', name: 'Leitura' },
      ]);
    }
  };
  const loadLogo = async (tid) => {
    if (!tid) return;
    try {
      const r = await fetch(`/api/iam/tenants/${encodeURIComponent(tid)}/logo?ts=${Date.now()}`, {
        cache: 'no-store',
      });
      if (!r.ok) {
        setLogo({ name: '', preview: '' });
        return;
      }
      const b = await r.blob();
      setLogo((p) => {
        if (p.preview?.startsWith('blob:')) URL.revokeObjectURL(p.preview);
        return { name: 'logo', preview: URL.createObjectURL(b) };
      });
    } catch {}
  };
  useEffect(() => {
    let ok = true;
    (async () => {
      try {
        const mr = await fetch('/api/auth/me', { cache: 'no-store' });
        if (!mr.ok) throw new Error('Sessão inválida.');
        const me = await mr.json();
        if (!ok) return;
        const tid = me?.tenant?.id || null;
        setTenantId(tid);
        setUserRole(me?.role?.code || me?.membership?.role?.code || 'cliente');
        setTp((p) => ({ ...p, tradeName: me?.tenant?.tradeName || p.tradeName }));
        if (tid) {
          const [tr] = await Promise.all([
            fetch('/api/iam/tenants', { cache: 'no-store' }),
            loadOccs(tid),
            loadUsers(tid),
            loadRoles(),
            loadLogo(tid),
          ]);
          if (tr.ok) {
            const ts = await tr.json();
            const c = Array.isArray(ts) ? ts.find((x) => x.id === tid) : null;
            if (c)
              setTp({
                tradeName: c.tradeName || c.legalName || CLIENT_NAME,
                taxId: c.taxId || CLIENT_DOC,
              });
          }
        } else setSyncErr('Tenant não encontrado.');
      } catch (e) {
        if (ok) setSyncErr(e.message);
      } finally {
        if (ok) setInitialLoading(false);
      }
    })();
    return () => {
      ok = false;
    };
  }, []);
  useEffect(() => {
    const url = new URL(window.location.href);
    const p = url.searchParams.get('occurrence') || url.searchParams.get('protocol');
    if (p) {
      const f = occs.find((o) => o.protocol.toLowerCase() === p.toLowerCase());
      if (f) setSelOcc(f);
    }
  }, [occs]);
  const openOcc = (o) => {
    setSelOcc(o);
    const u = new URL(window.location.href);
    u.searchParams.set('occurrence', o.protocol);
    window.history.replaceState({}, '', u.toString());
  };
  const closeOcc = () => {
    setSelOcc(null);
    const u = new URL(window.location.href);
    u.searchParams.delete('occurrence');
    u.searchParams.delete('protocol');
    window.history.replaceState({}, '', u.toString());
  };
  const copyP = async (v) => {
    const p = String(v || '').trim();
    if (!p) {
      notify('Inválido.');
      return;
    }
    notify((await copyText(p)) ? `${p} copiado.` : 'Falha ao copiar.');
  };
  const handleRefresh = () => {
    if (!tenantId) return;
    loadOccs(tenantId);
    loadUsers(tenantId);
    loadLogo(tenantId);
  };
  const handleLogoUpload = (event) => {
    const file = event?.target?.files?.[0];
    if (!file || !tenantId) return;
    const fd = new FormData();
    fd.set('file', file);
    (async () => {
      try {
        const r = await fetch(`/api/iam/tenants/${encodeURIComponent(tenantId)}/logo`, {
          method: 'POST',
          body: fd,
        });
        if (!r.ok) throw new Error(await apiErr(r, 'Erro ao enviar logo.'));
        notify('Logo atualizada.');
        await loadLogo(tenantId);
      } catch (e) {
        notify(e.message);
      }
    })();
  };
  const handleAddUser = (u) => {
    if (!tenantId) return;
    const roleCodeByLabel = { Admin: 'cliente', Operador: 'cliente', Visualizador: 'leitura' };
    (async () => {
      try {
        const r = await fetch('/api/iam/users', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            tenantId,
            name: u.name,
            email: u.email,
            password: u.password,
            roleCode: roleCodeByLabel[u.role] || 'leitura',
          }),
        });
        if (!r.ok) throw new Error(await apiErr(r, 'Erro ao criar usuário.'));
        notify('Usuário criado.');
        await loadUsers(tenantId);
      } catch (e) {
        notify(e.message);
      }
    })();
  };
  const handleRemoveUserByEmail = (email) => {
    if (!tenantId) return;
    const user = users.find((u) => u.email === email);
    if (!user?.id) {
      notify('Usuário não encontrado.');
      return;
    }
    (async () => {
      try {
        const r = await fetch(
          `/api/iam/users/${encodeURIComponent(user.id)}?tenantId=${encodeURIComponent(tenantId)}`,
          { method: 'DELETE' },
        );
        if (!r.ok) throw new Error(await apiErr(r, 'Erro ao remover usuário.'));
        notify('Usuário removido.');
        await loadUsers(tenantId);
      } catch (e) {
        notify(e.message);
      }
    })();
  };
  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } finally {
      window.location.href = '/login';
    }
  };
  if (!mounted) return _jsx('div', { className: 'h-screen bg-[#0f172a]/80 backdrop-blur-xl' });
  return _jsx(ThemeCtx.Provider, {
    value: { dark, toggle: toggleTheme },
    children: _jsxs(_Fragment, {
      children: [
        _jsx(ClientPortalFallback, {
          occurrences: occs,
          users: users,
          clientName: tp.tradeName,
          clientOptions: [tp.tradeName],
          logoPreview: logo.preview,
          loading: initialLoading,
          syncing: syncing,
          onRefresh: handleRefresh,
          onLogout: handleLogout,
          onCopyProtocol: copyP,
          onLogoUpload: handleLogoUpload,
          onAddUser: handleAddUser,
          onRemoveUser: handleRemoveUserByEmail,
        }),
        _jsx(ErpToast, { message: toast, dark: dark }),
      ],
    }),
  });
}
