import { PrismaClient } from '@prisma/client';
import { vaultSourceNoteText } from '../apps/api/src/common/vault.crypto';
const db = new PrismaClient();
async function main() {
  const tenant = await db.tenant.findUniqueOrThrow({where:{slug:'ajust-demo'}});
  for (const id of ['3632','3213','2964','783']) {
    const rows = await db.knowledgeCredential.findMany({where:{tenantId:tenant.id,provider:'MEGANET',externalId:{contains:`:anotacao:${id}:`}}});
    console.log(JSON.stringify({note:id,parts:rows.map(r=>{
      const lines=vaultSourceNoteText(r.sourceNoteEnc).split('\n').map(l=>l.trim()).filter(Boolean);
      return {id:r.id,lines:lines.length, headings:lines.flatMap((l,i)=> {
        const match=l.match(/^(?:ACESSO\s+)?(?:SW\s+)?(DATACOM|GRAFANA|ZABBIX|LINUX|PHPIPAM)\b/i);
        return match ? [{line:i,kind:match[1].toUpperCase()}] : [];
      })};
    })}));
  }
}
main().catch(()=>{console.error('Inspeção indisponível');process.exitCode=1;}).finally(()=>db.$disconnect());
