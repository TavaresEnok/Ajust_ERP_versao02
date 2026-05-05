import { NextRequest, NextResponse } from 'next/server';
import { apiBaseUrl } from '../../../../auth/_lib';
import { applyRefreshIfNeeded, resolveAuthSession } from '../../../../_proxy';

export async function GET(request: NextRequest, context: { params: Promise<{ tenantId: string }> }) {
  const session = await resolveAuthSession(request);
  if (session instanceof NextResponse) return session;

  const { tenantId } = await context.params;

  const response = await fetch(`${apiBaseUrl()}/iam/tenants/${encodeURIComponent(tenantId)}/sectors`, {
    method: 'GET',
    headers: { authorization: `Bearer ${session.accessToken}` },
    cache: 'no-store'
  });

  const text = await response.text();
  if (!response.ok) {
    return NextResponse.json({ error: text || 'Falha ao listar setores.' }, { status: response.status });
  }

  const proxied = NextResponse.json(text ? JSON.parse(text) : []);
  return applyRefreshIfNeeded(proxied, session.refreshPayload);
}

export async function POST(request: NextRequest, context: { params: Promise<{ tenantId: string }> }) {
  const session = await resolveAuthSession(request);
  if (session instanceof NextResponse) return session;

  const { tenantId } = await context.params;
  const body = (await request.json()) as Record<string, unknown>;

  const response = await fetch(`${apiBaseUrl()}/iam/tenants/${encodeURIComponent(tenantId)}/sectors`, {
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
    return NextResponse.json({ error: text || 'Falha ao criar setor.' }, { status: response.status });
  }

  const proxied = NextResponse.json(text ? JSON.parse(text) : {});
  return applyRefreshIfNeeded(proxied, session.refreshPayload);
}
