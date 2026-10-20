export const orderTypes = {
  ROMPIMENTO: 'Rompimento',
  LENTIDAO: 'Lentidão',
  CONFIGURACAO_ONU: 'Configuração ONU',
  TROCA_SENHA: 'Troca de senha',
  CANCELAMENTO: 'Cancelamento',
  AUDITORIA: 'Auditoria',
  INSTALACAO: 'Instalação',
  BGP: 'BGP',
  DNS: 'DNS',
  PROXMOX: 'Proxmox',
  FIREWALL: 'Firewall',
  ROTEAMENTO_CGNAT: 'Roteamento / CGNAT',
  INFRAESTRUTURA: 'Infraestrutura',
  CONSULTORIA_GERAL: 'Consultoria geral',
  OUTRO: 'Outro',
} as const;
export const priorities = {
  BAIXA: 'Baixa',
  NORMAL: 'Normal',
  ALTA: 'Alta',
  CRITICA: 'Crítica',
} as const;
export const orderStatuses = {
  ABERTA: 'Aberta',
  EM_ANALISE: 'Em análise',
  AG_CAMPO: 'Aguardando campo',
  AG_TERCEIROS: 'Aguardando terceiros',
  RESOLVIDA: 'Resolvida',
  FECHADA: 'Fechada',
  CANCELADA: 'Cancelada',
} as const;
export const occurrenceStatuses = {
  ABERTA: 'Aberta',
  EM_EXECUCAO: 'Em execução',
  PENDENTE: 'Pendente',
  ENCERRADA: 'Encerrada',
} as const;
export const changeStatuses = {
  RASCUNHO: 'Rascunho',
  AGUARDANDO_APROVACAO: 'Aguardando aprovação',
  APROVADO: 'Aprovado',
  EM_EXECUCAO: 'Em execução',
  CONCLUIDO: 'Concluído',
  CANCELADO: 'Cancelado',
  REJEITADO: 'Rejeitado',
} as const;
export type OrderType = keyof typeof orderTypes;
export type OrderStatus = keyof typeof orderStatuses;
export type PriorityCode = keyof typeof priorities;
export type RoleCode = 'super_admin' | 'gerente' | 'analista' | 'tecnico' | 'cliente' | 'leitura';
export interface ErpScope {
  userId: string;
  tenantId: string;
  role: RoleCode;
  sessionKey: string;
}
export interface CreateOrderInput {
  type: OrderType;
  priority: PriorityCode;
  title: string;
  description: string;
  occurrenceId?: string;
  requester?: string;
  sector?: string;
  origin?: string;
  ownerUserId?: string;
  ownerName?: string;
  assigneeUserId?: string;
  analystName?: string;
  deadlineAt?: string;
  tags?: string[];
  internalNotes?: string;
}
export type UpdateOrderInput = Partial<
  Pick<
    CreateOrderInput,
    | 'type'
    | 'priority'
    | 'title'
    | 'description'
    | 'requester'
    | 'sector'
    | 'origin'
    | 'ownerName'
    | 'analystName'
    | 'deadlineAt'
    | 'tags'
    | 'internalNotes'
  >
> & { expectedVersion?: number };
export interface OrderTransitionInput {
  toStatus: OrderStatus;
  reason: string;
  expectedVersion?: number;
}
export interface ServiceOrder extends CreateOrderInput {
  id: string;
  tenantId: string;
  protocol: string;
  status: OrderStatus;
  version: number;
  isCustomerVisible: boolean;
  createdAt: string;
  updatedAt: string;
  occurrences?: Record<string, unknown>[];
  approvals?: Record<string, unknown>[];
  attachments?: Record<string, unknown>[];
}
export interface CreateOccurrenceInput {
  provider: string;
  type: string;
  status?: keyof typeof occurrenceStatuses;
  sector: string;
  origin: string;
  openedByName: string;
  analystResponsible: string;
  description: string;
  createdAt?: string;
  firstOrder: Pick<CreateOrderInput, 'type' | 'description'> & Partial<CreateOrderInput>;
}
export interface CreateChangeInput {
  title: string;
  description: string;
  justification: string;
  rollbackPlan?: string | null;
  risk?: 'BAIXO' | 'MEDIO' | 'ALTO' | 'CRITICO';
  plannedStart?: string;
  plannedEnd?: string;
  affectedSystems?: string[];
  tags?: string[];
}
export interface TimeEntryInput {
  orderId: string;
  minutes: number;
  description?: string;
  billable?: boolean;
  loggedAt?: string;
}
export interface WorkflowNode {
  id: string;
  type: 'trigger' | 'condition' | 'action';
  subtype: string;
  config: Record<string, unknown>;
  position: { x: number; y: number };
}
export interface WorkflowDefinition {
  nodes: WorkflowNode[];
  edges: { id: string; source: string; target: string; label?: string }[];
  governance?: {
    ownerTeam?: string;
    requiresApproval?: boolean;
    changeTicketRequired?: boolean;
    maxExecutionsPerHour?: number;
    stopOnFailure?: boolean;
  };
  versions?: WorkflowVersion[];
}
export interface WorkflowVersion {
  version: number;
  createdAt: string;
  createdBy?: string | null;
  name: string;
  description?: string;
  definition: Omit<WorkflowDefinition, 'versions'>;
}
export interface ProcessChildOrder {
  id: string;
  title: string;
  type: OrderType;
  priority: PriorityCode;
  sector?: string;
  origin?: string;
  description?: string;
  deadlineHours?: number;
  tags?: string[];
}
export interface ProcessTemplateInput {
  name: string;
  description?: string;
  enabled?: boolean;
  triggerOsTypes: OrderType[];
  definition: { childOrders: ProcessChildOrder[] };
}
export const changeTransitions: Record<
  keyof typeof changeStatuses,
  (keyof typeof changeStatuses)[]
