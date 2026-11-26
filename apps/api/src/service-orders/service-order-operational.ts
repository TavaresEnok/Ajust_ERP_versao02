import { Prisma } from '@prisma/client';
import type { PrismaService } from '../prisma/prisma.service';
import { isCustomerRole, sanitizeOrderForRole } from './service-order-queries';

export const OPERATIONAL_TIMEZONE = 'America/Fortaleza';
const DAY_MS = 86_400_000;

export type OperationalFocus =
  | 'active'
  | 'overdue'
  | 'soon'
  | 'today'
  | 'within'
  | 'without'
  | 'paused'
  | 'unassigned'
  | 'scheduled'
  | 'urgent'
  | 'closed'
  | 'all';

export interface OperationalSummaryInput {
  scope?: 'mine' | 'operation';
  userId?: string;
  days?: number | null;
  excludeDemo?: boolean;
  role?: string | null;
}

export interface OperationalSummaryResult {
  generatedAt: string;
  totals: {
    totalActive: number;
    overdue: number;
    dueSoon: number;
    dueToday: number;
    withinSla: number;
    paused: number;
    withoutSla: number;
    unassigned: number;
    scheduled: number;
    urgent: number;
    opened: number;
    closed: number;
    allInScope: number;
    missingCompletionDate: number;
  };
  byStatus: { status: string; count: number }[];
  byProvider: { provider: string; count: number }[];
  teamLoad: { userId: string | null; name: string; count: number; late: number }[];
  series: { day: string; opened: number; closed: number }[];
}

export interface OperationalQueueInput {
  scope?: 'mine' | 'operation';
  userId?: string;
  focus?: OperationalFocus;
  search?: string;
  days?: number | null;
  limit?: number;
  offset?: number;
  excludeDemo?: boolean;
  role?: string | null;
}

function localDay(value: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: OPERATIONAL_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(value);
}

function periodStartDate(days: number | null | undefined, now: Date): Date | null {
  if (!days || !Number.isFinite(days) || days < 1) return null;
  const today = localDay(now);
  return new Date(new Date(`${today}T00:00:00-03:00`).getTime() - (days - 1) * DAY_MS);
}

function baseConditions(
  tenantId: string,
  options: {
    scope?: 'mine' | 'operation';
    userId?: string;
    excludeDemo?: boolean;
    role?: string | null;
  },
): Prisma.Sql[] {
  const parts: Prisma.Sql[] = [
    Prisma.sql`so."tenantId" = ${tenantId}`,
    Prisma.sql`so."deletedAt" IS NULL`,
  ];
  if (isCustomerRole(options.role)) {
    parts.push(Prisma.sql`so."isCustomerVisible" = true`);
  }
  if (options.excludeDemo !== false) {
    parts.push(Prisma.sql`COALESCE(so."sourceMetadata"->>'demonstration', 'false') <> 'true'`);
  }
  if (options.scope === 'mine' && options.userId) {
    parts.push(
      Prisma.sql`(so."ownerUserId" = ${options.userId} OR so."assigneeUserId" = ${options.userId})`,
    );
  }
  return parts;
}

function joinSql(conditions: Prisma.Sql[]): Prisma.Sql {
  return Prisma.join(conditions, ' AND ');
}

const ACTIVE_STATUS_SQL = Prisma.sql`so."status" NOT IN ('RESOLVIDA', 'FECHADA', 'CANCELADA')`;
const COMPLETED_STATUS_SQL = Prisma.sql`so."status" IN ('RESOLVIDA', 'FECHADA')`;

