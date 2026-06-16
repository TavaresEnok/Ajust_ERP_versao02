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
