require('./data-script-guard.cjs').assertDataScriptAllowed({ fixture: true });
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const [mode, token] = process.argv.slice(2);
  if (!/^[a-f0-9-]{36}$/.test(token || '')) throw new Error('Token de verificação inválido.');
  if (mode === 'create') {
    const tenant = await prisma.tenant.findUniqueOrThrow({ where: { slug: 'ajust-demo' } });
    const customer = await prisma.customer.create({
      data: {
        tenantId: tenant.id,
        taxId: `TOPOLOGY-TEST-${token}`,
        tradeName: `VERIFICAÇÃO TOPOLOGIA ${token.slice(0, 8)}`,
        legalName: 'Provedor temporário de verificação',
        personType: 'PJ',
        sourceMetadata: { topologyReviewToken: token },
      },
    });
    console.log(JSON.stringify({ customerId: customer.id, name: customer.tradeName }));
  } else if (mode === 'cleanup') {
    const customers = await prisma.customer.findMany({
      where: { taxId: `TOPOLOGY-TEST-${token}` },
    });
    for (const customer of customers) {
      if ((customer.sourceMetadata as Record<string, unknown>).topologyReviewToken !== token)
        throw new Error('Marcador de verificação não confere.');
      await prisma.customer.delete({ where: { id: customer.id } });
    }
    console.log('Provedor e diagramas temporários removidos.');
  } else throw new Error('Modo inválido.');
}
main()
  .catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
