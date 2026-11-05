require('./data-script-guard.cjs').assertDataScriptAllowed({ fixture: false });
import { PrismaClient } from '@prisma/client';
import { importSgpPilot } from '../apps/api/src/service-processes/import-sgp-pilot';

const prisma = new PrismaClient();
importSgpPilot(prisma, process.argv.includes('--apply'))
  .then((result) => console.log(JSON.stringify(result, null, 2)))
  .catch((error) => {
    console.error(error instanceof Error ? error.message : 'Falha na importação');
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
