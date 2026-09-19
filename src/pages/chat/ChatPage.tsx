import React, { useEffect, useRef, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import {
  getTenantConfig,
  initConversation,
  getVisitorMessages,
  sendVisitorMessage,
  uploadFile,
  markVisitorMessagesRead,
  getAgentList,
  submitPrechatForm,
  rateConversation,
} from '../../api';
import { IS_MOCK } from '../../api';
import { MockApiService } from '../../lib/mock/mock-api';
import { mockWsBus } from '../../lib/mock/mock-ws-bus';
import { INITIAL_MESSAGES } from '../../lib/mock/mock-data';
import { ChatMessage, Conversation, MessageType, TenantConfig, AgentUser, AgentStatus } from '../../types';
import { ChatHeader } from '../../components/chat/ChatHeader';
import { MessageBubble } from '../../components/chat/MessageBubble';
import { PreChatForm } from '../../components/chat/PreChatForm';
import { OfflineMessageForm } from '../../components/chat/OfflineMessageForm';
import { EmojiPicker } from '../../components/chat/EmojiPicker';
import { playNotificationSound } from '../../utils/audio';
import {
  Send,
  Paperclip,
  Smile,
  Sparkles,
  UploadCloud,
  Mic,
  RotateCcw,
  Info,
  Keyboard,
} from 'lucide-react';

// Visitor attachments: video is NOT allowed (agent workbench supports it).
// Whitelist for the file picker (videos appear greyed out) — audio included for voice-file uploads.
const VISITOR_FILE_ACCEPT = [
  'image/*',
  'audio/*',
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  '.txt', '.csv', '.md', '.json',
  '.zip', '.rar', '.7z',
].join(',');

// Runtime guard (covers drag-drop & paste where accept can't help).
// Some browsers report empty/odd mime types for e.g. .mkv, so check extensions too.
const VIDEO_FILE_EXT_RE = /\.(mp4|mov|avi|mkv|webm|flv|wmv|mpeg|mpg|m4v|3gp|ts)$/i;
const isVideoFile = (f: File) => f.type.startsWith('video/') || VIDEO_FILE_EXT_RE.test(f.name);

export const ChatPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const isEmbed = searchParams.get('embed') === '1';
  const tenantCodeParam = searchParams.get('tenant_code') || 'wgetcloud_live';

  // State
  const [tenantConfig, setTenantConfig] = useState<TenantConfig | null>(null);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [agents, setAgents] = useState<AgentUser[]>([]);
  // Agent presence (userId/nickname → status) fed by agent_updated events
  const [agentPresence, setAgentPresence] = useState<Record<string, AgentStatus>>({});
  const agentRefetchTimerRef = useRef<number | null>(null);

  // Polling fallback: agent_status relay can miss (unassigned conversations, relay
  // outages) — poll the agent list so profile/status eventually converge (30s).
  useEffect(() => {
    const timer = window.setInterval(() => {
      getAgentList()
        .then((list) => {
          if (list.length) setAgents(list);
        })
        .catch(() => {});
    }, 30000);
    return () => window.clearInterval(timer);
  }, []);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isAgentTyping, setIsAgentTyping] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [showPreChat, setShowPreChat] = useState(false);
  // Service rating (shown after conversation closed)
  const [ratingScore, setRatingScore] = useState<number | null>(null);
  const [ratingError, setRatingError] = useState('');
  // Default to active working hours state for demo presentation, can be toggled via header menu
  const [workStatusMode, setWorkStatusMode] = useState<'work' | 'offline' | 'auto'>('work');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isHomeView, setIsHomeView] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isInputFocused, setIsInputFocused] = useState(false);
  // 默认收起：配置加载完成前不闪现展开的窗口；未开启自动弹窗时配置回来后立即展开
  const [isMinimized, setIsMinimized] = useState(true);
  // 进线自动弹窗定时器（由租户配置 enable_auto_popup + 延迟秒数驱动）
  const autoPopupTimerRef = useRef<number | null>(null);

  // Voice recording state (Push-to-Talk like agent workbench)
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
  // Real mic recording (MediaRecorder) — the backend requires audio messages to carry a file
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  // Global window drop prevention so browser never navigates to dropped files
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
      mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const typingTimeoutRef = useRef<number | null>(null);
  const draftDebounceRef = useRef<number | null>(null);

  // Emoji handlers
  const handleSelectEmoji = (emoji: string) => {
    const textarea = textareaRef.current;
    if (textarea) {
      const currentVal = textarea.value;
      const start = typeof textarea.selectionStart === 'number' ? textarea.selectionStart : currentVal.length;
      const end = typeof textarea.selectionEnd === 'number' ? textarea.selectionEnd : currentVal.length;
      const newText = currentVal.substring(0, start) + emoji + currentVal.substring(end);
      const newCursorPos = start + emoji.length;

      setInputText(newText);
      textarea.value = newText;
      textarea.focus();
      textarea.setSelectionRange(newCursorPos, newCursorPos);

      // Ensure cursor remains placed right after the inserted emoji across render frames
      requestAnimationFrame(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
        }
      });
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
        }
      }, 20);

      if (conversation) {
        mockWsBus.send('draft', {
          conversationId: conversation.id,
          senderType: 'visitor',
          draft: newText,
        });
        mockWsBus.send('typing', {
          conversationId: conversation.id,
          senderType: 'visitor',
          isTyping: true,
          draft: newText,
        });
      }
    } else {
      setInputText((prev) => prev + emoji);
    }
  };

  const handleQuickSendEmoji = (emoji: string) => {
    handleSendMessage(emoji);
  };

  const handleToggleSound = () => {
    setSoundEnabled((prev) => {
      const next = !prev;
      if (next) {
        // Immediate audio feedback to confirm sound is active and unlock browser AudioContext
        playNotificationSound('prompt');
      }
      return next;
    });
  };

  const handleExportTranscript = (email: string) => {
    try {
      const headerInfo = `========================================\n` +
        `光年跃迁 在线客服会话记录导出\n` +
        `会话编号: ${conversation?.id || 'new'}\n` +
        `接收邮箱: ${email}\n` +
        `导出时间: ${new Date().toLocaleString()}\n` +
        `========================================\n\n`;

      const lines = messages
        .map((m) => `[${m.createdAt}] ${m.senderName} (${m.senderType === 'visitor' ? '访客' : '客服'}):\n${m.content}`)
        .join('\n\n');

      const blob = new Blob([headerInfo + lines], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `光年跃迁_Chat_Transcript_${new Date().toISOString().slice(0, 10)}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to export transcript:', err);
    }
  };

  // Check if current time is within working hours (Defaults to active working hours state)
  const isWithinWorkHours = (): boolean => {
    if (workStatusMode === 'offline') return false;
    if (workStatusMode === 'work') return true;

    if (!tenantConfig) return true;
    const { work_start_time, work_end_time } = tenantConfig;
    if (!work_start_time || !work_end_time || (work_start_time === '00:00' && (work_end_time === '23:59' || work_end_time === '24:00'))) {
      return true;
    }

    const now = new Date();
    const currentH = now.getHours();
    const currentM = now.getMinutes();
    const currentMinutes = currentH * 60 + currentM;

    const [startH, startM] = work_start_time.split(':').map(Number);
    const [endH, endM] = work_end_time.split(':').map(Number);

    const startMinutes = (startH || 0) * 60 + (startM || 0);
    const endMinutes = (endH !== undefined ? endH : 24) * 60 + (endM || 0);

    return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
  };

  const scrollToBottom = (smooth = true) => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTo({
        top: messagesContainerRef.current.scrollHeight,
        behavior: smooth ? 'smooth' : 'auto',
      });
    }
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
  };

  // Scroll on messages update or typing indicator
  useEffect(() => {
    scrollToBottom(false);
    const t1 = setTimeout(() => scrollToBottom(false), 60);
    const t2 = setTimeout(() => scrollToBottom(false), 250);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [messages, isAgentTyping]);

  // Listen to host window events (such as popup open)
  useEffect(() => {
    const handleHostMessage = (e: MessageEvent) => {
      if (e.data && (e.data.type === 'LIVECHAT_WIDGET_OPENED' || e.data.type === 'LIVECHAT_OPEN')) {
        setTimeout(() => scrollToBottom(false), 50);
        setTimeout(() => scrollToBottom(false), 200);
      }
    };
    window.addEventListener('message', handleHostMessage);
    return () => window.removeEventListener('message', handleHostMessage);
  }, []);

  // 卸载时清理自动弹窗定时器
  useEffect(() => {
    return () => {
      if (autoPopupTimerRef.current) window.clearTimeout(autoPopupTimerRef.current);
    };
  }, []);

  // 1. Initialize visitor session & fetch config
  const loadSession = async () => {
    try {
      setIsConnecting(true);
      const [config, agentList] = await Promise.all([
        getTenantConfig(tenantCodeParam),
        getAgentList().catch(() => [] as AgentUser[]),
      ]);
      setTenantConfig(config);
      setAgents(agentList);

      // 进线自动弹窗：企业主在外观定制页配置开关与延迟秒数。
      // 同一浏览器会话内访客手动关闭过则不再弹（sessionStorage 记忆）。
      if (config.enable_auto_popup) {
        const dismissKey = `lc_widget_dismissed_${tenantCodeParam}`;
        let dismissed = false;
        try {
          dismissed = sessionStorage.getItem(dismissKey) === 'true';
        } catch {
          dismissed = false;
        }
        if (!dismissed) {
          const delayMs = Math.max(1, Number(config.auto_popup_delay_sec) || 5) * 1000;
          if (isEmbed) {
            // iframe 嵌入时容器显隐由宿主页控制（widget.js），到点通知宿主弹窗
            autoPopupTimerRef.current = window.setTimeout(() => {
              try {
                window.parent?.postMessage({ type: 'LIVECHAT_AUTO_OPEN' }, '*');
              } catch {
                // ignore
              }
            }, delayMs);
          } else {
            // 独立页：保持收起为右下角头像，到点自动展开
            autoPopupTimerRef.current = window.setTimeout(() => setIsMinimized(false), delayMs);
          }
        }
      } else {
        // 未开启自动弹窗：配置就绪后直接展开
        if (!isEmbed) setIsMinimized(false);
      }

      const visitorToken = MockApiService.getVisitorToken();
      const prechatDone = localStorage.getItem(`prechat_done_${visitorToken}`);

      if (config.enable_prechat_form && !prechatDone) {
        setShowPreChat(true);
      }

      const conv = await initConversation(visitorToken, tenantCodeParam);
      if (conv.id === 'conv-1' || conv.assignedAgentName === '客服小雅') {
        conv.assignedAgentName = 'James';
      }
      setConversation(conv);
      // Seed presence from sessionInit's assigned_agent → correct status dot before
      // any live agent_status event arrives (backend relays online_status here).
      if (conv.assignedAgentStatus) {
        setAgentPresence((prev) => ({
          ...prev,
          ...(conv.assignedAgentId ? { [conv.assignedAgentId]: conv.assignedAgentStatus! } : {}),
          ...(conv.assignedAgentName
            ? { [conv.assignedAgentName]: conv.assignedAgentStatus! }
            : {}),
        }));
      }

      let history = await getVisitorMessages(conv.id);
      // Auto-sync reference screenshot messages if first message is not yet aligned to AI 助手 mock
      const isLatestMock = history.length > 0 && history[0].content?.includes('这是自动提示');
      if (conv.id === 'conv-1' && !isLatestMock) {
        history = INITIAL_MESSAGES['conv-1'];
        setMessages(history);
        try {
          const allStored = JSON.parse(localStorage.getItem('crisp_mock_messages') || '{}');
          allStored['conv-1'] = history;
          localStorage.setItem('crisp_mock_messages', JSON.stringify(allStored));
        } catch (e) {
          // ignore
        }
      } else {
        setMessages(history);
      }

      await markVisitorMessagesRead(conv.id);
    } catch (err) {
      console.error('Failed to initialize visitor chat:', err);
    } finally {
      setIsConnecting(false);
    }
  };

  useEffect(() => {
    loadSession();
  }, [tenantCodeParam]);

  // 2. WebSocket Bus Event Listeners
  useEffect(() => {
    if (!conversation) return;

    // Incoming messages
    const unbindMessage = mockWsBus.on('message', (msg: ChatMessage) => {
      if (msg.conversationId === conversation.id) {
        // Internal notes are strictly invisible to visitor
        if (msg.isInternalNote) return;

        setMessages((prev) => {
          if (prev.some((m) => m.id === msg.id)) return prev;
          return [...prev, msg];
        });

        if (msg.senderType === 'agent') {
          if (soundEnabled) playNotificationSound('message');
          markVisitorMessagesRead(conversation.id);
        }
      }
    });

    // Agent profile or status updated in real-time
    const unbindAgentUpdate = mockWsBus.on('agent_updated', (updatedAgent: AgentUser) => {
      setAgents((prev) =>
        prev.map((a) => (a.userId === updatedAgent.userId ? updatedAgent : a))
      );
      // Visitors usually can't fetch the agent list (auth-walled) — remember presence
      // keyed by both userId and nickname so the header dot matches the assigned agent.
      setAgentPresence((prev) => ({
        ...prev,
        ...(updatedAgent?.userId ? { [updatedAgent.userId]: updatedAgent.status } : {}),
        ...(updatedAgent?.nickname ? { [updatedAgent.nickname]: updatedAgent.status } : {}),
      }));
      // Cross-browser relays only carry userId/nickname/status — refetch the full
      // profile (title/bio/avatar) with a short debounce.
      if (agentRefetchTimerRef.current) clearTimeout(agentRefetchTimerRef.current);
      agentRefetchTimerRef.current = window.setTimeout(() => {
        getAgentList()
          .then((list) => {
            if (list.length) setAgents(list);
          })
          .catch(() => {});
      }, 1500);
    });

    // Agent typing status
    const unbindTyping = mockWsBus.on('typing', (payload) => {
      if (payload.conversationId === conversation.id && payload.senderType === 'agent') {
        if (typeof payload.draft === 'string') {
          // Draft-driven: indicator stays on as long as the agent's draft is non-empty.
          // The agent's heartbeat re-asserts it; the 6s staleness timer covers a dead
          // connection (agent closed the tab without blurring the input).
          // NOTE: draft content is never rendered — status only.
          if (payload.draft.trim()) {
            setIsAgentTyping(true);
            if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
            typingTimeoutRef.current = window.setTimeout(() => {
              setIsAgentTyping(false);
            }, 6000);
          } else {
            setIsAgentTyping(false);
            if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
          }
        } else {
          // Legacy typing-only events (no draft field): show for 3.5s
          setIsAgentTyping(payload.isTyping);
          if (payload.isTyping) {
            if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
            typingTimeoutRef.current = window.setTimeout(() => {
              setIsAgentTyping(false);
            }, 3500);
          }
        }
      }
    });

    // Conversation status update
    const unbindStatus = mockWsBus.on('conversation_status', (payload) => {
      if (payload.conversationId === conversation.id) {
        setConversation((prev) => (prev ? { ...prev, status: payload.status } : prev));
      }
    });

    // 全量会话更新（首条消息触发分配后，后端广播新的受理坐席/状态）
    const unbindConvUpdate = mockWsBus.on('conversation_updated', (payload: any) => {
      if (!payload || payload.id !== conversation.id) return;
      setConversation((prev) =>
        prev
          ? {
              ...prev,
              status: payload.status ?? prev.status,
              assignedAgentId: payload.assignedAgentId ?? prev.assignedAgentId,
              assignedAgentName: payload.assignedAgentName ?? prev.assignedAgentName,
              assignedAgentStatus: payload.assignedAgentStatus ?? prev.assignedAgentStatus,
            }
          : prev,
      );
    });

    // Conversation cleared (reset)
    const unbindCleared = mockWsBus.on('conversation_cleared', (payload) => {
      if (payload.conversationId === conversation.id) {
        setMessages([]);
      }
    });

    // Reconnecting / Connect states
    const unbindReconnecting = mockWsBus.on('reconnecting', () => {
      setIsConnecting(true);
    });
    const unbindConnect = mockWsBus.on('connect', () => {
      setIsConnecting(false);
    });

    return () => {
      unbindMessage();
      unbindAgentUpdate();
      unbindTyping();
      unbindStatus();
      unbindConvUpdate();
      unbindCleared();
      unbindReconnecting();
      unbindConnect();
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      if (agentRefetchTimerRef.current) clearTimeout(agentRefetchTimerRef.current);
    };
  }, [conversation?.id, soundEnabled]);

  // 3. Handle Input Change and Dispatch Draft / Typing Event
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setInputText(val);

    if (!conversation) return;

    // Dispatch visitor draft event (Real-time agent insight)
    mockWsBus.send('draft', {
      conversationId: conversation.id,
      senderType: 'visitor',
      draft: val,
    });

    // Dispatch typing event with debounce (draft rides along → backend relays to agent cross-browser)
    mockWsBus.send('typing', {
      conversationId: conversation.id,
      senderType: 'visitor',
      isTyping: val.trim().length > 0,
      draft: val,
    });

    if (draftDebounceRef.current) clearTimeout(draftDebounceRef.current);
    draftDebounceRef.current = window.setTimeout(() => {
      mockWsBus.send('typing', {
        conversationId: conversation.id,
        senderType: 'visitor',
        isTyping: false,
      });
    }, 2000);
  };

  // Submit service rating (backend: POST /widget/session/rate)
  const handleRateConversation = async (score: number) => {
    if (!conversation) return;
    setRatingScore(score);
    setRatingError('');
    try {
      await rateConversation({
        visitorToken: conversation.visitorToken,
        tenantCode: tenantCodeParam,
        conversationId: conversation.id,
        score,
      });
    } catch (e: any) {
      setRatingError(e?.message || '评价提交失败，请稍后重试');
      setRatingScore(null);
    }
  };

  // 4. Send Message
  const handleSendMessage = async (
    textToSend?: string,
    msgType: MessageType = 'text',
    voiceDuration?: number
  ) => {
    const content = (textToSend !== undefined ? textToSend : inputText).trim();
    if (!content || !conversation) return;

    setInputText('');
    if (textareaRef.current) {
      textareaRef.current.value = '';
    }
    setShowEmojiPicker(false);

    // Clear draft and typing on the bus immediately
    mockWsBus.send('draft', {
      conversationId: conversation.id,
      senderType: 'visitor',
      draft: '',
    });
    mockWsBus.send('typing', {
      conversationId: conversation.id,
      senderType: 'visitor',
      isTyping: false,
      draft: '',
    });

    try {
      await sendVisitorMessage(conversation.id, {
        senderId: conversation.visitorToken,
        senderName: conversation.visitorName,
        content,
        msgType,
        voiceDuration,
      });

      // Do NOT optimistic-append here. The backend echoes the message back via
      // socket 'new_message' → mockWsBus dispatch → listener setMessages,
      // which adds the very same id. Appending both causes a double-insert
      // (React batches both functional updates on the same prev, bypassing
      // the exists check). If socket is down the error path will fire.
    } catch (err) {
      console.error('Send message failed:', err);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Prevent sending when user is in the middle of Chinese/IME Pinyin composition
    if (e.nativeEvent.isComposing || e.keyCode === 229) {
      return;
    }

    // Direct Enter key sends message; Shift + Enter creates a new line
    if (e.key === 'Enter') {
      if (e.shiftKey) {
        // Allow Shift + Enter to add newline
        return;
      }
      e.preventDefault();
      handleSendMessage();
    }
  };

  // 5. Action Click (e.g. Human handoff from bot pill)
  const handleActionClick = async (action: string) => {
    if (action === 'transfer_human') {
      await handleSendMessage('转接人工客服');
      if (IS_MOCK) {
        // Simulate James receiving and responding (mock-only demo behavior)
        setTimeout(() => {
          setIsAgentTyping(true);
          setTimeout(async () => {
            setIsAgentTyping(false);
            if (conversation) {
              const reply = await MockApiService.sendMessage(conversation.id, {
                senderType: 'agent',
                senderId: 'agent_1',
                senderName: 'James',
                content: '您好！人工客服 James 已为您接入，请问有什么可以协助您？',
                msgType: 'text',
              });
              mockWsBus.send('message', reply);
            }
          }, 1200);
        }, 500);
      }
    }
  };

  // 6. File & Image Upload Core
  const processVisitorFile = async (file: File) => {
    if (!conversation) return;
    if (isVideoFile(file)) {
      alert('暂不支持发送视频文件，请上传文档、图片或压缩包');
      return;
    }
    const isImg = file.type.startsWith('image/');

    try {
      setIsUploading(true);
      console.log('[file] uploading', file.name, file.type, file.size);
      const res = await uploadFile(file);
      console.log('[file] uploaded →', res);

      console.log('[file] sending message...');
      const newMsg = await sendVisitorMessage(conversation.id, {
        senderId: conversation.visitorToken,
        senderName: conversation.visitorName,
        content: isImg ? '[图片]' : `[文件] ${res.name}`,
        msgType: isImg ? 'image' : 'file',
        fileUrl: res.url,
        fileName: res.name,
        fileSize: res.size,
        fileSizeBytes: res.sizeBytes,
      });
      console.log('[file] message sent →', newMsg.id);
      // Do NOT optimistic-append here — same pattern as handleSendMessage.
      // The backend echoes the message back via socket 'new_message' → mockWsBus dispatch → listener setMessages.
      // Appending both causes a double-insert. If socket is down the error path will fire.
    } catch (err: any) {
      console.error('File upload failed:', err);
      alert('文件发送失败: ' + (err?.message || JSON.stringify(err).slice(0, 120)));
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, _isImg = false) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processVisitorFile(file);
    if (e.target) e.target.value = '';
  };

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
    if (!isDraggingOver) setIsDraggingOver(true);
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

    if (conversation?.status === 'closed') return;

    const files = Array.from(e.dataTransfer.files || []) as File[];
    for (const file of files) {
      await processVisitorFile(file);
    }
  };

  const handlePaste = async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    if (conversation?.status === 'closed') return;
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.kind === 'file' && item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          e.preventDefault();
          await processVisitorFile(file);
        }
      }
    }
  };

  // 6. Visitor Push-to-Talk Voice Logic (Matching Agent Workbench)
  const showVoiceToast = (msg: string) => {
    setVoiceToast(msg);
    if (voiceToastTimerRef.current) clearTimeout(voiceToastTimerRef.current);
    voiceToastTimerRef.current = window.setTimeout(() => {
      setVoiceToast(null);
    }, 1600);
  };

  const handleStartVoiceRecording = (e: React.MouseEvent | React.TouchEvent) => {
    if (conversation?.status === 'closed' || !conversation) return;
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

    // Start real mic recording — uploaded as an audio attachment on release
    // (the backend rejects audio messages without payload.file_url, so a real file is mandatory)
    if (navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== 'undefined') {
      navigator.mediaDevices
        .getUserMedia({ audio: true })
        .then((stream) => {
          mediaStreamRef.current = stream;
          audioChunksRef.current = [];
          const recorder = new MediaRecorder(stream);
          recorder.ondataavailable = (ev) => {
            if (ev.data.size > 0) audioChunksRef.current.push(ev.data);
          };
          recorder.start();
          mediaRecorderRef.current = recorder;
        })
        .catch(() => {
          // Permission denied or no mic available → abort the whole recording flow
          if (voiceRecordingTimerRef.current) {
            clearInterval(voiceRecordingTimerRef.current);
            voiceRecordingTimerRef.current = null;
          }
          mediaRecorderRef.current = null;
          audioChunksRef.current = [];
          setIsVoiceRecording(false);
          setIsVoiceCancelWarning(false);
          isVoiceCancelWarningRef.current = false;
          showVoiceToast('无法访问麦克风，请检查浏览器权限');
        });
    } else {
      // Environment without mic support (e.g. insecure context)
      if (voiceRecordingTimerRef.current) {
        clearInterval(voiceRecordingTimerRef.current);
        voiceRecordingTimerRef.current = null;
      }
      setIsVoiceRecording(false);
      showVoiceToast('当前环境不支持录音');
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
    if (!isVoiceRecording) return;

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

    // Tear down the mic stream immediately; the recorder may still need one final onstop flush
    const recorder = mediaRecorderRef.current;
    mediaRecorderRef.current = null;
    mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
    mediaStreamRef.current = null;

    const discardRecording = () => {
      if (recorder && recorder.state !== 'inactive') recorder.stop();
      audioChunksRef.current = [];
    };

    if (cancelled) {
      discardRecording();
      showVoiceToast('已取消发送');
      return;
    }

    if (elapsedMs < 800) {
      discardRecording();
      showVoiceToast('说话时间太短');
      return;
    }

    if (!conversation) {
      discardRecording();
      return;
    }

    // Wait for MediaRecorder to flush the final chunk
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
      setIsUploading(true);
      const ext = blob.type.includes('mp4') ? 'm4a' : blob.type.includes('ogg') ? 'ogg' : 'webm';
      const file = new File([blob], `voice-${Date.now()}.${ext}`, {
        type: blob.type || 'audio/webm',
      });
      const res = await uploadFile(file, { type: 'audio', durationSeconds: duration });
      await sendVisitorMessage(conversation.id, {
        senderId: conversation.visitorToken,
        senderName: conversation.visitorName,
        content: `[语音消息 ${duration}"]`,
        msgType: 'voice',
        fileUrl: res.url,
        fileName: res.name,
        fileSize: res.size,
        fileSizeBytes: res.sizeBytes,
        voiceDuration: duration,
      });
      // Same as text/file sends: the backend echoes the message back via socket 'new_message'
    } catch (err: any) {
      console.error('Voice send failed:', err);
      alert('语音发送失败: ' + (err?.message || '请稍后重试'));
    } finally {
      setIsUploading(false);
    }
  };

  // 7. Pre-chat submit
  const handlePreChatSubmit = async (data: { name: string; email: string; inquiry: string }) => {
    const token = MockApiService.getVisitorToken();
    localStorage.setItem(`prechat_done_${token}`, 'true');
    setShowPreChat(false);

    const conv = await initConversation(token, tenantCodeParam, {
      name: data.name,
      email: data.email,
    });
    setConversation(conv);

    if (data.inquiry) {
      // Real backend: prechat note becomes a system message inside the conversation
      if (!IS_MOCK) {
        await submitPrechatForm({
          visitorToken: token,
          tenantCode: tenantCodeParam,
          name: data.name,
          email: data.email,
          note: data.inquiry,
        }).catch((e) => console.warn('prechat submit failed:', e));
      }
      await sendVisitorMessage(conv.id, {
        senderId: token,
        senderName: data.name,
        content: data.inquiry,
        msgType: 'text',
      });
      const updated = await getVisitorMessages(conv.id);
      setMessages(updated);
    }
  };

  const themeColor = tenantConfig?.theme_color || '#1972f5';
  const isWorking = isWithinWorkHours();

  // Core Chat Window JSX (reusable in standalone or embed)
  // 迎宾阶段快捷引导：访客未发任何消息前展示，点击即作为首条消息发送（同时触发坐席分配）
  const showGuideOptions =
    !showPreChat &&
    !!tenantConfig?.enable_guide_options &&
    (tenantConfig?.guide_options?.length ?? 0) > 0 &&
    !messages.some((m) => m.senderType === 'visitor');

  const renderChatWidget = () => {
    // Message list deduplication guarantee
    const uniqueMessages = messages.filter((msg, index, self) =>
      index === self.findIndex((m) => m.id === msg.id)
    );

    const assignedAgent = agents.find(
      (a) => a.userId === conversation?.assignedAgentId || a.nickname === conversation?.assignedAgentName
    );

    // Typing/header display name: prefer the sender name from the agent's latest
    // message in this thread (works even when the agent-list/conversation match
    // fails, e.g. real backend without assignedAgentName), then fall back.
    const lastAgentSenderName = [...messages]
      .reverse()
      .find((m) => m.senderType === 'agent')?.senderName;
    const agentDisplayName =
      assignedAgent?.nickname ||
      conversation?.assignedAgentName ||
      lastAgentSenderName ||
      '客服';

    // Presence: live agent_updated events win, then the sessionInit seed / agent
    // list, else default (green).
    const agentStatus: AgentStatus | undefined =
      (conversation?.assignedAgentId
        ? agentPresence[conversation.assignedAgentId]
        : undefined) ||
      (conversation?.assignedAgentName
        ? agentPresence[conversation.assignedAgentName]
        : undefined) ||
      assignedAgent?.status ||
      conversation?.assignedAgentStatus;

    // pre_chat 迎宾阶段（访客未发首条消息，坐席尚未分配）：头部展示 AI 助手
    const isPreChat = conversation?.status === 'pre_chat' && !conversation?.assignedAgentId;
    // 已进线但暂无坐席受理（排队中）
    const isQueuedUnassigned =
      !isPreChat && conversation?.status === 'queued' && !conversation?.assignedAgentId;
    const headerName = isPreChat ? 'AI 助手' : isQueuedUnassigned ? '人工客服' : agentDisplayName;
    const headerTitle = isPreChat
      ? '智能在线客服'
      : isQueuedUnassigned
        ? '正在为你接入客服…'
        : assignedAgent?.title || '在线技术支持';
    const headerStatus: AgentStatus | undefined = isPreChat
      ? 'online'
      : isQueuedUnassigned
        ? 'away'
        : agentStatus;
    const headerAvatar = isPreChat
      ? tenantConfig?.default_avatar ||
        `data:image/svg+xml;utf8,${encodeURIComponent(
          '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="48" fill="#2563eb"/><path d="M28 48 C28 32, 44 26, 50 38 L54 62 C60 74, 74 68, 74 52 C74 38, 66 32, 58 35" stroke="white" stroke-width="10" stroke-linecap="round" fill="none"/></svg>',
        )}`
      : assignedAgent?.avatar || '/avatars/agent-female.png';

    return (
      <div
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className="w-full h-full flex flex-col bg-white rounded-3xl overflow-hidden relative font-sans"
      >
        {/* Drag & Drop Visual Overlay */}
        {isDraggingOver && (
          <div className="absolute inset-0 z-50 bg-blue-600/10 border-2 border-dashed border-blue-500 rounded-3xl flex flex-col items-center justify-center gap-2 backdrop-blur-[2px] transition pointer-events-none">
            <div className="w-12 h-12 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md animate-bounce">
              <UploadCloud className="w-6 h-6" />
            </div>
            <p className="text-xs font-bold text-blue-700">松开鼠标即可发送图片或附件</p>
          </div>
        )}

        {/* Crisp-Style Replicated Header */}
        <ChatHeader
          tenantName={tenantConfig?.tenant_name || '光年跃迁'}
          themeColor={themeColor}
          agentName={headerName}
          agentAvatar={headerAvatar}
          agentStatus={headerStatus}
          agentTitle={headerTitle}
          agentBio={assignedAgent?.bio || `欢迎咨询 ${tenantConfig?.tenant_name || '光年跃迁'}，我们将竭诚为您解答产品、计费与系统对接相关疑问。`}
          isConnecting={isConnecting}
          isEmbed={isEmbed}
          onClose={() => {
            setIsMinimized(true);
            // 访客手动关闭：本会话内不再自动弹；iframe 嵌入时通知宿主页收起容器
            try {
              sessionStorage.setItem(`lc_widget_dismissed_${tenantCodeParam}`, 'true');
            } catch {
              // ignore
            }
            if (isEmbed) {
              try {
                window.parent?.postMessage({ type: 'LIVECHAT_MINIMIZE' }, '*');
              } catch {
                // ignore
              }
            }
          }}
          isSoundEnabled={soundEnabled}
          onToggleSound={handleToggleSound}
          onExportTranscript={handleExportTranscript}
          isWorkingHours={isWorking}
          onToggleWorkHours={() => setWorkStatusMode((prev) => (prev === 'work' ? 'offline' : 'work'))}
        />

        {/* Main Message Stream */}
        <div
          ref={messagesContainerRef}
          className="flex-1 min-h-0 overflow-y-auto p-3.5 space-y-1 bg-white select-text crisp-scrollbar"
        >
          {showPreChat ? (
            <div className="h-full flex items-center justify-center p-2">
              <PreChatForm themeColor={themeColor} onSubmit={handlePreChatSubmit} />
            </div>
          ) : (
            <>
              {/* Render Messages with Continuous Grouping (1:1 with Reference Screenshot) */}
              {uniqueMessages.map((msg, index) => {
                const prevMsg = index > 0 ? uniqueMessages[index - 1] : null;
                const isContinuous =
                  prevMsg &&
                  prevMsg.senderType === msg.senderType &&
                  prevMsg.senderName === msg.senderName;
                const showSenderInfo = !isContinuous;

                return (
                  <MessageBubble
                    key={msg.id}
                    message={
                      msg.senderType === 'agent'
                        ? { ...msg, senderName: agentDisplayName }
                        : msg
                    }
                    themeColor={themeColor}
                    agentAvatar={assignedAgent?.avatar || '/avatars/agent-female.png'}
                    botAvatar={tenantConfig?.default_avatar}
                    isAgentWorkbenchView={false}
                    showSenderInfo={showSenderInfo}
                    onActionClick={handleActionClick}
                  />
                );
              })}

              {/* 迎宾快捷引导选项：紧跟欢迎语气泡之后，仅在访客发首条消息前展示，点击直接发送（首条消息触发坐席分配） */}
              {showGuideOptions && (
                <div className="flex flex-wrap gap-1.5 pt-1 pb-2 pl-[40px] pr-3.5">
                  {tenantConfig!.guide_options.map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => handleSendMessage(opt)}
                      className="text-[11px] px-2.5 py-1 rounded-full bg-white border border-slate-200 text-slate-600 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 transition shadow-2xs cursor-pointer select-none"
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              )}

              {/* Agent Typing Indicator */}
              {isAgentTyping && (
                <div className="flex items-center gap-2 text-slate-400 text-xs py-1.5 px-3">
                  <div className="flex gap-1 items-center">
                    <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" />
                    <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce [animation-delay:0.2s]" />
                    <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce [animation-delay:0.4s]" />
                  </div>
                  <span>{agentDisplayName} 正在输入...</span>
                </div>
              )}

              {conversation?.status === 'closed' && (
                <div className="flex flex-col items-center my-3 gap-2.5">
                  <span className="text-xs bg-slate-100 text-slate-500 px-3 py-1 rounded-full font-medium border border-slate-200">
                    当前会话已结束
                  </span>
                  {/* Service rating (backend: POST /widget/session/rate) */}
                  {ratingScore === null ? (
                    <div className="flex items-center gap-2 text-xs text-slate-500 bg-white border border-slate-200 rounded-full px-3.5 py-1.5 shadow-xs">
                      <span>请为本次服务评分</span>
                      {[1, 2, 3, 4, 5].map((n) => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => handleRateConversation(n)}
                          className="text-amber-400 hover:text-amber-500 hover:scale-110 transition cursor-pointer"
                          title={`${n} 星`}
                        >
                          ★
                        </button>
                      ))}
                    </div>
                  ) : (
                    <span className="text-xs text-emerald-600 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full font-medium">
                      感谢您的评价 ({ratingScore} 星)
                    </span>
                  )}
                  {ratingError && <span className="text-[11px] text-red-500">{ratingError}</span>}
                </div>
              )}

              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Bottom Area: Crisp-style Floating Card Input Box with Precise Margins and Curves */}
        {!showPreChat && (
          <div className="p-3 pt-1 pb-3 bg-white relative rounded-b-3xl shrink-0 border-t border-slate-50 z-10">
            {!isWorking ? (
              <OfflineMessageForm
                themeColor={themeColor}
                tenantCode={tenantConfig?.tenant_code || 'wgetcloud_live'}
                visitorToken={conversation?.visitorToken || 'vis_temp'}
                workStartTime={tenantConfig?.work_start_time || '08:00'}
                workEndTime={tenantConfig?.work_end_time || '23:30'}
              />
            ) : (
              <div className="relative">
                {/* Expanded Multi-Category Emoji Picker */}
                {showEmojiPicker && (
                  <EmojiPicker
                    onSelectEmoji={handleSelectEmoji}
                    onQuickSendEmoji={handleQuickSendEmoji}
                    onClose={() => setShowEmojiPicker(false)}
                  />
                )}

              {/* Hidden File Input (video excluded via accept whitelist) */}
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept={VISITOR_FILE_ACCEPT}
                onChange={(e) => handleFileUpload(e, false)}
              />

              {/* Crisp Replicated Input Container:
                  - Unfocused: clean light grey border (border-[#dce2ec]), subtle flat shadow
                  - Focused / Ready to type: saturated Crisp-blue border (border-[#1972f5]) + outer halo glow shadow
                  - Generous 22px rounded corners
              */}
              <div
                onClick={() => !isVoiceMode && textareaRef.current?.focus()}
                className="border-[1.8px] rounded-[22px] bg-white px-3.5 pt-2.5 pb-2 transition-all duration-200 ease-out cursor-text"
                style={
                  isVoiceMode
                    ? {
                        borderColor: themeColor,
                        backgroundColor: 'rgba(239, 246, 255, 0.2)',
                        boxShadow: `0 0 0 3.5px ${themeColor}22`,
                      }
                    : isInputFocused || showEmojiPicker
                    ? {
                        borderColor: themeColor,
                        boxShadow: `0 0 0 3.5px ${themeColor}26, 0 2px 8px ${themeColor}12`,
                      }
                    : {
                        borderColor: '#dce2ec',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                      }
                }
              >
                {/* Voice Mode Push-To-Talk Button */}
                {isVoiceMode ? (
                  <div className="py-1 select-none">
                    <button
                      type="button"
                      onMouseDown={handleStartVoiceRecording}
                      onMouseUp={handleStopVoiceRecording}
                      onTouchStart={handleStartVoiceRecording}
                      onTouchEnd={handleStopVoiceRecording}
                      onTouchMove={handleVoiceTouchMove}
                      onMouseMove={handleVoiceMouseMove}
                      onMouseLeave={handleVoiceMouseLeave}
                      disabled={conversation?.status === 'closed'}
                      className={`w-full h-11 rounded-xl flex items-center justify-center gap-2 font-semibold text-xs tracking-wide transition-all shadow-2xs select-none cursor-pointer ${
                        isVoiceRecording
                          ? isVoiceCancelWarning
                            ? 'bg-red-50 text-red-600 border-2 border-red-500 scale-[0.98]'
                            : 'bg-blue-50 text-blue-700 border-2 border-blue-500 scale-[0.98] ring-4 ring-blue-500/15'
                          : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 hover:border-slate-300 active:bg-slate-200'
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
                    <div className="flex items-center justify-between mt-1 px-1 text-[10.5px] text-slate-400">
                      <span>按住说话，松开发送</span>
                      <button
                        type="button"
                        onClick={() => setIsVoiceMode(false)}
                        className="text-blue-600 hover:underline cursor-pointer font-medium"
                      >
                        切回键盘
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Textarea with exact Crisp placeholder */
                  <textarea
                    ref={textareaRef}
                    rows={2}
                    disabled={conversation?.status === 'closed'}
                    value={inputText}
                    onChange={handleInputChange}
                    onFocus={() => setIsInputFocused(true)}
                    onBlur={() => setIsInputFocused(false)}
                    onKeyDown={handleKeyDown}
                    onPaste={handlePaste}
                    placeholder="输入你的信息..."
                    className="w-full text-[13.5px] text-slate-800 placeholder-[#94a3b8] bg-transparent border-none outline-hidden resize-none leading-relaxed min-h-9.5 max-h-24 caret-slate-900"
                  />
                )}

                {/* Bottom Tools inside input container (1:1 icons: Smile, Paperclip, Waveform/Keyboard, Send) */}
                <div className="flex items-center justify-between mt-1 text-slate-500">
                  {/* Left Action Icons: Smile, Paperclip, Audio Waveform / Keyboard Toggle */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowEmojiPicker((prev) => !prev)}
                      disabled={conversation?.status === 'closed' || isVoiceMode}
                      className="p-1 rounded-md hover:text-slate-800 transition cursor-pointer disabled:opacity-40"
                      title="插入表情"
                    >
                      <Smile className="w-4 h-4 text-[#64748b] hover:text-slate-800 transition-colors" />
                    </button>

                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploading || conversation?.status === 'closed'}
                      className="p-1 rounded-md hover:text-slate-800 transition cursor-pointer disabled:opacity-40"
                      title="添加附件或图片"
                    >
                      <Paperclip className="w-4 h-4 text-[#64748b] hover:text-slate-800 transition-colors rotate-45" />
                    </button>

                    {/* Voice Mode Toggle: Crisp Waveform Icon (active: switches to keyboard icon or highlighted waveform) */}
                    <button
                      type="button"
                      onClick={() => {
                        setIsVoiceMode((prev) => !prev);
                        setShowEmojiPicker(false);
                      }}
                      disabled={conversation?.status === 'closed'}
                      className={`p-1 rounded-md transition cursor-pointer ${
                        isVoiceMode
                          ? 'text-blue-600 bg-blue-50 ring-1 ring-blue-200'
                          : 'text-[#64748b] hover:text-slate-800'
                      }`}
                      title={isVoiceMode ? '切换为键盘输入' : '切换为语音模式 (按住说话)'}
                    >
                      {isVoiceMode ? (
                        <Keyboard className="w-4 h-4 text-blue-600" />
                      ) : (
                        <svg viewBox="0 0 20 20" width="16" height="16" fill="currentColor">
                          <rect x="2.5" y="6" width="2" height="8" rx="1" />
                          <rect x="7" y="3" width="2" height="14" rx="1" />
                          <rect x="11.5" y="5" width="2" height="10" rx="1" />
                          <rect x="16" y="8" width="2" height="4" rx="1" />
                        </svg>
                      )}
                    </button>

                    {isUploading && (
                      <span className="text-[11px] text-blue-600 animate-pulse ml-1 font-medium">
                        正在上传...
                      </span>
                    )}
                  </div>

                  {/* Right Send Paper Plane Icon (Clean Crisp paper airplane tilted right) */}
                  <button
                    type="button"
                    onClick={() => handleSendMessage()}
                    disabled={!inputText.trim() || conversation?.status === 'closed' || isVoiceMode}
                    className={`p-1.5 transition select-none ${
                      inputText.trim() && !isVoiceMode
                        ? 'hover:opacity-80 active:scale-95 cursor-pointer'
                        : 'text-[#94a3b8] cursor-default'
                    }`}
                    style={inputText.trim() && !isVoiceMode ? { color: themeColor } : undefined}
                    title="发送信息 (Enter)"
                  >
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                      <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
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

      {/* Voice Toast Prompt */}
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

  // If embedded in iframe (e.g. ?embed=1), fill the iframe container with zero exterior overflow
  if (isEmbed) {
    return (
      <div className="w-full h-screen max-h-screen overflow-hidden flex flex-col bg-white rounded-3xl">
        {renderChatWidget()}
      </div>
    );
  }

  // If accessed directly via /chat, show the crisp widget floating on a simulated clean web canvas
  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 flex flex-col items-center justify-center p-3 sm:p-6 select-none relative overflow-hidden">
      {/* Floating Crisp Widget Card or Minimized Placeholder */}
      {isMinimized ? (
        <div className="flex flex-col items-center justify-center text-center p-8 max-w-md bg-white rounded-2xl shadow-sm border border-slate-200">
          <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mb-3">
            <Sparkles className="w-6 h-6" />
          </div>
          <h3 className="font-semibold text-slate-800 text-base mb-1">对话窗口已最小化</h3>
          <p className="text-xs text-slate-500 mb-4">
            已收起至右下角客服头像处。点击右下角 James 头像随时展开。
          </p>
          <button
            type="button"
            onClick={() => setIsMinimized(false)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-xl transition shadow-sm cursor-pointer"
          >
            展开对话窗口
          </button>
        </div>
      ) : (
        <div className="w-full max-w-96.25 h-165 max-h-[94vh] rounded-3xl shadow-[0_16px_50px_rgba(0,0,0,0.18),0_4px_16px_rgba(0,0,0,0.06)] border border-black/6 overflow-hidden bg-white flex flex-col relative">
          {renderChatWidget()}
        </div>
      )}

      {/* Persistent Bottom-Right Avatar Launcher when minimized */}
      {isMinimized && (
        <button
          type="button"
          onClick={() => setIsMinimized(false)}
          className="fixed bottom-6 right-6 w-14 h-14 rounded-full bg-white border-2 border-white shadow-[0_8px_24px_rgba(0,0,0,0.18),0_2px_8px_rgba(0,0,0,0.08)] cursor-pointer hover:scale-105 active:scale-95 transition-all z-50 flex items-center justify-center group"
          title="展开客服聊天"
        >
          <img
            src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80"
            alt="James"
            className="w-full h-full rounded-full object-cover"
          />
          <span className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full bg-[#00c853] border-2 border-white shadow-xs" />
          <span className="absolute right-16 px-2.5 py-1 rounded-lg bg-slate-900 text-white text-xs font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition shadow-lg pointer-events-none">
            与 James 在线咨询
          </span>
        </button>
      )}
    </div>
  );
};
