import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  getConversationDetail,
  getAgentMessages,
  sendAgentMessage,
  markAgentMessagesRead,
  closeConversation,
  reopenConversation,
  agentUploadFile,
  getCurrentAgentToken,
  joinConversationRoom,
} from '../../api';
import { mockWsBus } from '../../lib/mock/mock-ws-bus';
import { formatConversationTime } from '../../utils/format';
import { ChatMessage, Conversation, AgentUser } from '../../types';
import { ConversationSidebar } from '../../components/agent/ConversationSidebar';
import { VisitorInfoPanel } from '../../components/agent/VisitorInfoPanel';
import { TransferModal } from '../../components/agent/TransferModal';
import { QuickReplySelect } from '../../components/agent/QuickReplySelect';
import { MessageBubble } from '../../components/chat/MessageBubble';
import { playNotificationSound } from '../../utils/audio';
import {
  Send,
  Image as ImageIcon,
  Paperclip,
  Mic,
  Zap,
  UserCheck,
  CheckCircle,
  RotateCcw,
  PanelRightClose,
  PanelRightOpen,
  Info,
  Clock,
  Volume2,
  VolumeX,
  UploadCloud,
  Film,
  Globe,
} from 'lucide-react';

export const ConversationDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const currentUser = getCurrentAgentToken();

  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [visitorDraft, setVisitorDraft] = useState('');
  const [isVisitorTyping, setIsVisitorTyping] = useState(false);
  const [showVisitorPanel, setShowVisitorPanel] = useState(true);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showQuickReply, setShowQuickReply] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  // Visitor real presence (null = unknown — join ack / broadcast hasn't arrived yet)
  const [visitorOnline, setVisitorOnline] = useState<boolean | null>(null);
  const visitorOfflineTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Voice recording state (WeChat-style push-to-talk)
  const [isVoiceMode, setIsVoiceMode] = useState(false);
  const [isVoiceRecording, setIsVoiceRecording] = useState(false);
  const [voiceDuration, setVoiceDuration] = useState(0);
  const [isVoiceCancelWarning, setIsVoiceCancelWarning] = useState(false);
  const [voiceToast, setVoiceToast] = useState<string | null>(null);

  const voiceRecordingTimerRef = useRef<number | null>(null);
  const voiceStartTimeRef = useRef<number>(0);
  const isVoiceCancelWarningRef = useRef(false);
  const voiceToastTimerRef = useRef<number | null>(null);
  const voiceTouchStartYRef = useRef<number>(0);

  // Global dragover & drop prevention so browser never navigates or opens dropped files directly
  useEffect(() => {
    const preventBrowserFileOpen = (e: DragEvent) => {
      e.preventDefault();
    };
    window.addEventListener('dragover', preventBrowserFileOpen);
    window.addEventListener('drop', preventBrowserFileOpen);
    return () => {
      window.removeEventListener('dragover', preventBrowserFileOpen);
      window.removeEventListener('drop', preventBrowserFileOpen);
      if (voiceRecordingTimerRef.current) clearInterval(voiceRecordingTimerRef.current);
      if (voiceToastTimerRef.current) clearTimeout(voiceToastTimerRef.current);
    };
  }, []);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const agentTypingTimeoutRef = useRef<number | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const agentDraftRef = useRef('');
  // Per-conversation composer drafts (survive switching between conversations)
  const draftsByConvRef = useRef<Record<string, string>>({});
  const prevConvIdRef = useRef<string | undefined>(undefined);

  const scrollToBottom = (smooth = true) => {
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
  };

  // Unmount / conversation-switch safety: stop the heartbeat and tell the previous
  // conversation's visitor to clear the indicator (no blur event fires when the
  // focused element unmounts or the route changes programmatically).
  useEffect(() => {
    return () => {
      if (agentTypingTimeoutRef.current) {
        clearTimeout(agentTypingTimeoutRef.current);
        agentTypingTimeoutRef.current = null;
      }
      if (id) {
        mockWsBus.send('typing', {
          conversationId: id,
          senderType: 'agent',
          isTyping: false,
          draft: '',
        });
      }
    };
  }, [id]);

  // 1. Fetch conversation details & messages on ID change
  useEffect(() => {
    if (!id) return;

    // Per-conversation draft memory: stash the composer text of the conversation
    // we're leaving, then restore the draft of the one we're entering. A restored
    // draft does NOT emit typing by itself — that happens on input focus (plan 3).
    const prevId = prevConvIdRef.current;
    if (prevId && prevId !== id) {
      draftsByConvRef.current[prevId] = agentDraftRef.current;
    }
    const restoredDraft = draftsByConvRef.current[id] || '';
    setInputText(restoredDraft);
    agentDraftRef.current = restoredDraft;
    prevConvIdRef.current = id;

    const loadData = async () => {
      try {
        const conv = await getConversationDetail(id);
        setConversation(conv);

        const msgs = await getAgentMessages(id);
        setMessages(msgs);

        await markAgentMessagesRead(id);
        setVisitorDraft('');
        setIsVisitorTyping(false);
      } catch (err) {
        console.error('Failed to load conversation details:', err);
      }
    };

    loadData();
  }, [id]);

  useEffect(() => {
    scrollToBottom(false);
  }, [messages, visitorDraft, isVisitorTyping]);

  // 2. WebSocket Bus Event Listeners for Agent Workbench
  useEffect(() => {
    if (!id) return;

    // Join the conversation socket room — typing_status (draft preview) is room-scoped
    joinConversationRoom(id);

    // Incoming messages
    const unbindMessage = mockWsBus.on('message', (msg: ChatMessage) => {
      if (msg.conversationId === id) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === msg.id)) return prev;
          return [...prev, msg];
        });

        if (msg.senderType === 'visitor') {
          if (soundEnabled) playNotificationSound('message');
          // Clear visitor draft upon actual message received
          setVisitorDraft('');
          setIsVisitorTyping(false);
          markAgentMessagesRead(id);
        }
      }
    });

    // Visitor Draft Notification (Core Feature) - Always stays visible until sent or deleted
    const unbindDraft = mockWsBus.on('draft', (payload) => {
      if (payload.conversationId === id && payload.senderType === 'visitor') {
        setVisitorDraft(payload.draft || '');
      }
    });

    // Visitor Typing Notification + Draft preview relayed via backend (cross-browser channel)
    const unbindTyping = mockWsBus.on('typing', (payload) => {
      if (payload.conversationId === id && payload.senderType === 'visitor') {
        setIsVisitorTyping(payload.isTyping);
        if (typeof payload.draft === 'string') setVisitorDraft(payload.draft);
      }
    });

    // Conversation Status Update (close / reopen / transfer)
    const unbindStatus = mockWsBus.on('conversation_status', (payload) => {
      if (payload.conversationId === id) {
        setConversation((prev) => (prev ? { ...prev, status: payload.status } : prev));
      }
    });

    // Read receipts
    const unbindRead = mockWsBus.on('read', (payload) => {
      if (payload.conversationId === id && payload.readerType === 'visitor') {
        setMessages((prev) =>
          prev.map((m) => (m.senderType === 'agent' ? { ...m, isRead: true } : m))
        );
      }
    });

    // Conversation cleared
    const unbindClear = mockWsBus.on('conversation_cleared', (payload) => {
      if (payload.conversationId === id) {
        setMessages([]);
      }
    });

    // Conversation metadata updated (assignment, visitor rename, status…):
    // refetch the detail instead of trusting the broadcast payload, which may
    // carry unpopulated references (e.g. assigned agent) or be null on delete.
    const unbindUpdate = mockWsBus.on('conversation_updated', (payload) => {
      if (payload === null) return;
      if (payload.id === id) {
        getConversationDetail(id)
          .then(setConversation)
          .catch(() => undefined);
      }
    });

    // Visitor presence: initial state arrives via join_conversation ack, live
    // changes via backend broadcast. Online flips immediately; offline is
    // debounced 5s so brief reconnects don't flash the badge.
    const unbindPresence = mockWsBus.on(
      'visitor_presence',
      (p: { conversationId?: string; online?: boolean }) => {
        if (p?.conversationId !== id) return;
        if (visitorOfflineTimerRef.current) {
          clearTimeout(visitorOfflineTimerRef.current);
          visitorOfflineTimerRef.current = null;
        }
        if (p.online) {
          setVisitorOnline(true);
        } else {
          visitorOfflineTimerRef.current = setTimeout(() => {
            visitorOfflineTimerRef.current = null;
            setVisitorOnline(false);
          }, 5000);
        }
      },
    );

    return () => {
      unbindMessage();
      unbindDraft();
      unbindTyping();
      unbindStatus();
      unbindRead();
      unbindClear();
      unbindUpdate();
      unbindPresence();
      // Conversation switch: drop pending offline timer and unknown-state
      if (visitorOfflineTimerRef.current) {
        clearTimeout(visitorOfflineTimerRef.current);
        visitorOfflineTimerRef.current = null;
      }
      setVisitorOnline(null);
    };
  }, [id, soundEnabled]);

  // 3. Handle Agent Input Typing Dispatch (draft-driven, plan: blur/focus clears state)
  const emitAgentTyping = (convId: string, val: string) => {
    mockWsBus.send('typing', {
      conversationId: convId,
      senderType: 'agent',
      isTyping: val.trim().length > 0,
      // Backend relays draft to the visitor room; visitor uses it only for indicator timing
      draft: val,
    });
    // Heartbeat: keep re-asserting the non-empty draft every 2s so the visitor's
    // "agent is typing" indicator persists while the agent pauses mid-thought.
    if (agentTypingTimeoutRef.current) clearTimeout(agentTypingTimeoutRef.current);
    if (val.trim()) {
      agentTypingTimeoutRef.current = window.setTimeout(() => {
        emitAgentTyping(convId, agentDraftRef.current);
      }, 2000);
    }
  };

  const clearAgentTyping = () => {
    if (agentTypingTimeoutRef.current) {
      clearTimeout(agentTypingTimeoutRef.current);
      agentTypingTimeoutRef.current = null;
    }
    if (id) {
      mockWsBus.send('typing', {
        conversationId: id,
        senderType: 'agent',
        isTyping: false,
        draft: '',
      });
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setInputText(val);
    agentDraftRef.current = val;
    if (!id) return;
    // Live draft map — the sidebar list renders previews + "草稿" badges from it
    draftsByConvRef.current[id] = val;
    emitAgentTyping(id, val);
  };

  const handleInputBlur = () => {
    // Losing focus (switching conversation, alt-tab, clicking elsewhere) hides
    // the visitor's indicator without discarding the local draft text.
    clearAgentTyping();
  };

  const handleInputFocus = () => {
    // Re-engage: if a draft is still present, restore the visitor's indicator.
    if (id && agentDraftRef.current.trim()) {
      emitAgentTyping(id, agentDraftRef.current);
    }
  };

  // 4. Send Agent Message (Regular or Internal Note)
  const handleSendMessage = async (isNote = false) => {
    if (!inputText.trim() || !conversation) return;

    const content = inputText.trim();
    setInputText('');
    agentDraftRef.current = '';
    // Draft is sent → remove it from the sidebar draft map as well
    if (id) delete draftsByConvRef.current[id];

    // Draft is gone → stop the heartbeat and clear the visitor's indicator
    clearAgentTyping();

    try {
      const newMsg = await sendAgentMessage(conversation.id, {
        senderId: currentUser?.userId || 'agent_1',
        senderName: currentUser?.nickname || '在线坐席',
        content,
        msgType: 'text',
        isInternalNote: isNote,
      });

      setMessages((prev) => {
        if (prev.some((m) => m.id === newMsg.id)) return prev;
        return [...prev, newMsg];
      });
    } catch (err) {
      console.error('Failed to send message:', err);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.nativeEvent.isComposing || e.keyCode === 229) {
      return;
    }
    if (e.key === 'Enter') {
      if (e.shiftKey) {
        return;
      }
      e.preventDefault();
      handleSendMessage(false);
    }
  };

  // 4.5 WeChat-style Push-to-Talk Voice Logic
  const showVoiceToast = (msg: string) => {
    setVoiceToast(msg);
    if (voiceToastTimerRef.current) clearTimeout(voiceToastTimerRef.current);
    voiceToastTimerRef.current = window.setTimeout(() => {
      setVoiceToast(null);
    }, 1600);
  };

  const handleStartVoiceRecording = (e: React.MouseEvent | React.TouchEvent) => {
    if (isClosed || !conversation) return;
    e.preventDefault();

    if ('touches' in e && e.touches.length > 0) {
      voiceTouchStartYRef.current = e.touches[0].clientY;
    } else if ('clientY' in e) {
      voiceTouchStartYRef.current = (e as React.MouseEvent).clientY;
    }

    setIsVoiceRecording(true);
    setIsVoiceCancelWarning(false);
    isVoiceCancelWarningRef.current = false;
    setVoiceDuration(0);
    voiceStartTimeRef.current = Date.now();

    if (voiceRecordingTimerRef.current) clearInterval(voiceRecordingTimerRef.current);
    voiceRecordingTimerRef.current = window.setInterval(() => {
      const elapsed = Math.floor((Date.now() - voiceStartTimeRef.current) / 1000);
      setVoiceDuration(elapsed);
      if (elapsed >= 60) {
        // Max 60 seconds (WeChat convention)
        handleStopVoiceRecording();
      }
    }, 200);
  };

  const handleVoiceTouchMove = (e: React.TouchEvent) => {
    if (!isVoiceRecording) return;
    const currentY = e.touches[0].clientY;
    // If finger moves up more than 50px, highlight cancel state
    if (voiceTouchStartYRef.current - currentY > 50) {
      setIsVoiceCancelWarning(true);
      isVoiceCancelWarningRef.current = true;
    } else {
      setIsVoiceCancelWarning(false);
      isVoiceCancelWarningRef.current = false;
    }
  };

  const handleVoiceMouseMove = (e: React.MouseEvent) => {
    if (!isVoiceRecording) return;
    if (voiceTouchStartYRef.current - e.clientY > 50) {
      setIsVoiceCancelWarning(true);
      isVoiceCancelWarningRef.current = true;
    } else {
      setIsVoiceCancelWarning(false);
      isVoiceCancelWarningRef.current = false;
    }
  };

  const handleVoiceMouseLeave = () => {
    if (!isVoiceRecording) return;
    setIsVoiceCancelWarning(true);
    isVoiceCancelWarningRef.current = true;
  };

  const handleStopVoiceRecording = async () => {
    if (!isVoiceRecording) return;

    if (voiceRecordingTimerRef.current) {
      clearInterval(voiceRecordingTimerRef.current);
      voiceRecordingTimerRef.current = null;
    }
    setIsVoiceRecording(false);

    const elapsedMs = Date.now() - voiceStartTimeRef.current;
    const duration = Math.max(1, Math.round(elapsedMs / 1000));

    if (isVoiceCancelWarningRef.current) {
      showVoiceToast('已取消发送');
      setIsVoiceCancelWarning(false);
      isVoiceCancelWarningRef.current = false;
      return;
    }

    if (elapsedMs < 800) {
      showVoiceToast('说话时间太短');
      return;
    }

    if (!conversation) return;

    try {
      const newMsg = await sendAgentMessage(conversation.id, {
        senderId: currentUser?.userId || 'agent_1',
        senderName: currentUser?.nickname || '在线坐席',
        content: `[语音消息 ${duration}"]`,
        msgType: 'voice',
        voiceDuration: duration,
        isInternalNote: false,
      });

      setMessages((prev) => {
        if (prev.some((m) => m.id === newMsg.id)) return prev;
        return [...prev, newMsg];
      });

      if (soundEnabled) playNotificationSound('message');
    } catch (err) {
      console.error('Failed to send voice message:', err);
    }
  };

  // 5. File, Image & Video Processing Core
  const processFile = async (file: File, isVideoForce = false) => {
    if (!file || !conversation) return;
    const isImg = file.type.startsWith('image/');
    const isVideo = isVideoForce || file.type.startsWith('video/') || file.name.endsWith('.mp4') || file.name.endsWith('.webm');

    try {
      setIsUploading(true);
      const res = await agentUploadFile(file);

      const newMsg = await sendAgentMessage(conversation.id, {
        senderId: currentUser?.userId || 'agent_1',
        senderName: currentUser?.nickname || '在线坐席',
        content: isImg ? '[图片]' : isVideo ? `[视频] ${res.name || '演示视频.mp4'}` : `[文件] ${res.name}`,
        msgType: isImg ? 'image' : isVideo ? 'video' : 'file',
        fileUrl: res.url,
        fileName: res.name,
        fileSize: res.size,
        isInternalNote: false,
      });

      setMessages((prev) => {
        if (prev.some((m) => m.id === newMsg.id)) return prev;
        return [...prev, newMsg];
      });
    } catch (err) {
      console.error('Upload failed:', err);
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, _isImg = false, isVideo = false) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processFile(file, isVideo);
    if (e.target) e.target.value = '';
  };

  const handleSendSampleVideo = async () => {
    if (!conversation) return;
    try {
      setIsUploading(true);
      const newMsg = await sendAgentMessage(conversation.id, {
        senderId: currentUser?.userId || 'agent_1',
        senderName: currentUser?.nickname || '在线坐席',
        content: '光年跃迁 客户端节点切换与加速配置操作演示',
        msgType: 'video',
        fileUrl: 'https://www.w3schools.com/html/mov_bbb.mp4',
        fileName: 'client_setup_guide.mp4',
        fileSize: '4.8 MB',
        isInternalNote: false,
      });
      setMessages((prev) => {
        if (prev.some((m) => m.id === newMsg.id)) return prev;
        return [...prev, newMsg];
      });
    } catch (e) {
      console.error(e);
    } finally {
      setIsUploading(false);
    }
  };

  // Drag & Drop Handlers
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.types && Array.from(e.dataTransfer.types).includes('Files')) {
      setIsDraggingOver(true);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
    if (!isDraggingOver) {
      setIsDraggingOver(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsDraggingOver(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);

    if (isClosed) return;

    const files = Array.from(e.dataTransfer.files || []) as File[];
    if (files.length === 0) return;

    for (const file of files) {
      await processFile(file);
    }
  };

  // Clipboard Paste Handler (e.g. Snipping tool / Screenshot paste)
  const handlePaste = async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    if (isClosed) return;
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.kind === 'file' && item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          e.preventDefault();
          await processFile(file);
        }
      }
    }
  };

  // 6. Close or Reopen Conversation
  const handleCloseConversation = async () => {
    if (!conversation) return;
    if (!window.confirm('确定要结束该会话吗？结束后访客端将提示会话完成。')) return;
    try {
      const updated = await closeConversation(conversation.id);
      setConversation(updated);
    } catch (e) {
      console.error(e);
    }
  };

  const handleReopenConversation = async () => {
    if (!conversation) return;
    try {
      const updated = await reopenConversation(conversation.id);
      setConversation(updated);
    } catch (e) {
      console.error(e);
    }
  };

  const handleTransferSuccess = (targetAgent: AgentUser) => {
    if (conversation) {
      setConversation({
        ...conversation,
        assignedAgentId: targetAgent.userId,
        assignedAgentName: targetAgent.nickname,
      });
    }
  };

  if (!conversation) {
    return (
      <div className="h-full w-full flex">
        <ConversationSidebar activeId={id} agentDrafts={draftsByConvRef.current} />
        <div className="flex-1 flex items-center justify-center text-xs text-slate-400">
          正在加载会话详情...
        </div>
      </div>
    );
  }

  const isClosed = conversation.status === 'closed';

  return (
    <div className="h-full w-full flex overflow-hidden">
      {/* Left Conversations Sidebar */}
      <ConversationSidebar activeId={id} agentDrafts={draftsByConvRef.current} />

      {/* Center Chat Viewport */}
      <div
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className="flex-1 flex flex-col min-w-0 bg-slate-50 relative"
      >
        {/* Drag & Drop Visual Overlay */}
        {isDraggingOver && (
          <div className="absolute inset-0 z-50 bg-blue-600/10 border-2 border-dashed border-blue-500 flex flex-col items-center justify-center gap-3 backdrop-blur-[2px] transition pointer-events-none">
            <div className="w-14 h-14 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-lg shadow-blue-500/30 animate-bounce">
              <UploadCloud className="w-7 h-7" />
            </div>
            <div className="text-center">
              <p className="text-sm font-bold text-blue-700">松开鼠标即可立即发送图片或文件</p>
              <p className="text-xs text-blue-600 mt-0.5">支持常见图片格式 (JPG、PNG、GIF) 及文档附件</p>
            </div>
          </div>
        )}

        {/* Top Conversation Header */}
        <div className="px-5 py-3.5 bg-white border-b border-slate-200 flex items-center justify-between shadow-2xs z-10">
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative">
              <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-sm">
                {conversation.visitorName.substring(0, 1)}
              </div>
              <span
                className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-white ${
                  !isClosed ? 'bg-emerald-500' : 'bg-slate-400'
                }`}
              />
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-slate-800 truncate">
                  {conversation.visitorName}
                </h2>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                    !isClosed
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-slate-100 text-slate-600 border border-slate-200'
                  }`}
                >
                  {!isClosed ? '进行中' : '已结束'}
                </span>

                {/* Channel Source Badge */}
                {conversation.channel === 'wecom' && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    企业微信客服
                  </span>
                )}
                {conversation.channel === 'wechat' && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-green-50 text-green-700 border border-green-200 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                    微信公众号
                  </span>
                )}
                {conversation.channel === 'feishu' && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-sky-50 text-sky-700 border border-sky-200 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-sky-500" />
                    飞书开放平台
                  </span>
                )}
                {conversation.channel === 'dingtalk' && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                    钉钉
                  </span>
                )}
                {(!conversation.channel || conversation.channel === 'web') && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-slate-100 text-slate-600 border border-slate-200 flex items-center gap-1">
                    <Globe className="w-3 h-3 text-blue-600" />
                    Web官网咨询
                  </span>
                )}
              </div>
              <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                <span>归属地：{conversation.visitorInfo?.location || '未知地域'}</span>
                <span>·</span>
                <span>接待人：{conversation.assignedAgentName || '未分配'}</span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            {/* Audio Toggle */}
            <button
              type="button"
              onClick={() => setSoundEnabled((v) => !v)}
              className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 transition cursor-pointer"
              title={soundEnabled ? '提示音开启' : '提示音静音'}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4 text-blue-600" /> : <VolumeX className="w-4 h-4 text-slate-400" />}
            </button>

            {/* Transfer Dropdown Button */}
            {!isClosed && (
              <button
                type="button"
                onClick={() => setShowTransferModal(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded-lg transition cursor-pointer"
              >
                <UserCheck className="w-3.5 h-3.5" />
                <span>会话转接</span>
              </button>
            )}

            {/* Close / Reopen */}
            {!isClosed ? (
              <button
                type="button"
                onClick={handleCloseConversation}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 text-xs font-medium rounded-lg transition border border-red-200 cursor-pointer"
              >
                <CheckCircle className="w-3.5 h-3.5" />
                <span>结束会话</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleReopenConversation}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-medium rounded-lg transition border border-emerald-200 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>重新激活会话</span>
              </button>
            )}

            {/* Toggle Visitor Meta Panel */}
            <button
              type="button"
              onClick={() => setShowVisitorPanel((v) => !v)}
              className={`p-1.5 rounded-lg border transition cursor-pointer ${
                showVisitorPanel
                  ? 'bg-blue-50 border-blue-200 text-blue-600'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
              title="切换访客详情面板"
            >
              {showVisitorPanel ? (
                <PanelRightClose className="w-4 h-4" />
              ) : (
                <PanelRightOpen className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>

        {/* Message Scrollable Area */}
        <div className="flex-1 overflow-y-auto p-5 space-y-2">
          {/* Historical Separator */}
          <div className="flex justify-center my-3">
            <span className="text-[11px] text-slate-400 bg-slate-200/60 px-3 py-0.5 rounded-full flex items-center gap-1">
              <Clock className="w-3 h-3" />
              <span>会话开始于 {formatConversationTime(conversation.createdAt)}</span>
            </span>
          </div>

          {messages.map((msg) => (
            <MessageBubble
              key={msg.id}
              message={
                msg.senderType === 'visitor' && conversation.visitorName
                  ? { ...msg, senderName: conversation.visitorName }
                  : msg
              }
              themeColor="#2563eb"
              isAgentWorkbenchView={true}
            />
          ))}

          {/* Visitor typing dots (when typing before text commit) */}
          {isVisitorTyping && !visitorDraft && (
            <div className="flex items-center gap-2 text-slate-400 text-xs py-1 px-3 bg-white/80 rounded-xl w-fit border border-slate-200 animate-pulse">
              <div className="flex gap-1 items-center">
                <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" />
                <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce [animation-delay:0.2s]" />
                <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce [animation-delay:0.4s]" />
              </div>
              <span>访客正在打字...</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Bottom Input Area */}
        <div className="bg-white border-t border-slate-200 p-4 relative">
          {/* Quick Reply Popup Menu */}
          {showQuickReply && (
            <QuickReplySelect
              onSelect={(content) => {
                const next = inputText + content;
                setInputText(next);
                // Keep draft state in sync (sidebar preview + typing indicator restore)
                agentDraftRef.current = next;
                if (id) draftsByConvRef.current[id] = next;
                // Refocus the textarea and place the cursor after the inserted
                // content, so Enter sends immediately without an extra click.
                requestAnimationFrame(() => {
                  const el = inputRef.current;
                  if (el) {
                    el.focus();
                    const len = el.value.length;
                    el.setSelectionRange(len, len);
                  }
                });
              }}
              onClose={() => setShowQuickReply(false)}
            />
          )}

          {/* 🌟 CORE FEATURE: Visitor Real-time Draft Prediction Notification (No Truncation) */}
          {visitorDraft && (
            <div className="mb-3 p-2.5 bg-linear-to-r from-amber-50 via-orange-50/50 to-amber-50 border-2 border-amber-300 rounded-xl text-xs text-amber-950 shadow-xs animate-in fade-in slide-in-from-bottom-2">
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <div className="flex items-center gap-2 font-bold text-amber-900 text-xs">
                  <span className="flex h-2.5 w-2.5 relative shrink-0">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-500 opacity-80" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-600" />
                  </span>
                  <span>访客实时输入草稿 (未发送)</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[10px] bg-amber-500 text-white font-semibold px-2 py-0.5 rounded-full shadow-2xs">
                    实时感知
                  </span>
                </div>
              </div>
              {/* Full Text Area with auto-wrapping, no truncation ellipsis */}
              <div className="bg-white/95 border border-amber-300 rounded-lg px-3 py-2 text-xs font-mono text-amber-950 font-medium break-all whitespace-pre-wrap select-text leading-relaxed shadow-2xs max-h-28 overflow-y-auto">
                {visitorDraft}
              </div>
            </div>
          )}

          {/* Action Toolbar */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1 text-slate-500">
              <button
                type="button"
                onClick={() => setShowQuickReply((v) => !v)}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition cursor-pointer ${
                  showQuickReply
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
                title="选择快捷回复"
              >
                <Zap className="w-3.5 h-3.5 text-amber-500" />
                <span>快捷回复</span>
              </button>

              <button
                type="button"
                onClick={() => imageInputRef.current?.click()}
                disabled={isUploading || isClosed}
                className="p-1.5 rounded-lg hover:bg-slate-100 hover:text-slate-800 transition cursor-pointer disabled:opacity-40"
                title="发送图片"
              >
                <ImageIcon className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading || isClosed}
                className="p-1.5 rounded-lg hover:bg-slate-100 hover:text-slate-800 transition cursor-pointer disabled:opacity-40"
                title="发送文件附件 (支持大文件)"
              >
                <Paperclip className="w-4 h-4" />
              </button>

              {/* WeChat-style Voice Input Button */}
              <button
                type="button"
                onClick={() => {
                  // Leaving the textarea hides the visitor's indicator (blur won't fire on unmount)
                  clearAgentTyping();
                  setIsVoiceMode((prev) => !prev);
                }}
                disabled={isUploading || isClosed}
                className={`p-1.5 rounded-lg transition cursor-pointer disabled:opacity-40 flex items-center gap-1 ${
                  isVoiceMode
                    ? 'bg-blue-100 text-blue-700 font-medium ring-1 ring-blue-400/50'
                    : 'hover:bg-slate-100 hover:text-slate-800 text-slate-500'
                }`}
                title={isVoiceMode ? '点击切换回键盘输入' : '语音输入 (点击后按住说话)'}
              >
                <Mic className="w-4 h-4" />
                {isVoiceMode && <span className="text-[11px] font-medium">按住说话</span>}
              </button>

              {/* Video Message Button */}
              <button
                type="button"
                onClick={() => videoInputRef.current?.click()}
                disabled={isUploading || isClosed}
                className="p-1.5 rounded-lg hover:bg-slate-100 hover:text-slate-800 transition cursor-pointer disabled:opacity-40"
                title="上传或发送产品演示视频 (.mp4)"
              >
                <Film className="w-4 h-4 text-purple-600" />
              </button>

              {/* Quick Sample Video */}
              <button
                type="button"
                onClick={handleSendSampleVideo}
                disabled={isUploading || isClosed}
                className="px-2 py-0.5 rounded text-[11px] font-medium bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200 transition cursor-pointer disabled:opacity-40"
                title="一键发送官方配置演示视频消息"
              >
                演示视频
              </button>

              {isUploading && (
                <span className="text-xs text-blue-600 animate-pulse ml-2">正在处理文件...</span>
              )}
            </div>

            <div className="text-[11px] text-slate-400">
              <span>{isVoiceMode ? '按住下方按钮说话，松开发送' : 'Enter 发送回复'}</span>
            </div>
          </div>

          {/* Hidden File Inputs */}
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            onChange={(e) => handleFileUpload(e, false)}
          />
          <input
            type="file"
            ref={imageInputRef}
            accept="image/*"
            className="hidden"
            onChange={(e) => handleFileUpload(e, true)}
          />
          <input
            type="file"
            ref={videoInputRef}
            accept="video/*"
            className="hidden"
            onChange={(e) => handleFileUpload(e, false, true)}
          />

          {/* Text Area & Submit Button */}
          <div className="space-y-2.5">
            {isVoiceMode ? (
              <div className="min-h-30 w-full flex flex-col items-center justify-center bg-slate-50 border border-slate-200 rounded-xl p-3 select-none relative">
                <button
                  type="button"
                  onMouseDown={handleStartVoiceRecording}
                  onMouseUp={handleStopVoiceRecording}
                  onTouchStart={handleStartVoiceRecording}
                  onTouchEnd={handleStopVoiceRecording}
                  onTouchMove={handleVoiceTouchMove}
                  onMouseMove={handleVoiceMouseMove}
                  onMouseLeave={handleVoiceMouseLeave}
                  disabled={isClosed}
                  className={`w-full max-w-md h-12 rounded-xl flex items-center justify-center gap-2 font-semibold text-xs tracking-wide transition-all shadow-2xs select-none cursor-pointer ${
                    isVoiceRecording
                      ? isVoiceCancelWarning
                        ? 'bg-red-50 text-red-600 border-2 border-red-500 scale-[0.98]'
                        : 'bg-blue-50 text-blue-700 border-2 border-blue-500 scale-[0.98] ring-4 ring-blue-500/15'
                      : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 hover:border-slate-300 active:bg-slate-200'
                  }`}
                >
                  <Mic
                    className={`w-4 h-4 ${
                      isVoiceRecording
                        ? isVoiceCancelWarning
                          ? 'text-red-500'
                          : 'text-blue-600 animate-pulse'
                        : 'text-slate-500'
                    }`}
                  />
                  <span>
                    {isVoiceRecording
                      ? isVoiceCancelWarning
                        ? '松开手指，取消发送'
                        : '松开 结束发送 (上滑取消)'
                      : '按住 说话'}
                  </span>
                </button>

                <div className="flex items-center justify-between w-full mt-2.5 px-3 text-[11px] text-slate-400">
                  <span>微信语音模式：按住说话，移开取消，松开发送</span>
                  <button
                    type="button"
                    onClick={() => setIsVoiceMode(false)}
                    className="text-blue-600 hover:underline cursor-pointer font-medium"
                  >
                    切换为文字键盘
                  </button>
                </div>
              </div>
            ) : (
              <textarea
                ref={inputRef}
                rows={5}
                disabled={isClosed}
                value={inputText}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                onPaste={handlePaste}
                onBlur={handleInputBlur}
                onFocus={handleInputFocus}
                placeholder={
                  isClosed
                    ? '会话已关闭，重新激活后方可继续回复'
                    : '请输入回复内容...'
                }
                className="w-full min-h-28.75 p-3.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-y leading-relaxed transition disabled:bg-slate-100"
              />
            )}

            <div className="flex items-center justify-between">
              <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-slate-400" />
                <span>
                  {isVoiceMode
                    ? '按住上方按钮录音，松手即自动发送语音消息'
                    : '支持直接拖拽发图/视频，Enter快速发送'}
                </span>
              </div>

              <div className="flex items-center gap-2">
                {/* Regular Send Button */}
                {!isVoiceMode && (
                  <button
                    type="button"
                    disabled={!inputText.trim() || isClosed}
                    onClick={() => handleSendMessage(false)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-xs font-semibold shadow-xs transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>
                      发送回复
                      {conversation.channel === 'wecom'
                        ? ' (企微)'
                        : conversation.channel === 'wechat'
                        ? ' (微信)'
                        : conversation.channel === 'feishu'
                        ? ' (飞书)'
                        : conversation.channel === 'dingtalk'
                        ? ' (钉钉)'
                        : ''}
                    </span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Visitor Metadata Panel */}
      {showVisitorPanel && (
        <VisitorInfoPanel
          conversationId={conversation.id}
          visitorInfo={conversation.visitorInfo}
          visitorName={conversation.visitorName}
          channel={conversation.channel}
          online={visitorOnline}
          onUpdateVisitorInfo={(updated) => setConversation(updated)}
          onClose={() => setShowVisitorPanel(false)}
        />
      )}

      {/* Transfer Modal */}
      {showTransferModal && (
        <TransferModal
          conversationId={conversation.id}
          currentAssignedId={conversation.assignedAgentId}
          onClose={() => setShowTransferModal(false)}
          onSuccess={handleTransferSuccess}
        />
      )}

      {/* WeChat-style Voice Recording HUD Modal */}
      {isVoiceRecording && (
        <div className="fixed inset-0 z-50 pointer-events-none flex items-center justify-center">
          <div
            className={`w-40 h-40 rounded-2xl flex flex-col items-center justify-center shadow-2xl backdrop-blur-md transition-colors duration-150 select-none ${
              isVoiceCancelWarning
                ? 'bg-red-600/90 text-white ring-4 ring-red-400/30'
                : 'bg-slate-900/85 text-white ring-4 ring-white/10'
            }`}
          >
            {isVoiceCancelWarning ? (
              <div className="flex flex-col items-center text-center px-2">
                <RotateCcw className="w-10 h-10 text-white mb-2 animate-spin" />
                <span className="text-sm font-bold tracking-wide">松开手指</span>
                <span className="text-xs text-white/90 mt-0.5">取消发送</span>
              </div>
            ) : (
              <div className="flex flex-col items-center text-center px-2">
                <div className="flex items-center gap-2.5 mb-2.5">
                  <Mic className="w-9 h-9 text-emerald-400 animate-pulse" />
                  <div className="flex items-end gap-1 h-7">
                    <span className="w-1 bg-white rounded-full animate-bounce [animation-delay:-0.3s]" style={{ height: '50%' }} />
                    <span className="w-1 bg-white rounded-full animate-bounce [animation-delay:-0.15s]" style={{ height: '90%' }} />
                    <span className="w-1 bg-white rounded-full animate-bounce [animation-delay:-0.4s]" style={{ height: '35%' }} />
                    <span className="w-1 bg-white rounded-full animate-bounce [animation-delay:-0.2s]" style={{ height: '75%' }} />
                    <span className="w-1 bg-white rounded-full animate-bounce [animation-delay:-0.35s]" style={{ height: '100%' }} />
                  </div>
                </div>
                <div className="text-sm font-semibold tracking-wider">
                  录音中 {voiceDuration}s
                </div>
                <div className="text-[11px] text-white/80 mt-1">
                  手指上滑，取消发送
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* WeChat-style Voice Toast Prompt */}
      {voiceToast && (
        <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 pointer-events-none">
          <div className="px-4 py-2.5 rounded-xl bg-slate-900/90 text-white text-xs font-medium shadow-2xl backdrop-blur-sm flex items-center gap-2 animate-bounce">
            <Info className="w-4 h-4 text-amber-400" />
            <span>{voiceToast}</span>
          </div>
        </div>
      )}
    </div>
  );
};
