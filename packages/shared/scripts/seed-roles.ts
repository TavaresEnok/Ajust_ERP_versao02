import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const roles = [
  { code: 'super_admin', name: 'Super Admin', isGlobal: true },
  { code: 'gerente', name: 'Gerente', isGlobal: false },
  { code: 'analista', name: 'Analista', isGlobal: false },
  { code: 'tecnico', name: 'Tecnico', isGlobal: false },
  { code: 'cliente', name: 'Cliente', isGlobal: false },
  { code: 'leitura', name: 'Leitura', isGlobal: false }
];

async function main() {
  for (const role of roles) {
    await prisma.role.upsert({
      where: { code: role.code },
      update: {
        name: role.name,
        isGlobal: role.isGlobal
      },
      create: role
    });
  }

  // eslint-disable-next-line no-console
  console.log(`[seed] roles upserted: ${roles.length}`);
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
