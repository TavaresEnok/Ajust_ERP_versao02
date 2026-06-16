'use client';
import { useErpWebSocket } from '../shared/ws-client';

import React, { useEffect, useMemo, useState, createContext, useContext } from 'react';
import {
  PieChart, Users, Settings, LogOut, Sparkles, Terminal, LayoutDashboard, Search, Bell, Menu, X,
  Filter, ChevronDown, ChevronRight, CheckCircle, AlertTriangle, Clock, Calendar,
  ArrowRight, FileText, ChevronLeft, Shield, CheckCheck, HelpCircle, Eye, Copy,
  RefreshCw, TrendingUp, Sun, Moon, Activity, Plus, Download, ExternalLink, Briefcase, Sliders, User, UserCog, Wrench, Database, Key, Zap
} from 'lucide-react';
/* ----------------------------- Theme Context ----------------------------- */

const ThemeCtx = createContext({ dark: false, toggle: () => { } });
const useTheme = () => useContext(ThemeCtx);
import { SharedPortalShell } from '../shared/shared-portal-shell';
import { ErpBadge, ErpDataTable, ErpStatusBadge, ErpEmptyState } from '../shared/shared-ui';
import { canManageUsers as canManageUsersByRole } from '../shared/rbac';
import { AdminDashboardViewModule } from './views/admin-dashboard-view';
import { GlobalOrdersViewModule } from './views/global-orders-view';
import { TenantManagementViewModule } from './views/tenant-management-view';
import { SettingsViewModule } from './views/settings-view';
import { AnalystCredentialsNeoView } from '../analista/analista-credentials-neo-view';
import { AnalystNotesView } from '../analista/analista-notes-view';
import { AnalystKnowledgeAjustpediaPanel } from '../analista/analista-knowledge-ajustpedia-panel';
import { AnalystKnowledgeAjustpediaModal } from '../analista/analista-knowledge-ajustpedia-modal';
import { CalendarManageViewModule } from './views/calendar-manage-view';
import { NotificationsConfigView } from './views/notifications-config-view';
import { ApiKeysView } from './views/api-keys-view';
import { SlaBuilderView } from './views/sla-builder-view';
import { OperationalHealthView } from './views/operational-health-view';
import { WorkflowBuilderView } from './views/workflow-builder-view';
import { MonitorSlaView } from './views/monitor-sla-view';
import { ReportsView as ReportsRealView } from './views/reports-view';
import { TechniciansView } from './views/technicians-view';
import { ProvidersView } from './views/providers-view';
import { ServiceTypesView as ServiceTypesViewModule } from './views/service-types-view';

/* ----------------------------- Core Helpers ----------------------------- */

const cn = (...classes) => classes.filter(Boolean).join(' ');

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const PERIOD_TABS = [
  { id: 'today', label: 'Hoje', days: 0 },
  { id: '7d', label: '7d', days: 7 },
  { id: '15d', label: '15d', days: 15 },
  { id: '30d', label: '30d', days: 30 },
  { id: '90d', label: '90d', days: 90 },
  { id: 'all', label: 'Tudo', days: -1 },
  { id: 'custom', label: 'Custom', days: null },
];
const PERIOD_MAP = PERIOD_TABS.reduce((acc, p) => ({ ...acc, [p.id]: p }), {});

const PROVIDERS = [
  'Meganet',
  'UltraFibra',
  'MaximaNet',
];

const PROVIDER_CITY = {
  Meganet: 'Recife - PE',
  UltraFibra: 'Jaboatao - PE',
  MaximaNet: 'Cabo - PE',
};

const TECHS = [
  { name: 'Carlos Silva', specialization: 'Rede Externa' },
  { name: 'Roberto Almeida', specialization: 'Configuracao Logica' },
  { name: 'Fernanda Costa', specialization: 'NOC N2' },
  { name: 'Joao Pereira', specialization: 'Infraestrutura' },
  { name: 'Lucas Oliveira', specialization: 'Provisionamento' },
];

const TYPES = [
  'Rompimento',
  'Lentidao',
  'Configuracao ONU',
  'Troca de Senha',
  'Cancelamento',
  'Auditoria',
  'Instalacao',
  'BGP',
  'OTDR',
];

const PRIORITIES = ['Baixa', 'Normal', 'Alta', 'Critica'];

const STATUSES = [
  'Aberta',
  'Em Analise',
  'Ag. Campo',
  'Ag. Terceiros',
  'Em Execucao',
  'Fechada',
  'Cancelada',
];

const ORDER_STATUS_API_TO_UI = {
  ABERTA: 'Aberta',
  EM_ANALISE: 'Em Analise',
  AG_CAMPO: 'Ag. Campo',
  AG_TERCEIROS: 'Ag. Terceiros',
  RESOLVIDA: 'Em Execucao',
  FECHADA: 'Fechada',
  CANCELADA: 'Cancelada',
};

const PRIORITY_API_TO_UI = {
  BAIXA: 'Baixa',
  NORMAL: 'Normal',
  ALTA: 'Alta',
  CRITICA: 'Critica',
};

const ORDER_TYPE_API_TO_UI = {
  ROMPIMENTO: 'Rompimento',
  LENTIDAO: 'Lentidao',
  CONFIGURACAO_ONU: 'Configuracao ONU',
  TROCA_SENHA: 'Troca de Senha',
  CANCELAMENTO: 'Cancelamento',
  AUDITORIA: 'Auditoria',
  INSTALACAO: 'Instalacao',
  BGP: 'BGP',
};

const pad = (n) => String(n).padStart(2, '0');

const slugify = (s) =>
  String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '-');

