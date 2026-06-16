import { NextRequest, NextResponse } from 'next/server';
import { apiBaseUrl } from '../_lib';

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));

  const response = await fetch(`${apiBaseUrl()}/auth/reset-password`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    cache: 'no-store',
  });

  const text = await response.text();
  return NextResponse.json(text ? JSON.parse(text) : {}, { status: response.status });
}
