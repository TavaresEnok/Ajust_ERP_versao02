import { PrismaClient } from '@prisma/client';
import { encryptVaultSecret } from '../apps/api/src/common/vault.crypto';
import { readSgp } from '../apps/api/src/service-processes/sgp-reader';
import { noteText } from '../apps/api/src/customers/sgp-credential-parser';
const db = new PrismaClient();
async function main() {
  const tenant = await db.tenant.findUniqueOrThrow({ where: { slug: 'ajust-demo' } });
  const all = await readSgp('/api/ura/cliente/anotacao/list', {}, 'GET');
  let updated = 0;
  for (const row of await db.knowledgeCredential.findMany({
    where: { tenantId: tenant.id, sourceSystem: 'SGP' },
  })) {
    const meta = row.sourceMetadata as Record<string, any>;
    const note = all.find(
      (n: any) => Number(n.id) === meta.noteId && Number(n.cliente) === meta.sourceCustomerId,
    );
    if (!note) throw new Error('Anotação/cliente de origem divergente.');
    const html = String(note.anotacao || '');
    const links = [...html.matchAll(/\bhref\s*=\s*["']([^"']+)["']/gi)].map((m) => m[1]);
    const text = `Original completo da anotação SGP #${note.id}. Uma anotação pode conter vários acessos.\n\n${noteText(html)}${links.length ? `\n\nLinks preservados do HTML:\n${links.join('\n')}` : ''}`;
    await db.knowledgeCredential.update({
      where: { id: row.id },
      data: { sourceNoteEnc: encryptVaultSecret(`sgp-note:v1:${JSON.stringify({ html, text })}`) },
    });
    updated++;
  }
  console.log(JSON.stringify({ protectedFullSourceNotes: updated }));
}
main()
  .catch((e) => {
    console.error(e.name);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
