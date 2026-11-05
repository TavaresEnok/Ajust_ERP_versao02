require('./data-script-guard.cjs').assertDataScriptAllowed({ fixture: false });
import {PrismaClient} from '@prisma/client';
import {encryptVaultSecret,decryptVaultSecret,vaultSourceNoteText} from '../apps/api/src/common/vault.crypto';
import {packVaultContent,unpackVaultContent,VaultAccessSchema,type VaultAccess} from '../apps/api/src/common/vault-content';
const db=new PrismaClient();
function explicitFields(lines:string[],pattern:RegExp){
 const result:string[]=[];
 for(let index=0;index<lines.length;index++){const match=lines[index].match(pattern);if(!match)continue;const value=(match[1]||lines[index+1]||'').trim();if(value&&!/^(?:ip|porta|login|senha)\s*:?$/i.test(value))result.push(value);}
 return result;
}
async function main(){
 const tenant=await db.tenant.findUniqueOrThrow({where:{slug:'ajust-demo'}}),actor=await db.userTenant.findFirstOrThrow({where:{tenantId:tenant.id,role:{code:'gerente'},user:{status:'ACTIVE'}}});
 const rows=await db.knowledgeCredential.findMany({where:{tenantId:tenant.id,provider:'MEGANET',parentCredentialId:null,equipmentType:{notIn:['DOCUMENTO','REDE','CIRCUITOS','A CONFERIR']}}});
 const changes:{row:typeof rows[number];text:string;entry:VaultAccess}[]=[];let pending=0,already=0;
 for(const row of rows){
  const old=unpackVaultContent(row.protectedContentEnc?decryptVaultSecret(row.protectedContentEnc):null);if(old.accessEntries.length){already++;continue;}
  let host=row.host,username=row.username,secret=decryptVaultSecret(row.secretEnc),method=row.accessMethod,port:number|null=null;
  if(row.externalId?.includes(':anotacao:3632:')&&row.externalId.includes(':equipment:')){
   const lines=vaultSourceNoteText(row.sourceNoteEnc).split('\n').map(line=>line.trim()).filter(Boolean);
   const hosts=explicitFields(lines,/^IP\s*(?::\s*(.*)|$)/i),users=explicitFields(lines,/^LOGIN\s*(?::\s*(.*)|$)/i),secrets=explicitFields(lines,/^SENHA\s*(?::\s*(.*)|$)/i),ports=explicitFields(lines,/^PORTA(?:\s+SSH)?\s*(?::\s*(.*)|$)/i);
   if(hosts.length===1&&users.length===1&&secrets.length===1&&!lines.some(line=>/nova\s+senha|senha\s+antiga/i.test(line))){host=hosts[0];username=users[0];secret=secrets[0];method='SSH';if(ports.length===1&&/^\d+$/.test(ports[0]))port=Number(ports[0]);}
  }
  if(!host||!username||!secret||/[\s/,;\n]/.test(username)||!['WEB','SSH','WINBOX','TELNET','RDP','ANYDESK','BANCO','OUTROS'].includes(method)){pending++;continue;}
  if(/^https?:\/\//i.test(host)){try{const url=new URL(host);if(url.username||url.password){pending++;continue;}if(url.port)port=Number(url.port);}catch{pending++;continue;}}
  else{const endpoint=host.match(/^((?:\d{1,3}\.){3}\d{1,3})(?::(\d{1,5}))?$/);if(!endpoint){pending++;continue;}host=endpoint[1];if(endpoint[2])port=Number(endpoint[2]);}
  const entry=VaultAccessSchema.parse({label:'Acesso principal',method,host,port,context:'',username,secret,notes:''});
  changes.push({row,text:old.text,entry});
 }
 if(process.argv.includes('--apply'))await db.$transaction(async tx=>{for(const {row,text,entry} of changes){const result=await tx.knowledgeCredential.updateMany({where:{id:row.id,tenantId:tenant.id,updatedAt:row.updatedAt},data:{host:entry.host,username:entry.username,accessMethod:entry.method,secretEnc:encryptVaultSecret(entry.secret),protectedContentEnc:encryptVaultSecret(packVaultContent(text,[entry]))}});if(result.count!==1)throw new Error('Registro alterado durante a organização');await tx.auditLog.create({data:{tenantId:tenant.id,actorUserId:actor.userId,action:'OS_UPDATE',resourceType:'knowledge_credential',resourceId:row.id,metadata:{op:'update',operation:'structured_access_v2',accessCount:1}}});}},{timeout:30000});
 console.log(JSON.stringify({organized:changes.length,already,pendingReview:pending,applied:process.argv.includes('--apply')}));
}
main().catch(()=>{console.error('Organização interrompida; nenhum acesso sensível foi registrado no log.');process.exitCode=1;}).finally(()=>db.$disconnect());
