/**
 * Gerador único de protocolo de O.S. (auditoria C-067): AAAA + 6 dígitos, a partir do maior
 * número já emitido no ano (100001 no primeiro). Prefixos como WF-, MNT- ou SGP- ficam de fora.
 * Toda criação numera dentro de uma transação com trava por tenant (nextOrderProtocolInTransaction),
 * então duas criações simultâneas não pegam o mesmo número.
 * O worker (`apps/worker/src/integrations/ixc-reconciliation.service.ts`) usa a mesma consulta.
 */
type RawQuery = {
  $queryRaw<T = unknown>(query: TemplateStringsArray, ...values: unknown[]): Promise<T>;
};

export async function nextOrderProtocol(db: RawQuery, tenantId: string, now = new Date()) {
  const year = now.getFullYear();
  const rows = await db.$queryRaw<{ max: number | null }[]>`
    SELECT MAX(CAST(SUBSTRING("protocol" FROM 5) AS INTEGER)) AS "max"
    FROM "ServiceOrder"
    WHERE "tenantId" = ${tenantId} AND "protocol" ~ ${`^${year}[0-9]{6}$`}`;
  return `${year}${Math.max(Number(rows[0]?.max ?? 0), 100000) + 1}`;
}

export function isUniqueCollision(error: unknown) {
  return (error as { code?: string } | undefined)?.code === 'P2002';
}

type Transactional<Tx> = { $transaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T> };
type LockingTx = RawQuery & {
  $executeRaw(query: TemplateStringsArray, ...values: unknown[]): Promise<number>;
};

/**
 * Executa `create` numa transação com um protocolo novo, sob a mesma trava por tenant do motor
 * de fluxos. `create` deve gravar com o `tx` recebido para a trava valer até o commit.
 */
export async function withFreshProtocol<T, Tx extends LockingTx>(
  db: Transactional<Tx>,
  tenantId: string,
  create: (protocol: string, tx: Tx) => Promise<T>,
): Promise<T> {
  return db.$transaction(async (tx) =>
    create(await nextOrderProtocolInTransaction(tx, tenantId), tx),
  );
}

/**
 * Para criar O.S. dentro de uma transação (ex.: etapas do motor de processos), onde não dá
 * para tentar de novo após colisão: trava por tenant até o fim da transação e então numera.
 */
export async function nextOrderProtocolInTransaction(tx: LockingTx, tenantId: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`order-protocol:${tenantId}`}))`;
  return nextOrderProtocol(tx, tenantId);
}
