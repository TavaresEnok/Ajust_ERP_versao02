import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class OnCallService {
  constructor(private readonly prisma: PrismaService) {}

  async list(tenantId: string, from?: string, to?: string) {
    const where: any = { tenantId };
    if (from) where.startsAt = { gte: new Date(from) };
    if (to) { where.endsAt = { lte: new Date(to) }; }
    return (this.prisma as any).onCallSchedule.findMany({
      where,
      include: { user: { select: { id: true, name: true } } },
      orderBy: { startsAt: 'asc' },
    });
  }

  async currentOnCall(tenantId: string) {
    const now = new Date();
    return (this.prisma as any).onCallSchedule.findFirst({
      where: { tenantId, startsAt: { lte: now }, endsAt: { gte: now } },
      include: { user: { select: { id: true, name: true } } },
      orderBy: { startsAt: 'desc' },
    });
  }

  async create(tenantId: string, input: { userId: string; startsAt: string; endsAt: string; notes?: string }) {
    return (this.prisma as any).onCallSchedule.create({
      data: { tenantId, userId: input.userId, startsAt: new Date(input.startsAt), endsAt: new Date(input.endsAt), notes: input.notes },
      include: { user: { select: { id: true, name: true } } },
    });
  }

  async remove(tenantId: string, id: string) {
    const entry = await (this.prisma as any).onCallSchedule.findFirst({ where: { id, tenantId } });
    if (!entry) throw new NotFoundException('Schedule not found.');
    await (this.prisma as any).onCallSchedule.delete({ where: { id } });
    return { success: true };
  }
}
