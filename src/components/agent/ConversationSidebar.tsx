import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getConversationList, deleteConversation, ApiError } from '../../api';
import { mockWsBus } from '../../lib/mock/mock-ws-bus';
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

  const fetchConversations = async () => {
    try {
      setLoading(true);
      const res = await getConversationList({
        status: activeTab,
        keyword: keyword.trim(),
      });
      setConversations(res.list);
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
    if (!window.confirm(`确定永久删除全部 ${ids.length} 条已结束会话吗？删除后不可恢复。`)) return;
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
            <span>已结束会话</span>
          </button>
        </div>

        {/* Channel Filter Chips */}
        <div className="flex items-center gap-1 overflow-x-auto pb-0.5 text-[11px] no-scrollbar">
          {[
            { id: 'all', label: '全部渠道' },
            { id: 'web', label: '官网' },
            { id: 'wecom', label: '企业微信' },
            { id: 'wechat', label: '公众号' },
            { id: 'feishu', label: '飞书' },
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
                    <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 ${dark ? 'border-slate-900' : 'border-white'}`} />
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
                      {visitorRegion(conv)} · {conv.assignedAgentName || '未分配'}
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
