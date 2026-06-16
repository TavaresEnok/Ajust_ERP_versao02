import { NextRequest, NextResponse } from 'next/server';
import { omitTenantIdFromBody } from '../../../../../lib/strip-tenant-upstream';
import { apiBaseUrl } from '../../../auth/_lib';
import { applyRefreshIfNeeded, resolveAuthSession } from '../../../_proxy';

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await resolveAuthSession(request);
  if (session instanceof NextResponse) return session;

  const { id } = await context.params;
  const raw = await request.json().catch(() => ({}));
  const body = omitTenantIdFromBody(raw);

  const query = request.nextUrl.searchParams.toString();
  const response = await fetch(
    `${apiBaseUrl()}/calendar/events/${encodeURIComponent(id)}${query ? `?${query}` : ''}`,
    {
      method: 'PATCH',
      headers: {
        authorization: `Bearer ${session.accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
      cache: 'no-store',
    },
  );

  const text = await response.text();
  const proxied = NextResponse.json(text ? JSON.parse(text) : {}, { status: response.status });
  return applyRefreshIfNeeded(proxied, session.refreshPayload);
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await resolveAuthSession(request);
  if (session instanceof NextResponse) return session;

  const { id } = await context.params;
  const query = request.nextUrl.searchParams.toString();
  const response = await fetch(
    `${apiBaseUrl()}/calendar/events/${encodeURIComponent(id)}${query ? `?${query}` : ''}`,
    {
      method: 'DELETE',
      headers: { authorization: `Bearer ${session.accessToken}` },
      cache: 'no-store',
    },
  );

  const text = await response.text();
  const proxied = NextResponse.json(text ? JSON.parse(text) : {}, { status: response.status });
  return applyRefreshIfNeeded(proxied, session.refreshPayload);
}
