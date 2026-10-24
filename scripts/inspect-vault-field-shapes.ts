import {PrismaClient} from '@prisma/client';
import {vaultSourceNoteText} from '../apps/api/src/common/vault.crypto';
const db=new PrismaClient();
async function main(){
 const rows=await db.knowledgeCredential.findMany({where:{provider:'MEGANET',externalId:{contains:':equipment:'}}});
 for(const row of rows){const lines=vaultSourceNoteText(row.sourceNoteEnc).split('\n').map(line=>line.trim()).filter(Boolean);console.log(JSON.stringify({id:row.id,type:row.equipmentType,shape:lines.map((line,index)=>{const label=line.match(/^(IP|PORTA|PORT|LOGIN|USU[ÁA]RIO|USER|SENHA|PASSWORD|HOST|URL|SSH)(?:\s*[:=]|$)/i);return{index,type:label?label[1].toUpperCase():'value'};})}));}
}
main().catch(()=>{console.error('Inspeção indisponível');process.exitCode=1;}).finally(()=>db.$disconnect());
