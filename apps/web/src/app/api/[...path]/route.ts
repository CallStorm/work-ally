import { NextRequest, NextResponse } from 'next/server';

const API_TARGET =
  process.env.API_PROXY_TARGET?.replace(/\/$/, '') || 'http://127.0.0.1:3001';

const RETRYABLE_CODES = new Set([
  'ECONNREFUSED',
  'ECONNRESET',
  'EPIPE',
  'ETIMEDOUT',
  'UND_ERR_CONNECT_TIMEOUT',
  'UND_ERR_SOCKET',
]);
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

/** Nest --watch restarts often surface as TypeError("fetch failed") + cause.code. */
function isRetryableError(error: unknown) {
  let current: unknown = error;
  for (let depth = 0; depth < 5 && current; depth++) {
    if (typeof current === 'object') {
      const code =
        'code' in current && current.code != null ? String(current.code) : '';
      if (RETRYABLE_CODES.has(code)) return true;
      const message =
        current instanceof Error
          ? current.message
          : 'message' in current
            ? String((current as { message: unknown }).message)
            : '';
      if (/ECONNREFUSED|ECONNRESET|EPIPE|ETIMEDOUT|fetch failed/i.test(message)) {
        return true;
      }
      current = 'cause' in current ? (current as { cause: unknown }).cause : null;
      continue;
    }
    break;
  }
  return false;
}

function retryDelayMs(attempt: number) {
  // ~0.4s, 0.8s, 1.2s … capped — covers typical nest --watch relaunch gaps
  return Math.min(400 * (attempt + 1), 1500);
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
  // SSE also retries connection setup (stream itself is one-shot after open).
  const maxAttempts = isSse ? 8 : 10;

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
        await sleep(retryDelayMs(attempt));
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
