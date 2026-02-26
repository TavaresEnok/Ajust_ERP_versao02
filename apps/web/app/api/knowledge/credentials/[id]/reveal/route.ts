import { NextRequest, NextResponse } from 'next/server';
import { apiBaseUrl } from '../../../../auth/_lib';
import { applyRefreshIfNeeded, resolveAuthSession } from '../../../../_proxy';

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await resolveAuthSession(request);
  if (session instanceof NextResponse) return session;

  const { id } = await context.params;
  const tenantId = request.nextUrl.searchParams.get('tenantId') || session.me.tenant!.id;

  const response = await fetch(`${apiBaseUrl()}/knowledge/credentials/${encodeURIComponent(id)}/reveal?tenantId=${encodeURIComponent(tenantId)}`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${session.accessToken}`,
      'content-type': 'application/json'
    },
    body: JSON.stringify({}),
    cache: 'no-store'
  });

  const text = await response.text();
  if (!response.ok) {
    return NextResponse.json({ error: text || 'Falha ao revelar credencial.' }, { status: response.status });
  }

  const proxied = NextResponse.json(text ? JSON.parse(text) : {});
  return applyRefreshIfNeeded(proxied, session.refreshPayload);
}
