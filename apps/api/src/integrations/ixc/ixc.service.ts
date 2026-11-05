import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Optional,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import {
  Prisma,
  ProviderIntegration,
  ServiceOrderStatus,
  Priority,
  ServiceOrderType,
} from '@prisma/client';
import { EventsGateway } from '../../events.gateway';
import { decryptSecret, encryptSecret } from '../../common/secrets.crypto';
import { SlaEngineService } from '../../sla/sla-engine.service';
import { nextOrderProtocol } from '../../service-orders/order-protocol';
import { ServiceOrdersService } from '../../service-orders/service-orders.service';
import { ServiceOrderLifecycleService } from '../../service-orders/service-order-lifecycle.service';
import {
  AWAITING_APPROVAL_MESSAGE,
  ORDER_TRANSITIONS,
  hasCurrentApproval,
  isActiveStatus,
  needsClosingApproval,
  statusDates,
} from '../../service-orders/service-order-rules';

type IxcWebhookInput = {
  tenantId: string;
  eventType: string;
  externalProtocol?: string;
  status?: string;
  title?: string;
  description?: string;
  priority?: 'BAIXA' | 'NORMAL' | 'ALTA' | 'CRITICA';
  type?: ServiceOrderType;
  payload: Record<string, unknown>;
  rawBody?: string;
  signature?: string;
};

type UpsertIntegrationInput = {
  tenantId: string;
  baseUrl: string;
  status?: 'ACTIVE' | 'INACTIVE';
  webhookSecret?: string;
  apiToken?: string;
};

type PublicProviderIntegration = Omit<ProviderIntegration, 'webhookSecretEnc' | 'apiTokenEnc'> & {
  webhookSecretConfigured: boolean;
  apiTokenConfigured: boolean;
};

