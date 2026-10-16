import { NextRequest, NextResponse } from 'next/server';
import { apiBaseUrl } from '../../_lib';
import { applyRefreshIfNeeded, resolveAuthSession } from '../../../_proxy';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await resolveAuthSession(request);
  if (session instanceof NextResponse) return session;

  const { id } = await params;

  const response = await fetch(`${apiBaseUrl()}/auth/sessions/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: {
      authorization: `Bearer ${session.accessToken}`,
      'content-type': 'application/json',
    },
    cache: 'no-store',
  });

  const text = await response.text();
  if (!response.ok) {
    return NextResponse.json(
      { error: text || 'Falha ao revogar sessão.' },
      { status: response.status },
    );
  }

  const proxied = NextResponse.json(text ? JSON.parse(text) : { success: true });
  return applyRefreshIfNeeded(proxied, session.refreshPayload);
}
