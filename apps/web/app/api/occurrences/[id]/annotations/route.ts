import { NextRequest, NextResponse } from 'next/server';
import { omitTenantIdFromBody } from '../../../../../lib/strip-tenant-upstream';
import { apiBaseUrl } from '../../../auth/_lib';
import { applyRefreshIfNeeded, resolveAuthSession } from '../../../_proxy';

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await resolveAuthSession(request);
  if (session instanceof NextResponse) return session;

  const { id } = await context.params;
  const body = (await request.json()) as Record<string, unknown>;
  const payload = omitTenantIdFromBody(body);

  const response = await fetch(
    `${apiBaseUrl()}/service-orders/occurrences/${encodeURIComponent(id)}/annotations`,
    {
      method: 'POST',
      headers: {
        authorization: `Bearer ${session.accessToken}`,
        'content-type': 'application/json'
      },
      body: JSON.stringify(payload),
      cache: 'no-store'
    }
  );

  const text = await response.text();
  if (!response.ok) {
    return NextResponse.json({ error: text || 'Falha ao anotar ocorrencia.' }, { status: response.status });
  }

  const proxied = NextResponse.json(text ? JSON.parse(text) : {});
  return applyRefreshIfNeeded(proxied, session.refreshPayload);
}