> = {
  RASCUNHO: ['AGUARDANDO_APROVACAO', 'CANCELADO'],
  AGUARDANDO_APROVACAO: ['APROVADO', 'REJEITADO', 'CANCELADO'],
  APROVADO: ['EM_EXECUCAO', 'CANCELADO'],
  EM_EXECUCAO: ['CONCLUIDO', 'CANCELADO'],
  CONCLUIDO: [],
  CANCELADO: [],
  REJEITADO: [],
};
export type ErpRecord = { id: string } & Record<string, unknown>;
export type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
export interface ErpRequest {
  path: string;
  method?: HttpMethod;
  body?: unknown;
  signal?: AbortSignal;
}
export interface ErpDownload {
  blob: Blob;
  fileName?: string;
  rowCount?: number;
  truncated?: boolean;
}
export interface ErpTransport {
  request<T>(request: ErpRequest): Promise<T>;
  download?(path: string): Promise<Blob>;
  downloadWithMetadata?(path: string): Promise<ErpDownload>;
}
export interface BffAuthResult {
  authenticated?: boolean;
  twoFactorRequired?: boolean;
  temporaryToken?: string;
  redirectTo?: string;
}
export interface PublicSurvey {
  answered: boolean;
  order: { protocol: string; type: OrderType };
}
export interface SecuritySession extends ErpRecord {
  device?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  createdAt: string;
  expiresAt: string;
  isCurrent?: boolean;
}
export interface KnowledgeArticle extends ErpRecord {
  title: string;
  content: string;
  tags: string[];
  isPublished: boolean;
  updatedAt: string;
}
export interface CredentialMetadata extends ErpRecord {
  provider: string;
  equipmentType?: string;
  equipmentName?: string;
  environment: string;
  host: string;
  username: string;
  notes?: string | null;
}
export interface CredentialReveal extends CredentialMetadata {
  secret: string;
}
export interface PersonalNote extends ErpRecord {
  title: string;
  content?: string;
  pinned: boolean;
  updatedAt: string;
}
export interface ApiKeyMetadata extends ErpRecord {
  name: string;
  keyPrefix: string;
  active: boolean;
  expiresAt?: string;
  lastUsedAt?: string;
}
export interface ApiKeyCreated extends ApiKeyMetadata {
  key: string;
}
export interface CalendarConflict {
  hasConflict: boolean;
  conflictingEvents: ErpRecord[];
}
export interface TwoFactorSetup {
  secret: string;
  provisioning_url: string;
  qr_code_url: null;
}
export class ErpError extends Error {
  constructor(
    message: string,
    public status?: number,
  ) {
    super(message);
    this.name = 'ErpError';
  }
}
export function errorMessage(error: unknown): string {
  if (error instanceof ErpError) {
    if (error.status === 401) return 'Sua sessão expirou. Entre novamente antes de continuar.';
    if (error.status === 403) return 'Seu perfil não tem permissão para esta operação.';
    if (error.status === 409 || error.status === 412)
      return 'O ERP identificou um conflito de versão, agenda ou regra operacional. Atualize os dados e revise a operação antes de reenviar.';
  }
  return error instanceof Error
    ? error.message
    : 'Não foi possível concluir a operação. Tente novamente.';
}
export function queryPath(
  path: string,
  values: Record<string, string | number | boolean | undefined>,
) {
  const query = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined && value !== '') query.set(key, String(value));
  });
  return query.size ? `${path}?${query}` : path;
}
