// One owner (Ajust), three access profiles. Never creates a tenant or copies customer data.
// Passwords are generated once, only outside the repository, and never printed.
const fs = require('node:fs');
const path = require('node:path');
const { randomBytes } = require('node:crypto');
const { PrismaClient } = require('@prisma/client');
const { hash } = require('../apps/api/node_modules/bcryptjs');
const output = process.env.ERP_REVIEW_ACCESS_FILE;
if (
  !output ||
  !path.isAbsolute(output) ||
  path.resolve(output).startsWith(path.resolve(__dirname, '..') + path.sep)
)
  throw new Error('Choose an absolute access-file path outside the repository.');
if (fs.existsSync(output))
  throw new Error('Access file already exists; refusing to reset accounts again.');
const prisma = new PrismaClient();
async function main() {
  const tenant = await prisma.tenant.findUniqueOrThrow({ where: { slug: 'ajust-demo' } });
  const meganet = await prisma.customer.findUniqueOrThrow({
    where: { tenantId_taxId: { tenantId: tenant.id, taxId: '22672493000149' } },
  });
  const anderson = await prisma.user.findUniqueOrThrow({
    where: {
      sourceSystem_externalId: {
        sourceSystem: 'SGP',
        externalId: 'ajustconsulting.sgp.net.br:tecnico:20',
      },
    },
    include: { tenants: { include: { role: true } } },
  });
  if (anderson.status !== 'BLOCKED' || anderson.deletedAt || anderson.twoFactorEnabled)
    throw new Error('Analyst no longer matches inactive imported account; review manually.');
  const membership = anderson.tenants.find((item) => item.tenantId === tenant.id);
  if (!membership || !['analista'].includes(membership.role.code))
    throw new Error('Unexpected analyst membership.');
  const roles = await prisma.role.findMany({ where: { code: { in: ['gerente', 'cliente'] } } });
  const roleId = (code) => {
    const role = roles.find((item) => item.code === code);
    if (!role) throw new Error('Missing role');
    return role.id;
  };
  const accounts = [
    {
      profile: 'Administrador da Ajust',
      name: 'Gestores · Administração Ajust',
      email: 'gestores.admin@ajust.invalid',
      role: 'gerente',
      portal: '/gerencia',
    },
    {
      profile: 'Anderson Alves · equipe Ajust',
      name: anderson.name,
      email: anderson.email,
      role: membership.role.code,
      portal: '/analista',
      id: anderson.id,
    },
    {
      profile: 'Cliente Meganet',
      name: 'MEGANET · Avaliação dos gestores',
      email: 'meganet.teste@ajust.invalid',
      role: 'cliente',
      portal: '/cliente',
    },
  ];
  for (const account of accounts) {
    account.password = 'Aj!' + randomBytes(15).toString('base64url');
    account.passwordHash = await hash(account.password, 12);
  }
  const createdAt = new Date().toISOString();
  const accessProvisioning = { method: 'ADMIN_PROVISIONED', purpose: 'MANAGER_REVIEW', createdAt };
  await prisma.$transaction(async (tx) => {
    for (const account of accounts) {
      const user = account.id
        ? await tx.user.update({
            where: { id: account.id },
            data: {
              status: 'ACTIVE',
              passwordHash: account.passwordHash,
              sourceMetadata: { ...anderson.sourceMetadata, accessProvisioning },
            },
          })
        : await tx.user.create({
            data: {
              name: account.name,
              email: account.email,
              passwordHash: account.passwordHash,
              status: 'ACTIVE',
              sourceMetadata: { accessProvisioning },
            },
          });
      if (!account.id)
        await tx.userTenant.create({
          data: {
            userId: user.id,
            tenantId: tenant.id,
            roleId: roleId(account.role),
            ...(account.role === 'cliente' ? { customerId: meganet.id } : {}),
          },
        });
      account.id = user.id;
      await tx.auditLog.create({
        data: {
          tenantId: tenant.id,
          actorUserId: null,
          action: user.id === anderson.id ? 'UPDATE_USER' : 'CREATE_USER',
          resourceType: 'manager_review_access',
          resourceId: user.id,
          metadata: {
            role: account.role,
            customerId: account.role === 'cliente' ? meganet.id : null,
            provisionedAt: createdAt,
            previousStatus: user.id === anderson.id ? 'BLOCKED' : null,
          },
        },
      });
    }
  });
  const safeAccounts = accounts.map(({ passwordHash, ...account }) => account);
  fs.writeFileSync(
    output,
    JSON.stringify(
      {
        createdAt,
        base: 'http://168.194.13.18:8070',
        tenantId: tenant.id,
        customerId: meganet.id,
        accounts: safeAccounts,
      },
      null,
      2,
    ),
    { mode: 0o600, flag: 'wx' },
  );
  console.log(
    JSON.stringify({
      created: accounts.length,
      tenantCount: await prisma.tenant.count(),
      sameAjustWorkspace: true,
      credentialsPrinted: false,
    }),
  );
}
main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
