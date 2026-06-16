import { z } from 'zod';

export const SERVICE_ORDER_TYPES = [
  'ROMPIMENTO',
  'LENTIDAO',
  'CONFIGURACAO_ONU',
  'TROCA_SENHA',
  'CANCELAMENTO',
  'AUDITORIA',
  'INSTALACAO',
  'BGP',
] as const;

export const PRIORITIES = ['BAIXA', 'NORMAL', 'ALTA', 'CRITICA'] as const;

export const STATUS = [
  'ABERTA',
  'EM_ANALISE',
  'AG_CAMPO',
  'AG_TERCEIROS',
  'RESOLVIDA',
  'FECHADA',
  'CANCELADA',
] as const;

export const ServiceOrderSchema = z.object({
  tenantId: z.string().uuid(),
  type: z.enum(SERVICE_ORDER_TYPES),
  priority: z.enum(PRIORITIES),
  status: z.enum(STATUS),
  protocol: z.string().min(4),
  title: z.string().min(3),
  description: z.string().min(3),
});

export type ServiceOrderInput = z.infer<typeof ServiceOrderSchema>;

export function computeSlaHours(
  type: (typeof SERVICE_ORDER_TYPES)[number],
  priority: (typeof PRIORITIES)[number],
) {
  const base: Record<(typeof PRIORITIES)[number], number> = {
    BAIXA: 72,
    NORMAL: 24,
    ALTA: 8,
    CRITICA: 4,
  };

  if (type === 'ROMPIMENTO' || type === 'BGP') {
    return Math.max(2, base[priority] / 2);
  }

  return base[priority];
}

export interface ManagerKpiOverview {
  totalOpen: number;
  totalClosed: number;
  slaBreaches: number;
}

export interface AnalystPerformance {
  name: string;
  open: number;
  closed: number;
  slaBreaches: number;
  tmrHours: number;
}

export interface ManagerKpiResponse {
  overview: ManagerKpiOverview;
  performanceByAnalyst: AnalystPerformance[];
}

export interface FlowNode {
  status: string;
  total: number;
  overdue: number;
  priorityBreakdown: Record<string, number>;
}

export interface FlowEdge {
  from: string;
  to: string;
  count: number;
}

export interface ServiceOrderFlowResponse {
  nodes: FlowNode[];
  edges: FlowEdge[];
  totalOrders: number;
}

export interface HealthSummaryResponse {
  timestamp: string;
  services: {
    database: { ok: boolean; latencyMs: number };
    redis: { ok: boolean };
  };
  stats: {
    totalOrders: number;
    activeSessions: number;
  };
}

// === Sprint 4.2 — tipos compartilhados adicionais ===

export type AssetCategory =
  | 'SERVIDOR'
  | 'SWITCH'
  | 'ROTEADOR'
  | 'LINK_TRANSIT'
  | 'FIREWALL'
  | 'OUTRO';

export type AssetStatus = 'ATIVO' | 'INATIVO' | 'MANUTENCAO' | 'DESATIVADO';

