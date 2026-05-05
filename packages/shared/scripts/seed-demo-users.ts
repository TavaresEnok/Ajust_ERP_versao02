import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';

const prisma = new PrismaClient();

const USERS = [
  {
    role: 'gerente',
    name: 'Ajust Gerente',
    email: process.env.SEED_MANAGER_EMAIL || 'gerente@ajust.local',
    password: process.env.SEED_MANAGER_PASSWORD || 'Gerente@123'
  },
  {
    role: 'analista',
    name: 'Ajust Analista',
    email: process.env.SEED_ANALYST_EMAIL || 'analista@ajust.local',
    password: process.env.SEED_ANALYST_PASSWORD || 'Analista@123'
  },
  {
    role: 'cliente',
    name: 'Cliente Tenant',
    email: process.env.SEED_CLIENT_EMAIL || 'cliente-interno@ajust.local',
    password: process.env.SEED_CLIENT_PASSWORD || '__USE_CNPJ_LAST4__'
  }
];

async function main() {
  const tenant = await prisma.tenant.findUnique({
    where: { slug: 'ajust-demo' }
  });

  if (!tenant) {
    throw new Error('Tenant ajust-demo not found. Run db:seed:dev-admin first.');
  }

  for (const item of USERS) {
    const role = await prisma.role.findUnique({
      where: { code: item.role }
    });
    if (!role) {
      throw new Error(`Role ${item.role} not found. Run db:seed:roles first.`);
    }

    const passwordHash = await hash(item.password, 12);
    const user = await prisma.user.upsert({
      where: { email: item.email.toLowerCase() },
      update: {
        name: item.name,
        passwordHash,
        status: 'ACTIVE',
        twoFactorEnabled: false
      },
      create: {
        name: item.name,
        email: item.email.toLowerCase(),
        passwordHash,
        status: 'ACTIVE',
        twoFactorEnabled: false
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
        roleId: role.id
      },
      create: {
        userId: user.id,
        tenantId: tenant.id,
        roleId: role.id
      }
    });

    console.log(`[seed] demo user ready: ${item.role} ${item.email} tenant=${tenant.slug}`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
