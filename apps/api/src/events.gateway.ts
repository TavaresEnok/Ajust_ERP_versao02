import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Inject } from '@nestjs/common';
import { Socket, Server } from 'socket.io';
import { verify } from 'jsonwebtoken';
import { PrismaService } from './prisma/prisma.service';

type AccessPayload = {
  sub: string;
  sid: string;
  tenantId: string | null;
  role: string | null;
  typ: 'access' | 'socket';
};

type AuthenticatedSocket = Socket & {
  auth?: AccessPayload;
};

function getCorsOrigin() {
  if (process.env.NODE_ENV === 'production') {
    const base = process.env.WEB_BASE_URL || process.env.WEB_URL;
    return base ? [base] : false;
  }
  return ['http://localhost:3000', 'http://localhost:8070'];
}

@WebSocketGateway({
  cors: { origin: getCorsOrigin(), credentials: true },
})
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async handleConnection(client: AuthenticatedSocket) {
    const payload = this.verifyClientToken(client);
    if (!payload) {
      client.emit('error', { message: 'Authentication required' });
      client.disconnect(true);
      return;
    }

    // Validar sessão, usuário e tenant contra o banco (mesmo nível do AuthGuard)
    const valid = await this.validateSession(payload);
    if (!valid) {
      client.emit('error', { message: 'Session invalid or expired' });
      client.disconnect(true);
      return;
    }

    client.auth = payload;

    if (payload.tenantId) {
      client.join(`tenant:${payload.tenantId}`);
    }
  }

  handleDisconnect(_client: Socket) {}

  @SubscribeMessage('ping')
  handlePing(@MessageBody() payload: Record<string, unknown>) {
    return {
      event: 'pong',
      data: {
        ...payload,
        timestamp: new Date().toISOString(),
      },
    };
  }

  @SubscribeMessage('subscribe_tenant')
  subscribeTenant(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() _payload: { tenantId?: string },
  ) {
    const auth = client.auth;
    if (!auth?.tenantId) {
      return { ok: false, reason: 'not_authenticated' };
    }
    const room = `tenant:${auth.tenantId}`;
    client.join(room);
    return { ok: true, room };
  }

  @SubscribeMessage('unsubscribe_tenant')
  unsubscribeTenant(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() _payload: { tenantId?: string },
  ) {
    const auth = client.auth;
    if (!auth?.tenantId) {
      return { ok: false, reason: 'not_authenticated' };
    }
    const room = `tenant:${auth.tenantId}`;
    client.leave(room);
    return { ok: true, room };
  }

  emitDomainEvent(event: string, data: unknown) {
    this.server.emit(event, data);
  }

  emitTenantEvent(tenantId: string, event: string, data: unknown) {
    this.server.to(`tenant:${tenantId}`).emit(event, data);
  }

  disconnectTenant(tenantId: string) {
    this.server?.in(`tenant:${tenantId}`).disconnectSockets(true);
  }

  private verifyClientToken(client: Socket): AccessPayload | null {
    const token = client.handshake.auth?.token;
    if (typeof token !== 'string' || token.length < 8) return null;

    const secret = process.env.JWT_ACCESS_SECRET;
    if (!secret) return null;
    try {
      const payload = verify(token, secret) as AccessPayload;
      if (!['access', 'socket'].includes(payload.typ) || !payload.sub || !payload.sid) return null;
      return payload;
    } catch {
      return null;
    }
  }

  private async validateSession(payload: AccessPayload): Promise<boolean> {
    try {
      const session = await this.prisma.session.findUnique({
        where: { id: payload.sid },
        include: {
          user: { select: { id: true, status: true, deletedAt: true } },
        },
      });

      if (!session || session.userId !== payload.sub) return false;
      if (session.revokedAt) return false;
      if (session.expiresAt < new Date()) return false;
      if ((payload.tenantId ?? null) !== (session.tenantId ?? null)) return false;

      const { user } = session;
      if (!user || user.deletedAt || user.status !== 'ACTIVE') return false;

      if (session.tenantId) {
        const membership = await this.prisma.userTenant.findUnique({
          where: {
            userId_tenantId: { userId: payload.sub, tenantId: session.tenantId },
          },
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
          return false;
        }
        payload.role = membership.role.code;
      }

      return true;
    } catch {
      return false;
    }
  }
}
