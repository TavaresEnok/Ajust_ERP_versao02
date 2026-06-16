import { ApiTags } from '@nestjs/swagger';
import { Controller, Get, Inject, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { verify } from 'jsonwebtoken';
import { PrometheusService } from './prometheus.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../common/redis.service';

type MetricsAccessPayload = {
  typ?: string;
  sub?: string;
  sid?: string;
  tenantId?: string | null;
  role?: string | null;
};

@ApiTags('Monitoramento')
@Controller('monitoring')
export class MetricsController {
  constructor(
    @Inject(PrometheusService)
    private readonly prometheusService: PrometheusService,
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(RedisService)
    private readonly redis: RedisService,
  ) {}

  @Get('/metrics')
  async metrics(@Res() res: Response, @Req() req: Request): Promise<void> {
    if (process.env.NODE_ENV === 'production') {
      const authHeader = req.headers?.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      const token = authHeader.slice('Bearer '.length);
      const secret = process.env.JWT_ACCESS_SECRET;
      if (!secret) {
        res.status(500).json({ error: 'JWT secret not configured' });
        return;
      }
      const validation = await this.validateMetricsToken(token, secret);
      if (!validation.ok) {
        res.status(validation.status).json({ error: validation.error });
        return;
      }
    }
    const metrics = this.prometheusService.getMetrics();
    res.set('Content-Type', 'text/plain; charset=utf-8');
    res.send(metrics);
  }

  @Get('/health')
  health(): { status: string; timestamp: string; environment: string } {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
    };
  }

  @Get('/ready')
  async ready(@Res() res: Response): Promise<void> {
    let dbOk = false;
    let redisOk = false;

    try {
      await this.prisma.$queryRaw`SELECT 1`;
      dbOk = true;
    } catch {
      dbOk = false;
    }

    try {
      redisOk = this.redis.getStatus().connected;
    } catch {
      redisOk = false;
    }

    res.status(dbOk && redisOk ? 200 : 503).json({
      ready: dbOk && redisOk,
      timestamp: new Date().toISOString(),
      checks: { database: dbOk, redis: redisOk },
    });
  }

  private async validateMetricsToken(
    token: string,
    secret: string,
  ): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
    const adminRoles = ['super_admin', 'gerente'];

    let payload: MetricsAccessPayload;
    try {
      payload = verify(token, secret) as MetricsAccessPayload;
    } catch {
      return { ok: false, status: 403, error: 'Invalid or expired token' };
    }

    if (payload.typ !== 'access' || !payload.sub || !payload.sid) {
      return { ok: false, status: 403, error: 'Invalid token' };
    }

    const session = await this.prisma.session.findUnique({
      where: { id: payload.sid },
      include: {
        user: { select: { id: true, status: true, deletedAt: true } },
      },
    });

    if (
      !session ||
      session.userId !== payload.sub ||
      session.revokedAt ||
      session.expiresAt < new Date()
    ) {
      return { ok: false, status: 403, error: 'Session invalid' };
    }

    if ((payload.tenantId ?? null) !== (session.tenantId ?? null)) {
      return { ok: false, status: 403, error: 'Tenant scope mismatch' };
    }

    if (!session.user || session.user.deletedAt || session.user.status !== 'ACTIVE') {
      return { ok: false, status: 403, error: 'User inactive' };
    }

    let effectiveRole = payload.role ?? null;
    if (session.tenantId) {
      const membership = await this.prisma.userTenant.findUnique({
        where: { userId_tenantId: { userId: payload.sub, tenantId: session.tenantId } },
        select: {
          role: { select: { code: true } },
          tenant: { select: { status: true, deletedAt: true } },
        },
      });
      if (
        !membership ||
        membership.tenant.status !== 'ACTIVE' ||
        Boolean(membership.tenant.deletedAt)
      ) {
        return { ok: false, status: 403, error: 'Tenant inactive' };
      }
      effectiveRole = membership?.role.code ?? null;
    }

    if (!effectiveRole || !adminRoles.includes(effectiveRole)) {
      return { ok: false, status: 403, error: 'Admin role required' };
    }

    return { ok: true };
  }
}
