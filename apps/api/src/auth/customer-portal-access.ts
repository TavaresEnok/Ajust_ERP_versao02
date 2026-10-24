// Fail closed for customer-linked accounts: legacy tenant-wide endpoints are not safe
// for a consultancy with several customers in the SAME Ajust workspace.
export function customerPortalRequestAllowed(method: string, path: string, tenantId: string) {
  const clean = path.replace(/\/+$/, '') || '/';
  if (method === 'GET' && /^\/customer-portal(?:\/orders\/[a-f0-9-]+|\/agenda)?$/i.test(clean))
    return true;
  if (clean === '/auth/me' && ['GET', 'PATCH'].includes(method)) return true;
  if (['/auth/logout', '/auth/logout-all'].includes(clean) && method === 'POST') return true;
  if (clean === '/auth/sessions' && method === 'GET') return true;
  if (/^\/auth\/sessions\/[a-f0-9-]+$/i.test(clean) && method === 'DELETE') return true;
  if (
    ['/auth/2fa/setup', '/auth/2fa/confirm', '/auth/2fa/disable'].includes(clean) &&
    method === 'POST'
  )
    return true;
  if (clean === '/auth/2fa/status' && method === 'GET') return true;
  if (clean === `/iam/tenants/${tenantId}/logo` && method === 'GET') return true;
  if (clean === '/knowledge/notes' && ['GET', 'POST'].includes(method)) return true;
  return /^\/knowledge\/notes\/[a-f0-9-]+$/i.test(clean) && ['PATCH', 'DELETE'].includes(method);
}
