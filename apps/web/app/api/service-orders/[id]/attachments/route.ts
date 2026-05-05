import { NextRequest, NextResponse } from 'next/server';
import { apiBaseUrl } from '../../../auth/_lib';
import { applyRefreshIfNeeded, resolveAuthSession } from '../../../_proxy';

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await resolveAuthSession(request);
  if (session instanceof NextResponse) return session;

  const { id } = await context.params;
  const formData = await request.formData();

  const response = await fetch(`${apiBaseUrl()}/service-orders/${encodeURIComponent(id)}/attachments`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${session.accessToken}`
    },
    body: formData,
    cache: 'no-store'
  });

  const text = await response.text();
  if (!response.ok) {
    return NextResponse.json({ error: text || 'Falha ao enviar anexos da O.S.' }, { status: response.status });
  }

  const parsed = text ? JSON.parse(text) : {};
  const proxied = NextResponse.json(parsed);
  return applyRefreshIfNeeded(proxied, session.refreshPayload);
}
