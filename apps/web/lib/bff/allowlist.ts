import 'server-only';

/**
 * Rotas do NestJS que o navegador pode alcançar pelo BFF autenticado (/api/erp/*).
 * Qualquer combinação método + caminho fora desta lista recebe 404 do BFF, impedindo que
 * ele funcione como proxy aberto (monitoramento, webhooks, refresh e login ficam de fora).
 * Fonte: controllers em apps/api/src. Atualize ao expor um novo endpoint para a interface.
 */
type Method = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

const ROUTES: Record<string, Method[]> = {
  '/api-keys': ['GET', 'POST'],
  '/api-keys/:id': ['DELETE'],
  '/api-keys/:id/revoke': ['PATCH'],

  '/audit/export': ['GET'],
  '/audit/logs': ['GET'],
  '/audit/metrics': ['GET'],

  '/auth/2fa/confirm': ['POST'],
  '/auth/2fa/disable': ['POST'],
  '/auth/2fa/setup': ['POST'],
  '/auth/2fa/status': ['GET'],
  '/auth/admin/revoke-sessions/:id': ['POST'],
  '/auth/logout-all': ['POST'],
  '/auth/me': ['GET', 'PATCH'],
  '/auth/sessions': ['GET'],
  '/auth/sessions/:id': ['DELETE'],
  '/auth/sessions/user/:id': ['GET'],
  '/auth/socket-token': ['GET'],

  '/calendar/events': ['GET', 'POST'],
  '/calendar/events/:id': ['PATCH', 'DELETE'],
  '/calendar/events/all': ['GET'],
  '/calendar/events/check-conflict': ['POST'],
  '/calendar/users': ['GET'],

  '/change-management': ['GET', 'POST'],
  '/change-management/:id': ['DELETE'],
  '/change-management/:id/transition': ['PATCH'],

  '/cmdb/assets': ['GET', 'POST'],
  '/cmdb/assets/:id': ['PATCH', 'DELETE'],
  '/cmdb/assets/:id/link-order': ['POST'],
  '/cmdb/assets/:id/snapshots': ['GET', 'POST'],
  '/cmdb/assets/:id/snapshots-diff': ['GET'],
  '/cmdb/assets/:id/snapshots/:id': ['GET'],

  '/csat': ['GET'],
  '/csat/create-for-order': ['POST'],
  '/csat/summary': ['GET'],

  '/customers': ['GET'],
  '/customers/:id': ['GET'],
  '/network-topologies': ['GET'],
  '/network-topologies/:id': ['GET', 'PUT'],
  '/network-topologies/:id/history': ['GET'],
  '/network-topologies/:id/history/:id': ['GET'],
  '/customer-portal': ['GET'],
  '/customer-portal/agenda': ['GET'],
  '/customer-portal/orders/:id': ['GET'],

  '/dashboards/agenda-overview': ['GET'],
  '/dashboards/tenant-services': ['GET'],

  '/iam/roles': ['GET'],
  '/iam/tenants': ['GET', 'POST'],
  '/iam/tenants/:id': ['PATCH'],
  '/iam/tenants/:id/audit': ['GET'],
  '/iam/tenants/:id/logo': ['GET', 'POST'],
  '/iam/tenants/:id/sectors': ['GET', 'POST'],
  '/iam/tenants/:id/order-origins': ['GET', 'PATCH'],
  '/iam/tenants/:id/sectors/:id': ['PATCH', 'DELETE'],
  '/iam/tenants/:id/sla': ['GET', 'POST'],
  '/iam/users': ['GET', 'POST'],
  '/iam/users/:id': ['PATCH', 'DELETE'],

  '/integrations/ixc/configure': ['POST'],
  '/integrations/ixc/reconcile': ['POST'],

  '/knowledge/articles': ['GET', 'POST'],
  '/knowledge/articles/:id': ['PATCH', 'DELETE'],
  '/knowledge/credentials': ['GET', 'POST'],
  '/knowledge/credentials/:id': ['PATCH', 'DELETE'],
  '/knowledge/credentials/:id/reveal': ['POST'],
  '/knowledge/credentials/:id/history': ['GET'],
  '/knowledge/credentials/:id/totp': ['POST'],
  '/knowledge/credentials/summary': ['GET'],
  '/knowledge/credentials/providers': ['GET'],
  '/knowledge/notes': ['GET', 'POST'],
  '/knowledge/notes/:id': ['PATCH', 'DELETE'],

  '/notifications/config': ['GET', 'POST'],
  '/notifications/config/:id': ['PATCH', 'DELETE'],
  '/notifications/whatsapp/dispatch-order': ['POST'],

  '/on-call': ['GET', 'POST'],
  '/on-call/:id': ['DELETE'],
  '/on-call/current': ['GET'],
  '/on-call/roster': ['GET'],
  '/on-call/roster/policy': ['PUT'],
  '/on-call/roster/days/:date': ['PUT', 'DELETE'],

  '/os-process-templates': ['GET', 'POST'],
  '/service-processes': ['GET', 'POST'],
  '/service-processes/operational': ['GET', 'POST'],
  '/service-processes/operational/templates': ['GET', 'PUT'],
  '/service-processes/operational/assignees': ['GET'],
  '/service-processes/operational/validate': ['POST'],
  '/service-processes/operational/:id': ['GET'],
  '/service-processes/operational/:id/actions': ['POST'],
  '/service-processes/operational/:id/demo': ['POST'],
  '/service-processes/operational/:id/activate': ['POST'],
  '/service-processes/operational/:id/events/retry': ['POST'],
  '/service-processes/templates': ['GET', 'PUT'],
  '/service-processes/assignees': ['GET'],
  '/service-processes/:id': ['GET'],
  '/service-processes/:id/actions': ['POST'],
  '/os-process-templates/:id': ['GET', 'PATCH', 'DELETE'],
  '/os-process-templates/:id/toggle': ['PATCH'],

  '/reports/health-summary': ['GET'],
  '/shift-reports': ['GET', 'POST'],
  '/shift-reports/authors': ['GET'],
  '/shift-reports/order-search': ['GET'],
  '/shift-reports/:id': ['GET', 'PATCH'],
  '/shift-reports/:id/attachments': ['POST'],
  '/shift-reports/:id/attachments/:attachmentId/download': ['GET'],
  '/reports/manager-kpi': ['GET'],
  '/reports/management-overview': ['GET'],
  '/reports/operational-health': ['GET'],
  '/reports/service-order-flow': ['GET'],
  '/reports/service-types': ['GET'],

  '/service-catalog': ['GET', 'POST'],
  '/service-catalog/:id': ['GET', 'PUT', 'DELETE'],
  '/service-catalog/seed-defaults': ['POST'],

  '/service-orders': ['GET', 'POST'],
  '/service-orders/operational-alerts': ['GET'],
  '/service-orders/:id/operations': ['POST'],
  '/service-orders/occurrences/:id/close': ['POST'],
  '/service-orders/:id': ['GET', 'PATCH'],
  '/service-orders/:id/annotations': ['POST'],
  '/service-orders/:id/annotations/:id': ['PATCH'],
  '/service-orders/:id/approvals': ['POST'],
  '/service-orders/:id/attachments': ['POST'],
  '/service-orders/:id/attachments/:id/download': ['GET'],
  '/service-orders/:id/transition': ['PATCH'],
  '/service-orders/export/:id/download': ['GET'],
  '/service-orders/export/csv': ['GET'],
  '/service-orders/export/history': ['GET'],
  '/service-orders/occurrences': ['GET', 'POST'],
  '/service-orders/occurrences/:id': ['GET', 'PATCH'],
  '/service-orders/occurrences/:id/annotations': ['POST'],
  '/service-orders/occurrences/:id/orders': ['POST'],
  '/service-orders/summary': ['GET'],

  '/sla-policies': ['GET', 'POST'],
  '/sla-policies/:id': ['PATCH', 'DELETE'],
  '/sla/audit/:id': ['GET'],
  '/sla/breaches': ['GET'],
  '/sla/calendar': ['GET', 'POST'],
  '/sla/calendar/:id': ['DELETE'],
  '/sla/calendar/exceptions': ['POST'],
  '/sla/calendar/exceptions/:id': ['DELETE'],
  '/sla/simulate': ['GET'],

  '/time-entries': ['GET', 'POST'],
  '/time-entries/:id': ['DELETE'],
  '/time-entries/summary': ['GET'],
  '/time-entries/order-total': ['GET'],

  '/workflows': ['GET', 'POST'],
  '/workflows/:id': ['GET', 'PATCH', 'DELETE'],
  '/workflows/:id/executions': ['GET'],
  '/workflows/:id/rollback': ['POST'],
  '/workflows/:id/toggle': ['PATCH'],
  '/workflows/status': ['GET'],
};

/** Segmento dinâmico: ids, UUIDs, tokens e dias da semana; nunca "." ou ".." nem barras. */
const PARAM = '[A-Za-z0-9_-]{1,128}';

const COMPILED = Object.entries(ROUTES).map(([pattern, methods]) => ({
  pattern,
  methods: new Set<string>(methods),
  // Rotas literais têm precedência (ex.: /service-orders/summary antes de /service-orders/:id).
  literal: !pattern.includes(':'),
  regex: new RegExp(
    '^' +
      pattern
        .split('/')
        .map((segment) => (segment.startsWith(':') ? PARAM : segment.replace(/[-]/g, '\\-')))
        .join('/') +
      '$',
  ),
}));

export type AllowlistResult =
  { allowed: true; pattern: string } | { allowed: false; status: 404 | 405 };

export function matchAllowedRoute(method: string, path: string): AllowlistResult {
  const candidates = COMPILED.filter((route) => route.regex.test(path)).sort(
    (a, b) => Number(b.literal) - Number(a.literal),
  );
  if (!candidates.length) return { allowed: false, status: 404 };
  const route = candidates.find((candidate) => candidate.methods.has(method));
  return route ? { allowed: true, pattern: route.pattern } : { allowed: false, status: 405 };
}
