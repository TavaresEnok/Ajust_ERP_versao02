import { NextRequest, NextResponse } from 'next/server';
import { apiBaseUrl } from '../../auth/_lib';
import { applyRefreshIfNeeded, resolveAuthSession } from '../../_proxy';

export const dynamic = 'force-dynamic';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await resolveAuthSession(request);
  if (session instanceof NextResponse) return session;
  const { id } = await params;
  const body = await request.json();
    const response = await fetch(`${apiBaseUrl()}/change-management/${id}/transition`, {
    method: 'PATCH',
    headers: { authorization: `Bearer ${session.accessToken}`, 'content-type': 'application/json' },
    body: JSON.stringify(body), cache: 'no-store'
  });
  const text = await response.text();
  if (!response.ok) return NextResponse.json({ error: text }, { status: response.status });
  return applyRefreshIfNeeded(NextResponse.json(JSON.parse(text)), session.refreshPayload);
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await resolveAuthSession(request);
  if (session instanceof NextResponse) return session;
  const { id } = await params;
    const response = await fetch(`${apiBaseUrl()}/change-management/${id}`, {
    method: 'DELETE',
    headers: { authorization: `Bearer ${session.accessToken}` }, cache: 'no-store'
  });
  const text = await response.text();
  if (!response.ok) return NextResponse.json({ error: text }, { status: response.status });
  return applyRefreshIfNeeded(NextResponse.json(text ? JSON.parse(text) : {}), session.refreshPayload);
}
