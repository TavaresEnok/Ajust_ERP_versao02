import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'ajust-demo' },
    update: {},
    create: {
      legalName: 'Ajust Consultoria LTDA',
      tradeName: 'Ajust Demo',
      taxId: '00000000000100',
      slug: 'ajust-demo',
      domain: 'ajust-demo.local',
      timezone: 'America/Sao_Paulo',
      techContactName: 'NOC Ajust',
      techContactEmail: 'noc@ajust.local',
      techContactPhone: '+55-11-99999-0000',
      status: 'ACTIVE'
    }
  });

  const superAdminRole = await prisma.role.findUnique({
    where: { code: 'super_admin' }
  });

  if (!superAdminRole) {
    throw new Error('Role super_admin not found. Run db:seed:roles first.');
  }

  const email = process.env.SEED_ADMIN_EMAIL || 'admin@ajust.local';
  const password = process.env.SEED_ADMIN_PASSWORD || 'Admin@123456';

  const passwordHash = await hash(password, 12);

  const user = await prisma.user.upsert({
    where: { email },
    update: {
      name: 'Ajust Super Admin',
      passwordHash,
      status: 'ACTIVE',
      twoFactorEnabled: true
    },
    create: {
      name: 'Ajust Super Admin',
      email,
      passwordHash,
      status: 'ACTIVE',
      twoFactorEnabled: true
    }
  });

  await prisma.userTenant.upsert({
    where: {
      userId_tenantId: {
        userId: user.id,
        tenantId: tenant.id
      }
    },
    update: {
      roleId: superAdminRole.id
    },
    create: {
      userId: user.id,
      tenantId: tenant.id,
      roleId: superAdminRole.id
    }
  });

  // eslint-disable-next-line no-console
  console.log(`[seed] dev admin ready: ${email} tenant=${tenant.slug}`);
}

main()
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
