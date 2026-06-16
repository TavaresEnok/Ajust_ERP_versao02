import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Asset, AssetCategory, AssetServiceOrder, AssetStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export type AssetWriteInput = {
  name?: string;
  category?: AssetCategory;
  status?: AssetStatus;
  description?: string | null;
  location?: string | null;
  serialNumber?: string | null;
  vendor?: string | null;
  contractEnd?: string | null;
  tags?: string[];
};

@Injectable()
export class CmdbService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async list(tenantId: string): Promise<Asset[]> {
    return this.prisma.asset.findMany({
      where: { tenantId, deletedAt: null },
      include: { createdBy: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(
    tenantId: string,
    actorId: string,
    input: AssetWriteInput & { name: string },
  ): Promise<Asset> {
    return this.prisma.asset.create({
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

  async update(tenantId: string, id: string, input: AssetWriteInput): Promise<Asset> {
    const asset = await this.prisma.asset.findFirst({ where: { id, tenantId, deletedAt: null } });
    if (!asset) throw new NotFoundException('Asset not found.');
    const data: Prisma.AssetUpdateInput = {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.category !== undefined ? { category: input.category } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.location !== undefined ? { location: input.location } : {}),
      ...(input.serialNumber !== undefined ? { serialNumber: input.serialNumber } : {}),
      ...(input.vendor !== undefined ? { vendor: input.vendor } : {}),
      ...(input.tags !== undefined ? { tags: input.tags } : {}),
      ...(input.contractEnd !== undefined
        ? { contractEnd: input.contractEnd ? new Date(input.contractEnd) : null }
        : {}),
    };
    return this.prisma.asset.update({
      where: { id },
      data,
    });
  }

  async remove(tenantId: string, id: string): Promise<{ success: true }> {
    const asset = await this.prisma.asset.findFirst({ where: { id, tenantId, deletedAt: null } });
    if (!asset) throw new NotFoundException('Asset not found.');
    await this.prisma.asset.update({ where: { id }, data: { deletedAt: new Date() } });
    return { success: true };
  }

  async linkOrder(tenantId: string, assetId: string, orderId: string): Promise<AssetServiceOrder> {
    const [asset, order] = await Promise.all([
      this.prisma.asset.findFirst({ where: { id: assetId, tenantId, deletedAt: null } }),
      this.prisma.serviceOrder.findFirst({
        where: { id: orderId, tenantId, deletedAt: null },
        select: { id: true },
      }),
    ]);
    if (!asset) throw new NotFoundException('Asset not found.');
    if (!order) throw new NotFoundException('Order not found.');
    return this.prisma.assetServiceOrder.upsert({
      where: { assetId_orderId: { assetId, orderId } },
      create: { assetId, orderId },
      update: {},
    });
  }
}
