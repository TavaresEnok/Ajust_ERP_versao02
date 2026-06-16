import { NextRequest, NextResponse } from 'next/server';
import { apiBaseUrl } from '../_lib';
import { applyRefreshIfNeeded, resolveAuthSession } from '../../_proxy';

export async function GET(request: NextRequest) {
  const session = await resolveAuthSession(request);
  if (session instanceof NextResponse) return session;

  const response = await fetch(`${apiBaseUrl()}/auth/socket-token`, {
    method: 'GET',
    headers: { authorization: `Bearer ${session.accessToken}` },
    cache: 'no-store',
  });
  const text = await response.text();
  if (!response.ok) {
    return NextResponse.json(
      { error: text || 'Falha ao emitir token do canal em tempo real.' },
      { status: response.status },
    );
  }
  const payload = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  const socketUrl = (
    process.env.WS_PUBLIC_URL ||
    process.env.API_BASE_URL ||
    request.nextUrl.origin
  )
    .trim()
    .replace(/\/+$/, '');
  return applyRefreshIfNeeded(NextResponse.json({ ...payload, socketUrl }), session.refreshPayload);
}
