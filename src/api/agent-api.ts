import { MockApiService } from '../lib/mock/mock-api';
import { realSocket, mapMessage, mapConversation } from '../lib/real/socket-service';
import { mockWsBus } from '../lib/mock/mock-ws-bus';
import { get, post, put, del, STORAGE_KEYS, ApiError } from './http';
import { AgentUser, ChatMessage, Conversation, JwtTokenPayload, MessageType, QuickReplyItem, TenantConfig, TenantItem } from '../types';
import { IS_MOCK } from './index';

// ---------- role / user mappers ----------

function mapRole(r: string): 'agent' | 'tenant_admin' | 'super_admin' {
  if (r === 'admin') return 'tenant_admin';
  if (r === 'super_admin') return 'super_admin';
  return 'agent';
}

function mapBackendUser(u: any): AgentUser {
  return {
    userId: u._id,
    tenantId: u.tenant_id || '',
    account: u.username,
    nickname: u.display_name,
    role: mapRole(u.role),
    status: u.online_status === 'busy' ? 'away' : (u.online_status || 'offline'),
    avatar: u.avatar_url || undefined,
    title: u.title || undefined,
    bio: u.bio || undefined,
    enabled: u.is_active !== false,
    createdAt: u.created_at || '',
  };
}

function mapJwtPayload(u: any): JwtTokenPayload {
  return {
    userId: u._id,
    tenantId: u.tenant_id || '',
    role: mapRole(u.role),
    nickname: u.display_name,
    account: u.username,
    avatar: u.avatar_url || undefined,
    title: u.title || undefined,
    bio: u.bio || undefined,
  };
}

// ---------- auth ----------

export async function loginAgent(account: string, pass: string): Promise<JwtTokenPayload> {
  if (IS_MOCK) {
    return MockApiService.login(account, pass);
  }
  const data = await post<{ token: string; user: any }>('/auth/login', {
    username: account,
    password: pass,
  });
  localStorage.setItem(STORAGE_KEYS.JWT, JSON.stringify({ token: data.token, user: data.user }));
  return mapJwtPayload(data.user);
}

export function getCurrentAgentToken(): JwtTokenPayload | null {
  if (IS_MOCK) {
    return MockApiService.getAuthToken();
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.JWT);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.token) {
      // real mode: verify exp
      try {
        const payload = JSON.parse(atob(parsed.token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
        if (payload?.exp && payload.exp * 1000 < Date.now()) return null; // expired
      } catch {
        /* keep token on parse failure */
      }
      return mapJwtPayload(parsed.user);
    }
    return parsed as JwtTokenPayload; // legacy mock payload shape
  } catch {
    return null;
  }
}

/**
 * Update the locally cached agent profile fields (avatar_url, display_name, title, bio)
 * in localStorage without changing the JWT token itself. Used after the agent saves
 * their profile so the sidebar reflects the new avatar/name immediately.
 */
export function updateStoredAgentProfile(partial: {
  avatar_url?: string;
  display_name?: string;
  title?: string;
  bio?: string;
}): void {
  if (IS_MOCK) {
    // mock mode: update the in-memory token by merging partial into the cached user
    const cur = MockApiService.getAuthToken();
    if (cur) {
      const merged: any = { ...cur };
      if (partial.avatar_url !== undefined) merged.avatar = partial.avatar_url;
      if (partial.display_name !== undefined) merged.nickname = partial.display_name;
      if (partial.title !== undefined) merged.title = partial.title;
      if (partial.bio !== undefined) merged.bio = partial.bio;
      MockApiService.setAuthToken(merged);
    }
    return;
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.JWT);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (parsed?.user) {
      if (partial.avatar_url !== undefined) parsed.user.avatar_url = partial.avatar_url;
      if (partial.display_name !== undefined) parsed.user.display_name = partial.display_name;
      if (partial.title !== undefined) parsed.user.title = partial.title;
      if (partial.bio !== undefined) parsed.user.bio = partial.bio;
      localStorage.setItem(STORAGE_KEYS.JWT, JSON.stringify(parsed));
    }
  } catch {
    /* ignore */
  }
}

export function logoutAgent(): void {
  if (IS_MOCK) {
    MockApiService.removeAuthToken();
    return;
  }
  localStorage.removeItem(STORAGE_KEYS.JWT);
  realSocket.disconnectAgent();
}

// ---------- conversations ----------

