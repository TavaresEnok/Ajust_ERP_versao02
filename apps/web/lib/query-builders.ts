import { cache } from 'react';

type ApiLoginResponse = {
  accessToken: string;
  user?: {
    tenantId?: string;
    role?: string;
  };
};

type ApiMeResponse = {
  tenant: {
    id: string;
    tradeName: string;
    role: string;
  } | null;
};

type ApiServiceOrder = {
  id: string;
  protocol: string;
  type: string;
  priority: string;
  status: string;
  title: string;
  deadlineAt: string;
  createdAt: string;
  updatedAt: string;
  owner?: {
    name?: string | null;
  } | null;
  assignee?: {
    name?: string | null;
  } | null;
};

type ApiSummary = {
  total: number;
  active: number;
  closed: number;
  overdueActive: number;
  risk2h: number;
  criticalOverdue: number;
  byStatus: Record<string, number>;
  byPriority?: Record<string, number>;
  byType?: Record<string, number>;
  topAssignees?: Array<{ userId: string; name: string; count: number }>;
};

type ApiExportHistoryItem = {
  id: string;
  reportType: string;
  status: string;
  createdAt: string;
  fileAvailable: boolean;
  actor: {
    id: string;
    name: string;
    email: string;
  } | null;
};

type WorkerHealth = {
  ixcReconciliation?: {
    running?: boolean;
    lastRunAt?: string | null;
    lastErrorMessage?: string | null;
  };
};

export type TenantView = {
  id: string;
  tradeName: string;
  role: string;
};

export type ServiceOrderView = {
  id: string;
  protocol: string;
  title: string;
  type: string;
  priority: string;
  status: string;
  deadlineAt: Date;
  createdAt: Date;
  updatedAt: Date;
  ownerName: string;
};

export type DashboardSummary = {
  total: number;
  active: number;
  closed: number;
  overdueActive: number;
  risk2h: number;
  criticalOverdue: number;
  byStatus: Record<string, number>;
  byPriority: Record<string, number>;
  byType: Record<string, number>;
  topAssignees: Array<{ userId: string; name: string; count: number }>;
};

export type DashboardPagination = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasPrev: boolean;
  hasNext: boolean;
};

export type DashboardExportHistoryItem = {
  id: string;
  status: string;
  createdAt: Date;
  fileAvailable: boolean;
  actorName: string;
};

export type DashboardData = {
  tenant: TenantView | null;
  orders: ServiceOrderView[];
  summary: DashboardSummary;
  pagination: DashboardPagination;
  exportsHistory: DashboardExportHistoryItem[];
  syncLabel: string;
  error: string | null;
};

const STATUS_ENUM = ['ABERTA', 'EM_ANALISE', 'AG_CAMPO', 'AG_TERCEIROS', 'RESOLVIDA', 'FECHADA', 'CANCELADA'] as const;
const PRIORITY_ENUM = ['BAIXA', 'NORMAL', 'ALTA', 'CRITICA'] as const;
const TYPE_ENUM = [
  'ROMPIMENTO',
  'LENTIDAO',
  'CONFIGURACAO_ONU',
  'TROCA_SENHA',
  'CANCELAMENTO',
  'AUDITORIA',
  'INSTALACAO',
  'BGP'
] as const;
const PERIOD_ENUM = ['today', '7d', '15d', '30d', '90d', 'all'] as const;
const PAGE_SIZE_ENUM = [10, 20, 50] as const;
const ORDER_BY_ENUM = ['createdAt', 'updatedAt', 'deadlineAt', 'protocol', 'priority', 'status'] as const;
const ORDER_DIR_ENUM = ['asc', 'desc'] as const;

type StatusEnum = (typeof STATUS_ENUM)[number];
type PriorityEnum = (typeof PRIORITY_ENUM)[number];
type TypeEnum = (typeof TYPE_ENUM)[number];
type PeriodEnum = (typeof PERIOD_ENUM)[number];
type OrderByEnum = (typeof ORDER_BY_ENUM)[number];
type OrderDirEnum = (typeof ORDER_DIR_ENUM)[number];

