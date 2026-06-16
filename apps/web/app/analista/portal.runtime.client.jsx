'use client';
import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from 'react/jsx-runtime';
import React, { useEffect, useMemo, useState } from 'react';
import { useErpWebSocket } from '../shared/ws-client';
import {
  BookOpen,
  Bot,
  Briefcase,
  Calendar,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Clock,
  Copy,
  Eye,
  EyeOff,
  LayoutDashboard,
  Loader2,
  Plus,
  Save,
  Search,
  Settings,
  Sparkles,
  StickyNote,
  Terminal,
  TrendingUp,
  User,
  X,
} from 'lucide-react';
import { SharedPortalShell } from '../shared/shared-portal-shell';
import { ErpBadge, ErpToast } from '../shared/shared-ui';
import { AnalystKnowledgeAjustpediaPanel } from './analista-knowledge-ajustpedia-panel';
import { AnalystKnowledgeAjustpediaModal } from './analista-knowledge-ajustpedia-modal';
import { AnalystCommandPalette } from './analyst-command-palette';
import { AnalystKnowledgeCredentialsPanel } from './analista-knowledge-credentials-panel';
import { AnalystKnowledgeCredentialsLabPanel } from './analista-knowledge-credentials-lab-panel';
import { AnalystCredentialsNeoView } from './analista-credentials-neo-view';
import { AnalystNotesView } from './analista-notes-view';
import { PriorityBadge, StatusBadge } from '../shared/ui/badge';
import {
  canAnnotateOccurrence,
  canCreateOccurrence,
  canCreateOrder,
  canEditOccurrence,
  canEditOrder,
  canUploadAttachment,
} from '../shared/rbac';
const cn = (...classes) => classes.filter(Boolean).join(' ');
// Theme Context
const ThemeCtx = React.createContext({ dark: false, toggle: () => {} });
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
const PROVIDERS = ['Meganet', 'UltraFibra', 'MaximaNet'];
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
  { group: 'RECURSOS', id: 'credentials_neo', label: 'Cofre Neo', icon: Sparkles },
  { group: 'RECURSOS', id: 'ajustpedia', label: 'Ajustpedia', icon: Terminal },
  { group: 'RECURSOS', id: 'notes', label: 'Minhas Notas', icon: StickyNote },
  { group: 'RECURSOS', id: 'calendar', label: 'Calendario', icon: Calendar },
  { group: 'RECURSOS', id: 'settings', label: 'Configuracoes', icon: Settings },
];
const ANALYST_FUNCTIONS = [
  { id: 'visao', label: 'Visao' },
  { id: 'especializadas', label: 'Especializadas' },
  { id: 'administracao', label: 'Administracao' },
];
const ANALYST_FUNCTION_VIEWS = {
  visao: ['dashboard', 'os_list', 'providers', 'calendar'],
  especializadas: ['credentials_neo', 'ajustpedia', 'notes', 'topology'],
  administracao: ['os_list', 'providers', 'credentials_neo', 'ajustpedia', 'settings', 'topology'],
};
const VIEW_TITLE = {
  dashboard: 'Meu Painel',
  os_list: 'Ordens de Serviço',
  occurrences: 'Ocorrências',
  providers: 'Provedores',
  credentials_neo: 'Cofre Neo',
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
const createOccurrenceNumber = () =>
  `${new Date().getFullYear()}${String(Date.now()).slice(-8)}${pad(Math.floor(Math.random() * 100))}`;
const createOrderProtocol = () =>
  `${new Date().getFullYear()}${String(Date.now()).slice(-8)}${Math.floor(Math.random() * 10)}`;
const MAX_ATTACHMENT_SIZE_BYTES = 10 * 1024 * 1024;
const MAX_ATTACHMENTS_PER_ORDER = 10;
const ATTACHMENTS_ACCEPT =
  'image/*,video/*,audio/*,text/*,application/pdf,application/zip,.pdf,.zip,.txt,.csv';
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
const toApiOccurrenceStatus = (value) =>
  OCCURRENCE_STATUS_UI_TO_API[value] || OCCURRENCE_STATUS_UI_TO_API.Aberta;
const toUiOccurrenceStatus = (value) => OCCURRENCE_STATUS_API_TO_UI[value] || 'Aberta';
const toApiOrderType = (value) =>
  ORDER_TYPE_NORMALIZED_TO_API[normalizeEnumKey(value)] || 'AUDITORIA';
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
  const source =
    `${credential?.environment || ''} ${credential?.host || ''} ${credential?.username || ''} ${credential?.notes || ''}`
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
    owner: normalizeAnalystName(
      apiOrder.ownerName || apiOrder.owner?.name || apiOrder.analystName || '',
      'Analista',
    ),
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
    isCustomerVisible: apiOrder.isCustomerVisible !== false,
    occurrenceId: occurrence?.id || apiOrder.occurrenceId || `OCC-LEGACY-${apiOrder.id}`,
    occurrenceNumber: occurrence?.number || apiOrder.occurrenceNumber || createOccurrenceNumber(),
    occurrenceSector: occurrence?.sector || apiOrder.occurrenceSector || apiOrder.sector || 'NOC',
    occurrenceOrigin:
      occurrence?.origin || apiOrder.occurrenceOrigin || apiOrder.origin || 'Suporte Online',
    occurrenceType: occurrence?.type || apiOrder.occurrenceType || apiOrder.type,
    occurrenceStatus: toUiOccurrenceStatus(
      occurrence?.status || apiOrder.occurrenceStatus || 'ABERTA',
    ),
    occurrenceOpenedBy: occurrence?.openedByName || apiOrder.occurrenceOpenedBy || 'Analista',
    occurrenceResponsible: normalizeAnalystName(
      occurrence?.analystResponsible || apiOrder.occurrenceResponsible || apiOrder.analystName,
      'Analista',
    ),
    occurrenceCreatedAt,
    occurrenceDescription:
      occurrence?.description || apiOrder.occurrenceDescription || apiOrder.description || '',
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
    const closed = orders.filter(
      (o) => o.closedAt && o.closedAt >= dayStart && o.closedAt <= dayEnd,
    ).length;
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
    if (isActive(o) && o.deadlineAt >= startOfDay(now) && o.deadlineAt <= endOfDay(now))
      item.dueToday += 1;
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

const Badge = ErpBadge;
/* ---- Skeleton Loaders ---- */
const SkeletonKpiCards = ({ count = 5 }) => {
  const { dark } = useTheme();
  return _jsx('div', {
    className: cn('grid gap-4', `grid-cols-1 sm:grid-cols-2 xl:grid-cols-${count}`),
    children: Array.from({ length: count }).map((_, i) =>
      _jsxs(
        'div',
        {
          className: cn(
            'border rounded-xl p-4 shadow-sm animate-pulse',
            dark
              ? 'bg-[#1e293b]/60 backdrop-blur-md border-slate-700/50'
              : 'bg-white border-slate-200',
          ),
          children: [
            _jsx('div', {
              className: cn('h-3 w-14 rounded mb-3', dark ? 'bg-white/10' : 'bg-slate-100'),
            }),
            _jsx('div', {
              className: cn('h-8 w-10 rounded', dark ? 'bg-white/10' : 'bg-slate-100'),
            }),
          ],
        },
        i,
      ),
    ),
  });
};
const SkeletonTable = ({ rows = 6 }) => {
  const { dark } = useTheme();
  return _jsxs('div', {
    className: cn(
      'border rounded-xl shadow-sm overflow-hidden',
      dark ? 'bg-[#1e293b]/60 backdrop-blur-md border-slate-700/50' : 'bg-white border-slate-200',
    ),
    children: [
      _jsx('div', {
        className: cn('px-5 py-3 border-b', dark ? 'border-slate-700/50' : 'border-slate-100'),
        children: _jsx('div', {
          className: cn('h-5 w-40 rounded animate-pulse', dark ? 'bg-white/10' : 'bg-slate-100'),
        }),
      }),
      _jsx('div', {
        className: 'p-2',
        children: Array.from({ length: rows }).map((_, i) =>
          _jsx(
            'div',
            {
              className: cn(
                'h-12 rounded-lg mb-1 animate-pulse',
                dark ? 'bg-white/5' : 'bg-slate-50',
              ),
            },
            i,
          ),
        ),
      }),
    ],
  });
};
const ServiceTypeBadge = ({ type }) => {
  const { dark } = useTheme();
  let color = 'slate';
  const t = type?.toLowerCase() || '';
  if (t.includes('rompimento') || t.includes('ataque')) color = 'red';
  else if (t.includes('lentidao') || t.includes('bgp')) color = 'orange';
  else if (t.includes('instalacao') || t.includes('ativacao')) color = 'green';
  else if (t.includes('configuracao') || t.includes('troca')) color = 'blue';
  return _jsx(ErpBadge, { color: color, dark: dark, children: type });
};
const PeriodTabs = ({ value, onChange }) => {
  const { dark } = useTheme();
  return _jsx('div', {
    className: cn(
      'flex items-center border rounded-lg p-1 gap-1 overflow-x-auto no-scrollbar',
      dark ? 'bg-[#1e293b]/60 backdrop-blur-md border-slate-700/50' : 'bg-white border-slate-200',
    ),
    children: PERIODS.map((p) =>
      _jsx(
        'button',
        {
          onClick: () => onChange(p),
          className: cn(
            'px-3 py-1.5 text-xs rounded font-semibold whitespace-nowrap transition-colors',
            value === p
              ? dark
                ? 'bg-blue-600/20 text-blue-400 font-bold'
                : 'bg-slate-800 text-white'
              : dark
                ? 'text-slate-500 hover:bg-white/5 hover:text-slate-300'
                : 'text-slate-500 hover:bg-slate-100',
          ),
          children: p,
        },
        p,
      ),
    ),
  });
};
/* ═══════════════════════════════ MODALS ═══════════════════════════════ */
const Modal = ({ title, onClose, onBack, neonNav = false, children, maxWidth = 'max-w-4xl' }) => {
  const { dark } = useTheme();
  const [entered, setEntered] = useState(false);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(raf);
  }, []);
  const neonButtonClass = cn(
    'p-1.5 rounded border transition-all duration-200',
    dark
      ? 'border-cyan-400/60 bg-cyan-500/15 text-cyan-200 shadow-[0_0_14px_rgba(34,211,238,0.35)] hover:bg-cyan-500/25'
      : 'border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100',
  );
  return _jsxs('div', {
    className:
      'fixed inset-0 z-[90] flex items-start sm:items-center justify-center p-4 overflow-y-auto',
    children: [
      _jsx('div', { className: 'absolute inset-0 bg-black/60 backdrop-blur-sm', onClick: onClose }),
      _jsxs('div', {
        className: cn(
          'relative my-6 sm:my-0 w-full max-h-[92vh] rounded-xl border shadow-2xl overflow-hidden flex flex-col transition-all duration-200',
          entered ? 'translate-x-0 opacity-100' : 'translate-x-6 opacity-0',
          maxWidth,
          dark ? 'bg-[#11151c] border-slate-700/50' : 'bg-white border-slate-200',
        ),
        children: [
          _jsxs('div', {
            className: cn(
              'px-5 py-3 border-b flex items-center justify-between',
              dark ? 'border-slate-700/50' : 'border-slate-100',
            ),
            children: [
              _jsxs('div', {
                className: 'flex items-center gap-2',
                children: [
                  onBack &&
                    _jsx('button', {
                      onClick: onBack,
                      className: neonNav
                        ? neonButtonClass
                        : cn(
                            'p-1.5 rounded transition-colors',
                            dark
                              ? 'hover:bg-white/10 text-slate-400'
                              : 'hover:bg-slate-100 text-slate-500',
                          ),
                      children: _jsx(ChevronLeft, { size: 18 }),
                    }),
                  _jsx('h3', {
                    className: cn('font-bold', dark ? 'text-white' : 'text-slate-800'),
                    children: title,
                  }),
                ],
              }),
              _jsx('button', {
                onClick: onClose,
                className: neonNav
                  ? neonButtonClass
                  : cn(
                      'p-1.5 rounded transition-colors',
                      dark
                        ? 'hover:bg-white/10 text-slate-400'
                        : 'hover:bg-slate-100 text-slate-500',
                    ),
                children: _jsx(X, { size: 18 }),
              }),
            ],
          }),
          _jsx('div', { className: 'p-5 overflow-y-auto custom-scrollbar', children: children }),
        ],
      }),
    ],
  });
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
  return _jsxs('div', {
    className: 'fixed inset-0 z-[85] flex items-start justify-center p-4 md:p-12',
    children: [
      _jsx('div', { className: 'absolute inset-0 bg-slate-900/40', onClick: onClose }),
      _jsxs('div', {
        className:
          'relative hidden w-full max-w-2xl bg-white border border-slate-200 rounded-xl shadow-2xl overflow-hidden',
        children: [
          _jsx('div', {
            className: 'p-3 border-b border-slate-100',
            children: _jsx('input', {
              autoFocus: true,
              value: query,
              onChange: (e) => setQuery(e.target.value),
              placeholder: 'Buscar tela ou protocolo...',
              className: 'w-full px-3 py-2 border border-slate-300 rounded-lg text-sm',
            }),
          }),
          _jsxs('div', {
            className: 'max-h-[60vh] overflow-y-auto custom-scrollbar',
            children: [
              _jsx('div', {
                className: 'px-3 pt-3 text-[11px] uppercase text-slate-400 font-bold',
                children: 'Telas',
              }),
              _jsxs('div', {
                className: 'p-2 space-y-1',
                children: [
                  filteredViews.map((v) =>
                    _jsx(
                      'button',
                      {
                        onClick: () => {
                          onNavigate(v.id);
                          onClose();
                        },
                        className: 'w-full text-left px-3 py-2 rounded hover:bg-slate-100 text-sm',
                        children: v.label,
                      },
                      v.id,
                    ),
                  ),
                  filteredViews.length === 0 &&
                    _jsx('div', {
                      className: 'px-3 py-2 text-sm text-slate-400',
                      children: 'Nenhuma tela encontrada.',
                    }),
                ],
              }),
              _jsx('div', {
                className: 'px-3 pt-2 text-[11px] uppercase text-slate-400 font-bold',
                children: 'Ordens',
              }),
              _jsxs('div', {
                className: 'p-2 space-y-1',
                children: [
                  filteredOrders.map((o) =>
                    _jsxs(
                      'button',
                      {
                        onClick: () => {
                          onOpenOrder(o);
                          onClose();
                        },
                        className:
                          'w-full text-left px-3 py-2 rounded hover:bg-slate-100 text-sm flex justify-between',
                        children: [
                          _jsx('span', { className: 'font-mono', children: o.protocol }),
                          _jsx('span', { className: 'text-slate-500', children: o.provider }),
                        ],
                      },
                      o.id,
                    ),
                  ),
                  filteredOrders.length === 0 &&
                    _jsx('div', {
                      className: 'px-3 py-2 text-sm text-slate-400',
                      children: 'Digite para buscar OS.',
                    }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  });
};
const OSDetailsDrawer = ({
  order,
  onClose,
  onOpenOccurrence,
  onEditOrder,
  onAddOrderAnnotation,
}) => {
  const SMART_RESPONSES = [
    'Sinal óptico normalizado após reinício da ONU.',
    'Repasse efetuado para equipe de campo.',
    'Cliente confirmou navegação restabelecida.',
    'Aguardando liberação de acesso pelo cliente.',
  ];

  const { dark } = useTheme();
  // ── AI Copilot state ──────────────────────────────────────────
  const [copilotSuggestion, setCopilotSuggestion] = useState('');
  const [copilotLoading, setCopilotLoading] = useState(false);
  const runCopilot = async () => {
    if (!order) return;
    setCopilotLoading(true);
    // Simulate pattern-based analysis using order data (real integration would call OpenAI/Gemini)
    await new Promise((r) => setTimeout(r, 1200));
    const typeMap = {
      Rompimento:
        'Verificar logs de fibra e sinal PON na OLT. Checar histórico de alertas de rompimento neste provedor nos últimos 30 dias.',
      Lentidao:
        'Verificar uso de banda no link de trânsito e QoS. Possível saturação de rota BGP ou ataque de tráfego.',
      BGP: 'Verificar tabela de rotas, sessões eBGP ativas e prefixos anunciados. Checar logs do router core.',
      'ATAQUE DDOS':
        'Ativar mitigação via Blackhole/FlowSpec. Checar scrubbing center se disponível. Notificar upstream.',
      'Configuracao ONU':
        'Verificar provisioning na OLT, sinal óptico e MAC da ONU. Provisionamento correto no sistema.',
    };
    const type = (order.type || '').toLowerCase();
    let suggestion =
      'Com base no histórico de chamados similares, a resolução típica envolve reinicialização do serviço e validação do sinal com o cliente (tempo médio: 45min).';
    for (const [key, val] of Object.entries(typeMap)) {
      if (type.includes(key.toLowerCase())) {
        suggestion = val;
        break;
      }
    }
    if (order.priority === 'Critica' || order.priority === 'CRITICA') {
      suggestion =
        '⚠️ PRIORIDADE CRÍTICA DETECTADA. ' +
        suggestion +
        ' Acionar Gerência imediatamente e escalar para N3.';
    }
    setCopilotSuggestion(suggestion);
    setCopilotLoading(false);
  };
  const [annotationText, setAnnotationText] = useState('');
  const [annotationHideFromClient, setAnnotationHideFromClient] = useState(false);
  const [annotationSaving, setAnnotationSaving] = useState(false);
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);
  useEffect(() => {
    setAnnotationText('');
    setAnnotationHideFromClient(false);
    setAnnotationSaving(false);
  }, [order?.id]);
  if (!order) return null;
  const submitOrderAnnotation = async () => {
    const message = annotationText.trim();
    if (message.length < 2 || !onAddOrderAnnotation || annotationSaving) return;
    setAnnotationSaving(true);
    try {
      const ok = await onAddOrderAnnotation(order, message, annotationHideFromClient);
      if (ok) {
        setAnnotationText('');
        setAnnotationHideFromClient(false);
      }
    } finally {
      setAnnotationSaving(false);
    }
  };
  const attachments = normalizeAttachments(order.attachments);
  const history = Array.isArray(order.occurrences) ? order.occurrences : [];
  const sectionCardClass = cn(
    'border rounded-lg p-3',
    dark ? 'bg-[#0f172a]/80 backdrop-blur-xl border-slate-700/50' : 'bg-slate-50 border-slate-200',
  );
  const labelClass = cn(
    'text-[11px] uppercase font-bold',
    dark ? 'text-slate-500' : 'text-slate-500',
  );
  const valueClass = cn('text-sm', dark ? 'text-slate-200' : 'text-slate-800');
  return _jsxs('div', {
    className:
      'fixed inset-0 z-[80] flex items-start sm:items-center justify-center p-2 sm:p-4 overflow-y-auto',
    children: [
      _jsx('div', {
        className: 'absolute inset-0 bg-slate-900/35 backdrop-blur-sm',
        onClick: onClose,
      }),
      _jsxs('div', {
        className: cn(
          'relative w-full max-w-[1280px] h-[96vh] sm:h-[92vh] border rounded-xl shadow-2xl flex flex-col transition-colors duration-200',
          dark
            ? 'bg-[#1e293b]/60 backdrop-blur-md border-slate-700/50'
            : 'bg-white border-slate-200',
        ),
        children: [
          _jsxs('div', {
            className: cn(
              'h-16 border-b px-5 flex items-center justify-between',
              dark
                ? 'bg-[#0f172a]/80 backdrop-blur-xl border-slate-700/50'
                : 'bg-slate-50/60 border-slate-100',
            ),
            children: [
              _jsxs('div', {
                children: [
                  _jsx('div', {
                    className: cn(
                      'text-[11px] uppercase font-bold',
                      dark ? 'text-slate-500' : 'text-slate-400',
                    ),
                    children: 'Detalhes da OS',
                  }),
                  _jsx('div', {
                    className: cn(
                      'font-mono font-bold',
                      dark ? 'text-slate-200' : 'text-slate-800',
                    ),
                    children: order.protocol,
                  }),
                ],
              }),
              _jsx('button', {
                onClick: onClose,
                className: cn(
                  'p-2 rounded-full transition-colors',
                  dark ? 'hover:bg-white/10 text-slate-400' : 'hover:bg-slate-200 text-slate-600',
                ),
                children: _jsx(X, { size: 18 }),
              }),
            ],
          }),
          _jsxs('div', {
            className: 'flex-1 p-5 overflow-y-auto custom-scrollbar space-y-4',
            children: [
              _jsxs('div', {
                className: 'flex items-center gap-2',
                children: [
                  _jsx(StatusBadge, { status: order.status }),
                  _jsx(PriorityBadge, { priority: order.priority }),
                  order.isInconsistent &&
                    _jsx(Badge, { color: 'orange', children: 'Inconsistente' }),
                ],
              }),
              _jsxs('div', {
                className: sectionCardClass,
                children: [
                  _jsx('div', {
                    className: cn(
                      'text-[11px] uppercase font-bold mb-2',
                      dark ? 'text-slate-400' : 'text-slate-500',
                    ),
                    children: 'Resumo rapido',
                  }),
                  _jsxs('div', {
                    className: 'grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2',
                    children: [
                      _jsxs('div', {
                        className: 'flex items-center gap-2',
                        children: [
                          _jsx('span', { className: labelClass, children: 'Provedor:' }),
                          _jsx('span', { className: valueClass, children: order.provider || '-' }),
                        ],
                      }),
                      _jsxs('div', {
                        className: 'flex items-center gap-2',
                        children: [
                          _jsx('span', { className: labelClass, children: 'Tecnico:' }),
                          _jsx('span', { className: valueClass, children: order.tech || '-' }),
                        ],
                      }),
                      _jsxs('div', {
                        className: 'flex items-center gap-2',
                        children: [
                          _jsx('span', { className: labelClass, children: 'Gestor:' }),
                          _jsx('span', { className: valueClass, children: order.owner || '-' }),
                        ],
                      }),
                      _jsxs('div', {
                        className: 'flex items-center gap-2',
                        children: [
                          _jsx('span', { className: labelClass, children: 'Tipo:' }),
                          _jsx(ServiceTypeBadge, { type: order.type }),
                        ],
                      }),
                    ],
                  }),
                ],
              }),
              _jsxs('div', {
                className: sectionCardClass,
                children: [
                  _jsx('div', {
                    className: cn(
                      'text-[11px] uppercase font-bold',
                      dark ? 'text-slate-500' : 'text-slate-500',
                    ),
                    children: 'Descricao',
                  }),
                  _jsx('p', {
                    className: cn(
                      'text-sm mt-1 whitespace-pre-wrap break-words',
                      dark ? 'text-slate-300' : 'text-slate-700',
                    ),
                    children: order.description,
                  }),
                ],
              }),
              _jsxs('div', {
                className: cn(
                  'border rounded-lg p-3',
                  dark ? 'bg-blue-900/10 border-blue-500/20' : 'bg-blue-50 border-blue-100',
                ),
                children: [
                  _jsx('div', {
                    className: cn(
                      'text-[11px] uppercase font-bold mb-2',
                      dark ? 'text-blue-400' : 'text-blue-600',
                    ),
                    children: 'Identificacao da ocorrencia',
                  }),
                  _jsxs('div', {
                    className: 'grid grid-cols-1 md:grid-cols-2 gap-2 text-xs',
                    children: [
                      _jsxs('div', {
                        children: [
                          _jsx('span', {
                            className: dark ? 'text-slate-500' : 'text-slate-500',
                            children: 'Numero:',
                          }),
                          ' ',
                          _jsx('span', {
                            className: cn(
                              'font-semibold',
                              dark ? 'text-slate-300' : 'text-slate-800',
                            ),
                            children: order.occurrenceNumber || '-',
                          }),
                        ],
                      }),
                      _jsxs('div', {
                        children: [
                          _jsx('span', {
                            className: dark ? 'text-slate-500' : 'text-slate-500',
                            children: 'Status:',
                          }),
                          ' ',
                          _jsx('span', {
                            className: cn(
                              'font-semibold',
                              dark ? 'text-slate-300' : 'text-slate-800',
                            ),
                            children: order.occurrenceStatus || '-',
                          }),
                        ],
                      }),
                      _jsxs('div', {
                        children: [
                          _jsx('span', {
                            className: dark ? 'text-slate-500' : 'text-slate-500',
                            children: 'Tipo de Ocorrencia:',
                          }),
                          ' ',
                          _jsx('span', {
                            className: cn(
                              'font-semibold',
                              dark ? 'text-slate-300' : 'text-slate-800',
                            ),
                            children: order.occurrenceType || '-',
                          }),
                        ],
                      }),
                      _jsxs('div', {
                        children: [
                          _jsx('span', {
                            className: dark ? 'text-slate-500' : 'text-slate-500',
                            children: 'Origem:',
                          }),
                          ' ',
                          _jsx('span', {
                            className: cn(
                              'font-semibold',
                              dark ? 'text-slate-300' : 'text-slate-800',
                            ),
                            children: order.occurrenceOrigin || '-',
                          }),
                        ],
                      }),
                      _jsxs('div', {
                        children: [
                          _jsx('span', {
                            className: dark ? 'text-slate-500' : 'text-slate-500',
                            children: 'Setor:',
                          }),
                          ' ',
                          _jsx('span', {
                            className: cn(
                              'font-semibold',
                              dark ? 'text-slate-300' : 'text-slate-800',
                            ),
                            children: order.occurrenceSector || '-',
                          }),
                        ],
                      }),
                      _jsxs('div', {
                        children: [
                          _jsx('span', {
                            className: dark ? 'text-slate-500' : 'text-slate-500',
                            children: 'Analista responsavel:',
                          }),
                          ' ',
                          _jsx('span', {
                            className: cn(
                              'font-semibold',
                              dark ? 'text-slate-300' : 'text-slate-800',
                            ),
                            children: order.occurrenceResponsible || '-',
                          }),
                        ],
                      }),
                      _jsxs('div', {
                        children: [
                          _jsx('span', {
                            className: dark ? 'text-slate-500' : 'text-slate-500',
                            children: 'Data de Criacao:',
                          }),
                          ' ',
                          _jsx('span', {
                            className: cn(
                              'font-semibold',
                              dark ? 'text-slate-300' : 'text-slate-800',
                            ),
                            children: order.occurrenceCreatedAt
                              ? formatDateTime(order.occurrenceCreatedAt)
                              : '-',
                          }),
                        ],
                      }),
                    ],
                  }),
                ],
              }),
              _jsxs('div', {
                className: 'grid grid-cols-1 md:grid-cols-3 gap-3',
                children: [
                  _jsxs('div', {
                    className: sectionCardClass,
                    children: [
                      _jsx('div', { className: labelClass, children: 'Abertura' }),
                      _jsx('div', {
                        className: cn(
                          'text-xs font-mono mt-1',
                          dark ? 'text-slate-300' : 'text-slate-700',
                        ),
                        children: formatDateTime(order.createdAt),
                      }),
                    ],
                  }),
                  _jsxs('div', {
                    className: sectionCardClass,
                    children: [
                      _jsx('div', { className: labelClass, children: 'Prazo' }),
                      _jsx('div', {
                        className: cn(
                          'text-xs font-mono mt-1',
                          dark ? 'text-slate-300' : 'text-slate-700',
                        ),
                        children: formatDateTime(order.deadlineAt),
                      }),
                    ],
                  }),
                  _jsxs('div', {
                    className: sectionCardClass,
                    children: [
                      _jsx('div', { className: labelClass, children: 'Delay' }),
                      _jsx('div', {
                        className: cn(
                          'text-sm font-bold mt-1',
                          getDelayHours(order) > 0 ? 'text-rose-600' : 'text-emerald-600',
                        ),
                        children:
                          getDelayHours(order) > 0
                            ? `+${getDelayHours(order).toFixed(2)}h`
                            : 'Sem atraso',
                      }),
                    ],
                  }),
                ],
              }),
              _jsxs('div', {
                className: sectionCardClass,
                children: [
                  _jsx('div', {
                    className: cn(
                      'text-[11px] uppercase font-bold mb-2',
                      dark ? 'text-slate-500' : 'text-slate-400',
                    ),
                    children: 'Anexos',
                  }),
                  _jsxs('div', {
                    className: 'space-y-2',
                    children: [
                      attachments.map((a) =>
                        _jsxs(
                          'div',
                          {
                            className: cn(
                              'p-2 rounded border text-sm',
                              dark
                                ? 'bg-[#1e293b]/50 border-slate-700/50 text-slate-300'
                                : 'bg-white border-slate-200 text-slate-700',
                            ),
                            children: [
                              _jsx('div', { className: 'font-medium', children: a.name }),
                              _jsxs('div', {
                                className: 'text-[11px] text-slate-500',
                                children: [a.mime || 'arquivo', ' \u2022 ', formatFileSize(a.size)],
                              }),
                            ],
                          },
                          a.id,
                        ),
                      ),
                      attachments.length === 0 &&
                        _jsx('div', {
                          className: 'text-xs text-slate-400',
                          children: 'Sem anexos.',
                        }),
                    ],
                  }),
                ],
              }),
              _jsxs('div', {
                className: sectionCardClass,
                children: [
                  _jsx('div', {
                    className: cn(
                      'text-[11px] uppercase font-bold mb-2',
                      dark ? 'text-slate-500' : 'text-slate-400',
                    ),
                    children: 'Historico',
                  }),
                  _jsxs('div', {
                    className: cn(
                      'border rounded-lg p-3 mb-3',
                      dark
                        ? 'border-purple-500/30 bg-gradient-to-br from-purple-900/20 to-indigo-900/20'
                        : 'border-purple-200 bg-purple-50',
                    ),
                    children: [
                      _jsxs('div', {
                        className: 'flex items-center justify-between mb-2',
                        children: [
                          _jsx('span', {
                            className: cn(
                              'text-xs font-bold',
                              dark ? 'text-purple-300' : 'text-purple-700',
                            ),
                            children: '✨ AI Copilot',
                          }),
                          _jsx('button', {
                            onClick: runCopilot,
                            disabled: copilotLoading,
                            className: cn(
                              'px-2 py-1 rounded text-[10px] font-bold transition-colors',
                              dark
                                ? 'bg-purple-500/20 border border-purple-500/40 text-purple-300 hover:bg-purple-500/30'
                                : 'bg-purple-100 border border-purple-200 text-purple-700',
                            ),
                            children: copilotLoading ? 'Analisando...' : 'Analisar O.S',
                          }),
                        ],
                      }),
                      _jsx('p', {
                        className: cn(
                          'text-xs leading-relaxed',
                          dark ? 'text-slate-300' : 'text-slate-600',
                        ),
                        children:
                          copilotSuggestion ||
                          'Clique em Analisar para receber diagnóstico automático baseado no tipo e histórico desta O.S.',
                      }),
                    ],
                  }),
                  _jsxs('div', {
                    className: cn(
                      'border rounded-lg p-3 mb-3',
                      dark ? 'border-slate-700/50 bg-[#0f172a]/70' : 'border-slate-200 bg-white',
                    ),
                    children: [
                      _jsx('div', {
                        className: cn(
                          'text-[11px] uppercase font-bold mb-2',
                          dark ? 'text-slate-500' : 'text-slate-500',
                        ),
                        children: 'Nova atualizacao',
                      }),
                      _jsx('textarea', {
                        value: annotationText,
                        onChange: (e) => setAnnotationText(e.target.value),
                        rows: 3,
                        placeholder: 'Descreva o que foi feito nesta O.S...',
                        className: cn(
                          'w-full px-3 py-2 border rounded-lg text-sm resize-none',
                          dark
                            ? 'bg-[#1e293b]/60 border-slate-700 text-slate-200 placeholder:text-slate-500'
                            : 'bg-white border-slate-300 text-slate-900 placeholder:text-slate-400',
                        ),
                      }),
                      _jsxs('div', {
                        className: 'mt-2 flex items-center justify-between gap-2',
                        children: [
                          _jsxs('label', {
                            className: cn(
                              'inline-flex items-center gap-2 text-xs font-medium',
                              dark ? 'text-slate-300' : 'text-slate-600',
                            ),
                            children: [
                              _jsx('input', {
                                type: 'checkbox',
                                checked: annotationHideFromClient,
                                onChange: (e) => setAnnotationHideFromClient(e.target.checked),
                                className: cn(
                                  'h-3.5 w-3.5 rounded border',
                                  dark ? 'border-slate-600 bg-[#1e293b]' : 'border-slate-300',
                                ),
                              }),
                              'Nao mostrar ao cliente',
                            ],
                          }),
                          _jsx('button', {
                            onClick: submitOrderAnnotation,
                            disabled: annotationSaving || annotationText.trim().length < 2,
                            className: cn(
                              'px-3 py-1.5 rounded border text-xs font-bold transition-colors disabled:opacity-50',
                              dark
                                ? 'bg-cyan-900/30 border-cyan-700/50 text-cyan-400 hover:bg-cyan-900/50'
                                : 'border-cyan-200 bg-cyan-50 text-cyan-700 hover:bg-cyan-100',
                            ),
                            children: annotationSaving ? 'Salvando...' : 'Registrar atualizacao',
                          }),
                        ],
                      }),
                    ],
                  }),
                  _jsx('div', {
                    className: 'space-y-2 max-h-[40vh] overflow-y-auto custom-scrollbar',
                    children: history.map((o, idx) =>
                      _jsxs(
                        'div',
                        {
                          className: cn(
                            'border rounded-lg p-3',
                            dark
                              ? 'border-slate-700/50 bg-[#1e293b]/40'
                              : 'border-slate-200 bg-white',
                          ),
                          children: [
                            _jsxs('div', {
                              className: 'flex items-center justify-between text-xs mb-1',
                              children: [
                                _jsx('span', {
                                  className: cn(
                                    'font-bold',
                                    dark ? 'text-slate-300' : 'text-slate-700',
                                  ),
                                  children: o.user,
                                }),
                                _jsx('span', {
                                  className: 'font-mono text-slate-400',
                                  children: formatDateTime(o.at),
                                }),
                              ],
                            }),
                            _jsx('p', {
                              className: cn(
                                'text-sm whitespace-pre-wrap break-words',
                                dark ? 'text-slate-400' : 'text-slate-600',
                              ),
                              children: o.text,
                            }),
                          ],
                        },
                        `${order.id}-${idx}`,
                      ),
                    ),
                  }),
                ],
              }),
            ],
          }),
          _jsxs('div', {
            className: cn(
              'p-4 border-t grid grid-cols-1 md:grid-cols-3 gap-2',
              dark
                ? 'bg-[#0f172a]/80 backdrop-blur-xl border-slate-700/50'
                : 'bg-slate-50 border-slate-100',
            ),
            children: [
              _jsxs('button', {
                onClick: () => navigator.clipboard.writeText(order.protocol),
                className: cn(
                  'py-2 border rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition-colors',
                  dark
                    ? 'bg-[#1e293b]/60 border-slate-700/50 text-slate-300 hover:bg-[#1c2128]'
                    : 'bg-white border-slate-300 hover:bg-slate-100',
                ),
                children: [_jsx(Copy, { size: 13 }), 'Copiar'],
              }),
              _jsx('button', {
                onClick: () => onEditOrder(order),
                className: cn(
                  'py-2 border rounded-lg text-xs font-semibold transition-colors',
                  dark
                    ? 'bg-indigo-900/30 border-indigo-700/50 text-indigo-400 hover:bg-indigo-900/50'
                    : 'border-indigo-200 bg-indigo-50 text-indigo-700',
                ),
                children: 'Editar O.S',
              }),
              _jsx('button', {
                onClick: () => onOpenOccurrence(order),
                className: cn(
                  'py-2 border rounded-lg text-xs font-semibold transition-colors',
                  dark
                    ? 'bg-cyan-900/30 border-cyan-700/50 text-cyan-400 hover:bg-cyan-900/50'
                    : 'border-cyan-200 bg-cyan-50 text-cyan-700',
                ),
                children: 'Abrir Ocorrencia',
              }),
            ],
          }),
        ],
      }),
    ],
  });
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
    hideFromClient: order?.isCustomerVisible === false,
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
      hideFromClient: order?.isCustomerVisible === false,
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
      hideFromClient: !!form.hideFromClient,
      attachments: normalizeAttachments(form.attachments),
    });
    onClose();
  };
  const handleAttachmentSelect = (e) => {
    const { next, rejectedBySize, rejectedByLimit } = appendAttachmentFiles(
      form.attachments,
      e.target.files,
    );
    setForm((p) => ({ ...p, attachments: next }));
    e.target.value = '';
    setUploadNotice(buildUploadNotice(rejectedBySize, rejectedByLimit));
  };
  const inputClass = cn(
    'w-full px-3 py-2 border rounded-lg text-sm transition-colors',
    dark
      ? 'bg-[#1e293b]/50 border-slate-700 text-white placeholder-slate-500'
      : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400',
  );
  const labelClass = cn(
    'text-xs uppercase font-bold tracking-wider mb-1 block',
    dark ? 'text-slate-400' : 'text-slate-500',
  );
  const panelClass = cn(
    'border rounded-lg p-3 transition-colors',
    dark ? 'bg-[#0f172a]/50 border-slate-700/50' : 'bg-slate-50 border-slate-200',
  );
  const valueClass = cn('font-semibold', dark ? 'text-slate-300' : 'text-slate-800');
  const keyClass = cn('', dark ? 'text-slate-500' : 'text-slate-500');
  return _jsx(Modal, {
    title: `Editar O.S ${order.protocol}`,
    onClose: onClose,
    onBack: onClose,
    neonNav: true,
    maxWidth: 'max-w-[1280px]',
    children: _jsxs('form', {
      onSubmit: submit,
      className: 'space-y-3',
      children: [
        _jsxs('div', {
          className: panelClass,
          children: [
            _jsx('div', {
              className: cn(
                'text-xs uppercase font-bold mb-2',
                dark ? 'text-slate-400' : 'text-slate-500',
              ),
              children: 'Identificacao da O.S e da ocorrencia',
            }),
            _jsxs('div', {
              className: 'grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1.5 text-xs',
              children: [
                _jsxs('div', {
                  children: [
                    _jsx('span', { className: keyClass, children: 'Protocolo O.S:' }),
                    ' ',
                    _jsx('span', { className: valueClass, children: order.protocol }),
                  ],
                }),
                _jsxs('div', {
                  children: [
                    _jsx('span', { className: keyClass, children: 'Status O.S:' }),
                    ' ',
                    _jsx('span', { className: valueClass, children: order.status }),
                  ],
                }),
                _jsxs('div', {
                  children: [
                    _jsx('span', { className: keyClass, children: 'Provedor:' }),
                    ' ',
                    _jsx('span', { className: valueClass, children: order.provider }),
                  ],
                }),
                _jsxs('div', {
                  children: [
                    _jsx('span', { className: keyClass, children: 'Data criacao O.S:' }),
                    ' ',
                    _jsx('span', {
                      className: valueClass,
                      children: formatDateTime(order.createdAt),
                    }),
                  ],
                }),
                _jsxs('div', {
                  children: [
                    _jsx('span', { className: keyClass, children: 'Solicitante:' }),
                    ' ',
                    _jsx('span', { className: valueClass, children: order.solicitant || '-' }),
                  ],
                }),
                _jsxs('div', {
                  children: [
                    _jsx('span', { className: keyClass, children: 'Numero da Ocorrencia:' }),
                    ' ',
                    _jsx('span', {
                      className: valueClass,
                      children: order.occurrenceNumber || '-',
                    }),
                  ],
                }),
                _jsxs('div', {
                  children: [
                    _jsx('span', { className: keyClass, children: 'Status da Ocorrencia:' }),
                    ' ',
                    _jsx('span', {
                      className: valueClass,
                      children: order.occurrenceStatus || '-',
                    }),
                  ],
                }),
                _jsxs('div', {
                  children: [
                    _jsx('span', { className: keyClass, children: 'Tipo de Ocorrencia:' }),
                    ' ',
                    _jsx('span', { className: valueClass, children: order.occurrenceType || '-' }),
                  ],
                }),
                _jsxs('div', {
                  children: [
                    _jsx('span', { className: keyClass, children: 'Origem:' }),
                    ' ',
                    _jsx('span', {
                      className: valueClass,
                      children: order.occurrenceOrigin || '-',
                    }),
                  ],
                }),
                _jsxs('div', {
                  children: [
                    _jsx('span', { className: keyClass, children: 'Setor:' }),
                    ' ',
                    _jsx('span', {
                      className: valueClass,
                      children: order.occurrenceSector || '-',
                    }),
                  ],
                }),
                _jsxs('div', {
                  children: [
                    _jsx('span', { className: keyClass, children: 'Analista responsavel:' }),
                    ' ',
                    _jsx('span', {
                      className: valueClass,
                      children: order.occurrenceResponsible || '-',
                    }),
                  ],
                }),
                _jsxs('div', {
                  children: [
                    _jsx('span', { className: keyClass, children: 'Aberta por:' }),
                    ' ',
                    _jsx('span', {
                      className: valueClass,
                      children: order.occurrenceOpenedBy || 'Gerencia',
                    }),
                  ],
                }),
                _jsxs('div', {
                  children: [
                    _jsx('span', { className: keyClass, children: 'Data criacao ocorrencia:' }),
                    ' ',
                    _jsx('span', {
                      className: valueClass,
                      children: order.occurrenceCreatedAt
                        ? formatDateTime(order.occurrenceCreatedAt)
                        : '-',
                    }),
                  ],
                }),
              ],
            }),
          ],
        }),
        _jsx('div', {
          className: cn('text-xs uppercase font-bold', dark ? 'text-slate-400' : 'text-slate-500'),
          children: 'Campos editaveis da O.S',
        }),
        _jsxs('div', {
          className: 'grid grid-cols-1 md:grid-cols-3 gap-3',
          children: [
            _jsxs('div', {
              children: [
                _jsx('label', { className: labelClass, children: 'Tipo da O.S' }),
                _jsx('select', {
                  value: form.type,
                  onChange: (e) => setForm((p) => ({ ...p, type: e.target.value })),
                  className: inputClass,
                  children: SERVICE_TYPES.map((t) => _jsx('option', { children: t }, t)),
                }),
              ],
            }),
            _jsxs('div', {
              children: [
                _jsx('label', { className: labelClass, children: 'Prioridade da O.S' }),
                _jsx('select', {
                  value: form.priority,
                  onChange: (e) => setForm((p) => ({ ...p, priority: e.target.value })),
                  className: inputClass,
                  children: PRIORITIES.map((p) => _jsx('option', { children: p }, p)),
                }),
              ],
            }),
            _jsxs('div', {
              children: [
                _jsx('label', { className: labelClass, children: 'Status da O.S' }),
                _jsx('select', {
                  value: form.status,
                  onChange: (e) => setForm((p) => ({ ...p, status: e.target.value })),
                  className: inputClass,
                  children: STATUS_FLOW.map((s) => _jsx('option', { children: s }, s)),
                }),
              ],
            }),
          ],
        }),
        _jsxs('div', {
          className: 'grid grid-cols-1 md:grid-cols-3 gap-3',
          children: [
            _jsxs('div', {
              children: [
                _jsx('label', { className: labelClass, children: 'Usuario responsavel' }),
                _jsx('select', {
                  value: form.owner,
                  onChange: (e) => setForm((p) => ({ ...p, owner: e.target.value })),
                  className: inputClass,
                  children: ANALYST_USERS.map((a) => _jsx('option', { children: a }, a)),
                }),
              ],
            }),
            _jsxs('div', {
              children: [
                _jsx('label', { className: labelClass, children: 'Analista responsavel' }),
                _jsxs('select', {
                  value: form.tech,
                  onChange: (e) => setForm((p) => ({ ...p, tech: e.target.value })),
                  className: inputClass,
                  children: [
                    _jsx('option', { value: '', children: 'Sem analista' }),
                    ANALYST_USERS.map((a) => _jsx('option', { value: a, children: a }, a)),
                  ],
                }),
              ],
            }),
            _jsxs('div', {
              children: [
                _jsx('label', { className: labelClass, children: 'Solicitante' }),
                _jsx('input', {
                  value: form.solicitant,
                  onChange: (e) => setForm((p) => ({ ...p, solicitant: e.target.value })),
                  placeholder: 'Pessoa do provedor',
                  className: inputClass,
                }),
              ],
            }),
          ],
        }),
        _jsxs('div', {
          className: 'grid grid-cols-1 md:grid-cols-2 gap-3',
          children: [
            _jsxs('div', {
              children: [
                _jsx('label', { className: labelClass, children: 'Setor da O.S' }),
                _jsx('select', {
                  value: form.sector,
                  onChange: (e) => setForm((p) => ({ ...p, sector: e.target.value })),
                  className: inputClass,
                  children: OCCURRENCE_SECTORS.map((s) => _jsx('option', { children: s }, s)),
                }),
              ],
            }),
            _jsxs('div', {
              children: [
                _jsx('label', { className: labelClass, children: 'Origem da O.S' }),
                _jsx('select', {
                  value: form.origin,
                  onChange: (e) => setForm((p) => ({ ...p, origin: e.target.value })),
                  className: inputClass,
                  children: OCCURRENCE_ORIGINS.map((o) => _jsx('option', { children: o }, o)),
                }),
              ],
            }),
          ],
        }),
        _jsxs('div', {
          className: 'grid grid-cols-1 md:grid-cols-2 gap-3',
          children: [
            _jsxs('div', {
              children: [
                _jsx('label', { className: labelClass, children: 'Data limite SLA' }),
                _jsx('input', {
                  type: 'date',
                  value: form.deadlineDate,
                  onChange: (e) => setForm((p) => ({ ...p, deadlineDate: e.target.value })),
                  className: inputClass,
                }),
              ],
            }),
            _jsxs('div', {
              children: [
                _jsx('label', { className: labelClass, children: 'Hora limite SLA' }),
                _jsx('input', {
                  type: 'time',
                  value: form.deadlineTime,
                  onChange: (e) => setForm((p) => ({ ...p, deadlineTime: e.target.value })),
                  className: inputClass,
                }),
              ],
            }),
          ],
        }),
        _jsxs('div', {
          children: [
            _jsx('label', { className: labelClass, children: 'Descricao tecnica da O.S' }),
            _jsx('textarea', {
              value: form.description,
              onChange: (e) => setForm((p) => ({ ...p, description: e.target.value })),
              rows: 4,
              className: inputClass,
              placeholder: 'Descricao da O.S',
            }),
          ],
        }),
        _jsxs('label', {
          className: cn(
            'inline-flex items-center gap-2 text-xs font-semibold',
            dark ? 'text-slate-300' : 'text-slate-600',
          ),
          children: [
            _jsx('input', {
              type: 'checkbox',
              checked: !!form.hideFromClient,
              onChange: (e) => setForm((p) => ({ ...p, hideFromClient: e.target.checked })),
              className: cn(
                'h-3.5 w-3.5 rounded border',
                dark ? 'border-slate-600 bg-[#1e293b]' : 'border-slate-300',
              ),
            }),
            'Nao mostrar ao cliente',
          ],
        }),
        _jsxs('div', {
          className: cn(panelClass, 'space-y-2'),
          children: [
            _jsx('div', {
              className: labelClass,
              children: 'Anexos da O.S (imagem, video, audio, texto, PDF)',
            }),
            _jsx('div', {
              className: cn('text-[11px]', dark ? 'text-slate-400' : 'text-slate-500'),
              children: 'Ate 10 anexos por O.S, maximo 10MB por arquivo.',
            }),
            _jsx('input', {
              type: 'file',
              multiple: true,
              accept: ATTACHMENTS_ACCEPT,
              onChange: handleAttachmentSelect,
              className: cn(
                'block w-full text-xs file:mr-3 file:px-3 file:py-1.5 file:rounded file:border-0 file:text-slate-700',
                dark
                  ? 'text-slate-300 file:bg-slate-700 file:text-slate-200'
                  : 'text-slate-600 file:bg-slate-200',
              ),
            }),
            uploadNotice &&
              _jsx('div', { className: 'text-xs text-amber-700', children: uploadNotice }),
            _jsxs('div', {
              className: 'space-y-1',
              children: [
                normalizeAttachments(form.attachments).map((a) =>
                  _jsxs(
                    'div',
                    {
                      className: cn(
                        'flex items-center justify-between gap-2 border rounded px-2 py-1.5 text-xs',
                        dark
                          ? 'bg-[#1e293b]/50 border-slate-700 text-slate-300'
                          : 'bg-white border-slate-200 text-slate-700',
                      ),
                      children: [
                        _jsxs('div', {
                          className: 'min-w-0',
                          children: [
                            _jsx('div', { className: 'truncate', children: a.name }),
                            _jsxs('div', {
                              className: dark ? 'text-slate-400' : 'text-slate-400',
                              children: [a.mime || 'arquivo', ' \u2022 ', formatFileSize(a.size)],
                            }),
                          ],
                        }),
                        _jsx('button', {
                          type: 'button',
                          onClick: () =>
                            setForm((p) => ({
                              ...p,
                              attachments: normalizeAttachments(p.attachments).filter(
                                (att) => att.id !== a.id,
                              ),
                            })),
                          className: cn(
                            'px-2 py-1 border rounded transition-colors',
                            dark
                              ? 'border-rose-900/50 bg-rose-950/30 text-rose-400 hover:bg-rose-900/50'
                              : 'border-rose-200 bg-rose-50 text-rose-700',
                          ),
                          children: 'Remover',
                        }),
                      ],
                    },
                    a.id,
                  ),
                ),
                normalizeAttachments(form.attachments).length === 0 &&
                  _jsx('div', {
                    className: cn('text-xs', dark ? 'text-slate-500' : 'text-slate-400'),
                    children: 'Nenhum anexo adicionado.',
                  }),
              ],
            }),
          ],
        }),
        _jsxs('div', {
          className: 'flex justify-end gap-2',
          children: [
            _jsx('button', {
              type: 'button',
              onClick: onClose,
              className: cn(
                'px-3 py-2 border rounded-lg text-sm transition-colors',
                dark
                  ? 'border-slate-700 text-slate-300 hover:bg-slate-800'
                  : 'border-slate-300 text-slate-700 hover:bg-slate-50',
              ),
              children: 'Cancelar',
            }),
            _jsx('button', {
              type: 'submit',
              className:
                'px-3 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg text-sm font-semibold transition-colors',
              children: 'Salvar O.S',
            }),
          ],
        }),
      ],
    }),
  });
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
  const inputClass = cn(
    'w-full px-3 py-2 border rounded-lg text-sm transition-colors',
    dark
      ? 'bg-[#1e293b]/50 border-slate-700 text-white placeholder-slate-500'
      : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400',
  );
  const labelClass = cn(
    'text-xs uppercase font-bold tracking-wider mb-1 block',
    dark ? 'text-slate-400' : 'text-slate-500',
  );
  const panelClass = cn(
    'border rounded-lg p-3 transition-colors',
    dark ? 'bg-[#0f172a]/50 border-slate-700/50' : 'bg-slate-50 border-slate-200',
  );
  const valueClass = cn('font-semibold', dark ? 'text-slate-300' : 'text-slate-800');
  const keyClass = cn('', dark ? 'text-slate-500' : 'text-slate-500');
  return _jsx(Modal, {
    title: `Editar Ocorrencia ${occurrence.number}`,
    onClose: onClose,
    maxWidth: 'max-w-2xl',
    children: _jsxs('form', {
      onSubmit: submit,
      className: 'space-y-3',
      children: [
        _jsxs('div', {
          className: panelClass,
          children: [
            _jsx('div', {
              className: cn(
                'text-xs uppercase font-bold mb-2',
                dark ? 'text-slate-400' : 'text-slate-500',
              ),
              children: 'Identificacao da ocorrencia',
            }),
            _jsxs('div', {
              className: 'grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1.5 text-xs',
              children: [
                _jsxs('div', {
                  children: [
                    _jsx('span', { className: keyClass, children: 'Numero da Ocorrencia:' }),
                    ' ',
                    _jsx('span', { className: valueClass, children: occurrence.number }),
                  ],
                }),
                _jsxs('div', {
                  children: [
                    _jsx('span', { className: keyClass, children: 'Status atual:' }),
                    ' ',
                    _jsx('span', { className: valueClass, children: occurrence.status }),
                  ],
                }),
                _jsxs('div', {
                  children: [
                    _jsx('span', { className: keyClass, children: 'Tipo de Ocorrencia:' }),
                    ' ',
                    _jsx('span', { className: valueClass, children: occurrence.type }),
                  ],
                }),
                _jsxs('div', {
                  children: [
                    _jsx('span', { className: keyClass, children: 'Origem:' }),
                    ' ',
                    _jsx('span', { className: valueClass, children: occurrence.origin }),
                  ],
                }),
                _jsxs('div', {
                  children: [
                    _jsx('span', { className: keyClass, children: 'Setor:' }),
                    ' ',
                    _jsx('span', { className: valueClass, children: occurrence.sector }),
                  ],
                }),
                _jsxs('div', {
                  children: [
                    _jsx('span', { className: keyClass, children: 'Analista responsavel:' }),
                    ' ',
                    _jsx('span', {
                      className: valueClass,
                      children: occurrence.responsible || '-',
                    }),
                  ],
                }),
                _jsxs('div', {
                  children: [
                    _jsx('span', { className: keyClass, children: 'Aberta por:' }),
                    ' ',
                    _jsx('span', {
                      className: valueClass,
                      children: occurrence.openedBy || 'Gerencia',
                    }),
                  ],
                }),
                _jsxs('div', {
                  children: [
                    _jsx('span', { className: keyClass, children: 'Data de Criacao:' }),
                    ' ',
                    _jsx('span', {
                      className: valueClass,
                      children: occurrence.createdAt ? formatDateTime(occurrence.createdAt) : '-',
                    }),
                  ],
                }),
                _jsxs('div', {
                  children: [
                    _jsx('span', { className: keyClass, children: 'Provedor:' }),
                    ' ',
                    _jsx('span', { className: valueClass, children: occurrence.provider || '-' }),
                  ],
                }),
                _jsxs('div', {
                  children: [
                    _jsx('span', { className: keyClass, children: 'Qtd. de O.S:' }),
                    ' ',
                    _jsx('span', {
                      className: valueClass,
                      children: occurrence.orders?.length || 0,
                    }),
                  ],
                }),
              ],
            }),
          ],
        }),
        _jsx('div', {
          className: cn('text-xs uppercase font-bold', dark ? 'text-slate-400' : 'text-slate-500'),
          children: 'Campos editaveis da ocorrencia',
        }),
        _jsxs('div', {
          className: 'grid grid-cols-1 md:grid-cols-2 gap-3',
          children: [
            _jsxs('div', {
              children: [
                _jsx('label', { className: labelClass, children: 'Tipo de Ocorrencia' }),
                _jsx('select', {
                  value: form.type,
                  onChange: (e) => setForm((p) => ({ ...p, type: e.target.value })),
                  className: inputClass,
                  children: OCCURRENCE_TYPES.map((t) => _jsx('option', { children: t }, t)),
                }),
              ],
            }),
            _jsxs('div', {
              children: [
                _jsx('label', { className: labelClass, children: 'Status da Ocorrencia' }),
                _jsx('select', {
                  value: form.status,
                  onChange: (e) => setForm((p) => ({ ...p, status: e.target.value })),
                  className: inputClass,
                  children: OCCURRENCE_STATUS.map((s) => _jsx('option', { children: s }, s)),
                }),
              ],
            }),
            _jsxs('div', {
              children: [
                _jsx('label', { className: labelClass, children: 'Setor da Ocorrencia' }),
                _jsx('select', {
                  value: form.sector,
                  onChange: (e) => setForm((p) => ({ ...p, sector: e.target.value })),
                  className: inputClass,
                  children: OCCURRENCE_SECTORS.map((s) => _jsx('option', { children: s }, s)),
                }),
              ],
            }),
            _jsxs('div', {
              children: [
                _jsx('label', { className: labelClass, children: 'Origem da Ocorrencia' }),
                _jsx('select', {
                  value: form.origin,
                  onChange: (e) => setForm((p) => ({ ...p, origin: e.target.value })),
                  className: inputClass,
                  children: OCCURRENCE_ORIGINS.map((o) => _jsx('option', { children: o }, o)),
                }),
              ],
            }),
          ],
        }),
        _jsxs('div', {
          children: [
            _jsx('label', {
              className: labelClass,
              children: 'Analista responsavel da Ocorrencia',
            }),
            _jsx('select', {
              value: form.responsible,
              onChange: (e) => setForm((p) => ({ ...p, responsible: e.target.value })),
              className: inputClass,
              children: ANALYST_USERS.map((a) => _jsx('option', { children: a }, a)),
            }),
          ],
        }),
        _jsxs('div', {
          children: [
            _jsx('label', { className: labelClass, children: 'Descricao da Ocorrencia' }),
            _jsx('textarea', {
              value: form.description,
              onChange: (e) => setForm((p) => ({ ...p, description: e.target.value })),
              rows: 4,
              className: inputClass,
              placeholder: 'Descricao da ocorrencia',
            }),
          ],
        }),
        _jsxs('div', {
          className: 'flex justify-end gap-2',
          children: [
            _jsx('button', {
              type: 'button',
              onClick: onClose,
              className: cn(
                'px-3 py-2 border rounded-lg text-sm transition-colors',
                dark
                  ? 'border-slate-700 text-slate-300 hover:bg-slate-800'
                  : 'border-slate-300 text-slate-700 hover:bg-slate-50',
              ),
              children: 'Cancelar',
            }),
            _jsx('button', {
              type: 'submit',
              className:
                'px-3 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg text-sm font-semibold transition-colors',
              children: 'Salvar ocorrencia',
            }),
          ],
        }),
      ],
    }),
  });
};
const OccurrencesView = ({ orders, onSelectOrder, onCreateInternalOrder, focusOccurrenceId }) => {
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [newInternal, setNewInternal] = useState({
    sector: 'NOC',
    responsible: ANALYST_USERS[0],
    description: '',
  });
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
      const bySearch =
        !q ||
        `${o.number} ${o.provider} ${o.type} ${o.status} ${o.description}`
          .toLowerCase()
          .includes(q);
      const byStatus = statusFilter === 'Todas' || o.status === statusFilter;
      return bySearch && byStatus;
    });
  }, [occurrences, search, statusFilter]);
  const selected = occurrences.find((o) => o.id === selectedId) || null;
  return _jsxs('div', {
    className: 'space-y-5',
    children: [
      _jsxs('div', {
        children: [
          _jsx('h2', { className: 'text-2xl font-bold text-slate-900', children: 'Ocorrencias' }),
          _jsx('p', {
            className: 'text-sm text-slate-500',
            children: 'Cada O.S pertence a uma ocorrencia. Uma ocorrencia pode ter varias O.S.',
          }),
        ],
      }),
      _jsx('div', {
        className: 'bg-white border border-slate-200 rounded-xl p-4',
        children: _jsxs('div', {
          className: 'grid grid-cols-1 md:grid-cols-12 gap-3',
          children: [
            _jsxs('div', {
              className: 'relative w-full md:col-span-8',
              children: [
                _jsx(Search, {
                  size: 14,
                  className: 'absolute left-3 top-1/2 -translate-y-1/2 text-slate-400',
                }),
                _jsx('input', {
                  value: search,
                  onChange: (e) => setSearch(e.target.value),
                  placeholder: 'Buscar ocorrencia...',
                  className: 'w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm',
                }),
              ],
            }),
            _jsx('div', {
              className: 'md:col-span-4',
              children: _jsxs('select', {
                value: statusFilter,
                onChange: (e) => setStatusFilter(e.target.value),
                className: 'w-full px-3 py-2 border border-slate-300 rounded-lg text-sm',
                children: [
                  _jsx('option', { children: 'Todas' }),
                  OCCURRENCE_STATUS.map((s) => _jsx('option', { children: s }, s)),
                ],
              }),
            }),
          ],
        }),
      }),
      _jsxs('div', {
        className: 'grid grid-cols-1 xl:grid-cols-5 gap-5',
        children: [
          _jsx('div', {
            className:
              'xl:col-span-3 bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm',
            children: _jsx('div', {
              className: 'overflow-x-auto custom-scrollbar',
              children: _jsxs('table', {
                className: 'w-full text-sm',
                children: [
                  _jsx('thead', {
                    className: 'bg-slate-50 text-slate-500',
                    children: _jsxs('tr', {
                      children: [
                        _jsx('th', { className: 'px-4 py-3 text-left', children: 'Numero' }),
                        _jsx('th', { className: 'px-4 py-3 text-left', children: 'Provedor' }),
                        _jsx('th', { className: 'px-4 py-3 text-left', children: 'Tipo' }),
                        _jsx('th', { className: 'px-4 py-3 text-left', children: 'Status' }),
                        _jsx('th', { className: 'px-4 py-3 text-right', children: 'OS internas' }),
                      ],
                    }),
                  }),
                  _jsxs('tbody', {
                    className: 'divide-y divide-slate-100',
                    children: [
                      filtered.map((o) =>
                        _jsxs(
                          'tr',
                          {
                            onClick: () => setSelectedId(o.id),
                            className: cn(
                              'cursor-pointer hover:bg-slate-50',
                              selectedId === o.id && 'bg-slate-50',
                            ),
                            children: [
                              _jsx('td', { className: 'px-4 py-3 font-mono', children: o.number }),
                              _jsx('td', { className: 'px-4 py-3', children: o.provider }),
                              _jsx('td', { className: 'px-4 py-3', children: o.type }),
                              _jsx('td', {
                                className: 'px-4 py-3',
                                children: _jsx(Badge, {
                                  color: getOccurrenceStatusColor(o.status),
                                  children: o.status,
                                }),
                              }),
                              _jsx('td', {
                                className: 'px-4 py-3 text-right font-mono',
                                children: o.orders?.length || 0,
                              }),
                            ],
                          },
                          o.id,
                        ),
                      ),
                      filtered.length === 0 &&
                        _jsx('tr', {
                          children: _jsx('td', {
                            colSpan: 5,
                            className: 'px-4 py-8 text-center text-slate-400',
                            children: 'Nenhuma ocorrencia.',
                          }),
                        }),
                    ],
                  }),
                ],
              }),
            }),
          }),
          _jsxs('div', {
            className:
              'xl:col-span-2 bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-3',
            children: [
              !selected &&
                _jsx('div', {
                  className: 'text-sm text-slate-400',
                  children: 'Selecione uma ocorrencia.',
                }),
              selected &&
                _jsxs(_Fragment, {
                  children: [
                    _jsxs('div', {
                      children: [
                        _jsxs('div', {
                          className: 'text-xs uppercase font-bold text-slate-400',
                          children: ['Ocorrencia ', selected.number],
                        }),
                        _jsx('div', {
                          className: 'text-sm text-slate-700 mt-1',
                          children: selected.description,
                        }),
                      ],
                    }),
                    _jsxs('div', {
                      className: 'grid grid-cols-2 gap-2 text-xs',
                      children: [
                        _jsxs('div', {
                          children: [
                            _jsx('span', { className: 'text-slate-400', children: 'Setor:' }),
                            ' ',
                            _jsx('span', {
                              className: 'font-semibold text-slate-700',
                              children: selected.sector,
                            }),
                          ],
                        }),
                        _jsxs('div', {
                          children: [
                            _jsx('span', { className: 'text-slate-400', children: 'Origem:' }),
                            ' ',
                            _jsx('span', {
                              className: 'font-semibold text-slate-700',
                              children: selected.origin,
                            }),
                          ],
                        }),
                        _jsxs('div', {
                          children: [
                            _jsx('span', { className: 'text-slate-400', children: 'Abertor:' }),
                            ' ',
                            _jsx('span', {
                              className: 'font-semibold text-slate-700',
                              children: selected.openedBy,
                            }),
                          ],
                        }),
                        _jsxs('div', {
                          children: [
                            _jsx('span', { className: 'text-slate-400', children: 'Responsavel:' }),
                            ' ',
                            _jsx('span', {
                              className: 'font-semibold text-slate-700',
                              children: selected.responsible,
                            }),
                          ],
                        }),
                      ],
                    }),
                    _jsxs('div', {
                      className: 'border-t border-slate-100 pt-3 space-y-2',
                      children: [
                        _jsxs('div', {
                          className: 'text-xs uppercase font-bold text-slate-400',
                          children: ['Ordens de servico (', selected.orders.length, ')'],
                        }),
                        _jsx('div', {
                          className: 'space-y-2 max-h-56 overflow-y-auto custom-scrollbar',
                          children: (selected.orders || []).map((io) =>
                            _jsxs(
                              'button',
                              {
                                onClick: () => onSelectOrder(io),
                                className:
                                  'w-full text-left border border-slate-200 rounded-lg p-2 hover:bg-slate-50',
                                children: [
                                  _jsx('div', {
                                    className: 'text-xs text-slate-500 font-mono',
                                    children: io.protocol,
                                  }),
                                  _jsx('div', {
                                    className: 'text-sm text-slate-700',
                                    children: io.description,
                                  }),
                                  _jsxs('div', {
                                    className: 'text-xs text-slate-500 mt-1',
                                    children: [
                                      io.sector,
                                      ' \u2022 ',
                                      normalizeAnalystName(io.owner, ANALYST_USERS[0]),
                                    ],
                                  }),
                                ],
                              },
                              io.id,
                            ),
                          ),
                        }),
                      ],
                    }),
                    _jsxs('div', {
                      className: 'border-t border-slate-100 pt-3 space-y-2',
                      children: [
                        _jsx('div', {
                          className: 'text-xs uppercase font-bold text-slate-400',
                          children: 'Adicionar O.S interna',
                        }),
                        _jsx('select', {
                          value: newInternal.sector,
                          onChange: (e) =>
                            setNewInternal((p) => ({ ...p, sector: e.target.value })),
                          className: 'w-full px-2 py-1.5 border border-slate-300 rounded text-sm',
                          children: OCCURRENCE_SECTORS.map((s) =>
                            _jsx('option', { children: s }, s),
                          ),
                        }),
                        _jsx('input', {
                          value: newInternal.responsible,
                          onChange: (e) =>
                            setNewInternal((p) => ({ ...p, responsible: e.target.value })),
                          placeholder: 'Responsavel',
                          className: 'w-full px-2 py-1.5 border border-slate-300 rounded text-sm',
                        }),
                        _jsx('textarea', {
                          value: newInternal.description,
                          onChange: (e) =>
                            setNewInternal((p) => ({ ...p, description: e.target.value })),
                          rows: 2,
                          placeholder: 'Descricao interna',
                          className: 'w-full px-2 py-1.5 border border-slate-300 rounded text-sm',
                        }),
                        _jsx('button', {
                          onClick: () => {
                            if (!newInternal.description.trim()) return;
                            onCreateInternalOrder(selected, newInternal);
                            setNewInternal((p) => ({ ...p, description: '' }));
                          },
                          className:
                            'w-full px-3 py-2 border border-cyan-200 bg-cyan-50 text-cyan-700 rounded text-xs font-bold',
                          children: 'Salvar O.S interna',
                        }),
                      ],
                    }),
                  ],
                }),
            ],
          }),
        ],
      }),
    ],
  });
};
const DashboardView = ({
  orders,
  onSelectOrder,
  onGoToProviders,
  onGoToKnowledge,
  loading,
  currentAnalystName,
}) => {
  const { dark } = useTheme();
  const [period, setPeriod] = useState('Tudo');
  const [monthOffset, setMonthOffset] = useState(0);
  const [mineScopeMode, setMineScopeMode] = useState('owner_or_tech');
  const [hoverDayIndex, setHoverDayIndex] = useState(null);
  const normalizeName = (value) =>
    String(value || '')
      .trim()
      .toLowerCase();
  const analystNameNormalized = normalizeName(currentAnalystName || 'Analista');
  const isMineOrder = (order, mode = mineScopeMode) => {
    if (!analystNameNormalized) return false;
    if (mode === 'owner_only') {
      return normalizeName(order.owner) === analystNameNormalized;
    }
    return (
      normalizeName(order.owner) === analystNameNormalized ||
      normalizeName(order.tech) === analystNameNormalized
    );
  };
  const scoped = useMemo(() => filterByPeriod(orders, period), [orders, period]);
  const active = scoped.filter(isActive);
  const closed = scoped.filter(isClosed);
  const delayed = active.filter((o) => getDelayHours(o) > 0).length;
  const dueToday = active.filter(
    (o) => o.deadlineAt >= startOfDay(Date.now()) && o.deadlineAt <= endOfDay(Date.now()),
  );
  const mineScoped = useMemo(
    () => scoped.filter((order) => isMineOrder(order, mineScopeMode)),
    [scoped, analystNameNormalized, mineScopeMode],
  );
  const mineActive = mineScoped.filter(isActive);
  const mineClosed = mineScoped.filter(isClosed);
  const mineDelayed = mineActive.filter((o) => getDelayHours(o) > 0).length;
  const mineDueToday = mineActive.filter(
    (o) => o.deadlineAt >= startOfDay(Date.now()) && o.deadlineAt <= endOfDay(Date.now()),
  );
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
    [mineScoped],
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
    const monthLabel = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(
      monthStart,
    );
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
    return {
      points,
      width,
      height,
      paddingX,
      paddingY,
      maxY,
      getX,
      getY,
      openedPath,
      closedPath,
      openedArea,
      closedArea,
    };
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
  if (loading)
    return _jsxs('div', {
      className: 'space-y-6',
      children: [
        _jsxs('div', {
          children: [
            _jsx('h2', {
              className: cn('text-2xl font-bold', dark ? 'text-white' : 'text-slate-900'),
              children: 'Meu Painel',
            }),
            _jsx('p', {
              className: cn('text-sm', dark ? 'text-slate-400' : 'text-slate-500'),
              children: 'Carregando dados operacionais...',
            }),
          ],
        }),
        _jsx(SkeletonKpiCards, { count: 5 }),
        _jsxs('div', {
          className: 'grid grid-cols-1 xl:grid-cols-3 gap-5',
          children: [
            _jsx('div', { className: 'xl:col-span-2', children: _jsx(SkeletonTable, { rows: 4 }) }),
            _jsx(SkeletonTable, { rows: 3 }),
          ],
        }),
        _jsx(SkeletonTable, { rows: 5 }),
      ],
    });
  return _jsxs('div', {
    className: 'space-y-6',
    children: [
      _jsxs('div', {
        className: 'flex flex-col lg:flex-row lg:items-center justify-between gap-3',
        children: [
          _jsxs('div', {
            children: [
              _jsx('h2', {
                className: cn('text-2xl font-bold', dark ? 'text-white' : 'text-slate-900'),
                children: 'Meu Painel',
              }),
              _jsx('p', {
                className: cn('text-sm', dark ? 'text-slate-400' : 'text-slate-500'),
                children: 'Visao de operacao para tecnico/analista.',
              }),
            ],
          }),
          _jsx(PeriodTabs, { value: period, onChange: setPeriod }),
        ],
      }),
      _jsxs('div', {
        className: 'grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4',
        children: [
          _jsxs('div', {
            className: cn(
              'border rounded-xl p-4 shadow-sm',
              dark
                ? 'bg-[#1e293b]/60 backdrop-blur-md border-slate-700/50'
                : 'bg-white border-slate-200',
            ),
            children: [
              _jsx('div', {
                className: 'text-xs uppercase font-bold text-slate-400',
                children: 'Ativas (Geral)',
              }),
              _jsx('div', {
                className: cn('text-3xl font-bold mt-2', dark ? 'text-white' : 'text-slate-800'),
                children: active.length,
              }),
            ],
          }),
          _jsxs('div', {
            className: cn(
              'border rounded-xl p-4 shadow-sm',
              dark
                ? 'bg-[#1e293b]/60 backdrop-blur-md border-slate-700/50'
                : 'bg-white border-slate-200',
            ),
            children: [
              _jsx('div', {
                className: 'text-xs uppercase font-bold text-slate-400',
                children: 'Minhas Ativas',
              }),
              _jsx('div', {
                className: cn(
                  'text-3xl font-bold mt-2',
                  dark ? 'text-indigo-400' : 'text-indigo-700',
                ),
                children: mineActive.length,
              }),
            ],
          }),
          _jsxs('div', {
            className: cn(
              'border rounded-xl p-4 shadow-sm',
              dark
                ? 'bg-[#1e293b]/60 backdrop-blur-md border-rose-500/20'
                : 'bg-white border-rose-200',
            ),
            children: [
              _jsx('div', {
                className: 'text-xs uppercase font-bold text-rose-500',
                children: 'Minhas Atrasadas',
              }),
              _jsx('div', {
                className: 'text-3xl font-bold text-rose-500 mt-2',
                children: mineDelayed,
              }),
            ],
          }),
          _jsxs('div', {
            className: cn(
              'border rounded-xl p-4 shadow-sm',
              dark
                ? 'bg-[#1e293b]/60 backdrop-blur-md border-amber-500/20'
                : 'bg-white border-amber-200',
            ),
            children: [
              _jsx('div', {
                className: 'text-xs uppercase font-bold text-amber-500',
                children: 'Minhas Vencem Hoje',
              }),
              _jsx('div', {
                className: 'text-3xl font-bold text-amber-500 mt-2',
                children: mineDueToday.length,
              }),
            ],
          }),
          _jsxs('div', {
            className: cn(
              'border rounded-xl p-4 shadow-sm',
              dark
                ? 'bg-[#1e293b]/60 backdrop-blur-md border-slate-700/50'
                : 'bg-white border-slate-200',
            ),
            children: [
              _jsx('div', {
                className: 'text-xs uppercase font-bold text-slate-400',
                children: 'Minhas Fechadas',
              }),
              _jsx('div', {
                className: 'text-3xl font-bold mt-2 text-emerald-500',
                children: mineClosed.length,
              }),
            ],
          }),
        ],
      }),
      _jsxs('div', {
        className: 'grid grid-cols-1 xl:grid-cols-3 gap-5',
        children: [
          _jsxs('div', {
            className: cn(
              'xl:col-span-2 border rounded-xl p-5 shadow-sm overflow-hidden',
              dark
                ? 'bg-[#1e293b]/60 backdrop-blur-md border-slate-700/50'
                : 'bg-white border-slate-200',
            ),
            children: [
              _jsxs('div', {
                className: 'flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4',
                children: [
                  _jsxs('div', {
                    children: [
                      _jsxs('h3', {
                        className: cn(
                          'font-bold flex items-center gap-2',
                          dark ? 'text-white' : 'text-slate-800',
                        ),
                        children: [
                          _jsx('span', {
                            className: cn(
                              'p-1.5 rounded-md',
                              dark ? 'bg-blue-900/40 text-blue-300' : 'bg-blue-100 text-blue-700',
                            ),
                            children: _jsx(TrendingUp, { size: 14 }),
                          }),
                          'Minhas O.S - Fluxo do mes',
                        ],
                      }),
                      _jsxs('div', {
                        className: cn(
                          'text-[11px] uppercase tracking-wider mt-1',
                          dark ? 'text-slate-500' : 'text-slate-500',
                        ),
                        children: [
                          monthlyMineFlow.monthLabel,
                          ' - do dia 01 ao dia ',
                          pad(monthlyMineFlow.monthEnd.getDate()),
                        ],
                      }),
                    ],
                  }),
                  _jsxs('div', {
                    className: 'flex flex-col items-start md:items-end gap-2',
                    children: [
                      _jsxs('div', {
                        className: 'flex items-center gap-2',
                        children: [
                          _jsx('button', {
                            onClick: () => setMonthOffset((prev) => prev - 1),
                            className: cn(
                              'px-2 py-1 rounded border text-xs font-semibold',
                              dark
                                ? 'border-slate-700/50 text-slate-300 hover:bg-white/5'
                                : 'border-slate-300 text-slate-700 hover:bg-slate-50',
                            ),
                            children: 'Mes anterior',
                          }),
                          _jsx('button', {
                            onClick: () => setMonthOffset((prev) => Math.min(prev + 1, 0)),
                            disabled: monthOffset >= 0,
                            className: cn(
                              'px-2 py-1 rounded border text-xs font-semibold disabled:opacity-50',
                              dark
                                ? 'border-slate-700/50 text-slate-300 hover:bg-white/5'
                                : 'border-slate-300 text-slate-700 hover:bg-slate-50',
                            ),
                            children: 'Mes atual',
                          }),
                        ],
                      }),
                      _jsxs('div', {
                        className: 'flex items-center gap-2',
                        children: [
                          _jsx('button', {
                            onClick: () => setMineScopeMode('owner_or_tech'),
                            className: cn(
                              'px-2 py-1 rounded border text-[11px] font-semibold',
                              mineScopeMode === 'owner_or_tech'
                                ? dark
                                  ? 'border-cyan-600/50 bg-cyan-900/30 text-cyan-300'
                                  : 'border-cyan-200 bg-cyan-50 text-cyan-700'
                                : dark
                                  ? 'border-slate-700/50 text-slate-400 hover:bg-white/5'
                                  : 'border-slate-300 text-slate-600 hover:bg-slate-50',
                            ),
                            children: 'Owner + Analista',
                          }),
                          _jsx('button', {
                            onClick: () => setMineScopeMode('owner_only'),
                            className: cn(
                              'px-2 py-1 rounded border text-[11px] font-semibold',
                              mineScopeMode === 'owner_only'
                                ? dark
                                  ? 'border-cyan-600/50 bg-cyan-900/30 text-cyan-300'
                                  : 'border-cyan-200 bg-cyan-50 text-cyan-700'
                                : dark
                                  ? 'border-slate-700/50 text-slate-400 hover:bg-white/5'
                                  : 'border-slate-300 text-slate-600 hover:bg-slate-50',
                            ),
                            children: 'So owner',
                          }),
                        ],
                      }),
                      _jsxs('div', {
                        className:
                          'flex items-center gap-4 text-[11px] font-bold uppercase tracking-wider',
                        children: [
                          _jsxs('div', {
                            className: 'flex items-center gap-2',
                            children: [
                              _jsx('span', {
                                className:
                                  'w-4 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_12px_rgba(34,211,238,0.9)]',
                              }),
                              _jsxs('span', {
                                className: dark ? 'text-slate-400' : 'text-slate-500',
                                children: ['Abertas (', monthlyMineFlow.openedTotal, ')'],
                              }),
                            ],
                          }),
                          _jsxs('div', {
                            className: 'flex items-center gap-2',
                            children: [
                              _jsx('span', {
                                className:
                                  'w-4 h-1.5 rounded-full bg-violet-500 shadow-[0_0_12px_rgba(168,85,247,0.9)]',
                              }),
                              _jsxs('span', {
                                className: dark ? 'text-slate-400' : 'text-slate-500',
                                children: ['Fechadas (', monthlyMineFlow.closedTotal, ')'],
                              }),
                            ],
                          }),
                        ],
                      }),
                    ],
                  }),
                ],
              }),
              _jsx('div', {
                className: 'overflow-x-auto custom-scrollbar',
                children: _jsxs('svg', {
                  viewBox: `0 0 ${lineChart.width} ${lineChart.height}`,
                  className: 'w-full min-w-[760px] h-auto',
                  children: [
                    _jsxs('defs', {
                      children: [
                        _jsxs('filter', {
                          id: 'dashboardGlowCyan',
                          x: '-20%',
                          y: '-20%',
                          width: '140%',
                          height: '140%',
                          children: [
                            _jsx('feGaussianBlur', { stdDeviation: '3.5', result: 'blur' }),
                            _jsx('feComposite', {
                              in: 'SourceGraphic',
                              in2: 'blur',
                              operator: 'over',
                            }),
                          ],
                        }),
                        _jsxs('filter', {
                          id: 'dashboardGlowViolet',
                          x: '-20%',
                          y: '-20%',
                          width: '140%',
                          height: '140%',
                          children: [
                            _jsx('feGaussianBlur', { stdDeviation: '3.5', result: 'blur' }),
                            _jsx('feComposite', {
                              in: 'SourceGraphic',
                              in2: 'blur',
                              operator: 'over',
                            }),
                          ],
                        }),
                        _jsxs('linearGradient', {
                          id: 'dashboardGradCyan',
                          x1: '0',
                          y1: '0',
                          x2: '0',
                          y2: '1',
                          children: [
                            _jsx('stop', {
                              offset: '0%',
                              stopColor: '#22d3ee',
                              stopOpacity: '0.16',
                            }),
                            _jsx('stop', {
                              offset: '100%',
                              stopColor: '#22d3ee',
                              stopOpacity: '0',
                            }),
                          ],
                        }),
                        _jsxs('linearGradient', {
                          id: 'dashboardGradViolet',
                          x1: '0',
                          y1: '0',
                          x2: '0',
                          y2: '1',
                          children: [
                            _jsx('stop', {
                              offset: '0%',
                              stopColor: '#8b5cf6',
                              stopOpacity: '0.16',
                            }),
                            _jsx('stop', {
                              offset: '100%',
                              stopColor: '#8b5cf6',
                              stopOpacity: '0',
                            }),
                          ],
                        }),
                      ],
                    }),
                    yTickValues.map((value) =>
                      _jsxs(
                        'g',
                        {
                          children: [
                            _jsx('line', {
                              x1: lineChart.paddingX,
                              y1: lineChart.getY(value),
                              x2: lineChart.width - lineChart.paddingX,
                              y2: lineChart.getY(value),
                              stroke: dark ? 'rgba(148,163,184,0.13)' : 'rgba(100,116,139,0.15)',
                              strokeWidth: '1',
                            }),
                            _jsx('text', {
                              x: lineChart.paddingX - 10,
                              y: lineChart.getY(value) + 4,
                              fill: dark ? '#64748b' : '#94a3b8',
                              fontSize: '10',
                              fontWeight: '700',
                              textAnchor: 'end',
                              children: value,
                            }),
                          ],
                        },
                        `tick-${value}`,
                      ),
                    ),
                    _jsx('path', { d: lineChart.closedArea, fill: 'url(#dashboardGradViolet)' }),
                    _jsx('path', { d: lineChart.openedArea, fill: 'url(#dashboardGradCyan)' }),
                    _jsx('path', {
                      d: lineChart.closedPath,
                      fill: 'none',
                      stroke: '#8b5cf6',
                      strokeWidth: '3',
                      strokeLinecap: 'round',
                      filter: 'url(#dashboardGlowViolet)',
                    }),
                    _jsx('path', {
                      d: lineChart.openedPath,
                      fill: 'none',
                      stroke: '#22d3ee',
                      strokeWidth: '3',
                      strokeLinecap: 'round',
                      filter: 'url(#dashboardGlowCyan)',
                    }),
                    lineChart.points.map((_, idx) =>
                      _jsx(
                        'rect',
                        {
                          x: lineChart.getX(idx) - 10,
                          y: lineChart.paddingY,
                          width: 20,
                          height: lineChart.height - lineChart.paddingY * 2,
                          fill: 'transparent',
                          onMouseEnter: () => setHoverDayIndex(idx),
                          onMouseLeave: () =>
                            setHoverDayIndex((current) => (current === idx ? null : current)),
                        },
                        `hover-zone-${idx}`,
                      ),
                    ),
                    hoverDayIndex !== null &&
                      lineChart.points[hoverDayIndex] &&
                      _jsxs('g', {
                        pointerEvents: 'none',
                        children: [
                          _jsx('line', {
                            x1: lineChart.getX(hoverDayIndex),
                            y1: lineChart.paddingY,
                            x2: lineChart.getX(hoverDayIndex),
                            y2: lineChart.height - lineChart.paddingY,
                            stroke: dark ? 'rgba(148,163,184,0.35)' : 'rgba(100,116,139,0.35)',
                            strokeDasharray: '4 4',
                          }),
                          _jsx('circle', {
                            cx: lineChart.getX(hoverDayIndex),
                            cy: lineChart.getY(lineChart.points[hoverDayIndex].opened),
                            r: '3.5',
                            fill: '#22d3ee',
                          }),
                          _jsx('circle', {
                            cx: lineChart.getX(hoverDayIndex),
                            cy: lineChart.getY(lineChart.points[hoverDayIndex].closed),
                            r: '3.5',
                            fill: '#8b5cf6',
                          }),
                          _jsxs('g', {
                            transform: `translate(${Math.min(lineChart.getX(hoverDayIndex) + 14, lineChart.width - 190)}, ${lineChart.paddingY + 4})`,
                            children: [
                              _jsx('rect', {
                                width: '170',
                                height: '58',
                                rx: '8',
                                fill: dark ? 'rgba(15,23,42,0.92)' : 'rgba(255,255,255,0.95)',
                                stroke: dark ? 'rgba(51,65,85,0.8)' : 'rgba(203,213,225,0.9)',
                              }),
                              _jsxs('text', {
                                x: '10',
                                y: '16',
                                fill: dark ? '#94a3b8' : '#64748b',
                                fontSize: '10',
                                fontWeight: '700',
                                children: ['Dia ', pad(lineChart.points[hoverDayIndex].day)],
                              }),
                              _jsxs('text', {
                                x: '10',
                                y: '33',
                                fill: '#22d3ee',
                                fontSize: '11',
                                fontWeight: '700',
                                children: ['Abertas: ', lineChart.points[hoverDayIndex].opened],
                              }),
                              _jsxs('text', {
                                x: '10',
                                y: '49',
                                fill: '#8b5cf6',
                                fontSize: '11',
                                fontWeight: '700',
                                children: ['Fechadas: ', lineChart.points[hoverDayIndex].closed],
                              }),
                            ],
                          }),
                        ],
                      }),
                    xLabelIndexes.map((idx) => {
                      const day = lineChart.points[idx]?.day || idx + 1;
                      return _jsx(
                        'text',
                        {
                          x: lineChart.getX(idx),
                          y: lineChart.height - 8,
                          fill: dark ? '#64748b' : '#94a3b8',
                          fontSize: '10',
                          fontWeight: '800',
                          textAnchor: 'middle',
                          children: pad(day),
                        },
                        `day-${idx}`,
                      );
                    }),
                  ],
                }),
              }),
            ],
          }),
          _jsxs('div', {
            className: cn(
              'border rounded-xl p-5 shadow-sm',
              dark
                ? 'bg-[#1e293b]/60 backdrop-blur-md border-slate-700/50'
                : 'bg-white border-slate-200',
            ),
            children: [
              _jsx('h3', {
                className: cn('font-bold mb-3', dark ? 'text-white' : 'text-slate-800'),
                children: 'Acoes Rapidas',
              }),
              _jsxs('div', {
                className: 'space-y-2',
                children: [
                  _jsx('button', {
                    onClick: onGoToProviders,
                    className: cn(
                      'w-full text-left px-3 py-2 rounded-lg border font-semibold text-sm transition-colors',
                      dark
                        ? 'border-blue-500/30 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20'
                        : 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100',
                    ),
                    children: 'Abrir Provedores',
                  }),
                  _jsx('button', {
                    onClick: onGoToKnowledge,
                    className: cn(
                      'w-full text-left px-3 py-2 rounded-lg border text-sm transition-colors',
                      dark
                        ? 'border-slate-700/50 bg-white/5 text-slate-300 hover:bg-white/10'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
                    ),
                    children: 'Ver Ajustpedia',
                  }),
                ],
              }),
              _jsxs('div', {
                className: cn(
                  'mt-4 border rounded-lg p-3 text-xs',
                  dark
                    ? 'border-slate-700/50 bg-[#0f172a]/70 text-slate-400'
                    : 'border-slate-200 bg-slate-50 text-slate-600',
                ),
                children: [
                  _jsxs('div', {
                    className: 'flex items-center justify-between',
                    children: [
                      _jsx('span', { children: 'Minhas ativas' }),
                      _jsx('span', { className: 'font-mono', children: mineActive.length }),
                    ],
                  }),
                  _jsxs('div', {
                    className: 'flex items-center justify-between mt-1',
                    children: [
                      _jsx('span', { children: 'Minhas fechadas' }),
                      _jsx('span', { className: 'font-mono', children: mineClosed.length }),
                    ],
                  }),
                  _jsxs('div', {
                    className: 'flex items-center justify-between mt-1',
                    children: [
                      _jsx('span', { children: 'Atraso geral' }),
                      _jsx('span', { className: 'font-mono', children: delayed }),
                    ],
                  }),
                  _jsxs('div', {
                    className: 'flex items-center justify-between mt-1',
                    children: [
                      _jsx('span', { children: 'Vencem hoje (geral)' }),
                      _jsx('span', { className: 'font-mono', children: dueToday.length }),
                    ],
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
      _jsxs('div', {
        className: cn(
          'border rounded-xl shadow-sm overflow-hidden',
          dark
            ? 'bg-[#1e293b]/60 backdrop-blur-md border-slate-700/50'
            : 'bg-white border-slate-200',
        ),
        children: [
          _jsx('div', {
            className: cn(
              'px-5 py-3 border-b font-bold text-sm',
              dark ? 'border-slate-700/50 text-slate-300' : 'border-slate-100 text-slate-700',
            ),
            children: 'Minhas ordens de servico',
          }),
          _jsx('div', {
            className: 'overflow-x-auto custom-scrollbar',
            children: _jsxs('table', {
              className: 'w-full text-sm',
              children: [
                _jsx('thead', {
                  className: cn(dark ? 'bg-white/5 text-slate-400' : 'bg-slate-50 text-slate-500'),
                  children: _jsxs('tr', {
                    children: [
                      _jsx('th', { className: 'px-5 py-3 text-left', children: 'Protocolo' }),
                      _jsx('th', { className: 'px-5 py-3 text-left', children: 'Provedor' }),
                      _jsx('th', { className: 'px-5 py-3 text-left', children: 'Tipo' }),
                      _jsx('th', { className: 'px-5 py-3 text-left', children: 'Status' }),
                      _jsx('th', { className: 'px-5 py-3 text-right', children: 'Prazo' }),
                      _jsx('th', { className: 'px-5 py-3 text-center', children: 'Acao' }),
                    ],
                  }),
                }),
                _jsxs('tbody', {
                  className: cn('divide-y', dark ? 'divide-white/5' : 'divide-slate-100'),
                  children: [
                    myOrdersRows.map((o) =>
                      _jsxs(
                        'tr',
                        {
                          className: cn(
                            'transition-colors',
                            dark
                              ? 'hover:bg-white/5 text-slate-300'
                              : 'hover:bg-slate-50 text-slate-700',
                          ),
                          children: [
                            _jsx('td', { className: 'px-5 py-3 font-mono', children: o.protocol }),
                            _jsx('td', { className: 'px-5 py-3', children: o.provider }),
                            _jsx('td', {
                              className: 'px-5 py-3',
                              children: _jsx(ServiceTypeBadge, { type: o.type }),
                            }),
                            _jsx('td', {
                              className: 'px-5 py-3',
                              children: _jsx(StatusBadge, { status: o.status }),
                            }),
                            _jsx('td', {
                              className: cn(
                                'px-5 py-3 text-right font-mono text-xs',
                                getDelayHours(o) > 0 ? 'text-rose-500 font-bold' : 'text-slate-500',
                              ),
                              children: formatDateTime(o.deadlineAt),
                            }),
                            _jsx('td', {
                              className: 'px-5 py-3 text-center',
                              children: _jsx('button', {
                                onClick: () => onSelectOrder(o),
                                className: cn(
                                  'px-3 py-1 rounded border text-[10px] font-bold hover:opacity-80',
                                  dark
                                    ? 'border-cyan-500/30 bg-cyan-500/10 text-cyan-400'
                                    : 'border-cyan-200 bg-cyan-50 text-cyan-700',
                                ),
                                children: 'Ver',
                              }),
                            }),
                          ],
                        },
                        `mine-${o.id}`,
                      ),
                    ),
                    myOrdersRows.length === 0 &&
                      _jsx('tr', {
                        children: _jsxs('td', {
                          colSpan: 6,
                          className: 'px-5 py-14 text-center',
                          children: [
                            _jsx(Clock, { size: 28, className: 'mx-auto mb-3 text-slate-500' }),
                            _jsx('p', {
                              className: 'text-sm font-medium text-slate-400 mb-1',
                              children: 'Sem O.S vinculadas a voce neste periodo.',
                            }),
                          ],
                        }),
                      }),
                  ],
                }),
              ],
            }),
          }),
        ],
      }),
      _jsxs('div', {
        className: cn(
          'border rounded-xl shadow-sm overflow-hidden',
          dark
            ? 'bg-[#1e293b]/60 backdrop-blur-md border-slate-700/50'
            : 'bg-white border-slate-200',
        ),
        children: [
          _jsx('div', {
            className: cn(
              'px-5 py-3 border-b font-bold text-sm',
              dark ? 'border-slate-700/50 text-slate-300' : 'border-slate-100 text-slate-700',
            ),
            children: 'Proximas a vencer',
          }),
          _jsx('div', {
            className: 'overflow-x-auto custom-scrollbar',
            children: _jsxs('table', {
              className: 'w-full text-sm',
              children: [
                _jsx('thead', {
                  className: cn(dark ? 'bg-white/5 text-slate-400' : 'bg-slate-50 text-slate-500'),
                  children: _jsxs('tr', {
                    children: [
                      _jsx('th', { className: 'px-5 py-3 text-left', children: 'Protocolo' }),
                      _jsx('th', { className: 'px-5 py-3 text-left', children: 'Provedor' }),
                      _jsx('th', { className: 'px-5 py-3 text-left', children: 'Tipo' }),
                      _jsx('th', { className: 'px-5 py-3 text-left', children: 'Status' }),
                      _jsx('th', { className: 'px-5 py-3 text-right', children: 'Prazo' }),
                      _jsx('th', { className: 'px-5 py-3 text-center', children: 'Acao' }),
                    ],
                  }),
                }),
                _jsxs('tbody', {
                  className: cn('divide-y', dark ? 'divide-white/5' : 'divide-slate-100'),
                  children: [
                    [...active]
                      .sort((a, b) => a.deadlineAt - b.deadlineAt)
                      .slice(0, 8)
                      .map((o) =>
                        _jsxs(
                          'tr',
                          {
                            className: cn(
                              'transition-colors',
                              dark
                                ? 'hover:bg-white/5 text-slate-300'
                                : 'hover:bg-slate-50 text-slate-700',
                            ),
                            children: [
                              _jsx('td', {
                                className: 'px-5 py-3 font-mono',
                                children: o.protocol,
                              }),
                              _jsx('td', { className: 'px-5 py-3', children: o.provider }),
                              _jsx('td', {
                                className: 'px-5 py-3',
                                children: _jsx(ServiceTypeBadge, { type: o.type }),
                              }),
                              _jsx('td', {
                                className: 'px-5 py-3',
                                children: _jsx(StatusBadge, { status: o.status }),
                              }),
                              _jsx('td', {
                                className: cn(
                                  'px-5 py-3 text-right font-mono text-xs',
                                  getDelayHours(o) > 0
                                    ? 'text-rose-500 font-bold'
                                    : 'text-slate-500',
                                ),
                                children: formatDateTime(o.deadlineAt),
                              }),
                              _jsx('td', {
                                className: 'px-5 py-3 text-center',
                                children: _jsx('button', {
                                  onClick: () => onSelectOrder(o),
                                  className: cn(
                                    'px-3 py-1 rounded border text-[10px] font-bold hover:opacity-80',
                                    dark
                                      ? 'border-cyan-500/30 bg-cyan-500/10 text-cyan-400'
                                      : 'border-cyan-200 bg-cyan-50 text-cyan-700',
                                  ),
                                  children: 'Ver',
                                }),
                              }),
                            ],
                          },
                          o.id,
                        ),
                      ),
                    active.length === 0 &&
                      _jsx('tr', {
                        children: _jsxs('td', {
                          colSpan: 6,
                          className: 'px-5 py-14 text-center',
                          children: [
                            _jsx(Clock, { size: 28, className: 'mx-auto mb-3 text-slate-500' }),
                            _jsx('p', {
                              className: 'text-sm font-medium text-slate-400 mb-1',
                              children: 'Sem OS ativas no periodo.',
                            }),
                          ],
                        }),
                      }),
                  ],
                }),
              ],
            }),
          }),
        ],
      }),
    ],
  });
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
  const [period, setPeriod] = useState('Tudo');
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
  const selectClassName = cn(
    'w-full px-3 py-2 border rounded-lg text-sm outline-none transition-colors',
    dark
      ? 'bg-[#0f172a]/80 backdrop-blur-xl border-slate-700/50 text-white placeholder:text-slate-600 focus:border-blue-500/50'
      : 'bg-white border-slate-300 focus:border-blue-500',
  );
  return _jsxs('div', {
    className: 'space-y-5',
    children: [
      _jsxs('div', {
        className: 'flex flex-col lg:flex-row lg:items-center justify-between gap-3',
        children: [
          _jsxs('div', {
            children: [
              _jsx('h2', {
                className: cn('text-2xl font-bold', dark ? 'text-white' : 'text-slate-900'),
                children: 'Ordens de Servico',
              }),
              _jsx('p', {
                className: cn('text-sm', dark ? 'text-slate-400' : 'text-slate-500'),
                children: 'Busca completa, filtros e acoes em lote.',
              }),
            ],
          }),
          _jsx(PeriodTabs, { value: period, onChange: setPeriod }),
        ],
      }),
      _jsxs('div', {
        className: cn(
          'border rounded-xl p-4 grid grid-cols-1 md:grid-cols-12 gap-3',
          dark
            ? 'bg-[#1e293b]/60 backdrop-blur-md border-slate-700/50'
            : 'bg-white border-slate-200',
        ),
        children: [
          _jsxs('div', {
            className: 'md:col-span-4 relative',
            children: [
              _jsx(Search, {
                size: 14,
                className: cn(
                  'absolute left-3 top-1/2 -translate-y-1/2',
                  dark ? 'text-slate-500' : 'text-slate-400',
                ),
              }),
              _jsx('input', {
                value: search,
                onChange: (e) => setSearch(e.target.value),
                placeholder: 'Pesquisar protocolo, provedor, tecnico...',
                className: cn(
                  'w-full pl-9 pr-3 py-2 border rounded-lg text-sm outline-none transition-colors',
                  dark
                    ? 'bg-[#0f172a]/80 backdrop-blur-xl border-slate-700/50 text-white placeholder:text-slate-600 focus:border-blue-500/50'
                    : 'bg-white border-slate-300 focus:border-blue-500',
                ),
              }),
            ],
          }),
          _jsx('div', {
            className: 'md:col-span-2',
            children: _jsxs('select', {
              value: statusFilter,
              onChange: (e) => setStatusFilter(e.target.value),
              className: selectClassName,
              children: [
                _jsx('option', { children: 'Todas' }),
                STATUS_FLOW.map((s) => _jsx('option', { children: s }, s)),
              ],
            }),
          }),
          _jsx('div', {
            className: 'md:col-span-3',
            children: _jsxs('select', {
              value: providerFilter,
              onChange: (e) => setProviderFilter(e.target.value),
              className: selectClassName,
              children: [
                _jsx('option', { children: 'Todos' }),
                PROVIDERS.map((p) => _jsx('option', { children: p }, p)),
              ],
            }),
          }),
          _jsx('div', {
            className: 'md:col-span-3',
            children: _jsxs('select', {
              value: priorityFilter,
              onChange: (e) => setPriorityFilter(e.target.value),
              className: selectClassName,
              children: [
                _jsx('option', { children: 'Todas' }),
                PRIORITIES.map((p) => _jsx('option', { children: p }, p)),
              ],
            }),
          }),
          _jsxs('div', {
            className: cn(
              'md:col-span-12 border-t pt-3 grid grid-cols-1 lg:grid-cols-2 gap-2',
              dark ? 'border-slate-700/50' : 'border-slate-100',
            ),
            children: [
              _jsxs('div', {
                className: 'flex gap-2',
                children: [
                  _jsx('select', {
                    value: bulkStatus,
                    onChange: (e) => setBulkStatus(e.target.value),
                    className: cn(selectClassName, 'flex-1'),
                    children: STATUS_FLOW.map((s) => _jsx('option', { children: s }, s)),
                  }),
                  _jsx('button', {
                    onClick: runBulkStatus,
                    className: cn(
                      'px-3 py-2 text-xs rounded-lg border font-bold',
                      dark
                        ? 'border-cyan-500/30 bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20'
                        : 'border-cyan-200 bg-cyan-50 text-cyan-700',
                    ),
                    children: 'Status em lote',
                  }),
                ],
              }),
              _jsxs('div', {
                className: 'flex gap-2',
                children: [
                  _jsxs('select', {
                    value: bulkTech,
                    onChange: (e) => setBulkTech(e.target.value),
                    className: cn(selectClassName, 'flex-1'),
                    children: [
                      _jsx('option', { value: '', children: 'Selecione tecnico' }),
                      TECHS.map((t) => _jsx('option', { value: t.name, children: t.name }, t.name)),
                    ],
                  }),
                  _jsx('button', {
                    onClick: runBulkTech,
                    className: cn(
                      'px-3 py-2 text-xs rounded-lg border font-bold',
                      dark
                        ? 'border-indigo-500/30 bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20'
                        : 'border-indigo-200 bg-indigo-50 text-indigo-700',
                    ),
                    children: 'Atribuir em lote',
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
      _jsxs('div', {
        className: cn(
          'border rounded-xl overflow-hidden shadow-sm',
          dark
            ? 'bg-[#1e293b]/60 backdrop-blur-md border-slate-700/50'
            : 'bg-white border-slate-200',
        ),
        children: [
          _jsx('div', {
            className: 'overflow-x-auto custom-scrollbar',
            children: _jsxs('table', {
              className: 'w-full text-sm',
              children: [
                _jsx('thead', {
                  className: cn(dark ? 'bg-white/5 text-slate-400' : 'bg-slate-50 text-slate-500'),
                  children: _jsxs('tr', {
                    children: [
                      _jsx('th', {
                        className: 'px-4 py-3 text-left',
                        children: _jsx('input', {
                          type: 'checkbox',
                          checked: allVisibleSelected,
                          onChange: toggleSelectAllVisible,
                        }),
                      }),
                      _jsx('th', { className: 'px-5 py-3 text-left', children: 'Protocolo' }),
                      _jsx('th', { className: 'px-5 py-3 text-left', children: 'Provedor' }),
                      _jsx('th', { className: 'px-5 py-3 text-left', children: 'Tecnico' }),
                      _jsx('th', { className: 'px-5 py-3 text-left', children: 'Owner' }),
                      _jsx('th', { className: 'px-5 py-3 text-left', children: 'Tipo' }),
                      _jsx('th', { className: 'px-5 py-3 text-left', children: 'Prioridade' }),
                      _jsx('th', { className: 'px-5 py-3 text-left', children: 'Status' }),
                      _jsx('th', { className: 'px-5 py-3 text-right', children: 'Prazo' }),
                      _jsx('th', { className: 'px-5 py-3 text-center', children: 'Acao' }),
                    ],
                  }),
                }),
                _jsxs('tbody', {
                  className: cn('divide-y', dark ? 'divide-white/5' : 'divide-slate-100'),
                  children: [
                    rows.map((o) =>
                      _jsxs(
                        'tr',
                        {
                          className: cn(
                            'transition-colors',
                            dark
                              ? 'hover:bg-white/5 text-slate-300'
                              : 'hover:bg-slate-50 text-slate-700',
                          ),
                          children: [
                            _jsx('td', {
                              className: 'px-4 py-3',
                              children: _jsx('input', {
                                type: 'checkbox',
                                checked: !!selected[o.id],
                                onChange: () => setSelected((p) => ({ ...p, [o.id]: !p[o.id] })),
                              }),
                            }),
                            _jsx('td', { className: 'px-5 py-3 font-mono', children: o.protocol }),
                            _jsx('td', { className: 'px-5 py-3', children: o.provider }),
                            _jsx('td', { className: 'px-5 py-3', children: o.tech || '-' }),
                            _jsx('td', { className: 'px-5 py-3', children: o.owner || '-' }),
                            _jsx('td', {
                              className: 'px-5 py-3',
                              children: _jsx(ServiceTypeBadge, { type: o.type }),
                            }),
                            _jsx('td', {
                              className: 'px-5 py-3',
                              children: _jsx(PriorityBadge, { priority: o.priority }),
                            }),
                            _jsx('td', {
                              className: 'px-5 py-3',
                              children: _jsx(StatusBadge, { status: o.status }),
                            }),
                            _jsx('td', {
                              className: cn(
                                'px-5 py-3 text-right font-mono text-xs',
                                getDelayHours(o) > 0 && isActive(o)
                                  ? 'text-rose-500 font-bold'
                                  : 'text-slate-500',
                              ),
                              children: formatDateTime(o.deadlineAt),
                            }),
                            _jsxs('td', {
                              className: 'px-5 py-3 text-center flex justify-center gap-1',
                              children: [
                                _jsx('button', {
                                  onClick: () => onSelectOrder(o),
                                  className: cn(
                                    'px-2 py-1 rounded border text-[10px] font-bold',
                                    dark
                                      ? 'border-cyan-500/30 bg-cyan-500/10 text-cyan-400'
                                      : 'border-cyan-200 bg-cyan-50 text-cyan-700',
                                  ),
                                  children: 'Abrir',
                                }),
                                o.status !== 'Fechada' &&
                                  _jsx('button', {
                                    onClick: () => onAdvanceStatus(o.id),
                                    className: cn(
                                      'px-2 py-1 rounded border text-[10px]',
                                      dark
                                        ? 'border-slate-700/50 bg-white/5 text-slate-300'
                                        : 'border-slate-300 bg-white',
                                    ),
                                    children: 'Avancar',
                                  }),
                              ],
                            }),
                          ],
                        },
                        o.id,
                      ),
                    ),
                    rows.length === 0 &&
                      _jsx('tr', {
                        children: _jsx('td', {
                          colSpan: 10,
                          className: 'px-5 py-10 text-center text-slate-500',
                          children: 'Nenhuma OS encontrada.',
                        }),
                      }),
                  ],
                }),
              ],
            }),
          }),
          _jsxs('div', {
            className: cn(
              'px-5 py-3 border-t flex justify-between items-center text-xs',
              dark
                ? 'bg-white/5 border-slate-700/50 text-slate-400'
                : 'bg-slate-50 border-slate-200 text-slate-500',
            ),
            children: [
              _jsxs('span', {
                children: [
                  'Pagina ',
                  _jsx('strong', { children: currentPage }),
                  ' de ',
                  _jsx('strong', { children: totalPages }),
                  ' (',
                  filtered.length,
                  ' registros)',
                ],
              }),
              _jsxs('div', {
                className: 'flex gap-2',
                children: [
                  _jsx('button', {
                    onClick: () => setPage((p) => Math.max(1, p - 1)),
                    disabled: currentPage === 1,
                    className: cn(
                      'px-3 py-1.5 border rounded text-xs font-medium disabled:opacity-40',
                      dark
                        ? 'bg-white/5 border-slate-700/50 text-slate-300 hover:bg-white/10'
                        : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-50',
                    ),
                    children: 'Anterior',
                  }),
                  _jsx('button', {
                    onClick: () => setPage((p) => Math.min(totalPages, p + 1)),
                    disabled: currentPage === totalPages,
                    className: cn(
                      'px-3 py-1.5 border rounded text-xs font-medium disabled:opacity-40',
                      dark
                        ? 'bg-white/5 border-slate-700/50 text-slate-300 hover:bg-white/10'
                        : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-50',
                    ),
                    children: 'Proximo',
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  });
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
      hideFromClient: false,
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
      const parsedOccurrenceCreatedAt = new Date(
        `${form.occurrenceDate}T${form.occurrenceTime}`,
      ).getTime();
      const occurrenceCreatedAt = Number.isFinite(parsedOccurrenceCreatedAt)
        ? parsedOccurrenceCreatedAt
        : createdAt;
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
        hideFromClient: !!form.hideFromClient,
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
        occurrences: [{ at: createdAt, user: 'Voce', text: 'OS criada manualmente.' }],
      });
      setLoading(false);
      onToast('OS criada com sucesso.');
      setForm(buildDefaultForm());
    }, 850);
  };
  return _jsxs('div', {
    className: 'space-y-5',
    children: [
      _jsxs('div', {
        className: 'flex items-center justify-between',
        children: [
          _jsxs('div', {
            children: [
              _jsx('h2', {
                className: 'text-2xl font-bold text-slate-900',
                children: 'Nova Ordem de Servico',
              }),
              _jsx('p', {
                className: 'text-sm text-slate-500',
                children: 'Formulario completo de abertura para analista/tecnico.',
              }),
            ],
          }),
          _jsx('button', {
            onClick: onCancel,
            className: 'px-3 py-2 border border-slate-300 rounded-lg text-sm hover:bg-slate-50',
            children: 'Voltar para provedores',
          }),
        ],
      }),
      _jsxs('form', {
        onSubmit: submit,
        className: 'space-y-5',
        children: [
          _jsxs('div', {
            className: 'bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4',
            children: [
              _jsx('h3', {
                className: 'font-bold text-slate-800',
                children: 'Identificacao da Ocorrencia Vinculada',
              }),
              _jsx('p', {
                className: 'text-xs text-slate-500',
                children:
                  'Protocolo da O.S e numero da ocorrencia sao gerados automaticamente e nao sao editaveis.',
              }),
              _jsxs('div', {
                className: 'grid grid-cols-1 md:grid-cols-2 gap-3',
                children: [
                  _jsxs('div', {
                    children: [
                      _jsx('label', {
                        className:
                          'text-xs uppercase font-bold tracking-wider text-slate-500 mb-1 block',
                        children: 'Numero da Ocorrencia',
                      }),
                      _jsx('input', {
                        value: form.occurrenceNumber,
                        readOnly: true,
                        className:
                          'w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-slate-100 text-slate-600 cursor-not-allowed',
                      }),
                    ],
                  }),
                  _jsxs('div', {
                    children: [
                      _jsx('label', {
                        className:
                          'text-xs uppercase font-bold tracking-wider text-slate-500 mb-1 block',
                        children: 'Protocolo da O.S',
                      }),
                      _jsx('input', {
                        value: 'Gerado automaticamente ao salvar',
                        readOnly: true,
                        className:
                          'w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-slate-100 text-slate-600 cursor-not-allowed',
                      }),
                    ],
                  }),
                  _jsxs('div', {
                    children: [
                      _jsx('label', {
                        className:
                          'text-xs uppercase font-bold tracking-wider text-slate-500 mb-1 block',
                        children: 'Status',
                      }),
                      _jsx('select', {
                        value: form.occurrenceStatus,
                        onChange: (e) => setField('occurrenceStatus', e.target.value),
                        className: 'w-full px-3 py-2 border border-slate-300 rounded-lg text-sm',
                        children: OCCURRENCE_STATUS.map((s) => _jsx('option', { children: s }, s)),
                      }),
                    ],
                  }),
                  _jsxs('div', {
                    children: [
                      _jsx('label', {
                        className:
                          'text-xs uppercase font-bold tracking-wider text-slate-500 mb-1 block',
                        children: 'Tipo de Ocorrencia',
                      }),
                      _jsx('select', {
                        value: form.occurrenceType,
                        onChange: (e) => setField('occurrenceType', e.target.value),
                        className: 'w-full px-3 py-2 border border-slate-300 rounded-lg text-sm',
                        children: OCCURRENCE_TYPES.map((t) => _jsx('option', { children: t }, t)),
                      }),
                    ],
                  }),
                  _jsxs('div', {
                    children: [
                      _jsx('label', {
                        className:
                          'text-xs uppercase font-bold tracking-wider text-slate-500 mb-1 block',
                        children: 'Origem',
                      }),
                      _jsx('select', {
                        value: form.occurrenceOrigin,
                        onChange: (e) => setField('occurrenceOrigin', e.target.value),
                        className: 'w-full px-3 py-2 border border-slate-300 rounded-lg text-sm',
                        children: OCCURRENCE_ORIGINS.map((o) => _jsx('option', { children: o }, o)),
                      }),
                    ],
                  }),
                  _jsxs('div', {
                    children: [
                      _jsx('label', {
                        className:
                          'text-xs uppercase font-bold tracking-wider text-slate-500 mb-1 block',
                        children: 'Setor',
                      }),
                      _jsx('select', {
                        value: form.occurrenceSector,
                        onChange: (e) => setField('occurrenceSector', e.target.value),
                        className: 'w-full px-3 py-2 border border-slate-300 rounded-lg text-sm',
                        children: OCCURRENCE_SECTORS.map((s) => _jsx('option', { children: s }, s)),
                      }),
                    ],
                  }),
                  _jsxs('div', {
                    children: [
                      _jsx('label', {
                        className:
                          'text-xs uppercase font-bold tracking-wider text-slate-500 mb-1 block',
                        children: 'Usuario responsavel',
                      }),
                      _jsx('select', {
                        value: form.occurrenceResponsible,
                        onChange: (e) => setField('occurrenceResponsible', e.target.value),
                        className: 'w-full px-3 py-2 border border-slate-300 rounded-lg text-sm',
                        children: ANALYST_USERS.map((a) => _jsx('option', { children: a }, a)),
                      }),
                    ],
                  }),
                  _jsxs('div', {
                    children: [
                      _jsx('label', {
                        className:
                          'text-xs uppercase font-bold tracking-wider text-slate-500 mb-1 block',
                        children: 'Aberta por',
                      }),
                      _jsx('input', {
                        value: form.occurrenceOpenedBy,
                        onChange: (e) => setField('occurrenceOpenedBy', e.target.value),
                        className: 'w-full px-3 py-2 border border-slate-300 rounded-lg text-sm',
                      }),
                    ],
                  }),
                  _jsxs('div', {
                    className: 'grid grid-cols-2 gap-2',
                    children: [
                      _jsxs('div', {
                        children: [
                          _jsx('label', {
                            className:
                              'text-xs uppercase font-bold tracking-wider text-slate-500 mb-1 block',
                            children: 'Data de Criacao',
                          }),
                          _jsx('input', {
                            type: 'date',
                            value: form.occurrenceDate,
                            onChange: (e) => setField('occurrenceDate', e.target.value),
                            className:
                              'w-full px-3 py-2 border border-slate-300 rounded-lg text-sm',
                          }),
                        ],
                      }),
                      _jsxs('div', {
                        children: [
                          _jsx('label', {
                            className:
                              'text-xs uppercase font-bold tracking-wider text-slate-500 mb-1 block',
                            children: 'Hora',
                          }),
                          _jsx('input', {
                            type: 'time',
                            value: form.occurrenceTime,
                            onChange: (e) => setField('occurrenceTime', e.target.value),
                            className:
                              'w-full px-3 py-2 border border-slate-300 rounded-lg text-sm',
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
            className: 'bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4',
            children: [
              _jsxs('h3', {
                className: 'font-bold text-slate-800 flex items-center gap-2',
                children: [
                  _jsx(Briefcase, { size: 16, className: 'text-blue-600' }),
                  'Contexto da O.S',
                ],
              }),
              _jsx('p', {
                className: 'text-xs text-slate-500',
                children: 'Campos padronizados conforme o fluxo operacional da ocorrencia/O.S.',
              }),
              _jsxs('div', {
                className: 'grid grid-cols-1 md:grid-cols-2 gap-3',
                children: [
                  _jsxs('div', {
                    children: [
                      _jsx('label', {
                        className:
                          'text-xs uppercase font-bold tracking-wider text-slate-500 mb-1 block',
                        children: 'Provedor',
                      }),
                      _jsx('select', {
                        value: form.provider,
                        onChange: (e) => setField('provider', e.target.value),
                        className: 'w-full px-3 py-2 border border-slate-300 rounded-lg text-sm',
                        children: PROVIDERS.map((p) => _jsx('option', { children: p }, p)),
                      }),
                    ],
                  }),
                  _jsxs('div', {
                    children: [
                      _jsx('label', {
                        className:
                          'text-xs uppercase font-bold tracking-wider text-slate-500 mb-1 block',
                        children: 'Tipo da O.S',
                      }),
                      _jsx('select', {
                        value: form.type,
                        onChange: (e) => setField('type', e.target.value),
                        className: 'w-full px-3 py-2 border border-slate-300 rounded-lg text-sm',
                        children: SERVICE_TYPES.map((t) => _jsx('option', { children: t }, t)),
                      }),
                    ],
                  }),
                  _jsxs('div', {
                    children: [
                      _jsx('label', {
                        className:
                          'text-xs uppercase font-bold tracking-wider text-slate-500 mb-1 block',
                        children: 'Prioridade',
                      }),
                      _jsx('select', {
                        value: form.priority,
                        onChange: (e) => setField('priority', e.target.value),
                        className: 'w-full px-3 py-2 border border-slate-300 rounded-lg text-sm',
                        children: PRIORITIES.map((p) => _jsx('option', { children: p }, p)),
                      }),
                    ],
                  }),
                  _jsxs('div', {
                    children: [
                      _jsx('label', {
                        className:
                          'text-xs uppercase font-bold tracking-wider text-slate-500 mb-1 block',
                        children: 'Status da O.S',
                      }),
                      _jsx('input', {
                        value: 'Aberta',
                        readOnly: true,
                        className:
                          'w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-slate-100 text-slate-600 cursor-not-allowed',
                      }),
                    ],
                  }),
                  _jsxs('div', {
                    children: [
                      _jsx('label', {
                        className:
                          'text-xs uppercase font-bold tracking-wider text-slate-500 mb-1 block',
                        children: 'Analista responsavel',
                      }),
                      _jsxs('select', {
                        value: form.tech,
                        onChange: (e) => setField('tech', e.target.value),
                        className: 'w-full px-3 py-2 border border-slate-300 rounded-lg text-sm',
                        children: [
                          _jsx('option', { value: '', children: 'Sem analista' }),
                          ANALYST_USERS.map((a) => _jsx('option', { value: a, children: a }, a)),
                        ],
                      }),
                    ],
                  }),
                  _jsxs('div', {
                    children: [
                      _jsx('label', {
                        className:
                          'text-xs uppercase font-bold tracking-wider text-slate-500 mb-1 block',
                        children: 'Usuario responsavel',
                      }),
                      _jsx('select', {
                        value: form.owner,
                        onChange: (e) => setField('owner', e.target.value),
                        className: 'w-full px-3 py-2 border border-slate-300 rounded-lg text-sm',
                        children: ANALYST_USERS.map((a) => _jsx('option', { children: a }, a)),
                      }),
                    ],
                  }),
                  _jsxs('div', {
                    children: [
                      _jsx('label', {
                        className:
                          'text-xs uppercase font-bold tracking-wider text-slate-500 mb-1 block',
                        children: 'Solicitante',
                      }),
                      _jsx('input', {
                        value: form.solicitant,
                        onChange: (e) => setField('solicitant', e.target.value),
                        placeholder: 'Pessoa do provedor',
                        className: 'w-full px-3 py-2 border border-slate-300 rounded-lg text-sm',
                      }),
                    ],
                  }),
                  _jsxs('div', {
                    children: [
                      _jsx('label', {
                        className:
                          'text-xs uppercase font-bold tracking-wider text-slate-500 mb-1 block',
                        children: 'Origem',
                      }),
                      _jsx('select', {
                        value: form.origin,
                        onChange: (e) => setField('origin', e.target.value),
                        className: 'w-full px-3 py-2 border border-slate-300 rounded-lg text-sm',
                        children: OCCURRENCE_ORIGINS.map((o) => _jsx('option', { children: o }, o)),
                      }),
                    ],
                  }),
                  _jsxs('div', {
                    children: [
                      _jsx('label', {
                        className:
                          'text-xs uppercase font-bold tracking-wider text-slate-500 mb-1 block',
                        children: 'Setor',
                      }),
                      _jsx('select', {
                        value: form.sector,
                        onChange: (e) => setField('sector', e.target.value),
                        className: 'w-full px-3 py-2 border border-slate-300 rounded-lg text-sm',
                        children: OCCURRENCE_SECTORS.map((s) => _jsx('option', { children: s }, s)),
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),
          _jsxs('div', {
            className: 'bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4',
            children: [
              _jsxs('h3', {
                className: 'font-bold text-slate-800 flex items-center gap-2',
                children: [
                  _jsx(Clock, { size: 16, className: 'text-amber-600' }),
                  'SLA e descricao',
                ],
              }),
              _jsxs('div', {
                className: 'grid grid-cols-1 md:grid-cols-2 gap-3',
                children: [
                  _jsxs('div', {
                    children: [
                      _jsx('label', {
                        className:
                          'text-xs uppercase font-bold tracking-wider text-slate-500 mb-1 block',
                        children: 'Data limite SLA',
                      }),
                      _jsx('input', {
                        type: 'date',
                        value: form.deadlineDate,
                        onChange: (e) => setField('deadlineDate', e.target.value),
                        className: 'w-full px-3 py-2 border border-slate-300 rounded-lg text-sm',
                      }),
                    ],
                  }),
                  _jsxs('div', {
                    children: [
                      _jsx('label', {
                        className:
                          'text-xs uppercase font-bold tracking-wider text-slate-500 mb-1 block',
                        children: 'Hora limite SLA',
                      }),
                      _jsx('input', {
                        type: 'time',
                        value: form.deadlineTime,
                        onChange: (e) => setField('deadlineTime', e.target.value),
                        className: 'w-full px-3 py-2 border border-slate-300 rounded-lg text-sm',
                      }),
                    ],
                  }),
                ],
              }),
              _jsxs('div', {
                children: [
                  _jsx('label', {
                    className: 'text-sm font-semibold text-slate-700',
                    children: 'Descricao tecnica',
                  }),
                  _jsx('textarea', {
                    rows: 5,
                    value: form.description,
                    onChange: (e) => setField('description', e.target.value),
                    className: 'w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg text-sm',
                    placeholder: 'Descreva o problema com detalhes tecnicos...',
                  }),
                  _jsxs('button', {
                    type: 'button',
                    onClick: enhanceDescription,
                    disabled: enhancing,
                    className:
                      'mt-2 px-3 py-1.5 border border-indigo-200 bg-indigo-50 text-indigo-700 rounded-lg text-xs font-bold flex items-center gap-1 disabled:opacity-40',
                    children: [
                      enhancing
                        ? _jsx(Loader2, { size: 13, className: 'animate-spin' })
                        : _jsx(Sparkles, { size: 13 }),
                      'Melhorar descricao',
                    ],
                  }),
                ],
              }),
              _jsxs('div', {
                children: [
                  _jsx('label', {
                    className: 'text-sm font-semibold text-slate-700',
                    children: 'Observacoes internas',
                  }),
                  _jsx('textarea', {
                    rows: 3,
                    value: form.internalNotes,
                    onChange: (e) => setField('internalNotes', e.target.value),
                    className:
                      'w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg text-sm bg-amber-50',
                    placeholder: 'Notas para a equipe...',
                  }),
                ],
              }),
              _jsxs('label', {
                className: 'inline-flex items-center gap-2 text-xs font-semibold text-slate-600',
                children: [
                  _jsx('input', {
                    type: 'checkbox',
                    checked: !!form.hideFromClient,
                    onChange: (e) => setField('hideFromClient', e.target.checked),
                    className: 'h-3.5 w-3.5 rounded border border-slate-300',
                  }),
                  'Nao mostrar ao cliente',
                ],
              }),
            ],
          }),
          _jsxs('div', {
            className: 'flex justify-end gap-2',
            children: [
              _jsx('button', {
                type: 'button',
                onClick: onCancel,
                className: 'px-4 py-2 border border-slate-300 rounded-lg text-sm hover:bg-slate-50',
                children: 'Cancelar',
              }),
              _jsxs('button', {
                type: 'submit',
                disabled: loading,
                className:
                  'px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2',
                children: [
                  loading
                    ? _jsx(Loader2, { size: 14, className: 'animate-spin' })
                    : _jsx(CheckCircle, { size: 14 }),
                  loading ? 'Criando...' : 'Criar OS',
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  });
};
const TechnicianDelayModal = ({ techName, orders, onClose, onSelectOrder }) => {
  const { dark } = useTheme();
  const list = useMemo(
    () =>
      orders
        .filter((o) => o.tech === techName && getDelayHours(o) > 0)
        .sort((a, b) => getDelayHours(b) - getDelayHours(a)),
    [orders, techName],
  );
  return _jsx(Modal, {
    title: `Atrasos - ${techName}`,
    onClose: onClose,
    maxWidth: 'max-w-6xl',
    children: _jsx('div', {
      className: 'overflow-x-auto custom-scrollbar max-h-[70vh]',
      children: _jsxs('table', {
        className: 'w-full text-sm',
        children: [
          _jsx('thead', {
            className: cn(
              'sticky top-0',
              dark
                ? 'bg-[#1e293b]/60 backdrop-blur-md text-slate-400'
                : 'bg-slate-50 text-slate-500',
            ),
            children: _jsxs('tr', {
              children: [
                _jsx('th', { className: 'px-4 py-2 text-left', children: 'Protocolo' }),
                _jsx('th', { className: 'px-4 py-2 text-left', children: 'Provedor' }),
                _jsx('th', { className: 'px-4 py-2 text-left', children: 'Tipo' }),
                _jsx('th', { className: 'px-4 py-2 text-left', children: 'Status' }),
                _jsx('th', { className: 'px-4 py-2 text-right', children: 'Delay (h)' }),
                _jsx('th', { className: 'px-4 py-2 text-center', children: 'Acao' }),
              ],
            }),
          }),
          _jsxs('tbody', {
            className: cn('divide-y', dark ? 'divide-white/5' : 'divide-slate-100'),
            children: [
              list.map((o) =>
                _jsxs(
                  'tr',
                  {
                    children: [
                      _jsx('td', { className: 'px-4 py-2 font-mono', children: o.protocol }),
                      _jsx('td', { className: 'px-4 py-2', children: o.provider }),
                      _jsx('td', {
                        className: 'px-4 py-2',
                        children: _jsx(ServiceTypeBadge, { type: o.type }),
                      }),
                      _jsx('td', {
                        className: 'px-4 py-2',
                        children: _jsx(StatusBadge, { status: o.status }),
                      }),
                      _jsx('td', {
                        className: 'px-4 py-2 text-right font-mono font-bold text-rose-600',
                        children: getDelayHours(o).toFixed(2),
                      }),
                      _jsx('td', {
                        className: 'px-4 py-2 text-center',
                        children: _jsx('button', {
                          onClick: () => onSelectOrder(o),
                          className: cn(
                            'px-3 py-1 border rounded text-xs font-bold transition-colors',
                            dark
                              ? 'bg-cyan-900/30 border-cyan-700/50 text-cyan-400 hover:bg-cyan-900/50'
                              : 'border-cyan-200 bg-cyan-50 text-cyan-700 hover:bg-cyan-100/50',
                          ),
                          children: 'Abrir',
                        }),
                      }),
                    ],
                  },
                  o.id,
                ),
              ),
              list.length === 0 &&
                _jsx('tr', {
                  children: _jsx('td', {
                    colSpan: 6,
                    className: 'px-4 py-10 text-center text-slate-400',
                    children: 'Sem atrasos para este tecnico.',
                  }),
                }),
            ],
          }),
        ],
      }),
    }),
  });
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
  const analystOptions = useMemo(
    () => Array.from(new Set([currentAnalystName, ...ANALYST_USERS].filter(Boolean))),
    [currentAnalystName],
  );
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
      hideFromClient: false,
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
  const scoped = useMemo(
    () => (selectedProvider ? filterByPeriod(orders, period) : orders),
    [orders, period, selectedProvider],
  );
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
      row.critical += occurrence.orders.filter(
        (o) => o.priority === 'Alta' || o.priority === 'Critica',
      ).length;
    });
    return Array.from(map.values()).sort((a, b) => b.orders - a.orders);
  }, [scopedOccurrences]);
  const filteredProviders = useMemo(
    () =>
      providerRows.filter((p) => p.provider.toLowerCase().includes(search.toLowerCase().trim())),
    [providerRows, search],
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
      const bySearch =
        !q ||
        `${o.number} ${o.type} ${o.sector} ${o.status} ${o.description}`.toLowerCase().includes(q);
      const byStatus = statusFilter === 'Todas' || o.status === statusFilter;
      const byType = typeFilter === 'Todos' || o.type === typeFilter;
      const byDelay =
        !onlyDelayed ||
        (o.orders || []).some((order) => isActive(order) && getDelayHours(order) > 0);
      return bySearch && byStatus && byType && byDelay;
    });
  }, [
    providerOccurrences,
    occurrenceSearch,
    statusFilter,
    typeFilter,
    onlyDelayed,
    selectedProvider,
  ]);
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
      critical: providerOrders.filter((o) => o.priority === 'Alta' || o.priority === 'Critica')
        .length,
    };
  }, [providerOccurrences]);
  const providerListSummary = useMemo(
    () => ({
      providers: filteredProviders.length,
      occurrences: filteredProviders.reduce((acc, row) => acc + row.occurrences, 0),
      orders: filteredProviders.reduce((acc, row) => acc + row.orders, 0),
      active: filteredProviders.reduce((acc, row) => acc + row.active, 0),
      delayed: filteredProviders.reduce((acc, row) => acc + row.delayed, 0),
      critical: filteredProviders.reduce((acc, row) => acc + row.critical, 0),
    }),
    [filteredProviders],
  );
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
    const { next, rejectedBySize, rejectedByLimit } = appendAttachmentFiles(
      orderDraft.attachments,
      files,
    );
    setOrderDraft((p) => ({ ...p, attachments: next }));
    setDraftUploadNotice(buildUploadNotice(rejectedBySize, rejectedByLimit));
  };
  const submitOccurrenceAnnotation = async () => {
    const message = occurrenceAnnotationText.trim();
    if (
      !openedOccurrence ||
      message.length < 2 ||
      !onAddOccurrenceAnnotation ||
      occurrenceAnnotationSaving
    )
      return;
    setOccurrenceAnnotationSaving(true);
    try {
      const ok = await onAddOccurrenceAnnotation(openedOccurrence, message);
      if (ok) setOccurrenceAnnotationText('');
    } finally {
      setOccurrenceAnnotationSaving(false);
    }
  };
  const inputClass = cn(
    'w-full px-3 py-2 border rounded-lg text-sm transition-colors',
    dark
      ? 'bg-[#1e293b]/50 border-slate-700 text-white placeholder-slate-500'
      : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400',
  );
  const readOnlyInputClass = cn(
    'w-full px-3 py-2 border rounded-lg text-sm cursor-not-allowed',
    dark
      ? 'bg-[#0f172a]/50 border-slate-700 text-slate-500'
      : 'bg-slate-100 border-slate-300 text-slate-600',
  );
  const labelClass = cn(
    'text-xs uppercase font-bold tracking-wider mb-1 block',
    dark ? 'text-slate-400' : 'text-slate-500',
  );
  const panelClass = cn(
    'border rounded-lg p-3 transition-colors',
    dark ? 'bg-[#0f172a]/50 border-slate-700/50' : 'bg-slate-50 border-slate-200',
  );
  const sectionTitleClass = cn(
    'text-xs uppercase font-bold',
    dark ? 'text-slate-400' : 'text-slate-500',
  );
  if (selectedProvider) {
    return _jsxs('div', {
      className: 'space-y-5',
      children: [
        _jsxs('div', {
          className: 'flex flex-col lg:flex-row lg:items-start justify-between gap-3',
          children: [
            _jsxs('div', {
              children: [
                _jsxs('button', {
                  onClick: () => {
                    setOpenedOccurrenceId(null);
                    setSelectedProvider(null);
                    onProviderFocusChange?.(null);
                    onOccurrenceFocusChange?.(null);
                  },
                  className:
                    'inline-flex items-center gap-1 text-xs font-semibold text-cyan-700 mb-2 hover:underline',
                  children: [_jsx(ChevronLeft, { size: 14 }), 'Voltar para lista de provedores'],
                }),
                _jsx('h2', {
                  className: cn('text-2xl font-bold', dark ? 'text-slate-100' : 'text-slate-900'),
                  children: selectedProvider,
                }),
                _jsx('p', {
                  className: cn('text-sm', dark ? 'text-slate-400' : 'text-slate-500'),
                  children: 'Fluxo por ocorrencia. Cada ocorrencia pode ter varias O.S internas.',
                }),
                _jsxs('div', {
                  className: 'mt-3 flex flex-wrap items-center gap-2',
                  children: [
                    _jsxs('span', {
                      className: cn(
                        'inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold border',
                        dark
                          ? 'bg-slate-900/70 text-slate-300 border-slate-700/60'
                          : 'bg-slate-50 text-slate-600 border-slate-200',
                      ),
                      children: ['Ocorrencias: ', providerKpis.occurrences],
                    }),
                    _jsxs('span', {
                      className: cn(
                        'inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold border',
                        dark
                          ? 'bg-indigo-500/12 text-indigo-200 border-indigo-500/25'
                          : 'bg-indigo-50 text-indigo-700 border-indigo-200',
                      ),
                      children: ['Ativas: ', providerKpis.active],
                    }),
                    _jsxs('span', {
                      className: cn(
                        'inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold border',
                        dark
                          ? 'bg-rose-500/12 text-rose-200 border-rose-500/25'
                          : 'bg-rose-50 text-rose-700 border-rose-200',
                      ),
                      children: ['Atrasadas: ', providerKpis.delayed],
                    }),
                  ],
                }),
              ],
            }),
            _jsxs('div', {
              className: 'flex items-center gap-2',
              children: [
                !openedOccurrence &&
                  _jsx('button', {
                    onClick: () => {
                      setOccurrenceDraft(buildOccurrenceDraft());
                      setOrderDraft(buildOrderDraft());
                      setDraftUploadNotice('');
                      setShowOpenOccurrenceModal(true);
                    },
                    className:
                      'px-3 py-2 rounded-lg border border-blue-200 bg-blue-50 text-blue-700 text-xs font-bold hover:bg-blue-100',
                    children: 'Cadastrar ocorrencia',
                  }),
                _jsx(PeriodTabs, { value: period, onChange: setPeriod }),
              ],
            }),
          ],
        }),
        _jsxs('div', {
          className: 'grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4',
          children: [
            _jsxs('div', {
              className: cn(
                'border rounded-xl p-4 shadow-sm',
                dark
                  ? 'bg-[#1e293b]/60 backdrop-blur-md border-slate-700/50'
                  : 'bg-white border-slate-200',
              ),
              children: [
                _jsx('div', {
                  className: cn(
                    'text-xs uppercase font-bold',
                    dark ? 'text-slate-500' : 'text-slate-400',
                  ),
                  children: 'Ocorrencias',
                }),
                _jsx('div', {
                  className: cn(
                    'text-3xl font-bold mt-2',
                    dark ? 'text-slate-200' : 'text-slate-800',
                  ),
                  children: providerKpis.occurrences,
                }),
              ],
            }),
            _jsxs('div', {
              className: cn(
                'border rounded-xl p-4 shadow-sm',
                dark
                  ? 'bg-[#1e293b]/60 backdrop-blur-md border-slate-700/50'
                  : 'bg-white border-slate-200',
              ),
              children: [
                _jsx('div', {
                  className: cn(
                    'text-xs uppercase font-bold',
                    dark ? 'text-slate-500' : 'text-slate-400',
                  ),
                  children: 'Total O.S',
                }),
                _jsx('div', {
                  className: cn(
                    'text-3xl font-bold mt-2',
                    dark ? 'text-slate-200' : 'text-slate-800',
                  ),
                  children: providerKpis.total,
                }),
              ],
            }),
            _jsxs('div', {
              className: cn(
                'border rounded-xl p-4 shadow-sm',
                dark
                  ? 'bg-[#1e293b]/60 backdrop-blur-md border-slate-700/50'
                  : 'bg-white border-slate-200',
              ),
              children: [
                _jsx('div', {
                  className: 'text-xs uppercase font-bold text-slate-400',
                  children: 'Ativas',
                }),
                _jsx('div', {
                  className: cn(
                    'text-3xl font-bold mt-2',
                    dark ? 'text-indigo-400' : 'text-indigo-700',
                  ),
                  children: providerKpis.active,
                }),
              ],
            }),
            _jsxs('div', {
              className: cn(
                'border rounded-xl p-4 shadow-sm',
                dark
                  ? 'bg-[#1e293b]/60 backdrop-blur-md border-rose-500/20'
                  : 'bg-white border-rose-200',
              ),
              children: [
                _jsx('div', {
                  className: 'text-xs uppercase font-bold text-rose-500',
                  children: 'Atrasadas',
                }),
                _jsx('div', {
                  className: 'text-3xl font-bold text-rose-600 mt-2',
                  children: providerKpis.delayed,
                }),
              ],
            }),
            _jsxs('div', {
              className: cn(
                'border rounded-xl p-4 shadow-sm',
                dark
                  ? 'bg-[#1e293b]/60 backdrop-blur-md border-amber-500/20'
                  : 'bg-white border-amber-200',
              ),
              children: [
                _jsx('div', {
                  className: 'text-xs uppercase font-bold text-amber-600',
                  children: 'Alta/Critica',
                }),
                _jsx('div', {
                  className: 'text-3xl font-bold text-amber-600 mt-2',
                  children: providerKpis.critical,
                }),
              ],
            }),
          ],
        }),
        !openedOccurrence &&
          _jsxs(_Fragment, {
            children: [
              _jsx('div', {
                className: cn(
                  'border rounded-xl p-4',
                  dark
                    ? 'bg-[#1e293b]/60 backdrop-blur-md border-slate-700/50'
                    : 'bg-white border-slate-200',
                ),
                children: _jsxs('div', {
                  className: 'grid grid-cols-1 lg:grid-cols-12 gap-3',
                  children: [
                    _jsxs('div', {
                      className: 'lg:col-span-5 relative',
                      children: [
                        _jsx(Search, {
                          size: 14,
                          className: cn(
                            'absolute left-3 top-1/2 -translate-y-1/2',
                            dark ? 'text-slate-500' : 'text-slate-400',
                          ),
                        }),
                        _jsx('input', {
                          value: occurrenceSearch,
                          onChange: (e) => setOccurrenceSearch(e.target.value),
                          placeholder: 'Buscar ocorrencia...',
                          className: cn(
                            'w-full pl-9 pr-3 py-2 border rounded-lg text-sm transition-colors',
                            dark
                              ? 'bg-[#0f172a]/80 backdrop-blur-xl border-slate-700/50 text-slate-200 placeholder:text-slate-600 focus:border-blue-500/50'
                              : 'bg-white border-slate-300 text-slate-900 focus:border-blue-500',
                          ),
                        }),
                      ],
                    }),
                    _jsx('div', {
                      className: 'lg:col-span-3',
                      children: _jsxs('select', {
                        value: statusFilter,
                        onChange: (e) => setStatusFilter(e.target.value),
                        className: cn(
                          'w-full px-3 py-2 border rounded-lg text-sm',
                          dark
                            ? 'bg-[#0f172a]/80 backdrop-blur-xl border-slate-700/50 text-slate-300'
                            : 'bg-white border-slate-300 text-slate-900',
                        ),
                        children: [
                          _jsx('option', { children: 'Todas' }),
                          OCCURRENCE_STATUS.map((s) => _jsx('option', { children: s }, s)),
                        ],
                      }),
                    }),
                    _jsx('div', {
                      className: 'lg:col-span-2',
                      children: _jsxs('select', {
                        value: typeFilter,
                        onChange: (e) => setTypeFilter(e.target.value),
                        className: cn(
                          'w-full px-3 py-2 border rounded-lg text-sm',
                          dark
                            ? 'bg-[#0f172a]/80 backdrop-blur-xl border-slate-700/50 text-slate-300'
                            : 'bg-white border-slate-300 text-slate-900',
                        ),
                        children: [
                          _jsx('option', { children: 'Todos' }),
                          OCCURRENCE_TYPES.map((t) => _jsx('option', { children: t }, t)),
                        ],
                      }),
                    }),
                    _jsxs('div', {
                      className: 'lg:col-span-2 flex items-center gap-2',
                      children: [
                        _jsxs('label', {
                          className: cn(
                            'inline-flex items-center gap-2 text-xs font-medium',
                            dark ? 'text-slate-400' : 'text-slate-600',
                          ),
                          children: [
                            _jsx('input', {
                              type: 'checkbox',
                              checked: onlyDelayed,
                              onChange: (e) => setOnlyDelayed(e.target.checked),
                            }),
                            'Com atraso',
                          ],
                        }),
                        _jsx('button', {
                          onClick: () => {
                            setOccurrenceSearch('');
                            setStatusFilter('Todas');
                            setTypeFilter('Todos');
                            setOnlyDelayed(false);
                          },
                          className:
                            'ml-auto text-xs px-2 py-1 border border-slate-300 rounded hover:bg-slate-50',
                          children: 'Limpar',
                        }),
                      ],
                    }),
                  ],
                }),
              }),
              _jsxs('div', {
                className: cn(
                  'border rounded-xl overflow-hidden shadow-sm',
                  dark
                    ? 'bg-[#1e293b]/60 backdrop-blur-md border-slate-700/50'
                    : 'bg-white border-slate-200',
                ),
                children: [
                  _jsxs('div', {
                    className: cn(
                      'px-5 py-3 border-b font-bold text-sm',
                      dark
                        ? 'border-slate-700/50 text-slate-300'
                        : 'border-slate-100 text-slate-700',
                    ),
                    children: ['Ocorrencias do provedor (', filteredOccurrences.length, ')'],
                  }),
                  _jsx('div', {
                    className: 'overflow-x-auto custom-scrollbar',
                    children: _jsxs('table', {
                      className: 'w-full text-sm',
                      children: [
                        _jsx('thead', {
                          className: cn(
                            dark ? 'bg-white/5 text-slate-400' : 'bg-slate-50 text-slate-500',
                          ),
                          children: _jsxs('tr', {
                            children: [
                              _jsx('th', { className: 'px-4 py-3 text-left', children: 'Numero' }),
                              _jsx('th', { className: 'px-4 py-3 text-left', children: 'Tipo' }),
                              _jsx('th', { className: 'px-4 py-3 text-left', children: 'Setor' }),
                              _jsx('th', { className: 'px-4 py-3 text-left', children: 'Status' }),
                              _jsx('th', { className: 'px-4 py-3 text-right', children: 'OS' }),
                              _jsx('th', { className: 'px-4 py-3 text-center', children: 'Acao' }),
                            ],
                          }),
                        }),
                        _jsxs('tbody', {
                          className: cn('divide-y', dark ? 'divide-white/5' : 'divide-slate-100'),
                          children: [
                            filteredOccurrences.map((occurrence) =>
                              _jsxs(
                                'tr',
                                {
                                  className: cn(
                                    'cursor-pointer transition-colors',
                                    dark
                                      ? 'hover:bg-white/5 text-slate-300'
                                      : 'hover:bg-slate-50 text-slate-700',
                                  ),
                                  onClick: () => openOccurrenceOrders(occurrence.id),
                                  children: [
                                    _jsx('td', {
                                      className: 'px-4 py-3 font-mono',
                                      children: occurrence.number,
                                    }),
                                    _jsx('td', {
                                      className: 'px-4 py-3',
                                      children: occurrence.type,
                                    }),
                                    _jsx('td', {
                                      className: 'px-4 py-3',
                                      children: occurrence.sector,
                                    }),
                                    _jsx('td', {
                                      className: 'px-4 py-3',
                                      children: _jsx(Badge, {
                                        color: getOccurrenceStatusColor(occurrence.status),
                                        children: occurrence.status,
                                      }),
                                    }),
                                    _jsx('td', {
                                      className: 'px-4 py-3 text-right font-mono',
                                      children: occurrence.orders.length,
                                    }),
                                    _jsx('td', {
                                      className: 'px-4 py-3 text-center',
                                      children: _jsxs('div', {
                                        className: 'flex items-center justify-center gap-1',
                                        children: [
                                          _jsx('button', {
                                            onClick: (e) => {
                                              e.stopPropagation();
                                              openOccurrenceOrders(occurrence.id);
                                            },
                                            className:
                                              'px-3 py-1 rounded border border-cyan-200 bg-cyan-50 text-cyan-700 text-[11px] font-bold hover:bg-cyan-100',
                                            children: 'Abrir',
                                          }),
                                          _jsx('button', {
                                            onClick: (e) => {
                                              e.stopPropagation();
                                              onEditOccurrence(occurrence);
                                            },
                                            className:
                                              'px-3 py-1 rounded border border-indigo-200 bg-indigo-50 text-indigo-700 text-[11px] font-bold hover:bg-indigo-100',
                                            children: 'Editar',
                                          }),
                                        ],
                                      }),
                                    }),
                                  ],
                                },
                                occurrence.id,
                              ),
                            ),
                            filteredOccurrences.length === 0 &&
                              _jsx('tr', {
                                children: _jsx('td', {
                                  colSpan: 6,
                                  className: 'px-4 py-10 text-center text-slate-400',
                                  children: 'Nenhuma ocorrencia encontrada com esses filtros.',
                                }),
                              }),
                          ],
                        }),
                      ],
                    }),
                  }),
                ],
              }),
            ],
          }),
        openedOccurrence &&
          _jsxs('div', {
            className: 'space-y-4',
            children: [
              _jsxs('div', {
                className: cn(
                  'border rounded-xl p-4 shadow-sm',
                  dark
                    ? 'bg-[#1e293b]/60 backdrop-blur-md border-slate-700/50'
                    : 'bg-white border-slate-200',
                ),
                children: [
                  _jsxs('button', {
                    onClick: () => {
                      setOpenedOccurrenceId(null);
                      onOccurrenceFocusChange?.(null);
                    },
                    className:
                      'inline-flex items-center gap-1 text-xs font-semibold text-cyan-700 mb-2 hover:underline',
                    children: [
                      _jsx(ChevronLeft, { size: 14 }),
                      'Voltar para ocorrencias do provedor',
                    ],
                  }),
                  _jsxs('div', {
                    className: 'flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3',
                    children: [
                      _jsxs('div', {
                        children: [
                          _jsxs('div', {
                            className: 'text-xs uppercase font-bold text-slate-400',
                            children: ['Ocorrencia ', openedOccurrence.number],
                          }),
                          _jsx('div', {
                            className: cn(
                              'text-sm mt-1',
                              dark ? 'text-slate-300' : 'text-slate-700',
                            ),
                            children: openedOccurrence.description,
                          }),
                        ],
                      }),
                      _jsxs('div', {
                        className: 'flex items-center gap-2',
                        children: [
                          _jsx(Badge, {
                            color: getOccurrenceStatusColor(openedOccurrence.status),
                            children: openedOccurrence.status,
                          }),
                          _jsx('button', {
                            onClick: () => {
                              setOrderDraft(buildOrderDraft());
                              setDraftUploadNotice('');
                              setShowOpenOrderModal(true);
                            },
                            className: cn(
                              'px-3 py-1 rounded border text-xs font-bold transition-colors',
                              dark
                                ? 'bg-blue-900/30 border-blue-700/50 text-blue-400 hover:bg-blue-900/50'
                                : 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100',
                            ),
                            children: 'Criar O.S',
                          }),
                          _jsx('button', {
                            onClick: () => onEditOccurrence(openedOccurrence),
                            className: cn(
                              'px-3 py-1 rounded border text-xs font-bold transition-colors',
                              dark
                                ? 'bg-indigo-900/30 border-indigo-700/50 text-indigo-400 hover:bg-indigo-900/50'
                                : 'border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100',
                            ),
                            children: 'Editar ocorrencia',
                          }),
                        ],
                      }),
                    ],
                  }),
                  _jsxs('div', {
                    className: cn(
                      'mt-3 border rounded-lg p-3',
                      dark
                        ? 'bg-[#0f172a]/80 backdrop-blur-xl border-slate-700/50'
                        : 'bg-slate-50 border-slate-200',
                    ),
                    children: [
                      _jsx('div', {
                        className: 'text-xs uppercase font-bold text-slate-500 mb-2',
                        children: 'Identificacao da ocorrencia',
                      }),
                      _jsxs('div', {
                        className: 'grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2 text-xs',
                        children: [
                          _jsxs('div', {
                            children: [
                              _jsx('span', {
                                className: 'text-slate-500',
                                children: 'Numero da Ocorrencia:',
                              }),
                              ' ',
                              _jsx('span', {
                                className: cn(
                                  'font-semibold',
                                  dark ? 'text-slate-200' : 'text-slate-800',
                                ),
                                children: openedOccurrence.number,
                              }),
                            ],
                          }),
                          _jsxs('div', {
                            children: [
                              _jsx('span', { className: 'text-slate-500', children: 'Status:' }),
                              ' ',
                              _jsx('span', {
                                className: cn(
                                  'font-semibold',
                                  dark ? 'text-slate-200' : 'text-slate-800',
                                ),
                                children: openedOccurrence.status,
                              }),
                            ],
                          }),
                          _jsxs('div', {
                            children: [
                              _jsx('span', {
                                className: 'text-slate-500',
                                children: 'Tipo de Ocorrencia:',
                              }),
                              ' ',
                              _jsx('span', {
                                className: cn(
                                  'font-semibold',
                                  dark ? 'text-slate-200' : 'text-slate-800',
                                ),
                                children: openedOccurrence.type,
                              }),
                            ],
                          }),
                          _jsxs('div', {
                            children: [
                              _jsx('span', { className: 'text-slate-500', children: 'Origem:' }),
                              ' ',
                              _jsx('span', {
                                className: cn(
                                  'font-semibold',
                                  dark ? 'text-slate-200' : 'text-slate-800',
                                ),
                                children: openedOccurrence.origin,
                              }),
                            ],
                          }),
                          _jsxs('div', {
                            children: [
                              _jsx('span', { className: 'text-slate-500', children: 'Setor:' }),
                              ' ',
                              _jsx('span', {
                                className: cn(
                                  'font-semibold',
                                  dark ? 'text-slate-200' : 'text-slate-800',
                                ),
                                children: openedOccurrence.sector,
                              }),
                            ],
                          }),
                          _jsxs('div', {
                            children: [
                              _jsx('span', {
                                className: 'text-slate-500',
                                children: 'Analista responsavel:',
                              }),
                              ' ',
                              _jsx('span', {
                                className: cn(
                                  'font-semibold',
                                  dark ? 'text-slate-200' : 'text-slate-800',
                                ),
                                children: openedOccurrence.responsible,
                              }),
                            ],
                          }),
                          _jsxs('div', {
                            children: [
                              _jsx('span', {
                                className: 'text-slate-500',
                                children: 'Aberta por:',
                              }),
                              ' ',
                              _jsx('span', {
                                className: cn(
                                  'font-semibold',
                                  dark ? 'text-slate-200' : 'text-slate-800',
                                ),
                                children:
                                  openedOccurrence.openedBy || currentAnalystName || 'Analista',
                              }),
                            ],
                          }),
                          _jsxs('div', {
                            children: [
                              _jsx('span', {
                                className: 'text-slate-500',
                                children: 'Data de Criacao:',
                              }),
                              ' ',
                              _jsx('span', {
                                className: cn(
                                  'font-semibold',
                                  dark ? 'text-slate-200' : 'text-slate-800',
                                ),
                                children: formatDateTime(openedOccurrence.createdAt),
                              }),
                            ],
                          }),
                          _jsxs('div', {
                            children: [
                              _jsx('span', {
                                className: 'text-slate-500',
                                children: 'Qtd. de O.S:',
                              }),
                              ' ',
                              _jsx('span', {
                                className: cn(
                                  'font-semibold',
                                  dark ? 'text-slate-200' : 'text-slate-800',
                                ),
                                children: openedOccurrenceOrders.length,
                              }),
                            ],
                          }),
                          _jsxs('div', {
                            children: [
                              _jsx('span', { className: 'text-slate-500', children: 'Provedor:' }),
                              ' ',
                              _jsx('span', {
                                className: cn(
                                  'font-semibold',
                                  dark ? 'text-slate-200' : 'text-slate-800',
                                ),
                                children: openedOccurrence.provider,
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
                className: cn(
                  'border rounded-xl overflow-hidden shadow-sm',
                  dark
                    ? 'bg-[#1e293b]/60 backdrop-blur-md border-slate-700/50'
                    : 'bg-white border-slate-200',
                ),
                children: [
                  _jsxs('div', {
                    className: cn(
                      'px-5 py-3 border-b flex items-center justify-between gap-3',
                      dark ? 'border-slate-700/50' : 'border-slate-100',
                    ),
                    children: [
                      _jsxs('div', {
                        className: cn(
                          'font-bold text-sm',
                          dark ? 'text-slate-300' : 'text-slate-700',
                        ),
                        children: [
                          'Ordens de servico da ocorrencia (',
                          openedOccurrenceOrders.length,
                          ')',
                        ],
                      }),
                      _jsx('button', {
                        onClick: () => {
                          setOrderDraft(buildOrderDraft());
                          setDraftUploadNotice('');
                          setShowOpenOrderModal(true);
                        },
                        className: cn(
                          'px-3 py-1.5 rounded border text-xs font-bold transition-colors',
                          dark
                            ? 'bg-blue-900/30 border-blue-700/50 text-blue-400 hover:bg-blue-900/50'
                            : 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100',
                        ),
                        children: 'Criar outra O.S',
                      }),
                    ],
                  }),
                  _jsx('div', {
                    className: 'overflow-x-auto custom-scrollbar',
                    children: _jsxs('table', {
                      className: 'w-full text-sm',
                      children: [
                        _jsx('thead', {
                          className: cn(
                            dark ? 'bg-white/5 text-slate-400' : 'bg-slate-50 text-slate-500',
                          ),
                          children: _jsxs('tr', {
                            children: [
                              _jsx('th', {
                                className: 'px-4 py-3 text-left',
                                children: 'Protocolo',
                              }),
                              _jsx('th', { className: 'px-4 py-3 text-left', children: 'Tipo' }),
                              _jsx('th', {
                                className: 'px-4 py-3 text-left',
                                children: 'Prioridade',
                              }),
                              _jsx('th', { className: 'px-4 py-3 text-left', children: 'Status' }),
                              _jsx('th', { className: 'px-4 py-3 text-right', children: 'Prazo' }),
                              _jsx('th', { className: 'px-4 py-3 text-center', children: 'Acao' }),
                            ],
                          }),
                        }),
                        _jsxs('tbody', {
                          className: cn('divide-y', dark ? 'divide-white/5' : 'divide-slate-100'),
                          children: [
                            openedOccurrenceOrders.map((order) =>
                              _jsxs(
                                'tr',
                                {
                                  className: cn(
                                    'cursor-pointer transition-colors',
                                    dark ? 'hover:bg-white/5' : 'hover:bg-slate-50',
                                  ),
                                  onClick: () => onSelectOrder(order),
                                  children: [
                                    _jsx('td', {
                                      className: 'px-4 py-3 font-mono',
                                      children: order.protocol,
                                    }),
                                    _jsx('td', {
                                      className: 'px-4 py-3',
                                      children: _jsx(ServiceTypeBadge, { type: order.type }),
                                    }),
                                    _jsx('td', {
                                      className: 'px-4 py-3',
                                      children: _jsx(PriorityBadge, { priority: order.priority }),
                                    }),
                                    _jsx('td', {
                                      className: 'px-4 py-3',
                                      children: _jsx(StatusBadge, { status: order.status }),
                                    }),
                                    _jsx('td', {
                                      className: cn(
                                        'px-4 py-3 text-right font-mono text-xs',
                                        getDelayHours(order) > 0
                                          ? 'text-rose-600 font-bold'
                                          : 'text-slate-500',
                                      ),
                                      children: formatDateTime(order.deadlineAt),
                                    }),
                                    _jsx('td', {
                                      className: 'px-4 py-3 text-center',
                                      children: _jsx('div', {
                                        className: 'flex items-center justify-center gap-1',
                                        children: _jsx('button', {
                                          onClick: (e) => {
                                            e.stopPropagation();
                                            onEditOrder(order);
                                          },
                                          className: cn(
                                            'px-3 py-1 rounded border text-[11px] font-bold transition-colors',
                                            dark
                                              ? 'bg-indigo-900/30 border-indigo-700/50 text-indigo-400 hover:bg-indigo-900/50'
                                              : 'border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100',
                                          ),
                                          children: 'Editar',
                                        }),
                                      }),
                                    }),
                                  ],
                                },
                                order.id,
                              ),
                            ),
                            openedOccurrenceOrders.length === 0 &&
                              _jsx('tr', {
                                children: _jsx('td', {
                                  colSpan: 6,
                                  className: 'px-4 py-10 text-center text-slate-400',
                                  children: 'Esta ocorrencia ainda nao possui O.S vinculadas.',
                                }),
                              }),
                          ],
                        }),
                      ],
                    }),
                  }),
                ],
              }),
              _jsxs('div', {
                className: cn(
                  'border rounded-xl p-4 shadow-sm',
                  dark
                    ? 'bg-[#1e293b]/60 backdrop-blur-md border-slate-700/50'
                    : 'bg-white border-slate-200',
                ),
                children: [
                  _jsx('div', {
                    className: cn(
                      'text-xs uppercase font-bold mb-2',
                      dark ? 'text-slate-400' : 'text-slate-500',
                    ),
                    children: 'Anotacoes da ocorrencia',
                  }),
                  _jsx('textarea', {
                    value: occurrenceAnnotationText,
                    onChange: (e) => setOccurrenceAnnotationText(e.target.value),
                    rows: 3,
                    placeholder: 'Adicionar anotacao da ocorrencia...',
                    className: cn(
                      'w-full px-3 py-2 border rounded-lg text-sm resize-none',
                      dark
                        ? 'bg-[#0f172a]/80 border-slate-700/50 text-slate-200 placeholder:text-slate-500'
                        : 'bg-white border-slate-300 text-slate-900 placeholder:text-slate-400',
                    ),
                  }),
                  _jsx('div', {
                    className: 'mt-2 flex justify-end',
                    children: _jsx('button', {
                      onClick: submitOccurrenceAnnotation,
                      disabled:
                        occurrenceAnnotationSaving || occurrenceAnnotationText.trim().length < 2,
                      className: cn(
                        'px-3 py-1.5 rounded border text-xs font-bold transition-colors disabled:opacity-50',
                        dark
                          ? 'bg-cyan-900/30 border-cyan-700/50 text-cyan-400 hover:bg-cyan-900/50'
                          : 'border-cyan-200 bg-cyan-50 text-cyan-700 hover:bg-cyan-100',
                      ),
                      children: occurrenceAnnotationSaving ? 'Salvando...' : 'Adicionar anotacao',
                    }),
                  }),
                  _jsxs('div', {
                    className: 'mt-3 space-y-2 max-h-[240px] overflow-y-auto custom-scrollbar',
                    children: [
                      openedOccurrenceAnnotations.map((note) =>
                        _jsxs(
                          'div',
                          {
                            className: cn(
                              'border rounded-lg p-3',
                              dark
                                ? 'border-slate-700/50 bg-[#0f172a]/60'
                                : 'border-slate-200 bg-slate-50',
                            ),
                            children: [
                              _jsxs('div', {
                                className: 'flex items-center justify-between text-xs mb-1',
                                children: [
                                  _jsx('span', {
                                    className: cn(
                                      'font-bold',
                                      dark ? 'text-slate-300' : 'text-slate-700',
                                    ),
                                    children: note.user || 'Sistema',
                                  }),
                                  _jsx('span', {
                                    className: cn(
                                      'font-mono',
                                      dark ? 'text-slate-500' : 'text-slate-400',
                                    ),
                                    children: formatDateTime(note.at),
                                  }),
                                ],
                              }),
                              _jsx('p', {
                                className: cn(
                                  'text-sm whitespace-pre-wrap',
                                  dark ? 'text-slate-400' : 'text-slate-700',
                                ),
                                children: note.text,
                              }),
                            ],
                          },
                          note.id,
                        ),
                      ),
                      openedOccurrenceAnnotations.length === 0 &&
                        _jsx('div', {
                          className: cn('text-xs', dark ? 'text-slate-500' : 'text-slate-400'),
                          children: 'Nenhuma anotacao nesta ocorrencia.',
                        }),
                    ],
                  }),
                ],
              }),
            ],
          }),
        showOpenOccurrenceModal &&
          _jsx(Modal, {
            title: `Nova ocorrencia - ${selectedProvider}`,
            onClose: () => {
              setShowOpenOccurrenceModal(false);
              setDraftUploadNotice('');
            },
            maxWidth: 'max-w-6xl',
            children: _jsxs('form', {
              onSubmit: submitOpenOccurrence,
              className: 'space-y-4 max-h-[75vh] overflow-y-auto custom-scrollbar pr-1',
              children: [
                _jsx('div', { className: sectionTitleClass, children: 'Dados da ocorrencia' }),
                _jsxs('div', {
                  children: [
                    _jsx('label', { className: labelClass, children: 'Provedor vinculado' }),
                    _jsx('input', {
                      value: selectedProvider || '',
                      readOnly: true,
                      className: readOnlyInputClass,
                    }),
                  ],
                }),
                _jsxs('div', {
                  className: 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3',
                  children: [
                    _jsxs('div', {
                      children: [
                        _jsx('label', { className: labelClass, children: 'Tipo de ocorrencia' }),
                        _jsx('select', {
                          value: occurrenceDraft.type,
                          onChange: (e) =>
                            setOccurrenceDraft((p) => ({ ...p, type: e.target.value })),
                          className: inputClass,
                          children: OCCURRENCE_TYPES.map((t) => _jsx('option', { children: t }, t)),
                        }),
                      ],
                    }),
                    _jsxs('div', {
                      children: [
                        _jsx('label', { className: labelClass, children: 'Status' }),
                        _jsx('select', {
                          value: occurrenceDraft.status,
                          onChange: (e) =>
                            setOccurrenceDraft((p) => ({ ...p, status: e.target.value })),
                          className: inputClass,
                          children: OCCURRENCE_STATUS.map((s) =>
                            _jsx('option', { children: s }, s),
                          ),
                        }),
                      ],
                    }),
                    _jsxs('div', {
                      children: [
                        _jsx('label', { className: labelClass, children: 'Setor' }),
                        _jsx('select', {
                          value: occurrenceDraft.sector,
                          onChange: (e) =>
                            setOccurrenceDraft((p) => ({ ...p, sector: e.target.value })),
                          className: inputClass,
                          children: OCCURRENCE_SECTORS.map((s) =>
                            _jsx('option', { children: s }, s),
                          ),
                        }),
                      ],
                    }),
                    _jsxs('div', {
                      children: [
                        _jsx('label', { className: labelClass, children: 'Origem' }),
                        _jsx('select', {
                          value: occurrenceDraft.origin,
                          onChange: (e) =>
                            setOccurrenceDraft((p) => ({ ...p, origin: e.target.value })),
                          className: inputClass,
                          children: OCCURRENCE_ORIGINS.map((o) =>
                            _jsx('option', { children: o }, o),
                          ),
                        }),
                      ],
                    }),
                    _jsxs('div', {
                      children: [
                        _jsx('label', { className: labelClass, children: 'Gerente responsavel' }),
                        _jsx('select', {
                          value: occurrenceDraft.responsible,
                          onChange: (e) =>
                            setOccurrenceDraft((p) => ({ ...p, responsible: e.target.value })),
                          className: inputClass,
                          children: analystOptions.map((a) => _jsx('option', { children: a }, a)),
                        }),
                      ],
                    }),
                    _jsxs('div', {
                      children: [
                        _jsx('label', { className: labelClass, children: 'Aberta por' }),
                        _jsx('input', {
                          value: occurrenceDraft.openedBy,
                          readOnly: true,
                          className: readOnlyInputClass,
                        }),
                      ],
                    }),
                    _jsxs('div', {
                      children: [
                        _jsx('label', { className: labelClass, children: 'Data de criacao' }),
                        _jsx('input', {
                          type: 'date',
                          value: occurrenceDraft.date,
                          onChange: (e) =>
                            setOccurrenceDraft((p) => ({ ...p, date: e.target.value })),
                          className: inputClass,
                        }),
                      ],
                    }),
                    _jsxs('div', {
                      children: [
                        _jsx('label', { className: labelClass, children: 'Hora de criacao' }),
                        _jsx('input', {
                          type: 'time',
                          value: occurrenceDraft.time,
                          onChange: (e) =>
                            setOccurrenceDraft((p) => ({ ...p, time: e.target.value })),
                          className: inputClass,
                        }),
                      ],
                    }),
                  ],
                }),
                _jsxs('div', {
                  children: [
                    _jsx('label', { className: labelClass, children: 'Descricao da ocorrencia' }),
                    _jsx('textarea', {
                      value: occurrenceDraft.description,
                      onChange: (e) =>
                        setOccurrenceDraft((p) => ({ ...p, description: e.target.value })),
                      rows: 3,
                      placeholder: 'Descreva o motivo da ocorrencia',
                      className: inputClass,
                    }),
                  ],
                }),
                _jsx('div', {
                  className: sectionTitleClass,
                  children: 'Primeira O.S da ocorrencia',
                }),
                _jsxs('div', {
                  children: [
                    _jsx('label', { className: labelClass, children: 'Provedor da O.S' }),
                    _jsx('input', {
                      value: selectedProvider || '',
                      readOnly: true,
                      className: readOnlyInputClass,
                    }),
                  ],
                }),
                _jsxs('div', {
                  className: 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3',
                  children: [
                    _jsxs('div', {
                      children: [
                        _jsx('label', { className: labelClass, children: 'Tipo da O.S' }),
                        _jsx('select', {
                          value: orderDraft.type,
                          onChange: (e) => setOrderDraft((p) => ({ ...p, type: e.target.value })),
                          className: inputClass,
                          children: SERVICE_TYPES.map((t) => _jsx('option', { children: t }, t)),
                        }),
                      ],
                    }),
                    _jsxs('div', {
                      children: [
                        _jsx('label', { className: labelClass, children: 'Status' }),
                        _jsx('select', {
                          value: orderDraft.status,
                          onChange: (e) => setOrderDraft((p) => ({ ...p, status: e.target.value })),
                          className: inputClass,
                          children: STATUS_FLOW.map((s) => _jsx('option', { children: s }, s)),
                        }),
                      ],
                    }),
                    _jsxs('div', {
                      children: [
                        _jsx('label', { className: labelClass, children: 'Analista responsavel' }),
                        _jsx('select', {
                          value: orderDraft.analyst,
                          onChange: (e) =>
                            setOrderDraft((p) => ({ ...p, analyst: e.target.value })),
                          className: inputClass,
                          children: analystOptions.map((a) =>
                            _jsx('option', { value: a, children: a }, a),
                          ),
                        }),
                      ],
                    }),
                    _jsxs('div', {
                      children: [
                        _jsx('label', { className: labelClass, children: 'Solicitante' }),
                        _jsx('input', {
                          value: orderDraft.solicitant,
                          onChange: (e) =>
                            setOrderDraft((p) => ({ ...p, solicitant: e.target.value })),
                          placeholder: 'Pessoa do provedor',
                          className: inputClass,
                        }),
                      ],
                    }),
                    _jsxs('div', {
                      children: [
                        _jsx('label', { className: labelClass, children: 'Setor' }),
                        _jsx('select', {
                          value: orderDraft.sector,
                          onChange: (e) => setOrderDraft((p) => ({ ...p, sector: e.target.value })),
                          className: inputClass,
                          children: OCCURRENCE_SECTORS.map((s) =>
                            _jsx('option', { children: s }, s),
                          ),
                        }),
                      ],
                    }),
                    _jsxs('div', {
                      children: [
                        _jsx('label', { className: labelClass, children: 'Origem' }),
                        _jsx('select', {
                          value: orderDraft.origin,
                          onChange: (e) => setOrderDraft((p) => ({ ...p, origin: e.target.value })),
                          className: inputClass,
                          children: OCCURRENCE_ORIGINS.map((o) =>
                            _jsx('option', { children: o }, o),
                          ),
                        }),
                      ],
                    }),
                    _jsxs('div', {
                      children: [
                        _jsx('label', { className: labelClass, children: 'Previsao - Data' }),
                        _jsx('input', {
                          type: 'date',
                          value: orderDraft.deadlineDate,
                          onChange: (e) =>
                            setOrderDraft((p) => ({ ...p, deadlineDate: e.target.value })),
                          className: inputClass,
                        }),
                      ],
                    }),
                    _jsxs('div', {
                      children: [
                        _jsx('label', { className: labelClass, children: 'Previsao - Hora' }),
                        _jsx('input', {
                          type: 'time',
                          value: orderDraft.deadlineTime,
                          onChange: (e) =>
                            setOrderDraft((p) => ({ ...p, deadlineTime: e.target.value })),
                          className: inputClass,
                        }),
                      ],
                    }),
                  ],
                }),
                _jsxs('div', {
                  children: [
                    _jsx('label', { className: labelClass, children: 'Descricao tecnica da O.S' }),
                    _jsx('textarea', {
                      value: orderDraft.description,
                      onChange: (e) =>
                        setOrderDraft((p) => ({ ...p, description: e.target.value })),
                      rows: 3,
                      placeholder: 'Descreva a ordem de servico',
                      className: inputClass,
                    }),
                  ],
                }),
                _jsxs('label', {
                  className: cn(
                    'inline-flex items-center gap-2 text-xs font-semibold',
                    dark ? 'text-slate-300' : 'text-slate-600',
                  ),
                  children: [
                    _jsx('input', {
                      type: 'checkbox',
                      checked: !!orderDraft.hideFromClient,
                      onChange: (e) =>
                        setOrderDraft((p) => ({ ...p, hideFromClient: e.target.checked })),
                      className: cn(
                        'h-3.5 w-3.5 rounded border',
                        dark ? 'border-slate-600 bg-[#1e293b]' : 'border-slate-300',
                      ),
                    }),
                    'Nao mostrar ao cliente',
                  ],
                }),
                _jsxs('div', {
                  className: cn(panelClass, 'space-y-2'),
                  children: [
                    _jsx('div', {
                      className: sectionTitleClass,
                      children: 'Anexos da primeira O.S',
                    }),
                    _jsx('div', {
                      className: cn('text-[11px]', dark ? 'text-slate-400' : 'text-slate-500'),
                      children: 'Ate 10 anexos por O.S, maximo 10MB por arquivo.',
                    }),
                    _jsx('input', {
                      type: 'file',
                      multiple: true,
                      accept: ATTACHMENTS_ACCEPT,
                      onChange: (e) => {
                        addDraftAttachments(e.target.files);
                        e.target.value = '';
                      },
                      className: cn(
                        'block w-full text-xs file:mr-3 file:px-3 file:py-1.5 file:rounded file:border-0 file:text-slate-700',
                        dark
                          ? 'text-slate-300 file:bg-slate-700 file:text-slate-200'
                          : 'text-slate-600 file:bg-slate-200',
                      ),
                    }),
                    draftUploadNotice &&
                      _jsx('div', {
                        className: 'text-xs text-amber-700',
                        children: draftUploadNotice,
                      }),
                    _jsxs('div', {
                      className: 'space-y-1',
                      children: [
                        normalizeAttachments(orderDraft.attachments).map((a) =>
                          _jsxs(
                            'div',
                            {
                              className: cn(
                                'flex items-center justify-between gap-2 border rounded px-2 py-1.5 text-xs',
                                dark
                                  ? 'bg-[#1e293b]/50 border-slate-700 text-slate-300'
                                  : 'bg-white border-slate-200 text-slate-700',
                              ),
                              children: [
                                _jsxs('div', {
                                  className: 'min-w-0',
                                  children: [
                                    _jsx('div', { className: 'truncate', children: a.name }),
                                    _jsxs('div', {
                                      className: dark ? 'text-slate-400' : 'text-slate-400',
                                      children: [
                                        a.mime || 'arquivo',
                                        ' \u2022 ',
                                        formatFileSize(a.size),
                                      ],
                                    }),
                                  ],
                                }),
                                _jsx('button', {
                                  type: 'button',
                                  onClick: () =>
                                    setOrderDraft((p) => ({
                                      ...p,
                                      attachments: normalizeAttachments(p.attachments).filter(
                                        (att) => att.id !== a.id,
                                      ),
                                    })),
                                  className: cn(
                                    'px-2 py-1 border rounded transition-colors',
                                    dark
                                      ? 'border-rose-900/50 bg-rose-950/30 text-rose-400 hover:bg-rose-900/50'
                                      : 'border-rose-200 bg-rose-50 text-rose-700',
                                  ),
                                  children: 'Remover',
                                }),
                              ],
                            },
                            a.id,
                          ),
                        ),
                        normalizeAttachments(orderDraft.attachments).length === 0 &&
                          _jsx('div', {
                            className: cn('text-xs', dark ? 'text-slate-500' : 'text-slate-400'),
                            children: 'Nenhum anexo adicionado.',
                          }),
                      ],
                    }),
                  ],
                }),
                _jsxs('div', {
                  className: 'flex justify-end gap-2 pt-2',
                  children: [
                    _jsx('button', {
                      type: 'button',
                      onClick: () => {
                        setShowOpenOccurrenceModal(false);
                        setDraftUploadNotice('');
                      },
                      className: cn(
                        'px-3 py-2 border rounded-lg text-sm transition-colors',
                        dark
                          ? 'border-slate-700 text-slate-300 hover:bg-slate-800'
                          : 'border-slate-300 text-slate-700 hover:bg-slate-50',
                      ),
                      children: 'Cancelar',
                    }),
                    _jsx('button', {
                      type: 'submit',
                      className:
                        'px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors',
                      children: 'Abrir Ocorrencia e O.S',
                    }),
                  ],
                }),
              ],
            }),
          }),
        showOpenOrderModal &&
          openedOccurrence &&
          _jsx(Modal, {
            title: `Criar O.S - Ocorrencia ${openedOccurrence.number}`,
            onClose: () => {
              setShowOpenOrderModal(false);
              setDraftUploadNotice('');
            },
            maxWidth: 'max-w-5xl',
            children: _jsxs('form', {
              onSubmit: submitOpenOrder,
              className: 'space-y-3 max-h-[75vh] overflow-y-auto custom-scrollbar pr-1',
              children: [
                _jsxs('div', {
                  className: 'grid grid-cols-1 md:grid-cols-2 gap-3',
                  children: [
                    _jsxs('div', {
                      children: [
                        _jsx('label', { className: labelClass, children: 'Ocorrencia' }),
                        _jsx('input', {
                          value: openedOccurrence.number || '',
                          readOnly: true,
                          className: readOnlyInputClass,
                        }),
                      ],
                    }),
                    _jsxs('div', {
                      children: [
                        _jsx('label', { className: labelClass, children: 'Provedor da O.S' }),
                        _jsx('input', {
                          value: selectedProvider || '',
                          readOnly: true,
                          className: readOnlyInputClass,
                        }),
                      ],
                    }),
                  ],
                }),
                _jsxs('div', {
                  className: 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3',
                  children: [
                    _jsxs('div', {
                      children: [
                        _jsx('label', { className: labelClass, children: 'Tipo da O.S' }),
                        _jsx('select', {
                          value: orderDraft.type,
                          onChange: (e) => setOrderDraft((p) => ({ ...p, type: e.target.value })),
                          className: inputClass,
                          children: SERVICE_TYPES.map((t) => _jsx('option', { children: t }, t)),
                        }),
                      ],
                    }),
                    _jsxs('div', {
                      children: [
                        _jsx('label', { className: labelClass, children: 'Prioridade' }),
                        _jsx('select', {
                          value: orderDraft.priority,
                          onChange: (e) =>
                            setOrderDraft((p) => ({ ...p, priority: e.target.value })),
                          className: inputClass,
                          children: PRIORITIES.map((p) => _jsx('option', { children: p }, p)),
                        }),
                      ],
                    }),
                    _jsxs('div', {
                      children: [
                        _jsx('label', { className: labelClass, children: 'Status' }),
                        _jsx('select', {
                          value: orderDraft.status,
                          onChange: (e) => setOrderDraft((p) => ({ ...p, status: e.target.value })),
                          className: inputClass,
                          children: STATUS_FLOW.map((s) => _jsx('option', { children: s }, s)),
                        }),
                      ],
                    }),
                    _jsxs('div', {
                      children: [
                        _jsx('label', { className: labelClass, children: 'Analista responsavel' }),
                        _jsx('select', {
                          value: orderDraft.analyst,
                          onChange: (e) =>
                            setOrderDraft((p) => ({ ...p, analyst: e.target.value })),
                          className: inputClass,
                          children: analystOptions.map((a) =>
                            _jsx('option', { value: a, children: a }, a),
                          ),
                        }),
                      ],
                    }),
                    _jsxs('div', {
                      children: [
                        _jsx('label', { className: labelClass, children: 'Solicitante' }),
                        _jsx('input', {
                          value: orderDraft.solicitant,
                          onChange: (e) =>
                            setOrderDraft((p) => ({ ...p, solicitant: e.target.value })),
                          placeholder: 'Pessoa do provedor',
                          className: inputClass,
                        }),
                      ],
                    }),
                    _jsxs('div', {
                      children: [
                        _jsx('label', { className: labelClass, children: 'Setor' }),
                        _jsx('select', {
                          value: orderDraft.sector,
                          onChange: (e) => setOrderDraft((p) => ({ ...p, sector: e.target.value })),
                          className: inputClass,
                          children: OCCURRENCE_SECTORS.map((s) =>
                            _jsx('option', { children: s }, s),
                          ),
                        }),
                      ],
                    }),
                    _jsxs('div', {
                      children: [
                        _jsx('label', { className: labelClass, children: 'Origem' }),
                        _jsx('select', {
                          value: orderDraft.origin,
                          onChange: (e) => setOrderDraft((p) => ({ ...p, origin: e.target.value })),
                          className: inputClass,
                          children: OCCURRENCE_ORIGINS.map((o) =>
                            _jsx('option', { children: o }, o),
                          ),
                        }),
                      ],
                    }),
                    _jsxs('div', {
                      children: [
                        _jsx('label', { className: labelClass, children: 'Previsao - Data' }),
                        _jsx('input', {
                          type: 'date',
                          value: orderDraft.deadlineDate,
                          onChange: (e) =>
                            setOrderDraft((p) => ({ ...p, deadlineDate: e.target.value })),
                          className: inputClass,
                        }),
                      ],
                    }),
                    _jsxs('div', {
                      children: [
                        _jsx('label', { className: labelClass, children: 'Previsao - Hora' }),
                        _jsx('input', {
                          type: 'time',
                          value: orderDraft.deadlineTime,
                          onChange: (e) =>
                            setOrderDraft((p) => ({ ...p, deadlineTime: e.target.value })),
                          className: inputClass,
                        }),
                      ],
                    }),
                  ],
                }),
                _jsxs('div', {
                  children: [
                    _jsx('label', { className: labelClass, children: 'Descricao tecnica da O.S' }),
                    _jsx('textarea', {
                      value: orderDraft.description,
                      onChange: (e) =>
                        setOrderDraft((p) => ({ ...p, description: e.target.value })),
                      rows: 3,
                      placeholder: 'Descreva a ordem de servico',
                      className: inputClass,
                    }),
                  ],
                }),
                _jsxs('label', {
                  className: cn(
                    'inline-flex items-center gap-2 text-xs font-semibold',
                    dark ? 'text-slate-300' : 'text-slate-600',
                  ),
                  children: [
                    _jsx('input', {
                      type: 'checkbox',
                      checked: !!orderDraft.hideFromClient,
                      onChange: (e) =>
                        setOrderDraft((p) => ({ ...p, hideFromClient: e.target.checked })),
                      className: cn(
                        'h-3.5 w-3.5 rounded border',
                        dark ? 'border-slate-600 bg-[#1e293b]' : 'border-slate-300',
                      ),
                    }),
                    'Nao mostrar ao cliente',
                  ],
                }),
                _jsxs('div', {
                  className: cn(panelClass, 'space-y-2'),
                  children: [
                    _jsx('div', { className: sectionTitleClass, children: 'Anexos da O.S' }),
                    _jsx('div', {
                      className: cn('text-[11px]', dark ? 'text-slate-400' : 'text-slate-500'),
                      children: 'Ate 10 anexos por O.S, maximo 10MB por arquivo.',
                    }),
                    _jsx('input', {
                      type: 'file',
                      multiple: true,
                      accept: ATTACHMENTS_ACCEPT,
                      onChange: (e) => {
                        addDraftAttachments(e.target.files);
                        e.target.value = '';
                      },
                      className: cn(
                        'block w-full text-xs file:mr-3 file:px-3 file:py-1.5 file:rounded file:border-0 file:text-slate-700',
                        dark
                          ? 'text-slate-300 file:bg-slate-700 file:text-slate-200'
                          : 'text-slate-600 file:bg-slate-200',
                      ),
                    }),
                    draftUploadNotice &&
                      _jsx('div', {
                        className: 'text-xs text-amber-700',
                        children: draftUploadNotice,
                      }),
                    _jsxs('div', {
                      className: 'space-y-1',
                      children: [
                        normalizeAttachments(orderDraft.attachments).map((a) =>
                          _jsxs(
                            'div',
                            {
                              className: cn(
                                'flex items-center justify-between gap-2 border rounded px-2 py-1.5 text-xs',
                                dark
                                  ? 'bg-[#1e293b]/50 border-slate-700 text-slate-300'
                                  : 'bg-white border-slate-200 text-slate-700',
                              ),
                              children: [
                                _jsxs('div', {
                                  className: 'min-w-0',
                                  children: [
                                    _jsx('div', { className: 'truncate', children: a.name }),
                                    _jsxs('div', {
                                      className: dark ? 'text-slate-400' : 'text-slate-400',
                                      children: [
                                        a.mime || 'arquivo',
                                        ' \u2022 ',
                                        formatFileSize(a.size),
                                      ],
                                    }),
                                  ],
                                }),
                                _jsx('button', {
                                  type: 'button',
                                  onClick: () =>
                                    setOrderDraft((p) => ({
                                      ...p,
                                      attachments: normalizeAttachments(p.attachments).filter(
                                        (att) => att.id !== a.id,
                                      ),
                                    })),
                                  className: cn(
                                    'px-2 py-1 border rounded transition-colors',
                                    dark
                                      ? 'border-rose-900/50 bg-rose-950/30 text-rose-400 hover:bg-rose-900/50'
                                      : 'border-rose-200 bg-rose-50 text-rose-700',
                                  ),
                                  children: 'Remover',
                                }),
                              ],
                            },
                            a.id,
                          ),
                        ),
                        normalizeAttachments(orderDraft.attachments).length === 0 &&
                          _jsx('div', {
                            className: cn('text-xs', dark ? 'text-slate-500' : 'text-slate-400'),
                            children: 'Nenhum anexo adicionado.',
                          }),
                      ],
                    }),
                  ],
                }),
                _jsxs('div', {
                  className: 'flex justify-end gap-2 pt-2',
                  children: [
                    _jsx('button', {
                      type: 'button',
                      onClick: () => {
                        setShowOpenOrderModal(false);
                        setDraftUploadNotice('');
                      },
                      className: cn(
                        'px-3 py-2 border rounded-lg text-sm transition-colors',
                        dark
                          ? 'border-slate-700 text-slate-300 hover:bg-slate-800'
                          : 'border-slate-300 text-slate-700 hover:bg-slate-50',
                      ),
                      children: 'Cancelar',
                    }),
                    _jsx('button', {
                      type: 'submit',
                      className:
                        'px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors',
                      children: 'Criar O.S',
                    }),
                  ],
                }),
              ],
            }),
          }),
      ],
    });
  }
  return _jsxs('div', {
    className: 'space-y-5',
    children: [
      _jsxs('div', {
        className: 'flex flex-col lg:flex-row lg:items-center justify-between gap-3',
        children: [
          _jsxs('div', {
            children: [
              _jsx('h2', {
                className: cn('text-2xl font-bold', dark ? 'text-slate-100' : 'text-slate-900'),
                children: 'Provedores',
              }),
              _jsx('p', {
                className: cn('text-sm', dark ? 'text-slate-400' : 'text-slate-500'),
                children: 'Clique no provedor para abrir as ocorrencias e suas O.S.',
              }),
            ],
          }),
        ],
      }),
      _jsxs('div', {
        className: 'grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-6 gap-4',
        children: [
          _jsxs('div', {
            className: cn(
              'border rounded-xl p-4 shadow-sm',
              dark
                ? 'bg-[#1e293b]/60 backdrop-blur-md border-slate-700/50'
                : 'bg-white border-slate-200',
            ),
            children: [
              _jsx('div', {
                className: cn(
                  'text-xs uppercase font-bold',
                  dark ? 'text-slate-500' : 'text-slate-400',
                ),
                children: 'Provedores',
              }),
              _jsx('div', {
                className: cn(
                  'text-3xl font-bold mt-2',
                  dark ? 'text-slate-200' : 'text-slate-800',
                ),
                children: providerListSummary.providers,
              }),
            ],
          }),
          _jsxs('div', {
            className: cn(
              'border rounded-xl p-4 shadow-sm',
              dark
                ? 'bg-[#1e293b]/60 backdrop-blur-md border-slate-700/50'
                : 'bg-white border-slate-200',
            ),
            children: [
              _jsx('div', {
                className: cn(
                  'text-xs uppercase font-bold',
                  dark ? 'text-slate-500' : 'text-slate-400',
                ),
                children: 'Ocorrencias',
              }),
              _jsx('div', {
                className: cn(
                  'text-3xl font-bold mt-2',
                  dark ? 'text-slate-200' : 'text-slate-800',
                ),
                children: providerListSummary.occurrences,
              }),
            ],
          }),
          _jsxs('div', {
            className: cn(
              'border rounded-xl p-4 shadow-sm',
              dark
                ? 'bg-[#1e293b]/60 backdrop-blur-md border-slate-700/50'
                : 'bg-white border-slate-200',
            ),
            children: [
              _jsx('div', {
                className: cn(
                  'text-xs uppercase font-bold',
                  dark ? 'text-slate-500' : 'text-slate-400',
                ),
                children: 'Total O.S',
              }),
              _jsx('div', {
                className: cn(
                  'text-3xl font-bold mt-2',
                  dark ? 'text-slate-200' : 'text-slate-800',
                ),
                children: providerListSummary.orders,
              }),
            ],
          }),
          _jsxs('div', {
            className: cn(
              'border rounded-xl p-4 shadow-sm',
              dark
                ? 'bg-[#1e293b]/60 backdrop-blur-md border-slate-700/50'
                : 'bg-white border-slate-200',
            ),
            children: [
              _jsx('div', {
                className: 'text-xs uppercase font-bold text-slate-400',
                children: 'Ativas',
              }),
              _jsx('div', {
                className: cn(
                  'text-3xl font-bold mt-2',
                  dark ? 'text-indigo-400' : 'text-indigo-700',
                ),
                children: providerListSummary.active,
              }),
            ],
          }),
          _jsxs('div', {
            className: cn(
              'border rounded-xl p-4 shadow-sm',
              dark
                ? 'bg-[#1e293b]/60 backdrop-blur-md border-rose-500/20'
                : 'bg-white border-rose-200',
            ),
            children: [
              _jsx('div', {
                className: 'text-xs uppercase font-bold text-rose-500',
                children: 'Atrasadas',
              }),
              _jsx('div', {
                className: 'text-3xl font-bold text-rose-600 mt-2',
                children: providerListSummary.delayed,
              }),
            ],
          }),
          _jsxs('div', {
            className: cn(
              'border rounded-xl p-4 shadow-sm',
              dark
                ? 'bg-[#1e293b]/60 backdrop-blur-md border-amber-500/20'
                : 'bg-white border-amber-200',
            ),
            children: [
              _jsx('div', {
                className: 'text-xs uppercase font-bold text-amber-600',
                children: 'Alta/Critica',
              }),
              _jsx('div', {
                className: 'text-3xl font-bold text-amber-600 mt-2',
                children: providerListSummary.critical,
              }),
            ],
          }),
        ],
      }),
      _jsx('div', {
        className: cn(
          'border rounded-xl p-4',
          dark
            ? 'bg-[#1e293b]/60 backdrop-blur-md border-slate-700/50'
            : 'bg-white border-slate-200',
        ),
        children: _jsxs('div', {
          className: 'relative w-full md:w-72',
          children: [
            _jsx(Search, {
              size: 14,
              className: cn(
                'absolute left-3 top-1/2 -translate-y-1/2',
                dark ? 'text-slate-500' : 'text-slate-400',
              ),
            }),
            _jsx('input', {
              value: search,
              onChange: (e) => setSearch(e.target.value),
              placeholder: 'Buscar provedor...',
              className: cn(
                'w-full pl-9 pr-3 py-2 border rounded-lg text-sm transition-colors',
                dark
                  ? 'bg-[#0f172a]/80 backdrop-blur-xl border-slate-700/50 text-slate-200 placeholder:text-slate-600 focus:border-blue-500/50'
                  : 'bg-white border-slate-300 text-slate-900 focus:border-blue-500',
              ),
            }),
          ],
        }),
      }),
      _jsx('div', {
        className: cn(
          'border rounded-xl overflow-hidden shadow-sm',
          dark
            ? 'bg-[#1e293b]/60 backdrop-blur-md border-slate-700/50'
            : 'bg-white border-slate-200',
        ),
        children: _jsx('div', {
          className: 'overflow-x-auto custom-scrollbar',
          children: _jsxs('table', {
            className: 'w-full text-sm',
            children: [
              _jsx('thead', {
                className: cn(dark ? 'bg-white/5 text-slate-400' : 'bg-slate-50 text-slate-500'),
                children: _jsxs('tr', {
                  children: [
                    _jsx('th', { className: 'px-5 py-3 text-left', children: 'Provedor' }),
                    _jsx('th', { className: 'px-5 py-3 text-right', children: 'Ocorrencias' }),
                    _jsx('th', { className: 'px-5 py-3 text-right', children: 'Total OS' }),
                    _jsx('th', { className: 'px-5 py-3 text-right', children: 'Ativas' }),
                    _jsx('th', { className: 'px-5 py-3 text-right', children: 'Atrasadas' }),
                    _jsx('th', { className: 'px-5 py-3 text-right', children: 'Alta/Critica' }),
                    _jsx('th', { className: 'px-5 py-3 text-center', children: 'Entrar' }),
                  ],
                }),
              }),
              _jsxs('tbody', {
                className: cn('divide-y', dark ? 'divide-white/5' : 'divide-slate-100'),
                children: [
                  filteredProviders.map((p) =>
                    _jsxs(
                      'tr',
                      {
                        className: cn(
                          'cursor-pointer transition-colors',
                          dark ? 'hover:bg-white/5' : 'hover:bg-slate-50',
                        ),
                        onClick: () => openProviderPanel(p.provider),
                        children: [
                          _jsx('td', {
                            className: cn(
                              'px-5 py-3 font-medium',
                              dark ? 'text-slate-200' : 'text-slate-800',
                            ),
                            children: p.provider,
                          }),
                          _jsx('td', {
                            className: 'px-5 py-3 text-right font-mono',
                            children: p.occurrences,
                          }),
                          _jsx('td', {
                            className: 'px-5 py-3 text-right font-mono',
                            children: p.orders,
                          }),
                          _jsx('td', {
                            className: 'px-5 py-3 text-right font-mono',
                            children: p.active,
                          }),
                          _jsx('td', {
                            className: cn(
                              'px-5 py-3 text-right font-mono font-bold',
                              p.delayed > 0 ? 'text-rose-600' : 'text-slate-400',
                            ),
                            children: p.delayed,
                          }),
                          _jsx('td', {
                            className: 'px-5 py-3 text-right font-mono',
                            children: p.critical,
                          }),
                          _jsx('td', {
                            className: 'px-5 py-3 text-center',
                            children: _jsx('button', {
                              onClick: (e) => {
                                e.stopPropagation();
                                openProviderPanel(p.provider);
                              },
                              className:
                                'px-3 py-1 rounded border border-cyan-200 bg-cyan-50 text-cyan-700 text-[11px] font-bold hover:bg-cyan-100',
                              children: 'Abrir painel',
                            }),
                          }),
                        ],
                      },
                      p.provider,
                    ),
                  ),
                  filteredProviders.length === 0 &&
                    _jsx('tr', {
                      children: _jsx('td', {
                        colSpan: 7,
                        className: 'px-5 py-10 text-center text-slate-400',
                        children: 'Nenhum provedor encontrado.',
                      }),
                    }),
                ],
              }),
            ],
          }),
        }),
      }),
    ],
  });
};
const TechniciansView = ({ orders, onSelectOrder }) => {
  const [period, setPeriod] = useState('Tudo');
  const [tab, setTab] = useState('performance');
  const [search, setSearch] = useState('');
  const [selectedTech, setSelectedTech] = useState(null);
  const scoped = useMemo(() => filterByPeriod(orders, period), [orders, period]);
  const rows = useMemo(() => buildTechRows(scoped), [scoped]);
  const filteredRows = useMemo(
    () => rows.filter((r) => r.name.toLowerCase().includes(search.toLowerCase())),
    [rows, search],
  );
  const overdueOrders = useMemo(
    () =>
      scoped
        .filter((o) => isActive(o) && getDelayHours(o) > 0)
        .sort((a, b) => getDelayHours(b) - getDelayHours(a)),
    [scoped],
  );
  const dueTodayOrders = useMemo(
    () =>
      scoped
        .filter(
          (o) =>
            isActive(o) &&
            o.deadlineAt >= startOfDay(Date.now()) &&
            o.deadlineAt <= endOfDay(Date.now()),
        )
        .sort((a, b) => a.deadlineAt - b.deadlineAt),
    [scoped],
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
    return Array.from(map.values())
      .map((r) => ({
        type: r.type,
        total: r.total,
        techs: r.techSet.size,
        ratio: r.techSet.size ? (r.total / r.techSet.size).toFixed(1) : '0.0',
      }))
      .sort((a, b) => b.total - a.total);
  }, [scoped]);
  const { dark } = useTheme();
  return _jsxs('div', {
    className: 'space-y-5',
    children: [
      _jsxs('div', {
        className: 'flex flex-col lg:flex-row lg:items-center justify-between gap-3',
        children: [
          _jsxs('div', {
            children: [
              _jsx('h2', {
                className: cn('text-2xl font-bold', dark ? 'text-slate-100' : 'text-slate-900'),
                children: 'Tecnicos',
              }),
              _jsx('p', {
                className: cn('text-sm', dark ? 'text-slate-400' : 'text-slate-500'),
                children: 'Performance, atrasos, agenda e cobertura por tipo.',
              }),
            ],
          }),
          _jsx(PeriodTabs, { value: period, onChange: setPeriod }),
        ],
      }),
      _jsxs('div', {
        className: cn(
          'border rounded-xl p-4 flex flex-col md:flex-row gap-3 md:items-center justify-between',
          dark
            ? 'bg-[#1e293b]/60 backdrop-blur-md border-slate-700/50'
            : 'bg-white border-slate-200',
        ),
        children: [
          _jsx('div', {
            className: 'flex gap-2 flex-wrap',
            children: [
              { id: 'performance', label: 'Performance' },
              { id: 'delays', label: 'OS Atrasadas' },
              { id: 'agenda', label: 'Agenda Hoje' },
              { id: 'coverage', label: 'Cobertura' },
            ].map((t) =>
              _jsx(
                'button',
                {
                  onClick: () => setTab(t.id),
                  className: cn(
                    'px-3 py-1.5 rounded-full text-xs font-bold border transition-colors',
                    tab === t.id
                      ? dark
                        ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-400'
                        : 'bg-cyan-50 border-cyan-200 text-cyan-700'
                      : dark
                        ? 'bg-transparent border-slate-700/50 text-slate-400 hover:bg-white/5'
                        : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50',
                  ),
                  children: t.label,
                },
                t.id,
              ),
            ),
          }),
          _jsxs('div', {
            className: 'relative w-full md:w-64',
            children: [
              _jsx(Search, {
                size: 14,
                className: cn(
                  'absolute left-3 top-1/2 -translate-y-1/2',
                  dark ? 'text-slate-500' : 'text-slate-400',
                ),
              }),
              _jsx('input', {
                value: search,
                onChange: (e) => setSearch(e.target.value),
                placeholder: 'Buscar tecnico...',
                className: cn(
                  'w-full pl-9 pr-3 py-2 border rounded-lg text-sm transition-colors',
                  dark
                    ? 'bg-[#0f172a]/80 backdrop-blur-xl border-slate-700/50 text-slate-200 placeholder:text-slate-600 focus:border-blue-500/50'
                    : 'bg-white border-slate-300 text-slate-900 focus:border-blue-500',
                ),
              }),
            ],
          }),
        ],
      }),
      tab === 'performance' &&
        _jsx('div', {
          className: cn(
            'border rounded-xl overflow-hidden shadow-sm',
            dark
              ? 'bg-[#1e293b]/60 backdrop-blur-md border-slate-700/50'
              : 'bg-white border-slate-200',
          ),
          children: _jsx('div', {
            className: 'overflow-x-auto custom-scrollbar',
            children: _jsxs('table', {
              className: 'w-full text-sm',
              children: [
                _jsx('thead', {
                  className: cn(dark ? 'bg-white/5 text-slate-400' : 'bg-slate-50 text-slate-500'),
                  children: _jsxs('tr', {
                    children: [
                      _jsx('th', { className: 'px-5 py-3 text-left', children: 'Tecnico' }),
                      _jsx('th', { className: 'px-5 py-3 text-right', children: 'Criadas' }),
                      _jsx('th', { className: 'px-5 py-3 text-right', children: 'Ativas' }),
                      _jsx('th', { className: 'px-5 py-3 text-right', children: 'On-time %' }),
                      _jsx('th', { className: 'px-5 py-3 text-right', children: 'Atrasadas' }),
                      _jsx('th', { className: 'px-5 py-3 text-right', children: 'TMA' }),
                      _jsx('th', { className: 'px-5 py-3 text-right', children: 'Status' }),
                    ],
                  }),
                }),
                _jsxs('tbody', {
                  className: cn('divide-y', dark ? 'divide-white/5' : 'divide-slate-100'),
                  children: [
                    filteredRows.map((r) =>
                      _jsxs(
                        'tr',
                        {
                          children: [
                            _jsxs('td', {
                              className: 'px-5 py-3',
                              children: [
                                _jsx('div', {
                                  className: cn(
                                    'font-bold',
                                    dark ? 'text-slate-200' : 'text-slate-800',
                                  ),
                                  children: r.name,
                                }),
                                _jsx('div', {
                                  className: cn(
                                    'text-xs',
                                    dark ? 'text-slate-500' : 'text-slate-500',
                                  ),
                                  children: r.specialization,
                                }),
                              ],
                            }),
                            _jsx('td', {
                              className: 'px-5 py-3 text-right font-mono',
                              children: r.created,
                            }),
                            _jsx('td', {
                              className: 'px-5 py-3 text-right font-mono',
                              children: r.active,
                            }),
                            _jsxs('td', {
                              className:
                                'px-5 py-3 text-right font-mono text-emerald-600 font-bold',
                              children: [r.onTimePct, '%'],
                            }),
                            _jsx('td', {
                              className: cn(
                                'px-5 py-3 text-right font-mono font-bold',
                                r.delayed > 0 ? 'text-rose-600' : 'text-slate-300',
                              ),
                              children: r.delayed,
                            }),
                            _jsx('td', {
                              className: 'px-5 py-3 text-right font-mono text-slate-700',
                              children: r.avgDuration,
                            }),
                            _jsx('td', {
                              className: 'px-5 py-3 text-right',
                              children: _jsx(Badge, {
                                color: r.status === 'busy' ? 'orange' : 'green',
                                children: r.status === 'busy' ? 'Ocupado' : 'Disponivel',
                              }),
                            }),
                          ],
                        },
                        r.name,
                      ),
                    ),
                    filteredRows.length === 0 &&
                      _jsx('tr', {
                        children: _jsx('td', {
                          colSpan: 7,
                          className: 'px-5 py-10 text-center text-slate-400',
                          children: 'Nenhum tecnico encontrado.',
                        }),
                      }),
                  ],
                }),
              ],
            }),
          }),
        }),
      tab === 'delays' &&
        _jsx('div', {
          className: cn(
            'border rounded-xl overflow-hidden shadow-sm',
            dark
              ? 'bg-[#1e293b]/60 backdrop-blur-md border-slate-700/50'
              : 'bg-white border-slate-200',
          ),
          children: _jsx('div', {
            className: 'overflow-x-auto custom-scrollbar',
            children: _jsxs('table', {
              className: 'w-full text-sm',
              children: [
                _jsx('thead', {
                  className: cn(dark ? 'bg-white/5 text-slate-400' : 'bg-slate-50 text-slate-500'),
                  children: _jsxs('tr', {
                    children: [
                      _jsx('th', { className: 'px-5 py-3 text-left', children: 'Protocolo' }),
                      _jsx('th', { className: 'px-5 py-3 text-left', children: 'Tecnico' }),
                      _jsx('th', { className: 'px-5 py-3 text-left', children: 'Provedor' }),
                      _jsx('th', { className: 'px-5 py-3 text-left', children: 'Tipo' }),
                      _jsx('th', { className: 'px-5 py-3 text-right', children: 'Delay (h)' }),
                      _jsx('th', { className: 'px-5 py-3 text-center', children: 'Acao' }),
                    ],
                  }),
                }),
                _jsxs('tbody', {
                  className: cn('divide-y', dark ? 'divide-white/5' : 'divide-slate-100'),
                  children: [
                    overdueOrders.map((o) =>
                      _jsxs(
                        'tr',
                        {
                          children: [
                            _jsx('td', { className: 'px-5 py-3 font-mono', children: o.protocol }),
                            _jsx('td', {
                              className: 'px-5 py-3',
                              children: _jsx('button', {
                                onClick: () => setSelectedTech(o.tech),
                                className: 'text-cyan-700 font-semibold hover:underline',
                                children: o.tech || '-',
                              }),
                            }),
                            _jsx('td', { className: 'px-5 py-3', children: o.provider }),
                            _jsx('td', {
                              className: 'px-5 py-3',
                              children: _jsx(ServiceTypeBadge, { type: o.type }),
                            }),
                            _jsx('td', {
                              className: 'px-5 py-3 text-right font-mono font-bold text-rose-600',
                              children: getDelayHours(o).toFixed(2),
                            }),
                            _jsx('td', {
                              className: 'px-5 py-3 text-center',
                              children: _jsx('button', {
                                onClick: () => onSelectOrder(o),
                                className:
                                  'px-3 py-1 border border-cyan-200 bg-cyan-50 text-cyan-700 rounded text-xs font-bold',
                                children: 'Abrir',
                              }),
                            }),
                          ],
                        },
                        o.id,
                      ),
                    ),
                    overdueOrders.length === 0 &&
                      _jsx('tr', {
                        children: _jsx('td', {
                          colSpan: 6,
                          className: 'px-5 py-10 text-center text-slate-400',
                          children: 'Nenhum atraso na janela.',
                        }),
                      }),
                  ],
                }),
              ],
            }),
          }),
        }),
      tab === 'agenda' &&
        _jsx('div', {
          className: cn(
            'border rounded-xl overflow-hidden shadow-sm',
            dark
              ? 'bg-[#1e293b]/60 backdrop-blur-md border-slate-700/50'
              : 'bg-white border-slate-200',
          ),
          children: _jsx('div', {
            className: 'overflow-x-auto custom-scrollbar',
            children: _jsxs('table', {
              className: 'w-full text-sm',
              children: [
                _jsx('thead', {
                  className: cn(dark ? 'bg-white/5 text-slate-400' : 'bg-slate-50 text-slate-500'),
                  children: _jsxs('tr', {
                    children: [
                      _jsx('th', { className: 'px-5 py-3 text-left', children: 'Protocolo' }),
                      _jsx('th', { className: 'px-5 py-3 text-left', children: 'Tecnico' }),
                      _jsx('th', { className: 'px-5 py-3 text-left', children: 'Provedor' }),
                      _jsx('th', { className: 'px-5 py-3 text-left', children: 'Tipo' }),
                      _jsx('th', { className: 'px-5 py-3 text-right', children: 'Prazo' }),
                      _jsx('th', { className: 'px-5 py-3 text-center', children: 'Acao' }),
                    ],
                  }),
                }),
                _jsxs('tbody', {
                  className: cn('divide-y', dark ? 'divide-white/5' : 'divide-slate-100'),
                  children: [
                    dueTodayOrders.map((o) =>
                      _jsxs(
                        'tr',
                        {
                          children: [
                            _jsx('td', { className: 'px-5 py-3 font-mono', children: o.protocol }),
                            _jsx('td', { className: 'px-5 py-3', children: o.tech || '-' }),
                            _jsx('td', { className: 'px-5 py-3', children: o.provider }),
                            _jsx('td', {
                              className: 'px-5 py-3',
                              children: _jsx(ServiceTypeBadge, { type: o.type }),
                            }),
                            _jsx('td', {
                              className: 'px-5 py-3 text-right font-mono text-amber-700 font-bold',
                              children: formatDateTime(o.deadlineAt),
                            }),
                            _jsx('td', {
                              className: 'px-5 py-3 text-center',
                              children: _jsx('button', {
                                onClick: () => onSelectOrder(o),
                                className:
                                  'px-3 py-1 border border-cyan-200 bg-cyan-50 text-cyan-700 rounded text-xs font-bold',
                                children: 'Abrir',
                              }),
                            }),
                          ],
                        },
                        o.id,
                      ),
                    ),
                    dueTodayOrders.length === 0 &&
                      _jsx('tr', {
                        children: _jsx('td', {
                          colSpan: 6,
                          className: 'px-5 py-10 text-center text-slate-400',
                          children: 'Sem atividades para hoje.',
                        }),
                      }),
                  ],
                }),
              ],
            }),
          }),
        }),
      tab === 'coverage' &&
        _jsx('div', {
          className: cn(
            'border rounded-xl overflow-hidden shadow-sm',
            dark
              ? 'bg-[#1e293b]/60 backdrop-blur-md border-slate-700/50'
              : 'bg-white border-slate-200',
          ),
          children: _jsx('div', {
            className: 'overflow-x-auto custom-scrollbar',
            children: _jsxs('table', {
              className: 'w-full text-sm',
              children: [
                _jsx('thead', {
                  className: cn(dark ? 'bg-white/5 text-slate-400' : 'bg-slate-50 text-slate-500'),
                  children: _jsxs('tr', {
                    children: [
                      _jsx('th', { className: 'px-5 py-3 text-left', children: 'Tipo' }),
                      _jsx('th', { className: 'px-5 py-3 text-right', children: 'Total' }),
                      _jsx('th', { className: 'px-5 py-3 text-right', children: 'Tecnicos' }),
                      _jsx('th', { className: 'px-5 py-3 text-right', children: 'Ratio' }),
                    ],
                  }),
                }),
                _jsx('tbody', {
                  className: cn('divide-y', dark ? 'divide-white/5' : 'divide-slate-100'),
                  children: coverageRows.map((r) =>
                    _jsxs(
                      'tr',
                      {
                        children: [
                          _jsx('td', {
                            className: 'px-5 py-3',
                            children: _jsx(ServiceTypeBadge, { type: r.type }),
                          }),
                          _jsx('td', {
                            className: 'px-5 py-3 text-right font-mono',
                            children: r.total,
                          }),
                          _jsx('td', {
                            className: 'px-5 py-3 text-right font-mono',
                            children: r.techs,
                          }),
                          _jsx('td', {
                            className: 'px-5 py-3 text-right font-mono',
                            children: r.ratio,
                          }),
                        ],
                      },
                      r.type,
                    ),
                  ),
                }),
              ],
            }),
          }),
        }),
      selectedTech &&
        _jsx(TechnicianDelayModal, {
          techName: selectedTech,
          orders: scoped,
          onClose: () => setSelectedTech(null),
          onSelectOrder: onSelectOrder,
        }),
    ],
  });
};
const KnowledgeBaseView = ({ onToast, section = 'ajustpedia' }) => {
  const credentialsLabMode = section === 'credentials_lab';
  const [tab, setTab] = useState(
    section === 'credentials' || section === 'credentials_lab' ? 'credenciais' : 'ajustpedia',
  );
  const [search, setSearch] = useState('');
  const [tag, setTag] = useState('Todos');
  const [author, setAuthor] = useState('Todos');
  const [expandedId, setExpandedId] = useState(1);
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
  const [editingEntryId, setEditingEntryId] = useState(null);
  const [deletingEntryId, setDeletingEntryId] = useState(null);
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
  const normalizedRole = String(currentUserRole || '').toLowerCase();
  const canCreateCredential = ['super_admin', 'gerente', 'manager'].includes(normalizedRole);
  const canManageKnowledge = ['super_admin', 'gerente', 'manager', 'analista', 'analyst'].includes(
    normalizedRole,
  );
  const tags = useMemo(() => ['Todos', ...new Set(entries.flatMap((e) => e.tags))], [entries]);
  const authors = useMemo(() => ['Todos', ...new Set(entries.map((e) => e.author))], [entries]);
  const normalizeArticleHeader = (value) =>
    String(value || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  const summarizeDescription = (text) => {
    const firstLine =
      String(text || '')
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
      const command = lines
        .slice(cmdIdx + 1)
        .join('\n')
        .trim();
      const description =
        descIdx >= 0 && descIdx < cmdIdx
          ? lines
              .slice(descIdx + 1, cmdIdx)
              .join('\n')
              .trim()
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
    const normalizedEnv = /^sgp cliente\\s+\\d+$/i.test(rawEnv) ? '' : rawEnv || 'Nao informado';
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
      const response = await fetch(`/api/knowledge/credentials/providers?${params.toString()}`, {
        cache: 'no-store',
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || 'Falha ao carregar provedores de credenciais.');
      }
      setProviderSummaries(Array.isArray(payload?.items) ? payload.items : []);
    } catch (error) {
      setProviderSummaries([]);
      setSyncError(
        error instanceof Error ? error.message : 'Falha ao carregar provedores de credenciais.',
      );
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
      const response = await fetch(`/api/knowledge/credentials?${params.toString()}`, {
        cache: 'no-store',
      });
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
        fetch(`/api/knowledge/articles?tenantId=${encodeURIComponent(tenant)}`, {
          cache: 'no-store',
        }),
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
  }, [
    tab,
    search,
    credentialSearch,
    equipmentFilter,
    environmentFilter,
    providerFilter,
    credentialSort.field,
    credentialSort.dir,
  ]);
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
  }, [
    tab,
    tenantId,
    providerFilter,
    search,
    credentialSearch,
    equipmentFilter,
    environmentFilter,
    credentialSort.field,
    credentialSort.dir,
    credentialOffset,
  ]);
  const toggleFavorite = (id) => {
    setFavorites((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [id, ...prev]));
  };
  const touchRecent = (id) => {
    setRecent((prev) => [id, ...prev.filter((x) => x !== id)].slice(0, 8));
  };
  const filteredEntries = useMemo(() => {
    const q = search.toLowerCase().trim();
    return entries.filter((e) => {
      const bySearch =
        !q ||
        `${e.title} ${e.description} ${e.tags.join(' ')} ${e.author} ${e.command}`
          .toLowerCase()
          .includes(q);
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
    } catch {}
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
      tags: newEntry.tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
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
      const response = await fetch(
        `/api/knowledge/articles/${encodeURIComponent(String(entry.id))}?tenantId=${encodeURIComponent(tenantId)}`,
        {
          method: 'DELETE',
        },
      );
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
    () => [
      'Todos',
      ...Array.from(new Set(credentials.map((c) => c.equipmentType || 'OUTROS'))).sort((a, b) =>
        a.localeCompare(b, 'pt-BR'),
      ),
    ],
    [credentials],
  );
  const environmentOptions = useMemo(() => {
    const values = Array.from(new Set(credentials.map((c) => c.env || 'Nao informado')))
      .filter((item) => !/^sgp cliente\\s+\\d+$/i.test(String(item).trim()))
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
    [providerSummaries],
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
        const response = await fetch(
          `/api/knowledge/credentials/${encodeURIComponent(String(credentialId))}/reveal?tenantId=${encodeURIComponent(tenantId)}`,
          {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
          },
        );
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
    if (
      !payload.provider ||
      !payload.environment ||
      !payload.host ||
      !payload.username ||
      !payload.secret
    ) {
      setCreateCredentialError(
        'Preencha os campos obrigatorios: Provedor, Ambiente, Host, Usuario e Senha.',
      );
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
  return _jsxs('div', {
    className: 'space-y-5',
    children: [
      tab !== 'ajustpedia' &&
        _jsxs('div', {
          children: [
            _jsx('h2', {
              className: cn('text-2xl font-bold', dark ? 'text-slate-100' : 'text-slate-900'),
              children:
                tab === 'credenciais'
                  ? credentialsLabMode
                    ? 'Cofre de Credenciais Lab'
                    : 'Cofre de Credenciais'
                  : 'Ajustpedia',
            }),
            _jsx('p', {
              className: cn('text-sm', dark ? 'text-slate-400' : 'text-slate-500'),
              children:
                tab === 'credenciais'
                  ? credentialsLabMode
                    ? 'Versao alternativa para comparacao de layout do cofre.'
                    : 'Credenciais operacionais centralizadas.'
                  : 'Procedimentos tecnicos compartilhados.',
            }),
            syncing &&
              _jsx('p', {
                className: 'text-xs text-slate-500 mt-1',
                children: 'Sincronizando base compartilhada...',
              }),
            !syncing &&
              syncError &&
              _jsx('p', { className: 'text-xs text-amber-700 mt-1', children: syncError }),
          ],
        }),
      tab !== 'ajustpedia' &&
        _jsxs('div', {
          className: 'flex flex-col md:flex-row gap-3',
          children: [
            _jsxs('div', {
              className: 'relative flex-1',
              children: [
                _jsx(Search, {
                  size: 15,
                  className: cn(
                    'absolute left-3 top-1/2 -translate-y-1/2',
                    dark ? 'text-slate-500' : 'text-slate-400',
                  ),
                }),
                _jsx('input', {
                  value: search,
                  onChange: (e) => setSearch(e.target.value),
                  placeholder: 'Buscar...',
                  className: cn(
                    'w-full pl-9 pr-3 py-2.5 border rounded-lg text-sm transition-colors',
                    dark
                      ? 'bg-[#0f172a]/80 backdrop-blur-xl border-slate-700/50 text-slate-200 placeholder:text-slate-600 focus:border-blue-500/50'
                      : 'bg-white border-slate-300 text-slate-900 focus:border-blue-500',
                  ),
                }),
              ],
            }),
          ],
        }),
      tab === 'ajustpedia' &&
        _jsx(AnalystKnowledgeAjustpediaPanel, {
          dark: dark,
          tag: tag,
          onlyFav: onlyFav,
          tags: tags,
          filteredEntries: filteredEntries,
          favorites: favorites,
          canManage: canManageKnowledge,
          deletingId: deletingEntryId,
          searchQuery: search,
          onSearchQueryChange: setSearch,
          onTagChange: setTag,
          onOnlyFavToggle: () => setOnlyFav((v) => !v),
          onToggleFavorite: toggleFavorite,
          onCopyText: copyText,
          onEditEntry: openEditEntryModal,
          onDeleteEntry: deleteEntry,
          onCreateTip: openCreateContribModal,
        }),
      tab === 'credenciais' &&
        (!credentialsLabMode
          ? _jsx(AnalystKnowledgeCredentialsPanel, {
              dark: dark,
              equipmentFilter: equipmentFilter,
              environmentFilter: environmentFilter,
              equipmentOptions: equipmentOptions,
              environmentOptions: environmentOptions,
              providerFilter: providerFilter,
              providerSearch: providerSearch,
              credentialSearch: credentialSearch,
              providerSummariesVisible: providerSummariesVisible,
              providerSummariesTotal: providerSummaries.length,
              providersTotalCredentials: providersTotalCredentials,
              credentialsTotal: credentialsTotal,
              groupedByEquipment: groupedByEquipment,
              credentialSort: credentialSort,
              visibleSecrets: visibleSecrets,
              revealedSecrets: revealedSecrets,
              credentialOffset: credentialOffset,
              credentialLimit: credentialLimit,
              currentPageCount: credentials.length,
              onEquipmentFilterChange: setEquipmentFilter,
              onEnvironmentFilterChange: setEnvironmentFilter,
              onProviderFilterChange: setProviderFilter,
              onProviderSearchChange: setProviderSearch,
              onCredentialSearchChange: setCredentialSearch,
              onClearFilters: () => {
                setProviderFilter('Todos');
                setEquipmentFilter('Todos');
                setEnvironmentFilter('Todos');
                setProviderSearch('');
                setCredentialSearch('');
              },
              onToggleCredentialSort: toggleCredentialSort,
              onOpenCredentialDetails: openCredentialDetails,
              onToggleCredentialSecret: toggleCredentialSecret,
              onCopyCredentialLine: (credential, visible, secret) => {
                copyText(
                  credential.provider +
                    ' | ' +
                    credential.equipmentType +
                    ' | ' +
                    credential.env +
                    ' | ' +
                    credential.host +
                    ' | ' +
                    credential.user +
                    (visible ? ' | ' + secret : ''),
                );
              },
              onPrevPage: () => setCredentialOffset((prev) => Math.max(0, prev - credentialLimit)),
              onNextPage: () => setCredentialOffset((prev) => prev + credentialLimit),
              canCreateCredential: canCreateCredential,
              onOpenCreateCredential: openCreateCredentialModal,
            })
          : _jsx(AnalystKnowledgeCredentialsLabPanel, {
              dark: dark,
              equipmentFilter: equipmentFilter,
              equipmentOptions: equipmentOptions,
              providerFilter: providerFilter,
              credentialSearch: credentialSearch,
              providerSummariesVisible: providerSummariesVisible,
              providersTotalCredentials: providersTotalCredentials,
              credentialsTotal: credentialsTotal,
              groupedByEquipment: groupedByEquipment,
              credentialSort: credentialSort,
              visibleSecrets: visibleSecrets,
              revealedSecrets: revealedSecrets,
              credentialOffset: credentialOffset,
              credentialLimit: credentialLimit,
              currentPageCount: credentials.length,
              onEquipmentFilterChange: setEquipmentFilter,
              onProviderFilterChange: setProviderFilter,
              onCredentialSearchChange: setCredentialSearch,
              onClearFilters: () => {
                setProviderFilter('Todos');
                setEquipmentFilter('Todos');
                setEnvironmentFilter('Todos');
                setProviderSearch('');
                setCredentialSearch('');
              },
              onToggleCredentialSort: toggleCredentialSort,
              onOpenCredentialDetails: openCredentialDetails,
              onToggleCredentialSecret: toggleCredentialSecret,
              onCopyCredentialLine: (credential, visible, secret) => {
                copyText(
                  credential.provider +
                    ' | ' +
                    credential.equipmentType +
                    ' | ' +
                    credential.env +
                    ' | ' +
                    credential.host +
                    ' | ' +
                    credential.user +
                    (visible ? ' | ' + secret : ''),
                );
              },
              onPrevPage: () => setCredentialOffset((prev) => Math.max(0, prev - credentialLimit)),
              onNextPage: () => setCredentialOffset((prev) => prev + credentialLimit),
              canCreateCredential: canCreateCredential,
              onOpenCreateCredential: openCreateCredentialModal,
            })),
      showCreateCredential &&
        _jsx(Modal, {
          title: 'Novo equipamento / credencial',
          onClose: () => setShowCreateCredential(false),
          maxWidth: 'max-w-2xl',
          children: _jsxs('form', {
            onSubmit: submitCreateCredential,
            className: 'space-y-3',
            children: [
              createCredentialError &&
                _jsx('div', {
                  className: cn(
                    'text-xs border rounded-lg px-3 py-2',
                    dark
                      ? 'border-rose-700/40 bg-rose-900/20 text-rose-300'
                      : 'border-rose-200 bg-rose-50 text-rose-700',
                  ),
                  children: createCredentialError,
                }),
              _jsxs('div', {
                className: 'grid grid-cols-1 md:grid-cols-2 gap-3',
                children: [
                  _jsxs('label', {
                    className: 'text-sm',
                    children: [
                      _jsx('div', {
                        className: cn(
                          'text-xs font-semibold mb-1',
                          dark ? 'text-slate-400' : 'text-slate-600',
                        ),
                        children: 'Provedor *',
                      }),
                      _jsx('input', {
                        value: newCredential.provider,
                        onChange: (e) =>
                          setNewCredential((p) => ({ ...p, provider: e.target.value })),
                        placeholder: 'Nome do provedor',
                        className: cn(
                          'w-full px-3 py-2 border rounded-lg text-sm',
                          dark
                            ? 'bg-[#0f172a]/80 border-slate-700/50 text-slate-200'
                            : 'bg-white border-slate-300 text-slate-800',
                        ),
                      }),
                    ],
                  }),
                  _jsxs('label', {
                    className: 'text-sm',
                    children: [
                      _jsx('div', {
                        className: cn(
                          'text-xs font-semibold mb-1',
                          dark ? 'text-slate-400' : 'text-slate-600',
                        ),
                        children: 'Ambiente *',
                      }),
                      _jsx('input', {
                        value: newCredential.environment,
                        onChange: (e) =>
                          setNewCredential((p) => ({ ...p, environment: e.target.value })),
                        placeholder: 'Produ\u00E7\u00E3o / NOC / LAB',
                        className: cn(
                          'w-full px-3 py-2 border rounded-lg text-sm',
                          dark
                            ? 'bg-[#0f172a]/80 border-slate-700/50 text-slate-200'
                            : 'bg-white border-slate-300 text-slate-800',
                        ),
                      }),
                    ],
                  }),
                  _jsxs('label', {
                    className: 'text-sm',
                    children: [
                      _jsx('div', {
                        className: cn(
                          'text-xs font-semibold mb-1',
                          dark ? 'text-slate-400' : 'text-slate-600',
                        ),
                        children: 'Tipo de equipamento',
                      }),
                      _jsx('input', {
                        value: newCredential.equipmentType,
                        onChange: (e) =>
                          setNewCredential((p) => ({ ...p, equipmentType: e.target.value })),
                        placeholder: 'SWITCH, OLT, ROTEADOR...',
                        className: cn(
                          'w-full px-3 py-2 border rounded-lg text-sm',
                          dark
                            ? 'bg-[#0f172a]/80 border-slate-700/50 text-slate-200'
                            : 'bg-white border-slate-300 text-slate-800',
                        ),
                      }),
                    ],
                  }),
                  _jsxs('label', {
                    className: 'text-sm',
                    children: [
                      _jsx('div', {
                        className: cn(
                          'text-xs font-semibold mb-1',
                          dark ? 'text-slate-400' : 'text-slate-600',
                        ),
                        children: 'Nome do equipamento',
                      }),
                      _jsx('input', {
                        value: newCredential.equipmentName,
                        onChange: (e) =>
                          setNewCredential((p) => ({ ...p, equipmentName: e.target.value })),
                        placeholder: 'SW-CORE-01',
                        className: cn(
                          'w-full px-3 py-2 border rounded-lg text-sm',
                          dark
                            ? 'bg-[#0f172a]/80 border-slate-700/50 text-slate-200'
                            : 'bg-white border-slate-300 text-slate-800',
                        ),
                      }),
                    ],
                  }),
                  _jsxs('label', {
                    className: 'text-sm md:col-span-2',
                    children: [
                      _jsx('div', {
                        className: cn(
                          'text-xs font-semibold mb-1',
                          dark ? 'text-slate-400' : 'text-slate-600',
                        ),
                        children: 'Host/IP *',
                      }),
                      _jsx('input', {
                        value: newCredential.host,
                        onChange: (e) => setNewCredential((p) => ({ ...p, host: e.target.value })),
                        placeholder: '10.0.0.10 ou host.exemplo.com',
                        className: cn(
                          'w-full px-3 py-2 border rounded-lg text-sm font-mono',
                          dark
                            ? 'bg-[#0f172a]/80 border-slate-700/50 text-slate-200'
                            : 'bg-white border-slate-300 text-slate-800',
                        ),
                      }),
                    ],
                  }),
                  _jsxs('label', {
                    className: 'text-sm',
                    children: [
                      _jsx('div', {
                        className: cn(
                          'text-xs font-semibold mb-1',
                          dark ? 'text-slate-400' : 'text-slate-600',
                        ),
                        children: 'Usuario *',
                      }),
                      _jsx('input', {
                        value: newCredential.username,
                        onChange: (e) =>
                          setNewCredential((p) => ({ ...p, username: e.target.value })),
                        placeholder: 'admin',
                        className: cn(
                          'w-full px-3 py-2 border rounded-lg text-sm',
                          dark
                            ? 'bg-[#0f172a]/80 border-slate-700/50 text-slate-200'
                            : 'bg-white border-slate-300 text-slate-800',
                        ),
                      }),
                    ],
                  }),
                  _jsxs('label', {
                    className: 'text-sm',
                    children: [
                      _jsx('div', {
                        className: cn(
                          'text-xs font-semibold mb-1',
                          dark ? 'text-slate-400' : 'text-slate-600',
                        ),
                        children: 'Senha *',
                      }),
                      _jsx('input', {
                        type: 'password',
                        value: newCredential.secret,
                        onChange: (e) =>
                          setNewCredential((p) => ({ ...p, secret: e.target.value })),
                        placeholder: 'Senha de acesso',
                        className: cn(
                          'w-full px-3 py-2 border rounded-lg text-sm',
                          dark
                            ? 'bg-[#0f172a]/80 border-slate-700/50 text-slate-200'
                            : 'bg-white border-slate-300 text-slate-800',
                        ),
                      }),
                    ],
                  }),
                  _jsxs('label', {
                    className: 'text-sm md:col-span-2',
                    children: [
                      _jsx('div', {
                        className: cn(
                          'text-xs font-semibold mb-1',
                          dark ? 'text-slate-400' : 'text-slate-600',
                        ),
                        children: 'Observacoes',
                      }),
                      _jsx('textarea', {
                        rows: 3,
                        value: newCredential.notes,
                        onChange: (e) => setNewCredential((p) => ({ ...p, notes: e.target.value })),
                        placeholder: 'Porta, VLAN, procedimentos...',
                        className: cn(
                          'w-full px-3 py-2 border rounded-lg text-sm',
                          dark
                            ? 'bg-[#0f172a]/80 border-slate-700/50 text-slate-200'
                            : 'bg-white border-slate-300 text-slate-800',
                        ),
                      }),
                    ],
                  }),
                ],
              }),
              _jsxs('div', {
                className: 'flex justify-end gap-2',
                children: [
                  _jsx('button', {
                    type: 'button',
                    onClick: () => setShowCreateCredential(false),
                    className: cn(
                      'px-3 py-2 text-sm border rounded-lg',
                      dark
                        ? 'border-slate-700/50 text-slate-400 hover:bg-white/5'
                        : 'border-slate-300 text-slate-600 hover:bg-slate-50',
                    ),
                    children: 'Cancelar',
                  }),
                  _jsx('button', {
                    type: 'submit',
                    disabled: createCredentialSaving,
                    className: cn(
                      'px-4 py-2 text-sm rounded-lg text-white',
                      createCredentialSaving ? 'bg-cyan-700/60' : 'bg-cyan-600 hover:bg-cyan-700',
                    ),
                    children: createCredentialSaving ? 'Salvando...' : 'Salvar credencial',
                  }),
                ],
              }),
            ],
          }),
        }),
      selectedCredential &&
        !credentialsLabMode &&
        _jsx(Modal, {
          title: `Credencial - ${selectedCredential.equipmentName || selectedCredential.host}`,
          onClose: () => setSelectedCredential(null),
          maxWidth: 'max-w-7xl',
          children: _jsxs('div', {
            className: 'space-y-4',
            children: [
              _jsxs('div', {
                className: 'grid grid-cols-1 md:grid-cols-2 gap-3 text-sm',
                children: [
                  _jsxs('div', {
                    className: cn(
                      'border rounded-lg p-3',
                      dark ? 'bg-[#0f172a]/80 border-slate-700/50' : 'bg-slate-50 border-slate-200',
                    ),
                    children: [
                      _jsx('div', {
                        className: cn(
                          'text-[11px] uppercase font-bold',
                          dark ? 'text-slate-500' : 'text-slate-500',
                        ),
                        children: 'Provedor',
                      }),
                      _jsx('div', {
                        className: cn(
                          'font-semibold mt-1',
                          dark ? 'text-slate-200' : 'text-slate-800',
                        ),
                        children: selectedCredential.provider,
                      }),
                    ],
                  }),
                  _jsxs('div', {
                    className: cn(
                      'border rounded-lg p-3',
                      dark ? 'bg-[#0f172a]/80 border-slate-700/50' : 'bg-slate-50 border-slate-200',
                    ),
                    children: [
                      _jsx('div', {
                        className: cn(
                          'text-[11px] uppercase font-bold',
                          dark ? 'text-slate-500' : 'text-slate-500',
                        ),
                        children: 'Tipo de equipamento',
                      }),
                      _jsx('div', {
                        className: cn(
                          'font-semibold mt-1',
                          dark ? 'text-slate-200' : 'text-slate-800',
                        ),
                        children: selectedCredential.equipmentType,
                      }),
                    ],
                  }),
                  _jsxs('div', {
                    className: cn(
                      'border rounded-lg p-3',
                      dark ? 'bg-[#0f172a]/80 border-slate-700/50' : 'bg-slate-50 border-slate-200',
                    ),
                    children: [
                      _jsx('div', {
                        className: cn(
                          'text-[11px] uppercase font-bold',
                          dark ? 'text-slate-500' : 'text-slate-500',
                        ),
                        children: 'Equipamento',
                      }),
                      _jsx('div', {
                        className: cn(
                          'font-semibold mt-1',
                          dark ? 'text-slate-200' : 'text-slate-800',
                        ),
                        children: selectedCredential.equipmentName || '-',
                      }),
                    ],
                  }),
                  _jsxs('div', {
                    className: cn(
                      'border rounded-lg p-3',
                      dark ? 'bg-[#0f172a]/80 border-slate-700/50' : 'bg-slate-50 border-slate-200',
                    ),
                    children: [
                      _jsx('div', {
                        className: cn(
                          'text-[11px] uppercase font-bold',
                          dark ? 'text-slate-500' : 'text-slate-500',
                        ),
                        children: 'Ambiente',
                      }),
                      _jsx('div', {
                        className: cn(
                          'font-semibold mt-1',
                          dark ? 'text-slate-200' : 'text-slate-800',
                        ),
                        children: selectedCredential.env,
                      }),
                    ],
                  }),
                  _jsxs('div', {
                    className: cn(
                      'border rounded-lg p-3',
                      dark ? 'bg-[#0f172a]/80 border-slate-700/50' : 'bg-slate-50 border-slate-200',
                    ),
                    children: [
                      _jsx('div', {
                        className: cn(
                          'text-[11px] uppercase font-bold',
                          dark ? 'text-slate-500' : 'text-slate-500',
                        ),
                        children: 'Host',
                      }),
                      _jsx('div', {
                        className: cn(
                          'font-mono text-xs mt-1 break-all',
                          dark ? 'text-slate-300' : 'text-slate-700',
                        ),
                        children: selectedCredential.host,
                      }),
                    ],
                  }),
                  _jsxs('div', {
                    className: cn(
                      'border rounded-lg p-3',
                      dark ? 'bg-[#0f172a]/80 border-slate-700/50' : 'bg-slate-50 border-slate-200',
                    ),
                    children: [
                      _jsx('div', {
                        className: cn(
                          'text-[11px] uppercase font-bold',
                          dark ? 'text-slate-500' : 'text-slate-500',
                        ),
                        children: 'Usuario',
                      }),
                      _jsx('div', {
                        className: cn(
                          'font-mono text-xs mt-1 break-all',
                          dark ? 'text-slate-300' : 'text-slate-700',
                        ),
                        children: selectedCredential.user,
                      }),
                    ],
                  }),
                  _jsxs('div', {
                    className: cn(
                      'border rounded-lg p-3 md:col-span-2',
                      dark ? 'bg-[#0f172a]/80 border-slate-700/50' : 'bg-slate-50 border-slate-200',
                    ),
                    children: [
                      _jsx('div', {
                        className: cn(
                          'text-[11px] uppercase font-bold',
                          dark ? 'text-slate-500' : 'text-slate-500',
                        ),
                        children: 'Senha',
                      }),
                      _jsx('div', {
                        className: cn(
                          'font-mono text-xs mt-1 break-all',
                          dark ? 'text-slate-300' : 'text-slate-700',
                        ),
                        children: visibleSecrets[selectedCredential.id]
                          ? revealedSecrets[selectedCredential.id] || selectedCredential.secret
                          : selectedCredential.secret,
                      }),
                      _jsxs('div', {
                        className: 'mt-2 flex gap-2',
                        children: [
                          _jsxs('button', {
                            onClick: () => toggleCredentialSecret(selectedCredential.id),
                            className: cn(
                              'px-3 py-1.5 text-xs border rounded flex items-center gap-1',
                              dark
                                ? 'border-slate-700/50 text-slate-400 hover:bg-white/5'
                                : 'border-slate-300 text-slate-600 hover:bg-slate-50',
                            ),
                            children: [
                              visibleSecrets[selectedCredential.id]
                                ? _jsx(EyeOff, { size: 12 })
                                : _jsx(Eye, { size: 12 }),
                              visibleSecrets[selectedCredential.id]
                                ? 'Ocultar senha'
                                : 'Exibir senha',
                            ],
                          }),
                          _jsx('button', {
                            onClick: () => {
                              const secret =
                                revealedSecrets[selectedCredential.id] || selectedCredential.secret;
                              copyText(
                                `${selectedCredential.provider} | ${selectedCredential.equipmentType} | ${selectedCredential.env} | ${selectedCredential.host} | ${selectedCredential.user}${visibleSecrets[selectedCredential.id] ? ` | ${secret}` : ''}`,
                              );
                            },
                            className:
                              'px-3 py-1.5 text-xs border border-blue-200 bg-blue-50 text-blue-700 rounded hover:bg-blue-100',
                            children: 'Copiar dados',
                          }),
                        ],
                      }),
                    ],
                  }),
                ],
              }),
              _jsxs('div', {
                className: cn(
                  'border rounded-lg p-3',
                  dark ? 'bg-[#0f172a]/80 border-slate-700/50' : 'bg-slate-50 border-slate-200',
                ),
                children: [
                  _jsx('div', {
                    className: cn(
                      'text-[11px] uppercase font-bold mb-1',
                      dark ? 'text-slate-500' : 'text-slate-500',
                    ),
                    children: 'Descricao / Observacoes',
                  }),
                  _jsx('div', {
                    className: cn(
                      'text-sm whitespace-pre-wrap break-words max-h-[46vh] overflow-y-auto custom-scrollbar pr-2',
                      dark ? 'text-slate-300' : 'text-slate-700',
                    ),
                    children: selectedCredential.notes || 'Sem observacoes.',
                  }),
                ],
              }),
              _jsxs('div', {
                className: 'grid grid-cols-1 md:grid-cols-2 gap-3 text-xs',
                children: [
                  _jsxs('div', {
                    className: cn(
                      'border rounded-lg p-3',
                      dark
                        ? 'bg-[#0f172a]/80 border-slate-700/50 text-slate-400'
                        : 'bg-slate-50 border-slate-200 text-slate-600',
                    ),
                    children: [
                      _jsx('span', { className: 'font-semibold', children: 'Criado em:' }),
                      ' ',
                      selectedCredential.createdAt
                        ? formatDateTime(selectedCredential.createdAt)
                        : '-',
                    ],
                  }),
                  _jsxs('div', {
                    className: cn(
                      'border rounded-lg p-3',
                      dark
                        ? 'bg-[#0f172a]/80 border-slate-700/50 text-slate-400'
                        : 'bg-slate-50 border-slate-200 text-slate-600',
                    ),
                    children: [
                      _jsx('span', { className: 'font-semibold', children: 'Atualizado em:' }),
                      ' ',
                      selectedCredential.updatedAt
                        ? formatDateTime(selectedCredential.updatedAt)
                        : '-',
                    ],
                  }),
                ],
              }),
            ],
          }),
        }),
      _jsx(AnalystKnowledgeAjustpediaModal, {
        dark: dark,
        open: showContrib,
        editing: editingEntryId !== null,
        title: newEntry.title,
        tags: newEntry.tags,
        description: newEntry.description,
        command: newEntry.command,
        onClose: closeContribModal,
        onSubmit: submitContrib,
        onTitleChange: (value) => setNewEntry((p) => ({ ...p, title: value })),
        onTagsChange: (value) => setNewEntry((p) => ({ ...p, tags: value })),
        onDescriptionChange: (value) => setNewEntry((p) => ({ ...p, description: value })),
        onCommandChange: (value) => setNewEntry((p) => ({ ...p, command: value })),
      }),
    ],
  });
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
  return _jsxs('div', {
    className: 'space-y-5 h-full flex flex-col',
    children: [
      _jsxs('div', {
        className: 'flex items-center justify-between',
        children: [
          _jsx('h2', {
            className: cn('text-2xl font-bold', dark ? 'text-slate-100' : 'text-slate-900'),
            children: 'Calendario Operacional',
          }),
          _jsxs('div', {
            className: cn(
              'flex items-center gap-2 border rounded-lg p-1',
              dark
                ? 'bg-[#1e293b]/60 backdrop-blur-md border-slate-700/50'
                : 'bg-white border-slate-200',
            ),
            children: [
              _jsx('button', {
                onClick: () => setMonthDate(new Date(year, month - 1, 1)),
                className: cn(
                  'p-2 rounded',
                  dark ? 'hover:bg-white/5 text-slate-300' : 'hover:bg-slate-100 text-slate-600',
                ),
                children: _jsx(ChevronLeft, { size: 16 }),
              }),
              _jsx('div', {
                className: cn(
                  'text-sm font-semibold min-w-[150px] text-center',
                  dark ? 'text-slate-200' : 'text-slate-700',
                ),
                children: monthDate.toLocaleString('pt-BR', { month: 'long', year: 'numeric' }),
              }),
              _jsx('button', {
                onClick: () => setMonthDate(new Date(year, month + 1, 1)),
                className: cn(
                  'p-2 rounded',
                  dark ? 'hover:bg-white/5 text-slate-300' : 'hover:bg-slate-100 text-slate-600',
                ),
                children: _jsx(ChevronRight, { size: 16 }),
              }),
            ],
          }),
        ],
      }),
      _jsxs('div', {
        className: 'flex-1 grid grid-cols-1 lg:grid-cols-3 gap-4 min-h-0',
        children: [
          _jsxs('div', {
            className: cn(
              'lg:col-span-2 border rounded-xl p-4 overflow-y-auto custom-scrollbar',
              dark
                ? 'bg-[#1e293b]/60 backdrop-blur-md border-slate-700/50'
                : 'bg-white border-slate-200',
            ),
            children: [
              _jsx('div', {
                className: 'grid grid-cols-7 gap-2 mb-2',
                children: ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'].map((d) =>
                  _jsx(
                    'div',
                    {
                      className: 'text-[11px] font-bold uppercase text-slate-400 text-center py-1',
                      children: d,
                    },
                    d,
                  ),
                ),
              }),
              _jsx('div', {
                className: 'grid grid-cols-7 gap-2',
                children: grid.map((day, idx) => {
                  const events = getEventsForDay(day);
                  const selected = selectedDay === day;
                  return _jsx(
                    'button',
                    {
                      disabled: !day,
                      onClick: () => day && setSelectedDay(day),
                      className: cn(
                        'min-h-[95px] rounded-lg border p-2 text-left transition-colors',
                        !day
                          ? 'border-transparent bg-transparent cursor-default'
                          : dark
                            ? 'border-slate-700/50 hover:border-blue-500/50 hover:bg-blue-900/10'
                            : 'border-slate-200 hover:border-blue-300 hover:bg-blue-50/30',
                        selected &&
                          (dark
                            ? 'ring-2 ring-blue-500 bg-blue-900/20'
                            : 'ring-2 ring-blue-500 bg-blue-50'),
                      ),
                      children:
                        day &&
                        _jsxs(_Fragment, {
                          children: [
                            _jsx('div', {
                              className: cn(
                                'text-sm font-semibold',
                                dark ? 'text-slate-300' : 'text-slate-700',
                              ),
                              children: day,
                            }),
                            _jsxs('div', {
                              className: 'mt-1 space-y-1',
                              children: [
                                events
                                  .slice(0, 3)
                                  .map((e) =>
                                    _jsx(
                                      'div',
                                      {
                                        className: cn(
                                          'text-[10px] px-1.5 py-0.5 rounded border truncate',
                                          dark
                                            ? 'bg-[#0f172a]/80 backdrop-blur-xl border-slate-700/50 text-slate-300'
                                            : 'bg-slate-100 border-slate-200 text-slate-600',
                                        ),
                                        children: e.protocol,
                                      },
                                      e.id,
                                    ),
                                  ),
                                events.length > 3 &&
                                  _jsxs('div', {
                                    className: 'text-[10px] text-slate-400',
                                    children: ['+', events.length - 3, ' mais'],
                                  }),
                              ],
                            }),
                          ],
                        }),
                    },
                    idx,
                  );
                }),
              }),
            ],
          }),
          _jsxs('div', {
            className: cn(
              'border rounded-xl overflow-hidden flex flex-col',
              dark
                ? 'bg-[#1e293b]/60 backdrop-blur-md border-slate-700/50'
                : 'bg-white border-slate-200',
            ),
            children: [
              _jsx('div', {
                className: cn(
                  'px-4 py-3 border-b',
                  dark
                    ? 'bg-[#0f172a]/80 backdrop-blur-xl border-slate-700/50'
                    : 'bg-slate-50 border-slate-100',
                ),
                children: _jsx('h3', {
                  className: cn('font-bold', dark ? 'text-slate-200' : 'text-slate-700'),
                  children: selectedDay ? `Eventos do dia ${selectedDay}` : 'Selecione um dia',
                }),
              }),
              _jsx('div', {
                className: 'flex-1 overflow-y-auto custom-scrollbar p-4 space-y-2',
                children: selectedDay
                  ? selectedEvents.length > 0
                    ? selectedEvents.map((e) =>
                        _jsxs(
                          'div',
                          {
                            className: cn(
                              'p-3 border rounded-lg',
                              dark
                                ? 'bg-[#0f172a]/80 backdrop-blur-xl border-slate-700/50'
                                : 'bg-slate-50 border-slate-200',
                            ),
                            children: [
                              _jsxs('div', {
                                className: 'flex justify-between items-center mb-1',
                                children: [
                                  _jsx('span', {
                                    className: cn(
                                      'font-mono text-xs',
                                      dark ? 'text-slate-300' : 'text-slate-700',
                                    ),
                                    children: e.protocol,
                                  }),
                                  _jsx(StatusBadge, { status: e.status }),
                                ],
                              }),
                              _jsx('div', {
                                className: cn(
                                  'text-xs',
                                  dark ? 'text-slate-400' : 'text-slate-600',
                                ),
                                children: e.provider,
                              }),
                              _jsx('div', {
                                className: 'text-xs text-slate-500 mt-1',
                                children: formatDateTime(e.deadlineAt),
                              }),
                              _jsx('button', {
                                onClick: () => onSelectOrder(e),
                                className: cn(
                                  'mt-2 px-2 py-1 text-[10px] border rounded font-bold transition-colors',
                                  dark
                                    ? 'bg-cyan-900/30 border-cyan-700/50 text-cyan-400 hover:bg-cyan-900/50'
                                    : 'border-cyan-200 bg-cyan-50 text-cyan-700 hover:bg-cyan-100/50',
                                ),
                                children: 'Abrir',
                              }),
                            ],
                          },
                          e.id,
                        ),
                      )
                    : _jsx('div', {
                        className: 'text-sm text-slate-400',
                        children: 'Sem eventos nesse dia.',
                      })
                  : _jsx('div', {
                      className: 'text-sm text-slate-400',
                      children: 'Selecione uma data no calendario.',
                    }),
              }),
            ],
          }),
        ],
      }),
    ],
  });
};
const ReportsView = ({ orders, onToast }) => {
  const [period, setPeriod] = useState('Tudo');
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
    return Object.entries(map)
      .map(([provider, total]) => ({ provider, total }))
      .sort((a, b) => b.total - a.total);
  }, [scoped]);
  const topDelays = useMemo(
    () =>
      scoped
        .filter((o) => getDelayHours(o) > 0)
        .sort((a, b) => getDelayHours(b) - getDelayHours(a))
        .slice(0, 10),
    [scoped],
  );
  const exportCsv = () => {
    const header = [
      'protocol',
      'provider',
      'tech',
      'owner',
      'type',
      'priority',
      'status',
      'createdAt',
      'deadlineAt',
      'delayHours',
    ];
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
    const csv = [
      header.join(','),
      ...rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')),
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `relatorio_os_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    onToast('CSV exportado.');
  };
  return _jsxs('div', {
    className: 'space-y-5',
    children: [
      _jsxs('div', {
        className: 'flex flex-col lg:flex-row lg:items-center justify-between gap-3',
        children: [
          _jsxs('div', {
            children: [
              _jsx('h2', {
                className: cn('text-2xl font-bold', dark ? 'text-slate-100' : 'text-slate-900'),
                children: 'Relatorios',
              }),
              _jsx('p', {
                className: cn('text-sm', dark ? 'text-slate-400' : 'text-slate-500'),
                children: 'Indicadores operacionais e exportacao CSV.',
              }),
            ],
          }),
          _jsx(PeriodTabs, { value: period, onChange: setPeriod }),
        ],
      }),
      _jsx('div', {
        className: 'flex justify-end',
        children: _jsxs('button', {
          onClick: exportCsv,
          className:
            'px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 flex items-center gap-2',
          children: [_jsx(Save, { size: 14 }), 'Exportar CSV'],
        }),
      }),
      _jsxs('div', {
        className: 'grid grid-cols-1 lg:grid-cols-2 gap-4',
        children: [
          _jsxs('div', {
            className: cn(
              'border rounded-xl p-4 shadow-sm',
              dark
                ? 'bg-[#1e293b]/60 backdrop-blur-md border-slate-700/50'
                : 'bg-white border-slate-200',
            ),
            children: [
              _jsx('h3', {
                className: cn('font-bold mb-3', dark ? 'text-slate-200' : 'text-slate-800'),
                children: 'Resumo por status',
              }),
              _jsxs('div', {
                className: 'space-y-2',
                children: [
                  Object.entries(statusSummary).map(([status, count]) =>
                    _jsxs(
                      'div',
                      {
                        className: cn(
                          'flex items-center justify-between p-2 rounded border',
                          dark
                            ? 'bg-[#0f172a]/80 backdrop-blur-xl border-slate-700/50'
                            : 'bg-slate-50 border-slate-200',
                        ),
                        children: [
                          _jsx(StatusBadge, { status: status }),
                          _jsx('span', {
                            className: cn(
                              'font-mono font-bold',
                              dark ? 'text-slate-300' : 'text-slate-700',
                            ),
                            children: count,
                          }),
                        ],
                      },
                      status,
                    ),
                  ),
                  Object.keys(statusSummary).length === 0 &&
                    _jsx('div', {
                      className: 'text-sm text-slate-400',
                      children: 'Sem dados na janela.',
                    }),
                ],
              }),
            ],
          }),
          _jsxs('div', {
            className: cn(
              'border rounded-xl p-4 shadow-sm',
              dark
                ? 'bg-[#1e293b]/60 backdrop-blur-md border-slate-700/50'
                : 'bg-white border-slate-200',
            ),
            children: [
              _jsx('h3', {
                className: cn('font-bold mb-3', dark ? 'text-slate-200' : 'text-slate-800'),
                children: 'Top provedores',
              }),
              _jsxs('div', {
                className: 'space-y-2',
                children: [
                  providerSummary
                    .slice(0, 8)
                    .map((p) =>
                      _jsxs(
                        'div',
                        {
                          className: cn(
                            'flex items-center justify-between p-2 rounded border',
                            dark
                              ? 'bg-[#0f172a]/80 backdrop-blur-xl border-slate-700/50'
                              : 'bg-slate-50 border-slate-200',
                          ),
                          children: [
                            _jsx('span', {
                              className: cn('text-sm', dark ? 'text-slate-300' : 'text-slate-700'),
                              children: p.provider,
                            }),
                            _jsx('span', {
                              className: cn(
                                'font-mono font-bold',
                                dark ? 'text-slate-300' : 'text-slate-700',
                              ),
                              children: p.total,
                            }),
                          ],
                        },
                        p.provider,
                      ),
                    ),
                  providerSummary.length === 0 &&
                    _jsx('div', {
                      className: 'text-sm text-slate-400',
                      children: 'Sem dados na janela.',
                    }),
                ],
              }),
            ],
          }),
        ],
      }),
      _jsxs('div', {
        className: cn(
          'border rounded-xl overflow-hidden shadow-sm',
          dark
            ? 'bg-[#1e293b]/60 backdrop-blur-md border-slate-700/50'
            : 'bg-white border-slate-200',
        ),
        children: [
          _jsx('div', {
            className: cn(
              'px-5 py-3 border-b font-bold text-sm',
              dark ? 'border-slate-700/50 text-slate-300' : 'border-slate-100 text-slate-700',
            ),
            children: 'Top atrasos',
          }),
          _jsx('div', {
            className: 'overflow-x-auto custom-scrollbar',
            children: _jsxs('table', {
              className: 'w-full text-sm',
              children: [
                _jsx('thead', {
                  className: cn(dark ? 'bg-white/5 text-slate-400' : 'bg-slate-50 text-slate-500'),
                  children: _jsxs('tr', {
                    children: [
                      _jsx('th', { className: 'px-5 py-3 text-left', children: 'Protocolo' }),
                      _jsx('th', { className: 'px-5 py-3 text-left', children: 'Provedor' }),
                      _jsx('th', { className: 'px-5 py-3 text-left', children: 'Tecnico' }),
                      _jsx('th', { className: 'px-5 py-3 text-left', children: 'Status' }),
                      _jsx('th', { className: 'px-5 py-3 text-right', children: 'Delay (h)' }),
                    ],
                  }),
                }),
                _jsxs('tbody', {
                  className: 'divide-y divide-slate-100',
                  children: [
                    topDelays.map((o) =>
                      _jsxs(
                        'tr',
                        {
                          children: [
                            _jsx('td', { className: 'px-5 py-3 font-mono', children: o.protocol }),
                            _jsx('td', { className: 'px-5 py-3', children: o.provider }),
                            _jsx('td', { className: 'px-5 py-3', children: o.tech || '-' }),
                            _jsx('td', {
                              className: 'px-5 py-3',
                              children: _jsx(StatusBadge, { status: o.status }),
                            }),
                            _jsx('td', {
                              className: 'px-5 py-3 text-right font-mono font-bold text-rose-600',
                              children: getDelayHours(o).toFixed(2),
                            }),
                          ],
                        },
                        o.id,
                      ),
                    ),
                    topDelays.length === 0 &&
                      _jsx('tr', {
                        children: _jsxs('td', {
                          colSpan: 5,
                          className: 'px-5 py-14 text-center',
                          children: [
                            _jsx(CheckCircle, {
                              size: 28,
                              className: 'mx-auto mb-3 text-emerald-300',
                            }),
                            _jsx('p', {
                              className: 'text-sm font-medium text-slate-500 mb-1',
                              children: 'Sem atrasos no periodo.',
                            }),
                            _jsx('p', {
                              className: 'text-xs text-slate-400',
                              children: 'Todas as OS estao dentro do prazo.',
                            }),
                          ],
                        }),
                      }),
                  ],
                }),
              ],
            }),
          }),
        ],
      }),
    ],
  });
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
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(account.email.trim()))
      errs.email = 'E-mail invalido.';
    if (account.newPassword || account.confirmPassword || account.currentPassword) {
      if (!account.currentPassword) errs.currentPassword = 'Informe a senha atual.';
      if (account.newPassword.length < 8) errs.newPassword = 'Minimo 8 caracteres.';
      if (account.newPassword !== account.confirmPassword)
        errs.confirmPassword = 'Confirmacao nao confere.';
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
          throw new Error(
            await readApiErrorMessage(response, 'Falha ao atualizar dados de acesso.'),
          );
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
        setError(
          saveError instanceof Error ? saveError.message : 'Falha ao atualizar dados de acesso.',
        );
      } finally {
        setSaving(false);
      }
    })();
  };
  return _jsxs('div', {
    className: 'space-y-5 max-w-3xl',
    children: [
      _jsx('h2', {
        className: cn('text-2xl font-bold', dark ? 'text-slate-100' : 'text-slate-900'),
        children: 'Configuracoes',
      }),
      _jsxs('div', {
        className: cn(
          'border rounded-xl p-5 shadow-sm space-y-4',
          dark
            ? 'bg-[#1e293b]/60 backdrop-blur-md border-slate-700/50'
            : 'bg-white border-slate-200',
        ),
        children: [
          _jsxs('div', {
            children: [
              _jsxs('label', {
                className: cn(
                  'text-xs uppercase font-bold tracking-wider mb-1 block',
                  dark ? 'text-slate-500' : 'text-slate-500',
                ),
                children: [
                  'Usuario',
                  _jsx('span', { className: 'text-rose-500 ml-0.5', children: '*' }),
                ],
              }),
              _jsx('input', {
                value: account.username,
                onChange: (e) => {
                  setAccount((p) => ({ ...p, username: e.target.value }));
                  setFieldErrors((p) => ({ ...p, username: undefined }));
                },
                disabled: loading || saving,
                className: cn(
                  'w-full px-3 py-2 border rounded-lg text-sm transition-colors',
                  dark
                    ? 'bg-[#0f172a]/80 backdrop-blur-xl border-slate-700/50 text-slate-200 focus:border-blue-500'
                    : 'border-slate-300 text-slate-900 focus:border-blue-500',
                  fieldErrors.username && 'border-rose-400',
                ),
              }),
              fieldErrors.username &&
                _jsx('p', {
                  className: 'text-xs text-rose-500 mt-1',
                  children: fieldErrors.username,
                }),
            ],
          }),
          _jsxs('div', {
            children: [
              _jsxs('label', {
                className: 'text-xs uppercase font-bold tracking-wider text-slate-500 mb-1 block',
                children: [
                  'E-mail',
                  _jsx('span', { className: 'text-rose-500 ml-0.5', children: '*' }),
                ],
              }),
              _jsx('input', {
                value: account.email,
                onChange: (e) => {
                  setAccount((p) => ({ ...p, email: e.target.value }));
                  setFieldErrors((p) => ({ ...p, email: undefined }));
                },
                disabled: loading || saving,
                className: cn(
                  'w-full px-3 py-2 border rounded-lg text-sm transition-colors',
                  dark
                    ? 'bg-[#0f172a]/80 backdrop-blur-xl border-slate-700/50 text-slate-200 focus:border-blue-500'
                    : 'border-slate-300 text-slate-900 focus:border-blue-500',
                  fieldErrors.email && 'border-rose-400',
                ),
              }),
              fieldErrors.email &&
                _jsx('p', { className: 'text-xs text-rose-500 mt-1', children: fieldErrors.email }),
            ],
          }),
        ],
      }),
      _jsxs('div', {
        className: cn('border-t pt-4 space-y-3', dark ? 'border-slate-700/50' : 'border-slate-100'),
        children: [
          _jsx('h3', {
            className: cn('text-sm font-bold', dark ? 'text-slate-300' : 'text-slate-700'),
            children: 'Trocar senha',
          }),
          _jsx('input', {
            type: 'password',
            placeholder: 'Senha atual',
            value: account.currentPassword,
            onChange: (e) => {
              setAccount((p) => ({ ...p, currentPassword: e.target.value }));
              setFieldErrors((p) => ({ ...p, currentPassword: undefined }));
            },
            disabled: loading || saving,
            className: cn(
              'w-full px-3 py-2 border rounded-lg text-sm transition-colors',
              dark
                ? 'bg-[#0f172a]/80 backdrop-blur-xl border-slate-700/50 text-slate-200 focus:border-blue-500'
                : 'border-slate-300 text-slate-900 focus:border-blue-500',
              fieldErrors.currentPassword && 'border-rose-400',
            ),
          }),
          fieldErrors.currentPassword &&
            _jsx('p', {
              className: 'text-xs text-rose-500 mt-1',
              children: fieldErrors.currentPassword,
            }),
          _jsx('input', {
            type: 'password',
            placeholder: 'Nova senha (min 8 caracteres)',
            value: account.newPassword,
            onChange: (e) => {
              setAccount((p) => ({ ...p, newPassword: e.target.value }));
              setFieldErrors((p) => ({ ...p, newPassword: undefined }));
            },
            disabled: loading || saving,
            className: cn(
              'w-full px-3 py-2 border rounded-lg text-sm transition-colors',
              dark
                ? 'bg-[#0f172a]/80 backdrop-blur-xl border-slate-700/50 text-slate-200 focus:border-blue-500'
                : 'border-slate-300 text-slate-900 focus:border-blue-500',
              fieldErrors.newPassword && 'border-rose-400',
            ),
          }),
          fieldErrors.newPassword &&
            _jsx('p', {
              className: 'text-xs text-rose-500 mt-1',
              children: fieldErrors.newPassword,
            }),
          _jsx('input', {
            type: 'password',
            placeholder: 'Confirmar nova senha',
            value: account.confirmPassword,
            onChange: (e) => {
              setAccount((p) => ({ ...p, confirmPassword: e.target.value }));
              setFieldErrors((p) => ({ ...p, confirmPassword: undefined }));
            },
            disabled: loading || saving,
            className: cn(
              'w-full px-3 py-2 border rounded-lg text-sm transition-colors',
              dark
                ? 'bg-[#0f172a]/80 backdrop-blur-xl border-slate-700/50 text-slate-200 focus:border-blue-500'
                : 'border-slate-300 text-slate-900 focus:border-blue-500',
              fieldErrors.confirmPassword && 'border-rose-400',
            ),
          }),
          fieldErrors.confirmPassword &&
            _jsx('p', {
              className: 'text-xs text-rose-500 mt-1',
              children: fieldErrors.confirmPassword,
            }),
        ],
      }),
      loading &&
        _jsx('div', { className: 'text-sm text-slate-500', children: 'Carregando perfil...' }),
      error &&
        _jsx('div', {
          className:
            'text-sm text-rose-700 bg-rose-100 border border-rose-200 rounded-lg px-3 py-2',
          children: error,
        }),
      _jsx('div', {
        className: 'flex justify-end',
        children: _jsx('button', {
          onClick: saveAccess,
          disabled: loading || saving,
          className:
            'px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold disabled:opacity-50',
          children: saving ? 'Salvando...' : 'Salvar acesso',
        }),
      }),
    ],
  });
};
export default function AnalystPortalRuntime() {
  const [isTvMode, setIsTvMode] = useState(false);
  useEffect(() => {
    if (isTvMode) {
      document.documentElement.requestFullscreen?.().catch(() => {});
    } else {
      if (document.fullscreenElement) {
        document.exitFullscreen?.().catch(() => {});
      }
    }
  }, [isTvMode]);

  const [tenantId, setTenantId] = useState(null);

  const ws = useErpWebSocket({
    tenantId,
    onEvent: (ev) => {
      if (
        ev.type === 'ixc_sync_success' ||
        ev.type === 'order_created' ||
        ev.type === 'order_updated'
      ) {
        if (!apiSyncing) {
          onToast('Nova Ocorrencia detectada (Atualizacao em tempo real)');
          loadRemoteOrders(tenantId, { silent: true });
        }
      }
    },
  });

  const [dark, setDark] = useState(false);
  const toggleTheme = () => setDark(!dark);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [currentView, setCurrentView] = useState('dashboard');
  const [role, setRole] = useState('analyst');
  const [analystFunction, setAnalystFunction] = useState('visao');
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
  const [, forceSectorRefresh] = useState(0);
  const [apiSyncing, setApiSyncing] = useState(false);
  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (e) {}
    window.location.href = '/login';
  };
  const [apiSyncError, setApiSyncError] = useState('');
  const [initialLoading, setInitialLoading] = useState(true);
  const selectedOrder = useMemo(
    () => orders.find((o) => o.id === selectedOrderId) || null,
    [orders, selectedOrderId],
  );
  const roleCode = mapUiRoleToCode(role);
  const canUseAnalystFunctions = role === 'manager' || role === 'super_admin';
  const visibleNavItems = useMemo(() => {
    if (!canUseAnalystFunctions) return NAV_ITEMS;
    const allowedViews = ANALYST_FUNCTION_VIEWS[analystFunction] || ANALYST_FUNCTION_VIEWS.visao;
    return NAV_ITEMS.filter((item) => allowedViews.includes(item.id));
  }, [canUseAnalystFunctions, analystFunction]);
  const onToast = (msg) => setToastMessage(msg);
  const apiEnabled = !!tenantId;
  const loadTenantSectors = async (targetTenantId) => {
    if (!targetTenantId) return;
    try {
      const response = await fetch(
        `/api/iam/tenants/${encodeURIComponent(targetTenantId)}/sectors`,
        { cache: 'no-store' },
      );
      if (!response.ok) return;
      const payload = await response.json();
      const nextSectors = Array.isArray(payload)
        ? payload.map((item) => String(item?.name || '').trim()).filter((item) => item.length > 0)
        : [];
      if (!nextSectors.length) return;
      const uniqueSectors = Array.from(new Set(nextSectors));
      OCCURRENCE_SECTORS.splice(0, OCCURRENCE_SECTORS.length, ...uniqueSectors);
      forceSectorRefresh((prev) => prev + 1);
    } catch {}
  };
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
      setApiSyncError(
        error instanceof Error ? error.message : 'Falha ao sincronizar dados do backend.',
      );
      return false;
    } finally {
      if (!silent) setApiSyncing(false);
    }
  };
  const transitionOrderRemote = async (
    orderId,
    nextStatusLabel,
    reason = 'Atualizacao manual pelo analista.',
  ) => {
    if (!tenantId) return false;
    const response = await fetch(
      `/api/service-orders/${encodeURIComponent(orderId)}/transition?tenantId=${encodeURIComponent(tenantId)}`,
      {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          toStatus: toApiOrderStatus(nextStatusLabel),
          reason,
        }),
      },
    );
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
    const response = await fetch(
      `/api/service-orders/${encodeURIComponent(orderId)}/attachments?tenantId=${encodeURIComponent(tenantId)}`,
      {
        method: 'POST',
        body: formData,
      },
    );
    if (!response.ok) {
      throw new Error(await readApiErrorMessage(response, 'Falha ao enviar anexos.'));
    }
  };
  const addOrderAnnotation = async (order, message, hideFromClient = false) => {
    if (!apiEnabled || !order?.id) {
      onToast('Tenant nao identificado para comentar na O.S.');
      return false;
    }
    if (!canEditOrder(roleCode)) {
      onToast('Perfil sem permissao para comentar na O.S.');
      return false;
    }
    try {
      const response = await fetch(
        `/api/service-orders/${encodeURIComponent(order.id)}/annotations?tenantId=${encodeURIComponent(tenantId)}`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ message, hideFromClient: !!hideFromClient }),
        },
      );
      if (!response.ok) {
        throw new Error(
          await readApiErrorMessage(response, 'Falha ao registrar atualizacao da O.S.'),
        );
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
      const response = await fetch(
        `/api/occurrences/${encodeURIComponent(occurrence.id)}/annotations?tenantId=${encodeURIComponent(tenantId)}`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ message }),
        },
      );
      if (!response.ok) {
        throw new Error(
          await readApiErrorMessage(response, 'Falha ao registrar anotacao da ocorrencia.'),
        );
      }
      await loadRemoteOrders(tenantId, { silent: true });
      onToast(`Anotacao registrada na ocorrencia ${occurrence.number}.`);
      return true;
    } catch (error) {
      onToast(
        error instanceof Error ? error.message : 'Falha ao registrar anotacao da ocorrencia.',
      );
      return false;
    }
  };
  const openOrderDetails = (order) => {
    setEditingOrder(null);
    setSelectedOrderId(order.id);
    pushUiHistoryState({ layer: 'order', orderId: order.id });
  };
  const openOrderEditor = (order) => {
    setSelectedOrderId(order.id);
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
          throw new Error(
            await readApiErrorMessage(response, 'Nao foi possivel validar a sessao.'),
          );
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
          await loadTenantSectors(nextTenantId);
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
    if (
      typeof currentAnalystName === 'string' &&
      currentAnalystName.trim() &&
      currentAnalystName.trim().toLowerCase() !== 'voce'
    )
      return;
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
  useEffect(() => {
    if (visibleNavItems.some((item) => item.id === currentView)) return;
    const fallbackView = visibleNavItems[0]?.id || 'dashboard';
    setCurrentView(fallbackView);
  }, [currentView, visibleNavItems]);
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

    if (status === 'Fechada' || status === 'Resolvida') {
      const confirmed = window.confirm(
        'CHECKLIST DE ENCERRAMENTO\n\n1. Sinal óptico validado?\n2. Cliente confirmou funcionamento?\n3. Evidência anexada?\n\nConfirma que todos os passos foram concluídos?',
      );
      if (!confirmed) return;

      const targetOrder = orders.find((o) => o.id === id);
      if (targetOrder && targetOrder.occurrenceId) {
        // Find sibling orders
        const siblings = orders.filter(
          (o) =>
            o.occurrenceId === targetOrder.occurrenceId &&
            o.id !== id &&
            o.status !== 'Fechada' &&
            o.status !== 'Resolvida',
        );
        if (siblings.length > 0) {
          const massClose = window.confirm(
            `Existem outras ${siblings.length} O.S filhas abertas para a mesma Causa Raiz. Deseja ENCERRAR TODAS juntas?`,
          );
          if (massClose) {
            onToast('Encerrando Múltiplas O.S em Massa (Árvore resolvida)...');
            try {
              await Promise.all(
                siblings.map((sib) =>
                  transitionOrderRemote(
                    sib.id,
                    status,
                    `Status alterado em lote via O.S Mãe para ${status}.`,
                  ),
                ),
              );
            } catch (e) {
              console.error('Falha no encerramento em massa', e);
            }
          }
        }
      }
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
      await Promise.all(
        ids.map((id) =>
          transitionOrderRemote(id, status, `Status alterado em lote para ${status}.`),
        ),
      );
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
          fetch(
            `/api/service-orders/${encodeURIComponent(id)}?tenantId=${encodeURIComponent(tenantId)}`,
            {
              method: 'PATCH',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ analystName: techName }),
            },
          ).then(async (response) => {
            if (!response.ok) {
              throw new Error(
                await readApiErrorMessage(response, 'Falha ao atualizar analista responsavel.'),
              );
            }
          }),
        ),
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
    pushUiHistoryState({
      layer: 'occurrence',
      occurrenceId: order.occurrenceId || `OCC-LEGACY-${order.id}`,
    });
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
        hideFromClient: !!patch.hideFromClient,
        deadlineAt: patch.deadlineAt ? new Date(patch.deadlineAt).toISOString() : undefined,
      };
      const updateResponse = await fetch(
        `/api/service-orders/${encodeURIComponent(orderId)}?tenantId=${encodeURIComponent(tenantId)}`,
        {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(patchPayload),
        },
      );
      if (!updateResponse.ok) {
        throw new Error(
          await readApiErrorMessage(updateResponse, 'Falha ao salvar alteracoes da O.S.'),
        );
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
      const response = await fetch(
        `/api/occurrences/${encodeURIComponent(occurrenceId)}?tenantId=${encodeURIComponent(tenantId)}`,
        {
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
        },
      );
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
      const occurrenceCreatedAt = new Date(
        `${occurrenceDraft.date}T${occurrenceDraft.time}`,
      ).toISOString();
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
            hideFromClient: !!orderDraft.hideFromClient,
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
      const response = await fetch(
        `/api/occurrences/${encodeURIComponent(occurrence.id)}/orders?tenantId=${encodeURIComponent(tenantId)}`,
        {
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
            analystName:
              internalOrder.analyst ||
              internalOrder.responsible ||
              currentAnalystName ||
              ANALYST_USERS[0],
            hideFromClient: !!internalOrder.hideFromClient,
            deadlineAt:
              internalOrder.deadlineDate && internalOrder.deadlineTime
                ? new Date(
                    `${internalOrder.deadlineDate}T${internalOrder.deadlineTime}`,
                  ).toISOString()
                : undefined,
          }),
        },
      );
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
      onToast('Tenant nao identificado para abrir O.S. Verifique o login e tente novamente.');
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
        hideFromClient: !!newOrder.hideFromClient,
        deadlineDate: toDateInputValue(newOrder.deadlineAt || Date.now() + 24 * HOUR_MS),
        deadlineTime: toTimeInputValue(newOrder.deadlineAt || Date.now() + 24 * HOUR_MS),
        attachments: newOrder.attachments || [],
      },
    );
  };
  const renderView = () => {
    if (currentView === 'dashboard') {
      return _jsx(DashboardView, {
        orders: orders,
        onSelectOrder: openOrderDetails,
        onGoToProviders: () => setCurrentView('providers'),
        onGoToKnowledge: () => setCurrentView('ajustpedia'),
        loading: initialLoading,
        currentAnalystName: currentAnalystName,
      });
    }
    if (currentView === 'os_list') {
      return _jsx(OSListView, {
        orders: orders,
        onSelectOrder: openOrderDetails,
        onAdvanceStatus: advanceOrderStatus,
        onBulkStatusUpdate: bulkStatusUpdate,
        onBulkAssignTech: bulkAssignTech,
        onToast: onToast,
      });
    }
    if (currentView === 'occurrences') {
      return _jsx(OccurrencesView, {
        orders: orders,
        onSelectOrder: openOrderDetails,
        onCreateInternalOrder: addInternalOrderToOccurrence,
        focusOccurrenceId: focusOccurrenceId,
      });
    }
    if (currentView === 'os_create') {
      return _jsx(OSCreateView, {
        onCreateOrder: createStandaloneOrder,
        onCancel: () => setCurrentView('providers'),
        onToast: onToast,
        resetToken: menuResetToken,
      });
    }
    if (currentView === 'providers') {
      return _jsx(ProvidersView, {
        resetToken: menuResetToken,
        orders: orders,
        onSelectOrder: openOrderDetails,
        onEditOrder: openOrderEditor,
        onEditOccurrence: openOccurrenceEditor,
        onOpenOccurrenceWithOrder: openOccurrenceFromOrder,
        onCreateOrderInOccurrence: addInternalOrderToOccurrence,
        onAddOccurrenceAnnotation: addOccurrenceAnnotation,
        currentAnalystName: currentAnalystName,
        focusProvider: focusProviderName,
        focusOccurrenceId: focusOccurrenceId,
        onProviderFocusChange: setFocusProviderName,
        onOccurrenceFocusChange: setFocusOccurrenceId,
      });
    }
    if (currentView === 'ajustpedia') {
      return _jsx(KnowledgeBaseView, { onToast: onToast, section: 'ajustpedia' });
    }
    if (currentView === 'credentials_neo') {
      return _jsx(AnalystCredentialsNeoView, { dark: dark, onToast: onToast });
    }
    if (currentView === 'knowledge') {
      return _jsx(KnowledgeBaseView, { onToast: onToast, section: 'ajustpedia' });
    }
    if (currentView === 'notes') {
      return _jsx(AnalystNotesView, { dark: dark, onToast: onToast });
    }
    if (currentView === 'calendar') {
      return _jsx(CalendarView, { orders: orders, onSelectOrder: openOrderDetails });
    }
    if (currentView === 'settings') {
      return _jsx(SettingsView, { onToast: onToast, onProfileNameChange: setCurrentAnalystName });
    }
    return _jsx(DashboardView, {
      orders: orders,
      onSelectOrder: openOrderDetails,
      onGoToProviders: () => setCurrentView('providers'),
      onGoToKnowledge: () => setCurrentView('ajustpedia'),
      loading: initialLoading,
      currentAnalystName: currentAnalystName,
    });
  };
  {
    /* Legacy sidebar/header removed in favor of SharedPortalShell auto-layout */
  }
  const overlays = _jsxs(_Fragment, {
    children: [
      _jsx(AnalystCommandPalette, {
        open: commandOpen,
        dark: dark,
        onClose: () => setCommandOpen(false),
        views: visibleNavItems.map((n) => ({ id: n.id, label: n.label })),
        orders: orders,
        onNavigate: navigateFromMenu,
        onOpenOrder: openOrderDetails,
      }),
      selectedOrder &&
        !editingOrder &&
        _jsx(OSDetailsDrawer, {
          order: selectedOrder,
          onClose: () => {
            setEditingOrder(null);
            setSelectedOrderId(null);
          },
          onEditOrder: openOrderEditor,
          onAddOrderAnnotation: addOrderAnnotation,
          onOpenOccurrence: (order) => {
            setEditingOrder(null);
            setSelectedOrderId(null);
            openOccurrenceFromOrder(order);
          },
        }),
      editingOrder &&
        _jsx(EditOrderModal, {
          order: editingOrder,
          onClose: () => {
            const targetOrder = editingOrder;
            setEditingOrder(null);
            setSelectedOrderId(null);
            if (targetOrder) openOccurrenceFromOrder(targetOrder);
          },
          onSave: saveOrderEdits,
        }),
      editingOccurrence &&
        _jsx(EditOccurrenceModal, {
          occurrence: editingOccurrence,
          onClose: () => setEditingOccurrence(null),
          onSave: saveOccurrenceEdits,
        }),
      _jsx(ErpToast, { message: toastMessage, dark: dark }),
    ],
  });
  if (!mounted) {
    return _jsx('div', { className: 'h-screen bg-[#0e1a33]' });
  }
  const shellRootClassName = dark
    ? 'h-screen overflow-hidden analyst-readable-root bg-[#0b1220] text-slate-100'
    : undefined;
  return _jsx(ThemeCtx.Provider, {
    value: { dark, toggle: toggleTheme },
    children: _jsxs(SharedPortalShell, {
      tenantName: tenantId ? PROVIDERS.find((p) => p === tenantId) || tenantId : 'Ajust ERP',
      userName: currentAnalystName,
      userRole: 'analyst',
      onLogout: handleLogout,
      sidebarItems: visibleNavItems.map((item) => ({
        key: item.id,
        label: item.label,
        icon: item.icon,
        onClick: () => navigateFromMenu(item.id),
        active: currentView === item.id,
      })),
      dark: dark,
      themeToggle: toggleTheme,
      rootClassName: shellRootClassName,
      overlays: overlays,
      contentClassName: 'max-w-[1500px] mx-auto',
      contentWrapperClassName: 'flex-1 flex flex-col overflow-hidden relative',
      children: [
        canUseAnalystFunctions &&
          _jsxs('div', {
            className: cn(
              'mb-4 rounded-lg border px-3 py-2 flex flex-col gap-2',
              dark
                ? 'bg-[#111a2e] border-slate-700 text-slate-100'
                : 'bg-white border-slate-200 text-slate-800',
            ),
            children: [
              _jsx('div', {
                className: 'text-xs font-bold uppercase tracking-wide',
                children: 'Funcoes Analista',
              }),
              _jsx('div', {
                className: 'flex flex-wrap gap-2',
                children: ANALYST_FUNCTIONS.map((fn) =>
                  _jsx(
                    'button',
                    {
                      onClick: () => setAnalystFunction(fn.id),
                      className: cn(
                        'px-3 py-1.5 rounded-md text-xs font-semibold border transition-colors',
                        analystFunction === fn.id
                          ? dark
                            ? 'bg-blue-900/40 border-blue-500/60 text-blue-200'
                            : 'bg-blue-50 border-blue-300 text-blue-700'
                          : dark
                            ? 'bg-slate-900/70 border-slate-700 text-slate-300 hover:border-slate-500'
                            : 'bg-white border-slate-300 text-slate-700 hover:border-slate-400',
                      ),
                      children: fn.label,
                    },
                    fn.id,
                  ),
                ),
              }),
            ],
          }),
        _jsx('style', {
          children: `
        .analyst-readable-root {
          font-size: 15px;
        }
        .analyst-readable-root .text-xs {
          font-size: 0.86rem !important;
          line-height: 1.35 !important;
        }
        .analyst-readable-root .text-sm {
          font-size: 0.98rem !important;
          line-height: 1.45 !important;
        }
        .analyst-readable-root .text-slate-500 {
          color: #d6e4ff !important;
        }
        .analyst-readable-root .text-slate-400 {
          color: #e6efff !important;
        }
        .analyst-readable-root .text-slate-300 {
          color: #f2f7ff !important;
        }
        .analyst-readable-root .text-slate-200 {
          color: #ffffff !important;
        }
      `,
        }),
        apiSyncing &&
          _jsx('div', {
            className: cn(
              'mb-4 rounded-lg border px-3 py-2 text-xs',
              dark
                ? 'bg-blue-900/20 border-blue-500/30 text-blue-400'
                : 'bg-white border-slate-200 text-slate-500',
            ),
            children: 'Sincronizando dados operacionais com o backend...',
          }),
        !apiSyncing &&
          apiSyncError &&
          _jsx('div', {
            className: cn(
              'mb-4 rounded-lg border px-3 py-2 text-xs',
              dark
                ? 'bg-amber-900/20 border-amber-500/30 text-amber-400'
                : 'bg-amber-50 border-amber-200 text-amber-700',
            ),
            children: apiSyncError,
          }),
        renderView(),
      ],
    }),
  });
}
