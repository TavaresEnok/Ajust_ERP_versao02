import { PrismaClient } from '@prisma/client';
import { importSgpSample } from '../apps/api/src/service-processes/import-sgp-sample';
const prisma = new PrismaClient();
importSgpSample(prisma, process.argv.includes('--apply'))
  .then((r) => console.log(JSON.stringify(r, null, 2)))
  .catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