export type DashboardFilters = {
  status?: StatusEnum;
  priority?: PriorityEnum;
  type?: TypeEnum;
  period: PeriodEnum;
  q?: string;
  page: number;
  pageSize: (typeof PAGE_SIZE_ENUM)[number];
  orderBy: OrderByEnum;
  orderDir: OrderDirEnum;
};

export const PERIOD_OPTIONS: Array<{ value: PeriodEnum; label: string }> = [
  { value: 'today', label: 'Hoje' },
  { value: '7d', label: '7 dias' },
  { value: '15d', label: '15 dias' },
  { value: '30d', label: '30 dias' },
  { value: '90d', label: '90 dias' },
  { value: 'all', label: 'Tudo' }
];

export const PAGE_SIZE_OPTIONS: Array<{ value: number; label: string }> = [
  { value: 10, label: '10' },
  { value: 20, label: '20' },
  { value: 50, label: '50' }
];

export const ORDER_BY_OPTIONS: Array<{ value: OrderByEnum; label: string }> = [
  { value: 'createdAt', label: 'Abertura' },
  { value: 'updatedAt', label: 'Atualizacao' },
  { value: 'deadlineAt', label: 'SLA' },
  { value: 'protocol', label: 'Protocolo' },
  { value: 'priority', label: 'Prioridade' },
  { value: 'status', label: 'Status' }
];

export const ORDER_DIR_OPTIONS: Array<{ value: OrderDirEnum; label: string }> = [
  { value: 'asc', label: 'Crescente' },
  { value: 'desc', label: 'Decrescente' }
];

export const STATUS_OPTIONS: Array<{ value: '' | StatusEnum; label: string }> = [
  { value: '', label: 'Todos status' },
  { value: 'ABERTA', label: 'Aberta' },
  { value: 'EM_ANALISE', label: 'Em analise' },
  { value: 'AG_CAMPO', label: 'Ag. campo' },
  { value: 'AG_TERCEIROS', label: 'Ag. terceiros' },
  { value: 'RESOLVIDA', label: 'Resolvida' },
  { value: 'FECHADA', label: 'Fechada' },
  { value: 'CANCELADA', label: 'Cancelada' }
];

export const PRIORITY_OPTIONS: Array<{ value: '' | PriorityEnum; label: string }> = [
  { value: '', label: 'Todas prioridades' },
  { value: 'BAIXA', label: 'Baixa' },
  { value: 'NORMAL', label: 'Normal' },
  { value: 'ALTA', label: 'Alta' },
  { value: 'CRITICA', label: 'Critica' }
];

export const TYPE_OPTIONS: Array<{ value: '' | TypeEnum; label: string }> = [
  { value: '', label: 'Todos tipos' },
  { value: 'ROMPIMENTO', label: 'Rompimento' },
  { value: 'LENTIDAO', label: 'Lentidao' },
  { value: 'CONFIGURACAO_ONU', label: 'Configuracao ONU' },
  { value: 'TROCA_SENHA', label: 'Troca de Senha' },
  { value: 'CANCELAMENTO', label: 'Cancelamento' },
  { value: 'AUDITORIA', label: 'Auditoria' },
  { value: 'INSTALACAO', label: 'Instalacao' },
  { value: 'BGP', label: 'BGP' }
];

export const STATUS_FLOW: Array<{ key: StatusEnum; label: string }> = [
  { key: 'ABERTA', label: 'Aberta' },
  { key: 'EM_ANALISE', label: 'Em analise' },
  { key: 'AG_CAMPO', label: 'Ag. campo' },
  { key: 'AG_TERCEIROS', label: 'Ag. terceiros' },
  { key: 'RESOLVIDA', label: 'Resolvida' },
  { key: 'FECHADA', label: 'Fechada' },
  { key: 'CANCELADA', label: 'Cancelada' }
];

export const PRIORITY_FLOW: Array<{ key: PriorityEnum; label: string }> = [
  { key: 'BAIXA', label: 'Baixa' },
  { key: 'NORMAL', label: 'Normal' },
  { key: 'ALTA', label: 'Alta' },
  { key: 'CRITICA', label: 'Critica' }
];

