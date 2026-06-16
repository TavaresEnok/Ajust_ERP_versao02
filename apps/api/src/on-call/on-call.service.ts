import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class OnCallService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async list(tenantId: string, from?: string, to?: string) {
    const where: Prisma.OnCallScheduleWhereInput = { tenantId };
    if (to) where.startsAt = { lte: new Date(to) };
    if (from) where.endsAt = { gte: new Date(from) };
    return this.prisma.onCallSchedule.findMany({
      where,
      include: { user: { select: { id: true, name: true } } },
      orderBy: { startsAt: 'asc' },
    });
  }

  async currentOnCall(tenantId: string) {
    const now = new Date();
    return this.prisma.onCallSchedule.findFirst({
      where: { tenantId, startsAt: { lte: now }, endsAt: { gte: now } },
      include: { user: { select: { id: true, name: true } } },
      orderBy: { startsAt: 'desc' },
    });
  }

  async create(
    tenantId: string,
    input: { userId: string; startsAt: string; endsAt: string; notes?: string },
  ) {
    const startsAt = new Date(input.startsAt);
    const endsAt = new Date(input.endsAt);
    if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime()) || endsAt <= startsAt) {
      throw new BadRequestException('Plantão deve ter datas válidas e término após o início.');
    }

    const membership = await this.prisma.userTenant.findFirst({
      where: {
        userId: input.userId,
        tenantId,
        user: { status: 'ACTIVE', deletedAt: null },
      },
      select: { userId: true },
    });
    if (!membership) throw new NotFoundException('Active user is not a member of this tenant.');

    return this.prisma.onCallSchedule.create({
      data: {
        tenantId,
        userId: input.userId,
        startsAt,
        endsAt,
        notes: input.notes,
      },
      include: { user: { select: { id: true, name: true } } },
    });
  }

  async remove(tenantId: string, id: string) {
    const entry = await this.prisma.onCallSchedule.findFirst({ where: { id, tenantId } });
    if (!entry) throw new NotFoundException('Schedule not found.');
    await this.prisma.onCallSchedule.delete({ where: { id } });
    return { success: true };
  }
}
