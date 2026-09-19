/**
 * Unified HTTP client for the livechat backend.
 * - Envelope: { code, message, data } (code matches HTTP status)
 * - Visitor calls: X-Tenant-Key + X-Visitor-Token headers
 * - Agent/admin calls: Authorization: Bearer <JWT>
 */

export const TENANT_KEY = 'wgetcloud_live';

export const STORAGE_KEYS = {
  JWT: 'agent_jwt_token',
  VISITOR_TOKEN: 'visitor_token',
};

/** Visitor token shared via localStorage (same-origin tabs), used by agent-side upload fallback. */
export function getSharedVisitorToken(): string {
  if (typeof window === 'undefined') return '';
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.VISITOR_TOKEN);
    if (!raw) return '';
    return raw.replace(/^"|"$/g, '');
  } catch {
    return '';
  }
}

export function getJwt(): string {
  if (typeof window === 'undefined') return '';
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.JWT);
    if (!raw) return '';
    const parsed = JSON.parse(raw);
    // mock stored the whole JwtTokenPayload object; real mode stores {token, user}
    return parsed?.token || '';
  } catch {
    return '';
  }
}

export class ApiError extends Error {
  code: number;
  constructor(code: number, message: string) {
    super(message);
    this.code = code;
  }
}

type UnwrapOptions = {
  auth?: boolean; // attach Bearer token
  visitor?: boolean; // attach X-Tenant-Key / X-Visitor-Token
  visitorTokenOverride?: string;
};

function buildHeaders(opts: UnwrapOptions, json: boolean): Record<string, string> {
  const headers: Record<string, string> = {};
  if (json) headers['Content-Type'] = 'application/json';
  if (opts.auth) {
    const jwt = getJwt();
    if (jwt) headers['Authorization'] = `Bearer ${jwt}`;
  }
  if (opts.visitor) {
    headers['X-Tenant-Key'] = TENANT_KEY;
    const token = opts.visitorTokenOverride ?? getSharedVisitorToken();
    if (token) headers['X-Visitor-Token'] = token;
  }
  return headers;
}

function extractVisitorToken(headers: Record<string, string>): string | undefined {
  return headers['X-Visitor-Token'];
}

async function unwrap(res: Response): Promise<any> {
  let body: any = null;
  try {
    body = await res.json();
  } catch {
    throw new ApiError(res.status, `HTTP ${res.status}`);
  }
  const code = typeof body?.code === 'number' ? body.code : res.status;
  if (code >= 400) {
    throw new ApiError(code, body?.message || `请求失败 (${code})`);
  }
  return body?.data;
}

export async function request<T = any>(
  path: string,
  init: RequestInit & { opts?: UnwrapOptions } = {}
): Promise<T> {
  const { opts = {}, headers: extraHeaders, ...rest } = init;
  const headers = { ...buildHeaders(opts, !!rest.body && typeof rest.body === 'string'), ...(extraHeaders || {}) };
  if (opts.visitor && !headers['X-Visitor-Token']) {
    delete headers['X-Visitor-Token'];
  }
  const res = await fetch(`/api/v1${path}`, { ...rest, headers });
  return unwrap(res) as Promise<T>;
}

/** JSON request helper */
export function get<T = any>(path: string, opts: UnwrapOptions = {}): Promise<T> {
  return request<T>(path, { method: 'GET', opts });
}

export function post<T = any>(path: string, body?: any, opts: UnwrapOptions = {}): Promise<T> {
  return request<T>(path, {
    method: 'POST',
    body: body === undefined ? undefined : JSON.stringify(body),
    opts,
  });
}

export function put<T = any>(path: string, body?: any, opts: UnwrapOptions = {}): Promise<T> {
  return request<T>(path, {
    method: 'PUT',
    body: body === undefined ? undefined : JSON.stringify(body),
    opts,
  });
}

export function patch<T = any>(path: string, body?: any, opts: UnwrapOptions = {}): Promise<T> {
  return request<T>(path, {
    method: 'PATCH',
    body: body === undefined ? undefined : JSON.stringify(body),
    opts,
  });
}

export function del<T = any>(path: string, opts: UnwrapOptions = {}): Promise<T> {
  return request<T>(path, { method: 'DELETE', opts });
}

/** multipart upload (POST /widget/upload), returns data {file_url, file_name, file_size, mime_type, type} */
export async function upload(
  file: File,
  type: 'text' | 'image' | 'file' | 'audio',
  durationSeconds?: number
): Promise<{ file_url: string; file_name: string; file_size: number; mime_type: string; type: string }> {
  const headers = buildHeaders({ visitor: true }, false);
  const visitorToken = extractVisitorToken(headers);
  if (!visitorToken) {
    throw new ApiError(401, '访客会话未初始化，无法上传文件');
  }
  const formData = new FormData();
  formData.append('file', file);
  formData.append('type', type);
  if (durationSeconds !== undefined) formData.append('duration', String(durationSeconds));
  const res = await fetch(`/api/v1/widget/upload`, { method: 'POST', headers, body: formData });
  return unwrap(res);
}

/** Parse JWT exp; returns true when token present and not expired. */
export function isJwtValid(): boolean {
  const jwt = getJwt();
  if (!jwt) return false;
  try {
    const payloadPart = jwt.split('.')[1];
    const payload = JSON.parse(atob(payloadPart.replace(/-/g, '+').replace(/_/g, '/')));
    if (!payload?.exp) return true;
    return payload.exp * 1000 > Date.now();
  } catch {
    return true;
  }
}
