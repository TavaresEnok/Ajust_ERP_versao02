import {
  BadRequestException,
  Controller,
  Post,
  Body,
  Headers,
  UnauthorizedException,
  Inject,
} from '@nestjs/common';
import { ServiceOrdersService } from '../service-orders/service-orders.service';
import { Priority, ServiceOrderType } from '@prisma/client';
import { z } from 'zod';
import { timingSafeEqual } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { ApiKeysService } from '../api-keys/api-keys.service';

const ChatWebhookSchema = z.object({
  tenantId: z.string().uuid().optional(),
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().min(1).max(20_000),
  requester: z.string().trim().min(1).max(200),
  priority: z.nativeEnum(Priority).optional(),
  type: z.nativeEnum(ServiceOrderType).optional(),
});

@Controller('webhooks/chat')
export class WebhookController {
  constructor(
    @Inject(ServiceOrdersService) private readonly serviceOrders: ServiceOrdersService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ApiKeysService) private readonly apiKeys: ApiKeysService,
  ) {}

  @Post('incoming')
  async handleIncomingChat(@Headers('authorization') auth: string, @Body() body: unknown) {
    const payload = ChatWebhookSchema.parse(body);
    const tenantId = await this.resolveTenantId(auth, payload.tenantId);
    const tenant = await this.prisma.tenant.findFirst({
      where: { id: tenantId, status: 'ACTIVE', deletedAt: null },
      select: { id: true },
    });
    if (!tenant) {
      throw new BadRequestException('Tenant is unavailable.');
    }

    return this.serviceOrders.create(null, 'gerente', {
      tenantId,
      title: payload.title,
      description: payload.description,
      priority: payload.priority || 'NORMAL',
      type: payload.type || 'AUDITORIA',
      requester: payload.requester,
      origin: 'CHAT_BOT',
    });
  }

  private async resolveTenantId(auth: string, requestedTenantId?: string): Promise<string> {
    const webhookToken = process.env.CHAT_WEBHOOK_TOKEN;
    if (webhookToken && this.matchesToken(auth, `Bearer ${webhookToken}`)) {
      if (!requestedTenantId) {
        throw new BadRequestException('tenantId is required for the global integration token.');
      }
      return requestedTenantId;
    }

    const rawApiKey = auth?.startsWith('Bearer ') ? auth.slice('Bearer '.length).trim() : '';
    const apiKey = rawApiKey ? await this.apiKeys.validateKey(rawApiKey) : null;
    if (!apiKey || (requestedTenantId && requestedTenantId !== apiKey.tenantId)) {
      throw new UnauthorizedException('Invalid integration token');
    }
    return apiKey.tenantId;
  }

  private matchesToken(received: string, expected: string): boolean {
    if (!received) return false;
    const left = Buffer.from(received, 'utf8');
    const right = Buffer.from(expected, 'utf8');
    if (left.length !== right.length) return false;
    return timingSafeEqual(left, right);
  }
}
