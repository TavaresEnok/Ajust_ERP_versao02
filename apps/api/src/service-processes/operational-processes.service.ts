import type { ServiceOrderStatus } from '@prisma/client';
import { transactionScope } from '../prisma/transaction-scope';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Optional,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { WorkflowsService } from '../workflows/workflows.service';
import { SlaEngineService } from '../sla/sla-engine.service';
import { storedProcessDefinition, storedProcessRecord } from './stored-process-roles';
import {
  OperationalDefinition,
  OperationalDefinitionSchema,
  validateOperational,
} from './operational-definition';
import {
  AWAITING_APPROVAL_MESSAGE,
  hasCurrentApproval,
  needsClosingApproval,
  statusDates,
} from '../service-orders/service-order-rules';
import { ServiceOrderLifecycleService } from '../service-orders/service-order-lifecycle.service';
import { nextOrderProtocolInTransaction } from '../service-orders/order-protocol';

type Tx = Prisma.TransactionClient;
const json = (v: unknown) => JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;
const managers = ['super_admin', 'gerente'];
export type OperationalAction = {
  expectedOrderVersion?: number;
  expectedVersion: number;
  action: 'advance' | 'assign' | 'pause' | 'resume' | 'cancel' | 'reopen' | 'retry';
  stepId?: string;
  outcome?: string;
  evidence?: Record<string, string>;
  assigneeUserId?: string;
  reason: string;
};

