import { NextRequest, NextResponse } from 'next/server';
import { omitTenantIdFromBody, omitTenantIdFromSearchParams } from '../../../../lib/strip-tenant-upstream';
import { apiBaseUrl } from '../../auth/_lib';
import { applyRefreshIfNeeded, resolveAuthSession } from '../../_proxy';

export async function GET(request: NextRequest) {
  const session = await resolveAuthSession(request);
  if (session instanceof NextResponse) return session;

  const params = omitTenantIdFromSearchParams(new URLSearchParams(request.nextUrl.searchParams));
  const response = await fetch(`${apiBaseUrl()}/iam/users?${params.toString()}`, {
    method: 'GET',
    headers: { authorization: `Bearer ${session.accessToken}` },
    cache: 'no-store'
  });

  const text = await response.text();
  if (!response.ok) {
    return NextResponse.json({ error: text || 'Falha ao listar usuarios.' }, { status: response.status });
  }

  const proxied = NextResponse.json(text ? JSON.parse(text) : []);
  return applyRefreshIfNeeded(proxied, session.refreshPayload);
}

export async function POST(request: NextRequest) {
  const session = await resolveAuthSession(request);
  if (session instanceof NextResponse) return session;

  const body = (await request.json()) as Record<string, unknown>;
  const payload = {
    ...omitTenantIdFromBody(body),
    tenantId: String(body.tenantId ?? session.me.tenant!.id)
  };

  const response = await fetch(`${apiBaseUrl()}/iam/users`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${session.accessToken}`,
      'content-type': 'application/json'
    },
    body: JSON.stringify(payload),
    cache: 'no-store'
  });

  const text = await response.text();
  if (!response.ok) {
    return NextResponse.json({ error: text || 'Falha ao criar usuario.' }, { status: response.status });
  }

  const proxied = NextResponse.json(text ? JSON.parse(text) : {});
  return applyRefreshIfNeeded(proxied, session.refreshPayload);
}
