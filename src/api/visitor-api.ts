import { MockApiService } from '../lib/mock/mock-api';
import { realSocket, mapMessage, mapConversation } from '../lib/real/socket-service';
import { upload as httpUpload, TENANT_KEY, getSharedVisitorToken } from './http';
import { Conversation, ChatMessage, MessageType, OfflineMessagePayload, TenantConfig, AgentStatus } from '../types';
import { IS_MOCK } from './index';

export async function getTenantConfig(tenantCode: string): Promise<TenantConfig> {
  if (IS_MOCK) {
    return MockApiService.getTenantConfig(tenantCode);
  }
  const data = await fetch(`/api/v1/widget/config`, {
    headers: { 'X-Tenant-Key': tenantCode },
  }).then((r) => r.json());
  if (data.code >= 400) throw new Error(data.message || '获取租户配置失败');
  const c = data.data;
  return {
    tenant_code: c.tenant_key || tenantCode,
    tenant_name: c.tenant_name || '在线客服',
    theme_color: c.theme_color || '#1972f5',
    welcome_msg: c.welcome_msg || '',
    default_avatar: c.brand_avatar || undefined,
    work_start_time: c.business_hours?.start_time || '00:00',
    work_end_time: c.business_hours?.end_time || '23:59',
    enable_prechat_form: !!c.enable_prechat_form,
    enable_auto_popup: !!c.enable_auto_popup,
    auto_popup_delay_sec: Number(c.auto_popup_delay_sec) > 0 ? Number(c.auto_popup_delay_sec) : 5,
    auto_close_days: 7,
    enable_guide_options: !!c.enable_guide_options,
    guide_options: c.guide_options || [],
    widget_position: c.widget_position || 'right',
  } as TenantConfig;
}

export async function initConversation(
  visitorToken: string,
  tenantCode: string,
  visitorMeta?: { name?: string; email?: string }
): Promise<Conversation> {
  if (IS_MOCK) {
    return MockApiService.initConversation(visitorToken, tenantCode, visitorMeta);
  }
  const data = await fetch(`/api/v1/widget/session/init`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Tenant-Key': tenantCode,
      'X-Visitor-Token': visitorToken,
    },
    body: JSON.stringify({
      visitor_token: visitorToken,
      source_url: typeof window !== 'undefined' ? window.location.href : '',
      browser: typeof navigator !== 'undefined' ? navigator.userAgent : '',
      name: visitorMeta?.name,
      email: visitorMeta?.email,
    }),
  }).then((r) => r.json());
  if (data.code >= 400) throw new Error(data.message || '初始化会话失败');

  // Backend relays the assigned agent's identity + presence for the initial status dot
  const aa = data.data.assigned_agent || null;
  const rawStatus = aa?.online_status;
  const agentStatus: AgentStatus | undefined =
    rawStatus === 'busy'
      ? 'away'
      : rawStatus === 'online' || rawStatus === 'offline'
        ? rawStatus
        : undefined;

  const convStatus = data.data.conversation.status;

  const conv: Conversation = {
    id: data.data.conversation._id,
    tenantId: '',
    channel: 'web',
    visitorToken,
    visitorName: data.data.visitor?.name || visitorMeta?.name || '匿名访客',
    visitorInfo: {
      token: visitorToken,
      name: data.data.visitor?.name || visitorMeta?.name || '匿名访客',
      email: visitorMeta?.email || '',
      ip: '',
      location: '',
      referer: '',
      userAgent: '',
      firstVisitAt: new Date().toISOString(),
    },
    assignedAgentId: aa?._id || data.data.conversation.assigned_agent_id || null,
    assignedAgentName: aa?.display_name || null,
    assignedAgentStatus: agentStatus,
    status: convStatus === 'pre_chat' ? 'pre_chat' : convStatus === 'queued' ? 'queued' : 'open',
    lastMessage: '',
    lastMessageTime: new Date().toISOString(),
    unreadCountForAgent: 0,
    unreadCountForVisitor: data.data.conversation.unread_count_visitor ?? 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // Establish the real-time channel for this visitor session
  realSocket.connectVisitor(visitorToken, conv.id);
  return conv;
}

export async function sendVisitorMessage(
  conversationId: string,
  payload: {
    senderId: string;
    senderName: string;
    content: string;
    msgType?: MessageType;
    fileUrl?: string;
    fileName?: string;
    fileSize?: string;
    fileSizeBytes?: number;
    voiceDuration?: number;
  }
): Promise<ChatMessage> {
  if (IS_MOCK) {
    return MockApiService.sendMessage(conversationId, {
      ...payload,
      senderType: 'visitor',
    });
  }
  const typeMap: Record<MessageType, string> = {
    text: 'text',
    image: 'image',
    file: 'file',
    voice: 'audio',
    video: 'video',
  };
  const type = typeMap[payload.msgType || 'text'];
  const richPayload: Record<string, any> = {};
  if (payload.fileUrl) richPayload.file_url = payload.fileUrl;
  if (payload.fileName) richPayload.file_name = payload.fileName;
  if (payload.fileSizeBytes !== undefined) richPayload.file_size = payload.fileSizeBytes;
  if (payload.voiceDuration !== undefined) richPayload.audio_duration = payload.voiceDuration;

  const ack = await realSocket.visitorSendMessage(conversationId, {
    type,
    content: payload.content,
    payload: Object.keys(richPayload).length ? richPayload : undefined,
  });

  // ack only carries {_id, created_at} → build the optimistic message locally
  return {
    id: ack._id || ack.id,
    conversationId,
    senderType: 'visitor',
    senderId: payload.senderId,
    senderName: payload.senderName,
    content: payload.content,
    msgType: payload.msgType || 'text',
    fileUrl: payload.fileUrl,
    fileName: payload.fileName,
    fileSize: payload.fileSize,
    voiceDuration: payload.voiceDuration,
    isRead: false,
    createdAt: ack.created_at || ack.createdAt || new Date().toISOString(),
  };
}

