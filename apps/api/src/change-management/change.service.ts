import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ChangeRequest, ChangeRisk, ChangeStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export type CreateChangeInput = {
  title: string;
  description: string;
  justification: string;
  rollbackPlan?: string | null;
  risk?: ChangeRisk;
  plannedStart?: string;
  plannedEnd?: string;
  affectedSystems?: string[];
  tags?: string[];
};

@Injectable()
export class ChangeService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async list(tenantId: string): Promise<ChangeRequest[]> {
    return this.prisma.changeRequest.findMany({
      where: { tenantId, deletedAt: null },
      include: {
        requestedBy: { select: { id: true, name: true } },
        approvedBy: { select: { id: true, name: true } },
        executedBy: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(
    tenantId: string,
    actorId: string,
    input: CreateChangeInput,
  ): Promise<ChangeRequest> {
    const plannedStart = this.parseOptionalDate(input.plannedStart, 'plannedStart');
    const plannedEnd = this.parseOptionalDate(input.plannedEnd, 'plannedEnd');
    if (plannedStart && plannedEnd && plannedEnd <= plannedStart) {
      throw new BadRequestException('plannedEnd must be after plannedStart.');
    }

    for (let attempt = 1; attempt <= 3; attempt++) {
      const count = await this.prisma.changeRequest.count({ where: { tenantId } });
      const number = `RFC-${String(count + 1).padStart(5, '0')}`;
      try {
        return await this.prisma.changeRequest.create({
          data: {
            tenantId,
            number,
            title: input.title,
            description: input.description,
            justification: input.justification,
            rollbackPlan: input.rollbackPlan,
            risk: input.risk ?? 'MEDIO',
            status: 'RASCUNHO',
            plannedStart,
            plannedEnd,
            affectedSystems: input.affectedSystems ?? [],
            tags: input.tags ?? [],
            requestedById: actorId,
          },
        });
      } catch (error) {
        const known = error as Prisma.PrismaClientKnownRequestError;
        if (known.code !== 'P2002' || attempt === 3) throw error;
      }
    }
    throw new BadRequestException('Could not allocate RFC number.');
  }

  async transition(
    tenantId: string,
    id: string,
    actorId: string,
    toStatus: ChangeStatus,
  ): Promise<ChangeRequest> {
    const rfc = await this.prisma.changeRequest.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    if (!rfc) throw new NotFoundException('RFC not found.');
    if (rfc.status === toStatus) throw new BadRequestException('RFC already has requested status.');

    const transitions: Record<ChangeStatus, ChangeStatus[]> = {
      RASCUNHO: ['AGUARDANDO_APROVACAO', 'CANCELADO'],
      AGUARDANDO_APROVACAO: ['APROVADO', 'REJEITADO', 'CANCELADO'],
      APROVADO: ['EM_EXECUCAO', 'CANCELADO'],
      EM_EXECUCAO: ['CONCLUIDO', 'CANCELADO'],
      CONCLUIDO: [],
      CANCELADO: [],
      REJEITADO: [],
    };
    if (!transitions[rfc.status].includes(toStatus)) {
      throw new BadRequestException(`Transition ${rfc.status} -> ${toStatus} is not allowed.`);
    }

    const updates: Prisma.ChangeRequestUncheckedUpdateInput = { status: toStatus };
    if (toStatus === 'APROVADO') {
      updates.approvedById = actorId;
      updates.approvedAt = new Date();
    }
    if (toStatus === 'EM_EXECUCAO') updates.executedById = actorId;
    return this.prisma.changeRequest.update({ where: { id }, data: updates });
  }

  async remove(tenantId: string, id: string): Promise<ChangeRequest> {
    const rfc = await this.prisma.changeRequest.findFirst({ where: { id, tenantId } });
    if (!rfc) throw new NotFoundException('RFC not found.');
    return this.prisma.changeRequest.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  private parseOptionalDate(value: string | undefined, field: string): Date | undefined {
    if (!value) return undefined;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException(`${field} must be a valid date.`);
    }
    return parsed;
  }
}
