import { NextRequest, NextResponse } from 'next/server';
import { apiBaseUrl } from '../../../auth/_lib';
import { applyRefreshIfNeeded, resolveAuthSession } from '../../../_proxy';

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await resolveAuthSession(request);
  if (session instanceof NextResponse) return session;

  const { id } = await context.params;
  const body = (await request.json()) as Record<string, unknown>;

  const response = await fetch(`${apiBaseUrl()}/iam/tenants/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: {
      authorization: `Bearer ${session.accessToken}`,
      'content-type': 'application/json'
    },
    body: JSON.stringify(body),
    cache: 'no-store'
  });

  const text = await response.text();
  if (!response.ok) {
    return NextResponse.json({ error: text || 'Falha ao atualizar tenant.' }, { status: response.status });
  }

  const proxied = NextResponse.json(text ? JSON.parse(text) : {});
  return applyRefreshIfNeeded(proxied, session.refreshPayload);
}
