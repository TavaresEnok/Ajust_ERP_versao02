import { transactionScope } from '../prisma/transaction-scope';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { Prisma, type ServiceOrderStatus } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { SlaEngineService } from '../sla/sla-engine.service';
import { OperationalProcessesService } from '../service-processes/operational-processes.service';
import { storedProcessDefinition } from '../service-processes/stored-process-roles';
import { validateOperational } from '../service-processes/operational-definition';
import { syncOccurrenceStatus } from './occurrence-sync';
import {
  AWAITING_APPROVAL_MESSAGE,
  hasCurrentApproval,
  needsClosingApproval,
  statusDates,
} from './service-order-rules';
import { ServiceOrderLifecycleService } from './service-order-lifecycle.service';
import { PROCESS_PAUSE_PREFIX, deadlineAfterStop } from './sla-pause';

type Command = {
  action: 'start' | 'pause' | 'resume' | 'schedule' | 'unschedule' | 'assign' | 'finish' | 'reopen';
  expectedVersion: number;
  reason: string;
  assigneeUserId?: string;
  scheduledAt?: string;
  outcome?: string;
  evidence?: Record<string, string>;
  change?: { impact: string; rollbackPlan: string };
};
/**
 * RFC que pode ser concluída pela O.S.: não excluída e já em execução/aprovada; rascunho só
 * quando a mudança é operacional sem aprovação obrigatória. Rejeitada/cancelada nunca.
 */
function concludableChange(id: string, tenantId: string): Prisma.ChangeRequestWhereInput {
  return {
    id,
    tenantId,
    deletedAt: null,
    OR: [
      { status: { in: ['APROVADO', 'EM_EXECUCAO'] } },
      { status: 'RASCUNHO', tags: { has: 'aprovacao-nao-obrigatoria' } },
    ],
  };
}

