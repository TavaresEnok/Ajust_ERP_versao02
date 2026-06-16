import { NextRequest, NextResponse } from 'next/server';
import { omitTenantIdFromBody } from '../../../../lib/strip-tenant-upstream';
import { apiBaseUrl } from '../../auth/_lib';
import { applyRefreshIfNeeded, resolveAuthSession } from '../../_proxy';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = await resolveAuthSession(req);
  if (session instanceof NextResponse) return session;
  const res = await fetch(`${apiBaseUrl()}/notifications/config`, {
    headers: { authorization: `Bearer ${session.accessToken}` },
    cache: 'no-store',
  });
  const text = await res.text();
  if (!res.ok) return NextResponse.json({ error: text }, { status: res.status });
  return applyRefreshIfNeeded(NextResponse.json(JSON.parse(text)), session.refreshPayload);
}

export async function POST(req: NextRequest) {
  const session = await resolveAuthSession(req);
  if (session instanceof NextResponse) return session;
  const body = await req.json();
  const res = await fetch(`${apiBaseUrl()}/notifications/config`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${session.accessToken}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(omitTenantIdFromBody(body)),
    cache: 'no-store',
  });
  const text = await res.text();
  if (!res.ok) return NextResponse.json({ error: text }, { status: res.status });
  return applyRefreshIfNeeded(NextResponse.json(JSON.parse(text)), session.refreshPayload);
}
