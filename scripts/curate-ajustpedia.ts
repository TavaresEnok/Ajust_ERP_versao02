import {PrismaClient} from '@prisma/client';
const db=new PrismaClient();
const notes=[
 {slug:'huawei-ver-interfaces-ip',title:'Ver IP e estado das interfaces Huawei',command:'display ip interface brief',description:'Lista os endereços IP e os estados físico e de protocolo das interfaces de camada 3. Comando de consulta Huawei VRP.',tags:['huawei','interfaces'],source:'https://info.support.huawei.com/hedex/api/pages/EDOC1000053358/YEF0907R/25/resources/en-us_cliref_0133018113.html'},
 {slug:'huawei-ver-tabela-arp',title:'Ver tabela ARP no Huawei',command:'display arp',description:'Consulta os pares IP/MAC aprendidos e suas interfaces. Comando de consulta Huawei VRP.',tags:['huawei','arp'],source:'https://info.support.huawei.com/hedex/api/pages/EDOC1100331440/AZM10131/04/resources/dc/display_arp.html'},
 {slug:'huawei-ver-rotas-ipv4',title:'Ver tabela de rotas IPv4 no Huawei',command:'display ip routing-table',description:'Lista as rotas IPv4 ativas, o próximo salto e a interface de saída. Comando de consulta Huawei VRP.',tags:['huawei','roteamento'],source:'https://info.support.huawei.com/hedex/api/pages/EDOC1100362944/AZN04029/05/resources/command/yunshan/DISPLAYROUTE_1%28ROUTEOM%29.html'},
];
async function main(){
 const tenant=await db.tenant.findUniqueOrThrow({where:{slug:'ajust-demo'}});
 const preserved=await db.knowledgeArticle.findFirstOrThrow({where:{id:'59411729-3108-4b76-988c-eb6f6cd783a7',tenantId:tenant.id}});
 const actor=await db.userTenant.findFirstOrThrow({where:{tenantId:tenant.id,role:{code:'gerente'},user:{status:'ACTIVE'}}});
 const demos=await db.knowledgeArticle.findMany({where:{tenantId:tenant.id,title:'Artigo E2E Atualizado',content:'Conteúdo do artigo criado automaticamente no e2e.'},select:{id:true,title:true,updatedAt:true}});
 if(demos.some(row=>row.id===preserved.id))throw new Error('Artigo protegido na seleção');
 if(!process.argv.includes('--apply')){console.log(JSON.stringify({demonstrations:demos.length,preserved:preserved.id,newArticles:notes.map(note=>note.title)}));return;}
 let removed=0,created=0;
 await db.$transaction(async tx=>{
  for(const demo of demos){const result=await tx.knowledgeArticle.deleteMany({where:{id:demo.id,tenantId:tenant.id,updatedAt:demo.updatedAt,title:'Artigo E2E Atualizado',content:'Conteúdo do artigo criado automaticamente no e2e.'}});if(result.count!==1)throw new Error('Artigo alterado durante revisão');removed++;await tx.auditLog.create({data:{tenantId:tenant.id,actorUserId:actor.userId,action:'OS_UPDATE',resourceType:'knowledge_article',resourceId:demo.id,metadata:{op:'delete',reason:'explicit_demo_cleanup',title:demo.title}}});}
  for(const note of notes){if(await tx.knowledgeArticle.findUnique({where:{tenantId_slug:{tenantId:tenant.id,slug:note.slug}}}))continue;
   const row=await tx.knowledgeArticle.create({data:{tenantId:tenant.id,authorUserId:actor.userId,title:note.title,slug:note.slug,content:`## Descricao\n${note.description}\n\n## Comando\n${note.command}`,isPublished:true,tags:{create:await Promise.all(note.tags.map(async name=>{const tag=await tx.knowledgeTag.upsert({where:{name},create:{name},update:{}});return{tagId:tag.id};}))}}});created++;
   await tx.auditLog.create({data:{tenantId:tenant.id,actorUserId:actor.userId,action:'OS_CREATE',resourceType:'knowledge_article',resourceId:row.id,metadata:{op:'create',reason:'technical_reference',source:note.source}}});
  }
 });
 const after=await db.knowledgeArticle.findUniqueOrThrow({where:{id:preserved.id}});if(after.content!==preserved.content||after.title!==preserved.title)throw new Error('Verificar artigo protegido');
 console.log(JSON.stringify({removed,created,preserved:preserved.id}));
}
main().catch(()=>{console.error('Curadoria não concluída; conferir a seleção dos artigos.');process.exitCode=1;}).finally(()=>db.$disconnect());
