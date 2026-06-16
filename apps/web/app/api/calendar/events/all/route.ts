import { NextRequest, NextResponse } from 'next/server';
import { omitTenantIdFromSearchParams } from '../../../../../lib/strip-tenant-upstream';
import { apiBaseUrl } from '../../../auth/_lib';
import { applyRefreshIfNeeded, resolveAuthSession } from '../../../_proxy';

export async function GET(request: NextRequest) {
  const session = await resolveAuthSession(request);
  if (session instanceof NextResponse) return session;

  const searchParams = omitTenantIdFromSearchParams(
    new URLSearchParams(request.nextUrl.searchParams),
  );
  const response = await fetch(`${apiBaseUrl()}/calendar/events/all?${searchParams.toString()}`, {
    headers: { authorization: `Bearer ${session.accessToken}` },
    cache: 'no-store',
  });

  const proxied = NextResponse.json(await response.json().catch(() => []), {
    status: response.status,
  });
  return applyRefreshIfNeeded(proxied, session.refreshPayload);
}
