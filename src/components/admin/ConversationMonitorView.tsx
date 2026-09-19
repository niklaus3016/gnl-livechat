import React, { useEffect, useRef, useState } from 'react';
import { RefreshCw, Eye, Clock, Info, Globe, Zap, Image as ImageIcon, Paperclip, Mic, Send, MessagesSquare } from 'lucide-react';
import { getAgentMessages, getConversationDetail } from '../../api';
import { Conversation, ChatMessage } from '../../types';
import { formatConversationTime } from '../../utils/format';
import { MessageBubble } from '../chat/MessageBubble';
import { ConversationSidebar } from '../agent/ConversationSidebar';
import { VisitorInfoPanel } from '../agent/VisitorInfoPanel';

const STATUS_META: Record<string, { label: string; cls: string }> = {
  open: { label: '进行中', cls: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' },
  queued: { label: '排队中', cls: 'bg-amber-500/10 text-amber-400 border border-amber-500/30' },
  closed: { label: '已结束', cls: 'bg-slate-500/10 text-slate-400 border border-slate-500/30' },
};

/**
 * 企业主「会话监控」：1:1 复刻坐席工作台三栏布局（会话列表 + 聊天区 + 访客画像），
 * 数据为企业全租户会话（后端对企业主角色不过滤受理人），全程只读——
 * 删除/清空/回复/画像编辑均禁用。30s 轮询保持列表与消息新鲜。
 */
export const ConversationMonitorView: React.FC<{
  themeColor?: string;
  botAvatar?: string;
}> = ({ themeColor, botAvatar }) => {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [active, setActive] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [msgsLoading, setMsgsLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const activeIdRef = useRef<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const fetchMessages = async (convId: string, silent = false) => {
    if (!silent) setMsgsLoading(true);
    try {
      setMessages(await getAgentMessages(convId));
    } catch (e) {
      console.error(e);
      setMessages([]);
    } finally {
      if (!silent) setMsgsLoading(false);
    }
  };

  const fetchActive = async (convId: string) => {
    try {
      setActive(await getConversationDetail(convId));
    } catch (e) {
      console.error(e);
    }
  };

  // 轮询：30s 刷新列表（refreshKey 信号给 Sidebar）+ 当前会话消息与详情
  useEffect(() => {
    const timer = setInterval(() => {
      setRefreshKey((k) => k + 1);
      if (activeIdRef.current) {
        fetchMessages(activeIdRef.current, true);
        fetchActive(activeIdRef.current);
      }
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  const handleSelect = (id: string) => {
    setActiveId(id);
    activeIdRef.current = id;
    setMessages([]);
    fetchMessages(id);
    fetchActive(id);
  };

  // 消息更新后自动滚到底部
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, activeId]);

  const statusMeta = active ? STATUS_META[active.status] || STATUS_META.open : null;

  return (
    <div className="space-y-4">
      {/* 监控工具行（控制台层，不属于工作台复刻区） */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm">
          <Eye className="w-4.5 h-4.5 text-indigo-400" />
          <span className="font-bold text-white">坐席会话监控</span>
          <span className="text-xs text-slate-400">
            与坐席工作台界面一致 · 只读查看 · 每 30 秒自动刷新
          </span>
        </div>
        <button
          type="button"
          onClick={() => {
            setRefreshKey((k) => k + 1);
            if (activeIdRef.current) fetchMessages(activeIdRef.current);
          }}
          className="p-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-300 hover:text-white hover:border-slate-600 transition cursor-pointer"
          title="立即刷新"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* 1:1 复刻坐席工作台三栏（全只读），深蓝暗色主题，高度撑满视口剩余空间 */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-sm overflow-hidden flex text-slate-200 h-[calc(100vh-140px)] min-h-130">
        {/* 左栏：坐席端同款会话列表（搜索/进行中·已结束/渠道筛选，删除入口已隐藏） */}
        <ConversationSidebar
          activeId={activeId || undefined}
          onSelectConversation={handleSelect}
          readOnly
          refreshKey={refreshKey}
          dark
        />

        {/* 中栏：坐席端同款聊天区 */}
        <div className="flex-1 min-w-0 flex flex-col border-x border-slate-800">
          {active ? (
            <>
              {/* 会话头部 */}
              <div className="px-5 py-3.5 bg-slate-900 border-b border-slate-800 flex items-center justify-between shadow-2xs shrink-0">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="relative">
                    <div className="w-10 h-10 rounded-full bg-indigo-500/15 text-indigo-300 flex items-center justify-center font-bold text-sm">
                      {(active.visitorName || '访').charAt(0)}
                    </div>
                    <span
                      className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-slate-900 ${
                        active.status !== 'closed' ? 'bg-emerald-500' : 'bg-slate-500'
                      }`}
                    />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h2 className="text-sm font-bold text-slate-100 truncate">
                        {active.visitorName || '访客'}
                      </h2>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-semibold shrink-0 ${statusMeta!.cls}`}
                      >
                        {statusMeta!.label}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-slate-800 text-slate-300 border border-slate-700 flex items-center gap-1 shrink-0">
                        <Globe className="w-3 h-3 text-blue-400" />
                        Web官网咨询
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                      <span>归属地：{active.visitorInfo?.location || '未知地域'}</span>
                      <span>·</span>
                      <span>接待人：{active.assignedAgentName || '未分配'}</span>
                    </div>
                  </div>
                </div>
                <span className="text-[10px] px-2 py-1 rounded-lg bg-indigo-500/10 text-indigo-300 border border-indigo-500/30 font-semibold shrink-0">
                  监控中
                </span>
              </div>

              {/* 消息区：坐席视角（坐席右蓝 / 访客左白首字头像）+ 会话开始于分隔 */}
              <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto p-5 space-y-2 bg-slate-900">
                {msgsLoading ? (
                  <div className="h-full flex items-center justify-center text-xs text-slate-500">
                    正在加载聊天记录...
                  </div>
                ) : messages.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-xs text-slate-500">
                    暂无消息记录
                  </div>
                ) : (
                  <>
                    <div className="flex justify-center my-3">
                      <span className="text-[11px] text-slate-400 bg-slate-800/80 px-3 py-0.5 rounded-full flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        <span>会话开始于 {formatConversationTime(active.createdAt)}</span>
                      </span>
                    </div>
                    {messages.map((m, idx) => (
                      <MessageBubble
                        key={m.id}
                        message={
                          m.senderType === 'visitor' && active.visitorName
                            ? { ...m, senderName: active.visitorName }
                            : m
                        }
                        themeColor={themeColor}
                        botAvatar={botAvatar}
                        isAgentWorkbenchView
                        dark
                        showSenderInfo={idx === 0 || messages[idx - 1].senderName !== m.senderName}
                      />
                    ))}
                  </>
                )}
              </div>

              {/* 输入区（监控只读，全部禁用） */}
              <div className="px-5 py-3 bg-slate-900 border-t border-slate-800 shrink-0 select-none">
                <div className="flex items-center justify-between mb-2.5">
                  <div className="flex items-center gap-1 text-slate-400" title="监控模式下不可使用">
                    <span className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium text-orange-400 bg-orange-500/10 border border-orange-500/30">
                      <Zap className="w-3.5 h-3.5" />
                      快捷回复
                    </span>
                    <span className="p-2 rounded-lg hover:bg-slate-800 text-slate-300" title="发送图片">
                      <ImageIcon className="w-4.5 h-4.5" />
                    </span>
                    <span className="p-2 rounded-lg hover:bg-slate-800 text-slate-300" title="发送附件">
                      <Paperclip className="w-4.5 h-4.5" />
                    </span>
                    <span className="p-2 rounded-lg hover:bg-slate-800 text-slate-300" title="语音回复">
                      <Mic className="w-4.5 h-4.5" />
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500">Enter 发送回复</div>
                </div>
                <textarea
                  rows={3}
                  disabled
                  placeholder="请输入回复内容..."
                  className="w-full min-h-22 p-3.5 text-xs bg-slate-800/60 border border-slate-700 rounded-xl resize-none leading-relaxed text-slate-200 placeholder:text-slate-500 disabled:bg-slate-800/40 cursor-not-allowed"
                />
                <div className="flex items-center justify-between mt-2.5">
                  <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
                    <Info className="w-3.5 h-3.5 text-slate-500" />
                    <span>支持直接拖拽发图/视频，Enter快速发送</span>
                  </div>
                  <button
                    type="button"
                    disabled
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-semibold shadow-xs opacity-40 cursor-not-allowed"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>发送回复</span>
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center gap-2 text-slate-500">
              <MessagesSquare className="w-8 h-8 text-slate-700" />
              <span className="text-xs">选择左侧会话，以坐席视角查看完整聊天记录</span>
            </div>
          )}
        </div>

        {/* 右栏：坐席端同款访客画像面板（编辑已禁用） */}
        {active && (
          <VisitorInfoPanel
            key={active.id}
            conversationId={active.id}
            visitorInfo={active.visitorInfo}
            visitorName={active.visitorName}
            channel={active.channel}
            readOnly
            dark
          />
        )}
      </div>
    </div>
  );
};
