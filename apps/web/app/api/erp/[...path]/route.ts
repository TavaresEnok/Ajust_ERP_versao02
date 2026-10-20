import { NextRequest } from 'next/server';
import { forwardToApi } from '@/lib/bff/forward';

export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ path: string[] }> };

function socketUrl(request: NextRequest) {
  // O gateway Socket.IO roda no NestJS: usa a URL pública da API, não a origem do Next.
  return (
    process.env.WS_PUBLIC_URL ||
    process.env.NEXT_PUBLIC_WS_URL ||
    process.env.API_BASE_URL ||
    request.nextUrl.origin
  )
    .trim()
    .replace(/\/+$/, '');
}

async function handle(request: NextRequest, context: Context) {
  const { path } = await context.params;
  return forwardToApi(request, path, {
    transforms: {
      // O monitor em tempo real precisa saber onde está o gateway Socket.IO do NestJS.
      '/auth/socket-token': (data, req) => ({
        ...(data as Record<string, unknown>),
        socketUrl: socketUrl(req),
      }),
    },
    clearsSession: (pattern) => pattern === '/auth/logout-all',
  });
}

export const GET = handle;
export const POST = handle;
export const PATCH = handle;
export const PUT = handle;
export const DELETE = handle;
