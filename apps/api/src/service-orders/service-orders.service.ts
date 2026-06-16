/**
 * ServiceOrdersService
 *
 * Orquestra o ciclo de vida completo de uma ordem de serviço.
 *
 ## Seções (em ordem):
 *   1. Lifecycle    — create, update, addAnnotation, getById, list
 *   2. Transições   — transition, approve, assertTransitionAllowed
 *   3. Exports      — exportCsv, listExportHistory, downloadExportCsv
 *   4. Ocorrências  — listOccurrences, createOccurrenceWithFirstOrder, addOccurrenceAnnotation
 *   5. Helpers      — buildProtocol, sanitizeOrderForRole, csvCell, etc.
 *
 * Helpers compartilhados vivem em `./service-orders.helpers.ts` desde a extração
 * da Fase 8 (Sprint 2 do plano de melhorias).
 */
import {
  BadRequestException,
  ForbiddenException,
  forwardRef,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { csvCell, compactRecord, reduceCountRows } from './service-orders.helpers';
import {
  ApprovalStatus,
  AuditAction,
  OccurrenceStatus,
  Prisma,
  Priority,
  ServiceOrderStatus,
  ServiceOrderType,
} from '@prisma/client';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { basename, extname, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { validatePathWithinBase } from '../common/path-security';
import { EventsGateway } from '../events.gateway';
import { PrismaService } from '../prisma/prisma.service';
import { CsatService } from '../csat/csat.service';
import { WorkflowsService } from '../workflows/workflows.service';
import { SlaEngineService } from '../sla/sla-engine.service';
import { OsProcessTemplateService } from '../os-process-templates/os-process-templates.service';

type CreateOrderInput = {
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

type CreateOccurrenceInput = {
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
  firstOrder: {
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

type UpdateOccurrenceInput = {
  type?: string;
  status?: OccurrenceStatus;
  sector?: string;
  origin?: string;
  analystResponsible?: string;
  description?: string;
};

type ListOccurrencesInput = {
  provider?: string;
  search?: string;
  status?: OccurrenceStatus;
  limit?: number;
  offset?: number;
  includeOrders?: boolean;
};

type CreateOccurrenceOrderInput = {
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

type UpdateOrderInput = {
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
  tags?: string[];
  internalNotes?: string | null;
};

type TransitionInput = {
  toStatus: ServiceOrderStatus;
  reason: string;
};

type ListInput = {
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

type CsvExportResult = {
  fileName: string;
  content: string;
  rowCount: number;
  truncated: boolean;
};
type ExportHistoryItem = {
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
type ExportDownloadResult = {
  fileName: string;
  content: string;
};

const ROLE_SET = ['super_admin', 'gerente', 'analista', 'tecnico'] as const;
const ATTACHMENT_LIMIT = 10;
const ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024;
const EXPORT_MAX_ROWS = 10000;
const ALLOWED_EXTENSIONS = new Set([
  '.pdf',
  '.png',
  '.jpg',
  '.jpeg',
  '.txt',
  '.csv',
  '.zip',
  '.mp4',
  '.mov',
  '.webm',
  '.mp3',
  '.wav',
  '.ogg',
  '.aac',
  '.m4a',
]);
const ALLOWED_MIME = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'text/plain',
  'text/csv',
  'application/zip',
  'application/x-zip-compressed',
  'application/octet-stream',
  'video/mp4',
  'video/quicktime',
  'video/webm',
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/x-wav',
  'audio/ogg',
  'audio/aac',
  'audio/mp4',
]);
const MAX_CREATE_RETRIES = 5;

type Role = string;

@Injectable()
export class ServiceOrdersService {
  private readonly logger = new Logger(ServiceOrdersService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(EventsGateway) private readonly eventsGateway: EventsGateway,
    @Inject(SlaEngineService) private readonly slaEngine: SlaEngineService,
    @Optional() @Inject(CsatService) private readonly csatService?: CsatService,
    @Optional()
    @Inject(forwardRef(() => WorkflowsService))
    private readonly workflowsService?: WorkflowsService,
    @Optional()
    @Inject(OsProcessTemplateService)
    private readonly osProcessTemplateService?: OsProcessTemplateService,
  ) {}

  async create(authUserId: string | null, role: string, input: CreateOrderInput) {
    if (!ROLE_SET.includes(role as (typeof ROLE_SET)[number])) {
      throw new ForbiddenException('Role is not allowed to create service orders.');
    }

    if (input.occurrenceId) {
      const occurrence = await this.prisma.occurrence.findFirst({
        where: { id: input.occurrenceId, tenantId: input.tenantId, deletedAt: null },
        select: { id: true },
      });
      if (!occurrence) {
        throw new BadRequestException('Occurrence not found for this tenant.');
      }
    }

    const assignedUserIds = [
      ...new Set([input.ownerUserId, input.assigneeUserId].filter(Boolean)),
    ] as string[];
    if (assignedUserIds.length > 0) {
      const memberships = await this.prisma.userTenant.findMany({
        where: { tenantId: input.tenantId, userId: { in: assignedUserIds } },
        select: { userId: true },
      });
      const tenantUsers = new Set(memberships.map((membership) => membership.userId));
      if (assignedUserIds.some((userId) => !tenantUsers.has(userId))) {
        throw new BadRequestException(
          'Owner and assignee must belong to the service order tenant.',
        );
      }
    }

    const now = new Date();

    // Utilize SLA Engine to dynamically compute deadlines rather than raw timestamp addition
    const slaPolicy = await this.slaEngine.findApplicablePolicy(
      input.tenantId,
      input.priority,
      input.type,
    );
    const calculatedDeadline = await this.slaEngine.calculateTargetDate(
      now,
      slaPolicy.hours,
      input.tenantId,
    );

    const deadlineAt = input.deadlineAt ? new Date(input.deadlineAt) : calculatedDeadline;

    const created = await this.withCreateRetry(async () => {
      const protocol = await this.buildProtocol(input.tenantId);
      return this.prisma.serviceOrder.create({
        data: {
          tenantId: input.tenantId,
          occurrenceId: input.occurrenceId,
          protocol,
          sourceSystem: 'ERP',
          type: input.type,
          priority: input.priority,
          status: 'ABERTA',
          title: input.title,
          description: input.description,
          ownerUserId: input.ownerUserId,
          ownerName: input.ownerName,
          assigneeUserId: input.assigneeUserId,
          analystName: input.analystName,
          requester: input.requester,
          sector: input.sector,
          origin: input.origin,
          deadlineAt,
          tags: input.tags || [],
          internalNotes: input.internalNotes,
          occurrences: {
            create: {
              ...(authUserId ? { actorUserId: authUserId } : {}),
              sourceSystem: 'ERP',
              message: 'OS criada manualmente no ERP.',
            },
          },
        },
        include: {
          occurrences: {
            orderBy: { createdAt: 'desc' },
            include: {
              actorUser: {
                select: { id: true, name: true, email: true },
              },
            },
          },
        },
      });
    });

    await this.logAudit(input.tenantId, authUserId, 'OS_CREATE', 'service_order', created.id, {
      protocol: created.protocol,
      type: input.type,
      priority: input.priority,
    });

    this.eventsGateway.emitTenantEvent(input.tenantId, 'service_order.created', {
      tenantId: input.tenantId,
      orderId: created.id,
      protocol: created.protocol,
      priority: created.priority,
      status: created.status,
      at: new Date().toISOString(),
    });

    this.eventsGateway.emitTenantEvent(input.tenantId, 'service_order_created', {
      orderId: created.id,
      protocol: created.protocol,
    });

    this.workflowsService
      ?.executeForEvent(input.tenantId, {
        type: 'order_created',
        order: {
          id: created.id,
          protocol: created.protocol,
          title: created.title,
          type: created.type,
          priority: created.priority,
          status: created.status,
          requester: created.requester,
          sector: created.sector,
          analystName: created.analystName,
          deadlineAt: created.deadlineAt?.toISOString(),
        },
      })
      .catch((error) => {
        this.logger.warn(
          `Workflow execution failed after order creation: ${(error as Error).message}`,
        );
      });

    return created;
  }

  async list(tenantId: string, input: ListInput = {}, role?: string | null) {
    const where = this.buildWhere(tenantId, input, role);

    const rows = await this.prisma.serviceOrder.findMany({
      where,
      orderBy: this.buildOrderBy(input),
      ...(input.limit ? { take: input.limit } : {}),
      ...(input.offset ? { skip: input.offset } : {}),
      include: {
        occurrence: {
          select: {
            id: true,
            number: true,
            provider: true,
            type: true,
            status: true,
            sector: true,
            origin: true,
            openedByName: true,
            analystResponsible: true,
            description: true,
            createdAt: true,
          },
        },
        owner: { select: { id: true, name: true, email: true } },
        assignee: { select: { id: true, name: true, email: true } },
      },
    });

    return rows.map((row) => this.sanitizeOrderForRole(row, role));
  }

  async summary(tenantId: string, input: ListInput = {}, role?: string | null) {
    const where = this.buildWhere(tenantId, input, role);
    const now = new Date();
    const twoHours = new Date(now.getTime() + 2 * 60 * 60 * 1000);
    const activeStatuses: ServiceOrderStatus[] = [
      'ABERTA',
      'EM_ANALISE',
      'AG_CAMPO',
      'AG_TERCEIROS',
      'RESOLVIDA',
    ];

    const [
      total,
      active,
      closed,
      overdueActive,
      risk2h,
      criticalOverdue,
      byStatusRows,
      byPriorityRows,
      byTypeRows,
      topAssigneesRows,
    ] = await Promise.all([
      this.prisma.serviceOrder.count({ where }),
      this.prisma.serviceOrder.count({
        where: this.andWhere(where, { status: { in: activeStatuses } }),
      }),
      this.prisma.serviceOrder.count({
        where: this.andWhere(where, { status: { in: ['FECHADA', 'CANCELADA'] } }),
      }),
      this.prisma.serviceOrder.count({
        where: this.andWhere(where, {
          status: { in: activeStatuses },
          deadlineAt: { lt: now },
        }),
      }),
      this.prisma.serviceOrder.count({
        where: this.andWhere(where, {
          status: { in: activeStatuses },
          deadlineAt: { gte: now, lte: twoHours },
        }),
      }),
      this.prisma.serviceOrder.count({
        where: this.andWhere(where, {
          status: { in: activeStatuses },
          priority: 'CRITICA',
          deadlineAt: { lt: now },
        }),
      }),
      this.prisma.serviceOrder.groupBy({
        by: ['status'],
        where,
        _count: { _all: true },
      }),
      this.prisma.serviceOrder.groupBy({
        by: ['priority'],
        where,
        _count: { _all: true },
      }),
      this.prisma.serviceOrder.groupBy({
        by: ['type'],
        where,
        _count: { _all: true },
      }),
      this.prisma.serviceOrder.groupBy({
        by: ['assigneeUserId'],
        where: this.andWhere(where, { assigneeUserId: { not: null } }),
        _count: { _all: true },
        orderBy: {
          _count: {
            assigneeUserId: 'desc',
          },
        },
        take: 5,
      }),
    ]);

    const byStatus = this.reduceCountRows<ServiceOrderStatus>(
      byStatusRows.map((row) => ({
        key: row.status,
        count: (row._count as { _all?: number } | undefined)?._all ?? 0,
      })),
      ['ABERTA', 'EM_ANALISE', 'AG_CAMPO', 'AG_TERCEIROS', 'RESOLVIDA', 'FECHADA', 'CANCELADA'],
    );

    const byPriority = this.reduceCountRows<Priority>(
      byPriorityRows.map((row) => ({
        key: row.priority,
        count: (row._count as { _all?: number } | undefined)?._all ?? 0,
      })),
      ['BAIXA', 'NORMAL', 'ALTA', 'CRITICA'],
    );

    const byType = this.reduceCountRows<ServiceOrderType>(
      byTypeRows.map((row) => ({
        key: row.type,
        count: (row._count as { _all?: number } | undefined)?._all ?? 0,
      })),
      [
        'ROMPIMENTO',
        'LENTIDAO',
        'CONFIGURACAO_ONU',
        'TROCA_SENHA',
        'CANCELAMENTO',
        'AUDITORIA',
        'INSTALACAO',
        'BGP',
      ],
    );

    const assigneeIds = topAssigneesRows
      .map((row) => row.assigneeUserId)
      .filter(Boolean) as string[];
    const assignees = assigneeIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: assigneeIds } },
          select: { id: true, name: true },
        })
      : [];
    const assigneeNameMap = new Map(assignees.map((item) => [item.id, item.name]));
    const topAssignees = topAssigneesRows.map((row) => ({
      userId: row.assigneeUserId as string,
      name: assigneeNameMap.get(row.assigneeUserId as string) || 'Nao atribuido',
      count: (row._count as { _all?: number } | undefined)?._all ?? 0,
    }));

    return {
      total,
      active,
      closed,
      overdueActive,
      risk2h,
      criticalOverdue,
      byStatus,
      byPriority,
      byType,
      topAssignees,
    };
  }

  async exportCsv(
    tenantId: string,
    authUserId: string,
    role: string,
    input: ListInput = {},
  ): Promise<CsvExportResult> {
    if (!['super_admin', 'gerente', 'analista', 'leitura'].includes(role)) {
      throw new ForbiddenException('Role is not allowed to export service orders.');
    }

    const where = this.buildWhere(tenantId, input, role);
    const rows = await this.prisma.serviceOrder.findMany({
      where,
      orderBy: this.buildOrderBy(input),
      take: EXPORT_MAX_ROWS + 1,
      include: {
        owner: { select: { name: true } },
        assignee: { select: { name: true } },
      },
    });

    const truncated = rows.length > EXPORT_MAX_ROWS;
    const exportRows = truncated ? rows.slice(0, EXPORT_MAX_ROWS) : rows;
    const header = [
      'protocol',
      'externalProtocol',
      'title',
      'description',
      'type',
      'priority',
      'status',
      'createdAt',
      'updatedAt',
      'deadlineAt',
      'resolvedAt',
      'closedAt',
      'ownerName',
      'assigneeName',
    ];

    const csvLines = [header.join(',')];
    for (const row of exportRows) {
      const line = [
        row.protocol,
        row.externalProtocol,
        row.title,
        row.description,
        row.type,
        row.priority,
        row.status,
        row.createdAt.toISOString(),
        row.updatedAt.toISOString(),
        row.deadlineAt.toISOString(),
        row.resolvedAt?.toISOString() || '',
        row.closedAt?.toISOString() || '',
        row.owner?.name || '',
        row.assignee?.name || '',
      ];

      csvLines.push(line.map((value) => this.csvCell(value)).join(','));
    }

    const filters = this.compactRecord(input);
    const reportExport = await this.prisma.reportExport.create({
      data: {
        tenantId,
        actorUserId: authUserId,
        reportType: 'service_orders_csv',
        filters: filters as Prisma.InputJsonValue,
        status: 'PROCESSING',
      },
    });

    const fileName = `service-orders-${new Date().toISOString().slice(0, 10)}-${reportExport.id.slice(0, 8)}.csv`;
    const uploadRoot = process.env.UPLOAD_ROOT || join(process.cwd(), 'uploads');
    const exportDir = join(uploadRoot, 'reports', tenantId);
    let filePath = '';
    try {
      await mkdir(exportDir, { recursive: true });
      filePath = join(exportDir, fileName);
      await writeFile(filePath, csvLines.join('\n'), 'utf-8');

      await this.prisma.reportExport.update({
        where: { id: reportExport.id },
        data: {
          fileUrl: filePath,
          status: truncated ? 'COMPLETED_TRUNCATED' : 'COMPLETED',
        },
      });
    } catch {
      await this.prisma.reportExport.update({
        where: { id: reportExport.id },
        data: {
          status: 'FAILED',
        },
      });
      throw new BadRequestException('Failed to persist CSV export.');
    }

    await this.logAudit(tenantId, authUserId, 'EXPORT', 'report_export', reportExport.id, {
      reportType: 'service_orders_csv',
      filters,
      rowCount: exportRows.length,
      truncated,
      operation: 'create',
    });

    return {
      fileName,
      content: csvLines.join('\n'),
      rowCount: exportRows.length,
      truncated,
    };
  }

  async listExportHistory(
    tenantId: string,
    role: string,
    limit = 20,
    offset = 0,
  ): Promise<ExportHistoryItem[]> {
    if (!['super_admin', 'gerente', 'analista', 'leitura'].includes(role)) {
      throw new ForbiddenException('Role is not allowed to read export history.');
    }

    const rows = await this.prisma.reportExport.findMany({
      where: {
        tenantId,
        reportType: 'service_orders_csv',
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
      include: {
        actorUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return rows.map((row) => ({
      id: row.id,
      reportType: row.reportType,
      status: row.status,
      createdAt: row.createdAt.toISOString(),
      fileAvailable: Boolean(row.fileUrl),
      actor: row.actorUser
        ? {
            id: row.actorUser.id,
            name: row.actorUser.name,
            email: row.actorUser.email,
          }
        : null,
    }));
  }

  async downloadExportCsv(
    tenantId: string,
    exportId: string,
    authUserId: string,
    role: string,
  ): Promise<ExportDownloadResult> {
    if (!['super_admin', 'gerente', 'analista', 'leitura'].includes(role)) {
      throw new ForbiddenException('Role is not allowed to download exports.');
    }

    const report = await this.prisma.reportExport.findFirst({
      where: {
        id: exportId,
        tenantId,
        reportType: 'service_orders_csv',
      },
      select: {
        id: true,
        fileUrl: true,
      },
    });

    if (!report || !report.fileUrl) {
      throw new NotFoundException('Export file not found.');
    }

    // ✅ SECURITY: Validar que arquivo está dentro de UPLOAD_ROOT
    // Previne path traversal attacks (../../etc/passwd)
    const uploadRoot = process.env.UPLOAD_ROOT || join(process.cwd(), 'uploads');
    const safePath = validatePathWithinBase(uploadRoot, report.fileUrl);

    const content = await readFile(safePath, 'utf-8');
    const fileName = basename(safePath);

    await this.logAudit(tenantId, authUserId, 'EXPORT', 'report_export', report.id, {
      reportType: 'service_orders_csv',
      operation: 'download',
    });

    return { fileName, content };
  }

  async getById(tenantId: string, id: string, role?: string | null) {
    const order = await this.prisma.serviceOrder.findFirst({
      where: {
        id,
        tenantId,
        deletedAt: null,
        ...(this.isCustomerRole(role) ? { isCustomerVisible: true } : {}),
      },
      include: {
        occurrence: true,
        occurrences: {
          ...(this.isCustomerRole(role) ? { where: { isCustomerVisible: true } } : {}),
          orderBy: { createdAt: 'desc' },
          include: {
            actorUser: {
              select: { id: true, name: true, email: true },
            },
          },
        },
        attachments: {
          ...(this.isCustomerRole(role) ? { where: { isInternal: false } } : {}),
          orderBy: { uploadedAt: 'desc' },
        },
        approvals: this.isCustomerRole(role) ? false : { orderBy: { createdAt: 'desc' } },
      },
    });

    if (!order) {
      throw new NotFoundException('Service order not found.');
    }

    return this.sanitizeOrderForRole(order, role);
  }

  async listOccurrences(tenantId: string, input: ListOccurrencesInput = {}, role?: string | null) {
    const where: Prisma.OccurrenceWhereInput = {
      tenantId,
      deletedAt: null,
    };

    if (this.isCustomerRole(role)) {
      where.serviceOrders = {
        some: {
          deletedAt: null,
          isCustomerVisible: true,
        },
      };
    }

    if (input.provider) {
      where.provider = { contains: input.provider, mode: 'insensitive' };
    }
    if (input.status) {
      where.status = input.status;
    }
    if (input.search) {
      where.OR = [
        { number: { contains: input.search, mode: 'insensitive' } },
        { provider: { contains: input.search, mode: 'insensitive' } },
        { type: { contains: input.search, mode: 'insensitive' } },
        { sector: { contains: input.search, mode: 'insensitive' } },
        { origin: { contains: input.search, mode: 'insensitive' } },
        { description: { contains: input.search, mode: 'insensitive' } },
      ];
    }

    return this.prisma.occurrence.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      ...(input.limit ? { take: input.limit } : {}),
      ...(input.offset ? { skip: input.offset } : {}),
      include: {
        annotations: {
          ...(this.isCustomerRole(role) ? { where: { isCustomerVisible: true } } : {}),
          orderBy: { createdAt: 'desc' },
          include: {
            actorUser: {
              select: { id: true, name: true, email: true },
            },
          },
        },
        ...(input.includeOrders
          ? {
              serviceOrders: {
                where: {
                  deletedAt: null,
                  ...(this.isCustomerRole(role) ? { isCustomerVisible: true } : {}),
                },
                orderBy: { createdAt: 'desc' },
                include: {
                  attachments: {
                    ...(this.isCustomerRole(role) ? { where: { isInternal: false } } : {}),
                    orderBy: { uploadedAt: 'desc' },
                  },
                  occurrences: {
                    ...(this.isCustomerRole(role) ? { where: { isCustomerVisible: true } } : {}),
                    orderBy: { createdAt: 'desc' },
                    include: {
                      actorUser: {
                        select: { id: true, name: true, email: true },
                      },
                    },
                  },
                },
              },
            }
          : {}),
      },
    });
  }

  async getOccurrenceById(tenantId: string, occurrenceId: string, role?: string | null) {
    const occurrence = await this.prisma.occurrence.findFirst({
      where: {
        id: occurrenceId,
        tenantId,
        deletedAt: null,
        ...(this.isCustomerRole(role)
          ? { serviceOrders: { some: { deletedAt: null, isCustomerVisible: true } } }
          : {}),
      },
      include: {
        annotations: {
          ...(this.isCustomerRole(role) ? { where: { isCustomerVisible: true } } : {}),
          orderBy: { createdAt: 'desc' },
          include: {
            actorUser: {
              select: { id: true, name: true, email: true },
            },
          },
        },
        serviceOrders: {
          where: {
            deletedAt: null,
            ...(this.isCustomerRole(role) ? { isCustomerVisible: true } : {}),
          },
          orderBy: { createdAt: 'desc' },
          include: {
            attachments: {
              ...(this.isCustomerRole(role) ? { where: { isInternal: false } } : {}),
              orderBy: { uploadedAt: 'desc' },
            },
            occurrences: {
              ...(this.isCustomerRole(role) ? { where: { isCustomerVisible: true } } : {}),
              orderBy: { createdAt: 'desc' },
              include: {
                actorUser: {
                  select: { id: true, name: true, email: true },
                },
              },
            },
          },
        },
      },
    });
    if (!occurrence) {
      throw new NotFoundException('Occurrence not found.');
    }
    return occurrence;
  }

  async createOccurrenceWithFirstOrder(
    authUserId: string,
    role: string,
    input: CreateOccurrenceInput,
  ) {
    if (!ROLE_SET.includes(role as (typeof ROLE_SET)[number])) {
      throw new ForbiddenException('Role is not allowed to create occurrence.');
    }

    const now = new Date();
    const occurrenceCreatedAt = input.createdAt ? new Date(input.createdAt) : now;
    const firstOrderPriority = input.firstOrder.priority || 'NORMAL';
    const firstOrderPolicy = await this.slaEngine.findApplicablePolicy(
      input.tenantId,
      firstOrderPriority,
      input.firstOrder.type,
    );
    const firstOrderDeadline = input.firstOrder.deadlineAt
      ? new Date(input.firstOrder.deadlineAt)
      : await this.slaEngine.calculateTargetDate(now, firstOrderPolicy.hours, input.tenantId);
    const firstOrderStatus = input.firstOrder.status || 'ABERTA';

    const created = await this.withCreateRetry(() =>
      this.prisma.$transaction(async (tx) => {
        const protocol = await this.buildProtocol(input.tenantId);
        const occurrenceNumber = await this.buildOccurrenceNumber(input.tenantId);

        const occurrence = await tx.occurrence.create({
          data: {
            tenantId: input.tenantId,
            number: occurrenceNumber,
            provider: input.provider,
            type: input.type,
            status: input.status || 'ABERTA',
            sector: input.sector,
            origin: input.origin,
            openedByName: input.openedByName,
            analystResponsible: input.analystResponsible,
            description: input.description,
            createdAt: occurrenceCreatedAt,
          },
        });

        const order = await tx.serviceOrder.create({
          data: {
            tenantId: input.tenantId,
            occurrenceId: occurrence.id,
            protocol,
            sourceSystem: 'ERP',
            type: input.firstOrder.type,
            priority: firstOrderPriority,
            status: firstOrderStatus,
            title: input.firstOrder.title || `O.S ${input.firstOrder.type} - ${input.provider}`,
            description: input.firstOrder.description,
            requester: input.firstOrder.requester,
            sector: input.firstOrder.sector || input.sector,
            origin: input.firstOrder.origin || input.origin,
            ownerName: input.firstOrder.analystName || input.analystResponsible,
            analystName: input.firstOrder.analystName || input.analystResponsible,
            deadlineAt: firstOrderDeadline,
            tags: input.firstOrder.tags || [],
            internalNotes: input.firstOrder.internalNotes,
            occurrences: {
              create: {
                actorUserId: authUserId,
                sourceSystem: 'ERP',
                message: `O.S criada na ocorrencia ${occurrence.number}.`,
              },
            },
          },
        });

        return { occurrence, order };
      }),
    );

    await this.logAudit(
      input.tenantId,
      authUserId,
      'OS_CREATE',
      'occurrence',
      created.occurrence.id,
      {
        occurrenceNumber: created.occurrence.number,
        provider: created.occurrence.provider,
        firstOrderId: created.order.id,
        firstOrderProtocol: created.order.protocol,
      },
    );

    this.eventsGateway.emitTenantEvent(input.tenantId, 'occurrence.created', {
      tenantId: input.tenantId,
      occurrenceId: created.occurrence.id,
      occurrenceNumber: created.occurrence.number,
      provider: created.occurrence.provider,
      at: new Date().toISOString(),
    });

    this.eventsGateway.emitTenantEvent(input.tenantId, 'service_order.created', {
      tenantId: input.tenantId,
      orderId: created.order.id,
      protocol: created.order.protocol,
      occurrenceId: created.occurrence.id,
      occurrenceNumber: created.occurrence.number,
      at: new Date().toISOString(),
    });

    return this.getOccurrenceById(input.tenantId, created.occurrence.id);
  }

  async updateOccurrence(
    tenantId: string,
    occurrenceId: string,
    authUserId: string,
    role: string,
    patch: UpdateOccurrenceInput,
  ) {
    if (!['super_admin', 'gerente', 'analista'].includes(role)) {
      throw new ForbiddenException('Role is not allowed to update occurrence.');
    }

    const occurrence = await this.prisma.occurrence.findFirst({
      where: { id: occurrenceId, tenantId, deletedAt: null },
      select: { id: true, number: true },
    });
    if (!occurrence) {
      throw new NotFoundException('Occurrence not found.');
    }

    const updated = await this.prisma.occurrence.update({
      where: { id: occurrence.id },
      data: {
        ...(patch.type !== undefined ? { type: patch.type } : {}),
        ...(patch.status !== undefined ? { status: patch.status } : {}),
        ...(patch.sector !== undefined ? { sector: patch.sector } : {}),
        ...(patch.origin !== undefined ? { origin: patch.origin } : {}),
        ...(patch.analystResponsible !== undefined
          ? { analystResponsible: patch.analystResponsible }
          : {}),
        ...(patch.description !== undefined ? { description: patch.description } : {}),
      },
    });

    await this.logAudit(tenantId, authUserId, 'OS_UPDATE', 'occurrence', occurrence.id, {
      occurrenceNumber: occurrence.number,
      patch,
    });

    this.eventsGateway.emitTenantEvent(tenantId, 'occurrence.updated', {
      tenantId,
      occurrenceId: updated.id,
      occurrenceNumber: updated.number,
      at: new Date().toISOString(),
    });

    return this.getOccurrenceById(tenantId, updated.id);
  }

  async addOccurrenceAnnotation(
    tenantId: string,
    occurrenceId: string,
    authUserId: string,
    role: string,
    message: string,
  ) {
    if (!['super_admin', 'gerente', 'analista'].includes(role)) {
      throw new ForbiddenException('Role is not allowed to annotate occurrence.');
    }

    const trimmedMessage = message.trim();
    if (!trimmedMessage) {
      throw new BadRequestException('Annotation message is required.');
    }

    const occurrence = await this.prisma.occurrence.findFirst({
      where: { id: occurrenceId, tenantId, deletedAt: null },
      select: { id: true, number: true },
    });
    if (!occurrence) {
      throw new NotFoundException('Occurrence not found.');
    }

    const created = await this.prisma.occurrenceAnnotation.create({
      data: {
        tenantId,
        occurrenceId: occurrence.id,
        actorUserId: authUserId,
        message: trimmedMessage,
      },
    });

    await this.logAudit(tenantId, authUserId, 'OS_UPDATE', 'occurrence_annotation', created.id, {
      occurrenceId: occurrence.id,
      occurrenceNumber: occurrence.number,
    });

    this.eventsGateway.emitTenantEvent(tenantId, 'occurrence.annotation_created', {
      tenantId,
      occurrenceId: occurrence.id,
      occurrenceNumber: occurrence.number,
      annotationId: created.id,
      at: new Date().toISOString(),
    });

    return this.getOccurrenceById(tenantId, occurrence.id);
  }

  async addOrderAnnotation(
    tenantId: string,
    orderId: string,
    authUserId: string,
    role: string,
    message: string,
  ) {
    if (!['super_admin', 'gerente', 'analista'].includes(role)) {
      throw new ForbiddenException('Role is not allowed to annotate service order.');
    }

    const trimmedMessage = message.trim();
    if (!trimmedMessage) {
      throw new BadRequestException('Annotation message is required.');
    }

    const order = await this.prisma.serviceOrder.findFirst({
      where: { id: orderId, tenantId, deletedAt: null },
      select: { id: true, protocol: true, occurrenceId: true },
    });
    if (!order) {
      throw new NotFoundException('Service order not found.');
    }

    const noteMessage = trimmedMessage;

    const result = await this.prisma.$transaction(async (tx) => {
      const updatedOrder = await tx.serviceOrder.update({
        where: { id: order.id },
        data: {
          occurrences: {
            create: {
              actorUserId: authUserId,
              sourceSystem: 'ERP',
              message: noteMessage,
            },
          },
        },
        include: {
          occurrence: true,
          occurrences: {
            orderBy: { createdAt: 'desc' },
            include: {
              actorUser: {
                select: { id: true, name: true, email: true },
              },
            },
          },
          attachments: { orderBy: { uploadedAt: 'desc' } },
        },
      });

      const mirroredOccurrenceAnnotation = order.occurrenceId
        ? await tx.occurrenceAnnotation.create({
            data: {
              tenantId,
              occurrenceId: order.occurrenceId,
              actorUserId: authUserId,
              message: `[O.S ${order.protocol}] ${noteMessage}`,
            },
          })
        : null;

      return { updatedOrder, mirroredOccurrenceAnnotation };
    });

    await this.logAudit(tenantId, authUserId, 'OS_UPDATE', 'service_order_annotation', order.id, {
      protocol: order.protocol,
    });

    this.eventsGateway.emitTenantEvent(tenantId, 'service_order.annotation_created', {
      tenantId,
      orderId: result.updatedOrder.id,
      protocol: result.updatedOrder.protocol,
      at: new Date().toISOString(),
    });

    if (order.occurrenceId && result.mirroredOccurrenceAnnotation) {
      this.eventsGateway.emitTenantEvent(tenantId, 'occurrence.annotation_created', {
        tenantId,
        occurrenceId: order.occurrenceId,
        annotationId: result.mirroredOccurrenceAnnotation.id,
        at: new Date().toISOString(),
      });
    }

    return result.updatedOrder;
  }

  async createOrderInOccurrence(
    tenantId: string,
    occurrenceId: string,
    authUserId: string,
    role: string,
    input: CreateOccurrenceOrderInput,
  ) {
    if (!ROLE_SET.includes(role as (typeof ROLE_SET)[number])) {
      throw new ForbiddenException('Role is not allowed to create order in occurrence.');
    }

    const occurrence = await this.prisma.occurrence.findFirst({
      where: { id: occurrenceId, tenantId, deletedAt: null },
      select: {
        id: true,
        number: true,
        provider: true,
        sector: true,
        origin: true,
        analystResponsible: true,
      },
    });
    if (!occurrence) {
      throw new NotFoundException('Occurrence not found.');
    }

    const priority = input.priority || 'NORMAL';
    const slaPolicy = await this.slaEngine.findApplicablePolicy(tenantId, priority, input.type);
    const deadlineAt = input.deadlineAt
      ? new Date(input.deadlineAt)
      : await this.slaEngine.calculateTargetDate(new Date(), slaPolicy.hours, tenantId);
    const status = input.status || 'ABERTA';

    const created = await this.withCreateRetry(async () => {
      const protocol = await this.buildProtocol(tenantId);
      return this.prisma.serviceOrder.create({
        data: {
          tenantId,
          occurrenceId: occurrence.id,
          protocol,
          sourceSystem: 'ERP',
          type: input.type,
          priority,
          status,
          title: input.title || `O.S ${input.type} - ${occurrence.provider}`,
          description: input.description,
          requester: input.requester,
          sector: input.sector || occurrence.sector,
          origin: input.origin || occurrence.origin,
          ownerName: input.analystName || occurrence.analystResponsible,
          analystName: input.analystName || occurrence.analystResponsible,
          deadlineAt,
          tags: input.tags || [],
          internalNotes: input.internalNotes,
          occurrences: {
            create: {
              actorUserId: authUserId,
              sourceSystem: 'ERP',
              message: `O.S criada na ocorrencia ${occurrence.number}.`,
            },
          },
        },
        include: {
          attachments: { orderBy: { uploadedAt: 'desc' } },
          occurrences: {
            orderBy: { createdAt: 'desc' },
            include: {
              actorUser: {
                select: { id: true, name: true, email: true },
              },
            },
          },
        },
      });
    });

    await this.logAudit(tenantId, authUserId, 'OS_CREATE', 'service_order', created.id, {
      protocol: created.protocol,
      occurrenceId: occurrence.id,
      occurrenceNumber: occurrence.number,
    });

    this.eventsGateway.emitTenantEvent(tenantId, 'service_order.created', {
      tenantId,
      orderId: created.id,
      protocol: created.protocol,
      occurrenceId: occurrence.id,
      occurrenceNumber: occurrence.number,
      at: new Date().toISOString(),
    });

    this.eventsGateway.emitTenantEvent(tenantId, 'service_order_created', {
      orderId: created.id,
      protocol: created.protocol,
    });
    return created;
  }

  async updateOrder(
    tenantId: string,
    orderId: string,
    authUserId: string,
    role: string,
    patch: UpdateOrderInput,
  ) {
    if (!['super_admin', 'gerente', 'analista', 'tecnico'].includes(role)) {
      throw new ForbiddenException('Role is not allowed to update service order.');
    }

    const order = await this.prisma.serviceOrder.findFirst({
      where: { id: orderId, tenantId, deletedAt: null },
      select: { id: true, protocol: true },
    });
    if (!order) {
      throw new NotFoundException('Service order not found.');
    }

    const data: Prisma.ServiceOrderUpdateInput = {
      ...(patch.type !== undefined ? { type: patch.type } : {}),
      ...(patch.priority !== undefined ? { priority: patch.priority } : {}),
      ...(patch.title !== undefined ? { title: patch.title } : {}),
      ...(patch.description !== undefined ? { description: patch.description } : {}),
      ...(patch.requester !== undefined ? { requester: patch.requester } : {}),
      ...(patch.sector !== undefined ? { sector: patch.sector } : {}),
      ...(patch.origin !== undefined ? { origin: patch.origin } : {}),
      ...(patch.analystName !== undefined ? { analystName: patch.analystName } : {}),
      ...(patch.ownerName !== undefined ? { ownerName: patch.ownerName } : {}),
      ...(patch.tags !== undefined ? { tags: patch.tags } : {}),
      ...(patch.internalNotes !== undefined ? { internalNotes: patch.internalNotes } : {}),
      ...(patch.deadlineAt ? { deadlineAt: new Date(patch.deadlineAt) } : {}),
    };

    const updated = await this.prisma.serviceOrder.update({
      where: { id: order.id },
      data: {
        ...data,
        occurrences: {
          create: {
            actorUserId: authUserId,
            sourceSystem: 'ERP',
            message: 'Campos da O.S atualizados manualmente.',
          },
        },
      },
      include: {
        occurrence: true,
        occurrences: {
          orderBy: { createdAt: 'desc' },
          include: {
            actorUser: {
              select: { id: true, name: true, email: true },
            },
          },
        },
        attachments: { orderBy: { uploadedAt: 'desc' } },
      },
    });

    await this.logAudit(tenantId, authUserId, 'OS_UPDATE', 'service_order', updated.id, {
      protocol: updated.protocol,
      patch,
    });

    this.eventsGateway.emitTenantEvent(tenantId, 'service_order.updated', {
      tenantId,
      orderId: updated.id,
      protocol: updated.protocol,
      at: new Date().toISOString(),
    });

    return updated;
  }

  async transition(
    tenantId: string,
    id: string,
    authUserId: string,
    role: string,
    input: TransitionInput,
  ) {
    const order = await this.prisma.serviceOrder.findFirst({
      where: { id, tenantId, deletedAt: null },
    });

    if (!order) {
      throw new NotFoundException('Service order not found.');
    }

    const from = order.status;
    const to = input.toStatus;

    if (from === to) {
      throw new BadRequestException('Source and destination statuses are equal.');
    }

    this.assertTransitionAllowed(from, to, role as Role);

    if (to === 'FECHADA' && from === 'RESOLVIDA') {
      const needsApproval = this.requiresDelayedApproval(order.priority, order.deadlineAt);
      if (needsApproval) {
        const approved = await this.prisma.serviceOrderApproval.findFirst({
          where: {
            serviceOrderId: order.id,
            status: 'APPROVED',
          },
          orderBy: {
            createdAt: 'desc',
          },
        });

        if (!approved) {
          throw new ForbiddenException(
            'Closing delayed ALTA/CRITICA order requires explicit approval before FECHADA.',
          );
        }
      }
    }

    const now = new Date();

    const updated = await this.prisma.serviceOrder.update({
      where: { id: order.id },
      data: {
        status: to,
        resolvedAt: to === 'RESOLVIDA' ? now : order.resolvedAt,
        closedAt: to === 'FECHADA' ? now : order.closedAt,
        canceledAt: to === 'CANCELADA' ? now : order.canceledAt,
        reopenedCount:
          from === 'FECHADA' && to === 'EM_ANALISE' ? order.reopenedCount + 1 : order.reopenedCount,
        occurrences: {
          create: {
            actorUserId: authUserId,
            sourceSystem: 'ERP',
            message: `Status alterado de ${from} para ${to}. Motivo: ${input.reason}`,
          },
        },
        serviceOrderStatusEvents: {
          create: {
            tenantId,
            fromStatus: from,
            toStatus: to,
            actorUserId: authUserId,
            reason: input.reason || null,
          },
        },
      },
      include: {
        occurrences: {
          orderBy: { createdAt: 'desc' },
          include: {
            actorUser: {
              select: { id: true, name: true, email: true },
            },
          },
        },
      },
    });

    const auditAction: AuditAction =
      to === 'FECHADA'
        ? 'OS_CLOSE'
        : to === 'CANCELADA'
          ? 'OS_CANCEL'
          : to === 'EM_ANALISE' && from === 'FECHADA'
            ? 'OS_REOPEN'
            : 'OS_UPDATE';

    await this.logAudit(tenantId, authUserId, auditAction, 'service_order', order.id, {
      from,
      to,
      reason: input.reason,
    });

    this.eventsGateway.emitTenantEvent(tenantId, 'service_order.transitioned', {
      tenantId,
      orderId: updated.id,
      protocol: updated.protocol,
      from,
      to,
      byUserId: authUserId,
      at: new Date().toISOString(),
    });

    // Auto-trigger CSAT survey when order is resolved
    if (to === 'RESOLVIDA') {
      this.csatService?.createForOrder(tenantId, order.id).catch((error) => {
        this.logger.warn(`CSAT creation failed for order ${order.id}: ${(error as Error).message}`);
      });
    }

    // Trigger workflow automation for this transition
    const eventType = to === 'FECHADA' ? ('order_closed' as const) : ('order_updated' as const);
    this.workflowsService
      ?.executeForEvent(tenantId, {
        type: eventType,
        order: {
          id: updated.id,
          protocol: updated.protocol,
          title: updated.title,
          type: updated.type,
          priority: updated.priority,
          status: updated.status,
          requester: updated.requester,
          sector: updated.sector,
          analystName: updated.analystName,
          deadlineAt: updated.deadlineAt?.toISOString(),
        },
      })
      .catch((error) => {
        this.logger.warn(`Workflow execution failed after transition: ${(error as Error).message}`);
      });

    // Disparar templates de processo ao fechar OS
    if (to === 'FECHADA') {
      this.osProcessTemplateService
        ?.executeForOrder(
          tenantId,
          {
            id: updated.id,
            protocol: updated.protocol,
            type: updated.type,
            occurrenceId: updated.occurrenceId,
            sector: updated.sector,
            origin: updated.origin,
          },
          authUserId,
        )
        .catch((error) => {
          this.logger.warn(
            `Process template execution failed for order ${updated.id}: ${(error as Error).message}`,
          );
        });
    }

    return updated;
  }

  async approve(
    tenantId: string,
    serviceOrderId: string,
    authUserId: string,
    role: string,
    decision: ApprovalStatus,
    reason?: string,
  ) {
    if (!['super_admin', 'gerente', 'analista'].includes(role)) {
      throw new ForbiddenException('Role is not allowed to approve service orders.');
    }

    const order = await this.prisma.serviceOrder.findFirst({
      where: { id: serviceOrderId, tenantId, deletedAt: null },
    });

    if (!order) {
      throw new NotFoundException('Service order not found.');
    }

    const approval = await this.prisma.serviceOrderApproval.create({
      data: {
        serviceOrderId,
        requestedById: authUserId,
        reviewedById: authUserId,
        status: decision,
        reason,
        reviewedAt: new Date(),
      },
    });

    await this.logAudit(tenantId, authUserId, 'OS_UPDATE', 'service_order_approval', approval.id, {
      serviceOrderId,
      decision,
      reason,
    });

    this.eventsGateway.emitTenantEvent(tenantId, 'service_order.approval', {
      tenantId,
      serviceOrderId,
      decision,
      reason: reason || null,
      byUserId: authUserId,
      at: new Date().toISOString(),
    });

    return approval;
  }

  async uploadAttachments(
    tenantId: string,
    serviceOrderId: string,
    authUserId: string,
    role: string,
    files: Array<Express.Multer.File>,
  ) {
    if (!['super_admin', 'gerente', 'analista', 'tecnico'].includes(role)) {
      throw new ForbiddenException('Role is not allowed to upload attachments.');
    }
    if (!files?.length) {
      throw new BadRequestException('At least one file is required.');
    }
    if (files.length > ATTACHMENT_LIMIT) {
      throw new BadRequestException(`Max ${ATTACHMENT_LIMIT} files per request.`);
    }

    const order = await this.prisma.serviceOrder.findFirst({
      where: { id: serviceOrderId, tenantId, deletedAt: null },
      select: { id: true, protocol: true },
    });

    if (!order) {
      throw new NotFoundException('Service order not found.');
    }

    const existingCount = await this.prisma.serviceOrderAttachment.count({
      where: { serviceOrderId },
    });
    if (existingCount + files.length > ATTACHMENT_LIMIT) {
      throw new BadRequestException(
        `Attachment limit exceeded. Current=${existingCount}, incoming=${files.length}, max=${ATTACHMENT_LIMIT}.`,
      );
    }

    const uploadRoot = process.env.UPLOAD_ROOT || join(process.cwd(), 'uploads');
    const orderDir = join(uploadRoot, 'service-orders', serviceOrderId);
    for (const file of files) {
      const originalName = basename(file.originalname || 'file');
      const ext = extname(originalName).toLowerCase();
      if (!ALLOWED_EXTENSIONS.has(ext)) {
        throw new BadRequestException(`Unsupported extension: ${ext || 'none'}`);
      }
      if (!ALLOWED_MIME.has(file.mimetype)) {
        throw new BadRequestException(`Unsupported mime type: ${file.mimetype}`);
      }
      if (file.size > ATTACHMENT_MAX_BYTES) {
        throw new BadRequestException(`File too large: ${originalName}`);
      }
    }

    await mkdir(orderDir, { recursive: true });

    const created = [];
    const storedPaths: string[] = [];
    try {
      for (const file of files) {
        const originalName = basename(file.originalname || 'file');
        const ext = extname(originalName).toLowerCase();
        const storageFileName = `${Date.now()}_${randomUUID()}${ext}`;
        const storagePath = join(orderDir, storageFileName);
        await writeFile(storagePath, file.buffer);
        storedPaths.push(storagePath);

        const attachment = await this.prisma.serviceOrderAttachment.create({
          data: {
            serviceOrderId,
            fileName: originalName,
            mimeType: file.mimetype,
            sizeBytes: file.size,
            storageKey: storagePath,
            isInternal: true,
          },
        });

        created.push(attachment);
      }

      await this.prisma.serviceOrderOccurrence.create({
        data: {
          serviceOrderId,
          actorUserId: authUserId,
          sourceSystem: 'ERP',
          message: `${created.length} anexo(s) adicionado(s).`,
        },
      });
    } catch (error) {
      if (created.length > 0) {
        await this.prisma.serviceOrderAttachment.deleteMany({
          where: { id: { in: created.map((attachment) => attachment.id) } },
        });
      }
      await Promise.all(storedPaths.map((path) => rm(path, { force: true })));
      throw error;
    }

    await this.logAudit(
      tenantId,
      authUserId,
      'OS_UPDATE',
      'service_order_attachment',
      serviceOrderId,
      {
        count: created.length,
        names: created.map((a) => a.fileName),
      },
    );

    this.eventsGateway.emitTenantEvent(tenantId, 'service_order.attachment_uploaded', {
      tenantId,
      serviceOrderId,
      protocol: order.protocol,
      count: created.length,
      at: new Date().toISOString(),
    });

    return created;
  }

  private assertTransitionAllowed(from: ServiceOrderStatus, to: ServiceOrderStatus, role: Role) {
    if (role === 'cliente' || role === 'leitura') {
      throw new ForbiddenException('Role cannot transition service order status.');
    }

    if (role === 'tecnico' && to !== 'RESOLVIDA') {
      throw new ForbiddenException('Tecnico can only move orders to RESOLVIDA.');
    }

    const table: Record<ServiceOrderStatus, ServiceOrderStatus[]> = {
      ABERTA: ['EM_ANALISE', 'CANCELADA'],
      EM_ANALISE: ['AG_CAMPO', 'AG_TERCEIROS', 'RESOLVIDA', 'CANCELADA'],
      AG_CAMPO: ['EM_ANALISE', 'RESOLVIDA'],
      AG_TERCEIROS: ['RESOLVIDA', 'EM_ANALISE'],
      RESOLVIDA: ['FECHADA', 'EM_ANALISE'],
      FECHADA: ['EM_ANALISE'],
      CANCELADA: [],
    };

    const allowedTo = table[from] || [];
    if (!allowedTo.includes(to)) {
      throw new BadRequestException(`Transition ${from} -> ${to} is not allowed.`);
    }
  }

  private requiresDelayedApproval(priority: Priority, deadlineAt: Date) {
    const isHighPriority = priority === 'ALTA' || priority === 'CRITICA';
    const delayed = deadlineAt.getTime() < Date.now();
    return isHighPriority && delayed;
  }

  private async buildProtocol(tenantId: string) {
    const year = new Date().getFullYear();
    const count = await this.prisma.serviceOrder.count({ where: { tenantId } });
    return `${year}${String(100000 + count + 1).padStart(6, '0')}`;
  }

  private async buildOccurrenceNumber(tenantId: string) {
    const year = new Date().getFullYear();
    const count = await this.prisma.occurrence.count({
      where: { tenantId },
    });
    return `${year}${String(260000 + count + 1).padStart(6, '0')}`;
  }

  private async withCreateRetry<T>(operation: () => Promise<T>): Promise<T> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= MAX_CREATE_RETRIES; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        if (!this.isRetryableUniqueCollision(error) || attempt === MAX_CREATE_RETRIES) {
          throw error;
        }
      }
    }
    throw lastError;
  }

  private isRetryableUniqueCollision(error: unknown): boolean {
    const known = error as Prisma.PrismaClientKnownRequestError | undefined;
    return known?.code === 'P2002';
  }

  private buildWhere(
    tenantId: string,
    input: ListInput,
    role?: string | null,
  ): Prisma.ServiceOrderWhereInput {
    const where: Prisma.ServiceOrderWhereInput = {
      tenantId,
      deletedAt: null,
    };

    if (this.isCustomerRole(role)) {
      where.isCustomerVisible = true;
    }

    if (input.status) where.status = input.status;
    if (input.priority) where.priority = input.priority;
    if (input.type) where.type = input.type;

    if (input.from || input.to) {
      where.createdAt = {
        ...(input.from ? { gte: new Date(input.from) } : {}),
        ...(input.to ? { lte: new Date(input.to) } : {}),
      };
    }

    if (input.search) {
      where.OR = [
        { protocol: { contains: input.search, mode: 'insensitive' } },
        { title: { contains: input.search, mode: 'insensitive' } },
        { description: { contains: input.search, mode: 'insensitive' } },
        { externalProtocol: { contains: input.search, mode: 'insensitive' } },
      ];
    }

    return where;
  }

  private andWhere(
    base: Prisma.ServiceOrderWhereInput,
    extra: Prisma.ServiceOrderWhereInput,
  ): Prisma.ServiceOrderWhereInput {
    return { AND: [base, extra] };
  }

  private isCustomerRole(role?: string | null): boolean {
    return role === 'cliente';
  }

  private sanitizeOrderForRole<T>(order: T, role?: string | null): T {
    if (!this.isCustomerRole(role) || !order || typeof order !== 'object') {
      return order;
    }

    const record = order as Record<string, unknown>;
    const sanitized: Record<string, unknown> = {
      ...record,
      internalNotes: null,
    };

    if ('approvals' in sanitized) {
      sanitized.approvals = [];
    }

    return sanitized as T;
  }

  private buildOrderBy(input: ListInput): Prisma.ServiceOrderOrderByWithRelationInput {
    const orderBy = input.orderBy || 'createdAt';
    const orderDir: Prisma.SortOrder = input.orderDir || 'desc';
    return { [orderBy]: orderDir };
  }

  /**
   * Aliases para funções extraídas em `service-orders.helpers.ts`.
   * Mantidos para preservar as assinaturas originais dentro do service.
   */
  private csvCell = csvCell;
  private compactRecord = compactRecord;
  private reduceCountRows = reduceCountRows;

  private async logAudit(
    tenantId: string,
    actorUserId: string | null,
    action: AuditAction,
    resourceType: string,
    resourceId: string,
    metadata: Record<string, unknown>,
  ) {
    await this.prisma.auditLog.create({
      data: {
        tenantId,
        actorUserId,
        action,
        resourceType,
        resourceId,
        metadata: metadata as any,
      },
    });
  }
}