export async function getOperationalSummary(
  prisma: PrismaService,
  tenantId: string,
  input: OperationalSummaryInput = {},
): Promise<OperationalSummaryResult> {
  const now = new Date();
  const twoHours = new Date(now.getTime() + 2 * 3_600_000);
  const today = localDay(now);
  const periodStart = periodStartDate(input.days, now);
  const baseWhere = joinSql(baseConditions(tenantId, input));
  const finishedExpr = Prisma.sql`COALESCE(so."resolvedAt", so."closedAt")`;
  const openedInPeriodExpr = periodStart
    ? Prisma.sql`so."createdAt" >= ${periodStart} AND so."createdAt" <= ${now}`
    : Prisma.sql`so."createdAt" <= ${now}`;
  const closedInPeriodExpr = periodStart
    ? Prisma.sql`${COMPLETED_STATUS_SQL} AND ${finishedExpr} IS NOT NULL AND ${finishedExpr} >= ${periodStart} AND ${finishedExpr} <= ${now}`
    : Prisma.sql`${COMPLETED_STATUS_SQL} AND ${finishedExpr} IS NOT NULL AND ${finishedExpr} <= ${now}`;

  const [
    totalsRows,
    byStatusRows,
    byProviderRows,
    teamLoadRows,
    openedSeriesRows,
    closedSeriesRows,
  ] = await Promise.all([
    prisma.$queryRaw<
      Array<{
        totalActive: bigint;
        overdue: bigint;
        dueSoon: bigint;
        dueToday: bigint;
        withinSla: bigint;
        paused: bigint;
        withoutSla: bigint;
        unassigned: bigint;
        scheduled: bigint;
        urgent: bigint;
        opened: bigint;
        closed: bigint;
        allInScope: bigint;
        missingCompletionDate: bigint;
      }>
    >(Prisma.sql`
        SELECT
          COUNT(*) FILTER (WHERE ${ACTIVE_STATUS_SQL}) AS "totalActive",
          COUNT(*) FILTER (
            WHERE ${ACTIVE_STATUS_SQL}
              AND so."pausedAt" IS NULL
              AND so."slaEligible" = true
              AND so."deadlineAt" < ${now}
          ) AS "overdue",
          COUNT(*) FILTER (
            WHERE ${ACTIVE_STATUS_SQL}
              AND so."pausedAt" IS NULL
              AND so."slaEligible" = true
              AND so."deadlineAt" >= ${now}
              AND so."deadlineAt" <= ${twoHours}
          ) AS "dueSoon",
          COUNT(*) FILTER (
            WHERE ${ACTIVE_STATUS_SQL}
              AND so."pausedAt" IS NULL
              AND so."slaEligible" = true
              AND to_char((so."deadlineAt" AT TIME ZONE 'UTC') AT TIME ZONE ${OPERATIONAL_TIMEZONE}, 'YYYY-MM-DD') = ${today}
          ) AS "dueToday",
          COUNT(*) FILTER (
            WHERE ${ACTIVE_STATUS_SQL}
              AND so."pausedAt" IS NULL
              AND so."slaEligible" = true
              AND so."deadlineAt" > ${twoHours}
          ) AS "withinSla",
          COUNT(*) FILTER (
            WHERE ${ACTIVE_STATUS_SQL}
              AND so."pausedAt" IS NOT NULL
          ) AS "paused",
          COUNT(*) FILTER (
            WHERE ${ACTIVE_STATUS_SQL}
              AND so."pausedAt" IS NULL
              AND so."slaEligible" = false
          ) AS "withoutSla",
          COUNT(*) FILTER (
            WHERE ${ACTIVE_STATUS_SQL}
              AND so."assigneeUserId" IS NULL
          ) AS "unassigned",
          COUNT(*) FILTER (
            WHERE ${ACTIVE_STATUS_SQL}
              AND so."scheduledAt" IS NOT NULL
              AND so."scheduleStartedAt" IS NULL
          ) AS "scheduled",
          COUNT(*) FILTER (
            WHERE ${ACTIVE_STATUS_SQL}
              AND (
                so."priority" = 'CRITICA'
                OR (so."pausedAt" IS NULL AND so."slaEligible" = true AND so."deadlineAt" < ${now})
              )
          ) AS "urgent",
          COUNT(*) FILTER (WHERE ${openedInPeriodExpr}) AS "opened",
          COUNT(*) FILTER (WHERE ${closedInPeriodExpr}) AS "closed",
          COUNT(*) AS "allInScope",
          COUNT(*) FILTER (
            WHERE ${COMPLETED_STATUS_SQL}
              AND ${finishedExpr} IS NULL
          ) AS "missingCompletionDate"
        FROM "ServiceOrder" so
        WHERE ${baseWhere}
      `),

    prisma.$queryRaw<Array<{ status: string; count: bigint }>>(Prisma.sql`
        SELECT so."status"::text AS status, COUNT(*) AS count
        FROM "ServiceOrder" so
        WHERE ${baseWhere} AND ${ACTIVE_STATUS_SQL}
        GROUP BY so."status"
      `),

    prisma.$queryRaw<Array<{ provider: string; count: bigint }>>(Prisma.sql`
        SELECT
          COALESCE(NULLIF(BTRIM(occ."provider"), ''), NULLIF(BTRIM(so."requester"), ''), 'Sem provedor informado') AS provider,
          COUNT(*) AS count
        FROM "ServiceOrder" so
        LEFT JOIN "Occurrence" occ ON occ."id" = so."occurrenceId"
        WHERE ${baseWhere} AND ${ACTIVE_STATUS_SQL}
        GROUP BY 1
        ORDER BY count DESC, provider ASC
        LIMIT 6
      `),

    prisma.$queryRaw<Array<{ userId: string | null; name: string; count: bigint; late: bigint }>>(
      Prisma.sql`
          SELECT
            so."assigneeUserId" AS "userId",
            COALESCE(MAX(u."name"), MAX(NULLIF(BTRIM(so."analystName"), '')), 'Sem responsável') AS name,
            COUNT(*) AS count,
            COUNT(*) FILTER (
              WHERE so."pausedAt" IS NULL
                AND so."slaEligible" = true
                AND so."deadlineAt" < ${now}
            ) AS late
          FROM "ServiceOrder" so
          LEFT JOIN "User" u ON u."id" = so."assigneeUserId"
          WHERE ${baseWhere} AND ${ACTIVE_STATUS_SQL}
          GROUP BY so."assigneeUserId", CASE WHEN so."assigneeUserId" IS NULL THEN COALESCE(NULLIF(BTRIM(so."analystName"), ''), 'Sem responsável') ELSE '' END
          ORDER BY count DESC, name ASC
        `,
    ),

    prisma.$queryRaw<Array<{ day: string; count: bigint }>>(Prisma.sql`
        SELECT
          to_char((so."createdAt" AT TIME ZONE 'UTC') AT TIME ZONE ${OPERATIONAL_TIMEZONE}, 'YYYY-MM-DD') AS day,
          COUNT(*) AS count
        FROM "ServiceOrder" so
        WHERE ${baseWhere} AND ${openedInPeriodExpr}
        GROUP BY 1
        ORDER BY 1 ASC
      `),

    prisma.$queryRaw<Array<{ day: string; count: bigint }>>(Prisma.sql`
        SELECT
          to_char((${finishedExpr} AT TIME ZONE 'UTC') AT TIME ZONE ${OPERATIONAL_TIMEZONE}, 'YYYY-MM-DD') AS day,
          COUNT(*) AS count
        FROM "ServiceOrder" so
        WHERE ${baseWhere} AND ${closedInPeriodExpr}
        GROUP BY 1
        ORDER BY 1 ASC
      `),
  ]);

  const row = totalsRows[0];
  const n = (value: bigint | number | undefined) => Number(value ?? 0);

  const dayMap = new Map<string, { day: string; opened: number; closed: number }>();
  const touchDay = (day: string) => {
    if (!dayMap.has(day)) dayMap.set(day, { day, opened: 0, closed: 0 });
    return dayMap.get(day)!;
  };

  if (periodStart) {
    for (let t = periodStart.getTime(); t <= now.getTime(); t += DAY_MS) {
      touchDay(localDay(new Date(t)));
    }
    touchDay(today);
  } else {
    const earliestDay = [openedSeriesRows[0]?.day, closedSeriesRows[0]?.day]
      .filter((d): d is string => Boolean(d))
      .sort()[0];
    if (earliestDay) {
      const startMs = new Date(`${earliestDay}T00:00:00-03:00`).getTime();
      const maxSpanStart = now.getTime() - 365 * DAY_MS;
      const effectiveStart = Math.max(startMs, maxSpanStart);
      for (let t = effectiveStart; t <= now.getTime(); t += DAY_MS) {
        touchDay(localDay(new Date(t)));
      }
      touchDay(today);
    }
  }

  for (const item of openedSeriesRows) touchDay(item.day).opened += n(item.count);
  for (const item of closedSeriesRows) touchDay(item.day).closed += n(item.count);

  const series = [...dayMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, value]) => value);

  return {
    generatedAt: now.toISOString(),
    totals: {
      totalActive: n(row?.totalActive),
      overdue: n(row?.overdue),
      dueSoon: n(row?.dueSoon),
      dueToday: n(row?.dueToday),
      withinSla: n(row?.withinSla),
      paused: n(row?.paused),
      withoutSla: n(row?.withoutSla),
      unassigned: n(row?.unassigned),
      scheduled: n(row?.scheduled),
      urgent: n(row?.urgent),
      opened: n(row?.opened),
      closed: n(row?.closed),
      allInScope: n(row?.allInScope),
      missingCompletionDate: n(row?.missingCompletionDate),
    },
    byStatus: byStatusRows.map((item) => ({ status: item.status, count: n(item.count) })),
    byProvider: byProviderRows.map((item) => ({ provider: item.provider, count: n(item.count) })),
    teamLoad: teamLoadRows.map((item) => ({
      userId: item.userId,
      name: item.name,
      count: n(item.count),
      late: n(item.late),
    })),
    series,
  };
}