@Injectable()
export class OperationalProcessesService implements OnModuleInit, OnModuleDestroy {
  private timer?: ReturnType<typeof setInterval>;
  private delivering = false;
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(WorkflowsService) private readonly automations: WorkflowsService,
    @Optional()
    @Inject(ServiceOrderLifecycleService)
    private readonly lifecycle?: ServiceOrderLifecycleService,
  ) {}
  inTransaction(tx: Prisma.TransactionClient) {
    return new OperationalProcessesService(transactionScope(tx), this.automations, this.lifecycle);
  }

  onModuleInit() {
    this.timer = setInterval(() => void this.deliverEvents().catch(() => undefined), 10000);
    this.timer.unref();
  }
  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async templates(tenantId: string) {
    const rows = await this.prisma.serviceProcessTemplate.findMany({
      where: { tenantId, definition: { path: ['engineVersion'], equals: 2 } },
      orderBy: { code: 'asc' },
    });
    return rows.map(storedProcessRecord);
  }
  async assignees(tenantId: string) {
    const rows = await this.prisma.userTenant.findMany({
      where: {
        tenantId,
        user: { deletedAt: null, status: { in: ['ACTIVE', 'BLOCKED'] } },
        role: { code: { in: ['super_admin', 'gerente', 'analista'] } },
      },
      include: {
        user: { select: { id: true, name: true, status: true } },
        role: { select: { code: true } },
      },
    });
    return rows.map((r) => ({
      id: r.user.id,
      name: r.user.name,
      role: r.role.code,
      accessBlocked: r.user.status === 'BLOCKED',
    }));
  }
  async save(
    tenantId: string,
    actorId: string,
    input: { definition: unknown; expectedVersion: number; publish: boolean },
  ) {
    const def = input.publish
      ? validateOperational(input.definition)
      : OperationalDefinitionSchema.parse(input.definition);
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.serviceProcessTemplate.findUnique({
        where: { tenantId_code: { tenantId, code: def.code } },
      });
      if (!current && input.expectedVersion === 0) {
        def.version = 1;
        const created = await tx.serviceProcessTemplate.create({
          data: {
            tenantId,
            code: def.code,
            version: 1,
            definition: json(def),
            draft: input.publish ? Prisma.DbNull : json(def),
            publishedAt: input.publish ? new Date() : null,
          },
        });
        await this.audit(tx, tenantId, actorId, 'workflow_operational_template', created.id, {
          action: input.publish ? 'PUBLISH' : 'DRAFT',
          revision: 1,
        });
        return { version: 1 };
      }
      if (!current || current.version !== input.expectedVersion)
        throw new ConflictException('Modelo alterado por outra pessoa. Recarregue.');
      const revision = current.version + 1;
      if (input.publish) def.version = revision;
      const updated = await tx.serviceProcessTemplate.updateMany({
        where: { id: current.id, version: current.version },
        data: {
          version: revision,
          ...(input.publish
            ? { definition: json(def), draft: Prisma.DbNull, publishedAt: new Date() }
            : { draft: json(def) }),
        },
      });
      if (updated.count !== 1) throw new ConflictException('Edição concorrente do modelo.');
      await this.audit(tx, tenantId, actorId, 'workflow_operational_template', current.id, {
        action: input.publish ? 'PUBLISH' : 'DRAFT',
        revision,
      });
      return { version: revision };
    });
  }
  async list(tenantId: string) {
    const rows = await this.prisma.serviceProcessInstance.findMany({
      where: { tenantId, engineVersion: 2, status: { not: 'SUPERSEDED' } },
      include: {
        occurrence: true,
        links: {
          include: {
            order: {
              select: {
                id: true,
                protocol: true,
                status: true,
                title: true,
                parentOrderId: true,
                sector: true,
                analystName: true,
                assigneeUserId: true,
                pausedAt: true,
                scheduledAt: true,
                deadlineAt: true,
              },
            },
          },
        },
        orders: {
          select: {
            id: true,
            protocol: true,
            status: true,
            title: true,
            parentOrderId: true,
            sector: true,
            analystName: true,
            assigneeUserId: true,
            pausedAt: true,
            scheduledAt: true,
            deadlineAt: true,
          },
        },
        steps: { orderBy: { enteredAt: 'asc' } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return rows.map(storedProcessRecord);
  }
  async find(tenantId: string, id: string) {
    const item = await this.prisma.serviceProcessInstance.findFirst({
      where: { tenantId, id, engineVersion: 2 },
      include: {
        occurrence: { include: { customer: true } },
        links: {
          include: { order: { include: { occurrences: { orderBy: { createdAt: 'asc' } } } } },
        },
        steps: { orderBy: { enteredAt: 'asc' } },
        events: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!item) throw new NotFoundException('Execução não encontrada.');
    return storedProcessRecord(item);
  }

  async start(
    tenantId: string,
    actorId: string,
    orderId: string,
    templateCode: string,
    transaction?: Tx,
  ) {
    const execute = async (tx: Tx) => {
      await tx.$queryRaw`SELECT id FROM "ServiceOrder" WHERE id = ${orderId} AND "tenantId" = ${tenantId} FOR UPDATE`;
      const order = await tx.serviceOrder.findFirst({
        where: { id: orderId, tenantId, deletedAt: null },
        include: { occurrence: true },
      });
      if (
        !order?.occurrence ||
        order.processInstanceId ||
        ['FECHADA', 'CANCELADA'].includes(order.status)
      )
        throw new BadRequestException('Escolha uma O.S. aberta sem outro processo.');
      const template = await tx.serviceProcessTemplate.findUnique({
        where: { tenantId_code: { tenantId, code: templateCode } },
      });
      if (!template?.publishedAt)
        throw new BadRequestException(
          `O serviço escolhido usa o fluxo "${templateCode}", que não está publicado. Abra sem serviço do catálogo ou avise a gestão.`,
        );
      const def = validateOperational(storedProcessDefinition(template.definition));
      const instance = await tx.serviceProcessInstance.create({
        data: {
          tenantId,
          occurrenceId: order.occurrenceId!,
          rootOrderId: order.id,
          engineVersion: 2,
          templateCode,
          templateVersion: def.version,
          definition: json(def),
          state: { mode: 'LIVE_PILOT' },
        },
      });
      await tx.serviceOrder.update({
        where: { id: order.id },
        data: { processInstanceId: instance.id, processNodeId: def.start },
      });
      await tx.serviceProcessOrderLink.create({
        data: { instanceId: instance.id, orderKey: 'root', orderId: order.id },
      });
      await this.pump(tx, instance.id, tenantId, def, [def.start]);
      await this.audit(tx, tenantId, actorId, 'workflow_operational_start', instance.id, {
        orderId,
      });
      return { id: instance.id };
    };
    return transaction
      ? execute(transaction)
      : this.prisma.$transaction(execute, { timeout: 30000 });
  }

  async recordCompleted(tenantId: string, actorId: string, orderId: string, tx: Tx) {
    const order = await tx.serviceOrder.findFirstOrThrow({ where: { tenantId, id: orderId } });
    const template = await tx.serviceProcessTemplate.findUniqueOrThrow({
      where: { tenantId_code: { tenantId, code: 'AJUST_SIMPLES' } },
    });
    const definition = validateOperational(storedProcessDefinition(template.definition));
    if (
      !template.publishedAt ||
      definition.nodes.length !== 2 ||
      definition.nodes.filter((n) => n.kind === 'task').length !== 1 ||
      definition.nodes.filter((n) => n.kind === 'end').length !== 1
    )
      throw new BadRequestException(
        'O registro já concluído exige um fluxo simples publicado, com uma tarefa e um fim.',
      );
    const instance = await tx.serviceProcessInstance.create({
      data: {
        tenantId,
        occurrenceId: order.occurrenceId!,
        rootOrderId: orderId,
        templateCode: template.code,
        templateVersion: definition.version,
        definition: json(definition),
        engineVersion: 2,
        state: { mode: 'LIVE', recordedCompleted: true },
        status: 'COMPLETED',
        completedAt: order.closedAt,
      },
    });
    await tx.serviceOrder.update({
      where: { id: orderId },
      data: { processInstanceId: instance.id, processNodeId: definition.start },
    });
    await tx.serviceProcessOrderLink.create({
      data: { instanceId: instance.id, orderKey: 'root', orderId },
    });
    for (const node of definition.nodes)
      await tx.serviceProcessStep.create({
        data: {
          tenantId,
          instanceId: instance.id,
          nodeId: node.id,
          orderId: node.kind === 'task' ? orderId : null,
          status: 'COMPLETED',
          actorId,
          completedAt: order.closedAt,
          evidence: node.kind === 'task' ? { 'Resultado técnico': order.description } : {},
        },
      });
  }

  async demonstrate(tenantId: string, actorId: string, sourceId: string, expectedVersion: number) {
    return this.prisma.$transaction(
      async (tx) => {
        const source = await tx.serviceProcessInstance.findFirst({
          where: { id: sourceId, tenantId, engineVersion: 2 },
          include: { occurrence: true, links: { include: { order: true } } },
        });
        if (!source || source.version !== expectedVersion)
          throw new ConflictException('Registro de origem alterado. Recarregue.');
        const sourceState = source.state as Record<string, unknown>;
        if (source.status === 'SUPERSEDED')
          throw new BadRequestException(
            'Abra a proposta revisada para demonstrar este atendimento.',
          );
        if (sourceState.demoId) return { id: String(sourceState.demoId) };
        if (sourceState.mode === 'DEMO')
          throw new BadRequestException('Esta já é uma demonstração.');
        const def = validateOperational(storedProcessDefinition(source.definition));
        const root = source.links.find((l) => l.orderKey === 'root')?.order;
        if (!root) throw new BadRequestException('O.S. principal de origem não encontrada.');
        const unique = randomUUID().slice(0, 10);
        const occurrence = await tx.occurrence.create({
          data: {
            tenantId,
            customerId: source.occurrence.customerId,
            number: `DEMO-${unique}`,
            provider: source.occurrence.provider,
            type: def.name,
            sector: root.sector || 'NOC',
            origin: 'DEMONSTRACAO',
            status: 'EM_EXECUCAO',
            openedByName: 'Demonstração autorizada',
            analystResponsible: 'A definir',
            description: `DEMONSTRAÇÃO baseada em ${root.protocol}. Registros de execução aqui são simulados para apresentar o fluxo; o histórico original permanece na O.S. de origem.`,
            sourceMetadata: { demonstration: true, sourceOrderId: root.id },
          },
        });
        const order = await tx.serviceOrder.create({
          data: {
            tenantId,
            occurrenceId: occurrence.id,
            protocol: `DEMO-${unique}`,
            type: root.type,
            priority: 'NORMAL',
            title: `DEMO · ${def.name}`,
            description: occurrence.description,
            status: 'ABERTA',
            sector: root.sector,
            origin: 'DEMONSTRACAO',
            deadlineAt: new Date(Date.now() + 86400000),
            slaEligible: false,
            isCustomerVisible: false,
            tags: ['demonstracao', 'sla-proposto'],
            sourceMetadata: { demonstration: true, sourceOrderId: root.id },
          },
        });
        const instance = await tx.serviceProcessInstance.create({
          data: {
            tenantId,
            occurrenceId: occurrence.id,
            rootOrderId: order.id,
            engineVersion: 2,
            templateCode: def.code,
            templateVersion: def.version,
            definition: json(def),
            state: { mode: 'DEMO', sourceInstanceId: source.id },
          },
        });
        await tx.serviceOrder.update({
          where: { id: order.id },
          data: { processInstanceId: instance.id, processNodeId: def.start },
        });
        await tx.serviceProcessOrderLink.create({
          data: { instanceId: instance.id, orderKey: 'root', orderId: order.id },
        });
        const lock = await tx.serviceProcessInstance.updateMany({
          where: { id: source.id, version: expectedVersion },
          data: { version: { increment: 1 }, state: json({ ...sourceState, demoId: instance.id }) },
        });
        if (lock.count !== 1)
          throw new ConflictException('Demonstração iniciada por outro operador.');
        await this.pump(tx, instance.id, tenantId, def, [def.start]);
        await this.audit(tx, tenantId, actorId, 'workflow_operational_demo', instance.id, {
          sourceId,
        });
        return { id: instance.id };
      },
      { timeout: 30000 },
    );
  }

  async activateSource(tenantId: string, actorId: string, id: string, expectedVersion: number) {
    return this.prisma.$transaction(async (tx) => {
      const item = await tx.serviceProcessInstance.findFirst({
        where: { id, tenantId, engineVersion: 2, status: 'HISTORICAL' },
      });
      if (!item || item.version !== expectedVersion)
        throw new ConflictException('Registro de origem alterado ou já ativado.');
      const root = await tx.serviceOrder.findFirst({
        where: {
          id: item.rootOrderId!,
          tenantId,
          processInstanceId: id,
          deletedAt: null,
          status: { notIn: ['FECHADA', 'CANCELADA'] },
        },
      });
      if (!root)
        throw new BadRequestException(
          'O.S. encerrada ou sob autoridade do piloto anterior. Use demonstração para experimentar.',
        );
      const lock = await tx.serviceProcessInstance.updateMany({
        where: { id, version: expectedVersion },
        data: {
          status: 'ACTIVE',
          completedAt: null,
          version: { increment: 1 },
          state: json({
            ...(item.state as object),
            mode: 'LIVE_PILOT',
            activatedAt: new Date().toISOString(),
          }),
        },
      });
      if (!lock.count) throw new ConflictException('Ativação concorrente.');
      const def = validateOperational(storedProcessDefinition(item.definition));
      await this.pump(tx, id, tenantId, def, [def.start]);
      await tx.serviceOrder.update({
        where: { id: root.id },
        data: {
          deadlineAt: new Date(
            Date.now() + def.nodes.find((n) => n.id === def.start)!.slaMinutes * 60000,
          ),
        },
      });
      await tx.occurrence.update({
        where: { id: item.occurrenceId },
        data: { status: 'EM_EXECUCAO', closedAt: null },
      });
      await this.audit(tx, tenantId, actorId, 'workflow_operational_activate_source', id, {
        rootOrderId: root.id,
        stageHistoryReconstructed: false,
      });
      return { id };
    });
  }

  async act(tenantId: string, actorId: string, role: string, id: string, input: OperationalAction) {
    if (['cancel', 'retry', 'reopen'].includes(input.action) && !managers.includes(role))
      throw new ForbiddenException('Esta ação exige gestor.');
    let command = input;
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const item = await tx.serviceProcessInstance.findFirst({
            where: { tenantId, id, engineVersion: 2 },
          });
          if (!item) throw new NotFoundException('Execução inexistente.');
          const state = { ...(item.state as Record<string, unknown>) };
          if (['HISTORICAL', 'REFERENCE'].includes(String(state.mode)))
            throw new BadRequestException(
              'Histórico preservado. Inicie uma demonstração para executar esse modelo.',
            );
          const lock = await tx.serviceProcessInstance.updateMany({
            where: { id, tenantId, version: input.expectedVersion },
            data: { version: { increment: 1 } },
          });
          if (lock.count !== 1)
            throw new ConflictException('Outra pessoa alterou o fluxo. Recarregue.');
          const def = validateOperational(storedProcessDefinition(item.definition));
          if (input.action === 'retry') {
            if (item.status !== 'FAILED' || !state.failedCommand)
              throw new BadRequestException('Não há execução interrompida para retomar.');
            command = {
              ...(state.failedCommand as OperationalAction),
              expectedVersion: input.expectedVersion,
            };
            delete state.failedCommand;
            delete state.error;
            await tx.serviceProcessInstance.update({
              where: { id },
              data: { state: json(state), status: 'ACTIVE' },
            });
          } else if (item.status === 'FAILED' && input.action !== 'cancel')
            throw new BadRequestException('Retome a falha antes de continuar.');
          if (command.action === 'advance' || command.action === 'assign') {
            if (!command.stepId) throw new BadRequestException('Informe a etapa ativa.');
            if (!['ACTIVE', 'WAITING', 'FAILED'].includes(item.status))
              throw new BadRequestException('O processo não está em execução.');
            const step = await tx.serviceProcessStep.findFirst({
              where: { id: command.stepId, tenantId, instanceId: id, status: 'ACTIVE' },
            });
            const node = def.nodes.find((n) => n.id === step?.nodeId);
            if (!step || !node || node.kind !== 'task')
              throw new BadRequestException('Etapa ativa não encontrada.');
            const order = await tx.serviceOrder.findFirst({
              where: { id: step.orderId!, tenantId },
            });
            if (!order) throw new BadRequestException('O.S. da etapa não encontrada.');
            if (
              command.expectedOrderVersion !== undefined &&
              order.version !== command.expectedOrderVersion
            )
              throw new ConflictException('O.S. alterada durante a conclusão. Atualize.');
            if (command.action === 'advance' && order.pausedAt)
              throw new BadRequestException('Retome a O.S. antes de concluir o trabalho.');
            if (command.action === 'assign') {
              if (!['super_admin', 'gerente', 'analista'].includes(role) || !command.assigneeUserId)
                throw new ForbiddenException('Escolha um responsável autorizado.');
              const member = await tx.userTenant.findUnique({
                where: { userId_tenantId: { tenantId, userId: command.assigneeUserId } },
                include: { user: true, role: true },
              });
              if (
                !member ||
                member.user.deletedAt ||
                !['ACTIVE', 'BLOCKED'].includes(member.user.status) ||
                !node.roles.includes(member.role.code as never)
              )
                throw new BadRequestException('Responsável fora da equipe ou perfil da etapa.');
              // Imported staff may remain login-blocked; assignment does not grant access.
              await tx.serviceOrder.update({
                where: { id: order.id },
                data: {
                  assigneeUserId: member.user.id,
                  analystName: member.user.name,
                  version: { increment: 1 },
                },
              });
              await tx.serviceOrderOccurrence.create({
                data: {
                  serviceOrderId: order.id,
                  actorUserId: actorId,
                  message: `Encaminhada para ${member.user.name}: ${command.reason}`,
                  isCustomerVisible: false,
                },
              });
            } else {
              if (!node.roles.includes(role as never))
                throw new ForbiddenException('Perfil sem autorização para esta etapa.');
              if (
                order.assigneeUserId &&
                order.assigneeUserId !== actorId &&
                !managers.includes(role)
              )
                throw new ForbiddenException('O.S. atribuída a outra pessoa.');
              const target = node.routes[command.outcome || ''];
              if (!target) throw new BadRequestException('Escolha um resultado permitido.');
              for (const field of node.requiredFields)
                if (!command.evidence?.[field]?.trim())
                  throw new BadRequestException(`Evidência obrigatória: ${field}`);
              await tx.serviceProcessStep.update({
                where: { id: step.id },
                data: {
                  status: 'COMPLETED',
                  outcome: command.outcome,
                  evidence: json(command.evidence || {}),
                  actorId,
                  completedAt: new Date(),
                },
              });
              await tx.serviceOrderOccurrence.create({
                data: {
                  serviceOrderId: order.id,
                  actorUserId: actorId,
                  message: `${node.name} · ${command.outcome}: ${command.reason}\n${Object.entries(
                    command.evidence || {},
                  )
                    .map(([k, v]) => `${k}: ${v}`)
                    .join('\n')}`,
                  isCustomerVisible: false,
                },
              });
              if (node.closeOn.includes(command.outcome!))
                await this.close(tx, id, tenantId, order.id, actorId, step.id, command.reason);
              await this.pump(tx, id, tenantId, def, [target]);
            }
          } else if (command.action === 'pause') {
            if (item.status !== 'ACTIVE')
              throw new BadRequestException('Somente processo ativo pode ser pausado.');
            await tx.serviceProcessInstance.update({
              where: { id },
              data: {
                status: 'PAUSED',
                state: json({ ...state, pausedAt: new Date().toISOString() }),
              },
            });
          } else if (command.action === 'resume') {
            if (item.status !== 'PAUSED')
              throw new BadRequestException('Processo não está pausado.');
            const delta = Date.now() - new Date(String(state.pausedAt)).getTime();
            for (const step of await tx.serviceProcessStep.findMany({
              where: { instanceId: id, status: 'ACTIVE' },
            })) {
              if (step.dueAt)
                await tx.serviceProcessStep.update({
                  where: { id: step.id },
                  data: { dueAt: new Date(step.dueAt.getTime() + delta) },
                });
            }
            delete state.pausedAt;
            await tx.serviceProcessInstance.update({
              where: { id },
              data: { status: 'ACTIVE', state: json(state) },
            });
          } else if (command.action === 'cancel') {
            if (!['ACTIVE', 'WAITING', 'PAUSED', 'FAILED'].includes(item.status))
              throw new BadRequestException('Processo já encerrado.');
            await tx.serviceProcessStep.updateMany({
              where: { instanceId: id, status: { in: ['ACTIVE', 'WAITING'] } },
              data: { status: 'CANCELED', completedAt: new Date() },
            });
            const orders = await tx.serviceOrder.findMany({
              where: {
                tenantId,
                processInstanceId: id,
                status: { notIn: ['FECHADA', 'CANCELADA'] },
              },
            });
            for (const order of orders) {
              await tx.serviceOrder.update({
                where: { id: order.id },
                data: { status: 'CANCELADA', canceledAt: new Date(), version: { increment: 1 } },
              });
              await tx.serviceOrderStatusEvent.create({
                data: {
                  tenantId,
                  serviceOrderId: order.id,
                  fromStatus: order.status,
                  toStatus: 'CANCELADA',
                  actorUserId: actorId,
                  reason: command.reason,
                },
              });
            }
            await tx.serviceProcessInstance.update({
              where: { id },
              data: { status: 'CANCELED', completedAt: new Date() },
            });
          } else if (command.action === 'reopen') {
            if (!['COMPLETED', 'CANCELED'].includes(item.status))
              throw new BadRequestException('Reabertura exige processo encerrado.');
            const links = await tx.serviceProcessOrderLink.findMany({
              where: { instanceId: id },
              include: { order: true },
            });
            // Explicitly reuse the final human task of each existing order, never rerun the split.
            for (const link of links) {
              const last = await tx.serviceProcessStep.findFirst({
                where: {
                  instanceId: id,
                  orderId: link.orderId,
                  status: { in: ['COMPLETED', 'CANCELED'] },
                },
                orderBy: [{ completedAt: 'desc' }, { enteredAt: 'desc' }],
              });
              if (!last) continue;
              const n = def.nodes.find((x) => x.id === last.nodeId)!;
              const count = await tx.serviceProcessStep.count({
                where: { instanceId: id, nodeId: n.id },
              });
              if (count >= def.maxVisits)
                throw new BadRequestException('Limite de reaberturas atingido. Abra nova demanda.');
              await tx.serviceProcessStep.create({
                data: {
                  tenantId,
                  instanceId: id,
                  nodeId: n.id,
                  orderId: link.orderId,
                  attempt: count + 1,
                  enteredAt: new Date(),
                  dueAt: new Date(Date.now() + n.slaMinutes * 60000),
                },
              });
              await tx.serviceOrder.update({
                where: { id: link.orderId },
                data: {
                  status: 'EM_ANALISE',
                  closedAt: null,
                  canceledAt: null,
                  resolvedAt: null,
                  reopenedCount: { increment: 1 },
                  version: { increment: 1 },
                },
              });
              await tx.serviceOrderStatusEvent.create({
                data: {
                  tenantId,
                  serviceOrderId: link.orderId,
                  fromStatus: link.order.status,
                  toStatus: 'EM_ANALISE',
                  actorUserId: actorId,
                  reason: command.reason,
                },
              });
            }
            await tx.serviceProcessStep.updateMany({
              where: {
                instanceId: id,
                nodeId: {
                  in: def.nodes.filter((n) => ['join', 'end'].includes(n.kind)).map((n) => n.id),
                },
              },
              data: { status: 'SUPERSEDED' },
            });
            await tx.serviceProcessInstance.update({
              where: { id },
              data: { status: 'ACTIVE', completedAt: null },
            });
          }
          await this.reconcileOccurrence(tx, tenantId, item.occurrenceId);
          await this.audit(tx, tenantId, actorId, 'workflow_operational_action', id, {
            action: input.action,
            stepId: command.stepId,
            outcome: command.outcome,
            reason: input.reason,
          });
          return { id };
        },
        { timeout: 30000 },
      );
    } catch (error) {
      // Validation and permission failures remain user-correctable; unexpected execution failures are durable.
      if (
        !(
          error instanceof BadRequestException ||
          error instanceof ForbiddenException ||
          error instanceof ConflictException ||
          error instanceof NotFoundException
        )
      ) {
        await this.prisma.serviceProcessInstance.updateMany({
          where: {
            tenantId,
            id,
            engineVersion: 2,
            version: input.expectedVersion,
            status: { in: ['ACTIVE', 'FAILED'] },
          },
          data: {
            status: 'FAILED',
            version: { increment: 1 },
            state: json({
              ...((await this.prisma.serviceProcessInstance.findUnique({ where: { id } }))
                ?.state as object),
              error: 'Falha na execução. Revise o evento e retome com um gestor.',
              failedCommand: command,
            }),
          },
        });
      }
      throw error;
    }
  }

  private async pump(
    tx: Tx,
    instanceId: string,
    tenantId: string,
    def: OperationalDefinition,
    targets: string[],
  ) {
    const queue = [...targets];
    for (let transitions = 0; queue.length; transitions++) {
      if (transitions > 120)
        throw new BadRequestException('Limite de transições automáticas atingido.');
      const nodeId = queue.shift()!;
      const node = def.nodes.find((n) => n.id === nodeId)!;
      const previous = await tx.serviceProcessStep.findFirst({
        where: { instanceId, nodeId },
        orderBy: { attempt: 'desc' },
      });
      if (previous?.status === 'ACTIVE') continue;
      if (previous?.status === 'COMPLETED' && node.kind !== 'task') continue;
      if (node.kind === 'join') {
        const latest = await Promise.all(
          node.waitFor.map((required) =>
            tx.serviceProcessStep.findFirst({
              where: { instanceId, nodeId: required },
              orderBy: { attempt: 'desc' },
            }),
          ),
        );
        if (!latest.every((s) => s?.status === 'COMPLETED')) {
          if (!previous || previous.status === 'SUPERSEDED')
            await tx.serviceProcessStep.create({
              data: {
                tenantId,
                instanceId,
                nodeId,
                attempt: (previous?.attempt || 0) + 1,
                status: 'WAITING',
              },
            });
          continue;
        }
      }
      let stepId: string;
      let orderStarted = false;
      if (previous?.status === 'WAITING' && node.kind === 'join') {
        await tx.serviceProcessStep.update({
          where: { id: previous.id },
          data: { status: 'COMPLETED', completedAt: new Date() },
        });
        stepId = previous.id;
      } else {
        const attempt = (previous?.attempt || 0) + 1;
        if (attempt > def.maxVisits)
          throw new BadRequestException(
            `Limite de retornos em ${node.name}. Gestor deve revisar o atendimento.`,
          );
        let orderId: string | undefined;
        if (node.kind === 'task') {
          let link = await tx.serviceProcessOrderLink.findUnique({
            where: { instanceId_orderKey: { instanceId, orderKey: node.orderKey } },
            include: { order: true },
          });
          if (!link) {
            const instance = await tx.serviceProcessInstance.findUniqueOrThrow({
              where: { id: instanceId },
            });
            const root = await tx.serviceOrder.findUniqueOrThrow({
              where: { id: instance.rootOrderId! },
            });
            const demonstration = (instance.state as Record<string, unknown>).mode === 'DEMO';
            if ((await tx.serviceProcessOrderLink.count({ where: { instanceId } })) >= 20)
              throw new BadRequestException('Limite de 20 O.S. por execução atingido.');
            const sla = new SlaEngineService(this.prisma);
            const policy = await sla.findApplicablePolicy(
              tenantId,
              root.priority,
              node.serviceType,
            );
            const deadline = await sla.calculateTargetDate(new Date(), policy.hours, tenantId);
            const order = await tx.serviceOrder.create({
              data: {
                tenantId,
                occurrenceId: instance.occurrenceId,
                processInstanceId: instanceId,
                processNodeId: node.id,
                parentOrderId: root.id,
                rootOrderId: root.id,
                // Etapas reais usam a sequência normal de protocolo (C-067); só demonstração
                // mantém o prefixo DEMO-.
                protocol: demonstration
                  ? `DEMO-${randomUUID().slice(0, 12)}`
                  : await nextOrderProtocolInTransaction(tx, tenantId),
                sourceSystem: 'ERP',
                sourceMetadata: {
                  ...(demonstration ? { demonstration: true } : {}),
                  slaPolicyConfirmed: 'id' in policy,
                  slaHours: policy.hours,
                },
                type: node.serviceType,
                priority: root.priority,
                status: 'ABERTA',
                title: `${demonstration ? 'DEMONSTRAÇÃO · ' : ''}${node.name}`,
                description: `${def.name} · O.S. derivada de ${root.protocol}. ${demonstration ? 'DEMONSTRAÇÃO; execução simulada.' : 'Entrega complementar do atendimento.'}`,
                sector: node.sector,
                requester: root.requester,
                origin: demonstration ? 'DEMONSTRACAO' : 'PROCESSO_OPERACIONAL',
                deadlineAt: deadline,
                assigneeUserId: node.assigneeUserId || root.assigneeUserId,
                analystName: root.analystName,
                slaEligible: true,
                isCustomerVisible: root.isCustomerVisible,
                tags: [
                  'fluxo-operacional',
                  'sla-proposto',
                  ...(demonstration || root.tags.includes('demonstracao') ? ['demonstracao'] : []),
                ],
              },
            });
            link = await tx.serviceProcessOrderLink.create({
              data: { instanceId, orderKey: node.orderKey, orderId: order.id },
              include: { order: true },
            });
          }
          if (
            link.order.tenantId !== tenantId ||
            ['FECHADA', 'CANCELADA'].includes(link.order.status)
          )
            throw new BadRequestException(
              `A O.S. de ${node.name} está encerrada. Reabertura exige gestor.`,
            );
          orderId = link.orderId;
          let assigned: { assigneeUserId: string; analystName: string } | undefined;
          if (node.assigneeUserId) {
            const member = await tx.userTenant.findUnique({
              where: { userId_tenantId: { tenantId, userId: node.assigneeUserId } },
              include: { user: true, role: true },
            });
            if (
              !member ||
              member.user.deletedAt ||
              !['ACTIVE', 'BLOCKED'].includes(member.user.status) ||
              !node.roles.includes(member.role.code as never)
            )
              throw new BadRequestException(`Responsável inválido no bloco ${node.name}.`);
            assigned = { assigneeUserId: member.user.id, analystName: member.user.name };
          }
          await tx.serviceOrder.update({
            where: { id: orderId },
            data: {
              processNodeId: node.id,
              sector: node.sector,
              ...assigned,
            },
          });
          orderStarted = false;
        }
        const step = await tx.serviceProcessStep.create({
          data: {
            tenantId,
            instanceId,
            nodeId,
            attempt,
            enteredAt: new Date(),
            orderId,
            status: node.kind === 'task' ? 'ACTIVE' : 'COMPLETED',
            ...(node.kind === 'task'
              ? {
                  dueAt: (await tx.serviceOrder.findUniqueOrThrow({ where: { id: orderId! } }))
                    .deadlineAt,
                }
              : { completedAt: new Date() }),
          },
        });
        stepId = step.id;
        if (orderStarted && orderId) {
          await tx.serviceOrderStatusEvent.create({
            data: {
              tenantId,
              serviceOrderId: orderId,
              fromStatus: 'ABERTA',
              toStatus: 'EM_ANALISE',
              reason: `Início da etapa: ${node.name}`,
              metadata: { engine: 'operational-v2', instanceId, stepId },
            },
          });
        }
      }
      if (node.kind === 'end') {
        const active = await tx.serviceProcessStep.count({
          where: { instanceId, status: { in: ['ACTIVE', 'WAITING'] } },
        });
        if (active) throw new BadRequestException('Ainda existem ramos obrigatórios em andamento.');
        const links = await tx.serviceProcessOrderLink.findMany({
          where: { instanceId },
          include: { order: true },
        });
        for (const link of links) {
          if (link.order.status === 'CANCELADA')
            throw new BadRequestException(
              'Há O.S. cancelada; o fluxo não pode ser concluído como sucesso.',
            );
          if (link.order.status !== 'FECHADA')
            await this.close(
              tx,
              instanceId,
              tenantId,
              link.orderId,
              null,
              stepId,
              'Conclusão de todas as etapas obrigatórias',
            );
        }
        await tx.serviceProcessInstance.update({
          where: { id: instanceId },
          data: { status: 'COMPLETED', completedAt: new Date() },
        });
      } else if (node.kind !== 'task') queue.push(...Object.values(node.routes));
    }
  }
  private async close(
    tx: Tx,
    instanceId: string,
    tenantId: string,
    orderId: string,
    actorId: string | null,
    stepId: string,
    reason: string,
  ) {
    const order = await tx.serviceOrder.findFirstOrThrow({ where: { id: orderId, tenantId } });
    if (order.status === 'FECHADA') return;
    if (order.status === 'CANCELADA')
      throw new BadRequestException('O.S. cancelada não pode ser concluída sem reabertura.');
    const now = new Date();
    // Mesma regra de aprovação da transição manual (C-039): alta/crítica atrasada fica
    // resolvida aguardando a gestão, e o fechamento sai pela aba Aprovações.
    const blocked = needsClosingApproval(order, now) && !(await hasCurrentApproval(tx, order));
    if (blocked && order.status === 'RESOLVIDA') return;
    const target = blocked ? 'RESOLVIDA' : 'FECHADA';
    const changed = await tx.serviceOrder.updateMany({
      where: { id: orderId, version: order.version },
      data: { ...statusDates(order, target, now), status: target, version: { increment: 1 } },
    });
    if (changed.count !== 1) throw new ConflictException('O.S. alterada durante a conclusão.');
    await tx.serviceOrderOccurrence.create({
      data: {
        serviceOrderId: orderId,
        actorUserId: actorId,
        message: blocked
          ? `Atendimento concluído: ${reason}. ${AWAITING_APPROVAL_MESSAGE}`
          : `Atendimento concluído: ${reason}`,
        isCustomerVisible: true,
      },
    });
    if (blocked) {
      await tx.serviceOrderStatusEvent.create({
        data: {
          tenantId,
          serviceOrderId: orderId,
          fromStatus: order.status,
          toStatus: 'RESOLVIDA',
          actorUserId: actorId,
          reason,
          metadata: { engine: 'operational-v2', instanceId, stepId, awaitingApproval: true },
        },
      });
      return;
    }
    await tx.serviceOrderStatusEvent.create({
      data: {
        tenantId,
        serviceOrderId: orderId,
        fromStatus: order.status,
        toStatus: 'FECHADA',
        actorUserId: actorId,
        reason,
        metadata: { engine: 'operational-v2', instanceId, stepId },
      },
    });
    const run = await tx.serviceProcessInstance.findUniqueOrThrow({ where: { id: instanceId } });
    const demo = (run.state as Record<string, unknown>).mode === 'DEMO';
    await tx.serviceProcessEvent.create({
      data: {
        instanceId,
        tenantId,
        eventKey: `${instanceId}:${stepId}:${orderId}:closed`,
        type: 'order_closed',
        status: demo ? 'DEMO_RECORDED' : 'PENDING',
        payload: json({
          ...order,
          previousStatus: order.status,
          status: 'FECHADA',
          operationalProcess: true,
        }),
      },
    });
  }
  private async reconcileOccurrence(tx: Tx, tenantId: string, occurrenceId: string) {
    const pending = await tx.serviceProcessInstance.count({
      where: {
        tenantId,
        occurrenceId,
        status: { notIn: ['COMPLETED', 'CANCELED', 'HISTORICAL', 'SUPERSEDED'] },
      },
    });
    const orders = await tx.serviceOrder.count({
      where: {
        tenantId,
        occurrenceId,
        deletedAt: null,
        status: { notIn: ['FECHADA', 'CANCELADA'] },
      },
    });
    await tx.occurrence.update({
      where: { id: occurrenceId },
      data: {
        status: pending || orders ? 'EM_EXECUCAO' : 'ENCERRADA',
        closedAt: pending || orders ? null : new Date(),
      },
    });
  }
  private audit(
    tx: Tx,
    tenantId: string,
    actorId: string,
    resourceType: string,
    resourceId: string,
    metadata: unknown,
  ) {
    return tx.auditLog.create({
      data: {
        tenantId,
        actorUserId: actorId,
        action: 'OS_UPDATE',
        resourceType,
        resourceId,
        metadata: json(metadata),
      },
    });
  }
  async deliverEvents() {
    if (this.delivering) return;
    this.delivering = true;
    try {
      const stale = new Date(Date.now() - 120000);
      const pending = await this.prisma.serviceProcessEvent.findMany({
        where: {
          attempts: { lt: 5 },
          OR: [
            { status: 'PENDING' },
            { status: 'PROCESSING', claimedAt: { lt: stale } },
            { status: 'FAILED', claimedAt: { lt: stale } },
          ],
        },
        take: 20,
        orderBy: { createdAt: 'asc' },
      });
      for (const event of pending) {
        const claim = await this.prisma.serviceProcessEvent.updateMany({
          where: { id: event.id, status: event.status, attempts: event.attempts },
          data: { status: 'PROCESSING', claimedAt: new Date(), attempts: { increment: 1 } },
        });
        if (!claim.count) continue;
        try {
          const startedAt = new Date();
          // Efeitos únicos do fechamento (auditoria, CSAT, aviso, tempo real, ocorrência) para
          // todo fechamento pelo motor, inclusive pela tela de processos (C-013/C-032/C-035).
          // Só na primeira entrega: uma nova tentativa reenvia apenas os workflows.
          const payload = event.payload as Record<string, unknown>;
          if (event.attempts === 0 && this.lifecycle && typeof payload.id === 'string')
            await this.lifecycle.afterStatusChange({
              tenantId: event.tenantId,
              orderId: payload.id,
              from: (typeof payload.previousStatus === 'string'
                ? payload.previousStatus
                : 'EM_ANALISE') as ServiceOrderStatus,
              to: 'FECHADA',
              actorId: null,
              reason: 'Concluída pelo fluxo de atendimento',
              source: 'process',
              workflows: false,
            });
          await this.automations.executeForEvent(
            event.tenantId,
            { type: 'order_closed', order: event.payload as Record<string, unknown> },
            { eventKey: event.eventKey },
          );
          // Falha só desta execução (mesma chave de evento), não de outras da mesma O.S. (C-038).
          if (
            await this.prisma.workflowExecutionLog.count({
              where: {
                tenantId: event.tenantId,
                status: 'FAILED',
                createdAt: { gte: startedAt },
                context: { path: ['eventKey'], equals: event.eventKey },
              },
            })
          )
            throw new Error('Falha registrada em ação de automação.');
          await this.prisma.serviceProcessEvent.update({
            where: { id: event.id },
            data: { status: 'PROCESSED', processedAt: new Date(), error: null },
          });
        } catch {
          await this.prisma.serviceProcessEvent.update({
            where: { id: event.id },
            data: {
              status: 'FAILED',
              error:
                'Falha ao entregar automações pontuais. O trabalho operacional permanece registrado.',
            },
          });
        }
      }
    } finally {
      this.delivering = false;
    }
  }
  async retryEvents(tenantId: string, actorId: string, id: string, reason: string) {
    await this.find(tenantId, id);
    return this.prisma.$transaction(async (tx) => {
      const result = await tx.serviceProcessEvent.updateMany({
        where: { tenantId, instanceId: id, status: 'FAILED' },
        data: { status: 'PENDING', attempts: 0, error: null, claimedAt: null },
      });
      await this.audit(tx, tenantId, actorId, 'workflow_operational_event_retry', id, {
        reason,
        count: result.count,
      });
      return result;
    });
  }
}
