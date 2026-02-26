import { NextRequest, NextResponse } from 'next/server';
import { apiBaseUrl } from '../../../auth/_lib';
import { applyRefreshIfNeeded, resolveAuthSession } from '../../../_proxy';

export async function GET(request: NextRequest) {
  const session = await resolveAuthSession(request);
  if (session instanceof NextResponse) return session;

  const params = new URLSearchParams(request.nextUrl.searchParams);
  if (!params.get('tenantId')) {
    params.set('tenantId', session.me.tenant!.id);
  }

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
