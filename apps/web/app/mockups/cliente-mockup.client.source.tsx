'use client';

import React, { useState, useEffect, useMemo, createContext, useContext } from 'react';
import {
  LayoutDashboard, Settings, Sun, Moon, LogOut, Search, Eye, FileText,
  Calendar, CheckCircle2, Clock, AlertTriangle, Copy,
  Plus, UploadCloud, RefreshCw,
  Activity, User
} from 'lucide-react';

import { SharedPortalShell, type ErpSidebarItemBase } from './shared-portal-shell';
import { ErpStatusBadge, ErpKpiCard, ErpSkeletonCards, ErpToast, ErpModal, ErpDataTable, cn } from './shared-ui';

/* ═══════════════════════════════ THEME ═══════════════════════════════ */

const ThemeCtx = createContext({ dark: true, toggle: () => { } });

const useTheme = () => useContext(ThemeCtx);

const t = (dark, dVal, lVal) => dark ? dVal : lVal;

/* ═══════════════════════════════ HELPERS ═══════════════════════════════ */

const CLIENT_NAME = 'TONYNET';
const CLIENT_DOC = '16.893.178/0001-49';

const STATUS_API_TO_UI = { ABERTA: 'Aberta', EM_EXECUCAO: 'Em execução', PENDENTE: 'Pendente', ENCERRADA: 'Encerrada' };
const TYPE_API_TO_UI = { ROMPIMENTO: 'Rompimento', LENTIDAO: 'Lentidão', CONFIGURACAO_ONU: 'Config. ONU', TROCA_SENHA: 'Troca de Senha', CANCELAMENTO: 'Cancelamento', AUDITORIA: 'Auditoria', INSTALACAO: 'Instalação', BGP: 'BGP' };
const ROLE_CODE_TO_LABEL = { super_admin: 'Super Admin', gerente: 'Gerente', analista: 'Analista', tecnico: 'Técnico', cliente: 'Cliente', leitura: 'Leitura' };

const pad = (n) => String(n).padStart(2, '0');
const fmtDt = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
const toTs = (v, fb = Date.now()) => { if (!v) return fb; const x = new Date(v).getTime(); return Number.isFinite(x) ? x : fb; };
const parseDT = (v) => new Date(v.replace(' ', 'T'));
const isClosed = (s) => s === 'Encerrada';
const toBr = (v) => { if (!v) return '-'; const [d, time] = v.split(' '); const [y, m, dd] = d.split('-'); return `${dd}/${m}/${y}${time ? `, ${time}` : ''}`; };

const copyText = async (v) => {
  if (!v) return false;
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) { try { await navigator.clipboard.writeText(v); return true; } catch { } }
  if (typeof document === 'undefined') return false;
  const a = document.createElement('textarea'); a.value = v; a.setAttribute('readonly', ''); a.style.cssText = 'position:fixed;left:-9999px';
  document.body.appendChild(a); a.focus(); a.select(); let ok = false; try { ok = document.execCommand('copy'); } catch { } document.body.removeChild(a); return ok;
};

const apiErr = async (r, fb) => { const p = await r.json().catch(() => null); if (!p) return fb; if (typeof p === 'string') return p || fb; if (typeof p.error === 'string') return p.error || fb; return fb; };

const mapUser = (m) => ({ id: m.user?.id || m.id, name: m.user?.name || '-', email: m.user?.email || '-', roleCode: m.role?.code || 'leitura', role: ROLE_CODE_TO_LABEL[m.role?.code] || m.role?.name || 'Leitura', active: m.user?.status === 'ACTIVE', status: m.user?.status || 'INACTIVE' });

const mapOcc = (a) => {
  const ct = toTs(a?.createdAt), ut = toTs(a?.updatedAt, ct);
  const st = STATUS_API_TO_UI[a?.status] || 'Aberta';
  const notes = Array.isArray(a?.annotations)
    ? a.annotations.map((n) => ({ id: n.id, user: n.actorUser?.name || 'Sistema', message: n.message || '', createdAt: fmtDt(new Date(toTs(n.createdAt, ut))) })).sort((x, y) => toTs(y.createdAt) - toTs(x.createdAt))
    : [];
  const os = Array.isArray(a?.serviceOrders) && a.serviceOrders.length > 0 ? a.serviceOrders[0] : null;
  const forecast = os?.deadlineAt ? fmtDt(new Date(toTs(os.deadlineAt))) : '-';
  const osComment = os?.internalNotes || '-';
  return { id: a?.id, protocol: a?.number || '-', provider: a?.provider || CLIENT_NAME, type: TYPE_API_TO_UI[a?.type] || a?.type || '-', status: st, forecast, osComment, created_at: fmtDt(new Date(ct)), updated_at: fmtDt(new Date(ut)), description: os?.description || a?.description || '-', annotations: notes };
};
const mapOccs = (arr) => Array.isArray(arr) ? arr.map(mapOcc).sort((a, b) => toTs(b.created_at) - toTs(a.created_at)) : [];

