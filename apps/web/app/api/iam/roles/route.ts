import { NextRequest, NextResponse } from 'next/server';
import { apiBaseUrl } from '../../auth/_lib';
import { applyRefreshIfNeeded, resolveAuthSession } from '../../_proxy';

export async function GET(request: NextRequest) {
  const session = await resolveAuthSession(request);
  if (session instanceof NextResponse) return session;

  const response = await fetch(`${apiBaseUrl()}/iam/roles`, {
    method: 'GET',
    headers: { authorization: `Bearer ${session.accessToken}` },
    cache: 'no-store'
  });

  const text = await response.text();
  if (!response.ok) {
    return NextResponse.json({ error: text || 'Falha ao listar perfis.' }, { status: response.status });
  }

  const proxied = NextResponse.json(text ? JSON.parse(text) : []);
  return applyRefreshIfNeeded(proxied, session.refreshPayload);
}