@Injectable()
export class IxcService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(EventsGateway) private readonly eventsGateway: EventsGateway,
    @Inject(SlaEngineService) private readonly slaEngine: SlaEngineService,
    @Optional()
    @Inject(ServiceOrdersService)
    private readonly serviceOrders?: ServiceOrdersService,
    @Optional()
    @Inject(ServiceOrderLifecycleService)
    private readonly lifecycle?: ServiceOrderLifecycleService,
  ) {}

  async receiveWebhook(input: IxcWebhookInput) {
    await this.assertWebhookSignature(
      input.tenantId,
      input.rawBody || JSON.stringify(input),
      input.signature,
    );

    const payloadHash = createHash('sha256')
      .update(input.rawBody || JSON.stringify(input.payload || {}))
      .digest('hex');
    // Mesmo corpo assinado reenviado em 24 h é ignorado (proteção contra replay, C-045).
    const replay = await this.prisma.syncEvent.findFirst({
      where: {
        tenantId: input.tenantId,
        source: 'WEBHOOK',
        payloadHash,
        receivedAt: { gte: new Date(Date.now() - 24 * 3_600_000) },
      },
      select: { id: true },
    });
    if (replay) return { syncEventId: replay.id, processed: false, duplicate: true };

    const syncEvent = await this.prisma.syncEvent.create({
      data: {
        tenantId: input.tenantId,
        source: 'WEBHOOK',
        eventType: input.eventType,
        payloadHash,
        status: 'RECEIVED',
      },
    });

    try {
      const result = await this.withUniqueRetry(() => this.applyWebhookToOrder(input));

      await this.prisma.syncEvent.update({
        where: { id: syncEvent.id },
        data: {
          status: 'PROCESSED',
          processedAt: new Date(),
        },
      });

      this.eventsGateway.emitTenantEvent(input.tenantId, 'sync.ixc_webhook_processed', {
        tenantId: input.tenantId,
        syncEventId: syncEvent.id,
        eventType: input.eventType,
        orderId: result.orderId,
        at: new Date().toISOString(),
      });

      return {
        syncEventId: syncEvent.id,
        processed: true,
        ...result,
      };
    } catch (error: any) {
      await this.prisma.syncEvent.update({
        where: { id: syncEvent.id },
        data: {
          status: 'FAILED',
          errorMessage: error?.message || 'unknown_error',
          processedAt: new Date(),
        },
      });

      this.eventsGateway.emitTenantEvent(input.tenantId, 'sync.ixc_webhook_failed', {
        tenantId: input.tenantId,
        syncEventId: syncEvent.id,
        eventType: input.eventType,
        error: error?.message || 'unknown_error',
        at: new Date().toISOString(),
      });

      throw error;
    }
  }

  async runManualReconciliation(tenantId: string) {
    const integration = await this.prisma.providerIntegration.findFirst({
      where: {
        tenantId,
        provider: 'IXC',
      },
    });

    const syncEvent = await this.prisma.syncEvent.create({
      data: {
        tenantId,
        integrationId: integration?.id,
        source: 'POLLING',
        eventType: 'IXC_RECONCILIATION_TICK',
        status: 'PROCESSED',
        processedAt: new Date(),
      },
    });

    if (integration) {
      await this.prisma.providerIntegration.update({
        where: { id: integration.id },
        data: { lastSyncAt: new Date() },
      });
    }

    this.eventsGateway.emitTenantEvent(tenantId, 'sync.ixc_reconciliation', {
      tenantId,
      syncEventId: syncEvent.id,
      integrationId: integration?.id || null,
      at: new Date().toISOString(),
    });

    return {
      syncEventId: syncEvent.id,
      integrationId: integration?.id || null,
      processed: true,
    };
  }

  async upsertIntegration(input: UpsertIntegrationInput) {
    const existing = await this.prisma.providerIntegration.findFirst({
      where: { tenantId: input.tenantId, provider: 'IXC' },
    });

    const data = {
      tenantId: input.tenantId,
      provider: 'IXC',
      baseUrl: input.baseUrl,
      status: input.status || existing?.status || 'ACTIVE',
      ...(input.webhookSecret ? { webhookSecretEnc: encryptSecret(input.webhookSecret) } : {}),
      ...(input.apiToken ? { apiTokenEnc: encryptSecret(input.apiToken) } : {}),
    };

    if (existing) {
      const updated = await this.prisma.providerIntegration.update({
        where: { id: existing.id },
        data,
      });
      return this.toPublicIntegration(updated);
    }

    const created = await this.prisma.providerIntegration.create({ data });
    return this.toPublicIntegration(created);
  }

  async applyPollingDelta(tenantId: string, delta: Record<string, unknown>) {
    const integration = await this.prisma.providerIntegration.findFirst({
      where: { tenantId, provider: 'IXC', status: 'ACTIVE' },
    });
    if (!integration) throw new BadRequestException('Integração IXC inativa.');
    const externalProtocol = String(delta.externalProtocol || '').trim();
    if (!externalProtocol) return { applied: false };
    const updatedAt = delta.updatedAt ? new Date(String(delta.updatedAt)) : null;
    if (updatedAt && !Number.isFinite(updatedAt.getTime()))
      throw new BadRequestException('Data externa inválida.');
    const priority =
      Object.values(Priority).find((p) => p === String(delta.priority).toUpperCase()) ??
      Priority.NORMAL;
    const type =
      Object.values(ServiceOrderType).find((t) => t === String(delta.type).toUpperCase()) ??
      ServiceOrderType.AUDITORIA;
    const result = await this.applyWebhookToOrder({
      tenantId,
      externalProtocol,
      eventType: 'POLLING',
      status: typeof delta.status === 'string' ? delta.status : undefined,
      title: typeof delta.title === 'string' ? delta.title : undefined,
      description: typeof delta.description === 'string' ? delta.description : undefined,
      priority,
      type,
      payload: { ...delta, ...(updatedAt ? { ixcUpdatedAt: updatedAt.toISOString() } : {}) },
    });
    return { applied: result.operation !== 'skipped', ...result };
  }

  private async applyWebhookToOrder(input: IxcWebhookInput) {
    const mappedStatus = this.mapIxcStatus(input.status);

    if (!input.externalProtocol && !input.title) {
      throw new BadRequestException(
        'externalProtocol or title must be provided in webhook payload.',
      );
    }

    const existing = input.externalProtocol
      ? await this.prisma.serviceOrder.findFirst({
          where: {
            tenantId: input.tenantId,
            externalProtocol: input.externalProtocol,
            deletedAt: null,
          },
        })
      : null;

    if (existing) {
      const previous = existing.sourceMetadata as Record<string, unknown> | null;
      const incoming = input.payload.ixcUpdatedAt;
      if (
        typeof incoming === 'string' &&
        typeof previous?.ixcUpdatedAt === 'string' &&
        new Date(incoming) <= new Date(previous.ixcUpdatedAt)
      )
        return { orderId: existing.id, operation: 'skipped' as const };
      // O status do IXC passa pelas mesmas regras do ERP (C-045): transição válida, datas,
      // versão, aprovação e efeitos. Fora disso, registra conflito e não mexe no status.
      let target = mappedStatus && mappedStatus !== existing.status ? mappedStatus : null;
      let note = '';
      if (
        input.eventType === 'POLLING' &&
        ['RESOLVIDA', 'FECHADA', 'CANCELADA'].includes(existing.status) &&
        target
      ) {
        note = ' Status externo ignorado: atendimento já concluído.';
        target = null;
      }
      if (target) {
        const forwardClose =
          isActiveStatus(existing.status) && (target === 'RESOLVIDA' || target === 'FECHADA');
        if (!forwardClose && !ORDER_TRANSITIONS[existing.status].includes(target)) {
          note = ` Status ${input.status} ignorado: ${existing.status} → ${target} não é permitido.`;
          target = null;
        } else if (
          target === 'FECHADA' &&
          needsClosingApproval(existing) &&
          !(await hasCurrentApproval(this.prisma, existing))
        ) {
          target = 'RESOLVIDA';
          note = ` ${AWAITING_APPROVAL_MESSAGE}`;
        }
        if (target === existing.status) target = null;
      }
      const changed = await this.prisma.serviceOrder.updateMany({
        where: { id: existing.id, version: existing.version },
        data: {
          ...(typeof incoming === 'string'
            ? { sourceMetadata: { ...previous, ixcUpdatedAt: incoming } as Prisma.InputJsonValue }
            : {}),
          ...(target ? { ...statusDates(existing, target), status: target } : {}),
          title: input.title || existing.title,
          description: input.description || existing.description,
          version: { increment: 1 },
        },
      });
      if (changed.count !== 1)
        throw new ConflictException('O.S. alterada durante a sincronização.');
      await this.prisma.serviceOrderOccurrence.create({
        data: {
          serviceOrderId: existing.id,
          sourceSystem: input.eventType === 'POLLING' ? 'POLLING' : 'WEBHOOK',
          message: `Webhook IXC recebido (${input.eventType})${input.status ? ` status=${input.status}` : ''}.${note}`,
        },
      });
      if (target) {
        await this.prisma.serviceOrderStatusEvent.create({
          data: {
            tenantId: input.tenantId,
            serviceOrderId: existing.id,
            fromStatus: existing.status,
            toStatus: target,
            reason: `IXC ${input.eventType}`,
            metadata: { source: 'ixc-webhook' },
          },
        });
        await this.lifecycle?.afterStatusChange({
          tenantId: input.tenantId,
          orderId: existing.id,
          from: existing.status,
          to: target,
          actorId: null,
          reason: `IXC ${input.eventType}`,
          source: 'integration',
        });
      }
      const updated = await this.prisma.serviceOrder.findUniqueOrThrow({
        where: { id: existing.id },
      });

      this.eventsGateway.emitTenantEvent(input.tenantId, 'service_order.synced', {
        tenantId: input.tenantId,
        orderId: updated.id,
        protocol: updated.protocol,
        externalProtocol: updated.externalProtocol,
        status: updated.status,
        eventType: input.eventType,
        at: new Date().toISOString(),
      });

      return {
        orderId: updated.id,
        operation: 'updated' as const,
        ...(note ? { note: note.trim() } : {}),
      };
    }

    // O.S. nova: atendimento completo (ocorrência + primeira O.S.) pelo fluxo normal.
    if (this.serviceOrders) {
      const customer = await this.customerFor(input);
      const type = input.type || ServiceOrderType.AUDITORIA;
      const provider = customer
        ? customer.tradeName || customer.legalName
        : 'IXC (provedor não identificado)';
      const occurrence = await this.serviceOrders.createOccurrenceWithFirstOrder(null, 'gerente', {
        tenantId: input.tenantId,
        ...(customer ? { customerId: customer.id } : {}),
        provider,
        type,
        sector: 'Atendimento',
        origin: 'IXC',
        openedByName: 'Integração IXC',
        analystResponsible: 'Equipe Ajust',
        description: input.description || `Criada via webhook IXC (${input.eventType}).`,
        sourceSystem: input.eventType === 'POLLING' ? 'POLLING' : 'WEBHOOK',
        firstOrder: {
          type,
          priority: input.priority || Priority.NORMAL,
          title: input.title || `IXC ${input.eventType}`,
          description: input.description || `Criada via webhook IXC (${input.eventType}).`,
          requester: provider,
          origin: 'IXC',
        },
      });
      const first = (occurrence as { serviceOrders?: Array<{ id: string }> }).serviceOrders?.[0];
      if (first && input.externalProtocol)
        await this.prisma.serviceOrder.update({
          where: { id: first.id },
          data: {
            externalProtocol: input.externalProtocol,
            ...(typeof input.payload.ixcUpdatedAt === 'string'
              ? { sourceMetadata: { ixcUpdatedAt: input.payload.ixcUpdatedAt } }
              : {}),
          },
        });
      return { orderId: first?.id, operation: 'created' as const };
    }

    const protocol = await this.buildProtocol(input.tenantId);
    const type = input.type || ServiceOrderType.AUDITORIA;
    const priority = input.priority || Priority.NORMAL;
    const policy = await this.slaEngine.findApplicablePolicy(input.tenantId, priority, type);
    const deadlineAt = await this.slaEngine.calculateTargetDate(
      new Date(),
      policy.hours,
      input.tenantId,
    );

    const created = await this.prisma.serviceOrder.create({
      data: {
        tenantId: input.tenantId,
        protocol,
        externalProtocol: input.externalProtocol || null,
        sourceSystem: input.eventType === 'POLLING' ? 'POLLING' : 'WEBHOOK',
        type,
        priority,
        status: mappedStatus || 'ABERTA',
        title: input.title || `IXC ${input.eventType}`,
        description: input.description || 'Criada via webhook IXC.',
        deadlineAt,
        occurrences: {
          create: {
            sourceSystem: input.eventType === 'POLLING' ? 'POLLING' : 'WEBHOOK',
            message: `OS criada via webhook IXC (${input.eventType}).`,
          },
        },
      },
    });

    this.eventsGateway.emitTenantEvent(input.tenantId, 'service_order.synced', {
      tenantId: input.tenantId,
      orderId: created.id,
      protocol: created.protocol,
      externalProtocol: created.externalProtocol,
      status: created.status,
      eventType: input.eventType,
      at: new Date().toISOString(),
    });

    return { orderId: created.id, operation: 'created' as const };
  }

  /** Provedor do chamado: `payload.customerId` (cadastro da Ajust) ou nome em `payload.provider`. */
  private async customerFor(input: IxcWebhookInput) {
    const id = typeof input.payload?.customerId === 'string' ? input.payload.customerId : null;
    const name = typeof input.payload?.provider === 'string' ? input.payload.provider : null;
    if (!id && !name) return null;
    return this.prisma.customer.findFirst({
      where: {
        tenantId: input.tenantId,
        deletedAt: null,
        ...(id
          ? { id }
          : {
              OR: [
                { tradeName: { equals: name!, mode: 'insensitive' } },
                { legalName: { equals: name!, mode: 'insensitive' } },
              ],
            }),
      },
      select: { id: true, tradeName: true, legalName: true },
    });
  }

  private mapIxcStatus(ixcStatus?: string): ServiceOrderStatus | null {
    if (!ixcStatus) return null;
    const normalized = ixcStatus.trim().toLowerCase();

    if (['aberta', 'open', 'novo'].includes(normalized)) return 'ABERTA';
    if (['em_analise', 'em analise', 'triagem', 'analysis'].includes(normalized))
      return 'EM_ANALISE';
    if (['campo', 'ag_campo', 'ag campo'].includes(normalized)) return 'AG_CAMPO';
    if (['terceiros', 'ag_terceiros', 'ag terceiros'].includes(normalized)) return 'AG_TERCEIROS';
    if (['resolvida', 'resolved'].includes(normalized)) return 'RESOLVIDA';
    if (['fechada', 'closed'].includes(normalized)) return 'FECHADA';
    if (['cancelada', 'cancelled', 'canceled'].includes(normalized)) return 'CANCELADA';

    return null;
  }

  private async assertWebhookSignature(tenantId: string, rawBody: string, signature?: string) {
    const integration = await this.prisma.providerIntegration.findFirst({
      where: {
        tenantId,
        provider: 'IXC',
        tenant: { is: { status: 'ACTIVE', deletedAt: null } },
      },
    });

    if (!integration) {
      throw new BadRequestException('IXC integration is not configured for tenant.');
    }

    const requireSignature =
      (process.env.IXC_WEBHOOK_REQUIRE_SIGNATURE || 'true').toLowerCase() !== 'false';
    if (!requireSignature) return;

    const secret = decryptSecret(integration.webhookSecretEnc);
    if (!secret) {
      throw new BadRequestException('IXC webhook secret is not configured for tenant.');
    }

    if (!signature) {
      throw new ForbiddenException('Missing webhook signature.');
    }

    const incoming = signature.startsWith('sha256=')
      ? signature.slice('sha256='.length)
      : signature;
    const expected = createHmac('sha256', secret).update(rawBody).digest('hex');

    const incomingBuf = Buffer.from(incoming, 'utf8');
    const expectedBuf = Buffer.from(expected, 'utf8');
    if (incomingBuf.length !== expectedBuf.length || !timingSafeEqual(incomingBuf, expectedBuf)) {
      throw new ForbiddenException('Invalid webhook signature.');
    }
  }

  private async buildProtocol(tenantId: string) {
    // Mesmo gerador da API principal (C-067); a contagem antiga colidia com a sequência.
    return nextOrderProtocol(this.prisma, tenantId);
  }

  private toPublicIntegration(integration: ProviderIntegration): PublicProviderIntegration {
    const { webhookSecretEnc, apiTokenEnc, ...publicIntegration } = integration;
    return {
      ...publicIntegration,
      webhookSecretConfigured: Boolean(webhookSecretEnc),
      apiTokenConfigured: Boolean(apiTokenEnc),
    };
  }

  private async withUniqueRetry<T>(operation: () => Promise<T>): Promise<T> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        const known = error as Prisma.PrismaClientKnownRequestError;
        if (known.code !== 'P2002' || attempt === 3) throw error;
      }
    }
    throw lastError;
  }
}
