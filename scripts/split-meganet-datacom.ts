require('./data-script-guard.cjs').assertDataScriptAllowed({ fixture: false });
import { PrismaClient } from '@prisma/client';
import { encryptVaultSecret, vaultSourceNoteText } from '../apps/api/src/common/vault.crypto';
const db = new PrismaClient();
async function main() {
  const tenant = await db.tenant.findUniqueOrThrow({where:{slug:'ajust-demo'}});
  const root = await db.knowledgeCredential.findUniqueOrThrow({where:{id:'37ac236d-ceed-47f2-a37b-01aa20a40cdd'}});
  if(root.tenantId!==tenant.id || root.provider!=='MEGANET' || !root.externalId?.includes(':anotacao:3632:')) throw new Error('Alvo inválido');
  const lines=vaultSourceNoteText(root.sourceNoteEnc).split('\n').map(l=>l.trim()).filter(Boolean);
  const starts=lines.flatMap((line,i)=>/^(?:ACESSO\s+)?(?:SW\s+)?DATACOM\b/i.test(line)?[i]:[]);
  if(starts.length!==4 || starts[0]!==0) throw new Error('Estrutura divergente');
  const locations=['Jardim Atlântico','Monte','Engenho Maranguape','Água Fria'];
  const normalize=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const sections=starts.map((start,i)=>{
    const heading=normalize(lines[start]);
    const matches=locations.filter(l=>heading.includes(normalize(l)));
    if(matches.length!==1) throw new Error('Local não identificado de forma única');
    return {name:`Switch Datacom — ${matches[0]}`,content:lines.slice(start,starts[i+1]??lines.length).join('\n')};
  });
  if(new Set(sections.map(s=>s.name)).size!==4) throw new Error('Local repetido');
  const actor=await db.userTenant.findFirstOrThrow({where:{tenantId:tenant.id,role:{code:'gerente'},user:{status:'ACTIVE'}}});
  if(!process.argv.includes('--apply')) {console.log(JSON.stringify({sections:sections.map(s=>s.name),applied:false}));return;}
  await db.$transaction(async tx=>{
    for(const [i,section] of sections.entries()) {
      const externalId=`${root.externalId}:equipment:${i+1}`;
      if(await tx.knowledgeCredential.findUnique({where:{tenantId_sourceSystem_externalId:{tenantId:tenant.id,sourceSystem:'SGP',externalId}}})) continue;
      const row=await tx.knowledgeCredential.create({data:{tenantId:tenant.id,createdById:actor.userId,provider:'MEGANET',equipmentType:'SW',equipmentName:section.name,environment:'Não informado',host:'',username:'',secretEnc:encryptVaultSecret(''),sourceSystem:'SGP',externalId,sourceNoteEnc:encryptVaultSecret(section.content),protectedContentEnc:encryptVaultSecret(section.content),notes:'Equipamento separado pelo cabeçalho explícito da anotação. A ficha protegida contém os endereços e todas as contas do bloco original. Acessos não testados.'}});
      await tx.auditLog.create({data:{tenantId:tenant.id,actorUserId:actor.userId,action:'OS_CREATE',resourceType:'knowledge_credential',resourceId:row.id,metadata:{op:'create',operation:'split_datacom',originalRecordId:root.id}}});
    }
    await tx.knowledgeCredential.update({where:{id:root.id},data:{equipmentName:'Datacom — documento original dos quatro switches',equipmentType:'DOCUMENTO',accessMethod:'SEM_ACESSO',host:'',username:'',secretEnc:encryptVaultSecret(''),notes:'Documento de referência preservado. Os quatro switches estão cadastrados separadamente em SW: Jardim Atlântico, Monte, Engenho Maranguape e Água Fria. Use os cadastros individuais para consultar os acessos.'}});
    await tx.auditLog.create({data:{tenantId:tenant.id,actorUserId:actor.userId,action:'OS_UPDATE',resourceType:'knowledge_credential',resourceId:root.id,metadata:{op:'update',operation:'preserve_split_original'}}});
  });
  console.log(JSON.stringify({equipmentRecords:4,originalPreserved:true,applied:true}));
}
main().catch(()=>{console.error('Separação não aplicada; conferir estrutura e limites da anotação.');process.exitCode=1;}).finally(()=>db.$disconnect());
