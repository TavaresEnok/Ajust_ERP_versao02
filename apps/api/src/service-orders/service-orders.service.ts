import { attachmentMime } from '../common/attachment-content';
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
  ConflictException,
  ForbiddenException,
  forwardRef,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { csvCell, compactRecord, reduceCountRows } from './service-orders.helpers';
import { deadlineWhere } from './service-order-deadlines';
import {
  ApprovalStatus,
  AuditAction,
  Prisma,
  Priority,
  ServiceOrderStatus,
  ServiceOrderAttachment,
  ServiceOrderType,
} from '@prisma/client';
import { existsSync } from 'node:fs';
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
import { NotificationsService } from '../notifications/notifications.service';
import { OperationalProcessesService } from '../service-processes/operational-processes.service';
import {
  STATUS_LABEL,
  assertTransition,
  hasCurrentApproval,
  needsClosingApproval,
  statusDates,
} from './service-order-rules';
import { ServiceOrderLifecycleService } from './service-order-lifecycle.service';
import { syncOccurrenceStatus } from './occurrence-sync';
import { nextOrderProtocol } from './order-protocol';
import {
  andOrderWhere,
  buildOrderOrderBy,
  buildOrderWhere,
  isCustomerRole,
  sanitizeOrderForRole,
} from './service-order-queries';
import type {
  CreateOrderInput,
  CreateOccurrenceInput,
  UpdateOccurrenceInput,
  ListOccurrencesInput,
  CreateOccurrenceOrderInput,
  UpdateOrderInput,
  TransitionInput,
  ListInput,
  CsvExportResult,
  ExportHistoryItem,
  ExportDownloadResult,
} from './service-orders.types';
export type { AttachmentDownloadResult } from './service-orders.types';
import type { AttachmentDownloadResult } from './service-orders.types';

const ROLE_SET = ['super_admin', 'gerente', 'analista'] as const;
const ATTACHMENT_LIMIT = 10;
const ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024;
const EXPORT_MAX_ROWS = 10000;

