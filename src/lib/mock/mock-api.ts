import {
  AgentUser,
  ChatMessage,
  Conversation,
  JwtTokenPayload,
  MessageSenderType,
  MessageType,
  OfflineMessagePayload,
  QuickReplyItem,
  TenantConfig,
  TenantItem,
} from '../../types';
import {
  INITIAL_AGENTS,
  INITIAL_CONVERSATIONS,
  INITIAL_MESSAGES,
  INITIAL_QUICK_REPLIES,
  INITIAL_TENANT_CONFIG,
  INITIAL_TENANTS,
} from './mock-data';
import { mockWsBus } from './mock-ws-bus';

// Local storage keys for persistent mock testing
const STORAGE_KEYS = {
  TENANTS: 'mock_tenants_list',
  TENANT_CONFIG: 'mock_tenant_config',
  AGENTS: 'mock_agents',
  CONVERSATIONS: 'mock_conversations',
  MESSAGES: 'mock_messages',
  QUICK_REPLIES: 'mock_quick_replies',
  OFFLINE_MSGS: 'mock_offline_messages',
  AUTH_TOKEN: 'agent_jwt_token',
  VISITOR_TOKEN: 'visitor_token',
  VISITOR_PRECHAT: 'visitor_prechat_submitted',
};

// Helper: LocalStorage read & write with initial defaults
function getStored<T>(key: string, defaultVal: T): T {
  if (typeof window === 'undefined') return defaultVal;
  try {
    const item = localStorage.getItem(key);
    if (!item) {
      localStorage.setItem(key, JSON.stringify(defaultVal));
      return defaultVal;
    }
    return JSON.parse(item);
  } catch (e) {
    console.error(`Failed to read ${key} from storage:`, e);
    return defaultVal;
  }
}

function setStored<T>(key: string, val: T): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch (e) {
    console.error(`Failed to write ${key} to storage:`, e);
  }
}

