// Pure fixtures only: no insertion into the ERP database, and no login/secrets.
import assert from 'node:assert/strict';
import { buildAnalystOverview, isOwnOrder, localDay } from '../apps/web/lib/erp/analyst-workspace';
import { getPortalNavigation } from '../apps/web/lib/navigation';
import { canAccessSection } from '../apps/web/lib/erp/access';
import type { ErpRecord } from '../apps/web/lib/erp/contracts';

const now = new Date('2026-10-21T12:00:00Z');
const order = (id: string, extra: ErpRecord = {}): ErpRecord => ({
  id,
  status: 'ABERTA',
  createdAt: '2026-08-01T12:00:00Z',
  assigneeUserId: 'anderson',
  ...extra,
});
const rows = [
  order('overdue', { deadlineAt: '2026-10-21T11:00:00Z' }),
  order('soon', { deadlineAt: '2026-10-21T13:00:00Z' }),
  order('today', { deadlineAt: '2026-10-22T02:30:00Z' }),
  order('ineligible', { slaEligible: false, deadlineAt: '2026-10-20T12:00:00Z' }),
  order('invalid', { deadlineAt: 'invalid date' }),
  order('no-deadline'),
  order('done', {
    status: 'FECHADA',
    resolvedAt: '2026-10-20T12:00:00Z',
    closedAt: '2026-10-21T12:00:00Z',
  }),
  order('canceled', {
    status: 'CANCELADA',
    closedAt: '2026-10-21T12:00:00Z',
    deadlineAt: '2026-10-20T12:00:00Z',
  }),
  order('unknown-date', { status: 'FECHADA', updatedAt: now.toISOString() }),
  order('old-delivery', { status: 'RESOLVIDA', resolvedAt: '2026-08-02T12:00:00Z' }),
];
const report = buildAnalystOverview(rows, 7, now);
assert.equal(report.active.length, 6, 'backlog includes orders created before the period');
assert.equal(report.overdue.length, 1, 'ignores canceled, invalid deadlines and ineligible SLA');
assert.equal(
  report.dueToday.length,
  3,
  'includes overdue today and local-day late-night deadlines',
);
assert.equal(report.dueSoon.length, 1);
assert.equal(report.closed.length, 1, 'uses completion date, not creation/update date');
assert.equal(report.withoutSla, 3);
assert.equal(report.missingCompletionDate, 1);
assert.equal(report.series.length, 7);
assert.equal(
  report.series.find((s) => s.day === '2026-10-20')?.closed,
  1,
  'counts resolution once, not both resolution and closure',
);
assert.equal(report.series.find((s) => s.day === '2026-10-21')?.closed, 0);
assert.equal(report.ordered[0].id, 'overdue');
assert.equal(localDay(new Date('2026-10-22T02:30:00Z')), '2026-10-21');
assert.equal(
  isOwnOrder(order('owner', { assigneeUserId: 'other', ownerUserId: 'anderson' }), 'anderson'),
  true,
);
assert.equal(
  isOwnOrder(order('same-name', { assigneeUserId: 'other', analystName: 'Anderson' }), 'anderson'),
  false,
);
assert.equal(isOwnOrder(order('empty'), ''), false);
assert.equal(buildAnalystOverview([], null, now).series.length, 0);
assert.equal(buildAnalystOverview(rows, null, now).closed.length, 2);
assert.equal(
  buildAnalystOverview(rows, null, now).series.find((s) => s.day === '2026-09-01')?.closed,
  0,
);
assert.equal(
  buildAnalystOverview([order('future', { createdAt: '2026-10-22T12:00:00Z' })], 7, now).opened,
  0,
);
const nav = getPortalNavigation('/analista', 'analista');
const paths = nav.flatMap((g) => g.items.map((i) => i.path));
assert(paths.includes('/analista/provedores'));
assert(paths.includes('/analista/processos'));
assert(!paths.includes('/analista/workflows'));
assert(!paths.includes('/analista/usuarios'));
assert(nav.find((g) => g.label === 'Ferramentas técnicas')?.collapsible);
assert(canAccessSection('analista', 'provedores'));
assert(!canAccessSection('cliente', 'provedores'));
assert(!canAccessSection('analista', 'workflows'));
assert(
  getPortalNavigation('/gerencia', 'gerente').some((g) =>
    g.items.some((i) => i.path === '/gerencia/workflows'),
  ),
);
console.log(
  'Analyst workspace: 28 assertions passed (metrics, timezone, dates, scopes, navigation).',
);
