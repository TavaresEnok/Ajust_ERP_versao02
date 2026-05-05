import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Priority, ServiceOrderType } from '@prisma/client';

@Injectable()
export class SlaPoliciesService {
  constructor(private prisma: PrismaService) {}

  async list(tenantId: string) {
    return this.prisma.slaPolicy.findMany({
      where: { tenantId },
      orderBy: { priority: 'asc' },
    });
  }

  async create(tenantId: string, input: { priority: Priority; serviceOrderType?: ServiceOrderType; hours: number; isOverride?: boolean; active?: boolean }) {
    return this.prisma.slaPolicy.create({
      data: {
        tenantId,
        priority: input.priority,
        serviceOrderType: input.serviceOrderType,
        hours: input.hours,
        isOverride: input.isOverride ?? false,
        active: input.active ?? true,
      },
    });
  }

  async update(tenantId: string, id: string, input: { hours?: number; active?: boolean }) {
    const policy = await this.prisma.slaPolicy.findFirst({ where: { id, tenantId } });
    if (!policy) throw new NotFoundException('Policy not found');
    return this.prisma.slaPolicy.update({
      where: { id },
      data: { hours: input.hours, active: input.active },
    });
  }

  async remove(tenantId: string, id: string) {
    await this.prisma.slaPolicy.deleteMany({ where: { id, tenantId } });
    return { success: true };
  }
}
