import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { verify } from 'jsonwebtoken';
import { PrismaService } from '../prisma/prisma.service';
import { RequestWithAuth } from '../common/request-with-auth';

type AccessPayload = {
  sub: string;
  sid: string;
  tenantId: string | null;
  role: string | null;
  typ: 'access';
};

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<RequestWithAuth>();
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing Bearer token.');
    }

    const token = authHeader.slice('Bearer '.length);
    const secret = process.env.JWT_ACCESS_SECRET;
    if (!secret) throw new UnauthorizedException('JWT_ACCESS_SECRET não configurada');

    let payload: AccessPayload;
    try {
      payload = verify(token, secret) as AccessPayload;
    } catch {
      throw new UnauthorizedException('Invalid or expired access token.');
    }

    if (payload.typ !== 'access' || !payload.sub || !payload.sid) {
      throw new UnauthorizedException('Invalid access token payload.');
    }

    // ─── 1 query: session + user (antes eram 3 queries separadas) ────────────
    const session = await this.prisma.session.findUnique({
      where: { id: payload.sid },
      include: {
        user: {
          select: { id: true, status: true, deletedAt: true },
        },
      },
    });

    if (
      !session ||
      session.userId !== payload.sub ||
      session.revokedAt ||
      session.expiresAt < new Date()
    ) {
      throw new UnauthorizedException('Session is revoked, invalid, or expired.');
    }

    if ((payload.tenantId ?? null) !== (session.tenantId ?? null)) {
      throw new UnauthorizedException('Tenant scope mismatch for session.');
    }

    const { user } = session;
    if (!user || user.deletedAt || user.status !== 'ACTIVE') {
      throw new UnauthorizedException('User is inactive or not found.');
    }

    // Resolve papel atual do banco (garante papel atualizado mesmo com token antigo)
    let role = payload.role ?? null;
    if (session.tenantId) {
      const membership = await this.prisma.userTenant.findUnique({
        where: {
          userId_tenantId: {
            userId: payload.sub,
            tenantId: session.tenantId,
          },
        },
        select: {
          role: { select: { code: true } },
          tenant: { select: { status: true, deletedAt: true } },
        },
      });

      if (!membership) {
        throw new UnauthorizedException('User has no membership for this tenant.');
      }
      if (membership.tenant.status !== 'ACTIVE' || membership.tenant.deletedAt) {
        throw new UnauthorizedException('Tenant is inactive or suspended.');
      }

      role = membership.role.code;
    }

    req.auth = {
      userId: payload.sub,
      sessionId: payload.sid,
      tenantId: payload.tenantId ?? null,
      role,
    };

    return true;
  }
}