export async function getOperationalQueue(
  prisma: PrismaService,
  tenantId: string,
  input: OperationalQueueInput = {},
) {
  const now = new Date();
  const twoHours = new Date(now.getTime() + 2 * 3_600_000);
  const today = localDay(now);
  const periodStart = periodStartDate(input.days, now);
  const focus: OperationalFocus = input.focus || 'active';
  const limit = Math.min(Math.max(input.limit ?? 20, 1), 100);
  const offset = Math.max(input.offset ?? 0, 0);
  const finishedExpr = Prisma.sql`COALESCE(so."resolvedAt", so."closedAt")`;

  const conditions = baseConditions(tenantId, input);

  switch (focus) {
    case 'active':
      conditions.push(ACTIVE_STATUS_SQL);
      break;
    case 'overdue':
      conditions.push(
        ACTIVE_STATUS_SQL,
        Prisma.sql`so."pausedAt" IS NULL`,
        Prisma.sql`so."slaEligible" = true`,
        Prisma.sql`so."deadlineAt" < ${now}`,
      );
      break;
    case 'soon':
      conditions.push(
        ACTIVE_STATUS_SQL,
        Prisma.sql`so."pausedAt" IS NULL`,
        Prisma.sql`so."slaEligible" = true`,
        Prisma.sql`so."deadlineAt" >= ${now}`,
        Prisma.sql`so."deadlineAt" <= ${twoHours}`,
      );
      break;
    case 'today':
      conditions.push(
        ACTIVE_STATUS_SQL,
        Prisma.sql`so."pausedAt" IS NULL`,
        Prisma.sql`so."slaEligible" = true`,
        Prisma.sql`to_char((so."deadlineAt" AT TIME ZONE 'UTC') AT TIME ZONE ${OPERATIONAL_TIMEZONE}, 'YYYY-MM-DD') = ${today}`,
      );
      break;
    case 'within':
      conditions.push(
        ACTIVE_STATUS_SQL,
        Prisma.sql`so."pausedAt" IS NULL`,
        Prisma.sql`so."slaEligible" = true`,
        Prisma.sql`so."deadlineAt" > ${twoHours}`,
      );
      break;
    case 'without':
      conditions.push(
        ACTIVE_STATUS_SQL,
        Prisma.sql`so."pausedAt" IS NULL`,
        Prisma.sql`so."slaEligible" = false`,
      );
      break;
    case 'paused':
      conditions.push(ACTIVE_STATUS_SQL, Prisma.sql`so."pausedAt" IS NOT NULL`);
      break;
    case 'unassigned':
      conditions.push(ACTIVE_STATUS_SQL, Prisma.sql`so."assigneeUserId" IS NULL`);
      break;
    case 'scheduled':
      conditions.push(
        ACTIVE_STATUS_SQL,
        Prisma.sql`so."scheduledAt" IS NOT NULL`,
        Prisma.sql`so."scheduleStartedAt" IS NULL`,
      );
      break;
    case 'urgent':
      conditions.push(
        ACTIVE_STATUS_SQL,
        Prisma.sql`(so."priority" = 'CRITICA' OR (so."pausedAt" IS NULL AND so."slaEligible" = true AND so."deadlineAt" < ${now}))`,
      );
      break;
    case 'closed':
      conditions.push(
        COMPLETED_STATUS_SQL,
        Prisma.sql`${finishedExpr} IS NOT NULL`,
        Prisma.sql`${finishedExpr} <= ${now}`,
      );
      if (periodStart) conditions.push(Prisma.sql`${finishedExpr} >= ${periodStart}`);
      break;
    case 'all':
      break;
  }

  const trimmedSearch = input.search?.trim();
  if (trimmedSearch) {
    // `%`, `_` e `\` digitados são texto, não curingas do ILIKE (como faz o `contains` do Prisma).
    const pattern = `%${trimmedSearch.replace(/[\\%_]/g, '\\$&')}%`;
    conditions.push(
      Prisma.sql`(
        so."protocol" ILIKE ${pattern}
        OR so."title" ILIKE ${pattern}
        OR COALESCE(so."requester", '') ILIKE ${pattern}
        OR COALESCE(so."analystName", '') ILIKE ${pattern}
        OR COALESCE(occ."provider", '') ILIKE ${pattern}
        OR COALESCE(u."name", '') ILIKE ${pattern}
      )`,
    );
  }

  const whereSql = joinSql(conditions);
  const orderSql =
    focus === 'scheduled'
      ? Prisma.sql`ORDER BY so."scheduledAt" ASC NULLS LAST, so."id" ASC`
      : focus === 'closed'
        ? Prisma.sql`ORDER BY ${finishedExpr} DESC NULLS LAST, so."id" ASC`
        : Prisma.sql`
            ORDER BY
              CASE WHEN ${ACTIVE_STATUS_SQL} THEN 0 ELSE 1 END ASC,
              CASE
                WHEN so."pausedAt" IS NOT NULL THEN 3
                WHEN so."slaEligible" = true AND so."deadlineAt" < ${now} THEN 0
                WHEN so."priority" = 'CRITICA' THEN 1
                ELSE 2
              END ASC,
              CASE WHEN so."slaEligible" = true THEN so."deadlineAt" ELSE NULL END ASC NULLS LAST,
              so."id" ASC
          `;

  const [countRows, idRows] = await Promise.all([
    prisma.$queryRaw<Array<{ total: bigint }>>(Prisma.sql`
      SELECT COUNT(*) AS total
      FROM "ServiceOrder" so
      LEFT JOIN "Occurrence" occ ON occ."id" = so."occurrenceId"
      LEFT JOIN "User" u ON u."id" = so."assigneeUserId"
      WHERE ${whereSql}
    `),
    prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT so."id"
      FROM "ServiceOrder" so
      LEFT JOIN "Occurrence" occ ON occ."id" = so."occurrenceId"
      LEFT JOIN "User" u ON u."id" = so."assigneeUserId"
      WHERE ${whereSql}
      ${orderSql}
      LIMIT ${limit} OFFSET ${offset}
    `),
  ]);

  const total = Number(countRows[0]?.total ?? 0);
  const ids = idRows.map((row) => row.id);

  if (!ids.length) {
    return {
      generatedAt: now.toISOString(),
      total,
      limit,
      offset,
      items: [],
    };
  }

  const rows = await prisma.serviceOrder.findMany({
    where: { id: { in: ids }, tenantId },
    include: {
      occurrence: {
        select: {
          id: true,
          number: true,
          provider: true,
          type: true,
          status: true,
          sector: true,
          origin: true,
          openedByName: true,
          analystResponsible: true,
          description: true,
          createdAt: true,
        },
      },
      owner: { select: { id: true, name: true, email: true } },
      assignee: { select: { id: true, name: true, email: true } },
    },
  });

  const byId = new Map(rows.map((row) => [row.id, sanitizeOrderForRole(row, input.role)]));
  const items = ids
    .map((id) => byId.get(id))
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  return {
    generatedAt: now.toISOString(),
    total,
    limit,
    offset,
    items,
  };
}