const startOfDay = (ts) => {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

const endOfDay = (ts) => startOfDay(ts) + DAY_MS - 1;

const formatDate = (ts) => {
  if (!ts) return '-';
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return '-';
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
};

const formatDateTime = (ts) => {
  if (!ts) return '-';
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return '-';
  return `${formatDate(ts)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const toInputDate = (ts) => {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const formatNumber = (n) => new Intl.NumberFormat('pt-BR').format(Number(n || 0));

const formatPercent = (n) => `${Number(n || 0).toFixed(1)}%`;

const parseDateToTs = (value, fallback = Date.now()) => {
  if (!value) return fallback;
  const ts = new Date(value).getTime();
  return Number.isFinite(ts) ? ts : fallback;
};

const mapApiOrderToManagerOrder = (apiOrder, apiOccurrence) => {
  const occurrence = apiOccurrence || apiOrder.occurrence || null;
  const createdAt = parseDateToTs(apiOrder.createdAt);
  const status = ORDER_STATUS_API_TO_UI[apiOrder.status] || 'Aberta';
  const closedAt = apiOrder.closedAt ? parseDateToTs(apiOrder.closedAt) : null;
  const history = Array.isArray(apiOrder.occurrences)
    ? apiOrder.occurrences.map((item) => ({
      at: parseDateToTs(item.createdAt, createdAt),
      user: item.actorUser?.name || 'Sistema',
      text: item.message || 'Atualizacao registrada.',
    }))
    : [];

  return {
    id: apiOrder.id,
    protocol: apiOrder.protocol,
    provider: occurrence?.provider || 'Sem provedor',
    city: PROVIDER_CITY[occurrence?.provider] || '-',
    tech: apiOrder.analystName || apiOrder.assignee?.name || null,
    type: ORDER_TYPE_API_TO_UI[apiOrder.type] || apiOrder.type,
    priority: PRIORITY_API_TO_UI[apiOrder.priority] || 'Normal',
    status,
    sgpStatus: apiOrder.sourceSystem === 'SGP' ? 'Concluida' : 'Em Andamento',
    clientName: apiOrder.requester || occurrence?.provider || 'Cliente',
    createdAt,
    deadlineAt: apiOrder.deadlineAt ? parseDateToTs(apiOrder.deadlineAt) : null,
    closedAt,
    description: apiOrder.description || '-',
    sector: apiOrder.sector || occurrence?.sector || 'NOC',
    origin: apiOrder.origin || occurrence?.origin || 'Suporte Online',
    contract: occurrence?.number || apiOrder.externalProtocol || '-',
    isInconsistent: false,
    internalOsLinked: !!apiOrder.occurrenceId,
    occurrences: history,
    sourceSystem: apiOrder.sourceSystem,
  };
};

const mapApiOccurrencesToManagerOrders = (apiOccurrences) => {
  if (!Array.isArray(apiOccurrences)) return [];
  const flat = [];
  apiOccurrences.forEach((occurrence) => {
    const orders = Array.isArray(occurrence.serviceOrders) ? occurrence.serviceOrders : [];
    orders.forEach((order) => {
      flat.push(mapApiOrderToManagerOrder(order, occurrence));
    });
  });
  return flat.sort((a, b) => b.createdAt - a.createdAt);
};

const normalizeOrderSelection = (rawOrder, sourceOrders = []) => {
  if (!rawOrder || typeof rawOrder !== 'object') return null;

  const maybeProtocol = rawOrder.protocol || rawOrder.protocolo;
  if (maybeProtocol) {
    const matched = (sourceOrders || []).find((item) => String(item?.protocol || '') === String(maybeProtocol));
    if (matched) return matched;
  }

  if (rawOrder.protocol && rawOrder.provider && rawOrder.type) {
    return rawOrder;
  }

  return {
    id: rawOrder.id || rawOrder.protocolo || `tmp-${Date.now()}`,
    protocol: rawOrder.protocol || rawOrder.protocolo || '-',
    provider: rawOrder.provider || rawOrder.provedor || 'Sem provedor',
    city: rawOrder.city || '-',
    tech: rawOrder.tech || rawOrder.tecnico || null,
    type: rawOrder.type || rawOrder.tipo || 'CONSULTORIA_TECNICA',
    priority: rawOrder.priority || rawOrder.prioridade || 'NORMAL',
    status: rawOrder.status || 'ABERTA',
    sgpStatus: rawOrder.sgpStatus || 'Em Andamento',
    clientName: rawOrder.clientName || rawOrder.provedor || 'Cliente',
    createdAt: parseDateToTs(rawOrder.createdAt || rawOrder.criadaEm),
    deadlineAt: rawOrder.deadlineAt ? parseDateToTs(rawOrder.deadlineAt) : (rawOrder.prazoSLA ? parseDateToTs(rawOrder.prazoSLA) : null),
    closedAt: rawOrder.closedAt ? parseDateToTs(rawOrder.closedAt) : (rawOrder.concluidaEm ? parseDateToTs(rawOrder.concluidaEm) : null),
    description: rawOrder.description || rawOrder.descricao || rawOrder.titulo || '-',
    sector: rawOrder.sector || '-',
    origin: rawOrder.origin || 'Portal',
    contract: rawOrder.contract || '-',
    isInconsistent: Boolean(rawOrder.isInconsistent),
    internalOsLinked: Boolean(rawOrder.internalOsLinked),
    occurrences: Array.isArray(rawOrder.occurrences) ? rawOrder.occurrences : [],
    sourceSystem: rawOrder.sourceSystem || 'ERP',
  };
};

const deriveTenantsFromOrders = (orders) => {
  const map = new Map();
  orders.forEach((order) => {
    const key = order.provider || 'Sem provedor';
    if (!map.has(key)) {
      map.set(key, {
        id: key,
        name: key,
        slug: slugify(key),
        city: order.city || PROVIDER_CITY[key] || '-',
        cpfCnpj: '-',
        createdAt: order.createdAt || Date.now(),
        sgpConfigured: order.sourceSystem === 'SGP',
        sgpUrl: '',
        sgpAppName: '',
        sgpToken: '',
        sgpContractId: '',
        users: [],
      });
      return;
    }
    const current = map.get(key);
    if (order.createdAt && order.createdAt < current.createdAt) {
      current.createdAt = order.createdAt;
    }
    if (order.sourceSystem === 'SGP') {
      current.sgpConfigured = true;
    }
  });
  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
};

const mapRoleForManagerPortal = (roleCode) => {
  if (roleCode === 'super_admin') return 'super_admin';
  if (roleCode === 'gerente') return 'gerente';
  return 'analyst';
};

const readApiErrorMessage = async (response, fallbackMessage) => {
  const payload = await response.json().catch(() => null);
  if (!payload) return fallbackMessage;
  if (typeof payload === 'string') return payload || fallbackMessage;
  if (typeof payload.error === 'string') return payload.error || fallbackMessage;
  return fallbackMessage;
};

const ROLE_CODE_TO_LABEL = {
  super_admin: 'Super Admin',
  gerente: 'Gerente',
  analista: 'Analista',
  tecnico: 'Técnico',
  cliente: 'Cliente',
  leitura: 'Leitura',
};

const ROLE_LABEL_TO_CODE = {
  'Super Admin': 'super_admin',
  Gerente: 'gerente',
  Analista: 'analista',
  Técnico: 'tecnico',
  Cliente: 'cliente',
  Leitura: 'leitura',
  NOC: 'tecnico',
};

const mapApiTenantToPortalTenant = (tenant) => ({
  id: tenant.id,
  name: tenant.tradeName,
  slug: tenant.slug,
  city: '-',
  cpfCnpj: tenant.taxId || '-',
  createdAt: parseDateToTs(tenant.createdAt),
  sgpConfigured: false,
  sgpUrl: '',
  sgpAppName: '',
  sgpToken: '',
  sgpContractId: '',
  legalName: tenant.legalName || tenant.tradeName,
  tradeName: tenant.tradeName,
  taxId: tenant.taxId,
  domain: tenant.domain,
  timezone: tenant.timezone || 'America/Sao_Paulo',
  techContactName: tenant.techContactName || '',
  techContactEmail: tenant.techContactEmail || '',
  techContactPhone: tenant.techContactPhone || '',
  status: tenant.status || 'ACTIVE',
  users: [],
});

const mapApiTenantUser = (membership) => ({
  id: membership.user?.id || membership.id,
  membershipId: membership.id,
  name: membership.user?.name || '-',
  email: membership.user?.email || '-',
  roleCode: membership.role?.code || 'leitura',
  role: ROLE_CODE_TO_LABEL[membership.role?.code] || membership.role?.name || membership.role?.code || 'Leitura',
  sector: membership.sector || 'NOC',
  active: membership.user?.status === 'ACTIVE',
  status: membership.user?.status || 'INACTIVE',
  createdAt: membership.user?.createdAt || null,
  lastLoginAt: membership.user?.lastLoginAt || null,
});

const isClosed = (order) => order.status === 'Fechada' || order.status === 'Cancelada';
const isActive = (order) => !isClosed(order);

const getDelayHours = (order, now = Date.now()) => {
  if (!order.deadlineAt) return 0;
  const ref = order.closedAt || now;
  return Math.max(0, (ref - order.deadlineAt) / HOUR_MS);
};

const isOverdueActive = (order, now = Date.now()) => isActive(order) && getDelayHours(order, now) > 0;

const isDueToday = (order, now = Date.now()) =>
  isActive(order) &&
  !!order.deadlineAt &&
  order.deadlineAt >= startOfDay(now) &&
  order.deadlineAt <= endOfDay(now);

/* ----------------------------- Window / Filters ----------------------------- */

const buildWindow = (period, customRange, now = Date.now()) => {
  if (period === 'all') return { start: null, end: now };

  if (period === 'custom') {
    const start = customRange.start ? new Date(`${customRange.start}T00:00:00`).getTime() : null;
    const end = customRange.end ? new Date(`${customRange.end}T23:59:59`).getTime() : null;
    if (start && end && start <= end) return { start, end };
    return { start: null, end: now };
  }

  const preset = PERIOD_MAP[period];
  const days = preset?.days ?? 7;
  if (days === 0) return { start: startOfDay(now), end: endOfDay(now) };

  const start = startOfDay(now - (days - 1) * DAY_MS);
  return { start, end: now };
};

const isTsInWindow = (ts, window) => {
  if (!ts) return false;
  if (window.start == null) return ts <= window.end;
  return ts >= window.start && ts <= window.end;
};

const filterOrdersByWindow = (orders, window, field = 'createdAt') =>
  orders.filter((o) => isTsInWindow(o[field], window));

/* ----------------------------- Analytics ----------------------------- */

const buildTimeline = (orders, window, now = Date.now()) => {
  const withTs = orders
    .flatMap((order) => [order.createdAt || null, order.closedAt || null])
    .filter((ts) => Number.isFinite(ts));
  const hasData = withTs.length > 0;

  const end =
    window.start == null
      ? hasData
        ? Math.max(...withTs)
        : window.end || now
      : window.end || now;

  const start = (() => {
    if (window.start != null) return window.start;
    if (!hasData) return startOfDay(end - 13 * DAY_MS);

    const earliest = Math.min(...withTs);
    const spanDays = Math.floor((endOfDay(end) - startOfDay(earliest)) / DAY_MS) + 1;
    const rangeDays = Math.max(1, Math.min(60, spanDays));
    return startOfDay(end - (rangeDays - 1) * DAY_MS);
  })();

  const rangeDays = Math.max(1, Math.min(60, Math.floor((endOfDay(end) - startOfDay(start)) / DAY_MS) + 1));
  const timeline = [];

  for (let i = rangeDays - 1; i >= 0; i -= 1) {
    const dayStart = startOfDay(end - i * DAY_MS);
    const dayEnd = endOfDay(dayStart);

    const created = orders.filter((o) => o.createdAt >= dayStart && o.createdAt <= dayEnd).length;
    const closed = orders.filter((o) => o.closedAt && o.closedAt >= dayStart && o.closedAt <= dayEnd).length;
    const backlog = orders.filter((o) => o.createdAt <= dayEnd && (!o.closedAt || o.closedAt > dayEnd)).length;

    timeline.push({
      date: pad(new Date(dayStart).getDate()) + "/" + pad(new Date(dayStart).getMonth() + 1),
      created,
      closed,
      backlog,
    });
  }

  return timeline;
};

const buildProvidersAnalytics = (orders, now = Date.now()) => {
  const map = new Map();

  orders.forEach((o) => {
    if (!map.has(o.provider)) {
      map.set(o.provider, {
        name: o.provider,
        slug: slugify(o.provider),
        city: o.city || PROVIDER_CITY[o.provider] || '-',
        total: 0,
        active: 0,
        closed: 0,
        delayed: 0,
        dueToday: 0,
        criticalActive: 0,
        closedWithDeadline: 0,
        lateClosed: 0,
        delayHoursSum: 0,
        delayedCount: 0,
        sgpLinked: 0,
        techSet: new Set(),
        orders: [],
        topTypes: [],
      });
    }

    const p = map.get(o.provider);
    p.total += 1;
    if (isActive(o)) p.active += 1;
    if (isClosed(o)) p.closed += 1;
    if (isOverdueActive(o, now)) p.delayed += 1;
    if (isDueToday(o, now)) p.dueToday += 1;
    if (['Alta', 'Critica'].includes(o.priority) && isActive(o)) p.criticalActive += 1;
    if (o.sourceSystem === 'SGP') p.sgpLinked += 1;
    if (o.tech) p.techSet.add(o.tech);
    if (isClosed(o) && o.deadlineAt) {
      p.closedWithDeadline += 1;
      if (getDelayHours(o, now) > 0) p.lateClosed += 1;
    }
    const delay = getDelayHours(o, now);
    if (delay > 0) {
      p.delayHoursSum += delay;
      p.delayedCount += 1;
    }
    p.orders.push(o);
  });

  return Array.from(map.values())
    .map((p) => {
      const countMap = {};
      p.orders.forEach((o) => {
        countMap[o.type] = (countMap[o.type] || 0) + 1;
      });

      p.topTypes = Object.entries(countMap)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 3);

      p.techCoverage = p.techSet.size;
      p.avgDelayHours = p.delayedCount ? p.delayHoursSum / p.delayedCount : 0;
      p.overdueRate = p.active ? (p.delayed / p.active) * 100 : 0;
      p.closureRate = p.total ? (p.closed / p.total) * 100 : 0;
      p.lateClosedRate = p.closedWithDeadline ? (p.lateClosed / p.closedWithDeadline) * 100 : 0;
      p.riskScore = Math.round((p.overdueRate * 0.5) + (p.lateClosedRate * 0.35) + ((p.criticalActive || 0) * 1.5));

      return p;
    })
    .sort((a, b) => b.total - a.total);
};

const buildTechnicianAnalytics = (orders, now = Date.now()) => {
  const names = new Set([...TECHS.map((t) => t.name), ...orders.map((o) => o.tech).filter(Boolean)]);

  return Array.from(names).map((name) => {
    const own = orders.filter((o) => o.tech === name);
    const active = own.filter(isActive);
    const closed = own.filter(isClosed);
    const delayed = own.filter((o) => getDelayHours(o, now) > 0);

    const onTimeClosed = closed.filter((o) => getDelayHours(o, now) <= 0 || !o.deadlineAt);
    const onTimePct = closed.length ? Math.round((onTimeClosed.length / closed.length) * 100) : 0;

    const avgHours = closed.length
      ? closed.reduce((acc, o) => acc + Math.max(0, ((o.closedAt || now) - o.createdAt) / HOUR_MS), 0) / closed.length
      : 0;

    return {
      name,
      specialization: TECHS.find((t) => t.name === name)?.specialization || 'Operacao',
      created: own.length,
      active: active.length,
      delayed: delayed.length,
      onTimePct,
      avgDuration: `${Math.floor(avgHours)}h ${pad(Math.floor((avgHours % 1) * 60))}m`,
      status: active.length > 8 ? 'busy' : 'available',
    };
  });
};

const buildTypeAnalytics = (orders) => {
  const map = new Map();

  orders.forEach((o) => {
    if (!map.has(o.type)) {
      map.set(o.type, {
        name: o.type,
        total: 0,
        techSet: new Set(),
        durationSum: 0,
        durationCount: 0,
      });
    }

    const item = map.get(o.type);
    item.total += 1;
    if (o.tech) item.techSet.add(o.tech);

    if (isClosed(o) && o.closedAt) {
      item.durationSum += Math.max(0, (o.closedAt - o.createdAt) / HOUR_MS);
      item.durationCount += 1;
    }
  });

  const rows = Array.from(map.values()).map((i) => ({
    name: i.name,
    total: i.total,
    avgTime: i.durationCount ? `${(i.durationSum / i.durationCount).toFixed(1)}h` : '0.0h',
    techs: i.techSet.size,
    ratio: i.techSet.size ? (i.total / i.techSet.size).toFixed(1) : '0.0',
    topTech: Array.from(i.techSet)[0] || '-',
  }));

  return {
    kpis: {
      activeTypes: rows.length,
      totalOrders: orders.length,
      leaderType: [...rows].sort((a, b) => b.total - a.total)[0]?.name || '-',
      uniqueTechs: new Set(orders.map((o) => o.tech).filter(Boolean)).size,
    },
    volumeRanking: [...rows].sort((a, b) => b.total - a.total),
    durationRanking: [...rows].sort((a, b) => parseFloat(b.avgTime) - parseFloat(a.avgTime)),
    coverage: [...rows].sort((a, b) => parseFloat(b.ratio) - parseFloat(a.ratio)),
  };
};

const toBucketLabel = (hours) => {
  if (hours <= 2) return '0-2h';
  if (hours <= 6) return '2-6h';
  if (hours <= 24) return '6-24h';
  return '>24h';
};

const buildSlaAnalytics = (orders, now = Date.now()) => {
  const closed = orders.filter(isClosed);
  const active = orders.filter(isActive);

  const eligible = closed.filter((o) => !!o.deadlineAt);
  const onTime = eligible.filter((o) => getDelayHours(o, now) <= 0);
  const score = eligible.length ? Math.round((onTime.length / eligible.length) * 100) : 0;

  const buildRows = (list, type) => {
    const labels = ['0-2h', '2-6h', '6-24h', '>24h'];
    return labels.map((label) => {
      const rows = list.filter((o) => toBucketLabel(getDelayHours(o, now)) === label);
      return { label, count: rows.length, type, orders: rows };
    });
  };

  const closedDelayed = eligible.filter((o) => getDelayHours(o, now) > 0);
  const activeDelayed = active.filter((o) => getDelayHours(o, now) > 0);

  return {
    score,
    closedWindow: closed.length,
    eligible: eligible.length,
    noDeadline: closed.length - eligible.length,
    buckets: {
      closedDelay: buildRows(closedDelayed, 'closed_delay'),
      activeDelay: buildRows(activeDelayed, 'active_delay'),
    },
    criticalOverdue: activeDelayed
      .sort((a, b) => getDelayHours(b, now) - getDelayHours(a, now))
      .slice(0, 15),
  };
};

const buildAdminAnalytics = (orders, tenants, window, now = Date.now()) => {
  const createdInWindow = filterOrdersByWindow(orders, window, 'createdAt');
  const closedInWindow = filterOrdersByWindow(orders.filter(isClosed), window, 'closedAt');
  const activeNow = orders.filter(isActive);

  const overdueActiveNow = activeNow.filter((o) => isOverdueActive(o, now));
  const dueTodayActive = activeNow.filter((o) => isDueToday(o, now));

  const withDeadlineClosed = closedInWindow.filter((o) => !!o.deadlineAt);
  const lateClosed = withDeadlineClosed.filter((o) => getDelayHours(o, now) > 0);

  const avgResolutionHours = closedInWindow.length
    ? closedInWindow.reduce((acc, o) => acc + Math.max(0, ((o.closedAt || now) - o.createdAt) / HOUR_MS), 0) /
    closedInWindow.length
    : 0;

  const closureRate = createdInWindow.length ? (closedInWindow.length / createdInWindow.length) * 100 : 0;
  const lateClosedRate = withDeadlineClosed.length ? (lateClosed.length / withDeadlineClosed.length) * 100 : 0;

  const providers = buildProvidersAnalytics(createdInWindow, now);
  const techs = buildTechnicianAnalytics(createdInWindow, now)
    .sort((a, b) => b.created - a.created)
    .slice(0, 8);

  const types = buildTypeAnalytics(createdInWindow).volumeRanking.slice(0, 8);

  const slaDistribution = {
    within_deadline: activeNow.filter((o) => o.deadlineAt && !isOverdueActive(o, now)).length,
    overdue: overdueActiveNow.length,
    without_deadline: activeNow.filter((o) => !o.deadlineAt).length,
  };

  return {
    window,
    kpis: {
      tenants_total: tenants.length,
      providers_in_period: new Set(createdInWindow.map((o) => o.provider)).size,
      orders_total: orders.length,
      created_in_period: createdInWindow.length,
      closed_in_period: closedInWindow.length,
      closure_rate: closureRate,
      active_now: activeNow.length,
      overdue_active_now: overdueActiveNow.length,
      due_today_active: dueTodayActive.length,
      avg_resolution_hours: avgResolutionHours,
      late_closed_rate: lateClosedRate,
      late_closed_in_period: lateClosed.length,
    },
    sla_distribution: slaDistribution,
    volume_chart: buildTimeline(orders, window, now),
    top_providers: providers.slice(0, 8),
    top_technicians: techs,
    top_service_types: types,
    critical_overdue: overdueActiveNow
      .sort((a, b) => getDelayHours(b, now) - getDelayHours(a, now))
      .slice(0, 16),
    data_quality: {
      missing_deadline_in_window: createdInWindow.filter((o) => !o.deadlineAt).length,
      missing_technician_active: activeNow.filter((o) => !o.tech).length,
    },
  };
};

/* ----------------------------- Skeleton Loaders ----------------------------- */

const SkeletonKpiCards = ({ count = 4 }) => {
  const { dark } = useTheme();
  return (
    <div className={cn('grid gap-4', count === 3 ? 'grid-cols-1 md:grid-cols-3' : 'grid-cols-1 md:grid-cols-4')}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={cn('border rounded-xl p-5 animate-pulse', dark ? 'bg-[#1e293b]/60 backdrop-blur-md border-slate-700/50' : 'bg-white border-slate-200')}>
          <div className={cn('h-3 w-16 rounded mb-3', dark ? 'bg-slate-800' : 'bg-slate-100')} />
          <div className={cn('h-8 w-12 rounded', dark ? 'bg-slate-800' : 'bg-slate-100')} />
        </div>
      ))}
    </div>
  );
};

const SkeletonTable = ({ rows = 6 }) => {
  const { dark } = useTheme();
  return (
    <div className={cn('border rounded-xl shadow-sm overflow-hidden', dark ? 'bg-[#1e293b]/60 backdrop-blur-md border-slate-700/50' : 'bg-white border-slate-200')}>
      <div className={cn('px-6 py-3 border-b', dark ? 'bg-white/[0.02] border-slate-700/50' : 'bg-slate-50/50 border-slate-100')}>
        <div className={cn('h-5 w-40 rounded animate-pulse', dark ? 'bg-slate-800' : 'bg-slate-100')} />
      </div>
      <div className="p-2">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className={cn('h-14 rounded-lg mb-1 animate-pulse', dark ? 'bg-slate-800/50' : 'bg-slate-50')} />
        ))}
      </div>
    </div>
  );
};

/* ----------------------------- UI Components ----------------------------- */

const getStatusColor = (status) => {
  if (status === 'Fechada' || status === 'Cancelada') return 'green';
  if (status === 'Aberta') return 'blue';
  if (status === 'Em Analise') return 'cyan';
  if (status === 'Ag. Campo') return 'orange';
  if (status === 'Ag. Terceiros') return 'purple';
  if (status === 'Em Execucao') return 'blue';
  return 'slate';
};

const getPriorityColor = (priority) => {
  if (priority === 'Critica') return 'red';
  if (priority === 'Alta') return 'orange';
  if (priority === 'Normal') return 'blue';
  return 'green';
};

const getServiceTypeStyle = (type) => {
  const styles = [
    'bg-cyan-50 text-cyan-700 border-cyan-200',
    'bg-indigo-50 text-indigo-700 border-indigo-200',
    'bg-emerald-50 text-emerald-700 border-emerald-200',
    'bg-amber-50 text-amber-700 border-amber-200',
    'bg-rose-50 text-rose-700 border-rose-200',
    'bg-violet-50 text-violet-700 border-violet-200',
  ];
  let hash = 0;
  for (let i = 0; i < type.length; i += 1) hash = type.charCodeAt(i) + ((hash << 5) - hash);
  return styles[Math.abs(hash) % styles.length];
};

const Badge = ErpBadge;

const ServiceTypeBadge = ({ type }) => (
  <ErpBadge
    color={
      type === 'ROMPIMENTO' ? 'red' :
        type === 'LENTIDAO' ? 'orange' :
          type === 'INSTALACAO' ? 'green' :
            type === 'BGP' ? 'purple' : 'cyan'
    }
    dark={useTheme().dark}
    className="font-bold uppercase tracking-wider text-[10px]"
  >
    {type}
  </ErpBadge>
);

const SidebarItem = ({ icon: Icon, label, active = false, onClick }) => {
  const { dark } = useTheme();
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 text-sm font-medium mb-1',
        active
          ? cn(dark ? 'bg-blue-600/10 text-blue-400 border border-blue-500/20 shadow-lg shadow-blue-500/5' : 'bg-slate-800 text-white shadow-lg shadow-slate-900/20')
          : cn(dark ? 'text-slate-400 hover:text-white hover:bg-white/5' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100')
      )}
    >
      <Icon size={20} className={cn(active ? (dark ? 'text-blue-400' : 'text-cyan-300') : (dark ? 'text-slate-500' : 'text-slate-400'))} />
      <span>{label}</span>
      {active && <div className={cn('ml-auto w-1.5 h-1.5 rounded-full', dark ? 'bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.6)]' : 'bg-cyan-300')} />}
    </button>
  );
};

const WindowControls = ({ period, setPeriod, customRange, setCustomRange }) => {
  const { dark } = useTheme();
  return (
    <div className="flex flex-col gap-2">
      <div className={cn('flex items-center p-1 rounded-xl border overflow-x-auto no-scrollbar', dark ? 'bg-[#1e293b]/60 backdrop-blur-md border-slate-700/50' : 'bg-white border-slate-200')}>
        {PERIOD_TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setPeriod(tab.id)}
            className={cn(
              'px-3 py-1.5 text-xs font-medium rounded-lg transition-all whitespace-nowrap',
              period === tab.id
                ? cn(dark ? 'bg-blue-600/20 text-blue-400 shadow-sm' : 'bg-slate-800 text-white shadow-md')
                : cn(dark ? 'text-slate-400 hover:text-white hover:bg-white/5' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900')
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {period === 'custom' && (
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={customRange.start}
            onChange={(e) => setCustomRange((prev) => ({ ...prev, start: e.target.value }))}
            className={cn('px-3 py-1.5 border rounded-lg text-xs outline-none focus:ring-2 focus:ring-blue-500/20', dark ? 'bg-[#1e293b]/60 backdrop-blur-md border-slate-700/50 text-slate-300' : 'bg-white border-slate-300')}
          />
          <input
            type="date"
            value={customRange.end}
            onChange={(e) => setCustomRange((prev) => ({ ...prev, end: e.target.value }))}
            className={cn('px-3 py-1.5 border rounded-lg text-xs outline-none focus:ring-2 focus:ring-blue-500/20', dark ? 'bg-[#1e293b]/60 backdrop-blur-md border-slate-700/50 text-slate-300' : 'bg-white border-slate-300')}
          />
        </div>
      )}
    </div>
  );
};

const KpiCard = ({ label, value, icon: Icon, gradient, subtitle, trend }) => {
  const { dark } = useTheme();
  return (
    <div className={cn(
      'relative overflow-hidden rounded-2xl p-5 flex items-start justify-between transition-all duration-300 group',
      'hover:scale-[1.02] hover:shadow-xl',
      dark ? 'bg-[#111b2e]/75 backdrop-blur-md border border-slate-700/60 shadow-[0_12px_32px_rgba(2,6,23,0.38)]' : 'bg-white border border-slate-200 shadow-sm'
    )}>
      {/* gradient glow always visible */}
      <div className={cn(
        'absolute inset-0 pointer-events-none transition-opacity duration-500',
        dark ? 'opacity-100 group-hover:opacity-100' : 'opacity-70 group-hover:opacity-85',
        gradient
      )} />
      <div className="relative z-10">
        <p className={cn('text-[10px] font-bold tracking-wider mb-2 uppercase', dark ? 'text-slate-500' : 'text-slate-400')}>{label}</p>
        <p className={cn('text-3xl font-extrabold tabular-nums', dark ? 'text-white' : 'text-slate-900')}>{value}</p>
        {subtitle && <p className={cn('text-[11px] mt-1.5 flex items-center gap-1', dark ? 'text-slate-500' : 'text-slate-400')}>{subtitle}</p>}
      </div>
      <div className={cn('relative z-10 p-3 rounded-xl', dark ? 'bg-white/[0.04]' : 'bg-slate-50')}>
        <Icon size={22} className={cn(dark ? 'text-slate-400' : 'text-slate-500')} strokeWidth={1.8} />
      </div>
    </div>
  );
};

const DualAreaChart = ({ data }) => {
  const { dark } = useTheme();
  if (!data.length) return null;

  const maxVal = Math.max(1, ...data.map((d) => Math.max(d.created, d.closed))) * 1.1;

  const getPoints = (key) =>
    data
      .map((d, i) => {
        const x = data.length === 1 ? 50 : (i / (data.length - 1)) * 100;
        const y = 100 - (d[key] / maxVal) * 100;
        return `${x},${y}`;
      })
      .join(' ');

  const createdPoints = getPoints('created');
  const closedPoints = getPoints('closed');

  return (
    <div className={cn('w-full h-64 relative select-none rounded-xl border overflow-hidden',
      dark ? 'border-cyan-500/20 bg-[#0a1222]/70 shadow-[inset_0_0_34px_rgba(34,211,238,0.12)]' : 'border-slate-200 bg-slate-50')}>
      <div className={cn('absolute inset-0 pointer-events-none',
        dark ? 'bg-[linear-gradient(to_right,rgba(148,163,184,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(148,163,184,0.08)_1px,transparent_1px)] bg-[size:28px_28px]'
          : 'bg-[linear-gradient(to_right,rgba(148,163,184,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(148,163,184,0.08)_1px,transparent_1px)] bg-[size:28px_28px]')} />
      <div className={cn('absolute left-0 top-0 bottom-0 flex flex-col justify-between text-[9px] font-mono h-full pr-2',
        dark ? 'text-slate-500' : 'text-slate-400')}>
        <span>{Math.round(maxVal)}</span>
        <span>{Math.round(maxVal / 2)}</span>
        <span>0</span>
      </div>

      <div className="ml-6 w-[calc(100%-1.5rem)] h-full relative">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full overflow-visible relative z-10">
          <defs>
            <filter id="mgrGlowCyan" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="1.8" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
            <filter id="mgrGlowGreen" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="1.8" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
            <linearGradient id="gradCyanMain" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.2" />
              <stop offset="100%" stopColor="#06b6d4" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="gradGreenMain" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.2" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
            </linearGradient>
          </defs>

          <path d={`M0,100 ${createdPoints} L100,100 Z`} fill="url(#gradCyanMain)" />
          <polyline points={createdPoints} fill="none" stroke="#22d3ee" strokeWidth="2.2" vectorEffect="non-scaling-stroke" strokeLinecap="round" filter="url(#mgrGlowCyan)" />

          <path d={`M0,100 ${closedPoints} L100,100 Z`} fill="url(#gradGreenMain)" />
          <polyline points={closedPoints} fill="none" stroke="#10b981" strokeWidth="2.2" vectorEffect="non-scaling-stroke" strokeLinecap="round" filter="url(#mgrGlowGreen)" />
        </svg>
      </div>

      <div className={cn('absolute bottom-1 left-6 right-2 flex justify-between text-[9px] font-mono',
        dark ? 'text-slate-500' : 'text-slate-400')}>
        {data.map((d, i) => (
          <span key={`${d.date}-${i}`}>{d.date}</span>
        ))}
      </div>
    </div>
  );
};

const Modal = ({ title, children, onClose, actions, maxWidth = 'max-w-md' }) => (
  <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
    <div className={cn('relative w-full bg-white rounded-xl shadow-2xl overflow-hidden', maxWidth)}>
      <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
        <h3 className="font-bold text-slate-800">{title}</h3>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
          <X size={20} />
        </button>
      </div>
      <div className="p-6">{children}</div>
      {actions && <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-2">{actions}</div>}
    </div>
  </div>
);

/* ----------------------------- Drawers ----------------------------- */

const OSDetailsDrawer = ({ os, onClose, onCopyProtocolLink, onOpenOrder }) => {
  if (!os) return null;

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  const delayHours = getDelayHours(os).toFixed(2);

  return (
    <div className="fixed inset-0 z-[95] flex justify-end">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-[500px] bg-white h-full shadow-2xl flex flex-col">
        <div className="h-16 border-b border-slate-100 flex items-center justify-between px-6 bg-slate-50/70">
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Detalhes da OS</span>
            <h2 className="text-lg font-bold text-slate-800 font-mono">{os.protocol}</h2>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-full">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5 custom-scrollbar">
          <div className="flex items-center justify-between">
            <Badge color={getStatusColor(os.status)}>{os.status}</Badge>
            <Badge color={getPriorityColor(os.priority)}>{os.priority}</Badge>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="border rounded-lg p-3 bg-slate-50">
              <div className="text-[11px] uppercase text-slate-400 font-bold">Provedor</div>
              <div className="text-sm text-slate-700 font-medium">{os.provider}</div>
            </div>
            <div className="border rounded-lg p-3 bg-slate-50">
              <div className="text-[11px] uppercase text-slate-400 font-bold">Técnico</div>
              <div className="text-sm text-slate-700 font-medium">{os.tech || 'Sem tecnico'}</div>
            </div>
          </div>

          <div>
            <div className="text-xs font-bold text-slate-400 uppercase mb-2">Tipo</div>
            <ServiceTypeBadge type={os.type} />
          </div>

          <div className="border rounded-lg p-3 bg-slate-50">
            <div className="text-[11px] uppercase text-slate-400 font-bold mb-1">Descricao</div>
            <p className="text-sm text-slate-700">{os.description}</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="border rounded-lg p-3">
              <div className="text-[11px] uppercase text-slate-400 font-bold">Abertura</div>
              <div className="text-sm font-mono text-slate-700">{formatDateTime(os.createdAt)}</div>
            </div>
            <div className="border rounded-lg p-3">
              <div className="text-[11px] uppercase text-slate-400 font-bold">Prazo</div>
              <div className={cn('text-sm font-mono', isOverdueActive(os) ? 'text-rose-600 font-bold' : 'text-slate-700')}>
                {os.deadlineAt ? formatDateTime(os.deadlineAt) : 'Sem prazo'}
              </div>
            </div>
          </div>

          <div className="border rounded-lg p-3">
            <div className="text-[11px] uppercase text-slate-400 font-bold mb-1">Delay</div>
            <div className={cn('text-sm font-bold', parseFloat(delayHours) > 0 ? 'text-rose-600' : 'text-emerald-600')}>
              {parseFloat(delayHours) > 0 ? `+${delayHours}h` : 'Sem atraso'}
            </div>
          </div>

          <div>
            <div className="text-xs font-bold text-slate-400 uppercase mb-2">Histórico</div>
            <div className="space-y-3">
              {(os.occurrences || []).map((occ, idx) => (
                <div key={`${occ.at}-${idx}`} className="p-3 border border-slate-200 rounded-lg">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs font-bold text-slate-700">{occ.user}</span>
                    <span className="text-[10px] font-mono text-slate-400">{formatDateTime(occ.at)}</span>
                  </div>
                  <p className="text-sm text-slate-600">{occ.text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-slate-100 bg-slate-50 flex gap-2">
          <button
            onClick={() => onCopyProtocolLink(os.protocol)}
            className="flex-1 py-2 bg-white border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-100 flex items-center justify-center gap-2"
          >
            <Copy size={14} />
            Copiar Link
          </button>
          <button
            onClick={() => onOpenOrder(os.protocol)}
            className="flex-1 py-2 bg-blue-600 rounded-lg text-sm font-medium text-white hover:bg-blue-700 flex items-center justify-center gap-2"
          >
            <ExternalLink size={14} />
            Abrir O.S.
          </button>
        </div>
      </div>
    </div>
  );
};

const ProviderDetailDrawer = ({ provider, onClose, onSelectOS }) => {
  const { dark } = useTheme();

  const safeProvider = provider || { name: '-', slug: '-', city: '-', total: 0, active: 0, delayed: 0, dueToday: 0, topTypes: [], orders: [] };
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [onlyInconsistent, setOnlyInconsistent] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(35);
  const [sort, setSort] = useState({ key: 'deadlineAt', dir: 'asc' });

  const topTypes = safeProvider.topTypes || [];
  const typeOptions = useMemo(() => ['all', ...Array.from(new Set((safeProvider.orders || []).map((o) => o.type))).sort()], [safeProvider.orders]);
  const closedCount = useMemo(() => (safeProvider.orders || []).filter(isClosed).length, [safeProvider.orders]);

  const filteredOrders = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (safeProvider.orders || []).filter((o) => {
      const byStatus =
        statusFilter === 'all'
          ? true
          : statusFilter === 'active'
            ? isActive(o)
            : statusFilter === 'closed'
              ? isClosed(o)
              : statusFilter === 'overdue'
                ? isOverdueActive(o)
                : statusFilter === 'due_today'
                  ? isDueToday(o)
                  : o.status === statusFilter;
      const byType = typeFilter === 'all' ? true : o.type === typeFilter;
      const byInconsistent = onlyInconsistent ? Boolean(o.isInconsistent) : true;
      const bySearch =
        !q ||
        String(o.protocol || '').toLowerCase().includes(q) ||
        String(o.provider || '').toLowerCase().includes(q) ||
        String(o.tech || '').toLowerCase().includes(q) ||
        String(o.type || '').toLowerCase().includes(q);
      return byStatus && byType && byInconsistent && bySearch;
    });
  }, [safeProvider.orders, search, statusFilter, typeFilter, onlyInconsistent]);

  const sortedOrders = useMemo(() => {
    const list = [...filteredOrders];
    const factor = sort.dir === 'asc' ? 1 : -1;
    const val = (o) => {
      if (sort.key === 'protocol') return String(o.protocol || '');
      if (sort.key === 'tech') return String(o.tech || '');
      if (sort.key === 'type') return String(o.type || '');
      if (sort.key === 'status') return String(o.status || '');
      if (sort.key === 'createdAt') return Number(o.createdAt || 0);
      if (sort.key === 'deadlineAt') return Number(o.deadlineAt || 0);
      if (sort.key === 'delay') return Number(getDelayHours(o) || 0);
      return 0;
    };
    list.sort((a, b) => {
      const av = val(a);
      const bv = val(b);
      if (typeof av === 'string' || typeof bv === 'string') return String(av).localeCompare(String(bv), 'pt-BR') * factor;
      return (Number(av) - Number(bv)) * factor;
    });
    return list;
  }, [filteredOrders, sort]);

  const totalPages = Math.max(1, Math.ceil(sortedOrders.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageRows = useMemo(() => sortedOrders.slice((safePage - 1) * pageSize, safePage * pageSize), [sortedOrders, safePage, pageSize]);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, typeFilter, onlyInconsistent, pageSize]);

  const toggleSort = (key) => {
    setSort((prev) => (prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: key === 'protocol' ? 'asc' : 'desc' }));
  };
  const sortIcon = (key) => (sort.key === key ? (sort.dir === 'asc' ? '↑' : '↓') : '');

  return (
    <div className="fixed inset-0 z-[75] flex justify-end bg-slate-900/75 backdrop-blur-md" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className={cn(
          'h-full w-full max-w-[1180px] flex flex-col border-l shadow-2xl',
          dark ? 'bg-[#0b1426] border-slate-700/60' : 'bg-white border-slate-200'
        )}
      >
        <div className={cn('px-5 md:px-6 py-4 border-b flex justify-between items-center shrink-0',
          dark ? 'border-slate-700/60 bg-[#0b1426]/95' : 'border-slate-200 bg-white')}>
          <div>
            <h2 className={cn('text-xl font-bold tracking-tight', dark ? 'text-slate-100' : 'text-slate-800')}>
              {safeProvider.name}
            </h2>
            <p className={cn('text-xs mt-1 font-medium', dark ? 'text-slate-500' : 'text-slate-500')}>
              {safeProvider.city} • {safeProvider.slug}
            </p>
          </div>
          <button onClick={onClose} className={cn('px-3 py-2 rounded-lg text-sm font-medium transition',
            dark ? 'bg-[#111b2e] hover:bg-[#16213a] text-slate-200 border border-slate-700/60' : 'bg-slate-100 hover:bg-slate-200 text-slate-700')}>
            Fechar
          </button>
        </div>

        <div className="p-5 md:p-6 flex-1 min-h-0 overflow-auto space-y-4 custom-scrollbar">
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <div className={cn('rounded-xl p-3 border', dark ? 'bg-[#111b2e] border-slate-700/60' : 'bg-slate-50 border-slate-200')}>
              <p className={cn('text-[10px] uppercase', dark ? 'text-slate-500' : 'text-slate-500')}>Criadas</p>
              <p className={cn('text-lg font-bold', dark ? 'text-slate-100' : 'text-slate-800')}>{formatNumber(safeProvider.total || 0)}</p>
            </div>
            <div className={cn('rounded-xl p-3 border', dark ? 'bg-cyan-500/10 border-cyan-500/30' : 'bg-cyan-50 border-cyan-200')}>
              <p className={cn('text-[10px] uppercase', dark ? 'text-slate-500' : 'text-slate-500')}>Ativas</p>
              <p className={cn('text-lg font-bold', dark ? 'text-cyan-300' : 'text-cyan-700')}>{formatNumber(safeProvider.active || 0)}</p>
            </div>
            <div className={cn('rounded-xl p-3 border', dark ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-emerald-50 border-emerald-200')}>
              <p className={cn('text-[10px] uppercase', dark ? 'text-slate-500' : 'text-slate-500')}>Fechadas</p>
              <p className={cn('text-lg font-bold', dark ? 'text-emerald-300' : 'text-emerald-700')}>{formatNumber(closedCount)}</p>
            </div>
            <div className={cn('rounded-xl p-3 border', dark ? 'bg-rose-500/10 border-rose-500/30' : 'bg-rose-50 border-rose-200')}>
              <p className={cn('text-[10px] uppercase', dark ? 'text-slate-500' : 'text-slate-500')}>Atrasadas</p>
              <p className={cn('text-lg font-bold', dark ? 'text-rose-300' : 'text-rose-700')}>{formatNumber(safeProvider.delayed || 0)}</p>
            </div>
            <div className={cn('rounded-xl p-3 border', dark ? 'bg-indigo-500/10 border-indigo-500/30' : 'bg-indigo-50 border-indigo-200')}>
              <p className={cn('text-[10px] uppercase', dark ? 'text-slate-500' : 'text-slate-500')}>Vencem Hoje</p>
              <p className={cn('text-lg font-bold', dark ? 'text-indigo-300' : 'text-indigo-700')}>{formatNumber(safeProvider.dueToday || 0)}</p>
            </div>
          </div>

          <div className={cn('rounded-xl border p-4 space-y-3', dark ? 'bg-[#111b2e]/70 border-slate-700/60' : 'bg-white border-slate-200')}>
            <div className="flex items-center justify-between gap-4">
              <p className={cn('text-sm font-semibold', dark ? 'text-slate-200' : 'text-slate-700')}>Filtros da lista de O.S</p>
              <label className={cn('text-xs flex items-center gap-2 select-none', dark ? 'text-slate-300' : 'text-slate-600')}>
                <input type="checkbox" checked={onlyInconsistent} onChange={(e) => setOnlyInconsistent(e.target.checked)} />
                Somente inconsistentes
              </label>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                type="text"
                placeholder="Buscar protocolo, técnico, tipo..."
                className={cn('px-3 py-2 border rounded-lg text-sm',
                  dark ? 'bg-[#0d1628] border-slate-700/60 text-slate-200 placeholder:text-slate-500' : 'bg-white border-slate-300')}
              />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className={cn('px-3 py-2 border rounded-lg text-sm', dark ? 'bg-[#0d1628] border-slate-700/60 text-slate-200' : 'bg-white border-slate-300')}
              >
                <option value="all">Todos os status</option>
                <option value="active">Ativas</option>
                <option value="closed">Fechadas</option>
                <option value="overdue">Atrasadas</option>
                <option value="due_today">Vencem Hoje</option>
              </select>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className={cn('px-3 py-2 border rounded-lg text-sm', dark ? 'bg-[#0d1628] border-slate-700/60 text-slate-200' : 'bg-white border-slate-300')}
              >
                <option value="all">Todos os tipos</option>
                {typeOptions.filter((tp) => tp !== 'all').map((tp) => (
                  <option key={tp} value={tp}>{tp}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {topTypes.map((t) => (
              <span
                key={`${safeProvider.name}-${t.name}`}
                className={cn('px-2 py-1 rounded-md text-xs border font-medium',
                  dark ? 'border-indigo-500/30 bg-indigo-500/10 text-indigo-200' : 'border-indigo-200 bg-indigo-50 text-indigo-700')}
              >
                {t.name} ({formatNumber(t.count)})
              </span>
            ))}
            {topTypes.length === 0 && (
              <span className={cn('text-xs', dark ? 'text-slate-500' : 'text-slate-500')}>Sem top tipos para este provedor.</span>
            )}
          </div>

          <div className={cn('flex items-center justify-between text-xs', dark ? 'text-slate-400' : 'text-slate-500')}>
            <span>Exibindo {formatNumber(pageRows.length)} de {formatNumber(sortedOrders.length)} O.S</span>
            <span>Página {formatNumber(safePage)} / {formatNumber(totalPages)}</span>
          </div>

          <div className={cn('overflow-auto max-h-[52vh] border rounded-xl', dark ? 'border-slate-700/60' : 'border-slate-200')}>
            <table className="w-full text-sm">
              <thead className={cn('sticky top-0 z-10', dark ? 'bg-[#0b1426] text-slate-400' : 'bg-slate-50 text-slate-500')}>
                <tr className="text-left">
                  <th className="px-4 py-3 text-xs uppercase font-semibold"><button className="hover:underline" onClick={() => toggleSort('protocol')}>Protocolo {sortIcon('protocol')}</button></th>
                  <th className="px-4 py-3 text-xs uppercase font-semibold"><button className="hover:underline" onClick={() => toggleSort('tech')}>Técnico {sortIcon('tech')}</button></th>
                  <th className="px-4 py-3 text-xs uppercase font-semibold"><button className="hover:underline" onClick={() => toggleSort('type')}>Tipo {sortIcon('type')}</button></th>
                  <th className="px-4 py-3 text-xs uppercase font-semibold"><button className="hover:underline" onClick={() => toggleSort('createdAt')}>Criado {sortIcon('createdAt')}</button></th>
                  <th className="px-4 py-3 text-xs uppercase font-semibold"><button className="hover:underline" onClick={() => toggleSort('deadlineAt')}>Vencimento {sortIcon('deadlineAt')}</button></th>
                  <th className="px-4 py-3 text-xs uppercase font-semibold"><button className="hover:underline" onClick={() => toggleSort('status')}>Status {sortIcon('status')}</button></th>
                  <th className="px-4 py-3 text-xs uppercase font-semibold text-right"><button className="hover:underline" onClick={() => toggleSort('delay')}>Atraso (h) {sortIcon('delay')}</button></th>
                  <th className="px-4 py-3 text-xs uppercase font-semibold text-right">Ação</th>
                </tr>
              </thead>
              <tbody className={cn('divide-y', dark ? 'divide-slate-700/50' : 'divide-slate-100')}>
                {pageRows.map((os) => (
                  <tr key={os.id} className={cn('cursor-pointer transition-colors', dark ? 'hover:bg-slate-800/40' : 'hover:bg-slate-50')} onClick={() => onSelectOS(os)}>
                    <td className={cn('px-4 py-3 font-mono font-semibold', dark ? 'text-indigo-300' : 'text-indigo-700')}>
                      {os.protocol}
                      {os.isInconsistent && (
                        <span className={cn('ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border',
                          dark ? 'bg-rose-500/10 text-rose-300 border-rose-500/20' : 'bg-rose-50 text-rose-700 border-rose-200')}>
                          INCONSISTENTE
                        </span>
                      )}
                    </td>
                    <td className={cn('px-4 py-3', dark ? 'text-slate-300' : 'text-slate-700')}>{os.tech || '-'}</td>
                    <td className={cn('px-4 py-3', dark ? 'text-slate-300' : 'text-slate-700')}>{os.type || '-'}</td>
                    <td className={cn('px-4 py-3 text-xs', dark ? 'text-slate-400' : 'text-slate-500')}>{formatDateTime(os.createdAt)}</td>
                    <td className={cn('px-4 py-3 text-xs', dark ? 'text-amber-200' : 'text-amber-700')}>{os.deadlineAt ? formatDateTime(os.deadlineAt) : 'Sem prazo'}</td>
                    <td className="px-4 py-3"><Badge color={getStatusColor(os.status)}>{os.status}</Badge></td>
                    <td className={cn('px-4 py-3 text-right font-mono font-semibold', getDelayHours(os) > 0 ? (dark ? 'text-rose-300' : 'text-rose-600') : dark ? 'text-slate-500' : 'text-slate-400')}>
                      {getDelayHours(os).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectOS(os);
                        }}
                        className={cn('px-3 py-1.5 rounded-lg text-xs font-medium transition border',
                          dark ? 'bg-slate-800 hover:bg-slate-700 text-white border-slate-700/70' : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300')}
                      >
                        Ver O.S
                      </button>
                    </td>
                  </tr>
                ))}
                {pageRows.length === 0 && (
                  <tr>
                    <td colSpan={8} className={cn('px-6 py-10 text-center', dark ? 'text-slate-500' : 'text-slate-400')}>
                      Nenhuma O.S para o período/filtros selecionados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end gap-2">
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value) || 35)}
              className={cn('px-2 py-2 border rounded-lg text-xs', dark ? 'bg-[#0d1628] border-slate-700/60 text-slate-200' : 'bg-white border-slate-300')}
            >
              <option value={20}>20/pg</option>
              <option value={35}>35/pg</option>
              <option value={50}>50/pg</option>
              <option value={100}>100/pg</option>
            </select>
            <button
              className={cn('px-3 py-2 rounded-lg text-xs font-medium transition disabled:opacity-40 disabled:cursor-not-allowed',
                dark ? 'bg-slate-800 hover:bg-slate-700 text-white border border-slate-700/70' : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300')}
              disabled={safePage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Anterior
            </button>
            <button
              className={cn('px-3 py-2 rounded-lg text-xs font-medium transition disabled:opacity-40 disabled:cursor-not-allowed',
                dark ? 'bg-slate-800 hover:bg-slate-700 text-white border border-slate-700/70' : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300')}
              disabled={safePage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Próxima
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const TechnicianOrdersDrawer = ({ techName, orders, mode = 'overdue', onClose, onSelectOS }) => {
  const now = Date.now();
  const scopedOrders = useMemo(() => {
    if (mode === 'due_today') {
      return orders
        .filter((o) => (o.tech || 'Sem analista') === techName && isDueToday(o, now))
        .sort((a, b) => (a.deadlineAt || Infinity) - (b.deadlineAt || Infinity));
    }
    return orders
      .filter((o) => (o.tech || 'Sem analista') === techName && getDelayHours(o) > 0)
      .sort((a, b) => getDelayHours(b) - getDelayHours(a));
  }, [orders, techName, mode, now]);

  const drawerTitle = mode === 'due_today' ? `Vencem Hoje: ${techName}` : `Atrasos: ${techName}`;
  const drawerSubtitle = mode === 'due_today' ? 'Ordens com vencimento para hoje' : 'Ordens com delay acumulado';

  return (
    <div className="fixed inset-0 z-[75] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm">
      <div className="relative w-full max-w-[1280px] h-[90vh] bg-white rounded-xl shadow-2xl flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-white">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-rose-50 text-rose-600 rounded-lg">
              <AlertTriangle size={20} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-800">{drawerTitle}</h2>
              <p className="text-xs text-slate-500">{drawerSubtitle}</p>
            </div>
          </div>
          <button onClick={onClose}>
            <X size={20} className="text-slate-400" />
          </button>
        </div>

        <div className="p-6 overflow-auto bg-slate-50 flex-1 custom-scrollbar">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-slate-500 font-medium">
                <tr>
                  <th className="px-6 py-3">Protocolo</th>
                  <th className="px-6 py-3">Provedor</th>
                  <th className="px-6 py-3">Tipo</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3 text-right">{mode === 'due_today' ? 'Prazo' : 'Delay (h)'}</th>
                  <th className="px-6 py-3 text-center">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {scopedOrders.map((os) => (
                  <tr key={os.id} className="hover:bg-rose-50/20">
                    <td className="px-6 py-3 font-mono font-medium">{os.protocol}</td>
                    <td className="px-6 py-3 text-slate-600">{os.provider}</td>
                    <td className="px-6 py-3">
                      <ServiceTypeBadge type={os.type} />
                    </td>
                    <td className="px-6 py-3">
                      <Badge color={getStatusColor(os.status)}>{os.status}</Badge>
                    </td>
                    <td className="px-6 py-3 text-right font-mono font-bold text-rose-600">
                      {mode === 'due_today' ? (os.deadlineAt ? formatDateTime(os.deadlineAt) : 'Sem prazo') : getDelayHours(os).toFixed(2)}
                    </td>
                    <td className="px-6 py-3 text-center">
                      <button onClick={() => onSelectOS(os)} className="text-xs border px-2 py-1 rounded bg-white hover:bg-slate-50">
                        Detalhes
                      </button>
                    </td>
                  </tr>
                ))}
                {scopedOrders.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-10 text-center text-slate-400">
                      {mode === 'due_today'
                        ? 'Nenhuma OS vencendo hoje para este analista na janela selecionada.'
                        : 'Nenhum atraso para este analista na janela selecionada.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

const ServiceTypeDrilldownDrawer = ({ row, orders, onClose, onSelectOS }) => {
  const list = useMemo(() => orders.filter((o) => o.type === row.name), [orders, row.name]);
  const byTech = useMemo(() => {
    const map = new Map();
    list.forEach((o) => {
      const key = o.tech || 'Sem tecnico';
      map.set(key, (map.get(key) || 0) + 1);
    });
    return Array.from(map.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [list]);

  return (
    <div className="fixed inset-0 z-[75] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm">
      <div className="relative w-full max-w-[1280px] h-[90vh] bg-white rounded-xl shadow-2xl flex flex-col overflow-hidden">
        <div className="px-6 py-4 border-b flex justify-between bg-white">
          <h2 className="text-xl font-bold text-slate-800">Analise: {row.name}</h2>
          <button onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-auto bg-slate-50 p-6 flex gap-6 custom-scrollbar">
          <div className="flex-1 bg-white rounded-xl border shadow-sm overflow-hidden h-full flex flex-col">
            <div className="p-4 border-b font-bold text-sm bg-slate-50/50">Lista de O.S</div>
            <div className="flex-1 overflow-auto custom-scrollbar">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 sticky top-0 text-slate-500">
                  <tr>
                    <th className="p-3 text-left">Protocolo</th>
                    <th className="p-3 text-left">Provedor</th>
                    <th className="p-3 text-left">Status</th>
                    <th className="p-3 text-center">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {list.map((o) => (
                    <tr key={o.id} className="hover:bg-slate-50">
                      <td className="p-3 font-mono">{o.protocol}</td>
                      <td className="p-3">{o.provider}</td>
                      <td className="p-3">
                        <Badge color={getStatusColor(o.status)}>{o.status}</Badge>
                      </td>
                      <td className="p-3 text-center">
                        <button onClick={() => onSelectOS(o)} className="text-xs text-blue-600 font-bold">
                          Ver
                        </button>
                      </td>
                    </tr>
                  ))}
                  {list.length === 0 && (
                    <tr>
                      <td colSpan={4} className="p-8 text-center text-slate-400">
                        Nenhum registro encontrado.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="w-80 bg-white rounded-xl border shadow-sm p-4 h-full overflow-auto custom-scrollbar">
            <h3 className="font-bold text-slate-700 mb-4">Distribuição por Técnico</h3>
            {byTech.map((t) => (
              <div key={t.name} className="flex justify-between items-center mb-3 p-2 bg-slate-50 rounded border border-slate-100">
                <span className="text-sm font-medium text-slate-600">{t.name}</span>
                <span className="text-xs font-bold text-indigo-600">{t.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const SLABucketDrawer = ({ bucket, onClose, onSelectOS }) => (
  <div className="fixed inset-0 z-[75] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm">
    <div className="relative w-full max-w-[1280px] h-[90vh] bg-white rounded-xl shadow-2xl flex flex-col overflow-hidden">
      <div className="px-6 py-4 border-b flex justify-between bg-white">
        <h2 className="text-xl font-bold text-slate-800">
          Bucket {bucket.label} ({bucket.type === 'active_delay' ? 'Ativas' : 'Fechadas'})
        </h2>
        <button onClick={onClose}>
          <X size={20} />
        </button>
      </div>

      <div className="p-6 overflow-auto bg-slate-50 flex-1 custom-scrollbar">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {bucket.orders.map((o) => (
            <div key={o.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex justify-between mb-2">
                <span className="font-mono font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded text-xs">{o.protocol}</span>
                <Badge color={getStatusColor(o.status)}>{o.status}</Badge>
              </div>
              <div className="text-xs text-slate-500 mb-1">{o.provider}</div>
              <div className="text-xs text-slate-500 mb-2">{o.tech || 'Sem tecnico'}</div>
              <div className="text-right font-mono font-bold text-rose-600 text-sm">+{getDelayHours(o).toFixed(2)}h</div>
              <button onClick={() => onSelectOS(o)} className="mt-3 w-full text-xs py-1.5 bg-cyan-50 border border-cyan-200 text-cyan-700 rounded font-bold hover:bg-cyan-100">
                Ver Detalhes
              </button>
            </div>
          ))}
          {bucket.orders.length === 0 && <div className="col-span-full text-center text-slate-400 py-10">Nenhuma OS neste bucket.</div>}
        </div>
      </div>
    </div>
  </div>
);


/* ----------------------------- Views ----------------------------- */

const ManagerDashboardView = ({ orders, onSelectOS, loading }) => {
  const { dark } = useTheme();
  const [period, setPeriod] = useState('all');
  const [customRange, setCustomRange] = useState({ start: toInputDate(Date.now() - 7 * DAY_MS), end: toInputDate(Date.now()) });

  const now = Date.now();
  const window = useMemo(() => buildWindow(period, customRange), [period, customRange]);
  const scoped = useMemo(() => filterOrdersByWindow(orders, window, 'createdAt'), [orders, window]);

  const active = scoped.filter(isActive);
  const closed = scoped.filter(isClosed);
  const delayedActive = active.filter((o) => getDelayHours(o, now) > 0).length;

  const statusCount = useMemo(() => {
    const map = {};
    scoped.forEach((o) => {
      map[o.status] = (map[o.status] || 0) + 1;
    });
    return map;
  }, [scoped]);

  const timeline = useMemo(() => buildTimeline(orders, window, now), [orders, window, now]);

  const urgent = useMemo(
    () => [...active].sort((a, b) => (a.deadlineAt || Infinity) - (b.deadlineAt || Infinity)).slice(0, 10),
    [active]
  );

  const topProviders = useMemo(() => buildProvidersAnalytics(scoped, now).slice(0, 6), [scoped, now]);
  const topTechs = useMemo(
    () =>
      buildTechnicianAnalytics(scoped, now)
        .sort((a, b) => b.created - a.created)
        .slice(0, 6),
    [scoped, now]
  );
  const delayedRate = active.length ? (delayedActive / active.length) * 100 : 0;
  const maxProviderActive = Math.max(1, ...topProviders.map((item) => item.active));
  const maxTechCreated = Math.max(1, ...topTechs.map((item) => item.created));
  const slaWithin = active.filter((order) => order.deadlineAt && !isOverdueActive(order)).length;
  const slaOverdue = active.filter((order) => isOverdueActive(order)).length;
  const slaNoDeadline = active.filter((order) => !order.deadlineAt).length;
  const slaTotal = Math.max(1, slaWithin + slaOverdue + slaNoDeadline);
  const slaWithinStroke = (slaWithin / slaTotal) * 264;
  const slaOverdueStroke = (slaOverdue / slaTotal) * 264;
  const dataQualityMissingDeadline = scoped.filter((order) => !order.deadlineAt).length;
  const dataQualityMissingTech = active.filter((order) => !order.tech).length;
  const panelClass = cn('rounded-2xl border shadow-sm', dark ? 'bg-[#111b2e]/75 border-slate-700/60 backdrop-blur-md shadow-[0_12px_32px_rgba(2,6,23,0.35)]' : 'bg-white border-slate-200');
  const subPanelClass = cn('rounded-xl border px-4 py-3', dark ? 'bg-[#0d1628]/80 border-slate-700/60' : 'bg-slate-50/70 border-slate-200');

  if (loading) return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <h2 className={cn('text-2xl font-bold', dark ? 'text-slate-100' : 'text-slate-900')}>Visao Unificada</h2>
        <p className={cn('text-sm mt-1', dark ? 'text-slate-400' : 'text-slate-500')}>Carregando dados operacionais...</p>
      </div>
      <SkeletonKpiCards count={3} />
      <SkeletonTable rows={4} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4"><SkeletonTable rows={5} /><SkeletonTable rows={5} /></div>
    </div>
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
          <h2 className={cn('text-2xl font-bold tracking-tight', dark ? 'text-slate-100' : 'text-slate-900')}>Visao Unificada</h2>
          <p className={cn('text-sm flex items-center', dark ? 'text-slate-400' : 'text-slate-500')}>
            Painel de gerencia
            <span className={cn('mx-2', dark ? 'text-slate-600' : 'text-slate-300')}>|</span>
            <Clock size={12} className="mr-1" />
            America/Sao_Paulo
          </p>
        </div>
        <div className="space-y-2">
          <WindowControls period={period} setPeriod={setPeriod} customRange={customRange} setCustomRange={setCustomRange} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className={subPanelClass}>
          <p className={cn('text-[11px] font-bold uppercase tracking-wider', dark ? 'text-slate-500' : 'text-slate-500')}>Saúde SLA</p>
          <p className={cn('text-2xl font-extrabold mt-1', delayedRate > 20 ? 'text-rose-500' : dark ? 'text-emerald-400' : 'text-emerald-700')}>
            {(100 - delayedRate).toFixed(1)}%
          </p>
          <p className={cn('text-xs mt-1', dark ? 'text-slate-500' : 'text-slate-500')}>Percentual de ativas dentro do prazo.</p>
        </div>
        <div className={subPanelClass}>
          <p className={cn('text-[11px] font-bold uppercase tracking-wider', dark ? 'text-slate-500' : 'text-slate-500')}>Backlog Critico</p>
          <p className={cn('text-2xl font-extrabold mt-1', dark ? 'text-amber-300' : 'text-amber-700')}>
            {active.filter((order) => order.priority === 'Critica' || order.priority === 'Alta').length}
          </p>
          <p className={cn('text-xs mt-1', dark ? 'text-slate-500' : 'text-slate-500')}>OS de alta prioridade em aberto.</p>
        </div>
        <div className={subPanelClass}>
          <p className={cn('text-[11px] font-bold uppercase tracking-wider', dark ? 'text-slate-500' : 'text-slate-500')}>Capacidade Janela</p>
          <p className={cn('text-2xl font-extrabold mt-1', dark ? 'text-cyan-300' : 'text-cyan-700')}>
            {closed.length}/{Math.max(scoped.length, 1)}
          </p>
          <p className={cn('text-xs mt-1', dark ? 'text-slate-500' : 'text-slate-500')}>Fechadas versus criadas no período.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Ocorrencias Ativas" value={active.length} icon={Activity} gradient="bg-gradient-to-br from-blue-500/35 via-blue-400/8 to-transparent" />
        <KpiCard label="Criadas na Janela" value={scoped.length} icon={Plus} gradient="bg-gradient-to-br from-cyan-500/35 via-cyan-400/8 to-transparent" />
        <KpiCard label="Atrasadas Ativas" value={delayedActive} icon={AlertTriangle} gradient="bg-gradient-to-br from-rose-500/35 via-rose-400/8 to-transparent" />
        <KpiCard label="Encerradas Janela" value={closed.length} icon={CheckCircle} gradient="bg-gradient-to-br from-emerald-500/35 via-emerald-400/8 to-transparent" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className={cn('lg:col-span-2 p-6', panelClass)}>
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className={cn('font-bold text-lg flex items-center gap-2', dark ? 'text-slate-100' : 'text-slate-800')}>
                <Activity size={16} className={cn(dark ? 'text-fuchsia-300 drop-shadow-[0_0_8px_rgba(232,121,249,0.75)]' : 'text-fuchsia-600')} />
                Fluxo Diario
              </h3>
              <p className={cn('text-sm', dark ? 'text-slate-400' : 'text-slate-500')}>Volume de entrada vs saida</p>
            </div>
          </div>
          <DualAreaChart data={timeline} />
        </div>

        <div className="space-y-6">
          <div className={cn('p-6', panelClass)}>
            <h3 className={cn('font-bold mb-4 flex items-center', dark ? 'text-slate-100' : 'text-slate-800')}>
              <Shield size={17} className={cn('mr-2', dark ? 'text-indigo-300 drop-shadow-[0_0_8px_rgba(129,140,248,0.65)]' : 'text-indigo-600')} />
              Saúde SLA (Ativas)
            </h3>
            <div className="flex items-center justify-center mb-5">
              <div className="relative w-40 h-40">
                <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                  <circle cx="50" cy="50" r="42" fill="transparent" stroke={dark ? 'rgba(71, 85, 105, 0.6)' : '#e2e8f0'} strokeWidth="8" />
                  <circle
                    cx="50"
                    cy="50"
                    r="42"
                    fill="transparent"
                    stroke="#10b981"
                    strokeWidth="8"
                    strokeDasharray={`264 ${264}`}
                    strokeDashoffset={264 - slaWithinStroke}
                    strokeLinecap="round"
                    className={cn(dark ? 'drop-shadow-[0_0_6px_rgba(16,185,129,0.75)]' : '')}
                  />
                  <circle
                    cx="50"
                    cy="50"
                    r="42"
                    fill="transparent"
                    stroke="#ef4444"
                    strokeWidth="8"
                    strokeDasharray={`264 ${264}`}
                    strokeDashoffset={264 - slaOverdueStroke - slaWithinStroke}
                    strokeLinecap="round"
                    className={cn(dark ? 'drop-shadow-[0_0_6px_rgba(239,68,68,0.75)]' : '')}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <div className={cn('text-3xl font-black', dark ? 'text-slate-100' : 'text-slate-900')}>{active.length}</div>
                  <div className={cn('text-[10px] uppercase tracking-wider font-bold', dark ? 'text-slate-500' : 'text-slate-500')}>Ativas</div>
                  <div className={cn('text-[10px] font-bold mt-0.5', dark ? 'text-emerald-300' : 'text-emerald-700')}>
                    No prazo: {active.length ? ((slaWithin / active.length) * 100).toFixed(1) : '0.0'}%
                  </div>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className={cn('rounded-lg border py-2', dark ? 'bg-[#0d1628]/80 border-emerald-500/30' : 'bg-emerald-50 border-emerald-200')}>
                <div className={cn('text-sm font-bold', dark ? 'text-emerald-300' : 'text-emerald-700')}>{slaWithin}</div>
                <div className={cn('text-[9px] uppercase font-bold', dark ? 'text-emerald-400/80' : 'text-emerald-600')}>No prazo</div>
              </div>
              <div className={cn('rounded-lg border py-2', dark ? 'bg-[#0d1628]/80 border-rose-500/30' : 'bg-rose-50 border-rose-200')}>
                <div className={cn('text-sm font-bold', dark ? 'text-rose-300' : 'text-rose-700')}>{slaOverdue}</div>
                <div className={cn('text-[9px] uppercase font-bold', dark ? 'text-rose-400/80' : 'text-rose-600')}>Atrasadas</div>
              </div>
              <div className={cn('rounded-lg border py-2', dark ? 'bg-[#0d1628]/80 border-slate-600/60' : 'bg-slate-50 border-slate-200')}>
                <div className={cn('text-sm font-bold', dark ? 'text-slate-200' : 'text-slate-700')}>{slaNoDeadline}</div>
                <div className={cn('text-[9px] uppercase font-bold', dark ? 'text-slate-400' : 'text-slate-500')}>Sem prazo</div>
              </div>
            </div>
          </div>

          <div className={cn('p-6', panelClass)}>
            <h3 className={cn('font-bold mb-4 flex items-center', dark ? 'text-slate-100' : 'text-slate-800')}>
              <AlertTriangle size={17} className={cn('mr-2', dark ? 'text-amber-300' : 'text-amber-600')} />
              Qualidade dos Dados
            </h3>
            <div className="space-y-3">
              <div className={cn('flex items-center justify-between pb-3 border-b', dark ? 'border-slate-700/60' : 'border-slate-200')}>
                <span className={cn('text-xs uppercase tracking-wider font-bold', dark ? 'text-slate-500' : 'text-slate-500')}>Sem prazo na janela</span>
                <span className={cn('text-lg font-black', dark ? 'text-amber-300' : 'text-amber-700')}>{dataQualityMissingDeadline}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className={cn('text-xs uppercase tracking-wider font-bold', dark ? 'text-slate-500' : 'text-slate-500')}>Ativas sem tecnico</span>
                <span className={cn('text-lg font-black', dataQualityMissingTech > 0 ? (dark ? 'text-rose-300' : 'text-rose-700') : (dark ? 'text-emerald-300' : 'text-emerald-700'))}>
                  {dataQualityMissingTech}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className={cn('p-6', panelClass)}>
        <h3 className={cn('font-bold mb-4 flex items-center', dark ? 'text-slate-100' : 'text-slate-800')}>
          <PieChart size={18} className={cn('mr-2', dark ? 'text-slate-400' : 'text-slate-500')} /> Por Status
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-3">
          {Object.entries(statusCount).map(([status, count]) => (
            <div key={status} className={cn('p-3 rounded-lg border', dark ? 'bg-[#0d1628]/80 border-slate-700/60' : 'bg-slate-50 border-slate-100')}>
              <span className={cn('text-[10px] font-bold uppercase tracking-wider mb-1 block', dark ? 'text-slate-500' : 'text-slate-400')}>{status}</span>
              <span className={cn('text-xl font-bold', dark ? 'text-slate-100' : 'text-slate-700')}>{count}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className={cn('overflow-hidden', panelClass)}>
          <div className={cn('px-6 py-3 border-b font-bold text-sm', dark ? 'bg-white/[0.02] border-slate-700/60 text-slate-200' : 'bg-slate-50/50 border-slate-200 text-slate-700')}>
            Top Provedores (janela)
          </div>
          <div className="divide-y">
            {topProviders.length === 0 && (
              <div className="px-4 py-8">
                <ErpEmptyState dark={dark} title="Sem provedores na janela." description="Ajuste o filtro de período para visualizar dados." />
              </div>
            )}
            {topProviders.map((providerItem) => (
              <div key={providerItem.name} className={cn('px-6 py-3 flex items-center justify-between', dark ? 'hover:bg-white/[0.02]' : 'hover:bg-slate-50')}>
                <div className="min-w-0">
                  <div className={cn('font-semibold truncate', dark ? 'text-slate-100' : 'text-slate-800')}>{providerItem.name}</div>
                  <div className={cn('text-xs', dark ? 'text-slate-500' : 'text-slate-500')}>{providerItem.city}</div>
                  <div className={cn('h-1.5 mt-2 rounded-full overflow-hidden', dark ? 'bg-slate-800' : 'bg-slate-100')}>
                    <div
                      className="h-full bg-cyan-500/80"
                      style={{ width: `${Math.min(100, (providerItem.active / maxProviderActive) * 100)}%` }}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px] shrink-0 ml-4 text-right">
                  <div>
                    <div className={cn('uppercase tracking-wide', dark ? 'text-slate-500' : 'text-slate-400')}>Ativas</div>
                    <div className={cn('font-bold', dark ? 'text-cyan-300' : 'text-cyan-700')}>{providerItem.active}</div>
                  </div>
                  <div>
                    <div className={cn('uppercase tracking-wide', dark ? 'text-slate-500' : 'text-slate-400')}>Atrasadas</div>
                    <div className={cn('font-bold', providerItem.delayed > 0 ? (dark ? 'text-rose-300' : 'text-rose-700') : (dark ? 'text-emerald-300' : 'text-emerald-700'))}>
                      {providerItem.delayed}
                    </div>
                  </div>
                  <div>
                    <div className={cn('uppercase tracking-wide', dark ? 'text-slate-500' : 'text-slate-400')}>Fechadas</div>
                    <div className={cn('font-bold', dark ? 'text-slate-200' : 'text-slate-700')}>{providerItem.closed}</div>
                  </div>
                  <div>
                    <div className={cn('uppercase tracking-wide', dark ? 'text-slate-500' : 'text-slate-400')}>Hoje</div>
                    <div className={cn('font-bold', dark ? 'text-amber-300' : 'text-amber-700')}>{providerItem.dueToday}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className={cn('overflow-hidden', panelClass)}>
          <div className={cn('px-6 py-3 border-b font-bold text-sm', dark ? 'bg-white/[0.02] border-slate-700/60 text-slate-200' : 'bg-slate-50/50 border-slate-200 text-slate-700')}>
            Top Técnicos (janela)
          </div>
          <div className="divide-y">
            {topTechs.length === 0 && (
              <div className="px-4 py-8">
                <ErpEmptyState dark={dark} title="Sem técnicos na janela." description="Nenhum tecnico teve OS no período filtrado." />
              </div>
            )}
            {topTechs.map((techItem) => (
              <div key={techItem.name} className={cn('px-6 py-3 flex items-center justify-between', dark ? 'hover:bg-white/[0.02]' : 'hover:bg-slate-50')}>
                <div className="min-w-0">
                  <div className={cn('font-semibold truncate', dark ? 'text-slate-100' : 'text-slate-800')}>{techItem.name}</div>
                  <div className={cn('text-xs', dark ? 'text-slate-500' : 'text-slate-500')}>{techItem.specialization}</div>
                  <div className={cn('h-1.5 mt-2 rounded-full overflow-hidden', dark ? 'bg-slate-800' : 'bg-slate-100')}>
                    <div
                      className="h-full bg-blue-500/80"
                      style={{ width: `${Math.min(100, (techItem.created / maxTechCreated) * 100)}%` }}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px] shrink-0 ml-4 text-right">
                  <div>
                    <div className={cn('uppercase tracking-wide', dark ? 'text-slate-500' : 'text-slate-400')}>Criadas</div>
                    <div className={cn('font-bold', dark ? 'text-cyan-300' : 'text-cyan-700')}>{techItem.created}</div>
                  </div>
                  <div>
                    <div className={cn('uppercase tracking-wide', dark ? 'text-slate-500' : 'text-slate-400')}>Ativas</div>
                    <div className={cn('font-bold', dark ? 'text-slate-200' : 'text-slate-700')}>{techItem.active}</div>
                  </div>
                  <div>
                    <div className={cn('uppercase tracking-wide', dark ? 'text-slate-500' : 'text-slate-400')}>Atrasadas</div>
                    <div className={cn('font-bold', techItem.delayed > 0 ? (dark ? 'text-rose-300' : 'text-rose-700') : (dark ? 'text-emerald-300' : 'text-emerald-700'))}>
                      {techItem.delayed}
                    </div>
                  </div>
                  <div>
                    <div className={cn('uppercase tracking-wide', dark ? 'text-slate-500' : 'text-slate-400')}>On-time</div>
                    <div className={cn('font-bold', dark ? 'text-emerald-300' : 'text-emerald-700')}>{techItem.onTimePct}%</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className={cn('overflow-hidden', panelClass)}>
        <div className={cn('px-6 py-3 border-b font-bold text-sm', dark ? 'bg-white/[0.02] border-slate-700/60 text-slate-200' : 'bg-slate-50/50 border-slate-200 text-slate-700')}>
          OS Prioritarias
        </div>
        <ErpDataTable
          dark={dark}
          rows={urgent}
          rowKey={(orderItem) => orderItem.id}
          onRowClick={(orderItem) => onSelectOS(orderItem)}
          emptyTitle="Nenhuma OS ativa na janela atual."
          emptyDescription="A fila critica esta controlada para o período selecionado."
          columns={[
            {
              key: 'protocol',
              header: 'Protocolo',
              render: (orderItem) => <span className={cn('font-mono text-xs font-bold', dark ? 'text-slate-200' : 'text-slate-700')}>{orderItem.protocol}</span>
            },
            {
              key: 'provider',
              header: 'Provedor',
              render: (orderItem) => <span className={cn('text-xs', dark ? 'text-slate-300' : 'text-slate-700')}>{orderItem.provider}</span>
            },
            {
              key: 'type',
              header: 'Tipo',
              render: (orderItem) => <ServiceTypeBadge type={orderItem.type} />
            },
            {
              key: 'status',
              header: 'Status',
              render: (orderItem) => <ErpStatusBadge status={orderItem.status} />
            },
            {
              key: 'deadline',
              header: <span className="w-full inline-block text-right">Prazo</span>,
              className: 'text-right',
              cellClassName: 'text-right',
              render: (orderItem) => (
                <span className={cn('font-mono text-xs', isOverdueActive(orderItem) ? 'text-rose-500 font-bold' : dark ? 'text-slate-400' : 'text-slate-500')}>
                  {orderItem.deadlineAt ? formatDateTime(orderItem.deadlineAt) : 'Sem prazo'}
                </span>
              )
            },
            {
              key: 'action',
              header: <span className="w-full inline-block text-center">Ação</span>,
              className: 'text-center',
              cellClassName: 'text-center',
              render: () => (
                <button className={cn('px-3 py-1 rounded text-[10px] font-bold border transition-colors', dark ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/20' : 'bg-cyan-50 border-cyan-200 text-cyan-700 hover:bg-cyan-100')}>
                  Ver
                </button>
              )
            }
          ]}
        />
      </div>
    </div>
  );
};

const AdminDashboardView = ({ orders, tenants, onSelectOS, loading }) => (
  <AdminDashboardViewModule
    orders={orders}
    tenants={tenants}
    onSelectOS={onSelectOS}
    loading={loading}
    helpers={{
      useTheme,
      toInputDate,
      DAY_MS,
      buildWindow,
      buildAdminAnalytics,
      cn,
      SkeletonKpiCards,
      SkeletonTable,
      formatNumber,
      formatPercent,
      WindowControls,
      DualAreaChart,
      TrendingUp,
      Shield,
      Badge,
      ServiceTypeBadge,
      getDelayHours,
    }}
  />
);

const GlobalOrdersView = ({ orders, onSelectOS, title = 'Ordens Globais', showTenantFilter = false }) => (
  <GlobalOrdersViewModule
    orders={orders}
    onSelectOS={onSelectOS}
    title={title}
    showTenantFilter={showTenantFilter}
    helpers={{
      useTheme,
      toInputDate,
      DAY_MS,
      buildWindow,
      filterOrdersByWindow,
      isActive,
      isClosed,
      STATUSES,
      PRIORITIES,
      getDelayHours,
      isOverdueActive,
      formatDateTime,
      cn,
      WindowControls,
      Search,
      ServiceTypeBadge,
      Badge,
      getPriorityColor,
      getStatusColor,
    }}
  />
);

const TechniciansModule = ({ orders, onSelectOS }) => {
  const { dark } = useTheme();
  const [period, setPeriod] = useState('all');
  const [customRange, setCustomRange] = useState({ start: toInputDate(Date.now() - 7 * DAY_MS), end: toInputDate(Date.now()) });
  const [activeTab, setActiveTab] = useState('performance');
  const [search, setSearch] = useState('');
  const [analystOrdersPage, setAnalystOrdersPage] = useState(null);
  const [analystOrdersSearch, setAnalystOrdersSearch] = useState('');
  const [performanceSort, setPerformanceSort] = useState('created_desc');
  const [riskSort, setRiskSort] = useState({ key: 'delayed', dir: 'desc' });
  const [delaySort, setDelaySort] = useState({ key: 'delayed', dir: 'desc' });

  const openAnalystOrdersPage = (payload) => {
    setAnalystOrdersSearch('');
    setAnalystOrdersPage(payload);
  };

  const now = Date.now();
  const window = useMemo(() => buildWindow(period, customRange), [period, customRange]);
  const scoped = useMemo(() => filterOrdersByWindow(orders, window, 'createdAt'), [orders, window]);
  const techRows = useMemo(() => buildTechnicianAnalytics(scoped, now), [scoped, now]);

  const filteredTechs = useMemo(
    () => techRows.filter((t) => t.name.toLowerCase().includes(search.toLowerCase())),
    [techRows, search]
  );

  const overdueOrders = useMemo(
    () => scoped.filter((o) => isActive(o) && getDelayHours(o) > 0).sort((a, b) => getDelayHours(b) - getDelayHours(a)),
    [scoped]
  );

  const dueTodayOrders = useMemo(
    () => scoped.filter((o) => isDueToday(o, now)).sort((a, b) => (a.deadlineAt || Infinity) - (b.deadlineAt || Infinity)),
    [scoped, now]
  );
  const overdueByAnalyst = useMemo(() => {
    const query = search.trim().toLowerCase();
    const map = new Map();
    overdueOrders.forEach((orderItem) => {
      const analyst = orderItem.tech || 'Sem analista';
      if (!map.has(analyst)) {
        map.set(analyst, { analyst, count: 0, maxDelay: 0, orders: [] });
      }
      const row = map.get(analyst);
      const delay = getDelayHours(orderItem);
      row.count += 1;
      row.maxDelay = Math.max(row.maxDelay, delay);
      row.orders.push(orderItem);
    });
    return Array.from(map.values())
      .filter((row) => !query || row.analyst.toLowerCase().includes(query))
      .sort((a, b) => (b.count - a.count) || a.analyst.localeCompare(b.analyst, 'pt-BR'));
  }, [overdueOrders, search]);

  const dueTodayByAnalyst = useMemo(() => {
    const query = search.trim().toLowerCase();
    const map = new Map();
    dueTodayOrders.forEach((orderItem) => {
      const analyst = orderItem.tech || 'Sem analista';
      if (!map.has(analyst)) {
        map.set(analyst, { analyst, count: 0, nextDeadline: null, orders: [] });
      }
      const row = map.get(analyst);
      row.count += 1;
      row.orders.push(orderItem);
      if (orderItem.deadlineAt && (!row.nextDeadline || orderItem.deadlineAt < row.nextDeadline)) {
        row.nextDeadline = orderItem.deadlineAt;
      }
    });
    return Array.from(map.values())
      .filter((row) => !query || row.analyst.toLowerCase().includes(query))
      .sort((a, b) => (b.count - a.count) || a.analyst.localeCompare(b.analyst, 'pt-BR'));
  }, [dueTodayOrders, search]);

  const techSummaryByName = useMemo(
    () => filteredTechs.reduce((acc, row) => ({ ...acc, [row.name]: row }), {}),
    [filteredTechs]
  );

  const riskRows = useMemo(() => {
    const grouped = activeTab === 'overdue' ? overdueByAnalyst : dueTodayByAnalyst;
    return grouped.map((row) => {
      const summary = techSummaryByName[row.analyst] || {};
      const delayed = Number(summary.delayed ?? (activeTab === 'overdue' ? row.count : 0));
      const dueToday = Number(summary.dueToday ?? (activeTab === 'due_today' ? row.count : 0));
      const active = Number(summary.active ?? row.count);
      const base = active > 0 ? active : 1;
      const rate = activeTab === 'overdue' ? (delayed / base) * 100 : (dueToday / base) * 100;
      return {
        analyst: row.analyst,
        delayed,
        dueToday,
        active,
        rate,
        count: row.count,
      };
    });
  }, [activeTab, overdueByAnalyst, dueTodayByAnalyst, techSummaryByName]);

  const riskOverview = useMemo(() => {
    const analysts = riskRows.length;
    const delayed = riskRows.reduce((acc, row) => acc + row.delayed, 0);
    const dueToday = riskRows.reduce((acc, row) => acc + row.dueToday, 0);
    return { analysts, delayed, dueToday };
  }, [riskRows]);

  const performanceOverview = useMemo(() => {
    const created = filteredTechs.reduce((acc, row) => acc + Number(row.created || 0), 0);
    const active = filteredTechs.reduce((acc, row) => acc + Number(row.active || 0), 0);
    const delayed = filteredTechs.reduce((acc, row) => acc + Number(row.delayed || 0), 0);
    const avgConclusion = filteredTechs.length
      ? filteredTechs.reduce((acc, row) => acc + Number(row.onTimePct || 0), 0) / filteredTechs.length
      : 0;
    return { created, active, delayed, avgConclusion };
  }, [filteredTechs]);

  const delayOverview = useMemo(() => {
    const delayedTechs = filteredTechs.filter((row) => Number(row.delayed || 0) > 0).length;
    const maxDelayed = filteredTechs.reduce((acc, row) => Math.max(acc, Number(row.delayed || 0)), 0);
    const totalDelayed = filteredTechs.reduce((acc, row) => acc + Number(row.delayed || 0), 0);
    return { delayedTechs, maxDelayed, totalDelayed };
  }, [filteredTechs]);

  const performanceRows = useMemo(() => {
    const rows = filteredTechs.map((row) => {
      const completed = Math.max(0, Number(row.created || 0) - Number(row.active || 0));
      const completion = row.created > 0 ? (completed / row.created) * 100 : 0;
      return { ...row, completed, completion };
    });
    const sorter = {
      created_desc: (a, b) => b.created - a.created,
      active_desc: (a, b) => b.active - a.active,
      delayed_desc: (a, b) => b.delayed - a.delayed,
      completion_desc: (a, b) => b.completion - a.completion,
      ontime_desc: (a, b) => b.onTimePct - a.onTimePct,
    }[performanceSort] || ((a, b) => b.created - a.created);
    return [...rows].sort(sorter);
  }, [filteredTechs, performanceSort]);

  const delayRankingRows = useMemo(() => {
    const map = new Map();
    scoped.forEach((orderItem) => {
      const tech = orderItem.tech || 'Sem analista';
      if (!map.has(tech)) {
        map.set(tech, {
          name: tech,
          osPeriod: 0,
          delayed: 0,
          activeDelay: 0,
          completedDelay: 0,
          totalDelayHours: 0,
        });
      }
      const row = map.get(tech);
      row.osPeriod += 1;
      const delay = Math.max(0, getDelayHours(orderItem));
      if (delay > 0) {
        row.delayed += 1;
        row.totalDelayHours += delay;
        if (isActive(orderItem)) row.activeDelay += 1;
        if (isClosed(orderItem)) row.completedDelay += 1;
      }
    });
    return Array.from(map.values())
      .filter((row) => row.name.toLowerCase().includes(search.toLowerCase()))
      .map((row) => ({
        ...row,
        avgDelayHours: row.delayed > 0 ? row.totalDelayHours / row.delayed : 0,
      }));
  }, [scoped, search]);

  useEffect(() => {
    if (activeTab === 'due_today') {
      setRiskSort({ key: 'dueToday', dir: 'desc' });
      return;
    }
    if (activeTab === 'overdue') {
      setRiskSort({ key: 'delayed', dir: 'desc' });
    }
  }, [activeTab]);

  const toggleSort = (setter, key) => {
    setter((prev) => (prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'desc' }));
  };

  const sortIcon = (state, key) => (state.key === key ? (state.dir === 'asc' ? '↑' : '↓') : '');

  const riskRowsSorted = useMemo(() => {
    const factor = riskSort.dir === 'asc' ? 1 : -1;
    const list = [...riskRows];
    list.sort((a, b) => {
      if (riskSort.key === 'analyst') return a.analyst.localeCompare(b.analyst, 'pt-BR') * factor;
      if (riskSort.key === 'rate') return (a.rate - b.rate) * factor;
      return ((Number(a[riskSort.key] || 0) - Number(b[riskSort.key] || 0))) * factor;
    });
    return list;
  }, [riskRows, riskSort]);

  const delayRankingRowsSorted = useMemo(() => {
    const factor = delaySort.dir === 'asc' ? 1 : -1;
    const list = [...delayRankingRows];
    list.sort((a, b) => {
      if (delaySort.key === 'name') return a.name.localeCompare(b.name, 'pt-BR') * factor;
      if (delaySort.key === 'avgDelayHours') return (a.avgDelayHours - b.avgDelayHours) * factor;
      return ((Number(a[delaySort.key] || 0) - Number(b[delaySort.key] || 0))) * factor;
    });
    return list;
  }, [delayRankingRows, delaySort]);

  const analystOrdersPageRows = useMemo(() => {
    if (!analystOrdersPage?.name) return [];
    const source = analystOrdersPage.mode === 'due_today' ? dueTodayOrders : overdueOrders;
    const query = analystOrdersSearch.trim().toLowerCase();
    return source
      .filter((o) => (o.tech || 'Sem analista') === analystOrdersPage.name)
      .filter((o) => {
        if (!query) return true;
        return [
          String(o.protocol || ''),
          String(o.provider || ''),
          String(o.type || ''),
          String(o.status || ''),
          String(o.sector || ''),
          String(o.origin || ''),
          String(o.contract || ''),
        ].some((field) => field.toLowerCase().includes(query));
      })
      .sort((a, b) => {
        if (analystOrdersPage.mode === 'due_today') return (a.deadlineAt || Infinity) - (b.deadlineAt || Infinity);
        return getDelayHours(b) - getDelayHours(a);
      });
  }, [analystOrdersPage, analystOrdersSearch, dueTodayOrders, overdueOrders]);

  const techPanelClass = cn(
    'rounded-2xl border overflow-hidden flex flex-col h-[calc(100vh-260px)] md:h-[calc(100vh-220px)]',
    dark ? 'bg-[#111b2e]/75 border-slate-700/60 shadow-[0_12px_32px_rgba(2,6,23,0.35)]' : 'bg-white border-slate-200 shadow-sm'
  );
  const moduleSpacingClass = 'space-y-4 p-5';
  const statsGridClass = 'grid grid-cols-2 lg:grid-cols-4 gap-3';
  const metricCardClass = cn('rounded-xl border p-3', dark ? 'bg-[#0f172a]/70 border-slate-700/60' : 'bg-slate-50 border-slate-200');
  const metricLabelClass = cn('text-[10px] uppercase font-bold tracking-wider', dark ? 'text-slate-500' : 'text-slate-500');
  const sectionCardClass = cn('rounded-xl border overflow-hidden', dark ? 'bg-[#0f172a]/75 border-slate-700/60' : 'bg-white border-slate-200');
  const sectionHeaderClass = cn('px-5 py-3 border-b text-sm font-semibold tracking-wide flex items-center justify-between gap-2', dark ? 'border-slate-700/60 text-slate-200' : 'border-slate-200 text-slate-700');
  const tableHeadClass = cn(dark ? 'bg-[#0d1628]/85 text-slate-400' : 'bg-slate-50 text-slate-500', 'text-[11px] uppercase tracking-wide font-semibold');
  const tableBodyClass = cn('divide-y', dark ? 'divide-slate-700/50' : 'divide-slate-100');
  const tableRowClass = cn(dark ? 'hover:bg-white/[0.03]' : 'hover:bg-slate-50');
  const riskSectionClass = cn(
    sectionCardClass,
    activeTab === 'overdue'
      ? (dark ? 'border-rose-500/30' : 'border-rose-200')
      : activeTab === 'due_today'
        ? (dark ? 'border-amber-500/30' : 'border-amber-200')
        : ''
  );
  const tabToneClass = {
    performance: {
      active: dark ? 'bg-cyan-500/18 border-cyan-400/50 text-cyan-200 shadow-sm' : 'bg-cyan-50 border-cyan-300 text-cyan-700 shadow-sm',
      idle: dark ? 'bg-cyan-500/[0.06] border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/[0.12]' : 'bg-cyan-50/60 border-cyan-200 text-cyan-700 hover:bg-cyan-100/70',
    },
    overdue: {
      active: dark ? 'bg-rose-500/18 border-rose-400/50 text-rose-200 shadow-sm' : 'bg-rose-50 border-rose-300 text-rose-700 shadow-sm',
      idle: dark ? 'bg-rose-500/[0.06] border-rose-500/30 text-rose-300 hover:bg-rose-500/[0.12]' : 'bg-rose-50/60 border-rose-200 text-rose-700 hover:bg-rose-100/70',
    },
    due_today: {
      active: dark ? 'bg-amber-500/18 border-amber-400/50 text-amber-200 shadow-sm' : 'bg-amber-50 border-amber-300 text-amber-700 shadow-sm',
      idle: dark ? 'bg-amber-500/[0.06] border-amber-500/30 text-amber-300 hover:bg-amber-500/[0.12]' : 'bg-amber-50/60 border-amber-200 text-amber-700 hover:bg-amber-100/70',
    },
    delay_ranking: {
      active: dark ? 'bg-violet-500/18 border-violet-400/50 text-violet-200 shadow-sm' : 'bg-violet-50 border-violet-300 text-violet-700 shadow-sm',
      idle: dark ? 'bg-violet-500/[0.06] border-violet-500/30 text-violet-300 hover:bg-violet-500/[0.12]' : 'bg-violet-50/60 border-violet-200 text-violet-700 hover:bg-violet-100/70',
    },
  };

  const renderContent = () => {
    if (activeTab === 'performance') {
      return (
        <div className={moduleSpacingClass}>
          <div className="flex items-center gap-3">
            <span className={cn('text-sm', dark ? 'text-slate-400' : 'text-slate-500')}>Rankear por:</span>
            <select
              value={performanceSort}
              onChange={(e) => setPerformanceSort(e.target.value)}
              className={cn('px-3 py-1.5 border rounded-lg text-sm',
                dark ? 'bg-[#0d1628]/80 border-slate-700/60 text-slate-200' : 'bg-white border-slate-300 text-slate-700')}
            >
              <option value="created_desc">Volume (Criadas no periodo)</option>
              <option value="active_desc">Mais ativas</option>
              <option value="delayed_desc">Mais atrasadas</option>
              <option value="completion_desc">Conclusao %</option>
              <option value="ontime_desc">No prazo %</option>
            </select>
          </div>

          <div className={statsGridClass}>
            <div className={metricCardClass}>
              <div className={metricLabelClass}>OS criadas</div>
              <div className={cn('text-xl font-bold mt-1', dark ? 'text-cyan-300' : 'text-cyan-700')}>{formatNumber(performanceOverview.created)}</div>
            </div>
            <div className={metricCardClass}>
              <div className={metricLabelClass}>OS ativas</div>
              <div className={cn('text-xl font-bold mt-1', dark ? 'text-indigo-300' : 'text-indigo-700')}>{formatNumber(performanceOverview.active)}</div>
            </div>
            <div className={metricCardClass}>
              <div className={metricLabelClass}>Atrasadas</div>
              <div className={cn('text-xl font-bold mt-1', dark ? 'text-rose-300' : 'text-rose-700')}>{formatNumber(performanceOverview.delayed)}</div>
            </div>
            <div className={metricCardClass}>
              <div className={metricLabelClass}>Conclusão média</div>
              <div className={cn('text-xl font-bold mt-1', dark ? 'text-emerald-300' : 'text-emerald-700')}>{performanceOverview.avgConclusion.toFixed(1)}%</div>
            </div>
          </div>

          <div className={sectionCardClass}>
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-sm text-left">
                <thead className={tableHeadClass}>
                  <tr>
                    <th className="px-6 py-3 text-right">#</th>
                    <th className="px-6 py-3">Técnico</th>
                    <th className="px-6 py-3 text-right">Criadas</th>
                    <th className="px-6 py-3 text-right">Ativas</th>
                    <th className="px-6 py-3 text-right">Concluídas</th>
                    <th className="px-6 py-3 text-center">Conclusão %</th>
                    <th className="px-6 py-3 text-right">Atrasadas</th>
                    <th className="px-6 py-3 text-right">No prazo %</th>
                    <th className="px-6 py-3 text-right">TMA</th>
                    <th className="px-6 py-3 text-center">Ação</th>
                  </tr>
                </thead>
                <tbody className={tableBodyClass}>
                  {performanceRows.map((t, index) => {
                    const conclusion = Math.min(100, Math.max(0, Number(t.completion || 0)));
                    return (
                      <tr
                        key={t.name}
                        className={cn(
                          tableRowClass,
                          Number(t.delayed || 0) > 0 && (dark ? 'bg-rose-500/[0.03]' : 'bg-rose-50/40')
                        )}
                      >
                        <td className={cn('px-6 py-3 text-right font-mono', dark ? 'text-slate-500' : 'text-slate-500')}>{index + 1}</td>
                        <td className="px-6 py-3">
                          <div className={cn('font-bold', dark ? 'text-slate-100' : 'text-slate-800')}>{t.name}</div>
                          <div className={cn('text-xs', dark ? 'text-slate-500' : 'text-slate-500')}>{t.specialization}</div>
                        </td>
                        <td className={cn('px-6 py-3 text-right font-mono', dark ? 'text-slate-300' : '')}>{t.created}</td>
                        <td className={cn('px-6 py-3 text-right font-mono', dark ? 'text-indigo-300' : '')}>{t.active}</td>
                        <td className={cn('px-6 py-3 text-right font-mono', dark ? 'text-emerald-300' : 'text-emerald-600')}>{t.completed}</td>
                        <td className="px-6 py-3">
                          <div className="flex flex-col items-center gap-1">
                            <span className={cn('font-mono font-bold', dark ? 'text-emerald-300' : 'text-emerald-600')}>{conclusion.toFixed(1)}%</span>
                            <div className={cn('h-1.5 w-24 rounded-full overflow-hidden', dark ? 'bg-slate-700/70' : 'bg-slate-200')}>
                              <div className="h-full rounded-full bg-emerald-400" style={{ width: `${conclusion}%` }} />
                            </div>
                          </div>
                        </td>
                        <td className={cn('px-6 py-3 text-right font-mono font-bold', t.delayed > 0 ? (dark ? 'text-rose-300' : 'text-rose-600') : dark ? 'text-slate-500' : 'text-slate-300')}>{t.delayed}</td>
                        <td className={cn('px-6 py-3 text-right font-mono font-bold', dark ? 'text-amber-300' : 'text-amber-700')}>{t.onTimePct}%</td>
                        <td className={cn('px-6 py-3 text-right font-mono', dark ? 'text-slate-400' : 'text-slate-600')}>{t.avgDuration}</td>
                        <td className="px-6 py-3 text-center">
                          <button
                            onClick={() => openAnalystOrdersPage({ name: t.name, mode: 'overdue' })}
                            className={cn('px-3 py-1 border rounded text-[10px] font-bold',
                              dark ? 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30 hover:bg-cyan-500/20' : 'bg-cyan-50 text-cyan-700 border-cyan-200 hover:bg-cyan-100')}
                          >
                            Ver O.S
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      );
    }

    if (activeTab === 'delay_ranking') {
      return (
        <div className={moduleSpacingClass}>
          <div className={statsGridClass}>
            <div className={metricCardClass}>
              <div className={metricLabelClass}>Analistas com atraso</div>
              <div className={cn('text-xl font-bold mt-1', dark ? 'text-rose-300' : 'text-rose-700')}>{formatNumber(delayOverview.delayedTechs)}</div>
            </div>
            <div className={metricCardClass}>
              <div className={metricLabelClass}>Total de atrasos</div>
              <div className={cn('text-xl font-bold mt-1', dark ? 'text-rose-300' : 'text-rose-700')}>{formatNumber(delayOverview.totalDelayed)}</div>
            </div>
            <div className={metricCardClass}>
              <div className={metricLabelClass}>Maior atraso (qtd)</div>
              <div className={cn('text-xl font-bold mt-1', dark ? 'text-amber-300' : 'text-amber-700')}>{formatNumber(delayOverview.maxDelayed)}</div>
            </div>
          </div>

          <div className={sectionCardClass}>
            <div className={sectionHeaderClass}>
              <span>Quem Mais Atrasou (Período)</span>
              <span className={cn('text-xs font-medium', dark ? 'text-slate-400' : 'text-slate-500')}>
                {formatNumber(delayRankingRowsSorted.length)} analistas
              </span>
            </div>
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-sm text-left">
                <thead className={tableHeadClass}>
                  <tr>
                    <th className="px-6 py-3"><button className="hover:underline" onClick={() => toggleSort(setDelaySort, 'name')}>Técnico {sortIcon(delaySort, 'name')}</button></th>
                    <th className="px-6 py-3 text-center"><button className="hover:underline" onClick={() => toggleSort(setDelaySort, 'osPeriod')}>OS no período {sortIcon(delaySort, 'osPeriod')}</button></th>
                    <th className="px-6 py-3 text-right"><button className="hover:underline" onClick={() => toggleSort(setDelaySort, 'delayed')}>Atrasos {sortIcon(delaySort, 'delayed')}</button></th>
                    <th className="px-6 py-3 text-center"><button className="hover:underline" onClick={() => toggleSort(setDelaySort, 'activeDelay')}>Atraso (ativas) {sortIcon(delaySort, 'activeDelay')}</button></th>
                    <th className="px-6 py-3 text-center"><button className="hover:underline" onClick={() => toggleSort(setDelaySort, 'completedDelay')}>Atraso (concluídas) {sortIcon(delaySort, 'completedDelay')}</button></th>
                    <th className="px-6 py-3 text-right"><button className="hover:underline" onClick={() => toggleSort(setDelaySort, 'totalDelayHours')}>Horas (total) {sortIcon(delaySort, 'totalDelayHours')}</button></th>
                    <th className="px-6 py-3 text-right"><button className="hover:underline" onClick={() => toggleSort(setDelaySort, 'avgDelayHours')}>Horas (média) {sortIcon(delaySort, 'avgDelayHours')}</button></th>
                    <th className="px-6 py-3 text-center">Ação</th>
                  </tr>
                </thead>
                <tbody className={tableBodyClass}>
                  {delayRankingRowsSorted
                    .map((t) => (
                      <tr key={t.name} className={cn(tableRowClass, t.delayed > 0 && (dark ? 'bg-rose-500/[0.03]' : 'bg-rose-50/40'))}>
                        <td className={cn('px-6 py-3 font-bold', dark ? 'text-slate-100' : 'text-slate-800')}>{t.name}</td>
                        <td className={cn('px-6 py-3 text-center font-mono', dark ? 'text-slate-300' : 'text-slate-700')}>{t.osPeriod}</td>
                        <td className={cn('px-6 py-3 text-right font-mono font-bold', dark ? 'text-rose-300' : 'text-rose-600')}>{t.delayed}</td>
                        <td className={cn('px-6 py-3 text-center font-mono font-bold', dark ? 'text-amber-300' : 'text-amber-700')}>{t.activeDelay}</td>
                        <td className={cn('px-6 py-3 text-center font-mono font-bold', dark ? 'text-rose-300' : 'text-rose-600')}>{t.completedDelay}</td>
                        <td className={cn('px-6 py-3 text-right font-mono', dark ? 'text-slate-300' : 'text-slate-700')}>{t.totalDelayHours.toFixed(2)}</td>
                        <td className={cn('px-6 py-3 text-right font-mono', dark ? 'text-slate-300' : 'text-slate-700')}>{t.avgDelayHours.toFixed(2)}</td>
                        <td className="px-6 py-3 text-center">
                          <button onClick={() => openAnalystOrdersPage({ name: t.name, mode: 'overdue' })} className={cn('px-3 py-1 border rounded text-xs font-bold',
                            dark ? 'bg-rose-500/10 text-rose-300 border-rose-500/30 hover:bg-rose-500/20' : 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100')}>
                            Ver Atrasos
                          </button>
                        </td>
                      </tr>
                    ))}
                  {delayRankingRowsSorted.length === 0 && (
                    <tr>
                      <td colSpan={8} className={cn('px-6 py-10 text-center', dark ? 'text-slate-500' : 'text-slate-400')}>
                        Nenhum dado de atraso para o período selecionado.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className={moduleSpacingClass}>
        <div className={statsGridClass}>
          <div className={metricCardClass}>
            <div className={metricLabelClass}>Analistas em risco</div>
            <div className={cn('text-xl font-bold mt-1', dark ? 'text-slate-100' : 'text-slate-800')}>{formatNumber(riskOverview.analysts)}</div>
          </div>
          <div className={metricCardClass}>
            <div className={metricLabelClass}>Total atrasadas</div>
            <div className={cn('text-xl font-bold mt-1', dark ? 'text-rose-300' : 'text-rose-700')}>{formatNumber(riskOverview.delayed)}</div>
          </div>
          <div className={metricCardClass}>
            <div className={metricLabelClass}>Vencem hoje</div>
            <div className={cn('text-xl font-bold mt-1', dark ? 'text-amber-300' : 'text-amber-700')}>{formatNumber(riskOverview.dueToday)}</div>
          </div>
        </div>

        <div className={riskSectionClass}>
          <div className={cn(sectionHeaderClass, 'flex-wrap')}>
            <span>Ranking de Risco (Analistas)</span>
            <div className="flex items-center gap-3">
              <span className={cn('text-xs font-medium', dark ? 'text-slate-400' : 'text-slate-500')}>
                {formatNumber(riskRowsSorted.length)} analistas
              </span>
              <span className={cn('text-[11px]', dark ? 'text-slate-500' : 'text-slate-500')}>
                Clique no analista para ver as O.S
              </span>
            </div>
          </div>
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-sm text-left">
              <thead className={tableHeadClass}>
                <tr>
                  <th className="px-5 py-3"><button className="hover:underline" onClick={() => toggleSort(setRiskSort, 'analyst')}>Analista {sortIcon(riskSort, 'analyst')}</button></th>
                  <th className="px-5 py-3 text-center"><button className="hover:underline" onClick={() => toggleSort(setRiskSort, 'delayed')}>Atrasadas {sortIcon(riskSort, 'delayed')}</button></th>
                  <th className="px-5 py-3 text-center"><button className="hover:underline" onClick={() => toggleSort(setRiskSort, 'dueToday')}>Vencem Hoje {sortIcon(riskSort, 'dueToday')}</button></th>
                  <th className="px-5 py-3 text-center"><button className="hover:underline" onClick={() => toggleSort(setRiskSort, 'active')}>Ativas {sortIcon(riskSort, 'active')}</button></th>
                  <th className="px-5 py-3 text-center"><button className="hover:underline" onClick={() => toggleSort(setRiskSort, 'rate')}>Taxa {sortIcon(riskSort, 'rate')}</button></th>
                  <th className="px-5 py-3 text-center">Ação</th>
                </tr>
              </thead>
              <tbody className={cn('divide-y', dark ? 'divide-slate-700/50' : 'divide-slate-100')}>
                {riskRowsSorted.map((row) => (
                  <tr
                    key={row.analyst}
                    className={cn(tableRowClass, 'cursor-pointer')}
                    onClick={() => openAnalystOrdersPage({ name: row.analyst, mode: activeTab === 'due_today' ? 'due_today' : 'overdue' })}
                  >
                    <td className={cn('px-5 py-3 font-bold', dark ? 'text-slate-100' : 'text-slate-800')}>{row.analyst}</td>
                    <td className={cn('px-5 py-3 text-center font-mono font-bold', row.delayed > 0 ? (dark ? 'text-rose-300' : 'text-rose-600') : dark ? 'text-slate-500' : 'text-slate-300')}>{row.delayed}</td>
                    <td className={cn('px-5 py-3 text-center font-mono font-bold', row.dueToday > 0 ? (dark ? 'text-amber-300' : 'text-amber-700') : dark ? 'text-slate-500' : 'text-slate-300')}>{row.dueToday}</td>
                    <td className={cn('px-5 py-3 text-center font-mono', dark ? 'text-slate-300' : 'text-slate-600')}>{row.active}</td>
                    <td className={cn('px-5 py-3 text-center font-mono', dark ? 'text-slate-300' : 'text-slate-700')}>
                      {row.rate.toFixed(1)}%
                    </td>
                    <td className="px-5 py-3 text-center">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openAnalystOrdersPage({ name: row.analyst, mode: activeTab === 'due_today' ? 'due_today' : 'overdue' });
                        }}
                        className={cn(
                          'px-3 py-1 border rounded text-[10px] font-bold',
                          dark ? 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30 hover:bg-cyan-500/20' : 'bg-cyan-50 text-cyan-700 border-cyan-200 hover:bg-cyan-100'
                        )}
                      >
                        Ver O.S
                      </button>
                    </td>
                  </tr>
                ))}
                {riskRowsSorted.length === 0 && (
                  <tr>
                    <td colSpan={6} className={cn('px-5 py-10 text-center', dark ? 'text-slate-500' : 'text-slate-400')}>
                      Nenhum analista com dados nesta aba.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    );
  };

  if (analystOrdersPage) {
    return (
      <div className="space-y-6 animate-in fade-in duration-500">
        <div className="flex flex-col md:flex-row justify-between items-start gap-4">
          <div>
            <h2 className={cn('text-2xl font-bold tracking-tight', dark ? 'text-slate-100' : 'text-slate-900')}>Análise de Técnicos</h2>
            <p className={cn('text-sm', dark ? 'text-slate-400' : 'text-slate-500')}>Visão detalhada por analista.</p>
          </div>
          <WindowControls period={period} setPeriod={setPeriod} customRange={customRange} setCustomRange={setCustomRange} />
        </div>

        <div className={cn('rounded-2xl border overflow-hidden flex flex-col h-[calc(100vh-260px)] md:h-[calc(100vh-220px)]',
          dark ? 'bg-[#111b2e]/75 border-slate-700/60 shadow-[0_12px_32px_rgba(2,6,23,0.35)]' : 'bg-white border-slate-200 shadow-sm')}>
          <div className={cn('px-4 md:px-6 py-4 border-b flex flex-col md:flex-row md:items-center justify-between gap-3',
            dark ? 'border-slate-700/60 bg-[#0d1628]/80' : 'border-slate-200 bg-white')}>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setAnalystOrdersPage(null)}
                className={cn('px-2 py-1 border rounded text-xs font-bold flex items-center gap-1',
                  dark ? 'border-slate-700/60 text-slate-300 hover:bg-white/5' : 'border-slate-300 text-slate-700 hover:bg-slate-50')}
              >
                <ChevronLeft size={14} />
                Voltar
              </button>
              <div>
                <div className={cn('text-sm font-bold', dark ? 'text-slate-100' : 'text-slate-800')}>
                  {analystOrdersPage.mode === 'due_today' ? 'O.S que vencem hoje' : 'O.S atrasadas'} - {analystOrdersPage.name}
                </div>
                <div className={cn('text-xs', dark ? 'text-slate-400' : 'text-slate-500')}>
                  {analystOrdersPageRows.length} O.S
                </div>
              </div>
            </div>
            <div className="relative w-full md:w-auto">
              <input
                type="text"
                placeholder="Buscar protocolo, provedor, tipo..."
                value={analystOrdersSearch}
                onChange={(e) => setAnalystOrdersSearch(e.target.value)}
                className={cn(
                  'pl-9 pr-4 py-1.5 border rounded-lg text-sm focus:ring-2 focus:ring-cyan-500 w-full md:w-80',
                  dark ? 'bg-[#0d1628]/80 border-slate-700/60 text-slate-200 placeholder:text-slate-500' : 'border-slate-300'
                )}
              />
              <Search className={cn('absolute left-3 top-1/2 -translate-y-1/2', dark ? 'text-slate-500' : 'text-slate-400')} size={14} />
            </div>
          </div>

          <div className={cn('flex-1 overflow-auto custom-scrollbar', dark ? 'bg-[#0d1628]/60' : 'bg-slate-50/30')}>
            <div className="p-5">
              <div className={cn('rounded-xl border overflow-hidden', dark ? 'bg-[#0f172a]/75 border-slate-700/60' : 'bg-white border-slate-200')}>
                <div className="overflow-x-auto custom-scrollbar">
                  <table className="w-full text-sm text-left">
                    <thead className={tableHeadClass}>
                      <tr>
                        <th className="px-5 py-3">Protocolo</th>
                        <th className="px-5 py-3">Status</th>
                        <th className="px-5 py-3">Prioridade</th>
                        <th className="px-5 py-3">Provedor</th>
                        <th className="px-5 py-3">Ocorrência</th>
                        <th className="px-5 py-3">Setor</th>
                        <th className="px-5 py-3">Origem</th>
                        <th className="px-5 py-3">Tipo</th>
                        <th className="px-5 py-3 text-right">Abertura</th>
                        <th className="px-5 py-3 text-right">{analystOrdersPage.mode === 'due_today' ? 'Vencimento' : 'Delay (h)'}</th>
                        <th className="px-5 py-3 text-center">Ação</th>
                      </tr>
                    </thead>
                    <tbody className={tableBodyClass}>
                      {analystOrdersPageRows.map((o) => (
                        <tr key={o.id} className={cn(tableRowClass, 'cursor-pointer')} onClick={() => onSelectOS(o)}>
                          <td className={cn('px-5 py-3 font-mono', dark ? 'text-slate-200' : 'text-slate-700')}>{o.protocol}</td>
                          <td className="px-5 py-3">
                            <Badge color={getStatusColor(o.status)}>{o.status}</Badge>
                          </td>
                          <td className="px-5 py-3">
                            <Badge color={getPriorityColor(o.priority)}>{o.priority}</Badge>
                          </td>
                          <td className={cn('px-5 py-3', dark ? 'text-slate-300' : 'text-slate-700')}>{o.provider}</td>
                          <td className={cn('px-5 py-3 font-mono text-xs', dark ? 'text-slate-400' : 'text-slate-600')}>{o.contract || '-'}</td>
                          <td className={cn('px-5 py-3', dark ? 'text-slate-300' : 'text-slate-700')}>{o.sector || '-'}</td>
                          <td className={cn('px-5 py-3', dark ? 'text-slate-400' : 'text-slate-600')}>{o.origin || '-'}</td>
                          <td className="px-5 py-3"><ServiceTypeBadge type={o.type} /></td>
                          <td className={cn('px-5 py-3 text-right font-mono text-xs', dark ? 'text-slate-400' : 'text-slate-600')}>
                            {formatDateTime(o.createdAt)}
                          </td>
                          <td className={cn('px-5 py-3 text-right font-mono text-xs',
                            analystOrdersPage.mode === 'due_today'
                              ? (dark ? 'text-amber-300 font-bold' : 'text-amber-700 font-bold')
                              : (dark ? 'text-rose-300 font-bold' : 'text-rose-600 font-bold'))}>
                            {analystOrdersPage.mode === 'due_today'
                              ? (o.deadlineAt ? formatDateTime(o.deadlineAt) : 'Sem prazo')
                              : getDelayHours(o).toFixed(2)}
                          </td>
                          <td className="px-5 py-3 text-center">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onSelectOS(o);
                              }}
                              className={cn('px-3 py-1 border rounded text-[10px] font-bold',
                                dark ? 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30 hover:bg-cyan-500/20' : 'bg-cyan-50 text-cyan-700 border-cyan-200 hover:bg-cyan-100')}
                            >
                              Ver O.S
                            </button>
                          </td>
                        </tr>
                      ))}
                      {analystOrdersPageRows.length === 0 && (
                        <tr>
                          <td colSpan={11} className={cn('px-5 py-10 text-center', dark ? 'text-slate-500' : 'text-slate-400')}>
                            Nenhuma O.S encontrada para este analista.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start gap-4">
        <div>
          <h2 className={cn('text-2xl font-bold tracking-tight', dark ? 'text-slate-100' : 'text-slate-900')}>Análise de Técnicos</h2>
          <p className={cn('text-sm', dark ? 'text-slate-400' : 'text-slate-500')}>Performance individual e controle de SLA.</p>
        </div>
        <WindowControls period={period} setPeriod={setPeriod} customRange={customRange} setCustomRange={setCustomRange} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 px-1">
        <div className={cn('rounded-xl border p-3 md:p-4', dark ? 'bg-[#111b2e]/75 border-slate-700/60' : 'bg-white border-slate-200')}>
          <div className={cn('text-[10px] uppercase font-bold tracking-wider', dark ? 'text-slate-500' : 'text-slate-400')}>Técnicos Ativos</div>
          <div className={cn('text-2xl font-bold mt-1', dark ? 'text-slate-100' : 'text-slate-800')}>{formatNumber(filteredTechs.length)}</div>
        </div>
        <div className={cn('rounded-xl border p-3 md:p-4', dark ? 'bg-[#111b2e]/75 border-slate-700/60' : 'bg-white border-slate-200')}>
          <div className={cn('text-[10px] uppercase font-bold tracking-wider', dark ? 'text-slate-500' : 'text-slate-400')}>OS Atrasadas</div>
          <div className={cn('text-2xl font-bold mt-1', dark ? 'text-rose-300' : 'text-rose-700')}>{formatNumber(overdueOrders.length)}</div>
        </div>
        <div className={cn('rounded-xl border p-3 md:p-4', dark ? 'bg-[#111b2e]/75 border-slate-700/60' : 'bg-white border-slate-200')}>
          <div className={cn('text-[10px] uppercase font-bold tracking-wider', dark ? 'text-slate-500' : 'text-slate-400')}>Vencem Hoje</div>
          <div className={cn('text-2xl font-bold mt-1', dark ? 'text-amber-300' : 'text-amber-700')}>{formatNumber(dueTodayOrders.length)}</div>
        </div>
        <div className={cn('rounded-xl border p-3 md:p-4', dark ? 'bg-[#111b2e]/75 border-slate-700/60' : 'bg-white border-slate-200')}>
          <div className={cn('text-[10px] uppercase font-bold tracking-wider', dark ? 'text-slate-500' : 'text-slate-400')}>OS na Janela</div>
          <div className={cn('text-2xl font-bold mt-1', dark ? 'text-cyan-300' : 'text-cyan-700')}>{formatNumber(scoped.length)}</div>
        </div>
      </div>

      <div className={techPanelClass}>
        <div className={cn('px-4 md:px-6 py-4 border-b flex flex-col md:flex-row justify-between items-center gap-4', dark ? 'border-slate-700/60 bg-[#0d1628]/80' : 'border-slate-200 bg-white')}>
          <div className="flex gap-2 flex-wrap">
            {[
              { id: 'performance', label: 'Performance' },
              { id: 'overdue', label: 'OS Atrasadas' },
              { id: 'due_today', label: 'Vencem Hoje' },
              { id: 'delay_ranking', label: 'Quem Mais Atrasou' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'px-4 py-1.5 rounded-full text-xs font-bold border transition-all whitespace-nowrap',
                  activeTab === tab.id
                    ? tabToneClass[tab.id].active
                    : tabToneClass[tab.id].idle
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-auto">
            <input
              type="text"
              placeholder="Buscar analista..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={cn('pl-9 pr-4 py-1.5 border rounded-lg text-sm focus:ring-2 focus:ring-cyan-500 w-full sm:w-64',
                dark ? 'bg-[#0d1628]/80 border-slate-700/60 text-slate-200 placeholder:text-slate-500' : 'border-slate-300')}
            />
            <Search className={cn('absolute left-3 top-1/2 -translate-y-1/2', dark ? 'text-slate-500' : 'text-slate-400')} size={14} />
          </div>
        </div>

        <div className={cn('flex-1 overflow-auto custom-scrollbar', dark ? 'bg-[#0d1628]/60' : 'bg-slate-50/30')}>{renderContent()}</div>
      </div>

    </div>
  );
};

const ProvidersAnalysisView = ({ orders, onSelectOS }) => {
  const { dark } = useTheme();
  const [period, setPeriod] = useState('all');
  const [customRange, setCustomRange] = useState({ start: toInputDate(Date.now() - 7 * DAY_MS), end: toInputDate(Date.now()) });
  const [activeTab, setActiveTab] = useState('ranking');
  const [search, setSearch] = useState('');
  const [cityFilter, setCityFilter] = useState('Todas');
  const [onlyDelayed, setOnlyDelayed] = useState(false);
  const [minVolume, setMinVolume] = useState('0');
  const [rankingSort, setRankingSort] = useState({ key: 'total', dir: 'desc' });
  const [frequencySort, setFrequencySort] = useState({ key: 'total', dir: 'desc' });
  const [matrixSort, setMatrixSort] = useState({ key: 'total', dir: 'desc' });
  const [selectedProvider, setSelectedProvider] = useState(null);

  const now = Date.now();
  const window = useMemo(() => buildWindow(period, customRange), [period, customRange]);
  const scoped = useMemo(() => filterOrdersByWindow(orders, window, 'createdAt'), [orders, window]);
  const providers = useMemo(() => buildProvidersAnalytics(scoped, now), [scoped, now]);
  const totalDays = useMemo(() => {
    if (!scoped.length) return 1;
    const minCreated = Math.min(...scoped.map((o) => o.createdAt || now));
    const maxCreated = Math.max(...scoped.map((o) => o.createdAt || now));
    return Math.max(1, Math.floor((endOfDay(maxCreated) - startOfDay(minCreated)) / DAY_MS) + 1);
  }, [scoped, now]);

  const cityOptions = useMemo(() => ['Todas', ...Array.from(new Set(providers.map((p) => p.city || '-')))], [providers]);
  const filteredProviders = useMemo(() => {
    const min = Number(minVolume || 0);
    const q = search.toLowerCase();
    return providers.filter((p) => {
      const bySearch = !q || p.name.toLowerCase().includes(q) || p.slug.includes(q);
      const byCity = cityFilter === 'Todas' ? true : p.city === cityFilter;
      const byDelayed = onlyDelayed ? p.delayed > 0 : true;
      const byVolume = p.total >= (Number.isFinite(min) ? min : 0);
      return bySearch && byCity && byDelayed && byVolume;
    });
  }, [providers, search, cityFilter, onlyDelayed, minVolume]);
  const sortRows = (rows, sortState) => {
    const factor = sortState.dir === 'asc' ? 1 : -1;
    const list = [...rows];
    list.sort((a, b) => {
      const av = a?.[sortState.key];
      const bv = b?.[sortState.key];
      if (typeof av === 'string' || typeof bv === 'string') {
        return String(av || '').localeCompare(String(bv || ''), 'pt-BR', { sensitivity: 'base' }) * factor;
      }
      return ((Number(av) || 0) - (Number(bv) || 0)) * factor;
    });
    return list;
  };
  const toggleSort = (setter, key) => {
    setter((prev) => (prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: key === 'name' ? 'asc' : 'desc' }));
  };
  const sortIcon = (state, key) => (state.key === key ? (state.dir === 'asc' ? '↑' : '↓') : '');

  const rankingRows = useMemo(
    () =>
      sortRows(
        filteredProviders.map((p) => ({
          ...p,
          name: p.name,
          total: p.total,
          active: p.active,
          closed: p.closed,
          delayed: p.delayed,
          dueToday: p.dueToday,
        })),
        rankingSort
      ),
    [filteredProviders, rankingSort]
  );
  const frequencyRows = useMemo(
    () =>
      sortRows(
        filteredProviders.map((p) => ({
          ...p,
          name: p.name,
          total: p.total,
          osPerDay: p.total / totalDays,
          avgPerMonth: (p.total / totalDays) * 30,
        })),
        frequencySort
      ),
    [filteredProviders, totalDays, frequencySort]
  );
  const matrixTopTypes = useMemo(() => {
    const map = new Map();
    filteredProviders.forEach((p) => {
      (p.orders || []).forEach((o) => {
        const key = o.type || 'Outros';
        map.set(key, (map.get(key) || 0) + 1);
      });
    });
    return Array.from(map.entries())
      .map(([type, total]) => ({ type, total }))
      .sort((a, b) => b.total - a.total);
  }, [filteredProviders]);
  const matrixHeatColumns = useMemo(() => matrixTopTypes.slice(0, 6).map((t) => t.type), [matrixTopTypes]);
  const matrixRows = useMemo(
    () =>
      sortRows(
        filteredProviders.map((p) => {
          const typeMap = {};
          (p.orders || []).forEach((o) => {
            const key = o.type || 'Outros';
            typeMap[key] = (typeMap[key] || 0) + 1;
          });
          const topEntry = Object.entries(typeMap).sort((a, b) => b[1] - a[1])[0];
          return {
            ...p,
            name: p.name,
            city: p.city,
            total: p.total,
            typeMap,
            topType: topEntry?.[0] || '-',
            topCount: Number(topEntry?.[1] || 0),
          };
        }),
        matrixSort
      ),
    [filteredProviders, matrixSort]
  );
  const matrixTypeCoverage = useMemo(() => {
    const map = {};
    matrixRows.forEach((row) => {
      Object.entries(row.typeMap || {}).forEach(([type, count]) => {
        if (Number(count || 0) > 0) map[type] = (map[type] || 0) + 1;
      });
    });
    return map;
  }, [matrixRows]);
  const matrixList = useMemo(() => matrixRows.slice(0, 8), [matrixRows]);
  const providersSummary = useMemo(() => {
    const created = filteredProviders.reduce((acc, row) => acc + row.total, 0);
    const active = filteredProviders.reduce((acc, row) => acc + row.active, 0);
    const delayed = filteredProviders.reduce((acc, row) => acc + row.delayed, 0);
    const dueToday = filteredProviders.reduce((acc, row) => acc + row.dueToday, 0);
    const criticalActive = filteredProviders.reduce((acc, row) => acc + (row.criticalActive || 0), 0);
    const avgLateClosedRate = filteredProviders.length
      ? filteredProviders.reduce((acc, row) => acc + (row.lateClosedRate || 0), 0) / filteredProviders.length
      : 0;
    const avg = filteredProviders.length ? created / filteredProviders.length : 0;
    return { created, active, delayed, avg, dueToday, criticalActive, avgLateClosedRate };
  }, [filteredProviders]);
  const providersPanelClass = cn(
    'rounded-2xl border overflow-hidden flex flex-col h-[calc(100vh-260px)] md:h-[calc(100vh-220px)]',
    dark ? 'bg-[#111b2e]/75 border-slate-700/60 shadow-[0_12px_32px_rgba(2,6,23,0.35)]' : 'bg-white border-slate-200 shadow-sm'
  );
  const statsGridClass = 'grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3';
  const metricCardClass = cn('rounded-xl border p-4', dark ? 'bg-[#111b2e]/75 border-slate-700/60' : 'bg-white border-slate-200');
  const metricLabelClass = cn('text-[10px] uppercase font-bold tracking-wider', dark ? 'text-slate-500' : 'text-slate-400');
  const tableHeadClass = cn('sticky top-0 z-10 shadow-sm text-[11px] uppercase tracking-wide font-semibold', dark ? 'bg-[#0d1628]/95 text-slate-400' : 'bg-slate-50 text-slate-500');
  const tableBodyClass = cn('divide-y', dark ? 'divide-slate-700/50 bg-transparent' : 'divide-slate-100 bg-white');
  const tableRowClass = cn('transition-colors group', dark ? 'hover:bg-white/[0.03]' : 'hover:bg-indigo-50/30');
  const providerTabToneClass = {
    ranking: {
      active: dark ? 'bg-cyan-500/18 border-cyan-400/50 text-cyan-200 shadow-sm' : 'bg-cyan-50 border-cyan-300 text-cyan-700 shadow-sm',
      idle: dark ? 'bg-cyan-500/[0.06] border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/[0.12]' : 'bg-cyan-50/60 border-cyan-200 text-cyan-700 hover:bg-cyan-100/70',
    },
    frequency: {
      active: dark ? 'bg-emerald-500/18 border-emerald-400/50 text-emerald-200 shadow-sm' : 'bg-emerald-50 border-emerald-300 text-emerald-700 shadow-sm',
      idle: dark ? 'bg-emerald-500/[0.06] border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/[0.12]' : 'bg-emerald-50/60 border-emerald-200 text-emerald-700 hover:bg-emerald-100/70',
    },
    matrix: {
      active: dark ? 'bg-violet-500/18 border-violet-400/50 text-violet-200 shadow-sm' : 'bg-violet-50 border-violet-300 text-violet-700 shadow-sm',
      idle: dark ? 'bg-violet-500/[0.06] border-violet-500/30 text-violet-300 hover:bg-violet-500/[0.12]' : 'bg-violet-50/60 border-violet-200 text-violet-700 hover:bg-violet-100/70',
    },
  };
  const openProviderDetails = (providerRow) => setSelectedProvider(providerRow);
  const matrixCellClass = (count) => {
    const n = Number(count || 0);
    if (n >= 20) return dark ? 'bg-rose-500/25 text-rose-200' : 'bg-rose-100 text-rose-700';
    if (n >= 10) return dark ? 'bg-amber-500/20 text-amber-200' : 'bg-amber-100 text-amber-700';
    if (n >= 1) return dark ? 'bg-cyan-500/20 text-cyan-200' : 'bg-cyan-100 text-cyan-700';
    return dark ? 'bg-slate-800/70 text-slate-500' : 'bg-slate-100 text-slate-400';
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
          <h2 className={cn('text-2xl font-bold tracking-tight', dark ? 'text-slate-100' : 'text-slate-900')}>Análise de Provedores</h2>
          <p className={cn('text-sm', dark ? 'text-slate-400' : 'text-slate-500')}>Ranking e detalhamento operacional por contrato.</p>
        </div>
        <WindowControls period={period} setPeriod={setPeriod} customRange={customRange} setCustomRange={setCustomRange} />
      </div>

      <div className={cn(statsGridClass, 'px-1')}>
        <div className={metricCardClass}>
          <div className={metricLabelClass}>Provedores na Janela</div>
          <div className={cn('text-2xl font-bold mt-1', dark ? 'text-slate-100' : 'text-slate-800')}>{formatNumber(filteredProviders.length)}</div>
        </div>
        <div className={metricCardClass}>
          <div className={metricLabelClass}>OS Criadas</div>
          <div className={cn('text-2xl font-bold mt-1', dark ? 'text-cyan-300' : 'text-cyan-700')}>{formatNumber(providersSummary.created)}</div>
        </div>
        <div className={metricCardClass}>
          <div className={metricLabelClass}>Ativas / Atrasadas</div>
          <div className={cn('text-2xl font-bold mt-1', dark ? 'text-amber-300' : 'text-amber-700')}>{formatNumber(providersSummary.active)} / {formatNumber(providersSummary.delayed)}</div>
        </div>
        <div className={metricCardClass}>
          <div className={metricLabelClass}>Média por Provedor</div>
          <div className={cn('text-2xl font-bold mt-1', dark ? 'text-emerald-300' : 'text-emerald-700')}>
            {providersSummary.avg.toFixed(1)}
          </div>
        </div>
        <div className={metricCardClass}>
          <div className={metricLabelClass}>SLA Fora / Críticas</div>
          <div className={cn('text-2xl font-bold mt-1', dark ? 'text-rose-300' : 'text-rose-700')}>
            {providersSummary.avgLateClosedRate.toFixed(1)}% / {formatNumber(providersSummary.criticalActive)}
          </div>
        </div>
      </div>

      <div className={providersPanelClass}>
        <div className={cn('px-4 md:px-6 py-5 border-b flex flex-col gap-4',
          dark ? 'border-slate-700/60 bg-[#0d1628]/80' : 'border-slate-200 bg-white')}>
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className={cn('p-2 rounded-lg', dark ? 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/30' : 'bg-indigo-50 text-indigo-600')}>
                <TrendingUp size={20} />
              </div>
              <div>
                <h3 className={cn('font-bold', dark ? 'text-slate-100' : 'text-slate-800')}>Painel de Provedores</h3>
                <span className={cn('text-xs', dark ? 'text-slate-400' : 'text-slate-500')}>
                  Ranking operacional, frequência de entrada e concentração por tipo de serviço.
                </span>
              </div>
            </div>
            <div className={cn('flex items-center gap-2 text-xs rounded-full px-3 py-2 h-fit',
              dark ? 'bg-slate-900/70 text-slate-300 border border-slate-700/60' : 'bg-slate-50 text-slate-600 border border-slate-200')}>
              <span>Críticas ativas: {formatNumber(providersSummary.criticalActive)}</span>
              <span className={dark ? 'text-slate-600' : 'text-slate-300'}>•</span>
              <span>Vencem hoje: {formatNumber(providersSummary.dueToday)}</span>
            </div>
          </div>

          <div className={cn('rounded-2xl border p-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3',
            dark ? 'bg-[#09111f]/75 border-slate-700/60' : 'bg-slate-50/80 border-slate-200')}>
            <div className="relative xl:col-span-2">
              <input
                type="text"
                placeholder="Buscar provedor..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className={cn('pl-9 pr-4 py-2.5 border rounded-lg text-sm w-full',
                  dark ? 'bg-[#0d1628]/80 border-slate-700/60 text-slate-200 placeholder:text-slate-500' : 'bg-white border-slate-300')}
              />
              <Search className={cn('absolute left-3 top-1/2 -translate-y-1/2', dark ? 'text-slate-500' : 'text-slate-400')} size={14} />
            </div>
            <select value={cityFilter} onChange={(e) => setCityFilter(e.target.value)} className={cn('px-3 py-2.5 border rounded-lg text-sm', dark ? 'bg-[#0d1628]/80 border-slate-700/60 text-slate-200' : 'bg-white border-slate-300')}>
              {cityOptions.map((city) => <option key={city}>{city}</option>)}
            </select>
            <div className="flex items-center gap-2">
              <input value={minVolume} onChange={(e) => setMinVolume(e.target.value)} placeholder="Min O.S." className={cn('w-24 px-3 py-2.5 border rounded-lg text-sm', dark ? 'bg-[#0d1628]/80 border-slate-700/60 text-slate-200' : 'bg-white border-slate-300')} />
              <label className={cn('text-xs inline-flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2.5 border',
                dark ? 'text-slate-300 border-slate-700/60 bg-[#0d1628]/80' : 'text-slate-600 border-slate-300 bg-white')}>
                <input type="checkbox" checked={onlyDelayed} onChange={(e) => setOnlyDelayed(e.target.checked)} />
                Só atrasados
              </label>
            </div>
          </div>
        </div>

        <div className={cn('px-4 md:px-6 border-b flex flex-wrap items-center gap-2 py-3',
          dark ? 'border-slate-700/60 bg-[#0d1628]/70' : 'border-slate-200 bg-white')}>
          {[
            { id: 'ranking', label: 'Ranking' },
            { id: 'frequency', label: 'Frequência' },
            { id: 'matrix', label: 'Matriz de Tipos' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn('px-4 py-1.5 rounded-full text-xs font-bold border transition-all whitespace-nowrap',
                activeTab === tab.id
                  ? providerTabToneClass[tab.id].active
                  : providerTabToneClass[tab.id].idle)}
            >
              {tab.label}
            </button>
          ))}
          <div className={cn('ml-auto text-[11px] font-medium self-center pr-1', dark ? 'text-slate-400' : 'text-slate-500')}>
            {formatNumber(rankingRows.length)} provedores no recorte
          </div>
        </div>

        <div className={cn('flex-1 overflow-auto custom-scrollbar', dark ? 'bg-[#0d1628]/60' : 'bg-slate-50/30')}>
          {activeTab === 'ranking' && (
            <div className={cn('rounded-2xl border overflow-hidden', dark ? 'bg-[#111b2e]/70 border-slate-700/60' : 'bg-white border-slate-200')}>
              <div className={cn('px-6 py-4 border-b flex items-center justify-between gap-4', dark ? 'border-slate-700/60' : 'border-slate-200')}>
                <div>
                  <h3 className={cn('font-bold', dark ? 'text-slate-100' : 'text-slate-800')}>Ranking de Provedores</h3>
                  <p className={cn('text-sm', dark ? 'text-slate-400' : 'text-slate-500')}>Janela atual aplicada • clique no cabeçalho para ordenar</p>
                </div>
                <div className={cn('text-xs whitespace-nowrap', dark ? 'text-slate-400' : 'text-slate-500')}>
                  {formatNumber(rankingRows.length)} provedores
                </div>
              </div>
              <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full text-sm text-left border-collapse">
                  <thead className={tableHeadClass}>
                    <tr>
                      <th className="px-6 py-4"><button className="hover:underline" onClick={() => toggleSort(setRankingSort, 'name')}>Provedor {sortIcon(rankingSort, 'name')}</button></th>
                      <th className="px-6 py-4 text-right"><button className="hover:underline" onClick={() => toggleSort(setRankingSort, 'total')}>Criadas {sortIcon(rankingSort, 'total')}</button></th>
                      <th className="px-6 py-4 text-right"><button className="hover:underline" onClick={() => toggleSort(setRankingSort, 'active')}>Ativas {sortIcon(rankingSort, 'active')}</button></th>
                      <th className="px-6 py-4 text-right"><button className="hover:underline" onClick={() => toggleSort(setRankingSort, 'closed')}>Fechadas {sortIcon(rankingSort, 'closed')}</button></th>
                      <th className="px-6 py-4 text-right"><button className="hover:underline" onClick={() => toggleSort(setRankingSort, 'delayed')}>Atrasadas {sortIcon(rankingSort, 'delayed')}</button></th>
                      <th className="px-6 py-4 text-right"><button className="hover:underline" onClick={() => toggleSort(setRankingSort, 'dueToday')}>Vencem Hoje {sortIcon(rankingSort, 'dueToday')}</button></th>
                      <th className="px-6 py-4 text-right text-xs uppercase font-semibold">Ação</th>
                    </tr>
                  </thead>
                  <tbody className={tableBodyClass}>
                    {rankingRows.map((p) => (
                      <tr key={p.name} className={cn(tableRowClass, 'cursor-pointer')} onClick={() => openProviderDetails(p)}>
                        <td className="px-6 py-4">
                          <div className={cn('font-bold', dark ? 'text-slate-100 group-hover:text-indigo-300' : 'text-slate-800 group-hover:text-indigo-700')}>{p.name}</div>
                        </td>
                        <td className={cn('px-6 py-4 text-right font-mono', dark ? 'text-slate-300' : 'text-slate-600')}>{formatNumber(p.total)}</td>
                        <td className={cn('px-6 py-4 text-right font-mono font-bold', dark ? 'text-blue-300' : 'text-blue-600')}>{formatNumber(p.active)}</td>
                        <td className={cn('px-6 py-4 text-right font-mono font-bold', dark ? 'text-emerald-300' : 'text-emerald-600')}>{formatNumber(p.closed)}</td>
                        <td className={cn('px-6 py-4 text-right font-mono font-bold', p.delayed > 0 ? (dark ? 'text-rose-300' : 'text-rose-600') : dark ? 'text-slate-500' : 'text-slate-300')}>{formatNumber(p.delayed)}</td>
                        <td className={cn('px-6 py-4 text-right font-mono font-bold', p.dueToday > 0 ? (dark ? 'text-indigo-300' : 'text-indigo-600') : dark ? 'text-slate-500' : 'text-slate-300')}>{formatNumber(p.dueToday)}</td>
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openProviderDetails(p);
                            }}
                            className={cn('px-3 py-1.5 rounded-lg text-xs font-medium transition',
                              dark ? 'bg-slate-800 hover:bg-slate-700 text-white border border-slate-700/70' : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300')}
                          >
                            Ver OS
                          </button>
                        </td>
                      </tr>
                    ))}
                    {rankingRows.length === 0 && (
                      <tr>
                        <td colSpan={7} className={cn('px-6 py-12 text-center', dark ? 'text-slate-500' : 'text-slate-400')}>
                          Nenhum provedor encontrado.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'frequency' && (
            <div className={cn('rounded-2xl border overflow-hidden', dark ? 'bg-[#111b2e]/70 border-slate-700/60' : 'bg-white border-slate-200')}>
              <div className={cn('px-6 py-4 border-b', dark ? 'border-slate-700/60' : 'border-slate-200')}>
                <h3 className={cn('font-bold', dark ? 'text-slate-100' : 'text-slate-800')}>Frequência de Entrada de O.S</h3>
                <p className={cn('text-sm', dark ? 'text-slate-400' : 'text-slate-500')}>Baseado na janela atual • clique no cabeçalho para ordenar</p>
              </div>
              <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full text-sm text-left border-collapse">
                  <thead className={tableHeadClass}>
                    <tr>
                      <th className="px-6 py-4"><button className="hover:underline" onClick={() => toggleSort(setFrequencySort, 'name')}>Provedor {sortIcon(frequencySort, 'name')}</button></th>
                      <th className="px-6 py-4 text-right"><button className="hover:underline" onClick={() => toggleSort(setFrequencySort, 'total')}>Total no Período {sortIcon(frequencySort, 'total')}</button></th>
                      <th className="px-6 py-4 text-right"><button className="hover:underline" onClick={() => toggleSort(setFrequencySort, 'osPerDay')}>Média / Dia {sortIcon(frequencySort, 'osPerDay')}</button></th>
                      <th className="px-6 py-4 text-right"><button className="hover:underline" onClick={() => toggleSort(setFrequencySort, 'avgPerMonth')}>Média / Mês (estimada) {sortIcon(frequencySort, 'avgPerMonth')}</button></th>
                    </tr>
                  </thead>
                  <tbody className={tableBodyClass}>
                    {frequencyRows.map((p) => (
                      <tr key={p.name} className={cn(tableRowClass, 'cursor-pointer')} onClick={() => openProviderDetails(p)}>
                        <td className="px-6 py-4">
                          <div className={cn('font-bold', dark ? 'text-slate-100' : 'text-slate-800')}>{p.name}</div>
                        </td>
                        <td className={cn('px-6 py-4 text-right font-mono', dark ? 'text-slate-300' : 'text-slate-700')}>{formatNumber(p.total)}</td>
                        <td className={cn('px-6 py-4 text-right font-mono', dark ? 'text-cyan-300' : 'text-cyan-700')}>{p.osPerDay.toFixed(2)}</td>
                        <td className={cn('px-6 py-4 text-right font-mono', dark ? 'text-indigo-300' : 'text-indigo-700')}>{p.avgPerMonth.toFixed(0)}</td>
                      </tr>
                    ))}
                    {frequencyRows.length === 0 && (
                      <tr>
                        <td colSpan={4} className={cn('px-6 py-12 text-center', dark ? 'text-slate-500' : 'text-slate-400')}>
                          Sem dados de frequência para os filtros atuais.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'matrix' && (
            <div className="p-4 md:p-6 space-y-6">
              <div className={cn('rounded-2xl border overflow-hidden', dark ? 'bg-[#111b2e]/70 border-slate-700/60' : 'bg-white border-slate-200')}>
                <div className={cn('px-6 py-4 border-b flex items-center justify-between gap-4', dark ? 'border-slate-700/60' : 'border-slate-200')}>
                  <div>
                    <h3 className={cn('font-bold', dark ? 'text-slate-100' : 'text-slate-800')}>Radar Global de Tipos</h3>
                    <p className={cn('text-sm', dark ? 'text-slate-400' : 'text-slate-500')}>Tipos que mais pressionam os provedores no período</p>
                  </div>
                  <span className={cn('text-xs', dark ? 'text-slate-400' : 'text-slate-500')}>
                    {formatNumber(matrixTopTypes.length)} tipos
                  </span>
                </div>
                <div className="p-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                  {matrixTopTypes.slice(0, 8).map((t, idx) => (
                    <div
                      key={`top-type-${t.type}`}
                      className={cn(
                        'rounded-xl border p-4',
                        idx < 2
                          ? dark ? 'border-emerald-500/40 bg-emerald-500/10' : 'border-emerald-200 bg-emerald-50'
                          : idx < 5
                            ? dark ? 'border-cyan-500/35 bg-cyan-500/10' : 'border-cyan-200 bg-cyan-50'
                            : dark ? 'border-slate-700/60 bg-[#0d1628]/70' : 'border-slate-200 bg-slate-50'
                      )}
                    >
                      <p className={cn('text-xs truncate', dark ? 'text-slate-300' : 'text-slate-700')} title={t.type}>{t.type}</p>
                      <div className="mt-2 flex items-end justify-between gap-3">
                        <p className={cn('text-2xl font-bold', dark ? 'text-slate-100' : 'text-slate-800')}>{formatNumber(t.total)}</p>
                        <p className={cn('text-[11px] text-right', dark ? 'text-slate-400' : 'text-slate-500')}>
                          {formatNumber(matrixTypeCoverage[t.type] || 0)} provedores
                        </p>
                      </div>
                    </div>
                  ))}
                  {matrixTopTypes.length === 0 && (
                    <div className={cn('col-span-full text-center py-8 text-sm', dark ? 'text-slate-500' : 'text-slate-400')}>
                      Sem tipos de serviço para o período selecionado.
                    </div>
                  )}
                </div>
              </div>

              <div className={cn('rounded-2xl border overflow-hidden', dark ? 'bg-[#111b2e]/70 border-slate-700/60' : 'bg-white border-slate-200')}>
                <div className={cn('px-6 py-4 border-b flex items-center justify-between gap-4', dark ? 'border-slate-700/60' : 'border-slate-200')}>
                  <div>
                    <h3 className={cn('font-bold', dark ? 'text-slate-100' : 'text-slate-800')}>Heatmap Provedor x Tipo</h3>
                    <p className={cn('text-sm', dark ? 'text-slate-400' : 'text-slate-500')}>Leitura rápida da concentração de chamados por categoria</p>
                  </div>
                  <span className={cn('text-xs', dark ? 'text-slate-400' : 'text-slate-500')}>
                    Top {formatNumber(matrixRows.length)} provedores por volume
                  </span>
                </div>
                <div className="overflow-x-auto custom-scrollbar">
                  <table className="w-full min-w-[980px] text-sm">
                    <thead className={cn(dark ? 'bg-[#0d1628]/95 text-slate-400' : 'bg-slate-50 text-slate-500')}>
                      <tr>
                        <th className="px-4 py-3 text-left text-xs uppercase font-semibold">
                          <button className="hover:underline" onClick={() => toggleSort(setMatrixSort, 'name')}>Provedor {sortIcon(matrixSort, 'name')}</button>
                        </th>
                        <th className="px-4 py-3 text-left text-xs uppercase font-semibold">Tipo líder</th>
                        <th className="px-4 py-3 text-right text-xs uppercase font-semibold">
                          <button className="hover:underline" onClick={() => toggleSort(setMatrixSort, 'total')}>Total {sortIcon(matrixSort, 'total')}</button>
                        </th>
                        {matrixHeatColumns.map((type) => (
                          <th key={`head-${type}`} className="px-3 py-3 text-center text-xs uppercase font-semibold">
                            <span className="inline-block max-w-[140px] truncate" title={type}>{type}</span>
                          </th>
                        ))}
                        <th className="px-4 py-3 text-right text-xs uppercase font-semibold">Ação</th>
                      </tr>
                    </thead>
                    <tbody className={cn('divide-y', dark ? 'divide-slate-700/50' : 'divide-slate-100')}>
                      {matrixRows.map((row) => (
                        <tr key={`heat-${row.name}`} className={cn(tableRowClass, 'cursor-pointer')} onClick={() => openProviderDetails(row)}>
                          <td className={cn('px-4 py-3 font-medium', dark ? 'text-slate-100' : 'text-slate-800')}>{row.name}</td>
                          <td className={cn('px-4 py-3 text-sm', dark ? 'text-slate-300' : 'text-slate-700')}>
                            {row.topType}
                            <span className={cn('ml-1', dark ? 'text-slate-500' : 'text-slate-500')}>({formatNumber(row.topCount)})</span>
                          </td>
                          <td className={cn('px-4 py-3 text-right font-semibold', dark ? 'text-cyan-300' : 'text-cyan-700')}>{formatNumber(row.total)}</td>
                          {matrixHeatColumns.map((type) => (
                            <td key={`cell-${row.name}-${type}`} className="px-2 py-3">
                              <div className={cn('h-8 rounded-md text-xs font-semibold flex items-center justify-center', matrixCellClass(row.typeMap[type]))}>
                                {formatNumber(row.typeMap[type] || 0)}
                              </div>
                            </td>
                          ))}
                          <td className="px-4 py-3 text-right">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                openProviderDetails(row);
                              }}
                              className={cn('px-3 py-1.5 rounded-lg text-xs font-medium transition',
                                dark ? 'bg-slate-800 hover:bg-slate-700 text-white border border-slate-700/70' : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300')}
                            >
                              Ver O.S
                            </button>
                          </td>
                        </tr>
                      ))}
                      {matrixRows.length === 0 && (
                        <tr>
                          <td colSpan={4 + matrixHeatColumns.length} className={cn('px-6 py-10 text-center', dark ? 'text-slate-500' : 'text-slate-400')}>
                            Sem tipos de serviço para o período selecionado.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {matrixList.map((row) => {
                  const maxTypeCount = Math.max(1, ...Object.values(row.typeMap || {}).map((v) => Number(v || 0)));
                  const sortedTypes = Object.entries(row.typeMap || {}).sort((a, b) => Number(b[1] || 0) - Number(a[1] || 0)).slice(0, 6);
                  return (
                    <div
                      key={`card-${row.name}`}
                      className={cn('rounded-2xl p-5 cursor-pointer transition-colors border',
                        dark ? 'bg-[#111b2e]/70 border-slate-700/60 hover:border-indigo-500/40' : 'bg-white border-slate-200 hover:border-indigo-300')}
                      onClick={() => openProviderDetails(row)}
                    >
                      <div className="flex items-start justify-between gap-4 mb-4">
                        <div>
                          <h3 className={cn('font-bold', dark ? 'text-slate-100' : 'text-slate-800')}>{row.name}</h3>
                          <p className={cn('text-xs mt-1', dark ? 'text-slate-400' : 'text-slate-500')}>
                            {formatNumber(row.total)} O.S mapeadas
                          </p>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openProviderDetails(row);
                          }}
                          className={cn('px-3 py-1.5 rounded-lg text-xs font-semibold transition border',
                            dark ? 'bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-200 border-indigo-400/30' : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-200')}
                        >
                          Ver O.S
                        </button>
                      </div>
                      <div className="space-y-2">
                        {sortedTypes.map(([type, count]) => (
                          <div key={`${row.name}-${type}`}>
                            <div className="flex items-center justify-between text-xs mb-1">
                              <span className={cn('truncate pr-2', dark ? 'text-slate-300' : 'text-slate-700')} title={type}>{type}</span>
                              <span className={cn('font-semibold', dark ? 'text-slate-400' : 'text-slate-500')}>{formatNumber(count)}</span>
                            </div>
                            <div className={cn('h-2 rounded-full overflow-hidden', dark ? 'bg-slate-800' : 'bg-slate-200')}>
                              <div
                                className={cn('h-full rounded-full', dark ? 'bg-cyan-400/90' : 'bg-cyan-500')}
                                style={{ width: `${Math.max(6, (Number(count || 0) / maxTypeCount) * 100)}%` }}
                              />
                            </div>
                          </div>
                        ))}
                        {sortedTypes.length === 0 && (
                          <p className={cn('text-xs', dark ? 'text-slate-500' : 'text-slate-400')}>
                            Sem distribuição de tipos para este provedor.
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {selectedProvider && (
        <ProviderDetailDrawer
          provider={selectedProvider}
          onClose={() => setSelectedProvider(null)}
          onSelectOS={(os) => {
            setSelectedProvider(null);
            onSelectOS(os);
          }}
        />
      )}
    </div>
  );
};

const ANALYST_PROVIDER_PERIOD_LABELS = ['Tudo', 'Hoje', '7d', '15d', '30d'];

const filterOrdersByPeriodLabel = (orders, period, now = Date.now()) => {
  if (period === 'Tudo') return orders;
  if (period === 'Hoje') {
    const start = startOfDay(now);
    const end = endOfDay(now);
    return orders.filter((o) => (o.createdAt || 0) >= start && (o.createdAt || 0) <= end);
  }
  const days = Number(String(period).replace('d', ''));
  if (!Number.isFinite(days) || days <= 0) return orders;
  const start = startOfDay(now - (days - 1) * DAY_MS);
  return orders.filter((o) => (o.createdAt || 0) >= start);
};

const buildAnalystProviderOccurrences = (orders) => {
  const byOccurrence = new Map();
  orders.forEach((order) => {
    const provider = order.provider || 'Sem provedor';
    const contract = String(order.contract || '').trim();
    const hasContract = !!contract && contract !== '-';
    const number = hasContract ? contract : `Sem contrato (${order.protocol || order.id})`;
    const key = hasContract ? `${provider}::${contract}` : `${provider}::LEG-${order.id}`;
    if (!byOccurrence.has(key)) {
      byOccurrence.set(key, {
        id: key,
        provider,
        number,
        type: order.type || '-',
        status: order.status || 'Aberta',
        sector: order.sector || '-',
        origin: order.origin || '-',
        createdAt: order.createdAt || Date.now(),
        orders: [],
      });
    }
    const occurrence = byOccurrence.get(key);
    occurrence.orders.push(order);
    if ((order.createdAt || 0) < occurrence.createdAt) {
      occurrence.createdAt = order.createdAt || occurrence.createdAt;
    }
    if (isActive(order)) {
      occurrence.status = order.status || occurrence.status;
    }
  });
  return Array.from(byOccurrence.values()).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
};

const AnalystProvidersOperationalView = ({ orders, onSelectOS }) => {
  const { dark } = useTheme();
  const [search, setSearch] = useState('');
  const [selectedProvider, setSelectedProvider] = useState(null);
  const [period, setPeriod] = useState('Tudo');
  const [occurrenceSearch, setOccurrenceSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('Todas');
  const [typeFilter, setTypeFilter] = useState('Todos');
  const [onlyDelayed, setOnlyDelayed] = useState(false);
  const [selectedOccurrenceId, setSelectedOccurrenceId] = useState(null);

  const now = Date.now();
  const allOccurrences = useMemo(() => buildAnalystProviderOccurrences(orders), [orders]);

  const providerRows = useMemo(() => {
    const map = new Map();
    allOccurrences.forEach((occurrence) => {
      if (!map.has(occurrence.provider)) {
        map.set(occurrence.provider, {
          provider: occurrence.provider,
          occurrences: 0,
          orders: 0,
          active: 0,
          delayed: 0,
          critical: 0,
        });
      }
      const row = map.get(occurrence.provider);
      row.occurrences += 1;
      row.orders += occurrence.orders.length;
      row.active += occurrence.orders.filter(isActive).length;
      row.delayed += occurrence.orders.filter((o) => isActive(o) && getDelayHours(o, now) > 0).length;
      row.critical += occurrence.orders.filter((o) => o.priority === 'Alta' || o.priority === 'Critica').length;
    });
    return Array.from(map.values()).sort((a, b) => b.orders - a.orders);
  }, [allOccurrences, now]);

  const filteredProviders = useMemo(() => {
    const q = search.toLowerCase().trim();
    return providerRows.filter((row) => !q || row.provider.toLowerCase().includes(q));
  }, [providerRows, search]);

  const providerOrders = useMemo(() => {
    if (!selectedProvider) return [];
    return orders.filter((order) => order.provider === selectedProvider);
  }, [orders, selectedProvider]);

  const scopedProviderOrders = useMemo(() => filterOrdersByPeriodLabel(providerOrders, period, now), [providerOrders, period, now]);

  const providerOccurrences = useMemo(() => {
    if (!selectedProvider) return [];
    return buildAnalystProviderOccurrences(scopedProviderOrders).filter((occurrence) => occurrence.provider === selectedProvider);
  }, [scopedProviderOrders, selectedProvider]);

  const typeOptions = useMemo(() => ['Todos', ...Array.from(new Set(providerOccurrences.map((occurrence) => occurrence.type).filter(Boolean)))], [providerOccurrences]);

  const filteredOccurrences = useMemo(() => {
    const q = occurrenceSearch.toLowerCase().trim();
    return providerOccurrences.filter((occurrence) => {
      const bySearch = !q || `${occurrence.number} ${occurrence.type} ${occurrence.sector} ${occurrence.status}`.toLowerCase().includes(q);
      const byStatus = statusFilter === 'Todas' || occurrence.status === statusFilter;
      const byType = typeFilter === 'Todos' || occurrence.type === typeFilter;
      const byDelay = !onlyDelayed || occurrence.orders.some((order) => isActive(order) && getDelayHours(order, now) > 0);
      return bySearch && byStatus && byType && byDelay;
    });
  }, [providerOccurrences, occurrenceSearch, statusFilter, typeFilter, onlyDelayed, now]);

  const selectedOccurrence = useMemo(
    () => providerOccurrences.find((occurrence) => occurrence.id === selectedOccurrenceId) || null,
    [providerOccurrences, selectedOccurrenceId]
  );

  const selectedOccurrenceOrders = useMemo(() => {
    if (!selectedOccurrence) return [];
    return [...selectedOccurrence.orders].sort((a, b) => (a.deadlineAt || 0) - (b.deadlineAt || 0));
  }, [selectedOccurrence]);

  useEffect(() => {
    setSelectedOccurrenceId(null);
    setOccurrenceSearch('');
    setStatusFilter('Todas');
    setTypeFilter('Todos');
    setOnlyDelayed(false);
    setPeriod('Tudo');
  }, [selectedProvider]);

  useEffect(() => {
    if (!selectedOccurrenceId) return;
    if (!providerOccurrences.some((occurrence) => occurrence.id === selectedOccurrenceId)) {
      setSelectedOccurrenceId(null);
    }
  }, [selectedOccurrenceId, providerOccurrences]);

  if (selectedProvider) {
    return (
      <div className="space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div>
            <button
              onClick={() => setSelectedProvider(null)}
              className={cn('inline-flex items-center gap-1 text-xs font-semibold mb-2 hover:underline', dark ? 'text-cyan-300' : 'text-cyan-700')}
            >
              <ChevronLeft size={14} />
              Voltar para lista de provedores
            </button>
            <h2 className={cn('text-2xl font-bold', dark ? 'text-slate-100' : 'text-slate-900')}>{selectedProvider}</h2>
            <p className={cn('text-sm', dark ? 'text-slate-400' : 'text-slate-500')}>
              Fluxo operacional por ocorrência, seguindo o padrão da tela de analista.
            </p>
          </div>
          <div className={cn('flex items-center border rounded-lg p-1 gap-1 overflow-x-auto no-scrollbar', dark ? 'bg-[#1e293b]/60 border-slate-700/50' : 'bg-white border-slate-200')}>
            {ANALYST_PROVIDER_PERIOD_LABELS.map((label) => (
              <button
                key={label}
                onClick={() => setPeriod(label)}
                className={cn(
                  'px-3 py-1.5 text-xs rounded font-semibold whitespace-nowrap transition-colors',
                  period === label
                    ? dark ? 'bg-cyan-900/40 text-cyan-200' : 'bg-slate-800 text-white'
                    : dark ? 'text-slate-400 hover:bg-white/5 hover:text-slate-200' : 'text-slate-500 hover:bg-slate-100'
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
          <div className={cn('border rounded-xl p-4 shadow-sm', dark ? 'bg-[#111b2e]/75 border-slate-700/60' : 'bg-white border-slate-200')}>
            <div className={cn('text-xs uppercase font-bold', dark ? 'text-slate-500' : 'text-slate-400')}>Ocorrências</div>
            <div className={cn('text-3xl font-bold mt-2', dark ? 'text-slate-100' : 'text-slate-800')}>{providerOccurrences.length}</div>
          </div>
          <div className={cn('border rounded-xl p-4 shadow-sm', dark ? 'bg-[#111b2e]/75 border-slate-700/60' : 'bg-white border-slate-200')}>
            <div className={cn('text-xs uppercase font-bold', dark ? 'text-slate-500' : 'text-slate-400')}>Total O.S</div>
            <div className={cn('text-3xl font-bold mt-2', dark ? 'text-slate-100' : 'text-slate-800')}>{scopedProviderOrders.length}</div>
          </div>
          <div className={cn('border rounded-xl p-4 shadow-sm', dark ? 'bg-[#111b2e]/75 border-slate-700/60' : 'bg-white border-slate-200')}>
            <div className={cn('text-xs uppercase font-bold', dark ? 'text-slate-500' : 'text-slate-400')}>Ativas</div>
            <div className={cn('text-3xl font-bold mt-2', dark ? 'text-indigo-300' : 'text-indigo-700')}>{scopedProviderOrders.filter(isActive).length}</div>
          </div>
          <div className={cn('border rounded-xl p-4 shadow-sm', dark ? 'bg-[#111b2e]/75 border-rose-500/30' : 'bg-white border-rose-200')}>
            <div className="text-xs uppercase font-bold text-rose-500">Atrasadas</div>
            <div className="text-3xl font-bold text-rose-600 mt-2">{scopedProviderOrders.filter((order) => isActive(order) && getDelayHours(order, now) > 0).length}</div>
          </div>
          <div className={cn('border rounded-xl p-4 shadow-sm', dark ? 'bg-[#111b2e]/75 border-amber-500/30' : 'bg-white border-amber-200')}>
            <div className="text-xs uppercase font-bold text-amber-600">Alta/Critica</div>
            <div className="text-3xl font-bold text-amber-600 mt-2">{scopedProviderOrders.filter((order) => order.priority === 'Alta' || order.priority === 'Critica').length}</div>
          </div>
        </div>

        {!selectedOccurrence && (
          <>
            <div className={cn('border rounded-xl p-4', dark ? 'bg-[#111b2e]/75 border-slate-700/60' : 'bg-white border-slate-200')}>
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
                <div className="lg:col-span-5 relative">
                  <Search size={14} className={cn('absolute left-3 top-1/2 -translate-y-1/2', dark ? 'text-slate-500' : 'text-slate-400')} />
                  <input
                    value={occurrenceSearch}
                    onChange={(e) => setOccurrenceSearch(e.target.value)}
                    placeholder="Buscar ocorrência..."
                    className={cn(
                      'w-full pl-9 pr-3 py-2 border rounded-lg text-sm transition-colors',
                      dark ? 'bg-[#0d1628]/80 border-slate-700/60 text-slate-200 placeholder:text-slate-500' : 'bg-white border-slate-300 text-slate-900'
                    )}
                  />
                </div>
                <div className="lg:col-span-3">
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className={cn('w-full px-3 py-2 border rounded-lg text-sm', dark ? 'bg-[#0d1628]/80 border-slate-700/60 text-slate-300' : 'bg-white border-slate-300 text-slate-900')}
                  >
                    <option>Todas</option>
                    {Array.from(new Set(providerOccurrences.map((occurrence) => occurrence.status))).map((status) => (
                      <option key={status}>{status}</option>
                    ))}
                  </select>
                </div>
                <div className="lg:col-span-2">
                  <select
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value)}
                    className={cn('w-full px-3 py-2 border rounded-lg text-sm', dark ? 'bg-[#0d1628]/80 border-slate-700/60 text-slate-300' : 'bg-white border-slate-300 text-slate-900')}
                  >
                    {typeOptions.map((type) => (
                      <option key={type}>{type}</option>
                    ))}
                  </select>
                </div>
                <div className="lg:col-span-2 flex items-center gap-2">
                  <input id="only-delayed-occ" type="checkbox" checked={onlyDelayed} onChange={(e) => setOnlyDelayed(e.target.checked)} />
                  <label htmlFor="only-delayed-occ" className={cn('text-xs font-semibold', dark ? 'text-slate-400' : 'text-slate-600')}>
                    Só com atraso
                  </label>
                </div>
              </div>
            </div>

            <div className={cn('border rounded-xl overflow-hidden shadow-sm', dark ? 'bg-[#111b2e]/75 border-slate-700/60' : 'bg-white border-slate-200')}>
              <div className={cn('px-5 py-3 border-b', dark ? 'border-slate-700/50' : 'border-slate-100')}>
                <div className={cn('font-bold text-sm', dark ? 'text-slate-300' : 'text-slate-700')}>
                  Ocorrências do provedor ({filteredOccurrences.length})
                </div>
              </div>
              <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full text-sm">
                  <thead className={cn(dark ? 'bg-[#0d1628]/90 text-slate-400' : 'bg-slate-50 text-slate-500')}>
                    <tr>
                      <th className="px-4 py-3 text-left">Ocorrência</th>
                      <th className="px-4 py-3 text-left">Tipo</th>
                      <th className="px-4 py-3 text-left">Setor</th>
                      <th className="px-4 py-3 text-left">Status</th>
                      <th className="px-4 py-3 text-right">O.S</th>
                      <th className="px-4 py-3 text-center">Ação</th>
                    </tr>
                  </thead>
                  <tbody className={cn('divide-y', dark ? 'divide-slate-700/50' : 'divide-slate-100')}>
                    {filteredOccurrences.map((occurrence) => (
                      <tr
                        key={occurrence.id}
                        className={cn('cursor-pointer transition-colors', dark ? 'hover:bg-white/5' : 'hover:bg-slate-50')}
                        onClick={() => setSelectedOccurrenceId(occurrence.id)}
                      >
                        <td className={cn('px-4 py-3 font-mono text-xs', dark ? 'text-slate-300' : 'text-slate-700')}>{occurrence.number}</td>
                        <td className={cn('px-4 py-3', dark ? 'text-slate-300' : 'text-slate-700')}>{occurrence.type || '-'}</td>
                        <td className={cn('px-4 py-3', dark ? 'text-slate-300' : 'text-slate-700')}>{occurrence.sector || '-'}</td>
                        <td className="px-4 py-3">
                          <ErpBadge color={getStatusColor(occurrence.status || 'Aberta')} dark={dark}>{occurrence.status || '-'}</ErpBadge>
                        </td>
                        <td className={cn('px-4 py-3 text-right font-mono', dark ? 'text-slate-300' : 'text-slate-700')}>{occurrence.orders.length}</td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedOccurrenceId(occurrence.id);
                            }}
                            className={cn(
                              'px-3 py-1 rounded border text-[11px] font-bold transition-colors',
                              dark ? 'bg-cyan-900/30 border-cyan-700/50 text-cyan-300 hover:bg-cyan-900/50' : 'border-cyan-200 bg-cyan-50 text-cyan-700 hover:bg-cyan-100'
                            )}
                          >
                            Abrir
                          </button>
                        </td>
                      </tr>
                    ))}
                    {filteredOccurrences.length === 0 && (
                      <tr>
                        <td colSpan={6} className={cn('px-4 py-10 text-center', dark ? 'text-slate-500' : 'text-slate-400')}>
                          Nenhuma ocorrência encontrada para os filtros atuais.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {selectedOccurrence && (
          <div className="space-y-4">
            <div className={cn('border rounded-xl p-4 shadow-sm', dark ? 'bg-[#111b2e]/75 border-slate-700/60' : 'bg-white border-slate-200')}>
              <button
                onClick={() => setSelectedOccurrenceId(null)}
                className={cn('inline-flex items-center gap-1 text-xs font-semibold mb-2 hover:underline', dark ? 'text-cyan-300' : 'text-cyan-700')}
              >
                <ChevronLeft size={14} />
                Voltar para ocorrências
              </button>
              <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
                <div>
                  <div className={cn('text-xs uppercase font-bold', dark ? 'text-slate-500' : 'text-slate-400')}>
                    Ocorrência {selectedOccurrence.number}
                  </div>
                  <div className={cn('text-sm mt-1', dark ? 'text-slate-300' : 'text-slate-700')}>
                    Tipo: {selectedOccurrence.type || '-'} • Setor: {selectedOccurrence.sector || '-'} • Origem: {selectedOccurrence.origin || '-'}
                  </div>
                </div>
                <ErpBadge color={getStatusColor(selectedOccurrence.status || 'Aberta')} dark={dark}>
                  {selectedOccurrence.status || '-'}
                </ErpBadge>
              </div>
            </div>

            <div className={cn('border rounded-xl overflow-hidden shadow-sm', dark ? 'bg-[#111b2e]/75 border-slate-700/60' : 'bg-white border-slate-200')}>
              <div className={cn('px-5 py-3 border-b', dark ? 'border-slate-700/50' : 'border-slate-100')}>
                <div className={cn('font-bold text-sm', dark ? 'text-slate-300' : 'text-slate-700')}>
                  Ordens de serviço da ocorrência ({selectedOccurrenceOrders.length})
                </div>
              </div>
              <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full text-sm">
                  <thead className={cn(dark ? 'bg-[#0d1628]/90 text-slate-400' : 'bg-slate-50 text-slate-500')}>
                    <tr>
                      <th className="px-4 py-3 text-left">Protocolo</th>
                      <th className="px-4 py-3 text-left">Tipo</th>
                      <th className="px-4 py-3 text-left">Prioridade</th>
                      <th className="px-4 py-3 text-left">Status</th>
                      <th className="px-4 py-3 text-right">Prazo</th>
                      <th className="px-4 py-3 text-center">Ação</th>
                    </tr>
                  </thead>
                  <tbody className={cn('divide-y', dark ? 'divide-slate-700/50' : 'divide-slate-100')}>
                    {selectedOccurrenceOrders.map((order) => (
                      <tr
                        key={order.id}
                        className={cn('cursor-pointer transition-colors', dark ? 'hover:bg-white/5' : 'hover:bg-slate-50')}
                        onClick={() => onSelectOS(order)}
                      >
                        <td className={cn('px-4 py-3 font-mono', dark ? 'text-slate-300' : 'text-slate-700')}>{order.protocol}</td>
                        <td className={cn('px-4 py-3', dark ? 'text-slate-300' : 'text-slate-700')}>{order.type}</td>
                        <td className="px-4 py-3">
                          <ErpBadge color={getPriorityColor(order.priority)} dark={dark}>{order.priority}</ErpBadge>
                        </td>
                        <td className="px-4 py-3">
                          <ErpBadge color={getStatusColor(order.status)} dark={dark}>{order.status}</ErpBadge>
                        </td>
                        <td className={cn('px-4 py-3 text-right font-mono text-xs', getDelayHours(order, now) > 0 ? 'text-rose-600 font-bold' : dark ? 'text-slate-400' : 'text-slate-600')}>
                          {formatDateTime(order.deadlineAt)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectOS(order);
                            }}
                            className={cn(
                              'px-3 py-1 rounded border text-[11px] font-bold transition-colors',
                              dark ? 'bg-cyan-900/30 border-cyan-700/50 text-cyan-300 hover:bg-cyan-900/50' : 'border-cyan-200 bg-cyan-50 text-cyan-700 hover:bg-cyan-100'
                            )}
                          >
                            Abrir O.S
                          </button>
                        </td>
                      </tr>
                    ))}
                    {selectedOccurrenceOrders.length === 0 && (
                      <tr>
                        <td colSpan={6} className={cn('px-4 py-10 text-center', dark ? 'text-slate-500' : 'text-slate-400')}>
                          Esta ocorrência ainda não possui O.S vinculadas.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <h2 className={cn('text-2xl font-bold', dark ? 'text-slate-100' : 'text-slate-900')}>Provedores</h2>
          <p className={cn('text-sm', dark ? 'text-slate-400' : 'text-slate-500')}>
            Selecione um provedor para navegar por ocorrências e ordens de serviço.
          </p>
        </div>
        <div className="relative w-full lg:w-[340px]">
          <Search size={14} className={cn('absolute left-3 top-1/2 -translate-y-1/2', dark ? 'text-slate-500' : 'text-slate-400')} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar provedor..."
            className={cn(
              'w-full pl-9 pr-3 py-2 border rounded-lg text-sm transition-colors',
              dark ? 'bg-[#0d1628]/80 border-slate-700/60 text-slate-200 placeholder:text-slate-500' : 'bg-white border-slate-300 text-slate-900'
            )}
          />
        </div>
      </div>

      <div className={cn('border rounded-xl overflow-hidden shadow-sm', dark ? 'bg-[#111b2e]/75 border-slate-700/60' : 'bg-white border-slate-200')}>
        <div className={cn('px-5 py-3 border-b', dark ? 'border-slate-700/50' : 'border-slate-100')}>
          <div className={cn('font-bold text-sm', dark ? 'text-slate-300' : 'text-slate-700')}>
            Provedores ({filteredProviders.length})
          </div>
        </div>
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-sm">
            <thead className={cn(dark ? 'bg-[#0d1628]/90 text-slate-400' : 'bg-slate-50 text-slate-500')}>
              <tr>
                <th className="px-4 py-3 text-left">Provedor</th>
                <th className="px-4 py-3 text-right">Ocorrências</th>
                <th className="px-4 py-3 text-right">O.S</th>
                <th className="px-4 py-3 text-right">Ativas</th>
                <th className="px-4 py-3 text-right">Atrasadas</th>
                <th className="px-4 py-3 text-right">Alta/Critica</th>
                <th className="px-4 py-3 text-center">Ação</th>
              </tr>
            </thead>
            <tbody className={cn('divide-y', dark ? 'divide-slate-700/50' : 'divide-slate-100')}>
              {filteredProviders.map((row) => (
                <tr
                  key={row.provider}
                  className={cn('cursor-pointer transition-colors', dark ? 'hover:bg-white/5' : 'hover:bg-slate-50')}
                  onClick={() => setSelectedProvider(row.provider)}
                >
                  <td className={cn('px-4 py-3 font-semibold', dark ? 'text-slate-100' : 'text-slate-800')}>{row.provider}</td>
                  <td className={cn('px-4 py-3 text-right font-mono', dark ? 'text-slate-300' : 'text-slate-700')}>{row.occurrences}</td>
                  <td className={cn('px-4 py-3 text-right font-mono', dark ? 'text-slate-300' : 'text-slate-700')}>{row.orders}</td>
                  <td className={cn('px-4 py-3 text-right font-mono', dark ? 'text-indigo-300' : 'text-indigo-700')}>{row.active}</td>
                  <td className={cn('px-4 py-3 text-right font-mono', row.delayed > 0 ? 'text-rose-600 font-bold' : dark ? 'text-slate-500' : 'text-slate-500')}>{row.delayed}</td>
                  <td className={cn('px-4 py-3 text-right font-mono', dark ? 'text-amber-300' : 'text-amber-700')}>{row.critical}</td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedProvider(row.provider);
                      }}
                      className={cn(
                        'px-3 py-1 rounded border text-[11px] font-bold transition-colors',
                        dark ? 'bg-cyan-900/30 border-cyan-700/50 text-cyan-300 hover:bg-cyan-900/50' : 'border-cyan-200 bg-cyan-50 text-cyan-700 hover:bg-cyan-100'
                      )}
                    >
                      Abrir
                    </button>
                  </td>
                </tr>
              ))}
              {filteredProviders.length === 0 && (
                <tr>
                  <td colSpan={7} className={cn('px-4 py-10 text-center', dark ? 'text-slate-500' : 'text-slate-400')}>
                    Nenhum provedor encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const ServiceTypesView = ({ orders, onSelectOS }) => {
  const { dark } = useTheme();
  const [period, setPeriod] = useState('all');
  const [customRange, setCustomRange] = useState({ start: toInputDate(Date.now() - 7 * DAY_MS), end: toInputDate(Date.now()) });
  const [selectedTypeRow, setSelectedTypeRow] = useState(null);
  const [rankingSearch, setRankingSearch] = useState('');
  const [durationSearch, setDurationSearch] = useState('');
  const [coverageSearch, setCoverageSearch] = useState('');
  const [rankingSort, setRankingSort] = useState({ key: 'total', dir: 'desc' });
  const [durationSort, setDurationSort] = useState({ key: 'avgHours', dir: 'desc' });
  const [coverageSort, setCoverageSort] = useState({ key: 'ratioNum', dir: 'desc' });

  const window = useMemo(() => buildWindow(period, customRange), [period, customRange]);
  const scoped = useMemo(() => filterOrdersByWindow(orders, window, 'createdAt'), [orders, window]);
  const analytics = useMemo(() => buildTypeAnalytics(scoped), [scoped]);
  const metricCardClass = cn('rounded-xl border p-3 md:p-4', dark ? 'bg-[#111b2e]/75 border-slate-700/60' : 'bg-white border-slate-200');
  const metricLabelClass = cn('text-[10px] uppercase font-bold tracking-wider', dark ? 'text-slate-500' : 'text-slate-400');
  const sectionCardClass = cn('rounded-xl border shadow-sm overflow-hidden', dark ? 'bg-[#111b2e]/75 border-slate-700/60' : 'bg-white border-slate-200');
  const sectionHeaderClass = cn('px-5 py-4 border-b flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3', dark ? 'border-slate-700/60 bg-[#0d1628]/80' : 'border-slate-200 bg-slate-50/50');
  const tableHeadClass = cn('text-[11px] uppercase tracking-wide font-semibold', dark ? 'bg-[#0d1628]/90 text-slate-400' : 'bg-slate-50 text-slate-500');
  const tableBodyClass = cn('divide-y', dark ? 'divide-slate-700/50' : 'divide-slate-100');
  const tableRowClass = cn(dark ? 'hover:bg-white/[0.03]' : 'hover:bg-slate-50');

  const parseAvgHours = (value) => Number(String(value || '0').replace('h', '')) || 0;
  const toggleSort = (setter, key) => {
    setter((prev) => (prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'desc' }));
  };
  const sortIcon = (state, key) => (state.key === key ? (state.dir === 'asc' ? '↑' : '↓') : '');

  const rankingRows = useMemo(() => {
    const q = rankingSearch.trim().toLowerCase();
    const total = Math.max(1, analytics.kpis.totalOrders || 0);
    const rows = analytics.volumeRanking
      .map((row) => ({
        ...row,
        sharePct: (Number(row.total || 0) / total) * 100,
      }))
      .filter((row) => !q || String(row.name || '').toLowerCase().includes(q));

    const factor = rankingSort.dir === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
      if (rankingSort.key === 'name') return a.name.localeCompare(b.name, 'pt-BR') * factor;
      if (rankingSort.key === 'sharePct') return (a.sharePct - b.sharePct) * factor;
      return ((Number(a[rankingSort.key] || 0) - Number(b[rankingSort.key] || 0))) * factor;
    });
  }, [analytics, rankingSearch, rankingSort]);

  const durationRows = useMemo(() => {
    const q = durationSearch.trim().toLowerCase();
    const rows = analytics.durationRanking
      .map((row) => ({
        ...row,
        avgHours: parseAvgHours(row.avgTime),
      }))
      .filter((row) => !q || String(row.name || '').toLowerCase().includes(q));

    const factor = durationSort.dir === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
      if (durationSort.key === 'name') return a.name.localeCompare(b.name, 'pt-BR') * factor;
      if (durationSort.key === 'avgHours') return (a.avgHours - b.avgHours) * factor;
      return ((Number(a[durationSort.key] || 0) - Number(b[durationSort.key] || 0))) * factor;
    });
  }, [analytics, durationSearch, durationSort]);

  const coverageRows = useMemo(() => {
    const q = coverageSearch.trim().toLowerCase();
    const rows = analytics.coverage
      .map((row) => ({
        ...row,
        ratioNum: Number(row.ratio || 0),
      }))
      .filter((row) => !q || `${row.name} ${row.topTech}`.toLowerCase().includes(q));

    const factor = coverageSort.dir === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
      if (coverageSort.key === 'name') return a.name.localeCompare(b.name, 'pt-BR') * factor;
      if (coverageSort.key === 'topTech') return String(a.topTech || '').localeCompare(String(b.topTech || ''), 'pt-BR') * factor;
      if (coverageSort.key === 'ratioNum') return (a.ratioNum - b.ratioNum) * factor;
      return ((Number(a[coverageSort.key] || 0) - Number(b[coverageSort.key] || 0))) * factor;
    });
  }, [analytics, coverageSearch, coverageSort]);

  const getDurationSignal = (hours) => {
    if (hours >= 48) return { label: 'Crítico', cls: dark ? 'bg-rose-500/15 text-rose-300 border-rose-500/40' : 'bg-rose-50 text-rose-700 border-rose-200' };
    if (hours >= 24) return { label: 'Alto', cls: dark ? 'bg-amber-500/15 text-amber-300 border-amber-500/40' : 'bg-amber-50 text-amber-700 border-amber-200' };
    if (hours >= 8) return { label: 'Moderado', cls: dark ? 'bg-sky-500/15 text-sky-300 border-sky-500/40' : 'bg-sky-50 text-sky-700 border-sky-200' };
    return { label: 'Saudável', cls: dark ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40' : 'bg-emerald-50 text-emerald-700 border-emerald-200' };
  };

  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="flex flex-col md:flex-row justify-between items-start gap-4">
        <h2 className={cn('text-2xl font-bold tracking-tight', dark ? 'text-slate-100' : 'text-slate-900')}>Tipos de Serviço</h2>
        <WindowControls period={period} setPeriod={setPeriod} customRange={customRange} setCustomRange={setCustomRange} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 px-1">
        <div className={metricCardClass}>
          <div className={metricLabelClass}>Tipos Ativos</div>
          <div className={cn('text-2xl font-bold mt-1', dark ? 'text-slate-100' : 'text-slate-800')}>{analytics.kpis.activeTypes}</div>
        </div>
        <div className={metricCardClass}>
          <div className={metricLabelClass}>Total OS</div>
          <div className={cn('text-2xl font-bold mt-1', dark ? 'text-slate-100' : 'text-slate-800')}>{analytics.kpis.totalOrders}</div>
        </div>
        <div className={metricCardClass}>
          <div className={metricLabelClass}>Tipo Lider</div>
          <div className={cn('text-lg font-bold mt-1', dark ? 'text-indigo-300' : 'text-indigo-700')}>{analytics.kpis.leaderType}</div>
        </div>
        <div className={metricCardClass}>
          <div className={metricLabelClass}>Técnicos Únicos</div>
          <div className={cn('text-2xl font-bold mt-1', dark ? 'text-slate-100' : 'text-slate-800')}>{analytics.kpis.uniqueTechs}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className={sectionCardClass}>
          <div className={sectionHeaderClass}>
            <div>
              <h3 className={cn('font-bold', dark ? 'text-slate-100' : 'text-slate-800')}>Ranking de Tipos</h3>
              <p className={cn('text-xs', dark ? 'text-slate-400' : 'text-slate-500')}>{formatNumber(rankingRows.length)} tipos</p>
            </div>
            <div className="relative w-full sm:w-56">
              <Search className={cn('absolute left-3 top-1/2 -translate-y-1/2', dark ? 'text-slate-500' : 'text-slate-400')} size={14} />
              <input
                value={rankingSearch}
                onChange={(e) => setRankingSearch(e.target.value)}
                placeholder="Buscar tipo..."
                className={cn('w-full pl-9 pr-3 py-2 border rounded-lg text-sm', dark ? 'bg-[#0f172a]/80 border-slate-700/60 text-slate-200 placeholder:text-slate-500' : 'bg-white border-slate-300')}
              />
            </div>
          </div>
          <div className="max-h-96 overflow-auto custom-scrollbar">
            <table className="w-full text-sm text-left">
              <thead className={cn(tableHeadClass, 'sticky top-0 z-10')}>
                <tr>
                  <th className="px-4 py-3 text-right">#</th>
                  <th className="px-4 py-3"><button className="hover:underline" onClick={() => toggleSort(setRankingSort, 'name')}>Tipo {sortIcon(rankingSort, 'name')}</button></th>
                  <th className="px-4 py-3 text-right"><button className="hover:underline" onClick={() => toggleSort(setRankingSort, 'total')}>Volume {sortIcon(rankingSort, 'total')}</button></th>
                  <th className="px-4 py-3 text-right"><button className="hover:underline" onClick={() => toggleSort(setRankingSort, 'sharePct')}>Participação {sortIcon(rankingSort, 'sharePct')}</button></th>
                  <th className="px-4 py-3 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className={tableBodyClass}>
                {rankingRows.map((r, idx) => (
                  <tr key={r.name} className={cn(tableRowClass, 'cursor-pointer')} onClick={() => setSelectedTypeRow(r)}>
                    <td className={cn('px-4 py-3 text-right font-mono', dark ? 'text-slate-500' : 'text-slate-500')}>{idx + 1}</td>
                    <td className="px-4 py-3"><ServiceTypeBadge type={r.name} /></td>
                    <td className={cn('px-4 py-3 text-right font-mono font-semibold', dark ? 'text-cyan-300' : 'text-cyan-700')}>{formatNumber(r.total)}</td>
                    <td className={cn('px-4 py-3 text-right font-mono', dark ? 'text-slate-300' : 'text-slate-600')}>{r.sharePct.toFixed(1)}%</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedTypeRow(r);
                        }}
                        className={cn('inline-flex items-center justify-center w-8 h-8 border rounded-lg',
                          dark ? 'bg-slate-800/80 border-slate-700/60 text-slate-200 hover:bg-slate-700/80' : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50')}
                        title="Ver detalhes"
                      >
                        <Eye size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
                {rankingRows.length === 0 && (
                  <tr>
                    <td colSpan={5} className={cn('px-4 py-8 text-center', dark ? 'text-slate-500' : 'text-slate-400')}>
                      Sem dados para o período selecionado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className={sectionCardClass}>
          <div className={sectionHeaderClass}>
            <div>
              <h3 className={cn('font-bold', dark ? 'text-slate-100' : 'text-slate-800')}>Duração Média por Tipo</h3>
              <p className={cn('text-xs', dark ? 'text-slate-400' : 'text-slate-500')}>{formatNumber(durationRows.length)} tipos</p>
            </div>
            <div className="relative w-full sm:w-56">
              <Search className={cn('absolute left-3 top-1/2 -translate-y-1/2', dark ? 'text-slate-500' : 'text-slate-400')} size={14} />
              <input
                value={durationSearch}
                onChange={(e) => setDurationSearch(e.target.value)}
                placeholder="Buscar tipo..."
                className={cn('w-full pl-9 pr-3 py-2 border rounded-lg text-sm', dark ? 'bg-[#0f172a]/80 border-slate-700/60 text-slate-200 placeholder:text-slate-500' : 'bg-white border-slate-300')}
              />
            </div>
          </div>
          <div className="max-h-96 overflow-auto custom-scrollbar">
            <table className="w-full text-sm text-left">
              <thead className={cn(tableHeadClass, 'sticky top-0 z-10')}>
                <tr>
                  <th className="px-4 py-3 text-right">#</th>
                  <th className="px-4 py-3"><button className="hover:underline" onClick={() => toggleSort(setDurationSort, 'name')}>Tipo {sortIcon(durationSort, 'name')}</button></th>
                  <th className="px-4 py-3 text-right"><button className="hover:underline" onClick={() => toggleSort(setDurationSort, 'avgHours')}>Média (h) {sortIcon(durationSort, 'avgHours')}</button></th>
                  <th className="px-4 py-3 text-right"><button className="hover:underline" onClick={() => toggleSort(setDurationSort, 'total')}>Volume {sortIcon(durationSort, 'total')}</button></th>
                  <th className="px-4 py-3 text-right">Sinal</th>
                </tr>
              </thead>
              <tbody className={tableBodyClass}>
                {durationRows.map((r, idx) => {
                  const signal = getDurationSignal(r.avgHours);
                  return (
                    <tr key={r.name} className={tableRowClass}>
                      <td className={cn('px-4 py-3 text-right font-mono', dark ? 'text-slate-500' : 'text-slate-500')}>{idx + 1}</td>
                      <td className="px-4 py-3"><button className={cn('text-left hover:underline', dark ? 'text-slate-100' : 'text-slate-800')} onClick={() => setSelectedTypeRow(r)}>{r.name}</button></td>
                      <td className={cn('px-4 py-3 text-right font-mono font-semibold', dark ? 'text-amber-300' : 'text-amber-700')}>{r.avgHours.toFixed(1)}</td>
                      <td className={cn('px-4 py-3 text-right font-mono', dark ? 'text-slate-300' : 'text-slate-600')}>{formatNumber(r.total)}</td>
                      <td className="px-4 py-3 text-right">
                        <span className={cn('px-2 py-1 rounded text-[11px] font-semibold border', signal.cls)}>{signal.label}</span>
                      </td>
                    </tr>
                  );
                })}
                {durationRows.length === 0 && (
                  <tr>
                    <td colSpan={5} className={cn('px-4 py-8 text-center', dark ? 'text-slate-500' : 'text-slate-400')}>
                      Sem dados de duração para o período selecionado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className={sectionCardClass}>
          <div className={sectionHeaderClass}>
            <div>
              <h3 className={cn('font-bold', dark ? 'text-slate-100' : 'text-slate-800')}>Cobertura Técnica por Tipo</h3>
              <p className={cn('text-xs', dark ? 'text-slate-400' : 'text-slate-500')}>{formatNumber(coverageRows.length)} tipos</p>
            </div>
            <div className="relative w-full sm:w-56">
              <Search className={cn('absolute left-3 top-1/2 -translate-y-1/2', dark ? 'text-slate-500' : 'text-slate-400')} size={14} />
              <input
                value={coverageSearch}
                onChange={(e) => setCoverageSearch(e.target.value)}
                placeholder="Tipo ou técnico..."
                className={cn('w-full pl-9 pr-3 py-2 border rounded-lg text-sm', dark ? 'bg-[#0f172a]/80 border-slate-700/60 text-slate-200 placeholder:text-slate-500' : 'bg-white border-slate-300')}
              />
            </div>
          </div>
          <div className="max-h-96 overflow-auto custom-scrollbar">
            <table className="w-full text-sm text-left">
              <thead className={cn(tableHeadClass, 'sticky top-0 z-10')}>
                <tr>
                  <th className="px-4 py-3"><button className="hover:underline" onClick={() => toggleSort(setCoverageSort, 'name')}>Tipo {sortIcon(coverageSort, 'name')}</button></th>
                  <th className="px-4 py-3 text-right"><button className="hover:underline" onClick={() => toggleSort(setCoverageSort, 'total')}>Volume {sortIcon(coverageSort, 'total')}</button></th>
                  <th className="px-4 py-3 text-right"><button className="hover:underline" onClick={() => toggleSort(setCoverageSort, 'techs')}>Técnicos {sortIcon(coverageSort, 'techs')}</button></th>
                  <th className="px-4 py-3 text-right"><button className="hover:underline" onClick={() => toggleSort(setCoverageSort, 'ratioNum')}>Carga/Téc {sortIcon(coverageSort, 'ratioNum')}</button></th>
                  <th className="px-4 py-3"><button className="hover:underline" onClick={() => toggleSort(setCoverageSort, 'topTech')}>Técnico líder {sortIcon(coverageSort, 'topTech')}</button></th>
                </tr>
              </thead>
              <tbody className={tableBodyClass}>
                {coverageRows.map((r) => (
                  <tr key={r.name} className={cn(tableRowClass, 'cursor-pointer')} onClick={() => setSelectedTypeRow(r)}>
                    <td className="px-4 py-3"><ServiceTypeBadge type={r.name} /></td>
                    <td className={cn('px-4 py-3 text-right font-mono font-semibold', dark ? 'text-cyan-300' : 'text-cyan-700')}>{formatNumber(r.total)}</td>
                    <td className={cn('px-4 py-3 text-right font-mono', dark ? 'text-slate-300' : 'text-slate-600')}>{formatNumber(r.techs)}</td>
                    <td className={cn('px-4 py-3 text-right font-mono', dark ? 'text-slate-300' : 'text-slate-600')}>{r.ratioNum.toFixed(1)}</td>
                    <td className={cn('px-4 py-3', dark ? 'text-slate-200' : 'text-slate-700')}>{r.topTech}</td>
                  </tr>
                ))}
                {coverageRows.length === 0 && (
                  <tr>
                    <td colSpan={5} className={cn('px-4 py-8 text-center', dark ? 'text-slate-500' : 'text-slate-400')}>
                      Sem dados de cobertura para o período selecionado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {selectedTypeRow && <ServiceTypeDrilldownDrawer row={selectedTypeRow} orders={scoped} onClose={() => setSelectedTypeRow(null)} onSelectOS={onSelectOS} />}
    </div>
  );
};

const SLAView = ({ orders, onSelectOS }) => {
  const { dark } = useTheme();
  const [period, setPeriod] = useState('all');
  const [customRange, setCustomRange] = useState({ start: toInputDate(Date.now() - 7 * DAY_MS), end: toInputDate(Date.now()) });
  const [selectedBucket, setSelectedBucket] = useState(null);
  const [impactSearch, setImpactSearch] = useState('');
  const [impactSort, setImpactSort] = useState({ key: 'delayedTotal', dir: 'desc' });
  const [criticalSearch, setCriticalSearch] = useState('');
  const [criticalOnlyInconsistent, setCriticalOnlyInconsistent] = useState(false);
  const [criticalSort, setCriticalSort] = useState({ key: 'delayHours', dir: 'desc' });

  const now = Date.now();
  const window = useMemo(() => buildWindow(period, customRange), [period, customRange]);
  const scoped = useMemo(() => {
    return filterOrdersByWindow(orders, window, 'createdAt');
  }, [orders, window]);
  const sla = useMemo(() => buildSlaAnalytics(scoped, now), [scoped, now]);

  const maxClosed = Math.max(1, ...sla.buckets.closedDelay.map((b) => b.count));
  const maxActive = Math.max(1, ...sla.buckets.activeDelay.map((b) => b.count));
  const closedDelayedTotal = sla.buckets.closedDelay.reduce((acc, row) => acc + Number(row.count || 0), 0);
  const activeDelayedTotal = sla.buckets.activeDelay.reduce((acc, row) => acc + Number(row.count || 0), 0);
  const onTimeCount = Math.max(0, Number(sla.eligible || 0) - closedDelayedTotal);
  const lateRate = sla.eligible > 0 ? (closedDelayedTotal / sla.eligible) * 100 : 0;

  const trendRows = useMemo(() => {
    const map = new Map();
    scoped.filter(isClosed).forEach((orderItem) => {
      if (!orderItem.closedAt) return;
      const day = startOfDay(orderItem.closedAt);
      if (!map.has(day)) map.set(day, { day, totalClosed: 0, late: 0 });
      const row = map.get(day);
      row.totalClosed += 1;
      if (orderItem.deadlineAt && getDelayHours(orderItem, now) > 0) row.late += 1;
    });
    return Array.from(map.values())
      .sort((a, b) => a.day - b.day)
      .map((row) => ({
        ...row,
        date: formatDate(row.day),
        complianceRate: row.totalClosed > 0 ? ((row.totalClosed - row.late) / row.totalClosed) * 100 : 0,
      }));
  }, [scoped, now]);

  const bestDay = trendRows.length ? [...trendRows].sort((a, b) => b.complianceRate - a.complianceRate)[0] : null;
  const worstDay = trendRows.length ? [...trendRows].sort((a, b) => a.complianceRate - b.complianceRate)[0] : null;

  const impactRows = useMemo(() => {
    const map = new Map();
    scoped.forEach((orderItem) => {
      const tech = orderItem.tech || 'Sem analista';
      if (!map.has(tech)) map.set(tech, { technician: tech, osPeriod: 0, delayedTotal: 0, delayHoursTotal: 0 });
      const row = map.get(tech);
      row.osPeriod += 1;
      const delay = Math.max(0, getDelayHours(orderItem, now));
      if (delay > 0) {
        row.delayedTotal += 1;
        row.delayHoursTotal += delay;
      }
    });

    const query = impactSearch.trim().toLowerCase();
    const factor = impactSort.dir === 'asc' ? 1 : -1;
    return Array.from(map.values())
      .map((row) => ({
        ...row,
        delayHoursAvg: row.delayedTotal > 0 ? row.delayHoursTotal / row.delayedTotal : 0,
      }))
      .filter((row) => !query || row.technician.toLowerCase().includes(query))
      .sort((a, b) => {
        if (impactSort.key === 'technician') return a.technician.localeCompare(b.technician, 'pt-BR') * factor;
        return ((Number(a[impactSort.key] || 0) - Number(b[impactSort.key] || 0))) * factor;
      });
  }, [scoped, now, impactSearch, impactSort]);

  const criticalRows = useMemo(() => {
    const query = criticalSearch.trim().toLowerCase();
    const factor = criticalSort.dir === 'asc' ? 1 : -1;
    return sla.criticalOverdue
      .filter((row) => !criticalOnlyInconsistent || Boolean(row.isInconsistent || row.is_inconsistent))
      .filter((row) => {
        if (!query) return true;
        return [
          String(row.protocol || ''),
          String(row.provider || ''),
          String(row.tech || ''),
          String(row.type || ''),
        ].some((field) => field.toLowerCase().includes(query));
      })
      .map((row) => ({
        ...row,
        delayHours: getDelayHours(row, now),
      }))
      .sort((a, b) => {
        if (criticalSort.key === 'protocol') return String(a.protocol || '').localeCompare(String(b.protocol || ''), 'pt-BR') * factor;
        if (criticalSort.key === 'provider') return String(a.provider || '').localeCompare(String(b.provider || ''), 'pt-BR') * factor;
        if (criticalSort.key === 'tech') return String(a.tech || '').localeCompare(String(b.tech || ''), 'pt-BR') * factor;
        if (criticalSort.key === 'deadlineAt') return ((a.deadlineAt || Infinity) - (b.deadlineAt || Infinity)) * factor;
        if (criticalSort.key === 'delayHours') return (a.delayHours - b.delayHours) * factor;
        return 0;
      });
  }, [sla, criticalOnlyInconsistent, criticalSearch, criticalSort, now]);

  const toggleSort = (setter, key) => {
    setter((prev) => (prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'desc' }));
  };
  const sortIcon = (state, key) => (state.key === key ? (state.dir === 'asc' ? '↑' : '↓') : '');

  const statsGridClass = 'grid grid-cols-2 lg:grid-cols-6 gap-3';
  const metricCardClass = cn('p-4 rounded-xl border', dark ? 'bg-[#111b2e]/75 border-slate-700/60' : 'bg-white border-slate-200');
  const metricLabelClass = cn('text-[10px] uppercase font-bold tracking-wider', dark ? 'text-slate-500' : 'text-slate-400');
  const sectionCardClass = cn('rounded-xl border shadow-sm', dark ? 'bg-[#111b2e]/75 border-slate-700/60' : 'bg-white border-slate-200');
  const sectionHeaderClass = cn('px-6 py-3 border-b text-sm font-semibold tracking-wide flex items-center justify-between gap-2', dark ? 'bg-[#0d1628]/80 border-slate-700/60 text-slate-200' : 'bg-slate-50/50 text-slate-700');
  const tableHeadClass = cn('text-[11px] uppercase tracking-wide font-semibold', dark ? 'bg-[#0d1628]/95 text-slate-400' : 'bg-slate-50 text-slate-500');
  const tableBodyClass = cn('divide-y', dark ? 'divide-slate-700/50' : 'divide-slate-100');
  const tableRowClass = cn(dark ? 'hover:bg-white/[0.03]' : 'hover:bg-slate-50');

  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="flex flex-col md:flex-row justify-between items-start gap-4">
        <h2 className={cn('text-2xl font-bold', dark ? 'text-slate-100' : 'text-slate-900')}>Monitor SLA</h2>
        <WindowControls period={period} setPeriod={setPeriod} customRange={customRange} setCustomRange={setCustomRange} />
      </div>

      <div className={statsGridClass}>
        <div className={metricCardClass}>
          <div className={metricLabelClass}>Score SLA</div>
          <div className={cn('text-3xl font-bold mt-1', dark ? 'text-emerald-300' : 'text-emerald-600')}>{sla.score}%</div>
        </div>
        <div className={metricCardClass}>
          <div className={metricLabelClass}>Encerradas</div>
          <div className={cn('text-2xl font-bold mt-1', dark ? 'text-slate-100' : 'text-slate-800')}>{sla.closedWindow}</div>
        </div>
        <div className={metricCardClass}>
          <div className={metricLabelClass}>Com Prazo</div>
          <div className={cn('text-2xl font-bold mt-1', dark ? 'text-cyan-300' : 'text-cyan-700')}>{sla.eligible}</div>
        </div>
        <div className={metricCardClass}>
          <div className={metricLabelClass}>Sem Prazo</div>
          <div className={cn('text-2xl font-bold mt-1', dark ? 'text-slate-100' : 'text-slate-800')}>{sla.noDeadline}</div>
        </div>
        <div className={metricCardClass}>
          <div className={metricLabelClass}>No Prazo</div>
          <div className={cn('text-2xl font-bold mt-1', dark ? 'text-emerald-300' : 'text-emerald-700')}>{onTimeCount}</div>
        </div>
        <div className={metricCardClass}>
          <div className={metricLabelClass}>Com Atraso</div>
          <div className={cn('text-2xl font-bold mt-1', dark ? 'text-rose-300' : 'text-rose-700')}>{closedDelayedTotal}</div>
          <div className={cn('text-xs mt-1 font-semibold', dark ? 'text-amber-300' : 'text-amber-700')}>Taxa: {lateRate.toFixed(1)}%</div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className={cn(sectionCardClass, 'p-6')}>
          <div className="flex items-center justify-between mb-5">
            <h3 className={cn('font-bold', dark ? 'text-slate-100' : 'text-slate-800')}>Distribuição de Atrasos</h3>
            <span className={cn('text-xs', dark ? 'text-slate-400' : 'text-slate-500')}>
              Ativas atrasadas: <strong className={dark ? 'text-rose-300' : 'text-rose-700'}>{formatNumber(activeDelayedTotal)}</strong>
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <h4 className={cn('text-sm font-bold uppercase mb-3 flex items-center', dark ? 'text-slate-300' : 'text-slate-700')}>
                <CheckCircle size={16} className={cn('mr-2', dark ? 'text-amber-300' : 'text-amber-600')} />
                Fechadas com Atraso
              </h4>
              <div className="space-y-3">
                {sla.buckets.closedDelay.map((b) => (
                  <div key={b.label} className="flex justify-between items-center group">
                    <span className={cn('text-sm font-medium w-16', dark ? 'text-slate-400' : 'text-slate-600')}>{b.label}</span>
                    <div className={cn('flex-1 mx-4 h-2 rounded-full overflow-hidden', dark ? 'bg-slate-800' : 'bg-slate-100')}>
                      <div className="bg-amber-400 h-full" style={{ width: `${(b.count / maxClosed) * 100}%` }} />
                    </div>
                    <button onClick={() => setSelectedBucket(b)} className={cn('px-3 py-1 rounded font-bold text-xs',
                      dark ? 'bg-amber-500/10 text-amber-300 hover:bg-amber-500/20' : 'bg-amber-50 text-amber-700 hover:bg-amber-100')}>
                      {b.count}
                    </button>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h4 className={cn('text-sm font-bold uppercase mb-3 flex items-center', dark ? 'text-slate-300' : 'text-slate-700')}>
                <AlertTriangle size={16} className={cn('mr-2', dark ? 'text-rose-300' : 'text-rose-500')} />
                Ativas Atrasadas
              </h4>
              <div className="space-y-3">
                {sla.buckets.activeDelay.map((b) => (
                  <div key={b.label} className="flex justify-between items-center group">
                    <span className={cn('text-sm font-medium w-16', dark ? 'text-slate-400' : 'text-slate-600')}>{b.label}</span>
                    <div className={cn('flex-1 mx-4 h-2 rounded-full overflow-hidden', dark ? 'bg-slate-800' : 'bg-slate-100')}>
                      <div className="bg-rose-500 h-full" style={{ width: `${(b.count / maxActive) * 100}%` }} />
                    </div>
                    <button onClick={() => setSelectedBucket(b)} className={cn('px-3 py-1 rounded font-bold text-xs',
                      dark ? 'bg-rose-500/10 text-rose-300 hover:bg-rose-500/20' : 'bg-rose-50 text-rose-700 hover:bg-rose-100')}>
                      {b.count}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className={sectionCardClass}>
          <div className={sectionHeaderClass}>
            <span>Tendência de Cumprimento</span>
            <span className={cn('text-xs font-medium', dark ? 'text-slate-400' : 'text-slate-500')}>
              {formatNumber(trendRows.length)} dia(s)
            </span>
          </div>
          <div className="p-5 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className={cn('rounded-lg border p-3', dark ? 'bg-slate-800/40 border-slate-700/60' : 'bg-slate-50 border-slate-200')}>
                <p className={cn('text-[10px] uppercase', dark ? 'text-slate-500' : 'text-slate-500')}>Melhor dia</p>
                <p className={cn('text-sm font-semibold', dark ? 'text-emerald-300' : 'text-emerald-700')}>
                  {bestDay ? `${bestDay.date} (${bestDay.complianceRate.toFixed(1)}%)` : '-'}
                </p>
              </div>
              <div className={cn('rounded-lg border p-3', dark ? 'bg-slate-800/40 border-slate-700/60' : 'bg-slate-50 border-slate-200')}>
                <p className={cn('text-[10px] uppercase', dark ? 'text-slate-500' : 'text-slate-500')}>Pior dia</p>
                <p className={cn('text-sm font-semibold', dark ? 'text-rose-300' : 'text-rose-700')}>
                  {worstDay ? `${worstDay.date} (${worstDay.complianceRate.toFixed(1)}%)` : '-'}
                </p>
              </div>
            </div>
            <div className="max-h-64 overflow-auto custom-scrollbar">
              <table className="w-full text-sm text-left">
                <thead className={tableHeadClass}>
                  <tr>
                    <th className="px-4 py-3">Data</th>
                    <th className="px-4 py-3 text-right">Encerradas</th>
                    <th className="px-4 py-3 text-right">Atrasadas</th>
                    <th className="px-4 py-3 text-right">SLA %</th>
                  </tr>
                </thead>
                <tbody className={tableBodyClass}>
                  {trendRows.map((row) => (
                    <tr key={row.day} className={tableRowClass}>
                      <td className={cn('px-4 py-3', dark ? 'text-slate-300' : 'text-slate-700')}>{row.date}</td>
                      <td className={cn('px-4 py-3 text-right', dark ? 'text-slate-200' : 'text-slate-700')}>{formatNumber(row.totalClosed)}</td>
                      <td className={cn('px-4 py-3 text-right', dark ? 'text-rose-300' : 'text-rose-700')}>{formatNumber(row.late)}</td>
                      <td className={cn('px-4 py-3 text-right font-semibold', row.complianceRate >= 90 ? (dark ? 'text-emerald-300' : 'text-emerald-700') : row.complianceRate >= 75 ? (dark ? 'text-amber-300' : 'text-amber-700') : (dark ? 'text-rose-300' : 'text-rose-700'))}>
                        {row.complianceRate.toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                  {trendRows.length === 0 && (
                    <tr>
                      <td colSpan={4} className={cn('px-4 py-8 text-center', dark ? 'text-slate-500' : 'text-slate-400')}>
                        Sem tendência diária para o período selecionado.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <div className={cn(sectionCardClass, 'overflow-hidden')}>
        <div className={sectionHeaderClass}>
          <div>
            <span>Técnicos com Maior Impacto de Atraso</span>
            <p className={cn('text-[11px] font-normal mt-0.5', dark ? 'text-slate-400' : 'text-slate-500')}>Top {formatNumber(impactRows.length)} no período</p>
          </div>
          <div className="relative w-full sm:w-64">
            <Search className={cn('absolute left-3 top-1/2 -translate-y-1/2', dark ? 'text-slate-500' : 'text-slate-400')} size={14} />
            <input
              value={impactSearch}
              onChange={(e) => setImpactSearch(e.target.value)}
              placeholder="Buscar técnico..."
              className={cn('w-full pl-9 pr-3 py-1.5 border rounded-lg text-sm', dark ? 'bg-[#0f172a]/80 border-slate-700/60 text-slate-200 placeholder:text-slate-500' : 'bg-white border-slate-300')}
            />
          </div>
        </div>
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-sm">
            <thead className={tableHeadClass}>
              <tr>
                <th className="px-6 py-3 text-left"><button className="hover:underline" onClick={() => toggleSort(setImpactSort, 'technician')}>Técnico {sortIcon(impactSort, 'technician')}</button></th>
                <th className="px-6 py-3 text-right"><button className="hover:underline" onClick={() => toggleSort(setImpactSort, 'osPeriod')}>OS no Período {sortIcon(impactSort, 'osPeriod')}</button></th>
                <th className="px-6 py-3 text-right"><button className="hover:underline" onClick={() => toggleSort(setImpactSort, 'delayedTotal')}>Atrasadas {sortIcon(impactSort, 'delayedTotal')}</button></th>
                <th className="px-6 py-3 text-right"><button className="hover:underline" onClick={() => toggleSort(setImpactSort, 'delayHoursTotal')}>Horas (Total) {sortIcon(impactSort, 'delayHoursTotal')}</button></th>
                <th className="px-6 py-3 text-right"><button className="hover:underline" onClick={() => toggleSort(setImpactSort, 'delayHoursAvg')}>Horas (Média) {sortIcon(impactSort, 'delayHoursAvg')}</button></th>
              </tr>
            </thead>
            <tbody className={tableBodyClass}>
              {impactRows.map((row) => (
                <tr key={row.technician} className={tableRowClass}>
                  <td className={cn('px-6 py-3 font-medium', dark ? 'text-slate-100' : 'text-slate-800')}>{row.technician}</td>
                  <td className={cn('px-6 py-3 text-right', dark ? 'text-slate-300' : 'text-slate-600')}>{formatNumber(row.osPeriod)}</td>
                  <td className={cn('px-6 py-3 text-right font-semibold', dark ? 'text-rose-300' : 'text-rose-700')}>{formatNumber(row.delayedTotal)}</td>
                  <td className={cn('px-6 py-3 text-right', dark ? 'text-amber-300' : 'text-amber-700')}>{row.delayHoursTotal.toFixed(2)}</td>
                  <td className={cn('px-6 py-3 text-right', dark ? 'text-slate-300' : 'text-slate-600')}>{row.delayHoursAvg.toFixed(2)}</td>
                </tr>
              ))}
              {impactRows.length === 0 && (
                <tr>
                  <td colSpan={5} className={cn('px-6 py-8 text-center', dark ? 'text-slate-500' : 'text-slate-400')}>
                    Sem dados de atraso de técnicos no período.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className={cn(sectionCardClass, 'overflow-hidden')}>
        <div className={sectionHeaderClass}>
          <div>
            <span>Top Críticas Atrasadas</span>
            <p className={cn('text-[11px] font-normal mt-0.5', dark ? 'text-slate-400' : 'text-slate-500')}>
              {formatNumber(criticalRows.length)} O.S
            </p>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full sm:w-auto">
            <label className={cn('text-xs flex items-center gap-2 select-none', dark ? 'text-slate-300' : 'text-slate-600')}>
              <input
                type="checkbox"
                checked={criticalOnlyInconsistent}
                onChange={(e) => setCriticalOnlyInconsistent(e.target.checked)}
                className="accent-rose-500"
              />
              Somente inconsistentes
            </label>
            <div className="relative w-full sm:w-72">
              <Search className={cn('absolute left-3 top-1/2 -translate-y-1/2', dark ? 'text-slate-500' : 'text-slate-400')} size={14} />
              <input
                value={criticalSearch}
                onChange={(e) => setCriticalSearch(e.target.value)}
                placeholder="Buscar protocolo, provedor..."
                className={cn('w-full pl-9 pr-3 py-1.5 border rounded-lg text-sm',
                  dark ? 'bg-[#0f172a]/80 border-slate-700/60 text-slate-200 placeholder:text-slate-500' : 'bg-white border-slate-300')}
              />
            </div>
          </div>
        </div>
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-sm">
            <thead className={tableHeadClass}>
              <tr>
                <th className="px-6 py-3 text-left"><button className="hover:underline" onClick={() => toggleSort(setCriticalSort, 'protocol')}>Protocolo {sortIcon(criticalSort, 'protocol')}</button></th>
                <th className="px-6 py-3 text-left"><button className="hover:underline" onClick={() => toggleSort(setCriticalSort, 'provider')}>Provedor {sortIcon(criticalSort, 'provider')}</button></th>
                <th className="px-6 py-3 text-left"><button className="hover:underline" onClick={() => toggleSort(setCriticalSort, 'tech')}>Técnico {sortIcon(criticalSort, 'tech')}</button></th>
                <th className="px-6 py-3 text-right"><button className="hover:underline" onClick={() => toggleSort(setCriticalSort, 'deadlineAt')}>Vencimento {sortIcon(criticalSort, 'deadlineAt')}</button></th>
                <th className="px-6 py-3 text-right"><button className="hover:underline" onClick={() => toggleSort(setCriticalSort, 'delayHours')}>Atraso (h) {sortIcon(criticalSort, 'delayHours')}</button></th>
                <th className="px-6 py-3 text-center">Ação</th>
              </tr>
            </thead>
            <tbody className={tableBodyClass}>
              {criticalRows.map((o) => (
                <tr key={o.id} className={tableRowClass}>
                  <td className={cn('px-6 py-3 font-mono', dark ? 'text-rose-200' : 'text-rose-700')}>
                    {o.protocol}
                    {(o.isInconsistent || o.is_inconsistent) && (
                      <span className={cn('ml-2 px-2 py-0.5 rounded-full text-[10px] font-bold border',
                        dark ? 'bg-rose-500/10 text-rose-300 border-rose-500/20' : 'bg-rose-50 text-rose-700 border-rose-200')}>
                        INCONSISTENTE
                      </span>
                    )}
                  </td>
                  <td className={cn('px-6 py-3', dark ? 'text-slate-300' : 'text-slate-700')}>{o.provider}</td>
                  <td className={cn('px-6 py-3', dark ? 'text-slate-300' : 'text-slate-700')}>{o.tech || '-'}</td>
                  <td className={cn('px-6 py-3 text-right font-mono text-xs', dark ? 'text-slate-400' : 'text-slate-600')}>
                    {o.deadlineAt ? formatDateTime(o.deadlineAt) : '-'}
                  </td>
                  <td className={cn('px-6 py-3 text-right font-mono font-bold', dark ? 'text-rose-300' : 'text-rose-700')}>
                    {o.delayHours.toFixed(2)}
                  </td>
                  <td className="px-6 py-3 text-center">
                    <button onClick={() => onSelectOS(o)} className={cn('px-3 py-1 border rounded text-[10px] font-bold',
                      dark ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/20' : 'bg-cyan-50 border-cyan-200 text-cyan-700 hover:bg-cyan-100')}>
                      Ver
                    </button>
                  </td>
                </tr>
              ))}
              {criticalRows.length === 0 && (
                <tr>
                  <td colSpan={6} className={cn('px-6 py-8 text-center', dark ? 'text-slate-500' : 'text-slate-400')}>
                    Nenhuma crítica atrasada para os filtros atuais.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedBucket && <SLABucketDrawer bucket={selectedBucket} onClose={() => setSelectedBucket(null)} onSelectOS={onSelectOS} />}
    </div>
  );
};

const ReportsView = ({ orders, tenants, isSuperAdmin }) => {
  const { dark } = useTheme();
  const [period, setPeriod] = useState('all');
  const [customRange, setCustomRange] = useState({ start: toInputDate(Date.now() - 30 * DAY_MS), end: toInputDate(Date.now()) });
  const [statusFilter, setStatusFilter] = useState('Todos');
  const [tenantFilter, setTenantFilter] = useState('Todos');
  const [format, setFormat] = useState('excel_csv');
  const [generating, setGenerating] = useState(false);

  const window = useMemo(() => buildWindow(period, customRange), [period, customRange]);

  const filtered = useMemo(() => {
    const inWindow = filterOrdersByWindow(orders, window, 'createdAt');
    return inWindow.filter((o) => {
      const byStatus = statusFilter === 'Todos' ? true : statusFilter === 'Ativas' ? isActive(o) : isClosed(o);
      const byTenant = tenantFilter === 'Todos' ? true : o.provider === tenantFilter;
      return byStatus && byTenant;
    });
  }, [orders, window, statusFilter, tenantFilter]);

  const summary = useMemo(() => {
    const active = filtered.filter(isActive).length;
    const closed = filtered.filter(isClosed).length;
    const delayed = filtered.filter((o) => isOverdueActive(o)).length;
    return { total: filtered.length, active, closed, delayed };
  }, [filtered]);

  const toCsv = (rows) => {
    const header = [
      'id',
      'protocol',
      'provider',
      'tech',
      'type',
      'priority',
      'status',
      'sgp_status',
      'created_at',
      'deadline_at',
      'closed_at',
      'delay_hours',
      'client_name',
    ];

    const body = rows.map((o) =>
      [
        o.id,
        o.protocol,
        o.provider,
        o.tech || '',
        o.type,
        o.priority,
        o.status,
        o.sgpStatus,
        formatDateTime(o.createdAt),
        o.deadlineAt ? formatDateTime(o.deadlineAt) : '',
        o.closedAt ? formatDateTime(o.closedAt) : '',
        getDelayHours(o).toFixed(2),
        o.clientName || '',
      ]
        .map((cell) => `"${String(cell).replaceAll('"', '""')}"`)
        .join(',')
    );

    return [header.join(','), ...body].join('\n');
  };

  const handleExport = () => {
    setGenerating(true);
    setTimeout(() => {
      const csv = toCsv(filtered);
      const withBom = format === 'excel_csv' ? `\uFEFF${csv}` : csv;
      const blob = new Blob([withBom], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `relatorio_global_${Date.now()}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      setGenerating(false);
    }, 700);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in duration-500">
      <div>
        <h2 className={cn('text-2xl font-bold', dark ? 'text-slate-100' : 'text-slate-900')}>Relatórios Globais</h2>
        <p className={cn('text-sm', dark ? 'text-slate-400' : 'text-slate-500')}>Exportacao operacional com filtros e recorte temporal.</p>
      </div>

      <div className={cn('rounded-xl border p-5 space-y-4 shadow-sm', dark ? 'bg-[#111b2e]/75 border-slate-700/60' : 'bg-white border-slate-200')}>
        <WindowControls period={period} setPeriod={setPeriod} customRange={customRange} setCustomRange={setCustomRange} />

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={cn('border rounded-lg px-3 py-2 text-sm', dark ? 'bg-[#0d1628]/80 border-slate-700/60 text-slate-200' : 'border-slate-300')}>
            <option>Todos</option>
            <option>Ativas</option>
            <option>Fechadas</option>
          </select>

          {isSuperAdmin && (
            <select value={tenantFilter} onChange={(e) => setTenantFilter(e.target.value)} className={cn('border rounded-lg px-3 py-2 text-sm', dark ? 'bg-[#0d1628]/80 border-slate-700/60 text-slate-200' : 'border-slate-300')}>
              <option>Todos</option>
              {tenants.map((t) => (
                <option key={t.id}>{t.name}</option>
              ))}
            </select>
          )}

          <select value={format} onChange={(e) => setFormat(e.target.value)} className={cn('border rounded-lg px-3 py-2 text-sm', dark ? 'bg-[#0d1628]/80 border-slate-700/60 text-slate-200' : 'border-slate-300')}>
            <option value="excel_csv">Excel (CSV UTF-8)</option>
            <option value="csv">CSV</option>
          </select>

          <button onClick={handleExport} disabled={generating} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60">
            {generating ? <RefreshCw size={16} className="animate-spin" /> : <Download size={16} />}
            {generating ? 'Gerando...' : 'Exportar'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className={cn('border rounded-xl p-4', dark ? 'bg-[#111b2e]/75 border-slate-700/60' : 'bg-white')}>
          <div className={cn('text-[10px] uppercase font-bold', dark ? 'text-slate-500' : 'text-slate-400')}>Total</div>
          <div className={cn('text-2xl font-bold', dark ? 'text-slate-100' : 'text-slate-900')}>{formatNumber(summary.total)}</div>
        </div>
        <div className={cn('border rounded-xl p-4', dark ? 'bg-[#111b2e]/75 border-slate-700/60' : 'bg-white')}>
          <div className={cn('text-[10px] uppercase font-bold', dark ? 'text-slate-500' : 'text-slate-400')}>Ativas</div>
          <div className={cn('text-2xl font-bold', dark ? 'text-blue-300' : 'text-blue-700')}>{formatNumber(summary.active)}</div>
        </div>
        <div className={cn('border rounded-xl p-4', dark ? 'bg-[#111b2e]/75 border-slate-700/60' : 'bg-white')}>
          <div className={cn('text-[10px] uppercase font-bold', dark ? 'text-slate-500' : 'text-slate-400')}>Fechadas</div>
          <div className={cn('text-2xl font-bold', dark ? 'text-emerald-300' : 'text-emerald-700')}>{formatNumber(summary.closed)}</div>
        </div>
        <div className={cn('border rounded-xl p-4', dark ? 'bg-[#111b2e]/75 border-slate-700/60' : 'bg-white')}>
          <div className={cn('text-[10px] uppercase font-bold', dark ? 'text-slate-500' : 'text-slate-400')}>Atrasadas</div>
          <div className={cn('text-2xl font-bold', dark ? 'text-rose-300' : 'text-rose-700')}>{formatNumber(summary.delayed)}</div>
        </div>
      </div>

      <div className={cn('rounded-xl border p-5 shadow-sm text-sm', dark ? 'bg-[#111b2e]/75 border-slate-700/60 text-slate-300' : 'bg-white border-slate-200 text-slate-600')}>
        <p className={cn('font-semibold mb-2', dark ? 'text-slate-100' : 'text-slate-800')}>O que o relatorio entrega:</p>
        <ul className="list-disc list-inside space-y-1">
          <li>Resumo de volume por status no recorte escolhido.</li>
          <li>Tabela operacional completa por OS (provedor, tecnico, SLA e timestamps).</li>
          <li>Arquivo de download para validação visual do fluxo de exportação.</li>
        </ul>
      </div>
    </div>
  );
};

const TenantManagementView = ({ tenants, orders, notify, onReloadTenants }) => (
  <TenantManagementViewModule
    tenants={tenants}
    orders={orders}
    notify={notify}
    onReloadTenants={onReloadTenants}
    helpers={{
      useTheme,
      Search,
      RefreshCw,
      Plus,
      Badge,
      Modal,
      formatNumber,
      formatDate,
      isActive,
      slugify,
      readApiErrorMessage,
      mapApiTenantUser,
      ROLE_CODE_TO_LABEL,
    }}
  />
);

const SettingsView = ({ role, notify, tenantId }) => (
  <SettingsViewModule
    role={role}
    notify={notify}
    tenantId={tenantId}
    helpers={{
      useTheme,
      canManageUsersByRole,
      readApiErrorMessage,
      mapApiTenantUser,
      ROLE_CODE_TO_LABEL,
      cn,
      Settings,
      RefreshCw,
      UserCog,
      Plus,
      Users,
      Badge,
      Modal,
    }}
  />
);

const AnalystDashboardView = ({ orders, onSelectOS, loading, currentUserName }) => {
  const normalizeName = (value) => String(value || '').trim().toLowerCase();
  const currentName = normalizeName(currentUserName);
  const rows = currentName
    ? orders.filter((o) => normalizeName(o.tech) === currentName).slice(0, 8)
    : [];

  if (loading) return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div><h2 className="text-2xl font-bold text-slate-900">Meu Painel</h2><p className="text-sm text-slate-500">Carregando dados...</p></div>
      <SkeletonKpiCards count={4} />
      <SkeletonTable rows={5} />
    </div>
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Meu Painel</h2>
        <p className="text-sm text-slate-500">Resumo operacional do analista.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white border rounded-xl p-5">
          <div className="text-xs uppercase text-slate-400 font-bold">Pendencias</div>
          <div className="text-3xl font-bold text-slate-800 mt-2">{formatNumber(rows.filter(isActive).length)}</div>
        </div>
        <div className="bg-white border rounded-xl p-5 border-rose-100">
          <div className="text-xs uppercase text-rose-500 font-bold">Vencidas</div>
          <div className="text-3xl font-bold text-rose-600 mt-2">{formatNumber(rows.filter((o) => isOverdueActive(o)).length)}</div>
        </div>
        <div className="bg-white border rounded-xl p-5">
          <div className="text-xs uppercase text-slate-400 font-bold">Finalizadas</div>
          <div className="text-3xl font-bold text-emerald-600 mt-2">{formatNumber(rows.filter(isClosed).length)}</div>
        </div>
        <div className="bg-white border rounded-xl p-5 border-amber-100">
          <div className="text-xs uppercase text-amber-600 font-bold">Vencem Hoje</div>
          <div className="text-3xl font-bold text-amber-600 mt-2">{formatNumber(rows.filter((o) => isDueToday(o)).length)}</div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-3 border-b bg-slate-50/50 font-bold text-slate-700 text-sm">Minhas OS</div>
        <div className="divide-y">
          {rows.length === 0 && (
            <div className="px-6 py-14 text-center">
              <Briefcase size={28} className="mx-auto mb-3 text-slate-300" />
              <p className="text-sm font-medium text-slate-500 mb-1">Nenhuma O.S atribuida a voce.</p>
              <p className="text-xs text-slate-400">Ordens serao exibidas aqui quando forem atribuidas.</p>
            </div>
          )}
          {rows.map((os) => (
            <div key={os.id} className="px-6 py-4 hover:bg-slate-50 flex items-center justify-between">
              <div>
                <div className="font-semibold text-slate-800">{os.protocol} - {os.type}</div>
                <div className="text-xs text-slate-500">{os.provider} • {os.clientName}</div>
              </div>
              <button onClick={() => onSelectOS(os)} className="px-3 py-1 border border-cyan-200 bg-cyan-50 text-cyan-700 rounded text-xs font-bold">
                Detalhes
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const AnalystAjustpediaView = ({ tenantId, notify }) => {
  const { dark } = useTheme();
  const [loading, setLoading] = useState(false);
  const [entries, setEntries] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedTag, setSelectedTag] = useState('Todos');
  const [onlyFav, setOnlyFav] = useState(false);
  const [favorites, setFavorites] = useState([]);
  const [showContrib, setShowContrib] = useState(false);
  const [editingEntryId, setEditingEntryId] = useState(null);
  const [deletingEntryId, setDeletingEntryId] = useState(null);
  const [newEntry, setNewEntry] = useState({
    title: '',
    description: '',
    command: '',
    tags: '',
  });

  const normalizeArticleHeader = (value) => String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  const summarizeDescription = (text) => {
    const firstLine = String(text || '')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find(Boolean) || '';
    if (!firstLine) return 'Sem descricao.';
    return firstLine.length > 220 ? `${firstLine.slice(0, 217)}...` : firstLine;
  };

  const parseArticleContent = (rawContent) => {
    const content = String(rawContent || '').trim();
    if (!content) return { description: 'Sem descricao.', command: '' };
    const lines = content.split(/\r?\n/);
    const normalized = lines.map((line) => normalizeArticleHeader(line));
    const descIdx = normalized.findIndex((line) => line === '## descricao');
    const cmdIdx = normalized.findIndex((line) => line === '## comando');
    if (cmdIdx >= 0) {
      const command = lines.slice(cmdIdx + 1).join('\n').trim();
      const description = descIdx >= 0 && descIdx < cmdIdx ? lines.slice(descIdx + 1, cmdIdx).join('\n').trim() : '';
      return {
        description: description || summarizeDescription(command),
        command,
      };
    }
    return { description: summarizeDescription(content), command: content };
  };

  const serializeArticleContent = (description, command) => {
    const descriptionText = String(description || '').trim();
    const commandText = String(command || '').trim();
    if (!descriptionText) return `## Comando\n${commandText}`;
    return `## Descricao\n${descriptionText}\n\n## Comando\n${commandText}`;
  };

  const mapArticleToEntry = (item) => ({
    ...parseArticleContent(item.content),
    id: item.id,
    title: item.title || 'Sem titulo',
    tags: Array.isArray(item.tags) ? item.tags : [],
    author: item.author?.name || 'Equipe',
    updatedAt: parseDateToTs(item.updatedAt || item.createdAt),
  });

  useEffect(() => {
    if (!tenantId) return;
    let active = true;

    const load = async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/knowledge/articles?tenantId=${encodeURIComponent(tenantId)}&limit=300`, { cache: 'no-store' });
        if (!response.ok) {
          throw new Error(await readApiErrorMessage(response, 'Falha ao carregar Ajustpedia.'));
        }
        const payload = await response.json();
        if (!active) return;

        const mapped = Array.isArray(payload) ? payload.map(mapArticleToEntry) : [];

        setEntries(mapped.sort((a, b) => b.updatedAt - a.updatedAt));
      } catch (error) {
        if (!active) return;
        notify?.(error instanceof Error ? error.message : 'Falha ao carregar Ajustpedia.');
      } finally {
        if (active) setLoading(false);
      }
    };

    load();
    return () => {
      active = false;
    };
  }, [tenantId, notify]);

  const tags = useMemo(() => ['Todos', ...Array.from(new Set(entries.flatMap((entry) => entry.tags)))], [entries]);

  const filteredEntries = useMemo(() => {
    if (loading) return [];
    const q = search.toLowerCase().trim();
    return entries
      .filter((entry) => {
        const byTag = selectedTag === 'Todos' || entry.tags.includes(selectedTag);
        const byFav = !onlyFav || favorites.includes(entry.id);
        const bySearch = !q || `${entry.title} ${entry.description} ${entry.command} ${entry.tags.join(' ')}`.toLowerCase().includes(q);
        return byTag && byFav && bySearch;
      })
      .map((entry) => ({
        id: entry.id,
        title: entry.title,
        tags: entry.tags,
        author: entry.author,
        date: formatDateTime(entry.updatedAt),
        description: entry.description,
        command: entry.command,
      }));
  }, [entries, favorites, loading, onlyFav, search, selectedTag]);

  const toggleFavorite = (id) => {
    setFavorites((prev) => (prev.includes(id) ? prev.filter((currentId) => currentId !== id) : [...prev, id]));
  };

  const copyText = (value) => {
    navigator.clipboard.writeText(value || '').catch(() => { });
    notify?.('Comando copiado.');
  };

  const resetContribForm = () => {
    setEditingEntryId(null);
    setNewEntry({ title: '', description: '', command: '', tags: '' });
  };

  const closeContribModal = () => {
    setShowContrib(false);
    resetContribForm();
  };

  const openCreateContribModal = () => {
    resetContribForm();
    setShowContrib(true);
  };

  const openEditEntryModal = (entry) => {
    setEditingEntryId(entry.id);
    setNewEntry({
      title: entry.title || '',
      description: entry.description || '',
      command: entry.command || '',
      tags: Array.isArray(entry.tags) ? entry.tags.join(', ') : '',
    });
    setShowContrib(true);
  };

  const submitContrib = async (event) => {
    event.preventDefault();
    const title = newEntry.title.trim();
    const command = newEntry.command.trim();
    const description = newEntry.description.trim();
    if (!title || !command) {
      notify?.('Preencha titulo e comando.');
      return;
    }
    if (!tenantId) {
      notify?.('Tenant nao identificado para salvar artigo.');
      return;
    }

    const isEditing = editingEntryId !== null;
    const payload = {
      tenantId,
      title,
      content: serializeArticleContent(description, command),
      tags: newEntry.tags.split(',').map((tagItem) => tagItem.trim()).filter(Boolean),
      isPublished: true,
    };

    try {
      const url = isEditing
        ? `/api/knowledge/articles/${encodeURIComponent(String(editingEntryId))}?tenantId=${encodeURIComponent(tenantId)}`
        : '/api/knowledge/articles';
      const method = isEditing ? 'PATCH' : 'POST';
      const response = await fetch(url, {
        method,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const article = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(article.error || 'Falha ao salvar artigo.');
      }
      const mapped = mapArticleToEntry(article);
      if (isEditing) {
        const editedId = editingEntryId;
        setEntries((prev) => prev.map((entryItem) => (entryItem.id === editedId ? mapped : entryItem)));
        notify?.('Dica atualizada na Ajustpedia.');
      } else {
        setEntries((prev) => [mapped, ...prev]);
        notify?.('Contribuicao salva na Ajustpedia.');
      }
      closeContribModal();
    } catch (error) {
      notify?.(error instanceof Error ? error.message : 'Falha ao salvar contribuicao.');
    }
  };

  const deleteEntry = async (entry) => {
    if (!tenantId) {
      notify?.('Tenant nao identificado para apagar artigo.');
      return;
    }
    const confirmed = window.confirm(`Apagar a dica "${entry.title}"?`);
    if (!confirmed) return;
    setDeletingEntryId(entry.id);
    try {
      const response = await fetch(`/api/knowledge/articles/${encodeURIComponent(String(entry.id))}?tenantId=${encodeURIComponent(tenantId)}`, {
        method: 'DELETE',
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || 'Falha ao apagar artigo.');
      }
      setEntries((prev) => prev.filter((entryItem) => entryItem.id !== entry.id));
      setFavorites((prev) => prev.filter((itemId) => itemId !== entry.id));
      notify?.('Dica apagada da Ajustpedia.');
    } catch (error) {
      notify?.(error instanceof Error ? error.message : 'Falha ao apagar artigo.');
    } finally {
      setDeletingEntryId(null);
    }
  };

  if (loading) {
    return (
      <div className={cn('border rounded-xl p-6 text-sm', dark ? 'bg-[#1e293b]/60 border-slate-700/50 text-slate-400' : 'bg-white border-slate-200 text-slate-500')}>
        Carregando Ajustpedia...
      </div>
    );
  }

  return (
    <>
      <AnalystKnowledgeAjustpediaPanel
        dark={dark}
        tag={selectedTag}
        onlyFav={onlyFav}
        canManage={true}
        tags={tags}
        filteredEntries={filteredEntries}
        favorites={favorites}
        deletingId={deletingEntryId}
        searchQuery={search}
        onSearchQueryChange={setSearch}
        onTagChange={setSelectedTag}
        onOnlyFavToggle={() => setOnlyFav((prev) => !prev)}
        onToggleFavorite={toggleFavorite}
        onCopyText={copyText}
        onEditEntry={openEditEntryModal}
        onDeleteEntry={deleteEntry}
        onCreateTip={openCreateContribModal}
      />
      <AnalystKnowledgeAjustpediaModal
        dark={dark}
        open={showContrib}
        editing={editingEntryId !== null}
        title={newEntry.title}
        tags={newEntry.tags}
        description={newEntry.description}
        command={newEntry.command}
        onClose={closeContribModal}
        onSubmit={submitContrib}
        onTitleChange={(value) => setNewEntry((prev) => ({ ...prev, title: value }))}
        onTagsChange={(value) => setNewEntry((prev) => ({ ...prev, tags: value }))}
        onDescriptionChange={(value) => setNewEntry((prev) => ({ ...prev, description: value }))}
        onCommandChange={(value) => setNewEntry((prev) => ({ ...prev, command: value }))}
      />
    </>
  );
};

/* ----------------------------- Main App ----------------------------- */

export default function App() {
  const [mounted, setMounted] = useState(false);
  const [tenantName, setTenantName] = useState('Ajust ERP');
  const [userName, setUserName] = useState('Usuário');

  const [orders, setOrders] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [tenantId, setTenantId] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState('');
  const [initialLoading, setInitialLoading] = useState(true);

  const [userRole, setUserRole] = useState('gerente'); // gerente | super_admin | analyst
  const [currentView, setCurrentView] = useState('manager_dashboard');
  const [selectedOS, setSelectedOS] = useState(null);

  const [dark, setDark] = useState(false);
  const toggleTheme = () => setDark(!dark);

  const notify = (message) => {
    if (!message) return;
    setSyncError(message);
    window.setTimeout(() => {
      setSyncError((prev) => (prev === message ? '' : prev));
    }, 2500);
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // no-op: redirect anyway
    }
    window.location.href = '/login';
  };

  const loadRemoteData = async (targetTenantId, roleHint = userRole) => {
    if (!targetTenantId) return;
    setSyncing(true);
    setSyncError('');
    try {
      const params = new URLSearchParams({
        tenantId: targetTenantId,
        includeOrders: 'true',
        limit: '200',
      });
      const response = await fetch(`/api/occurrences?${params.toString()}`, { cache: 'no-store' });
      if (!response.ok) {
        throw new Error(await readApiErrorMessage(response, 'Falha ao carregar ordens.'));
      }
      const payload = await response.json();
      const mappedOrders = mapApiOccurrencesToManagerOrders(payload);
      const derivedTenants = deriveTenantsFromOrders(mappedOrders);
      let nextTenants = derivedTenants;

      const tenantsResponse = await fetch('/api/iam/tenants', { cache: 'no-store' });
      if (tenantsResponse.ok) {
        const tenantPayload = await tenantsResponse.json();
        const apiTenants = Array.isArray(tenantPayload) ? tenantPayload.map(mapApiTenantToPortalTenant) : [];
        const derivedByName = new Map(derivedTenants.map((item) => [item.name, item]));
        const merged = apiTenants.map((tenant) => {
          const orderTenant = derivedByName.get(tenant.name);
          return {
            ...tenant,
            sgpConfigured: orderTenant?.sgpConfigured || false,
          };
        });
        const mergedNameSet = new Set(merged.map((item) => item.name));
        const missingFromOrders = derivedTenants.filter((item) => !mergedNameSet.has(item.name));
        nextTenants = [...merged, ...missingFromOrders];
      } else if (roleHint === 'super_admin') {
        throw new Error(await readApiErrorMessage(tenantsResponse, 'Falha ao carregar tenants.'));
      }

      setOrders(mappedOrders);
      setTenants(nextTenants);
      setSelectedOS(null);
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : 'Falha na sincronização.');
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    setMounted(true);
    let active = true;
    const bootstrap = async () => {
      try {
        const response = await fetch('/api/auth/me', { cache: 'no-store' });
        if (!response.ok) {
          throw new Error(await readApiErrorMessage(response, 'Sessao invalida.'));
        }
        const me = await response.json();
        if (!active) return;
        const mappedRole = mapRoleForManagerPortal(me?.tenant?.role);
        setUserRole(mappedRole);
        setUserName(me?.name || 'Usuário');
        setTenantName(me?.tenant?.tradeName || 'Ajust ERP');
        setCurrentView(mappedRole === 'super_admin' ? 'admin_dashboard' : mappedRole === 'analyst' ? 'analyst_dashboard' : 'manager_dashboard');
        const nextTenantId = me?.tenant?.id || null;
        setTenantId(nextTenantId);
        if (nextTenantId) {
          await loadRemoteData(nextTenantId, mappedRole);
        } else {
          setSyncError('Tenant não encontrado na sessão.');
        }
      } catch (error) {
        if (!active) return;
        setSyncError(error instanceof Error ? error.message : 'Falha ao carregar sessão.');
      } finally {
        if (active) setInitialLoading(false);
      }
    };
    bootstrap();
    return () => {
      active = false;
    };
  }, []);

    // Real-time WebSocket for gerencia
  useErpWebSocket({
    tenantId,
    onEvent: (ev) => {
      if (ev.type === 'order_created' || ev.type === 'order_updated' || ev.type === 'ixc_sync_success') {
        if (!syncing) loadRemoteData(tenantId, userRole);
      }
    }
  });

  const syncData = () => {
    if (!tenantId) {
      notify('Tenant não identificado para sincronização.');
      return;
    }
    loadRemoteData(tenantId, userRole);
  };

  useEffect(() => {
    const adminOnly = ['admin_dashboard', 'admin_orders', 'tenants'];
    const analystOnly = ['analyst_dashboard'];

    if (userRole === 'analyst') {
      if (!analystOnly.includes(currentView) && currentView !== 'settings') setCurrentView('analyst_dashboard');
      return;
    }

    if (userRole === 'gerente') {
      if (adminOnly.includes(currentView)) setCurrentView('manager_dashboard');
      if (currentView === 'analyst_dashboard') setCurrentView('manager_dashboard');
      return;
    }

    if (userRole === 'super_admin') {
      if (currentView === 'manager_dashboard') setCurrentView('admin_dashboard');
    }
  }, [userRole, currentView]);

  useEffect(() => {
    const removedViews = new Set(['cmdb', 'change_management', 'time_tracking', 'csat', 'pdf_reports', 'on_call']);
    if (removedViews.has(currentView)) {
      setCurrentView(userRole === 'super_admin' ? 'admin_dashboard' : 'manager_dashboard');
    }
  }, [currentView, userRole]);

  const viewLabel = useMemo(() => {
    const map = {
      manager_dashboard: 'Visao Unificada',
      admin_dashboard: 'War Room Admin',
      global_orders: 'Ordens Globais',
      admin_orders: 'Ordens Globais (Admin)',
      technicians: 'Análise de Técnicos',
      providers: 'Análise de Provedores',
      service_types: 'Tipos de Serviço',
      sla: 'Monitor SLA',
      reports: 'Relatórios Globais',
      tenants: 'Gestão de Clientes',
      settings: 'Configurações',
      analyst_dashboard: 'Meu Painel',
      analyst_providers: 'Provedores',
      analyst_credentials_neo: 'Cofre Neo',
      analyst_ajustpedia: 'Ajustpedia',
      analyst_notes: 'Minhas Notas',
      notifications_config: 'Notificações Externas',
      api_keys: 'API Keys',
      sla_builder: 'SLA Policy Builder',
      operational_health: 'Saúde Operacional (Health Score)',
      workflow_builder: 'Workflow Builder (Automações)',
    };
    return map[currentView] || 'Dashboard';
  }, [currentView]);

  const renderView = () => {
    switch (currentView) {
      case 'analyst_dashboard':
        return <AnalystDashboardView orders={orders} onSelectOS={setSelectedOS} loading={initialLoading} currentUserName={userName} />;

      case 'manager_dashboard':
        return <ManagerDashboardView orders={orders} onSelectOS={setSelectedOS} loading={initialLoading} />;

      case 'admin_dashboard':
        return <AdminDashboardView orders={orders} tenants={tenants} onSelectOS={setSelectedOS} loading={initialLoading} />;

      case 'global_orders':
        return <GlobalOrdersView orders={orders} onSelectOS={setSelectedOS} title="Ordens Globais" />;

      case 'admin_orders':
        return <GlobalOrdersView orders={orders} onSelectOS={setSelectedOS} title="Ordens Globais (Admin)" showTenantFilter />;

      case 'technicians':
        return tenantId ? <TechniciansView dark={dark} tenantId={tenantId} onToast={notify} /> : <TechniciansModule orders={orders} onSelectOS={setSelectedOS} />;

      case 'providers':
        return tenantId ? <ProvidersView dark={dark} tenantId={tenantId} onToast={notify} /> : <ProvidersAnalysisView orders={orders} onSelectOS={setSelectedOS} />;

      case 'service_types':
        return tenantId ? (
          <ServiceTypesViewModule dark={dark} tenantId={tenantId} onToast={notify} />
        ) : (
          <div className="flex h-full w-full items-center justify-center min-h-[400px]">
            <div className="flex flex-col items-center space-y-4">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              <p className="text-sm text-muted-foreground">Carregando tipos de serviço...</p>
            </div>
          </div>
        );

      case 'sla':
        return tenantId ? <MonitorSlaView dark={dark} tenantId={tenantId} onToast={notify} /> : <SLAView orders={orders} onSelectOS={setSelectedOS} />;

      case 'reports':
        return tenantId ? <ReportsRealView dark={dark} tenantId={tenantId} onToast={notify} /> : <ReportsView orders={orders} tenants={tenants} isSuperAdmin={userRole === 'super_admin'} />;

      case 'tenants':
        return <TenantManagementView tenants={tenants} orders={orders} notify={notify} onReloadTenants={() => syncData()} />;

      case 'settings':
        return <SettingsView role={userRole} notify={notify} tenantId={tenantId} />;

      case 'analyst_providers':
        return <AnalystProvidersOperationalView orders={orders} onSelectOS={setSelectedOS} />;

      case 'analyst_credentials_neo':
        return <AnalystCredentialsNeoView dark={dark} onToast={notify} />;

      case 'analyst_ajustpedia':
        return <AnalystAjustpediaView tenantId={tenantId} notify={notify} />;

      case 'analyst_notes':
        return <AnalystNotesView dark={dark} onToast={notify} />;

      case 'calendar':
        return <CalendarManageViewModule dark={dark} />;

      case 'notifications_config':
        return tenantId ? <NotificationsConfigView dark={dark} tenantId={tenantId} onToast={notify} /> : null;

      case 'api_keys':
        return tenantId ? <ApiKeysView dark={dark} tenantId={tenantId} onToast={notify} /> : null;

      case 'sla_builder':
        return tenantId ? <SlaBuilderView dark={dark} tenantId={tenantId} onToast={notify} /> : null;

      case 'operational_health':
        return tenantId ? <OperationalHealthView dark={dark} tenantId={tenantId} onToast={notify} /> : null;

      case 'workflow_builder':
        return <WorkflowBuilderView dark={dark} tenantId={tenantId} onToast={notify} />;

      default:
        return userRole === 'super_admin' ? (
          <AdminDashboardView orders={orders} tenants={tenants} onSelectOS={setSelectedOS} loading={initialLoading} />
        ) : userRole === 'analyst' ? (
          <AnalystDashboardView orders={orders} onSelectOS={setSelectedOS} loading={initialLoading} currentUserName={userName} />
        ) : (
          <ManagerDashboardView orders={orders} onSelectOS={setSelectedOS} loading={initialLoading} />
        );
    }
  };

  const DatabaseIcon = Database;

  if (!mounted) return <div className="h-screen bg-[#0e1a33]" />;

  return (
    <ThemeCtx.Provider value={{ dark, toggle: toggleTheme }}>
      <SharedPortalShell
        tenantName={tenantName}
        userName={userName}
        userRole={userRole}
        sidebarItems={[
          {
            key: 'section_main',
            kind: 'section',
            label: 'Visao'
          },
          {
            key: 'dashboard',
            label: 'Visao Unificada',
            icon: LayoutDashboard,
            onClick: () => setCurrentView(userRole === 'super_admin' ? 'admin_dashboard' : 'manager_dashboard'),
            active: currentView.includes('dashboard')
          },
          {
            key: 'global_orders',
            label: 'Ordens Globais',
            icon: Search,
            onClick: () => setCurrentView('global_orders'),
            active: currentView === 'global_orders'
          },
          {
            key: 'section_ops',
            kind: 'section',
            label: 'Especializadas'
          },
          {
            key: 'technicians',
            label: 'Técnicos',
            icon: Users,
            onClick: () => setCurrentView('technicians'),
            active: currentView === 'technicians'
          },
          {
            key: 'providers',
            label: 'Provedores',
            icon: Shield,
            onClick: () => setCurrentView('providers'),
            active: currentView === 'providers'
          },
          {
            key: 'service_types',
            label: 'Tipos de Serviço',
            icon: Sliders,
            onClick: () => setCurrentView('service_types'),
            active: currentView === 'service_types'
          },
          {
            key: 'sla_config',
            label: 'Monitor SLA',
            icon: Clock,
            onClick: () => setCurrentView('sla'),
            active: currentView === 'sla'
          },
          {
            key: 'sla_builder',
            label: 'SLA Policy Builder',
            icon: Settings,
            onClick: () => setCurrentView('sla_builder'),
            active: currentView === 'sla_builder'
          },
          {
            key: 'operational_health',
            label: 'Saúde Operacional',
            icon: Activity,
            onClick: () => setCurrentView('operational_health'),
            active: currentView === 'operational_health'
          },
          {
            key: 'workflow_builder',
            label: 'Workflow Builder',
            icon: Zap,
            onClick: () => setCurrentView('workflow_builder'),
            active: currentView === 'workflow_builder'
          },
          {
            key: 'calendar',
            label: 'Calendário',
            icon: Calendar,
            onClick: () => setCurrentView('calendar'),
            active: currentView === 'calendar'
          },
          {
            key: 'section_admin',
            kind: 'section',
            label: 'Administracao'
          },
          {
            key: 'reports',
            label: 'Relatórios Globais',
            icon: FileText,
            onClick: () => setCurrentView('reports'),
            active: currentView === 'reports'
          },
          {
            key: 'tenants',
            label: 'Gestão de Tenants',
            icon: DatabaseIcon,
            onClick: () => setCurrentView('tenants'),
            active: currentView === 'tenants',
            role: 'super_admin'
          },
          {
            key: 'settings',
            label: 'Configurações',
            icon: Settings,
            onClick: () => setCurrentView('settings'),
            active: currentView === 'settings'
          },
          {
            key: 'notifications_config',
            label: 'Notificações & Alertas',
            icon: Bell,
            onClick: () => setCurrentView('notifications_config'),
            active: currentView === 'notifications_config'
          },
          {
            key: 'api_keys',
            label: 'Integração & API Keys',
            icon: Key,
            onClick: () => setCurrentView('api_keys'),
            active: currentView === 'api_keys'
          },
          {
            key: 'section_analyst_functions',
            kind: 'section',
            label: 'Funções analista',
            role: 'gerente'
          },
          {
            key: 'analyst_providers',
            label: 'Provedores',
            icon: Shield,
            onClick: () => setCurrentView('analyst_providers'),
            active: currentView === 'analyst_providers',
            role: 'gerente'
          },
          {
            key: 'analyst_credentials_neo',
            label: 'Cofre Neo',
            icon: DatabaseIcon,
            onClick: () => setCurrentView('analyst_credentials_neo'),
            active: currentView === 'analyst_credentials_neo',
            role: 'gerente'
          },
          {
            key: 'analyst_ajustpedia',
            label: 'Ajustpedia',
            icon: FileText,
            onClick: () => setCurrentView('analyst_ajustpedia'),
            active: currentView === 'analyst_ajustpedia',
            role: 'gerente'
          },
          {
            key: 'analyst_notes',
            label: 'Minhas Notas',
            icon: User,
            onClick: () => setCurrentView('analyst_notes'),
            active: currentView === 'analyst_notes',
            role: 'gerente'
          }
        ].filter(item => !item.role || item.role === userRole || (item.role === 'gerente' && userRole === 'super_admin'))}
        onLogout={handleLogout}
        loading={initialLoading}
        dark={dark}
        themeToggle={toggleTheme}
      >
        <div className={cn('min-h-full transition-colors duration-300', dark ? 'manager-dark manager-cyber text-slate-300' : 'text-slate-700')}>
          {syncing && (
            <div className={cn('fixed bottom-4 right-4 z-50 px-4 py-2 rounded-lg shadow-lg text-xs font-bold flex items-center gap-2', dark ? 'bg-slate-800 text-white' : 'bg-white text-slate-800 border')}>
              <RefreshCw className="animate-spin" size={14} /> Sincronizando...
            </div>
          )}
          {!syncing && syncError && (
            <div className="fixed bottom-4 right-4 z-50 bg-rose-600 text-white px-4 py-2 rounded-lg shadow-lg text-xs font-bold flex items-center gap-2">
              <AlertTriangle size={14} /> {syncError}
            </div>
          )}

          {selectedOS && (
            <OSDetailsDrawer
              os={selectedOS}
              onClose={() => setSelectedOS(null)}
              onCopyProtocolLink={(protocol) => {
                const url = `${window.location.origin}/gerencia?view=global_orders&os=${encodeURIComponent(protocol)}`;
                navigator.clipboard.writeText(url);
              }}
              onOpenOrder={(protocol) => {
                const order = (orders || []).find((o) => String(o?.protocol || '') === String(protocol));
                setCurrentView('global_orders');
                if (order) {
                  setSelectedOS(order);
                } else {
                  notify?.(`O.S ${protocol} não encontrada na carga atual.`);
                }
              }}
            />
          )}

          {renderView()}
        </div>
        <style jsx global>{`
          .manager-cyber {
            background:
              radial-gradient(980px 520px at 8% -12%, rgba(59, 130, 246, 0.22), transparent 72%),
              radial-gradient(900px 500px at 95% -18%, rgba(14, 165, 233, 0.14), transparent 72%),
              linear-gradient(180deg, rgba(11, 18, 32, 0.9) 0%, rgba(15, 23, 42, 0.86) 100%);
          }

          .manager-dark [class*='bg-white'] {
            background-color: rgba(15, 23, 42, 0.72) !important;
          }
          .manager-dark [class*='bg-slate-50'],
          .manager-dark [class*='bg-slate-100'] {
            background-color: rgba(30, 41, 59, 0.55) !important;
          }
          .manager-dark [class*='bg-indigo-50'] {
            background-color: rgba(79, 70, 229, 0.16) !important;
          }
          .manager-dark [class*='bg-cyan-50'] {
            background-color: rgba(34, 211, 238, 0.12) !important;
          }
          .manager-dark [class*='bg-rose-50'] {
            background-color: rgba(244, 63, 94, 0.16) !important;
          }
          .manager-dark [class*='bg-amber-50'] {
            background-color: rgba(245, 158, 11, 0.14) !important;
          }
          .manager-dark [class*='border-slate-100'],
          .manager-dark [class*='border-slate-200'],
          .manager-dark [class*='border-slate-300'] {
            border-color: rgba(100, 116, 139, 0.35) !important;
          }
          .manager-dark [class*='border-indigo-200'] {
            border-color: rgba(99, 102, 241, 0.35) !important;
          }
          .manager-dark [class*='border-cyan-200'] {
            border-color: rgba(34, 211, 238, 0.35) !important;
          }
          .manager-dark [class*='border-rose-200'],
          .manager-dark [class*='border-rose-900'] {
            border-color: rgba(244, 63, 94, 0.35) !important;
          }
          .manager-dark [class*='border-amber-200'],
          .manager-dark [class*='border-amber-900'] {
            border-color: rgba(245, 158, 11, 0.35) !important;
          }
          .manager-dark [class*='text-slate-900'],
          .manager-dark [class*='text-slate-800'],
          .manager-dark [class*='text-slate-700'] {
            color: rgb(226 232 240) !important;
          }
          .manager-dark [class*='text-slate-600'],
          .manager-dark [class*='text-slate-500'],
          .manager-dark [class*='text-slate-400'] {
            color: rgb(148 163 184) !important;
          }
          .manager-dark [class*='text-indigo-700'] {
            color: rgb(129 140 248) !important;
          }
          .manager-dark [class*='text-cyan-700'] {
            color: rgb(34 211 238) !important;
          }
          .manager-dark [class*='text-emerald-700'] {
            color: rgb(52 211 153) !important;
          }
          .manager-dark [class*='text-rose-700'],
          .manager-dark [class*='text-rose-600'] {
            color: rgb(251 113 133) !important;
          }
          .manager-dark [class*='text-amber-700'] {
            color: rgb(251 191 36) !important;
          }
          .manager-dark [class*='hover:bg-slate-50']:hover,
          .manager-dark [class*='hover:bg-slate-100']:hover {
            background-color: rgba(30, 41, 59, 0.75) !important;
          }
          .manager-dark [class*='shadow-sm'],
          .manager-dark [class*='shadow-md'],
          .manager-dark [class*='shadow-lg'],
          .manager-dark [class*='shadow-xl'] {
            box-shadow: 0 12px 34px rgba(2, 6, 23, 0.45) !important;
          }
        `}</style>
      </SharedPortalShell>
    </ThemeCtx.Provider>
  );
}
