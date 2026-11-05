import {
  BadRequestException,
  Controller,
  Post,
  Body,
  Headers,
  UnauthorizedException,
  Inject,
  HttpException,
  HttpStatus,
  Optional,
} from '@nestjs/common';
import { z } from 'zod';
import { PrismaService } from '../../prisma/prisma.service';
import { ServiceOrderType, Priority } from '@prisma/client';
import { timingSafeEqual } from 'node:crypto';
import { ServiceOrdersService } from '../../service-orders/service-orders.service';
import { ApiKeysService } from '../../api-keys/api-keys.service';
import { RedisService } from '../../common/redis.service';

const ZabbixPayloadSchema = z
  .object({
    eventName: z.string().min(1).max(200).optional(),
    host: z.string().min(1).max(200).optional(),
    severity: z
      .enum(['Not classified', 'Information', 'Warning', 'Average', 'High', 'Disaster'])
      .optional(),
    // Identidade do problema no Zabbix ({EVENT.ID} / {TRIGGER.ID}) e situação ({EVENT.STATUS}).
    eventId: z.union([z.string(), z.number()]).optional(),
    triggerId: z.union([z.string(), z.number()]).optional(),
    status: z.string().max(40).optional(),
  })
  .passthrough();

const RECOVERY = new Set(['ok', 'resolved', 'recovery', 'resolvido']);

/**
 * Alertas do Zabbix (auditoria C-044): um problema = uma ocorrência (deduplicada pelo id do
 * evento ou do trigger), a recuperação resolve a O.S. aberta e a abertura usa o fluxo normal.
 */
