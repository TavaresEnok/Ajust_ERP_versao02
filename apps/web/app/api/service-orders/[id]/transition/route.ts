import { NextRequest, NextResponse } from 'next/server';
import {
  omitTenantIdFromBody,
  omitTenantIdFromSearchParams,
} from '../../../../../lib/strip-tenant-upstream';
import { apiBaseUrl } from '../../../auth/_lib';
import { applyRefreshIfNeeded, resolveAuthSession } from '../../../_proxy';

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await resolveAuthSession(request);
  if (session instanceof NextResponse) return session;

  const { id } = await context.params;
  const raw = await request.json().catch(() => ({}));
  const body = omitTenantIdFromBody(raw);

  const ifMatch = request.headers.get('if-match');
  const headers: Record<string, string> = {
    authorization: `Bearer ${session.accessToken}`,
    'content-type': 'application/json',
  };
  if (ifMatch) {
    headers['if-match'] = ifMatch;
  }

  const response = await fetch(
    `${apiBaseUrl()}/service-orders/${encodeURIComponent(id)}/transition`,
    {
      method: 'PATCH',
      headers,
      body: JSON.stringify(body),
      cache: 'no-store',
    },
  );

  const text = await response.text();
  if (!response.ok) {
    return NextResponse.json(
      { error: text || 'Falha ao transicionar O.S.' },
      { status: response.status },
    );
  }

  const proxied = NextResponse.json(text ? JSON.parse(text) : {});
  const etag = response.headers.get('etag');
  if (etag) {
    proxied.headers.set('etag', etag);
  }
  return applyRefreshIfNeeded(proxied, session.refreshPayload);
}
