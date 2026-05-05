import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CmdbService {
  constructor(private readonly prisma: PrismaService) {}

  async list(tenantId: string): Promise<any[]> {
    return (this.prisma as any).asset.findMany({
      where: { tenantId, deletedAt: null },
      include: { createdBy: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(tenantId: string, actorId: string, input: {
    name: string; category?: string; status?: string;
    description?: string; location?: string; serialNumber?: string;
    vendor?: string; contractEnd?: string; tags?: string[];
  }): Promise<any> {
    return (this.prisma as any).asset.create({
      data: {
        tenantId,
        name: input.name,
        category: input.category ?? 'OUTRO',
        status: input.status ?? 'ATIVO',
        description: input.description,
        location: input.location,
        serialNumber: input.serialNumber,
        vendor: input.vendor,
        contractEnd: input.contractEnd ? new Date(input.contractEnd) : undefined,
        tags: input.tags ?? [],
        createdById: actorId,
      },
    });
  }

  async update(tenantId: string, id: string, input: Record<string, any>): Promise<any> {
    const asset = await (this.prisma as any).asset.findFirst({ where: { id, tenantId, deletedAt: null } });
    if (!asset) throw new NotFoundException('Asset not found.');
    return (this.prisma as any).asset.update({
      where: { id },
      data: { ...input, contractEnd: input.contractEnd ? new Date(input.contractEnd) : undefined },
    });
  }

  async remove(tenantId: string, id: string): Promise<any> {
    const asset = await (this.prisma as any).asset.findFirst({ where: { id, tenantId, deletedAt: null } });
    if (!asset) throw new NotFoundException('Asset not found.');
    await (this.prisma as any).asset.update({ where: { id }, data: { deletedAt: new Date() } });
    return { success: true };
  }

  async linkOrder(tenantId: string, assetId: string, orderId: string): Promise<any> {
    const asset = await (this.prisma as any).asset.findFirst({ where: { id: assetId, tenantId } });
    if (!asset) throw new NotFoundException('Asset not found.');
    return (this.prisma as any).assetServiceOrder.upsert({
      where: { assetId_orderId: { assetId, orderId } },
      create: { assetId, orderId },
      update: {},
    });
  }
}
