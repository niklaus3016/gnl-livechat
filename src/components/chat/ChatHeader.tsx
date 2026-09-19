import React, { useState } from 'react';
import {
  Home,
  MessageSquare,
  MoreVertical,
  ChevronDown,
  Minus,
  X,
  Volume2,
  VolumeX,
  CheckCircle2,
  Mail,
  Send,
} from 'lucide-react';

interface ChatHeaderProps {
  tenantName: string;
  themeColor: string;
  agentName?: string;
  agentAvatar?: string;
  agentTitle?: string;
  agentBio?: string;
  /** Assigned agent's presence: online → green dot, away → amber, offline → grey */
  agentStatus?: 'online' | 'away' | 'offline';
  isConnecting?: boolean;
  isEmbed?: boolean;
  isHomeView?: boolean;
  onToggleHome?: () => void;
  onClose?: () => void;
  isSoundEnabled?: boolean;
  onToggleSound?: () => void;
  onExportTranscript?: (email: string) => void;
  isWorkingHours?: boolean;
}

export const ChatHeader: React.FC<ChatHeaderProps> = ({
  tenantName = '光年跃迁',
  themeColor = '#1972f5',
  agentName = 'James',
  agentAvatar,
  agentTitle,
  agentBio,
  agentStatus,
  isConnecting = false,
  isEmbed = false,
  isHomeView = false,
  onToggleHome,
  onClose,
  isSoundEnabled = true,
  onToggleSound,
  onExportTranscript,
  isWorkingHours = true,
}) => {
  const [showMenu, setShowMenu] = useState(false);
  const [showAgentInfo, setShowAgentInfo] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [emailSentSuccess, setEmailSentSuccess] = useState(false);

  const defaultAvatar = agentAvatar || '/avatars/agent-female.png';

  const handleSendTranscript = (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput.trim()) return;
    if (onExportTranscript) {
      onExportTranscript(emailInput.trim());
    }
    setEmailSentSuccess(true);
    setTimeout(() => {
      setEmailSentSuccess(false);
      setShowEmailModal(false);
      setEmailInput('');
    }, 1800);
  };

  return (
    <div
      className="text-white relative select-none transition-colors z-20 rounded-t-[24px] shrink-0"
      style={{ backgroundColor: themeColor }}
    >
      {/* Top Row: [Minimize] ... [立体 聊天 Pill] ... [More Options ⋮] */}
      <div className="px-3.5 pt-3 pb-2 flex items-center justify-between">
        {/* Left: Minimize button (moved to home position) */}
        <button
          type="button"
          onClick={() => {
            if (onClose) onClose();
            if (window.parent && window.parent !== window) {
              window.parent.postMessage({ type: 'LIVECHAT_CLOSE' }, '*');
              window.parent.postMessage({ type: 'LIVECHAT_MINIMIZE' }, '*');
            }
          }}
          className="w-8 h-8 rounded-full hover:bg-white/15 flex items-center justify-center text-white transition-all cursor-pointer active:scale-95"
          title="最小化窗口"
        >
          <Minus className="w-4 h-4 stroke-[2.5]" />
        </button>

        {/* Center: Replicated Deep Oval Track with 3D Tactile "聊天" Pill Button (Dynamically adapts to themeColor) */}
        <div
          className="shadow-[inset_0_1.5px_3px_rgba(0,0,0,0.32)] p-0.5 rounded-full flex items-center transition-colors"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.22)' }}
        >
          <div
            className="px-4 py-1 rounded-full text-xs font-semibold text-white flex items-center gap-1.5 cursor-default transition select-none"
            style={{
              background: `linear-gradient(180deg, rgba(255, 255, 255, 0.32) 0%, rgba(255, 255, 255, 0.05) 52%, rgba(0, 0, 0, 0.22) 100%), ${themeColor}`,
              boxShadow:
                '0 2.5px 5px rgba(0, 0, 0, 0.32), inset 0 1px 1px rgba(255, 255, 255, 0.45), inset 0 -1px 1px rgba(0, 0, 0, 0.22)',
              borderTop: '1px solid rgba(255, 255, 255, 0.42)',
            }}
          >
            {/* Crisp style solid speech bubble */}
            <svg viewBox="0 0 20 20" width="13" height="13" fill="currentColor">
              <path d="M18 10c0 3.866-3.582 7-8 7-1.077 0-2.096-.186-3.018-.521L3 17.5l.872-2.913C3.327 13.336 3 11.724 3 10c0-3.866 3.582-7 8-7s8 3.134 8 7z" />
            </svg>
            <span className="tracking-wide">聊天</span>
          </div>
        </div>

        {/* Right: Actions (More ⋮) */}
        <div className="flex items-center">
          <button
            type="button"
            onClick={() => setShowMenu((prev) => !prev)}
            className="w-8 h-8 rounded-full hover:bg-white/15 flex items-center justify-center text-white transition cursor-pointer active:scale-95"
            title="更多选项"
          >
            <MoreVertical className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Second Row: Agent Status Bar (Avatar + "James 来自 光年跃迁" + Dropdown Box) */}
      <div className="px-4 pb-3 pt-0.5 flex items-center justify-center">
        <button
          type="button"
          onClick={() => setShowAgentInfo((prev) => !prev)}
          className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full hover:bg-white/10 transition cursor-pointer group"
        >
          {/* Avatar with presence status dot (green/amber/grey by agent status) */}
          <div className="relative shrink-0">
            <img
              src={defaultAvatar}
              alt={agentName}
              className="w-6 h-6 rounded-full object-cover border border-white/80 shadow-xs"
            />
            <span
              className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 ${
                isConnecting
                  ? 'bg-amber-400 animate-ping'
                  : agentStatus === 'away'
                    ? 'bg-amber-500'
                    : agentStatus === 'offline'
                      ? 'bg-slate-400'
                      : 'bg-[#00c853]'
              }`}
              style={{ borderColor: themeColor }}
            />
          </div>

          {/* Name & Tenant info */}
          <div className="flex items-center gap-1.5 text-[13px] font-medium tracking-tight text-white">
            <span>
              {agentName} 来自 {tenantName}
            </span>

            {/* Crisp signature translucent pill box for Chevron Down */}
            <div className="w-4.5 h-4.5 rounded-sm bg-white/20 group-hover:bg-white/30 flex items-center justify-center transition">
              <ChevronDown
                className={`w-3 h-3 text-white transition-transform duration-200 ${
                  showAgentInfo ? 'rotate-180' : ''
                }`}
              />
            </div>
          </div>
        </button>
      </div>

      {/* Popover Menu from MoreVertical (⋮) */}
      {showMenu && (
        <>
          <div
            className="fixed inset-0 z-30"
            onClick={() => {
              setShowMenu(false);
            }}
          />
          <div className="absolute top-12 right-3 z-40 bg-white text-slate-800 rounded-xl shadow-xl border border-slate-100 py-1.5 w-48 text-xs font-normal animate-in fade-in zoom-in-95 duration-150">
            {/* Real Service Status Badge (Read-only for Visitor) */}
            <div className="px-3 py-2 border-b border-slate-100 flex items-center gap-2 text-slate-600 bg-slate-50/70">
              <span className={`w-2 h-2 rounded-full shrink-0 ${isWorkingHours ? 'bg-emerald-500 shadow-xs' : 'bg-amber-500'}`} />
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-slate-800 text-[11px]">
                  {isWorkingHours ? '客服状态：在线响应' : '客服状态：非工作时间'}
                </div>
                {!isWorkingHours && (
                  <div className="text-[10px] text-slate-500">
                    当前支持留言提交
                  </div>
                )}
              </div>
            </div>

            {/* Sound Notification Toggle */}
            {onToggleSound && (
              <button
                type="button"
                onClick={() => {
                  onToggleSound();
                  setShowMenu(false);
                }}
                className="w-full px-3 py-2 text-left hover:bg-slate-50 flex items-center justify-between text-slate-700 cursor-pointer transition"
              >
                <div className="flex items-center gap-2">
                  {isSoundEnabled ? (
                    <Volume2 className="w-3.5 h-3.5 text-blue-600" />
                  ) : (
                    <VolumeX className="w-3.5 h-3.5 text-slate-400" />
                  )}
                  <span>新消息提示音</span>
                </div>
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${isSoundEnabled ? 'bg-blue-50 text-blue-600' : 'bg-slate-100 text-slate-500'}`}>
                  {isSoundEnabled ? '已开启' : '已静音'}
                </span>
              </button>
            )}

            {/* Email Transcript — disabled v1 */}
            {false && onExportTranscript && (
              <button
                type="button"
                onClick={() => {
                  setShowMenu(false);
                  setShowEmailModal(true);
                }}
                className="w-full px-3 py-2 text-left hover:bg-slate-50 flex items-center gap-2 text-slate-700 cursor-pointer transition"
              >
                <Mail className="w-3.5 h-3.5 text-slate-500" />
                <span>发送记录到邮箱</span>
              </button>
            )}
          </div>
        </>
      )}

      {/* Email Transcript Modal — disabled v1 */}
      {false && showEmailModal && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/30 backdrop-blur-xs animate-in fade-in"
            onClick={() => setShowEmailModal(false)}
          />
          <div className="absolute top-16 left-4 right-4 z-50 bg-white text-slate-800 rounded-2xl shadow-2xl border border-slate-100 p-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
                <Mail className="w-4 h-4 text-blue-600" />
                <span>发送完整聊天记录</span>
              </div>
              <button
                type="button"
                onClick={() => setShowEmailModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-md transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {emailSentSuccess ? (
              <div className="py-4 text-center space-y-1.5">
                <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 mx-auto flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div className="text-xs font-bold text-slate-800">发送成功！</div>
                <div className="text-[11px] text-slate-500">
                  聊天记录已发送至 <span className="text-blue-600 font-medium">{emailInput}</span>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSendTranscript} className="space-y-3 pt-1">
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  请输入接收邮箱，本场对话的全部聊天记录将打包发送至您的邮箱：
                </p>
                <input
                  type="email"
                  required
                  placeholder="例如：name@example.com"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:border-blue-500 text-slate-800"
                  autoFocus
                />
                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowEmailModal(false)}
                    className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                  >
                    取消
                  </button>
                  <button
                    type="submit"
                    className="px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition inline-flex items-center gap-1.5 shadow-xs cursor-pointer"
                  >
                    <Send className="w-3 h-3" />
                    <span>确认发送</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </>
      )}

      {/* Agent Info Dropdown Drawer */}
      {showAgentInfo && (
        <>
          <div
            className="fixed inset-0 z-30"
            onClick={() => setShowAgentInfo(false)}
          />
          <div className="absolute top-20 left-4 right-4 z-40 bg-white text-slate-800 rounded-2xl shadow-xl border border-slate-100 p-3.5 text-xs animate-in fade-in slide-in-from-top-2 duration-150">
            <div className="flex items-start gap-3">
              <img
                src={defaultAvatar}
                alt={agentName}
                className="w-10 h-10 rounded-full object-cover border border-slate-200 shrink-0"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 font-semibold text-slate-900 text-sm">
                  <span>{agentName}</span>
                  <span className="text-[11px] font-normal text-slate-400">· {agentTitle || '在线技术支持'}</span>
                </div>
                <div className="flex items-center gap-1 text-[11px] text-emerald-600 mt-0.5">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>极速响应中 · 官方认证</span>
                </div>
                <p className="text-slate-500 text-[11px] mt-1 leading-relaxed">
                  {agentBio || `欢迎咨询 ${tenantName}，我们将竭诚为您解答产品、计费与系统对接相关疑问。`}
                </p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
