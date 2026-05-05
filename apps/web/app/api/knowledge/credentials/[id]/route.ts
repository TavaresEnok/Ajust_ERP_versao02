import { NextRequest, NextResponse } from 'next/server';
import { apiBaseUrl } from '../../../auth/_lib';
import { applyRefreshIfNeeded, resolveAuthSession } from '../../../_proxy';
import { omitTenantIdFromBody } from '../../../../../lib/strip-tenant-upstream';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await resolveAuthSession(request);
  if (session instanceof NextResponse) return session;

  const { id } = await params;
  const body = (await request.json()) as Record<string, unknown>;
  const payload = omitTenantIdFromBody(body);

  const response = await fetch(`${apiBaseUrl()}/knowledge/credentials/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: {
      authorization: `Bearer ${session.accessToken}`,
      'content-type': 'application/json'
    },
    body: JSON.stringify(payload),
    cache: 'no-store'
  });

  const text = await response.text();
  if (!response.ok) {
    return NextResponse.json({ error: text || 'Falha ao atualizar credencial.' }, { status: response.status });
  }

  const proxied = NextResponse.json(text ? JSON.parse(text) : {});
  return applyRefreshIfNeeded(proxied, session.refreshPayload);
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await resolveAuthSession(request);
  if (session instanceof NextResponse) return session;

  const { id } = await params;
    const response = await fetch(`${apiBaseUrl()}/knowledge/credentials/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: {
      authorization: `Bearer ${session.accessToken}`
    },
    cache: 'no-store'
  });

  const text = await response.text();
  if (!response.ok) {
    return NextResponse.json({ error: text || 'Falha ao remover credencial.' }, { status: response.status });
  }

  const proxied = NextResponse.json(text ? JSON.parse(text) : {});
  return applyRefreshIfNeeded(proxied, session.refreshPayload);
}
