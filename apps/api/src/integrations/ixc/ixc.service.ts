import { BadRequestException, ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { ServiceOrderStatus } from '@prisma/client';
import { EventsGateway } from '../../events.gateway';
import { decryptSecret, encryptSecret } from '../../common/secrets.crypto';

type IxcWebhookInput = {
  tenantId: string;
  eventType: string;
  externalProtocol?: string;
  status?: string;
  title?: string;
  description?: string;
  priority?: 'BAIXA' | 'NORMAL' | 'ALTA' | 'CRITICA';
  type?:
    | 'ROMPIMENTO'
    | 'LENTIDAO'
    | 'CONFIGURACAO_ONU'
    | 'TROCA_SENHA'
    | 'CANCELAMENTO'
    | 'AUDITORIA'
    | 'INSTALACAO'
    | 'BGP';
  payload: Record<string, unknown>;
  rawBody?: string;
  signature?: string;
};

type UpsertIntegrationInput = {
  tenantId: string;
  baseUrl: string;
  status?: string;
  webhookSecret?: string;
  apiToken?: string;
};

@Injectable()
export class IxcService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(EventsGateway) private readonly eventsGateway: EventsGateway
  ) {}

  async receiveWebhook(input: IxcWebhookInput) {
    await this.assertWebhookSignature(input.tenantId, input.rawBody || JSON.stringify(input), input.signature);

    const payloadHash = createHash('sha256').update(JSON.stringify(input.payload || {})).digest('hex');

    const syncEvent = await this.prisma.syncEvent.create({
      data: {
        tenantId: input.tenantId,
        source: 'WEBHOOK',
        eventType: input.eventType,
        payloadHash,
        status: 'RECEIVED'
      }
    });

    try {
      const result = await this.applyWebhookToOrder(input);

      await this.prisma.syncEvent.update({
        where: { id: syncEvent.id },
        data: {
          status: 'PROCESSED',
          processedAt: new Date()
        }
      });

      this.eventsGateway.emitTenantEvent(input.tenantId, 'sync.ixc_webhook_processed', {
        tenantId: input.tenantId,
        syncEventId: syncEvent.id,
        eventType: input.eventType,
        orderId: result.orderId,
        at: new Date().toISOString()
      });

      return {
        syncEventId: syncEvent.id,
        processed: true,
        ...result
      };
    } catch (error: any) {
      await this.prisma.syncEvent.update({
        where: { id: syncEvent.id },
        data: {
          status: 'FAILED',
          errorMessage: error?.message || 'unknown_error',
          processedAt: new Date()
        }
      });

      this.eventsGateway.emitTenantEvent(input.tenantId, 'sync.ixc_webhook_failed', {
        tenantId: input.tenantId,
        syncEventId: syncEvent.id,
        eventType: input.eventType,
        error: error?.message || 'unknown_error',
        at: new Date().toISOString()
      });

      throw error;
    }
  }

  async runManualReconciliation(tenantId: string) {
    const integration = await this.prisma.providerIntegration.findFirst({
      where: {
        tenantId,
        provider: 'IXC'
      }
    });

    const syncEvent = await this.prisma.syncEvent.create({
      data: {
        tenantId,
        integrationId: integration?.id,
        source: 'POLLING',
        eventType: 'IXC_RECONCILIATION_TICK',
        status: 'PROCESSED',
        processedAt: new Date()
      }
    });

    if (integration) {
      await this.prisma.providerIntegration.update({
        where: { id: integration.id },
        data: { lastSyncAt: new Date() }
      });
    }

    this.eventsGateway.emitTenantEvent(tenantId, 'sync.ixc_reconciliation', {
      tenantId,
      syncEventId: syncEvent.id,
      integrationId: integration?.id || null,
      at: new Date().toISOString()
    });

    return {
      syncEventId: syncEvent.id,
      integrationId: integration?.id || null,
      processed: true
    };
  }

  async upsertIntegration(input: UpsertIntegrationInput) {
    const existing = await this.prisma.providerIntegration.findFirst({
      where: { tenantId: input.tenantId, provider: 'IXC' }
    });

    const data = {
      tenantId: input.tenantId,
      provider: 'IXC',
      baseUrl: input.baseUrl,
      status: input.status || existing?.status || 'ACTIVE',
      ...(input.webhookSecret ? { webhookSecretEnc: encryptSecret(input.webhookSecret) } : {}),
      ...(input.apiToken ? { apiTokenEnc: encryptSecret(input.apiToken) } : {})
    };

    if (existing) {
      return this.prisma.providerIntegration.update({
        where: { id: existing.id },
        data
      });
    }

    return this.prisma.providerIntegration.create({ data });
  }

  private async applyWebhookToOrder(input: IxcWebhookInput) {
    const mappedStatus = this.mapIxcStatus(input.status);

    if (!input.externalProtocol && !input.title) {
      throw new BadRequestException('externalProtocol or title must be provided in webhook payload.');
    }

    const existing = input.externalProtocol
      ? await this.prisma.serviceOrder.findFirst({
          where: {
            tenantId: input.tenantId,
            externalProtocol: input.externalProtocol,
            deletedAt: null
          }
        })
      : null;

    if (existing) {
      const updated = await this.prisma.serviceOrder.update({
        where: { id: existing.id },
        data: {
          status: mappedStatus || existing.status,
          title: input.title || existing.title,
          description: input.description || existing.description,
          occurrences: {
            create: {
              sourceSystem: 'WEBHOOK',
              message: `Webhook IXC recebido (${input.eventType})${input.status ? ` status=${input.status}` : ''}.`
            }
          }
        }
      });

      this.eventsGateway.emitTenantEvent(input.tenantId, 'service_order.synced', {
        tenantId: input.tenantId,
        orderId: updated.id,
        protocol: updated.protocol,
        externalProtocol: updated.externalProtocol,
        status: updated.status,
        eventType: input.eventType,
        at: new Date().toISOString()
      });

      return { orderId: updated.id, operation: 'updated' as const };
    }

    const protocol = await this.buildProtocol(input.tenantId);

    const created = await this.prisma.serviceOrder.create({
      data: {
        tenantId: input.tenantId,
        protocol,
        externalProtocol: input.externalProtocol || null,
        sourceSystem: 'SGP',
        type: input.type || 'AUDITORIA',
        priority: input.priority || 'NORMAL',
        status: mappedStatus || 'ABERTA',
        title: input.title || `IXC ${input.eventType}`,
        description: input.description || 'Criada via webhook IXC.',
        deadlineAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        occurrences: {
          create: {
            sourceSystem: 'WEBHOOK',
            message: `OS criada via webhook IXC (${input.eventType}).`
          }
        }
      }
    });

    this.eventsGateway.emitTenantEvent(input.tenantId, 'service_order.synced', {
      tenantId: input.tenantId,
      orderId: created.id,
      protocol: created.protocol,
      externalProtocol: created.externalProtocol,
      status: created.status,
      eventType: input.eventType,
      at: new Date().toISOString()
    });

    return { orderId: created.id, operation: 'created' as const };
  }

  private mapIxcStatus(ixcStatus?: string): ServiceOrderStatus | null {
    if (!ixcStatus) return null;
    const normalized = ixcStatus.trim().toLowerCase();

    if (['aberta', 'open', 'novo'].includes(normalized)) return 'ABERTA';
    if (['em_analise', 'em analise', 'triagem', 'analysis'].includes(normalized)) return 'EM_ANALISE';
    if (['campo', 'ag_campo', 'ag campo'].includes(normalized)) return 'AG_CAMPO';
    if (['terceiros', 'ag_terceiros', 'ag terceiros'].includes(normalized)) return 'AG_TERCEIROS';
    if (['resolvida', 'resolved'].includes(normalized)) return 'RESOLVIDA';
    if (['fechada', 'closed'].includes(normalized)) return 'FECHADA';
    if (['cancelada', 'cancelled', 'canceled'].includes(normalized)) return 'CANCELADA';

    return null;
  }

  private async assertWebhookSignature(tenantId: string, rawBody: string, signature?: string) {
    const integration = await this.prisma.providerIntegration.findFirst({
      where: { tenantId, provider: 'IXC' }
    });

    if (!integration) {
      throw new BadRequestException('IXC integration is not configured for tenant.');
    }

    const requireSignature = (process.env.IXC_WEBHOOK_REQUIRE_SIGNATURE || 'true').toLowerCase() !== 'false';
    if (!requireSignature) return;

    const secret = decryptSecret(integration.webhookSecretEnc);
    if (!secret) {
      throw new BadRequestException('IXC webhook secret is not configured for tenant.');
    }

    if (!signature) {
      throw new ForbiddenException('Missing webhook signature.');
    }

    const incoming = signature.startsWith('sha256=') ? signature.slice('sha256='.length) : signature;
    const expected = createHmac('sha256', secret).update(rawBody).digest('hex');

    const incomingBuf = Buffer.from(incoming, 'utf8');
    const expectedBuf = Buffer.from(expected, 'utf8');
    if (
      incomingBuf.length !== expectedBuf.length ||
      !timingSafeEqual(incomingBuf, expectedBuf)
    ) {
      throw new ForbiddenException('Invalid webhook signature.');
    }
  }

  private async buildProtocol(tenantId: string) {
    const year = new Date().getFullYear();
    const count = await this.prisma.serviceOrder.count({ where: { tenantId } });
    return `${year}${String(100000 + count + 1).padStart(6, '0')}`;
  }
}
