export const MANAGEMENT_TIMEZONE = 'America/Fortaleza';
const DAY = 86_400_000;
const completed = new Set(['RESOLVIDA', 'FECHADA']);

export interface ManagementOrder {
  id: string;
  status: string;
  createdAt: Date;
  assigneeUserId?: string | null;
  analystName?: string | null;
  assignee?: { name: string } | null;
  sourceMetadata?: unknown;
  deadlineAt?: Date | null;
  resolvedAt?: Date | null;
  closedAt?: Date | null;
  pausedAt?: Date | null;
  scheduledAt?: Date | null;
  scheduleStartedAt?: Date | null;
  slaEligible?: boolean;
}

export function isDemonstration(order: { sourceMetadata?: unknown }) {
  const metadata = order.sourceMetadata;
  return Boolean(
    metadata &&
    typeof metadata === 'object' &&
    'demonstration' in metadata &&
    metadata.demonstration === true,
  );
}

export function managementPeriod(days: number, now: Date) {
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: MANAGEMENT_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
  return {
    start: new Date(new Date(`${today}T00:00:00-03:00`).getTime() - (days - 1) * DAY),
    end: now,
    days,
    timeZone: MANAGEMENT_TIMEZONE,
  };
}

export function buildManagementOverview(orders: ManagementOrder[], days: number, now: Date) {
  const period = managementPeriod(days, now);
  const nowMs = now.getTime();
  const stamp = (date: Date | null | undefined) => (date ? date.getTime() : NaN);
  const inPeriod = (date: Date | null | undefined) =>
    stamp(date) >= period.start.getTime() && stamp(date) <= nowMs;
  const rows = orders.filter((row) => !isDemonstration(row));
  const active = rows.filter((row) => !completed.has(row.status) && row.status !== 'CANCELADA');
  const overdue = (row: ManagementOrder) =>
    !row.pausedAt && row.slaEligible !== false && stamp(row.deadlineAt) < nowMs;
  const dueSoon = (row: ManagementOrder) =>
    !row.pausedAt &&
    row.slaEligible !== false &&
    stamp(row.deadlineAt) >= nowMs &&
    stamp(row.deadlineAt) <= nowMs + 2 * 3_600_000;
  const finishedAt = (row: ManagementOrder) => row.resolvedAt || row.closedAt;
  const validCompletion = (row: ManagementOrder) =>
    completed.has(row.status) &&
    inPeriod(finishedAt(row)) &&
    stamp(finishedAt(row)) >= stamp(row.createdAt);
  const delivered = rows.filter(validCompletion);
  const eligible = delivered.filter(
    (row) => row.slaEligible !== false && Number.isFinite(stamp(row.deadlineAt)),
  );
  const averageHours = (group: ManagementOrder[]) =>
    group.length
      ? Math.round(
          (group.reduce((sum, row) => sum + stamp(finishedAt(row)) - stamp(row.createdAt), 0) /
            group.length /
            3_600_000) *
            10,
        ) / 10
      : null;
  const slaMet = eligible.filter((row) => stamp(finishedAt(row)) <= stamp(row.deadlineAt)).length;
  const team = new Map<
    string,
    {
      id: string;
      userId: string | null;
      name: string;
      open: number;
      closed: number;
      slaBreaches: number;
      paused: number;
      measuredClosed: number;
      tmrHours: number | null;
    }
  >();
  const person = (row: ManagementOrder) => {
    // Historical names remain distinguishable; only linked IDs can identify an ERP user.
    const key = row.assigneeUserId || `unlinked:${row.analystName || ''}`;
    if (!team.has(key))
      team.set(key, {
        id: key,
        userId: row.assigneeUserId || null,
        name: row.assignee?.name || row.analystName || 'Sem responsável',
        open: 0,
        closed: 0,
        slaBreaches: 0,
        paused: 0,
        measuredClosed: 0,
        tmrHours: null,
      });
    return team.get(key)!;
  };
  for (const row of active) {
    const item = person(row);
    item.open++;
    if (overdue(row)) item.slaBreaches++;
    if (row.pausedAt) item.paused++;
  }
  const deliveriesByPerson = new Map<string, ManagementOrder[]>();
  for (const row of delivered) {
    const item = person(row);
    item.closed++;
    item.measuredClosed++;
    const group = deliveriesByPerson.get(item.id) || [];
    group.push(row);
    deliveriesByPerson.set(item.id, group);
  }
  for (const [key, group] of deliveriesByPerson) team.get(key)!.tmrHours = averageHours(group);
  return {
    period,
    generatedAt: now,
    population: {
      excludedDemonstrations: orders.length - rows.length,
      scope: 'CURRENT_PENDING_AND_PERIOD_EVENTS',
    },
    operation: {
      totalOpen: active.length,
      overdue: active.filter(overdue).length,
      dueSoon: active.filter(dueSoon).length,
      paused: active.filter((row) => row.pausedAt).length,
      unassigned: active.filter((row) => !row.assigneeUserId).length,
      scheduled: active.filter((row) => row.scheduledAt && !row.scheduleStartedAt).length,
      withoutSla: active.filter(
        (row) => row.slaEligible === false || !Number.isFinite(stamp(row.deadlineAt)),
      ).length,
    },
    results: {
      opened: rows.filter((row) => inPeriod(row.createdAt)).length,
      closed: delivered.length,
      tmrHours: averageHours(delivered),
      measuredClosed: delivered.length,
      slaPercentage: eligible.length ? Math.round((slaMet / eligible.length) * 1000) / 10 : null,
      slaEvaluated: eligible.length,
      slaMet,
      // Undated historical completions cannot be attributed to the selected period.
      missingCompletionDate: rows.filter(
        (row) =>
          completed.has(row.status) &&
          inPeriod(row.createdAt) &&
          !Number.isFinite(stamp(finishedAt(row))),
      ).length,
    },
    team: [...team.values()].sort(
      (a, b) =>
        b.slaBreaches - a.slaBreaches ||
        b.open - a.open ||
        a.name.localeCompare(b.name, 'pt-BR') ||
        a.id.localeCompare(b.id),
    ),
  };
}