@Controller('webhooks/monitoring')
export class MonitoringController {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ServiceOrdersService) private readonly serviceOrders: ServiceOrdersService,
    @Optional() @Inject(ApiKeysService) private readonly apiKeys?: ApiKeysService,
    @Optional() @Inject(RedisService) private readonly redis?: RedisService,
  ) {}

  @Post('zabbix')
  async handleZabbixWebhook(
    @Headers('authorization') authHeader: string,
    @Headers('x-tenant-slug') tenantSlug: string,
    @Body() rawPayload: unknown,
  ) {
    // Autenticação por tenant (C-044): uma chave de API do próprio tenant (Configurações >
    // Chaves de API) define a empresa sozinha. O token global legado continua aceito, mas
    // aí o tenant vem do cabeçalho x-tenant-slug.
    const rawKey = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    const apiKey = rawKey.startsWith('ajust_') ? await this.apiKeys?.validateKey(rawKey) : null;
    const expectedToken = process.env.MONITORING_WEBHOOK_TOKEN;
    const globalToken = !!expectedToken && this.matchesToken(authHeader, `Bearer ${expectedToken}`);
    if (!apiKey && !globalToken) throw new UnauthorizedException('Invalid token');
    if (!apiKey && !tenantSlug?.trim()) {
      throw new BadRequestException('Missing x-tenant-slug header.');
    }

    const payload = ZabbixPayloadSchema.parse(rawPayload);
    const tenant = await this.prisma.tenant.findFirst({
      where: {
        ...(apiKey ? { id: apiKey.tenantId } : { slug: tenantSlug.trim() }),
        status: 'ACTIVE',
        deletedAt: null,
      },
    });
    if (!tenant) return { status: 'no tenant' };
    await this.assertWithinRate(tenant.id);

    const problemKey = String(payload.eventId ?? payload.triggerId ?? '').trim();
    const externalId = problemKey ? `zabbix:${problemKey}` : null;
    const existing = externalId
      ? await this.prisma.occurrence.findUnique({
          where: {
            tenantId_sourceSystem_externalId: {
              tenantId: tenant.id,
              sourceSystem: 'WEBHOOK',
              externalId,
            },
          },
          select: { id: true, number: true, status: true },
        })
      : null;

    if (payload.status && RECOVERY.has(payload.status.trim().toLowerCase())) {
      if (!existing) return { status: 'recovery_without_problem' };
      const resolved = await this.serviceOrders.resolveFromIntegration(
        tenant.id,
        existing.id,
        `Zabbix informou recuperação${payload.host ? ` em ${payload.host}` : ''}.`,
      );
      return { status: 'resolved', occurrenceId: existing.id, resolved };
    }
    // Mesmo problema chegando de novo (repetição do Zabbix): não abre outro chamado.
    if (existing && existing.status !== 'ENCERRADA')
      return { status: 'duplicate', occurrenceId: existing.id };

    // Problema que volta depois de encerrado: a chave passa para a nova ocorrência e a antiga
    // fica com uma chave arquivada, para a deduplicação continuar valendo (C-044).
    if (existing && externalId)
      await this.prisma.occurrence.update({
        where: { id: existing.id },
        data: { externalId: `${externalId}#encerrada-${Date.now()}` },
      });

    const title = payload.eventName || 'Alerta de Monitoramento';
    const desc = payload.host
      ? `Host ${payload.host} reportou um problema: ${title}. Severidade: ${payload.severity || 'não informada'}.`
      : `Alerta do Zabbix: ${title}.`;
    const priority: Priority =
      payload.severity === 'Disaster' || payload.severity === 'High'
        ? Priority.CRITICA
        : Priority.ALTA;
    const customer = payload.host ? await this.customerForHost(tenant.id, payload.host) : null;
    const provider = customer ? customer.tradeName || customer.legalName : 'NOC / ZABBIX';

    const occurrence = await this.serviceOrders.createOccurrenceWithFirstOrder(null, 'gerente', {
      tenantId: tenant.id,
      ...(customer ? { customerId: customer.id } : {}),
      provider,
      type: 'ROMPIMENTO/INCIDENTE',
      sector: 'NOC N3',
      origin: 'Monitoramento Zabbix',
      openedByName: 'Sistema Zabbix',
      analystResponsible: 'Equipe Ajust',
      description: `INCIDENTE DETECTADO AUTOMATICAMENTE: ${desc}`,
      sourceSystem: 'WEBHOOK',
      ...(externalId ? { externalId } : {}),
      sourceMetadata: { zabbix: payload } as never,
      firstOrder: {
        type: ServiceOrderType.ROMPIMENTO,
        priority,
        title: `[ALERTA ZABBIX] ${title}`,
        description: desc,
        requester: provider,
        sector: 'NOC N3',
        origin: 'Monitoramento',
      },
    });
    return { success: true, occurrenceId: occurrence.id, provider };
  }

  /** Até 120 alertas por minuto por tenant: uma tempestade do Zabbix não derruba a API (C-044). */
  private async assertWithinRate(tenantId: string) {
    if (!this.redis) return;
    const limit = Number(process.env.MONITORING_WEBHOOK_PER_MINUTE || 120);
    const count = await this.redis.incrEx(`rate-limit:monitoring:${tenantId}`, 60);
    if (count > limit)
      throw new HttpException(
        'Limite de alertas por minuto atingido para esta empresa.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
  }

  /** Host do alerta → provedor, pelo host cadastrado no cofre (credenciais do equipamento). */
  private async customerForHost(tenantId: string, host: string) {
    const credential = await this.prisma.knowledgeCredential.findFirst({
      where: { tenantId, host: { equals: host, mode: 'insensitive' } },
      select: { provider: true },
    });
    if (!credential?.provider) return null;
    return this.prisma.customer.findFirst({
      where: {
        tenantId,
        deletedAt: null,
        OR: [
          { tradeName: { equals: credential.provider, mode: 'insensitive' } },
          { legalName: { equals: credential.provider, mode: 'insensitive' } },
        ],
      },
      select: { id: true, tradeName: true, legalName: true },
    });
  }

  private matchesToken(received: string, expected: string): boolean {
    if (!received) return false;
    const left = Buffer.from(received, 'utf8');
    const right = Buffer.from(expected, 'utf8');
    return left.length === right.length && timingSafeEqual(left, right);
  }
}
