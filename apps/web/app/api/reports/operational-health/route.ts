import { NextRequest, NextResponse } from 'next/server';
import { apiBaseUrl } from '../../auth/_lib';
import { applyRefreshIfNeeded, resolveAuthSession } from '../../_proxy';
import {
  omitTenantIdFromBody,
  omitTenantIdFromSearchParams,
} from '../../../../lib/strip-tenant-upstream';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = await resolveAuthSession(req);
  if (session instanceof NextResponse) return session;
  const searchParams = omitTenantIdFromSearchParams(req.nextUrl.searchParams);
  const q = searchParams.toString();
  const res = await fetch(`${apiBaseUrl()}/reports/operational-health${q ? '?' + q : ''}`, {
    headers: { authorization: `Bearer ${session.accessToken}` },
    cache: 'no-store',
  });
  const text = await res.text();
  if (!res.ok) return NextResponse.json({ error: text }, { status: res.status });
  return applyRefreshIfNeeded(
    NextResponse.json(text ? JSON.parse(text) : {}),
    session.refreshPayload,
  );
}
