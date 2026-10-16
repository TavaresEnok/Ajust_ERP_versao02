import { NextRequest, NextResponse } from 'next/server';
import { apiBaseUrl } from '../../auth/_lib';
import { applyRefreshIfNeeded, resolveAuthSession } from '../../_proxy';

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const session = await resolveAuthSession(request);
  if (session instanceof NextResponse) return session;

  const { id } = await context.params;

  const response = await fetch(`${apiBaseUrl()}/on-call/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: {
      authorization: `Bearer ${session.accessToken}`,
    },
    cache: 'no-store',
  });

  const text = await response.text();
  if (!response.ok) {
    return NextResponse.json(
      { error: text || 'Falha ao remover plantão da escala.' },
      { status: response.status },
    );
  }

  const proxied = NextResponse.json(text ? JSON.parse(text) : { success: true });
  return applyRefreshIfNeeded(proxied, session.refreshPayload);
}