export const TYPE_FLOW: Array<{ key: TypeEnum; label: string }> = [
  { key: 'ROMPIMENTO', label: 'Rompimento' },
  { key: 'LENTIDAO', label: 'Lentidao' },
  { key: 'CONFIGURACAO_ONU', label: 'Configuracao ONU' },
  { key: 'TROCA_SENHA', label: 'Troca de Senha' },
  { key: 'CANCELAMENTO', label: 'Cancelamento' },
  { key: 'AUDITORIA', label: 'Auditoria' },
  { key: 'INSTALACAO', label: 'Instalacao' },
  { key: 'BGP', label: 'BGP' }
];

const STATUS_LABEL: Record<string, string> = Object.fromEntries(
  STATUS_OPTIONS.filter((x) => x.value).map((x) => [x.value, x.label])
);
const PRIORITY_LABEL: Record<string, string> = Object.fromEntries(
  PRIORITY_OPTIONS.filter((x) => x.value).map((x) => [x.value, x.label])
);
const TYPE_LABEL: Record<string, string> = Object.fromEntries(
  TYPE_OPTIONS.filter((x) => x.value).map((x) => [x.value, x.label])
);

const EMPTY_SUMMARY: DashboardSummary = {
  total: 0,
  active: 0,
  closed: 0,
  overdueActive: 0,
  risk2h: 0,
  criticalOverdue: 0,
  byStatus: {
    ABERTA: 0,
    EM_ANALISE: 0,
    AG_CAMPO: 0,
    AG_TERCEIROS: 0,
    RESOLVIDA: 0,
    FECHADA: 0,
    CANCELADA: 0
  },
  byPriority: {
    BAIXA: 0,
    NORMAL: 0,
    ALTA: 0,
    CRITICA: 0
  },
  byType: {
    ROMPIMENTO: 0,
    LENTIDAO: 0,
    CONFIGURACAO_ONU: 0,
    TROCA_SENHA: 0,
    CANCELAMENTO: 0,
    AUDITORIA: 0,
    INSTALACAO: 0,
    BGP: 0
  },
  topAssignees: []
};

const EMPTY_PAGINATION: DashboardPagination = {
  page: 1,
  pageSize: 20,
  total: 0,
  totalPages: 1,
  hasPrev: false,
  hasNext: false
};

function baseUrl() {
  const raw = process.env.API_INTERNAL_URL || process.env.API_BASE_URL || 'http://localhost:8071';
  return raw.replace(/\/+$/, '');
}

function workerUrl() {
  const raw = process.env.WORKER_INTERNAL_URL || 'http://localhost:8076';
  return raw.replace(/\/+$/, '');
}

function demoCredentials() {
  return {
    email: process.env.WEB_DEMO_EMAIL || process.env.SEED_ADMIN_EMAIL || 'admin@ajust.local',
    password: process.env.WEB_DEMO_PASSWORD || process.env.SEED_ADMIN_PASSWORD || 'Admin@123456',
    tenantId: process.env.WEB_TENANT_ID
  };
}

function pickFirst(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0];
  return value;
}

function toIsoRange(period: PeriodEnum) {
  if (period === 'all') return {};

  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);

  if (period === 'today') {
    return { from: start.toISOString(), to: now.toISOString() };
  }

  const days = Number(period.replace('d', ''));
  start.setDate(start.getDate() - days);
  return { from: start.toISOString(), to: now.toISOString() };
}

export function buildServiceOrderApiQuery(
  tenantId: string,
  filters: DashboardFilters,
  options?: {
    includePagination?: boolean;
    page?: number;
  }
) {
  const params = new URLSearchParams();
  // tenant vem apenas do JWT na API (TenantIsolationGuard rejeita tenantId na query)

  if (filters.status) params.set('status', filters.status);
  if (filters.priority) params.set('priority', filters.priority);
  if (filters.type) params.set('type', filters.type);
  if (filters.q) params.set('search', filters.q);

  params.set('orderBy', filters.orderBy);
  params.set('orderDir', filters.orderDir);

  const range = toIsoRange(filters.period);
  if (range.from) params.set('from', range.from);
  if (range.to) params.set('to', range.to);

  if (options?.includePagination) {
    const page = options.page || filters.page;
    params.set('limit', String(filters.pageSize));
    params.set('offset', String((page - 1) * filters.pageSize));
  }

  return params.toString();
}

