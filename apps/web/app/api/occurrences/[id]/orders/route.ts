import { NextRequest, NextResponse } from 'next/server';
import { apiBaseUrl } from '../../../auth/_lib';
import { applyRefreshIfNeeded, resolveAuthSession } from '../../../_proxy';

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await resolveAuthSession(request);
  if (session instanceof NextResponse) return session;

  const { id } = await context.params;
  const body = (await request.json()) as Record<string, unknown>;
  const tenantId = String(body.tenantId || request.nextUrl.searchParams.get('tenantId') || session.me.tenant!.id);

  const response = await fetch(`${apiBaseUrl()}/service-orders/occurrences/${encodeURIComponent(id)}/orders?tenantId=${encodeURIComponent(tenantId)}`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${session.accessToken}`,
      'content-type': 'application/json'
    },
    body: JSON.stringify(body),
    cache: 'no-store'
  });

  const text = await response.text();
  if (!response.ok) {
    return NextResponse.json({ error: text || 'Falha ao criar O.S na ocorrencia.' }, { status: response.status });
  }

  const proxied = NextResponse.json(text ? JSON.parse(text) : {});
  return applyRefreshIfNeeded(proxied, session.refreshPayload);
}
