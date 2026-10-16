import { NextRequest, NextResponse } from 'next/server';
import { apiBaseUrl } from '../../auth/_lib';
import { applyRefreshIfNeeded, resolveAuthSession } from '../../_proxy';
import { omitTenantIdFromBody } from '../../../../lib/strip-tenant-upstream';

export async function POST(request: NextRequest) {
  const session = await resolveAuthSession(request);
  if (session instanceof NextResponse) return session;

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const payload = omitTenantIdFromBody(body);

  const response = await fetch(`${apiBaseUrl()}/notifications/whatsapp/dispatch-order`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${session.accessToken}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(payload),
    cache: 'no-store',
  });

  const text = await response.text();
  if (!response.ok) {
    return NextResponse.json(
      { error: text || 'Falha ao despachar notificação para WhatsApp.' },
      { status: response.status },
    );
  }

  const proxied = NextResponse.json(text ? JSON.parse(text) : {});
  return applyRefreshIfNeeded(proxied, session.refreshPayload);
}
