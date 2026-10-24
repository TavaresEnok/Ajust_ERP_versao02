type AnalyticsOrder = {
  type: string;
  status: string;
  priority: string;
  sourceMetadata?: unknown;
  createdAt: Date;
  closedAt?: Date | null;
  resolvedAt?: Date | null;
  deadlineAt?: Date | null;
  slaEligible?: boolean;
  analystName?: string | null;
  assigneeUserId?: string | null;
  requester?: string | null;
  occurrence?: { type: string; provider: string; customerId?: string | null } | null;
  timeEntries?: { minutes: number }[];
};

const labels: Record<string, string> = {
  ROMPIMENTO: 'Rompimento',
  LENTIDAO: 'Lentidão',
  CONFIGURACAO_ONU: 'Configuração ONU',
  TROCA_SENHA: 'Troca de senha',
  CANCELAMENTO: 'Cancelamento',
  AUDITORIA: 'Auditoria',
  INSTALACAO: 'Instalação',
  BGP: 'BGP',
  DNS: 'DNS',
  PROXMOX: 'Proxmox',
  FIREWALL: 'Firewall',
  ROTEAMENTO_CGNAT: 'Roteamento / CGNAT',
  INFRAESTRUTURA: 'Infraestrutura',
  CONSULTORIA_GERAL: 'Consultoria geral',
  OUTRO: 'Outro',
};
const closedStatuses = new Set(['FECHADA', 'RESOLVIDA']);
const round = (value: number) => Math.round(value * 100) / 100;
function metadata(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
function providerName(order: AnalyticsOrder) {
  return order.occurrence?.provider?.trim() || order.requester?.trim() || 'Interno';
}

export function buildServiceTypeAnalytics(
  orders: AnalyticsOrder[],
  provider?: string,
  now = new Date(),
) {
  const realOrders = orders.filter(
    (order) => metadata(order.sourceMetadata).demonstration !== true,
  );
  const providerOptions = [...new Set(realOrders.map(providerName))].sort((a, b) =>
    a.localeCompare(b, 'pt-BR'),
  );
  const selected = provider?.trim().toLocaleLowerCase('pt-BR');
  const filtered = realOrders.filter(
    (order) => !selected || providerName(order).toLocaleLowerCase('pt-BR') === selected,
  );
  const types = new Map<
    string,
    {
      name: string;
      total: number;
      active: number;
      closed: number;
      canceled: number;
      overdue: number;
      dueSoon: number;
      withoutSla: number;
      resolutionHours: number;
      measuredClosed: number;
      loggedMinutes: number;
      worklogOrders: number;
      byPriority: Record<string, number>;
      byStatus: Record<string, number>;
      analysts: Map<string, { name: string; orders: number }>;
    }
  >();
  const providers = new Map<
    string,
    {
      name: string;
      customerId: string | null;
      total: number;
      active: number;
      closed: number;
      canceled: number;
      overdue: number;
      dueSoon: number;
    }
  >();
  let resolutionHours = 0,
    measuredClosed = 0;
  for (const order of filtered) {
    const originalType = metadata(order.sourceMetadata).originalType;
    const name =
      (typeof originalType === 'string' && originalType.trim()) ||
      order.occurrence?.type?.trim() ||
      labels[order.type] ||
      order.type;
    let stats = types.get(name);
    if (!stats) {
      stats = {
        name,
        total: 0,
        active: 0,
        closed: 0,
        canceled: 0,
        overdue: 0,
        dueSoon: 0,
        withoutSla: 0,
        resolutionHours: 0,
        measuredClosed: 0,
        loggedMinutes: 0,
        worklogOrders: 0,
        byPriority: {},
        byStatus: {},
        analysts: new Map(),
      };
      types.set(name, stats);
    }
    const pName = providerName(order);
    let p = providers.get(pName);
    if (!p) {
      p = {
        name: pName,
        customerId: order.occurrence?.customerId || null,
        total: 0,
        active: 0,
        closed: 0,
        canceled: 0,
        overdue: 0,
        dueSoon: 0,
      };
      providers.set(pName, p);
    }
    const closed = closedStatuses.has(order.status),
      canceled = order.status === 'CANCELADA';
    const active = !closed && !canceled;
    const hasSla = order.slaEligible !== false && !!order.deadlineAt;
    const remaining = order.deadlineAt ? order.deadlineAt.getTime() - now.getTime() : 0;
    stats.total++;
    p.total++;
    if (closed) {
      stats.closed++;
      p.closed++;
    }
    if (canceled) {
      stats.canceled++;
      p.canceled++;
    }
    if (active) {
      stats.active++;
      p.active++;
    }
    if (!hasSla) stats.withoutSla++;
    if (active && hasSla && remaining < 0) {
      stats.overdue++;
      p.overdue++;
    }
    if (active && hasSla && remaining >= 0 && remaining <= 2 * 3600000) {
      stats.dueSoon++;
      p.dueSoon++;
    }
    const finished = order.resolvedAt || order.closedAt;
    if (closed && finished && finished >= order.createdAt) {
      const hours = (finished.getTime() - order.createdAt.getTime()) / 3600000;
      stats.resolutionHours += hours;
      stats.measuredClosed++;
      resolutionHours += hours;
      measuredClosed++;
    }
    const entries = order.timeEntries || [];
    if (entries.length) {
      stats.worklogOrders++;
      stats.loggedMinutes += entries.reduce((sum, entry) => sum + Math.max(0, entry.minutes), 0);
    }
    stats.byPriority[order.priority] = (stats.byPriority[order.priority] || 0) + 1;
    stats.byStatus[order.status] = (stats.byStatus[order.status] || 0) + 1;
    const analyst = order.analystName?.trim();
    if (analyst) {
      const key = order.assigneeUserId || analyst.toLocaleLowerCase('pt-BR');
      const existing = stats.analysts.get(key) || { name: analyst, orders: 0 };
      existing.orders++;
      stats.analysts.set(key, existing);
    }
  }
  const rows = [...types.values()]
    .map(({ resolutionHours: hours, analysts, ...row }) => ({
      ...row,
      avgResolutionHours: row.measuredClosed ? round(hours / row.measuredClosed) : null,
      completionRate: round((row.closed / row.total) * 100),
      analysts: [...analysts.values()].sort((a, b) => b.orders - a.orders),
    }))
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, 'pt-BR'));
  const sum = (key: 'active' | 'closed' | 'canceled' | 'overdue' | 'dueSoon' | 'withoutSla') =>
    rows.reduce((n, row) => n + row[key], 0);
  return {
    summary: {
      totalOrders: filtered.length,
      types: rows.length,
      active: sum('active'),
      closed: sum('closed'),
      canceled: sum('canceled'),
      overdue: sum('overdue'),
      dueSoon: sum('dueSoon'),
      withoutSla: sum('withoutSla'),
      avgResolutionHours: measuredClosed ? round(resolutionHours / measuredClosed) : null,
      measuredClosed,
      excludedDemonstrations: orders.length - realOrders.length,
    },
    rows,
    providerOptions,
    providers: [...providers.values()]
      .map((p) => ({ ...p, completionRate: round((p.closed / p.total) * 100) }))
      .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, 'pt-BR')),
  };
}
