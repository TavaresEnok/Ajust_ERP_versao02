import { Inject, Injectable, Logger, Module, Optional, forwardRef } from '@nestjs/common';
import type { AuditAction, ServiceOrder, ServiceOrderStatus } from '@prisma/client';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from '../prisma/prisma.service';
import { EventsGateway } from '../events.gateway';
import { CsatModule } from '../csat/csat.module';
import { CsatService } from '../csat/csat.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { NotificationsService } from '../notifications/notifications.service';
import { OsProcessTemplatesModule } from '../os-process-templates/os-process-templates.module';
import { OsProcessTemplateService } from '../os-process-templates/os-process-templates.service';
import { WorkflowsModule } from '../workflows/workflows.module';
import { WorkflowsService } from '../workflows/workflows.service';
import { syncOccurrenceStatus } from './occurrence-sync';
import { isReopen } from './service-order-rules';

export type StatusChange = {
  tenantId: string;
  orderId: string;
  from: ServiceOrderStatus;
  to: ServiceOrderStatus;
  actorId: string | null;
  reason?: string | null;
  source: 'transition' | 'operations' | 'process' | 'integration' | 'workflow';
  /** O motor de processos já publica `order_closed` pela própria fila. */
  workflows?: boolean;
  /** Quem chama já sincronizou a ocorrência na mesma operação. */
  syncOccurrence?: boolean;
};

/**
 * Efeitos únicos de mudança de status e de criação de O.S. (auditoria C-013/C-035).
 * Tudo aqui roda depois da gravação: uma falha é registrada em log e não desfaz o status.
 */
@Injectable()
export class ServiceOrderLifecycleService {
  private readonly logger = new Logger(ServiceOrderLifecycleService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(EventsGateway) private readonly events: EventsGateway,
    @Optional() @Inject(CsatService) private readonly csat?: CsatService,
    @Optional() @Inject(NotificationsService) private readonly notifications?: NotificationsService,
    @Optional()
    @Inject(OsProcessTemplateService)
    private readonly osTemplates?: OsProcessTemplateService,
    @Optional()
    @Inject(forwardRef(() => WorkflowsService))
    private readonly workflows?: WorkflowsService,
  ) {}

  async afterStatusChange(change: StatusChange) {
    const { tenantId, orderId, from, to } = change;
    const order = await this.prisma.serviceOrder.findFirst({ where: { id: orderId, tenantId } });
    if (!order) return;
    const action: AuditAction =
      to === 'FECHADA'
        ? 'OS_CLOSE'
        : to === 'CANCELADA'
          ? 'OS_CANCEL'
          : isReopen(from, to)
            ? 'OS_REOPEN'
            : 'OS_UPDATE';

    await this.safe('auditoria', () =>
      this.prisma.auditLog.create({
        data: {
          tenantId,
          actorUserId: change.actorId,
          action,
          resourceType: 'service_order',
          resourceId: orderId,
          metadata: { from, to, reason: change.reason ?? null, source: change.source },
        },
      }),
    );

    this.events.emitTenantEvent(tenantId, 'service_order.transitioned', {
      tenantId,
      orderId,
      protocol: order.protocol,
      from,
      to,
      byUserId: change.actorId,
      at: new Date().toISOString(),
    });

    if (change.syncOccurrence !== false)
      await this.safe('sincronização da ocorrência', () =>
        syncOccurrenceStatus(this.prisma, tenantId, order.occurrenceId),
      );
    if (order.processInstanceId && (to === 'FECHADA' || to === 'CANCELADA'))
      await this.safe('conclusão do processo', () =>
        this.completeProcessIfDone(tenantId, order.processInstanceId!),
      );

    // A pesquisa só sai no fechamento efetivo: RESOLVIDA ainda pode voltar (C-032).
    if (to === 'FECHADA' && this.csat)
      await this.safe('CSAT', () => this.csat!.createForOrder(tenantId, orderId));

    // Aviso próprio de fechamento (não o de escalonamento) e só no fechamento efetivo (C-033).
    if (to === 'FECHADA' && this.notifications)
      void this.safe('aviso de fechamento', () =>
        this.notifications!.notifyOrderClosed(tenantId, orderId),
      );

    if (change.workflows !== false && this.workflows)
      void this.safe('workflow', () =>
        this.workflows!.executeForEvent(tenantId, {
          type: to === 'FECHADA' ? 'order_closed' : 'order_updated',
          order: this.workflowPayload(order),
        }),
      );
  }

  /** Efeitos de "O.S. criada", iguais para todos os caminhos de abertura (C-010). */
  async afterOrderCreated(
    order: ServiceOrder,
    actorId: string | null,
    extra: Record<string, unknown> = {},
  ) {
    await this.safe('auditoria', () =>
      this.prisma.auditLog.create({
        data: {
          tenantId: order.tenantId,
          actorUserId: actorId,
          action: 'OS_CREATE',
          resourceType: 'service_order',
          resourceId: order.id,
          metadata: {
            protocol: order.protocol,
            type: order.type,
            priority: order.priority,
            ...extra,
          },
        },
      }),
    );
    const payload = {
      tenantId: order.tenantId,
      orderId: order.id,
      protocol: order.protocol,
      priority: order.priority,
      status: order.status,
      occurrenceId: order.occurrenceId,
      at: new Date().toISOString(),
    };
    this.events.emitTenantEvent(order.tenantId, 'service_order.created', payload);
    this.events.emitTenantEvent(order.tenantId, 'service_order_created', {
      orderId: order.id,
      protocol: order.protocol,
    });
    if (this.workflows)
      void this.safe('workflow', () =>
        this.workflows!.executeForEvent(order.tenantId, {
          type: 'order_created',
          order: this.workflowPayload(order),
        }),
      );
  }

  /** O processo termina quando não há etapa ativa nem O.S. pendente. */
  private async completeProcessIfDone(tenantId: string, instanceId: string) {
    const [unfinished, active] = await Promise.all([
      this.prisma.serviceOrder.count({
        where: {
          tenantId,
          processInstanceId: instanceId,
          status: { notIn: ['FECHADA', 'CANCELADA'] },
        },
      }),
      this.prisma.serviceProcessStep.count({
        where: { instanceId, status: { in: ['ACTIVE', 'WAITING'] } },
      }),
    ]);
    if (!unfinished && !active)
      await this.prisma.serviceProcessInstance.updateMany({
        where: { id: instanceId, tenantId, status: 'ACTIVE' },
        data: { status: 'COMPLETED', completedAt: new Date() },
      });
  }

  private workflowPayload(order: ServiceOrder) {
    return {
      id: order.id,
      protocol: order.protocol,
      title: order.title,
      type: order.type,
      priority: order.priority,
      status: order.status,
      requester: order.requester,
      sector: order.sector,
      analystName: order.analystName,
      deadlineAt: order.deadlineAt?.toISOString(),
    };
  }

  private async safe(what: string, run: () => Promise<unknown>) {
    try {
      await run();
    } catch (error) {
      this.logger.warn(`Efeito "${what}" falhou: ${(error as Error).message}`);
    }
  }
}

@Module({
  imports: [
    PrismaModule,
    CsatModule,
    NotificationsModule,
    OsProcessTemplatesModule,
    forwardRef(() => WorkflowsModule),
  ],
  providers: [ServiceOrderLifecycleService],
  exports: [ServiceOrderLifecycleService],
})
export class ServiceOrderLifecycleModule {}
