/**
 * Real Socket.IO service (namespace /ws) bridged onto the legacy mockWsBus
 * so pages keep listening to the same event names.
 *
 * Backend contract:
 * - Agent:  io(base + '/ws', { auth: { token: JWT } })          → auto joins tenant room
 *           must emit('join_conversation', { conversation_id }, ack) per conversation
 * - Visitor: io(base + '/ws', { query: { token, conversation_id } }) → auto joins conv room
 * - Events: send_message (ack {code,data:{_id,created_at}}), new_message {message},
 *           typing_status {conversation_id, is_typing} (sender not echoed),
 *           message_read (ack {data:{updated}}) → peer gets {conversation_id, reader_role, updated},
 *           conversation_updated {conversation}, conversation_queued, conversation_transferred
 * - Reconnect: rooms are lost → re-join all conversations.
 */
import { io, Socket } from 'socket.io-client';
import { mockWsBus } from '../mock/mock-ws-bus';
import { ChatMessage, Conversation } from '../../types';
import { getJwt } from '../../api/http';

const SOCKET_BASE = `${window.location.protocol}//${window.location.host}`;

export type AgentRole = 'visitor' | 'agent';

// ---------- field mappers (backend snake_case → frontend camelCase) ----------

export function normalizeStatus(s: string): 'open' | 'closed' | 'queued' | 'pre_chat' {
  if (s === 'resolved') return 'closed';
  if (s === 'queued') return 'queued';
  if (s === 'pre_chat') return 'pre_chat';
  return 'open'; // active → open
}