export async function getConversationList(params?: {
  status?: 'open' | 'closed' | 'queued';
  page?: number;
  pageSize?: number;
  keyword?: string;
}): Promise<{ list: Conversation[]; total: number; unreadTotal: number }> {
  if (IS_MOCK) {
    return MockApiService.getConversationList(params as any);
  }
  const query = new URLSearchParams();
  query.set('page', String(params?.page ?? 1));
  query.set('limit', String(params?.pageSize ?? 100));
  if (params?.status === 'closed') query.set('status', 'resolved');
  // 'open'/'queued' → fetch all and filter client-side (backend takes a single status value)
  const data = await get<{ total: number; list: any[] }>(`/conversations?${query.toString()}`, { auth: true });
  let list: Conversation[] = (data.list || []).map(mapConversation);
  if (params?.status === 'open') list = list.filter((c) => c.status !== 'closed');
  if (params?.status === 'queued') list = list.filter((c) => c.status === 'queued');
  if (params?.keyword) {
    const kw = params.keyword.toLowerCase();
    list = list.filter(
      (c) =>
        c.visitorName.toLowerCase().includes(kw) ||
        (c.lastMessage || '').toLowerCase().includes(kw)
    );
  }
  const unreadTotal = list.reduce((sum, c) => sum + (c.unreadCountForAgent || 0), 0);
  return { list, total: data.total ?? list.length, unreadTotal };
}

export async function getConversationDetail(id: string): Promise<Conversation> {
  if (IS_MOCK) {
    return MockApiService.getConversationDetail(id);
  }
  // Backend has no single-conversation GET; pull the list and pick ours.
  const { list } = await getConversationList({ page: 1, pageSize: 100 });
  const conv = list.find((c) => c.id === id);
  if (!conv) throw new ApiError(404, '会话不存在');
  return conv;
}

/** Agent-side message history (GET /conversations/:id/messages, Bearer JWT, paginated). */
export async function getAgentMessages(conversationId: string): Promise<ChatMessage[]> {
  if (IS_MOCK) {
    return MockApiService.getMessages(conversationId);
  }
  const data = await get<{ total: number; list: any[]; has_more: boolean }>(
    `/conversations/${conversationId}/messages?page=1&limit=50`,
    { auth: true }
  );
  const list: ChatMessage[] = (data?.list || []).map(mapMessage);
  return list.reverse();
}

export async function sendAgentMessage(
  conversationId: string,
  payload: {
    senderId: string;
    senderName: string;
    content: string;
    msgType?: MessageType;
    fileUrl?: string;
    fileName?: string;
    fileSize?: string;
    voiceDuration?: number;
    isInternalNote?: boolean;
  }
): Promise<ChatMessage> {
  if (IS_MOCK) {
    return MockApiService.sendMessage(conversationId, {
      ...payload,
      senderType: 'agent',
    });
  }
  const typeMap: Record<MessageType, string> = {
    text: 'text',
    image: 'image',
    file: 'file',
    voice: 'audio',
    video: 'video',
  };
  const richPayload: Record<string, any> = {};
  if (payload.fileUrl) richPayload.file_url = payload.fileUrl;
  if (payload.fileName) richPayload.file_name = payload.fileName;
  if (payload.fileSize) richPayload.file_size = payload.fileSize;
  if (payload.voiceDuration !== undefined) richPayload.audio_duration = payload.voiceDuration;

  const ack = await realSocket.agentSendMessage(conversationId, {
    type: typeMap[payload.msgType || 'text'],
    content: payload.content,
    payload: Object.keys(richPayload).length ? richPayload : undefined,
    is_internal: payload.isInternalNote || undefined,
  });

  return {
    // Backend ack carries {_id, created_at} — must read _id so the local append
    // dedupes against the new_message socket echo (otherwise the message shows twice)
    id: ack._id || ack.id,
    conversationId,
    senderType: 'agent',
    senderId: payload.senderId,
    senderName: payload.senderName,
    content: payload.content,
    msgType: payload.msgType || 'text',
    fileUrl: payload.fileUrl,
    fileName: payload.fileName,
    fileSize: payload.fileSize,
    voiceDuration: payload.voiceDuration,
    isInternalNote: payload.isInternalNote,
    isRead: false,
    createdAt: ack.created_at || new Date().toISOString(),
  };
}

export async function markAgentMessagesRead(conversationId: string): Promise<void> {
  if (IS_MOCK) {
    return MockApiService.markMessagesRead(conversationId, 'agent');
  }
  await realSocket.agentRead(conversationId).catch(() => undefined);
  // Ack-confirmed read: nudge every listener (sidebar per-item badge + layout
  // total) to refetch AFTER the backend processed the read, so unread badges
  // never linger on stale pre-read data.
  mockWsBus.dispatch('read', { conversationId, readerType: 'agent' });
}

