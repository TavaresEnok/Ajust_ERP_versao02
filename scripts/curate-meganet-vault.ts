import { readFileSync } from 'node:fs';
import { PrismaClient } from '@prisma/client';
import { encryptVaultSecret, vaultSourceNoteText } from '../apps/api/src/common/vault.crypto';
const db = new PrismaClient();
async function main() {
  const tenant = await db.tenant.findUniqueOrThrow({ where: { slug: 'ajust-demo' } });
  const actor = await db.userTenant.findFirstOrThrow({ where: { tenantId: tenant.id, role: { code: 'gerente' }, user: { status: 'ACTIVE' } } });
  const plan = readFileSync('docs/analise-sgp/meganet-base-tecnica-revisao.md', 'utf8').split('\n').flatMap(line => {
    const m = line.match(/^\|(\d+)\|([^|]+)\|([^|]+)\|$/);
    return m ? [{ id: m[1], content: m[2], treatment: m[3] }] : [];
  });
  if (plan.length !== 51) throw new Error('Inventário incompleto.');
  const rows = await db.knowledgeCredential.findMany({ where: { tenantId: tenant.id, provider: 'MEGANET', sourceSystem: 'SGP' } });
  const changes = rows.map(row => {
    const id = row.externalId?.match(/:anotacao:(\d+):/)?.[1];
    const entry = plan.find(p => p.id === id);
    if (!entry || !row.sourceNoteEnc) throw new Error('Registro sem correspondência protegida.');
    return { row, entry, original: vaultSourceNoteText(row.sourceNoteEnc) };
  });
  if (new Set(changes.map(c => c.entry.id)).size !== 51) throw new Error('Cobertura incompleta.');
  let updated = 0;
  for (const {row, entry, original} of changes) {
    if (row.protectedContentEnc) continue; // Nunca sobrescrever edição da equipe ao repetir.
    if (!process.argv.includes('--apply')) { updated++; continue; }
    await db.$transaction(async tx => {
      const result = await tx.knowledgeCredential.updateMany({ where: { id: row.id, tenantId: tenant.id, updatedAt: row.updatedAt, protectedContentEnc: null }, data: {
        notes: `CONTEÚDO IDENTIFICADO\n${entry.content}\n\nCUIDADOS E ORGANIZAÇÃO\n${entry.treatment}\n\nSituação: organização inicial; acessos não testados. Consulte a ficha protegida para os valores.`,
        protectedContentEnc: encryptVaultSecret(`IDENTIFICAÇÃO\n${entry.content}\n\nORIENTAÇÕES DE CONFERÊNCIA\n${entry.treatment}\n\nDADOS PRESERVADOS DESTE REGISTRO\n${original}`),
        ...(entry.id === '1250' ? {equipmentName:'Rede Meganet — ASN e prefixos', equipmentType:'REDE', accessMethod:'SEM_ACESSO', host:'', username:'', secretEnc:encryptVaultSecret('')} : {}),
        ...(entry.id === '799' ? {equipmentName:'Links e operadoras — contratos e capacidades', equipmentType:'CIRCUITOS', accessMethod:'SEM_ACESSO', host:'', username:'', secretEnc:encryptVaultSecret('')} : {}),
      } });
      if (result.count !== 1) throw new Error('Registro alterado durante a revisão.');
      await tx.auditLog.create({ data: { tenantId: tenant.id, actorUserId: actor.userId, action:'OS_UPDATE', resourceType:'knowledge_credential', resourceId:row.id, metadata:{op:'update', operation:'meganet_curated_inventory_v1', sourceNoteId:entry.id} } });
    });
    updated++;
  }
  console.log(JSON.stringify({sourceNotes:51, records:rows.length, updated, applied:process.argv.includes('--apply')}));
}
main().catch(() => {console.error('Revisão interrompida; nenhum conteúdo sensível registrado no log.'); process.exitCode=1;}).finally(() => db.$disconnect());
