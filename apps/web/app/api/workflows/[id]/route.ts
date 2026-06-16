import { NextRequest, NextResponse } from 'next/server';
import { apiBaseUrl } from '../../auth/_lib';
import { applyRefreshIfNeeded, resolveAuthSession } from '../../_proxy';

export const dynamic = 'force-dynamic';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await resolveAuthSession(req);
  if (session instanceof NextResponse) return session;
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const res = await fetch(`${apiBaseUrl()}/workflows/${id}`, {
    method: 'PATCH',
    headers: { authorization: `Bearer ${session.accessToken}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
    cache: 'no-store',
  });
  const text = await res.text();
  if (!res.ok) return NextResponse.json({ error: text }, { status: res.status });
  return applyRefreshIfNeeded(
    NextResponse.json(text ? JSON.parse(text) : {}),
    session.refreshPayload,
  );
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await resolveAuthSession(req);
  if (session instanceof NextResponse) return session;
  const { id } = await params;
  const res = await fetch(`${apiBaseUrl()}/workflows/${id}`, {
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

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await resolveAuthSession(req);
  if (session instanceof NextResponse) return session;
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const res = await fetch(`${apiBaseUrl()}/workflows/${id}/rollback`, {
    method: 'POST',
    headers: { authorization: `Bearer ${session.accessToken}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
    cache: 'no-store',
  });
  const text = await res.text();
  if (!res.ok) return NextResponse.json({ error: text }, { status: res.status });
  return applyRefreshIfNeeded(
    NextResponse.json(text ? JSON.parse(text) : {}),
    session.refreshPayload,
  );
}