/** Agent file upload (POST /agent/upload, Bearer JWT + multipart). */
export async function agentUploadFile(
  file: File,
  opts?: { type?: 'text' | 'image' | 'file' | 'audio'; durationSeconds?: number }
): Promise<{ url: string; name: string; size: string; type: string }> {
  if (IS_MOCK) {
    return MockApiService.uploadFile(file);
  }
  const isImage = file.type.startsWith('image/');
  const isAudio = file.type.startsWith('audio/') || file.type === 'audio/webm' || opts?.type === 'audio';
  const type = opts?.type || (isImage ? 'image' : isAudio ? 'audio' : 'file');
  const { getJwt, ApiError } = await import('./http');
  const jwt = getJwt();
  if (!jwt) throw new ApiError(401, '坐席未登录，无法上传文件');
  const formData = new FormData();
  formData.append('file', file);
  formData.append('type', type);
  if (opts?.durationSeconds !== undefined) formData.append('duration', String(opts.durationSeconds));
  const res = await fetch(`/api/v1/agent/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${jwt}` },
    body: formData,
  });
  const data = await res.json().catch(() => ({}));
  if (data.code >= 400) throw new ApiError(data.code, data.message || '上传失败');
  const size = data.data?.file_size;
  const sizeStr =
    typeof size === 'number'
      ? size > 1024 * 1024
        ? `${(size / 1024 / 1024).toFixed(1)} MB`
        : `${Math.max(1, Math.round(size / 1024))} KB`
      : String(size ?? '');
  return {
    url: data.data?.file_url,
    name: data.data?.file_name || file.name,
    size: sizeStr,
    type: data.data?.type,
  };
}

export async function claimConversation(conversationId: string): Promise<Conversation> {
  if (IS_MOCK) {
    return MockApiService.getConversationDetail(conversationId);
  }
  const data = await post<any>(`/conversations/${conversationId}/assign`, {}, { auth: true });
  return mapConversation(data.conversation || data);
}

/**
 * Join the conversation's socket room so the agent receives room-scoped events
 * (typing_status with draft preview). Idempotent; re-joins automatically on reconnect.
 */
export function joinConversationRoom(conversationId: string): void {
  if (IS_MOCK) return;
  realSocket.joinConversation(conversationId);
}

export async function transferConversation(
  conversationId: string,
  targetAgentId: string,
  transferNote?: string
): Promise<Conversation> {
  if (IS_MOCK) {
    return MockApiService.transferConversation(conversationId, targetAgentId);
  }
  const data = await post<any>(
    `/conversations/${conversationId}/assign`,
    { target_agent_id: targetAgentId, transfer_note: transferNote || '' },
    { auth: true }
  );
  return mapConversation(data.conversation || data);
}

export async function closeConversation(conversationId: string): Promise<Conversation> {
  if (IS_MOCK) {
    return MockApiService.closeConversation(conversationId);
  }
  await post<any>(`/conversations/${conversationId}/close`, { summary: '', tags: [] }, { auth: true });
  const conv = await getConversationDetail(conversationId).catch(() => null);
  return { ...(conv || ({ id: conversationId } as Conversation)), status: 'closed' };
}

export async function reopenConversation(conversationId: string): Promise<Conversation> {
  if (IS_MOCK) {
    return MockApiService.reopenConversation(conversationId);
  }
  // No backend endpoint yet
  throw new ApiError(404, '后端暂不支持重新开启会话');
}

/** Permanently delete a (closed) conversation and all of its messages. */
export async function deleteConversation(conversationId: string): Promise<void> {
  if (IS_MOCK) {
    return MockApiService.deleteConversation(conversationId);
  }
  await del(`/conversations/${conversationId}`, { auth: true });
}

// ---------- agents ----------

export async function getAgentList(): Promise<AgentUser[]> {
  if (IS_MOCK) {
    return MockApiService.getAgentList();
  }
  try {
    const data = await get<{ list: any[] }>(`/admin/agents?limit=100`, { auth: true });
    return (data.list || []).map(mapBackendUser);
  } catch (err) {
    if (err instanceof ApiError && (err.code === 403 || err.code === 401)) {
      // Preferred fallback: public widget endpoint carrying LIVE profile/status
      // data from the DB (the legacy peers below are built from the login-time
      // JWT snapshot + conversation names — always stale after profile edits).
      try {
        const pub = await get<{ list?: any[]; agents?: any[] }>(`/widget/agents`, {
          visitor: true,
        });
        const list = (pub.list || pub.agents || []) as any[];
        if (list.length) return list.map(mapBackendUser);
      } catch {
        /* widget endpoint not deployed yet — fall through to legacy peers */
      }
      // Agent role has no admin access: derive peers from populated conversations.
      const { list } = await getConversationList({ page: 1, pageSize: 100 });
      const peers = new Map<string, AgentUser>();
      const me = getCurrentAgentToken();
      if (me) {
        peers.set(me.userId, {
          userId: me.userId,
          tenantId: me.tenantId,
          account: me.account,
          nickname: me.nickname,
          role: me.role,
          status: 'online',
          avatar: me.avatar,
          title: me.title,
          bio: me.bio,
          enabled: true,
          createdAt: '',
        });
      }
      for (const c of list) {
        if (c.assignedAgentId && c.assignedAgentName && !peers.has(c.assignedAgentId)) {
          peers.set(c.assignedAgentId, {
            userId: c.assignedAgentId,
            tenantId: '',
            account: c.assignedAgentId,
            nickname: c.assignedAgentName,
            role: 'agent',
            status: 'online',
            enabled: true,
            createdAt: '',
          });
        }
      }
      return Array.from(peers.values());
    }
    throw err;
  }
}

