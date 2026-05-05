import { NextRequest, NextResponse } from 'next/server';
import { omitTenantIdFromBody, omitTenantIdFromSearchParams } from '../../../lib/strip-tenant-upstream';
import { apiBaseUrl } from '../auth/_lib';
import { applyRefreshIfNeeded, resolveAuthSession } from '../_proxy';

export async function GET(request: NextRequest) {
  const session = await resolveAuthSession(request);
  if (session instanceof NextResponse) return session;

  const searchParams = omitTenantIdFromSearchParams(new URL(request.url).searchParams);

  const response = await fetch(`${apiBaseUrl()}/service-orders?${searchParams.toString()}`, {
    headers: { authorization: `Bearer ${session.accessToken}` },
    cache: 'no-store'
  });

  const proxied = NextResponse.json(await response.json().catch(() => ([])), { status: response.status });
  return applyRefreshIfNeeded(proxied, session.refreshPayload);
}

export async function POST(request: NextRequest) {
  const session = await resolveAuthSession(request);
  if (session instanceof NextResponse) return session;

  const rawBody = await request.json().catch(() => ({}));
  const body = omitTenantIdFromBody(rawBody);

  const response = await fetch(`${apiBaseUrl()}/service-orders`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${session.accessToken}`,
      'content-type': 'application/json'
    },
    body: JSON.stringify(body),
    cache: 'no-store'
  });

  const text = await response.text();
  const proxied = NextResponse.json(text ? JSON.parse(text) : {}, { status: response.status });
  return applyRefreshIfNeeded(proxied, session.refreshPayload);
}

