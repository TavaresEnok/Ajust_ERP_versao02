import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Priority, ServiceOrderType } from '@prisma/client';

@Injectable()
export class SlaPoliciesService {
  constructor(@Inject(PrismaService) private prisma: PrismaService) {}

  async list(tenantId: string) {
    return this.prisma.slaPolicy.findMany({
      where: { tenantId },
      orderBy: { priority: 'asc' },
    });
  }

  async create(
    tenantId: string,
    input: {
      priority: Priority;
      serviceOrderType?: ServiceOrderType | null;
      hours: number;
      isOverride?: boolean;
      active?: boolean;
    },
  ) {
    const isOverride = input.isOverride ?? false;
    const serviceOrderType = isOverride ? input.serviceOrderType : null;
    if (isOverride && !serviceOrderType) {
      throw new BadRequestException('Override policies require a serviceOrderType.');
    }

    const existing = await this.prisma.slaPolicy.findFirst({
      where: isOverride
        ? { tenantId, isOverride: true, serviceOrderType }
        : { tenantId, isOverride: false, priority: input.priority, serviceOrderType: null },
      select: { id: true },
    });
    if (existing) throw new ConflictException('An equivalent SLA policy already exists.');

    return this.prisma.slaPolicy.create({
      data: {
        tenantId,
        priority: input.priority,
        serviceOrderType,
        hours: input.hours,
        isOverride,
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
    const result = await this.prisma.slaPolicy.deleteMany({ where: { id, tenantId } });
    if (result.count === 0) throw new NotFoundException('Policy not found');
    return { success: true };
  }
}
