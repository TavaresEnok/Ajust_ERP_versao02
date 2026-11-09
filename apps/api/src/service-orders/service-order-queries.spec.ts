import {
  buildOrderOrderBy,
  buildOrderWhere,
  isCustomerRole,
  sanitizeOrderForRole,
} from './service-order-queries';

describe('service-order-queries', () => {
  it('cliente só vê O.S. visíveis e sem notas internas', () => {
    expect(isCustomerRole('cliente')).toBe(true);
    expect(buildOrderWhere('t1', {}, 'cliente')).toMatchObject({
      tenantId: 't1',
      deletedAt: null,
      isCustomerVisible: true,
    });
    expect(buildOrderWhere('t1', {}, 'analista')).not.toHaveProperty('isCustomerVisible');
    expect(sanitizeOrderForRole({ internalNotes: 'x', approvals: [1] }, 'cliente')).toEqual({
      internalNotes: null,
      approvals: [],
    });
    expect(sanitizeOrderForRole({ internalNotes: 'x' }, 'gerente')).toEqual({ internalNotes: 'x' });
  });

  it('combina situação, responsável e provedor sem perder restrições', () => {
    const where = buildOrderWhere('t1', {
      situation: 'active',
      responsibleUserId: 'u1',
      provider: 'Meganet',
    });
    expect(where.AND).toHaveLength(3);
    expect(where.AND).toEqual(
      expect.arrayContaining([
        { status: { notIn: ['RESOLVIDA', 'FECHADA', 'CANCELADA'] } },
        { OR: [{ ownerUserId: 'u1' }, { assigneeUserId: 'u1' }] },
      ]),
    );
  });

  it('ordenação é estável pelo id', () => {
    expect(buildOrderOrderBy({})).toEqual([{ createdAt: 'desc' }, { id: 'asc' }]);
    expect(buildOrderOrderBy({ orderBy: 'priority', orderDir: 'asc' })).toEqual([
      { priority: 'asc' },
      { id: 'asc' },
    ]);
  });
});
