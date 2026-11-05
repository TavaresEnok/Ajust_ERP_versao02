import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Inject, OnModuleDestroy } from '@nestjs/common';
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
  // Fora de produção também aceita o endereço público (HTTPS pelo Caddy, C-075).
  const publicUrl = process.env.WEB_BASE_URL || process.env.PUBLIC_APP_URL;
  return ['http://localhost:3000', 'http://localhost:8070', ...(publicUrl ? [publicUrl] : [])];
}

@WebSocketGateway({
  cors: { origin: getCorsOrigin(), credentials: true },
})
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect, OnModuleDestroy {
  @WebSocketServer()
  server!: Server;
  private readonly checks = new Map<string, ReturnType<typeof setInterval>>();

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
    client.data.auth = payload;
    const timer = setInterval(() => {
      void this.validateSession(payload).then((valid) => {
        if (!valid) client.disconnect(true);
      });
    }, 30_000);
    timer.unref();
    this.checks.set(client.id, timer);

    if (payload.tenantId) {
      client.join(`tenant:${payload.tenantId}`);
    }
  }

  handleDisconnect(client: Socket) {
    clearInterval(this.checks.get(client.id));
    this.checks.delete(client.id);
  }
  onModuleDestroy() {
    for (const timer of this.checks.values()) clearInterval(timer);
    this.checks.clear();
  }

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
  async subscribeTenant(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() _payload: { tenantId?: string },
  ) {
    const auth = client.auth;
    if (!auth?.tenantId || !(await this.validateSession(auth))) {
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
    return this.emitValidated(undefined, event, data);
  }

  emitTenantEvent(tenantId: string, event: string, data: unknown) {
    return this.emitValidated(tenantId, event, data);
  }

  private async emitValidated(tenantId: string | undefined, event: string, data: unknown) {
    if (!this.server) return;
    try {
      const clients = await (
        tenantId ? this.server.in(`tenant:${tenantId}`) : this.server
      ).fetchSockets();
      await Promise.all(
        clients.map(async (client) => {
          const auth = client.data.auth as AccessPayload | undefined;
          if (
            !auth ||
            (tenantId && auth.tenantId !== tenantId) ||
            !(await this.validateSession(auth))
          ) {
            client.disconnect(true);
            return;
          }
          client.emit(event, data);
        }),
      );
    } catch {
      /* Fail closed: never broadcast if validation or the adapter is unavailable. */
    }
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
        if (payload.role !== membership.role.code) return false;
        // A sala do tenant recebe eventos de todos os provedores; contas cliente ficam fora (C-019/C-053).
        if (payload.role === 'cliente') return false;
      }

      return true;
    } catch {
      return false;
    }
  }
}
