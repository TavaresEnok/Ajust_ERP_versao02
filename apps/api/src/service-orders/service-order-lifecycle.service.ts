import {
  Inject,
  Injectable,
  Logger,
  Module,
  OnModuleInit,
  Optional,
  forwardRef,
} from '@nestjs/common';
import type {
  AuditAction,
  ServiceOrder,
  ServiceOrderStatus,
  ServiceOrderLifecycleEvent,
} from '@prisma/client';
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
import { LifecycleOutboxService, EffectRunner } from './lifecycle-outbox.service';

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
 * O outbox nasce na transação do banco. Cada efeito concluído é registrado e falhas são retentadas.
 */
@Injectable()
export class ServiceOrderLifecycleService implements OnModuleInit {
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
    @Optional() @Inject(LifecycleOutboxService) private readonly outbox?: LifecycleOutboxService,
  ) {}

  onModuleInit() {
    this.outbox?.start((event, effect) => this.deliverStoredEvent(event, effect));
  }

  private async deliverStoredEvent(event: ServiceOrderLifecycleEvent, effect: EffectRunner) {
    const payload = event.payload as unknown as { order: ServiceOrder; change?: StatusChange };
    const order = { ...payload.order, deadlineAt: new Date(payload.order.deadlineAt) };
    const current = await this.prisma.serviceOrder.findUnique({
      where: { id: order.id },
      select: { processInstanceId: true },
    });
    const instanceId = order.processInstanceId ?? current?.processInstanceId;
    if (instanceId) {
      const instance = await this.prisma.serviceProcessInstance.findUnique({
        where: { id: instanceId },
      });
      if ((instance?.state as Record<string, unknown> | null)?.mode === 'DEMO') return;
    }
    if (event.kind === 'created') {
      const firstNote = await this.prisma.serviceOrderOccurrence.findFirst({
        where: { serviceOrderId: order.id },
        orderBy: { createdAt: 'asc' },
        select: { actorUserId: true },
      });
      await this.applyOrderCreated(order, firstNote?.actorUserId ?? null, {}, effect, event.id);
    } else if (payload.change) {
      await this.applyStatusChange(payload.change, effect, order, event.id);
    } else throw new Error('Invalid lifecycle event payload.');
  }

  private async deliverForOrder(orderId: string) {
    try {
      await this.outbox!.deliver(orderId);
    } catch (error) {
      // The transaction already persisted the event; the background poller will retry it.
      this.logger.warn(`Efeitos da O.S. ${orderId} pendentes: ${(error as Error).message}`);
    }
  }

  async afterStatusChange(change: StatusChange) {
    if (this.outbox) {
      void this.deliverForOrder(change.orderId);
      return;
    }
    return this.applyStatusChange(change, (name, run) => this.safe(name, run));
  }

  private async applyStatusChange(
    change: StatusChange,
    effect: EffectRunner,
    snapshot?: ServiceOrder,
    eventId?: string,
  ) {
    const { tenantId, orderId, from, to } = change;
    const order =
      snapshot ?? (await this.prisma.serviceOrder.findFirst({ where: { id: orderId, tenantId } }));
    if (!order) return;
    const action: AuditAction =
      to === 'FECHADA'
        ? 'OS_CLOSE'
        : to === 'CANCELADA'
          ? 'OS_CANCEL'
          : isReopen(from, to)
            ? 'OS_REOPEN'
            : 'OS_UPDATE';

    await effect('auditoria', () =>
      this.writeAudit(eventId, {
        tenantId,
        actorUserId: change.actorId,
        action,
        resourceType: 'service_order',
        resourceId: orderId,
        metadata: { from, to, reason: change.reason ?? null, source: change.source },
      }),
    );

    await effect('tempo real', async () =>
      this.events.emitTenantEvent(tenantId, 'service_order.transitioned', {
        eventId,
        tenantId,
        orderId,
        protocol: order.protocol,
        from,
        to,
        byUserId: change.actorId,
        at: new Date().toISOString(),
      }),
    );

    if (order.processInstanceId && (to === 'FECHADA' || to === 'CANCELADA'))
      await effect('conclusão do processo', () =>
        this.completeProcessIfDone(tenantId, order.processInstanceId!),
      );

    if (change.syncOccurrence !== false)
      await effect('sincronização da ocorrência', () =>
        syncOccurrenceStatus(this.prisma, tenantId, order.occurrenceId),
      );

    // A pesquisa só sai no fechamento efetivo: RESOLVIDA ainda pode voltar (C-032).
    if (to === 'FECHADA' && this.csat)
      await effect('CSAT', () => this.csat!.createForOrder(tenantId, orderId, !!eventId));

    // Aviso próprio de fechamento (não o de escalonamento) e só no fechamento efetivo (C-033).
    if (to === 'FECHADA' && this.notifications)
      await effect('aviso de fechamento', () =>
        this.notifications!.notifyOrderClosed(
          tenantId,
          orderId,
          eventId ? { eventId, effect } : undefined,
        ),
      );

    if (change.workflows !== false && this.workflows)
      await effect('workflow', () =>
        this.workflows!.executeForEvent(
          tenantId,
          {
            type: to === 'FECHADA' ? 'order_closed' : 'order_updated',
            order: this.workflowPayload(order),
          },
          { eventKey: eventId, throwOnFailure: !!eventId },
        ),
      );
  }

  /** Efeitos de "O.S. criada", iguais para todos os caminhos de abertura (C-010). */
  async afterOrderCreated(
    order: ServiceOrder,
    actorId: string | null,
    extra: Record<string, unknown> = {},
  ) {
    if (this.outbox) {
      void this.deliverForOrder(order.id);
      return;
    }
    return this.applyOrderCreated(order, actorId, extra, (name, run) => this.safe(name, run));
  }

  private async applyOrderCreated(
    order: ServiceOrder,
    actorId: string | null,
    extra: Record<string, unknown>,
    effect: EffectRunner,
    eventId?: string,
  ) {
    await effect('auditoria', () =>
      this.writeAudit(eventId, {
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
    await effect('tempo real', async () => {
      this.events.emitTenantEvent(order.tenantId, 'service_order.created', { ...payload, eventId });
      this.events.emitTenantEvent(order.tenantId, 'service_order_created', {
        orderId: order.id,
        protocol: order.protocol,
        eventId,
      });
    });
    if (this.workflows)
      await effect('workflow', () =>
        this.workflows!.executeForEvent(
          order.tenantId,
          {
            type: 'order_created',
            order: this.workflowPayload(order),
          },
          { eventKey: eventId, throwOnFailure: !!eventId },
        ),
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
      approvalCompleted: order.approvalCompleted,
      changeRequestId: order.changeRequestId,
      deadlineAt: order.deadlineAt?.toISOString(),
    };
  }

  private writeAudit(
    eventId: string | undefined,
    data: Parameters<PrismaService['auditLog']['create']>[0]['data'],
  ) {
    if (!eventId) return this.prisma.auditLog.create({ data });
    return this.prisma.auditLog.upsert({
      where: { id: eventId },
      create: { ...data, id: eventId },
      update: {},
    });
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
  providers: [LifecycleOutboxService, ServiceOrderLifecycleService],
  exports: [ServiceOrderLifecycleService],
})
export class ServiceOrderLifecycleModule {}
