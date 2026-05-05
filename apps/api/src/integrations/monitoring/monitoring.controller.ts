import { BadRequestException, Controller, Post, Body, Headers, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EventsGateway } from '../../events.gateway';
import { ServiceOrderType, Priority, SourceSystem } from '@prisma/client';

@Controller('webhooks/monitoring')
export class MonitoringController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventsGateway: EventsGateway,
  ) {}

  @Post('zabbix')
  async handleZabbixWebhook(
    @Headers('authorization') authHeader: string,
    @Headers('x-tenant-slug') tenantSlug: string,
    @Body() payload: any
  ) {
    const expectedToken = process.env.MONITORING_WEBHOOK_TOKEN;
    if (!expectedToken || authHeader !== `Bearer ${expectedToken}`) {
      throw new UnauthorizedException('Invalid token');
    }

    if (!tenantSlug?.trim()) {
      throw new BadRequestException('Missing x-tenant-slug header.');
    }

    const tenant = await this.prisma.tenant.findUnique({
      where: { slug: tenantSlug.trim() }
    });
    if (!tenant) return { status: 'no tenant' };

    const title = payload.eventName || 'Alerta de Monitoramento';
    const desc = payload.host ? `Host: ${payload.host} reportou um problema. Detalhes: ${JSON.stringify(payload)}` : JSON.stringify(payload);
    
    let priority: Priority = Priority.ALTA;
    if (payload.severity === 'Disaster' || payload.severity === 'High') priority = Priority.CRITICA;

    
    const occurrence = await this.prisma.occurrence.create({
      data: {
        tenantId: tenant.id,
        number: 'ZBX' + Date.now().toString().substring(5),
        provider: 'NOC / ZABBIX',
        type: 'ROMPIMENTO/INCIDENTE GLOBAL',
        status: 'ABERTA',
        sector: 'NOC N3',
        origin: 'Monitoramento Zabbix',
        openedByName: 'Sistema Zabbix',
        analystResponsible: 'Zabbix Automacao',
        description: `INCIDENTE DETECTADO AUTOMATICAMENTE:\n${desc}`,
      }
    });

    const order = await this.prisma.serviceOrder.create({

      data: {
        tenantId: tenant.id,
        protocol: 'MNT' + Date.now().toString(),
        sourceSystem: SourceSystem.ERP, // Use ERP as origin since ZABBIX isn't in enum
        type: ServiceOrderType.ROMPIMENTO,
        occurrenceId: occurrence.id,
        priority,
        status: 'ABERTA',
        title: `[ALERTA ZABBIX] ${title}`,
        description: desc,
        sector: 'NOC N3',
        deadlineAt: new Date(Date.now() + 4 * 3600000),
        origin: 'Monitoramento',
      }
    });

    this.eventsGateway.emitTenantEvent(tenant.id, 'order_created', { orderId: order.id, source: 'ZABBIX' });
    
    return { success: true, orderId: order.id };
  }
}