/* ═══════════════════════════════ OCCURRENCE DETAIL ═══════════════════════════════ */

const OccurrenceDetailModal = ({ occurrence: occ, onClose, onCopyProtocol }) => {
  const { dark } = useTheme();

  useEffect(() => {
    if (!occ) return;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = 'unset'; };
  }, [occ]);

  if (!occ) return null;

  const infos = [
    { label: 'Previsão de finalização', value: occ.forecast },
    { label: 'Última atualização', value: occ.updated_at },
  ];

  return (
    <ErpModal
      title={`#${occ.protocol}`}
      subtitle={`Criado em ${toBr(occ.created_at)}`}
      badge={<ErpStatusBadge status={occ.status} />}
      onClose={onClose}
      maxWidth="max-w-3xl"
      dark={dark}
      actions={
        <>
          <button onClick={() => onCopyProtocol(occ.protocol)} className={cn('inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors border', dark ? 'bg-white/5 border-slate-700/50 text-white hover:bg-white/10' : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200')}>
            <Copy size={14} /> Copiar protocolo
          </button>
          <button onClick={onClose} className={cn('px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors border', dark ? 'bg-white/5 border-slate-700/50 text-slate-400 hover:bg-white/10' : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100')}>
            Fechar
          </button>
        </>
      }
    >
      {/* Description */}
      <div>
        <label className={cn('text-[10px] font-bold uppercase tracking-widest block mb-2', dark ? 'text-slate-500' : 'text-slate-400')}>Descrição da Ocorrência/O.S.</label>
        <div className={cn('rounded-xl p-4 text-sm leading-relaxed border font-medium', dark ? 'bg-[#0d1628]/80 border-slate-700/60 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-800')}>
          {occ.description || '-'}
        </div>
      </div>

      {/* Context grid (Forecast and Last Update) */}
      <div className="grid grid-cols-2 gap-4">
        <div className={cn('rounded-xl p-4 border', dark ? 'bg-[#0f172a]/80 border-slate-700/60' : 'bg-slate-50/80 border-slate-200')}>
          <label className={cn('text-[10px] font-bold uppercase tracking-widest block mb-1', dark ? 'text-slate-600' : 'text-slate-400')}>Previsão de finalização</label>
          <p className={cn('text-lg font-bold', dark ? 'text-slate-400' : 'text-indigo-900')}>{occ.forecast || '-'}</p>
        </div>
        <div className={cn('rounded-xl p-4 border', dark ? 'bg-[#0f172a]/80 border-slate-700/60' : 'bg-slate-50/80 border-slate-200')}>
          <label className={cn('text-[10px] font-bold uppercase tracking-widest block mb-1', dark ? 'text-slate-600' : 'text-slate-400')}>Última atualização</label>
          <p className={cn('text-lg font-bold', dark ? 'text-white' : 'text-cyan-900')}>{occ.updated_at || '-'}</p>
        </div>
      </div>



      {/* Annotations */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className={cn('text-[10px] font-bold uppercase tracking-widest', dark ? 'text-slate-500' : 'text-slate-400')}>Histórico de Anotações</label>
          {occ.annotations.length > 0 && (
            <span className="bg-blue-600/20 text-blue-400 text-[9px] font-bold px-2 py-0.5 rounded border border-blue-500/20 uppercase">
              {occ.annotations.length} {occ.annotations.length === 1 ? 'registro' : 'registros'}
            </span>
          )}
        </div>
        {occ.annotations.length === 0 ? (
          <div className={cn('border border-dashed rounded-xl p-10 flex flex-col items-center justify-center', dark ? 'border-slate-700/60 bg-[#0f172a]/60' : 'border-slate-200 bg-slate-50/50')}>
            <p className={cn('text-sm italic', dark ? 'text-slate-600' : 'text-slate-400')}>Sem histórico de anotações</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {occ.annotations.map((note) => (
              <div key={note.id} className={cn('rounded-xl p-4 border', dark ? 'bg-[#0d1628]/80 border-slate-700/60' : 'bg-slate-50 border-slate-200')}>
                <div className="flex items-center justify-between mb-2">
                  <span className={cn('text-[10px] uppercase font-bold tracking-widest', dark ? 'text-slate-500' : 'text-slate-400')}>Anotação</span>
                  <span className={cn('text-[10px]', dark ? 'text-slate-600' : 'text-slate-400')}>{toBr(note.createdAt)}</span>
                </div>
                <p className={cn('text-sm leading-relaxed', dark ? 'text-slate-300' : 'text-slate-600')}>{note.message}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </ErpModal>
  );
};

/* ═══════════════════════════════ SKELETON ═══════════════════════════════ */

const SkeletonTable = ({ dark, rows = 6 }) => (
  <div className={cn('rounded-2xl overflow-hidden border', dark ? 'bg-[#111b2e]/75 border-slate-700/60' : 'bg-white border-slate-200 shadow-sm')}>
    <div className={cn('p-4 border-b', dark ? 'border-slate-700/50' : 'border-slate-100')}>
      <div className={cn('h-9 w-60 rounded-xl animate-pulse', dark ? 'bg-[#1e293b]/60 backdrop-blur-md' : 'bg-slate-100')} />
    </div>
    <div className="p-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className={cn('h-14 rounded-lg mb-1 animate-pulse', dark ? 'bg-white/[0.02]' : 'bg-slate-50')} />
      ))}
    </div>
  </div>
);

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
    const closed = occurrences.filter((o) => isClosed(o.status) && o.updated_at.slice(0, 7) === mk).length;
    return { active, total: occurrences.length, opened, closed };
  }, [occurrences]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return occurrences.filter((o) => {
      const byTab = tab === 'ativas' ? !isClosed(o.status) : isClosed(o.status);
      const byQ = !q || o.protocol.toLowerCase().includes(q) || o.description.toLowerCase().includes(q) || o.type.toLowerCase().includes(q);
      return byTab && byQ;
    }).sort((a, b) => parseDT(b.created_at) - parseDT(a.created_at));
  }, [occurrences, search, tab]);

  useEffect(() => { setPage(1); }, [search, tab]);
  const tp = Math.max(1, Math.ceil(filtered.length / perPage));
  const cp = Math.min(page, tp);
  const rows = filtered.slice((cp - 1) * perPage, cp * perPage);
  const ativasN = occurrences.filter((o) => !isClosed(o.status)).length;
  const encerradasN = occurrences.filter((o) => isClosed(o.status)).length;

  return (
    <>
      {/* Header */}
      <div className="flex items-end justify-between mb-8">
        <div>
          <h1 className={cn('text-2xl font-bold mb-1', dark ? 'text-white' : 'text-slate-900')}>Painel de Ocorrências</h1>
          <p className={cn('text-sm', dark ? 'text-slate-500' : 'text-slate-400')}>Visão geral das demandas ativas e histórico.</p>
        </div>
        <button
          onClick={onSync}
          disabled={syncing || loading}
          className={cn('inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all border',
            dark ? 'border-slate-700/50 text-slate-400 hover:bg-white/5 disabled:opacity-40' : 'border-slate-200 text-slate-500 hover:bg-slate-100 disabled:opacity-40'
          )}
        >
          <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
          {syncing ? 'Sincronizando...' : 'Atualizar'}
        </button>
      </div>

      {/* KPIs — skeleton while loading */}
      {loading ? <ErpSkeletonCards dark={dark} /> : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <ErpKpiCard dark={dark} label="TOTAL ABERTAS" value={kpis.active} icon={Clock} iconContainerClassName={dark ? 'bg-blue-900/20 border-blue-500/30' : ''} iconClassName={dark ? 'text-blue-400' : ''} />
          <ErpKpiCard dark={dark} label="TOTAIS DE O.S" value={kpis.total} icon={FileText} iconContainerClassName={dark ? 'bg-purple-900/20 border-purple-500/30' : ''} iconClassName={dark ? 'text-purple-400' : ''} />
          <ErpKpiCard dark={dark} label="ENTRADAS (MÊS)" value={kpis.opened} icon={Calendar} iconContainerClassName={dark ? 'bg-orange-900/20 border-orange-500/30' : ''} iconClassName={dark ? 'text-orange-400' : ''} />
          <ErpKpiCard dark={dark} label="CONCLUÍDAS (MÊS)" value={kpis.closed} icon={CheckCircle2} iconContainerClassName={dark ? 'bg-emerald-900/20 border-emerald-500/30' : ''} iconClassName={dark ? 'text-emerald-400' : ''} />
        </div>
      )}

      {/* Table — skeleton while loading */}
      {loading ? <SkeletonTable dark={dark} /> : (
        <div className={cn('rounded-2xl overflow-hidden border', dark ? 'bg-[#111b2e]/75 border-slate-700/60' : 'bg-white border-slate-200 shadow-sm')}>
          {/* Tabs + search */}
          <div className={cn('p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b', dark ? 'border-slate-700/60' : 'border-slate-100')}>
            <div className={cn('flex gap-2 p-1 rounded-lg', dark ? 'bg-[#0d1628]/80' : 'bg-slate-100')}>
              {[
                { key: 'ativas', label: 'Ativas', count: ativasN, Icon: Clock, activeThemeClass: dark ? 'bg-[#0d1628] text-white shadow-lg' : 'bg-white text-slate-900 shadow-sm' },
                { key: 'encerradas', label: 'Fechadas', count: encerradasN, Icon: FileText, activeThemeClass: dark ? 'bg-[#0d1628] text-emerald-500 shadow-lg border-b-2 border-emerald-500' : 'bg-white text-emerald-600 shadow-sm border-b-2 border-emerald-500' },
              ].map(({ key, label, count, Icon, activeThemeClass }) => (
                <button
                  key={key}
                  onClick={() => setTab(key)}
                  className={cn(
                    'flex items-center gap-2 px-6 py-2 rounded-md text-xs font-bold transition-all',
                    tab === key
                      ? activeThemeClass
                      : cn(dark ? 'text-slate-500 hover:text-slate-300' : 'text-slate-500 hover:text-slate-700')
                  )}
                >
                  <Icon size={14} />
                  {label}
                  <span className="opacity-50 font-normal ml-0.5">{count}</span>
                </button>
              ))}
            </div>

            <div className="relative group">
              <Search className={cn('absolute left-3 top-1/2 -translate-y-1/2 transition-colors', dark ? 'text-slate-600 group-hover:text-slate-400' : 'text-slate-400')} size={16} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar protocolo ou texto..."
                className={cn(
                  'rounded-lg py-2 pl-10 pr-4 text-xs w-64 focus:outline-none transition-all border',
                  dark ? 'bg-[#0d1628]/80 border-slate-700/60 text-white placeholder:text-slate-600 focus:border-blue-500' : 'bg-slate-50 border-slate-200 text-slate-700 placeholder:text-slate-400 focus:border-blue-400'
                )}
              />
            </div>
          </div>

          {/* Table */}
          <ErpDataTable
            dark={dark}
            rows={rows}
            rowKey={(o) => String(o.id)}
            onRowClick={(o) => onOpen(o)}
            emptyTitle="Nenhuma ocorrência encontrada."
            emptyDescription={tab === 'ativas' ? 'Nenhuma demanda ativa no momento.' : 'Nenhuma demanda encerrada ainda.'}
            columns={[
              {
                key: 'protocol',
                header: 'Protocolo',
                render: (o) => (
                  <div>
                    <p className={cn('text-xs font-bold mb-0.5', dark ? 'text-slate-300' : 'text-slate-700')}>{o.protocol}</p>
                    <p className={cn('text-[10px]', dark ? 'text-slate-600' : 'text-slate-400')}>{toBr(o.created_at)}</p>
                  </div>
                )
              },
              {
                key: 'description',
                header: 'Descrição',
                render: (o) => <p className={cn('text-xs max-w-md truncate font-medium', dark ? 'text-white' : 'text-slate-700')}>{o.description}</p>
              },
              {
                key: 'type',
                header: 'Tipo',
                render: (o) => {
                  const typeStr = o.type.toUpperCase();
                  const typeColorMap = {
                    'ROMPIMENTO': 'bg-fuchsia-500/10 text-fuchsia-400 border-fuchsia-500/20',
                    'LENTIDÃO': 'bg-orange-500/10 text-orange-400 border-orange-500/20',
                    'CONFIG. ONU': 'bg-purple-500/10 text-purple-400 border-purple-500/20',
                    'TROCA DE SENHA': 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
                    'CANCELAMENTO': 'bg-pink-500/10 text-pink-400 border-pink-500/20',
                    'AUDITORIA': 'bg-amber-500/10 text-amber-400 border-amber-500/20',
                    'INSTALAÇÃO': 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
                    'BGP': 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
                  };
                  const fallbackColors = [
                    'bg-purple-500/10 text-purple-400 border-purple-500/20',
                    'bg-orange-500/10 text-orange-400 border-orange-500/20',
                    'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
                    'bg-pink-500/10 text-pink-400 border-pink-500/20',
                  ];
                  const typeColors = typeColorMap[typeStr] || fallbackColors[typeStr.length % fallbackColors.length];
                  return <span className={cn('text-[10px] font-bold px-2 py-1 rounded-md border uppercase', typeColors)}>{o.type}</span>;
                }
              },
              {
                key: 'status',
                header: 'Status',
                render: (o) => <ErpStatusBadge status={o.status} />
              },
              {
                key: 'action',
                header: <span className="w-full inline-block text-center">Ação</span>,
                render: (o) => (
                  <div className="inline-flex items-center gap-1">
                    <button
                      onClick={(e) => { e.stopPropagation(); onCopy(o.protocol); }}
                      className={cn('p-1.5 rounded-lg transition-colors', dark ? 'text-slate-600 hover:text-white' : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100')}
                      title="Copiar"
                    >
                      <Copy size={16} />
                    </button>
                    <button className={cn('p-1.5 rounded-lg transition-colors', dark ? 'text-slate-600 hover:text-white' : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100')} title="Ver detalhes">
                      <Eye size={16} />
                    </button>
                  </div>
                ),
                className: 'text-center',
                cellClassName: 'text-center'
              }
            ]}
          />

          {/* Pagination */}
          {filtered.length > perPage && (
            <div className={cn('px-6 py-3 flex items-center justify-between border-t', dark ? 'border-slate-700/50' : 'border-slate-100')}>
              <span className={cn('text-[11px]', dark ? 'text-slate-600' : 'text-slate-400')}>Página {cp} de {tp} · {filtered.length} registros</span>
              <div className="flex gap-2">
                {['Anterior', 'Próximo'].map((lbl, i) => (
                  <button key={lbl} onClick={() => setPage((p) => i === 0 ? Math.max(1, p - 1) : Math.min(tp, p + 1))} disabled={i === 0 ? cp === 1 : cp === tp}
                    className={cn('px-3 py-1.5 text-xs rounded-lg transition-colors border disabled:opacity-25', dark ? 'border-slate-700/50 text-slate-400 hover:bg-white/5' : 'border-slate-200 text-slate-500 hover:bg-slate-100')}>{lbl}</button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
};

/* ═══════════════════════════════ SETTINGS ═══════════════════════════════ */

const ClientSettingsView = ({ logo, users, roles, tenantId, userRole, notify, onUsersRefresh, onLogoRefresh }) => {
  const { dark } = useTheme();
  const [showAdd, setShowAdd] = useState(false);
  const [nu, setNu] = useState({ name: '', email: '', password: '', roleCode: 'leitura' });
  const [fieldErrors, setFieldErrors] = useState({});
  const [err, setErr] = useState('');
  const [submitting, setSub] = useState(false);
  const [uploading, setUploading] = useState(false);
  const canManage = ['super_admin', 'gerente'].includes(userRole || '');

  useEffect(() => { if (roles.length) setNu((p) => ({ ...p, roleCode: p.roleCode || roles[0].code })); }, [roles]);

  const onLogo = (e) => {
    const f = e.target.files?.[0]; if (!f || !tenantId) return;
    const fd = new FormData(); fd.set('file', f);
    (async () => { setUploading(true); try { const r = await fetch(`/api/iam/tenants/${encodeURIComponent(tenantId)}/logo`, { method: 'POST', body: fd }); if (!r.ok) throw new Error(await apiErr(r, 'Erro.')); notify('Logo atualizada.'); await onLogoRefresh?.(); } catch (e) { notify(e.message); } finally { setUploading(false); } })();
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
    (async () => { setSub(true); try { const r = await fetch('/api/iam/users', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ tenantId, name: nu.name.trim(), email: nu.email.trim(), password: nu.password, roleCode: nu.roleCode }) }); if (!r.ok) throw new Error(await apiErr(r, 'Erro.')); notify('Usuário criado.'); setNu({ name: '', email: '', password: '', roleCode: roles[0]?.code || 'leitura' }); setErr(''); setFieldErrors({}); setShowAdd(false); await onUsersRefresh?.(); } catch (e) { setErr(e.message); } finally { setSub(false); } })();
  };

  const toggle = (u) => { if (!tenantId) return; (async () => { try { const r = await fetch(`/api/iam/users/${encodeURIComponent(u.id)}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ tenantId, status: u.active ? 'INACTIVE' : 'ACTIVE' }) }); if (!r.ok) throw new Error(await apiErr(r, 'Erro.')); await onUsersRefresh?.(); } catch (e) { notify(e.message); } })(); };
  const remove = (u) => { if (!tenantId) return; (async () => { try { const r = await fetch(`/api/iam/users/${encodeURIComponent(u.id)}?tenantId=${encodeURIComponent(tenantId)}`, { method: 'DELETE' }); if (!r.ok) throw new Error(await apiErr(r, 'Erro.')); notify('Removido.'); await onUsersRefresh?.(); } catch (e) { notify(e.message); } })(); };

  const cardCls = cn('rounded-2xl p-6 border', dark ? 'bg-[#1e293b]/60 backdrop-blur-md border-slate-700/60' : 'bg-white border-slate-200 shadow-sm');
  const headCls = cn('text-[10px] font-bold uppercase tracking-widest mb-4', dark ? 'text-slate-500' : 'text-slate-400');
  const inputCls = cn('w-full rounded-xl p-2.5 text-sm border focus:outline-none transition-colors', dark ? 'bg-[#0f172a]/80 backdrop-blur-xl border-slate-700/50 text-white placeholder:text-slate-600 focus:border-blue-500/40' : 'bg-slate-50 border-slate-200 text-slate-700 placeholder:text-slate-400 focus:border-blue-400');

  return (
    <>
      <div className="mb-8">
        <h1 className={cn('text-2xl font-bold mb-1', dark ? 'text-white' : 'text-slate-900')}>Configurações</h1>
        <p className={cn('text-sm', dark ? 'text-slate-500' : 'text-slate-400')}>Identidade visual e gestão de usuários.</p>
      </div>

      {/* Logo */}
      <div className={cn(cardCls, 'mb-6')}>
        <h3 className={headCls}>Identidade Visual</h3>
        <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-5 items-start">
          <div className={cn('h-28 rounded-xl flex items-center justify-center overflow-hidden border', dark ? 'border-slate-700/50 bg-[#0f172a]/80 backdrop-blur-xl' : 'border-slate-200 bg-slate-50')}>
            {logo.preview ? <img src={logo.preview} alt="Logo" className="max-h-20 object-contain" /> : <span className={cn('text-sm', dark ? 'text-slate-600' : 'text-slate-400')}>Sem logo</span>}
          </div>
          <div className="space-y-3">
            <p className={cn('text-sm', dark ? 'text-slate-400' : 'text-slate-500')}>Arquivo: <span className={dark ? 'text-slate-500' : 'text-slate-400'}>{logo.name || 'não definido'}</span></p>
            <label className={cn('inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold cursor-pointer transition-colors border', dark ? 'border-slate-700/50 text-slate-300 hover:bg-white/5' : 'border-slate-200 text-slate-600 hover:bg-slate-100')}>
              <UploadCloud size={15} /> {uploading ? 'Enviando...' : 'Alterar logo'}
              <input type="file" accept="image/*" className="hidden" onChange={onLogo} />
            </label>
          </div>
        </div>
      </div>

      {/* Users */}
      <div className={cardCls}>
        <div className="flex items-center justify-between mb-4">
          <h3 className={headCls} style={{ marginBottom: 0 }}>Usuários</h3>
          {canManage && (
            <button onClick={() => setShowAdd(true)} className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-xl text-xs font-semibold text-white transition-colors">
              <Plus size={14} /> Adicionar
            </button>
          )}
        </div>
        <div className={cn('rounded-xl overflow-hidden border', dark ? 'border-slate-700/60' : 'border-slate-200')}>
          <div className={cn('grid grid-cols-12 px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider border-b', dark ? 'bg-[#0f172a]/80 backdrop-blur-xl border-slate-700/50 text-slate-500' : 'bg-slate-50 border-slate-100 text-slate-400')}>
            <div className="col-span-3">Nome</div><div className="col-span-4">E-mail</div><div className="col-span-2 text-center">Perfil</div><div className="col-span-1 text-center">Status</div><div className="col-span-2 text-right">Ações</div>
          </div>
          {users.map((u) => (
            <div key={u.id} className={cn('grid grid-cols-12 px-4 py-3 items-center border-b last:border-b-0 transition-colors', dark ? 'border-white/[0.04] hover:bg-white/[0.02]' : 'border-slate-100 hover:bg-slate-50')}>
              <div className={cn('col-span-3 text-sm', dark ? 'text-slate-300' : 'text-slate-700')}>{u.name}</div>
              <div className={cn('col-span-4 text-sm', dark ? 'text-slate-500' : 'text-slate-500')}>{u.email}</div>
              <div className="col-span-2 text-center"><span className={cn('text-[10px] px-2 py-1 rounded-full font-bold uppercase border', dark ? 'bg-slate-500/10 border-slate-500/20 text-slate-400' : 'bg-slate-100 border-slate-200 text-slate-500')}>{u.role}</span></div>
              <div className="col-span-1 text-center"><span className={cn('text-[10px] px-2 py-1 rounded-full font-bold uppercase border', u.active ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-amber-500/10 border-amber-500/20 text-amber-400')}>{u.active ? 'Ativo' : 'Inativo'}</span></div>
              <div className="col-span-2 flex justify-end gap-2">
                {canManage ? (
                  <>
                    <button onClick={() => toggle(u)} className={cn('px-2.5 py-1 text-xs rounded-lg transition-colors border', dark ? 'border-slate-700/50 text-slate-400 hover:bg-white/5' : 'border-slate-200 text-slate-500 hover:bg-slate-100')}>{u.active ? 'Desativar' : 'Ativar'}</button>
                    <button onClick={() => remove(u)} className="px-2.5 py-1 text-xs rounded-lg border border-rose-500/20 text-rose-400 hover:bg-rose-500/10 transition-colors">Remover</button>
                  </>
                ) : (
                  <span className={cn('text-[10px]', dark ? 'text-slate-600' : 'text-slate-400')}>—</span>
                )}
              </div>
            </div>
          ))}
          {users.length === 0 && <div className={cn('px-4 py-10 text-sm text-center', dark ? 'text-slate-600' : 'text-slate-400')}>Nenhum usuário carregado.</div>}
        </div>
      </div>

      {/* Add modal */}
      {showAdd && (
        <ErpModal title="Adicionar Usuário" onClose={() => { setShowAdd(false); setErr(''); }}
          actions={<>
            <button onClick={() => setShowAdd(false)} className={cn('px-4 py-2.5 rounded-xl text-sm font-semibold border transition-colors', dark ? 'border-slate-700/50 text-slate-400 hover:bg-white/5' : 'border-slate-200 text-slate-500 hover:bg-slate-100')}>Cancelar</button>
            <button onClick={add} disabled={submitting} className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 rounded-xl text-sm font-semibold text-white disabled:opacity-50 transition-colors">{submitting ? 'Salvando...' : 'Salvar'}</button>
          </>}>
          <div className="space-y-4">
            {[{ l: 'Nome', t: 'text', f: 'name', p: 'Nome do usuário' }, { l: 'E-mail', t: 'email', f: 'email', p: 'usuario@cliente.com.br' }, { l: 'Senha', t: 'password', f: 'password', p: 'Mínimo 8 caracteres' }].map((x) => (
              <div key={x.f}>
                <label className={cn('text-[10px] uppercase tracking-widest font-bold mb-1.5 block', dark ? 'text-slate-500' : 'text-slate-400')}>{x.l}<span className="text-rose-400 ml-0.5">*</span></label>
                <input type={x.t} value={nu[x.f]} onChange={(e) => { setNu((p) => ({ ...p, [x.f]: e.target.value })); setFieldErrors((p) => ({ ...p, [x.f]: undefined })); }} className={cn(inputCls, fieldErrors[x.f] && 'border-rose-500/50')} placeholder={x.p} />
                {fieldErrors[x.f] && <p className="text-[11px] text-rose-400 mt-1">{fieldErrors[x.f]}</p>}
              </div>
            ))}
            <div>
              <label className={cn('text-[10px] uppercase tracking-widest font-bold mb-1.5 block', dark ? 'text-slate-500' : 'text-slate-400')}>Perfil</label>
              <select value={nu.roleCode} onChange={(e) => setNu((p) => ({ ...p, roleCode: e.target.value }))} className={inputCls}>
                {(roles.length ? roles : [{ code: 'leitura', name: 'Leitura' }]).map((r) => <option key={r.code} value={r.code}>{ROLE_CODE_TO_LABEL[r.code] || r.name}</option>)}
              </select>
            </div>
            {err && <div className="text-sm text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-xl px-3 py-2">{err}</div>}
          </div>
        </ErpModal>
      )}
    </>
  );
};

/* ═══════════════════════════════ MAIN APP ═══════════════════════════════ */

export default function App() {
  const [mounted, setMounted] = useState(false);
  const [dark, setDark] = useState(true);
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

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    document.documentElement.classList.remove('erp-dark');
  }, []);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(''), 2300); return () => clearTimeout(t); }, [toast]);
  useEffect(() => () => { if (logo.preview?.startsWith('blob:')) URL.revokeObjectURL(logo.preview); }, [logo.preview]);


  const loadOccs = async (tid) => {
    if (!tid) return; setSyncing(true); setSyncErr('');
    try { const r = await fetch(`/api/occurrences?${new URLSearchParams({ tenantId: tid, limit: '200', includeOrders: 'true' })}`, { cache: 'no-store' }); if (!r.ok) throw new Error(await apiErr(r, 'Falha.')); setOccs(mapOccs(await r.json())); setSelOcc(null); }
    catch (e) { setOccs([]); setSyncErr(e.message); } finally { setSyncing(false); }
  };
  const loadUsers = async (tid) => { if (!tid) return; try { const r = await fetch(`/api/iam/users?tenantId=${encodeURIComponent(tid)}`, { cache: 'no-store' }); if (!r.ok) throw new Error('Erro.'); setUsers((await r.json()).map(mapUser)); } catch { setUsers([]); } };
  const loadRoles = async () => { try { const r = await fetch('/api/iam/roles', { cache: 'no-store' }); if (!r.ok) return; setRoles((await r.json()).map((x) => ({ code: x.code, name: ROLE_CODE_TO_LABEL[x.code] || x.name || x.code }))); } catch { } };
  const loadLogo = async (tid) => { if (!tid) return; try { const r = await fetch(`/api/iam/tenants/${encodeURIComponent(tid)}/logo?ts=${Date.now()}`, { cache: 'no-store' }); if (!r.ok) { setLogo({ name: '', preview: '' }); return; } const b = await r.blob(); setLogo((p) => { if (p.preview?.startsWith('blob:')) URL.revokeObjectURL(p.preview); return { name: 'logo', preview: URL.createObjectURL(b) }; }); } catch { } };

  useEffect(() => {
    let ok = true;
    (async () => {
      try {
        const mr = await fetch('/api/auth/me', { cache: 'no-store' }); if (!mr.ok) throw new Error('Sessão inválida.');
        const me = await mr.json(); if (!ok) return;
        const tid = me?.tenant?.id || null; setTenantId(tid);
        setUserRole(me?.role?.code || me?.membership?.role?.code || 'cliente');
        setTp((p) => ({ ...p, tradeName: me?.tenant?.tradeName || p.tradeName }));
        if (tid) {
          const [tr] = await Promise.all([fetch('/api/iam/tenants', { cache: 'no-store' }), loadOccs(tid), loadUsers(tid), loadRoles(), loadLogo(tid)]);
          if (tr.ok) { const ts = await tr.json(); const c = Array.isArray(ts) ? ts.find((x) => x.id === tid) : null; if (c) setTp({ tradeName: c.tradeName || c.legalName || CLIENT_NAME, taxId: c.taxId || CLIENT_DOC }); }
        } else setSyncErr('Tenant não encontrado.');
      } catch (e) { if (ok) setSyncErr(e.message); }
      finally { if (ok) setInitialLoading(false); }
    })();
    return () => { ok = false; };
  }, []);

  useEffect(() => {
    const url = new URL(window.location.href);
    const p = url.searchParams.get('occurrence') || url.searchParams.get('protocol');
    if (p) { const f = occs.find((o) => o.protocol.toLowerCase() === p.toLowerCase()); if (f) setSelOcc(f); }
  }, [occs]);

  const openOcc = (o) => { setSelOcc(o); const u = new URL(window.location.href); u.searchParams.set('occurrence', o.protocol); window.history.replaceState({}, '', u.toString()); };
  const closeOcc = () => { setSelOcc(null); const u = new URL(window.location.href); u.searchParams.delete('occurrence'); u.searchParams.delete('protocol'); window.history.replaceState({}, '', u.toString()); };
  const copyP = async (v) => { const p = String(v || '').trim(); if (!p) { notify('Inválido.'); return; } notify((await copyText(p)) ? `${p} copiado.` : 'Falha ao copiar.'); };
  const handleLogout = async () => { try { await fetch('/api/auth/logout', { method: 'POST' }); } finally { window.location.href = '/login'; } };

  if (!mounted) return <div className="h-screen bg-[#0f172a]/80 backdrop-blur-xl" />;

  const initials = (tp.tradeName || 'T').slice(0, 3).toUpperCase();

  return (
    <ThemeCtx.Provider value={{ dark, toggle: toggleTheme }}>
      <SharedPortalShell
        contentClassName="max-w-[1500px] mx-auto"
        dark={dark}
        themeToggle={toggleTheme}
        brandName="AjustNOC"
        brandIcon={Activity}
        sidebarItems={[
          { key: 'dashboard', label: 'Visão Geral', icon: LayoutDashboard },
          { key: 'settings', label: 'Configurações', icon: Settings },
        ]}
        activeView={view}
        onViewChange={setView}
        userName={tp.tradeName}
        userRole={tp.taxId}
        avatarText={initials}
        avatarImg={logo.preview}
        onLogout={handleLogout}
      >
        {view === 'settings'
          ? <ClientSettingsView logo={logo} users={users} roles={roles} tenantId={tenantId} userRole={userRole} notify={notify} onUsersRefresh={() => loadUsers(tenantId)} onLogoRefresh={() => loadLogo(tenantId)} />
          : <ClientDashboardView occurrences={occs} onOpen={openOcc} onCopy={copyP} onSync={() => { if (tenantId) { loadOccs(tenantId); loadUsers(tenantId); loadLogo(tenantId); } }} syncing={syncing} loading={initialLoading} />
        }

        {/* Overlays */}
        <OccurrenceDetailModal occurrence={selOcc} onClose={closeOcc} onCopyProtocol={copyP} />
        <ErpToast message={toast} dark={dark} />
      </SharedPortalShell>
    </ThemeCtx.Provider>
  );
}
