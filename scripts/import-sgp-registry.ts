require('./data-script-guard.cjs').assertDataScriptAllowed({ fixture: false });
import { PrismaClient } from '@prisma/client';
import { importSgpRegistry } from '../apps/api/src/customers/import-sgp-registry';
const prisma = new PrismaClient();
importSgpRegistry(prisma, process.argv.includes('--apply'))
  .then((result) => console.log(JSON.stringify(result, null, 2)))
  .catch((error: Error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
