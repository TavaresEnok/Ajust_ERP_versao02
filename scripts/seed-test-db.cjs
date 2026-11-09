const { PrismaClient } = require('@prisma/client');
const { randomUUID } = require('node:crypto');
const url = new URL(process.env.DATABASE_URL || 'invalid');
if (
  process.env.NODE_ENV === 'production' ||
  !['localhost', '127.0.0.1'].includes(url.hostname) ||
  url.pathname !== '/ajust_ci'
) {
  throw new Error('Seed exclusivo do banco local descartável ajust_ci.');
}
const prisma = new PrismaClient();
async function main() {
  if (await prisma.tenant.count()) throw new Error('O seed exige banco vazio.');
  await prisma.$transaction(async (tx) => {
    const tenant = await tx.tenant.create({
      data: {
        legalName: 'CI tenant',
        tradeName: 'CI',
        taxId: randomUUID(),
        slug: 'ci',
        domain: 'ci.invalid',
        orderOrigins: ['Monitoramento', 'Telefone'],
        techContactName: 'CI',
        techContactEmail: 'ci@example.invalid',
        techContactPhone: '',
      },
    });
    const { createRequire } = require('node:module');
    const apiRequire = createRequire(
      require('node:path').resolve(__dirname, '../apps/api/package.json'),
    );
    apiRequire('tsx/cjs');
    const { ajustFlow } = require('../apps/api/src/service-processes/ajust-default-flows.ts');
    const flow = ajustFlow('AJUST_SIMPLES');
    await tx.serviceProcessTemplate.create({
      data: {
        tenantId: tenant.id,
        code: flow.code,
        version: 1,
        definition: JSON.parse(JSON.stringify(flow)),
        publishedAt: new Date(),
      },
    });
    const customer = await tx.customer.create({
      data: {
        tenantId: tenant.id,
        legalName: 'CI provider',
        tradeName: 'CI provider',
        personType: 'J',
      },
    });
    await tx.tenantSector.create({ data: { tenantId: tenant.id, name: 'NOC' } });
    const passwordHash = process.env.SEED_E2E_PASSWORD
      ? await require('../apps/api/node_modules/bcryptjs').hash(process.env.SEED_E2E_PASSWORD, 10)
      : 'disabled-ci-login';
    for (const code of ['super_admin', 'gerente', 'analista', 'cliente']) {
      const role = await tx.role.upsert({
        where: { code },
        create: { code, name: code },
        update: {},
      });
      const user = await tx.user.create({
        data: {
          name: code,
          email: `${code}@example.invalid`,
          passwordHash,
          ...(code === 'cliente'
            ? { sourceMetadata: { accessProvisioning: { method: 'ADMIN_PROVISIONED' } } }
            : {}),
        },
      });
      await tx.userTenant.create({
        data: {
          tenantId: tenant.id,
          roleId: role.id,
          userId: user.id,
          ...(code === 'cliente' ? { customerId: customer.id } : {}),
        },
      });
    }
  });
}
main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
