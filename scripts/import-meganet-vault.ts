import { PrismaClient } from '@prisma/client';
import { readSgp } from '../apps/api/src/service-processes/sgp-reader';
import { parseAccessNote } from '../apps/api/src/customers/sgp-credential-parser';
import { encryptVaultSecret } from '../apps/api/src/common/vault.crypto';
const db = new PrismaClient();
async function main() {
  let token = ''; for await (const chunk of process.stdin) token += chunk;
  process.env.SGP_TOKEN = token.trim();
  const tenant = await db.tenant.findUniqueOrThrow({ where: { slug: 'ajust-demo' } });
  const actor = await db.userTenant.findFirstOrThrow({ where: { tenantId: tenant.id, role: { code: 'gerente' }, user: { status: 'ACTIVE' } } });
  const all = await readSgp('/api/ura/cliente/anotacao/list', {}, 'GET');
  if (!Array.isArray(all)) throw new Error('Formato de anotações não reconhecido.');
  const notes = all.filter(n => Number(n.cliente) === 60);
  let imported = 0, pending = 0, skipped = 0;
  for (const note of notes) for (const part of parseAccessNote(String(note.anotacao || ''), Number(note.id))) {
    const externalId = `ajustconsulting.sgp.net.br:cliente:60:anotacao:${note.id}:parte:${part.part}`;
    const existing = await db.knowledgeCredential.findUnique({ where: { tenantId_sourceSystem_externalId: { tenantId: tenant.id, sourceSystem: 'SGP', externalId } } });
    if (existing) { skipped++; continue; }
    const uncertain = part.ambiguous || part.missing.length > 0;
    if (uncertain) pending++;
    if (!process.argv.includes('--apply')) continue;
    await db.$transaction(async tx => {
      const row = await tx.knowledgeCredential.create({ data: {
        tenantId: tenant.id, createdById: actor.userId, provider: 'MEGANET', equipmentType: part.equipmentType,
        equipmentName: part.equipmentName.replace(/ · anotação SGP /g, ' · registro '),
        environment: 'Não informado', host: part.host, username: part.ambiguous ? '' : part.username,
        secretEnc: encryptVaultSecret(part.ambiguous ? '' : part.secret), sourceNoteEnc: encryptVaultSecret(part.sourceText),
        sourceSystem: 'SGP', externalId, accessMethod: /^https?:\/\//i.test(part.host) ? 'WEB' : 'OUTROS',
        notes: uncertain ? `Revisão necessária: ${part.ambiguous ? 'múltiplos acessos na mesma anotação; não foi presumida associação entre usuários e senhas. ' : ''}Campos não identificados: ${part.missing.join(', ') || 'associação dos acessos'}. Consulte a anotação original protegida antes de usar.` : 'Dados de acesso identificados por rótulos explícitos. Consulte a anotação original protegida para conferir instruções e particularidades.',
      } });
      await tx.auditLog.create({ data: { tenantId: tenant.id, actorUserId: actor.userId, action: 'OS_CREATE', resourceType: 'knowledge_credential', resourceId: row.id, metadata: { op: 'create', provider: 'MEGANET', import: true, requiresReview: uncertain } } });
    }); imported++;
  }
  console.log(JSON.stringify({ sourceNotes: notes.length, imported, requiresReview: pending, skipped, applied: process.argv.includes('--apply') }));
}
main().catch(() => { console.error('Importação não concluída. Verifique autorização SGP, conectividade e configuração do cofre. Nenhum segredo foi registrado no log.'); process.exitCode = 1; }).finally(() => db.$disconnect());
