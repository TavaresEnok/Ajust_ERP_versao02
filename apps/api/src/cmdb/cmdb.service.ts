import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Asset, AssetCategory, AssetConfigSnapshot, AssetServiceOrder, AssetStatus, Prisma } from '@prisma/client';
import { createHash } from 'crypto';
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

export type DiffLine = {
  type: 'added' | 'removed' | 'unchanged';
  text: string;
};

export type SnapshotDiffResult = {
  fromVersion: number;
  toVersion: number;
  addedLinesCount: number;
  removedLinesCount: number;
  diffLines: DiffLine[];
};

@Injectable()
export class CmdbService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async list(tenantId: string): Promise<Asset[]> {
    return this.prisma.asset.findMany({
      where: { tenantId, deletedAt: null },
      include: {
        createdBy: { select: { id: true, name: true } },
        _count: { select: { configSnapshots: true } },
      },
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

  // ─── Network Config Snapshots (CMDB-01) ───────────────────────────────────

  async createSnapshot(
    tenantId: string,
    actorId: string,
    assetId: string,
    input: { content: string; notes?: string },
  ): Promise<AssetConfigSnapshot> {
    const asset = await this.prisma.asset.findFirst({
      where: { id: assetId, tenantId, deletedAt: null },
      select: { id: true },
    });
    if (!asset) throw new NotFoundException('Ativo não encontrado.');

    const latest = await this.prisma.assetConfigSnapshot.findFirst({
      where: { assetId, tenantId },
      orderBy: { version: 'desc' },
      select: { version: true },
    });

    const nextVersion = (latest?.version ?? 0) + 1;
    const checksum = createHash('sha256').update(input.content).digest('hex');

    return this.prisma.assetConfigSnapshot.create({
      data: {
        tenantId,
        assetId,
        version: nextVersion,
        content: input.content,
        notes: input.notes,
        checksum,
        createdById: actorId,
      },
      include: {
        createdBy: { select: { id: true, name: true } },
      },
    });
  }

  async listSnapshots(tenantId: string, assetId: string) {
    const asset = await this.prisma.asset.findFirst({
      where: { id: assetId, tenantId, deletedAt: null },
      select: { id: true },
    });
    if (!asset) throw new NotFoundException('Ativo não encontrado.');

    return this.prisma.assetConfigSnapshot.findMany({
      where: { assetId, tenantId },
      select: {
        id: true,
        version: true,
        notes: true,
        checksum: true,
        createdAt: true,
        createdBy: { select: { id: true, name: true } },
      },
      orderBy: { version: 'desc' },
    });
  }

  async getSnapshot(tenantId: string, assetId: string, snapshotId: string): Promise<AssetConfigSnapshot> {
    const snapshot = await this.prisma.assetConfigSnapshot.findFirst({
      where: { id: snapshotId, assetId, tenantId },
      include: {
        createdBy: { select: { id: true, name: true } },
      },
    });
    if (!snapshot) throw new NotFoundException('Snapshot de configuração não encontrado.');
    return snapshot;
  }

  async diffSnapshots(
    tenantId: string,
    assetId: string,
    fromSnapshotId: string,
    toSnapshotId: string,
  ): Promise<SnapshotDiffResult> {
    const [fromSnap, toSnap] = await Promise.all([
      this.getSnapshot(tenantId, assetId, fromSnapshotId),
      this.getSnapshot(tenantId, assetId, toSnapshotId),
    ]);

    const linesA = fromSnap.content.split('\n');
    const linesB = toSnap.content.split('\n');

    const diffLines = this.computeLineDiff(linesA, linesB);

    let addedLinesCount = 0;
    let removedLinesCount = 0;
    for (const d of diffLines) {
      if (d.type === 'added') addedLinesCount++;
      else if (d.type === 'removed') removedLinesCount++;
    }

    return {
      fromVersion: fromSnap.version,
      toVersion: toSnap.version,
      addedLinesCount,
      removedLinesCount,
      diffLines,
    };
  }

  /** Algoritmo simples e determinístico de diff linha a linha */
  private computeLineDiff(a: string[], b: string[]): DiffLine[] {
    const m = a.length;
    const n = b.length;
    const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (a[i - 1] === b[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1] + 1;
        } else {
          dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
        }
      }
    }

    let i = m;
    let j = n;
    const result: DiffLine[] = [];

    while (i > 0 || j > 0) {
      if (i > 0 && j > 0 && a[i - 1] === b[j - 1]) {
        result.push({ type: 'unchanged', text: a[i - 1] });
        i--;
        j--;
      } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
        result.push({ type: 'added', text: b[j - 1] });
        j--;
      } else if (i > 0 && (j === 0 || dp[i][j - 1] < dp[i - 1][j])) {
        result.push({ type: 'removed', text: a[i - 1] });
        i--;
      }
    }

    return result.reverse();
  }
}

