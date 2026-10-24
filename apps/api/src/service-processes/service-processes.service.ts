import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, ServiceOrderType } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { PILOT_DEFINITIONS } from './pilot-definitions';
import { storedProcessDefinition, storedProcessRecord } from './stored-process-roles';
import {
  nextVisit,
  ProcessDefinition,
  ProcessState,
  validateDefinition,
} from './process-definition';

type Tx = Prisma.TransactionClient;
const json = (value: unknown) => value as Prisma.InputJsonValue;
const managers = ['super_admin', 'gerente'];
const operators = [...managers, 'analista'];

@Injectable()
export class ServiceProcessesService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  assertRole(role: string, manager = false) {
    if (!(manager ? managers : operators).includes(role))
      throw new ForbiddenException('Perfil sem permissão para processos.');
  }

  async templates(tenantId: string) {
    const saved = await this.prisma.serviceProcessTemplate.findMany({ where: { tenantId } });
    const definitions = new Map(PILOT_DEFINITIONS.map((d) => [d.code, d]));
    for (const item of saved) {
      if ((item.definition as { engineVersion?: number }).engineVersion === 2) continue;
      definitions.set(item.code, validateDefinition(storedProcessDefinition(item.definition)));
    }
    return [...definitions.values()];
  }
  async assignees(tenantId: string) {
    const rows = await this.prisma.userTenant.findMany({
      where: { tenantId, user: { status: 'ACTIVE' } },
      include: { user: { select: { id: true, name: true } }, role: { select: { code: true } } },
    });
    return rows
      .filter((row) => operators.includes(row.role.code))
      .map((row) => ({ id: row.user.id, name: row.user.name, role: row.role.code }));
  }

  async saveTemplate(
    tenantId: string,
    actorId: string,
    role: string,
    value: unknown,
    expectedVersion: number,
  ) {
    this.assertRole(role, true);
    const def = validateDefinition(value);
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.serviceProcessTemplate.findUnique({
        where: { tenantId_code: { tenantId, code: def.code } },
      });
      const preset = PILOT_DEFINITIONS.find((d) => d.code === def.code);
      if ((current?.version ?? preset?.version ?? 0) !== expectedVersion)
        throw new ConflictException('O fluxo foi alterado. Recarregue antes de salvar.');
      def.version = expectedVersion + 1;
      if (current) {
        const lock = await tx.serviceProcessTemplate.updateMany({
          where: { id: current.id, version: expectedVersion },
          data: { definition: json(def), version: def.version },
        });
        if (lock.count !== 1) throw new ConflictException('Edição concorrente do fluxo.');
      } else {
        await tx.serviceProcessTemplate.create({
          data: { tenantId, code: def.code, version: def.version, definition: json(def) },
        });
      }
      await this.audit(tx, tenantId, actorId, 'process_template', def.code, {
        version: def.version,
      });
      return def;
    });
  }

  async list(tenantId: string) {
    const rows = await this.prisma.serviceProcessInstance.findMany({
      where: { tenantId, engineVersion: 1 },
      include: {
        occurrence: true,
        orders: { select: { id: true, protocol: true, status: true, processNodeId: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return rows.map(storedProcessRecord);
  }

  async find(tenantId: string, id: string) {
    const item = await this.prisma.serviceProcessInstance.findFirst({
      where: { tenantId, id, engineVersion: 1 },
      include: {
        occurrence: true,
        orders: {
          include: { occurrences: { orderBy: { createdAt: 'asc' } } },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!item) throw new NotFoundException('Processo não encontrado.');
    return storedProcessRecord(item);
  }

  async start(
    tenantId: string,
    actorId: string,
    role: string,
    input: { occurrenceId: string; templateCode: string; initialOrderId?: string },
  ) {
    this.assertRole(role);
    const def = (await this.templates(tenantId)).find((d) => d.code === input.templateCode);
    if (!def) throw new BadRequestException('Modelo não encontrado.');
    return this.prisma.$transaction(async (tx) => {
      const occurrence = await tx.occurrence.findFirst({
        where: { tenantId, id: input.occurrenceId, deletedAt: null },
      });
      if (!occurrence || occurrence.status === 'ENCERRADA')
        throw new BadRequestException('Selecione uma ocorrência aberta deste provedor.');
      const exists = await tx.serviceProcessInstance.findFirst({
        where: { tenantId, occurrenceId: occurrence.id },
      });
      if (exists) throw new ConflictException('Esta ocorrência já tem processo.');
      if (!input.initialOrderId) {
        const candidates = await tx.serviceOrder.findMany({
          where: {
            tenantId,
            occurrenceId: occurrence.id,
            deletedAt: null,
            processInstanceId: null,
            status: { in: ['ABERTA', 'EM_ANALISE'] },
          },
          select: { id: true },
          take: 2,
        });
        if (candidates.length > 1)
          throw new BadRequestException(
            'Há várias O.S. abertas. Informe qual será a O.S. inicial.',
          );
        if (candidates.length === 1) input = { ...input, initialOrderId: candidates[0].id };
      }
      if (input.initialOrderId) {
        const order = await tx.serviceOrder.findFirst({
          where: {
            tenantId,
            id: input.initialOrderId,
            occurrenceId: occurrence.id,
            deletedAt: null,
            processInstanceId: null,
            status: { in: ['ABERTA', 'EM_ANALISE'] },
          },
        });
        if (!order)
          throw new BadRequestException('O.S. inicial não disponível para este atendimento.');
      }
      const now = new Date();
      const state: ProcessState = {
        current: null,
        history: [],
        events: [
          {
            type: 'STARTED',
            actorId,
            at: now.toISOString(),
            reason: 'Início do processo nativo; metas propostas para o piloto.',
          },
        ],
      };
      const instance = await tx.serviceProcessInstance.create({
        data: {
          tenantId,
          occurrenceId: occurrence.id,
          templateCode: def.code,
          templateVersion: def.version,
          definition: json(def),
          state: json(state),
        },
      });
      await this.activate(
        tx,
        instance.id,
        tenantId,
        occurrence.id,
        def,
        state,
        def.start,
        now,
        input.initialOrderId,
      );
      await tx.serviceProcessInstance.update({
        where: { id: instance.id },
        data: { state: json(state) },
      });
      await tx.occurrence.update({ where: { id: occurrence.id }, data: { status: 'EM_EXECUCAO' } });
      await this.audit(tx, tenantId, actorId, 'process_start', instance.id, {
        templateCode: def.code,
        occurrenceId: occurrence.id,
      });
      return { id: instance.id };
    });
  }

  async act(
    tenantId: string,
    actorId: string,
    role: string,
    id: string,
    input: {
      expectedVersion: number;
      action: 'advance' | 'pause' | 'resume' | 'cancel' | 'reopen' | 'assign';
      assigneeUserId?: string;
      outcome?: string;
      evidence?: Record<string, string>;
      reason: string;
    },
  ) {
    this.assertRole(role, ['cancel', 'reopen'].includes(input.action));
    return this.prisma.$transaction(async (tx) => {
      const item = await tx.serviceProcessInstance.findFirst({ where: { tenantId, id } });
      if (!item) throw new NotFoundException('Processo não encontrado.');
      const lock = await tx.serviceProcessInstance.updateMany({
        where: { tenantId, id, version: input.expectedVersion },
        data: { version: { increment: 1 } },
      });
      if (lock.count !== 1)
        throw new ConflictException('Outra pessoa alterou o processo. Recarregue.');
      const def = validateDefinition(storedProcessDefinition(item.definition));
      const state = structuredClone(item.state) as unknown as ProcessState;
      const now = new Date();
      let status = item.status;
      const visit = state.current;
      const node = def.nodes.find((n) => n.id === visit?.nodeId);
      if (input.action === 'assign') {
        if (
          !visit ||
          !node ||
          !['ACTIVE', 'WAITING', 'PAUSED'].includes(status) ||
          !input.assigneeUserId
        )
          throw new BadRequestException('Etapa ou responsável inválido.');
        if (!['super_admin', 'gerente', 'analista'].includes(role))
          throw new ForbiddenException('Atribuição exige gestor ou analista.');
        const member = await tx.userTenant.findUnique({
          where: { userId_tenantId: { tenantId, userId: input.assigneeUserId } },
          include: { user: true, role: true },
        });
        if (
          !member ||
          member.user.status !== 'ACTIVE' ||
          !node.roles.includes(member.role.code as never)
        )
          throw new BadRequestException('Responsável sem vínculo ou perfil para esta etapa.');
        visit.assigneeUserId = member.user.id;
        if (visit.orderId)
          await tx.serviceOrder.update({
            where: { id: visit.orderId },
            data: { assigneeUserId: member.user.id, analystName: member.user.name },
          });
      } else if (input.action === 'advance') {
        if (!['ACTIVE', 'WAITING'].includes(status) || !visit || !node)
          throw new BadRequestException('Não há etapa ativa para concluir.');
        if (!node.roles.includes(role as never))
          throw new ForbiddenException(
            'Esta etapa exige o perfil responsável, como gestão na auditoria.',
          );
        if (visit.assigneeUserId && visit.assigneeUserId !== actorId && !managers.includes(role))
          throw new ForbiddenException('Etapa atribuída a outro responsável.');
        const target = node.routes[input.outcome || ''];
        if (!target) throw new BadRequestException('Escolha um resultado permitido para a etapa.');
        for (const field of node.requiredFields)
          if (!input.evidence?.[field]?.trim())
            throw new BadRequestException(`Preencha a evidência: ${field}.`);
        await this.finishOrder(tx, tenantId, actorId, role, visit.orderId, input.reason, false);
        state.history.push({
          ...visit,
          completedAt: now.toISOString(),
          actorId,
          outcome: input.outcome,
          evidence: input.evidence,
        });
        state.current = null;
        const next = def.nodes.find((n) => n.id === target)!;
        if (next.kind === 'end') {
          status = 'COMPLETED';
          await tx.occurrence.update({
            where: { id: item.occurrenceId },
            data: { status: 'ENCERRADA', closedAt: now },
          });
        } else {
          await this.activate(tx, id, tenantId, item.occurrenceId, def, state, target, now);
          status = next.kind === 'wait' ? 'WAITING' : 'ACTIVE';
        }
      } else if (input.action === 'pause') {
        if (!['ACTIVE', 'WAITING'].includes(status) || !visit)
          throw new BadRequestException('Somente processo em execução pode ser pausado.');
        status = 'PAUSED';
        state.pausedAt = now.toISOString();
      } else if (input.action === 'resume') {
        if (status !== 'PAUSED' || !visit || !state.pausedAt)
          throw new BadRequestException('Processo não está pausado.');
        visit.dueAt = new Date(
          new Date(visit.dueAt).getTime() + now.getTime() - new Date(state.pausedAt).getTime(),
        ).toISOString();
        if (visit.orderId)
          await tx.serviceOrder.update({
            where: { id: visit.orderId },
            data: { deadlineAt: new Date(visit.dueAt) },
          });
        state.pausedAt = null;
        status = node?.kind === 'wait' ? 'WAITING' : 'ACTIVE';
      } else if (input.action === 'cancel') {
        if (!['ACTIVE', 'WAITING', 'PAUSED'].includes(status))
          throw new BadRequestException('Processo já encerrado.');
        await this.finishOrder(tx, tenantId, actorId, role, visit?.orderId, input.reason, true);
        if (visit)
          state.history.push({
            ...visit,
            completedAt: now.toISOString(),
            actorId,
            outcome: 'CANCELADO',
          });
        state.current = null;
        status = 'CANCELED';
        await tx.occurrence.update({
          where: { id: item.occurrenceId },
          data: { status: 'ENCERRADA', closedAt: now },
        });
      } else {
        if (!['COMPLETED', 'CANCELED'].includes(status))
          throw new BadRequestException('Reabertura exige processo encerrado.');
        await this.activate(tx, id, tenantId, item.occurrenceId, def, state, def.start, now);
        await tx.occurrence.update({
          where: { id: item.occurrenceId },
          data: { status: 'EM_EXECUCAO', closedAt: null },
        });
        status = 'ACTIVE';
        state.pausedAt = null;
      }
      state.events.push({
        type: input.action.toUpperCase(),
        at: now.toISOString(),
        actorId,
        reason: input.reason,
      });
      await this.audit(tx, tenantId, actorId, 'process_transition', id, {
        action: input.action,
        outcome: input.outcome || null,
        reason: input.reason,
      });
      return tx.serviceProcessInstance.update({
        where: { id },
        data: {
          status,
          state: json(state),
          completedAt: ['COMPLETED', 'CANCELED'].includes(status) ? now : null,
        },
      });
    });
  }

  private async activate(
    tx: Tx,
    instanceId: string,
    tenantId: string,
    occurrenceId: string,
    def: ProcessDefinition,
    state: ProcessState,
    nodeId: string,
    now: Date,
    initialOrderId?: string,
  ) {
    const node = def.nodes.find((n) => n.id === nodeId)!;
    const visit = nextVisit(def, state, nodeId, now);
    if (node.kind === 'task') {
      if (initialOrderId) {
        await tx.serviceOrder.update({
          where: { id: initialOrderId },
          data: {
            processInstanceId: instanceId,
            processNodeId: nodeId,
            slaEligible: false,
            deadlineAt: new Date(visit.dueAt),
          },
        });
        visit.orderId = initialOrderId;
      } else {
        const order = await tx.serviceOrder.create({
          data: {
            tenantId,
            occurrenceId,
            processInstanceId: instanceId,
            processNodeId: nodeId,
            protocol: `PROC-${randomUUID()}`,
            sourceSystem: 'ERP',
            type: node.serviceType as ServiceOrderType,
            priority: 'NORMAL',
            title: node.name,
            description: `${def.name} · etapa ${node.name}. Meta proposta para demonstração.`,
            sector: node.sector,
            origin: 'PROCESSO_NATIVO',
            slaEligible: false,
            deadlineAt: new Date(visit.dueAt),
            isCustomerVisible: false,
            tags: ['piloto-meganet', 'sla-proposto'],
          },
        });
        visit.orderId = order.id;
      }
    }
    state.current = visit;
  }

  private async finishOrder(
    tx: Tx,
    tenantId: string,
    actorId: string,
    role: string,
    id: string | undefined,
    reason: string,
    canceled: boolean,
  ) {
    if (!id) return;
    const order = await tx.serviceOrder.findFirst({ where: { tenantId, id, deletedAt: null } });
    if (!order || ['FECHADA', 'CANCELADA'].includes(order.status))
      throw new ConflictException('O.S. da etapa foi alterada fora do fluxo.');
    if (
      order.slaEligible &&
      ['ALTA', 'CRITICA'].includes(order.priority) &&
      order.deadlineAt < new Date() &&
      !managers.includes(role)
    )
      throw new ForbiddenException('Conclusão atrasada exige aprovação gerencial.');
    const now = new Date();
    const status = canceled ? 'CANCELADA' : 'FECHADA';
    await tx.serviceOrder.update({
      where: { id, version: order.version },
      data: {
        status,
        version: { increment: 1 },
        ...(canceled ? { canceledAt: now } : { resolvedAt: now, closedAt: now }),
        occurrences: {
          create: {
            actorUserId: actorId,
            message: `Etapa do processo ${status.toLowerCase()}: ${reason}`,
            isCustomerVisible: false,
          },
        },
        serviceOrderStatusEvents: {
          create: {
            tenantId,
            fromStatus: order.status,
            toStatus: status,
            actorUserId: actorId,
            reason,
          },
        },
      },
    });
  }

  private audit(
    tx: Tx,
    tenantId: string,
    actorId: string,
    resourceType: string,
    resourceId: string,
    metadata: Record<string, unknown>,
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
}
