import { NextRequest, NextResponse } from 'next/server';
import { apiBaseUrl } from '../../../../auth/_lib';
import { applyRefreshIfNeeded, resolveAuthSession } from '../../../../_proxy';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const session = await resolveAuthSession(request);
  if (session instanceof NextResponse) return session;

  const { id } = await context.params;
  const url = new URL(request.url);
  const fromId = url.searchParams.get('fromId') || '';
  const toId = url.searchParams.get('toId') || '';

  const response = await fetch(
    `${apiBaseUrl()}/cmdb/assets/${encodeURIComponent(id)}/snapshots-diff?fromId=${encodeURIComponent(fromId)}&toId=${encodeURIComponent(toId)}`,
    {
      method: 'GET',
      headers: {
        authorization: `Bearer ${session.accessToken}`,
        'content-type': 'application/json',
      },
      cache: 'no-store',
    },
  );

  const text = await response.text();
  if (!response.ok) {
    return NextResponse.json(
      { error: text || 'Falha ao comparar snapshots de configuração.' },
      { status: response.status },
    );
  }

  const proxied = NextResponse.json(text ? JSON.parse(text) : {});
  return applyRefreshIfNeeded(proxied, session.refreshPayload);
}
