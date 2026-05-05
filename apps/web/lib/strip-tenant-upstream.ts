/**
 * A API Nest aplica TenantIsolationGuard: tenantId em query/body é rejeitado.
 * O tenant efetivo vem sempre do JWT (sessão). O BFF não deve repassar tenantId ao upstream.
 */
export function omitTenantIdFromSearchParams(searchParams: URLSearchParams): URLSearchParams {
  const next = new URLSearchParams(searchParams.toString());
  next.delete('tenantId');
  return next;
}

export function omitTenantIdFromBody(body: unknown): Record<string, unknown> {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return {};
  }
  const { tenantId: _ignored, ...rest } = body as Record<string, unknown>;
  return rest;
}