export async function updateAgentProfile(payload: {
  nickname?: string;
  status?: 'online' | 'away' | 'offline';
  avatar?: string;
  title?: string;
  bio?: string;
  targetUserId?: string;
  password?: string;
}): Promise<AgentUser> {
  if (IS_MOCK) {
    return MockApiService.updateAgentProfile(payload);
  }
  const me = getCurrentAgentToken();
  const isSelf = !payload.targetUserId || !me || payload.targetUserId === me.userId;

  // Presence status only has a real endpoint for the logged-in agent (away → busy)
  if (payload.status && isSelf) {
    const backendStatus = payload.status === 'away' ? 'busy' : payload.status;
    await put<any>(`/agent/status`, { status: backendStatus }, { auth: true });
  }

  if (!isSelf) {
    // 管理员代改坐席资料：走管理接口（后端白名单：display_name/title/bio，avatar_url 会被忽略）
    return updateTenantAgent(payload.targetUserId!, {
      nickname: payload.nickname,
      title: payload.title,
      bio: payload.bio,
      password: payload.password,
    });
  }

  // PUT /agent/profile（P2 新接口）：昵称/头像/职称/简介持久化到库
  const body: Record<string, any> = {};
  if (payload.nickname !== undefined) body.display_name = payload.nickname;
  if (payload.avatar !== undefined) body.avatar_url = payload.avatar;
  if (payload.title !== undefined) body.title = payload.title;
  if (payload.bio !== undefined) body.bio = payload.bio;

  if (Object.keys(body).length) {
    const data = await put<any>(`/agent/profile`, body, { auth: true });
    // 同步刷新本地缓存的 JWT user（顶栏昵称/头像即时生效）
    const raw = localStorage.getItem(STORAGE_KEYS.JWT);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        parsed.user = { ...parsed.user, ...data };
        localStorage.setItem(STORAGE_KEYS.JWT, JSON.stringify(parsed));
      } catch {
        /* ignore */
      }
    }
    return mapBackendUser(data);
  }

  // 仅切换状态：返回本地合并视图
  return {
    userId: me?.userId || '',
    tenantId: me?.tenantId || '',
    account: me?.account || '',
    nickname: me?.nickname ?? '',
    role: me?.role || 'agent',
    status: payload.status ?? 'online',
    avatar: me?.avatar,
    title: me?.title,
    bio: me?.bio,
    enabled: true,
    createdAt: '',
  };
}

// ---------- canned responses ----------

function mapQuickReply(r: any): QuickReplyItem {
  return {
    id: r._id,
    title: r.title,
    content: r.content,
    category: r.category,
    shortcut: r.shortcut,
    createdAt: r.created_at || '',
  };
}

export async function getQuickReplies(): Promise<QuickReplyItem[]> {
  if (IS_MOCK) {
    return MockApiService.getQuickReplies();
  }
  const data = await get<{ list: any[] }>(`/canned-responses?limit=100`, { auth: true });
  return (data.list || []).map(mapQuickReply);
}

export async function createQuickReply(item: Omit<QuickReplyItem, 'id' | 'createdAt'>): Promise<QuickReplyItem> {
  if (IS_MOCK) {
    return MockApiService.createQuickReply(item);
  }
  const data = await post<any>(
    `/canned-responses`,
    { title: item.title, content: item.content, category: item.category, shortcut: item.shortcut },
    { auth: true }
  );
  return mapQuickReply(data);
}

export async function updateQuickReply(id: string, item: Partial<QuickReplyItem>): Promise<QuickReplyItem> {
  if (IS_MOCK) {
    return MockApiService.updateQuickReply(id, item);
  }
  const body: Record<string, any> = {};
  if (item.title !== undefined) body.title = item.title;
  if (item.content !== undefined) body.content = item.content;
  if (item.category !== undefined) body.category = item.category;
  if (item.shortcut !== undefined) body.shortcut = item.shortcut;
  const data = await put<any>(`/canned-responses/${id}`, body, { auth: true });
  return mapQuickReply(data);
}

