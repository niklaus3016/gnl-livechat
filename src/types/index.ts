export type Role = 'agent' | 'tenant_admin' | 'super_admin';

export type AgentStatus = 'online' | 'away' | 'offline';

export interface AgentUser {
  userId: string;
  tenantId: string;
  account: string;
  nickname: string;
  role: Role;
  status: AgentStatus;
  avatar?: string;
  title?: string;
  bio?: string;
  enabled: boolean;
  createdAt: string;
}

export interface JwtTokenPayload {
  userId: string;
  tenantId: string;
  role: Role;
  nickname: string;
  account: string;
  avatar?: string;
  title?: string;
  bio?: string;
}

export type ChannelType = 'web' | 'wecom' | 'wechat' | 'feishu' | 'dingtalk';

export interface ProactiveTriggerConfig {
  enabled: boolean;
  delaySeconds: number;
  triggerPages: string; // e.g. '*' or '/pricing' or '/dashboard'
  title: string;        // e.g. '客服小云'
  message: string;      // e.g. '您好！正在查看企业套餐吗？可随时咨询获取首单8折优惠哦~'
  quickOptions: string[]; // e.g. ['咨询套餐优惠', '技术接入指引', '人工客服']
  showAvatar: boolean;
}

export interface ChannelIntegrationConfig {
  wecom: {
    enabled: boolean;
    corpId: string;
    corpSecret: string;
    kfId: string;
    kfName: string;
  };
  wechat: {
    enabled: boolean;
    appId: string;
    appSecret: string;
    token: string;
    accountName: string;
  };
  feishu: {
    enabled: boolean;
    appId: string;
    appSecret: string;
    botName: string;
  };
}

export interface TenantConfig {
  tenant_code: string;
  tenant_name: string;
  theme_color: string;
  welcome_msg: string;
  default_avatar?: string;
  work_start_time: string; // e.g. "09:00"
  work_end_time: string;   // e.g. "18:00"
  enable_prechat_form: boolean;
  enable_auto_popup: boolean;
  auto_popup_delay_sec: number;
  auto_close_days: number;
  enable_guide_options?: boolean;
  guide_options?: string[];
  proactive_trigger?: ProactiveTriggerConfig;
  channels?: ChannelIntegrationConfig;
  /** 服务到期日 YYYY-MM-DD（后端 /admin/tenant/config 下发；空 = 不限期） */
  expires_at?: string;
}

export interface TenantItem {
  id: string;
  tenantCode: string;
  name: string;
  domain?: string;
  plan: 'free' | 'standard' | 'enterprise';
  status: 'active' | 'suspended' | 'trial';
  maxSeats: number;
  usedSeats: number;
  activeChatsCount: number;
  totalMessagesCount: number;
  adminEmail: string;
  createdAt: string;
  expireAt: string;
  /** 公司负责人（选填） */
  ownerName?: string;
  /** 负责人联系方式（选填） */
  ownerContact?: string;
  /** 累计支付费用（元，开通/续费累加） */
  totalPaid?: number;
  config: TenantConfig;
}

export type ConversationStatus = 'open' | 'closed' | 'queued' | 'pre_chat';

export interface VisitorInfo {
  /** 后端 visitor 文档 _id（用于标签等写操作） */
  id?: string;
  token: string;
  name: string;
  phone?: string;
  email?: string;
  notes?: string;
  tags?: string[];
  ip: string;
  location: string;
  referer: string;
  userAgent: string;
  firstVisitAt: string;
}

export interface Conversation {
  id: string;
  tenantId: string;
  channel?: ChannelType; // 'web' | 'wecom' | 'wechat' | 'feishu' | 'dingtalk'
  channelAccount?: string; // e.g. '企业微信客服 (WgetCloud)' 或 '微信服务号'
  visitorToken: string;
  visitorName: string;
  visitorInfo: VisitorInfo;
  assignedAgentId: string | null;
  assignedAgentName: string | null;
  /** Assigned agent's presence at session-init time (seed for the visitor status dot) */
  assignedAgentStatus?: AgentStatus;
  status: ConversationStatus;
  lastMessage: string;
  lastMessageTime: string;
  unreadCountForAgent: number;
  unreadCountForVisitor: number;
  createdAt: string;
  updatedAt: string;
}

export type MessageType = 'text' | 'image' | 'file' | 'voice' | 'video';

export type MessageSenderType = 'visitor' | 'agent' | 'system' | 'bot';

export interface ChatMessageAction {
  label: string;
  action: string;
  payload?: string;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderType: MessageSenderType;
  senderId: string;
  senderName: string;
  content: string;
  msgType: MessageType;
  fileUrl?: string;
  fileName?: string;
  fileSize?: string;
  videoUrl?: string;
  videoDuration?: number;
  videoThumbnail?: string;
  voiceDuration?: number; // 语音消息时长 (秒)
  isInternalNote?: boolean; // 内部备注，仅客服可见
  isBot?: boolean;           // 是否为 AI / 机器人自动回复
  actions?: ChatMessageAction[]; // 快捷交互按钮（如 [人工]）
  isRead: boolean;
  createdAt: string;
}

export interface QuickReplyItem {
  id: string;
  title: string;
  content: string;
  category?: string;
  shortcut?: string;
  createdAt: string;
}

export interface OfflineMessagePayload {
  tenantCode: string;
  visitorToken: string;
  name: string;
  email: string;
  phone?: string;
  content: string;
}

export type WsEventName =
  | 'connect'
  | 'disconnect'
  | 'reconnecting'
  | 'message'
  | 'draft'
  | 'typing'
  | 'read'
  | 'conversation_status'
  | 'conversation_updated'
  | 'conversation_queued'
  | 'conversation_transferred'
  | 'agent_status';

export interface WsDraftPayload {
  conversationId: string;
  senderType: 'visitor' | 'agent';
  draft: string;
}

export interface WsTypingPayload {
  conversationId: string;
  senderType: 'visitor' | 'agent';
  isTyping: boolean;
  /** Visitor draft preview relayed via backend typing_status (cross-browser channel) */
  draft?: string;
}

export interface WsReadPayload {
  conversationId: string;
  readerType: 'visitor' | 'agent';
  lastReadMessageId?: string;
}

export interface WsStatusPayload {
  conversationId: string;
  status: ConversationStatus;
  operatorId?: string;
}
