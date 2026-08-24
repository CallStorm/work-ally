import { NextRequest, NextResponse } from 'next/server';

const API_TARGET =
  process.env.API_PROXY_TARGET?.replace(/\/$/, '') || 'http://127.0.0.1:3001';

const RETRYABLE_CODES = new Set(['ECONNREFUSED', 'ECONNRESET', 'EPIPE', 'ETIMEDOUT']);
const HOP_BY_HOP_HEADERS = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
  'host',
]);

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableError(error: unknown) {
  if (!error || typeof error !== 'object') return false;
  const code = 'code' in error ? String(error.code) : '';
  return RETRYABLE_CODES.has(code);
}

function buildTargetUrl(path: string[], search: string) {
  const suffix = path.length > 0 ? `/${path.join('/')}` : '';
  return `${API_TARGET}/api${suffix}${search}`;
}

function forwardRequestHeaders(request: NextRequest) {
  const headers = new Headers();
  request.headers.forEach((value, key) => {
    if (!HOP_BY_HOP_HEADERS.has(key.toLowerCase())) {
      headers.set(key, value);
    }
  });
  return headers;
}

function forwardResponseHeaders(response: Response) {
  const headers = new Headers();
  response.headers.forEach((value, key) => {
    if (!HOP_BY_HOP_HEADERS.has(key.toLowerCase())) {
      headers.set(key, value);
    }
  });
  return headers;
}

async function proxyRequest(request: NextRequest, path: string[]) {
  const targetUrl = buildTargetUrl(path, request.nextUrl.search);
  const headers = forwardRequestHeaders(request);
  const method = request.method.toUpperCase();
  const hasBody = method !== 'GET' && method !== 'HEAD';
  const body = hasBody ? await request.arrayBuffer() : undefined;
  const isSse =
    path.length >= 3 &&
    path[0] === 'runs' &&
    path[path.length - 1] === 'events';
  const maxAttempts = isSse ? 1 : 3;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const upstream = await fetch(targetUrl, {
        method,
        headers,
        body,
        cache: 'no-store',
        redirect: 'manual',
      });

      return new NextResponse(upstream.body, {
        status: upstream.status,
        statusText: upstream.statusText,
        headers: forwardResponseHeaders(upstream),
      });
    } catch (error) {
      const retryable = isRetryableError(error);
      if (retryable && attempt < maxAttempts - 1) {
        await sleep(350 * (attempt + 1));
        continue;
      }

      console.error(`API proxy failed for ${targetUrl}:`, error);
      return NextResponse.json(
        {
          message:
            '无法连接 API 服务。请确认已运行 pnpm dev（或 pnpm dev:api），然后刷新页面重试。',
          code: 'API_UNAVAILABLE',
        },
        { status: 503 },
      );
    }
  }

  return NextResponse.json(
    { message: '无法连接 API 服务。', code: 'API_UNAVAILABLE' },
    { status: 503 },
  );
}

type RouteContext = { params: Promise<{ path: string[] }> };

async function handle(request: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  return proxyRequest(request, path);
}

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
export const OPTIONS = handle;
