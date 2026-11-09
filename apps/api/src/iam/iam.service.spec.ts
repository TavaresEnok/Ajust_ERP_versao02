import { BadRequestException, NotFoundException } from '@nestjs/common';
import { IamService } from './iam.service';

function makePrisma(overrides: Record<string, unknown> = {}): any {
  return {
    slaPolicy: {
      findFirst: jest.fn().mockResolvedValue(null),
      update: jest.fn().mockResolvedValue({ id: 'policy-1' }),
      create: jest.fn().mockResolvedValue({ id: 'policy-1' }),
    },
    ...overrides,
  };
}

function makeService(prisma: any) {
  return new IamService(prisma, { log: jest.fn().mockResolvedValue(undefined) } as any);
}

describe('IamService.listUsersByTenant workload', () => {
  it('maps aggregate results to the right members and distinguishes zero SLA from no sample', async () => {
    const prisma = makePrisma({
      userTenant: {
        findMany: jest
          .fn()
          .mockResolvedValue([
            { userId: 'analyst-a' },
            { userId: 'analyst-b' },
            { userId: 'analyst-c' },
          ]),
      },
      $queryRaw: jest.fn().mockResolvedValue([
        {
          assigneeUserId: 'analyst-b',
          activeOrderCount: 1,
          completedOrderCount: 2,
          slaEvaluatedCount: 2,
          slaMetCount: 0,
        },
        {
          assigneeUserId: 'analyst-a',
          activeOrderCount: 2,
          completedOrderCount: 4,
          slaEvaluatedCount: 3,
          slaMetCount: 2,
        },
      ]),
    });
    const rows = await makeService(prisma).listUsersByTenant('tenant-1');
    expect(rows[0]).toMatchObject({
      activeOrderCount: 2,
      completedOrderCount: 4,
      slaEvaluatedCount: 3,
      slaMetCount: 2,
      slaPercentage: 66.7,
    });
    expect(rows[1]).toMatchObject({
      activeOrderCount: 1,
      completedOrderCount: 2,
      slaEvaluatedCount: 2,
      slaMetCount: 0,
      slaPercentage: 0,
    });
    expect(rows[2]).toMatchObject({
      activeOrderCount: 0,
      completedOrderCount: 0,
      slaEvaluatedCount: 0,
      slaMetCount: 0,
      slaPercentage: null,
    });
    // Tenant is bound as a SQL parameter, never interpolated into SQL text.
    expect(prisma.$queryRaw.mock.calls[0].slice(1)).toEqual(['tenant-1']);
    expect(prisma.userTenant.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: 'tenant-1', user: { deletedAt: null } },
      }),
    );
  });
});

