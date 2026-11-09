/** Tipos de entrada e saída do ServiceOrdersService (extraídos na divisão do arquivo, C-084). */
import type {
  OccurrenceStatus,
  Prisma,
  Priority,
  ServiceOrderStatus,
  ServiceOrderType,
} from '@prisma/client';
import type { DeadlineFilter } from './service-order-deadlines';

export type AttachmentDownloadResult = {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  filePath: string;
};

export type CreateOrderInput = {
  workflowTemplateCode?: string;
  tenantId: string;
  occurrenceId?: string;
  type: ServiceOrderType;
  priority: Priority;
  title: string;
  description: string;
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
};

export type CreateOccurrenceInput = {
  customerId?: string;
  tenantId: string;
  provider: string;
  type: string;
  status?: OccurrenceStatus;
  sector: string;
  origin: string;
  openedByName: string;
  analystResponsible: string;
  description: string;
  createdAt?: string;
  /** Origem externa (integrações): deduplicada por @@unique(tenantId, sourceSystem, externalId). */
  sourceSystem?: 'WEBHOOK' | 'POLLING';
  externalId?: string;
  sourceMetadata?: Prisma.InputJsonValue;
  firstOrder: {
    recordCompleted?: boolean;
    workflowTemplateCode?: string;
    ownerUserId?: string;
    assigneeUserId?: string;
    type: ServiceOrderType;
    status?: ServiceOrderStatus;
    priority?: Priority;
    title?: string;
    description: string;
    requester?: string;
    sector?: string;
    origin?: string;
    analystName?: string;
    deadlineAt?: string;
    tags?: string[];
    internalNotes?: string;
  };
};

export type UpdateOccurrenceInput = {
  type?: string;
  status?: OccurrenceStatus;
  sector?: string;
  origin?: string;
  analystResponsible?: string;
  description?: string;
};

export type ListOccurrencesInput = {
  customerId?: string;
  provider?: string;
  search?: string;
  status?: OccurrenceStatus;
  limit?: number;
  offset?: number;
  includeOrders?: boolean;
};

export type CreateOccurrenceOrderInput = {
  workflowTemplateCode?: string;
  ownerUserId?: string;
  assigneeUserId?: string;
  type: ServiceOrderType;
  status?: ServiceOrderStatus;
  priority?: Priority;
  title?: string;
  description: string;
  requester?: string;
  sector?: string;
  origin?: string;
  analystName?: string;
  deadlineAt?: string;
  tags?: string[];
  internalNotes?: string;
};

export type UpdateOrderInput = {
  ownerUserId?: string;
  assigneeUserId?: string;
  type?: ServiceOrderType;
  priority?: Priority;
  title?: string;
  description?: string;
  requester?: string | null;
  sector?: string | null;
  origin?: string | null;
  analystName?: string | null;
  ownerName?: string | null;
  deadlineAt?: string;
  deadlineReason?: string;
  tags?: string[];
  internalNotes?: string | null;
  expectedVersion?: number;
};

export type TransitionInput = {
  toStatus: ServiceOrderStatus;
  reason: string;
  expectedVersion?: number;
};

export type ListInput = {
  customerId?: string;
  situation?: 'active' | 'completed' | 'all';
  deadline?: DeadlineFilter;
  provider?: string;
  /** Internal scope resolved from the authenticated user, never a public user-ID filter. */
  responsibleUserId?: string;
  status?: ServiceOrderStatus;
  priority?: Priority;
  type?: ServiceOrderType;
  search?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
  orderBy?: 'createdAt' | 'updatedAt' | 'deadlineAt' | 'protocol' | 'priority' | 'status';
  orderDir?: 'asc' | 'desc';
};

export type CsvExportResult = {
  fileName: string;
  content: string;
  rowCount: number;
  truncated: boolean;
};
export type ExportHistoryItem = {
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
export type ExportDownloadResult = {
  fileName: string;
  content: string;
};