export async function deleteQuickReply(id: string): Promise<void> {
  if (IS_MOCK) {
    return MockApiService.deleteQuickReply(id);
  }
  await del<any>(`/canned-responses/${id}`, { auth: true });
}

// ---------- tenant config (admin) ----------

let lastBusinessHours: any = null;

function mapTenantConfig(c: any): TenantConfig {
  lastBusinessHours = c.business_hours || lastBusinessHours;
  return {
    tenant_code: c.tenant_key || 'wgetcloud_live',
    tenant_name: c.tenant_name || '',
    theme_color: c.theme_color || '#1972f5',
    welcome_msg: c.welcome_msg || '',
    default_avatar: c.brand_avatar || undefined,
    work_start_time: c.business_hours?.start_time || '09:00',
    work_end_time: c.business_hours?.end_time || '18:00',
    enable_prechat_form: !!c.enable_prechat_form,
    enable_auto_popup: !!c.enable_auto_popup,
    auto_popup_delay_sec: Number(c.auto_popup_delay_sec) > 0 ? Number(c.auto_popup_delay_sec) : 5,
    auto_close_days: 7,
    enable_guide_options: !!c.enable_guide_options,
    guide_options: c.guide_options || [],
    widget_position: (c.widget_position as 'left' | 'right') || 'right',
    expires_at: c.expires_at ? String(c.expires_at).slice(0, 10) : undefined,
  } as TenantConfig;
}

/**
 * 企业主修改登录密码（tenant_admin 身份）。
 * 后端需实现 PUT /admin/tenant/password：校验 old_password 正确后将
 * 当前 tenant_admin 账号密码改为 new_password（≥6 位，bcrypt 存储）。
 */
export async function changeTenantPassword(payload: {
  oldPassword: string;
  newPassword: string;
}): Promise<void> {
  if (IS_MOCK) {
    return MockApiService.changeTenantPassword(payload);
  }
  await put<any>(
    `/admin/tenant/password`,
    { old_password: payload.oldPassword, new_password: payload.newPassword },
    { auth: true }
  );
}

export async function getTenantSetting(): Promise<TenantConfig> {
  if (IS_MOCK) {
    return MockApiService.getTenantSetting();
  }
  const data = await get<any>(`/admin/tenant/config`, { auth: true });
  return mapTenantConfig(data);
}

