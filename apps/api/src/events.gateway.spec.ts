import { EventsGateway } from './events.gateway';
describe('WebSocket session revocation', () => {
  function setup(revoked = false) {
    const prisma = {
      session: {
        findUnique: jest.fn().mockResolvedValue({
          userId: 'u',
          tenantId: 't',
          revokedAt: revoked ? new Date() : null,
          expiresAt: new Date(Date.now() + 60000),
          user: { status: 'ACTIVE', deletedAt: null },
        }),
      },
      userTenant: {
        findUnique: jest.fn().mockResolvedValue({
          role: { code: 'analista' },
          tenant: { status: 'ACTIVE', deletedAt: null },
        }),
      },
    };
    const client = {
      data: { auth: { sub: 'u', sid: 's', tenantId: 't', role: 'analista' } },
      emit: jest.fn(),
      disconnect: jest.fn(),
    };
    const gateway = new EventsGateway(prisma as never);
    gateway.server = {
      in: jest.fn().mockReturnValue({ fetchSockets: jest.fn().mockResolvedValue([client]) }),
    } as never;
    return { gateway, client, prisma };
  }
  it('does not send an event after revocation, and disconnects the socket', async () => {
    const { gateway, client } = setup(true);
    await gateway.emitTenantEvent('t', 'order_changed', {});
    expect(client.emit).not.toHaveBeenCalled();
    expect(client.disconnect).toHaveBeenCalledWith(true);
  });
  it('sends to a current team member, but not after their role changes', async () => {
    const { gateway, client, prisma } = setup();
    await gateway.emitTenantEvent('t', 'order_changed', {});
    expect(client.emit).toHaveBeenCalledTimes(1);
    prisma.userTenant.findUnique.mockResolvedValue({
      role: { code: 'cliente' },
      tenant: { status: 'ACTIVE', deletedAt: null },
    });
    await gateway.emitTenantEvent('t', 'order_changed', {});
    expect(client.emit).toHaveBeenCalledTimes(1);
    expect(client.disconnect).toHaveBeenCalled();
  });
  it('fails closed when the database cannot validate the session', async () => {
    const { gateway, client, prisma } = setup();
    prisma.session.findUnique.mockRejectedValue(new Error('offline'));
    await gateway.emitTenantEvent('t', 'order_changed', {});
    expect(client.emit).not.toHaveBeenCalled();
    expect(client.disconnect).toHaveBeenCalled();
  });
});
