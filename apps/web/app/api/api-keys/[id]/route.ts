import { NextRequest, NextResponse } from 'next/server';
import { apiBaseUrl } from '../../auth/_lib';
import { applyRefreshIfNeeded, resolveAuthSession } from '../../_proxy';
import { omitTenantIdFromSearchParams } from '../../../../lib/strip-tenant-upstream';

export const dynamic = 'force-dynamic';

type ApiKeyRouteContext = {
  params: Promise<{ id: string }>;
};

export async function DELETE(req: NextRequest, { params }: ApiKeyRouteContext) {
  const session = await resolveAuthSession(req);
  if (session instanceof NextResponse) return session;
  const { id } = await params;
  const searchParams = omitTenantIdFromSearchParams(req.nextUrl.searchParams);
  const q = searchParams.toString();
  const url = `${apiBaseUrl()}/api-keys/${encodeURIComponent(id)}`;
  const res = await fetch(`${url}${q ? `?${q}` : ''}`, {
    method: 'DELETE',
    headers: { authorization: `Bearer ${session.accessToken}` },
    cache: 'no-store',
  });
  const text = await res.text();
  if (!res.ok) return NextResponse.json({ error: text }, { status: res.status });
  return applyRefreshIfNeeded(
    NextResponse.json(text ? JSON.parse(text) : {}),
    session.refreshPayload,
  );
}