export async function updateTenantSetting(payload: Partial<TenantConfig>): Promise<TenantConfig> {
  if (IS_MOCK) {
    return MockApiService.updateTenantSetting(payload);
  }
  // Backend PUT whitelist: theme_color / welcome_msg / guide_options /
  // enable_guide_options / enable_prechat_form / widget_position / business_hours
  const body: Record<string, any> = {};
  if (payload.tenant_name !== undefined) body.tenant_name = payload.tenant_name;
  if (payload.theme_color && /^#[0-9a-fA-F]{6}$/.test(payload.theme_color)) body.theme_color = payload.theme_color;
  if (payload.welcome_msg !== undefined) body.welcome_msg = payload.welcome_msg;
  if (payload.guide_options) body.guide_options = payload.guide_options;
  if (payload.enable_guide_options !== undefined) body.enable_guide_options = payload.enable_guide_options;
  if (payload.enable_prechat_form !== undefined) body.enable_prechat_form = payload.enable_prechat_form;
  if (payload.enable_auto_popup !== undefined) body.enable_auto_popup = payload.enable_auto_popup;
  if (payload.default_avatar !== undefined) body.brand_avatar = payload.default_avatar || '';
  if (payload.auto_popup_delay_sec !== undefined) {
    const sec = Math.max(1, Math.min(300, Math.floor(Number(payload.auto_popup_delay_sec))));
    body.auto_popup_delay_sec = sec;
  }
  if ((payload as any).widget_position) body.widget_position = (payload as any).widget_position;
  if (payload.work_start_time || payload.work_end_time) {
    body.business_hours = {
      ...(lastBusinessHours || {}),
      enabled: lastBusinessHours?.enabled ?? true,
      work_days: lastBusinessHours?.work_days ?? [1, 2, 3, 4, 5],
      offline_msg: lastBusinessHours?.offline_msg ?? '',
      start_time: payload.work_start_time ?? lastBusinessHours?.start_time ?? '09:00',
      end_time: payload.work_end_time ?? lastBusinessHours?.end_time ?? '18:00',
    };
  }
  const data = await put<any>(`/admin/tenant/config`, body, { auth: true });
  return mapTenantConfig(data);
}

export interface WidgetEmbedInfo {
  snippet: string;
  script_url: string;
  tenant_key: string;
}

/**
 * 获取后端生成的 widget 嵌入代码（企业主 JWT）。
 * base_url 优先级：query 传入 > env.PUBLIC_BASE_URL > 请求协议+域名。
 */
export async function getWidgetEmbed(baseUrl?: string): Promise<WidgetEmbedInfo> {
  if (IS_MOCK) {
    const origin = baseUrl || window.location.origin;
    const cfg = await MockApiService.getTenantSetting();
    const tenantKey = cfg.tenant_code || 'wgetcloud_live';
    return {
      snippet: `<script src="${origin}/widget.js" data-tenant-id="${tenantKey}" async></script>`,
      script_url: `${origin}/widget.js`,
      tenant_key: tenantKey,
    };
  }
  const query = baseUrl ? `?base_url=${encodeURIComponent(baseUrl)}` : '';
  return get<WidgetEmbedInfo>(`/admin/widget/embed${query}`, { auth: true });
}

// ---------- agent management (admin) ----------

export async function getTenantAgents(): Promise<AgentUser[]> {
  if (IS_MOCK) {
    return MockApiService.getTenantAgents();
  }
  const data = await get<{ list: any[] }>(`/admin/agents?limit=100`, { auth: true });
  return (data.list || []).map(mapBackendUser);
}

export async function createTenantAgent(payload: {
  account: string;
  nickname: string;
  role: 'agent' | 'tenant_admin';
  password?: string;
}): Promise<AgentUser> {
  if (IS_MOCK) {
    return MockApiService.createTenantAgent(payload);
  }
  const password = payload.password || `lc_${Math.random().toString(36).slice(2, 10)}`;
  const data = await post<any>(
    `/admin/agents`,
    {
      username: payload.account,
      display_name: payload.nickname,
      role: payload.role === 'tenant_admin' ? 'admin' : 'agent',
      password,
    },
    { auth: true }
  );
  return mapBackendUser(data);
}

export async function updateTenantAgent(
  userId: string,
  payload: Partial<Pick<AgentUser, 'nickname' | 'role' | 'enabled' | 'title' | 'bio'>> & {
    maxConcurrentChats?: number;
    password?: string;
  }
): Promise<AgentUser> {
  if (IS_MOCK) {
    return MockApiService.updateTenantAgent(userId, payload);
  }
  const body: Record<string, any> = {};
  if (payload.nickname !== undefined) body.display_name = payload.nickname;
  if (payload.role !== undefined) body.role = payload.role === 'tenant_admin' ? 'admin' : 'agent';
  if (payload.enabled !== undefined) body.is_active = payload.enabled;
  if (payload.maxConcurrentChats !== undefined) body.max_concurrent_chats = payload.maxConcurrentChats;
  if (payload.password) body.password = payload.password;
  if (payload.title !== undefined) body.title = payload.title;
  if (payload.bio !== undefined) body.bio = payload.bio;
  const data = await put<any>(`/admin/agents/${userId}`, body, { auth: true });
  return mapBackendUser(data);
}

export async function deleteTenantAgent(userId: string): Promise<void> {
  if (IS_MOCK) {
    return;
  }
  await del<any>(`/admin/agents/${userId}`, { auth: true });
}

// ---------- visitor info (limited backend support) ----------

export async function updateVisitorBasicInfo(
  conversationId: string,
  payload: {
    name?: string;
    phone?: string;
    email?: string;
    notes?: string;
  }
): Promise<Conversation> {
  // Notify every open workbench (sidebar lists, bubbles) to patch the name
  // locally so all views stay consistent within the session even before the
  // backend persists + broadcasts the change.
  mockWsBus.dispatch('visitor_updated', {
    conversationId,
    name: payload.name,
  });
  if (IS_MOCK) {
    return MockApiService.updateVisitorBasicInfo(conversationId, payload);
  }
  const conv = await getConversationDetail(conversationId).catch(() => null);
  // Preferred: persist to the visitor document (PUT /visitors/:id, same family as
  // PUT /visitors/:id/tags). Graceful fallback to local-only edit while the
  // endpoint is not deployed or the conversation carries no visitor id.
  const visitorId = conv?.visitorInfo?.id;
  if (visitorId) {
    await put<any>(`/visitors/${visitorId}`, payload, { auth: true }).catch(() => null);
  }
  return {
    ...(conv || ({ id: conversationId } as Conversation)),
    visitorName: payload.name ?? conv?.visitorName ?? '',
    visitorInfo: {
      ...(conv?.visitorInfo || ({} as any)),
      name: payload.name ?? conv?.visitorInfo?.name ?? '',
      phone: payload.phone ?? conv?.visitorInfo?.phone ?? '',
      email: payload.email ?? conv?.visitorInfo?.email ?? '',
      notes: payload.notes ?? conv?.visitorInfo?.notes ?? '',
    },
  };
}

// ---------- platform super-admin (P0: /platform/* 仅 super_admin JWT) ----------

function mapPlatformTenant(t: any): TenantItem {
  return {
    id: t._id,
    tenantCode: t.tenant_key,
    name: t.tenant_name,
    domain: '',
    plan: 'standard',
    status: t.status === 'enabled' ? 'active' : 'suspended',
    maxSeats: t.max_agents ?? 0,
    usedSeats: t.agent_count ?? 0,
    activeChatsCount: t.conversation_count ?? 0,
    totalMessagesCount: t.conversation_count ?? 0,
    adminEmail: t.admin_email || '',
    createdAt: t.created_at || '',
    expireAt: t.expires_at ? String(t.expires_at).slice(0, 10) : '—',
    ownerName: t.owner_name || '',
    ownerContact: t.owner_contact || '',
    totalPaid: t.total_paid ?? 0,
    config: mapTenantConfig(t),
  };
}

export async function getPlatformTenants(params?: {
  keyword?: string;
  status?: string;
  plan?: string;
}): Promise<{ list: TenantItem[]; total: number }> {
  if (IS_MOCK) {
    return MockApiService.getPlatformTenants(params);
  }
  const qs = new URLSearchParams({ page: '1', limit: '100' });
  if (params?.keyword) qs.set('keyword', params.keyword);
  const data = await get<{ total: number; list: any[] }>(`/platform/tenants?${qs.toString()}`, { auth: true });
  let list: TenantItem[] = (data.list || []).map(mapPlatformTenant);
  if (params?.status && params.status !== 'all') list = list.filter((t) => t.status === params.status);
  if (params?.plan && params.plan !== 'all') list = list.filter((t) => t.plan === params.plan);
  return { list, total: data.total ?? list.length };
}

export async function createPlatformTenant(payload: {
  name: string;
  adminEmail: string;
  /** 企业主登录账号（后端 admin_username，成对必填，据此创建 tenant_admin 用户） */
  username: string;
  /** 企业主登录密码（≥6 位，后端 admin_password） */
  password: string;
  maxSeats: number;
  domain?: string;
  /** 公司负责人（选填） */
  ownerName?: string;
  /** 负责人联系方式（选填） */
  ownerContact?: string;
  /** 服务到期日 YYYY-MM-DD（选填 = 不限期） */
  expireAt?: string;
  /** 本次开通支付费用（元，选填） */
  paymentAmount?: number;
}): Promise<TenantItem> {
  if (IS_MOCK) {
    return MockApiService.createPlatformTenant(payload);
  }
  const body: Record<string, any> = {
    tenant_name: payload.name,
    admin_username: payload.username,
    admin_password: payload.password,
    max_agents: payload.maxSeats,
    expires_at: payload.expireAt || null,
  };
  if (payload.adminEmail) body.admin_email = payload.adminEmail;
  if (payload.domain) body.domain = payload.domain;
  if (payload.ownerName) body.owner_name = payload.ownerName;
  if (payload.ownerContact) body.owner_contact = payload.ownerContact;
  if (payload.paymentAmount != null && !Number.isNaN(payload.paymentAmount)) {
    body.payment_amount = payload.paymentAmount;
  }
  const data = await post<any>(`/platform/tenants`, body, { auth: true });
  return mapPlatformTenant(data);
}

/**
 * 企业续费：调整服务到期日并记录本次续费金额（累加到 total_paid）。
 * 后端 updateTenant 已接收 expires_at；payment_amount 需后端落库。
 */
export async function renewPlatformTenant(
  id: string,
  payload: { expireAt: string; paymentAmount?: number }
): Promise<TenantItem> {
  if (IS_MOCK) {
    return MockApiService.renewPlatformTenant(id, payload);
  }
  const body: Record<string, any> = { expires_at: payload.expireAt };
  if (payload.paymentAmount != null && !Number.isNaN(payload.paymentAmount)) {
    body.payment_amount = payload.paymentAmount;
  }
  const data = await put<any>(`/platform/tenants/${id}`, body, { auth: true });
  return mapPlatformTenant(data);
}

export async function updatePlatformTenant(id: string, payload: Partial<TenantItem>): Promise<TenantItem> {
  if (IS_MOCK) {
    return MockApiService.updatePlatformTenant(id, payload);
  }
  const body: Record<string, any> = {};
  if (payload.status !== undefined) body.status = payload.status === 'active' ? 'enabled' : 'disabled';
  if (payload.maxSeats !== undefined) body.max_agents = payload.maxSeats;
  if (payload.expireAt !== undefined) body.expires_at = payload.expireAt === '—' ? null : payload.expireAt;
  const data = await put<any>(`/platform/tenants/${id}`, body, { auth: true });
  return mapPlatformTenant(data);
}

export interface PlatformStats {
  totalTenants: number;
  activeTenants: number;
  totalAgents: number;
  onlineAgents: number;
  todayMessages: number;
  activeConversations: number;
  conversations: { total: number; resolved: number; active: number; queued: number; offline_lead: number };
  csat: { avg: number; rated_count: number };
  messagesTotal: number;
  dailyTrend: Array<{ date: string; conversations: number; messages: number }>;
  tenantRanking: Array<{
    tenantId: string;
    tenantKey: string;
    tenantName: string;
    status: string;
    conversations: number;
    messages: number;
  }>;
}

export async function getPlatformMetrics(): Promise<PlatformStats> {
  if (IS_MOCK) {
    // mock 模式仅提供旧版指标字段，新版字段由真实接口返回
    return MockApiService.getPlatformMetrics() as Promise<PlatformStats>;
  }
  const tzOffset = new Date().getTimezoneOffset();
  const d = await get<any>(`/platform/stats?tz_offset=${tzOffset}`, { auth: true });
  const trend: Array<{ date: string; conversations: number; messages: number }> = d.daily_trend || [];
  const today = trend.length ? trend[trend.length - 1] : { date: '', conversations: 0, messages: 0 };
  return {
    totalTenants: d.tenants?.total ?? 0,
    activeTenants: d.tenants?.enabled ?? 0,
    totalAgents: d.agents_total ?? 0,
    onlineAgents: 0, // 后端暂无全网在线坐席数
    todayMessages: today.messages ?? 0,
    activeConversations: d.conversations?.active ?? 0,
    conversations: {
      total: d.conversations?.total ?? 0,
      resolved: d.conversations?.resolved ?? 0,
      active: d.conversations?.active ?? 0,
      queued: d.conversations?.queued ?? 0,
      offline_lead: d.conversations?.offline_lead ?? 0,
    },
    csat: { avg: d.csat?.avg ?? 0, rated_count: d.csat?.rated_count ?? 0 },
    messagesTotal: d.messages_total ?? 0,
    dailyTrend: trend,
    tenantRanking: (d.tenant_ranking || []).map((r: any) => ({
      tenantId: r.tenant_id,
      tenantKey: r.tenant_key,
      tenantName: r.tenant_name,
      status: r.status,
      conversations: r.conversations ?? 0,
      messages: r.messages ?? 0,
    })),
  };
}

// ---------- analytics ----------

export interface AnalyticsOverview {
  conversations: {
    total: number;
    resolved: number;
    active: number;
    queued: number;
    offline_lead: number;
    avg_rating: number;
    rated_count: number;
  };
  first_response: { avg_seconds: number; replied_count: number };
  messages: { total: number; by_type: Record<string, number> };
  daily_trend: Array<{ date: string; conversations: number; messages: number }>;
  period: { start_date: string; end_date: string; tz_offset?: number; tz?: string };
  /** 统计口径说明（会话按创建日、消息按发送日；跨天长会话会在新一天只计消息） */
  metric_note?: string;
  /** P1 新增：渠道来源分布（按 source_url 域名聚合） */
  by_source?: Array<{ source: string; count: number }>;
  /** P1 新增：1~5 星评价分布 */
  csat_distribution?: Record<string, number>;
  /** P1 新增：解决效能（ART + SLA） */
  resolution?: {
    avg_seconds: number;
    resolved_with_duration: number;
    sla: { target_seconds: number; compliant_count: number; replied_count: number; compliant_rate: number };
  };
  /** P1 新增：坐席效能排行 */
  agent_ranking?: Array<{
    agent_id: string;
    username: string;
    display_name: string;
    avatar_url?: string;
    handled_count: number;
    resolved_count: number;
    avg_first_response_seconds: number;
    avg_rating: number;
  }>;
}

export async function getAnalyticsOverview(
  startDate: string,
  endDate: string
): Promise<AnalyticsOverview> {
  if (IS_MOCK) {
    throw new ApiError(404, 'mock 模式无 analytics');
  }
  // tz_offset：JS getTimezoneOffset 同口径（UTC+8 浏览器为 -480），保证日界按浏览器本地时区
  const tzOffset = new Date().getTimezoneOffset();
  return get<AnalyticsOverview>(
    `/admin/analytics/overview?start_date=${startDate}&end_date=${endDate}&tz_offset=${tzOffset}`,
    { auth: true }
  );
}
