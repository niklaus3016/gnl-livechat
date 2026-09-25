# 坐席会话接待工作台 —— 完整代码

> 本页面对应坐席端「会话接待工作台」，由以下 6 个文件组成（共约 3000 行）：
>
| 顺序 | 文件 | 行数 | 职责 |
|---|---|---|---|
| 1 | `src/pages/agent/ConversationDetailPage.tsx` | 1308 | 页面主体：顶部会话栏、消息区、草稿预知、输入区、归档/转接 |
| 2 | `src/components/agent/ConversationSidebar.tsx` | 458 | 左侧会话列表（搜索、进行中/已归档、渠道筛选） |
| 3 | `src/components/agent/VisitorInfoPanel.tsx` | 354 | 右侧访客画像与网络元信息 |
| 4 | `src/components/agent/TransferModal.tsx` | 164 | 会话转接弹窗 |
| 5 | `src/components/agent/QuickReplySelect.tsx` | 113 | 快捷回复模板选择器 |
| 6 | `src/components/chat/MessageBubble.tsx` | 670 | 聊天气泡（文本/图片/文件/语音/视频） |

---

## 1. 页面主体 ConversationDetailPage

`src/pages/agent/ConversationDetailPage.tsx`

```tsx
import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  getConversationDetail,
  getAgentMessages,
  sendAgentMessage,
  markAgentMessagesRead,
  closeConversation,
  agentUploadFile,
  getCurrentAgentToken,
  joinConversationRoom,
  claimConversation,
  getTenantSetting,
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
  UserPlus,
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
  // 企业主配置的品牌通用头像，用于 AI 助手欢迎消息气泡
  const [brandAvatar, setBrandAvatar] = useState<string | undefined>(undefined);
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
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const isRecordingRef = useRef(false);

  // Global dragover & drop prevention so browser never navigates or opens dropped files directly
  useEffect(() => {
    // 取一次企业主配置的品牌通用头像，用于 AI 助手消息气泡
    getTenantSetting()
      .then((c) => setBrandAvatar(c.default_avatar))
      .catch(() => undefined);

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
      mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
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
  // 排队中（未分配）会话：坐席一旦开始回复（文本/语音/文件），先静默认领给自己，
  // 避免出现"已经在接待、头部和列表却一直显示未分配"的割裂。认领失败不阻断发送。
  const ensureClaimed = async () => {
    if (!conversation || conversation.status !== 'queued') return;
    try {
      const claimed = await claimConversation(conversation.id);
      setConversation(claimed);
    } catch (e) {
      console.warn('自动认领失败，继续发送消息:', e);
    }
  };

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
      await ensureClaimed();
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

  const handleStartVoiceRecording = async (e: React.MouseEvent | React.TouchEvent) => {
    if (isClosed || !conversation) return;
    e.preventDefault();

    if ('touches' in e && e.touches.length > 0) {
      voiceTouchStartYRef.current = e.touches[0].clientY;
    } else if ('clientY' in e) {
      voiceTouchStartYRef.current = (e as React.MouseEvent).clientY;
    }

    // 立即标记录音中（同步 ref，避免 await getUserMedia 期间 mouseUp 被误判为未录音）
    isRecordingRef.current = true;
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
        handleStopVoiceRecording();
      }
    }, 200);

    // Request mic & start MediaRecorder (real audio recording)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // 如果在等待授权期间用户已松开，直接结束
      if (!isRecordingRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      mediaStreamRef.current = stream;
      const mime = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4';
      const recorder = new MediaRecorder(stream, { mimeType: mime });
      audioChunksRef.current = [];
      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) audioChunksRef.current.push(ev.data);
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
    } catch (err) {
      console.error('Mic access failed:', err);
      showVoiceToast('无法访问麦克风，请检查浏览器权限');
      // 重置录音状态
      if (voiceRecordingTimerRef.current) clearInterval(voiceRecordingTimerRef.current);
      voiceRecordingTimerRef.current = null;
      isRecordingRef.current = false;
      setIsVoiceRecording(false);
      return;
    }
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
    if (!isRecordingRef.current) return;
    isRecordingRef.current = false;

    if (voiceRecordingTimerRef.current) {
      clearInterval(voiceRecordingTimerRef.current);
      voiceRecordingTimerRef.current = null;
    }
    setIsVoiceRecording(false);

    const elapsedMs = Date.now() - voiceStartTimeRef.current;
    const duration = Math.max(1, Math.round(elapsedMs / 1000));

    const cancelled = isVoiceCancelWarningRef.current;
    setIsVoiceCancelWarning(false);
    isVoiceCancelWarningRef.current = false;

    // Stop mic tracks
    mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
    mediaStreamRef.current = null;

    const recorder = mediaRecorderRef.current;
    mediaRecorderRef.current = null;

    const discardRecording = () => {
      audioChunksRef.current = [];
    };

    if (cancelled) {
      if (recorder && recorder.state !== 'inactive') recorder.stop();
      discardRecording();
      showVoiceToast('已取消发送');
      return;
    }

    if (elapsedMs < 800) {
      if (recorder && recorder.state !== 'inactive') recorder.stop();
      discardRecording();
      showVoiceToast('说话时间太短');
      return;
    }

    if (!conversation) {
      discardRecording();
      return;
    }

    // Wait for MediaRecorder to flush final chunk
    const blob = await new Promise<Blob>((resolve) => {
      if (!recorder || recorder.state === 'inactive') {
        resolve(new Blob(audioChunksRef.current, { type: 'audio/webm' }));
        return;
      }
      recorder.onstop = () =>
        resolve(new Blob(audioChunksRef.current, { type: recorder.mimeType || 'audio/webm' }));
      recorder.stop();
    });
    audioChunksRef.current = [];

    if (!blob || blob.size === 0) {
      showVoiceToast('录音失败，请重试');
      return;
    }

    try {
      await ensureClaimed();
      setIsUploading(true);
      const ext = blob.type.includes('mp4') ? 'm4a' : blob.type.includes('ogg') ? 'ogg' : 'webm';
      const file = new File([blob], `voice-${Date.now()}.${ext}`, {
        type: blob.type || 'audio/webm',
      });
      const res = await agentUploadFile(file);
      const newMsg = await sendAgentMessage(conversation.id, {
        senderId: currentUser?.userId || 'agent_1',
        senderName: currentUser?.nickname || '在线坐席',
        content: `[语音消息 ${duration}"]`,
        msgType: 'voice',
        fileUrl: res.url,
        fileName: res.name,
        fileSize: res.size,
        fileSizeBytes: res.sizeBytes,
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
      showVoiceToast(err instanceof Error ? err.message : '语音发送失败，请重试');
    } finally {
      setIsUploading(false);
    }
  };

  // 5. File, Image & Video Processing Core
  const processFile = async (file: File, isVideoForce = false) => {
    if (!file || !conversation) return;
    const isImg = file.type.startsWith('image/');
    const isVideo = isVideoForce || file.type.startsWith('video/') || file.name.endsWith('.mp4') || file.name.endsWith('.webm');

    // 视频大小限制：100MB
    const MAX_VIDEO_BYTES = 100 * 1024 * 1024;
    if (isVideo && file.size > MAX_VIDEO_BYTES) {
      showVoiceToast('视频文件不能超过 100MB');
      return;
    }

    try {
      setIsUploading(true);
      await ensureClaimed();
      const res = await agentUploadFile(file);

      const newMsg = await sendAgentMessage(conversation.id, {
        senderId: currentUser?.userId || 'agent_1',
        senderName: currentUser?.nickname || '在线坐席',
        content: isImg ? '[图片]' : isVideo ? `[视频] ${res.name || '演示视频.mp4'}` : `[文件] ${res.name}`,
        msgType: isImg ? 'image' : isVideo ? 'video' : 'file',
        fileUrl: res.url,
        fileName: res.name,
        fileSize: res.size,
        fileSizeBytes: res.sizeBytes,
        isInternalNote: false,
      });

      setMessages((prev) => {
        if (prev.some((m) => m.id === newMsg.id)) return prev;
        return [...prev, newMsg];
      });
    } catch (err) {
      console.error('Upload failed:', err);
      showVoiceToast(err instanceof Error ? err.message : '发送失败，请重试');
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

  // 6. 认领排队中（未分配）的会话：指派给当前坐席并转为进行中
  const [claiming, setClaiming] = useState(false);
  const handleClaimConversation = async () => {
    if (!conversation || claiming) return;
    setClaiming(true);
    try {
      const updated = await claimConversation(conversation.id);
      setConversation(updated);
      showVoiceToast('已认领，该会话已分配给你');
    } catch (e) {
      console.error(e);
      showVoiceToast('认领失败，请重试');
    } finally {
      setClaiming(false);
    }
  };

  // 7. Archive Conversation (visitor-side reopen is automatic on next message)
  const handleCloseConversation = async () => {
    if (!conversation) return;
    if (!window.confirm('确定要归档该会话吗？归档后访客仍可继续发消息，消息会自动重新分配接待。')) return;
    try {
      const updated = await closeConversation(conversation.id);
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
  // 排队中（未分配）：出现在所有坐席列表里，等待坐席认领
  const isQueued = conversation.status === 'queued';

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
                  {!isClosed ? '进行中' : '已归档'}
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
                    Web
                  </span>
                )}
              </div>
              <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                <span>归属地：{conversation.visitorInfo?.location || '未知地域'}</span>
                <span>·</span>
                <span>
                  接待人：
                  {conversation.assignedAgentName ? (
                    conversation.assignedAgentName
                  ) : (
                    <span className={isQueued ? 'text-amber-600 font-medium' : ''}>待认领</span>
                  )}
                </span>
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

            {/* Claim queued (unassigned) conversation */}
            {!isClosed && isQueued && (
              <button
                type="button"
                onClick={handleClaimConversation}
                disabled={claiming}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded-lg transition cursor-pointer disabled:opacity-60 disabled:cursor-default"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>{claiming ? '认领中…' : '认领接待'}</span>
              </button>
            )}

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

            {/* Archive */}
            {!isClosed && (
              <button
                type="button"
                onClick={handleCloseConversation}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 text-xs font-medium rounded-lg transition border border-red-200 cursor-pointer"
              >
                <CheckCircle className="w-3.5 h-3.5" />
                <span>归档会话</span>
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
              botAvatar={brandAvatar}
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
                className="p-1.5 rounded-lg hover:bg-purple-50 transition cursor-pointer disabled:opacity-40"
                title="发送图片"
              >
                <ImageIcon className="w-4 h-4 text-purple-600" />
              </button>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading || isClosed}
                className="p-1.5 rounded-lg hover:bg-purple-50 transition cursor-pointer disabled:opacity-40"
                title="发送文件附件 (支持大文件)"
              >
                <Paperclip className="w-4 h-4 text-purple-600" />
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
                    ? 'bg-purple-100 text-purple-700 font-medium ring-1 ring-purple-400/50'
                    : 'hover:bg-purple-50 text-purple-600'
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
                className="p-1.5 rounded-lg hover:bg-purple-50 transition cursor-pointer disabled:opacity-40"
                title="上传或发送产品演示视频 (.mp4)"
              >
                <Film className="w-4 h-4 text-purple-600" />
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
                    ? '会话已归档，访客再次发消息时将自动重新分配接待'
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
```

---

## 2. 左侧会话列表 ConversationSidebar

`src/components/agent/ConversationSidebar.tsx`

```tsx
import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getConversationList, deleteConversation, ApiError } from '../../api';
import { mockWsBus } from '../../lib/mock/mock-ws-bus';
import { realSocket } from '../../lib/real/socket-service';
import { Conversation, ChannelType } from '../../types';
import { Search, Inbox, Archive, User, Clock, MessageSquare, Globe, Send, Trash2 } from 'lucide-react';
import { formatConversationTime } from '../../utils/format';

interface ConversationSidebarProps {
  activeId?: string;
  onSelectConversation?: (id: string) => void;
  /** Agent's unsent drafts keyed by conversation id — items with a draft show a preview + badge */
  agentDrafts?: Record<string, string>;
  /** 只读模式（企业主会话监控）：隐藏删除/一键清空入口 */
  readOnly?: boolean;
  /** 外部递增时强制重新拉取列表（监控轮询用；坐席端靠 ws 总线无需传） */
  refreshKey?: number;
  /** 暗色主题（企业主会话监控深蓝配色） */
  dark?: boolean;
}

/** 列表副行的访客归属地：取 location 的城市段（空格分隔末段），未知显示「未知地域」（与详情头部一致，不再硬编码「中国」） */
function visitorRegion(conv: Conversation): string {
  const loc = conv.visitorInfo?.location?.trim();
  if (!loc) return '未知地域';
  return loc.split(/\s+/).pop() || loc;
}

export const ConversationSidebar: React.FC<ConversationSidebarProps> = ({
  activeId,
  onSelectConversation,
  agentDrafts,
  readOnly = false,
  refreshKey,
  dark = false,
}) => {
  const navigate = useNavigate();
  const params = useParams<{ id?: string }>();
  const currentId = activeId || params.id;

  const [activeTab, setActiveTab] = useState<'open' | 'closed'>('open');
  const [selectedChannel, setSelectedChannel] = useState<string>('all');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [keyword, setKeyword] = useState('');
  const [loading, setLoading] = useState(false);
  // 访客在线状态表：conversationId → online（仅坐席实时模式维护；监控只读页不连接 socket）
  const [presence, setPresence] = useState<Record<string, boolean>>({});
  // 每个会话独立的离线防抖定时器（与详情页一致：掉线延迟 5s 变灰，刷新/抖动不闪烁）
  const offlineTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const fetchConversations = async () => {
    try {
      setLoading(true);
      const res = await getConversationList({
        status: activeTab,
        keyword: keyword.trim(),
      });
      setConversations(res.list);
      // 坐席工作台：批量订阅进行中会话房间，拿 join ack 初始在线状态 + 后续 presence 广播。
      // socket-service 内部有去重（agentJoinedRooms）与断线重连恢复（agentRoomRestore），
      // 列表里只会出现「分配给我」或「排队中（未分配）」的会话，均在权限范围内。
      if (!readOnly) {
        res.list
          .filter((c) => c.status !== 'closed')
          .forEach((c) => realSocket.joinConversation(c.id));
      }
    } catch (err) {
      console.error('Failed to load conversations:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConversations();
  }, [activeTab, keyword]);

  // 外部轮询信号（仅监控模式传入）：递增即刷新列表
  useEffect(() => {
    if (refreshKey) fetchConversations();
  }, [refreshKey]);

  // Listen to WebSocket events to automatically update conversation preview & badges
  useEffect(() => {
    const unbindMsg = mockWsBus.on('message', () => {
      fetchConversations();
    });
    const unbindStatus = mockWsBus.on('conversation_status', () => {
      fetchConversations();
    });
    const unbindRead = mockWsBus.on('read', () => {
      fetchConversations();
    });
    const unbindUpdate = mockWsBus.on('conversation_updated', () => {
      fetchConversations();
    });
    // Visitor renamed (info panel auto-save) → patch the list entry in place.
    // A refetch would revert the name until the backend persists it, so patch.
    const unbindVisitor = mockWsBus.on(
      'visitor_updated',
      (p: { conversationId?: string; name?: string }) => {
        if (!p?.conversationId || !p.name) return;
        setConversations((prev) =>
          prev.map((c) => (c.id === p.conversationId ? { ...c, visitorName: p.name! } : c)),
        );
      },
    );

    return () => {
      unbindMsg();
      unbindStatus();
      unbindRead();
      unbindUpdate();
      unbindVisitor();
    };
  }, [activeTab, keyword]);

  // 列表访客在线点：join ack 初始状态 + presence 实时广播（仅坐席实时模式）。
  // 在线立即变绿；离线延迟 5s 变灰，访客刷新页面/网络抖动不会闪灰，与详情页同口径。
  useEffect(() => {
    if (readOnly) return;
    const unbind = mockWsBus.on(
      'visitor_presence',
      (p: { conversationId?: string; online?: boolean }) => {
        const cid = p?.conversationId;
        if (!cid) return;
        const timers = offlineTimersRef.current;
        const oldTimer = timers.get(cid);
        if (oldTimer) {
          clearTimeout(oldTimer);
          timers.delete(cid);
        }
        if (p.online) {
          setPresence((prev) => (prev[cid] === true ? prev : { ...prev, [cid]: true }));
        } else {
          const timer = setTimeout(() => {
            timers.delete(cid);
            setPresence((prev) => (prev[cid] === false ? prev : { ...prev, [cid]: false }));
          }, 5000);
          timers.set(cid, timer);
        }
      },
    );
    return () => {
      unbind();
      offlineTimersRef.current.forEach((t) => clearTimeout(t));
      offlineTimersRef.current.clear();
    };
  }, [readOnly]);

  const handleItemClick = (id: string) => {
    if (onSelectConversation) {
      onSelectConversation(id);
    } else {
      navigate(`/agent/conversations/${id}`);
    }
  };

  /** Permanently remove one closed conversation (row trash icon). */
  const handleDeleteConversation = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!window.confirm('确定永久删除该会话及其全部消息吗？删除后不可恢复。')) return;
    try {
      await deleteConversation(id);
      if (currentId === id) navigate('/agent/conversations');
      await fetchConversations();
      mockWsBus.dispatch('conversation_updated', null);
    } catch (err) {
      console.error(err);
      // 后端 403 语义：无权删除该会话（非受理人）；其余为网络/未知错误
      window.alert(err instanceof ApiError ? err.message : '删除失败，请稍后重试');
    }
  };

  /** Batch-delete every closed conversation in the current list (一键清空). */
  const handleClearClosed = async () => {
    const ids = conversations.filter((c) => c.status === 'closed').map((c) => c.id);
    if (ids.length === 0) return;
    if (!window.confirm(`确定永久删除全部 ${ids.length} 条已归档会话吗？删除后不可恢复。`)) return;
    const results = await Promise.allSettled(ids.map((id) => deleteConversation(id)));
    const failed = results.filter((r) => r.status === 'rejected').length;
    if (failed > 0) {
      console.error(`${failed} conversations failed to delete`);
      const firstReason = results.find((r): r is PromiseRejectedResult => r.status === 'rejected')?.reason;
      window.alert(
        firstReason instanceof ApiError
          ? `有 ${failed} 条删除失败：${firstReason.message}`
          : `有 ${failed} 条删除失败，请稍后重试`,
      );
    }
    if (ids.includes(currentId || '')) navigate('/agent/conversations');
    await fetchConversations();
    mockWsBus.dispatch('conversation_updated', null);
  };

  // Filter by selected channel
  const filteredConversations = conversations.filter((c) => {
    if (selectedChannel === 'all') return true;
    const ch = c.channel || 'web';
    return ch === selectedChannel;
  });

  const renderChannelBadge = (channel?: ChannelType) => {
    switch (channel) {
      case 'wecom':
        return (
          <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded ${dark ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'} text-[10px] font-medium shrink-0`}>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            企微
          </span>
        );
      case 'wechat':
        return (
          <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded ${dark ? 'bg-green-500/10 text-green-300 border border-green-500/30' : 'bg-green-50 text-green-700 border border-green-200'} text-[10px] font-medium shrink-0`}>
            <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
            微信
          </span>
        );
      case 'feishu':
        return (
          <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded ${dark ? 'bg-sky-500/10 text-sky-300 border border-sky-500/30' : 'bg-sky-50 text-sky-700 border border-sky-200'} text-[10px] font-medium shrink-0`}>
            <span className="w-1.5 h-1.5 rounded-full bg-sky-500" />
            飞书
          </span>
        );
      case 'dingtalk':
        return (
          <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded ${dark ? 'bg-indigo-500/10 text-indigo-300 border border-indigo-500/30' : 'bg-indigo-50 text-indigo-700 border border-indigo-200'} text-[10px] font-medium shrink-0`}>
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
            钉钉
          </span>
        );
      case 'web':
      default:
        return (
          <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded ${dark ? 'bg-slate-800 text-slate-300 border border-slate-700' : 'bg-slate-100 text-slate-600 border border-slate-200'} text-[10px] font-medium shrink-0`}>
            <Globe className="w-2.5 h-2.5" />
            Web
          </span>
        );
    }
  };

  return (
    <div className={`w-72 xl:w-80 h-full flex flex-col shrink-0 select-none ${dark ? 'bg-slate-900 border-r border-slate-800' : 'bg-white border-r border-slate-200'}`}>
      {/* Top Search & Filter */}
      <div className={`p-3.5 border-b space-y-2.5 ${dark ? 'border-slate-800' : 'border-slate-100'}`}>
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="搜索访客、消息、渠道..."
            className={`w-full pl-9 pr-3 py-1.5 text-xs border rounded-xl focus:outline-hidden focus:ring-2 transition ${
              dark
                ? 'bg-slate-800 border-slate-700 text-slate-100 placeholder:text-slate-500 focus:bg-slate-800 focus:ring-indigo-500/20 focus:border-indigo-500'
                : 'bg-slate-50 border-slate-200 focus:bg-white focus:ring-blue-500/20 focus:border-blue-500'
            }`}
          />
        </div>

        {/* Tab Toggle: 进行中 vs 已关闭 */}
        <div className={`grid grid-cols-2 p-1 rounded-xl text-xs font-medium ${dark ? 'bg-slate-800' : 'bg-slate-100'}`}>
          <button
            type="button"
            onClick={() => setActiveTab('open')}
            className={`flex items-center justify-center gap-1.5 py-1.5 rounded-lg transition cursor-pointer ${
              activeTab === 'open'
                ? dark
                  ? 'bg-slate-700 text-indigo-300 shadow-xs font-semibold'
                  : 'bg-white text-blue-600 shadow-xs font-semibold'
                : dark
                  ? 'text-slate-400 hover:text-slate-200'
                  : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Inbox className="w-3.5 h-3.5" />
            <span>进行中会话</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('closed')}
            className={`flex items-center justify-center gap-1.5 py-1.5 rounded-lg transition cursor-pointer ${
              activeTab === 'closed'
                ? dark
                  ? 'bg-slate-700 text-slate-100 shadow-xs font-semibold'
                  : 'bg-white text-slate-800 shadow-xs font-semibold'
                : dark
                  ? 'text-slate-400 hover:text-slate-200'
                  : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Archive className="w-3.5 h-3.5" />
            <span>已归档会话</span>
          </button>
        </div>

        {/* Channel Filter Chips */}
        <div className="flex items-center gap-1 overflow-x-auto pb-0.5 text-[11px] no-scrollbar">
          {[
            { id: 'all', label: '全部渠道' },
            { id: 'web', label: 'Web' },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setSelectedChannel(item.id)}
              className={`px-2 py-0.5 rounded-md transition whitespace-nowrap cursor-pointer ${
                selectedChannel === item.id
                  ? dark
                    ? 'bg-indigo-500 text-white font-medium'
                    : 'bg-blue-600 text-white font-medium'
                  : dark
                    ? 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Closed-tab bulk cleanup bar */}
      {activeTab === 'closed' && !readOnly && conversations.length > 0 && (
        <div className="px-3 py-1.5 flex items-center justify-end border-b border-slate-100">
          <button
            type="button"
            onClick={handleClearClosed}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] text-red-500 hover:text-red-600 hover:bg-red-50 transition cursor-pointer"
          >
            <Trash2 className="w-3 h-3" />
            <span>一键清空（{conversations.length}）</span>
          </button>
        </div>
      )}

      {/* Conversations Scrollable List */}
      <div className={`flex-1 overflow-y-auto divide-y ${dark ? 'divide-slate-800' : 'divide-slate-100'}`}>
        {loading && conversations.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-400">正在同步会话数据...</div>
        ) : filteredConversations.length === 0 ? (
          <div className="p-8 text-center">
            <Inbox className={`w-8 h-8 mx-auto mb-2 ${dark ? 'text-slate-600' : 'text-slate-300'}`} />
            <p className={`text-xs font-medium ${dark ? 'text-slate-400' : 'text-slate-500'}`}>
              暂无匹配的会话
            </p>
            <p className="text-[11px] text-slate-400 mt-1">访客通过网页或社交渠道发起的咨询将自动接入</p>
          </div>
        ) : (
          filteredConversations.map((conv) => {
            const isSelected = conv.id === currentId;
            const unread = conv.unreadCountForAgent || 0;
            // Unsent agent draft for this conversation (only meaningful while open)
            const draft = conv.status === 'open' ? agentDrafts?.[conv.id]?.trim() : '';
            // 访客在线点：真实 presence 在线绿/离线灰；状态未知（null/undefined）按在线展示，不误判
            const visitorOnline = presence[conv.id] !== false;

            return (
              <div
                key={conv.id}
                onClick={() => handleItemClick(conv.id)}
                className={`p-3 transition cursor-pointer relative flex gap-3 ${
                  isSelected
                    ? dark
                      ? 'bg-indigo-500/10 border-l-4 border-indigo-400'
                      : 'bg-blue-50/70 border-l-4 border-blue-600'
                    : dark
                      ? 'hover:bg-slate-800/60 border-l-4 border-transparent'
                      : 'hover:bg-slate-50 border-l-4 border-transparent'
                }`}
              >
                {/* Avatar with initial */}
                <div className="relative shrink-0">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${dark ? 'bg-slate-700 text-slate-300' : 'bg-slate-200 text-slate-700'}`}>
                    {conv.visitorName.substring(0, 1)}
                  </div>
                  {conv.status === 'open' ? (
                    <span
                      title={visitorOnline ? '访客当前在线' : '访客已离线'}
                      className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 transition-colors duration-300 ${
                        visitorOnline ? 'bg-emerald-500' : 'bg-slate-400'
                      } ${dark ? 'border-slate-900' : 'border-white'}`}
                    />
                  ) : (
                    <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-slate-400 border-2 ${dark ? 'border-slate-900' : 'border-white'}`} />
                  )}
                </div>

                {/* Content info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <div className="flex items-center gap-1.5 min-w-0 pr-1">
                      <span className={`text-sm font-semibold truncate ${dark ? 'text-slate-100' : 'text-slate-800'}`}>
                        {conv.visitorName}
                      </span>
                      {renderChannelBadge(conv.channel)}
                    </div>
                    <span className="text-xs text-slate-400 shrink-0">
                      {formatConversationTime(conv.lastMessageTime)}
                    </span>
                  </div>

                  {draft ? (
                    <div className="flex items-center gap-1 mb-1 min-w-0">
                      <span className="text-[12.5px] text-amber-600 truncate min-w-0 flex-1">
                        {draft}
                      </span>
                      <span className="shrink-0 inline-flex items-center px-1 py-px rounded bg-amber-100 text-amber-700 border border-amber-200 text-[10px] font-medium">
                        草稿
                      </span>
                    </div>
                  ) : (
                    <p className={`text-[12.5px] truncate mb-1 ${dark ? 'text-slate-400' : 'text-slate-500'}`}>
                      {conv.lastMessage || '已接入会话'}
                    </p>
                  )}

                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span className="truncate max-w-37.5">
                      {visitorRegion(conv)} ·{' '}
                      {conv.assignedAgentName ? (
                        conv.assignedAgentName
                      ) : conv.status === 'queued' ? (
                        <span className="text-amber-500 font-medium">待认领</span>
                      ) : (
                        '未分配'
                      )}
                    </span>
                    <span className="flex items-center gap-1.5 shrink-0">
                      {unread > 0 && (
                        <span className="px-2 py-0.5 min-w-4 text-center rounded-full bg-red-500 text-white font-bold text-xs shadow-xs">
                          {unread}
                        </span>
                      )}
                      {conv.status === 'closed' && !readOnly && (
                        <button
                          type="button"
                          title="删除会话"
                          onClick={(e) => handleDeleteConversation(e, conv.id)}
                          className="text-slate-300 hover:text-red-500 transition cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
```

---

## 3. 右侧访客画像 VisitorInfoPanel

`src/components/agent/VisitorInfoPanel.tsx`

```tsx
import React, { useState, useEffect, useRef } from 'react';
import { Conversation, VisitorInfo, ChannelType } from '../../types';
import { updateVisitorBasicInfo } from '../../api';
import { formatConversationTime } from '../../utils/format';
import {
  Globe,
  MapPin,
  Clock,
  Mail,
  User,
  Phone,
  FileText,
  Check,
  Loader2,
  Share2,
} from 'lucide-react';

interface VisitorInfoPanelProps {
  conversationId: string;
  visitorInfo: VisitorInfo;
  visitorName: string;
  channel?: ChannelType;
  /** 真实在线状态：null = 未知（ack/广播未到达，含 mock 模式）— 按在线展示 */
  online?: boolean | null;
  onUpdateVisitorInfo?: (updatedConv: Conversation) => void;
  onClose?: () => void;
  /** 只读模式（企业主会话监控）：输入禁用、不触发自动保存 */
  readOnly?: boolean;
  /** 暗色主题（企业主会话监控深蓝配色） */
  dark?: boolean;
}

export const VisitorInfoPanel: React.FC<VisitorInfoPanelProps> = ({
  conversationId,
  visitorInfo,
  visitorName,
  channel = 'web',
  online = null,
  onUpdateVisitorInfo,
  readOnly = false,
  dark = false,
}) => {
  const [name, setName] = useState(visitorInfo.name || visitorName || '');
  const [phone, setPhone] = useState(visitorInfo.phone || '');
  const [email, setEmail] = useState(visitorInfo.email || '');
  const [notes, setNotes] = useState(visitorInfo.notes || '');

  // 基本信息自动保存状态
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const debounceTimerRef = useRef<number | null>(null);
  const statusResetTimerRef = useRef<number | null>(null);

  // 仅在切换会话时同步本地状态。
  // 注意：不要把 visitorInfo 放进依赖数组——父组件会因 socket 事件（新消息/typing/在线状态等）
  // 频繁重渲染并产生新的 visitorInfo 引用，若依赖它会导致输入过程中被反复重置，
  // 出现打字丢失、中文输入法乱码等问题。同一会话内以本地 state 为唯一真相。
  useEffect(() => {
    setName(visitorInfo.name || visitorName || '');
    setPhone(visitorInfo.phone || '');
    setEmail(visitorInfo.email || '');
    setNotes(visitorInfo.notes || '');
    setSaveStatus('idle');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      if (statusResetTimerRef.current) clearTimeout(statusResetTimerRef.current);
    };
  }, []);

  const saveChanges = async (updatedFields: {
    name?: string;
    phone?: string;
    email?: string;
    notes?: string;
  }) => {
    if (!conversationId) return;

    try {
      setSaveStatus('saving');
      const updated = await updateVisitorBasicInfo(conversationId, {
        name: updatedFields.name !== undefined ? updatedFields.name : name,
        phone: updatedFields.phone !== undefined ? updatedFields.phone : phone,
        email: updatedFields.email !== undefined ? updatedFields.email : email,
        notes: updatedFields.notes !== undefined ? updatedFields.notes : notes,
      });

      setSaveStatus('saved');
      onUpdateVisitorInfo?.(updated);

      if (statusResetTimerRef.current) clearTimeout(statusResetTimerRef.current);
      statusResetTimerRef.current = window.setTimeout(() => {
        setSaveStatus('idle');
      }, 2500);
    } catch (err) {
      console.error('Failed to auto-save visitor basic info:', err);
      setSaveStatus('error');
    }
  };

  const triggerDebouncedSave = (newFields: {
    name?: string;
    phone?: string;
    email?: string;
    notes?: string;
  }) => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = window.setTimeout(() => {
      saveChanges(newFields);
    }, 600);
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (readOnly) return;
    const val = e.target.value;
    setName(val);
    triggerDebouncedSave({ name: val });
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (readOnly) return;
    const val = e.target.value;
    setPhone(val);
    triggerDebouncedSave({ phone: val });
  };

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (readOnly) return;
    const val = e.target.value;
    setEmail(val);
    triggerDebouncedSave({ email: val });
  };

  const handleNotesChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (readOnly) return;
    const val = e.target.value;
    setNotes(val);
    triggerDebouncedSave({ notes: val });
  };

  const handleBlur = () => {
    if (readOnly) return;
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    saveChanges({ name, phone, email, notes });
  };

  return (
    <div className={`w-72 xl:w-80 ${dark ? 'bg-slate-900 border-l border-slate-800' : 'bg-slate-50 border-l border-slate-200'} h-full flex flex-col shrink-0 overflow-y-auto`}>
      {/* Header */}
      <div className={`p-4 border-b ${dark ? 'border-slate-800 bg-slate-900' : 'border-slate-200 bg-white'}`}>
        <h3 className={`text-xs font-bold ${dark ? 'text-slate-400' : 'text-slate-500'} uppercase tracking-wider mb-2`}>
          访客画像与网络元信息
        </h3>
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-full ${dark ? 'bg-indigo-500/15 text-indigo-300' : 'bg-blue-100 text-blue-700'} flex items-center justify-center font-bold text-sm shrink-0`}>
            {(name || visitorName || '访').substring(0, 1)}
          </div>
          <div className="min-w-0 flex-1">
            <h4 className={`text-sm font-semibold truncate ${dark ? 'text-slate-100' : 'text-slate-800'}`}>
              {name || visitorName || '在线访客'}
            </h4>
            <span
              className={`inline-flex items-center gap-1 text-[11px] font-medium ${
                online === false ? 'text-slate-400' : dark ? 'text-emerald-400' : 'text-emerald-600'
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${online === false ? 'bg-slate-300' : 'bg-emerald-500'}`}
              />
              {online === false ? '离线' : '当前在线'}
            </span>
          </div>
        </div>
      </div>

      {/* Info Items List */}
      <div className="p-4 space-y-4 text-xs">
        {/* Contact Info (Editable with Auto-Save) */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className={`font-semibold ${dark ? 'text-slate-400' : 'text-slate-500'} text-[11px] uppercase tracking-wider block`}>
              基本联系信息
            </span>
            <div className="flex items-center gap-1">
              {saveStatus === 'saving' && (
                <span className="text-[10px] text-blue-600 flex items-center gap-1 font-medium animate-pulse">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  保存中...
                </span>
              )}
              {saveStatus === 'saved' && (
                <span className="text-[10px] text-emerald-600 flex items-center gap-1 font-medium">
                  <Check className="w-3 h-3 text-emerald-500" />
                  已自动保存
                </span>
              )}
              {saveStatus === 'error' && (
                <span className="text-[10px] text-red-500 font-medium">
                  保存失败
                </span>
              )}
              {saveStatus === 'idle' && (
                <span className="text-[10px] text-slate-400">
                  修改后自动保存
                </span>
              )}
            </div>
          </div>

          {/* 1. 访客称谓 */}
          <div className={`p-2.5 rounded-xl ${dark ? 'bg-slate-800/60 border border-slate-700' : 'bg-white border border-slate-200/80 shadow-2xs'} transition-colors focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-500/10`}>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                <User className="w-3.5 h-3.5 text-slate-400" />
                <span>访客称谓</span>
              </div>
              {!readOnly && <span className="text-[10px] text-slate-400">可编辑</span>}
            </div>
            <input
              type="text"
              value={name}
              onChange={handleNameChange}
              onBlur={handleBlur}
              disabled={readOnly}
              placeholder="请填写访客称谓或姓名..."
              className={`w-full text-xs font-semibold ${dark ? 'text-slate-100 placeholder:text-slate-500' : 'text-slate-800 placeholder:text-slate-300'} bg-transparent border-none outline-hidden p-0 placeholder:font-normal`}
            />
          </div>

          {/* 2. 手机号码 (电子邮箱上面) */}
          <div className={`p-2.5 rounded-xl ${dark ? 'bg-slate-800/60 border border-slate-700' : 'bg-white border border-slate-200/80 shadow-2xs'} transition-colors focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-500/10`}>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                <Phone className="w-3.5 h-3.5 text-slate-400" />
                <span>手机号码</span>
              </div>
              {!readOnly && <span className="text-[10px] text-slate-400">可编辑</span>}
            </div>
            <input
              type="tel"
              value={phone}
              onChange={handlePhoneChange}
              onBlur={handleBlur}
              disabled={readOnly}
              placeholder="请填写手机号或联系电话..."
              className={`w-full text-xs font-medium ${dark ? 'text-slate-100 placeholder:text-slate-500' : 'text-slate-800 placeholder:text-slate-300'} bg-transparent border-none outline-hidden p-0 placeholder:font-normal font-mono`}
            />
          </div>

          {/* 3. 电子邮箱 */}
          <div className={`p-2.5 rounded-xl ${dark ? 'bg-slate-800/60 border border-slate-700' : 'bg-white border border-slate-200/80 shadow-2xs'} transition-colors focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-500/10`}>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                <Mail className="w-3.5 h-3.5 text-slate-400" />
                <span>电子邮箱</span>
              </div>
              {!readOnly && <span className="text-[10px] text-slate-400">可编辑</span>}
            </div>
            <input
              type="email"
              value={email}
              onChange={handleEmailChange}
              onBlur={handleBlur}
              disabled={readOnly}
              placeholder="请填写电子邮箱..."
              className={`w-full text-xs font-medium ${dark ? 'text-slate-100 placeholder:text-slate-500' : 'text-slate-800 placeholder:text-slate-300'} bg-transparent border-none outline-hidden p-0 placeholder:font-normal`}
            />
          </div>

          {/* 4. 客户备注栏 (电子邮箱下面) */}
          <div className={`p-2.5 rounded-xl ${dark ? 'bg-slate-800/60 border border-slate-700' : 'bg-white border border-slate-200/80 shadow-2xs'} transition-colors focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-500/10`}>
            <div className="flex items-center justify-between mb-1.5">
              <div className={`flex items-center gap-1.5 text-[11px] font-medium ${dark ? 'text-amber-300' : 'text-amber-700'}`}>
                <FileText className="w-3.5 h-3.5 text-amber-600" />
                <span>客服备注栏</span>
              </div>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium ${dark ? 'text-amber-300 bg-amber-500/10' : 'text-amber-700 bg-amber-50'}`}>
                客服可见
              </span>
            </div>
            <textarea
              rows={5}
              value={notes}
              onChange={handleNotesChange}
              onBlur={handleBlur}
              disabled={readOnly}
              placeholder="添加客户意向、特殊要求或跟进备注，离开或输入后自动保存..."
              className={`w-full text-xs ${dark ? 'text-slate-100 bg-slate-800/60 hover:bg-slate-800 focus:bg-slate-800 border border-slate-700 focus:border-indigo-500 placeholder:text-slate-500' : 'text-slate-700 bg-slate-50/60 hover:bg-slate-50 focus:bg-white border border-slate-200/60 focus:border-blue-400 placeholder:text-slate-400'} rounded-lg p-2 outline-hidden resize-none leading-relaxed transition`}
            />
          </div>
        </div>

        {/* Network & Geography */}
        <div className="space-y-2">
          <span className="font-semibold text-slate-500 text-[11px] uppercase tracking-wider block">
            网络环境与归属地
          </span>

          <div className={`flex items-start gap-2.5 p-2.5 rounded-xl ${dark ? 'bg-slate-800/60 border border-slate-700' : 'bg-white border border-slate-200/80 shadow-2xs'}`}>
            <MapPin className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
              <div className="text-[11px] text-slate-400">地理位置</div>
              <div className={`font-medium wrap-break-word ${dark ? 'text-slate-200' : 'text-slate-700'}`}>{visitorInfo.location || '未知'}</div>
            </div>
          </div>

          <div className={`flex items-start gap-2.5 p-2.5 rounded-xl ${dark ? 'bg-slate-800/60 border border-slate-700' : 'bg-white border border-slate-200/80 shadow-2xs'}`}>
            <Globe className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
              <div className="text-[11px] text-slate-400">访客真实 IP</div>
              <div className={`font-medium font-mono ${dark ? 'text-slate-200' : 'text-slate-700'}`}>{visitorInfo.ip || '未知'}</div>
            </div>
          </div>
        </div>

        {/* Track & Referer */}
        <div className="space-y-2">
          <span className="font-semibold text-slate-500 text-[11px] uppercase tracking-wider block">
            访问轨迹与设备
          </span>

          {/* 渠道接入来源 */}
          <div className={`p-2.5 rounded-xl ${dark ? 'bg-slate-800/60 border border-slate-700' : 'bg-white border border-slate-200/80 shadow-2xs'} space-y-1.5`}>
            <div className={`flex items-center gap-1.5 text-[11px] font-medium ${dark ? 'text-slate-400' : 'text-slate-500'}`}>
              <Share2 className="w-3.5 h-3.5 text-slate-400" />
              <span>渠道接入来源</span>
            </div>
            <div className={`font-semibold text-xs ${dark ? 'text-slate-100' : 'text-slate-800'}`}>
              {channel === 'wecom' && '企业微信 (WeCom) 客服'}
              {channel === 'wechat' && '微信公众号 (WeChat Official)'}
              {channel === 'feishu' && '飞书开放平台 (Feishu OpenBot)'}
              {channel === 'dingtalk' && '阿里钉钉开放平台 (DingTalk)'}
              {(!channel || channel === 'web') && 'Web 在线咨询窗口'}
            </div>
          </div>

          <div className={`flex items-center gap-2 p-2.5 rounded-xl ${dark ? 'bg-slate-800/60 border border-slate-700' : 'bg-white border border-slate-200/80 shadow-2xs'}`}>
            <Clock className="w-4 h-4 text-slate-400 shrink-0" />
            <div>
              <div className="text-[11px] text-slate-400">首次接入时间</div>
              <div className={`font-medium ${dark ? 'text-slate-200' : 'text-slate-700'}`}>{formatConversationTime(visitorInfo.firstVisitAt) || '今天'}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
```

---

## 4. 会话转接弹窗 TransferModal

`src/components/agent/TransferModal.tsx`

```tsx
import React, { useEffect, useState } from 'react';
import { getAgentList, transferConversation } from '../../api';
import { AgentUser } from '../../types';
import { UserCheck, X, ArrowRight, ShieldCheck } from 'lucide-react';

interface TransferModalProps {
  conversationId: string;
  currentAssignedId?: string | null;
  onClose: () => void;
  onSuccess: (targetAgent: AgentUser) => void;
}

export const TransferModal: React.FC<TransferModalProps> = ({
  conversationId,
  currentAssignedId,
  onClose,
  onSuccess,
}) => {
  const [agents, setAgents] = useState<AgentUser[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchAgents = async () => {
      try {
        const list = await getAgentList();
        // filter out disabled agents
        const available = list.filter((a) => a.enabled && a.userId !== currentAssignedId);
        setAgents(available);
        if (available.length > 0) {
          setSelectedAgentId(available[0].userId);
        }
      } catch (err: any) {
        setError(err.message || '获取坐席列表失败');
      }
    };
    fetchAgents();
  }, [currentAssignedId]);

  const handleConfirmTransfer = async () => {
    if (!selectedAgentId) return;
    try {
      setLoading(true);
      await transferConversation(conversationId, selectedAgentId);
      const target = agents.find((a) => a.userId === selectedAgentId);
      if (target) onSuccess(target);
      onClose();
    } catch (err: any) {
      setError(err.message || '转接失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2 text-slate-800 font-bold text-base">
            <UserCheck className="w-5 h-5 text-blue-600" />
            <span>会话转接给同租户其他坐席</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mt-4 p-3 bg-red-50 text-red-600 text-xs rounded-xl border border-red-200">
            {error}
          </div>
        )}

        <div className="py-5 space-y-4">
          <p className="text-xs text-slate-600 leading-relaxed">
            选择接收该会话的目标坐席。转接后，该会话将自动同步分配给目标坐席，并在聊天对话中插入转接系统通知。
          </p>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-2">选择目标坐席：</label>
            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {agents.map((agent) => (
                <label
                  key={agent.userId}
                  className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition ${
                    selectedAgentId === agent.userId
                      ? 'border-blue-600 bg-blue-50/50 shadow-xs'
                      : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="radio"
                      name="targetAgent"
                      checked={selectedAgentId === agent.userId}
                      onChange={() => setSelectedAgentId(agent.userId)}
                      className="text-blue-600 focus:ring-blue-500"
                    />
                    <div>
                      <div className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                        <span>{agent.nickname}</span>
                        {agent.role === 'tenant_admin' && (
                          <span className="text-[10px] bg-indigo-100 text-indigo-700 px-1.5 py-0.2 rounded font-normal">
                            主管
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400">{agent.account}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 text-[11px]">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        agent.status === 'online'
                          ? 'bg-emerald-500'
                          : agent.status === 'away'
                          ? 'bg-amber-500'
                          : 'bg-slate-400'
                      }`}
                    />
                    <span className="text-slate-500 capitalize">
                      {agent.status === 'online' ? '在线' : agent.status === 'away' ? '离开' : '离线'}
                    </span>
                  </div>
                </label>
              ))}

              {agents.length === 0 && (
                <div className="text-center py-6 text-xs text-slate-400">
                  暂无其他可转接的在线坐席
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
          >
            取消
          </button>
          <button
            type="button"
            disabled={!selectedAgentId || loading}
            onClick={handleConfirmTransfer}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-xs font-medium rounded-xl shadow-md transition disabled:opacity-40 cursor-pointer"
          >
            <span>{loading ? '正在转接...' : '确认转接'}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
```

---

## 5. 快捷回复选择器 QuickReplySelect

`src/components/agent/QuickReplySelect.tsx`

```tsx
import React, { useEffect, useState } from 'react';
import { getQuickReplies } from '../../api';
import { QuickReplyItem } from '../../types';
import { Zap, Search, ChevronRight, X } from 'lucide-react';

interface QuickReplySelectProps {
  onSelect: (content: string) => void;
  onClose: () => void;
}

export const QuickReplySelect: React.FC<QuickReplySelectProps> = ({ onSelect, onClose }) => {
  const [replies, setReplies] = useState<QuickReplyItem[]>([]);
  const [keyword, setKeyword] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  useEffect(() => {
    getQuickReplies().then(setReplies).catch(console.error);
  }, []);

  const categories = ['all', ...Array.from(new Set(replies.map((r) => r.category || '通用')))];

  const filtered = replies.filter((item) => {
    const matchCat = selectedCategory === 'all' || (item.category || '通用') === selectedCategory;
    const matchKw =
      !keyword ||
      item.title.toLowerCase().includes(keyword.toLowerCase()) ||
      item.content.toLowerCase().includes(keyword.toLowerCase()) ||
      (item.shortcut && item.shortcut.toLowerCase().includes(keyword.toLowerCase()));
    return matchCat && matchKw;
  });

  return (
    <div className="absolute bottom-full left-0 mb-2 w-96 max-w-[calc(100vw-32px)] bg-white rounded-2xl shadow-2xl border border-slate-200 z-50 overflow-hidden flex flex-col max-h-96">
      {/* Search & Header */}
      <div className="p-3 border-b border-slate-100 bg-slate-50/70">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
            <Zap className="w-3.5 h-3.5 text-amber-500" />
            <span>我的快捷回复</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 rounded-md cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
          <input
            type="text"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="搜索快捷语、标题或指令(如 /hi)..."
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-hidden focus:border-blue-500"
          />
        </div>

        {/* Categories Bar */}
        <div className="flex gap-1.5 mt-2 overflow-x-auto pb-0.5">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`px-2 py-0.5 rounded-md text-[11px] whitespace-nowrap transition cursor-pointer ${
                selectedCategory === cat
                  ? 'bg-blue-600 text-white font-medium'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {cat === 'all' ? '全部' : cat}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
        {filtered.map((item) => (
          <div
            key={item.id}
            onClick={() => {
              onSelect(item.content);
              onClose();
            }}
            className="p-2.5 rounded-xl hover:bg-blue-50/60 border border-transparent hover:border-blue-200 transition cursor-pointer group"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold text-slate-800 group-hover:text-blue-700">
                {item.title}
              </span>
              {item.shortcut && (
                <span className="text-[10px] font-mono bg-slate-100 group-hover:bg-blue-100 text-slate-600 px-1.5 py-0.5 rounded">
                  {item.shortcut}
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">
              {item.content}
            </p>
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="text-center py-8 text-xs text-slate-400">未找到匹配的快捷回复</div>
        )}
      </div>
    </div>
  );
};
```

---

## 6. 聊天气泡 MessageBubble

`src/components/chat/MessageBubble.tsx`

```tsx
import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage } from '../../types';
import { FileText, Download, Check, CheckCheck, Lock, Copy, Film, FileCode, FileArchive, FileSpreadsheet } from 'lucide-react';
import { playVoiceSimulation } from '../../utils/audio';
import { resolveAssetUrl } from '../../api/http';

const WeChatWaveIcon: React.FC<{ isPlaying: boolean; className?: string }> = ({
  isPlaying,
  className = 'w-4.5 h-4.5',
}) => {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.3"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* Inner Dot / Small arc */}
      <path
        d="M6 10.5 A 2 2 0 0 1 6 13.5"
        strokeWidth="2.8"
        className={isPlaying ? 'wechat-arc-1' : ''}
      />
      {/* Middle arc */}
      <path
        d="M10.5 7.5 A 6 6 0 0 1 10.5 16.5"
        className={isPlaying ? 'wechat-arc-2' : ''}
      />
      {/* Outer arc */}
      <path
        d="M15 4.5 A 10.5 10.5 0 0 1 15 19.5"
        className={isPlaying ? 'wechat-arc-3' : ''}
      />
    </svg>
  );
};

const CodeHighlightBlock: React.FC<{ code: string; language?: string }> = ({ code, language }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard?.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="my-2 rounded-lg overflow-hidden border border-slate-700/70 bg-slate-950 text-slate-100 text-xs font-mono shadow-sm">
      <div className="flex items-center justify-between px-3 py-1.5 bg-slate-900 border-b border-slate-800 text-[11px] text-slate-400 select-none">
        <span className="font-semibold uppercase tracking-wider text-slate-300">{language || 'CODE'}</span>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1 px-2 py-0.5 rounded hover:bg-slate-800 text-slate-300 hover:text-white transition cursor-pointer"
        >
          {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
          <span>{copied ? '已复制' : '复制代码'}</span>
        </button>
      </div>
      <pre className="p-3 overflow-x-auto text-emerald-400 leading-relaxed select-text font-mono text-[12px]">
        <code>{code}</code>
      </pre>
    </div>
  );
};

// Rich text renderer parsing markdown code blocks and inline code
const RichContentRenderer: React.FC<{ content: string; isMe?: boolean; dark?: boolean }> = ({ content, isMe, dark }) => {
  if (!content) return null;

  // Check if content has markdown code blocks ```lang\ncode```
  if (content.includes('```')) {
    const parts: React.ReactNode[] = [];
    const regex = /```(\w+)?\n([\s\S]*?)```/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(content)) !== null) {
      if (match.index > lastIndex) {
        const textBefore = content.substring(lastIndex, match.index);
        parts.push(
          <span key={`text-${lastIndex}`} className="whitespace-pre-wrap">
            {textBefore}
          </span>
        );
      }
      const lang = match[1] || 'text';
      const code = match[2];
      parts.push(<CodeHighlightBlock key={`code-${match.index}`} code={code} language={lang} />);
      lastIndex = regex.lastIndex;
    }

    if (lastIndex < content.length) {
      parts.push(
        <span key={`text-${lastIndex}`} className="whitespace-pre-wrap">
          {content.substring(lastIndex)}
        </span>
      );
    }

    return <div className="space-y-1">{parts}</div>;
  }

  // Handle inline code `code`
  if (content.includes('`')) {
    const parts = content.split(/(`[^`]+`)/g);
    return (
      <p className="whitespace-pre-wrap wrap-break-word">
        {parts.map((p, idx) => {
          if (p.startsWith('`') && p.endsWith('`') && p.length > 2) {
            return (
              <code
                key={idx}
                className={`px-1.5 py-0.5 rounded text-[12px] font-mono mx-0.5 ${
                  isMe ? 'bg-white/20 text-white' : dark ? 'bg-slate-700/80 text-blue-300' : 'bg-slate-200/80 text-blue-700'
                }`}
              >
                {p.slice(1, -1)}
              </code>
            );
          }
          return p;
        })}
      </p>
    );
  }

  return <p className="whitespace-pre-wrap wrap-break-word">{content}</p>;
};

// Enhanced file icon helper
const getFileIcon = (fileName?: string) => {
  if (!fileName) return <FileText className="w-4 h-4" />;
  const ext = fileName.split('.').pop()?.toLowerCase();
  if (['conf', 'js', 'ts', 'jsx', 'tsx', 'json', 'sh', 'py', 'go', 'yml', 'yaml'].includes(ext || '')) {
    return <FileCode className="w-4 h-4 text-emerald-500" />;
  }
  if (['zip', 'rar', 'tar', 'gz', '7z'].includes(ext || '')) {
    return <FileArchive className="w-4 h-4 text-amber-500" />;
  }
  if (['xlsx', 'xls', 'csv'].includes(ext || '')) {
    return <FileSpreadsheet className="w-4 h-4 text-emerald-600" />;
  }
  return <FileText className="w-4 h-4 text-blue-500" />;
};

const WeChatVoiceBubble: React.FC<{
  duration?: number;
  isMe: boolean;
  themeColor?: string;
  /** Real recorded audio file (backend-stored); falls back to simulation when absent (legacy/mock bubbles). */
  audioUrl?: string;
  dark?: boolean;
}> = ({ duration = 3, isMe, themeColor = '#1972f5', audioUrl, dark }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasPlayed, setHasPlayed] = useState(false);
  const stopRef = useRef<(() => void) | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    return () => {
      if (stopRef.current) stopRef.current();
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const handleTogglePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    setHasPlayed(true);
    if (isPlaying) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if (stopRef.current) stopRef.current();
      setIsPlaying(false);
      return;
    }
    if (audioUrl) {
      // Play the real recording
      const el = new Audio(audioUrl);
      audioRef.current = el;
      el.onended = () => setIsPlaying(false);
      el.onerror = () => setIsPlaying(false);
      el.play().catch(() => setIsPlaying(false));
      setIsPlaying(true);
      return;
    }
    setIsPlaying(true);
    stopRef.current = playVoiceSimulation(duration, () => {
      setIsPlaying(false);
    });
  };

  // WeChat voice width scaling:
  // Base width is ~76px, scales progressively with duration up to 220px
  const bubbleWidth = Math.min(Math.max(68 + Math.min(duration, 60) * 5.5, 76), 220);

  return (
    <div className="flex items-center gap-2 select-none">
      <div
        onClick={handleTogglePlay}
        className={`relative h-9.5 px-3.5 flex items-center rounded-md cursor-pointer transition-all duration-100 active:opacity-85 shadow-2xs ${
          isMe
            ? 'text-white justify-between'
            : dark
              ? 'bg-slate-800 text-slate-100 justify-between border border-slate-700'
              : 'bg-white text-[#111827] justify-between border border-slate-200/90'
        }`}
        style={{
          width: `${bubbleWidth}px`,
          ...(isMe ? { backgroundColor: themeColor } : {}),
        }}
        title={isPlaying ? '点击暂停' : '点击播放语音'}
      >
        {/* Tail Pointer Arrow */}
        {isMe ? (
          // Right arrow pointing to avatar in matching theme blue
          <span
            className="absolute -right-1.5 top-3.5 w-0 h-0 border-t-[5px] border-t-transparent border-b-[5px] border-b-transparent border-l-[6px]"
            style={{ borderLeftColor: themeColor }}
          />
        ) : (
          // Left arrow pointing to avatar with matching border
          <>
            <span className={`absolute -left-1.5 top-3.5 w-0 h-0 border-t-[5px] border-t-transparent border-b-[5px] border-b-transparent border-r-[6px] ${dark ? 'border-r-slate-700' : 'border-r-slate-200'}`} />
            <span className={`absolute -left-1.25 top-3.5 w-0 h-0 border-t-[5px] border-t-transparent border-b-[5px] border-b-transparent border-r-[5px] ${dark ? 'border-r-slate-800' : 'border-r-white'}`} />
          </>
        )}

        {/* Content Layout */}
        {isMe ? (
          // Right bubble (Self): Duration on left, wave icon on right (radiating leftwards) in white
          <>
            <span className="text-[14px] font-normal tracking-tight text-white">{duration}"</span>
            <div className="scale-x-[-1] flex items-center shrink-0 text-white">
              <WeChatWaveIcon isPlaying={isPlaying} />
            </div>
          </>
        ) : (
          // Left bubble (Other): Wave icon on left (radiating rightwards), duration on right
          <>
            <div className={`flex items-center shrink-0 ${dark ? 'text-slate-200' : 'text-slate-800'}`}>
              <WeChatWaveIcon isPlaying={isPlaying} />
            </div>
            <span className="text-[14px] font-normal tracking-tight">{duration}"</span>
          </>
        )}
      </div>

      {/* Unread red dot for received voice message (WeChat signature feature) */}
      {!isMe && !hasPlayed && (
        <span className={`w-2 h-2 rounded-full bg-red-500 shrink-0 ${dark ? 'ring-1 ring-slate-900' : 'ring-1 ring-white'}`} title="未收听" />
      )}
    </div>
  );
};

interface MessageBubbleProps {
  message: ChatMessage;
  themeColor?: string;
  isAgentWorkbenchView?: boolean;
  agentAvatar?: string;
  botAvatar?: string;
  showSenderInfo?: boolean;
  onActionClick?: (action: string, payload?: string) => void;
  /** 暗色模式（企业主会话监控等深底场景）：气泡/头像/文字改暗色配色 */
  dark?: boolean;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  themeColor = '#1972f5',
  isAgentWorkbenchView = false,
  agentAvatar,
  botAvatar,
  showSenderInfo = true,
  onActionClick,
  dark = false,
}) => {
  // 独立域名部署时把后端相对附件地址补全；同源部署原样不变
  const fileUrl = resolveAssetUrl(message.fileUrl);
  const videoUrl = resolveAssetUrl(message.videoUrl);
  const [previewOpen, setPreviewOpen] = useState(false);

  const openPreview = (e: React.MouseEvent) => {
    e.stopPropagation();
    const url = resolveAssetUrl(message.fileUrl) || message.fileUrl;
    if (url) setPreviewOpen(true);
  };
  const previewUrl = resolveAssetUrl(message.fileUrl) || message.fileUrl || '';

  useEffect(() => {
    if (!previewOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPreviewOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [previewOpen]);

  // 1. System Notification Message
  if (message.senderType === 'system') {
    return (
      <div className="flex justify-center my-3">
        <span
          className={`text-xs px-3 py-1 rounded-full shadow-xs max-w-sm text-center border ${
            dark ? 'bg-slate-800 text-slate-400 border-slate-700' : 'bg-slate-100 text-slate-500 border-slate-200/80'
          }`}
        >
          {message.content}
        </span>
      </div>
    );
  }

  // 2. Internal Note (Only visible to agent workbench)
  if (message.isInternalNote) {
    if (!isAgentWorkbenchView) {
      return null; // Strictly invisible to visitor
    }
    return (
      <div className="flex justify-center my-3 px-4">
        <div
          className={`w-full max-w-lg rounded-xl p-3 text-xs shadow-xs border ${
            dark ? 'bg-amber-500/10 border-amber-500/30 text-amber-200' : 'bg-amber-50 border-amber-200 text-amber-900'
          }`}
        >
          <div className={`flex items-center gap-1.5 font-semibold mb-1 ${dark ? 'text-amber-300' : 'text-amber-800'}`}>
            <Lock className="w-3.5 h-3.5" />
            <span>内部坐席备注（访客不可见）· {message.senderName} · {message.createdAt}</span>
          </div>
          <p className="whitespace-pre-wrap">{message.content}</p>
        </div>
      </div>
    );
  }

  // In Visitor view: visitor is 'me' (right, blue), agent is 'other' (left, grey)
  // In Agent Workbench view: agent is 'me' (right, blue), visitor is 'other' (left, grey)
  const isMe = isAgentWorkbenchView
    ? message.senderType === 'agent'
    : message.senderType === 'visitor';

  // 坐席头像兜底：统一用本地通用头像（不用外部人像图）
  const defaultAgentPhoto = agentAvatar || '/avatars/agent-female.png';

  // Helper to extract voice duration
  const isVoice =
    message.msgType === 'voice' ||
    Boolean(
      message.content &&
        (message.content.includes('语音消息') ||
          message.content.includes('🎤') ||
          /\[\s*语音/i.test(message.content))
    );

  const getVoiceDuration = (): number => {
    if (message.voiceDuration && message.voiceDuration > 0) return message.voiceDuration;
    if (!message.content) return 3;
    const colonMatch = message.content.match(/0:(\d+)/);
    if (colonMatch && colonMatch[1]) return parseInt(colonMatch[1], 10) || 3;
    const quoteMatch = message.content.match(/(\d+)\s*["”'秒s]/);
    if (quoteMatch && quoteMatch[1]) return parseInt(quoteMatch[1], 10) || 3;
    const bracketMatch = message.content.match(/\[.*?(\d+).*?\]/);
    if (bracketMatch && bracketMatch[1]) return parseInt(bracketMatch[1], 10) || 3;
    return 3;
  };

  // Visitor perspective (Right aligned bubble, clean Crisp blue, no avatar, NO read tick marks)
  if (isMe) {
    if (isVoice) {
      return (
        <div className={`flex flex-col items-end ${showSenderInfo ? 'mb-2.5' : 'mb-1'}`}>
          <WeChatVoiceBubble
            duration={getVoiceDuration()}
            isMe={true}
            themeColor={themeColor}
            audioUrl={fileUrl}
          />
        </div>
      );
    }

    return (
      <>
      <div className={`flex flex-col items-end ${showSenderInfo ? 'mb-2.5' : 'mb-1'}`}>
        <div
          className="relative inline-block w-fit max-w-[85%] rounded-xl px-3.5 py-2.5 text-[13.5px] leading-relaxed text-white shadow-2xs wrap-break-word select-text"
          style={{ backgroundColor: themeColor }}
        >
          {/* Text content */}
          {message.msgType === 'text' && (
            <RichContentRenderer content={message.content} isMe={true} />
          )}

          {/* Video content */}
          {message.msgType === 'video' && (
            <div className="space-y-1 rounded-lg overflow-hidden bg-black/40 p-1">
              <video
                src={videoUrl || fileUrl}
                controls
                playsInline
                className="rounded-lg max-h-60 w-full object-contain"
              />
              {message.content && (
                <div className="flex items-center gap-1.5 px-1 py-0.5 text-xs text-white/90">
                  <Film className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{message.content}</span>
                  {message.videoDuration && (
                    <span className="text-[10px] text-white/75 shrink-0 ml-auto">{message.videoDuration}s</span>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Image content */}
          {message.msgType === 'image' && (
            <div className="space-y-1 cursor-pointer select-none" onMouseDown={openPreview}>
              <img
                src={fileUrl || 'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=600&auto=format&fit=crop&q=80'}
                alt={message.fileName || '图片'}
                draggable={false}
                className="rounded-xl max-h-60 object-cover pointer-events-none select-none hover:opacity-95 transition"
              />
              {message.content && message.content !== '[图片]' && (
                <p className="text-xs pt-1">{message.content}</p>
              )}
            </div>
          )}

          {/* File content */}
          {message.msgType === 'file' && (
            <div className="flex items-center gap-3 p-2.5 rounded-xl bg-white/15 border border-white/20">
              <div className="p-2 rounded-lg bg-white/20 text-white">
                {getFileIcon(message.fileName)}
              </div>
              <div className="flex-1 min-w-0 pr-2">
                <p className="text-xs font-medium truncate text-white">{message.fileName || '附件文件'}</p>
                <p className="text-[10px] text-white/80">{message.fileSize || '未知大小'}</p>
              </div>
              <a
                href={fileUrl || '#'}
                download={message.fileName}
                target="_blank"
                rel="noreferrer"
                className="p-1.5 rounded-lg hover:bg-white/20 text-white transition cursor-pointer"
                title="下载文件"
              >
                <Download className="w-3.5 h-3.5" />
              </a>
            </div>
          )}
        </div>
      </div>
      {previewOpen && previewUrl && (
        <div
          className="fixed inset-0 z-9999 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setPreviewOpen(false)}
        >
          <button
            type="button"
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/15 hover:bg-white/25 text-white flex items-center justify-center transition cursor-pointer"
            onClick={() => setPreviewOpen(false)}
            aria-label="关闭预览"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
          <img
            src={previewUrl}
            alt={message.fileName || '图片预览'}
            className="max-w-[92vw] max-h-[88vh] object-contain rounded-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
      </>
    );
  }

  // Other side (Agent or Bot, grey bubble with avatar and grey sender name on the left)
  const isBot =
    message.isBot ||
    message.senderName?.includes('机器人') ||
    message.senderId?.includes('bot');

  // 机器人头像兜底：企业主配置的 brand_avatar，未配置时用系统默认 AI 头像（企业开通即有，正常不会到这层）
  const botAvatarSrc = botAvatar || '/avatars/ai-default.png';

  return (
    <>
    <div className={`flex items-start gap-2.5 ${showSenderInfo ? 'mb-2.5 mt-2' : 'mb-1'}`}>
      {/* Left Avatar (Hidden if continuous message from same sender) */}
      <div className="w-7.5 shrink-0">
        {showSenderInfo ? (
          isBot ? (
            <img
              src={botAvatarSrc}
              alt="光年跃迁 机器人"
              className="w-7.5 h-7.5 rounded-full object-cover shadow-xs border border-blue-200/50"
            />
          ) : isAgentWorkbenchView && message.senderType === 'visitor' ? (
            // 坐席工作台里的访客气泡：首字头像（与侧栏/详情头部一致），真人照片仅用于坐席
            <div
              className={`w-7.5 h-7.5 rounded-full text-xs font-medium flex items-center justify-center shrink-0 select-none ${
                dark ? 'bg-slate-700 text-slate-300' : 'bg-slate-200 text-slate-600'
              }`}
            >
              {(message.senderName || '访').trim().charAt(0) || '访'}
            </div>
          ) : (
            <img
              src={defaultAgentPhoto}
              alt={message.senderName}
              className={`w-7.5 h-7.5 rounded-full object-cover shadow-xs ${dark ? 'border border-slate-700' : 'border border-slate-200'}`}
            />
          )
        ) : (
          <div className="w-7.5 h-1" />
        )}
      </div>

      <div className="flex-1 min-w-0 max-w-[85%] flex flex-col items-start">
        {/* Sender Name (Refined slate-500 light font matching reference image) */}
        {showSenderInfo && (
          <div className="flex items-center gap-1.5 mb-1 ml-0.5">
            <span className={`text-[12px] font-normal ${dark ? 'text-slate-400' : 'text-slate-500'}`}>
              {message.senderName}
            </span>
          </div>
        )}

        {/* Message Bubble */}
        {isVoice ? (
          <WeChatVoiceBubble duration={getVoiceDuration()} isMe={false} audioUrl={fileUrl} dark={dark} />
        ) : (
          <div
            className={`inline-block w-fit max-w-full rounded-xl px-3.5 py-2.5 text-[13.5px] leading-relaxed shadow-2xs wrap-break-word select-text ${
              dark ? 'bg-slate-800 text-slate-100' : 'bg-[#f1f3f5] text-[#1e293b]'
            }`}
          >
            {/* Text content with code block and markdown support */}
            {message.msgType === 'text' && (
              <RichContentRenderer content={message.content} isMe={false} dark={dark} />
            )}

            {/* Video content */}
            {message.msgType === 'video' && (
              <div className="space-y-1 rounded-lg overflow-hidden bg-black/90 p-1">
                <video
                  src={videoUrl || fileUrl}
                  controls
                  playsInline
                  className="rounded-lg max-h-60 w-full object-contain"
                />
                {message.content && (
                  <div className="flex items-center gap-1.5 px-1 py-0.5 text-xs text-slate-200">
                    <Film className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                    <span className="truncate">{message.content}</span>
                    {message.videoDuration && (
                      <span className="text-[10px] text-slate-400 shrink-0 ml-auto">{message.videoDuration}s</span>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Image content */}
            {message.msgType === 'image' && (
              <div className="space-y-1 cursor-pointer select-none" onMouseDown={openPreview}>
                <img
                  src={fileUrl || 'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=600&auto=format&fit=crop&q=80'}
                  alt={message.fileName || '图片'}
                  draggable={false}
                  className={`rounded-xl max-h-64 object-contain pointer-events-none select-none hover:opacity-95 transition ${
                    dark ? 'bg-slate-900 border border-slate-700' : 'bg-white border border-slate-200/80'
                  }`}
                />
                {message.content && message.content !== '[图片]' && (
                  <p className={`text-xs pt-1 ${dark ? 'text-slate-300' : 'text-slate-600'}`}>{message.content}</p>
                )}
              </div>
            )}

            {message.msgType === 'file' && (
              <div
                className={`flex items-center gap-3 p-2.5 rounded-xl border ${
                  dark ? 'bg-slate-900 border-slate-700' : 'bg-white border border-slate-200'
                }`}
              >
                <div className={`p-2 rounded-lg ${dark ? 'bg-slate-800' : 'bg-slate-100'}`}>
                  {getFileIcon(message.fileName)}
                </div>
                <div className="flex-1 min-w-0 pr-2">
                  <p className={`text-xs font-medium truncate ${dark ? 'text-slate-100' : 'text-slate-800'}`}>{message.fileName || '附件文件'}</p>
                  <p className="text-[10px] text-slate-400">{message.fileSize || '未知大小'}</p>
                </div>
                <a
                  href={fileUrl || '#'}
                  download={message.fileName}
                  target="_blank"
                  rel="noreferrer"
                  className={`p-1.5 rounded-lg transition cursor-pointer ${
                    dark ? 'hover:bg-slate-800 text-slate-300' : 'hover:bg-slate-100 text-slate-600'
                  }`}
                  title="下载文件"
                >
                  <Download className="w-3.5 h-3.5" />
                </a>
              </div>
            )}
          </div>
        )}

        {/* Action Buttons (e.g. [人工] button) */}
        {message.actions && message.actions.length > 0 && (
          <div className="w-full flex justify-end gap-2 mt-2">
            {message.actions.map((act, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => onActionClick?.(act.action, act.payload)}
                className="px-4 py-1.5 rounded-full text-white text-xs font-medium hover:opacity-90 active:scale-95 transition shadow-xs cursor-pointer tracking-wide"
                style={{ backgroundColor: themeColor }}
              >
                {act.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
    {previewOpen && previewUrl && (
      <div
        className="fixed inset-0 z-9999 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
        onClick={() => setPreviewOpen(false)}
      >
        <button
          type="button"
          className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/15 hover:bg-white/25 text-white flex items-center justify-center transition cursor-pointer"
          onClick={() => setPreviewOpen(false)}
          aria-label="关闭预览"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
        <img
          src={previewUrl}
          alt={message.fileName || '图片预览'}
          className="max-w-[92vw] max-h-[88vh] object-contain rounded-lg shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        />
      </div>
    )}
    </>
  );
};
```

---

