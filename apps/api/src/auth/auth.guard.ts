import { CanActivate, ExecutionContext, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
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
    const secret = process.env.JWT_ACCESS_SECRET || 'dev-access-secret';

    let payload: AccessPayload;
    try {
      payload = verify(token, secret) as AccessPayload;
    } catch {
      throw new UnauthorizedException('Invalid or expired access token.');
    }

    if (payload.typ !== 'access' || !payload.sub || !payload.sid) {
      throw new UnauthorizedException('Invalid access token payload.');
    }

    const session = await this.prisma.session.findUnique({
      where: { id: payload.sid }
    });

    if (!session || session.userId !== payload.sub || session.revokedAt || session.expiresAt < new Date()) {
      throw new UnauthorizedException('Session is revoked, invalid, or expired.');
    }

    if ((payload.tenantId ?? null) !== (session.tenantId ?? null)) {
      throw new UnauthorizedException('Tenant scope mismatch for session.');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, status: true, deletedAt: true }
    });

    if (!user || user.deletedAt || user.status !== 'ACTIVE') {
      throw new UnauthorizedException('User is inactive or not found.');
    }

    let role = payload.role ?? null;
    if (session.tenantId) {
      const membership = await this.prisma.userTenant.findUnique({
        where: {
          userId_tenantId: {
            userId: payload.sub,
            tenantId: session.tenantId
          }
        },
        include: { role: true }
      });

      if (!membership) {
        throw new UnauthorizedException('User has no membership for this tenant.');
      }

      role = membership.role.code;
    }

    req.auth = {
      userId: payload.sub,
      sessionId: payload.sid,
      tenantId: payload.tenantId ?? null,
      role
    };

    return true;
  }
}