// Format current time HH:mm
export function formatCurrentTime(): string {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

export class MockApiService {
  // Reset all mock data to factory state
  public static resetToDefault(): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(STORAGE_KEYS.TENANT_CONFIG, JSON.stringify(INITIAL_TENANT_CONFIG));
    localStorage.setItem(STORAGE_KEYS.AGENTS, JSON.stringify(INITIAL_AGENTS));
    localStorage.setItem(STORAGE_KEYS.CONVERSATIONS, JSON.stringify(INITIAL_CONVERSATIONS));
    localStorage.setItem(STORAGE_KEYS.MESSAGES, JSON.stringify(INITIAL_MESSAGES));
    localStorage.setItem(STORAGE_KEYS.QUICK_REPLIES, JSON.stringify(INITIAL_QUICK_REPLIES));
    localStorage.removeItem(STORAGE_KEYS.OFFLINE_MSGS);
    localStorage.removeItem(STORAGE_KEYS.VISITOR_PRECHAT);
  }

  // --- Auth / JWT Helpers ---
  public static getAuthToken(): JwtTokenPayload | null {
    if (typeof window === 'undefined') return null;
    const tokenStr = localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
    if (!tokenStr) return null;
    try {
      return JSON.parse(tokenStr);
    } catch {
      return null;
    }
  }

  public static setAuthToken(payload: JwtTokenPayload): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, JSON.stringify(payload));
  }

  public static removeAuthToken(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN);
  }

  public static getVisitorToken(): string {
    if (typeof window === 'undefined') return 'vis_token_demo';
    // URL 上的 vt 参数可显式指定访客身份（嵌入方归因/测试用），优先级最高
    try {
      const vtParam = new URLSearchParams(window.location.search).get('vt');
      if (vtParam) {
        localStorage.setItem(STORAGE_KEYS.VISITOR_TOKEN, vtParam);
        return vtParam;
      }
    } catch {
      // ignore malformed URL
    }
    let token = localStorage.getItem(STORAGE_KEYS.VISITOR_TOKEN);
    if (!token) {
      // 首次访问生成唯一匿名 token（不能用共享默认值，否则所有无痕访客会串成同一个人）
      token = `vis_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
      localStorage.setItem(STORAGE_KEYS.VISITOR_TOKEN, token);
    }
    return token;
  }

  // --- Visitor APIs ---
  public static async getTenantConfig(tenantCode?: string): Promise<TenantConfig> {
    const config = getStored<TenantConfig>(STORAGE_KEYS.TENANT_CONFIG, INITIAL_TENANT_CONFIG);
    // Automatic migration for cached legacy local storage: ensure working hours state (00:00 - 23:59) & 光年跃迁 branding
    if (config.work_start_time === '08:30' || config.work_end_time === '21:00' || config.tenant_name?.includes('光年跃迁')) {
      config.work_start_time = '00:00';
      config.work_end_time = '23:59';
      config.tenant_name = '光年跃迁';
      config.theme_color = '#1972f5';
    }
    // Migration: ensure proactive trigger & channels are present
    if (!config.proactive_trigger) {
      config.proactive_trigger = INITIAL_TENANT_CONFIG.proactive_trigger;
    }
    if (!config.channels) {
      config.channels = INITIAL_TENANT_CONFIG.channels;
    }
    setStored(STORAGE_KEYS.TENANT_CONFIG, config);
    return { ...config };
  }

  public static async initConversation(
    visitorToken: string,
    tenantCode: string,
    visitorMeta?: { name?: string; email?: string }
  ): Promise<Conversation> {
    const conversations = getStored<Conversation[]>(STORAGE_KEYS.CONVERSATIONS, INITIAL_CONVERSATIONS);
    const existing = conversations.find((c) => c.visitorToken === visitorToken);

    if (existing) {
      if (visitorMeta?.name && visitorMeta.name !== existing.visitorName) {
        existing.visitorName = visitorMeta.name;
        existing.visitorInfo.name = visitorMeta.name;
        if (visitorMeta.email) existing.visitorInfo.email = visitorMeta.email;
        setStored(STORAGE_KEYS.CONVERSATIONS, conversations);
      }
      return existing;
    }

    // Create new conversation
    const newId = `conv-${Date.now().toString(36)}`;
    const newConv: Conversation = {
      id: newId,
      tenantId: tenantCode || 'tenant_001',
      visitorToken,
      visitorName: visitorMeta?.name || `访客_${Math.random().toString(36).substring(2, 6)}`,
      visitorInfo: {
        token: visitorToken,
        name: visitorMeta?.name || '在线访客',
        email: visitorMeta?.email || '',
        ip: '183.14.31.' + Math.floor(Math.random() * 250 + 1),
        location: '中国 (在线网页接入)',
        referer: typeof window !== 'undefined' ? window.location.href : 'https://client-site.com',
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
        firstVisitAt: new Date().toLocaleString(),
      },
      assignedAgentId: 'agent_1',
      assignedAgentName: 'James',
      status: 'open',
      lastMessage: '新会话已建立',
      lastMessageTime: formatCurrentTime(),
      unreadCountForAgent: 0,
      unreadCountForVisitor: 0,
      createdAt: new Date().toLocaleString(),
      updatedAt: new Date().toLocaleString(),
    };

    conversations.unshift(newConv);
    setStored(STORAGE_KEYS.CONVERSATIONS, conversations);

    // Seed welcome message
    const config = await this.getTenantConfig();
    const messages = getStored<Record<string, ChatMessage[]>>(STORAGE_KEYS.MESSAGES, INITIAL_MESSAGES);
    messages[newId] = [
      {
        id: `msg-${Date.now()}`,
        conversationId: newId,
        senderType: 'agent',
        isBot: true,
        senderId: 'bot_ai',
        senderName: 'AI 助手',
        content: '我是 AI 助手，这是自动提示。这个问题可能需要人工客服进一步判断，接下来会尝试将此时对话送入人工客服收件箱。只有真人客服在本次对话中回复后，才表示已接手。如需补充，请只提供非敏感信息，勿发送密码、验证码、完整订阅链接或付款资料。',
        actions: [{ label: '人工', action: 'transfer_human' }],
        msgType: 'text',
        isRead: true,
        createdAt: formatCurrentTime(),
      },
    ];
    setStored(STORAGE_KEYS.MESSAGES, messages);

    // Notify WS
    mockWsBus.send('conversation_status', { conversationId: newId, status: 'open' });

    return newConv;
  }

  public static async sendMessage(
    conversationId: string,
    payload: {
      senderType: MessageSenderType;
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
    const messagesMap = getStored<Record<string, ChatMessage[]>>(STORAGE_KEYS.MESSAGES, INITIAL_MESSAGES);
    const convList = getStored<Conversation[]>(STORAGE_KEYS.CONVERSATIONS, INITIAL_CONVERSATIONS);

    const newMsg: ChatMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      conversationId,
      senderType: payload.senderType,
      senderId: payload.senderId,
      senderName: payload.senderName,
      content: payload.content,
      msgType: payload.msgType || 'text',
      fileUrl: payload.fileUrl,
      videoUrl: (payload as any).videoUrl || (payload.msgType === 'video' ? payload.fileUrl : undefined),
      fileName: payload.fileName,
      fileSize: payload.fileSize,
      voiceDuration: payload.voiceDuration,
      isInternalNote: payload.isInternalNote || false,
      isRead: false,
      createdAt: formatCurrentTime(),
    };

    if (!messagesMap[conversationId]) {
      messagesMap[conversationId] = [];
    }
    messagesMap[conversationId].push(newMsg);
    setStored(STORAGE_KEYS.MESSAGES, messagesMap);

    // Update conversation preview and unread count
    const conv = convList.find((c) => c.id === conversationId);
    if (conv) {
      if (!payload.isInternalNote) {
        conv.lastMessage =
          payload.msgType === 'image'
            ? '[图片]'
            : payload.msgType === 'video'
            ? `[视频] ${payload.fileName || '视频消息'}`
            : payload.msgType === 'file'
            ? `[文件] ${payload.fileName}`
            : payload.msgType === 'voice'
            ? `[语音消息 ${payload.voiceDuration || 3}"]`
            : payload.content;
      }
      conv.lastMessageTime = newMsg.createdAt;
      conv.updatedAt = new Date().toLocaleString();

      if (payload.senderType === 'visitor') {
        conv.unreadCountForAgent = (conv.unreadCountForAgent || 0) + 1;
      } else if (payload.senderType === 'agent' && !payload.isInternalNote) {
        conv.unreadCountForVisitor = (conv.unreadCountForVisitor || 0) + 1;
      }
      setStored(STORAGE_KEYS.CONVERSATIONS, convList);
    }

    // Dispatch message event via mock WebSocket bus!
    mockWsBus.send('message', newMsg);

    return newMsg;
  }

  public static async clearConversationMessages(conversationId: string): Promise<void> {
    const messagesMap = getStored<Record<string, ChatMessage[]>>(STORAGE_KEYS.MESSAGES, INITIAL_MESSAGES);
    messagesMap[conversationId] = [];
    setStored(STORAGE_KEYS.MESSAGES, messagesMap);

    // Also reset conversation preview and unread counters
    const convList = getStored<Conversation[]>(STORAGE_KEYS.CONVERSATIONS, INITIAL_CONVERSATIONS);
    const conv = convList.find((c) => c.id === conversationId);
    if (conv) {
      conv.lastMessage = '';
      conv.unreadCountForAgent = 0;
      conv.unreadCountForVisitor = 0;
      setStored(STORAGE_KEYS.CONVERSATIONS, convList);
    }

    // Dispatch conversation_cleared event via WS bus
    mockWsBus.send('conversation_cleared', { conversationId });
  }

  public static async uploadFile(file: File): Promise<{ url: string; name: string; size: string; sizeBytes: number; type: string }> {
    // Generate simulated URL without real backend upload
    const sizeKB = Math.round(file.size / 1024);
    const sizeStr = sizeKB > 1024 ? `${(sizeKB / 1024).toFixed(1)} MB` : `${sizeKB} KB`;
    
    // For images or videos, create a local preview blob URL for rich UI experience
    let previewUrl = '';
    const isVideo = file.type.startsWith('video/') || file.name.match(/\.(mp4|webm|mov|mkv)$/i);
    const isImage = file.type.startsWith('image/') || file.name.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i);

    if (isImage || isVideo) {
      try {
        previewUrl = URL.createObjectURL(file);
      } catch {
        previewUrl = isVideo
          ? 'https://www.w3schools.com/html/mov_bbb.mp4'
          : 'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=600&auto=format&fit=crop&q=80';
      }
    } else {
      previewUrl = `https://mock-storage.local/files/${file.name}`;
    }

    return {
      url: previewUrl,
      name: file.name,
      size: sizeStr,
      sizeBytes: file.size,
      type: isVideo ? 'video' : isImage ? 'image' : 'file',
    };
  }

  public static async submitOfflineMessage(payload: OfflineMessagePayload): Promise<{ success: boolean; message: string }> {
    const list = getStored<OfflineMessagePayload[]>(STORAGE_KEYS.OFFLINE_MSGS, []);
    list.push({ ...payload });
    setStored(STORAGE_KEYS.OFFLINE_MSGS, list);
    return {
      success: true,
      message: '留言提交成功！客服顾问将在上班后第一时间通过邮箱与您取得联系。',
    };
  }

  // --- Agent APIs ---
  public static async login(account: string, pass: string): Promise<JwtTokenPayload> {
    const agents = getStored<AgentUser[]>(STORAGE_KEYS.AGENTS, INITIAL_AGENTS);
    const user = agents.find((a) => a.account.trim().toLowerCase() === account.trim().toLowerCase());

    if (!user) {
      throw new Error('账号不存在，请检查后重新输入（演示密码为 123456）');
    }

    if (!user.enabled) {
      throw new Error('该客服账号已被管理员禁用，请联系管理员启用');
    }

    // Default demo password is "123456" for convenience
    if (pass !== '123456' && pass !== 'password') {
      throw new Error('密码错误，演示密码统一为 123456');
    }

    const payload: JwtTokenPayload = {
      userId: user.userId,
      tenantId: user.tenantId,
      role: user.role,
      nickname: user.nickname,
      account: user.account,
    };

    this.setAuthToken(payload);
    return payload;
  }

  public static async getConversationList(params?: {
    status?: 'open' | 'closed';
    page?: number;
    pageSize?: number;
    keyword?: string;
  }): Promise<{ list: Conversation[]; total: number; unreadTotal: number }> {
    const allConvs = getStored<Conversation[]>(STORAGE_KEYS.CONVERSATIONS, INITIAL_CONVERSATIONS);
    // Ensure all conversations have channels mapped
    let updated = false;
    allConvs.forEach((c) => {
      if (!c.channel) {
        const init = INITIAL_CONVERSATIONS.find((ic) => ic.id === c.id);
        c.channel = init?.channel || 'web';
        c.channelAccount = init?.channelAccount || 'Web 在线挂件';
        updated = true;
      }
    });
    if (updated) {
      setStored(STORAGE_KEYS.CONVERSATIONS, allConvs);
    }
    let filtered = [...allConvs];

    if (params?.status) {
      filtered = filtered.filter((c) => c.status === params.status);
    }

    if (params?.keyword) {
      const kw = params.keyword.toLowerCase();
      filtered = filtered.filter(
        (c) =>
          c.visitorName.toLowerCase().includes(kw) ||
          c.lastMessage.toLowerCase().includes(kw) ||
          c.visitorInfo?.location?.toLowerCase().includes(kw)
      );
    }

    const unreadTotal = allConvs.reduce((acc, c) => acc + (c.unreadCountForAgent || 0), 0);

    return {
      list: filtered,
      total: filtered.length,
      unreadTotal,
    };
  }

  public static async getConversationDetail(id: string): Promise<Conversation> {
    const allConvs = getStored<Conversation[]>(STORAGE_KEYS.CONVERSATIONS, INITIAL_CONVERSATIONS);
    const found = allConvs.find((c) => c.id === id);
    if (!found) {
      throw new Error(`会话 ${id} 不存在`);
    }
    return found;
  }

  public static async getMessages(conversationId: string): Promise<ChatMessage[]> {
    const messagesMap = getStored<Record<string, ChatMessage[]>>(STORAGE_KEYS.MESSAGES, INITIAL_MESSAGES);
    return messagesMap[conversationId] || [];
  }

  public static async markMessagesRead(conversationId: string, readerType: 'visitor' | 'agent'): Promise<void> {
    const messagesMap = getStored<Record<string, ChatMessage[]>>(STORAGE_KEYS.MESSAGES, INITIAL_MESSAGES);
    const convList = getStored<Conversation[]>(STORAGE_KEYS.CONVERSATIONS, INITIAL_CONVERSATIONS);

    const msgs = messagesMap[conversationId];
    if (msgs) {
      msgs.forEach((m) => {
        if (readerType === 'agent' && m.senderType === 'visitor') {
          m.isRead = true;
        } else if (readerType === 'visitor' && m.senderType === 'agent') {
          m.isRead = true;
        }
      });
      setStored(STORAGE_KEYS.MESSAGES, messagesMap);
    }

    const conv = convList.find((c) => c.id === conversationId);
    if (conv) {
      if (readerType === 'agent') {
        conv.unreadCountForAgent = 0;
      } else {
        conv.unreadCountForVisitor = 0;
      }
      setStored(STORAGE_KEYS.CONVERSATIONS, convList);
    }

    mockWsBus.send('read', { conversationId, readerType });
  }

  public static async getAgentList(): Promise<AgentUser[]> {
    return getStored<AgentUser[]>(STORAGE_KEYS.AGENTS, INITIAL_AGENTS);
  }

  public static async transferConversation(conversationId: string, targetAgentId: string): Promise<Conversation> {
    const convList = getStored<Conversation[]>(STORAGE_KEYS.CONVERSATIONS, INITIAL_CONVERSATIONS);
    const agents = getStored<AgentUser[]>(STORAGE_KEYS.AGENTS, INITIAL_AGENTS);

    const conv = convList.find((c) => c.id === conversationId);
    if (!conv) throw new Error('会话不存在');

    const targetAgent = agents.find((a) => a.userId === targetAgentId);
    if (!targetAgent) throw new Error('目标坐席不存在');

    conv.assignedAgentId = targetAgent.userId;
    conv.assignedAgentName = targetAgent.nickname;
    setStored(STORAGE_KEYS.CONVERSATIONS, convList);

    // Send system message
    await this.sendMessage(conversationId, {
      senderType: 'system',
      senderId: 'system',
      senderName: '系统通知',
      content: `会话已成功转接给坐席【${targetAgent.nickname}】`,
    });

    mockWsBus.send('conversation_status', { conversationId, status: conv.status });

    return conv;
  }

  public static async closeConversation(conversationId: string): Promise<Conversation> {
    const convList = getStored<Conversation[]>(STORAGE_KEYS.CONVERSATIONS, INITIAL_CONVERSATIONS);
    const conv = convList.find((c) => c.id === conversationId);
    if (!conv) throw new Error('会话不存在');

    conv.status = 'closed';
    setStored(STORAGE_KEYS.CONVERSATIONS, convList);

    mockWsBus.send('conversation_status', { conversationId, status: 'closed' });

    return conv;
  }

  public static async reopenConversation(conversationId: string): Promise<Conversation> {
    const convList = getStored<Conversation[]>(STORAGE_KEYS.CONVERSATIONS, INITIAL_CONVERSATIONS);
    const conv = convList.find((c) => c.id === conversationId);
    if (!conv) throw new Error('会话不存在');

    conv.status = 'open';
    setStored(STORAGE_KEYS.CONVERSATIONS, convList);

    mockWsBus.send('conversation_status', { conversationId, status: 'open' });
    return conv;
  }

  /** Permanently remove a conversation and all of its messages (mock). */
  public static async deleteConversation(conversationId: string): Promise<void> {
    const convList = getStored<Conversation[]>(STORAGE_KEYS.CONVERSATIONS, INITIAL_CONVERSATIONS);
    const next = convList.filter((c) => c.id !== conversationId);
    if (next.length === convList.length) throw new Error('会话不存在');
    setStored(STORAGE_KEYS.CONVERSATIONS, next);

    const messagesMap = getStored<Record<string, ChatMessage[]>>(STORAGE_KEYS.MESSAGES, INITIAL_MESSAGES);
    delete messagesMap[conversationId];
    setStored(STORAGE_KEYS.MESSAGES, messagesMap);
    mockWsBus.send('conversation_status', { conversationId, status: 'deleted' });
  }

  public static async updateVisitorBasicInfo(
    conversationId: string,
    payload: {
      name?: string;
      phone?: string;
      email?: string;
      notes?: string;
    }
  ): Promise<Conversation> {
    const convList = getStored<Conversation[]>(STORAGE_KEYS.CONVERSATIONS, INITIAL_CONVERSATIONS);
    const conv = convList.find((c) => c.id === conversationId);
    if (!conv) throw new Error('会话不存在');

    if (payload.name !== undefined) {
      conv.visitorName = payload.name;
      if (conv.visitorInfo) {
        conv.visitorInfo.name = payload.name;
      }
    }
    if (conv.visitorInfo) {
      if (payload.phone !== undefined) {
        conv.visitorInfo.phone = payload.phone;
      }
      if (payload.email !== undefined) {
        conv.visitorInfo.email = payload.email;
      }
      if (payload.notes !== undefined) {
        conv.visitorInfo.notes = payload.notes;
      }
    }
    conv.updatedAt = new Date().toLocaleString();
    setStored(STORAGE_KEYS.CONVERSATIONS, convList);

    // Notify other components via WebSocket bus
    mockWsBus.send('conversation_updated', conv);

    return conv;
  }

  public static async updateAgentProfile(payload: {
    nickname?: string;
    status?: 'online' | 'away' | 'offline';
    avatar?: string;
    title?: string;
    bio?: string;
    targetUserId?: string;
  }): Promise<AgentUser> {
    const token = this.getAuthToken();
    if (!token) throw new Error('未登录');

    const agents = getStored<AgentUser[]>(STORAGE_KEYS.AGENTS, INITIAL_AGENTS);
    const targetId = payload.targetUserId || token.userId;
    const current = agents.find((a) => a.userId === targetId);
    if (!current) throw new Error('坐席用户不存在');

    if (payload.nickname !== undefined) {
      current.nickname = payload.nickname;
      if (current.userId === token.userId) token.nickname = payload.nickname;
    }
    if (payload.status !== undefined) {
      current.status = payload.status;
    }
    if (payload.avatar !== undefined) {
      current.avatar = payload.avatar;
      if (current.userId === token.userId) token.avatar = payload.avatar;
    }
    if (payload.title !== undefined) {
      current.title = payload.title;
      if (current.userId === token.userId) token.title = payload.title;
    }
    if (payload.bio !== undefined) {
      current.bio = payload.bio;
      if (current.userId === token.userId) token.bio = payload.bio;
    }

    if (current.userId === token.userId) {
      this.setAuthToken(token);
    }

    setStored(STORAGE_KEYS.AGENTS, agents);
    mockWsBus.send('agent_status', { userId: current.userId, status: current.status });
    mockWsBus.send('agent_updated', current);
    return current;
  }

  // --- Quick Replies ---
  public static async getQuickReplies(): Promise<QuickReplyItem[]> {
    return getStored<QuickReplyItem[]>(STORAGE_KEYS.QUICK_REPLIES, INITIAL_QUICK_REPLIES);
  }

  public static async createQuickReply(item: Omit<QuickReplyItem, 'id' | 'createdAt'>): Promise<QuickReplyItem> {
    const list = getStored<QuickReplyItem[]>(STORAGE_KEYS.QUICK_REPLIES, INITIAL_QUICK_REPLIES);
    const newItem: QuickReplyItem = {
      ...item,
      id: `qr-${Date.now()}`,
      createdAt: new Date().toISOString().split('T')[0],
    };
    list.unshift(newItem);
    setStored(STORAGE_KEYS.QUICK_REPLIES, list);
    return newItem;
  }

  public static async updateQuickReply(id: string, item: Partial<QuickReplyItem>): Promise<QuickReplyItem> {
    const list = getStored<QuickReplyItem[]>(STORAGE_KEYS.QUICK_REPLIES, INITIAL_QUICK_REPLIES);
    const index = list.findIndex((q) => q.id === id);
    if (index === -1) throw new Error('快捷回复不存在');
    list[index] = { ...list[index], ...item };
    setStored(STORAGE_KEYS.QUICK_REPLIES, list);
    return list[index];
  }

  public static async deleteQuickReply(id: string): Promise<void> {
    let list = getStored<QuickReplyItem[]>(STORAGE_KEYS.QUICK_REPLIES, INITIAL_QUICK_REPLIES);
    list = list.filter((q) => q.id !== id);
    setStored(STORAGE_KEYS.QUICK_REPLIES, list);
  }

  // --- Tenant Settings (tenant_admin only) ---
  public static async getTenantSetting(): Promise<TenantConfig> {
    const config = getStored<TenantConfig>(STORAGE_KEYS.TENANT_CONFIG, INITIAL_TENANT_CONFIG);
    if (config.work_start_time === '08:30' || config.work_end_time === '21:00' || config.tenant_name?.includes('光年跃迁')) {
      config.work_start_time = '00:00';
      config.work_end_time = '23:59';
      config.tenant_name = '光年跃迁';
      config.theme_color = '#1972f5';
      setStored(STORAGE_KEYS.TENANT_CONFIG, config);
    }
    if (config.enable_guide_options === undefined) {
      config.enable_guide_options = true;
    }
    if (!config.guide_options || config.guide_options.length === 0) {
      config.guide_options = ['了解产品功能与特性', '获取方案报价与私有化部署', '联系人工客服支持'];
    }
    if (!config.expires_at) {
      config.expires_at = new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString().split('T')[0];
      setStored(STORAGE_KEYS.TENANT_CONFIG, config);
    }
    return config;
  }

  /** mock：修改企业主登录密码（仅校验非空，真实校验走后端） */
  public static async changeTenantPassword(payload: {
    oldPassword: string;
    newPassword: string;
  }): Promise<void> {
    if (!payload.oldPassword || payload.newPassword.length < 6) {
      throw new Error('新密码至少 6 位');
    }
  }

  public static async updateTenantSetting(payload: Partial<TenantConfig>): Promise<TenantConfig> {
    const current = getStored<TenantConfig>(STORAGE_KEYS.TENANT_CONFIG, INITIAL_TENANT_CONFIG);
    const updated = { ...current, ...payload };
    setStored(STORAGE_KEYS.TENANT_CONFIG, updated);
    return updated;
  }

  // --- Tenant Agents (tenant_admin only) ---
  public static async getTenantAgents(): Promise<AgentUser[]> {
    return getStored<AgentUser[]>(STORAGE_KEYS.AGENTS, INITIAL_AGENTS);
  }

  public static async createTenantAgent(payload: {
    account: string;
    nickname: string;
    role: 'agent' | 'tenant_admin';
  }): Promise<AgentUser> {
    const list = getStored<AgentUser[]>(STORAGE_KEYS.AGENTS, INITIAL_AGENTS);
    if (list.some((a) => a.account.toLowerCase() === payload.account.toLowerCase())) {
      throw new Error('该账号邮箱已存在');
    }

    const newAgent: AgentUser = {
      userId: `agent_${Date.now()}`,
      tenantId: 'tenant_001',
      account: payload.account,
      nickname: payload.nickname,
      role: payload.role,
      status: 'offline',
      enabled: true,
      createdAt: new Date().toLocaleString(),
    };

    list.push(newAgent);
    setStored(STORAGE_KEYS.AGENTS, list);
    return newAgent;
  }

  public static async updateTenantAgent(
    userId: string,
    payload: Partial<Pick<AgentUser, 'nickname' | 'role' | 'enabled'>>
  ): Promise<AgentUser> {
    const list = getStored<AgentUser[]>(STORAGE_KEYS.AGENTS, INITIAL_AGENTS);
    const target = list.find((a) => a.userId === userId);
    if (!target) throw new Error('坐席不存在');

    Object.assign(target, payload);
    setStored(STORAGE_KEYS.AGENTS, list);
    return target;
  }

  // --- Platform Super Admin APIs ---
  public static async getPlatformTenants(params?: {
    keyword?: string;
    status?: string;
    plan?: string;
  }): Promise<{ list: TenantItem[]; total: number }> {
    const list = getStored<TenantItem[]>(STORAGE_KEYS.TENANTS, INITIAL_TENANTS);
    let filtered = [...list];

    if (params?.keyword) {
      const kw = params.keyword.toLowerCase();
      filtered = filtered.filter(
        (t) =>
          t.name.toLowerCase().includes(kw) ||
          t.tenantCode.toLowerCase().includes(kw) ||
          t.adminEmail.toLowerCase().includes(kw) ||
          (t.domain && t.domain.toLowerCase().includes(kw))
      );
    }

    if (params?.status && params.status !== 'all') {
      filtered = filtered.filter((t) => t.status === params.status);
    }

    if (params?.plan && params.plan !== 'all') {
      filtered = filtered.filter((t) => t.plan === params.plan);
    }

    return { list: filtered, total: filtered.length };
  }

  public static async createPlatformTenant(payload: {
    name: string;
    adminEmail: string;
    /** 企业主登录账号（对齐后端 admin_username） */
    username: string;
    /** 企业主登录密码（对齐后端 admin_password） */
    password: string;
    maxSeats: number;
    domain?: string;
    /** 公司负责人（选填） */
    ownerName?: string;
    /** 负责人联系方式（选填） */
    ownerContact?: string;
    /** 服务到期日 YYYY-MM-DD（选填 = 不限期，默认一年） */
    expireAt?: string;
    /** 本次开通支付费用（元，选填） */
    paymentAmount?: number;
  }): Promise<TenantItem> {
    const list = getStored<TenantItem[]>(STORAGE_KEYS.TENANTS, INITIAL_TENANTS);
    const code = `tenant_${Date.now().toString(36)}`;
    const newTenant: TenantItem = {
      id: `tenant_${Date.now()}`,
      tenantCode: code,
      name: payload.name,
      domain: payload.domain,
      plan: 'standard',
      status: 'active',
      maxSeats: payload.maxSeats || 5,
      usedSeats: 1,
      activeChatsCount: 0,
      totalMessagesCount: 0,
      adminEmail: payload.adminEmail,
      createdAt: new Date().toISOString().split('T')[0],
      expireAt:
        payload.expireAt ||
        new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString().split('T')[0],
      ownerName: payload.ownerName || '',
      ownerContact: payload.ownerContact || '',
      totalPaid: payload.paymentAmount ?? 0,
      config: {
        tenant_code: code,
        tenant_name: payload.name,
        theme_color: '#1972f5',
        welcome_msg: `您好！欢迎使用 ${payload.name} 在线客服，请问有什么可以帮您？`,
        work_start_time: '09:00',
        work_end_time: '18:00',
        enable_prechat_form: false,
        enable_auto_popup: true,
        auto_popup_delay_sec: 5,
        auto_close_days: 7,
      },
    };

    list.unshift(newTenant);
    setStored(STORAGE_KEYS.TENANTS, list);

    // Also create initial admin agent
    const agents = getStored<AgentUser[]>(STORAGE_KEYS.AGENTS, INITIAL_AGENTS);
    agents.push({
      userId: `agent_${Date.now()}`,
      tenantId: code,
      account: payload.username,
      nickname: `${payload.name} 管理员`,
      role: 'tenant_admin',
      status: 'offline',
      enabled: true,
      createdAt: new Date().toLocaleString(),
    });
    setStored(STORAGE_KEYS.AGENTS, agents);

    return newTenant;
  }

  /** 企业续费：顺延到期日并累加累计支付费用 */
  public static async renewPlatformTenant(
    id: string,
    payload: { expireAt: string; paymentAmount?: number }
  ): Promise<TenantItem> {
    const list = getStored<TenantItem[]>(STORAGE_KEYS.TENANTS, INITIAL_TENANTS);
    const target = list.find((t) => t.id === id);
    if (!target) throw new Error('企业租户不存在');

    target.expireAt = payload.expireAt;
    target.totalPaid = (target.totalPaid || 0) + (payload.paymentAmount || 0);
    setStored(STORAGE_KEYS.TENANTS, list);
    return target;
  }

  public static async updatePlatformTenant(
    id: string,
    payload: Partial<TenantItem>
  ): Promise<TenantItem> {
    const list = getStored<TenantItem[]>(STORAGE_KEYS.TENANTS, INITIAL_TENANTS);
    const index = list.findIndex((t) => t.id === id);
    if (index === -1) throw new Error('企业租户不存在');

    list[index] = { ...list[index], ...payload };
    setStored(STORAGE_KEYS.TENANTS, list);

    // If active tenant is the demo one, sync config
    if (list[index].tenantCode === 'tenant_001' && payload.config) {
      setStored(STORAGE_KEYS.TENANT_CONFIG, list[index].config);
    }

    return list[index];
  }

  public static async getPlatformMetrics(): Promise<{
    totalTenants: number;
    activeTenants: number;
    totalAgents: number;
    onlineAgents: number;
    todayMessages: number;
    activeConversations: number;
  }> {
    const tenants = getStored<TenantItem[]>(STORAGE_KEYS.TENANTS, INITIAL_TENANTS);
    const agents = getStored<AgentUser[]>(STORAGE_KEYS.AGENTS, INITIAL_AGENTS);
    const convs = getStored<Conversation[]>(STORAGE_KEYS.CONVERSATIONS, INITIAL_CONVERSATIONS);

    return {
      totalTenants: tenants.length,
      activeTenants: tenants.filter((t) => t.status === 'active').length,
      totalAgents: agents.filter((a) => a.role !== 'super_admin').length,
      onlineAgents: agents.filter((a) => a.status === 'online' && a.role !== 'super_admin').length,
      todayMessages: 1894,
      activeConversations: convs.filter((c) => c.status === 'open').length,
    };
  }
}
