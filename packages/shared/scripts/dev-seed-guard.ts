/**
 * Seeds de desenvolvimento gravam contas com senha conhecida. Recusa rodar em produção ou
 * contra um banco que não seja local, salvo ALLOW_DEV_SEED=1 explícito.
 */
export function assertDevSeedAllowed(scriptName: string) {
  if (process.env.ALLOW_DEV_SEED === '1') return;
  if (process.env.NODE_ENV === 'production')
    throw new Error(`${scriptName}: recusado com NODE_ENV=production (use ALLOW_DEV_SEED=1).`);
  let host = '';
  try {
    host = new URL(process.env.DATABASE_URL || '').hostname;
  } catch {
    throw new Error(`${scriptName}: DATABASE_URL inválida.`);
  }
  if (!['localhost', '127.0.0.1', '::1', 'postgres'].includes(host))
    throw new Error(
      `${scriptName}: o banco ${host} não parece local. Para continuar mesmo assim, use ALLOW_DEV_SEED=1.`,
    );
}