export async function uploadFile(
  file: File,
  opts?: { type?: 'text' | 'image' | 'file' | 'audio'; durationSeconds?: number }
): Promise<{ url: string; name: string; size: string; sizeBytes: number; type: string }> {
  if (IS_MOCK) {
    return MockApiService.uploadFile(file);
  }
  const isImage = file.type.startsWith('image/');
  const isAudio = file.type.startsWith('audio/') || file.type === 'audio/webm' || opts?.type === 'audio';
  const type = opts?.type || (isImage ? 'image' : isAudio ? 'audio' : 'file');
  const data = await httpUpload(file, type, opts?.durationSeconds);
  const size = data.file_size;
  const sizeNum = typeof size === 'number' ? size : parseInt(String(size), 10) || 0;
  const sizeStr =
    sizeNum > 1024 * 1024
      ? `${(sizeNum / 1024 / 1024).toFixed(1)} MB`
      : `${Math.max(1, Math.round(sizeNum / 1024))} KB`;
  return {
    url: data.file_url,
    name: file.name,
    size: sizeStr,
    sizeBytes: sizeNum,
    type: data.type,
  };
}

export async function submitOfflineMessage(payload: OfflineMessagePayload): Promise<{ success: boolean; message: string }> {
  if (IS_MOCK) {
    return MockApiService.submitOfflineMessage(payload);
  }
  const data = await fetch(`/api/v1/widget/lead/offline`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Tenant-Key': payload.tenantCode,
      'X-Visitor-Token': payload.visitorToken,
    },
    body: JSON.stringify({
      name: payload.name,
      contact: payload.phone || payload.email,
      message: payload.content,
    }),
  }).then((r) => r.json());
  if (data.code >= 400) throw new Error(data.message || '提交留言失败');
  return { success: true, message: '留言已提交' };
}

export async function getVisitorMessages(conversationId: string): Promise<ChatMessage[]> {
  if (IS_MOCK) {
    return MockApiService.getMessages(conversationId);
  }
  const data = await fetch(
    `/api/v1/widget/messages?conversation_id=${encodeURIComponent(conversationId)}&page=1&limit=50`,
    {
      headers: {
        'X-Tenant-Key': TENANT_KEY,
        'X-Visitor-Token': getSharedVisitorToken(),
      },
    }
  ).then((r) => r.json());
  if (data.code >= 400) throw new Error(data.message || '获取历史消息失败');
  // Backend returns newest-first → reverse for chronological rendering
  const list: ChatMessage[] = (data.data?.list || []).map(mapMessage);
  return list.reverse();
}

export async function markVisitorMessagesRead(conversationId: string): Promise<void> {
  if (IS_MOCK) {
    return MockApiService.markMessagesRead(conversationId, 'visitor');
  }
  await realSocket.visitorRead(conversationId).catch(() => undefined);
}

export async function clearConversationMessages(conversationId: string): Promise<void> {
  if (IS_MOCK) {
    return MockApiService.clearConversationMessages(conversationId);
  }
  // No backend equivalent; local-only reset (client keeps its own transcript)
  return;
}

export async function submitPrechatForm(payload: {
  visitorToken: string;
  tenantCode: string;
  name: string;
  email?: string;
  phone?: string;
  note?: string;
}): Promise<void> {
  if (IS_MOCK) {
    return;
  }
  const data = await fetch(`/api/v1/widget/prechat/submit`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Tenant-Key': payload.tenantCode,
      'X-Visitor-Token': payload.visitorToken,
    },
    body: JSON.stringify({
      name: payload.name,
      email: payload.email,
      phone: payload.phone,
      note: payload.note,
    }),
  }).then((r) => r.json());
  if (data.code >= 400) throw new Error(data.message || '提交留资失败');
}

export async function rateConversation(payload: {
  visitorToken: string;
  tenantCode: string;
  conversationId: string;
  score: number;
  feedback?: string;
}): Promise<void> {
  if (IS_MOCK) {
    return;
  }
  const data = await fetch(`/api/v1/widget/session/rate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Tenant-Key': payload.tenantCode,
      'X-Visitor-Token': payload.visitorToken,
    },
    body: JSON.stringify({
      conversation_id: payload.conversationId,
      score: payload.score,
      feedback: payload.feedback,
    }),
  }).then((r) => r.json());
  if (data.code >= 400) throw new Error(data.message || '提交评价失败');
}

export { mapConversation };
