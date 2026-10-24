import { PrismaClient } from '@prisma/client';
import { decryptVaultSecret as decryptSecret } from '../apps/api/src/common/vault.crypto';
const db = new PrismaClient();
async function main() {
  const rows = await db.knowledgeCredential.findMany({ where: { sourceSystem: 'SGP' } });
  let rawNotes = 0,
    publicNameLeaks = 0, publicHostMatches=0;
  for (const row of rows) {
    const secret = decryptSecret(row.secretEnc);
    if(secret.length>=5&&row.host.includes(secret))publicHostMatches++;
    if (row.sourceNoteEnc && decryptSecret(row.sourceNoteEnc)) rawNotes++;
    if (
      secret.length >= 5 &&
      (row.equipmentName.includes(secret) || (row.notes || '').includes(secret))
    ) {
      publicNameLeaks++;
      if (process.argv.includes('--repair-public-names'))
        await db.knowledgeCredential.update({
          where: { id: row.id },
          data: {
            equipmentName: row.equipmentName.split(secret).join('[trecho protegido]'),
            notes: row.notes?.split(secret).join('[trecho protegido]'),
            sourceMetadata: { ...(row.sourceMetadata as object), publicFieldsSanitized: true },
          },
        });
    }
  }
  console.log(
    JSON.stringify({ records: rows.length, protectedOriginalNotes: rawNotes, publicNameLeaks,publicHostMatches }),
  );
  if (publicNameLeaks) process.exitCode = 2;
}
main()
  .catch((e) => {
    console.error(e.name);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
