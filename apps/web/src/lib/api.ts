const TOKEN_KEY = 'workally.accessToken';
const AUTH_KEY = 'workally.auth';

export type StoredAuth = {
  accessToken: string;
  user: {
    userId: string;
    tenantId: string;
    role: string;
    phone: string;
    name: string;
  };
  defaultGroupId: string | null;
  tenantId: string;
};

export function getApiBase() {
  // Prefer same-origin `/api` (Next rewrite → Nest) so LAN/Network URL works.
  const fromEnv = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, '');
  if (fromEnv) return fromEnv;
  if (typeof window !== 'undefined') return '/api';
  return 'http://127.0.0.1:3001/api';
}

export function loadAuth(): StoredAuth | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(AUTH_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredAuth;
  } catch {
    return null;
  }
}

export function saveAuth(auth: StoredAuth) {
  localStorage.setItem(AUTH_KEY, JSON.stringify(auth));
  localStorage.setItem(TOKEN_KEY, auth.accessToken);
}

export function clearAuth() {
  localStorage.removeItem(AUTH_KEY);
  localStorage.removeItem(TOKEN_KEY);
}

export function getToken() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isIdempotentRequest(method: string) {
  const normalized = method.toUpperCase();
  return normalized === 'GET' || normalized === 'HEAD';
}

async function fetchWithRetry(
  url: string,
  init: RequestInit,
): Promise<Response> {
  const method = init.method ?? 'GET';
  // Idempotent: wait through Nest --watch relaunch. Mutations: one extra 503 retry
  // (proxy already waits longer on ECONNREFUSED).
  const maxAttempts = isIdempotentRequest(method) ? 6 : 2;
  let lastError: unknown;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const res = await fetch(url, init);
      if (
        (res.status === 502 || res.status === 503) &&
        attempt < maxAttempts - 1
      ) {
        await sleep(Math.min(400 * (attempt + 1), 1500));
        continue;
      }
      return res;
    } catch (error) {
      lastError = error;
      if (attempt < maxAttempts - 1) {
        await sleep(Math.min(400 * (attempt + 1), 1500));
        continue;
      }
    }
  }

  if (lastError) throw lastError;
  throw new ApiError(
    '无法连接 API（Failed to fetch）。请确认 pnpm dev 中 API 已启动，并刷新页面。',
    0,
  );
}

export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  const isFormData =
    typeof FormData !== 'undefined' && init.body instanceof FormData;
  if (!headers.has('content-type') && init.body && !isFormData) {
    headers.set('content-type', 'application/json');
  }
  const token = getToken();
  if (token) headers.set('authorization', `Bearer ${token}`);

  let res: Response;
  try {
    res = await fetchWithRetry(`${getApiBase()}${path}`, {
      ...init,
      headers,
    });
  } catch {
    throw new ApiError(
      '无法连接 API（Failed to fetch）。请确认 pnpm dev 中 API 已启动，并刷新页面。',
      0,
    );
  }
  if (!res.ok) {
    let message = res.statusText;
    try {
      const data = (await res.json()) as { message?: string | string[] };
      message = Array.isArray(data.message)
        ? data.message.join(', ')
        : (data.message ?? message);
    } catch {
      // ignore
    }
    throw new ApiError(message, res.status);
  }
  if (res.status === 204) return undefined as T;
  // Nest `return null` yields an empty 200 body — treat as null, not JSON parse error.
  const text = await res.text();
  if (!text) return null as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new ApiError('接口返回了无法解析的响应', res.status);
  }
}

/** Authenticated binary download → browser save dialog. */
export async function apiDownload(path: string, filename: string) {
  const headers = new Headers();
  const token = getToken();
  if (token) headers.set('authorization', `Bearer ${token}`);

  let res: Response;
  try {
    res = await fetchWithRetry(`${getApiBase()}${path}`, { headers });
  } catch {
    throw new ApiError(
      '无法连接 API（Failed to fetch）。请确认 pnpm dev 中 API 已启动，并刷新页面。',
      0,
    );
  }
  if (!res.ok) {
    throw new ApiError(res.statusText || '下载失败', res.status);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    URL.revokeObjectURL(url);
  }
}
