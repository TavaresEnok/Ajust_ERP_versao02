import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
@Injectable()
export class SessionRetentionService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}
  async runOnce(now = new Date()) {
    const configured = Number(process.env.SESSION_RETENTION_DAYS || 30);
    const days = Number.isInteger(configured) && configured >= 1 ? configured : 30;
    const cutoff = new Date(now.getTime() - days * 86400000);
    const where = { OR: [{ expiresAt: { lt: cutoff } }, { revokedAt: { lt: cutoff } }] };
    let removed = 0;
    while (true) {
      const batch = await this.prisma.session.findMany({
        where,
        orderBy: { id: 'asc' },
        take: 500,
        select: { id: true },
      });
      if (!batch.length) return { removed };
      // Recheck the cutoff: a refresh may have extended an expired session after the SELECT.
      const result = await this.prisma.session.deleteMany({
        where: { ...where, id: { in: batch.map((row) => row.id) } },
      });
      removed += result.count;
    }
  }
}
