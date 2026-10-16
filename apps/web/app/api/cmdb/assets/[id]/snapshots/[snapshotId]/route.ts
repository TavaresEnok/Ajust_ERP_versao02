import { NextRequest, NextResponse } from 'next/server';
import { apiBaseUrl } from '../../../../../auth/_lib';
import { applyRefreshIfNeeded, resolveAuthSession } from '../../../../../_proxy';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string; snapshotId: string }> },
) {
  const session = await resolveAuthSession(request);
  if (session instanceof NextResponse) return session;

  const { id, snapshotId } = await context.params;

  const response = await fetch(
    `${apiBaseUrl()}/cmdb/assets/${encodeURIComponent(id)}/snapshots/${encodeURIComponent(snapshotId)}`,
    {
      method: 'GET',
      headers: {
        authorization: `Bearer ${session.accessToken}`,
        'content-type': 'application/json',
      },
      cache: 'no-store',
    },
  );

  const text = await response.text();
  if (!response.ok) {
    return NextResponse.json(
      { error: text || 'Falha ao obter conteúdo do snapshot.' },
      { status: response.status },
    );
  }

  const proxied = NextResponse.json(text ? JSON.parse(text) : {});
  return applyRefreshIfNeeded(proxied, session.refreshPayload);
}
