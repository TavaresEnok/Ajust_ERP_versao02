import { Controller, Get, UseGuards, Req, UnauthorizedException, Inject } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard';
import { TenantIsolationGuard } from '../auth/tenant-isolation.guard';
import { RequestWithAuth } from '../common/request-with-auth';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../common/redis.service';
import { assertManagerRole } from '../common/role-utils';

@ApiTags('Health')
@Controller('reports')
@UseGuards(AuthGuard, TenantIsolationGuard)
export class HealthSummaryController {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(RedisService) private readonly redis: RedisService,
  ) {}

  @Get('health-summary')
  @ApiOperation({ summary: 'Get health summary of services, database, Redis and stats' })
  async getHealthSummary(@Req() req: RequestWithAuth) {
    if (!req.auth?.tenantId) throw new UnauthorizedException('Missing tenantId');
    assertManagerRole(req.auth);

    let dbOk = false;
    let dbLatencyMs = 0;
    let redisOk = false;

    try {
      const start = Date.now();
      await this.prisma.$queryRaw`SELECT 1`;
      dbLatencyMs = Date.now() - start;
      dbOk = true;
    } catch {
      /* ignore */
    }

    try {
      redisOk = this.redis.getStatus().connected;
    } catch {
      /* ignore */
    }

    let totalOrders: number | null = null;
    let activeSessions: number | null = null;
    try {
      const [count, sessions] = await Promise.all([
        this.prisma.serviceOrder.count({ where: { tenantId: req.auth.tenantId, deletedAt: null } }),
        this.prisma.session.count({
          where: {
            tenantId: req.auth.tenantId,
            revokedAt: null,
            expiresAt: { gt: new Date() },
          },
        }),
      ]);
      totalOrders = count;
      activeSessions = sessions;
    } catch {
      /* ignore */
    }

    return {
      timestamp: new Date().toISOString(),
      services: {
        database: { ok: dbOk, latencyMs: dbLatencyMs },
        redis: { ok: redisOk },
      },
      stats: {
        available: totalOrders !== null && activeSessions !== null,
        totalOrders,
        activeSessions,
      },
    };
  }
}
