// Thin fetch wrapper: same-origin cookies, CSRF header on writes, stable error parsing.
// No token is ever read from / written to browser storage here.

export class ApiError extends Error {
  status: number;
  code: string;
  requestId: string | null;
  details: Record<string, unknown>;
  constructor(status: number, code: string, message: string, requestId: string | null = null, details: Record<string, unknown> = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.requestId = requestId;
    this.details = details;
  }
}

export type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface RequestOpts {
  body?: unknown;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  keepalive?: boolean;
  query?: Record<string, string | number | boolean | null | undefined>;
}

let unauthorizedHandler: (() => void) | null = null;
export function setUnauthorizedHandler(fn: (() => void) | null): void {
  unauthorizedHandler = fn;
}

function withQuery(path: string, q?: RequestOpts['query']): string {
  if (!q) return path;
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(q)) {
    if (v !== undefined && v !== null && v !== '') sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `${path}${path.includes('?') ? '&' : '?'}${s}` : path;
}

export async function parseError(res: Response): Promise<ApiError> {
  let body: unknown = null;
  const text = await res.text().catch(() => '');
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = null;
    }
  }
  const b = (body ?? {}) as Record<string, unknown>;
  if (typeof b.code === 'string') {
    return new ApiError(
      res.status,
      b.code,
      typeof b.message === 'string' ? b.message : res.statusText,
      typeof b.request_id === 'string' ? b.request_id : res.headers.get('X-Request-Id'),
      (b.details as Record<string, unknown>) ?? {},
    );
  }
  return new ApiError(res.status, `http_${res.status}`, text && !text.startsWith('<') ? text.slice(0, 200) : res.statusText || '請求失敗',
    res.headers.get('X-Request-Id'));
}

async function raw(method: Method, path: string, opts: RequestOpts = {}): Promise<Response> {
  const headers: Record<string, string> = { Accept: 'application/json, text/plain', ...(opts.headers ?? {}) };
  if (method !== 'GET') headers['X-Requested-With'] = 'edge-web'; // CSRF guard (server enforces for cookie sessions)
  let body: string | undefined;
  if (opts.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(opts.body);
  }
  let res: Response;
  try {
    res = await fetch(withQuery(path, opts.query), {
      method,
      headers,
      body,
      credentials: 'same-origin',
      signal: opts.signal,
      keepalive: opts.keepalive,
    });
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') throw e;
    throw new ApiError(0, 'network_error', '無法連線到 Edge 服務，請檢查網路或服務狀態');
  }
  if (!res.ok) {
    const err = await parseError(res);
    if (res.status === 401 && path !== '/v1/auth/login') unauthorizedHandler?.();
    throw err;
  }
  return res;
}

export async function api<T = unknown>(method: Method, path: string, opts: RequestOpts = {}): Promise<T> {
  const res = await raw(method, path, opts);
  const text = await res.text();
  if (!text) return undefined as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new ApiError(res.status, 'bad_response', '伺服器回應格式不正確', res.headers.get('X-Request-Id'));
  }
}

export async function apiText(path: string, opts: RequestOpts = {}): Promise<string> {
  const res = await raw('GET', path, opts);
  return res.text();
}

export const get = <T>(path: string, opts?: RequestOpts) => api<T>('GET', path, opts);
export const post = <T>(path: string, body?: unknown, opts?: RequestOpts) => api<T>('POST', path, { ...opts, body });
export const put = <T>(path: string, body?: unknown, opts?: RequestOpts) => api<T>('PUT', path, { ...opts, body });
export const patch = <T>(path: string, body?: unknown, opts?: RequestOpts) => api<T>('PATCH', path, { ...opts, body });
export const del = <T>(path: string, opts?: RequestOpts) => api<T>('DELETE', path, opts);

// ---- media session release on page hide / unmount -------------------------------------------
const tracked = new Set<string>();

/** Fire-and-forget DELETE that survives page unload. Never throws. */
export function releaseKeepalive(path: string): void {
  try {
    void fetch(path, {
      method: 'DELETE',
      keepalive: true,
      credentials: 'same-origin',
      headers: { 'X-Requested-With': 'edge-web' },
    }).catch(() => undefined);
  } catch {
    /* ignore */
  }
}

export function trackSession(deletePath: string): void {
  tracked.add(deletePath);
}
export function untrackSession(deletePath: string): void {
  tracked.delete(deletePath);
}

if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', () => {
    for (const p of tracked) releaseKeepalive(p);
    tracked.clear();
  });
}
