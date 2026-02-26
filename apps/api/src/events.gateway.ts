import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer
} from '@nestjs/websockets';
import { Socket, Server } from 'socket.io';

@WebSocketGateway({
  cors: { origin: '*' }
})
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  handleConnection(client: Socket) {
    const room = this.resolveTenantRoom(client.handshake.auth?.tenantId || client.handshake.query?.tenantId);
    if (room) {
      client.join(room);
    }
  }

  handleDisconnect(_client: Socket) {
    // no-op
  }

  @SubscribeMessage('ping')
  handlePing(@MessageBody() payload: Record<string, unknown>) {
    return {
      event: 'pong',
      data: {
        ...payload,
        timestamp: new Date().toISOString()
      }
    };
  }

  @SubscribeMessage('subscribe_tenant')
  subscribeTenant(@ConnectedSocket() client: Socket, @MessageBody() payload: { tenantId?: string }) {
    const room = this.resolveTenantRoom(payload?.tenantId);
    if (!room) {
      return { ok: false, reason: 'tenantId_missing' };
    }
    client.join(room);
    return { ok: true, room };
  }

  @SubscribeMessage('unsubscribe_tenant')
  unsubscribeTenant(@ConnectedSocket() client: Socket, @MessageBody() payload: { tenantId?: string }) {
    const room = this.resolveTenantRoom(payload?.tenantId);
    if (!room) {
      return { ok: false, reason: 'tenantId_missing' };
    }
    client.leave(room);
    return { ok: true, room };
  }

  emitDomainEvent(event: string, data: unknown) {
    this.server.emit(event, data);
  }

  emitTenantEvent(tenantId: string, event: string, data: unknown) {
    this.server.to(`tenant:${tenantId}`).emit(event, data);
  }

  private resolveTenantRoom(tenantId?: unknown) {
    if (typeof tenantId !== 'string' || tenantId.length < 8) return null;
    return `tenant:${tenantId}`;
  }
}
