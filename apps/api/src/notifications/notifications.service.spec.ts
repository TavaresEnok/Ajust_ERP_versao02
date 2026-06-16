jest.mock('../common/ssrf-guard', () => ({
  assertSafeUrl: jest.fn().mockResolvedValue(undefined),
}));

import { NotificationsService } from './notifications.service';

function makeEmail(): any {
  return { sendEmail: jest.fn() };
}

function makePrisma(overrides: any = {}): any {
  const base: any = {
    notificationConfig: {
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockResolvedValue({ id: 'n1' }),
      create: jest.fn().mockResolvedValue({ id: 'n1' }),
      update: jest.fn().mockResolvedValue({ id: 'n1' }),
      delete: jest.fn().mockResolvedValue({ id: 'n1' }),
    },
  };
  for (const key of Object.keys(overrides)) base.notificationConfig[key] = overrides[key];
  return base;
}

describe('NotificationsService.list', () => {
  it('lista configs do tenant por createdAt desc', async () => {
    const prisma = makePrisma();
    const svc = new NotificationsService(prisma, makeEmail());
    await svc.list('t1');
    expect(prisma.notificationConfig.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: 't1' } }),
    );
  });
});

describe('NotificationsService.create', () => {
  it('cria config com active=true por default', async () => {
    const prisma = makePrisma();
    const svc = new NotificationsService(prisma, makeEmail());
    await svc.create('t1', {
      name: 'X',
      channel: 'WEBHOOK',
      trigger: 'ORDER_ESCALATED',
      target: 'https://x',
    });
    const data = prisma.notificationConfig.create.mock.calls[0][0].data;
    expect(data.active).toBe(true);
  });
});

describe('NotificationsService.update', () => {
  it('lança NotFoundException se config não existe', async () => {
    const prisma = makePrisma({ findFirst: jest.fn().mockResolvedValue(null) });
    const svc = new NotificationsService(prisma, makeEmail());
    await expect(svc.update('t1', 'n1', { name: 'X' })).rejects.toThrow(
      'Configuração de notificação não encontrada',
    );
  });

  it('atualiza apenas campos definidos', async () => {
    const prisma = makePrisma();
    const svc = new NotificationsService(prisma, makeEmail());
    await svc.update('t1', 'n1', { name: 'Novo' });
    expect(prisma.notificationConfig.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { name: 'Novo' } }),
    );
  });
});

describe('NotificationsService.remove', () => {
  it('deleta e retorna success', async () => {
    const prisma = makePrisma();
    const svc = new NotificationsService(prisma, makeEmail());
    const result = await svc.remove('t1', 'n1');
    expect(result).toEqual({ success: true });
  });
});

describe('NotificationsService.dispatch', () => {
  it('busca configs ativas pelo trigger', async () => {
    const prisma = makePrisma();
    prisma.notificationConfig.findMany.mockResolvedValueOnce([]);
    const svc = new NotificationsService(prisma, makeEmail());
    await svc.dispatch('t1', 'ORDER_ESCALATED', { protocol: 'OS-1' });
    expect(prisma.notificationConfig.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ active: true }) }),
    );
  });

  it('faz POST no webhook para channel SLACK/WEBHOOK', async () => {
    const prisma = makePrisma();
    prisma.notificationConfig.findMany.mockResolvedValueOnce([
      { id: 'n1', channel: 'SLACK', target: 'https://hooks.slack.com/test' },
    ]);
    global.fetch = jest.fn().mockResolvedValue({ ok: true }) as any;
    const svc = new NotificationsService(prisma, makeEmail());
    await svc.dispatch('t1', 'ORDER_ESCALATED', { protocol: 'OS-1' });
    expect(global.fetch).toHaveBeenCalledWith(
      'https://hooks.slack.com/test',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('não chama fetch para channel EMAIL', async () => {
    const prisma = makePrisma();
    prisma.notificationConfig.findMany.mockResolvedValueOnce([
      { id: 'n1', channel: 'EMAIL', target: 'user@example.com' },
    ]);
    const fetchSpy = jest.fn();
    global.fetch = fetchSpy as any;
    const email = makeEmail();
    const svc = new NotificationsService(prisma, email);
    await svc.dispatch('t1', 'ORDER_ESCALATED', { protocol: 'OS-1' });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(email.sendEmail).toHaveBeenCalledWith(
      'user@example.com',
      expect.stringContaining('ORDER_ESCALATED'),
      expect.stringContaining('OS-1'),
    );
  });
});