async function apiJson<T>(path: string, init: RequestInit = {}, accessToken?: string): Promise<T> {
  const response = await fetch(`${baseUrl()}${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
      ...(init.headers || {})
    },
    cache: 'no-store'
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Request failed: ${response.status}`);
  }

  const body = await response.text();
  return body ? (JSON.parse(body) as T) : ({} as T);
}

const getSession = cache(async () => {
  const creds = demoCredentials();

  const login = await apiJson<ApiLoginResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      email: creds.email,
      password: creds.password,
      ...(creds.tenantId ? { tenantId: creds.tenantId } : {})
    })
  });

  if (!login.accessToken) {
    throw new Error('Nao foi possivel autenticar no backend para montar os dashboards.');
  }

  return {
    accessToken: login.accessToken,
    role: login.user?.role || 'desconhecido',
    tenantId: login.user?.tenantId || creds.tenantId || ''
  };
});

async function getWorkerHealth(): Promise<WorkerHealth | null> {
  try {
    const response = await fetch(`${workerUrl()}/health`, { cache: 'no-store' });
    if (!response.ok) return null;
    return (await response.json()) as WorkerHealth;
  } catch {
    return null;
  }
}

async function getExportHistory(
  tenantId: string,
  accessToken: string,
  limit = 8
): Promise<DashboardExportHistoryItem[]> {
  try {
    const rows = await apiJson<ApiExportHistoryItem[]>(
      `/service-orders/export/history?limit=${limit}`,
      { method: 'GET' },
      accessToken
    );

    return rows.map((row) => ({
      id: row.id,
      status: row.status,
      createdAt: new Date(row.createdAt),
      fileAvailable: row.fileAvailable,
      actorName: row.actor?.name || 'Sistema'
    }));
  } catch {
    return [];
  }
}

function formatSyncLabel(health: WorkerHealth | null) {
  if (!health?.ixcReconciliation) return 'n/d';
  if (health.ixcReconciliation.lastErrorMessage) return 'erro';
  if (health.ixcReconciliation.running) return 'executando';
  if (health.ixcReconciliation.lastRunAt) return 'ok';
  return 'n/d';
}

function normalizeOrder(order: ApiServiceOrder): ServiceOrderView {
  return {
    id: order.id,
    protocol: order.protocol,
    title: order.title,
    type: TYPE_LABEL[order.type] || order.type,
    priority: PRIORITY_LABEL[order.priority] || order.priority,
    status: STATUS_LABEL[order.status] || order.status,
    deadlineAt: new Date(order.deadlineAt),
    createdAt: new Date(order.createdAt),
    updatedAt: new Date(order.updatedAt),
    ownerName: order.owner?.name || order.assignee?.name || 'Nao atribuido'
  };
}

function normalizeSummary(summary: ApiSummary | null | undefined): DashboardSummary {
  if (!summary) return EMPTY_SUMMARY;

  return {
    ...EMPTY_SUMMARY,
    ...summary,
    byStatus: {
      ...EMPTY_SUMMARY.byStatus,
      ...(summary.byStatus || {})
    },
    byPriority: {
      ...EMPTY_SUMMARY.byPriority,
      ...(summary.byPriority || {})
    },
    byType: {
      ...EMPTY_SUMMARY.byType,
      ...(summary.byType || {})
    },
    topAssignees: Array.isArray(summary.topAssignees) ? summary.topAssignees : []
  };
}

function toPositiveInt(raw: string | undefined, fallback: number) {
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 1) return fallback;
  return Math.floor(value);
}

