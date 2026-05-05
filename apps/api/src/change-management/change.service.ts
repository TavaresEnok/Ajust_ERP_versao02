import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ChangeService {
  constructor(private readonly prisma: PrismaService) {}

  async list(tenantId: string): Promise<any[]> {
    return (this.prisma as any).changeRequest.findMany({
      where: { tenantId, deletedAt: null },
      include: {
        requestedBy: { select: { id: true, name: true } },
        approvedBy:  { select: { id: true, name: true } },
        executedBy:  { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(tenantId: string, actorId: string, input: Record<string, any>): Promise<any> {
    const count = await (this.prisma as any).changeRequest.count({ where: { tenantId } });
    const number = `RFC-${String(count + 1).padStart(5, '0')}`;
    return (this.prisma as any).changeRequest.create({
      data: {
        tenantId, number,
        title: input.title,
        description: input.description,
        justification: input.justification,
        rollbackPlan: input.rollbackPlan,
        risk: input.risk ?? 'MEDIO',
        status: 'RASCUNHO',
        plannedStart: input.plannedStart ? new Date(input.plannedStart) : undefined,
        plannedEnd: input.plannedEnd ? new Date(input.plannedEnd) : undefined,
        affectedSystems: input.affectedSystems ?? [],
        tags: input.tags ?? [],
        requestedById: actorId,
      },
    });
  }

  async transition(tenantId: string, id: string, actorId: string, toStatus: string): Promise<any> {
    const rfc = await (this.prisma as any).changeRequest.findFirst({ where: { id, tenantId, deletedAt: null } });
    if (!rfc) throw new NotFoundException('RFC not found.');
    const updates: any = { status: toStatus };
    if (toStatus === 'APROVADO') { updates.approvedById = actorId; updates.approvedAt = new Date(); }
    if (toStatus === 'EM_EXECUCAO') updates.executedById = actorId;
    return (this.prisma as any).changeRequest.update({ where: { id }, data: updates });
  }

  async remove(tenantId: string, id: string): Promise<any> {
    const rfc = await (this.prisma as any).changeRequest.findFirst({ where: { id, tenantId } });
    if (!rfc) throw new NotFoundException('RFC not found.');
    return (this.prisma as any).changeRequest.update({ where: { id }, data: { deletedAt: new Date() } });
  }
}
