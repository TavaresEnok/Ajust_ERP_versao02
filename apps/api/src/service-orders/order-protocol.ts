/**
 * Gerador único de protocolo de O.S. (auditoria C-067): AAAA + 6 dígitos, a partir do maior
 * número já emitido no ano (100001 no primeiro). Prefixos como WF-, MNT- ou SGP- ficam de fora.
 * Colisões concorrentes são tratadas por quem cria (retry no erro P2002 de @@unique).
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

/** Executa `create` com um protocolo novo, tentando de novo se outro processo pegou o mesmo número. */
export async function withFreshProtocol<T>(
  db: RawQuery,
  tenantId: string,
  create: (protocol: string) => Promise<T>,
  attempts = 5,
): Promise<T> {
  let last: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await create(await nextOrderProtocol(db, tenantId));
    } catch (error) {
      last = error;
      if (!isUniqueCollision(error)) throw error;
    }
  }
  throw last;
}

/**
 * Para criar O.S. dentro de uma transação (ex.: etapas do motor de processos), onde não dá
 * para tentar de novo após colisão: trava por tenant até o fim da transação e então numera.
 */
export async function nextOrderProtocolInTransaction(
  tx: RawQuery & {
    $executeRaw(query: TemplateStringsArray, ...values: unknown[]): Promise<number>;
  },
  tenantId: string,
) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`order-protocol:${tenantId}`}))`;
  return nextOrderProtocol(tx, tenantId);
}