export interface Asset {
  id: string;
  tenantId: string;
  name: string;
  category: AssetCategory;
  status: AssetStatus;
  description?: string | null;
  location?: string | null;
  serialNumber?: string | null;
  vendor?: string | null;
  contractEnd?: string | null;
  tags: string[];
  createdById?: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

export type ChangeRisk = 'BAIXO' | 'MEDIO' | 'ALTO' | 'CRITICO';
export type ChangeStatus =
  | 'RASCUNHO'
  | 'AGUARDANDO_APROVACAO'
  | 'APROVADO'
  | 'EM_EXECUCAO'
  | 'CONCLUIDO'
  | 'CANCELADO'
  | 'REJEITADO';

export interface ChangeRequest {
  id: string;
  tenantId: string;
  number: string;
  title: string;
  description: string;
  justification: string;
  rollbackPlan?: string | null;
  risk: ChangeRisk;
  status: ChangeStatus;
  plannedStart?: string | null;
  plannedEnd?: string | null;
  affectedSystems: string[];
  tags: string[];
  requestedById?: string | null;
  approvedById?: string | null;
  approvedAt?: string | null;
  executedById?: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

export type CalendarEventType =
  | 'REUNIAO'
  | 'REUNIAO_ONLINE'
  | 'PLANTAO'
  | 'FERIADO'
  | 'LEMBRETE'
  | 'OUTRO';

export interface CalendarEvent {
  id: string;
  tenantId: string;
  title: string;
  description?: string | null;
  type: CalendarEventType;
  isGlobal: boolean;
  startAt: string;
  endAt?: string | null;
  allDay: boolean;
  meetingLink?: string | null;
  location?: string | null;
  color?: string | null;
  createdById?: string | null;
  assigneeId?: string | null;
  recurrenceRule?: string | null;
  recurrenceEnd?: string | null;
  parentEventId?: string | null;
  serviceOrderId?: string | null;
  occurrenceId?: string | null;
  changeRequestId?: string | null;
}

export type NotificationChannel = 'EMAIL' | 'WEBHOOK' | 'SLACK';
export type NotificationTrigger =
  | 'ORDER_CREATED'
  | 'ORDER_ESCALATED'
  | 'ORDER_CLOSED'
  | 'SLA_BREACH_WARNING'
  | 'OCCURRENCE_CREATED';

export interface NotificationConfig {
  id: string;
  tenantId: string;
  name: string;
  channel: NotificationChannel;
  trigger: NotificationTrigger;
  target: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TimeEntry {
  id: string;
  tenantId: string;
  userId: string;
  orderId: string;
  minutes: number;
  description?: string | null;
  billable: boolean;
  loggedAt: string;
  createdAt: string;
}

export interface ApiKey {
  id: string;
  tenantId: string;
  name: string;
  keyPrefix: string;
  createdById?: string | null;
  active: boolean;
  expiresAt?: string | null;
  lastUsedAt?: string | null;
  createdAt: string;
}

export interface OnCallSchedule {
  id: string;
  tenantId: string;
  userId: string;
  startsAt: string;
  endsAt: string;
  notes?: string | null;
  createdAt: string;
}

export interface SatisfactionResponse {
  id: string;
  tenantId: string;
  orderId: string;
  token: string;
  score: number;
  comment?: string | null;
  answered: boolean;
  answeredAt?: string | null;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  tenantId?: string | null;
  actorUserId?: string | null;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  metadata?: Record<string, unknown>;
  ip?: string | null;
  userAgent?: string | null;
  createdAt: string;
}

export interface SlaPolicy {
  id: string;
  tenantId: string;
  priority: (typeof PRIORITIES)[number];
  serviceOrderType?: (typeof SERVICE_ORDER_TYPES)[number] | null;
  hours: number;
  isOverride: boolean;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export type OccurrenceStatus = 'ABERTA' | 'EM_ANALISE' | 'RESOLVIDA' | 'CANCELADA' | 'FECHADA';

export interface Occurrence {
  id: string;
  tenantId: string;
  number: string;
  provider: string;
  type: string;
  status: OccurrenceStatus;
  sector: string;
  origin: string;
  openedByName: string;
  analystResponsible: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

export interface KnowledgeArticle {
  id: string;
  tenantId?: string | null;
  authorUserId?: string | null;
  title: string;
  slug: string;
  content: string;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
  tagIds?: string[];
}

export interface WorkflowDefinition {
  nodes: Array<{
    id: string;
    type: 'trigger' | 'condition' | 'action';
    subtype: string;
    config: Record<string, unknown>;
    position: { x: number; y: number };
  }>;
  edges: Array<{
    id: string;
    source: string;
    target: string;
    label?: string;
  }>;
  governance?: Record<string, unknown>;
}
