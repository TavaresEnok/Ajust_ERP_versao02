'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Bell,
  BookOpen,
  Briefcase,
  Calendar,
  CheckCircle,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Clock,
  Copy,
  Eye,
  EyeOff,
  Filter,
  LayoutDashboard,
  Loader2,
  Menu,
  Plus,
  RefreshCw,
  Save,
  Search,
  Settings,
  Sparkles,
  StickyNote,
  Terminal,
  TrendingUp,
  User,
  Users,
  X,
} from 'lucide-react';
import { SharedPortalShell } from './shared-portal-shell';
import { ErpBadge, ErpSidebarItem, ErpToast } from './shared-ui';
import { SidebarUtilityButtons } from './sidebar-utility-buttons';
import { AnalystKnowledgeAjustpediaPanel } from './analista-knowledge-ajustpedia-panel';
import { AnalystKnowledgeCredentialsPanel } from './analista-knowledge-credentials-panel';
import { AnalystNotesView } from './analista-notes-view';
import {
  canAnnotateOccurrence,
  canCreateOccurrence,
  canCreateOrder,
  canEditOccurrence,
  canEditOrder,
  canUploadAttachment,
} from './rbac';

const cn = (...classes) => classes.filter(Boolean).join(' ');

// Theme Context
const ThemeCtx = React.createContext({ dark: true, toggle: () => { } });
const useTheme = () => React.useContext(ThemeCtx);
const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

const PERIODS = ['Hoje', '7d', '15d', '30d', 'Tudo'];
const STATUS_FLOW = ['Aberta', 'Em Analise', 'Ag. Campo', 'Ag. Terceiros', 'Fechada'];
const PRIORITIES = ['Baixa', 'Normal', 'Alta', 'Critica'];
const OCCURRENCE_SECTORS = ['SAC', 'SUPORTE Tecnico', 'NOC', 'CGR', 'SOC', 'INFRAESTRUTURA'];
const OCCURRENCE_ORIGINS = ['Telefone', 'Email', 'Suporte Online', 'Pessoal Local', 'Whatsapp'];
const OCCURRENCE_STATUS = ['Aberta', 'Em execucao', 'Pendente', 'Encerrada'];
const OCCURRENCE_TYPES = [
  'ATAQUE DDOS',
  'ATIVACAO DE CLIENTE',
  'ATIVACAO DE OPERADORA',
  'ATUALIZACAO DE RPKI',
  'ROMPIMENTO',
  'LENTIDAO',
  'BGP',
];

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

const ANALYST_USERS = ['Analista', 'Gerencia', 'Anderson', 'Junior', 'NOC N1', 'NOC N2'];

const SERVICE_TYPES = [
  'Rompimento',
  'Lentidao',
  'Configuracao ONU',
  'Troca de Senha',
  'Cancelamento',
  'Auditoria',
  'Instalacao',
  'BGP',
];

const NAV_ITEMS = [
  { group: 'OPERACIONAL', id: 'dashboard', label: 'Meu Painel', icon: LayoutDashboard },
  { group: 'OPERACIONAL', id: 'os_list', label: 'Ordens de Serviço', icon: Search },
  { group: 'OPERACIONAL', id: 'providers', label: 'Provedores', icon: Briefcase },
  { group: 'OPERACIONAL', id: 'providers_lab', label: 'Provedores Lab', icon: Sparkles },
  { group: 'RECURSOS', id: 'credentials', label: 'Cofre de Credenciais', icon: User },
  { group: 'RECURSOS', id: 'ajustpedia', label: 'Ajustpedia', icon: Terminal },
  { group: 'RECURSOS', id: 'notes', label: 'Minhas Notas', icon: StickyNote },
  { group: 'RECURSOS', id: 'calendar', label: 'Calendario', icon: Calendar },
  { group: 'RECURSOS', id: 'settings', label: 'Configuracoes', icon: Settings },
];

const VIEW_TITLE = {
  dashboard: 'Meu Painel',
  os_list: 'Ordens de Serviço',
  occurrences: 'Ocorrências',
  providers: 'Provedores',
  providers_lab: 'Provedores Lab',
  credentials: 'Cofre de Credenciais',
  ajustpedia: 'Ajustpedia',
  notes: 'Minhas Notas',
  calendar: 'Calendario',
  settings: 'Configuracoes',
};

const pad = (n) => String(n).padStart(2, '0');
const randomFrom = (arr) => arr[Math.floor(Math.random() * arr.length)];

const formatDate = (ts) => {
  const d = new Date(ts);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
};

const formatDateTime = (ts) => {
  const d = new Date(ts);
  return `${formatDate(ts)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const toDateInputValue = (ts) => {
  const d = new Date(ts);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const toTimeInputValue = (ts) => {
  const d = new Date(ts);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const pushUiHistoryState = (state = {}) => {
  if (typeof window === 'undefined') return;
  window.history.pushState({ ajustUi: true, ...state, ts: Date.now() }, '');
};

const createOccurrenceNumber = () => `${new Date().getFullYear()}${String(Date.now()).slice(-8)}${pad(Math.floor(Math.random() * 100))}`;
const createOrderProtocol = () => `${new Date().getFullYear()}${String(Date.now()).slice(-8)}${Math.floor(Math.random() * 10)}`;
const MAX_ATTACHMENT_SIZE_BYTES = 10 * 1024 * 1024;
const MAX_ATTACHMENTS_PER_ORDER = 10;
const ATTACHMENTS_ACCEPT = 'image/*,video/*,audio/*,text/*,application/pdf,application/zip,.pdf,.zip,.txt,.csv';
const ORDER_STATUS_UI_TO_API = {
  Aberta: 'ABERTA',
  'Em Analise': 'EM_ANALISE',
  'Ag. Campo': 'AG_CAMPO',
  'Ag. Terceiros': 'AG_TERCEIROS',
  Resolvida: 'RESOLVIDA',
  Fechada: 'FECHADA',
  Cancelada: 'CANCELADA',
};
const ORDER_STATUS_API_TO_UI = {
  ABERTA: 'Aberta',
  EM_ANALISE: 'Em Analise',
  AG_CAMPO: 'Ag. Campo',
  AG_TERCEIROS: 'Ag. Terceiros',
  RESOLVIDA: 'Resolvida',
  FECHADA: 'Fechada',
  CANCELADA: 'Cancelada',
};
const PRIORITY_UI_TO_API = {
  Baixa: 'BAIXA',
  Normal: 'NORMAL',
  Alta: 'ALTA',
  Critica: 'CRITICA',
};
const PRIORITY_API_TO_UI = {
  BAIXA: 'Baixa',
  NORMAL: 'Normal',
  ALTA: 'Alta',
  CRITICA: 'Critica',
};
const OCCURRENCE_STATUS_UI_TO_API = {
  Aberta: 'ABERTA',
  'Em execucao': 'EM_EXECUCAO',
  Pendente: 'PENDENTE',
  Encerrada: 'ENCERRADA',
};
const OCCURRENCE_STATUS_API_TO_UI = {
  ABERTA: 'Aberta',
  EM_EXECUCAO: 'Em execucao',
  PENDENTE: 'Pendente',
  ENCERRADA: 'Encerrada',
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
const ORDER_TYPE_NORMALIZED_TO_API = {
  ROMPIMENTO: 'ROMPIMENTO',
  LENTIDAO: 'LENTIDAO',
  CONFIGURACAO_ONU: 'CONFIGURACAO_ONU',
  TROCA_SENHA: 'TROCA_SENHA',
  TROCA_DE_SENHA: 'TROCA_SENHA',
  CANCELAMENTO: 'CANCELAMENTO',
  AUDITORIA: 'AUDITORIA',
  INSTALACAO: 'INSTALACAO',
  BGP: 'BGP',
};

const normalizeEnumKey = (value) =>
  String(value || '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toUpperCase();

const parseDateToTs = (value, fallback = Date.now()) => {
  if (!value) return fallback;
  const ts = new Date(value).getTime();
  return Number.isFinite(ts) ? ts : fallback;
};

const toApiOrderStatus = (value) => ORDER_STATUS_UI_TO_API[value] || ORDER_STATUS_UI_TO_API.Aberta;
const toUiOrderStatus = (value) => ORDER_STATUS_API_TO_UI[value] || 'Aberta';
const toApiPriority = (value) => PRIORITY_UI_TO_API[value] || PRIORITY_UI_TO_API.Normal;
const toUiPriority = (value) => PRIORITY_API_TO_UI[value] || 'Normal';
const toApiOccurrenceStatus = (value) => OCCURRENCE_STATUS_UI_TO_API[value] || OCCURRENCE_STATUS_UI_TO_API.Aberta;
const toUiOccurrenceStatus = (value) => OCCURRENCE_STATUS_API_TO_UI[value] || 'Aberta';
const toApiOrderType = (value) => ORDER_TYPE_NORMALIZED_TO_API[normalizeEnumKey(value)] || 'AUDITORIA';
const toUiOrderType = (value) => ORDER_TYPE_API_TO_UI[value] || value || 'Auditoria';
const mapRoleToUi = (roleCode) => {
  if (roleCode === 'tecnico') return 'technician';
  if (roleCode === 'gerente') return 'manager';
  if (roleCode === 'super_admin') return 'super_admin';
  if (roleCode === 'cliente') return 'client';
  if (roleCode === 'leitura') return 'readonly';
  return 'analyst';
};

const mapUiRoleToCode = (uiRole) => {
  if (uiRole === 'technician') return 'tecnico';
  if (uiRole === 'manager') return 'gerente';
  if (uiRole === 'super_admin') return 'super_admin';
  if (uiRole === 'client') return 'cliente';
  if (uiRole === 'readonly') return 'leitura';
  return 'analista';
};

const normalizeEquipmentType = (value) => {
  const normalized = String(value || '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();
  if (!normalized) return 'OUTROS';
  return normalized;
};

const inferEquipmentType = (credential) => {
  const source = `${credential?.environment || ''} ${credential?.host || ''} ${credential?.username || ''} ${credential?.notes || ''}`
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  if (/(^|\\b)(olt|pon|gpon|xgpon)(\\b|$)/.test(source)) return 'OLT';
  if (/(^|\\b)(bng|bras|pppoe)(\\b|$)/.test(source)) return 'BNG/BRAS';
  if (/(^|\\b)(router|roteador|juniper|mikrotik|cisco|edge)(\\b|$)/.test(source)) return 'ROTEADOR';
  if (/(^|\\b)(switch)(\\b|$)/.test(source)) return 'SWITCH';
  if (/(^|\\b)(firewall|fortigate|palo|checkpoint)(\\b|$)/.test(source)) return 'FIREWALL';
  if (/(^|\\b)(radius|freeradius|radacct)(\\b|$)/.test(source)) return 'RADIUS';
  if (/(^|\\b)(dns|bind|powerdns)(\\b|$)/.test(source)) return 'DNS';
  if (/(^|\\b)(core|backbone|transit)(\\b|$)/.test(source)) return 'CORE';
  if (/(^|\\b)(onu|ont)(\\b|$)/.test(source)) return 'ONU/ONT';
  if (/(^|\\b)(server|servidor|vm|vps|linux|windows)(\\b|$)/.test(source)) return 'SERVIDOR';
  return 'OUTROS';
};

const mapApiOccurrenceAnnotations = (apiAnnotations) => {
  if (!Array.isArray(apiAnnotations)) return [];
  return apiAnnotations.map((item) => ({
    id: item.id,
    user: item.actorUser?.name || 'Sistema',
    text: item.message || '',
    at: parseDateToTs(item.createdAt),
  }));
};

const mapApiOrderToUi = (apiOrder, apiOccurrence) => {
  const createdAt = parseDateToTs(apiOrder.createdAt);
  const occurrence = apiOccurrence || apiOrder.occurrence || null;
  const occurrenceCreatedAt = parseDateToTs(occurrence?.createdAt, createdAt);
  const history = Array.isArray(apiOrder.occurrences)
    ? apiOrder.occurrences.map((item) => ({
      at: parseDateToTs(item.createdAt, createdAt),
      user: item.actorUser?.name || 'Sistema',
      text: item.message || 'Atualizacao registrada.',
    }))
    : [{ at: createdAt, user: 'Sistema', text: 'O.S carregada do backend.' }];

  return {
    id: apiOrder.id,
    protocol: apiOrder.protocol,
    provider: occurrence?.provider || 'Sem provedor',
    tech: normalizeAnalystName(apiOrder.analystName || apiOrder.assignee?.name || '', ''),
    owner: normalizeAnalystName(apiOrder.ownerName || apiOrder.owner?.name || apiOrder.analystName || '', 'Analista'),
    type: toUiOrderType(apiOrder.type),
    priority: toUiPriority(apiOrder.priority),
    status: toUiOrderStatus(apiOrder.status),
    createdAt,
    deadlineAt: parseDateToTs(apiOrder.deadlineAt, createdAt + 24 * HOUR_MS),
    closedAt: apiOrder.closedAt ? parseDateToTs(apiOrder.closedAt) : null,
    sector: apiOrder.sector || occurrence?.sector || 'NOC',
    origin: apiOrder.origin || occurrence?.origin || 'Suporte Online',
    solicitant: apiOrder.requester || '',
    description: apiOrder.description || '',
    occurrenceId: occurrence?.id || apiOrder.occurrenceId || `OCC-LEGACY-${apiOrder.id}`,
    occurrenceNumber: occurrence?.number || apiOrder.occurrenceNumber || createOccurrenceNumber(),
    occurrenceSector: occurrence?.sector || apiOrder.occurrenceSector || apiOrder.sector || 'NOC',
    occurrenceOrigin: occurrence?.origin || apiOrder.occurrenceOrigin || apiOrder.origin || 'Suporte Online',
    occurrenceType: occurrence?.type || apiOrder.occurrenceType || apiOrder.type,
    occurrenceStatus: toUiOccurrenceStatus(occurrence?.status || apiOrder.occurrenceStatus || 'ABERTA'),
    occurrenceOpenedBy: occurrence?.openedByName || apiOrder.occurrenceOpenedBy || 'Analista',
    occurrenceResponsible: normalizeAnalystName(occurrence?.analystResponsible || apiOrder.occurrenceResponsible || apiOrder.analystName, 'Analista'),
    occurrenceCreatedAt,
    occurrenceDescription: occurrence?.description || apiOrder.occurrenceDescription || apiOrder.description || '',
    occurrenceAnnotations: mapApiOccurrenceAnnotations(occurrence?.annotations),
    isInconsistent: false,
    attachments: Array.isArray(apiOrder.attachments)
      ? apiOrder.attachments.map((att) => ({
        id: att.id,
        name: att.fileName || att.name || 'arquivo',
        mime: att.mimeType || att.mime || '',
        size: Number(att.sizeBytes || att.size || 0),
      }))
      : [],
    occurrences: history,
  };
};

const mapApiOccurrencesToUiOrders = (apiOccurrences) => {
  if (!Array.isArray(apiOccurrences)) return [];
  const flat = [];
  apiOccurrences.forEach((occurrence) => {
    const orders = Array.isArray(occurrence.serviceOrders) ? occurrence.serviceOrders : [];
    orders.forEach((order) => {
      flat.push(mapApiOrderToUi(order, occurrence));
    });
  });
  return flat.sort((a, b) => b.createdAt - a.createdAt);
};

const readApiErrorMessage = async (response, fallbackMessage) => {
  const payload = await response.json().catch(() => null);
  if (!payload) return fallbackMessage;
  if (typeof payload === 'string') return payload || fallbackMessage;
  if (typeof payload.error === 'string') return payload.error || fallbackMessage;
  return fallbackMessage;
};

const formatFileSize = (size) => {
  if (!size) return '-';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
};

const normalizeAttachment = (file) => ({
  id: file.id || `att-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
  name: file.name || 'arquivo',
  mime: file.mime || file.type || '',
  size: Number(file.size) || 0,
  ...(file.file ? { file: file.file } : {}),
});

const normalizeAttachments = (list) => {
  if (!Array.isArray(list)) return [];
  return list.map(normalizeAttachment).slice(0, MAX_ATTACHMENTS_PER_ORDER);
};

const normalizeAnalystName = (name, fallback = 'Analista') => {
  const parsed = String(name || '').trim();
  if (!parsed || parsed.toLowerCase() === 'voce') return fallback;
  return parsed;
};

