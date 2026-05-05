import { NextRequest, NextResponse } from 'next/server';
import { apiBaseUrl } from '../../auth/_lib';
import { applyRefreshIfNeeded, resolveAuthSession } from '../../_proxy';
import { omitTenantIdFromSearchParams, omitTenantIdFromBody } from '../../../../lib/strip-tenant-upstream';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const session = await resolveAuthSession(request);
  if (session instanceof NextResponse) return session;
  const params = omitTenantIdFromSearchParams(new URLSearchParams(request.nextUrl.searchParams));
  const response = await fetch(`${apiBaseUrl()}/cmdb/assets?${params.toString()}`, {
    headers: { authorization: `Bearer ${session.accessToken}` }, cache: 'no-store'
  });
  const text = await response.text();
  if (!response.ok) return NextResponse.json({ error: text }, { status: response.status });
  return applyRefreshIfNeeded(NextResponse.json(JSON.parse(text)), session.refreshPayload);
}

export async function POST(request: NextRequest) {
  const session = await resolveAuthSession(request);
  if (session instanceof NextResponse) return session;
  const body = await request.json() as Record<string, unknown>;
  const payload = omitTenantIdFromBody(body);
  const response = await fetch(`${apiBaseUrl()}/cmdb/assets`, {
    method: 'POST',
    headers: { authorization: `Bearer ${session.accessToken}`, 'content-type': 'application/json' },
    body: JSON.stringify(payload), cache: 'no-store'
  });
  const text = await response.text();
  if (!response.ok) return NextResponse.json({ error: text }, { status: response.status });
  return applyRefreshIfNeeded(NextResponse.json(JSON.parse(text)), session.refreshPayload);
}
