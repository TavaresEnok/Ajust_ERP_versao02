import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as crypto from 'crypto';

@Injectable()
export class ApiKeysService {
  constructor(private readonly prisma: PrismaService) {}

  private hash(key: string): string {
    return crypto.createHash('sha256').update(key).digest('hex');
  }

  async list(tenantId: string) {
    const keys: any[] = await (this.prisma as any).apiKey.findMany({
      where: { tenantId },
      include: { createdBy: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return keys.map(k => ({ ...k, keyHash: undefined })); // never expose hash
  }

  async create(tenantId: string, actorId: string, name: string, expiresAt?: string) {
    const raw = `ajust_${crypto.randomBytes(24).toString('hex')}`;
    const prefix = raw.substring(0, 12);
    const keyHash = this.hash(raw);
    const record = await (this.prisma as any).apiKey.create({
      data: { tenantId, name, keyHash, keyPrefix: prefix, createdById: actorId, expiresAt: expiresAt ? new Date(expiresAt) : undefined },
    });
    return { ...record, key: raw }; // Only time the raw key is returned
  }

  async revoke(tenantId: string, id: string) {
    const key = await (this.prisma as any).apiKey.findFirst({ where: { id, tenantId } });
    if (!key) throw new NotFoundException('API Key not found.');
    return (this.prisma as any).apiKey.update({ where: { id }, data: { active: false } });
  }

  async remove(tenantId: string, id: string) {
    await (this.prisma as any).apiKey.deleteMany({ where: { id, tenantId } });
    return { success: true };
  }

  async validateKey(rawKey: string): Promise<{ tenantId: string; keyId: string } | null> {
    const keyHash = this.hash(rawKey);
    const key = await (this.prisma as any).apiKey.findFirst({
      where: { keyHash, active: true },
    });
    if (!key) return null;
    if (key.expiresAt && new Date(key.expiresAt) < new Date()) return null;
    await (this.prisma as any).apiKey.update({ where: { id: key.id }, data: { lastUsedAt: new Date() } });
    return { tenantId: key.tenantId, keyId: key.id };
  }
}
