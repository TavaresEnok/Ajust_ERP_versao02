import { NextRequest, NextResponse } from 'next/server';
import { apiBaseUrl } from '../_lib';
import { applyRefreshIfNeeded, resolveAuthSession } from '../../_proxy';

export async function GET(request: NextRequest) {
  const session = await resolveAuthSession(request);
  if (session instanceof NextResponse) return session;

  const url = new URL(request.url);
  const targetUserId = url.searchParams.get('userId');

  const endpoint = targetUserId
    ? `${apiBaseUrl()}/auth/sessions/user/${encodeURIComponent(targetUserId)}`
    : `${apiBaseUrl()}/auth/sessions`;

  const response = await fetch(endpoint, {
    method: 'GET',
    headers: {
      authorization: `Bearer ${session.accessToken}`,
      'content-type': 'application/json',
    },
    cache: 'no-store',
  });

  const text = await response.text();
  if (!response.ok) {
    return NextResponse.json(
      { error: text || 'Falha ao consultar sessões ativas.' },
      { status: response.status },
    );
  }

  const proxied = NextResponse.json(text ? JSON.parse(text) : []);
  return applyRefreshIfNeeded(proxied, session.refreshPayload);
}

export async function POST(request: NextRequest) {
  // Logout all sessions
  const session = await resolveAuthSession(request);
  if (session instanceof NextResponse) return session;

  const response = await fetch(`${apiBaseUrl()}/auth/logout-all`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${session.accessToken}`,
      'content-type': 'application/json',
    },
    cache: 'no-store',
  });

  const text = await response.text();
  if (!response.ok) {
    return NextResponse.json(
      { error: text || 'Falha ao encerrar todas as sessões.' },
      { status: response.status },
    );
  }

  const proxied = NextResponse.json(text ? JSON.parse(text) : { success: true });
  return applyRefreshIfNeeded(proxied, session.refreshPayload);
}