const MAX_CREATE_RETRIES = 5;
/** Teto e padrão das listagens de O.S. e ocorrências (igual ao máximo do schema da API). */
const DEFAULT_PAGE_SIZE = 200;
/** Marca a pausa de SLA aplicada automaticamente por "Aguardando terceiros" (C-030). */
const AUTO_PAUSE_PREFIX = 'Aguardando terceiros: ';

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
    @Optional()
    @Inject(NotificationsService)
    private readonly notificationsService?: NotificationsService,
    @Optional()
    @Inject(OperationalProcessesService)
    private readonly operationalProcesses?: OperationalProcessesService,
    @Optional()
    @Inject(ServiceOrderLifecycleService)
    private lifecycleService?: ServiceOrderLifecycleService,
  ) {}

  /**
   * Responsáveis precisam ser da equipe (super_admin, gerente ou analista) do tenant; nunca
   * um login de cliente (C-007). Devolve o nome de cada id para gravar junto.
   */
  private async teamMemberNames(tenantId: string, ids: Array<string | null | undefined>) {
    const wanted = [...new Set(ids.filter((id): id is string => !!id))];
    if (!wanted.length) return new Map<string, string>();
    const members = await this.prisma.userTenant.findMany({
      where: { tenantId, userId: { in: wanted }, role: { code: { in: [...ROLE_SET] } } },
      select: { userId: true, user: { select: { name: true } } },
    });
    if (wanted.some((id) => !members.some((m) => m.userId === id)))
      throw new BadRequestException('Selecione responsáveis da equipe da Ajust.');
    return new Map(members.map((m) => [m.userId, m.user.name]));
  }

  /** Serviço único de efeitos; criado na hora quando não vem injetado (testes). */
  private get lifecycle(): ServiceOrderLifecycleService {
    return (this.lifecycleService ??= new ServiceOrderLifecycleService(
      this.prisma,
      this.eventsGateway,
      this.csatService,
      this.notificationsService,
      this.osProcessTemplateService,
      this.workflowsService,
    ));
  }

  async create(authUserId: string | null, role: string, input: CreateOrderInput) {
    if (!ROLE_SET.includes(role as (typeof ROLE_SET)[number])) {
      throw new ForbiddenException('Role is not allowed to create service orders.');
    }
    if (!input.occurrenceId) {
      throw new BadRequestException(
        'Use Novo atendimento para criar a ocorrência junto com a primeira O.S., ou selecione uma ocorrência existente.',
      );
    }

    if (input.occurrenceId) {
      const occurrence = await this.prisma.occurrence.findFirst({
        where: { id: input.occurrenceId, tenantId: input.tenantId, deletedAt: null },
        select: { id: true, number: true, status: true },
      });
      if (!occurrence) {
        throw new BadRequestException('Occurrence not found for this tenant.');
      }
      this.assertOccurrenceOpen(occurrence);
    }

    if (authUserId && (role === 'analista' || !input.ownerUserId)) input.ownerUserId = authUserId;
    const names = await this.teamMemberNames(input.tenantId, [
      input.ownerUserId,
      input.assigneeUserId,
    ]);
    if (input.ownerUserId) input.ownerName = names.get(input.ownerUserId) || input.ownerName;
    if (input.assigneeUserId)
      input.analystName = names.get(input.assigneeUserId) || input.analystName;
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

    if (input.deadlineAt && new Date(input.deadlineAt).getTime() <= now.getTime())
      throw new BadRequestException('O prazo excepcional precisa estar no futuro.');
    const deadlineAt = input.deadlineAt ? new Date(input.deadlineAt) : calculatedDeadline;

    const created = await this.withCreateRetry(async () => {
      const protocol = await this.buildProtocol(input.tenantId);
      return this.prisma.$transaction(
        async (tx) => {
          const created = await tx.serviceOrder.create({
            data: {
              tenantId: input.tenantId,
              occurrenceId: input.occurrenceId,
              protocol,
              sourceSystem: 'ERP',
              type: input.type,
              sourceMetadata: { slaPolicyConfirmed: 'id' in slaPolicy, slaHours: slaPolicy.hours },
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
          if (authUserId && created.occurrenceId && this.operationalProcesses)
            await this.operationalProcesses.start(
              input.tenantId,
              authUserId,
              created.id,
              input.workflowTemplateCode || 'AJUST_SIMPLES',
              tx,
            );
          if (created.occurrenceId)
            await tx.occurrence.update({
              where: { id: created.occurrenceId },
              data: { status: 'EM_EXECUCAO', closedAt: null },
            });
          return created;
        },
        { timeout: 30000 },
      );
    });
    await this.lifecycle.afterOrderCreated(created, authUserId, {
      occurrenceId: created.occurrenceId,
      manualDeadline: !!input.deadlineAt,
    });

    return created;
  }

  async list(tenantId: string, input: ListInput = {}, role?: string | null) {
    const where = await this.buildListWhere(tenantId, input, role);

    const rows = await this.prisma.serviceOrder.findMany({
      where,
      orderBy: this.buildOrderBy(input),
      // Sem limite informado, vale o teto da API: nunca devolve o workspace inteiro (C-041).
      take: Math.min(input.limit ?? DEFAULT_PAGE_SIZE, DEFAULT_PAGE_SIZE),
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
    const where = await this.buildListWhere(tenantId, input, role);
    const now = new Date();
    const twoHours = new Date(now.getTime() + 2 * 60 * 60 * 1000);
    const activeStatuses: ServiceOrderStatus[] = [
      'ABERTA',
      'EM_ANALISE',
      'AG_CAMPO',
      'AG_TERCEIROS',
    ];

    const [
      total,
      active,
      closed,
      resolvedAwaiting,
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
        where: this.andWhere(where, { status: { in: ['FECHADA', 'RESOLVIDA'] } }),
      }),
      this.prisma.serviceOrder.count({
        where: this.andWhere(where, { status: 'RESOLVIDA' }),
      }),
      this.prisma.serviceOrder.count({
        where: this.andWhere(where, {
          status: { in: activeStatuses },
          deadlineAt: { lt: now },
          slaEligible: true,
          pausedAt: null,
        }),
      }),
      this.prisma.serviceOrder.count({
        where: this.andWhere(where, {
          status: { in: activeStatuses },
          deadlineAt: { gte: now, lte: twoHours },
          slaEligible: true,
          pausedAt: null,
        }),
      }),
      this.prisma.serviceOrder.count({
        where: this.andWhere(where, {
          status: { in: activeStatuses },
          priority: 'CRITICA',
          slaEligible: true,
          pausedAt: null,
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
      /** Resolvidas que ainda aguardam o fechamento (já incluídas em `closed`). */
      resolvedAwaiting,
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
    if (!['super_admin', 'gerente', 'analista'].includes(role)) {
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
    if (!['super_admin', 'gerente', 'analista'].includes(role)) {
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
    if (!['super_admin', 'gerente', 'analista'].includes(role)) {
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

    if (input.customerId) where.customerId = input.customerId;
    if (input.provider && !input.customerId) {
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
      take: Math.min(input.limit ?? DEFAULT_PAGE_SIZE, DEFAULT_PAGE_SIZE),
      ...(input.offset ? { skip: input.offset } : {}),
      include: {
        annotations: {
          ...(this.isCustomerRole(role) ? { where: { isCustomerVisible: true } } : {}),
          orderBy: { createdAt: 'desc' },
          // A lista traz só as últimas; o histórico completo está no detalhe (C-022).
          take: 5,
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
    /** null = integração (chat, monitoramento): sem ator humano, a O.S. abre sem fluxo. */
    authUserId: string | null,
    role: string,
    input: CreateOccurrenceInput,
  ) {
    if (!ROLE_SET.includes(role as (typeof ROLE_SET)[number])) {
      throw new ForbiddenException('Role is not allowed to create occurrence.');
    }

    if (input.customerId) {
      const customer = await this.prisma.customer.findFirst({
        where: { id: input.customerId, tenantId: input.tenantId, deletedAt: null },
        select: { tradeName: true, legalName: true },
      });
      if (!customer) throw new BadRequestException('Provedor não encontrado na Ajust.');
      input.provider = customer.tradeName || customer.legalName;
      input.firstOrder.requester = input.provider;
    }
    if (authUserId && (role === 'analista' || !input.firstOrder.ownerUserId))
      input.firstOrder.ownerUserId = authUserId;
    const assignedIds = [input.firstOrder.ownerUserId, input.firstOrder.assigneeUserId].filter(
      (id): id is string => !!id,
    );
    const members = assignedIds.length
      ? await this.prisma.userTenant.findMany({
          where: {
            tenantId: input.tenantId,
            userId: { in: assignedIds },
            role: { code: { in: [...ROLE_SET] } },
            user: { status: 'ACTIVE', deletedAt: null },
          },
          select: { userId: true, user: { select: { name: true } } },
        })
      : [];
    if (assignedIds.some((id) => !members.some((m) => m.userId === id)))
      throw new BadRequestException('Selecione responsáveis da equipe da Ajust.');
    const ownerName =
      members.find((m) => m.userId === input.firstOrder.ownerUserId)?.user.name ||
      input.openedByName;
    const analystName =
      members.find((m) => m.userId === input.firstOrder.assigneeUserId)?.user.name ||
      input.firstOrder.analystName ||
      input.analystResponsible;
    const now = new Date();
    // Data retroativa só para a gestão, nunca no futuro, e vale para a O.S. e o prazo (C-006).
    if (input.createdAt) {
      if (!['super_admin', 'gerente'].includes(role))
        throw new ForbiddenException('Só a gestão registra atendimento com data retroativa.');
      if (new Date(input.createdAt).getTime() > now.getTime())
        throw new BadRequestException('A data de abertura não pode estar no futuro.');
    }
    const occurrenceCreatedAt = input.createdAt ? new Date(input.createdAt) : now;
    const firstOrderPriority = input.firstOrder.priority || 'NORMAL';
    const firstOrderPolicy = await this.slaEngine.findApplicablePolicy(
      input.tenantId,
      firstOrderPriority,
      input.firstOrder.type,
    );
    if (
      input.firstOrder.deadlineAt &&
      !input.createdAt &&
      new Date(input.firstOrder.deadlineAt).getTime() <= now.getTime()
    )
      throw new BadRequestException('O prazo excepcional precisa estar no futuro.');
    const firstOrderDeadline = input.firstOrder.deadlineAt
      ? new Date(input.firstOrder.deadlineAt)
      : await this.slaEngine.calculateTargetDate(
          occurrenceCreatedAt,
          firstOrderPolicy.hours,
          input.tenantId,
        );
    if (
      input.firstOrder.recordCompleted &&
      input.firstOrder.workflowTemplateCode &&
      input.firstOrder.workflowTemplateCode !== 'AJUST_SIMPLES'
    )
      throw new BadRequestException(
        'Para trabalhos com desdobramentos, abra o atendimento e registre a conclusão na O.S.',
      );
    const firstOrderStatus = input.firstOrder.recordCompleted ? 'FECHADA' : 'ABERTA';

    const created = await this.withCreateRetry(() =>
      this.prisma.$transaction(async (tx) => {
        const protocol = await this.buildProtocol(input.tenantId);
        const occurrenceNumber = await this.buildOccurrenceNumber(input.tenantId);

        const occurrence = await tx.occurrence.create({
          data: {
            tenantId: input.tenantId,
            number: occurrenceNumber,
            provider: input.provider,
            customerId: input.customerId,
            type: input.type,
            status: 'ABERTA',
            sector: input.sector,
            origin: input.origin,
            openedByName: ownerName,
            analystResponsible: analystName,
            analystResponsibleUserId: input.firstOrder.assigneeUserId || null,
            openedByUserId: authUserId,
            description: input.description,
            createdAt: occurrenceCreatedAt,
            ...(input.sourceSystem ? { sourceSystem: input.sourceSystem } : {}),
            ...(input.externalId ? { externalId: input.externalId } : {}),
            ...(input.sourceMetadata ? { sourceMetadata: input.sourceMetadata } : {}),
          },
        });

        const order = await tx.serviceOrder.create({
          data: {
            tenantId: input.tenantId,
            occurrenceId: occurrence.id,
            protocol,
            sourceSystem: input.sourceSystem || 'ERP',
            type: input.firstOrder.type,
            sourceMetadata: {
              slaPolicyConfirmed: 'id' in firstOrderPolicy,
              slaHours: firstOrderPolicy.hours,
            },
            priority: firstOrderPriority,
            status: firstOrderStatus,
            closedAt: input.firstOrder.recordCompleted ? now : null,
            resolvedAt: input.firstOrder.recordCompleted ? now : null,
            title: input.firstOrder.title || `O.S ${input.firstOrder.type} - ${input.provider}`,
            description: input.firstOrder.description,
            requester: input.firstOrder.requester,
            sector: input.firstOrder.sector || input.sector,
            origin: input.firstOrder.origin || input.origin,
            ownerUserId: input.firstOrder.ownerUserId,
            ownerName,
            assigneeUserId: input.firstOrder.assigneeUserId,
            analystName,
            deadlineAt: firstOrderDeadline,
            createdAt: occurrenceCreatedAt,
            tags: input.firstOrder.tags || [],
            internalNotes: input.firstOrder.internalNotes,
            occurrences: {
              create: {
                actorUserId: authUserId,
                sourceSystem: 'ERP',
                message: input.firstOrder.recordCompleted
                  ? `Atendimento concluído: ${input.firstOrder.description}`
                  : `O.S criada na ocorrencia ${occurrence.number}.`,
              },
            },
          },
        });

        if (input.firstOrder.recordCompleted) {
          await tx.occurrence.update({
            where: { id: occurrence.id },
            data: { status: 'ENCERRADA', closedAt: now },
          });
          await tx.serviceOrderStatusEvent.create({
            data: {
              tenantId: input.tenantId,
              serviceOrderId: order.id,
              fromStatus: 'ABERTA',
              toStatus: 'FECHADA',
              actorUserId: authUserId,
              reason: input.firstOrder.description,
            },
          });
          if (this.operationalProcesses && authUserId)
            await this.operationalProcesses.recordCompleted(
              input.tenantId,
              authUserId,
              order.id,
              tx,
            );
        } else if (this.operationalProcesses && authUserId) {
          await this.operationalProcesses.start(
            input.tenantId,
            authUserId,
            order.id,
            input.firstOrder.workflowTemplateCode || 'AJUST_SIMPLES',
            tx,
          );
        }
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

    // Mesmos efeitos de "O.S. criada" dos outros caminhos, incluindo workflows (C-010).
    await this.lifecycle.afterOrderCreated(created.order, authUserId, {
      occurrenceId: created.occurrence.id,
      occurrenceNumber: created.occurrence.number,
      manualDeadline: !!input.firstOrder.deadlineAt,
    });
    if (input.firstOrder.recordCompleted)
      await this.lifecycle.afterStatusChange({
        tenantId: input.tenantId,
        orderId: created.order.id,
        from: 'ABERTA',
        to: 'FECHADA',
        actorId: authUserId,
        reason: input.firstOrder.description,
        source: 'transition',
        syncOccurrence: false,
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

    const updated = await this.prisma
      .$transaction(
        async (tx) => {
          const occurrence = await tx.occurrence.findFirst({
            where: { id: occurrenceId, tenantId, deletedAt: null },
            select: { id: true, number: true, processes: { select: { id: true }, take: 1 } },
          });
          if (!occurrence) throw new NotFoundException('Occurrence not found.');
          if (patch.status !== undefined && occurrence.processes?.length) {
            throw new ForbiddenException('Altere o estado da ocorrência pela tela de processos.');
          }
          if (patch.status === 'ENCERRADA') {
            const where = {
              tenantId,
              occurrenceId,
              deletedAt: null,
              status: { notIn: [ServiceOrderStatus.FECHADA, ServiceOrderStatus.CANCELADA] },
            };
            const pending = await tx.serviceOrder.findMany({
              where,
              select: { id: true, protocol: true, status: true },
              orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
              take: 20,
            });
            if (pending.length) {
              const count = await tx.serviceOrder.count({ where });
              throw new ConflictException({
                message: `Não é possível encerrar a ocorrência: ${count} O.S. ainda pendente(s). Feche ou cancele: ${pending.map((o) => o.protocol).join(', ')}${count > pending.length ? ' (consulte as demais na lista de ordens)' : ''}. Nenhuma O.S. foi alterada.`,
                pendingOrders: pending,
                pendingCount: count,
              });
            }
          }
          return tx.occurrence.update({
            where: { id: occurrence.id },
            data: {
              ...(patch.type !== undefined ? { type: patch.type } : {}),
              ...(patch.status !== undefined ? { status: patch.status } : {}),
              ...(patch.status !== undefined
                ? { closedAt: patch.status === 'ENCERRADA' ? new Date() : null }
                : {}),
              ...(patch.sector !== undefined ? { sector: patch.sector } : {}),
              ...(patch.origin !== undefined ? { origin: patch.origin } : {}),
              ...(patch.analystResponsible !== undefined
                ? { analystResponsible: patch.analystResponsible }
                : {}),
              ...(patch.description !== undefined ? { description: patch.description } : {}),
            },
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      )
      .catch((error: unknown) => {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034')
          throw new ConflictException(
            'O atendimento foi alterado durante a operação. Atualize a ocorrência e tente novamente.',
          );
        throw error;
      });

    await this.logAudit(tenantId, authUserId, 'OS_UPDATE', 'occurrence', updated.id, {
      occurrenceNumber: updated.number,
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
    const annotationId = randomUUID();

    const result = await this.prisma.$transaction(async (tx) => {
      const updatedOrder = await tx.serviceOrder.update({
        where: { id: order.id },
        data: {
          occurrences: {
            create: {
              id: annotationId,
              editable: true,
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

      if (mirroredOccurrenceAnnotation)
        await tx.serviceOrderOccurrence.update({
          where: { id: annotationId },
          data: { mirroredAnnotationId: mirroredOccurrenceAnnotation.id },
        });
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
        status: true,
      },
    });
    if (!occurrence) {
      throw new NotFoundException('Occurrence not found.');
    }
    this.assertOccurrenceOpen(occurrence);

    const priority = input.priority || 'NORMAL';
    if (this.operationalProcesses)
      return this.create(authUserId, role, {
        ...input,
        tenantId,
        occurrenceId,
        priority,
        title: input.title || `O.S ${input.type} - ${occurrence.provider}`,
        requester: input.requester || occurrence.provider,
        sector: input.sector || occurrence.sector,
        origin: input.origin || occurrence.origin,
      });
    const slaPolicy = await this.slaEngine.findApplicablePolicy(tenantId, priority, input.type);
    const deadlineAt = input.deadlineAt
      ? new Date(input.deadlineAt)
      : await this.slaEngine.calculateTargetDate(new Date(), slaPolicy.hours, tenantId);
    const status = 'ABERTA';

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

    await this.lifecycle.afterOrderCreated(created, authUserId, {
      occurrenceId: occurrence.id,
      occurrenceNumber: occurrence.number,
    });
    await syncOccurrenceStatus(this.prisma, tenantId, occurrence.id).catch(() => undefined);
    return created;
  }

  async updateOrder(
    tenantId: string,
    orderId: string,
    authUserId: string,
    role: string,
    patch: UpdateOrderInput,
  ) {
    if (!['super_admin', 'gerente', 'analista'].includes(role)) {
      throw new ForbiddenException('Seu perfil não edita O.S.');
    }

    const order = await this.prisma.serviceOrder.findFirst({
      where: { id: orderId, tenantId, deletedAt: null },
      select: {
        id: true,
        protocol: true,
        ownerUserId: true,
        version: true,
        type: true,
        priority: true,
        status: true,
        createdAt: true,
        deadlineAt: true,
        originalDeadlineAt: true,
        pausedAt: true,
        slaEligible: true,
      },
    });
    if (!order) {
      throw new NotFoundException('O.S. não encontrada.');
    }

    if (patch.expectedVersion !== undefined && order.version !== patch.expectedVersion) {
      throw new ConflictException(
        'Esta O.S. foi alterada por outra pessoa. Recarregue a página para ver a versão mais recente.',
      );
    }

    if (role === 'analista' && patch.ownerUserId && patch.ownerUserId !== order.ownerUserId)
      throw new ForbiddenException('Somente a gestão pode corrigir a autoria da abertura.');
    if (!patch.ownerUserId) delete patch.ownerName;
    if (!patch.assigneeUserId) delete patch.analystName;

    const names = await this.teamMemberNames(tenantId, [patch.ownerUserId, patch.assigneeUserId]);
    if (patch.ownerUserId) patch.ownerName = names.get(patch.ownerUserId)!;
    if (patch.assigneeUserId) patch.analystName = names.get(patch.assigneeUserId)!;

    // Prazo: a tela reenvia o prazo atual a cada salvamento; só conta como mudança se for
    // diferente (precisão de minuto do campo datetime-local).
    const requestedDeadline = patch.deadlineAt ? new Date(patch.deadlineAt) : null;
    const deadlineChanged =
      !!requestedDeadline &&
      Math.abs(requestedDeadline.getTime() - order.deadlineAt.getTime()) >= 60_000;
    const typeChanged = patch.type !== undefined && patch.type !== order.type;
    const priorityChanged = patch.priority !== undefined && patch.priority !== order.priority;
    let nextDeadline: Date | null = null;
    let slaEvent: { eventType: string; reason: string } | null = null;
    if (deadlineChanged) {
      // Mudar o prazo depois da abertura é decisão gerencial, com motivo e auditoria (C-005).
      if (!['super_admin', 'gerente'].includes(role))
        throw new ForbiddenException(
          'Só a gestão altera o prazo de uma O.S. aberta. Peça ao gerente ou registre a pausa do SLA.',
        );
      const reason = patch.deadlineReason?.trim();
      if (!reason || reason.length < 3)
        throw new BadRequestException('Informe o motivo da mudança de prazo.');
      if (requestedDeadline!.getTime() <= Date.now())
        throw new BadRequestException('O novo prazo precisa estar no futuro.');
      nextDeadline = requestedDeadline;
      slaEvent = { eventType: 'DEADLINE_CHANGED', reason };
    } else if (
      (typeChanged || priorityChanged) &&
      order.slaEligible &&
      !order.pausedAt &&
      ['ABERTA', 'EM_ANALISE', 'AG_CAMPO', 'AG_TERCEIROS'].includes(order.status)
    ) {
      // O prazo depende do tipo e da prioridade: corrigir um deles recalcula a partir da
      // abertura (C-025, C-024).
      const nextType = patch.type ?? order.type;
      const nextPriority = patch.priority ?? order.priority;
      const policy = await this.slaEngine.findApplicablePolicy(tenantId, nextPriority, nextType);
      nextDeadline = await this.slaEngine.calculateTargetDate(
        order.createdAt,
        policy.hours,
        tenantId,
      );
      slaEvent = {
        eventType: 'RECALCULATED',
        reason: [
          typeChanged ? `tipo ${order.type} → ${nextType}` : '',
          priorityChanged ? `prioridade ${order.priority} → ${nextPriority}` : '',
        ]
          .filter(Boolean)
          .join('; '),
      };
    }
    const changedFields = (
      [
        'ownerUserId',
        'assigneeUserId',
        'type',
        'priority',
        'title',
        'description',
        'requester',
        'sector',
        'origin',
        'tags',
        'internalNotes',
      ] as const
    ).filter((key) => patch[key] !== undefined);
    if (nextDeadline) changedFields.push('deadlineAt' as never);

    const data: Prisma.ServiceOrderUpdateInput = {
      ...(patch.ownerUserId ? { owner: { connect: { id: patch.ownerUserId } } } : {}),
      ...(patch.assigneeUserId ? { assignee: { connect: { id: patch.assigneeUserId } } } : {}),
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
      ...(nextDeadline
        ? {
            deadlineAt: nextDeadline,
            originalDeadlineAt: order.originalDeadlineAt ?? order.deadlineAt,
          }
        : {}),
    };

    let updated;
    try {
      updated = await this.prisma.$transaction(async (tx) => {
        const saved = await tx.serviceOrder.update({
          where: {
            id: order.id,
            ...(patch.expectedVersion !== undefined ? { version: patch.expectedVersion } : {}),
          },
          data: {
            ...data,
            version: { increment: 1 },
            occurrences: {
              create: {
                actorUserId: authUserId,
                sourceSystem: 'ERP',
                message: nextDeadline
                  ? `O.S. editada. Prazo de ${order.deadlineAt.toISOString()} para ${nextDeadline.toISOString()}${slaEvent ? ` (${slaEvent.reason})` : ''}.`
                  : 'O.S. editada.',
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
        if (nextDeadline && slaEvent)
          await tx.slaAuditEvent.create({
            data: {
              tenantId,
              orderId: saved.id,
              eventType: slaEvent.eventType,
              deadlineAt: nextDeadline,
              reason: slaEvent.reason,
              metadata: {
                previousDeadline: order.deadlineAt.toISOString(),
                actorUserId: authUserId,
              },
            },
          });
        return saved;
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new ConflictException(
          'Esta Ordem de Serviço foi alterada concorrentemente por outro usuário. Recarregue a página para obter a versão mais recente.',
        );
      }
      throw error;
    }

    await this.logAudit(tenantId, authUserId, 'OS_UPDATE', 'service_order', updated.id, {
      protocol: updated.protocol,
      changedFields,
      ...(nextDeadline
        ? {
            previousDeadline: order.deadlineAt.toISOString(),
            deadlineAt: nextDeadline.toISOString(),
          }
        : {}),
    });

    this.eventsGateway.emitTenantEvent(tenantId, 'service_order.updated', {
      tenantId,
      orderId: updated.id,
      protocol: updated.protocol,
      at: new Date().toISOString(),
    });

    return updated;
  }

  async editOrderAnnotation(
    tenantId: string,
    orderId: string,
    annotationId: string,
    actorId: string,
    role: string,
    message: string,
    expectedVersion: number,
  ) {
    if (!['super_admin', 'gerente', 'analista'].includes(role))
      throw new ForbiddenException('Sem autorização.');
    return this.prisma.$transaction(async (tx) => {
      const note = await tx.serviceOrderOccurrence.findFirst({
        where: {
          id: annotationId,
          serviceOrderId: orderId,
          actorUserId: actorId,
          editable: true,
          serviceOrder: { tenantId, deletedAt: null },
        },
      });
      if (!note)
        throw new NotFoundException(
          'Somente o autor pode editar uma anotação manual deste atendimento.',
        );
      const result = await tx.serviceOrderOccurrence.updateMany({
        where: { id: note.id, version: expectedVersion },
        data: { message, editedAt: new Date(), version: { increment: 1 } },
      });
      if (!result.count) throw new ConflictException('A anotação mudou. Atualize antes de editar.');
      if (note.mirroredAnnotationId) {
        const order = await tx.serviceOrder.findFirstOrThrow({
          where: { id: orderId, tenantId },
          select: { protocol: true },
        });
        await tx.occurrenceAnnotation.updateMany({
          where: { id: note.mirroredAnnotationId, tenantId, actorUserId: actorId },
          data: { message: `[O.S ${order.protocol}] ${message}` },
        });
      }
      await tx.auditLog.create({
        data: {
          tenantId,
          actorUserId: actorId,
          action: 'OS_UPDATE',
          resourceType: 'service_order_annotation',
          resourceId: note.id,
          metadata: {
            operation: 'edit',
            orderId,
            previousMessage: note.message,
            message,
            previousVersion: note.version,
          },
        },
      });
      return { id: note.id, message, version: expectedVersion + 1 };
    });
  }

  async transition(
    tenantId: string,
    id: string,
    authUserId: string,
    role: string,
    input: TransitionInput,
  ) {
    if (!['super_admin', 'gerente', 'analista'].includes(role)) {
      throw new ForbiddenException('Seu perfil não altera a etapa de O.S.');
    }
    const order = await this.prisma.serviceOrder.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    if (!order) throw new NotFoundException('O.S. não encontrada.');

    const from = order.status;
    const to = input.toStatus;
    if (order.processInstanceId) {
      // Com etapa de processo em andamento, a O.S. anda pela tela de processos. Sem etapa
      // ativa (processo concluído ou arquivado, ou aguardando aprovação), a transição manual vale.
      const activeSteps = await this.prisma.serviceProcessStep.count({
        where: { instanceId: order.processInstanceId, status: { in: ['ACTIVE', 'WAITING'] } },
      });
      if (activeSteps)
        throw new ForbiddenException(
          'Esta O.S. está numa etapa de processo. Conclua a etapa na tela de processos.',
        );
    }
    assertTransition(from, to);

    if (
      to === 'FECHADA' &&
      needsClosingApproval(order) &&
      !(await hasCurrentApproval(this.prisma, order))
    ) {
      throw new ForbiddenException(
        'Esta O.S. de prioridade alta/crítica está atrasada: o fechamento precisa de aprovação gerencial na aba Aprovações.',
      );
    }
    if (input.expectedVersion !== undefined && order.version !== input.expectedVersion) {
      throw new ConflictException(
        'Esta O.S. foi alterada por outra pessoa. Recarregue a página para ver a versão mais recente.',
      );
    }

    // "Aguardando terceiros" pausa o SLA; sair dela retoma e estende o prazo pelo tempo útil
    // parado (decisão C-030 de 04/11). Pausa manual já existente não é alterada.
    const now = new Date();
    let slaPatch: Prisma.ServiceOrderUpdateInput = {};
    let slaAudit: { eventType: 'PAUSED' | 'RESUMED'; deadlineAt: Date; minutes?: number } | null =
      null;
    if (to === 'AG_TERCEIROS' && !order.pausedAt && order.slaEligible) {
      slaPatch = {
        pausedAt: now,
        pauseReason: `${AUTO_PAUSE_PREFIX}${input.reason}`,
        originalDeadlineAt: order.originalDeadlineAt ?? order.deadlineAt,
      };
      slaAudit = { eventType: 'PAUSED', deadlineAt: order.deadlineAt };
    } else if (
      from === 'AG_TERCEIROS' &&
      order.pausedAt &&
      order.pauseReason?.startsWith(AUTO_PAUSE_PREFIX)
    ) {
      const minutes = await this.slaEngine.calculateBusinessPauseDuration(
        order.pausedAt,
        now,
        tenantId,
      );
      const deadlineAt =
        minutes > 0
          ? await this.slaEngine.calculateTargetDate(order.deadlineAt, minutes / 60, tenantId)
          : order.deadlineAt;
      slaPatch = { pausedAt: null, pauseReason: null, deadlineAt };
      slaAudit = { eventType: 'RESUMED', deadlineAt, minutes };
    }

    let updated;
    try {
      updated = await this.prisma.$transaction(async (tx) => {
        if (
          to === 'FECHADA' &&
          needsClosingApproval(order) &&
          !(await hasCurrentApproval(tx, order))
        )
          throw new ForbiddenException('O fechamento precisa de aprovação gerencial vigente.');
        const saved = await tx.serviceOrder.update({
          where: {
            id: order.id,
            version: input.expectedVersion ?? order.version,
          },
          data: {
            ...(statusDates(order, to) as Prisma.ServiceOrderUpdateInput),
            ...slaPatch,
            status: to,
            version: { increment: 1 },
            occurrences: {
              create: {
                actorUserId: authUserId,
                sourceSystem: 'ERP',
                message: `Etapa alterada de ${STATUS_LABEL[from]} para ${STATUS_LABEL[to]}. Motivo: ${input.reason}`,
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
        if (slaAudit)
          await tx.slaAuditEvent.create({
            data: {
              tenantId,
              orderId: saved.id,
              eventType: slaAudit.eventType,
              deadlineAt: slaAudit.deadlineAt,
              reason: input.reason,
              metadata: {
                automatic: true,
                trigger: 'AG_TERCEIROS',
                actorId: authUserId,
                previousDeadline: order.deadlineAt.toISOString(),
                ...(slaAudit.minutes !== undefined
                  ? { pausedBusinessMinutes: Math.round(slaAudit.minutes) }
                  : {}),
              },
            },
          });
        return saved;
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new ConflictException(
          'Esta O.S. foi alterada ao mesmo tempo por outra pessoa. Recarregue a página e tente de novo.',
        );
      }
      throw error;
    }

    await this.lifecycle.afterStatusChange({
      tenantId,
      orderId: updated.id,
      from,
      to,
      actorId: authUserId,
      reason: input.reason,
      source: 'transition',
    });
    return updated;
  }

  /**
   * Integração informa que o problema foi resolvido (ex.: recuperação do Zabbix): as O.S.
   * ativas da ocorrência sem etapa de processo passam a RESOLVIDA pelo ciclo de vida único.
   */
  async resolveFromIntegration(tenantId: string, occurrenceId: string, reason: string) {
    const orders = await this.prisma.serviceOrder.findMany({
      where: {
        tenantId,
        occurrenceId,
        deletedAt: null,
        status: { in: ['ABERTA', 'EM_ANALISE', 'AG_CAMPO', 'AG_TERCEIROS'] },
      },
    });
    const resolved: string[] = [];
    for (const order of orders) {
      if (order.processInstanceId) {
        const active = await this.prisma.serviceProcessStep.count({
          where: { instanceId: order.processInstanceId, status: { in: ['ACTIVE', 'WAITING'] } },
        });
        if (active) continue;
      }
      const applied = await this.prisma.$transaction(async (tx) => {
        const changed = await tx.serviceOrder.updateMany({
          where: { id: order.id, version: order.version },
          data: {
            ...statusDates(order, 'RESOLVIDA'),
            status: 'RESOLVIDA',
            version: { increment: 1 },
          },
        });
        if (changed.count !== 1) return false;
        await tx.serviceOrderOccurrence.create({
          data: { serviceOrderId: order.id, sourceSystem: 'WEBHOOK', message: reason },
        });
        await tx.serviceOrderStatusEvent.create({
          data: {
            tenantId,
            serviceOrderId: order.id,
            fromStatus: order.status,
            toStatus: 'RESOLVIDA',
            reason,
            metadata: { source: 'integration' },
          },
        });
        return true;
      });
      if (!applied) continue;
      await this.lifecycle.afterStatusChange({
        tenantId,
        orderId: order.id,
        from: order.status,
        to: 'RESOLVIDA',
        actorId: null,
        reason,
        source: 'integration',
      });
      resolved.push(order.protocol);
    }
    return resolved;
  }

  async approve(
    tenantId: string,
    serviceOrderId: string,
    authUserId: string,
    role: string,
    decision: ApprovalStatus,
    reason?: string,
  ) {
    // A aprovação de fechamento é uma decisão gerencial: o analista não aprova o próprio trabalho.
    if (!['super_admin', 'gerente'].includes(role)) {
      throw new ForbiddenException('Somente gerentes podem aprovar o fechamento de O.S.');
    }

    const order = await this.prisma.serviceOrder.findFirst({
      where: { id: serviceOrderId, tenantId, deletedAt: null },
    });

    if (!order) {
      throw new NotFoundException('Service order not found.');
    }
    if (order.status !== 'RESOLVIDA') {
      throw new ConflictException(
        'A aprovação é registrada quando a O.S. está resolvida e aguardando fechamento.',
      );
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
    isInternal = true,
  ) {
    if (!['super_admin', 'gerente', 'analista'].includes(role)) {
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

    const uploadRoot = process.env.UPLOAD_ROOT || join(process.cwd(), 'uploads');
    const orderDir = join(uploadRoot, 'service-orders', serviceOrderId);
    for (const file of files) {
      const originalName = basename(file.originalname || 'file');
      file.mimetype = attachmentMime(originalName, file.buffer);
      if (file.buffer.length > ATTACHMENT_MAX_BYTES) {
        throw new BadRequestException(`File too large: ${originalName}`);
      }
    }

    await mkdir(orderDir, { recursive: true });

    const created: ServiceOrderAttachment[] = [];
    const storedPaths: string[] = [];
    try {
      await this.prisma.$transaction(
        async (tx) => {
          await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${tenantId}), hashtext(${serviceOrderId}))::text`;
          const configured = Number(process.env.ORDER_ATTACHMENT_TOTAL_LIMIT || 100);
          const totalLimit =
            Number.isInteger(configured) && configured >= ATTACHMENT_LIMIT ? configured : 100;
          const existing = await tx.serviceOrderAttachment.count({ where: { serviceOrderId } });
          if (existing + files.length > totalLimit)
            throw new BadRequestException(
              `Limite total de ${totalLimit} anexos por O.S. atingido.`,
            );
          for (const file of files) {
            const originalName = basename(file.originalname || 'file');
            const ext = extname(originalName).toLowerCase();
            const storageFileName = `${Date.now()}_${randomUUID()}${ext}`;
            const storagePath = join(orderDir, storageFileName);
            await writeFile(storagePath, file.buffer);
            storedPaths.push(storagePath);

            const attachment = await tx.serviceOrderAttachment.create({
              data: {
                serviceOrderId,
                fileName: originalName,
                mimeType: file.mimetype,
                sizeBytes: file.buffer.length,
                storageKey: join('service-orders', serviceOrderId, storageFileName),
                isInternal,
              },
            });

            created.push(attachment);
          }

          await tx.serviceOrderOccurrence.create({
            data: {
              serviceOrderId,
              actorUserId: authUserId,
              sourceSystem: 'ERP',
              message: `${created.length} anexo(s) adicionado(s).`,
            },
          });
        },
        { timeout: 30000 },
      );
    } catch (error) {
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

  async downloadAttachment(
    tenantId: string,
    orderId: string,
    attachmentId: string,
    authUserId: string,
    role: string,
  ): Promise<AttachmentDownloadResult> {
    if (!['super_admin', 'gerente', 'analista', 'cliente'].includes(role)) {
      throw new ForbiddenException('Role is not allowed to download attachments.');
    }

    const order = await this.prisma.serviceOrder.findFirst({
      where: { id: orderId, tenantId, deletedAt: null },
      select: { id: true, isCustomerVisible: true },
    });

    if (!order) {
      throw new NotFoundException('Service order not found.');
    }

    if (role === 'cliente' && !order.isCustomerVisible) {
      throw new ForbiddenException('Service order is not accessible.');
    }

    const attachment = await this.prisma.serviceOrderAttachment.findFirst({
      where: {
        id: attachmentId,
        serviceOrderId: orderId,
      },
    });

    if (!attachment || !attachment.storageKey) {
      throw new NotFoundException('Attachment not found.');
    }

    if (role === 'cliente' && attachment.isInternal) {
      throw new ForbiddenException('Internal attachment not accessible to customer.');
    }

    // Validação estrita contra path traversal
    const uploadRoot = process.env.UPLOAD_ROOT || join(process.cwd(), 'uploads');
    const safePath = validatePathWithinBase(uploadRoot, attachment.storageKey);

    if (!existsSync(safePath)) {
      throw new NotFoundException('Attachment file not found on disk.');
    }

    await this.logAudit(tenantId, authUserId, 'EXPORT', 'service_order_attachment', attachment.id, {
      serviceOrderId: orderId,
      fileName: attachment.fileName,
      operation: 'download',
    });

    return {
      fileName: attachment.fileName,
      mimeType: attachment.mimeType,
      sizeBytes: attachment.sizeBytes,
      filePath: safePath,
    };
  }

  private assertOccurrenceOpen(occurrence: { number?: string; status?: string | null }) {
    if (occurrence.status === 'ENCERRADA') {
      const label = occurrence.number ? `A ocorrência ${occurrence.number}` : 'A ocorrência';
      throw new ConflictException(
        `${label} está encerrada. Reabra a ocorrência ou abra um novo atendimento para incluir outra O.S.`,
      );
    }
  }

  private async buildProtocol(tenantId: string) {
    return nextOrderProtocol(this.prisma, tenantId);
  }

  private async buildOccurrenceNumber(tenantId: string) {
    const year = new Date().getFullYear();
    const rows = await this.prisma.$queryRaw<{ max: number | null }[]>`
      SELECT MAX(CAST(SUBSTRING("number" FROM 5) AS INTEGER)) AS "max"
      FROM "Occurrence"
      WHERE "tenantId" = ${tenantId} AND "number" ~ ${`^${year}[0-9]{6}$`}`;
    return `${year}${Math.max(Number(rows[0]?.max ?? 0), 260000) + 1}`;
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

  private async buildListWhere(tenantId: string, input: ListInput, role?: string | null) {
    const where = this.buildWhere(tenantId, input, role);
    if (!input.deadline) return where;
    const tenant = await this.prisma.tenant.findUniqueOrThrow({
      where: { id: tenantId },
      select: { timezone: true },
    });
    return this.andWhere(where, deadlineWhere(input.deadline, new Date(), tenant.timezone));
  }

  private buildWhere = buildOrderWhere;

  private andWhere = andOrderWhere;

  private isCustomerRole = isCustomerRole;

  private sanitizeOrderForRole = sanitizeOrderForRole;

  private buildOrderBy = buildOrderOrderBy;

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
