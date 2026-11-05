import {
  Body,
  Controller,
  Headers,
  HttpCode,
  Inject,
  NotFoundException,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { PrismaService } from '../prisma/prisma.service';
import { WorkflowsService } from './workflows.service';

const SlaBreachSchema = z.object({
  tenantId: z.string().uuid(),
  orderId: z.string().uuid(),
});

/**
 * Entrada interna para o worker publicar eventos que só ele detecta (auditoria C-036).
 * Não passa pelo BFF; exige `WORKER_API_TOKEN`.
 */
@Controller('workflows/internal')
export class WorkflowsInternalController {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(WorkflowsService) private readonly workflows: WorkflowsService,
  ) {}

  @Post('sla-breach')
  @HttpCode(202)
  async slaBreach(@Headers('authorization') auth: string | undefined, @Body() body: unknown) {
    const expected = process.env.WORKER_API_TOKEN;
    const left = Buffer.from(auth || '', 'utf8');
    const right = Buffer.from(`Bearer ${expected || ''}`, 'utf8');
    if (!expected || left.length !== right.length || !timingSafeEqual(left, right))
      throw new UnauthorizedException('Token do worker inválido.');
    const input = SlaBreachSchema.parse(body);
    const order = await this.prisma.serviceOrder.findFirst({
      where: { id: input.orderId, tenantId: input.tenantId, deletedAt: null },
    });
    if (!order) throw new NotFoundException('O.S. não encontrada.');
    const triggered = await this.workflows.executeForEvent(input.tenantId, {
      type: 'sla_breach',
      order: {
        id: order.id,
        protocol: order.protocol,
        title: order.title,
        type: order.type,
        priority: order.priority,
        status: order.status,
        requester: order.requester,
        sector: order.sector,
        analystName: order.analystName,
        deadlineAt: order.deadlineAt.toISOString(),
      },
    });
    return { triggered };
  }
}
