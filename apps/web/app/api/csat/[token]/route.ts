import { NextRequest, NextResponse } from 'next/server';
import { apiBaseUrl } from '../../auth/_lib';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  // Public endpoint — no auth needed, token is the secret
  const res = await fetch(`${apiBaseUrl()}/csat/${token}`, { cache: 'no-store' });
  const text = await res.text();
  if (!res.ok) return NextResponse.json({ error: 'Pesquisa não encontrada.' }, { status: 404 });
  return NextResponse.json(text ? JSON.parse(text) : {});
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const body = await req.json().catch(() => ({}));
  const res = await fetch(`${apiBaseUrl()}/csat/${token}/answer`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    cache: 'no-store'
  });
  const text = await res.text();
  if (!res.ok) return NextResponse.json({ error: text }, { status: res.status });
  return NextResponse.json(text ? JSON.parse(text) : {});
}
