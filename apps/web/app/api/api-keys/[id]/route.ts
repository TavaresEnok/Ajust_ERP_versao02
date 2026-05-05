import { NextRequest, NextResponse } from 'next/server';
import { apiBaseUrl } from '../../auth/_lib';
import { applyRefreshIfNeeded, resolveAuthSession } from '../../_proxy';
import { omitTenantIdFromBody, omitTenantIdFromSearchParams } from '../../../../lib/strip-tenant-upstream';

export const dynamic = 'force-dynamic';







export async function DELETE(req: NextRequest, { params }: any) {
  const session = await resolveAuthSession(req);
  if (session instanceof NextResponse) return session;
  const p = await params || {};
  const searchParams = omitTenantIdFromSearchParams(req.nextUrl.searchParams);
  let url = `${apiBaseUrl()}/api-keys/[id]`;
  for (const [k, v] of Object.entries(p)) url = url.replace(`[${k}]`, v as string);
  const res = await fetch(`${url}?${searchParams.toString()}`, { method: 'DELETE', headers: { authorization: `Bearer ${session.accessToken}` }, cache: 'no-store' });
  const text = await res.text();
  if (!res.ok) return NextResponse.json({ error: text }, { status: res.status });
  return applyRefreshIfNeeded(NextResponse.json(text ? JSON.parse(text) : {}), session.refreshPayload);
}

