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
        techContactName: 'CI',
        techContactEmail: 'ci@example.invalid',
        techContactPhone: '',
      },
    });
    for (const code of ['super_admin', 'gerente', 'analista', 'cliente']) {
      const role = await tx.role.upsert({
        where: { code },
        create: { code, name: code },
        update: {},
      });
      const user = await tx.user.create({
        data: { name: code, email: `${code}@example.invalid`, passwordHash: 'disabled-ci-login' },
      });
      await tx.userTenant.create({
        data: { tenantId: tenant.id, roleId: role.id, userId: user.id },
      });
    }
    await tx.customer.create({
      data: {
        tenantId: tenant.id,
        legalName: 'CI provider',
        tradeName: 'CI provider',
        personType: 'J',
      },
    });
  });
}
main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
