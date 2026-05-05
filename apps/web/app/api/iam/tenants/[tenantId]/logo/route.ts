import { NextRequest, NextResponse } from 'next/server';
import { apiBaseUrl } from '../../../../auth/_lib';
import { applyRefreshIfNeeded, resolveAuthSession } from '../../../../_proxy';

export async function GET(request: NextRequest, context: { params: Promise<{ tenantId: string }> }) {
  const session = await resolveAuthSession(request);
  if (session instanceof NextResponse) return session;

  const { tenantId } = await context.params;
  const response = await fetch(`${apiBaseUrl()}/iam/tenants/${encodeURIComponent(tenantId)}/logo`, {
    method: 'GET',
    headers: { authorization: `Bearer ${session.accessToken}` },
    cache: 'no-store'
  });

  if (!response.ok) {
    const text = await response.text();
    return NextResponse.json({ error: text || 'Falha ao carregar logo.' }, { status: response.status });
  }

  const bytes = await response.arrayBuffer();
  const proxied = new NextResponse(bytes, {
    status: 200,
    headers: {
      'content-type': response.headers.get('content-type') || 'application/octet-stream',
      'cache-control': 'no-store'
    }
  });

  return applyRefreshIfNeeded(proxied, session.refreshPayload);
}

export async function POST(request: NextRequest, context: { params: Promise<{ tenantId: string }> }) {
  const session = await resolveAuthSession(request);
  if (session instanceof NextResponse) return session;

  const { tenantId } = await context.params;
  const formData = await request.formData();
  const file = formData.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Arquivo de logo e obrigatorio.' }, { status: 400 });
  }

  const payload = new FormData();
  payload.set('file', file);

  const response = await fetch(`${apiBaseUrl()}/iam/tenants/${encodeURIComponent(tenantId)}/logo`, {
    method: 'POST',
    headers: { authorization: `Bearer ${session.accessToken}` },
    body: payload,
    cache: 'no-store'
  });

  const text = await response.text();
  if (!response.ok) {
    return NextResponse.json({ error: text || 'Falha ao atualizar logo.' }, { status: response.status });
  }

  const proxied = NextResponse.json(text ? JSON.parse(text) : {});
  return applyRefreshIfNeeded(proxied, session.refreshPayload);
}
