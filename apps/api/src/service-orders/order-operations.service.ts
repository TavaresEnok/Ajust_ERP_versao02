import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { SlaEngineService } from '../sla/sla-engine.service';
import { OperationalProcessesService } from '../service-processes/operational-processes.service';
import { storedProcessDefinition } from '../service-processes/stored-process-roles';
import { validateOperational } from '../service-processes/operational-definition';

type Command = {
  action: 'start' | 'pause' | 'resume' | 'schedule' | 'unschedule' | 'assign' | 'finish' | 'reopen';
  expectedVersion: number;
  reason: string;
  assigneeUserId?: string;
  scheduledAt?: string;
  outcome?: string;
  change?: { impact: string; rollbackPlan: string };
};
@Injectable()
export class OrderOperationsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(SlaEngineService) private readonly sla: SlaEngineService,
    @Inject(OperationalProcessesService) private readonly processes: OperationalProcessesService,
  ) {}

  async alerts(tenantId: string) {
    return this.prisma.serviceOrder.findMany({
      where: {
        tenantId,
        deletedAt: null,
        status: { notIn: ['FECHADA', 'CANCELADA'] },
        OR: [
          { pausedAt: { not: null } },
          { scheduledAt: { lt: new Date() }, scheduleStartedAt: null },
        ],
      },
      select: {
        id: true,
        protocol: true,
        title: true,
        analystName: true,
        pausedAt: true,
        pauseReason: true,
        scheduledAt: true,
        scheduleStartedAt: true,
      },
      orderBy: { updatedAt: 'desc' },
      take: 200,
    });
  }

  async run(tenantId: string, actorId: string, role: string, id: string, input: Command) {
    if (!['super_admin', 'gerente', 'analista'].includes(role)) throw new ForbiddenException();
    const order = await this.prisma.serviceOrder.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    if (!order) throw new NotFoundException('O.S. não encontrada.');
    if (order.version !== input.expectedVersion)
      throw new ConflictException('O.S. alterada. Atualize antes de continuar.');
    if (input.action === 'reopen') {
      if (order.status !== 'FECHADA')
        throw new BadRequestException('Somente O.S. fechada pode ser reaberta.');
      await this.prisma.$transaction(async (tx) => {
        const changed = await tx.serviceOrder.updateMany({
          where: { id, tenantId, version: input.expectedVersion },
          data: {
            status: 'EM_ANALISE',
            closedAt: null,
            resolvedAt: null,
            reopenedCount: { increment: 1 },
            version: { increment: 1 },
          },
        });
        if (changed.count !== 1) throw new ConflictException('O.S. alterada.');
        if (order.processInstanceId) {
          const last = await tx.serviceProcessStep.findFirst({
            where: { instanceId: order.processInstanceId, orderId: id, status: 'COMPLETED' },
            orderBy: { completedAt: 'desc' },
          });
          if (!last || last.attempt >= 5)
            throw new BadRequestException(
              'Não foi possível reabrir esta entrega. Revise o fluxo com a gestão.',
            );
          await tx.serviceProcessStep.create({
            data: {
              tenantId,
              instanceId: order.processInstanceId,
              nodeId: last.nodeId,
              orderId: id,
              attempt: last.attempt + 1,
              status: 'ACTIVE',
              dueAt: order.deadlineAt,
            },
          });
          await tx.serviceProcessInstance.update({
            where: { id: order.processInstanceId },
            data: { status: 'ACTIVE', completedAt: null, version: { increment: 1 } },
          });
        }
        await tx.serviceOrderStatusEvent.create({
          data: {
            tenantId,
            serviceOrderId: id,
            actorUserId: actorId,
            fromStatus: 'FECHADA',
            toStatus: 'EM_ANALISE',
            reason: input.reason,
          },
        });
        await tx.serviceOrderOccurrence.create({
          data: {
            serviceOrderId: id,
            actorUserId: actorId,
            message: `O.S. reaberta sem recriar entregas: ${input.reason}`,
          },
        });
      });
      await this.syncOccurrence(tenantId, order.occurrenceId);
      return this.prisma.serviceOrder.findUniqueOrThrow({ where: { id } });
    }
    if (['FECHADA', 'CANCELADA'].includes(order.status))
      throw new BadRequestException('Reabra a O.S. antes de alterar o atendimento.');
    if (input.action === 'finish' && order.pausedAt)
      throw new BadRequestException('Retome a O.S. antes de encerrar.');
    if (input.action === 'finish' && order.processInstanceId) {
      const process = await this.processes.find(tenantId, order.processInstanceId);
      const step = process.steps.find((s) => s.orderId === id && s.status === 'ACTIVE');
      const definition = validateOperational(storedProcessDefinition(process.definition));
      const node = definition.nodes.find((n) => n.id === step?.nodeId);
      if (!step || !node)
        throw new BadRequestException(
          'Esta O.S. aguarda uma etapa anterior. Consulte o acompanhamento.',
        );
      const outcomes = Object.keys(node.routes);
      const outcome = input.outcome || (outcomes.length === 1 ? outcomes[0] : undefined);
      if (!outcome) throw new BadRequestException('Selecione o resultado do trabalho.');
      await this.processes.act(tenantId, actorId, role, process.id, {
        action: 'advance',
        expectedVersion: process.version,
        expectedOrderVersion: input.expectedVersion,
        stepId: step.id,
        outcome,
        reason: input.reason,
        evidence: Object.fromEntries(node.requiredFields.map((f) => [f, input.reason])),
      });
      const unfinished = await this.prisma.serviceOrder.count({
        where: {
          tenantId,
          processInstanceId: process.id,
          status: { notIn: ['FECHADA', 'CANCELADA'] },
        },
      });
      const active = await this.prisma.serviceProcessStep.count({
        where: { instanceId: process.id, status: { in: ['ACTIVE', 'WAITING'] } },
      });
      if (!unfinished && !active)
        await this.prisma.serviceProcessInstance.updateMany({
          where: { id: process.id, status: 'ACTIVE' },
          data: { status: 'COMPLETED', completedAt: new Date() },
        });
      await this.syncOccurrence(tenantId, order.occurrenceId);
      if (
        order.changeRequestId &&
        (await this.prisma.serviceOrder.findUniqueOrThrow({ where: { id } })).status === 'FECHADA'
      )
        await this.prisma.changeRequest.updateMany({
          where: { id: order.changeRequestId, tenantId },
          data: { status: 'CONCLUIDO', executedById: actorId },
        });
      return this.prisma.serviceOrder.findUniqueOrThrow({ where: { id } });
    }

    const now = new Date();
    const data: Prisma.ServiceOrderUncheckedUpdateManyInput = { version: { increment: 1 } };
    let message = input.reason;
    if (input.action === 'pause') {
      if (order.pausedAt) throw new BadRequestException('O.S. já pausada.');
      data.pausedAt = now;
      data.pauseReason = input.reason;
      data.originalDeadlineAt = order.originalDeadlineAt || order.deadlineAt;
      message = `SLA pausado: ${input.reason}`;
    }
    if (input.action === 'resume') {
      if (!order.pausedAt) throw new BadRequestException('O.S. não está pausada.');
      const minutes = await this.sla.calculateBusinessPauseDuration(order.pausedAt, now, tenantId);
      data.deadlineAt =
        minutes > 0
          ? await this.sla.calculateTargetDate(order.deadlineAt, minutes / 60, tenantId)
          : order.deadlineAt;
      data.pausedAt = null;
      data.pauseReason = null;
      message = `SLA retomado; ${Math.round(minutes)} minutos úteis em pausa. ${input.reason}`;
    }
    if (input.action === 'schedule') {
      if (!input.scheduledAt || new Date(input.scheduledAt) <= now)
        throw new BadRequestException('Informe uma data futura para a execução.');
      data.scheduledAt = new Date(input.scheduledAt);
      data.scheduleStartedAt = null;
      message = `Execução agendada para ${new Date(input.scheduledAt).toLocaleString('pt-BR', { timeZone: 'America/Fortaleza' })}: ${input.reason}`;
    }
    if (input.action === 'unschedule') {
      data.scheduledAt = null;
      data.scheduleStartedAt = null;
      message = `Agendamento removido: ${input.reason}`;
    }
    if (input.action === 'assign') {
      const member =
        input.assigneeUserId &&
        (await this.prisma.userTenant.findFirst({
          where: {
            tenantId,
            userId: input.assigneeUserId,
            role: { code: { in: ['analista', 'gerente', 'super_admin'] } },
            user: { status: 'ACTIVE', deletedAt: null },
          },
          include: { user: true },
        }));
      if (!member) throw new BadRequestException('Selecione uma pessoa ativa da equipe.');
      data.assigneeUserId = member.userId;
      data.analystName = member.user.name;
      data.handoffNotes = input.reason;
      message = `Encaminhada de ${order.analystName || 'não atribuído'} para ${member.user.name}. Passagem de atendimento: ${input.reason}`;
    }
    if (input.action === 'start') {
      if (order.pausedAt) throw new BadRequestException('Retome a O.S. antes de iniciar.');
      data.status = 'EM_ANALISE';
      data.scheduleStartedAt = order.scheduledAt ? now : null;
      message = input.reason ? `Execução iniciada: ${input.reason}` : 'Execução iniciada.';
    }
    if (input.action === 'finish') {
      data.status = 'FECHADA';
      data.resolvedAt = now;
      data.closedAt = now;
      message = `Atendimento concluído: ${input.reason}`;
    }
    await this.prisma.$transaction(async (tx) => {
      const changed = await tx.serviceOrder.updateMany({
        where: { id, tenantId, version: input.expectedVersion },
        data,
      });
      if (changed.count !== 1)
        throw new ConflictException('Outro usuário alterou esta O.S. Atualize.');
      let changeRequestId = order.changeRequestId;
      if (input.action === 'schedule' && input.change) {
        const values = {
          title: order.title,
          description: input.change.impact,
          justification: input.reason,
          rollbackPlan: input.change.rollbackPlan,
          plannedStart: new Date(input.scheduledAt!),
        };
        if (changeRequestId)
          await tx.changeRequest.updateMany({
            where: { id: changeRequestId, tenantId },
            data: values,
          });
        else {
          const change = await tx.changeRequest.create({
            data: {
              tenantId,
              number: `RFC-${randomUUID().slice(0, 8)}`,
              ...values,
              requestedById: actorId,
              status: 'RASCUNHO',
              tags: ['manutencao-operacional', 'aprovacao-nao-obrigatoria'],
            },
          });
          changeRequestId = change.id;
          await tx.serviceOrder.update({ where: { id }, data: { changeRequestId } });
        }
      }
      if (changeRequestId && input.action === 'start')
        await tx.changeRequest.updateMany({
          where: { id: changeRequestId, tenantId, tags: { has: 'aprovacao-nao-obrigatoria' } },
          data: { status: 'EM_EXECUCAO', executedById: actorId },
        });
      if (changeRequestId && input.action === 'finish')
        await tx.changeRequest.updateMany({
          where: { id: changeRequestId, tenantId },
          data: { status: 'CONCLUIDO', executedById: actorId },
        });
      await tx.serviceOrderOccurrence.create({
        data: {
          serviceOrderId: id,
          actorUserId: actorId,
          message,
          isCustomerVisible: input.action === 'finish',
        },
      });
      if (data.status)
        await tx.serviceOrderStatusEvent.create({
          data: {
            tenantId,
            serviceOrderId: id,
            actorUserId: actorId,
            fromStatus: order.status,
            toStatus: data.status as 'FECHADA' | 'EM_ANALISE',
            reason: input.reason,
          },
        });
      if (['pause', 'resume'].includes(input.action)) {
        await tx.slaAuditEvent.create({
          data: {
            tenantId,
            orderId: id,
            eventType: input.action === 'pause' ? 'PAUSED' : 'RESUMED',
            deadlineAt: (data.deadlineAt as Date) || order.deadlineAt,
            reason: input.reason,
            metadata: {
              actorId,
              pausedAt: order.pausedAt?.toISOString() || now.toISOString(),
              previousDeadline: order.deadlineAt.toISOString(),
            },
          },
        });
        if (input.action === 'resume')
          await tx.serviceProcessStep.updateMany({
            where: { tenantId, orderId: id, status: 'ACTIVE' },
            data: { dueAt: (data.deadlineAt as Date) || order.deadlineAt },
          });
      }
      if (['schedule', 'unschedule'].includes(input.action)) {
        await tx.calendarEvent.deleteMany({
          where: { tenantId, serviceOrderId: id, title: { startsWith: 'Execução · ' } },
        });
        if (input.action === 'schedule')
          await tx.calendarEvent.create({
            data: {
              tenantId,
              title: `Execução · ${order.protocol}`,
              description: input.reason,
              type: 'OUTRO',
              startAt: new Date(input.scheduledAt!),
              endAt: null,
              changeRequestId,
              createdById: actorId,
              assigneeId: order.assigneeUserId,
              serviceOrderId: id,
              occurrenceId: order.occurrenceId,
            },
          });
      }
      if (input.action === 'assign')
        await tx.calendarEvent.updateMany({
          where: { tenantId, serviceOrderId: id, startAt: { gte: now } },
          data: { assigneeId: input.assigneeUserId },
        });
    });
    await this.syncOccurrence(tenantId, order.occurrenceId);
    return this.prisma.serviceOrder.findUniqueOrThrow({ where: { id } });
  }

  async syncOccurrence(tenantId: string, occurrenceId: string | null) {
    if (!occurrenceId) return;
    await this.prisma.$transaction(
      async (tx) => {
        const pending = await tx.serviceOrder.count({
          where: {
            tenantId,
            occurrenceId,
            deletedAt: null,
            status: { notIn: ['FECHADA', 'CANCELADA'] },
          },
        });
        const flows = await tx.serviceProcessInstance.count({
          where: {
            tenantId,
            occurrenceId,
            status: { in: ['ACTIVE', 'WAITING', 'PAUSED', 'FAILED'] },
          },
        });
        await tx.occurrence.updateMany({
          where: { id: occurrenceId, tenantId },
          data: {
            status: pending || flows ? 'EM_EXECUCAO' : 'ENCERRADA',
            closedAt: pending || flows ? null : new Date(),
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async closeOccurrence(
    tenantId: string,
    actorId: string,
    role: string,
    id: string,
    input: { reason: string; orders: { id: string; version: number }[] },
  ) {
    const occurrence = await this.prisma.occurrence.findFirst({
      where: { tenantId, id, deletedAt: null },
    });
    if (!occurrence) throw new NotFoundException();
    const pending = await this.prisma.serviceOrder.findMany({
      where: {
        tenantId,
        occurrenceId: id,
        deletedAt: null,
        status: { notIn: ['FECHADA', 'CANCELADA'] },
      },
    });
    if (pending.some((o) => o.pausedAt))
      throw new BadRequestException('Retome as O.S. pausadas antes da conclusão conjunta.');
    if (
      role === 'analista' &&
      pending.some((o) => o.assigneeUserId && o.assigneeUserId !== actorId)
    )
      throw new ForbiddenException(
        'Cada analista conclui suas entregas. A gestão pode registrar a conclusão conjunta.',
      );
    if (pending.some((o) => !input.orders.some((c) => c.id === o.id && c.version === o.version)))
      throw new ConflictException(
        'A lista de O.S. mudou. Revise as ordens pendentes antes de confirmar.',
      );
    // Each completion uses the same operational authority. Newly generated children must be reviewed separately.
    for (const order of pending)
      await this.run(tenantId, actorId, role, order.id, {
        action: 'finish',
        expectedVersion: order.version,
        reason: input.reason,
      });
    await this.syncOccurrence(tenantId, id);
    return this.prisma.occurrence.findUniqueOrThrow({ where: { id } });
  }
}
