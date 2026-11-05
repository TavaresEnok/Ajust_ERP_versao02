#!/usr/bin/env node
if (process.argv.includes('--apply') && !process.argv.includes('--dry-run'))
  require('./data-script-guard.cjs').assertDataScriptAllowed({ fixture: false });
/**
 * Recriptografa os dados protegidos por SECRETS_ENCRYPTION_KEY (formato enc:v1) com uma chave nova.
 * Hoje: NetworkTopology.xmlEnc, NetworkTopologyRevision.xmlEnc, User.twoFactorSecretEnc,
 * ProviderIntegration.webhookSecretEnc / apiTokenEnc e campos enc:v1 do cofre (KnowledgeCredential).
 * O cofre novo (vault:v1) usa a chave em arquivo e não é tocado.
 *
 * Uso (simulação, padrão):
 *   OLD_SECRETS_ENCRYPTION_KEY=... NEW_SECRETS_ENCRYPTION_KEY=... DATABASE_URL=... node scripts/rotate-secrets-key.cjs
 * Gravar de verdade (uma transação; confere cada valor depois):
 *   ... node scripts/rotate-secrets-key.cjs --apply --confirm-database=<nome do banco>
 */
const { createCipheriv, createDecipheriv, createHash, randomBytes } = require('node:crypto');
const { PrismaClient } = require(
  require.resolve('@prisma/client', {
    paths: [require('node:path').join(__dirname, '../apps/api')],
  }),
);

const PREFIX = 'enc:v1:';
const apply = process.argv.includes('--apply') && !process.argv.includes('--dry-run');
const confirm = (process.argv.find((a) => a.startsWith('--confirm-database=')) || '').split('=')[1];
const oldRaw = process.env.OLD_SECRETS_ENCRYPTION_KEY;
const newRaw = process.env.NEW_SECRETS_ENCRYPTION_KEY;
if (!oldRaw || !newRaw)
  throw new Error('Defina OLD_SECRETS_ENCRYPTION_KEY e NEW_SECRETS_ENCRYPTION_KEY.');
if (oldRaw === newRaw) throw new Error('A chave nova é igual à antiga.');
const dbName = new URL(process.env.DATABASE_URL).pathname.replace(/^\//, '');
if (apply && confirm !== dbName) throw new Error(`Use --confirm-database=${dbName} para gravar.`);

const key = (raw) => createHash('sha256').update(raw).digest();
const oldKey = key(oldRaw);
const newKey = key(newRaw);

function decrypt(value, k) {
  const [iv, tag, data] = value.slice(PREFIX.length).split('.');
  const d = createDecipheriv('aes-256-gcm', k, Buffer.from(iv, 'base64'));
  d.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([d.update(Buffer.from(data, 'base64')), d.final()]).toString('utf8');
}
function encrypt(plain, k) {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', k, iv);
  const body = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
  return `${PREFIX}${iv.toString('base64')}.${c.getAuthTag().toString('base64')}.${body.toString('base64')}`;
}

const TARGETS = [
  ['NetworkTopology', ['xmlEnc']],
  ['NetworkTopologyRevision', ['xmlEnc']],
  ['User', ['twoFactorSecretEnc']],
  ['ProviderIntegration', ['webhookSecretEnc', 'apiTokenEnc']],
  ['KnowledgeCredential', ['secretEnc', 'protectedContentEnc', 'totpSecretEnc', 'sourceNoteEnc']],
];

async function main() {
  const prisma = new PrismaClient();
  const plan = [];
  const problems = [];
  for (const [table, columns] of TARGETS) {
    for (const column of columns) {
      const rows = await prisma.$queryRawUnsafe(
        `SELECT id, "${column}" AS v FROM "${table}" WHERE "${column}" LIKE 'enc:v1:%'`,
      );
      for (const row of rows) {
        try {
          const plain = decrypt(row.v, oldKey);
          plan.push({ table, column, id: row.id, plain, next: encrypt(plain, newKey) });
        } catch {
          problems.push(`${table}.${column} ${row.id}`);
        }
      }
      const other = await prisma.$queryRawUnsafe(
        `SELECT count(*)::int n FROM "${table}" WHERE "${column}" IS NOT NULL AND "${column}" <> '' AND "${column}" NOT LIKE 'enc:v1:%' AND "${column}" NOT LIKE 'vault:v1:%'`,
      );
      if (other[0].n)
        problems.push(`${table}.${column}: ${other[0].n} valor(es) em formato antigo`);
    }
  }
  const summary = {};
  for (const p of plan)
    summary[`${p.table}.${p.column}`] = (summary[`${p.table}.${p.column}`] || 0) + 1;
  console.log(`Banco: ${dbName}`, summary);
  if (problems.length) {
    console.error('Não foi possível ler com a chave antiga:', problems);
    process.exitCode = 1;
    await prisma.$disconnect();
    return;
  }
  if (!apply) {
    console.log(`Simulação: ${plan.length} valor(es) seriam recriptografados. Nada foi gravado.`);
    await prisma.$disconnect();
    return;
  }
  await prisma.$transaction(
    async (tx) => {
      for (const p of plan)
        await tx.$executeRawUnsafe(
          `UPDATE "${p.table}" SET "${p.column}" = $1 WHERE id = $2`,
          p.next,
          p.id,
        );
      for (const p of plan) {
        const [row] = await tx.$queryRawUnsafe(
          `SELECT "${p.column}" AS v FROM "${p.table}" WHERE id = $1`,
          p.id,
        );
        if (decrypt(row.v, newKey) !== p.plain)
          throw new Error(`Conferência falhou em ${p.table} ${p.id}`);
      }
    },
    { timeout: 120000 },
  );
  console.log(`Gravado e conferido: ${plan.length} valor(es) com a chave nova.`);
  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
