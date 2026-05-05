import { NextRequest, NextResponse } from 'next/server';
import { apiBaseUrl } from '../../../auth/_lib';
import { applyRefreshIfNeeded, resolveAuthSession } from '../../../_proxy';
import { omitTenantIdFromBody, omitTenantIdFromSearchParams } from '../../../../../lib/strip-tenant-upstream';

export async function GET(request: NextRequest) {
  const session = await resolveAuthSession(request);
  if (session instanceof NextResponse) return session;

  const params = omitTenantIdFromSearchParams(new URLSearchParams(request.nextUrl.searchParams));
  const response = await fetch(`${apiBaseUrl()}/knowledge/credentials/providers?${params.toString()}`, {
    method: 'GET',
    headers: { authorization: `Bearer ${session.accessToken}` },
    cache: 'no-store'
  });

  const text = await response.text();
  if (!response.ok) {
    return NextResponse.json({ error: text || 'Falha ao listar provedores de credenciais.' }, { status: response.status });
  }

  const proxied = NextResponse.json(text ? JSON.parse(text) : { items: [], total: 0, limit: 0, offset: 0 });
  return applyRefreshIfNeeded(proxied, session.refreshPayload);
}

