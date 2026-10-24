import { PrismaClient } from '@prisma/client';
import { encryptVaultSecret, decryptVaultSecret } from '../apps/api/src/common/vault.crypto';
const db = new PrismaClient();
async function main() {
  const tenant = await db.tenant.findUniqueOrThrow({ where: { slug: 'ajust-demo' } });
  let count = 0;
  for (const row of await db.knowledgeCredential.findMany({
    where: { tenantId: tenant.id, sourceSystem: 'SGP' },
  })) {
    if (row.secretEnc.startsWith('vault:v1:') && row.sourceNoteEnc?.startsWith('vault:v1:'))
      continue;
    const secret = decryptVaultSecret(row.secretEnc),
      note = row.sourceNoteEnc ? decryptVaultSecret(row.sourceNoteEnc) : null;
    const changed = await db.knowledgeCredential.updateMany({
      where: { id: row.id, secretEnc: row.secretEnc, updatedAt: row.updatedAt },
      data: {
        secretEnc: encryptVaultSecret(secret),
        sourceNoteEnc: note === null ? null : encryptVaultSecret(note),
      },
    });
    count += changed.count;
  }
  console.log(JSON.stringify({ protectedWithDedicatedKey: count }));
}
main()
  .catch((e) => {
    console.error(e.name);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
