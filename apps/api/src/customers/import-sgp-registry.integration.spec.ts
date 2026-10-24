import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { importSgpRegistry, SGP_CUSTOMERS } from './import-sgp-registry';

const dbDescribe = process.env.REGISTRY_DB_TESTS === '1' ? describe : describe.skip;
dbDescribe('Cadastral import: atomic real-DB scenario, always rolled back', () => {
  const prisma = new PrismaClient();
  afterAll(() => prisma.$disconnect());
  it('imports safely, blocks access, audits and is idempotent without touching operational records', async () => {
    const rollback = new Error('ROLLBACK_REGISTRY_TEST');
    const oldToken = process.env.SGP_TOKEN,
      oldSlug = process.env.REGISTRY_TENANT_SLUG;
    process.env.SGP_TOKEN = 'test-only';
    try {
      await prisma.$transaction(
        async (tx) => {
          const suffix = randomUUID();
          const tenant = await tx.tenant.create({
            data: {
              legalName: 'Transactional registry test',
              tradeName: 'TEST',
              slug: suffix,
              domain: `${suffix}.invalid`,
              taxId: suffix,
              techContactName: '',
              techContactEmail: '',
              techContactPhone: '',
            },
          });
          process.env.REGISTRY_TENANT_SLUG = tenant.slug;
          const facade = {
            ...tx,
            $transaction: (cb: (transaction: typeof tx) => unknown) => cb(tx),
          } as unknown as PrismaClient;
          const fetcher = (async (url: string, init: RequestInit) => {
            if (url.endsWith('/tecnicos/'))
              return new Response(
                JSON.stringify([
                  { id: 999999, username: 'transaction_test', nome: `Registry ${suffix}` },
                  { id: 23, username: 'Chamados_em_Espera', nome: '' },
                ]),
              );
            const spec = SGP_CUSTOMERS.find(
              (x) => String(x.id) === (init.body as URLSearchParams).get('cliente_id'),
            )!;
            return new Response(
              JSON.stringify({
                clientes: [
                  {
                    id: spec.id,
                    nome: `Original ${spec.tradeName}`,
                    cpfcnpj: spec.taxId,
                    tipo: 'J',
                    contatos: { emails: ['test@example.invalid'] },
                  },
                ],
              }),
            );
          }) as typeof fetch;
          const result = await importSgpRegistry(facade, true, fetcher);
          expect(result.status).toBe('IMPORTED');
          expect('before' in result && result.before).toEqual('after' in result && result.after);
          expect(await tx.customer.count({ where: { tenantId: tenant.id } })).toBe(6);
          const member = await tx.userTenant.findFirstOrThrow({
            where: { tenantId: tenant.id },
            include: { user: true, role: true },
          });
          expect(member.user.status).toBe('BLOCKED');
          expect(member.user.email).toMatch(/\.invalid$/);
          expect(member.role.code).toBe('analista');
          expect(member.user.sourceMetadata).toMatchObject({
            emailMissing: true,
            roleVerified: false,
          });
          const audited = await tx.auditLog.count({ where: { tenantId: tenant.id } });
          expect(audited).toBe(8);
          const repeat = await importSgpRegistry(facade, true, fetcher);
          expect(repeat.status).toBe('ALREADY_IMPORTED');
          expect(await tx.userTenant.count({ where: { tenantId: tenant.id } })).toBe(1);
          expect(await tx.auditLog.count({ where: { tenantId: tenant.id } })).toBe(audited);
          throw rollback;
        },
        { timeout: 30000 },
      );
    } catch (error) {
      if (error !== rollback) throw error;
    } finally {
      if (oldToken === undefined) delete process.env.SGP_TOKEN;
      else process.env.SGP_TOKEN = oldToken;
      if (oldSlug === undefined) delete process.env.REGISTRY_TENANT_SLUG;
      else process.env.REGISTRY_TENANT_SLUG = oldSlug;
    }
  });
});