describe('IamService.saveSlaPolicy', () => {
  it('updates only tenant-owned SLA policies', async () => {
    const prisma = makePrisma({
      slaPolicy: {
        findFirst: jest.fn().mockResolvedValue({ id: 'policy-1' }),
        update: jest.fn().mockResolvedValue({ id: 'policy-1', active: false }),
        create: jest.fn(),
      },
    });
    const service = makeService(prisma);

    await expect(
      service.saveSlaPolicy('user-1', 'tenant-1', { id: 'policy-1', active: false }),
    ).resolves.toEqual({ id: 'policy-1', active: false });

    expect(prisma.slaPolicy.findFirst).toHaveBeenCalledWith({
      where: { id: 'policy-1', tenantId: 'tenant-1' },
      select: { id: true },
    });
    expect(prisma.slaPolicy.update).toHaveBeenCalledWith({
      where: { id: 'policy-1' },
      data: { hours: undefined, active: false },
    });
  });

  it('returns not found when updating an SLA policy outside the tenant', async () => {
    const prisma = makePrisma();
    const service = makeService(prisma);

    await expect(
      service.saveSlaPolicy('user-1', 'tenant-1', { id: 'policy-2', active: false }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('requires service order type for override SLA policies', async () => {
    const service = makeService(makePrisma());

    await expect(
      service.saveSlaPolicy('user-1', 'tenant-1', {
        priority: 'NORMAL',
        hours: 8,
        isOverride: true,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('normalizes base SLA policies to serviceOrderType null', async () => {
    const prisma = makePrisma({
      slaPolicy: {
        findFirst: jest.fn().mockResolvedValue(null),
        update: jest.fn(),
        create: jest.fn().mockResolvedValue({ id: 'policy-1' }),
      },
    });
    const service = makeService(prisma);

    await service.saveSlaPolicy('user-1', 'tenant-1', {
      priority: 'ALTA',
      serviceOrderType: 'ROMPIMENTO',
      hours: 4,
      isOverride: false,
    });

    expect(prisma.slaPolicy.create).toHaveBeenCalledWith({
      data: {
        tenantId: 'tenant-1',
        priority: 'ALTA',
        serviceOrderType: null,
        hours: 4,
        active: true,
        isOverride: false,
      },
    });
  });
});

describe('IamService — contas e vínculos (C-019, C-020, C-021)', () => {
  const role = { id: 'role-1', code: 'analista' };
  function prismaFor(overrides: Record<string, unknown> = {}) {
    const tx: any = {
      user: { update: jest.fn() },
      userTenant: {
        create: jest.fn(),
        findUnique: jest.fn().mockResolvedValue({ id: 'm-1' }),
        update: jest.fn(),
        delete: jest.fn(),
        count: jest.fn().mockResolvedValue(1),
      },
      session: { updateMany: jest.fn() },
    };
    const prisma: any = {
      role: { findUnique: jest.fn().mockResolvedValue(role) },
      tenant: { findUnique: jest.fn().mockResolvedValue({ id: 'tenant-1' }) },
      customer: { findFirst: jest.fn().mockResolvedValue({ id: 'customer-1' }) },
      user: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ id: 'user-9', status: 'ACTIVE', deletedAt: null }),
        create: jest.fn().mockResolvedValue({ id: 'user-new' }),
      },
      userTenant: {
        findUnique: jest.fn().mockResolvedValue(null),
        count: jest.fn().mockResolvedValue(0),
      },
      $transaction: jest.fn((fn: (t: unknown) => unknown) => fn(tx)),
      ...overrides,
    };
    return { prisma, tx };
  }
  const base = {
    name: 'Fulano',
    email: 'existente@ajust.com',
    password: 'senha-escolhida-por-terceiro',
    tenantId: 'tenant-1',
    roleCode: 'analista',
  };

  it('vincula e-mail existente sem trocar nome, senha ou situação da conta', async () => {
    const { prisma, tx } = prismaFor();
    await makeService(prisma).createUser('actor', { ...base, actorRole: 'gerente' });
    expect(tx.user.update).not.toHaveBeenCalled();
    expect(tx.userTenant.create).toHaveBeenCalledWith({
      data: { userId: 'user-9', tenantId: 'tenant-1', roleId: 'role-1' },
    });
  });

  it('não reativa conta excluída pelo cadastro', async () => {
    const { prisma } = prismaFor();
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-9',
      status: 'INACTIVE',
      deletedAt: new Date(),
    });
    await expect(makeService(prisma).createUser('actor', base)).rejects.toThrow(
      'inativa ou excluída',
    );
  });

  it('exige provedor válido para usuário cliente', async () => {
    const { prisma } = prismaFor();
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(
      makeService(prisma).createUser('actor', { ...base, roleCode: 'cliente' }),
    ).rejects.toThrow('Selecione o provedor');
    prisma.customer.findFirst.mockResolvedValue(null);
    await expect(
      makeService(prisma).createUser('actor', { ...base, roleCode: 'cliente', customerId: 'x' }),
    ).rejects.toThrow('Provedor não encontrado');
  });

  it('grava o vínculo do cliente com o provedor', async () => {
    const { prisma } = prismaFor();
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.userTenant.findUnique.mockResolvedValue({ id: 'm-1' });
    await makeService(prisma).createUser('actor', {
      ...base,
      roleCode: 'cliente',
      customerId: 'customer-1',
    });
    expect(prisma.user.create.mock.calls[0][0].data.tenants.create).toMatchObject({
      customerId: 'customer-1',
    });
  });

  it('gerente não altera nem remove super admin', async () => {
    const { prisma } = prismaFor();
    prisma.userTenant.findUnique.mockResolvedValue({ id: 'm-1', role: { code: 'super_admin' } });
    prisma.userTenant.count.mockResolvedValue(1);
    const service = makeService(prisma);
    await expect(
      service.updateUserInTenant('actor', {
        userId: 'root',
        tenantId: 'tenant-1',
        password: 'nova-senha-123',
        actorRole: 'gerente',
      }),
    ).rejects.toThrow('Somente um super admin');
    await expect(
      service.removeUserFromTenant('actor', 'tenant-1', 'root', 'gerente'),
    ).rejects.toThrow('Somente um super admin');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('trocar e-mail de outra pessoa revoga as sessões dela', async () => {
    const { prisma, tx } = prismaFor();
    prisma.userTenant.findUnique.mockResolvedValue({ id: 'm-1', role: { code: 'analista' } });
    await makeService(prisma).updateUserInTenant('actor', {
      userId: 'user-2',
      tenantId: 'tenant-1',
      email: 'novo@ajust.com',
      actorRole: 'gerente',
    });
    expect(tx.session.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'user-2', revokedAt: null } }),
    );
  });
});
