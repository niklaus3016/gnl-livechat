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
