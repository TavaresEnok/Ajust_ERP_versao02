// Shared preflight for maintenance entrypoints. Never print DATABASE_URL credentials.
function assertDataScriptAllowed({ fixture = false } = {}) {
  const args = process.argv.slice(2);
  if (!args.includes('--apply') || args.includes('--dry-run')) {
    console.log(
      'Modo de verificação: nenhuma conexão ou alteração executada. Para aplicar, use --apply --confirm-database=NOME e DATA_SCRIPT_BACKUP_VERIFIED=1.',
    );
    process.exit(0);
  }
  if (!['development', 'test', 'production'].includes(process.env.NODE_ENV)) {
    throw new Error('Defina NODE_ENV explicitamente antes de aplicar alterações.');
  }
  if (fixture && process.env.NODE_ENV !== 'development') {
    throw new Error('Fixtures e demonstrações só podem rodar com NODE_ENV=development.');
  }
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_DATA_SCRIPT !== '1') {
    throw new Error('Produção exige ALLOW_DATA_SCRIPT=1.');
  }
  let url;
  try {
    url = new URL(process.env.DATABASE_URL || 'invalid');
  } catch {
    throw new Error('DATABASE_URL inválida.');
  }
  if (!['postgres:', 'postgresql:'].includes(url.protocol))
    throw new Error('DATABASE_URL deve apontar para PostgreSQL.');
  const database = decodeURIComponent(url.pathname.slice(1));
  const confirmation = args
    .find((arg) => arg.startsWith('--confirm-database='))
    ?.slice('--confirm-database='.length);
  if (!database || confirmation !== database)
    throw new Error('Confirme explicitamente o nome do banco com --confirm-database=NOME.');
  if (process.env.DATA_SCRIPT_BACKUP_VERIFIED !== '1')
    throw new Error('Verifique o backup antes e defina DATA_SCRIPT_BACKUP_VERIFIED=1.');
}
module.exports = { assertDataScriptAllowed };