export function normalizeDashboardFilters(raw: Record<string, string | string[] | undefined>): DashboardFilters {
  const status = pickFirst(raw.status);
  const priority = pickFirst(raw.priority);
  const type = pickFirst(raw.type);
  const period = pickFirst(raw.period);
  const q = (pickFirst(raw.q) || '').trim();
  const pageRaw = pickFirst(raw.page);
  const pageSizeRaw = pickFirst(raw.pageSize);
  const orderByRaw = pickFirst(raw.orderBy);
  const orderDirRaw = pickFirst(raw.orderDir);

  const page = toPositiveInt(pageRaw, 1);
  const pageSize = PAGE_SIZE_ENUM.includes(Number(pageSizeRaw) as (typeof PAGE_SIZE_ENUM)[number])
    ? (Number(pageSizeRaw) as (typeof PAGE_SIZE_ENUM)[number])
    : 20;
  const orderBy = ORDER_BY_ENUM.includes(orderByRaw as OrderByEnum)
    ? (orderByRaw as OrderByEnum)
    : 'createdAt';
  const orderDir = ORDER_DIR_ENUM.includes(orderDirRaw as OrderDirEnum)
    ? (orderDirRaw as OrderDirEnum)
    : 'desc';

  return {
    status: STATUS_ENUM.includes(status as StatusEnum) ? (status as StatusEnum) : undefined,
    priority: PRIORITY_ENUM.includes(priority as PriorityEnum) ? (priority as PriorityEnum) : undefined,
    type: TYPE_ENUM.includes(type as TypeEnum) ? (type as TypeEnum) : undefined,
    period: PERIOD_ENUM.includes(period as PeriodEnum) ? (period as PeriodEnum) : 'all',
    ...(q.length >= 2 ? { q } : {}),
    page,
    pageSize,
    orderBy,
    orderDir
  };
}

export function buildDashboardQuery(filters: DashboardFilters, overrides: Partial<DashboardFilters> = {}) {
  const merged: DashboardFilters = { ...filters, ...overrides };
  const params = new URLSearchParams();

  params.set('period', merged.period);
  params.set('page', String(merged.page));
  params.set('pageSize', String(merged.pageSize));
  params.set('orderBy', merged.orderBy);
  params.set('orderDir', merged.orderDir);

  if (merged.status) params.set('status', merged.status);
  if (merged.priority) params.set('priority', merged.priority);
  if (merged.type) params.set('type', merged.type);
  if (merged.q) params.set('q', merged.q);

  return params.toString();
}

export async function loadDashboardData(filters: DashboardFilters): Promise<DashboardData> {
  try {
    const session = await getSession();

    const me = await apiJson<ApiMeResponse>('/auth/me', { method: 'GET' }, session.accessToken);
    const tenantId = me.tenant?.id || session.tenantId;

    if (!tenantId) {
      throw new Error('Usuario autenticado sem tenant ativo.');
    }

    const [summaryRaw, health, exportsHistory] = await Promise.all([
      apiJson<ApiSummary>(
        `/service-orders/summary?${buildServiceOrderApiQuery(tenantId, filters, { includePagination: false })}`,
        { method: 'GET' },
        session.accessToken
      ),
      getWorkerHealth(),
      getExportHistory(tenantId, session.accessToken)
    ]);

    const summary = normalizeSummary(summaryRaw);
    const totalPages = Math.max(1, Math.ceil(summary.total / filters.pageSize));
    const safePage = Math.min(filters.page, totalPages);

    const orders = await apiJson<ApiServiceOrder[]>(
      `/service-orders?${buildServiceOrderApiQuery(tenantId, filters, { includePagination: true, page: safePage })}`,
      { method: 'GET' },
      session.accessToken
    );

    return {
      tenant: {
        id: tenantId,
        tradeName: me.tenant?.tradeName || 'Tenant',
        role: me.tenant?.role || session.role
      },
      orders: orders.map(normalizeOrder),
      summary,
      pagination: {
        page: safePage,
        pageSize: filters.pageSize,
        total: summary.total,
        totalPages,
        hasPrev: safePage > 1,
        hasNext: safePage < totalPages
      },
      exportsHistory,
      syncLabel: formatSyncLabel(health),
      error: null
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha ao carregar dashboards.';

    return {
      tenant: null,
      orders: [],
      summary: EMPTY_SUMMARY,
      pagination: EMPTY_PAGINATION,
      exportsHistory: [],
      syncLabel: 'n/d',
      error: message
    };
  }
}

export function isClosedStatus(status: string) {
  return status === 'Fechada' || status === 'Cancelada';
}

export function formatShortDate(date: Date) {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
}

export function formatSlaCountdown(deadlineAt: Date) {
  const minutes = Math.round((deadlineAt.getTime() - Date.now()) / 60000);
  const absMinutes = Math.abs(minutes);
  const hours = Math.floor(absMinutes / 60);
  const restMinutes = absMinutes % 60;
  const value = `${String(hours).padStart(2, '0')}:${String(restMinutes).padStart(2, '0')}`;
  return minutes >= 0 ? `+${value}` : `-${value}`;
}