const appendAttachmentFiles = (current, fileList) => {
  const base = normalizeAttachments(current);
  const files = Array.from(fileList || []);
  const valid = [];
  let rejectedBySize = 0;
  files.forEach((file) => {
    if (file.size > MAX_ATTACHMENT_SIZE_BYTES) {
      rejectedBySize += 1;
      return;
    }
    valid.push({
      id: `att-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
      name: file.name,
      mime: file.type,
      size: file.size,
      file,
    });
  });
  const next = [...base, ...valid].slice(0, MAX_ATTACHMENTS_PER_ORDER);
  const rejectedByLimit = Math.max(0, base.length + valid.length - MAX_ATTACHMENTS_PER_ORDER);
  return { next, rejectedBySize, rejectedByLimit };
};

const buildUploadNotice = (rejectedBySize, rejectedByLimit) => {
  if (!rejectedBySize && !rejectedByLimit) return '';
  const parts = [];
  if (rejectedBySize) parts.push(`${rejectedBySize} acima de 10MB`);
  if (rejectedByLimit) parts.push(`${rejectedByLimit} acima do limite de 10 anexos`);
  return `Alguns arquivos nao foram adicionados: ${parts.join(', ')}.`;
};

const startOfDay = (ts) => {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

const endOfDay = (ts) => startOfDay(ts) + DAY_MS - 1;

const slugify = (s) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '-');

const isClosed = (o) => o.status === 'Fechada';
const isActive = (o) => !isClosed(o);

const getDelayHours = (order, now = Date.now()) => {
  const ref = order.closedAt || now;
  return Math.max(0, (ref - order.deadlineAt) / HOUR_MS);
};

const getStatusColor = (status) => {
  if (status === 'Fechada') return 'green';
  if (status === 'Aberta') return 'blue';
  if (status === 'Em Analise') return 'cyan';
  if (status === 'Ag. Campo') return 'orange';
  if (status === 'Ag. Terceiros') return 'purple';
  return 'slate';
};

const getPriorityColor = (p) => {
  if (p === 'Critica') return 'red';
  if (p === 'Alta') return 'orange';
  if (p === 'Normal') return 'blue';
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
  for (let i = 0; i < type.length; i++) hash = type.charCodeAt(i) + ((hash << 5) - hash);
  return styles[Math.abs(hash) % styles.length];
};

const nextStatus = (status) => {
  if (status === 'Aberta') return 'Em Analise';
  if (status === 'Em Analise') return 'Ag. Campo';
  if (status === 'Ag. Campo') return 'Ag. Terceiros';
  if (status === 'Ag. Terceiros') return 'Fechada';
  return 'Fechada';
};

const periodStart = (period, now = Date.now()) => {
  if (period === 'Tudo') return null;
  if (period === 'Hoje') return startOfDay(now);
  if (period === '7d') return now - 7 * DAY_MS;
  if (period === '15d') return now - 15 * DAY_MS;
  if (period === '30d') return now - 30 * DAY_MS;
  return null;
};

const filterByPeriod = (orders, period) => {
  const start = periodStart(period);
  if (!start) return orders;
  return orders.filter((o) => o.createdAt >= start);
};

const buildTimeline = (orders, period) => {
  const now = Date.now();
  let days = 8;
  if (period === 'Hoje') days = 1;
  if (period === '7d') days = 7;
  if (period === '15d') days = 15;
  if (period === '30d') days = 30;
  if (period === 'Tudo') days = 14;

  const end = startOfDay(now);
  const arr = [];

  for (let i = days - 1; i >= 0; i--) {
    const dayStart = end - i * DAY_MS;
    const dayEnd = dayStart + DAY_MS - 1;
    const created = orders.filter((o) => o.createdAt >= dayStart && o.createdAt <= dayEnd).length;
    const closed = orders.filter((o) => o.closedAt && o.closedAt >= dayStart && o.closedAt <= dayEnd).length;
    arr.push({
      label: `${pad(new Date(dayStart).getDate())}/${pad(new Date(dayStart).getMonth() + 1)}`,
      created,
      closed,
    });
  }

  return arr;
};

const buildProviderRows = (orders, now = Date.now()) => {
  const map = new Map();
  PROVIDERS.forEach((providerName) => {
    if (!map.has(providerName)) {
      map.set(providerName, {
        name: providerName,
        slug: slugify(providerName),
        city: PROVIDER_CITY[providerName] || '-',
        total: 0,
        active: 0,
        closed: 0,
        delayed: 0,
        dueToday: 0,
        orders: [],
      });
    }
  });

  orders.forEach((o) => {
    if (!map.has(o.provider)) {
      map.set(o.provider, {
        name: o.provider,
        slug: slugify(o.provider),
        city: PROVIDER_CITY[o.provider] || '-',
        total: 0,
        active: 0,
        closed: 0,
        delayed: 0,
        dueToday: 0,
        orders: [],
      });
    }

    const item = map.get(o.provider);
    item.total += 1;
    if (isActive(o)) item.active += 1;
    if (isClosed(o)) item.closed += 1;
    if (isActive(o) && getDelayHours(o, now) > 0) item.delayed += 1;
    if (isActive(o) && o.deadlineAt >= startOfDay(now) && o.deadlineAt <= endOfDay(now)) item.dueToday += 1;
    item.orders.push(o);
  });

  return Array.from(map.values()).sort((a, b) => b.total - a.total);
};

const buildTechRows = (orders, now = Date.now()) =>
  TECHS.map((t) => {
    const own = orders.filter((o) => o.tech === t.name);
    const active = own.filter(isActive);
    const closed = own.filter(isClosed);
    const delayed = own.filter((o) => getDelayHours(o, now) > 0);
    const onTime = closed.filter((o) => getDelayHours(o, now) <= 0);
    const onTimePct = closed.length ? Math.round((onTime.length / closed.length) * 100) : 0;

    const avgDuration = closed.length
      ? closed.reduce((acc, o) => acc + (o.closedAt - o.createdAt) / HOUR_MS, 0) / closed.length
      : 0;

    return {
      ...t,
      created: own.length,
      active: active.length,
      delayed: delayed.length,
      onTimePct,
      avgDuration: `${Math.floor(avgDuration)}h ${pad(Math.floor((avgDuration % 1) * 60))}m`,
      status: active.length > 8 ? 'busy' : 'available',
    };
  });

const getOccurrenceStatusColor = (status) => {
  if (status === 'Encerrada') return 'green';
  if (status === 'Pendente') return 'orange';
  if (status === 'Em execucao') return 'cyan';
  return 'blue';
};

const buildOccurrencesFromOrders = (orders) => {
  const map = new Map();
  orders.forEach((order) => {
    const occurrenceId = order.occurrenceId || `OCC-LEGACY-${order.id}`;
    if (!map.has(occurrenceId)) {
      map.set(occurrenceId, {
        id: occurrenceId,
        number: order.occurrenceNumber || createOccurrenceNumber(),
        provider: order.provider,
        sector: order.occurrenceSector || order.sector || 'NOC',
        origin: order.occurrenceOrigin || order.origin || 'Suporte Online',
        type: order.occurrenceType || order.type,
        status: order.occurrenceStatus || 'Aberta',
        description: order.occurrenceDescription || order.description,
        openedBy: normalizeAnalystName(order.occurrenceOpenedBy, 'Analista'),
        responsible: normalizeAnalystName(order.occurrenceResponsible || order.owner, 'Analista'),
        createdAt: order.occurrenceCreatedAt || order.createdAt,
        annotations: Array.isArray(order.occurrenceAnnotations) ? order.occurrenceAnnotations : [],
        orders: [],
      });
    }
    map.get(occurrenceId).orders.push(order);
  });

  return Array.from(map.values())
    .map((occ) => ({ ...occ, orders: [...occ.orders].sort((a, b) => b.createdAt - a.createdAt) }))
    .sort((a, b) => b.createdAt - a.createdAt);
};

const generateMockOrders = (count = 260) => {
  const now = Date.now();
  const providerOccurrencePool = new Map();

  return Array.from({ length: count }).map((_, i) => {
    const createdAt = now - Math.floor(Math.random() * 80 * DAY_MS);
    const deadlineAt = createdAt + (8 + Math.floor(Math.random() * 72)) * HOUR_MS;
    const status = randomFrom(STATUS_FLOW);
    const priority = randomFrom(PRIORITIES);
    const provider = randomFrom(PROVIDERS);
    const type = randomFrom(SERVICE_TYPES);

    const owner = randomFrom(ANALYST_USERS);
    const tech = Math.random() > 0.2 ? randomFrom(ANALYST_USERS) : null;

    let closedAt = null;
    if (status === 'Fechada') {
      const jitter = (Math.floor(Math.random() * 18) - 5) * HOUR_MS;
      closedAt = Math.max(createdAt + 2 * HOUR_MS, deadlineAt + jitter);
    }

    const protocol = `${new Date(createdAt).getFullYear()}${String(100000 + i * 13).padStart(6, '0')}`;
    const currentPool = providerOccurrencePool.get(provider) || [];
    let occurrence = null;

    if (currentPool.length > 0 && Math.random() > 0.52) {
      occurrence = randomFrom(currentPool);
    } else {
      occurrence = {
        id: `OCC-${provider.replace(/\s+/g, '-').toLowerCase()}-${i}`,
        number: `${new Date(createdAt).getFullYear()}${String(260000 + i * 7).padStart(6, '0')}`,
        sector: randomFrom(OCCURRENCE_SECTORS),
        origin: randomFrom(OCCURRENCE_ORIGINS),
        type: randomFrom(OCCURRENCE_TYPES),
        status: randomFrom(OCCURRENCE_STATUS),
        openedBy: randomFrom(['Analista', 'Atendimento', 'Gerente']),
        responsible: Math.random() > 0.45 ? 'Analista' : randomFrom(TECHS).name,
        createdAt: createdAt - Math.floor(Math.random() * 4 * HOUR_MS),
      };
      providerOccurrencePool.set(provider, [...currentPool, occurrence]);
    }

    return {
      id: `OS-${202400 + i}`,
      protocol,
      provider,
      tech,
      owner,
      type,
      priority,
      status,
      createdAt,
      deadlineAt,
      closedAt,
      sector: randomFrom(['NOC', 'SAC', 'Suporte N1', 'Suporte N2']),
      origin: randomFrom(['WhatsApp', 'Ligacao', 'Ticket', 'Email']),
      solicitant: randomFrom(['Atendimento Provedor', 'Supervisor NOC', 'Gerente Operacional', 'Cliente Corporativo']),
      description: `Cliente relata ${type.toLowerCase()} com oscilacao e impacto no servico.`,
      occurrenceId: occurrence.id,
      occurrenceNumber: occurrence.number,
      occurrenceSector: occurrence.sector,
      occurrenceOrigin: occurrence.origin,
      occurrenceType: occurrence.type,
      occurrenceStatus: occurrence.status,
      occurrenceOpenedBy: occurrence.openedBy,
      occurrenceResponsible: occurrence.responsible,
      occurrenceCreatedAt: occurrence.createdAt,
      occurrenceDescription: `Ocorrencia ${occurrence.type.toLowerCase()} registrada para ${provider}.`,
      isInconsistent: Math.random() > 0.98,
      attachments: [
        { id: `a-${i}-1`, name: 'print_cliente.png' },
        { id: `a-${i}-2`, name: 'log_olt.txt' },
      ],
      occurrences: [
        { at: createdAt, user: 'Sistema', text: 'OS criada via integracao API.' },
        { at: createdAt + 90 * 60 * 1000, user: 'NOC N1', text: 'Triagem inicial concluida.' },
        ...(closedAt ? [{ at: closedAt, user: tech || 'NOC N2', text: 'Normalizacao confirmada.' }] : []),
      ],
    };
  });
};

const Badge = ErpBadge;

/* ---- Skeleton Loaders ---- */
const SkeletonKpiCards = ({ count = 5 }) => {
  const { dark } = useTheme();
  return (
    <div className={cn('grid gap-4', `grid-cols-1 sm:grid-cols-2 xl:grid-cols-${count}`)}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={cn("border rounded-xl p-4 shadow-sm animate-pulse", dark ? "bg-[#1e293b]/60 backdrop-blur-md border-slate-700/50" : "bg-white border-slate-200")}>
          <div className={cn("h-3 w-14 rounded mb-3", dark ? "bg-white/10" : "bg-slate-100")} />
          <div className={cn("h-8 w-10 rounded", dark ? "bg-white/10" : "bg-slate-100")} />
        </div>
      ))}
    </div>
  );
};

const SkeletonTable = ({ rows = 6 }) => {
  const { dark } = useTheme();
  return (
    <div className={cn("border rounded-xl shadow-sm overflow-hidden", dark ? "bg-[#1e293b]/60 backdrop-blur-md border-slate-700/50" : "bg-white border-slate-200")}>
      <div className={cn("px-5 py-3 border-b", dark ? "border-slate-700/50" : "border-slate-100")}>
        <div className={cn("h-5 w-40 rounded animate-pulse", dark ? "bg-white/10" : "bg-slate-100")} />
      </div>
      <div className="p-2">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className={cn("h-12 rounded-lg mb-1 animate-pulse", dark ? "bg-white/5" : "bg-slate-50")} />
        ))}
      </div>
    </div>
  );
};

const ServiceTypeBadge = ({ type }) => {
  const { dark } = useTheme();
  let color = 'slate';
  const t = type?.toLowerCase() || '';
  if (t.includes('rompimento') || t.includes('ataque')) color = 'red';
  else if (t.includes('lentidao') || t.includes('bgp')) color = 'orange';
  else if (t.includes('instalacao') || t.includes('ativacao')) color = 'green';
  else if (t.includes('configuracao') || t.includes('troca')) color = 'blue';

  return <ErpBadge color={color} dark={dark}>{type}</ErpBadge>;
};

const SidebarItem = ({ icon: Icon, label, compact = false, active = false, onClick }) => (
  <ErpSidebarItem icon={Icon} label={label} compact={compact} active={active} onClick={onClick} iconSize={18} />
);

const PeriodTabs = ({ value, onChange }) => {
  const { dark } = useTheme();
  return (
    <div className={cn("flex items-center border rounded-lg p-1 gap-1 overflow-x-auto no-scrollbar", dark ? "bg-[#1e293b]/60 backdrop-blur-md border-slate-700/50" : "bg-white border-slate-200")}>
      {PERIODS.map((p) => (
        <button key={p} onClick={() => onChange(p)} className={cn('px-3 py-1.5 text-xs rounded font-semibold whitespace-nowrap transition-colors',
          value === p
            ? (dark ? 'bg-blue-600/20 text-blue-400 font-bold' : 'bg-slate-800 text-white')
            : (dark ? 'text-slate-500 hover:bg-white/5 hover:text-slate-300' : 'text-slate-500 hover:bg-slate-100')
        )}>
          {p}
        </button>
      ))}
    </div>
  );
};

/* ═══════════════════════════════ MODALS ═══════════════════════════════ */

const Modal = ({ title, onClose, children, maxWidth = 'max-w-4xl' }) => {
  const { dark } = useTheme();
  return (
    <div className="fixed inset-0 z-[70] flex items-start sm:items-center justify-center p-4 overflow-y-auto">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className={cn('relative my-6 sm:my-0 w-full max-h-[92vh] rounded-xl border shadow-2xl overflow-hidden flex flex-col', maxWidth, dark ? "bg-[#11151c] border-slate-700/50" : "bg-white border-slate-200")}>
        <div className={cn("px-5 py-3 border-b flex items-center justify-between", dark ? "border-slate-700/50" : "border-slate-100")}>
          <h3 className={cn("font-bold", dark ? "text-white" : "text-slate-800")}>{title}</h3>
          <button onClick={onClose} className={cn("p-1.5 rounded transition-colors", dark ? "hover:bg-white/10 text-slate-400" : "hover:bg-slate-100 text-slate-500")}>
            <X size={18} />
          </button>
        </div>
        <div className="p-5 overflow-y-auto custom-scrollbar">{children}</div>
      </div>
    </div>
  );
};

const CommandPalette = ({ open, onClose, views, orders, onNavigate, onOpenOrder }) => {
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!open) setQuery('');
  }, [open]);

  if (!open) return null;

  const q = query.trim().toLowerCase();

  const filteredViews = views.filter((v) => !q || v.label.toLowerCase().includes(q));
  const filteredOrders = orders
    .filter((o) => {
      if (!q) return false;
      return (
        o.protocol.toLowerCase().includes(q) ||
        o.provider.toLowerCase().includes(q) ||
        (o.tech || '').toLowerCase().includes(q) ||
        (o.owner || '').toLowerCase().includes(q)
      );
    })
    .slice(0, 8);

  return (
    <div className="fixed inset-0 z-[85] flex items-start justify-center p-4 md:p-12">
      <div className="absolute inset-0 bg-slate-900/40" onClick={onClose} />
      <div className="relative w-full max-w-2xl bg-white border border-slate-200 rounded-xl shadow-2xl overflow-hidden">
        <div className="p-3 border-b border-slate-100">
          <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar tela ou protocolo..." className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
        </div>

        <div className="max-h-[60vh] overflow-y-auto custom-scrollbar">
          <div className="px-3 pt-3 text-[11px] uppercase text-slate-400 font-bold">Telas</div>
          <div className="p-2 space-y-1">
            {filteredViews.map((v) => (
              <button
                key={v.id}
                onClick={() => {
                  onNavigate(v.id);
                  onClose();
                }}
                className="w-full text-left px-3 py-2 rounded hover:bg-slate-100 text-sm"
              >
                {v.label}
              </button>
            ))}
            {filteredViews.length === 0 && <div className="px-3 py-2 text-sm text-slate-400">Nenhuma tela encontrada.</div>}
          </div>

          <div className="px-3 pt-2 text-[11px] uppercase text-slate-400 font-bold">Ordens</div>
          <div className="p-2 space-y-1">
            {filteredOrders.map((o) => (
              <button
                key={o.id}
                onClick={() => {
                  onOpenOrder(o);
                  onClose();
                }}
                className="w-full text-left px-3 py-2 rounded hover:bg-slate-100 text-sm flex justify-between"
              >
                <span className="font-mono">{o.protocol}</span>
                <span className="text-slate-500">{o.provider}</span>
              </button>
            ))}
            {filteredOrders.length === 0 && <div className="px-3 py-2 text-sm text-slate-400">Digite para buscar OS.</div>}
          </div>
        </div>
      </div>
    </div>
  );
};

const OSDetailsDrawer = ({ order, onClose, onOpenOccurrence, onEditOrder, onAddOrderAnnotation }) => {
  const { dark } = useTheme();
  const [annotationText, setAnnotationText] = useState('');
  const [annotationSaving, setAnnotationSaving] = useState(false);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  useEffect(() => {
    setAnnotationText('');
    setAnnotationSaving(false);
  }, [order?.id]);

  if (!order) return null;

  const submitOrderAnnotation = async () => {
    const message = annotationText.trim();
    if (message.length < 2 || !onAddOrderAnnotation || annotationSaving) return;
    setAnnotationSaving(true);
    try {
      const ok = await onAddOrderAnnotation(order, message);
      if (ok) setAnnotationText('');
    } finally {
      setAnnotationSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex justify-end">
      <div className="absolute inset-0 bg-slate-900/35 backdrop-blur-sm" onClick={onClose} />
      <div className={cn("relative w-full max-w-[620px] h-full border-l shadow-2xl flex flex-col transition-colors duration-200", dark ? "bg-[#1e293b]/60 backdrop-blur-md border-slate-700/50" : "bg-white border-slate-200")}>
        <div className={cn("h-16 border-b px-5 flex items-center justify-between", dark ? "bg-[#0f172a]/80 backdrop-blur-xl border-slate-700/50" : "bg-slate-50/60 border-slate-100")}>
          <div>
            <div className={cn("text-[11px] uppercase font-bold", dark ? "text-slate-500" : "text-slate-400")}>Detalhes da OS</div>
            <div className={cn("font-mono font-bold", dark ? "text-slate-200" : "text-slate-800")}>{order.protocol}</div>
          </div>
          <button onClick={onClose} className={cn("p-2 rounded-full transition-colors", dark ? "hover:bg-white/10 text-slate-400" : "hover:bg-slate-200 text-slate-600")}>
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 p-5 overflow-y-auto custom-scrollbar space-y-4">
          <div className="flex items-center gap-2">
            <Badge color={getStatusColor(order.status)}>{order.status}</Badge>
            <Badge color={getPriorityColor(order.priority)}>{order.priority}</Badge>
            {order.isInconsistent && <Badge color="orange">Inconsistente</Badge>}
          </div>

          <div>
            <div className={cn("text-[11px] uppercase font-bold", dark ? "text-slate-500" : "text-slate-400")}>Provedor</div>
            <div className={cn("text-sm font-semibold", dark ? "text-slate-200" : "text-slate-800")}>{order.provider}</div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className={cn("text-[11px] uppercase font-bold", dark ? "text-slate-500" : "text-slate-400")}>Tecnico</div>
              <div className={cn("text-sm", dark ? "text-slate-300" : "text-slate-700")}>{order.tech || '-'}</div>
            </div>
            <div>
              <div className={cn("text-[11px] uppercase font-bold", dark ? "text-slate-500" : "text-slate-400")}>Owner</div>
              <div className={cn("text-sm", dark ? "text-slate-300" : "text-slate-700")}>{order.owner || '-'}</div>
            </div>
          </div>

          <div>
            <div className={cn("text-[11px] uppercase font-bold", dark ? "text-slate-500" : "text-slate-400")}>Tipo</div>
            <div className="mt-1">
              <ServiceTypeBadge type={order.type} />
            </div>
          </div>

          <div className={cn("border rounded-lg p-3", dark ? "bg-[#0f172a]/80 backdrop-blur-xl border-slate-700/50" : "bg-slate-50 border-slate-200")}>
            <div className={cn("text-[11px] uppercase font-bold", dark ? "text-slate-500" : "text-slate-400")}>Descricao</div>
            <p className={cn("text-sm mt-1", dark ? "text-slate-300" : "text-slate-700")}>{order.description}</p>
          </div>

          <div className={cn("border rounded-lg p-3", dark ? "bg-blue-900/10 border-blue-500/20" : "bg-blue-50 border-blue-100")}>
            <div className={cn("text-[11px] uppercase font-bold mb-2", dark ? "text-blue-400" : "text-blue-600")}>Identificacao da ocorrencia</div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div><span className={dark ? "text-slate-500" : "text-slate-500"}>Numero:</span> <span className={cn("font-semibold", dark ? "text-slate-300" : "text-slate-800")}>{order.occurrenceNumber || '-'}</span></div>
              <div><span className={dark ? "text-slate-500" : "text-slate-500"}>Status:</span> <span className={cn("font-semibold", dark ? "text-slate-300" : "text-slate-800")}>{order.occurrenceStatus || '-'}</span></div>
              <div><span className={dark ? "text-slate-500" : "text-slate-500"}>Tipo de Ocorrencia:</span> <span className={cn("font-semibold", dark ? "text-slate-300" : "text-slate-800")}>{order.occurrenceType || '-'}</span></div>
              <div><span className={dark ? "text-slate-500" : "text-slate-500"}>Origem:</span> <span className={cn("font-semibold", dark ? "text-slate-300" : "text-slate-800")}>{order.occurrenceOrigin || '-'}</span></div>
              <div><span className={dark ? "text-slate-500" : "text-slate-500"}>Setor:</span> <span className={cn("font-semibold", dark ? "text-slate-300" : "text-slate-800")}>{order.occurrenceSector || '-'}</span></div>
              <div><span className={dark ? "text-slate-500" : "text-slate-500"}>Analista responsavel:</span> <span className={cn("font-semibold", dark ? "text-slate-300" : "text-slate-800")}>{order.occurrenceResponsible || '-'}</span></div>
              <div className="col-span-2"><span className={dark ? "text-slate-500" : "text-slate-500"}>Data de Criacao:</span> <span className={cn("font-semibold", dark ? "text-slate-300" : "text-slate-800")}>{order.occurrenceCreatedAt ? formatDateTime(order.occurrenceCreatedAt) : '-'}</span></div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className={cn("border rounded-lg p-3", dark ? "border-slate-700/50" : "border-slate-200")}>
              <div className={cn("text-[11px] uppercase font-bold", dark ? "text-slate-500" : "text-slate-400")}>Abertura</div>
              <div className={cn("text-xs font-mono mt-1", dark ? "text-slate-300" : "text-slate-700")}>{formatDateTime(order.createdAt)}</div>
            </div>
            <div className={cn("border rounded-lg p-3", dark ? "border-slate-700/50" : "border-slate-200")}>
              <div className={cn("text-[11px] uppercase font-bold", dark ? "text-slate-500" : "text-slate-400")}>Prazo</div>
              <div className={cn("text-xs font-mono mt-1", dark ? "text-slate-300" : "text-slate-700")}>{formatDateTime(order.deadlineAt)}</div>
            </div>
          </div>

          <div className={cn("border rounded-lg p-3", dark ? "border-slate-700/50" : "border-slate-200")}>
            <div className={cn("text-[11px] uppercase font-bold", dark ? "text-slate-500" : "text-slate-400")}>Delay</div>
            <div className={cn('text-sm font-bold mt-1', getDelayHours(order) > 0 ? 'text-rose-600' : 'text-emerald-600')}>
              {getDelayHours(order) > 0 ? `+${getDelayHours(order).toFixed(2)}h` : 'Sem atraso'}
            </div>
          </div>

          <div>
            <div className={cn("text-[11px] uppercase font-bold mb-2", dark ? "text-slate-500" : "text-slate-400")}>Anexos</div>
            <div className="space-y-2">
              {normalizeAttachments(order.attachments).map((a) => (
                <div key={a.id} className={cn("p-2 rounded border text-sm", dark ? "bg-[#0f172a]/80 backdrop-blur-xl border-slate-700/50 text-slate-300" : "bg-slate-50 border-slate-200 text-slate-700")}>
                  <div className="font-medium">{a.name}</div>
                  <div className="text-[11px] text-slate-500">{a.mime || 'arquivo'} • {formatFileSize(a.size)}</div>
                </div>
              ))}
              {normalizeAttachments(order.attachments).length === 0 && <div className="text-xs text-slate-400">Sem anexos.</div>}
            </div>
          </div>

          <div>
            <div className={cn("text-[11px] uppercase font-bold mb-2", dark ? "text-slate-500" : "text-slate-400")}>Historico</div>
            <div className={cn("border rounded-lg p-3 mb-3", dark ? "border-slate-700/50 bg-[#0f172a]/70" : "border-slate-200 bg-slate-50")}>
              <div className={cn("text-[11px] uppercase font-bold mb-2", dark ? "text-slate-500" : "text-slate-500")}>Nova atualizacao</div>
              <textarea
                value={annotationText}
                onChange={(e) => setAnnotationText(e.target.value)}
                rows={3}
                placeholder="Descreva o que foi feito nesta O.S..."
                className={cn(
                  "w-full px-3 py-2 border rounded-lg text-sm resize-none",
                  dark
                    ? "bg-[#1e293b]/60 border-slate-700 text-slate-200 placeholder:text-slate-500"
                    : "bg-white border-slate-300 text-slate-900 placeholder:text-slate-400"
                )}
              />
              <div className="mt-2 flex justify-end">
                <button
                  onClick={submitOrderAnnotation}
                  disabled={annotationSaving || annotationText.trim().length < 2}
                  className={cn(
                    "px-3 py-1.5 rounded border text-xs font-bold transition-colors disabled:opacity-50",
                    dark
                      ? "bg-cyan-900/30 border-cyan-700/50 text-cyan-400 hover:bg-cyan-900/50"
                      : "border-cyan-200 bg-cyan-50 text-cyan-700 hover:bg-cyan-100"
                  )}
                >
                  {annotationSaving ? 'Salvando...' : 'Registrar atualizacao'}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              {order.occurrences.map((o, idx) => (
                <div key={`${order.id}-${idx}`} className={cn("border rounded-lg p-3", dark ? "border-slate-700/50" : "border-slate-200")}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className={cn("font-bold", dark ? "text-slate-300" : "text-slate-700")}>{o.user}</span>
                    <span className="font-mono text-slate-400">{formatDateTime(o.at)}</span>
                  </div>
                  <p className={cn("text-sm whitespace-pre-wrap break-words", dark ? "text-slate-400" : "text-slate-600")}>{o.text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className={cn("p-4 border-t grid grid-cols-3 gap-2", dark ? "bg-[#0f172a]/80 backdrop-blur-xl border-slate-700/50" : "bg-slate-50 border-slate-100")}>
          <button onClick={() => navigator.clipboard.writeText(order.protocol)} className={cn("py-2 border rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition-colors", dark ? "bg-[#1e293b]/60 backdrop-blur-md border-slate-700/50 text-slate-300 hover:bg-[#1c2128]" : "bg-white border-slate-300 hover:bg-slate-100")}>
            <Copy size={13} />
            Copiar
          </button>
          <button onClick={() => onEditOrder(order)} className={cn("py-2 border rounded-lg text-xs font-semibold transition-colors", dark ? "bg-indigo-900/30 border-indigo-700/50 text-indigo-400 hover:bg-indigo-900/50" : "border-indigo-200 bg-indigo-50 text-indigo-700")}>
            Editar O.S
          </button>
          <button onClick={() => onOpenOccurrence(order)} className={cn("py-2 border rounded-lg text-xs font-semibold transition-colors", dark ? "bg-cyan-900/30 border-cyan-700/50 text-cyan-400 hover:bg-cyan-900/50" : "border-cyan-200 bg-cyan-50 text-cyan-700")}>
            Abrir Ocorrencia
          </button>
        </div>
      </div>
    </div>
  );
};

const EditOrderModal = ({ order, onClose, onSave }) => {
  const { dark } = useTheme();
  const [uploadNotice, setUploadNotice] = useState('');
  const [form, setForm] = useState(() => ({
    type: order?.type || SERVICE_TYPES[0],
    priority: order?.priority || 'Normal',
    status: order?.status || 'Aberta',
    tech: order?.tech || '',
    owner: order?.owner || ANALYST_USERS[0],
    solicitant: order?.solicitant || '',
    sector: order?.sector || 'NOC',
    origin: order?.origin || 'Suporte Online',
    deadlineDate: toDateInputValue(order?.deadlineAt || Date.now()),
    deadlineTime: toTimeInputValue(order?.deadlineAt || Date.now()),
    description: order?.description || '',
    attachments: normalizeAttachments(order?.attachments),
  }));

  useEffect(() => {
    if (!order) return;
    setForm({
      type: order.type,
      priority: order.priority,
      status: order.status,
      tech: order.tech || '',
      owner: order.owner || ANALYST_USERS[0],
      solicitant: order.solicitant || '',
      sector: order.sector || 'NOC',
      origin: order.origin || 'Suporte Online',
      deadlineDate: toDateInputValue(order.deadlineAt || Date.now()),
      deadlineTime: toTimeInputValue(order.deadlineAt || Date.now()),
      description: order.description || '',
      attachments: normalizeAttachments(order.attachments),
    });
  }, [order]);

  if (!order) return null;

  const submit = (e) => {
    e.preventDefault();
    const parsedDeadline = new Date(`${form.deadlineDate}T${form.deadlineTime}`).getTime();
    onSave(order.id, {
      type: form.type,
      priority: form.priority,
      status: form.status,
      tech: form.tech || null,
      owner: form.owner || ANALYST_USERS[0],
      solicitant: form.solicitant,
      sector: form.sector,
      origin: form.origin,
      deadlineAt: Number.isFinite(parsedDeadline) ? parsedDeadline : order.deadlineAt,
      description: form.description,
      attachments: normalizeAttachments(form.attachments),
    });
    onClose();
  };

  const handleAttachmentSelect = (e) => {
    const { next, rejectedBySize, rejectedByLimit } = appendAttachmentFiles(form.attachments, e.target.files);
    setForm((p) => ({ ...p, attachments: next }));
    e.target.value = '';
    setUploadNotice(buildUploadNotice(rejectedBySize, rejectedByLimit));
  };

  const inputClass = cn("w-full px-3 py-2 border rounded-lg text-sm transition-colors", dark ? "bg-[#1e293b]/50 border-slate-700 text-white placeholder-slate-500" : "bg-white border-slate-300 text-slate-900 placeholder-slate-400");
  const labelClass = cn("text-xs uppercase font-bold tracking-wider mb-1 block", dark ? "text-slate-400" : "text-slate-500");
  const panelClass = cn("border rounded-lg p-3 transition-colors", dark ? "bg-[#0f172a]/50 border-slate-700/50" : "bg-slate-50 border-slate-200");
  const valueClass = cn("font-semibold", dark ? "text-slate-300" : "text-slate-800");
  const keyClass = cn("", dark ? "text-slate-500" : "text-slate-500");

  return (
    <Modal title={`Editar O.S ${order.protocol}`} onClose={onClose} maxWidth="max-w-3xl">
      <form onSubmit={submit} className="space-y-3">
        <div className={panelClass}>
          <div className={cn("text-xs uppercase font-bold mb-2", dark ? "text-slate-400" : "text-slate-500")}>Identificacao da O.S e da ocorrencia</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
            <div><span className={keyClass}>Protocolo O.S:</span> <span className={valueClass}>{order.protocol}</span></div>
            <div><span className={keyClass}>Status O.S:</span> <span className={valueClass}>{order.status}</span></div>
            <div><span className={keyClass}>Provedor:</span> <span className={valueClass}>{order.provider}</span></div>
            <div><span className={keyClass}>Data criacao O.S:</span> <span className={valueClass}>{formatDateTime(order.createdAt)}</span></div>
            <div><span className={keyClass}>Solicitante:</span> <span className={valueClass}>{order.solicitant || '-'}</span></div>
            <div><span className={keyClass}>Numero da Ocorrencia:</span> <span className={valueClass}>{order.occurrenceNumber || '-'}</span></div>
            <div><span className={keyClass}>Status da Ocorrencia:</span> <span className={valueClass}>{order.occurrenceStatus || '-'}</span></div>
            <div><span className={keyClass}>Tipo de Ocorrencia:</span> <span className={valueClass}>{order.occurrenceType || '-'}</span></div>
            <div><span className={keyClass}>Origem:</span> <span className={valueClass}>{order.occurrenceOrigin || '-'}</span></div>
            <div><span className={keyClass}>Setor:</span> <span className={valueClass}>{order.occurrenceSector || '-'}</span></div>
            <div><span className={keyClass}>Analista responsavel:</span> <span className={valueClass}>{order.occurrenceResponsible || '-'}</span></div>
            <div><span className={keyClass}>Aberta por:</span> <span className={valueClass}>{order.occurrenceOpenedBy || 'Gerencia'}</span></div>
            <div><span className={keyClass}>Data criacao ocorrencia:</span> <span className={valueClass}>{order.occurrenceCreatedAt ? formatDateTime(order.occurrenceCreatedAt) : '-'}</span></div>
          </div>
        </div>

        <div className={cn("text-xs uppercase font-bold", dark ? "text-slate-400" : "text-slate-500")}>Campos editaveis da O.S</div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className={labelClass}>Tipo da O.S</label>
            <select value={form.type} onChange={(e) => setForm((p) => ({ ...p, type: e.target.value }))} className={inputClass}>
              {SERVICE_TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Prioridade da O.S</label>
            <select value={form.priority} onChange={(e) => setForm((p) => ({ ...p, priority: e.target.value }))} className={inputClass}>
              {PRIORITIES.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Status da O.S</label>
            <select value={form.status} onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))} className={inputClass}>
              {STATUS_FLOW.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className={labelClass}>Usuario responsavel</label>
            <select value={form.owner} onChange={(e) => setForm((p) => ({ ...p, owner: e.target.value }))} className={inputClass}>
              {ANALYST_USERS.map((a) => (
                <option key={a}>{a}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Analista responsavel</label>
            <select value={form.tech} onChange={(e) => setForm((p) => ({ ...p, tech: e.target.value }))} className={inputClass}>
              <option value="">Sem analista</option>
              {ANALYST_USERS.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Solicitante</label>
            <input value={form.solicitant} onChange={(e) => setForm((p) => ({ ...p, solicitant: e.target.value }))} placeholder="Pessoa do provedor" className={inputClass} />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Setor da O.S</label>
            <select value={form.sector} onChange={(e) => setForm((p) => ({ ...p, sector: e.target.value }))} className={inputClass}>
              {OCCURRENCE_SECTORS.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Origem da O.S</label>
            <select value={form.origin} onChange={(e) => setForm((p) => ({ ...p, origin: e.target.value }))} className={inputClass}>
              {OCCURRENCE_ORIGINS.map((o) => (
                <option key={o}>{o}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Data limite SLA</label>
            <input type="date" value={form.deadlineDate} onChange={(e) => setForm((p) => ({ ...p, deadlineDate: e.target.value }))} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Hora limite SLA</label>
            <input type="time" value={form.deadlineTime} onChange={(e) => setForm((p) => ({ ...p, deadlineTime: e.target.value }))} className={inputClass} />
          </div>
        </div>

        <div>
          <label className={labelClass}>Descricao tecnica da O.S</label>
          <textarea value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} rows={4} className={inputClass} placeholder="Descricao da O.S" />
        </div>

        <div className={cn(panelClass, "space-y-2")}>
          <div className={labelClass}>Anexos da O.S (imagem, video, audio, texto, PDF)</div>
          <div className={cn("text-[11px]", dark ? "text-slate-400" : "text-slate-500")}>Ate 10 anexos por O.S, maximo 10MB por arquivo.</div>
          <input type="file" multiple accept={ATTACHMENTS_ACCEPT} onChange={handleAttachmentSelect} className={cn("block w-full text-xs file:mr-3 file:px-3 file:py-1.5 file:rounded file:border-0 file:text-slate-700", dark ? "text-slate-300 file:bg-slate-700 file:text-slate-200" : "text-slate-600 file:bg-slate-200")} />
          {uploadNotice && <div className="text-xs text-amber-700">{uploadNotice}</div>}
          <div className="space-y-1">
            {normalizeAttachments(form.attachments).map((a) => (
              <div key={a.id} className={cn("flex items-center justify-between gap-2 border rounded px-2 py-1.5 text-xs", dark ? "bg-[#1e293b]/50 border-slate-700 text-slate-300" : "bg-white border-slate-200 text-slate-700")}>
                <div className="min-w-0">
                  <div className="truncate">{a.name}</div>
                  <div className={dark ? "text-slate-400" : "text-slate-400"}>{a.mime || 'arquivo'} • {formatFileSize(a.size)}</div>
                </div>
                <button
                  type="button"
                  onClick={() => setForm((p) => ({ ...p, attachments: normalizeAttachments(p.attachments).filter((att) => att.id !== a.id) }))}
                  className={cn("px-2 py-1 border rounded transition-colors", dark ? "border-rose-900/50 bg-rose-950/30 text-rose-400 hover:bg-rose-900/50" : "border-rose-200 bg-rose-50 text-rose-700")}
                >
                  Remover
                </button>
              </div>
            ))}
            {normalizeAttachments(form.attachments).length === 0 && <div className={cn("text-xs", dark ? "text-slate-500" : "text-slate-400")}>Nenhum anexo adicionado.</div>}
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={cn("px-3 py-2 border rounded-lg text-sm transition-colors", dark ? "border-slate-700 text-slate-300 hover:bg-slate-800" : "border-slate-300 text-slate-700 hover:bg-slate-50")}>
            Cancelar
          </button>
          <button type="submit" className="px-3 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg text-sm font-semibold transition-colors">
            Salvar O.S
          </button>
        </div>
      </form>
    </Modal>
  );
};

const EditOccurrenceModal = ({ occurrence, onClose, onSave }) => {
  const { dark } = useTheme();
  const [form, setForm] = useState(() => ({
    type: occurrence?.type || OCCURRENCE_TYPES[0],
    status: occurrence?.status || 'Aberta',
    sector: occurrence?.sector || 'NOC',
    origin: occurrence?.origin || 'Suporte Online',
    responsible: normalizeAnalystName(occurrence?.responsible, ANALYST_USERS[0]),
    description: occurrence?.description || '',
  }));

  useEffect(() => {
    if (!occurrence) return;
    setForm({
      type: occurrence.type,
      status: occurrence.status,
      sector: occurrence.sector,
      origin: occurrence.origin,
      responsible: normalizeAnalystName(occurrence.responsible, ANALYST_USERS[0]),
      description: occurrence.description || '',
    });
  }, [occurrence]);

  if (!occurrence) return null;

  const submit = (e) => {
    e.preventDefault();
    onSave(occurrence.id, {
      type: form.type,
      status: form.status,
      sector: form.sector,
      origin: form.origin,
      responsible: normalizeAnalystName(form.responsible, ANALYST_USERS[0]),
      description: form.description,
    });
    onClose();
  };

  const inputClass = cn("w-full px-3 py-2 border rounded-lg text-sm transition-colors", dark ? "bg-[#1e293b]/50 border-slate-700 text-white placeholder-slate-500" : "bg-white border-slate-300 text-slate-900 placeholder-slate-400");
  const labelClass = cn("text-xs uppercase font-bold tracking-wider mb-1 block", dark ? "text-slate-400" : "text-slate-500");
  const panelClass = cn("border rounded-lg p-3 transition-colors", dark ? "bg-[#0f172a]/50 border-slate-700/50" : "bg-slate-50 border-slate-200");
  const valueClass = cn("font-semibold", dark ? "text-slate-300" : "text-slate-800");
  const keyClass = cn("", dark ? "text-slate-500" : "text-slate-500");

  return (
    <Modal title={`Editar Ocorrencia ${occurrence.number}`} onClose={onClose} maxWidth="max-w-2xl">
      <form onSubmit={submit} className="space-y-3">
        <div className={panelClass}>
          <div className={cn("text-xs uppercase font-bold mb-2", dark ? "text-slate-400" : "text-slate-500")}>Identificacao da ocorrencia</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
            <div><span className={keyClass}>Numero da Ocorrencia:</span> <span className={valueClass}>{occurrence.number}</span></div>
            <div><span className={keyClass}>Status atual:</span> <span className={valueClass}>{occurrence.status}</span></div>
            <div><span className={keyClass}>Tipo de Ocorrencia:</span> <span className={valueClass}>{occurrence.type}</span></div>
            <div><span className={keyClass}>Origem:</span> <span className={valueClass}>{occurrence.origin}</span></div>
            <div><span className={keyClass}>Setor:</span> <span className={valueClass}>{occurrence.sector}</span></div>
            <div><span className={keyClass}>Analista responsavel:</span> <span className={valueClass}>{occurrence.responsible || '-'}</span></div>
            <div><span className={keyClass}>Aberta por:</span> <span className={valueClass}>{occurrence.openedBy || 'Gerencia'}</span></div>
            <div><span className={keyClass}>Data de Criacao:</span> <span className={valueClass}>{occurrence.createdAt ? formatDateTime(occurrence.createdAt) : '-'}</span></div>
            <div><span className={keyClass}>Provedor:</span> <span className={valueClass}>{occurrence.provider || '-'}</span></div>
            <div><span className={keyClass}>Qtd. de O.S:</span> <span className={valueClass}>{occurrence.orders?.length || 0}</span></div>
          </div>
        </div>

        <div className={cn("text-xs uppercase font-bold", dark ? "text-slate-400" : "text-slate-500")}>Campos editaveis da ocorrencia</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Tipo de Ocorrencia</label>
            <select value={form.type} onChange={(e) => setForm((p) => ({ ...p, type: e.target.value }))} className={inputClass}>
              {OCCURRENCE_TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Status da Ocorrencia</label>
            <select value={form.status} onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))} className={inputClass}>
              {OCCURRENCE_STATUS.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Setor da Ocorrencia</label>
            <select value={form.sector} onChange={(e) => setForm((p) => ({ ...p, sector: e.target.value }))} className={inputClass}>
              {OCCURRENCE_SECTORS.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Origem da Ocorrencia</label>
            <select value={form.origin} onChange={(e) => setForm((p) => ({ ...p, origin: e.target.value }))} className={inputClass}>
              {OCCURRENCE_ORIGINS.map((o) => (
                <option key={o}>{o}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className={labelClass}>Analista responsavel da Ocorrencia</label>
          <select value={form.responsible} onChange={(e) => setForm((p) => ({ ...p, responsible: e.target.value }))} className={inputClass}>
            {ANALYST_USERS.map((a) => (
              <option key={a}>{a}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Descricao da Ocorrencia</label>
          <textarea value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} rows={4} className={inputClass} placeholder="Descricao da ocorrencia" />
        </div>

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={cn("px-3 py-2 border rounded-lg text-sm transition-colors", dark ? "border-slate-700 text-slate-300 hover:bg-slate-800" : "border-slate-300 text-slate-700 hover:bg-slate-50")}>
            Cancelar
          </button>
          <button type="submit" className="px-3 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg text-sm font-semibold transition-colors">
            Salvar ocorrencia
          </button>
        </div>
      </form>
    </Modal>
  );
};

const OccurrencesView = ({ orders, onSelectOrder, onCreateInternalOrder, focusOccurrenceId }) => {
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [newInternal, setNewInternal] = useState({ sector: 'NOC', responsible: ANALYST_USERS[0], description: '' });
  const [statusFilter, setStatusFilter] = useState('Todas');

  const occurrences = useMemo(() => buildOccurrencesFromOrders(orders), [orders]);

  useEffect(() => {
    if (focusOccurrenceId) setSelectedId(focusOccurrenceId);
  }, [focusOccurrenceId]);

  useEffect(() => {
    if (occurrences.length === 0) {
      setSelectedId(null);
      return;
    }
    if (!selectedId || !occurrences.some((o) => o.id === selectedId)) {
      setSelectedId(occurrences[0].id);
    }
  }, [occurrences, selectedId]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return occurrences.filter((o) => {
      const bySearch = !q || `${o.number} ${o.provider} ${o.type} ${o.status} ${o.description}`.toLowerCase().includes(q);
      const byStatus = statusFilter === 'Todas' || o.status === statusFilter;
      return bySearch && byStatus;
    });
  }, [occurrences, search, statusFilter]);

  const selected = occurrences.find((o) => o.id === selectedId) || null;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Ocorrencias</h2>
        <p className="text-sm text-slate-500">Cada O.S pertence a uma ocorrencia. Uma ocorrencia pode ter varias O.S.</p>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-4">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          <div className="relative w-full md:col-span-8">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar ocorrencia..." className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm" />
          </div>
          <div className="md:col-span-4">
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
              <option>Todas</option>
              {OCCURRENCE_STATUS.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-5">
        <div className="xl:col-span-3 bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-4 py-3 text-left">Numero</th>
                  <th className="px-4 py-3 text-left">Provedor</th>
                  <th className="px-4 py-3 text-left">Tipo</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-right">OS internas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((o) => (
                  <tr key={o.id} onClick={() => setSelectedId(o.id)} className={cn('cursor-pointer hover:bg-slate-50', selectedId === o.id && 'bg-slate-50')}>
                    <td className="px-4 py-3 font-mono">{o.number}</td>
                    <td className="px-4 py-3">{o.provider}</td>
                    <td className="px-4 py-3">{o.type}</td>
                    <td className="px-4 py-3">
                      <Badge color={getOccurrenceStatusColor(o.status)}>{o.status}</Badge>
                    </td>
                    <td className="px-4 py-3 text-right font-mono">{o.orders?.length || 0}</td>
                  </tr>
                ))}
                {filtered.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">Nenhuma ocorrencia.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        <div className="xl:col-span-2 bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-3">
          {!selected && <div className="text-sm text-slate-400">Selecione uma ocorrencia.</div>}

          {selected && (
            <>
              <div>
                <div className="text-xs uppercase font-bold text-slate-400">Ocorrencia {selected.number}</div>
                <div className="text-sm text-slate-700 mt-1">{selected.description}</div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div><span className="text-slate-400">Setor:</span> <span className="font-semibold text-slate-700">{selected.sector}</span></div>
                <div><span className="text-slate-400">Origem:</span> <span className="font-semibold text-slate-700">{selected.origin}</span></div>
                <div><span className="text-slate-400">Abertor:</span> <span className="font-semibold text-slate-700">{selected.openedBy}</span></div>
                <div><span className="text-slate-400">Responsavel:</span> <span className="font-semibold text-slate-700">{selected.responsible}</span></div>
              </div>

              <div className="border-t border-slate-100 pt-3 space-y-2">
                <div className="text-xs uppercase font-bold text-slate-400">Ordens de servico ({selected.orders.length})</div>
                <div className="space-y-2 max-h-56 overflow-y-auto custom-scrollbar">
                  {(selected.orders || []).map((io) => (
                    <button key={io.id} onClick={() => onSelectOrder(io)} className="w-full text-left border border-slate-200 rounded-lg p-2 hover:bg-slate-50">
                      <div className="text-xs text-slate-500 font-mono">{io.protocol}</div>
                      <div className="text-sm text-slate-700">{io.description}</div>
                      <div className="text-xs text-slate-500 mt-1">{io.sector} • {normalizeAnalystName(io.owner, ANALYST_USERS[0])}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="border-t border-slate-100 pt-3 space-y-2">
                <div className="text-xs uppercase font-bold text-slate-400">Adicionar O.S interna</div>
                <select value={newInternal.sector} onChange={(e) => setNewInternal((p) => ({ ...p, sector: e.target.value }))} className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm">
                  {OCCURRENCE_SECTORS.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
                <input value={newInternal.responsible} onChange={(e) => setNewInternal((p) => ({ ...p, responsible: e.target.value }))} placeholder="Responsavel" className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm" />
                <textarea value={newInternal.description} onChange={(e) => setNewInternal((p) => ({ ...p, description: e.target.value }))} rows={2} placeholder="Descricao interna" className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm" />
                <button
                  onClick={() => {
                    if (!newInternal.description.trim()) return;
                    onCreateInternalOrder(selected, newInternal);
                    setNewInternal((p) => ({ ...p, description: '' }));
                  }}
                  className="w-full px-3 py-2 border border-cyan-200 bg-cyan-50 text-cyan-700 rounded text-xs font-bold"
                >
                  Salvar O.S interna
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

const DashboardView = ({ orders, onSelectOrder, onGoToProviders, onGoToKnowledge, loading, currentAnalystName }) => {
  const { dark } = useTheme();
  const [period, setPeriod] = useState('7d');
  const [monthOffset, setMonthOffset] = useState(0);
  const [mineScopeMode, setMineScopeMode] = useState('owner_or_tech');
  const [hoverDayIndex, setHoverDayIndex] = useState(null);

  const normalizeName = (value) => String(value || '').trim().toLowerCase();
  const analystNameNormalized = normalizeName(currentAnalystName || 'Analista');
  const isMineOrder = (order, mode = mineScopeMode) => {
    if (!analystNameNormalized) return false;
    if (mode === 'owner_only') {
      return normalizeName(order.owner) === analystNameNormalized;
    }
    return normalizeName(order.owner) === analystNameNormalized || normalizeName(order.tech) === analystNameNormalized;
  };

  const scoped = useMemo(() => (selectedProvider ? filterByPeriod(orders, period) : orders), [orders, period, selectedProvider]);
  const active = scoped.filter(isActive);
  const closed = scoped.filter(isClosed);
  const delayed = active.filter((o) => getDelayHours(o) > 0).length;
  const dueToday = active.filter((o) => o.deadlineAt >= startOfDay(Date.now()) && o.deadlineAt <= endOfDay(Date.now()));

  const mineScoped = useMemo(() => scoped.filter((order) => isMineOrder(order, mineScopeMode)), [scoped, analystNameNormalized, mineScopeMode]);
  const mineActive = mineScoped.filter(isActive);
  const mineClosed = mineScoped.filter(isClosed);
  const mineDelayed = mineActive.filter((o) => getDelayHours(o) > 0).length;
  const mineDueToday = mineActive.filter((o) => o.deadlineAt >= startOfDay(Date.now()) && o.deadlineAt <= endOfDay(Date.now()));

  const myOrdersRows = useMemo(
    () =>
      [...mineScoped]
        .sort((a, b) => {
          const aBucket = isActive(a) ? 0 : 1;
          const bBucket = isActive(b) ? 0 : 1;
          if (aBucket !== bBucket) return aBucket - bBucket;
          if (aBucket === 0) return a.deadlineAt - b.deadlineAt;
          return b.createdAt - a.createdAt;
        })
        .slice(0, 8),
    [mineScoped]
  );

  const monthlyMineFlow = useMemo(() => {
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth() + monthOffset, 1);
    const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0);
    const totalDays = monthEnd.getDate();
    const rows = Array.from({ length: totalDays }, (_, idx) => ({
      day: idx + 1,
      opened: 0,
      closed: 0,
    }));

    orders.forEach((order) => {
      if (!isMineOrder(order, mineScopeMode)) return;
      const createdAt = new Date(order.createdAt);
      if (
        createdAt.getFullYear() === monthStart.getFullYear() &&
        createdAt.getMonth() === monthStart.getMonth()
      ) {
        rows[createdAt.getDate() - 1].opened += 1;
      }

      if (order.closedAt) {
        const closedAt = new Date(order.closedAt);
        if (
          closedAt.getFullYear() === monthStart.getFullYear() &&
          closedAt.getMonth() === monthStart.getMonth()
        ) {
          rows[closedAt.getDate() - 1].closed += 1;
        }
      }
    });

    const openedTotal = rows.reduce((acc, item) => acc + item.opened, 0);
    const closedTotal = rows.reduce((acc, item) => acc + item.closed, 0);
    const monthLabel = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(monthStart);

    return { monthStart, monthEnd, rows, openedTotal, closedTotal, monthLabel };
  }, [orders, analystNameNormalized, mineScopeMode, monthOffset]);

  const lineChart = useMemo(() => {
    const points = monthlyMineFlow.rows;
    const width = 980;
    const height = 330;
    const paddingX = 42;
    const paddingY = 28;
    const maxY = Math.max(1, ...points.map((item) => Math.max(item.opened, item.closed)));

    const getX = (index) =>
      points.length <= 1
        ? paddingX
        : paddingX + (index * (width - paddingX * 2)) / (points.length - 1);
    const getY = (value) => height - paddingY - (value * (height - paddingY * 2)) / maxY;

    const buildPath = (key) =>
      points.reduce((path, item, idx) => {
        const x = getX(idx);
        const y = getY(item[key]);
        if (idx === 0) return `M ${x} ${y}`;
        const prevX = getX(idx - 1);
        const prevY = getY(points[idx - 1][key]);
        const cpX = prevX + (x - prevX) / 2;
        return `${path} C ${cpX} ${prevY}, ${cpX} ${y}, ${x} ${y}`;
      }, '');

    const openedPath = buildPath('opened');
    const closedPath = buildPath('closed');
    const openedArea = `${openedPath} L ${getX(points.length - 1)} ${height - paddingY} L ${getX(0)} ${height - paddingY} Z`;
    const closedArea = `${closedPath} L ${getX(points.length - 1)} ${height - paddingY} L ${getX(0)} ${height - paddingY} Z`;

    return { points, width, height, paddingX, paddingY, maxY, getX, getY, openedPath, closedPath, openedArea, closedArea };
  }, [monthlyMineFlow.rows]);

  const yTickValues = useMemo(() => {
    const steps = 5;
    const values = [];
    for (let i = 0; i <= steps; i += 1) {
      values.push(Math.round((lineChart.maxY * i) / steps));
    }
    return Array.from(new Set(values));
  }, [lineChart.maxY]);

  const xLabelIndexes = useMemo(() => {
    const total = lineChart.points.length;
    if (total <= 1) return [0];
    const indexes = new Set([
      0,
      Math.floor((total - 1) * 0.25),
      Math.floor((total - 1) * 0.5),
      Math.floor((total - 1) * 0.75),
      total - 1,
    ]);
    return Array.from(indexes).sort((a, b) => a - b);
  }, [lineChart.points.length]);

  useEffect(() => {
    setHoverDayIndex(null);
  }, [monthOffset, mineScopeMode]);

  if (loading) return (
    <div className="space-y-6">
      <div>
        <h2 className={cn("text-2xl font-bold", dark ? "text-white" : "text-slate-900")}>Meu Painel</h2>
        <p className={cn("text-sm", dark ? "text-slate-400" : "text-slate-500")}>Carregando dados operacionais...</p>
      </div>
      <SkeletonKpiCards count={5} />
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5"><div className="xl:col-span-2"><SkeletonTable rows={4} /></div><SkeletonTable rows={3} /></div>
      <SkeletonTable rows={5} />
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <h2 className={cn("text-2xl font-bold", dark ? "text-white" : "text-slate-900")}>Meu Painel</h2>
          <p className={cn("text-sm", dark ? "text-slate-400" : "text-slate-500")}>Visao de operacao para tecnico/analista.</p>
        </div>
        <PeriodTabs value={period} onChange={setPeriod} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
        <div className={cn("border rounded-xl p-4 shadow-sm", dark ? "bg-[#1e293b]/60 backdrop-blur-md border-slate-700/50" : "bg-white border-slate-200")}>
          <div className="text-xs uppercase font-bold text-slate-400">Ativas (Geral)</div>
          <div className={cn("text-3xl font-bold mt-2", dark ? "text-white" : "text-slate-800")}>{active.length}</div>
        </div>
        <div className={cn("border rounded-xl p-4 shadow-sm", dark ? "bg-[#1e293b]/60 backdrop-blur-md border-slate-700/50" : "bg-white border-slate-200")}>
          <div className="text-xs uppercase font-bold text-slate-400">Minhas Ativas</div>
          <div className={cn("text-3xl font-bold mt-2", dark ? "text-indigo-400" : "text-indigo-700")}>{mineActive.length}</div>
        </div>
        <div className={cn("border rounded-xl p-4 shadow-sm", dark ? "bg-[#1e293b]/60 backdrop-blur-md border-rose-500/20" : "bg-white border-rose-200")}>
          <div className="text-xs uppercase font-bold text-rose-500">Minhas Atrasadas</div>
          <div className="text-3xl font-bold text-rose-500 mt-2">{mineDelayed}</div>
        </div>
        <div className={cn("border rounded-xl p-4 shadow-sm", dark ? "bg-[#1e293b]/60 backdrop-blur-md border-amber-500/20" : "bg-white border-amber-200")}>
          <div className="text-xs uppercase font-bold text-amber-500">Minhas Vencem Hoje</div>
          <div className="text-3xl font-bold text-amber-500 mt-2">{mineDueToday.length}</div>
        </div>
        <div className={cn("border rounded-xl p-4 shadow-sm", dark ? "bg-[#1e293b]/60 backdrop-blur-md border-slate-700/50" : "bg-white border-slate-200")}>
          <div className="text-xs uppercase font-bold text-slate-400">Minhas Fechadas</div>
          <div className="text-3xl font-bold mt-2 text-emerald-500">{mineClosed.length}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <div className={cn("xl:col-span-2 border rounded-xl p-5 shadow-sm overflow-hidden", dark ? "bg-[#1e293b]/60 backdrop-blur-md border-slate-700/50" : "bg-white border-slate-200")}>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
            <div>
              <h3 className={cn("font-bold flex items-center gap-2", dark ? "text-white" : "text-slate-800")}>
                <span className={cn("p-1.5 rounded-md", dark ? "bg-blue-900/40 text-blue-300" : "bg-blue-100 text-blue-700")}>
                  <TrendingUp size={14} />
                </span>
                Minhas O.S - Fluxo do mes
              </h3>
              <div className={cn("text-[11px] uppercase tracking-wider mt-1", dark ? "text-slate-500" : "text-slate-500")}>
                {monthlyMineFlow.monthLabel} - do dia 01 ao dia {pad(monthlyMineFlow.monthEnd.getDate())}
              </div>
            </div>

            <div className="flex flex-col items-start md:items-end gap-2">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setMonthOffset((prev) => prev - 1)}
                  className={cn("px-2 py-1 rounded border text-xs font-semibold", dark ? "border-slate-700/50 text-slate-300 hover:bg-white/5" : "border-slate-300 text-slate-700 hover:bg-slate-50")}
                >
                  Mes anterior
                </button>
                <button
                  onClick={() => setMonthOffset((prev) => Math.min(prev + 1, 0))}
                  disabled={monthOffset >= 0}
                  className={cn("px-2 py-1 rounded border text-xs font-semibold disabled:opacity-50", dark ? "border-slate-700/50 text-slate-300 hover:bg-white/5" : "border-slate-300 text-slate-700 hover:bg-slate-50")}
                >
                  Mes atual
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setMineScopeMode('owner_or_tech')}
                  className={cn("px-2 py-1 rounded border text-[11px] font-semibold", mineScopeMode === 'owner_or_tech'
                    ? (dark ? "border-cyan-600/50 bg-cyan-900/30 text-cyan-300" : "border-cyan-200 bg-cyan-50 text-cyan-700")
                    : (dark ? "border-slate-700/50 text-slate-400 hover:bg-white/5" : "border-slate-300 text-slate-600 hover:bg-slate-50")
                  )}
                >
                  Owner + Analista
                </button>
                <button
                  onClick={() => setMineScopeMode('owner_only')}
                  className={cn("px-2 py-1 rounded border text-[11px] font-semibold", mineScopeMode === 'owner_only'
                    ? (dark ? "border-cyan-600/50 bg-cyan-900/30 text-cyan-300" : "border-cyan-200 bg-cyan-50 text-cyan-700")
                    : (dark ? "border-slate-700/50 text-slate-400 hover:bg-white/5" : "border-slate-300 text-slate-600 hover:bg-slate-50")
                  )}
                >
                  So owner
                </button>
              </div>

              <div className="flex items-center gap-4 text-[11px] font-bold uppercase tracking-wider">
                <div className="flex items-center gap-2">
                  <span className="w-4 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_12px_rgba(34,211,238,0.9)]" />
                  <span className={dark ? "text-slate-400" : "text-slate-500"}>Abertas ({monthlyMineFlow.openedTotal})</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-4 h-1.5 rounded-full bg-violet-500 shadow-[0_0_12px_rgba(168,85,247,0.9)]" />
                  <span className={dark ? "text-slate-400" : "text-slate-500"}>Fechadas ({monthlyMineFlow.closedTotal})</span>
                </div>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto custom-scrollbar">
            <svg viewBox={`0 0 ${lineChart.width} ${lineChart.height}`} className="w-full min-w-[760px] h-auto">
              <defs>
                <filter id="dashboardGlowCyan" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="3.5" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
                <filter id="dashboardGlowViolet" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="3.5" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
                <linearGradient id="dashboardGradCyan" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.16" />
                  <stop offset="100%" stopColor="#22d3ee" stopOpacity="0" />
                </linearGradient>
                <linearGradient id="dashboardGradViolet" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.16" />
                  <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0" />
                </linearGradient>
              </defs>

              {yTickValues.map((value) => (
                <g key={`tick-${value}`}>
                  <line
                    x1={lineChart.paddingX}
                    y1={lineChart.getY(value)}
                    x2={lineChart.width - lineChart.paddingX}
                    y2={lineChart.getY(value)}
                    stroke={dark ? 'rgba(148,163,184,0.13)' : 'rgba(100,116,139,0.15)'}
                    strokeWidth="1"
                  />
                  <text
                    x={lineChart.paddingX - 10}
                    y={lineChart.getY(value) + 4}
                    fill={dark ? '#64748b' : '#94a3b8'}
                    fontSize="10"
                    fontWeight="700"
                    textAnchor="end"
                  >
                    {value}
                  </text>
                </g>
              ))}

              <path d={lineChart.closedArea} fill="url(#dashboardGradViolet)" />
              <path d={lineChart.openedArea} fill="url(#dashboardGradCyan)" />

              <path d={lineChart.closedPath} fill="none" stroke="#8b5cf6" strokeWidth="3" strokeLinecap="round" filter="url(#dashboardGlowViolet)" />
              <path d={lineChart.openedPath} fill="none" stroke="#22d3ee" strokeWidth="3" strokeLinecap="round" filter="url(#dashboardGlowCyan)" />

              {lineChart.points.map((_, idx) => (
                <rect
                  key={`hover-zone-${idx}`}
                  x={lineChart.getX(idx) - 10}
                  y={lineChart.paddingY}
                  width={20}
                  height={lineChart.height - lineChart.paddingY * 2}
                  fill="transparent"
                  onMouseEnter={() => setHoverDayIndex(idx)}
                  onMouseLeave={() => setHoverDayIndex((current) => (current === idx ? null : current))}
                />
              ))}

              {hoverDayIndex !== null && lineChart.points[hoverDayIndex] && (
                <g pointerEvents="none">
                  <line
                    x1={lineChart.getX(hoverDayIndex)}
                    y1={lineChart.paddingY}
                    x2={lineChart.getX(hoverDayIndex)}
                    y2={lineChart.height - lineChart.paddingY}
                    stroke={dark ? 'rgba(148,163,184,0.35)' : 'rgba(100,116,139,0.35)'}
                    strokeDasharray="4 4"
                  />
                  <circle
                    cx={lineChart.getX(hoverDayIndex)}
                    cy={lineChart.getY(lineChart.points[hoverDayIndex].opened)}
                    r="3.5"
                    fill="#22d3ee"
                  />
                  <circle
                    cx={lineChart.getX(hoverDayIndex)}
                    cy={lineChart.getY(lineChart.points[hoverDayIndex].closed)}
                    r="3.5"
                    fill="#8b5cf6"
                  />
                  <g transform={`translate(${Math.min(lineChart.getX(hoverDayIndex) + 14, lineChart.width - 190)}, ${lineChart.paddingY + 4})`}>
                    <rect width="170" height="58" rx="8" fill={dark ? 'rgba(15,23,42,0.92)' : 'rgba(255,255,255,0.95)'} stroke={dark ? 'rgba(51,65,85,0.8)' : 'rgba(203,213,225,0.9)'} />
                    <text x="10" y="16" fill={dark ? '#94a3b8' : '#64748b'} fontSize="10" fontWeight="700">
                      Dia {pad(lineChart.points[hoverDayIndex].day)}
                    </text>
                    <text x="10" y="33" fill="#22d3ee" fontSize="11" fontWeight="700">
                      Abertas: {lineChart.points[hoverDayIndex].opened}
                    </text>
                    <text x="10" y="49" fill="#8b5cf6" fontSize="11" fontWeight="700">
                      Fechadas: {lineChart.points[hoverDayIndex].closed}
                    </text>
                  </g>
                </g>
              )}

              {xLabelIndexes.map((idx) => {
                const day = lineChart.points[idx]?.day || idx + 1;
                return (
                  <text
                    key={`day-${idx}`}
                    x={lineChart.getX(idx)}
                    y={lineChart.height - 8}
                    fill={dark ? '#64748b' : '#94a3b8'}
                    fontSize="10"
                    fontWeight="800"
                    textAnchor="middle"
                  >
                    {pad(day)}
                  </text>
                );
              })}
            </svg>
          </div>
        </div>

        <div className={cn("border rounded-xl p-5 shadow-sm", dark ? "bg-[#1e293b]/60 backdrop-blur-md border-slate-700/50" : "bg-white border-slate-200")}>
          <h3 className={cn("font-bold mb-3", dark ? "text-white" : "text-slate-800")}>Acoes Rapidas</h3>
          <div className="space-y-2">
            <button onClick={onGoToProviders} className={cn("w-full text-left px-3 py-2 rounded-lg border font-semibold text-sm transition-colors", dark ? "border-blue-500/30 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20" : "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100")}>
              Abrir Provedores
            </button>
            <button onClick={onGoToKnowledge} className={cn("w-full text-left px-3 py-2 rounded-lg border text-sm transition-colors", dark ? "border-slate-700/50 bg-white/5 text-slate-300 hover:bg-white/10" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50")}>
              Ver Ajustpedia
            </button>
          </div>

          <div className={cn("mt-4 border rounded-lg p-3 text-xs", dark ? "border-slate-700/50 bg-[#0f172a]/70 text-slate-400" : "border-slate-200 bg-slate-50 text-slate-600")}>
            <div className="flex items-center justify-between"><span>Minhas ativas</span><span className="font-mono">{mineActive.length}</span></div>
            <div className="flex items-center justify-between mt-1"><span>Minhas fechadas</span><span className="font-mono">{mineClosed.length}</span></div>
            <div className="flex items-center justify-between mt-1"><span>Atraso geral</span><span className="font-mono">{delayed}</span></div>
            <div className="flex items-center justify-between mt-1"><span>Vencem hoje (geral)</span><span className="font-mono">{dueToday.length}</span></div>
          </div>
        </div>
      </div>

      <div className={cn("border rounded-xl shadow-sm overflow-hidden", dark ? "bg-[#1e293b]/60 backdrop-blur-md border-slate-700/50" : "bg-white border-slate-200")}>
        <div className={cn("px-5 py-3 border-b font-bold text-sm", dark ? "border-slate-700/50 text-slate-300" : "border-slate-100 text-slate-700")}>Minhas ordens de servico</div>
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-sm">
            <thead className={cn(dark ? "bg-white/5 text-slate-400" : "bg-slate-50 text-slate-500")}>
              <tr>
                <th className="px-5 py-3 text-left">Protocolo</th>
                <th className="px-5 py-3 text-left">Provedor</th>
                <th className="px-5 py-3 text-left">Tipo</th>
                <th className="px-5 py-3 text-left">Status</th>
                <th className="px-5 py-3 text-right">Prazo</th>
                <th className="px-5 py-3 text-center">Acao</th>
              </tr>
            </thead>
            <tbody className={cn("divide-y", dark ? "divide-white/5" : "divide-slate-100")}>
              {myOrdersRows.map((o) => (
                <tr key={`mine-${o.id}`} className={cn("transition-colors", dark ? "hover:bg-white/5 text-slate-300" : "hover:bg-slate-50 text-slate-700")}>
                  <td className="px-5 py-3 font-mono">{o.protocol}</td>
                  <td className="px-5 py-3">{o.provider}</td>
                  <td className="px-5 py-3"><ServiceTypeBadge type={o.type} /></td>
                  <td className="px-5 py-3"><Badge color={getStatusColor(o.status)} dark={dark}>{o.status}</Badge></td>
                  <td className={cn('px-5 py-3 text-right font-mono text-xs', getDelayHours(o) > 0 ? 'text-rose-500 font-bold' : 'text-slate-500')}>{formatDateTime(o.deadlineAt)}</td>
                  <td className="px-5 py-3 text-center">
                    <button onClick={() => onSelectOrder(o)} className={cn("px-3 py-1 rounded border text-[10px] font-bold hover:opacity-80", dark ? "border-cyan-500/30 bg-cyan-500/10 text-cyan-400" : "border-cyan-200 bg-cyan-50 text-cyan-700")}>Ver</button>
                  </td>
                </tr>
              ))}
              {myOrdersRows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-14 text-center">
                    <Clock size={28} className="mx-auto mb-3 text-slate-500" />
                    <p className="text-sm font-medium text-slate-400 mb-1">Sem O.S vinculadas a voce neste periodo.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className={cn("border rounded-xl shadow-sm overflow-hidden", dark ? "bg-[#1e293b]/60 backdrop-blur-md border-slate-700/50" : "bg-white border-slate-200")}>
        <div className={cn("px-5 py-3 border-b font-bold text-sm", dark ? "border-slate-700/50 text-slate-300" : "border-slate-100 text-slate-700")}>Proximas a vencer</div>
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-sm">
            <thead className={cn(dark ? "bg-white/5 text-slate-400" : "bg-slate-50 text-slate-500")}>
              <tr>
                <th className="px-5 py-3 text-left">Protocolo</th>
                <th className="px-5 py-3 text-left">Provedor</th>
                <th className="px-5 py-3 text-left">Tipo</th>
                <th className="px-5 py-3 text-left">Status</th>
                <th className="px-5 py-3 text-right">Prazo</th>
                <th className="px-5 py-3 text-center">Acao</th>
              </tr>
            </thead>
            <tbody className={cn("divide-y", dark ? "divide-white/5" : "divide-slate-100")}>
              {[...active].sort((a, b) => a.deadlineAt - b.deadlineAt).slice(0, 8).map((o) => (
                <tr key={o.id} className={cn("transition-colors", dark ? "hover:bg-white/5 text-slate-300" : "hover:bg-slate-50 text-slate-700")}>
                  <td className="px-5 py-3 font-mono">{o.protocol}</td>
                  <td className="px-5 py-3">{o.provider}</td>
                  <td className="px-5 py-3"><ServiceTypeBadge type={o.type} /></td>
                  <td className="px-5 py-3"><Badge color={getStatusColor(o.status)} dark={dark}>{o.status}</Badge></td>
                  <td className={cn('px-5 py-3 text-right font-mono text-xs', getDelayHours(o) > 0 ? 'text-rose-500 font-bold' : 'text-slate-500')}>{formatDateTime(o.deadlineAt)}</td>
                  <td className="px-5 py-3 text-center">
                    <button onClick={() => onSelectOrder(o)} className={cn("px-3 py-1 rounded border text-[10px] font-bold hover:opacity-80", dark ? "border-cyan-500/30 bg-cyan-500/10 text-cyan-400" : "border-cyan-200 bg-cyan-50 text-cyan-700")}>Ver</button>
                  </td>
                </tr>
              ))}
              {active.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-14 text-center">
                    <Clock size={28} className="mx-auto mb-3 text-slate-500" />
                    <p className="text-sm font-medium text-slate-400 mb-1">Sem OS ativas no periodo.</p>
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

const OSListView = ({
  orders,
  onSelectOrder,
  onAdvanceStatus,
  onBulkStatusUpdate,
  onBulkAssignTech,
  onToast,
}) => {
  const { dark } = useTheme();
  const [period, setPeriod] = useState('7d');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('Todas');
  const [providerFilter, setProviderFilter] = useState('Todos');
  const [priorityFilter, setPriorityFilter] = useState('Todas');
  const [selected, setSelected] = useState({});
  const [bulkStatus, setBulkStatus] = useState('Em Analise');
  const [bulkTech, setBulkTech] = useState('');
  const [page, setPage] = useState(1);

  const PAGE_SIZE = 25;
  const scoped = useMemo(() => filterByPeriod(orders, period), [orders, period]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();

    return scoped.filter((o) => {
      const matchQ =
        !q ||
        o.protocol.toLowerCase().includes(q) ||
        o.provider.toLowerCase().includes(q) ||
        (o.tech || '').toLowerCase().includes(q) ||
        (o.owner || '').toLowerCase().includes(q) ||
        o.type.toLowerCase().includes(q);

      const matchStatus = statusFilter === 'Todas' ? true : o.status === statusFilter;
      const matchProvider = providerFilter === 'Todos' ? true : o.provider === providerFilter;
      const matchPriority = priorityFilter === 'Todas' ? true : o.priority === priorityFilter;

      return matchQ && matchStatus && matchProvider && matchPriority;
    });
  }, [scoped, search, statusFilter, providerFilter, priorityFilter]);

  useEffect(() => {
    setPage(1);
    setSelected({});
  }, [period, search, statusFilter, providerFilter, priorityFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const rows = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const selectedIds = rows.filter((r) => selected[r.id]).map((r) => r.id);
  const allVisibleSelected = rows.length > 0 && rows.every((r) => selected[r.id]);

  const toggleSelectAllVisible = () => {
    if (allVisibleSelected) {
      const next = { ...selected };
      rows.forEach((r) => delete next[r.id]);
      setSelected(next);
      return;
    }
    const next = { ...selected };
    rows.forEach((r) => {
      next[r.id] = true;
    });
    setSelected(next);
  };

  const runBulkStatus = () => {
    if (!selectedIds.length) return;
    onBulkStatusUpdate(selectedIds, bulkStatus);
    setSelected({});
    onToast(`${selectedIds.length} OS atualizadas para ${bulkStatus}.`);
  };

  const runBulkTech = () => {
    if (!selectedIds.length || !bulkTech) return;
    onBulkAssignTech(selectedIds, bulkTech);
    setSelected({});
    onToast(`${selectedIds.length} OS atribuidas para ${bulkTech}.`);
  };

  const selectClassName = cn("w-full px-3 py-2 border rounded-lg text-sm outline-none transition-colors",
    dark ? "bg-[#0f172a]/80 backdrop-blur-xl border-slate-700/50 text-white placeholder:text-slate-600 focus:border-blue-500/50" : "bg-white border-slate-300 focus:border-blue-500");

  return (
    <div className="space-y-5">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <h2 className={cn("text-2xl font-bold", dark ? "text-white" : "text-slate-900")}>Ordens de Servico</h2>
          <p className={cn("text-sm", dark ? "text-slate-400" : "text-slate-500")}>Busca completa, filtros e acoes em lote.</p>
        </div>
        <PeriodTabs value={period} onChange={setPeriod} />
      </div>

      <div className={cn("border rounded-xl p-4 grid grid-cols-1 md:grid-cols-12 gap-3", dark ? "bg-[#1e293b]/60 backdrop-blur-md border-slate-700/50" : "bg-white border-slate-200")}>
        <div className="md:col-span-4 relative">
          <Search size={14} className={cn("absolute left-3 top-1/2 -translate-y-1/2", dark ? "text-slate-500" : "text-slate-400")} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Pesquisar protocolo, provedor, tecnico..."
            className={cn("w-full pl-9 pr-3 py-2 border rounded-lg text-sm outline-none transition-colors",
              dark ? "bg-[#0f172a]/80 backdrop-blur-xl border-slate-700/50 text-white placeholder:text-slate-600 focus:border-blue-500/50" : "bg-white border-slate-300 focus:border-blue-500")} />
        </div>

        <div className="md:col-span-2">
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={selectClassName}>
            <option>Todas</option>
            {STATUS_FLOW.map((s) => <option key={s}>{s}</option>)}
          </select>
        </div>

        <div className="md:col-span-3">
          <select value={providerFilter} onChange={(e) => setProviderFilter(e.target.value)} className={selectClassName}>
            <option>Todos</option>
            {PROVIDERS.map((p) => <option key={p}>{p}</option>)}
          </select>
        </div>

        <div className="md:col-span-3">
          <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)} className={selectClassName}>
            <option>Todas</option>
            {PRIORITIES.map((p) => <option key={p}>{p}</option>)}
          </select>
        </div>

        <div className={cn("md:col-span-12 border-t pt-3 grid grid-cols-1 lg:grid-cols-2 gap-2", dark ? "border-slate-700/50" : "border-slate-100")}>
          <div className="flex gap-2">
            <select value={bulkStatus} onChange={(e) => setBulkStatus(e.target.value)} className={cn(selectClassName, "flex-1")}>
              {STATUS_FLOW.map((s) => <option key={s}>{s}</option>)}
            </select>
            <button onClick={runBulkStatus} className={cn("px-3 py-2 text-xs rounded-lg border font-bold", dark ? "border-cyan-500/30 bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20" : "border-cyan-200 bg-cyan-50 text-cyan-700")}>Status em lote</button>
          </div>

          <div className="flex gap-2">
            <select value={bulkTech} onChange={(e) => setBulkTech(e.target.value)} className={cn(selectClassName, "flex-1")}>
              <option value="">Selecione tecnico</option>
              {TECHS.map((t) => <option key={t.name} value={t.name}>{t.name}</option>)}
            </select>
            <button onClick={runBulkTech} className={cn("px-3 py-2 text-xs rounded-lg border font-bold", dark ? "border-indigo-500/30 bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20" : "border-indigo-200 bg-indigo-50 text-indigo-700")}>Atribuir em lote</button>
          </div>
        </div>
      </div>

      <div className={cn("border rounded-xl overflow-hidden shadow-sm", dark ? "bg-[#1e293b]/60 backdrop-blur-md border-slate-700/50" : "bg-white border-slate-200")}>
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-sm">
            <thead className={cn(dark ? "bg-white/5 text-slate-400" : "bg-slate-50 text-slate-500")}>
              <tr>
                <th className="px-4 py-3 text-left">
                  <input type="checkbox" checked={allVisibleSelected} onChange={toggleSelectAllVisible} />
                </th>
                <th className="px-5 py-3 text-left">Protocolo</th>
                <th className="px-5 py-3 text-left">Provedor</th>
                <th className="px-5 py-3 text-left">Tecnico</th>
                <th className="px-5 py-3 text-left">Owner</th>
                <th className="px-5 py-3 text-left">Tipo</th>
                <th className="px-5 py-3 text-left">Prioridade</th>
                <th className="px-5 py-3 text-left">Status</th>
                <th className="px-5 py-3 text-right">Prazo</th>
                <th className="px-5 py-3 text-center">Acao</th>
              </tr>
            </thead>
            <tbody className={cn("divide-y", dark ? "divide-white/5" : "divide-slate-100")}>
              {rows.map((o) => (
                <tr key={o.id} className={cn("transition-colors", dark ? "hover:bg-white/5 text-slate-300" : "hover:bg-slate-50 text-slate-700")}>
                  <td className="px-4 py-3">
                    <input type="checkbox" checked={!!selected[o.id]} onChange={() => setSelected((p) => ({ ...p, [o.id]: !p[o.id] }))} />
                  </td>
                  <td className="px-5 py-3 font-mono">{o.protocol}</td>
                  <td className="px-5 py-3">{o.provider}</td>
                  <td className="px-5 py-3">{o.tech || '-'}</td>
                  <td className="px-5 py-3">{o.owner || '-'}</td>
                  <td className="px-5 py-3"><ServiceTypeBadge type={o.type} /></td>
                  <td className="px-5 py-3"><Badge color={getPriorityColor(o.priority)} dark={dark}>{o.priority}</Badge></td>
                  <td className="px-5 py-3"><Badge color={getStatusColor(o.status)} dark={dark}>{o.status}</Badge></td>
                  <td className={cn('px-5 py-3 text-right font-mono text-xs', getDelayHours(o) > 0 && isActive(o) ? 'text-rose-500 font-bold' : 'text-slate-500')}>{formatDateTime(o.deadlineAt)}</td>
                  <td className="px-5 py-3 text-center flex justify-center gap-1">
                    <button onClick={() => onSelectOrder(o)} className={cn("px-2 py-1 rounded border text-[10px] font-bold", dark ? "border-cyan-500/30 bg-cyan-500/10 text-cyan-400" : "border-cyan-200 bg-cyan-50 text-cyan-700")}>Abrir</button>
                    {o.status !== 'Fechada' && (
                      <button onClick={() => onAdvanceStatus(o.id)} className={cn("px-2 py-1 rounded border text-[10px]", dark ? "border-slate-700/50 bg-white/5 text-slate-300" : "border-slate-300 bg-white")}>Avancar</button>
                    )}
                  </td>
                </tr>
              ))}

              {rows.length === 0 && <tr><td colSpan={10} className="px-5 py-10 text-center text-slate-500">Nenhuma OS encontrada.</td></tr>}
            </tbody>
          </table>
        </div>

        <div className={cn("px-5 py-3 border-t flex justify-between items-center text-xs", dark ? "bg-white/5 border-slate-700/50 text-slate-400" : "bg-slate-50 border-slate-200 text-slate-500")}>
          <span>
            Pagina <strong>{currentPage}</strong> de <strong>{totalPages}</strong> ({filtered.length} registros)
          </span>
          <div className="flex gap-2">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1} className={cn("px-3 py-1.5 border rounded text-xs font-medium disabled:opacity-40", dark ? "bg-white/5 border-slate-700/50 text-slate-300 hover:bg-white/10" : "bg-white border-slate-300 text-slate-600 hover:bg-slate-50")}>Anterior</button>
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className={cn("px-3 py-1.5 border rounded text-xs font-medium disabled:opacity-40", dark ? "bg-white/5 border-slate-700/50 text-slate-300 hover:bg-white/10" : "bg-white border-slate-300 text-slate-600 hover:bg-slate-50")}>Proximo</button>
          </div>
        </div>
      </div>
    </div>
  );
};

const OSCreateView = ({ onCreateOrder, onCancel, onToast, resetToken }) => {
  const [loading, setLoading] = useState(false);
  const [enhancing, setEnhancing] = useState(false);

  const buildDefaultForm = () => {
    const now = new Date();
    const plusOneDay = new Date(now.getTime() + 24 * HOUR_MS);
    return {
      provider: PROVIDERS[0],
      type: SERVICE_TYPES[0],
      priority: 'Normal',
      tech: '',
      owner: ANALYST_USERS[0],
      origin: 'Suporte Online',
      sector: 'NOC',
      solicitant: '',
      deadlineDate: `${plusOneDay.getFullYear()}-${pad(plusOneDay.getMonth() + 1)}-${pad(plusOneDay.getDate())}`,
      deadlineTime: `${pad(plusOneDay.getHours())}:${pad(plusOneDay.getMinutes())}`,
      description: '',
      internalNotes: '',
      occurrenceNumber: createOccurrenceNumber(),
      occurrenceStatus: 'Aberta',
      occurrenceType: OCCURRENCE_TYPES[0],
      occurrenceOrigin: 'Suporte Online',
      occurrenceSector: 'NOC',
      occurrenceOpenedBy: 'Gerencia',
      occurrenceResponsible: ANALYST_USERS[0],
      occurrenceDate: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
      occurrenceTime: `${pad(now.getHours())}:${pad(now.getMinutes())}`,
    };
  };

  const [form, setForm] = useState(buildDefaultForm);

  useEffect(() => {
    setForm(buildDefaultForm());
  }, [resetToken, setForm]);

  const setField = (name, value) => setForm((prev) => ({ ...prev, [name]: value }));

  const enhanceDescription = () => {
    if (!form.description.trim()) return;
    setEnhancing(true);
    setTimeout(() => {
      const improved = `Resumo tecnico:
- Sintoma: ${form.description.trim()}
- Impacto: degradacao no servico ao cliente
- Validacoes iniciais: ping, perda de pacote, nivel de sinal
- Acao sugerida: triagem N1 e encaminhamento para tecnico de campo se necessario`;
      setField('description', improved);
      setEnhancing(false);
      onToast('Descricao aprimorada.');
    }, 900);
  };

  const submit = (e) => {
    e.preventDefault();

    if (!form.description.trim()) {
      onToast('Preencha a descricao.');
      return;
    }

    setLoading(true);
    setTimeout(() => {
      const createdAt = Date.now();
      const parsed = new Date(`${form.deadlineDate}T${form.deadlineTime}`).getTime();
      const deadlineAt = Number.isFinite(parsed) ? parsed : createdAt + 24 * HOUR_MS;
      const parsedOccurrenceCreatedAt = new Date(`${form.occurrenceDate}T${form.occurrenceTime}`).getTime();
      const occurrenceCreatedAt = Number.isFinite(parsedOccurrenceCreatedAt) ? parsedOccurrenceCreatedAt : createdAt;
      const occurrenceNumber = form.occurrenceNumber.trim() || createOccurrenceNumber();
      const occurrenceId = `OCC-MANUAL-${slugify(form.provider)}-${slugify(occurrenceNumber)}`;

      onCreateOrder({
        id: `OS-${Date.now()}`,
        protocol: createOrderProtocol(),
        provider: form.provider,
        tech: form.tech || null,
        owner: form.owner || ANALYST_USERS[0],
        solicitant: form.solicitant,
        type: form.type,
        priority: form.priority,
        status: 'Aberta',
        createdAt,
        deadlineAt,
        closedAt: null,
        sector: form.sector,
        origin: form.origin,
        description: form.description,
        internalNotes: form.internalNotes,
        occurrenceId,
        occurrenceNumber,
        occurrenceStatus: form.occurrenceStatus,
        occurrenceType: form.occurrenceType,
        occurrenceOrigin: form.occurrenceOrigin,
        occurrenceSector: form.occurrenceSector,
        occurrenceOpenedBy: form.occurrenceOpenedBy,
        occurrenceResponsible: normalizeAnalystName(form.occurrenceResponsible, ANALYST_USERS[0]),
        occurrenceCreatedAt,
        occurrenceDescription: form.description,
        isInconsistent: false,
        attachments: [{ id: `n-${Date.now()}`, name: 'evidencia_upload.txt' }],
        occurrences: [
          { at: createdAt, user: 'Voce', text: 'OS criada manualmente.' },
        ],
      });

      setLoading(false);
      onToast('OS criada com sucesso.');
      setForm(buildDefaultForm());
    }, 850);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Nova Ordem de Servico</h2>
          <p className="text-sm text-slate-500">Formulario completo de abertura para analista/tecnico.</p>
        </div>
        <button onClick={onCancel} className="px-3 py-2 border border-slate-300 rounded-lg text-sm hover:bg-slate-50">
          Voltar para provedores
        </button>
      </div>

      <form onSubmit={submit} className="space-y-5">
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
          <h3 className="font-bold text-slate-800">Identificacao da Ocorrencia Vinculada</h3>
          <p className="text-xs text-slate-500">Protocolo da O.S e numero da ocorrencia sao gerados automaticamente e nao sao editaveis.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-xs uppercase font-bold tracking-wider text-slate-500 mb-1 block">Numero da Ocorrencia</label>
              <input value={form.occurrenceNumber} readOnly className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-slate-100 text-slate-600 cursor-not-allowed" />
            </div>
            <div>
              <label className="text-xs uppercase font-bold tracking-wider text-slate-500 mb-1 block">Protocolo da O.S</label>
              <input value="Gerado automaticamente ao salvar" readOnly className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-slate-100 text-slate-600 cursor-not-allowed" />
            </div>
            <div>
              <label className="text-xs uppercase font-bold tracking-wider text-slate-500 mb-1 block">Status</label>
              <select value={form.occurrenceStatus} onChange={(e) => setField('occurrenceStatus', e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
                {OCCURRENCE_STATUS.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs uppercase font-bold tracking-wider text-slate-500 mb-1 block">Tipo de Ocorrencia</label>
              <select value={form.occurrenceType} onChange={(e) => setField('occurrenceType', e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
                {OCCURRENCE_TYPES.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs uppercase font-bold tracking-wider text-slate-500 mb-1 block">Origem</label>
              <select value={form.occurrenceOrigin} onChange={(e) => setField('occurrenceOrigin', e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
                {OCCURRENCE_ORIGINS.map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs uppercase font-bold tracking-wider text-slate-500 mb-1 block">Setor</label>
              <select value={form.occurrenceSector} onChange={(e) => setField('occurrenceSector', e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
                {OCCURRENCE_SECTORS.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs uppercase font-bold tracking-wider text-slate-500 mb-1 block">Usuario responsavel</label>
              <select value={form.occurrenceResponsible} onChange={(e) => setField('occurrenceResponsible', e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
                {ANALYST_USERS.map((a) => (
                  <option key={a}>{a}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs uppercase font-bold tracking-wider text-slate-500 mb-1 block">Aberta por</label>
              <input value={form.occurrenceOpenedBy} onChange={(e) => setField('occurrenceOpenedBy', e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs uppercase font-bold tracking-wider text-slate-500 mb-1 block">Data de Criacao</label>
                <input type="date" value={form.occurrenceDate} onChange={(e) => setField('occurrenceDate', e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
              </div>
              <div>
                <label className="text-xs uppercase font-bold tracking-wider text-slate-500 mb-1 block">Hora</label>
                <input type="time" value={form.occurrenceTime} onChange={(e) => setField('occurrenceTime', e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
          <h3 className="font-bold text-slate-800 flex items-center gap-2">
            <Briefcase size={16} className="text-blue-600" />
            Contexto da O.S
          </h3>
          <p className="text-xs text-slate-500">Campos padronizados conforme o fluxo operacional da ocorrencia/O.S.</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-xs uppercase font-bold tracking-wider text-slate-500 mb-1 block">Provedor</label>
              <select value={form.provider} onChange={(e) => setField('provider', e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
                {PROVIDERS.map((p) => <option key={p}>{p}</option>)}
              </select>
            </div>

            <div>
              <label className="text-xs uppercase font-bold tracking-wider text-slate-500 mb-1 block">Tipo da O.S</label>
              <select value={form.type} onChange={(e) => setField('type', e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
                {SERVICE_TYPES.map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>

            <div>
              <label className="text-xs uppercase font-bold tracking-wider text-slate-500 mb-1 block">Prioridade</label>
              <select value={form.priority} onChange={(e) => setField('priority', e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
                {PRIORITIES.map((p) => <option key={p}>{p}</option>)}
              </select>
            </div>

            <div>
              <label className="text-xs uppercase font-bold tracking-wider text-slate-500 mb-1 block">Status da O.S</label>
              <input value="Aberta" readOnly className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-slate-100 text-slate-600 cursor-not-allowed" />
            </div>

            <div>
              <label className="text-xs uppercase font-bold tracking-wider text-slate-500 mb-1 block">Analista responsavel</label>
              <select value={form.tech} onChange={(e) => setField('tech', e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
                <option value="">Sem analista</option>
                {ANALYST_USERS.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>

            <div>
              <label className="text-xs uppercase font-bold tracking-wider text-slate-500 mb-1 block">Usuario responsavel</label>
              <select value={form.owner} onChange={(e) => setField('owner', e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
                {ANALYST_USERS.map((a) => <option key={a}>{a}</option>)}
              </select>
            </div>

            <div>
              <label className="text-xs uppercase font-bold tracking-wider text-slate-500 mb-1 block">Solicitante</label>
              <input value={form.solicitant} onChange={(e) => setField('solicitant', e.target.value)} placeholder="Pessoa do provedor" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
            </div>

            <div>
              <label className="text-xs uppercase font-bold tracking-wider text-slate-500 mb-1 block">Origem</label>
              <select value={form.origin} onChange={(e) => setField('origin', e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
                {OCCURRENCE_ORIGINS.map((o) => <option key={o}>{o}</option>)}
              </select>
            </div>

            <div>
              <label className="text-xs uppercase font-bold tracking-wider text-slate-500 mb-1 block">Setor</label>
              <select value={form.sector} onChange={(e) => setField('sector', e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
                {OCCURRENCE_SECTORS.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
          <h3 className="font-bold text-slate-800 flex items-center gap-2">
            <Clock size={16} className="text-amber-600" />
            SLA e descricao
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-xs uppercase font-bold tracking-wider text-slate-500 mb-1 block">Data limite SLA</label>
              <input type="date" value={form.deadlineDate} onChange={(e) => setField('deadlineDate', e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
            </div>
            <div>
              <label className="text-xs uppercase font-bold tracking-wider text-slate-500 mb-1 block">Hora limite SLA</label>
              <input type="time" value={form.deadlineTime} onChange={(e) => setField('deadlineTime', e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
            </div>
          </div>

          <div>
            <label className="text-sm font-semibold text-slate-700">Descricao tecnica</label>
            <textarea rows={5} value={form.description} onChange={(e) => setField('description', e.target.value)} className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg text-sm" placeholder="Descreva o problema com detalhes tecnicos..." />
            <button type="button" onClick={enhanceDescription} disabled={enhancing} className="mt-2 px-3 py-1.5 border border-indigo-200 bg-indigo-50 text-indigo-700 rounded-lg text-xs font-bold flex items-center gap-1 disabled:opacity-40">
              {enhancing ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
              Melhorar descricao
            </button>
          </div>

          <div>
            <label className="text-sm font-semibold text-slate-700">Observacoes internas</label>
            <textarea rows={3} value={form.internalNotes} onChange={(e) => setField('internalNotes', e.target.value)} className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg text-sm bg-amber-50" placeholder="Notas para a equipe..." />
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="px-4 py-2 border border-slate-300 rounded-lg text-sm hover:bg-slate-50">
            Cancelar
          </button>
          <button type="submit" disabled={loading} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2">
            {loading ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
            {loading ? 'Criando...' : 'Criar OS'}
          </button>
        </div>
      </form>
    </div>
  );
};

const TechnicianDelayModal = ({ techName, orders, onClose, onSelectOrder }) => {
  const { dark } = useTheme();

  const list = useMemo(
    () =>
      orders
        .filter((o) => o.tech === techName && getDelayHours(o) > 0)
        .sort((a, b) => getDelayHours(b) - getDelayHours(a)),
    [orders, techName]
  );

  return (
    <Modal title={`Atrasos - ${techName}`} onClose={onClose} maxWidth="max-w-6xl">
      <div className="overflow-x-auto custom-scrollbar max-h-[70vh]">
        <table className="w-full text-sm">
          <thead className={cn("sticky top-0", dark ? "bg-[#1e293b]/60 backdrop-blur-md text-slate-400" : "bg-slate-50 text-slate-500")}>
            <tr>
              <th className="px-4 py-2 text-left">Protocolo</th>
              <th className="px-4 py-2 text-left">Provedor</th>
              <th className="px-4 py-2 text-left">Tipo</th>
              <th className="px-4 py-2 text-left">Status</th>
              <th className="px-4 py-2 text-right">Delay (h)</th>
              <th className="px-4 py-2 text-center">Acao</th>
            </tr>
          </thead>
          <tbody className={cn("divide-y", dark ? "divide-white/5" : "divide-slate-100")}>
            {list.map((o) => (
              <tr key={o.id}>
                <td className="px-4 py-2 font-mono">{o.protocol}</td>
                <td className="px-4 py-2">{o.provider}</td>
                <td className="px-4 py-2"><ServiceTypeBadge type={o.type} /></td>
                <td className="px-4 py-2"><Badge color={getStatusColor(o.status)}>{o.status}</Badge></td>
                <td className="px-4 py-2 text-right font-mono font-bold text-rose-600">{getDelayHours(o).toFixed(2)}</td>
                <td className="px-4 py-2 text-center">
                  <button onClick={() => onSelectOrder(o)} className={cn("px-3 py-1 border rounded text-xs font-bold transition-colors", dark ? "bg-cyan-900/30 border-cyan-700/50 text-cyan-400 hover:bg-cyan-900/50" : "border-cyan-200 bg-cyan-50 text-cyan-700 hover:bg-cyan-100/50")}>
                    Abrir
                  </button>
                </td>
              </tr>
            ))}
            {list.length === 0 && <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-400">Sem atrasos para este tecnico.</td></tr>}
          </tbody>
        </table>
      </div>
    </Modal>
  );
};

const ProvidersView = ({
  resetToken,
  orders,
  onSelectOrder,
  onEditOrder,
  onEditOccurrence,
  onOpenOccurrenceWithOrder,
  onCreateOrderInOccurrence,
  onAddOccurrenceAnnotation,
  currentAnalystName,
  focusProvider,
  focusOccurrenceId,
  onProviderFocusChange,
  onOccurrenceFocusChange,
}) => {
  const [period, setPeriod] = useState('Tudo');
  const [search, setSearch] = useState('');
  const [selectedProvider, setSelectedProvider] = useState(null);
  const [occurrenceSearch, setOccurrenceSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('Todas');
  const [typeFilter, setTypeFilter] = useState('Todos');
  const [onlyDelayed, setOnlyDelayed] = useState(false);
  const [openedOccurrenceId, setOpenedOccurrenceId] = useState(null);
  const [showOpenOccurrenceModal, setShowOpenOccurrenceModal] = useState(false);
  const [showOpenOrderModal, setShowOpenOrderModal] = useState(false);
  const [draftUploadNotice, setDraftUploadNotice] = useState('');
  const [occurrenceAnnotationText, setOccurrenceAnnotationText] = useState('');
  const [occurrenceAnnotationSaving, setOccurrenceAnnotationSaving] = useState(false);
  const analystOptions = useMemo(() => Array.from(new Set([currentAnalystName, ...ANALYST_USERS].filter(Boolean))), [currentAnalystName]);

  const { dark } = useTheme();

  const buildOccurrenceDraft = () => {
    const now = new Date();
    return {
      type: OCCURRENCE_TYPES[0],
      status: 'Aberta',
      sector: OCCURRENCE_SECTORS[0],
      origin: OCCURRENCE_ORIGINS[2],
      openedBy: currentAnalystName || ANALYST_USERS[0],
      responsible: currentAnalystName || ANALYST_USERS[0],
      description: '',
      date: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
      time: `${pad(now.getHours())}:${pad(now.getMinutes())}`,
    };
  };

  const buildOrderDraft = () => {
    const now = new Date();
    const plusOneDay = new Date(now.getTime() + 24 * HOUR_MS);
    return {
      type: SERVICE_TYPES[0],
      priority: 'Normal',
      status: 'Aberta',
      owner: currentAnalystName || ANALYST_USERS[0],
      analyst: currentAnalystName || ANALYST_USERS[0],
      solicitant: '',
      sector: OCCURRENCE_SECTORS[0],
      origin: OCCURRENCE_ORIGINS[2],
      deadlineDate: `${plusOneDay.getFullYear()}-${pad(plusOneDay.getMonth() + 1)}-${pad(plusOneDay.getDate())}`,
      deadlineTime: `${pad(plusOneDay.getHours())}:${pad(plusOneDay.getMinutes())}`,
      description: '',
      attachments: [],
    };
  };

  const [occurrenceDraft, setOccurrenceDraft] = useState(buildOccurrenceDraft);
  const [orderDraft, setOrderDraft] = useState(buildOrderDraft);

  const openProviderPanel = (providerName) => {
    setOpenedOccurrenceId(null);
    setSelectedProvider(providerName);
    onProviderFocusChange?.(providerName);
    onOccurrenceFocusChange?.(null);
    pushUiHistoryState({ layer: 'provider', provider: providerName });
  };

  const openOccurrenceOrders = (occurrenceId) => {
    setOpenedOccurrenceId(occurrenceId);
    onOccurrenceFocusChange?.(occurrenceId);
    pushUiHistoryState({ layer: 'occurrence', occurrenceId });
  };

  const scoped = useMemo(() => (selectedProvider ? filterByPeriod(orders, period) : orders), [orders, period, selectedProvider]);
  const scopedOccurrences = useMemo(() => buildOccurrencesFromOrders(scoped), [scoped]);

  useEffect(() => {
    if (!focusProvider) return;
    setSelectedProvider(focusProvider);
  }, [focusProvider]);

  useEffect(() => {
    if (!focusOccurrenceId) return;
    setOpenedOccurrenceId(focusOccurrenceId);
  }, [focusOccurrenceId]);

  useEffect(() => {
    setSelectedProvider(null);
    setOpenedOccurrenceId(null);
    setSearch('');
    setOccurrenceSearch('');
    setStatusFilter('Todas');
    setTypeFilter('Todos');
    setOnlyDelayed(false);
    setShowOpenOccurrenceModal(false);
    setShowOpenOrderModal(false);
    setDraftUploadNotice('');
    setOccurrenceAnnotationText('');
    setOccurrenceAnnotationSaving(false);
    setOccurrenceDraft(buildOccurrenceDraft());
    setOrderDraft(buildOrderDraft());
  }, [resetToken, setSelectedProvider, setOpenedOccurrenceId]);

  useEffect(() => {
    const onPopState = (event) => {
      if (openedOccurrenceId) {
        setOpenedOccurrenceId(null);
        onOccurrenceFocusChange?.(null);
        event.stopImmediatePropagation?.();
        return;
      }
      if (selectedProvider) {
        setSelectedProvider(null);
        onProviderFocusChange?.(null);
        onOccurrenceFocusChange?.(null);
        event.stopImmediatePropagation?.();
      }
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [openedOccurrenceId, selectedProvider, onProviderFocusChange, onOccurrenceFocusChange]);

  useEffect(() => {
    if (!selectedProvider) return;
    setOccurrenceSearch('');
    setStatusFilter('Todas');
    setTypeFilter('Todos');
    setOnlyDelayed(false);
    setDraftUploadNotice('');
    setOccurrenceAnnotationText('');
    setOccurrenceAnnotationSaving(false);
    setOccurrenceDraft(buildOccurrenceDraft());
    setOrderDraft(buildOrderDraft());
  }, [selectedProvider, currentAnalystName]);

  useEffect(() => {
    setOccurrenceAnnotationText('');
    setOccurrenceAnnotationSaving(false);
  }, [openedOccurrenceId]);

  const providerRows = useMemo(() => {
    const map = new Map();
    scopedOccurrences.forEach((occurrence) => {
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
      row.delayed += occurrence.orders.filter((o) => isActive(o) && getDelayHours(o) > 0).length;
      row.critical += occurrence.orders.filter((o) => o.priority === 'Alta' || o.priority === 'Critica').length;
    });
    return Array.from(map.values()).sort((a, b) => b.orders - a.orders);
  }, [scopedOccurrences]);

  const filteredProviders = useMemo(
    () => providerRows.filter((p) => p.provider.toLowerCase().includes(search.toLowerCase().trim())),
    [providerRows, search]
  );

  const providerOccurrences = useMemo(() => {
    if (!selectedProvider) return [];
    return scopedOccurrences
      .filter((o) => o.provider === selectedProvider)
      .sort((a, b) => b.createdAt - a.createdAt);
  }, [scopedOccurrences, selectedProvider]);

  const filteredOccurrences = useMemo(() => {
    if (!selectedProvider) return [];
    const q = occurrenceSearch.toLowerCase().trim();
    return providerOccurrences.filter((o) => {
      const bySearch = !q || `${o.number} ${o.type} ${o.sector} ${o.status} ${o.description}`.toLowerCase().includes(q);
      const byStatus = statusFilter === 'Todas' || o.status === statusFilter;
      const byType = typeFilter === 'Todos' || o.type === typeFilter;
      const byDelay = !onlyDelayed || (o.orders || []).some((order) => isActive(order) && getDelayHours(order) > 0);
      return bySearch && byStatus && byType && byDelay;
    });
  }, [providerOccurrences, occurrenceSearch, statusFilter, typeFilter, onlyDelayed, selectedProvider]);

  const openedOccurrence = providerOccurrences.find((o) => o.id === openedOccurrenceId) || null;
  const openedOccurrenceOrders = useMemo(() => {
    if (!openedOccurrence) return [];
    return [...openedOccurrence.orders].sort((a, b) => a.deadlineAt - b.deadlineAt);
  }, [openedOccurrence]);
  const openedOccurrenceAnnotations = useMemo(() => {
    if (!openedOccurrence || !Array.isArray(openedOccurrence.annotations)) return [];
    return [...openedOccurrence.annotations].sort((a, b) => b.at - a.at);
  }, [openedOccurrence]);

  const providerKpis = useMemo(() => {
    const providerOrders = providerOccurrences.flatMap((o) => o.orders);
    return {
      occurrences: providerOccurrences.length,
      total: providerOrders.length,
      active: providerOrders.filter(isActive).length,
      delayed: providerOrders.filter((o) => isActive(o) && getDelayHours(o) > 0).length,
      critical: providerOrders.filter((o) => o.priority === 'Alta' || o.priority === 'Critica').length,
    };
  }, [providerOccurrences]);

  const submitOpenOccurrence = (e) => {
    e.preventDefault();
    if (!selectedProvider) return;
    if (!occurrenceDraft.description.trim() || !orderDraft.description.trim()) return;
    const analystName = orderDraft.analyst || currentAnalystName || ANALYST_USERS[0];
    const firstOrderPayload = {
      ...orderDraft,
      priority: 'Normal',
      analyst: analystName,
      owner: analystName,
      attachments: normalizeAttachments(orderDraft.attachments),
    };
    onOpenOccurrenceWithOrder?.(selectedProvider, occurrenceDraft, firstOrderPayload);
    setShowOpenOccurrenceModal(false);
    setDraftUploadNotice('');
    setOccurrenceDraft(buildOccurrenceDraft());
    setOrderDraft(buildOrderDraft());
  };

  const submitOpenOrder = (e) => {
    e.preventDefault();
    if (!openedOccurrence) return;
    if (!orderDraft.description.trim()) return;
    const analystName = orderDraft.analyst || currentAnalystName || ANALYST_USERS[0];
    const orderPayload = {
      ...orderDraft,
      analyst: analystName,
      owner: analystName,
      attachments: normalizeAttachments(orderDraft.attachments),
    };
    onCreateOrderInOccurrence?.(openedOccurrence, orderPayload);
    setShowOpenOrderModal(false);
    setDraftUploadNotice('');
    setOrderDraft(buildOrderDraft());
  };

  const addDraftAttachments = (files) => {
    const { next, rejectedBySize, rejectedByLimit } = appendAttachmentFiles(orderDraft.attachments, files);
    setOrderDraft((p) => ({ ...p, attachments: next }));
    setDraftUploadNotice(buildUploadNotice(rejectedBySize, rejectedByLimit));
  };

  const submitOccurrenceAnnotation = async () => {
    const message = occurrenceAnnotationText.trim();
    if (!openedOccurrence || message.length < 2 || !onAddOccurrenceAnnotation || occurrenceAnnotationSaving) return;
    setOccurrenceAnnotationSaving(true);
    try {
      const ok = await onAddOccurrenceAnnotation(openedOccurrence, message);
      if (ok) setOccurrenceAnnotationText('');
    } finally {
      setOccurrenceAnnotationSaving(false);
    }
  };

  const inputClass = cn("w-full px-3 py-2 border rounded-lg text-sm transition-colors", dark ? "bg-[#1e293b]/50 border-slate-700 text-white placeholder-slate-500" : "bg-white border-slate-300 text-slate-900 placeholder-slate-400");
  const readOnlyInputClass = cn("w-full px-3 py-2 border rounded-lg text-sm cursor-not-allowed", dark ? "bg-[#0f172a]/50 border-slate-700 text-slate-500" : "bg-slate-100 border-slate-300 text-slate-600");
  const labelClass = cn("text-xs uppercase font-bold tracking-wider mb-1 block", dark ? "text-slate-400" : "text-slate-500");
  const panelClass = cn("border rounded-lg p-3 transition-colors", dark ? "bg-[#0f172a]/50 border-slate-700/50" : "bg-slate-50 border-slate-200");
  const sectionTitleClass = cn("text-xs uppercase font-bold", dark ? "text-slate-400" : "text-slate-500");

  if (selectedProvider) {
    return (
      <div className="space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div>
            <button
              onClick={() => {
                setOpenedOccurrenceId(null);
                setSelectedProvider(null);
                onProviderFocusChange?.(null);
                onOccurrenceFocusChange?.(null);
              }}
              className="inline-flex items-center gap-1 text-xs font-semibold text-cyan-700 mb-2 hover:underline"
            >
              <ChevronLeft size={14} />
              Voltar para lista de provedores
            </button>
            <h2 className={cn("text-2xl font-bold", dark ? "text-slate-100" : "text-slate-900")}>{selectedProvider}</h2>
            <p className={cn("text-sm", dark ? "text-slate-400" : "text-slate-500")}>Fluxo por ocorrencia. Cada ocorrencia pode ter varias O.S internas.</p>
          </div>
          <div className="flex items-center gap-2">
            {!openedOccurrence && (
              <button
                onClick={() => {
                  setOccurrenceDraft(buildOccurrenceDraft());
                  setOrderDraft(buildOrderDraft());
                  setDraftUploadNotice('');
                  setShowOpenOccurrenceModal(true);
                }}
                className="px-3 py-2 rounded-lg border border-blue-200 bg-blue-50 text-blue-700 text-xs font-bold hover:bg-blue-100"
              >
                Cadastrar ocorrencia
              </button>
            )}
            <PeriodTabs value={period} onChange={setPeriod} />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
          <div className={cn("border rounded-xl p-4 shadow-sm", dark ? "bg-[#1e293b]/60 backdrop-blur-md border-slate-700/50" : "bg-white border-slate-200")}>
            <div className={cn("text-xs uppercase font-bold", dark ? "text-slate-500" : "text-slate-400")}>Ocorrencias</div>
            <div className={cn("text-3xl font-bold mt-2", dark ? "text-slate-200" : "text-slate-800")}>{providerKpis.occurrences}</div>
          </div>
          <div className={cn("border rounded-xl p-4 shadow-sm", dark ? "bg-[#1e293b]/60 backdrop-blur-md border-slate-700/50" : "bg-white border-slate-200")}>
            <div className={cn("text-xs uppercase font-bold", dark ? "text-slate-500" : "text-slate-400")}>Total O.S</div>
            <div className={cn("text-3xl font-bold mt-2", dark ? "text-slate-200" : "text-slate-800")}>{providerKpis.total}</div>
          </div>
          <div className={cn("border rounded-xl p-4 shadow-sm", dark ? "bg-[#1e293b]/60 backdrop-blur-md border-slate-700/50" : "bg-white border-slate-200")}>
            <div className="text-xs uppercase font-bold text-slate-400">Ativas</div>
            <div className={cn("text-3xl font-bold mt-2", dark ? "text-indigo-400" : "text-indigo-700")}>{providerKpis.active}</div>
          </div>
          <div className={cn("border rounded-xl p-4 shadow-sm", dark ? "bg-[#1e293b]/60 backdrop-blur-md border-rose-500/20" : "bg-white border-rose-200")}>
            <div className="text-xs uppercase font-bold text-rose-500">Atrasadas</div>
            <div className="text-3xl font-bold text-rose-600 mt-2">{providerKpis.delayed}</div>
          </div>
          <div className={cn("border rounded-xl p-4 shadow-sm", dark ? "bg-[#1e293b]/60 backdrop-blur-md border-amber-500/20" : "bg-white border-amber-200")}>
            <div className="text-xs uppercase font-bold text-amber-600">Alta/Critica</div>
            <div className="text-3xl font-bold text-amber-600 mt-2">{providerKpis.critical}</div>
          </div>
        </div>

        {!openedOccurrence && (
          <>
            <div className={cn("border rounded-xl p-4", dark ? "bg-[#1e293b]/60 backdrop-blur-md border-slate-700/50" : "bg-white border-slate-200")}>
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
                <div className="lg:col-span-5 relative">
                  <Search size={14} className={cn("absolute left-3 top-1/2 -translate-y-1/2", dark ? "text-slate-500" : "text-slate-400")} />
                  <input
                    value={occurrenceSearch}
                    onChange={(e) => setOccurrenceSearch(e.target.value)}
                    placeholder="Buscar ocorrencia..."
                    className={cn(
                      "w-full pl-9 pr-3 py-2 border rounded-lg text-sm transition-colors",
                      dark
                        ? "bg-[#0f172a]/80 backdrop-blur-xl border-slate-700/50 text-slate-200 placeholder:text-slate-600 focus:border-blue-500/50"
                        : "bg-white border-slate-300 text-slate-900 focus:border-blue-500"
                    )}
                  />
                </div>

                <div className="lg:col-span-3">
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className={cn(
                      "w-full px-3 py-2 border rounded-lg text-sm",
                      dark ? "bg-[#0f172a]/80 backdrop-blur-xl border-slate-700/50 text-slate-300" : "bg-white border-slate-300 text-slate-900"
                    )}
                  >
                    <option>Todas</option>
                    {OCCURRENCE_STATUS.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </div>

                <div className="lg:col-span-2">
                  <select
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value)}
                    className={cn(
                      "w-full px-3 py-2 border rounded-lg text-sm",
                      dark ? "bg-[#0f172a]/80 backdrop-blur-xl border-slate-700/50 text-slate-300" : "bg-white border-slate-300 text-slate-900"
                    )}
                  >
                    <option>Todos</option>
                    {OCCURRENCE_TYPES.map((t) => (
                      <option key={t}>{t}</option>
                    ))}
                  </select>
                </div>

                <div className="lg:col-span-2 flex items-center gap-2">
                  <label className={cn("inline-flex items-center gap-2 text-xs font-medium", dark ? "text-slate-400" : "text-slate-600")}>
                    <input type="checkbox" checked={onlyDelayed} onChange={(e) => setOnlyDelayed(e.target.checked)} />
                    Com atraso
                  </label>
                  <button
                    onClick={() => {
                      setOccurrenceSearch('');
                      setStatusFilter('Todas');
                      setTypeFilter('Todos');
                      setOnlyDelayed(false);
                    }}
                    className="ml-auto text-xs px-2 py-1 border border-slate-300 rounded hover:bg-slate-50"
                  >
                    Limpar
                  </button>
                </div>
              </div>
            </div>

            <div className={cn("border rounded-xl overflow-hidden shadow-sm", dark ? "bg-[#1e293b]/60 backdrop-blur-md border-slate-700/50" : "bg-white border-slate-200")}>
              <div className={cn("px-5 py-3 border-b font-bold text-sm", dark ? "border-slate-700/50 text-slate-300" : "border-slate-100 text-slate-700")}>
                Ocorrencias do provedor ({filteredOccurrences.length})
              </div>
              <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full text-sm">
                  <thead className={cn(dark ? "bg-white/5 text-slate-400" : "bg-slate-50 text-slate-500")}>
                    <tr>
                      <th className="px-4 py-3 text-left">Numero</th>
                      <th className="px-4 py-3 text-left">Tipo</th>
                      <th className="px-4 py-3 text-left">Setor</th>
                      <th className="px-4 py-3 text-left">Status</th>
                      <th className="px-4 py-3 text-right">OS</th>
                      <th className="px-4 py-3 text-center">Acao</th>
                    </tr>
                  </thead>
                  <tbody className={cn("divide-y", dark ? "divide-white/5" : "divide-slate-100")}>
                    {filteredOccurrences.map((occurrence) => (
                      <tr key={occurrence.id} className={cn("cursor-pointer transition-colors", dark ? "hover:bg-white/5 text-slate-300" : "hover:bg-slate-50 text-slate-700")} onClick={() => openOccurrenceOrders(occurrence.id)}>
                        <td className="px-4 py-3 font-mono">{occurrence.number}</td>
                        <td className="px-4 py-3">{occurrence.type}</td>
                        <td className="px-4 py-3">{occurrence.sector}</td>
                        <td className="px-4 py-3">
                          <Badge color={getOccurrenceStatusColor(occurrence.status)}>{occurrence.status}</Badge>
                        </td>
                        <td className="px-4 py-3 text-right font-mono">{occurrence.orders.length}</td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                openOccurrenceOrders(occurrence.id);
                              }}
                              className="px-3 py-1 rounded border border-cyan-200 bg-cyan-50 text-cyan-700 text-[11px] font-bold hover:bg-cyan-100"
                            >
                              Abrir
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onEditOccurrence(occurrence);
                              }}
                              className="px-3 py-1 rounded border border-indigo-200 bg-indigo-50 text-indigo-700 text-[11px] font-bold hover:bg-indigo-100"
                            >
                              Editar
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {filteredOccurrences.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-4 py-10 text-center text-slate-400">
                          Nenhuma ocorrencia encontrada com esses filtros.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {openedOccurrence && (
          <div className="space-y-4">
            <div className={cn("border rounded-xl p-4 shadow-sm", dark ? "bg-[#1e293b]/60 backdrop-blur-md border-slate-700/50" : "bg-white border-slate-200")}>
              <button
                onClick={() => {
                  setOpenedOccurrenceId(null);
                  onOccurrenceFocusChange?.(null);
                }}
                className="inline-flex items-center gap-1 text-xs font-semibold text-cyan-700 mb-2 hover:underline"
              >
                <ChevronLeft size={14} />
                Voltar para ocorrencias do provedor
              </button>
              <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
                <div>
                  <div className="text-xs uppercase font-bold text-slate-400">Ocorrencia {openedOccurrence.number}</div>
                  <div className={cn("text-sm mt-1", dark ? "text-slate-300" : "text-slate-700")}>{openedOccurrence.description}</div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge color={getOccurrenceStatusColor(openedOccurrence.status)}>{openedOccurrence.status}</Badge>
                  <button
                    onClick={() => {
                      setOrderDraft(buildOrderDraft());
                      setDraftUploadNotice('');
                      setShowOpenOrderModal(true);
                    }}
                    className={cn("px-3 py-1 rounded border text-xs font-bold transition-colors", dark ? "bg-blue-900/30 border-blue-700/50 text-blue-400 hover:bg-blue-900/50" : "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100")}
                  >
                    Criar O.S
                  </button>
                  <button onClick={() => onEditOccurrence(openedOccurrence)} className={cn("px-3 py-1 rounded border text-xs font-bold transition-colors", dark ? "bg-indigo-900/30 border-indigo-700/50 text-indigo-400 hover:bg-indigo-900/50" : "border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100")}>
                    Editar ocorrencia
                  </button>
                </div>
              </div>

              <div className={cn("mt-3 border rounded-lg p-3", dark ? "bg-[#0f172a]/80 backdrop-blur-xl border-slate-700/50" : "bg-slate-50 border-slate-200")}>
                <div className="text-xs uppercase font-bold text-slate-500 mb-2">Identificacao da ocorrencia</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2 text-xs">
                  <div><span className="text-slate-500">Numero da Ocorrencia:</span> <span className={cn("font-semibold", dark ? "text-slate-200" : "text-slate-800")}>{openedOccurrence.number}</span></div>
                  <div><span className="text-slate-500">Status:</span> <span className={cn("font-semibold", dark ? "text-slate-200" : "text-slate-800")}>{openedOccurrence.status}</span></div>
                  <div><span className="text-slate-500">Tipo de Ocorrencia:</span> <span className={cn("font-semibold", dark ? "text-slate-200" : "text-slate-800")}>{openedOccurrence.type}</span></div>
                  <div><span className="text-slate-500">Origem:</span> <span className={cn("font-semibold", dark ? "text-slate-200" : "text-slate-800")}>{openedOccurrence.origin}</span></div>
                  <div><span className="text-slate-500">Setor:</span> <span className={cn("font-semibold", dark ? "text-slate-200" : "text-slate-800")}>{openedOccurrence.sector}</span></div>
                  <div><span className="text-slate-500">Analista responsavel:</span> <span className={cn("font-semibold", dark ? "text-slate-200" : "text-slate-800")}>{openedOccurrence.responsible}</span></div>
                  <div><span className="text-slate-500">Aberta por:</span> <span className={cn("font-semibold", dark ? "text-slate-200" : "text-slate-800")}>{openedOccurrence.openedBy || currentAnalystName || 'Analista'}</span></div>
                  <div><span className="text-slate-500">Data de Criacao:</span> <span className={cn("font-semibold", dark ? "text-slate-200" : "text-slate-800")}>{formatDateTime(openedOccurrence.createdAt)}</span></div>
                  <div><span className="text-slate-500">Qtd. de O.S:</span> <span className={cn("font-semibold", dark ? "text-slate-200" : "text-slate-800")}>{openedOccurrenceOrders.length}</span></div>
                  <div><span className="text-slate-500">Provedor:</span> <span className={cn("font-semibold", dark ? "text-slate-200" : "text-slate-800")}>{openedOccurrence.provider}</span></div>
                </div>
              </div>
            </div>

            <div className={cn("border rounded-xl overflow-hidden shadow-sm", dark ? "bg-[#1e293b]/60 backdrop-blur-md border-slate-700/50" : "bg-white border-slate-200")}>
              <div className={cn("px-5 py-3 border-b flex items-center justify-between gap-3", dark ? "border-slate-700/50" : "border-slate-100")}>
                <div className={cn("font-bold text-sm", dark ? "text-slate-300" : "text-slate-700")}>Ordens de servico da ocorrencia ({openedOccurrenceOrders.length})</div>
                <button
                  onClick={() => {
                    setOrderDraft(buildOrderDraft());
                    setDraftUploadNotice('');
                    setShowOpenOrderModal(true);
                  }}
                  className={cn("px-3 py-1.5 rounded border text-xs font-bold transition-colors", dark ? "bg-blue-900/30 border-blue-700/50 text-blue-400 hover:bg-blue-900/50" : "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100")}
                >
                  Criar outra O.S
                </button>
              </div>
              <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full text-sm">
                  <thead className={cn(dark ? "bg-white/5 text-slate-400" : "bg-slate-50 text-slate-500")}>
                    <tr>
                      <th className="px-4 py-3 text-left">Protocolo</th>
                      <th className="px-4 py-3 text-left">Tipo</th>
                      <th className="px-4 py-3 text-left">Prioridade</th>
                      <th className="px-4 py-3 text-left">Status</th>
                      <th className="px-4 py-3 text-right">Prazo</th>
                      <th className="px-4 py-3 text-center">Acao</th>
                    </tr>
                  </thead>
                  <tbody className={cn("divide-y", dark ? "divide-white/5" : "divide-slate-100")}>
                    {openedOccurrenceOrders.map((order) => (
                      <tr key={order.id} className={cn("cursor-pointer transition-colors", dark ? "hover:bg-white/5" : "hover:bg-slate-50")} onClick={() => onSelectOrder(order)}>
                        <td className="px-4 py-3 font-mono">{order.protocol}</td>
                        <td className="px-4 py-3">
                          <ServiceTypeBadge type={order.type} />
                        </td>
                        <td className="px-4 py-3">
                          <Badge color={getPriorityColor(order.priority)}>{order.priority}</Badge>
                        </td>
                        <td className="px-4 py-3">
                          <Badge color={getStatusColor(order.status)}>{order.status}</Badge>
                        </td>
                        <td className={cn('px-4 py-3 text-right font-mono text-xs', getDelayHours(order) > 0 ? 'text-rose-600 font-bold' : 'text-slate-500')}>
                          {formatDateTime(order.deadlineAt)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onEditOrder(order);
                              }}
                              className={cn("px-3 py-1 rounded border text-[11px] font-bold transition-colors", dark ? "bg-indigo-900/30 border-indigo-700/50 text-indigo-400 hover:bg-indigo-900/50" : "border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100")}
                            >
                              Editar
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {openedOccurrenceOrders.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-4 py-10 text-center text-slate-400">
                          Esta ocorrencia ainda nao possui O.S vinculadas.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className={cn("border rounded-xl p-4 shadow-sm", dark ? "bg-[#1e293b]/60 backdrop-blur-md border-slate-700/50" : "bg-white border-slate-200")}>
              <div className={cn("text-xs uppercase font-bold mb-2", dark ? "text-slate-400" : "text-slate-500")}>Anotacoes da ocorrencia</div>
              <textarea
                value={occurrenceAnnotationText}
                onChange={(e) => setOccurrenceAnnotationText(e.target.value)}
                rows={3}
                placeholder="Adicionar anotacao da ocorrencia..."
                className={cn(
                  "w-full px-3 py-2 border rounded-lg text-sm resize-none",
                  dark
                    ? "bg-[#0f172a]/80 border-slate-700/50 text-slate-200 placeholder:text-slate-500"
                    : "bg-white border-slate-300 text-slate-900 placeholder:text-slate-400"
                )}
              />
              <div className="mt-2 flex justify-end">
                <button
                  onClick={submitOccurrenceAnnotation}
                  disabled={occurrenceAnnotationSaving || occurrenceAnnotationText.trim().length < 2}
                  className={cn(
                    "px-3 py-1.5 rounded border text-xs font-bold transition-colors disabled:opacity-50",
                    dark
                      ? "bg-cyan-900/30 border-cyan-700/50 text-cyan-400 hover:bg-cyan-900/50"
                      : "border-cyan-200 bg-cyan-50 text-cyan-700 hover:bg-cyan-100"
                  )}
                >
                  {occurrenceAnnotationSaving ? 'Salvando...' : 'Adicionar anotacao'}
                </button>
              </div>
              <div className="mt-3 space-y-2 max-h-[240px] overflow-y-auto custom-scrollbar">
                {openedOccurrenceAnnotations.map((note) => (
                  <div key={note.id} className={cn("border rounded-lg p-3", dark ? "border-slate-700/50 bg-[#0f172a]/60" : "border-slate-200 bg-slate-50")}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className={cn("font-bold", dark ? "text-slate-300" : "text-slate-700")}>{note.user || 'Sistema'}</span>
                      <span className={cn("font-mono", dark ? "text-slate-500" : "text-slate-400")}>{formatDateTime(note.at)}</span>
                    </div>
                    <p className={cn("text-sm whitespace-pre-wrap", dark ? "text-slate-400" : "text-slate-700")}>{note.text}</p>
                  </div>
                ))}
                {openedOccurrenceAnnotations.length === 0 && <div className={cn("text-xs", dark ? "text-slate-500" : "text-slate-400")}>Nenhuma anotacao nesta ocorrencia.</div>}
              </div>
            </div>
          </div>
        )}

        {showOpenOccurrenceModal && (
          <Modal
            title={`Nova ocorrencia - ${selectedProvider}`}
            onClose={() => {
              setShowOpenOccurrenceModal(false);
              setDraftUploadNotice('');
            }}
            maxWidth="max-w-6xl"
          >
            <form onSubmit={submitOpenOccurrence} className="space-y-4 max-h-[75vh] overflow-y-auto custom-scrollbar pr-1">
              <div className={sectionTitleClass}>Dados da ocorrencia</div>
              <div>
                <label className={labelClass}>Provedor vinculado</label>
                <input value={selectedProvider || ''} readOnly className={readOnlyInputClass} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                <div>
                  <label className={labelClass}>Tipo de ocorrencia</label>
                  <select value={occurrenceDraft.type} onChange={(e) => setOccurrenceDraft((p) => ({ ...p, type: e.target.value }))} className={inputClass}>
                    {OCCURRENCE_TYPES.map((t) => (
                      <option key={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Status</label>
                  <select value={occurrenceDraft.status} onChange={(e) => setOccurrenceDraft((p) => ({ ...p, status: e.target.value }))} className={inputClass}>
                    {OCCURRENCE_STATUS.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Setor</label>
                  <select value={occurrenceDraft.sector} onChange={(e) => setOccurrenceDraft((p) => ({ ...p, sector: e.target.value }))} className={inputClass}>
                    {OCCURRENCE_SECTORS.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Origem</label>
                  <select value={occurrenceDraft.origin} onChange={(e) => setOccurrenceDraft((p) => ({ ...p, origin: e.target.value }))} className={inputClass}>
                    {OCCURRENCE_ORIGINS.map((o) => (
                      <option key={o}>{o}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Gerente responsavel</label>
                  <select value={occurrenceDraft.responsible} onChange={(e) => setOccurrenceDraft((p) => ({ ...p, responsible: e.target.value }))} className={inputClass}>
                    {analystOptions.map((a) => (
                      <option key={a}>{a}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Aberta por</label>
                  <input value={occurrenceDraft.openedBy} readOnly className={readOnlyInputClass} />
                </div>
                <div>
                  <label className={labelClass}>Data de criacao</label>
                  <input type="date" value={occurrenceDraft.date} onChange={(e) => setOccurrenceDraft((p) => ({ ...p, date: e.target.value }))} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Hora de criacao</label>
                  <input type="time" value={occurrenceDraft.time} onChange={(e) => setOccurrenceDraft((p) => ({ ...p, time: e.target.value }))} className={inputClass} />
                </div>
              </div>
              <div>
                <label className={labelClass}>Descricao da ocorrencia</label>
                <textarea value={occurrenceDraft.description} onChange={(e) => setOccurrenceDraft((p) => ({ ...p, description: e.target.value }))} rows={3} placeholder="Descreva o motivo da ocorrencia" className={inputClass} />
              </div>

              <div className={sectionTitleClass}>Primeira O.S da ocorrencia</div>
              <div>
                <label className={labelClass}>Provedor da O.S</label>
                <input value={selectedProvider || ''} readOnly className={readOnlyInputClass} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                <div>
                  <label className={labelClass}>Tipo da O.S</label>
                  <select value={orderDraft.type} onChange={(e) => setOrderDraft((p) => ({ ...p, type: e.target.value }))} className={inputClass}>
                    {SERVICE_TYPES.map((t) => (
                      <option key={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Status</label>
                  <select value={orderDraft.status} onChange={(e) => setOrderDraft((p) => ({ ...p, status: e.target.value }))} className={inputClass}>
                    {STATUS_FLOW.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Analista responsavel</label>
                  <select value={orderDraft.analyst} onChange={(e) => setOrderDraft((p) => ({ ...p, analyst: e.target.value }))} className={inputClass}>
                    {analystOptions.map((a) => (
                      <option key={a} value={a}>
                        {a}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Solicitante</label>
                  <input value={orderDraft.solicitant} onChange={(e) => setOrderDraft((p) => ({ ...p, solicitant: e.target.value }))} placeholder="Pessoa do provedor" className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Setor</label>
                  <select value={orderDraft.sector} onChange={(e) => setOrderDraft((p) => ({ ...p, sector: e.target.value }))} className={inputClass}>
                    {OCCURRENCE_SECTORS.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Origem</label>
                  <select value={orderDraft.origin} onChange={(e) => setOrderDraft((p) => ({ ...p, origin: e.target.value }))} className={inputClass}>
                    {OCCURRENCE_ORIGINS.map((o) => (
                      <option key={o}>{o}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Previsao - Data</label>
                  <input type="date" value={orderDraft.deadlineDate} onChange={(e) => setOrderDraft((p) => ({ ...p, deadlineDate: e.target.value }))} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Previsao - Hora</label>
                  <input type="time" value={orderDraft.deadlineTime} onChange={(e) => setOrderDraft((p) => ({ ...p, deadlineTime: e.target.value }))} className={inputClass} />
                </div>
              </div>
              <div>
                <label className={labelClass}>Descricao tecnica da O.S</label>
                <textarea value={orderDraft.description} onChange={(e) => setOrderDraft((p) => ({ ...p, description: e.target.value }))} rows={3} placeholder="Descreva a ordem de servico" className={inputClass} />
              </div>
              <div className={cn(panelClass, "space-y-2")}>
                <div className={sectionTitleClass}>Anexos da primeira O.S</div>
                <div className={cn("text-[11px]", dark ? "text-slate-400" : "text-slate-500")}>Ate 10 anexos por O.S, maximo 10MB por arquivo.</div>
                <input
                  type="file"
                  multiple
                  accept={ATTACHMENTS_ACCEPT}
                  onChange={(e) => {
                    addDraftAttachments(e.target.files);
                    e.target.value = '';
                  }}
                  className={cn("block w-full text-xs file:mr-3 file:px-3 file:py-1.5 file:rounded file:border-0 file:text-slate-700", dark ? "text-slate-300 file:bg-slate-700 file:text-slate-200" : "text-slate-600 file:bg-slate-200")}
                />
                {draftUploadNotice && <div className="text-xs text-amber-700">{draftUploadNotice}</div>}
                <div className="space-y-1">
                  {normalizeAttachments(orderDraft.attachments).map((a) => (
                    <div key={a.id} className={cn("flex items-center justify-between gap-2 border rounded px-2 py-1.5 text-xs", dark ? "bg-[#1e293b]/50 border-slate-700 text-slate-300" : "bg-white border-slate-200 text-slate-700")}>
                      <div className="min-w-0">
                        <div className="truncate">{a.name}</div>
                        <div className={dark ? "text-slate-400" : "text-slate-400"}>{a.mime || 'arquivo'} • {formatFileSize(a.size)}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setOrderDraft((p) => ({ ...p, attachments: normalizeAttachments(p.attachments).filter((att) => att.id !== a.id) }))}
                        className={cn("px-2 py-1 border rounded transition-colors", dark ? "border-rose-900/50 bg-rose-950/30 text-rose-400 hover:bg-rose-900/50" : "border-rose-200 bg-rose-50 text-rose-700")}
                      >
                        Remover
                      </button>
                    </div>
                  ))}
                  {normalizeAttachments(orderDraft.attachments).length === 0 && <div className={cn("text-xs", dark ? "text-slate-500" : "text-slate-400")}>Nenhum anexo adicionado.</div>}
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowOpenOccurrenceModal(false);
                    setDraftUploadNotice('');
                  }}
                  className={cn("px-3 py-2 border rounded-lg text-sm transition-colors", dark ? "border-slate-700 text-slate-300 hover:bg-slate-800" : "border-slate-300 text-slate-700 hover:bg-slate-50")}
                >
                  Cancelar
                </button>
                <button type="submit" className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors">Abrir Ocorrencia e O.S</button>
              </div>
            </form>
          </Modal>
        )}

        {showOpenOrderModal && openedOccurrence && (
          <Modal
            title={`Criar O.S - Ocorrencia ${openedOccurrence.number}`}
            onClose={() => {
              setShowOpenOrderModal(false);
              setDraftUploadNotice('');
            }}
            maxWidth="max-w-5xl"
          >
            <form onSubmit={submitOpenOrder} className="space-y-3 max-h-[75vh] overflow-y-auto custom-scrollbar pr-1">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Ocorrencia</label>
                  <input value={openedOccurrence.number || ''} readOnly className={readOnlyInputClass} />
                </div>
                <div>
                  <label className={labelClass}>Provedor da O.S</label>
                  <input value={selectedProvider || ''} readOnly className={readOnlyInputClass} />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                <div>
                  <label className={labelClass}>Tipo da O.S</label>
                  <select value={orderDraft.type} onChange={(e) => setOrderDraft((p) => ({ ...p, type: e.target.value }))} className={inputClass}>
                    {SERVICE_TYPES.map((t) => (
                      <option key={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Prioridade</label>
                  <select value={orderDraft.priority} onChange={(e) => setOrderDraft((p) => ({ ...p, priority: e.target.value }))} className={inputClass}>
                    {PRIORITIES.map((p) => (
                      <option key={p}>{p}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Status</label>
                  <select value={orderDraft.status} onChange={(e) => setOrderDraft((p) => ({ ...p, status: e.target.value }))} className={inputClass}>
                    {STATUS_FLOW.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Analista responsavel</label>
                  <select value={orderDraft.analyst} onChange={(e) => setOrderDraft((p) => ({ ...p, analyst: e.target.value }))} className={inputClass}>
                    {analystOptions.map((a) => (
                      <option key={a} value={a}>
                        {a}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Solicitante</label>
                  <input value={orderDraft.solicitant} onChange={(e) => setOrderDraft((p) => ({ ...p, solicitant: e.target.value }))} placeholder="Pessoa do provedor" className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Setor</label>
                  <select value={orderDraft.sector} onChange={(e) => setOrderDraft((p) => ({ ...p, sector: e.target.value }))} className={inputClass}>
                    {OCCURRENCE_SECTORS.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Origem</label>
                  <select value={orderDraft.origin} onChange={(e) => setOrderDraft((p) => ({ ...p, origin: e.target.value }))} className={inputClass}>
                    {OCCURRENCE_ORIGINS.map((o) => (
                      <option key={o}>{o}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Previsao - Data</label>
                  <input type="date" value={orderDraft.deadlineDate} onChange={(e) => setOrderDraft((p) => ({ ...p, deadlineDate: e.target.value }))} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Previsao - Hora</label>
                  <input type="time" value={orderDraft.deadlineTime} onChange={(e) => setOrderDraft((p) => ({ ...p, deadlineTime: e.target.value }))} className={inputClass} />
                </div>
              </div>
              <div>
                <label className={labelClass}>Descricao tecnica da O.S</label>
                <textarea value={orderDraft.description} onChange={(e) => setOrderDraft((p) => ({ ...p, description: e.target.value }))} rows={3} placeholder="Descreva a ordem de servico" className={inputClass} />
              </div>
              <div className={cn(panelClass, "space-y-2")}>
                <div className={sectionTitleClass}>Anexos da O.S</div>
                <div className={cn("text-[11px]", dark ? "text-slate-400" : "text-slate-500")}>Ate 10 anexos por O.S, maximo 10MB por arquivo.</div>
                <input
                  type="file"
                  multiple
                  accept={ATTACHMENTS_ACCEPT}
                  onChange={(e) => {
                    addDraftAttachments(e.target.files);
                    e.target.value = '';
                  }}
                  className={cn("block w-full text-xs file:mr-3 file:px-3 file:py-1.5 file:rounded file:border-0 file:text-slate-700", dark ? "text-slate-300 file:bg-slate-700 file:text-slate-200" : "text-slate-600 file:bg-slate-200")}
                />
                {draftUploadNotice && <div className="text-xs text-amber-700">{draftUploadNotice}</div>}
                <div className="space-y-1">
                  {normalizeAttachments(orderDraft.attachments).map((a) => (
                    <div key={a.id} className={cn("flex items-center justify-between gap-2 border rounded px-2 py-1.5 text-xs", dark ? "bg-[#1e293b]/50 border-slate-700 text-slate-300" : "bg-white border-slate-200 text-slate-700")}>
                      <div className="min-w-0">
                        <div className="truncate">{a.name}</div>
                        <div className={dark ? "text-slate-400" : "text-slate-400"}>{a.mime || 'arquivo'} • {formatFileSize(a.size)}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setOrderDraft((p) => ({ ...p, attachments: normalizeAttachments(p.attachments).filter((att) => att.id !== a.id) }))}
                        className={cn("px-2 py-1 border rounded transition-colors", dark ? "border-rose-900/50 bg-rose-950/30 text-rose-400 hover:bg-rose-900/50" : "border-rose-200 bg-rose-50 text-rose-700")}
                      >
                        Remover
                      </button>
                    </div>
                  ))}
                  {normalizeAttachments(orderDraft.attachments).length === 0 && <div className={cn("text-xs", dark ? "text-slate-500" : "text-slate-400")}>Nenhum anexo adicionado.</div>}
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowOpenOrderModal(false);
                    setDraftUploadNotice('');
                  }}
                  className={cn("px-3 py-2 border rounded-lg text-sm transition-colors", dark ? "border-slate-700 text-slate-300 hover:bg-slate-800" : "border-slate-300 text-slate-700 hover:bg-slate-50")}
                >
                  Cancelar
                </button>
                <button type="submit" className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors">Criar O.S</button>
              </div>
            </form>
          </Modal>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <h2 className={cn("text-2xl font-bold", dark ? "text-slate-100" : "text-slate-900")}>Provedores</h2>
          <p className={cn("text-sm", dark ? "text-slate-400" : "text-slate-500")}>Clique no provedor para abrir as ocorrencias e suas O.S.</p>
        </div>
      </div>

      <div className={cn("border rounded-xl p-4", dark ? "bg-[#1e293b]/60 backdrop-blur-md border-slate-700/50" : "bg-white border-slate-200")}>
        <div className="relative w-full md:w-72">
          <Search size={14} className={cn("absolute left-3 top-1/2 -translate-y-1/2", dark ? "text-slate-500" : "text-slate-400")} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar provedor..."
            className={cn(
              "w-full pl-9 pr-3 py-2 border rounded-lg text-sm transition-colors",
              dark
                ? "bg-[#0f172a]/80 backdrop-blur-xl border-slate-700/50 text-slate-200 placeholder:text-slate-600 focus:border-blue-500/50"
                : "bg-white border-slate-300 text-slate-900 focus:border-blue-500"
            )}
          />
        </div>
      </div>

      <div className={cn("border rounded-xl overflow-hidden shadow-sm", dark ? "bg-[#1e293b]/60 backdrop-blur-md border-slate-700/50" : "bg-white border-slate-200")}>
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-sm">
            <thead className={cn(dark ? "bg-white/5 text-slate-400" : "bg-slate-50 text-slate-500")}>
              <tr>
                <th className="px-5 py-3 text-left">Provedor</th>
                <th className="px-5 py-3 text-right">Ocorrencias</th>
                <th className="px-5 py-3 text-right">Total OS</th>
                <th className="px-5 py-3 text-right">Ativas</th>
                <th className="px-5 py-3 text-right">Atrasadas</th>
                <th className="px-5 py-3 text-right">Alta/Critica</th>
                <th className="px-5 py-3 text-center">Entrar</th>
              </tr>
            </thead>
            <tbody className={cn("divide-y", dark ? "divide-white/5" : "divide-slate-100")}>
              {filteredProviders.map((p) => (
                <tr
                  key={p.provider}
                  className={cn("cursor-pointer transition-colors", dark ? "hover:bg-white/5" : "hover:bg-slate-50")}
                  onClick={() => openProviderPanel(p.provider)}
                >
                  <td className={cn("px-5 py-3 font-medium", dark ? "text-slate-200" : "text-slate-800")}>{p.provider}</td>
                  <td className="px-5 py-3 text-right font-mono">{p.occurrences}</td>
                  <td className="px-5 py-3 text-right font-mono">{p.orders}</td>
                  <td className="px-5 py-3 text-right font-mono">{p.active}</td>
                  <td className={cn('px-5 py-3 text-right font-mono font-bold', p.delayed > 0 ? 'text-rose-600' : 'text-slate-400')}>{p.delayed}</td>
                  <td className="px-5 py-3 text-right font-mono">{p.critical}</td>
                  <td className="px-5 py-3 text-center">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openProviderPanel(p.provider);
                      }}
                      className="px-3 py-1 rounded border border-cyan-200 bg-cyan-50 text-cyan-700 text-[11px] font-bold hover:bg-cyan-100"
                    >
                      Abrir painel
                    </button>
                  </td>
                </tr>
              ))}
              {filteredProviders.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-slate-400">
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

const TechniciansView = ({ orders, onSelectOrder }) => {
  const [period, setPeriod] = useState('7d');
  const [tab, setTab] = useState('performance');
  const [search, setSearch] = useState('');
  const [selectedTech, setSelectedTech] = useState(null);

  const scoped = useMemo(() => filterByPeriod(orders, period), [orders, period]);
  const rows = useMemo(() => buildTechRows(scoped), [scoped]);

  const filteredRows = useMemo(() => rows.filter((r) => r.name.toLowerCase().includes(search.toLowerCase())), [rows, search]);

  const overdueOrders = useMemo(
    () => scoped.filter((o) => isActive(o) && getDelayHours(o) > 0).sort((a, b) => getDelayHours(b) - getDelayHours(a)),
    [scoped]
  );

  const dueTodayOrders = useMemo(
    () => scoped.filter((o) => isActive(o) && o.deadlineAt >= startOfDay(Date.now()) && o.deadlineAt <= endOfDay(Date.now())).sort((a, b) => a.deadlineAt - b.deadlineAt),
    [scoped]
  );

  const coverageRows = useMemo(() => {
    const map = new Map();
    SERVICE_TYPES.forEach((t) => map.set(t, { type: t, total: 0, techSet: new Set() }));
    scoped.forEach((o) => {
      const row = map.get(o.type);
      if (!row) return;
      row.total += 1;
      if (o.tech) row.techSet.add(o.tech);
    });
    return Array.from(map.values()).map((r) => ({
      type: r.type,
      total: r.total,
      techs: r.techSet.size,
      ratio: r.techSet.size ? (r.total / r.techSet.size).toFixed(1) : '0.0',
    })).sort((a, b) => b.total - a.total);
  }, [scoped]);

  const { dark } = useTheme();

  return (
    <div className="space-y-5">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <h2 className={cn("text-2xl font-bold", dark ? "text-slate-100" : "text-slate-900")}>Tecnicos</h2>
          <p className={cn("text-sm", dark ? "text-slate-400" : "text-slate-500")}>Performance, atrasos, agenda e cobertura por tipo.</p>
        </div>
        <PeriodTabs value={period} onChange={setPeriod} />
      </div>

      <div className={cn("border rounded-xl p-4 flex flex-col md:flex-row gap-3 md:items-center justify-between", dark ? "bg-[#1e293b]/60 backdrop-blur-md border-slate-700/50" : "bg-white border-slate-200")}>
        <div className="flex gap-2 flex-wrap">
          {[
            { id: 'performance', label: 'Performance' },
            { id: 'delays', label: 'OS Atrasadas' },
            { id: 'agenda', label: 'Agenda Hoje' },
            { id: 'coverage', label: 'Cobertura' },
          ].map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)} className={cn('px-3 py-1.5 rounded-full text-xs font-bold border transition-colors',
              tab === t.id
                ? (dark ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-400' : 'bg-cyan-50 border-cyan-200 text-cyan-700')
                : (dark ? 'bg-transparent border-slate-700/50 text-slate-400 hover:bg-white/5' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50')
            )}>
              {t.label}
            </button>
          ))}
        </div>

        <div className="relative w-full md:w-64">
          <Search size={14} className={cn("absolute left-3 top-1/2 -translate-y-1/2", dark ? "text-slate-500" : "text-slate-400")} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar tecnico..."
            className={cn(
              "w-full pl-9 pr-3 py-2 border rounded-lg text-sm transition-colors",
              dark
                ? "bg-[#0f172a]/80 backdrop-blur-xl border-slate-700/50 text-slate-200 placeholder:text-slate-600 focus:border-blue-500/50"
                : "bg-white border-slate-300 text-slate-900 focus:border-blue-500"
            )}
          />
        </div>
      </div>

      {tab === 'performance' && (
        <div className={cn("border rounded-xl overflow-hidden shadow-sm", dark ? "bg-[#1e293b]/60 backdrop-blur-md border-slate-700/50" : "bg-white border-slate-200")}>
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-sm">
              <thead className={cn(dark ? "bg-white/5 text-slate-400" : "bg-slate-50 text-slate-500")}>
                <tr>
                  <th className="px-5 py-3 text-left">Tecnico</th>
                  <th className="px-5 py-3 text-right">Criadas</th>
                  <th className="px-5 py-3 text-right">Ativas</th>
                  <th className="px-5 py-3 text-right">On-time %</th>
                  <th className="px-5 py-3 text-right">Atrasadas</th>
                  <th className="px-5 py-3 text-right">TMA</th>
                  <th className="px-5 py-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className={cn("divide-y", dark ? "divide-white/5" : "divide-slate-100")}>
                {filteredRows.map((r) => (
                  <tr key={r.name}>
                    <td className="px-5 py-3">
                      <div className={cn("font-bold", dark ? "text-slate-200" : "text-slate-800")}>{r.name}</div>
                      <div className={cn("text-xs", dark ? "text-slate-500" : "text-slate-500")}>{r.specialization}</div>
                    </td>
                    <td className="px-5 py-3 text-right font-mono">{r.created}</td>
                    <td className="px-5 py-3 text-right font-mono">{r.active}</td>
                    <td className="px-5 py-3 text-right font-mono text-emerald-600 font-bold">{r.onTimePct}%</td>
                    <td className={cn('px-5 py-3 text-right font-mono font-bold', r.delayed > 0 ? 'text-rose-600' : 'text-slate-300')}>{r.delayed}</td>
                    <td className="px-5 py-3 text-right font-mono text-slate-700">{r.avgDuration}</td>
                    <td className="px-5 py-3 text-right">
                      <Badge color={r.status === 'busy' ? 'orange' : 'green'}>{r.status === 'busy' ? 'Ocupado' : 'Disponivel'}</Badge>
                    </td>
                  </tr>
                ))}
                {filteredRows.length === 0 && <tr><td colSpan={7} className="px-5 py-10 text-center text-slate-400">Nenhum tecnico encontrado.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'delays' && (
        <div className={cn("border rounded-xl overflow-hidden shadow-sm", dark ? "bg-[#1e293b]/60 backdrop-blur-md border-slate-700/50" : "bg-white border-slate-200")}>
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-sm">
              <thead className={cn(dark ? "bg-white/5 text-slate-400" : "bg-slate-50 text-slate-500")}>
                <tr>
                  <th className="px-5 py-3 text-left">Protocolo</th>
                  <th className="px-5 py-3 text-left">Tecnico</th>
                  <th className="px-5 py-3 text-left">Provedor</th>
                  <th className="px-5 py-3 text-left">Tipo</th>
                  <th className="px-5 py-3 text-right">Delay (h)</th>
                  <th className="px-5 py-3 text-center">Acao</th>
                </tr>
              </thead>
              <tbody className={cn("divide-y", dark ? "divide-white/5" : "divide-slate-100")}>
                {overdueOrders.map((o) => (
                  <tr key={o.id}>
                    <td className="px-5 py-3 font-mono">{o.protocol}</td>
                    <td className="px-5 py-3">
                      <button onClick={() => setSelectedTech(o.tech)} className="text-cyan-700 font-semibold hover:underline">
                        {o.tech || '-'}
                      </button>
                    </td>
                    <td className="px-5 py-3">{o.provider}</td>
                    <td className="px-5 py-3"><ServiceTypeBadge type={o.type} /></td>
                    <td className="px-5 py-3 text-right font-mono font-bold text-rose-600">{getDelayHours(o).toFixed(2)}</td>
                    <td className="px-5 py-3 text-center">
                      <button onClick={() => onSelectOrder(o)} className="px-3 py-1 border border-cyan-200 bg-cyan-50 text-cyan-700 rounded text-xs font-bold">Abrir</button>
                    </td>
                  </tr>
                ))}
                {overdueOrders.length === 0 && <tr><td colSpan={6} className="px-5 py-10 text-center text-slate-400">Nenhum atraso na janela.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'agenda' && (
        <div className={cn("border rounded-xl overflow-hidden shadow-sm", dark ? "bg-[#1e293b]/60 backdrop-blur-md border-slate-700/50" : "bg-white border-slate-200")}>
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-sm">
              <thead className={cn(dark ? "bg-white/5 text-slate-400" : "bg-slate-50 text-slate-500")}>
                <tr>
                  <th className="px-5 py-3 text-left">Protocolo</th>
                  <th className="px-5 py-3 text-left">Tecnico</th>
                  <th className="px-5 py-3 text-left">Provedor</th>
                  <th className="px-5 py-3 text-left">Tipo</th>
                  <th className="px-5 py-3 text-right">Prazo</th>
                  <th className="px-5 py-3 text-center">Acao</th>
                </tr>
              </thead>
              <tbody className={cn("divide-y", dark ? "divide-white/5" : "divide-slate-100")}>
                {dueTodayOrders.map((o) => (
                  <tr key={o.id}>
                    <td className="px-5 py-3 font-mono">{o.protocol}</td>
                    <td className="px-5 py-3">{o.tech || '-'}</td>
                    <td className="px-5 py-3">{o.provider}</td>
                    <td className="px-5 py-3"><ServiceTypeBadge type={o.type} /></td>
                    <td className="px-5 py-3 text-right font-mono text-amber-700 font-bold">{formatDateTime(o.deadlineAt)}</td>
                    <td className="px-5 py-3 text-center">
                      <button onClick={() => onSelectOrder(o)} className="px-3 py-1 border border-cyan-200 bg-cyan-50 text-cyan-700 rounded text-xs font-bold">Abrir</button>
                    </td>
                  </tr>
                ))}
                {dueTodayOrders.length === 0 && <tr><td colSpan={6} className="px-5 py-10 text-center text-slate-400">Sem atividades para hoje.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'coverage' && (
        <div className={cn("border rounded-xl overflow-hidden shadow-sm", dark ? "bg-[#1e293b]/60 backdrop-blur-md border-slate-700/50" : "bg-white border-slate-200")}>
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-sm">
              <thead className={cn(dark ? "bg-white/5 text-slate-400" : "bg-slate-50 text-slate-500")}>
                <tr>
                  <th className="px-5 py-3 text-left">Tipo</th>
                  <th className="px-5 py-3 text-right">Total</th>
                  <th className="px-5 py-3 text-right">Tecnicos</th>
                  <th className="px-5 py-3 text-right">Ratio</th>
                </tr>
              </thead>
              <tbody className={cn("divide-y", dark ? "divide-white/5" : "divide-slate-100")}>
                {coverageRows.map((r) => (
                  <tr key={r.type}>
                    <td className="px-5 py-3"><ServiceTypeBadge type={r.type} /></td>
                    <td className="px-5 py-3 text-right font-mono">{r.total}</td>
                    <td className="px-5 py-3 text-right font-mono">{r.techs}</td>
                    <td className="px-5 py-3 text-right font-mono">{r.ratio}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {selectedTech && <TechnicianDelayModal techName={selectedTech} orders={scoped} onClose={() => setSelectedTech(null)} onSelectOrder={onSelectOrder} />}
    </div>
  );
};

const ProvidersLabView = ({ orders, onSelectOrder, onOpenProvider }) => {
  const { dark } = useTheme();
  const [period, setPeriod] = useState('30d');
  const [search, setSearch] = useState('');
  const scoped = useMemo(() => filterByPeriod(orders, period), [orders, period]);

  const providers = useMemo(() => {
    return buildProviderRows(scoped).filter((row) =>
      row.name.toLowerCase().includes(search.toLowerCase().trim())
    );
  }, [scoped, search]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <h2 className={cn("text-2xl font-bold", dark ? "text-slate-100" : "text-slate-900")}>Provedores Lab</h2>
          <p className={cn("text-sm", dark ? "text-slate-400" : "text-slate-500")}>
            Layout alternativo para comparar leitura operacional sem tabela.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <PeriodTabs value={period} onChange={setPeriod} />
          <div className="relative">
            <Search size={14} className={cn("absolute left-3 top-1/2 -translate-y-1/2", dark ? "text-slate-500" : "text-slate-400")} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar provedor..."
              className={cn(
                "pl-9 pr-3 py-2 border rounded-lg text-sm w-[220px]",
                dark ? "bg-[#0f172a]/80 border-slate-700/50 text-slate-200" : "bg-white border-slate-300 text-slate-900"
              )}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {providers.map((row) => {
          const recentOrders = [...row.orders].sort((a, b) => b.createdAt - a.createdAt).slice(0, 5);
          const total = Math.max(1, row.total);
          const activePct = Math.min(100, Math.round((row.active / total) * 100));
          const delayedPct = Math.min(100, Math.round((row.delayed / total) * 100));
          const closedPct = Math.min(100, Math.round((row.closed / total) * 100));

          return (
            <div
              key={row.slug}
              className={cn(
                "rounded-2xl border p-4 shadow-sm overflow-hidden",
                dark
                  ? "bg-gradient-to-br from-[#0f172a] via-[#111c34] to-[#0e2230] border-slate-700/50"
                  : "bg-gradient-to-br from-white via-slate-50 to-cyan-50 border-slate-200"
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className={cn("text-xs uppercase tracking-wider", dark ? "text-cyan-400" : "text-cyan-700")}>Operacao</div>
                  <div className={cn("text-xl font-bold", dark ? "text-white" : "text-slate-900")}>{row.name}</div>
                  <div className={cn("text-xs mt-1", dark ? "text-slate-400" : "text-slate-500")}>{row.city}</div>
                </div>
                <button
                  onClick={() => onOpenProvider(row.name)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg border text-xs font-bold transition-colors",
                    dark
                      ? "bg-cyan-900/30 border-cyan-700/50 text-cyan-300 hover:bg-cyan-900/50"
                      : "bg-cyan-50 border-cyan-200 text-cyan-700 hover:bg-cyan-100"
                  )}
                >
                  Abrir detalhe
                </button>
              </div>

              <div className="grid grid-cols-4 gap-2 mt-4">
                <div className={cn("rounded-lg p-2 border", dark ? "border-slate-700/50 bg-[#0b1328]" : "border-slate-200 bg-white")}>
                  <div className="text-[11px] text-slate-500">Total</div>
                  <div className={cn("text-lg font-bold", dark ? "text-slate-200" : "text-slate-800")}>{row.total}</div>
                </div>
                <div className={cn("rounded-lg p-2 border", dark ? "border-indigo-700/40 bg-[#0b1328]" : "border-indigo-200 bg-indigo-50")}>
                  <div className="text-[11px] text-slate-500">Ativas</div>
                  <div className={cn("text-lg font-bold", dark ? "text-indigo-300" : "text-indigo-700")}>{row.active}</div>
                </div>
                <div className={cn("rounded-lg p-2 border", dark ? "border-rose-700/40 bg-[#0b1328]" : "border-rose-200 bg-rose-50")}>
                  <div className="text-[11px] text-slate-500">Atraso</div>
                  <div className="text-lg font-bold text-rose-500">{row.delayed}</div>
                </div>
                <div className={cn("rounded-lg p-2 border", dark ? "border-emerald-700/40 bg-[#0b1328]" : "border-emerald-200 bg-emerald-50")}>
                  <div className="text-[11px] text-slate-500">Fechadas</div>
                  <div className="text-lg font-bold text-emerald-500">{row.closed}</div>
                </div>
              </div>

              <div className="mt-4 space-y-2">
                <div>
                  <div className="text-[11px] uppercase text-slate-500 mb-1">Carga ativa ({activePct}%)</div>
                  <div className={cn("h-2 rounded-full", dark ? "bg-slate-800" : "bg-slate-200")}>
                    <div className="h-2 rounded-full bg-indigo-500" style={{ width: `${activePct}%` }} />
                  </div>
                </div>
                <div>
                  <div className="text-[11px] uppercase text-slate-500 mb-1">Risco atraso ({delayedPct}%)</div>
                  <div className={cn("h-2 rounded-full", dark ? "bg-slate-800" : "bg-slate-200")}>
                    <div className="h-2 rounded-full bg-rose-500" style={{ width: `${delayedPct}%` }} />
                  </div>
                </div>
                <div>
                  <div className="text-[11px] uppercase text-slate-500 mb-1">Resolucao ({closedPct}%)</div>
                  <div className={cn("h-2 rounded-full", dark ? "bg-slate-800" : "bg-slate-200")}>
                    <div className="h-2 rounded-full bg-emerald-500" style={{ width: `${closedPct}%` }} />
                  </div>
                </div>
              </div>

              <div className="mt-4">
                <div className="text-[11px] uppercase text-slate-500 mb-2">Ultimas O.S</div>
                <div className="space-y-2">
                  {recentOrders.map((order) => (
                    <button
                      key={order.id}
                      onClick={() => onSelectOrder(order)}
                      className={cn(
                        "w-full text-left border rounded-lg p-2 transition-colors",
                        dark ? "border-slate-700/50 bg-[#0b1328] hover:bg-[#13203d]" : "border-slate-200 bg-white hover:bg-slate-50"
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className={cn("font-mono text-xs", dark ? "text-slate-300" : "text-slate-700")}>{order.protocol}</span>
                        <Badge color={getStatusColor(order.status)}>{order.status}</Badge>
                      </div>
                      <div className={cn("text-xs mt-1 truncate", dark ? "text-slate-400" : "text-slate-600")}>{order.type}</div>
                      <div className="text-[11px] text-slate-500 mt-1">{formatDateTime(order.createdAt)}</div>
                    </button>
                  ))}
                  {recentOrders.length === 0 && <div className="text-xs text-slate-500">Sem O.S neste periodo.</div>}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {providers.length === 0 && (
        <div className={cn("border rounded-xl p-8 text-center text-sm", dark ? "bg-[#1e293b]/60 border-slate-700/50 text-slate-400" : "bg-white border-slate-200 text-slate-500")}>
          Nenhum provedor encontrado para os filtros atuais.
        </div>
      )}
    </div>
  );
};

const KnowledgeBaseView = ({ onToast, section = 'ajustpedia' }) => {
  const [tab, setTab] = useState(section === 'credentials' ? 'credenciais' : 'ajustpedia');
  const [search, setSearch] = useState('');
  const [tag, setTag] = useState('Todos');
  const [author, setAuthor] = useState('Todos');
  const [expandedId, setExpandedId] = useState<string | number | null>(1);
  const [onlyFav, setOnlyFav] = useState(false);
  const [favorites, setFavorites] = useState([]);
  const [recent, setRecent] = useState([]);
  const [entries, setEntries] = useState([]);
  const [credentials, setCredentials] = useState([]);
  const [providerSummaries, setProviderSummaries] = useState([]);
  const [credentialsTotal, setCredentialsTotal] = useState(0);
  const [credentialOffset, setCredentialOffset] = useState(0);
  const [providerFilter, setProviderFilter] = useState('Todos');
  const [equipmentFilter, setEquipmentFilter] = useState('Todos');
  const [environmentFilter, setEnvironmentFilter] = useState('Todos');
  const [providerSearch, setProviderSearch] = useState('');
  const [credentialSearch, setCredentialSearch] = useState('');
  const [credentialSort, setCredentialSort] = useState({ field: 'equipmentName', dir: 'asc' });
  const [selectedCredential, setSelectedCredential] = useState(null);
  const [showContrib, setShowContrib] = useState(false);
  const [editingEntryId, setEditingEntryId] = useState<string | number | null>(null);
  const [deletingEntryId, setDeletingEntryId] = useState<string | number | null>(null);
  const [tenantId, setTenantId] = useState(null);
  const [currentUserName, setCurrentUserName] = useState('Analista');
  const [currentUserRole, setCurrentUserRole] = useState('analista');
  const [syncError, setSyncError] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [visibleSecrets, setVisibleSecrets] = useState({});
  const [revealedSecrets, setRevealedSecrets] = useState({});
  const [showCreateCredential, setShowCreateCredential] = useState(false);
  const [createCredentialSaving, setCreateCredentialSaving] = useState(false);
  const [createCredentialError, setCreateCredentialError] = useState('');
  const [newCredential, setNewCredential] = useState({
    provider: '',
    equipmentType: '',
    equipmentName: '',
    environment: '',
    host: '',
    username: '',
    secret: '',
    notes: '',
  });

  const [newEntry, setNewEntry] = useState({
    title: '',
    description: '',
    command: '',
    tags: '',
  });

  const { dark } = useTheme();
  const credentialLimit = 80;
  const canCreateCredential = ['super_admin', 'gerente'].includes((currentUserRole || '').toLowerCase());
  const canManageKnowledge = ['super_admin', 'gerente', 'analista'].includes((currentUserRole || '').toLowerCase());

  const tags = useMemo(() => ['Todos', ...new Set(entries.flatMap((e) => e.tags))], [entries]);
  const authors = useMemo(() => ['Todos', ...new Set(entries.map((e) => e.author))], [entries]);

  const normalizeArticleHeader = (value) =>
    String(value || '')
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
    if (!content) {
      return { description: 'Sem descricao.', command: '' };
    }

    const lines = content.split(/\r?\n/);
    const normalized = lines.map((line) => normalizeArticleHeader(line));
    const descIdx = normalized.findIndex((line) => line === '## descricao');
    const cmdIdx = normalized.findIndex((line) => line === '## comando');

    if (cmdIdx >= 0) {
      const command = lines.slice(cmdIdx + 1).join('\n').trim();
      const description = descIdx >= 0 && descIdx < cmdIdx
        ? lines.slice(descIdx + 1, cmdIdx).join('\n').trim()
        : '';
      return {
        description: description || summarizeDescription(command),
        command,
      };
    }

    return {
      description: summarizeDescription(content),
      command: content,
    };
  };

  const serializeArticleContent = (description, command) => {
    const descriptionText = String(description || '').trim();
    const commandText = String(command || '').trim();
    if (!descriptionText) {
      return `## Comando\n${commandText}`;
    }
    return `## Descricao\n${descriptionText}\n\n## Comando\n${commandText}`;
  };

  const mapArticleToEntry = (article) => ({
    ...parseArticleContent(article.content),
    id: article.id,
    title: article.title,
    tags: Array.isArray(article.tags) ? article.tags : [],
    author: article.author?.name || 'Equipe',
    date: formatDate(new Date(article.updatedAt || article.createdAt || Date.now()).getTime()),
  });

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
    if (!canManageKnowledge) return;
    setEditingEntryId(entry.id);
    setNewEntry({
      title: entry.title || '',
      description: entry.description || '',
      command: entry.command || '',
      tags: Array.isArray(entry.tags) ? entry.tags.join(', ') : '',
    });
    setShowContrib(true);
  };

  const mapCredentialToRow = (c) => {
    const rawEnv = String(c.environment || '').trim();
    const normalizedEnv = /^sgp cliente\s+\d+$/i.test(rawEnv) ? '' : (rawEnv || 'Nao informado');
    return {
      id: c.id,
      provider: c.provider || 'Sem provedor',
      env: normalizedEnv,
      equipmentType: normalizeEquipmentType(c.equipmentType || 'OUTROS'),
      equipmentName: c.equipmentName || c.host || '-',
      host: c.host,
      user: c.username,
      secret: '************',
      notes: c.notes || '',
      createdAt: parseDateToTs(c.createdAt),
      updatedAt: parseDateToTs(c.updatedAt),
    };
  };

  const mapCredentialSortToApi = (field) => {
    if (field === 'env') return 'environment';
    if (field === 'user') return 'username';
    return field;
  };

  const loadProviderSummaries = async (tenant, options = {}) => {
    if (!tenant) return;
    const silent = !!options.silent;
    if (!silent) {
      setSyncing(true);
      setSyncError('');
    }
    try {
      const params = new URLSearchParams({
        tenantId: tenant,
        limit: '500',
        offset: '0',
      });
      if (search.trim()) params.set('search', search.trim());
      if (equipmentFilter !== 'Todos') params.set('equipmentType', equipmentFilter);
      if (environmentFilter !== 'Todos') params.set('environment', environmentFilter);
      const response = await fetch(`/api/knowledge/credentials/providers?${params.toString()}`, { cache: 'no-store' });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || 'Falha ao carregar provedores de credenciais.');
      }
      setProviderSummaries(Array.isArray(payload?.items) ? payload.items : []);
    } catch (error) {
      setProviderSummaries([]);
      setSyncError(error instanceof Error ? error.message : 'Falha ao carregar provedores de credenciais.');
    } finally {
      if (!silent) setSyncing(false);
    }
  };

  const loadCredentialsPage = async (tenant, options = {}) => {
    if (!tenant || providerFilter === 'Todos') {
      setCredentials([]);
      setCredentialsTotal(0);
      return;
    }
    const silent = !!options.silent;
    if (!silent) {
      setSyncing(true);
      setSyncError('');
    }
    try {
      const params = new URLSearchParams({
        tenantId: tenant,
        provider: providerFilter,
        sortBy: mapCredentialSortToApi(credentialSort.field),
        sortDir: credentialSort.dir,
        limit: String(credentialLimit),
        offset: String(credentialOffset),
      });
      const q = `${search} ${credentialSearch}`.trim();
      if (q) params.set('search', q);
      if (equipmentFilter !== 'Todos') params.set('equipmentType', equipmentFilter);
      if (environmentFilter !== 'Todos') params.set('environment', environmentFilter);

      const response = await fetch(`/api/knowledge/credentials?${params.toString()}`, { cache: 'no-store' });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || 'Falha ao carregar credenciais.');
      }
      const items = Array.isArray(payload?.items) ? payload.items : [];
      setCredentials(items.map(mapCredentialToRow));
      setCredentialsTotal(Number(payload?.total) || items.length);
    } catch (error) {
      setCredentials([]);
      setCredentialsTotal(0);
      setSyncError(error instanceof Error ? error.message : 'Falha ao carregar credenciais.');
    } finally {
      if (!silent) setSyncing(false);
    }
  };

  const loadKnowledge = async (tenant) => {
    if (!tenant) return;
    setSyncing(true);
    setSyncError('');
    try {
      const [articlesRes] = await Promise.all([
        fetch(`/api/knowledge/articles?tenantId=${encodeURIComponent(tenant)}`, { cache: 'no-store' }),
      ]);

      if (!articlesRes.ok) {
        const payload = await articlesRes.json().catch(() => ({}));
        throw new Error(payload.error || 'Falha ao carregar base de conhecimento.');
      }

      const articles = await articlesRes.json();
      setEntries(Array.isArray(articles) ? articles.map(mapArticleToEntry) : []);
      setCredentials([]);
      setCredentialsTotal(0);
      setProviderSummaries([]);
      setCredentialOffset(0);
      setProviderFilter('Todos');
      setEquipmentFilter('Todos');
      setEnvironmentFilter('Todos');
      setProviderSearch('');
      setCredentialSearch('');
      setCredentialSort({ field: 'equipmentName', dir: 'asc' });
      setSelectedCredential(null);
      setVisibleSecrets({});
      setRevealedSecrets({});
      await loadProviderSummaries(tenant, { silent: true });
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : 'Falha ao sincronizar conhecimento.');
      setEntries([]);
      setCredentials([]);
      setProviderSummaries([]);
      setCredentialsTotal(0);
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    setTab(section === 'credentials' ? 'credenciais' : 'ajustpedia');
  }, [section]);

  useEffect(() => {
    const bootstrap = async () => {
      try {
        const meRes = await fetch('/api/auth/me', { cache: 'no-store' });
        if (!meRes.ok) throw new Error('Falha ao obter sessao.');
        const me = await meRes.json();
        const tenant = me?.tenant?.id || null;
        setTenantId(tenant);
        setCurrentUserName(me?.name || 'Analista');
        setCurrentUserRole(String(me?.role || 'analista').toLowerCase());
        if (!tenant) {
          setSyncError('Tenant nao encontrado na sessao.');
          setEntries([]);
          setCredentials([]);
          return;
        }
        await loadKnowledge(tenant);
      } catch {
        setSyncError('Falha ao carregar base de conhecimento do backend.');
        setEntries([]);
        setCredentials([]);
      }
    };
    bootstrap();
  }, []);

  useEffect(() => {
    if (tab !== 'credenciais') return;
    setCredentialOffset(0);
  }, [tab, search, credentialSearch, equipmentFilter, environmentFilter, providerFilter, credentialSort.field, credentialSort.dir]);

  useEffect(() => {
    if (tab !== 'credenciais' || !tenantId) return;
    loadProviderSummaries(tenantId, { silent: true });
  }, [tab, tenantId, search, equipmentFilter, environmentFilter]);

  useEffect(() => {
    if (tab !== 'credenciais') return;
    if (providerSummaries.length === 0) {
      if (providerFilter !== 'Todos') setProviderFilter('Todos');
      return;
    }
    if (providerFilter === 'Todos') {
      setProviderFilter(providerSummaries[0].provider);
      return;
    }
    const stillExists = providerSummaries.some((item) => item.provider === providerFilter);
    if (!stillExists) setProviderFilter(providerSummaries[0].provider);
  }, [tab, providerSummaries, providerFilter]);

  useEffect(() => {
    if (tab !== 'credenciais' || !tenantId) return;
    loadCredentialsPage(tenantId, { silent: true });
  }, [tab, tenantId, providerFilter, search, credentialSearch, equipmentFilter, environmentFilter, credentialSort.field, credentialSort.dir, credentialOffset]);

  const toggleFavorite = (id) => {
    setFavorites((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [id, ...prev]));
  };

  const touchRecent = (id) => {
    setRecent((prev) => [id, ...prev.filter((x) => x !== id)].slice(0, 8));
  };

  const filteredEntries = useMemo(() => {
    const q = search.toLowerCase().trim();
    return entries.filter((e) => {
      const bySearch = !q || `${e.title} ${e.description} ${e.tags.join(' ')} ${e.author} ${e.command}`.toLowerCase().includes(q);
      const byTag = tag === 'Todos' || e.tags.includes(tag);
      const byAuthor = author === 'Todos' || e.author === author;
      const byFav = !onlyFav || favorites.includes(e.id);
      return bySearch && byTag && byAuthor && byFav;
    });
  }, [entries, search, tag, author, onlyFav, favorites]);

  const copyText = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      onToast('Copiado para area de transferencia.');
    } catch { }
  };

  const submitContrib = async (e) => {
    e.preventDefault();
    if (!canManageKnowledge) {
      onToast('Seu perfil nao pode alterar a Ajustpedia.');
      return;
    }

    const title = newEntry.title.trim();
    const command = newEntry.command.trim();
    const description = newEntry.description.trim();
    if (!title || !command) {
      onToast('Preencha titulo e comando.');
      return;
    }
    if (!tenantId) {
      onToast('Tenant nao identificado para salvar artigo.');
      return;
    }

    const isEditing = editingEntryId !== null;
    const payload = {
      tenantId,
      title,
      content: serializeArticleContent(description, command),
      tags: newEntry.tags.split(',').map((t) => t.trim()).filter(Boolean),
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
        setEntries((prev) => prev.map((item) => (item.id === editedId ? mapped : item)));
        onToast('Dica atualizada na Ajustpedia.');
      } else {
        setEntries((prev) => [mapped, ...prev]);
        onToast('Contribuicao salva na base compartilhada.');
      }
      setExpandedId(mapped.id);
      closeContribModal();
    } catch (error) {
      onToast(error instanceof Error ? error.message : 'Falha ao salvar contribuicao.');
    }
  };

  const deleteEntry = async (entry) => {
    if (!canManageKnowledge) {
      onToast('Seu perfil nao pode apagar itens da Ajustpedia.');
      return;
    }
    if (!tenantId) {
      onToast('Tenant nao identificado para apagar artigo.');
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
      setEntries((prev) => prev.filter((item) => item.id !== entry.id));
      setFavorites((prev) => prev.filter((itemId) => itemId !== entry.id));
      setRecent((prev) => prev.filter((itemId) => itemId !== entry.id));
      if (expandedId === entry.id) {
        setExpandedId(null);
      }
      onToast('Dica apagada da Ajustpedia.');
    } catch (error) {
      onToast(error instanceof Error ? error.message : 'Falha ao apagar artigo.');
    } finally {
      setDeletingEntryId(null);
    }
  };

  const equipmentOptions = useMemo(
    () => ['Todos', ...Array.from(new Set(credentials.map((c) => c.equipmentType || 'OUTROS'))).sort((a, b) => a.localeCompare(b, 'pt-BR'))],
    [credentials]
  );
  const environmentOptions = useMemo(() => {
    const values = Array.from(new Set(credentials.map((c) => c.env || 'Nao informado')))
      .filter((item) => !/^sgp cliente\s+\d+$/i.test(String(item).trim()))
      .sort((a, b) => a.localeCompare(b, 'pt-BR'));
    return ['Todos', ...values];
  }, [credentials]);

  const providerSummariesVisible = useMemo(() => {
    const q = providerSearch.toLowerCase().trim();
    if (!q) return providerSummaries;
    return providerSummaries.filter((summary) => summary.provider.toLowerCase().includes(q));
  }, [providerSummaries, providerSearch]);

  const providersTotalCredentials = useMemo(
    () => providerSummaries.reduce((acc, row) => acc + (Number(row.total) || 0), 0),
    [providerSummaries]
  );

  const credsFiltered = useMemo(() => credentials, [credentials]);

  const groupedByEquipment = useMemo(() => {
    const map = new Map();
    credsFiltered.forEach((item) => {
      const equipmentType = item.equipmentType || 'OUTROS';
      if (!map.has(equipmentType)) map.set(equipmentType, []);
      map.get(equipmentType).push(item);
    });

    const sortBy = credentialSort.field || 'equipmentName';
    const sortDir = credentialSort.dir === 'desc' ? -1 : 1;
    const compare = (a, b) => {
      const read = (entry) => {
        if (sortBy === 'env') return entry.env || '';
        if (sortBy === 'host') return entry.host || '';
        if (sortBy === 'user') return entry.user || '';
        if (sortBy === 'notes') return entry.notes || '';
        return entry.equipmentName || '';
      };
      return read(a).localeCompare(read(b), 'pt-BR') * sortDir;
    };

    return Array.from(map.entries())
      .map(([equipmentType, items]) => ({
        equipmentType,
        total: items.length,
        items: [...items].sort(compare),
      }))
      .sort((a, b) => a.equipmentType.localeCompare(b.equipmentType, 'pt-BR'));
  }, [credsFiltered, credentialSort.field, credentialSort.dir]);

  const toggleCredentialSort = (field) => {
    setCredentialSort((prev) => {
      if (prev.field === field) {
        return { field, dir: prev.dir === 'asc' ? 'desc' : 'asc' };
      }
      return { field, dir: 'asc' };
    });
  };

  const openCredentialDetails = (credential) => {
    setSelectedCredential(credential);
  };

  const toggleCredentialSecret = async (credentialId) => {
    const currentlyVisible = !!visibleSecrets[credentialId];
    if (currentlyVisible) {
      setVisibleSecrets((prev) => ({ ...prev, [credentialId]: false }));
      return;
    }

    if (!revealedSecrets[credentialId]) {
      if (!tenantId) {
        onToast('Sem tenant autenticado para revelar credencial.');
        return;
      }
      try {
        const response = await fetch(`/api/knowledge/credentials/${encodeURIComponent(String(credentialId))}/reveal?tenantId=${encodeURIComponent(tenantId)}`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(payload.error || 'Falha ao revelar segredo.');
        }
        setRevealedSecrets((prev) => ({ ...prev, [credentialId]: payload.secret || '' }));
      } catch (error) {
        onToast(error instanceof Error ? error.message : 'Falha ao revelar credencial.');
        return;
      }
    }

    setVisibleSecrets((prev) => ({ ...prev, [credentialId]: true }));
  };

  const openCreateCredentialModal = () => {
    const selectedProvider = providerFilter !== 'Todos' ? providerFilter : '';
    setNewCredential((prev) => ({
      provider: selectedProvider || prev.provider || '',
      equipmentType: '',
      equipmentName: '',
      environment: '',
      host: '',
      username: '',
      secret: '',
      notes: '',
    }));
    setCreateCredentialError('');
    setShowCreateCredential(true);
  };

  const submitCreateCredential = async (e) => {
    e.preventDefault();
    if (!tenantId) {
      setCreateCredentialError('Tenant nao identificado na sessao.');
      return;
    }

    const payload = {
      tenantId,
      provider: newCredential.provider.trim(),
      equipmentType: newCredential.equipmentType.trim(),
      equipmentName: newCredential.equipmentName.trim(),
      environment: newCredential.environment.trim(),
      host: newCredential.host.trim(),
      username: newCredential.username.trim(),
      secret: newCredential.secret,
      notes: newCredential.notes.trim(),
    };

    if (!payload.provider || !payload.environment || !payload.host || !payload.username || !payload.secret) {
      setCreateCredentialError('Preencha os campos obrigatorios: Provedor, Ambiente, Host, Usuario e Senha.');
      return;
    }

    setCreateCredentialSaving(true);
    setCreateCredentialError('');
    try {
      const response = await fetch('/api/knowledge/credentials', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const created = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(created.error || 'Falha ao criar credencial.');
      }

      onToast('Equipamento/credencial adicionado com sucesso.');
      setShowCreateCredential(false);
      setNewCredential({
        provider: '',
        equipmentType: '',
        equipmentName: '',
        environment: '',
        host: '',
        username: '',
        secret: '',
        notes: '',
      });

      if (created?.provider && providerFilter !== created.provider) {
        setProviderFilter(created.provider);
      }
      setCredentialOffset(0);
      await loadProviderSummaries(tenantId, { silent: true });
      await loadCredentialsPage(tenantId, { silent: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Falha ao criar credencial.';
      setCreateCredentialError(message);
      onToast(message);
    } finally {
      setCreateCredentialSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className={cn("text-2xl font-bold", dark ? "text-slate-100" : "text-slate-900")}>
          {tab === 'credenciais' ? 'Cofre de Credenciais' : 'Ajustpedia'}
        </h2>
        <p className={cn("text-sm", dark ? "text-slate-400" : "text-slate-500")}>
          {tab === 'credenciais' ? 'Credenciais operacionais centralizadas.' : 'Procedimentos tecnicos compartilhados.'}
        </p>
        {syncing && <p className="text-xs text-slate-500 mt-1">Sincronizando base compartilhada...</p>}
        {!syncing && syncError && <p className="text-xs text-amber-700 mt-1">{syncError}</p>}
      </div>

      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={15} className={cn("absolute left-3 top-1/2 -translate-y-1/2", dark ? "text-slate-500" : "text-slate-400")} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar..."
            className={cn(
              "w-full pl-9 pr-3 py-2.5 border rounded-lg text-sm transition-colors",
              dark
                ? "bg-[#0f172a]/80 backdrop-blur-xl border-slate-700/50 text-slate-200 placeholder:text-slate-600 focus:border-blue-500/50"
                : "bg-white border-slate-300 text-slate-900 focus:border-blue-500"
            )}
          />
        </div>
        {tab === 'ajustpedia' && canManageKnowledge && (
          <button onClick={openCreateContribModal} className="px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 flex items-center gap-2">
            <Plus size={14} />
            Nova dica
          </button>
        )}
      </div>

      {tab === 'ajustpedia' && (
        <AnalystKnowledgeAjustpediaPanel
          dark={dark}
          author={author}
          tag={tag}
          onlyFav={onlyFav}
          authors={authors}
          tags={tags}
          recent={recent}
          entries={entries}
          filteredEntries={filteredEntries}
          expandedId={expandedId}
          favorites={favorites}
          canManage={canManageKnowledge}
          deletingId={deletingEntryId}
          onAuthorChange={setAuthor}
          onTagChange={setTag}
          onOnlyFavToggle={() => setOnlyFav((v) => !v)}
          onExpand={setExpandedId}
          onTouchRecent={touchRecent}
          onToggleFavorite={toggleFavorite}
          onCopyText={copyText}
          onEditEntry={openEditEntryModal}
          onDeleteEntry={deleteEntry}
        />
      )}

      {tab === 'credenciais' && (
        <AnalystKnowledgeCredentialsPanel
          dark={dark}
          equipmentFilter={equipmentFilter}
          equipmentOptions={equipmentOptions}
          providerFilter={providerFilter}
          providerSearch={providerSearch}
          credentialSearch={credentialSearch}
          providerSummariesVisible={providerSummariesVisible}
          providerSummariesTotal={providerSummaries.length}
          providersTotalCredentials={providersTotalCredentials}
          credentialsTotal={credentialsTotal}
          groupedByEquipment={groupedByEquipment}
          credentialSort={credentialSort}
          visibleSecrets={visibleSecrets}
          revealedSecrets={revealedSecrets}
          credentialOffset={credentialOffset}
          credentialLimit={credentialLimit}
          currentPageCount={credentials.length}
          onEquipmentFilterChange={setEquipmentFilter}
          onProviderFilterChange={setProviderFilter}
          onProviderSearchChange={setProviderSearch}
          onCredentialSearchChange={setCredentialSearch}
          onClearFilters={() => {
            setProviderFilter('Todos');
            setEquipmentFilter('Todos');
            setEnvironmentFilter('Todos');
            setProviderSearch('');
            setCredentialSearch('');
          }}
          onToggleCredentialSort={toggleCredentialSort}
          onOpenCredentialDetails={openCredentialDetails}
          onToggleCredentialSecret={toggleCredentialSecret}
          onCopyCredentialLine={(credential, visible, secret) => {
            copyText(`${credential.provider} | ${credential.equipmentType} | ${credential.env} | ${credential.host} | ${credential.user}${visible ? ` | ${secret}` : ''}`);
          }}
          onPrevPage={() => setCredentialOffset((prev) => Math.max(0, prev - credentialLimit))}
          onNextPage={() => setCredentialOffset((prev) => prev + credentialLimit)}
          canCreateCredential={canCreateCredential}
          onOpenCreateCredential={openCreateCredentialModal}
        />
      )}

      {showCreateCredential && (
        <Modal title="Novo equipamento / credencial" onClose={() => setShowCreateCredential(false)} maxWidth="max-w-2xl">
          <form onSubmit={submitCreateCredential} className="space-y-3">
            {createCredentialError && (
              <div className={cn("text-xs border rounded-lg px-3 py-2", dark ? "border-rose-700/40 bg-rose-900/20 text-rose-300" : "border-rose-200 bg-rose-50 text-rose-700")}>
                {createCredentialError}
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <label className="text-sm">
                <div className={cn("text-xs font-semibold mb-1", dark ? "text-slate-400" : "text-slate-600")}>Provedor *</div>
                <input
                  value={newCredential.provider}
                  onChange={(e) => setNewCredential((p) => ({ ...p, provider: e.target.value }))}
                  placeholder="Nome do provedor"
                  className={cn("w-full px-3 py-2 border rounded-lg text-sm", dark ? "bg-[#0f172a]/80 border-slate-700/50 text-slate-200" : "bg-white border-slate-300 text-slate-800")}
                />
              </label>
              <label className="text-sm">
                <div className={cn("text-xs font-semibold mb-1", dark ? "text-slate-400" : "text-slate-600")}>Ambiente *</div>
                <input
                  value={newCredential.environment}
                  onChange={(e) => setNewCredential((p) => ({ ...p, environment: e.target.value }))}
                  placeholder="Produção / NOC / LAB"
                  className={cn("w-full px-3 py-2 border rounded-lg text-sm", dark ? "bg-[#0f172a]/80 border-slate-700/50 text-slate-200" : "bg-white border-slate-300 text-slate-800")}
                />
              </label>
              <label className="text-sm">
                <div className={cn("text-xs font-semibold mb-1", dark ? "text-slate-400" : "text-slate-600")}>Tipo de equipamento</div>
                <input
                  value={newCredential.equipmentType}
                  onChange={(e) => setNewCredential((p) => ({ ...p, equipmentType: e.target.value }))}
                  placeholder="SWITCH, OLT, ROTEADOR..."
                  className={cn("w-full px-3 py-2 border rounded-lg text-sm", dark ? "bg-[#0f172a]/80 border-slate-700/50 text-slate-200" : "bg-white border-slate-300 text-slate-800")}
                />
              </label>
              <label className="text-sm">
                <div className={cn("text-xs font-semibold mb-1", dark ? "text-slate-400" : "text-slate-600")}>Nome do equipamento</div>
                <input
                  value={newCredential.equipmentName}
                  onChange={(e) => setNewCredential((p) => ({ ...p, equipmentName: e.target.value }))}
                  placeholder="SW-CORE-01"
                  className={cn("w-full px-3 py-2 border rounded-lg text-sm", dark ? "bg-[#0f172a]/80 border-slate-700/50 text-slate-200" : "bg-white border-slate-300 text-slate-800")}
                />
              </label>
              <label className="text-sm md:col-span-2">
                <div className={cn("text-xs font-semibold mb-1", dark ? "text-slate-400" : "text-slate-600")}>Host/IP *</div>
                <input
                  value={newCredential.host}
                  onChange={(e) => setNewCredential((p) => ({ ...p, host: e.target.value }))}
                  placeholder="10.0.0.10 ou host.exemplo.com"
                  className={cn("w-full px-3 py-2 border rounded-lg text-sm font-mono", dark ? "bg-[#0f172a]/80 border-slate-700/50 text-slate-200" : "bg-white border-slate-300 text-slate-800")}
                />
              </label>
              <label className="text-sm">
                <div className={cn("text-xs font-semibold mb-1", dark ? "text-slate-400" : "text-slate-600")}>Usuario *</div>
                <input
                  value={newCredential.username}
                  onChange={(e) => setNewCredential((p) => ({ ...p, username: e.target.value }))}
                  placeholder="admin"
                  className={cn("w-full px-3 py-2 border rounded-lg text-sm", dark ? "bg-[#0f172a]/80 border-slate-700/50 text-slate-200" : "bg-white border-slate-300 text-slate-800")}
                />
              </label>
              <label className="text-sm">
                <div className={cn("text-xs font-semibold mb-1", dark ? "text-slate-400" : "text-slate-600")}>Senha *</div>
                <input
                  type="password"
                  value={newCredential.secret}
                  onChange={(e) => setNewCredential((p) => ({ ...p, secret: e.target.value }))}
                  placeholder="Senha de acesso"
                  className={cn("w-full px-3 py-2 border rounded-lg text-sm", dark ? "bg-[#0f172a]/80 border-slate-700/50 text-slate-200" : "bg-white border-slate-300 text-slate-800")}
                />
              </label>
              <label className="text-sm md:col-span-2">
                <div className={cn("text-xs font-semibold mb-1", dark ? "text-slate-400" : "text-slate-600")}>Observacoes</div>
                <textarea
                  rows={3}
                  value={newCredential.notes}
                  onChange={(e) => setNewCredential((p) => ({ ...p, notes: e.target.value }))}
                  placeholder="Porta, VLAN, procedimentos..."
                  className={cn("w-full px-3 py-2 border rounded-lg text-sm", dark ? "bg-[#0f172a]/80 border-slate-700/50 text-slate-200" : "bg-white border-slate-300 text-slate-800")}
                />
              </label>
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowCreateCredential(false)} className={cn("px-3 py-2 text-sm border rounded-lg", dark ? "border-slate-700/50 text-slate-400 hover:bg-white/5" : "border-slate-300 text-slate-600 hover:bg-slate-50")}>
                Cancelar
              </button>
              <button
                type="submit"
                disabled={createCredentialSaving}
                className={cn("px-4 py-2 text-sm rounded-lg text-white", createCredentialSaving ? "bg-cyan-700/60" : "bg-cyan-600 hover:bg-cyan-700")}
              >
                {createCredentialSaving ? 'Salvando...' : 'Salvar credencial'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {selectedCredential && (
        <Modal title={`Credencial - ${selectedCredential.equipmentName || selectedCredential.host}`} onClose={() => setSelectedCredential(null)} maxWidth="max-w-7xl">
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              <div className={cn("border rounded-lg p-3", dark ? "bg-[#0f172a]/80 border-slate-700/50" : "bg-slate-50 border-slate-200")}>
                <div className={cn("text-[11px] uppercase font-bold", dark ? "text-slate-500" : "text-slate-500")}>Provedor</div>
                <div className={cn("font-semibold mt-1", dark ? "text-slate-200" : "text-slate-800")}>{selectedCredential.provider}</div>
              </div>
              <div className={cn("border rounded-lg p-3", dark ? "bg-[#0f172a]/80 border-slate-700/50" : "bg-slate-50 border-slate-200")}>
                <div className={cn("text-[11px] uppercase font-bold", dark ? "text-slate-500" : "text-slate-500")}>Tipo de equipamento</div>
                <div className={cn("font-semibold mt-1", dark ? "text-slate-200" : "text-slate-800")}>{selectedCredential.equipmentType}</div>
              </div>
              <div className={cn("border rounded-lg p-3", dark ? "bg-[#0f172a]/80 border-slate-700/50" : "bg-slate-50 border-slate-200")}>
                <div className={cn("text-[11px] uppercase font-bold", dark ? "text-slate-500" : "text-slate-500")}>Equipamento</div>
                <div className={cn("font-semibold mt-1", dark ? "text-slate-200" : "text-slate-800")}>{selectedCredential.equipmentName || '-'}</div>
              </div>
              <div className={cn("border rounded-lg p-3", dark ? "bg-[#0f172a]/80 border-slate-700/50" : "bg-slate-50 border-slate-200")}>
                <div className={cn("text-[11px] uppercase font-bold", dark ? "text-slate-500" : "text-slate-500")}>Ambiente</div>
                <div className={cn("font-semibold mt-1", dark ? "text-slate-200" : "text-slate-800")}>
                  {/^sgp cliente\s+\d+$/i.test(String(selectedCredential.env || '').trim()) ? '-' : (selectedCredential.env || '-')}
                </div>
              </div>
              <div className={cn("border rounded-lg p-3", dark ? "bg-[#0f172a]/80 border-slate-700/50" : "bg-slate-50 border-slate-200")}>
                <div className={cn("text-[11px] uppercase font-bold", dark ? "text-slate-500" : "text-slate-500")}>Host</div>
                <div className={cn("font-mono text-xs mt-1 break-all", dark ? "text-slate-300" : "text-slate-700")}>{selectedCredential.host}</div>
              </div>
              <div className={cn("border rounded-lg p-3", dark ? "bg-[#0f172a]/80 border-slate-700/50" : "bg-slate-50 border-slate-200")}>
                <div className={cn("text-[11px] uppercase font-bold", dark ? "text-slate-500" : "text-slate-500")}>Usuario</div>
                <div className={cn("font-mono text-xs mt-1 break-all", dark ? "text-slate-300" : "text-slate-700")}>{selectedCredential.user}</div>
              </div>
              <div className={cn("border rounded-lg p-3 md:col-span-2", dark ? "bg-[#0f172a]/80 border-slate-700/50" : "bg-slate-50 border-slate-200")}>
                <div className={cn("text-[11px] uppercase font-bold", dark ? "text-slate-500" : "text-slate-500")}>Senha</div>
                <div className={cn("font-mono text-xs mt-1 break-all", dark ? "text-slate-300" : "text-slate-700")}>
                  {visibleSecrets[selectedCredential.id] ? (revealedSecrets[selectedCredential.id] || selectedCredential.secret) : selectedCredential.secret}
                </div>
                <div className="mt-2 flex gap-2">
                  <button
                    onClick={() => toggleCredentialSecret(selectedCredential.id)}
                    className={cn("px-3 py-1.5 text-xs border rounded flex items-center gap-1", dark ? "border-slate-700/50 text-slate-400 hover:bg-white/5" : "border-slate-300 text-slate-600 hover:bg-slate-50")}
                  >
                    {visibleSecrets[selectedCredential.id] ? <EyeOff size={12} /> : <Eye size={12} />}
                    {visibleSecrets[selectedCredential.id] ? 'Ocultar senha' : 'Exibir senha'}
                  </button>
                  <button
                    onClick={() => {
                      const secret = revealedSecrets[selectedCredential.id] || selectedCredential.secret;
                      copyText(`${selectedCredential.provider} | ${selectedCredential.equipmentType} | ${selectedCredential.host} | ${selectedCredential.user}${visibleSecrets[selectedCredential.id] ? ` | ${secret}` : ''}`);
                    }}
                    className="px-3 py-1.5 text-xs border border-blue-200 bg-blue-50 text-blue-700 rounded hover:bg-blue-100"
                  >
                    Copiar dados
                  </button>
                </div>
              </div>
            </div>

            <div className={cn("border rounded-lg p-3", dark ? "bg-[#0f172a]/80 border-slate-700/50" : "bg-slate-50 border-slate-200")}>
              <div className={cn("text-[11px] uppercase font-bold mb-1", dark ? "text-slate-500" : "text-slate-500")}>Descricao / Observacoes</div>
              <div className={cn("text-sm whitespace-pre-wrap break-words max-h-[46vh] overflow-y-auto custom-scrollbar pr-2", dark ? "text-slate-300" : "text-slate-700")}>
                {selectedCredential.notes || 'Sem observacoes.'}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div className={cn("border rounded-lg p-3", dark ? "bg-[#0f172a]/80 border-slate-700/50 text-slate-400" : "bg-slate-50 border-slate-200 text-slate-600")}>
                <span className="font-semibold">Criado em:</span> {selectedCredential.createdAt ? formatDateTime(selectedCredential.createdAt) : '-'}
              </div>
              <div className={cn("border rounded-lg p-3", dark ? "bg-[#0f172a]/80 border-slate-700/50 text-slate-400" : "bg-slate-50 border-slate-200 text-slate-600")}>
                <span className="font-semibold">Atualizado em:</span> {selectedCredential.updatedAt ? formatDateTime(selectedCredential.updatedAt) : '-'}
              </div>
            </div>
          </div>
        </Modal>
      )}

      {showContrib && (
        <Modal title={editingEntryId ? "Editar dica da Ajustpedia" : "Nova dica na Ajustpedia"} onClose={closeContribModal} maxWidth="max-w-2xl">
          <form onSubmit={submitContrib} className="space-y-3">
            <input value={newEntry.title} onChange={(e) => setNewEntry((p) => ({ ...p, title: e.target.value }))} placeholder="Titulo da dica (uma acao unica)" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
            <input value={newEntry.tags} onChange={(e) => setNewEntry((p) => ({ ...p, tags: e.target.value }))} placeholder="Tags separadas por virgula" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
            <textarea rows={2} value={newEntry.description} onChange={(e) => setNewEntry((p) => ({ ...p, description: e.target.value }))} placeholder="Descricao objetiva da dica" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
            <textarea rows={6} value={newEntry.command} onChange={(e) => setNewEntry((p) => ({ ...p, command: e.target.value }))} placeholder="Comando/procedimento" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono bg-slate-950 text-slate-100" />
            <p className={cn("text-xs", dark ? "text-slate-400" : "text-slate-500")}>
              Padrao Ajustpedia: cada dica deve cobrir apenas um procedimento.
            </p>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={closeContribModal} className="px-3 py-2 border border-slate-300 rounded-lg text-sm">Cancelar</button>
              <button type="submit" className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold">{editingEntryId ? 'Salvar alteracoes' : 'Salvar'}</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};

const CalendarView = ({ orders, onSelectOrder }) => {
  const [monthDate, setMonthDate] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d;
  });

  const [selectedDay, setSelectedDay] = useState(null);

  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstWeekDay = new Date(year, month, 1).getDay();

  const grid = [];
  for (let i = 0; i < firstWeekDay; i++) grid.push(null);
  for (let d = 1; d <= daysInMonth; d++) grid.push(d);

  const getEventsForDay = (day) => {
    if (!day) return [];
    const start = new Date(year, month, day, 0, 0, 0, 0).getTime();
    const end = start + DAY_MS - 1;
    return orders
      .filter((o) => {
        const dueInDay = o.deadlineAt >= start && o.deadlineAt <= end;
        const createdInDay = o.createdAt >= start && o.createdAt <= end;
        return dueInDay || createdInDay;
      })
      .slice(0, 20);
  };

  const selectedEvents = selectedDay ? getEventsForDay(selectedDay) : [];

  const { dark } = useTheme();

  return (
    <div className="space-y-5 h-full flex flex-col">
      <div className="flex items-center justify-between">
        <h2 className={cn("text-2xl font-bold", dark ? "text-slate-100" : "text-slate-900")}>Calendario Operacional</h2>
        <div className={cn("flex items-center gap-2 border rounded-lg p-1", dark ? "bg-[#1e293b]/60 backdrop-blur-md border-slate-700/50" : "bg-white border-slate-200")}>
          <button onClick={() => setMonthDate(new Date(year, month - 1, 1))} className={cn("p-2 rounded", dark ? "hover:bg-white/5 text-slate-300" : "hover:bg-slate-100 text-slate-600")}>
            <ChevronLeft size={16} />
          </button>
          <div className={cn("text-sm font-semibold min-w-[150px] text-center", dark ? "text-slate-200" : "text-slate-700")}>
            {monthDate.toLocaleString('pt-BR', { month: 'long', year: 'numeric' })}
          </div>
          <button onClick={() => setMonthDate(new Date(year, month + 1, 1))} className={cn("p-2 rounded", dark ? "hover:bg-white/5 text-slate-300" : "hover:bg-slate-100 text-slate-600")}>
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-4 min-h-0">
        <div className={cn("lg:col-span-2 border rounded-xl p-4 overflow-y-auto custom-scrollbar", dark ? "bg-[#1e293b]/60 backdrop-blur-md border-slate-700/50" : "bg-white border-slate-200")}>
          <div className="grid grid-cols-7 gap-2 mb-2">
            {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'].map((d) => (
              <div key={d} className="text-[11px] font-bold uppercase text-slate-400 text-center py-1">{d}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-2">
            {grid.map((day, idx) => {
              const events = getEventsForDay(day);
              const selected = selectedDay === day;

              return (
                <button
                  key={idx}
                  disabled={!day}
                  onClick={() => day && setSelectedDay(day)}
                  className={cn(
                    'min-h-[95px] rounded-lg border p-2 text-left transition-colors',
                    !day ? 'border-transparent bg-transparent cursor-default' : (dark ? 'border-slate-700/50 hover:border-blue-500/50 hover:bg-blue-900/10' : 'border-slate-200 hover:border-blue-300 hover:bg-blue-50/30'),
                    selected && (dark ? 'ring-2 ring-blue-500 bg-blue-900/20' : 'ring-2 ring-blue-500 bg-blue-50')
                  )}
                >
                  {day && (
                    <>
                      <div className={cn("text-sm font-semibold", dark ? "text-slate-300" : "text-slate-700")}>{day}</div>
                      <div className="mt-1 space-y-1">
                        {events.slice(0, 3).map((e) => (
                          <div key={e.id} className={cn("text-[10px] px-1.5 py-0.5 rounded border truncate", dark ? "bg-[#0f172a]/80 backdrop-blur-xl border-slate-700/50 text-slate-300" : "bg-slate-100 border-slate-200 text-slate-600")}>
                            {e.protocol}
                          </div>
                        ))}
                        {events.length > 3 && <div className="text-[10px] text-slate-400">+{events.length - 3} mais</div>}
                      </div>
                    </>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className={cn("border rounded-xl overflow-hidden flex flex-col", dark ? "bg-[#1e293b]/60 backdrop-blur-md border-slate-700/50" : "bg-white border-slate-200")}>
          <div className={cn("px-4 py-3 border-b", dark ? "bg-[#0f172a]/80 backdrop-blur-xl border-slate-700/50" : "bg-slate-50 border-slate-100")}>
            <h3 className={cn("font-bold", dark ? "text-slate-200" : "text-slate-700")}>{selectedDay ? `Eventos do dia ${selectedDay}` : 'Selecione um dia'}</h3>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-2">
            {selectedDay ? (
              selectedEvents.length > 0 ? (
                selectedEvents.map((e) => (
                  <div key={e.id} className={cn("p-3 border rounded-lg", dark ? "bg-[#0f172a]/80 backdrop-blur-xl border-slate-700/50" : "bg-slate-50 border-slate-200")}>
                    <div className="flex justify-between items-center mb-1">
                      <span className={cn("font-mono text-xs", dark ? "text-slate-300" : "text-slate-700")}>{e.protocol}</span>
                      <Badge color={getStatusColor(e.status)}>{e.status}</Badge>
                    </div>
                    <div className={cn("text-xs", dark ? "text-slate-400" : "text-slate-600")}>{e.provider}</div>
                    <div className="text-xs text-slate-500 mt-1">{formatDateTime(e.deadlineAt)}</div>
                    <button onClick={() => onSelectOrder(e)} className={cn("mt-2 px-2 py-1 text-[10px] border rounded font-bold transition-colors", dark ? "bg-cyan-900/30 border-cyan-700/50 text-cyan-400 hover:bg-cyan-900/50" : "border-cyan-200 bg-cyan-50 text-cyan-700 hover:bg-cyan-100/50")}>
                      Abrir
                    </button>
                  </div>
                ))
              ) : (
                <div className="text-sm text-slate-400">Sem eventos nesse dia.</div>
              )
            ) : (
              <div className="text-sm text-slate-400">Selecione uma data no calendario.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const ReportsView = ({ orders, onToast }) => {
  const [period, setPeriod] = useState('30d');
  const scoped = useMemo(() => filterByPeriod(orders, period), [orders, period]);

  const statusSummary = useMemo(() => {
    const map = {};
    scoped.forEach((o) => {
      map[o.status] = (map[o.status] || 0) + 1;
    });
    return map;
  }, [scoped]);

  const { dark } = useTheme();

  const providerSummary = useMemo(() => {
    const map = {};
    scoped.forEach((o) => {
      map[o.provider] = (map[o.provider] || 0) + 1;
    });
    return Object.entries(map).map(([provider, total]) => ({ provider, total })).sort((a, b) => b.total - a.total);
  }, [scoped]);

  const topDelays = useMemo(
    () =>
      scoped
        .filter((o) => getDelayHours(o) > 0)
        .sort((a, b) => getDelayHours(b) - getDelayHours(a))
        .slice(0, 10),
    [scoped]
  );

  const exportCsv = () => {
    const header = ['protocol', 'provider', 'tech', 'owner', 'type', 'priority', 'status', 'createdAt', 'deadlineAt', 'delayHours'];
    const rows = scoped.map((o) => [
      o.protocol,
      o.provider,
      o.tech || '',
      o.owner || '',
      o.type,
      o.priority,
      o.status,
      formatDateTime(o.createdAt),
      formatDateTime(o.deadlineAt),
      getDelayHours(o).toFixed(2),
    ]);

    const csv = [header.join(','), ...rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `relatorio_os_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    onToast('CSV exportado.');
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <h2 className={cn("text-2xl font-bold", dark ? "text-slate-100" : "text-slate-900")}>Relatorios</h2>
          <p className={cn("text-sm", dark ? "text-slate-400" : "text-slate-500")}>Indicadores operacionais e exportacao CSV.</p>
        </div>
        <PeriodTabs value={period} onChange={setPeriod} />
      </div>

      <div className="flex justify-end">
        <button onClick={exportCsv} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 flex items-center gap-2">
          <Save size={14} />
          Exportar CSV
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className={cn("border rounded-xl p-4 shadow-sm", dark ? "bg-[#1e293b]/60 backdrop-blur-md border-slate-700/50" : "bg-white border-slate-200")}>
          <h3 className={cn("font-bold mb-3", dark ? "text-slate-200" : "text-slate-800")}>Resumo por status</h3>
          <div className="space-y-2">
            {Object.entries(statusSummary).map(([status, count]) => (
              <div key={status} className={cn("flex items-center justify-between p-2 rounded border", dark ? "bg-[#0f172a]/80 backdrop-blur-xl border-slate-700/50" : "bg-slate-50 border-slate-200")}>
                <Badge color={getStatusColor(status)}>{status}</Badge>
                <span className={cn("font-mono font-bold", dark ? "text-slate-300" : "text-slate-700")}>{count}</span>
              </div>
            ))}
            {Object.keys(statusSummary).length === 0 && <div className="text-sm text-slate-400">Sem dados na janela.</div>}
          </div>
        </div>

        <div className={cn("border rounded-xl p-4 shadow-sm", dark ? "bg-[#1e293b]/60 backdrop-blur-md border-slate-700/50" : "bg-white border-slate-200")}>
          <h3 className={cn("font-bold mb-3", dark ? "text-slate-200" : "text-slate-800")}>Top provedores</h3>
          <div className="space-y-2">
            {providerSummary.slice(0, 8).map((p) => (
              <div key={p.provider} className={cn("flex items-center justify-between p-2 rounded border", dark ? "bg-[#0f172a]/80 backdrop-blur-xl border-slate-700/50" : "bg-slate-50 border-slate-200")}>
                <span className={cn("text-sm", dark ? "text-slate-300" : "text-slate-700")}>{p.provider}</span>
                <span className={cn("font-mono font-bold", dark ? "text-slate-300" : "text-slate-700")}>{p.total}</span>
              </div>
            ))}
            {providerSummary.length === 0 && <div className="text-sm text-slate-400">Sem dados na janela.</div>}
          </div>
        </div>
      </div>

      <div className={cn("border rounded-xl overflow-hidden shadow-sm", dark ? "bg-[#1e293b]/60 backdrop-blur-md border-slate-700/50" : "bg-white border-slate-200")}>
        <div className={cn("px-5 py-3 border-b font-bold text-sm", dark ? "border-slate-700/50 text-slate-300" : "border-slate-100 text-slate-700")}>Top atrasos</div>
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-sm">
            <thead className={cn(dark ? "bg-white/5 text-slate-400" : "bg-slate-50 text-slate-500")}>
              <tr>
                <th className="px-5 py-3 text-left">Protocolo</th>
                <th className="px-5 py-3 text-left">Provedor</th>
                <th className="px-5 py-3 text-left">Tecnico</th>
                <th className="px-5 py-3 text-left">Status</th>
                <th className="px-5 py-3 text-right">Delay (h)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {topDelays.map((o) => (
                <tr key={o.id}>
                  <td className="px-5 py-3 font-mono">{o.protocol}</td>
                  <td className="px-5 py-3">{o.provider}</td>
                  <td className="px-5 py-3">{o.tech || '-'}</td>
                  <td className="px-5 py-3"><Badge color={getStatusColor(o.status)}>{o.status}</Badge></td>
                  <td className="px-5 py-3 text-right font-mono font-bold text-rose-600">{getDelayHours(o).toFixed(2)}</td>
                </tr>
              ))}
              {topDelays.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-14 text-center">
                    <CheckCircle size={28} className="mx-auto mb-3 text-emerald-300" />
                    <p className="text-sm font-medium text-slate-500 mb-1">Sem atrasos no periodo.</p>
                    <p className="text-xs text-slate-400">Todas as OS estao dentro do prazo.</p>
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

const SettingsView = ({ onToast, onProfileNameChange }) => {
  const [account, setAccount] = useState({
    username: '',
    email: '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { dark } = useTheme();

  useEffect(() => {
    let active = true;
    const loadProfile = async () => {
      try {
        const response = await fetch('/api/auth/me', { cache: 'no-store' });
        if (!response.ok) {
          throw new Error(await readApiErrorMessage(response, 'Falha ao carregar perfil.'));
        }
        const me = await response.json();
        if (!active) return;
        setAccount((prev) => ({
          ...prev,
          username: String(me?.name || ''),
          email: String(me?.email || ''),
        }));
      } catch (loadError) {
        if (!active) return;
        setError(loadError instanceof Error ? loadError.message : 'Falha ao carregar perfil.');
      } finally {
        if (active) setLoading(false);
      }
    };
    loadProfile();
    return () => {
      active = false;
    };
  }, []);

  const saveAccess = () => {
    if (saving) return;
    const errs = {};
    if (!account.username.trim()) errs.username = 'Informe o usuario.';
    if (!account.email.trim()) errs.email = 'Informe o e-mail.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(account.email.trim())) errs.email = 'E-mail invalido.';
    if (account.newPassword || account.confirmPassword || account.currentPassword) {
      if (!account.currentPassword) errs.currentPassword = 'Informe a senha atual.';
      if (account.newPassword.length < 8) errs.newPassword = 'Minimo 8 caracteres.';
      if (account.newPassword !== account.confirmPassword) errs.confirmPassword = 'Confirmacao nao confere.';
    }
    setFieldErrors(errs);
    if (Object.keys(errs).length > 0) return;

    const payload = {
      name: account.username.trim(),
      email: account.email.trim(),
      ...(account.newPassword
        ? {
          currentPassword: account.currentPassword,
          newPassword: account.newPassword,
        }
        : {}),
    };

    (async () => {
      setSaving(true);
      setError('');
      try {
        const response = await fetch('/api/auth/me', {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!response.ok) {
          throw new Error(await readApiErrorMessage(response, 'Falha ao atualizar dados de acesso.'));
        }
        const updated = await response.json();
        const nextName = String(updated?.name || payload.name || '');
        const nextEmail = String(updated?.email || payload.email || '');
        setAccount((prev) => ({
          ...prev,
          username: nextName,
          email: nextEmail,
          currentPassword: '',
          newPassword: '',
          confirmPassword: '',
        }));
        if (nextName) onProfileNameChange?.(nextName);
        onToast('Dados de acesso atualizados.');
      } catch (saveError) {
        setError(saveError instanceof Error ? saveError.message : 'Falha ao atualizar dados de acesso.');
      } finally {
        setSaving(false);
      }
    })();
  };

  return (
    <div className="space-y-5 max-w-3xl">
      <h2 className={cn("text-2xl font-bold", dark ? "text-slate-100" : "text-slate-900")}>Configuracoes</h2>

      <div className={cn("border rounded-xl p-5 shadow-sm space-y-4", dark ? "bg-[#1e293b]/60 backdrop-blur-md border-slate-700/50" : "bg-white border-slate-200")}>
        <div>
          <label className={cn("text-xs uppercase font-bold tracking-wider mb-1 block", dark ? "text-slate-500" : "text-slate-500")}>Usuario<span className="text-rose-500 ml-0.5">*</span></label>
          <input
            value={account.username}
            onChange={(e) => { setAccount((p) => ({ ...p, username: e.target.value })); setFieldErrors((p) => ({ ...p, username: undefined })); }}
            disabled={loading || saving}
            className={cn('w-full px-3 py-2 border rounded-lg text-sm transition-colors',
              dark ? "bg-[#0f172a]/80 backdrop-blur-xl border-slate-700/50 text-slate-200 focus:border-blue-500" : "border-slate-300 text-slate-900 focus:border-blue-500",
              fieldErrors.username && 'border-rose-400'
            )}
          />
          {fieldErrors.username && <p className="text-xs text-rose-500 mt-1">{fieldErrors.username}</p>}
        </div>

        <div>
          <label className="text-xs uppercase font-bold tracking-wider text-slate-500 mb-1 block">E-mail<span className="text-rose-500 ml-0.5">*</span></label>
          <input
            value={account.email}
            onChange={(e) => { setAccount((p) => ({ ...p, email: e.target.value })); setFieldErrors((p) => ({ ...p, email: undefined })); }}
            disabled={loading || saving}
            className={cn('w-full px-3 py-2 border rounded-lg text-sm transition-colors',
              dark ? "bg-[#0f172a]/80 backdrop-blur-xl border-slate-700/50 text-slate-200 focus:border-blue-500" : "border-slate-300 text-slate-900 focus:border-blue-500",
              fieldErrors.email && 'border-rose-400'
            )}
          />
          {fieldErrors.email && <p className="text-xs text-rose-500 mt-1">{fieldErrors.email}</p>}
        </div>

      </div>

      <div className={cn("border-t pt-4 space-y-3", dark ? "border-slate-700/50" : "border-slate-100")}>
        <h3 className={cn("text-sm font-bold", dark ? "text-slate-300" : "text-slate-700")}>Trocar senha</h3>
        <input
          type="password"
          placeholder="Senha atual"
          value={account.currentPassword}
          onChange={(e) => { setAccount((p) => ({ ...p, currentPassword: e.target.value })); setFieldErrors((p) => ({ ...p, currentPassword: undefined })); }}
          disabled={loading || saving}
          className={cn('w-full px-3 py-2 border rounded-lg text-sm transition-colors',
            dark ? "bg-[#0f172a]/80 backdrop-blur-xl border-slate-700/50 text-slate-200 focus:border-blue-500" : "border-slate-300 text-slate-900 focus:border-blue-500",
            fieldErrors.currentPassword && 'border-rose-400'
          )}
        />
        {fieldErrors.currentPassword && <p className="text-xs text-rose-500 mt-1">{fieldErrors.currentPassword}</p>}
        <input
          type="password"
          placeholder="Nova senha (min 8 caracteres)"
          value={account.newPassword}
          onChange={(e) => { setAccount((p) => ({ ...p, newPassword: e.target.value })); setFieldErrors((p) => ({ ...p, newPassword: undefined })); }}
          disabled={loading || saving}
          className={cn('w-full px-3 py-2 border rounded-lg text-sm transition-colors',
            dark ? "bg-[#0f172a]/80 backdrop-blur-xl border-slate-700/50 text-slate-200 focus:border-blue-500" : "border-slate-300 text-slate-900 focus:border-blue-500",
            fieldErrors.newPassword && 'border-rose-400'
          )}
        />
        {fieldErrors.newPassword && <p className="text-xs text-rose-500 mt-1">{fieldErrors.newPassword}</p>}
        <input
          type="password"
          placeholder="Confirmar nova senha"
          value={account.confirmPassword}
          onChange={(e) => { setAccount((p) => ({ ...p, confirmPassword: e.target.value })); setFieldErrors((p) => ({ ...p, confirmPassword: undefined })); }}
          disabled={loading || saving}
          className={cn('w-full px-3 py-2 border rounded-lg text-sm transition-colors',
            dark ? "bg-[#0f172a]/80 backdrop-blur-xl border-slate-700/50 text-slate-200 focus:border-blue-500" : "border-slate-300 text-slate-900 focus:border-blue-500",
            fieldErrors.confirmPassword && 'border-rose-400'
          )}
        />
        {fieldErrors.confirmPassword && <p className="text-xs text-rose-500 mt-1">{fieldErrors.confirmPassword}</p>}
      </div>

      {loading && <div className="text-sm text-slate-500">Carregando perfil...</div>}
      {error && <div className="text-sm text-rose-700 bg-rose-100 border border-rose-200 rounded-lg px-3 py-2">{error}</div>}

      <div className="flex justify-end">
        <button onClick={saveAccess} disabled={loading || saving} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold disabled:opacity-50">
          {saving ? 'Salvando...' : 'Salvar acesso'}
        </button>
      </div>
    </div>
  );
};

export default function AnalystTechnicianMockupComplete() {
  const [dark, setDark] = useState(true);
  const toggleTheme = () => setDark(!dark);

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [currentView, setCurrentView] = useState('dashboard');
  const [role, setRole] = useState('analyst');
  const [currentAnalystName, setCurrentAnalystName] = useState('Analista');
  const [orders, setOrders] = useState([]);
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [focusProviderName, setFocusProviderName] = useState(null);
  const [focusOccurrenceId, setFocusOccurrenceId] = useState(null);

  const [mobileOpen, setMobileOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState(null);
  const [editingOccurrence, setEditingOccurrence] = useState(null);
  const [toastMessage, setToastMessage] = useState('');
  useEffect(() => {
    if (!toastMessage) return;
    const t = setTimeout(() => setToastMessage(''), 2500);
    return () => clearTimeout(t);
  }, [toastMessage]);
  const [commandOpen, setCommandOpen] = useState(false);
  const [menuResetToken, setMenuResetToken] = useState(0);
  const [mounted, setMounted] = useState(false);
  const [tenantId, setTenantId] = useState(null);
  const [apiSyncing, setApiSyncing] = useState(false);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (e) { }
    window.location.href = '/login';
  };
  const [apiSyncError, setApiSyncError] = useState('');
  const [initialLoading, setInitialLoading] = useState(true);
  const selectedOrder = useMemo(() => orders.find((o) => o.id === selectedOrderId) || null, [orders, selectedOrderId]);
  const roleCode = mapUiRoleToCode(role);

  const onToast = (msg) => setToastMessage(msg);
  const apiEnabled = !!tenantId;


  const loadRemoteOrders = async (targetTenantId, options = {}) => {
    if (!targetTenantId) return false;
    const silent = !!options.silent;
    if (!silent) setApiSyncing(true);
    setApiSyncError('');
    try {
      const params = new URLSearchParams({
        tenantId: targetTenantId,
        includeOrders: 'true',
        limit: '200',
      });
      const response = await fetch(`/api/occurrences?${params.toString()}`, { cache: 'no-store' });
      if (!response.ok) {
        throw new Error(await readApiErrorMessage(response, 'Falha ao carregar ocorrencias.'));
      }
      const payload = await response.json();
      const mapped = mapApiOccurrencesToUiOrders(payload);
      setOrders(mapped);
      return true;
    } catch (error) {
      setApiSyncError(error instanceof Error ? error.message : 'Falha ao sincronizar dados do backend.');
      return false;
    } finally {
      if (!silent) setApiSyncing(false);
    }
  };

  const transitionOrderRemote = async (orderId, nextStatusLabel, reason = 'Atualizacao manual pelo analista.') => {
    if (!tenantId) return false;
    const response = await fetch(`/api/service-orders/${encodeURIComponent(orderId)}/transition?tenantId=${encodeURIComponent(tenantId)}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        toStatus: toApiOrderStatus(nextStatusLabel),
        reason,
      }),
    });
    if (!response.ok) {
      throw new Error(await readApiErrorMessage(response, 'Falha ao transicionar O.S.'));
    }
    return true;
  };

  const uploadOrderAttachments = async (orderId, attachments) => {
    if (!tenantId || !orderId) return;
    if (!canUploadAttachment(roleCode)) {
      onToast('Perfil sem permissao para anexar arquivos.');
      return;
    }
    const files = normalizeAttachments(attachments)
      .map((item) => item.file)
      .filter(Boolean);
    if (files.length === 0) return;

    const formData = new FormData();
    files.forEach((file) => {
      formData.append('files', file);
    });

    const response = await fetch(`/api/service-orders/${encodeURIComponent(orderId)}/attachments?tenantId=${encodeURIComponent(tenantId)}`, {
      method: 'POST',
      body: formData,
    });
    if (!response.ok) {
      throw new Error(await readApiErrorMessage(response, 'Falha ao enviar anexos.'));
    }
  };

  const addOrderAnnotation = async (order, message) => {
    if (!apiEnabled || !order?.id) {
      onToast('Tenant nao identificado para comentar na O.S.');
      return false;
    }
    if (!canEditOrder(roleCode)) {
      onToast('Perfil sem permissao para comentar na O.S.');
      return false;
    }
    try {
      const response = await fetch(`/api/service-orders/${encodeURIComponent(order.id)}/annotations?tenantId=${encodeURIComponent(tenantId)}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ message }),
      });
      if (!response.ok) {
        throw new Error(await readApiErrorMessage(response, 'Falha ao registrar atualizacao da O.S.'));
      }
      await loadRemoteOrders(tenantId, { silent: true });
      onToast(`Atualizacao registrada na O.S ${order.protocol}.`);
      return true;
    } catch (error) {
      onToast(error instanceof Error ? error.message : 'Falha ao registrar atualizacao da O.S.');
      return false;
    }
  };

  const addOccurrenceAnnotation = async (occurrence, message) => {
    if (!apiEnabled || !occurrence?.id) {
      onToast('Tenant nao identificado para comentar na ocorrencia.');
      return false;
    }
    if (!canAnnotateOccurrence(roleCode)) {
      onToast('Perfil sem permissao para comentar na ocorrencia.');
      return false;
    }
    try {
      const response = await fetch(`/api/occurrences/${encodeURIComponent(occurrence.id)}/annotations?tenantId=${encodeURIComponent(tenantId)}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ message }),
      });
      if (!response.ok) {
        throw new Error(await readApiErrorMessage(response, 'Falha ao registrar anotacao da ocorrencia.'));
      }
      await loadRemoteOrders(tenantId, { silent: true });
      onToast(`Anotacao registrada na ocorrencia ${occurrence.number}.`);
      return true;
    } catch (error) {
      onToast(error instanceof Error ? error.message : 'Falha ao registrar anotacao da ocorrencia.');
      return false;
    }
  };

  const openOrderDetails = (order) => {
    setSelectedOrderId(order.id);
    pushUiHistoryState({ layer: 'order', orderId: order.id });
  };

  const openOrderEditor = (order) => {
    setEditingOrder(order);
    pushUiHistoryState({ layer: 'edit_order', orderId: order.id });
  };

  const openOccurrenceEditor = (occurrence) => {
    setEditingOccurrence(occurrence);
    pushUiHistoryState({ layer: 'edit_occurrence', occurrenceId: occurrence.id });
  };

  const navigateFromMenu = (viewId) => {
    setSelectedOrderId(null);
    setEditingOrder(null);
    setEditingOccurrence(null);
    setFocusProviderName(null);
    setFocusOccurrenceId(null);
    setCurrentView(viewId);
    setMenuResetToken((prev) => prev + 1);
    setMobileOpen(false);
  };

  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandOpen(true);
      }
      if (e.key === 'Escape') setCommandOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    let active = true;
    const bootstrapSession = async () => {
      try {
        const response = await fetch('/api/auth/me', { cache: 'no-store' });
        if (!response.ok) {
          throw new Error(await readApiErrorMessage(response, 'Nao foi possivel validar a sessao.'));
        }
        const me = await response.json();
        if (!active) return;

        const nextTenantId = me?.tenant?.id || null;
        setTenantId(nextTenantId);
        setRole(mapRoleToUi(me?.tenant?.role));

        if (typeof me?.name === 'string' && me.name.trim()) {
          setCurrentAnalystName(normalizeAnalystName(me.name, 'Analista'));
        }

        if (nextTenantId) {
          await loadRemoteOrders(nextTenantId);
        }
      } catch (error) {
        if (!active) return;
        setApiSyncError(error instanceof Error ? error.message : 'Falha ao iniciar sessao remota.');
      } finally {
        if (active) setInitialLoading(false);
      }
    };
    bootstrapSession();
    return () => {
      active = false;
    };
  }, [setCurrentAnalystName]);

  useEffect(() => {
    if (typeof currentAnalystName === 'string' && currentAnalystName.trim() && currentAnalystName.trim().toLowerCase() !== 'voce') return;
    setCurrentAnalystName('Analista');
  }, [currentAnalystName, setCurrentAnalystName]);

  useEffect(() => {
    const onPopState = (event) => {
      if (editingOrder) {
        setEditingOrder(null);
        event.stopImmediatePropagation?.();
        return;
      }
      if (editingOccurrence) {
        setEditingOccurrence(null);
        event.stopImmediatePropagation?.();
        return;
      }
      if (selectedOrder) {
        setSelectedOrderId(null);
        event.stopImmediatePropagation?.();
      }
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [selectedOrder, editingOrder, editingOccurrence, setSelectedOrderId]);

  const syncOrdersFromBackend = () => {
    if (!apiEnabled) {
      onToast('Tenant nao identificado para sincronizacao.');
      return;
    }
    loadRemoteOrders(tenantId);
    onToast('Dados sincronizados com o backend.');
  };

  const updateOrderStatus = async (id, status) => {
    if (!apiEnabled) {
      onToast('Tenant nao identificado para atualizar status.');
      return;
    }
    try {
      await transitionOrderRemote(id, status, `Status alterado para ${status}.`);
      await loadRemoteOrders(tenantId, { silent: true });
    } catch (error) {
      onToast(error instanceof Error ? error.message : 'Falha ao atualizar status da O.S.');
    }
  };

  const advanceOrderStatus = async (id) => {
    const order = orders.find((o) => o.id === id);
    if (!order || order.status === 'Fechada') return;
    await updateOrderStatus(id, nextStatus(order.status));
  };

  const bulkStatusUpdate = async (ids, status) => {
    if (!apiEnabled) {
      onToast('Tenant nao identificado para atualizar status.');
      return;
    }
    try {
      await Promise.all(ids.map((id) => transitionOrderRemote(id, status, `Status alterado em lote para ${status}.`)));
      await loadRemoteOrders(tenantId, { silent: true });
      onToast('Status em lote atualizado com sucesso.');
    } catch (error) {
      onToast(error instanceof Error ? error.message : 'Falha ao atualizar status em lote.');
    }
  };

  const bulkAssignTech = async (ids, techName) => {
    if (!apiEnabled) {
      onToast('Tenant nao identificado para atribuir analista.');
      return;
    }
    try {
      await Promise.all(
        ids.map((id) =>
          fetch(`/api/service-orders/${encodeURIComponent(id)}?tenantId=${encodeURIComponent(tenantId)}`, {
            method: 'PATCH',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ analystName: techName }),
          }).then(async (response) => {
            if (!response.ok) {
              throw new Error(await readApiErrorMessage(response, 'Falha ao atualizar analista responsavel.'));
            }
          })
        )
      );
      await loadRemoteOrders(tenantId, { silent: true });
      onToast('Analista responsavel atualizado em lote.');
    } catch (error) {
      onToast(error instanceof Error ? error.message : 'Falha ao atribuir analista em lote.');
    }
  };

  const openOccurrenceFromOrder = (order) => {
    setFocusProviderName(order.provider);
    setFocusOccurrenceId(order.occurrenceId || `OCC-LEGACY-${order.id}`);
    setCurrentView('providers');
    pushUiHistoryState({ layer: 'occurrence', occurrenceId: order.occurrenceId || `OCC-LEGACY-${order.id}` });
  };

  const saveOrderEdits = async (orderId, patch) => {
    const current = orders.find((o) => o.id === orderId);
    if (!apiEnabled || !current) {
      onToast('Tenant nao identificado para editar O.S.');
      return;
    }
    if (!canEditOrder(roleCode)) {
      onToast('Perfil sem permissao para editar O.S.');
      return;
    }

    try {
      const patchPayload = {
        type: patch.type ? toApiOrderType(patch.type) : undefined,
        priority: patch.priority ? toApiPriority(patch.priority) : undefined,
        description: patch.description,
        requester: patch.solicitant,
        sector: patch.sector,
        origin: patch.origin,
        analystName: patch.tech || patch.owner || currentAnalystName,
        ownerName: patch.owner || patch.tech || currentAnalystName,
        deadlineAt: patch.deadlineAt ? new Date(patch.deadlineAt).toISOString() : undefined,
      };

      const updateResponse = await fetch(`/api/service-orders/${encodeURIComponent(orderId)}?tenantId=${encodeURIComponent(tenantId)}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(patchPayload),
      });
      if (!updateResponse.ok) {
        throw new Error(await readApiErrorMessage(updateResponse, 'Falha ao salvar alteracoes da O.S.'));
      }

      await uploadOrderAttachments(orderId, patch.attachments);

      if (patch.status && patch.status !== current.status) {
        await transitionOrderRemote(orderId, patch.status, 'Atualizacao manual da O.S.');
      }

      await loadRemoteOrders(tenantId, { silent: true });
      onToast('O.S atualizada com sucesso.');
    } catch (error) {
      onToast(error instanceof Error ? error.message : 'Falha ao atualizar O.S.');
    }
  };

  const saveOccurrenceEdits = async (occurrenceId, patch) => {
    if (!apiEnabled) {
      onToast('Tenant nao identificado para editar ocorrencia.');
      return;
    }
    if (!canEditOccurrence(roleCode)) {
      onToast('Perfil sem permissao para editar ocorrencia.');
      return;
    }

    try {
      const response = await fetch(`/api/occurrences/${encodeURIComponent(occurrenceId)}?tenantId=${encodeURIComponent(tenantId)}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          type: patch.type,
          status: patch.status ? toApiOccurrenceStatus(patch.status) : undefined,
          sector: patch.sector,
          origin: patch.origin,
          analystResponsible: patch.responsible,
          description: patch.description,
        }),
      });
      if (!response.ok) {
        throw new Error(await readApiErrorMessage(response, 'Falha ao atualizar ocorrencia.'));
      }
      await loadRemoteOrders(tenantId, { silent: true });
      onToast('Ocorrencia atualizada com sucesso.');
    } catch (error) {
      onToast(error instanceof Error ? error.message : 'Falha ao atualizar ocorrencia.');
    }
  };

  const openOccurrenceWithOrder = async (providerName, occurrenceDraft, orderDraft) => {
    if (!apiEnabled) {
      onToast('Tenant nao identificado para abrir ocorrencia.');
      return;
    }
    if (!canCreateOccurrence(roleCode) || !canCreateOrder(roleCode)) {
      onToast('Perfil sem permissao para abrir ocorrencia/O.S.');
      return;
    }

    try {
      const occurrenceCreatedAt = new Date(`${occurrenceDraft.date}T${occurrenceDraft.time}`).toISOString();
      const response = await fetch('/api/occurrences', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          tenantId,
          provider: providerName,
          type: occurrenceDraft.type,
          status: toApiOccurrenceStatus(occurrenceDraft.status),
          sector: occurrenceDraft.sector,
          origin: occurrenceDraft.origin,
          openedByName: occurrenceDraft.openedBy || currentAnalystName || ANALYST_USERS[0],
          analystResponsible: occurrenceDraft.responsible || currentAnalystName || ANALYST_USERS[0],
          description: occurrenceDraft.description || `Ocorrencia registrada para ${providerName}.`,
          createdAt: occurrenceCreatedAt,
          firstOrder: {
            type: toApiOrderType(orderDraft.type),
            status: toApiOrderStatus(orderDraft.status),
            priority: toApiPriority(orderDraft.priority || 'Normal'),
            description: orderDraft.description,
            requester: orderDraft.solicitant || '',
            sector: orderDraft.sector || occurrenceDraft.sector,
            origin: orderDraft.origin || occurrenceDraft.origin,
            analystName: orderDraft.analyst || currentAnalystName || ANALYST_USERS[0],
            deadlineAt:
              orderDraft.deadlineDate && orderDraft.deadlineTime
                ? new Date(`${orderDraft.deadlineDate}T${orderDraft.deadlineTime}`).toISOString()
                : undefined,
          },
        }),
      });
      if (!response.ok) {
        throw new Error(await readApiErrorMessage(response, 'Falha ao abrir ocorrencia.'));
      }
      const created = await response.json();
      const firstOrderId = created?.serviceOrders?.[0]?.id || null;
      if (firstOrderId) {
        await uploadOrderAttachments(firstOrderId, orderDraft.attachments);
      }
      setFocusProviderName(providerName);
      setFocusOccurrenceId(created?.id || null);
      setCurrentView('providers');
      await loadRemoteOrders(tenantId, { silent: true });
      onToast(`Ocorrencia ${created?.number || ''} aberta com O.S inicial.`);
    } catch (error) {
      onToast(error instanceof Error ? error.message : 'Falha ao abrir ocorrencia.');
    }
  };

  const addInternalOrderToOccurrence = async (occurrence, internalOrder) => {
    if (!apiEnabled) {
      onToast('Tenant nao identificado para abrir O.S.');
      return;
    }
    if (!canCreateOrder(roleCode)) {
      onToast('Perfil sem permissao para abrir O.S.');
      return;
    }

    try {
      const response = await fetch(`/api/occurrences/${encodeURIComponent(occurrence.id)}/orders?tenantId=${encodeURIComponent(tenantId)}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          type: toApiOrderType(internalOrder.type),
          status: toApiOrderStatus(internalOrder.status || 'Aberta'),
          priority: toApiPriority(internalOrder.priority || 'Normal'),
          description: internalOrder.description || 'O.S aberta na ocorrencia.',
          requester: internalOrder.solicitant || '',
          sector: internalOrder.sector || occurrence.sector,
          origin: internalOrder.origin || occurrence.origin,
          analystName: internalOrder.analyst || internalOrder.responsible || currentAnalystName || ANALYST_USERS[0],
          deadlineAt:
            internalOrder.deadlineDate && internalOrder.deadlineTime
              ? new Date(`${internalOrder.deadlineDate}T${internalOrder.deadlineTime}`).toISOString()
              : undefined,
        }),
      });
      if (!response.ok) {
        throw new Error(await readApiErrorMessage(response, 'Falha ao abrir O.S interna.'));
      }
      const createdOrder = await response.json();
      if (createdOrder?.id) {
        await uploadOrderAttachments(createdOrder.id, internalOrder.attachments);
      }
      await loadRemoteOrders(tenantId, { silent: true });
      setFocusProviderName(occurrence.provider);
      setFocusOccurrenceId(occurrence.id);
      onToast(`O.S interna criada na ocorrencia ${occurrence.number}.`);
    } catch (error) {
      onToast(error instanceof Error ? error.message : 'Falha ao criar O.S interna.');
    }
  };

  const createStandaloneOrder = async (newOrder) => {
    if (!apiEnabled) {
      setOrders((prev) => [newOrder, ...prev]);
      setCurrentView('os_list');
      return;
    }

    await openOccurrenceWithOrder(
      newOrder.provider,
      {
        type: newOrder.occurrenceType || OCCURRENCE_TYPES[0],
        status: newOrder.occurrenceStatus || 'Aberta',
        sector: newOrder.occurrenceSector || 'NOC',
        origin: newOrder.occurrenceOrigin || 'Suporte Online',
        openedBy: newOrder.occurrenceOpenedBy || currentAnalystName || ANALYST_USERS[0],
        responsible: newOrder.occurrenceResponsible || currentAnalystName || ANALYST_USERS[0],
        description: newOrder.occurrenceDescription || newOrder.description || '',
        date: toDateInputValue(newOrder.occurrenceCreatedAt || Date.now()),
        time: toTimeInputValue(newOrder.occurrenceCreatedAt || Date.now()),
      },
      {
        type: newOrder.type || SERVICE_TYPES[0],
        status: newOrder.status || 'Aberta',
        priority: newOrder.priority || 'Normal',
        description: newOrder.description || '',
        solicitant: newOrder.solicitant || '',
        sector: newOrder.sector || newOrder.occurrenceSector || 'NOC',
        origin: newOrder.origin || newOrder.occurrenceOrigin || 'Suporte Online',
        analyst: newOrder.tech || newOrder.owner || currentAnalystName || ANALYST_USERS[0],
        deadlineDate: toDateInputValue(newOrder.deadlineAt || Date.now() + 24 * HOUR_MS),
        deadlineTime: toTimeInputValue(newOrder.deadlineAt || Date.now() + 24 * HOUR_MS),
        attachments: newOrder.attachments || [],
      }
    );
  };

  const renderView = () => {
    if (currentView === 'dashboard') {
      return (
        <DashboardView
          orders={orders}
          onSelectOrder={openOrderDetails}
          onGoToProviders={() => setCurrentView('providers')}
          onGoToKnowledge={() => setCurrentView('ajustpedia')}
          loading={initialLoading}
          currentAnalystName={currentAnalystName}
        />
      );
    }

    if (currentView === 'os_list') {
      return (
        <OSListView
          orders={orders}
          onSelectOrder={openOrderDetails}
          onAdvanceStatus={advanceOrderStatus}
          onBulkStatusUpdate={bulkStatusUpdate}
          onBulkAssignTech={bulkAssignTech}
          onToast={onToast}
        />
      );
    }

    if (currentView === 'occurrences') {
      return (
        <OccurrencesView
          orders={orders}
          onSelectOrder={openOrderDetails}
          onCreateInternalOrder={addInternalOrderToOccurrence}
          focusOccurrenceId={focusOccurrenceId}
        />
      );
    }

    if (currentView === 'os_create') {
      return (
        <OSListView
          orders={orders}
          onSelectOrder={openOrderDetails}
          onAdvanceStatus={advanceOrderStatus}
          onBulkStatusUpdate={bulkStatusUpdate}
          onBulkAssignTech={bulkAssignTech}
          onToast={onToast}
        />
      );
    }

    if (currentView === 'providers') {
      return (
        <ProvidersView
          resetToken={menuResetToken}
          orders={orders}
          onSelectOrder={openOrderDetails}
          onEditOrder={openOrderEditor}
          onEditOccurrence={openOccurrenceEditor}
          onOpenOccurrenceWithOrder={openOccurrenceWithOrder}
          onCreateOrderInOccurrence={addInternalOrderToOccurrence}
          onAddOccurrenceAnnotation={addOccurrenceAnnotation}
          currentAnalystName={currentAnalystName}
          focusProvider={focusProviderName}
          focusOccurrenceId={focusOccurrenceId}
          onProviderFocusChange={setFocusProviderName}
          onOccurrenceFocusChange={setFocusOccurrenceId}
        />
      );
    }

    if (currentView === 'providers_lab') {
      return (
        <ProvidersLabView
          orders={orders}
          onSelectOrder={openOrderDetails}
          onOpenProvider={(providerName) => {
            setFocusProviderName(providerName);
            setFocusOccurrenceId(null);
            setCurrentView('providers');
          }}
        />
      );
    }

    if (currentView === 'ajustpedia') {
      return <KnowledgeBaseView onToast={onToast} section="ajustpedia" />;
    }

    if (currentView === 'credentials') {
      return <KnowledgeBaseView onToast={onToast} section="credentials" />;
    }

    if (currentView === 'knowledge') {
      return <KnowledgeBaseView onToast={onToast} section="ajustpedia" />;
    }

    if (currentView === 'notes') {
      return <AnalystNotesView dark={dark} onToast={onToast} />;
    }

    if (currentView === 'calendar') {
      return <CalendarView orders={orders} onSelectOrder={openOrderDetails} />;
    }

    if (currentView === 'settings') {
      return <SettingsView onToast={onToast} onProfileNameChange={setCurrentAnalystName} />;
    }

    return (
      <DashboardView
        orders={orders}
        onSelectOrder={openOrderDetails}
        onGoToProviders={() => setCurrentView('providers')}
        onGoToKnowledge={() => setCurrentView('ajustpedia')}
        currentAnalystName={currentAnalystName}
      />
    );
  };

  {/* Legacy sidebar/header removed in favor of SharedPortalShell auto-layout */ }

  const overlays = (
    <>
      <CommandPalette
        open={commandOpen}
        onClose={() => setCommandOpen(false)}
        views={NAV_ITEMS.map((n) => ({ id: n.id, label: n.label }))}
        orders={orders}
        onNavigate={navigateFromMenu}
        onOpenOrder={openOrderDetails}
      />

      {selectedOrder && (
        <OSDetailsDrawer
          order={selectedOrder}
          onClose={() => setSelectedOrderId(null)}
          onEditOrder={openOrderEditor}
          onAddOrderAnnotation={addOrderAnnotation}
          onOpenOccurrence={(order) => {
            setSelectedOrderId(null);
            openOccurrenceFromOrder(order);
          }}
        />
      )}

      {editingOrder && (
        <EditOrderModal
          order={editingOrder}
          onClose={() => setEditingOrder(null)}
          onSave={saveOrderEdits}
        />
      )}

      {editingOccurrence && (
        <EditOccurrenceModal
          occurrence={editingOccurrence}
          onClose={() => setEditingOccurrence(null)}
          onSave={saveOccurrenceEdits}
        />
      )}

      <ErpToast message={toastMessage} dark={dark} />
    </>
  );

  if (!mounted) {
    return <div className="h-screen bg-[#0e1a33]" />;
  }

  const shellRootClassName = undefined;

  return (
    <ThemeCtx.Provider value={{ dark, toggle: toggleTheme }}>
      <SharedPortalShell
        tenantName={tenantId ? (PROVIDERS.find(p => p === tenantId) || tenantId) : 'Ajust ERP'}
        userName={currentAnalystName}
        userRole={'analyst'}
        onLogout={handleLogout}
        sidebarItems={NAV_ITEMS.map((item) => ({
          key: item.id,
          label: item.label,
          icon: item.icon,
          onClick: () => navigateFromMenu(item.id),
          active: currentView === item.id
        }))}
        dark={dark}
        themeToggle={toggleTheme}
        rootClassName={shellRootClassName}
        overlays={overlays}
        contentClassName="max-w-[1500px] mx-auto"
        contentWrapperClassName="flex-1 flex flex-col overflow-hidden relative"
      >
        {apiSyncing && (
          <div className={cn("mb-4 rounded-lg border px-3 py-2 text-xs", dark ? "bg-blue-900/20 border-blue-500/30 text-blue-400" : "bg-white border-slate-200 text-slate-500")}>
            Sincronizando dados operacionais com o backend...
          </div>
        )}
        {!apiSyncing && apiSyncError && (
          <div className={cn("mb-4 rounded-lg border px-3 py-2 text-xs", dark ? "bg-amber-900/20 border-amber-500/30 text-amber-400" : "bg-amber-50 border-amber-200 text-amber-700")}>
            {apiSyncError}
          </div>
        )}
        {renderView()}
      </SharedPortalShell>
    </ThemeCtx.Provider>
  );
}