/** Format raw byte count into human-readable size; non-numeric strings pass through unchanged. */
function formatDisplaySize(v: any): string | undefined {
  if (v === undefined || v === null) return undefined;
  if (typeof v === 'number' || /^\d+$/.test(String(v))) {
    const n = Number(v);
    if (n >= 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
    if (n >= 1024) return `${Math.max(1, Math.round(n / 1024))} KB`;
    return `${n} B`;
  }
  return String(v);
}

export function mapMessage(m: any): ChatMessage {
  const payload = m?.payload || {};
  const type = (m?.type === 'audio' ? 'voice' : m?.type) || 'text';
  return {
    id: m?._id || m?.id || '',
    conversationId: m?.conversation_id || '',
    senderType: m?.sender_type || 'system',
    senderId: m?.sender_id || '',
    senderName: m?.sender_name || (m?.sender_type === 'visitor' ? '访客' : '客服'),
    content: m?.content || '',
    msgType: type,
    fileUrl: payload.file_url || m?.file_url,
    fileName: payload.file_name || m?.file_name,
    fileSize: formatDisplaySize(payload.file_size ?? m?.file_size),
    voiceDuration: payload.audio_duration ?? m?.audio_duration,
    isInternalNote: m?.is_internal || false,
    isBot: m?.sender_type === 'bot' || m?.is_bot === true,
    isRead: !!m?.is_read,
    createdAt: m?.created_at || new Date().toISOString(),
  };
}

export function mapConversation(c: any): Conversation {
  const visitor = c?.visitor_id && typeof c.visitor_id === 'object' ? c.visitor_id : null;
  const agent = c?.assigned_agent_id && typeof c.assigned_agent_id === 'object' ? c.assigned_agent_id : null;
  return {
    id: c?._id || '',
    tenantId: c?.tenant_id || '',
    channel: 'web',
    visitorToken: '',
    visitorName: visitor?.name || '匿名访客',
    visitorInfo: {
      id: visitor?._id || (typeof c?.visitor_id === 'string' ? c.visitor_id : ''),
      token: '',
      name: visitor?.name || '匿名访客',
      phone: visitor?.phone || '',
      email: visitor?.email || '',
      notes: visitor?.notes || '',
      tags: visitor?.tags || [],
      ip: visitor?.ip || '',
      location: visitor?.location || '',
      referer: visitor?.source_url || '',
      userAgent: visitor?.browser || '',
      firstVisitAt: c?.created_at || '',
    },
    assignedAgentId: agent?._id || (typeof c?.assigned_agent_id === 'string' ? c.assigned_agent_id : null),
    assignedAgentName: agent?.display_name || null,
    assignedAgentStatus:
      agent?.online_status === 'busy'
        ? 'away'
        : agent?.online_status === 'online' || agent?.online_status === 'offline'
          ? agent.online_status
          : undefined,
    status: normalizeStatus(c?.status),
    lastMessage: c?.last_message?.content || '',
    lastMessageTime: c?.last_message?.created_at || c?.updated_at || '',
    unreadCountForAgent: c?.unread_count_agent ?? 0,
    unreadCountForVisitor: c?.unread_count_visitor ?? 0,
    createdAt: c?.created_at || '',
    updatedAt: c?.updated_at || '',
  };
}

// ---------- service ----------

class RealSocketService {
  private visitorSock: Socket | null = null;
  private agentSock: Socket | null = null;

  private visitorConversationId = '';
  private agentJoinedRooms = new Set<string>();
  private agentRoomRestore = new Set<string>();

  constructor() {
    // Route legacy bus.send() events into the real socket when applicable.
    // 'draft' has no backend equivalent → falls through to local BroadcastChannel.
    mockWsBus.setSendRouter((eventName: string, payload: any) => {
      if (eventName === 'typing') {
        const isTyping = !!payload?.isTyping;
        const convId: string = payload?.conversationId || '';
        if (payload?.senderType === 'visitor' && this.visitorSock) {
          this.visitorTyping(convId, isTyping, typeof payload?.draft === 'string' ? payload.draft : undefined);
          return true;
        }
        if (payload?.senderType === 'agent' && this.agentSock) {
          this.agentTyping(convId, isTyping, typeof payload?.draft === 'string' ? payload.draft : undefined);
          return true;
        }
      }
      return false;
    });
  }

  // ===== Visitor =====

  connectVisitor(visitorToken: string, conversationId: string): void {
    // Idempotent: same conversation already connected → nothing to do.
    if (
      this.visitorSock &&
      this.visitorConversationId === conversationId &&
      this.visitorSock.connected
    ) {
      return;
    }
    // Tear down previous socket completely (removeAllListeners so no stale
    // callbacks fire on the lingering socket before it's fully closed).
    if (this.visitorSock) {
      this.visitorSock.removeAllListeners();
      this.visitorSock.disconnect();
      this.visitorSock = null;
    }
    this.visitorConversationId = conversationId;
    const sock = io(`${SOCKET_BASE}/ws`, {
      query: { token: visitorToken, conversation_id: conversationId },
      transports: ['websocket', 'polling'],
      reconnection: true,
    });
    this.visitorSock = sock;

    sock.on('new_message', (p: any) => {
      if (p?.message) {
        mockWsBus.dispatch('message', mapMessage(p.message));
      }
    });
    sock.on('typing_status', (p: any) => {
      // peer is the agent (server never echoes sender)
      mockWsBus.dispatch('typing', {
        conversationId: p?.conversation_id,
        senderType: 'agent',
        isTyping: !!p?.is_typing,
        // Agent draft rides along — used ONLY for indicator timing, never rendered
        ...(typeof p?.draft === 'string' && { draft: p.draft }),
      });
    });
    // Agent presence change relayed by the backend (user_id + status)
    sock.on('agent_status', (p: any) => {
      console.log('[ws] visitor <- agent_status relayed', p);
      // Only trust a concrete status from the relay; if the backend omits it
      // (or sends garbage), fall through to the widget/agents polled value
      // instead of clobbering presence with 'offline'.
      const raw = p?.status;
      const mapped =
        raw === 'online' ? 'online'
        : raw === 'busy' || raw === 'away' ? 'away'
        : raw === 'offline' ? 'offline'
        : undefined;
      mockWsBus.dispatch('agent_updated', {
        userId: p?.user_id,
        nickname: p?.display_name,
        ...(mapped && { status: mapped }),
      });
    });
    sock.on('message_read', (p: any) => {
      mockWsBus.dispatch('read', {
        conversationId: p?.conversation_id,
        readerType: p?.reader_role === 'agent' ? 'agent' : 'visitor',
        updated: p?.updated,
      });
    });
    sock.on('conversation_updated', (p: any) => {
      this.dispatchConversationEvents(p?.conversation);
    });
    sock.on('connect', () => {
      mockWsBus.dispatch('connect', { connected: true });
    });
    sock.on('disconnect', () => {
      mockWsBus.dispatch('disconnect', {});
    });
    sock.on('connect_error', (err: Error) => {
      console.warn('[WS] visitor connect_error:', err.message);
    });
  }

  disconnectVisitor(): void {
    this.visitorSock?.disconnect();
    this.visitorSock = null;
    this.visitorConversationId = '';
  }

  /** Visitor sends a message; resolves with minimal ack data ({_id, created_at}). */
  visitorSendMessage(
    conversationId: string,
    body: { type: string; content: string; payload?: Record<string, any> }
  ): Promise<{ _id?: string; id?: string; created_at?: string; createdAt?: string }> {
    return this.emitAck(this.visitorSock, 'send_message', {
      conversation_id: conversationId,
      ...body,
    });
  }

  visitorTyping(conversationId: string, isTyping: boolean, draft?: string): void {
    this.visitorSock?.emit('typing_status', {
      conversation_id: conversationId,
      is_typing: isTyping,
      // Backend relays draft to the agent room only when the field is present ('' clears the bubble)
      ...(draft !== undefined && { draft }),
    });
  }

  visitorRead(conversationId: string): Promise<{ updated: number }> {
    return this.emitAck(this.visitorSock, 'message_read', { conversation_id: conversationId });
  }

  // ===== Agent =====

  connectAgent(): Promise<void> {
    if (this.agentSock && this.agentSock.connected) return Promise.resolve();
    if (this.agentSock) {
      this.agentSock.removeAllListeners();
      this.agentSock.disconnect();
      this.agentSock = null;
    }
    return new Promise((resolve, reject) => {
      const jwt = getJwt();
      if (!jwt) {
        reject(new Error('未登录，缺少 JWT'));
        return;
      }
      const sock = io(`${SOCKET_BASE}/ws`, {
        auth: { token: jwt },
        transports: ['websocket', 'polling'],
        reconnection: true,
      });
      this.agentSock = sock;

      sock.on('new_message', (p: any) => {
        if (p?.message) {
          mockWsBus.dispatch('message', mapMessage(p.message));
        }
      });
      sock.on('typing_status', (p: any) => {
        mockWsBus.dispatch('typing', {
          conversationId: p?.conversation_id,
          senderType: 'visitor',
          isTyping: !!p?.is_typing,
          // Backend relays the visitor draft preview ('' means clear)
          ...(typeof p?.draft === 'string' && { draft: p.draft }),
        });
      });
      sock.on('message_read', (p: any) => {
        mockWsBus.dispatch('read', {
          conversationId: p?.conversation_id,
          readerType: p?.reader_role === 'visitor' ? 'visitor' : 'agent',
          updated: p?.updated,
        });
      });
      sock.on('conversation_updated', (p: any) => {
        this.dispatchConversationEvents(p?.conversation);
      });
      sock.on('conversation_queued', (p: any) => {
        mockWsBus.dispatch('conversation_queued', {
          conversationId: p?.conversation_id,
          visitorName: p?.visitor_name,
          sourceUrl: p?.source_url,
        });
        // queue changes the list too
        mockWsBus.dispatch('conversation_updated', null);
      });
      sock.on('conversation_transferred', (p: any) => {
        mockWsBus.dispatch('conversation_transferred', p);
        mockWsBus.dispatch('conversation_updated', null);
      });
      sock.on('visitor_presence', (p: any) => {
        mockWsBus.dispatch('visitor_presence', {
          conversationId: p?.conversation_id,
          online: !!p?.online,
        });
      });
      sock.on('connect', () => {
        // Rooms are session-bound: re-join everything on (re)connect
        this.agentJoinedRooms.clear();
        for (const convId of Array.from(this.agentRoomRestore)) {
          this.joinConversation(convId);
        }
        mockWsBus.dispatch('connect', { connected: true, reconnected: true });
        resolve();
      });
      sock.on('disconnect', () => {
        mockWsBus.dispatch('disconnect', {});
      });
      sock.on('connect_error', (err: Error) => {
        console.warn('[WS] agent connect_error:', err.message);
        reject(err);
      });
    });
  }

  disconnectAgent(): void {
    this.agentSock?.disconnect();
    this.agentSock = null;
    this.agentJoinedRooms.clear();
    this.agentRoomRestore.clear();
  }

  isAgentConnected(): boolean {
    return !!this.agentSock?.connected;
  }

  joinConversation(conversationId: string): void {
    if (!conversationId) return;
    this.agentRoomRestore.add(conversationId);
    if (this.agentJoinedRooms.has(conversationId)) return;
    if (!this.agentSock?.connected) return; // will re-join on connect
    this.agentSock.emit('join_conversation', { conversation_id: conversationId }, (res: any) => {
      if (res?.code === 200) {
        this.agentJoinedRooms.add(conversationId);
        // Backend ack carries the current visitor presence — dispatch it as the
        // initial state so a freshly opened/refreshed panel shows the truth
        // without waiting for the next connect/disconnect broadcast.
        if (typeof res.visitor_online === 'boolean') {
          mockWsBus.dispatch('visitor_presence', {
            conversationId,
            online: res.visitor_online,
            initial: true,
          });
        }
      } else {
        console.warn('[WS] join_conversation failed:', res?.message);
      }
    });
  }

  /** Agent sends a message; resolves with minimal ack data ({_id, created_at}). */
  agentSendMessage(
    conversationId: string,
    body: { type: string; content: string; payload?: Record<string, any>; is_internal?: boolean }
  ): Promise<{ _id?: string; id?: string; created_at?: string; createdAt?: string }> {
    return this.emitAck(this.agentSock, 'send_message', {
      conversation_id: conversationId,
      ...body,
    });
  }

  agentTyping(conversationId: string, isTyping: boolean, draft?: string): void {
    this.agentSock?.emit('typing_status', {
      conversation_id: conversationId,
      is_typing: isTyping,
      // Backend relays draft to the visitor room; '' clears the visitor's indicator
      ...(draft !== undefined && { draft }),
    });
  }

  /** Agent presence change — backend should relay { user_id, display_name, status } to visitor rooms */
  agentStatus(status: 'online' | 'away' | 'offline'): void {
    console.log('[ws] agent -> emit agent_status', { status });
    this.agentSock?.emit('agent_status', { status });
  }

  agentRead(conversationId: string): Promise<{ updated: number }> {
    return this.emitAck(this.agentSock, 'message_read', { conversation_id: conversationId });
  }

  // ===== helpers =====

  private emitAck<T = any>(sock: Socket | null, event: string, payload: any): Promise<T> {
    return new Promise((resolve, reject) => {
      if (!sock?.connected) {
        reject(new Error('实时通道未连接'));
        return;
      }
      sock.timeout(10000).emit(event, payload, (err: Error | null, res: any) => {
        if (err) {
          reject(new Error('消息发送超时'));
          return;
        }
        if (res && typeof res.code === 'number' && res.code >= 400) {
          reject(new Error(res.message || `发送失败 (${res.code})`));
          return;
        }
        resolve(res?.data ?? res);
      });
    });
  }

  /** Fan out backend conversation payload into legacy bus events. */
  private dispatchConversationEvents(rawConv: any): void {
    if (!rawConv) {
      // conversation 为空 = 该会话已被删除（后端 DELETE 广播约定）→ 通知所有列表监听者重拉
      mockWsBus.dispatch('conversation_updated', null);
      return;
    }
    const conv = mapConversation(rawConv);
    mockWsBus.dispatch('conversation_status', {
      conversationId: conv.id,
      status: conv.status,
    });
    mockWsBus.dispatch('conversation_updated', conv);
  }
}

export const realSocket = new RealSocketService();
