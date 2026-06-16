import {
  BadRequestException,
  Controller,
  Post,
  Body,
  Headers,
  UnauthorizedException,
  Inject,
} from '@nestjs/common';
import { z } from 'zod';
import { PrismaService } from '../../prisma/prisma.service';
import { EventsGateway } from '../../events.gateway';
import { ServiceOrderType, Priority, SourceSystem } from '@prisma/client';
import { randomUUID, timingSafeEqual } from 'node:crypto';
import { SlaEngineService } from '../../sla/sla-engine.service';

const ZabbixPayloadSchema = z
  .object({
    eventName: z.string().min(1).max(200).optional(),
    host: z.string().min(1).max(200).optional(),
    severity: z
      .enum(['Not classified', 'Information', 'Warning', 'Average', 'High', 'Disaster'])
      .optional(),
  })
  .passthrough();

@Controller('webhooks/monitoring')
export class MonitoringController {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(EventsGateway) private readonly eventsGateway: EventsGateway,
    @Inject(SlaEngineService) private readonly slaEngine: SlaEngineService,
  ) {}

  @Post('zabbix')
  async handleZabbixWebhook(
    @Headers('authorization') authHeader: string,
    @Headers('x-tenant-slug') tenantSlug: string,
    @Body() rawPayload: unknown,
  ) {
    const expectedToken = process.env.MONITORING_WEBHOOK_TOKEN;
    if (!expectedToken || !this.matchesToken(authHeader, `Bearer ${expectedToken}`)) {
      throw new UnauthorizedException('Invalid token');
    }

    if (!tenantSlug?.trim()) {
      throw new BadRequestException('Missing x-tenant-slug header.');
    }

    const payload = ZabbixPayloadSchema.parse(rawPayload);

    const tenant = await this.prisma.tenant.findFirst({
      where: { slug: tenantSlug.trim(), status: 'ACTIVE', deletedAt: null },
    });
    if (!tenant) return { status: 'no tenant' };

    const title = payload.eventName || 'Alerta de Monitoramento';
    const desc = payload.host
      ? `Host: ${payload.host} reportou um problema. Detalhes: ${JSON.stringify(payload)}`
      : JSON.stringify(payload);

    let priority: Priority = Priority.ALTA;
    if (payload.severity === 'Disaster' || payload.severity === 'High') priority = Priority.CRITICA;

    const suffix = `${Date.now()}-${randomUUID().slice(0, 8)}`;
    const policy = await this.slaEngine.findApplicablePolicy(
      tenant.id,
      priority,
      ServiceOrderType.ROMPIMENTO,
    );
    const deadlineAt = await this.slaEngine.calculateTargetDate(
      new Date(),
      policy.hours,
      tenant.id,
    );

    const order = await this.prisma.$transaction(async (tx) => {
      const occurrence = await tx.occurrence.create({
        data: {
          tenantId: tenant.id,
          number: `ZBX-${suffix}`,
          provider: 'NOC / ZABBIX',
          type: 'ROMPIMENTO/INCIDENTE GLOBAL',
          status: 'ABERTA',
          sector: 'NOC N3',
          origin: 'Monitoramento Zabbix',
          openedByName: 'Sistema Zabbix',
          analystResponsible: 'Zabbix Automacao',
          description: `INCIDENTE DETECTADO AUTOMATICAMENTE:\n${desc}`,
        },
      });

      return tx.serviceOrder.create({
        data: {
          tenantId: tenant.id,
          protocol: `MNT-${suffix}`,
          sourceSystem: SourceSystem.ERP,
          type: ServiceOrderType.ROMPIMENTO,
          occurrenceId: occurrence.id,
          priority,
          status: 'ABERTA',
          title: `[ALERTA ZABBIX] ${title}`,
          description: desc,
          sector: 'NOC N3',
          deadlineAt,
          origin: 'Monitoramento',
        },
      });
    });

    this.eventsGateway.emitTenantEvent(tenant.id, 'order_created', {
      orderId: order.id,
      source: 'ZABBIX',
    });

    return { success: true, orderId: order.id };
  }

  private matchesToken(received: string, expected: string): boolean {
    if (!received) return false;
    const left = Buffer.from(received, 'utf8');
    const right = Buffer.from(expected, 'utf8');
    return left.length === right.length && timingSafeEqual(left, right);
  }
}
