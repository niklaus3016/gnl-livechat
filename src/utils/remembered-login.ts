/**
 * 「记住登录凭证」持久化：勾选后登录成功才写入，下次打开对应登录入口自动回填。
 * 按入口隔离（tenant / super / agent），三个登录页互不串用。
 */

export interface RememberedLogin {
  account: string;
  password: string;
}

const KEY_PREFIX = 'lc_remembered_login:';

export function getRememberedLogin(scope: 'tenant' | 'super' | 'agent'): RememberedLogin | null {
  try {
    const raw = localStorage.getItem(KEY_PREFIX + scope);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.account && parsed?.password) return parsed as RememberedLogin;
    return null;
  } catch {
    return null;
  }
}

export function saveRememberedLogin(
  scope: 'tenant' | 'super' | 'agent',
  cred: RememberedLogin
): void {
  try {
    localStorage.setItem(KEY_PREFIX + scope, JSON.stringify(cred));
  } catch {
    /* ignore */
  }
}

export function clearRememberedLogin(scope: 'tenant' | 'super' | 'agent'): void {
  try {
    localStorage.removeItem(KEY_PREFIX + scope);
  } catch {
    /* ignore */
  }
}
