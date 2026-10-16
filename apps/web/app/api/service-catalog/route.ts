import { NextRequest, NextResponse } from 'next/server';
import { apiBaseUrl } from '../auth/_lib';
import { applyRefreshIfNeeded, resolveAuthSession } from '../_proxy';
import { omitTenantIdFromBody } from '../../../lib/strip-tenant-upstream';

export async function GET(request: NextRequest) {
  const session = await resolveAuthSession(request);
  if (session instanceof NextResponse) return session;

  const url = new URL(request.url);
  const category = url.searchParams.get('category');
  const activeOnly = url.searchParams.get('activeOnly');

  const queryParams = new URLSearchParams();
  if (category) queryParams.set('category', category);
  if (activeOnly) queryParams.set('activeOnly', activeOnly);

  const qs = queryParams.toString() ? `?${queryParams.toString()}` : '';

  const response = await fetch(`${apiBaseUrl()}/service-catalog${qs}`, {
    method: 'GET',
    headers: { authorization: `Bearer ${session.accessToken}` },
    cache: 'no-store',
  });

  const text = await response.text();
  if (!response.ok) {
    return NextResponse.json(
      { error: text || 'Falha ao buscar catálogo de serviços.' },
      { status: response.status },
    );
  }

  const proxied = NextResponse.json(text ? JSON.parse(text) : []);
  return applyRefreshIfNeeded(proxied, session.refreshPayload);
}

export async function POST(request: NextRequest) {
  const session = await resolveAuthSession(request);
  if (session instanceof NextResponse) return session;

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const payload = omitTenantIdFromBody(body);

  const response = await fetch(`${apiBaseUrl()}/service-catalog`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${session.accessToken}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(payload),
    cache: 'no-store',
  });

  const text = await response.text();
  if (!response.ok) {
    return NextResponse.json(
      { error: text || 'Falha ao cadastrar item no catálogo de serviços.' },
      { status: response.status },
    );
  }

  const proxied = NextResponse.json(text ? JSON.parse(text) : {});
  return applyRefreshIfNeeded(proxied, session.refreshPayload);
}
