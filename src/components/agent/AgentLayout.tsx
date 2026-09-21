import React, { useEffect, useRef, useState } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  getCurrentAgentToken,
  logoutAgent,
  updateAgentProfile,
  getConversationList,
  getTenantSetting,
  IS_MOCK,
} from '../../api';
import { mockWsBus } from '../../lib/mock/mock-ws-bus';
import { realSocket } from '../../lib/real/socket-service';
import { AgentStatus, JwtTokenPayload } from '../../types';
import {
  MessageSquare,
  UserCheck,
  Zap,
  Building2,
  Users,
  LogOut,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Headphones,
  KeyRound,
  ShieldCheck,
} from 'lucide-react';

interface AgentLayoutProps {
  children: React.ReactNode;
}

export const AgentLayout: React.FC<AgentLayoutProps> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [currentUser, setCurrentUser] = useState<JwtTokenPayload | null>(getCurrentAgentToken());
  const [status, setStatus] = useState<AgentStatus>('online');
  const [unreadTotal, setUnreadTotal] = useState(0);
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  // 左上角品牌名：走 JWT 接口（GET /admin/tenant/config 对本租户坐席只读开放），
  // 读企业管理员配置的 brand_name，未设置时回退注册全称 tenant_name
  const [tenantName, setTenantName] = useState('');

  useEffect(() => {
    getTenantSetting()
      .then((c) => setTenantName(c.brand_name || c.tenant_name || ''))
      .catch(() => undefined);
  }, []);

  // Persistent sidebar collapsed state (collapsed = icon-only mode)
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('agent_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  // Real backend: ensure the agent realtime socket is connected.
  // connectAgent is idempotent; retrying on route change recovers from early failures.
  // 登录即上线：连接成功后向后端补报 online（DB + socket）。后端自动分配只认
  // online_status='online' 的坐席，不补报会导致所有进线都落入排队（queued）。
  // ref 保证每次页面加载只上报一次；坐席手动切忙碌后不会被路由重连覆盖。
  const autoOnlineReportedRef = useRef(false);
  useEffect(() => {
    if (IS_MOCK) return;
    if (!getCurrentAgentToken()) return;
    realSocket
      .connectAgent()
      .then(() => {
        if (autoOnlineReportedRef.current) return;
        autoOnlineReportedRef.current = true;
        updateAgentProfile({ status: 'online' })
          .then((updated) => {
            mockWsBus.send('agent_updated', { ...updated, status: 'online' });
          })
          .catch(() => undefined);
        realSocket.agentStatus('online');
      })
      .catch((e) => {
        console.warn('agent socket connect failed:', e?.message || e);
      });
  }, [location.pathname]);

  // Temporary hover expansion state when collapsed
  const [isHovered, setIsHovered] = useState<boolean>(false);

  const toggleCollapse = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('agent_sidebar_collapsed', String(next));
      } catch {}
      return next;
    });
  };

  const isExpanded = !isCollapsed || isHovered;

  // Sync token and unread count
  useEffect(() => {
    const user = getCurrentAgentToken();
    setCurrentUser(user);

    const fetchUnread = async () => {
      try {
        const { unreadTotal: total } = await getConversationList({ status: 'open' });
        setUnreadTotal(total);
      } catch (e) {
        console.error('Failed to fetch unread total:', e);
      }
    };
    fetchUnread();

    // Listen to messages or status updates to refresh unread badge
    const unbindMsg = mockWsBus.on('message', () => {
      fetchUnread();
    });
    const unbindRead = mockWsBus.on('read', () => {
      fetchUnread();
    });

    // Refresh sidebar avatar/name when the agent saves their profile on this tab
    // (ProfilePage updates localStorage first, then broadcasts agent_updated).
    const unbindAgentUpdated = mockWsBus.on('agent_updated', () => {
      const user = getCurrentAgentToken();
      setCurrentUser(user);
    });

    return () => {
      unbindMsg();
      unbindRead();
      unbindAgentUpdated();
    };
  }, [location.pathname]);

  const handleStatusChange = async (newStatus: AgentStatus) => {
    setStatus(newStatus);
    setShowStatusMenu(false);
    try {
      const updated = await updateAgentProfile({ status: newStatus });
      // send() = local dispatch + BroadcastChannel: same-browser visitor tabs (and
      // mock mode) update instantly; cross-browser relies on the agent_status relay.
      mockWsBus.send('agent_updated', { ...updated, status: newStatus });
      // Real backend: emit for server-side relay to visitor rooms
      if (!IS_MOCK) realSocket.agentStatus(newStatus);
    } catch (e) {
      console.error(e);
    }
  };

  const handleLogout = () => {
    realSocket.disconnectAgent();
    logoutAgent();
    navigate('/agent/login', { replace: true });
  };

  const isTenantAdmin = currentUser?.role === 'tenant_admin';

  return (
    <div className="h-screen w-screen flex bg-slate-100 overflow-hidden text-slate-800 font-sans">
      {/* Primary Left Navigation Bar with Collapsible & Hover-Expand Capability */}
      <div
        className="shrink-0 h-full relative z-30 select-none transition-[width] duration-200 ease-in-out"
        style={{ width: isCollapsed ? 70 : 280 }}
        onMouseEnter={() => {
          if (isCollapsed) setIsHovered(true);
        }}
        onMouseLeave={() => {
          if (isCollapsed) {
            setIsHovered(false);
            setShowStatusMenu(false);
          }
        }}
      >
        <aside
          className={`h-full bg-slate-900 text-slate-300 flex flex-col border-r border-slate-800 transition-[width,box-shadow] duration-200 ease-in-out overflow-hidden ${
            isCollapsed && isHovered
              ? 'absolute top-0 bottom-0 left-0 w-70 shadow-2xl z-40 border-slate-700 ring-1 ring-black/40'
              : isCollapsed
              ? 'relative w-17.5'
              : 'relative w-70'
          }`}
        >
          {/* Brand Section */}
          <div className="p-3.5 border-b border-slate-800/80 flex items-center justify-between min-h-17.25">
            {isExpanded ? (
              <>
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white font-bold shadow-md shadow-blue-600/30 shrink-0">
                    <Headphones className="w-5.5 h-5.5" />
                  </div>
                  <div className="min-w-0">
                    <h1 className="font-bold text-base text-white leading-tight tracking-tight truncate">
                      {tenantName || '坐席工作台'}
                    </h1>
                    <p className="text-xs text-slate-400 mt-0.5 truncate">坐席工作台</p>
                  </div>
                </div>

                {/* Round Toggle Button (< or >) */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleCollapse();
                  }}
                  title={isCollapsed ? '点击固定显示侧边栏' : '点击收起侧边栏 (悬停时自动显示)'}
                  className="w-7 h-7 rounded-full bg-white text-blue-600 hover:bg-blue-50 hover:shadow-lg shadow-md flex items-center justify-center transition-all cursor-pointer border border-slate-200 shrink-0 ml-1 group"
                >
                  {isCollapsed ? (
                    <ChevronRight className="w-4 h-4 stroke-[2.5] text-blue-600 group-hover:translate-x-0.5 transition-transform" />
                  ) : (
                    <ChevronLeft className="w-4 h-4 stroke-[2.5] text-blue-600 group-hover:-translate-x-0.5 transition-transform" />
                  )}
                </button>
              </>
            ) : (
              <div className="w-full flex items-center justify-center">
                <button
                  type="button"
                  onClick={toggleCollapse}
                  title={`${tenantName || '坐席工作台'} · 点击展开固定侧边栏`}
                  className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white font-bold shadow-md shadow-blue-600/30 cursor-pointer hover:bg-blue-500 transition"
                >
                  <Headphones className="w-5.5 h-5.5" />
                </button>
              </div>
            )}
          </div>

          {/* Current User & Status Card */}
          <div className="p-3 border-b border-slate-800/80 bg-slate-950/40">
            {isExpanded ? (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowStatusMenu((v) => !v)}
                  className="w-full flex items-center justify-between p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-left transition border border-slate-700/60 cursor-pointer"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="relative shrink-0">
                      <img
                        src={currentUser?.avatar || '/avatars/agent-female.png'}
                        alt={currentUser?.nickname || '客服坐席'}
                        className="w-9 h-9 rounded-full object-cover"
                      />
                      <span
                        className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-slate-900 ${
                          status === 'online'
                            ? 'bg-emerald-500'
                            : status === 'away'
                            ? 'bg-amber-500'
                            : 'bg-slate-500'
                        }`}
                      />
                    </div>
                    <div className="truncate">
                      <div className="text-sm font-semibold text-white truncate">
                        {currentUser?.nickname || '客服坐席'}
                      </div>
                      <div className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
                        <span>
                          {status === 'online' ? '在线接待中' : status === 'away' ? '暂离' : '离线'}
                        </span>
                        <span>·</span>
                        <span className="text-blue-400 font-medium">
                          {isTenantAdmin ? '管理员' : '客服'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                </button>

                {/* Status Dropdown Menu */}
                {showStatusMenu && (
                  <div className="absolute left-0 right-0 top-full mt-1 bg-slate-800 border border-slate-700 rounded-xl shadow-xl z-50 py-1.5 text-sm text-slate-200">
                    <button
                      type="button"
                      onClick={() => handleStatusChange('online')}
                      className="w-full px-3.5 py-2.5 flex items-center gap-2.5 hover:bg-slate-700/80 text-left cursor-pointer"
                    >
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
                      <span>在线 (自动接收新访客)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleStatusChange('away')}
                      className="w-full px-3.5 py-2.5 flex items-center gap-2.5 hover:bg-slate-700/80 text-left cursor-pointer"
                    >
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0" />
                      <span>离开 (忙碌/暂时离开)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleStatusChange('offline')}
                      className="w-full px-3.5 py-2.5 flex items-center gap-2.5 hover:bg-slate-700/80 text-left cursor-pointer"
                    >
                      <span className="w-2.5 h-2.5 rounded-full bg-slate-500 shrink-0" />
                      <span>离线 (不接收咨询)</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex justify-center">
                <div
                  title={`${currentUser?.nickname || '客服坐席'} (${
                    status === 'online' ? '在线接待中' : status === 'away' ? '暂离' : '离线'
                  })`}
                  className="relative cursor-pointer"
                  onClick={() => setIsHovered(true)}
                >
                  <img
                    src={currentUser?.avatar || '/avatars/agent-female.png'}
                    alt={currentUser?.nickname || '客服坐席'}
                    className="w-10 h-10 rounded-full object-cover hover:ring-2 hover:ring-blue-500 transition"
                  />
                  <span
                    className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-slate-900 ${
                      status === 'online'
                        ? 'bg-emerald-500'
                        : status === 'away'
                        ? 'bg-amber-500'
                        : 'bg-slate-500'
                    }`}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Navigation Menu */}
          <nav className="flex-1 p-3 space-y-1.5 overflow-y-auto">
            {isExpanded ? (
              <div className="text-xs font-bold text-slate-400 uppercase px-3.5 py-1.5 tracking-wider">
                对话业务
              </div>
            ) : null}

            <NavLink
              to="/agent/conversations"
              title={!isExpanded ? `会话接待工作台 ${unreadTotal > 0 ? `(${unreadTotal})` : ''}` : undefined}
              className={({ isActive }) =>
                `flex items-center ${
                  isExpanded
                    ? 'justify-between px-3.5 py-2.5 rounded-xl'
                    : 'justify-center w-11 h-11 mx-auto rounded-xl'
                } text-sm font-medium transition ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`
              }
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="relative shrink-0 flex items-center justify-center">
                  <MessageSquare className="w-5 h-5" />
                  {!isExpanded && unreadTotal > 0 && (
                    <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-red-500 ring-2 ring-slate-900" />
                  )}
                </div>
                {isExpanded && <span className="truncate">会话接待工作台</span>}
              </div>
              {isExpanded && unreadTotal > 0 && (
                <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-red-500 text-white shrink-0 ml-2">
                  {unreadTotal}
                </span>
              )}
            </NavLink>

            {isExpanded ? (
              <div className="text-xs font-bold text-slate-400 uppercase px-3.5 pt-4 pb-1.5 tracking-wider">
                坐席偏好
              </div>
            ) : (
              <div className="w-7 h-px bg-slate-800/80 mx-auto my-2" />
            )}

            <NavLink
              to="/agent/settings/profile"
              title={!isExpanded ? '个人信息与状态' : undefined}
              className={({ isActive }) =>
                `flex items-center ${
                  isExpanded
                    ? 'gap-3 px-3.5 py-2.5 rounded-xl'
                    : 'justify-center w-11 h-11 mx-auto rounded-xl'
                } text-sm font-medium transition ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`
              }
            >
              <UserCheck className="w-5 h-5 shrink-0" />
              {isExpanded && <span className="truncate">个人信息与状态</span>}
            </NavLink>

            <NavLink
              to="/agent/settings/quick-reply"
              title={!isExpanded ? '快捷回复模板库' : undefined}
              className={({ isActive }) =>
                `flex items-center ${
                  isExpanded
                    ? 'gap-3 px-3.5 py-2.5 rounded-xl'
                    : 'justify-center w-11 h-11 mx-auto rounded-xl'
                } text-sm font-medium transition ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`
              }
            >
              <Zap className="w-5 h-5 shrink-0" />
              {isExpanded && <span className="truncate">快捷回复模板库</span>}
            </NavLink>

            <NavLink
              to="/agent/settings/password"
              title={!isExpanded ? '修改登录密码' : undefined}
              className={({ isActive }) =>
                `flex items-center ${
                  isExpanded
                    ? 'gap-3 px-3.5 py-2.5 rounded-xl'
                    : 'justify-center w-11 h-11 mx-auto rounded-xl'
                } text-sm font-medium transition ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`
              }
            >
              <KeyRound className="w-5 h-5 shrink-0" />
              {isExpanded && <span className="truncate">修改登录密码</span>}
            </NavLink>

            {/* Tenant Admin Restricted Section */}
            {isTenantAdmin && (
              <>
                {isExpanded ? (
                  <div className="text-xs font-bold text-slate-400 uppercase px-3.5 pt-4 pb-1.5 tracking-wider flex items-center justify-between">
                    <span>租户全局管理</span>
                    <span className="text-[10px] bg-indigo-900/60 text-indigo-300 px-2 py-0.5 rounded font-normal">
                      管理员
                    </span>
                  </div>
                ) : (
                  <div className="w-7 h-px bg-slate-800/80 mx-auto my-2" />
                )}

                <NavLink
                  to="/agent/settings/tenant"
                  title={!isExpanded ? '租户参数与外观配置' : undefined}
                  className={({ isActive }) =>
                    `flex items-center ${
                      isExpanded
                        ? 'gap-3 px-3.5 py-2.5 rounded-xl'
                        : 'justify-center w-11 h-11 mx-auto rounded-xl'
                    } text-sm font-medium transition ${
                      isActive
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                    }`
                  }
                >
                  <Building2 className="w-5 h-5 text-indigo-400 shrink-0" />
                  {isExpanded && <span className="truncate">租户参数与外观配置</span>}
                </NavLink>

                <NavLink
                  to="/agent/settings/agents"
                  title={!isExpanded ? '坐席账号人员管理' : undefined}
                  className={({ isActive }) =>
                    `flex items-center ${
                      isExpanded
                        ? 'gap-3 px-3.5 py-2.5 rounded-xl'
                        : 'justify-center w-11 h-11 mx-auto rounded-xl'
                    } text-sm font-medium transition ${
                      isActive
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                    }`
                  }
                >
                  <Users className="w-5 h-5 text-indigo-400 shrink-0" />
                  {isExpanded && <span className="truncate">坐席账号人员管理</span>}
                </NavLink>

                <NavLink
                  to="/admin"
                  title={!isExpanded ? '企业管理控制台' : undefined}
                  className={({ isActive }) =>
                    `flex items-center ${
                      isExpanded
                        ? 'gap-3 px-3.5 py-2.5 rounded-xl'
                        : 'justify-center w-11 h-11 mx-auto rounded-xl'
                    } text-sm font-medium transition ${
                      isActive
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                    }`
                  }
                >
                  <ShieldCheck className="w-5 h-5 text-amber-400 shrink-0" />
                  {isExpanded && <span className="truncate">企业管理控制台</span>}
                </NavLink>
              </>
            )}

          </nav>

          {/* Bottom Logout */}
          <div className="p-3 border-t border-slate-800/80">
            <button
              type="button"
              onClick={handleLogout}
              title={!isExpanded ? '退出坐席登录' : undefined}
              className={`w-full flex items-center ${
                isExpanded ? 'justify-center gap-2.5 px-3.5 py-2.5' : 'justify-center w-11 h-11 mx-auto'
              } text-sm text-slate-400 hover:text-red-400 hover:bg-slate-800/60 rounded-xl transition cursor-pointer`}
            >
              <LogOut className="w-5 h-5 shrink-0" />
              {isExpanded && <span>退出坐席登录</span>}
            </button>
          </div>
        </aside>
      </div>

      {/* Main Content Pane */}
      <main className="flex-1 flex flex-col min-w-0 h-full overflow-hidden bg-white">
        {children}
      </main>
    </div>
  );
};

