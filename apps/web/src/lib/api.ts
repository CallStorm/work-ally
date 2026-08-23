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
    res = await fetch(`${getApiBase()}${path}`, {
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
  return (await res.json()) as T;
}
