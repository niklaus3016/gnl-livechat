/**
 * Unified HTTP client for the livechat backend.
 * - Envelope: { code, message, data } (code matches HTTP status)
 * - Visitor calls: X-Tenant-Key + X-Visitor-Token headers
 * - Agent/admin calls: Authorization: Bearer <JWT>
 */

export const TENANT_KEY = 'wgetcloud_live';

/**
 * 访客挂件运行期实际租户键：
 * 挂件可嵌入任意租户（URL tenant 参数），上传/拉消息等请求必须带当前租户，
 * 不能写死演示租户。由 visitor-api 初始化（getTenantConfig/initConversation）时写入。
 */
let activeTenantKey = TENANT_KEY;
export function setActiveTenantKey(code?: string | null): void {
  if (code && typeof code === 'string' && code.trim()) activeTenantKey = code.trim();
}
export function getActiveTenantKey(): string {
  return activeTenantKey;
}

/**
 * 后端地址（构建期注入）：
 * - 默认 '' = 同源部署（生产环境前端构建产物由后端域名托管，全部走相对路径）
 * - 前端独立域名部署时，构建时设置 VITE_API_BASE_URL，例如
 *   VITE_API_BASE_URL=https://dzdqdodqktpq.sealoshzh.site
 */
export const API_ORIGIN = String(
  (import.meta as any).env?.VITE_API_BASE_URL ?? ''
).replace(/\/+$/, '');

/** REST 接口前缀（同源时为 /api/v1） */
export const API_BASE = `${API_ORIGIN}/api/v1`;

/**
 * 把后端返回的附件相对路径（如 /uploads/2026/xx.png）补全为可访问地址。
 * 同源部署原样返回；独立域名部署（API_ORIGIN 非空）时补后端域名。
 * 绝对 http(s)/协议相对/data/blob URL 一律原样返回。
 */
export function resolveAssetUrl(url?: string): string | undefined {
  if (!url) return url;
  if (/^(https?:)?\/\//i.test(url) || /^(data|blob):/i.test(url)) return url;
  if (url.startsWith('/') && API_ORIGIN) return `${API_ORIGIN}${url}`;
  return url;
}

export const STORAGE_KEYS = {
  /** 旧版统一 key（仅用于一次性迁移到分角色 key） */
  JWT: 'agent_jwt_token',
  JWT_SUPER: 'lc_jwt_super',
  JWT_ADMIN: 'lc_jwt_admin',
  JWT_AGENT: 'lc_jwt_agent',
  VISITOR_TOKEN: 'visitor_token',
};

/** 后端原始角色 → 前端角色（admin = tenant_admin） */
function normalizeRole(r?: string): 'agent' | 'tenant_admin' | 'super_admin' {
  if (r === 'super_admin') return 'super_admin';
  if (r === 'admin' || r === 'tenant_admin') return 'tenant_admin';
  return 'agent';
}

/** 角色 → 专属 localStorage key */
function roleKey(role: 'agent' | 'tenant_admin' | 'super_admin'): string {
  if (role === 'super_admin') return STORAGE_KEYS.JWT_SUPER;
  if (role === 'tenant_admin') return STORAGE_KEYS.JWT_ADMIN;
  return STORAGE_KEYS.JWT_AGENT;
}

/**
 * 当前页面区域的 token 读取优先级：
 * - /super：仅超管
 * - /admin：企业主 → 超管（两者共用同一个 AdminConsolePage）
 * - 其余（坐席工作台 / 访客页无 token）：坐席 → 企业主（可进坐席台）→ 超管
 */
function zoneKeyOrder(): string[] {
  if (typeof window === 'undefined') return [];
  const p = window.location.pathname;
  if (p.startsWith('/super')) return [STORAGE_KEYS.JWT_SUPER];
  if (p.startsWith('/admin')) return [STORAGE_KEYS.JWT_ADMIN, STORAGE_KEYS.JWT_SUPER];
  return [STORAGE_KEYS.JWT_AGENT, STORAGE_KEYS.JWT_ADMIN, STORAGE_KEYS.JWT_SUPER];
}

function parseRaw(raw: string): { token?: string; user?: any } | null {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * 旧版统一 key 一次性迁移：按 user.role 搬到分角色 key 后删除旧 key。
 * 保证已登录用户升级后不被登出。
 */
function migrateLegacyJwt(): void {
  try {
    const legacy = localStorage.getItem(STORAGE_KEYS.JWT);
    if (!legacy) return;
    const parsed = parseRaw(legacy);
    if (parsed?.token && parsed.user) {
      const role = normalizeRole(parsed.user.role);
      localStorage.setItem(roleKey(role), legacy);
    }
    localStorage.removeItem(STORAGE_KEYS.JWT);
  } catch {
    /* ignore */
  }
}

/**
 * 按当前页面区域返回生效的原始 JWT 存储串。
 * 三个角色各自独立 key：同一浏览器分别登录企业主和坐席互不覆盖。
 */
export function getActiveJwtRaw(): string | null {
  if (typeof window === 'undefined') return null;
  migrateLegacyJwt();
  for (const key of zoneKeyOrder()) {
    const raw = localStorage.getItem(key);
    if (raw) return raw;
  }
  return null;
}

/** 登录成功后按角色写入专属 key（不影响其他角色的登录态） */
export function saveJwtForRole(
  role: 'agent' | 'tenant_admin' | 'super_admin',
  raw: string
): void {
  if (typeof window === 'undefined') return;
  migrateLegacyJwt();
  localStorage.setItem(roleKey(role), raw);
}

/** 退出当前区域生效的登录态（只删当前角色 key，其他标签页的其他角色不受影响） */
export function clearActiveJwt(): void {
  if (typeof window === 'undefined') return;
  migrateLegacyJwt();
  for (const key of zoneKeyOrder()) {
    if (localStorage.getItem(key)) {
      localStorage.removeItem(key);
      return;
    }
  }
}

/** 就地修改当前生效 JWT 缓存里的 user 字段（头像/昵称更新即时生效） */
export function patchActiveJwtUser(mutator: (user: any) => void): void {
  if (typeof window === 'undefined') return;
  for (const key of zoneKeyOrder()) {
    const raw = localStorage.getItem(key);
    if (!raw) continue;
    const parsed = parseRaw(raw);
    if (parsed?.user) {
      mutator(parsed.user);
      localStorage.setItem(key, JSON.stringify(parsed));
    }
    return;
  }
}

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
  try {
    const raw = getActiveJwtRaw();
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
    headers['X-Tenant-Key'] = getActiveTenantKey();
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
  const res = await fetch(`${API_BASE}${path}`, { ...rest, headers });
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
  type: 'text' | 'image' | 'file' | 'audio' | 'video',
  durationSeconds?: number,
  visitorTokenOverride?: string
): Promise<{ file_url: string; file_name: string; file_size: number; mime_type: string; type: string }> {
  const headers = buildHeaders({ visitor: true, visitorTokenOverride }, false);
  const visitorToken = extractVisitorToken(headers);
  if (!visitorToken) {
    throw new ApiError(401, '访客会话未初始化，无法上传文件');
  }
  const formData = new FormData();
  formData.append('file', file);
  formData.append('type', type);
  if (durationSeconds !== undefined) formData.append('duration', String(durationSeconds));
  const res = await fetch(`${API_BASE}/widget/upload`, { method: 'POST', headers, body: formData });
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