@Injectable()
export class OrderOperationsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(SlaEngineService) private readonly sla: SlaEngineService,
    @Inject(OperationalProcessesService) private readonly processes: OperationalProcessesService,
    @Optional()
    @Inject(ServiceOrderLifecycleService)
    private readonly lifecycle?: ServiceOrderLifecycleService,
  ) {}

  private async after(
    tenantId: string,
    actorId: string,
    order: { id: string; status: ServiceOrderStatus },
    reason: string,
    workflows = true,
    handledElsewhere: ServiceOrderStatus[] = [],
  ) {
    const current = await this.prisma.serviceOrder.findUnique({
      where: { id: order.id },
      select: { status: true },
    });
    if (current && handledElsewhere.includes(current.status)) return;
    if (current && current.status !== order.status)
      await this.lifecycle?.afterStatusChange({
        tenantId,
        orderId: order.id,
        from: order.status,
        to: current.status,
        actorId,
        reason,
        source: 'operations',
        workflows,
        syncOccurrence: false,
      });
  }

  private async auditAction(tenantId: string, actorId: string, orderId: string, action: string) {
    await this.prisma.auditLog
      .create({
        data: {
          tenantId,
          actorUserId: actorId,
          action: 'OS_UPDATE',
          resourceType: 'service_order',
          resourceId: orderId,
          metadata: { operation: action },
        },
      })
      .catch(() => undefined);
  }

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
      if (order.status !== 'FECHADA' && order.status !== 'RESOLVIDA')
        throw new BadRequestException('Somente O.S. resolvida ou fechada pode ser reaberta.');
      // O período em que a O.S. ficou encerrada não consome prazo: ela volta com o tempo útil
      // que restava na entrega (mesma conta da retomada de pausa).
      const stoppedAt = order.resolvedAt ?? order.closedAt;
      const reopened =
        order.slaEligible && !order.pausedAt && stoppedAt
          ? await deadlineAfterStop(this.sla, tenantId, stoppedAt, order.deadlineAt)
          : null;
      const deadlineAt = reopened?.deadlineAt ?? order.deadlineAt;
      await this.prisma.$transaction(async (tx) => {
        const changed = await tx.serviceOrder.updateMany({
          where: { id, tenantId, version: input.expectedVersion },
          data: {
            deadlineAt,
            ...(reopened && reopened.minutes > 0
              ? { originalDeadlineAt: order.originalDeadlineAt ?? order.deadlineAt }
              : {}),
            status: 'EM_ANALISE',
            closedAt: null,
            resolvedAt: null,
            reopenedCount: { increment: 1 },
            version: { increment: 1 },
          },
        });
        if (changed.count !== 1) throw new ConflictException('O.S. alterada.');
        if (reopened && reopened.minutes > 0)
          await tx.slaAuditEvent.create({
            data: {
              tenantId,
              orderId: id,
              eventType: 'REOPENED',
              deadlineAt,
              reason: input.reason,
              metadata: {
                actorId,
                previousDeadline: order.deadlineAt.toISOString(),
                pausedBusinessMinutes: Math.round(reopened.minutes),
              },
            },
          });
        if (order.processInstanceId) {
          const instance = await tx.serviceProcessInstance.findFirst({
            where: { id: order.processInstanceId, tenantId },
          });
          // Fluxo cancelado, pausado ou em falha só volta pela ação da gestão na tela do
          // processo; reabrir a O.S. não pode reativá-lo por fora.
          if (!instance || !['ACTIVE', 'COMPLETED'].includes(instance.status))
            throw new BadRequestException(
              'O fluxo deste atendimento não está em execução (cancelado, pausado ou em falha). Peça à gestão para reabrir ou retomar o processo.',
            );
          const definition = validateOperational(storedProcessDefinition(instance.definition));
          const last = await tx.serviceProcessStep.findFirst({
            where: { instanceId: order.processInstanceId, orderId: id, status: 'COMPLETED' },
            orderBy: { completedAt: 'desc' },
          });
          const visits = last
            ? await tx.serviceProcessStep.count({
                where: { instanceId: order.processInstanceId, nodeId: last.nodeId },
              })
            : 0;
          if (!last || visits >= definition.maxVisits)
            throw new BadRequestException(
              'Não foi possível reabrir esta entrega. Revise o fluxo com a gestão.',
            );
          // Como na reabertura pelo processo: junção e fim já concluídos voltam a valer, para
          // a nova conclusão da etapa encerrar o fluxo de novo.
          await tx.serviceProcessStep.updateMany({
            where: {
              instanceId: order.processInstanceId,
              status: 'COMPLETED',
              nodeId: {
                in: definition.nodes
                  .filter((n) => ['join', 'end'].includes(n.kind))
                  .map((n) => n.id),
              },
            },
            data: { status: 'SUPERSEDED' },
          });
          await tx.serviceProcessStep.create({
            data: {
              tenantId,
              instanceId: order.processInstanceId,
              nodeId: last.nodeId,
              orderId: id,
              attempt: visits + 1,
              status: 'ACTIVE',
              dueAt: deadlineAt,
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
            fromStatus: order.status,
            toStatus: 'EM_ANALISE',
            reason: input.reason,
          },
        });
        await tx.serviceOrderOccurrence.create({
          data: {
            serviceOrderId: id,
            actorUserId: actorId,
            message: `O.S. reaberta sem recriar entregas: ${input.reason}`,
            isCustomerVisible: false,
          },
        });
      });
      await this.syncOccurrence(tenantId, order.occurrenceId);
      await this.after(tenantId, actorId, order, input.reason);
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
        // Older integrations send one combined technical record. The analyst UI sends
        // each requirement explicitly; missing fields are then rejected by the engine.
        evidence:
          input.evidence ?? Object.fromEntries(node.requiredFields.map((f) => [f, input.reason])),
      });
      const unfinished = await this.prisma.serviceOrder.count({
        where: {
          tenantId,
          processInstanceId: process.id,
          deletedAt: null,
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
      // Fechado pelo motor: os efeitos saem pela fila do processo (uma vez só). Aqui fica só
      // o caso "resolvida aguardando aprovação", que não gera evento de fechamento.
      await this.after(tenantId, actorId, order, input.reason, false, ['FECHADA']);
      if (
        order.changeRequestId &&
        (await this.prisma.serviceOrder.findUniqueOrThrow({ where: { id } })).status === 'FECHADA'
      )
        await this.prisma.changeRequest.updateMany({
          where: concludableChange(order.changeRequestId, tenantId),
          data: { status: 'CONCLUIDO', executedById: actorId, version: { increment: 1 } },
        });
      return this.prisma.serviceOrder.findUniqueOrThrow({ where: { id } });
    }

    const now = new Date();
    const data: Prisma.ServiceOrderUncheckedUpdateManyInput = { version: { increment: 1 } };
    let message = input.reason;
    let resumedMinutes: number | undefined;
    if (input.action === 'pause') {
      if (order.pausedAt) throw new BadRequestException('O.S. já pausada.');
      data.pausedAt = now;
      data.pauseReason = input.reason;
      data.originalDeadlineAt = order.originalDeadlineAt || order.deadlineAt;
      message = `SLA pausado: ${input.reason}`;
    }
    if (input.action === 'resume') {
      if (!order.pausedAt) throw new BadRequestException('O.S. não está pausada.');
      if (order.pauseReason?.startsWith(PROCESS_PAUSE_PREFIX))
        throw new BadRequestException(
          'O fluxo deste atendimento está pausado. Retome o processo na tela de acompanhamento; o prazo volta a contar junto.',
        );
      const { minutes, deadlineAt: resumedDeadline } = await deadlineAfterStop(
        this.sla,
        tenantId,
        order.pausedAt,
        order.deadlineAt,
        now,
      );
      resumedMinutes = Math.round(minutes);
      data.deadlineAt = resumedDeadline;
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
      if (order.status === 'RESOLVIDA')
        throw new BadRequestException(
          'A O.S. está resolvida. Use "Reabrir" para voltar a trabalhar nela.',
        );
      // Já em análise: não registra outra mudança de status nem reinicia o agendamento.
      if (order.status !== 'EM_ANALISE') data.status = 'EM_ANALISE';
      if (order.status !== 'EM_ANALISE' || !order.scheduleStartedAt)
        data.scheduleStartedAt = order.scheduledAt ? now : null;
      message = input.reason ? `Execução iniciada: ${input.reason}` : 'Execução iniciada.';
    }
    if (input.action === 'finish') {
      // Concluir = resolver e fechar. Se o fechamento exige aprovação gerencial (alta/crítica
      // atrasada), a O.S. fica resolvida aguardando a gestão (C-013/C-039).
      const blocked =
        needsClosingApproval(order) && !(await hasCurrentApproval(this.prisma, order));
      if (blocked && order.status === 'RESOLVIDA')
        throw new BadRequestException('Esta O.S. aguarda a aprovação gerencial para fechar.');
      const target = blocked ? 'RESOLVIDA' : 'FECHADA';
      Object.assign(data, statusDates(order, target, now));
      data.status = target;
      message = blocked
        ? `Atendimento concluído: ${input.reason}. ${AWAITING_APPROVAL_MESSAGE}`
        : `Atendimento concluído: ${input.reason}`;
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
          where: {
            id: changeRequestId,
            tenantId,
            deletedAt: null,
            status: { in: ['RASCUNHO', 'APROVADO'] },
            tags: { has: 'aprovacao-nao-obrigatoria' },
          },
          data: { status: 'EM_EXECUCAO', executedById: actorId, version: { increment: 1 } },
        });
      // A RFC só conclui quando a O.S. fecha de fato (resolvida aguardando aprovação não
      // conta) e respeitando a máquina de estados da mudança.
      if (changeRequestId && input.action === 'finish' && data.status === 'FECHADA')
        await tx.changeRequest.updateMany({
          where: concludableChange(changeRequestId, tenantId),
          data: { status: 'CONCLUIDO', executedById: actorId, version: { increment: 1 } },
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
            toStatus: data.status as ServiceOrderStatus,
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
              ...(resumedMinutes !== undefined ? { pausedBusinessMinutes: resumedMinutes } : {}),
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
    if (data.status) await this.after(tenantId, actorId, order, input.reason);
    else await this.auditAction(tenantId, actorId, id, input.action);
    return this.prisma.serviceOrder.findUniqueOrThrow({ where: { id } });
  }

  async syncOccurrence(tenantId: string, occurrenceId: string | null) {
    await syncOccurrenceStatus(this.prisma, tenantId, occurrenceId);
  }

  async closeOccurrence(
    tenantId: string,
    actorId: string,
    role: string,
    id: string,
    input: { reason: string; orders: { id: string; version: number }[] },
  ) {
    if (!['super_admin', 'gerente', 'analista'].includes(role)) throw new ForbiddenException();
    const changes: { id: string; status: ServiceOrderStatus; processInstanceId: string | null }[] =
      [];
    let result;
    try {
      result = await this.prisma.$transaction(
        async (tx) => {
          const scoped = new OrderOperationsService(
            transactionScope(tx),
            this.sla,
            this.processes.inTransaction(tx),
          );
          return scoped.closeOccurrenceInTransaction(tenantId, actorId, role, id, input, changes);
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 60000 },
      );
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034')
        throw new ConflictException(
          'A ocorrência foi alterada durante a conclusão. Atualize e tente novamente.',
        );
      throw error;
    }
    for (const order of changes)
      await this.after(tenantId, actorId, order, input.reason, !order.processInstanceId);
    return result;
  }

  private async closeOccurrenceInTransaction(
    tenantId: string,
    actorId: string,
    role: string,
    id: string,
    input: { reason: string; orders: { id: string; version: number }[] },
    changes: { id: string; status: ServiceOrderStatus; processInstanceId: string | null }[],
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
    if (pending.some((o) => !input.orders.some((c) => c.id === o.id && c.version === o.version)))
      throw new ConflictException(
        'A lista de O.S. mudou. Revise as ordens pendentes antes de confirmar.',
      );
    // Valida todas antes de concluir qualquer uma, para não deixar a ocorrência pela metade (C-016).
    const blockers: string[] = [];
    for (const order of pending) {
      if (!order.processInstanceId) continue;
      const process = await this.processes.find(tenantId, order.processInstanceId);
      const step = process.steps.find((s) => s.orderId === order.id && s.status === 'ACTIVE');
      const definition = validateOperational(storedProcessDefinition(process.definition));
      const node = definition.nodes.find((n) => n.id === step?.nodeId);
      if (!step || !node) blockers.push(`${order.protocol}: aguarda uma etapa anterior do fluxo`);
      else if (Object.keys(node.routes).length !== 1)
        blockers.push(`${order.protocol}: precisa escolher o resultado do trabalho`);
    }
    if (blockers.length)
      throw new BadRequestException(
        `Nenhuma O.S. foi concluída. Conclua estas individualmente primeiro: ${blockers.join('; ')}.`,
      );
    changes.push(...pending);
    // All completions reuse the outer transaction; effects run only after commit.
    for (const order of pending)
      await this.run(tenantId, actorId, role, order.id, {
        action: 'finish',
        expectedVersion: order.version,
        reason: input.reason,
      });
    // Concluir a etapa atual pode só avançar o fluxo ou abrir entregas novas. A conclusão
    // conjunta só vale se nada ficou em aberto; senão desfaz tudo (transação) e orienta.
    const remaining = await this.prisma.serviceOrder.findMany({
      where: {
        tenantId,
        occurrenceId: id,
        deletedAt: null,
        status: { notIn: ['RESOLVIDA', 'FECHADA', 'CANCELADA'] },
      },
      select: { protocol: true },
    });
    if (remaining.length)
      throw new BadRequestException(
        `Nenhuma O.S. foi concluída: o fluxo ainda tem etapas ou entregas depois da etapa atual (${remaining
          .map((o) => o.protocol)
          .join(', ')}). Conclua as etapas pelo acompanhamento do atendimento.`,
      );
    await this.syncOccurrence(tenantId, id);
    return this.prisma.occurrence.findUniqueOrThrow({ where: { id } });
  }
}
