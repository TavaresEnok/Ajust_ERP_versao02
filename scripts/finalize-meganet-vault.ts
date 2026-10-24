import { PrismaClient } from '@prisma/client';
import { encryptVaultSecret, vaultSourceNoteText } from '../apps/api/src/common/vault.crypto';
const db = new PrismaClient();
// Names and categories reviewed against the inventory; no credentials are stored in this file.
const names: Record<string, [string,string]> = {
 '3696':['ROUTER','RB — identificação a confirmar'], '3622':['ROUTER','CCR 2011 — Macedo Rocha'], '3600':['ROUTER','RB — Cisney / Pessonali'],
 '3532':['SISTEMA','SGP — Knet'], '3530':['OLT','Huawei MA5680T — acesso porta 2222'], '3529':['ROUTER','CCR 2116 — concentrador Knet'], '3528':['ROUTER','CCR 2004 — borda Knet'],
 '3330':['A CONFERIR','Acesso — finalidade a confirmar (3330)'], '3213':['SISTEMA','phpIPAM — aplicação e administração'], '3138':['ROUTER','RB 1016 — Gato Mercado'], '3129':['SW','TP-Link — Serrambi'], '3092':['ROUTER','RB 2011 — Igreja da Árvore'],
 '2890':['OLT','Huawei — Maranguape / Fox UP'], '2887':['FIREWALL','CGNAT — Hillstone'], '2859':['ENLACE','PTP Ubiquiti — Serrambi (AP, station e gateway)'], '2857':['OLT','GPON uma porta — Serrambi Sítio'], '2785':['SW','Huawei S6730 — Jardim Atlântico'],
 '2744':['SERVIDOR','LibreNMS — Debian'], '2743':['SISTEMA','LibreNMS — aplicação'], '2526':['OLT','VSOL EPON — Serrambi'], '2224':['ROUTER','RB 3011 — Serrambi'], '2223':['OLT','VSOL GPON — Porto de Galinhas'], '2208':['SW','Huawei S5720 — POP Monte'],
 '2129':['ACESSO REMOTO','AnyDesk — PC Central Grafana'], '1990':['A CONFERIR','Winbox — histórico de endereços (1990)'], '1962':['OLT','Huawei — Jardim Atlântico'], '1827':['ROUTER','RB 1100 — Lar de Acolhimento'], '1808':['SERVIDOR','Speedtest — administração SSH'],
 '1795':['SISTEMA','SGP — Konecta Telecom'], '1791':['OLT','Huawei — Água Fria / Konecta Telecom'], '1661':['OLT','Huawei — POP Monte'], '1559':['OLT','VSOL — local a confirmar'], '1323':['A CONFERIR','Conta e sistema — finalidade a confirmar (1323)'],
 '1250':['REDE','Rede Meganet — ASN e prefixos'], '1230':['SERVIDOR','PowerEdge R410 — acessos interno e externo'], '1157':['DNS','DNS Ajust'], '969':['A CONFERIR','Acesso por código — finalidade a confirmar (969)'], '799':['CIRCUITOS','Links e operadoras — contratos e capacidades'],
 '782':['A CONFERIR','Conta e sistema — finalidade a confirmar (782)'], '746':['SW','Huawei S6720 — Tabajara'], '735':['SISTEMA','Grafana — registro individual'], '725':['ROUTER','NE8000 — autenticador / BGP'], '705':['SISTEMA','SGP — Meganet'], '702':['DNS','DNS Meganet — cache'], '701':['OLT','Huawei MA5680T — identidade a confirmar'], '700':['OLT','Huawei — POP Tabajara'], '696':['ROUTER','CCR 1036 — gerência'], '695':['SERVIDOR','SGP — máquina de hospedagem'],
};
async function main() {
 const tenant=await db.tenant.findUniqueOrThrow({where:{slug:'ajust-demo'}});
 const actor=await db.userTenant.findFirstOrThrow({where:{tenantId:tenant.id,role:{code:'gerente'},user:{status:'ACTIVE'}}});
 const rows=await db.knowledgeCredential.findMany({where:{tenantId:tenant.id,provider:'MEGANET',sourceSystem:'SGP'}});
 let renamed=0,split=0;
 await db.$transaction(async tx=>{
  for(const row of rows) {
   const id=row.externalId?.match(/:anotacao:(\d+):/)?.[1];
   if(!id || row.externalId?.includes(':equipment:') || row.externalId?.includes(':section:')) continue;
   const metadata=row.sourceMetadata as Record<string,unknown>;
   if(metadata?.curationVersion===2) continue;
   let title=names[id];
   const original=vaultSourceNoteText(row.sourceNoteEnc);
   const lines=original.split('\n').map(l=>l.trim()).filter(Boolean);
   let cuts: {start:number; name:string; category:string}[]=[];
   if(['3213','2964','783'].includes(id)) {
    const linux=lines.findIndex(l=>/^LINUX\b/i.test(l));
    const head=/^GRAFANA\b/i.test(lines[0]||'')?'Grafana':id==='3213'?'phpIPAM':'Zabbix';
    title=['SISTEMA',`${head} — conjunto ${id}`];
    if(linux>0) cuts=[{start:0,name:`${head} — aplicação (${id})`,category:'SISTEMA'},{start:linux,name:`${head} — servidor e banco (${id})`,category:'SERVIDOR'}];
   }
   if(!title && id!=='3632') throw new Error('Registro fora do inventário');
   if(cuts.length) {
    // Preserve every line and original ordering; never guess which DB account belongs to Linux.
    for(const [index,cut] of cuts.entries()) {
     const externalId=`${row.externalId}:section:${index+1}`;
     if(await tx.knowledgeCredential.findUnique({where:{tenantId_sourceSystem_externalId:{tenantId:tenant.id,sourceSystem:'SGP',externalId}}})) continue;
     const body=lines.slice(cut.start,cuts[index+1]?.start??lines.length).join('\n');
     const child=await tx.knowledgeCredential.create({data:{tenantId:tenant.id,createdById:actor.userId,provider:'MEGANET',equipmentName:cut.name,equipmentType:cut.category,environment:'Não informado',accessMethod:index===0?'WEB':'SSH',host:'',username:'',secretEnc:encryptVaultSecret(''),sourceSystem:'SGP',externalId,sourceNoteEnc:encryptVaultSecret(body),protectedContentEnc:encryptVaultSecret(body),notes:`Parte do conjunto ${id}. Contas e endereços permanecem nos respectivos rótulos da ficha protegida. Não foi presumido que o usuário do sistema operacional seja o mesmo do banco. Acesso não testado.`,sourceMetadata:{curationVersion:2,relatedRecordId:row.id}}});
     await tx.auditLog.create({data:{tenantId:tenant.id,actorUserId:actor.userId,action:'OS_CREATE',resourceType:'knowledge_credential',resourceId:child.id,metadata:{op:'create',operation:'technical_section_split',originalRecordId:row.id}}}); split++;
    }
    title=['DOCUMENTO',`${title![1]} — documento de referência`];
   }
   await tx.knowledgeCredential.update({where:{id:row.id},data:{...(title?{equipmentType:title[0],equipmentName:title[1]}:{}),...(cuts.length?{host:'',username:'',secretEnc:encryptVaultSecret(''),accessMethod:'SEM_ACESSO'}:{}),sourceMetadata:{...metadata,curationVersion:2}}});
   await tx.auditLog.create({data:{tenantId:tenant.id,actorUserId:actor.userId,action:'OS_UPDATE',resourceType:'knowledge_credential',resourceId:row.id,metadata:{op:'update',operation:'meganet_inventory_v2'}}}); renamed++;
  }
 },{timeout:30000});
 const count=await db.knowledgeCredential.count({where:{tenantId:tenant.id,provider:'MEGANET'}});
 console.log(JSON.stringify({reviewed:renamed,createdSections:split,total:count}));
}
main().catch(()=>{console.error('Revisão revertida: conferir inventário e estrutura.');process.exitCode=1;}).finally(()=>db.$disconnect());
