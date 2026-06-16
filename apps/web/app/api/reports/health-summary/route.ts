import { NextRequest, NextResponse } from 'next/server';
import { apiBaseUrl } from '../../auth/_lib';
import { applyRefreshIfNeeded, resolveAuthSession } from '../../_proxy';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = await resolveAuthSession(req);
  if (session instanceof NextResponse) return session;
  const res = await fetch(`${apiBaseUrl()}/reports/health-summary`, {
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
