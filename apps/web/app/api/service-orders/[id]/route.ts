import { NextRequest, NextResponse } from 'next/server';
import { omitTenantIdFromBody, omitTenantIdFromSearchParams } from '../../../../lib/strip-tenant-upstream';
import { apiBaseUrl } from '../../auth/_lib';
import { applyRefreshIfNeeded, resolveAuthSession } from '../../_proxy';

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await resolveAuthSession(request);
  if (session instanceof NextResponse) return session;

  const { id } = await context.params;
  const raw = await request.json().catch(() => ({}));
  const body = omitTenantIdFromBody(raw);

  const response = await fetch(`${apiBaseUrl()}/service-orders/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: {
      authorization: `Bearer ${session.accessToken}`,
      'content-type': 'application/json'
    },
    body: JSON.stringify(body),
    cache: 'no-store'
  });

  const text = await response.text();
  if (!response.ok) {
    return NextResponse.json({ error: text || 'Falha ao atualizar O.S.' }, { status: response.status });
  }

  const proxied = NextResponse.json(text ? JSON.parse(text) : {});
  return applyRefreshIfNeeded(proxied, session.refreshPayload);
}

