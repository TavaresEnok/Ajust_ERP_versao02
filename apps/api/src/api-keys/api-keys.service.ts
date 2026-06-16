import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import * as crypto from 'crypto';
import { ApiKey } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

type PublicApiKey = Omit<ApiKey, 'keyHash'>;

@Injectable()
export class ApiKeysService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  private hash(key: string): string {
    return crypto.createHash('sha256').update(key).digest('hex');
  }

  async list(tenantId: string) {
    const keys = await this.prisma.apiKey.findMany({
      where: { tenantId },
      include: { createdBy: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return keys.map(({ keyHash: _keyHash, ...key }) => key);
  }

  async create(
    tenantId: string,
    actorId: string,
    name: string,
    expiresAt?: string,
  ): Promise<PublicApiKey & { key: string }> {
    const expiration = expiresAt ? new Date(expiresAt) : undefined;
    if (expiration && (Number.isNaN(expiration.getTime()) || expiration <= new Date())) {
      throw new BadRequestException('API Key expiration must be in the future.');
    }

    const raw = `ajust_${crypto.randomBytes(24).toString('hex')}`;
    const prefix = raw.substring(0, 12);
    const keyHash = this.hash(raw);
    const record = await this.prisma.apiKey.create({
      data: {
        tenantId,
        name,
        keyHash,
        keyPrefix: prefix,
        createdById: actorId,
        expiresAt: expiration,
      },
    });
    return { ...this.toPublicKey(record), key: raw };
  }

  async revoke(tenantId: string, id: string) {
    const key = await this.prisma.apiKey.findFirst({ where: { id, tenantId } });
    if (!key) throw new NotFoundException('API Key not found.');
    const updated = await this.prisma.apiKey.update({ where: { id }, data: { active: false } });
    return this.toPublicKey(updated);
  }

  async remove(tenantId: string, id: string) {
    const result = await this.prisma.apiKey.deleteMany({ where: { id, tenantId } });
    if (result.count === 0) throw new NotFoundException('API Key not found.');
    return { success: true };
  }

  async validateKey(rawKey: string): Promise<{ tenantId: string; keyId: string } | null> {
    const keyHash = this.hash(rawKey);
    const key = await this.prisma.apiKey.findFirst({
      where: {
        keyHash,
        active: true,
        tenant: { status: 'ACTIVE', deletedAt: null },
      },
    });
    if (!key) return null;
    if (key.expiresAt && new Date(key.expiresAt) < new Date()) return null;
    await this.prisma.apiKey.update({ where: { id: key.id }, data: { lastUsedAt: new Date() } });
    return { tenantId: key.tenantId, keyId: key.id };
  }

  private toPublicKey(key: ApiKey): PublicApiKey {
    const { keyHash: _keyHash, ...publicKey } = key;
    return publicKey;
  }
}
