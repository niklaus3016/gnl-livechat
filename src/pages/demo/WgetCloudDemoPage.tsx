import React, { useState, useEffect, useRef } from 'react';
import { NavLink, useSearchParams } from 'react-router-dom';
import {
  Sparkles,
  RotateCcw,
  ExternalLink,
  MessageCircle,
  Bell,
  CheckCircle2,
  Layers,
  CreditCard,
  Share2,
  Activity,
  Mail,
  Settings,
  ChevronRight,
  Minus,
  Columns,
  Maximize2,
  Headphones,
  Laptop,
} from 'lucide-react';

export const WgetCloudDemoPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  // Default to dual-view split mode enabled for seamless testing
  const [isDualView, setIsDualView] = useState<boolean>(() => {
    const param = searchParams.get('dual');
    return param !== '0';
  });

  const [isOpen, setIsOpen] = useState(false);
  const [agentKey, setAgentKey] = useState(1);
  // 访客 iframe 重载键（重置弹窗演示时重新触发 iframe 内的配置定时弹窗）
  const [visitorKey, setVisitorKey] = useState(1);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Toggle dual-view mode
  const toggleDualView = () => {
    setIsDualView((prev) => {
      const next = !prev;
      setSearchParams({ dual: next ? '1' : '0' }, { replace: true });
      return next;
    });
  };

  // 自动弹窗由 iframe 内访客页按租户配置（enable_auto_popup + 延迟秒数）驱动，
  // 到点 iframe 会 postMessage LIVECHAT_AUTO_OPEN，宿主页只负责显隐容器。
  const reloadAgent = () => setAgentKey((k) => k + 1);

  // When isOpen becomes true, notify the iframe to auto scroll to bottom
  useEffect(() => {
    if (isOpen && iframeRef.current?.contentWindow) {
      try {
        iframeRef.current.contentWindow.postMessage({ type: 'LIVECHAT_WIDGET_OPENED' }, '*');
      } catch (e) {
        // ignore
      }
    }
  }, [isOpen]);

  // Listen to postMessage from the embedded chat iframe
  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      if (!e.data) return;
      if (e.data.type === 'LIVECHAT_AUTO_OPEN') {
        setIsOpen(true);
        return;
      }
      if (e.data.type === 'LIVECHAT_CLOSE' || e.data.type === 'LIVECHAT_MINIMIZE') {
        setIsOpen(false);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const handleResetPopup = () => {
    // 清掉访客页的"本会话已手动关闭"记忆，收起容器并重载 iframe，重新走配置定时弹窗
    try {
      sessionStorage.removeItem('lc_widget_dismissed_wgetcloud_live');
    } catch {
      // ignore
    }
    setIsOpen(false);
    setVisitorKey((k) => k + 1);
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-[#0f172a] text-[#0f172a] overflow-hidden font-sans relative">
      {/* Top Test Banner Bar */}
      <header className="h-11 bg-[#090d16] text-white text-xs px-4 flex items-center justify-between z-30 shrink-0 select-none shadow-md border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 font-semibold border border-blue-400/30">
            <Sparkles className="w-3.5 h-3.5 text-blue-400" />
            <span>左右双界面联调测试视窗</span>
          </span>

          {isOpen ? (
            <span className="text-emerald-400 text-[11px] hidden sm:inline-flex items-center gap-1 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
              ✓ 左侧已自动弹出，点击右上角「—」可收起为头像，右侧可直接接收访客消息与草稿
            </span>
          ) : (
            <span className="text-amber-300 text-[11px] animate-pulse hidden sm:inline-flex items-center gap-1 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
              ⏳ 等待左侧网站按企业主配置的延迟秒数自动弹出客服窗口...
            </span>
          )}
        </div>

        <div className="flex items-center gap-2.5">
          {/* Dual Screen Toggle Button */}
          <button
            type="button"
            onClick={toggleDualView}
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition cursor-pointer border ${
              isDualView
                ? 'bg-blue-600 text-white border-blue-500 shadow-sm shadow-blue-500/30'
                : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
            }`}
            title="切换单屏全览或左右双分屏联动"
          >
            <Columns className="w-3.5 h-3.5" />
            <span>{isDualView ? '左右双界面联动：已开启' : '切换为左右双屏'}</span>
          </button>

          <button
            type="button"
            onClick={handleResetPopup}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs transition cursor-pointer active:scale-95"
            title="重新体验3秒自动弹出"
          >
            <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
            <span>重新倒计时弹出</span>
          </button>

          <NavLink
            to="/agent/conversations"
            target="_blank"
            className="hidden md:inline-flex items-center gap-1 text-slate-400 hover:text-blue-300 transition text-xs"
            title="在新标签页独立打开客服工作台"
          >
            <ExternalLink className="w-3 h-3" />
            <span>新标签页工作台</span>
          </NavLink>
        </div>
      </header>

      {/* Main Container: Split Dual-Screen or Single View */}
      <div className="flex-1 flex overflow-hidden p-2 gap-2 bg-[#090d16]">
        {/* Left Screen: WgetCloud Host Site with Auto-popup Chat & Avatar */}
        <div
          className={`h-full flex flex-col rounded-xl overflow-hidden border border-slate-800 shadow-2xl transition-all duration-300 bg-[#f1f5f9] relative ${
            isDualView ? 'w-full lg:w-1/2' : 'w-full'
          }`}
        >
          {/* Left Top Sub-bar */}
          {isDualView && (
            <div className="h-7 px-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-[11px] text-slate-300 shrink-0 select-none">
              <div className="flex items-center gap-1.5 font-medium">
                <Laptop className="w-3.5 h-3.5 text-emerald-400" />
                <span>左侧：光年跃迁用户中心宿主端 (访客体验视窗)</span>
              </div>
              <span className="text-[10px] text-slate-400">右下角自动弹出 & 头像最小化</span>
            </div>
          )}

          {/* Host Layout: Sidebar + Dashboard */}
          <div className="flex-1 flex overflow-hidden relative">
            {/* Sidebar */}
            <aside className="w-48 sm:w-56 bg-[#0f172a] text-[#94a3b8] flex flex-col shrink-0 border-r border-[#1e293b]">
              {/* Logo Area */}
              <div className="h-12 px-4 flex items-center gap-2.5 border-b border-[#1e293b]">
                <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-sm shadow-md shadow-blue-500/20">
                  光
                </div>
                <div>
                  <div className="text-xs font-bold text-white tracking-wide">光年跃迁</div>
                  <div className="text-[9px] text-slate-400">用户中心</div>
                </div>
              </div>

              {/* Nav List */}
              <nav className="p-2 space-y-1 text-xs flex-1">
                <div className="px-2.5 py-1 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                  服务导航
                </div>
                <div className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg bg-[#1972f5] text-white font-medium cursor-pointer shadow-xs">
                  <Layers className="w-3.5 h-3.5" />
                  <span>节点列表</span>
                </div>
                <div className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-slate-800/60 hover:text-slate-200 transition cursor-pointer">
                  <CreditCard className="w-3.5 h-3.5" />
                  <span>订阅服务</span>
                </div>
                <div className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-slate-800/60 hover:text-slate-200 transition cursor-pointer">
                  <Share2 className="w-3.5 h-3.5" />
                  <span>推广联盟</span>
                </div>
                <div className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-slate-800/60 hover:text-slate-200 transition cursor-pointer">
                  <Activity className="w-3.5 h-3.5" />
                  <span>流量明细</span>
                </div>
                <div className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-slate-800/60 hover:text-slate-200 transition cursor-pointer">
                  <Mail className="w-3.5 h-3.5" />
                  <span>信箱服务</span>
                </div>

                <div className="pt-3 px-2.5 py-1 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                  配置管理
                </div>
                <div className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-slate-800/60 hover:text-slate-200 transition cursor-pointer">
                  <Settings className="w-3.5 h-3.5" />
                  <span>账户设置</span>
                </div>
              </nav>

              {/* User profile bottom */}
              <div className="p-2.5 border-t border-[#1e293b] flex items-center gap-2 text-xs">
                <img
                  src="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop&q=80"
                  alt="User"
                  className="w-7 h-7 rounded-full border border-slate-700 object-cover"
                />
                <div className="overflow-hidden">
                  <div className="text-white font-medium truncate text-[11px]">VIP 专线用户</div>
                  <div className="text-[10px] text-slate-400">user@wget.co</div>
                </div>
              </div>
            </aside>

            {/* Content Area */}
            <main className="flex-1 overflow-y-auto bg-[#f8fafc] flex flex-col">
              {/* Top Bar */}
              <div className="h-12 bg-white border-b border-slate-200 px-4 flex items-center justify-between shrink-0">
                <div className="text-sm font-bold text-slate-800">节点列表</div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center relative transition"
                  >
                    <Bell className="w-3.5 h-3.5" />
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 absolute top-1 right-1" />
                  </button>
                  <div className="flex items-center gap-1.5 text-xs text-slate-600">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span className="hidden sm:inline">专线节点畅通</span>
                  </div>
                </div>
              </div>

              {/* Dashboard Body */}
              <div className="p-4 space-y-4 max-w-5xl w-full mx-auto">
                {/* Welcome Card & Plan Card */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Welcome Card */}
                  <div className="bg-white rounded-xl p-4 border border-slate-200/80 shadow-xs flex items-start gap-3">
                    <img
                      src="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120&auto=format&fit=crop&q=80"
                      alt="User"
                      className="w-11 h-11 rounded-full border-2 border-slate-200 object-cover shrink-0"
                    />
                    <div className="space-y-1 text-xs text-slate-600">
                      <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1">
                        <span>🎉 欢迎来到光年跃迁</span>
                      </h3>
                      <p className="text-[11px]">随时找到我们：</p>
                      <p className="font-mono text-[10px] text-slate-500">
                        跳转：<span className="text-blue-600 font-semibold">wgetcloud.ltd</span>
                      </p>
                      <div className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 font-medium text-[10px]">
                        <CheckCircle2 className="w-3 h-3 text-blue-500" />
                        <span>在线专属客服随时响应</span>
                      </div>
                    </div>
                  </div>

                  {/* Subscription Card */}
                  <div className="bg-white rounded-xl p-4 border border-slate-200/80 shadow-xs flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-800 text-xs">精品专线服务</span>
                        <span className="px-2 py-0.2 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-medium">
                          生效中
                        </span>
                      </div>
                      <div className="mt-2 text-[11px] text-slate-600 space-y-0.5">
                        <div className="flex justify-between">
                          <span>已用时长: 7 / 90 天</span>
                          <span className="text-amber-600 font-medium">83天后到期</span>
                        </div>
                        <div className="flex justify-between">
                          <span>已用流量: 5.06 / 270 G</span>
                          <span className="text-emerald-600 font-medium">剩余 98%</span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden mt-1.5">
                          <div className="h-full bg-blue-600 rounded-full w-[2%]" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Metrics */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-xs">
                    <div className="text-[11px] text-slate-500">今日流量</div>
                    <div className="text-lg font-bold text-emerald-600 mt-0.5">635 MB</div>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-xs">
                    <div className="text-[11px] text-slate-500">在线设备</div>
                    <div className="text-lg font-bold text-blue-600 mt-0.5">1 / 5 台</div>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-xs">
                    <div className="text-[11px] text-slate-500">峰值带宽</div>
                    <div className="text-lg font-bold text-indigo-600 mt-0.5">500 Mbps</div>
                  </div>
                </div>

                {/* Client Setup Tutorials */}
                <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
                  <h4 className="text-xs font-bold text-slate-800 mb-2.5">客户端配置教程</h4>
                  <div className="grid grid-cols-4 gap-2">
                    <div className="p-2.5 rounded-lg border border-slate-200 hover:border-blue-400 hover:bg-blue-50/20 transition cursor-pointer flex flex-col items-center text-center">
                      <div className="text-xl mb-1">🪟</div>
                      <div className="text-[11px] font-bold text-slate-800">Windows</div>
                    </div>
                    <div className="p-2.5 rounded-lg border border-slate-200 hover:border-blue-400 hover:bg-blue-50/20 transition cursor-pointer flex flex-col items-center text-center">
                      <div className="text-xl mb-1">🤖</div>
                      <div className="text-[11px] font-bold text-slate-800">Android</div>
                    </div>
                    <div className="p-2.5 rounded-lg border border-slate-200 hover:border-blue-400 hover:bg-blue-50/20 transition cursor-pointer flex flex-col items-center text-center">
                      <div className="text-xl mb-1">🍏</div>
                      <div className="text-[11px] font-bold text-slate-800">iOS</div>
                    </div>
                    <div className="p-2.5 rounded-lg border border-slate-200 hover:border-blue-400 hover:bg-blue-50/20 transition cursor-pointer flex flex-col items-center text-center">
                      <div className="text-xl mb-1">💻</div>
                      <div className="text-[11px] font-bold text-slate-800">macOS</div>
                    </div>
                  </div>
                </div>
              </div>
            </main>
          </div>

          {/* Floating Chat Widget & Avatar Launcher (Crisp Exact Replica) */}
          <div className="absolute bottom-4 right-4 z-40 flex flex-col items-end pointer-events-none">
            {/* Expanded Chat Dialog Iframe Container */}
            <div
              className={`w-95 max-w-[calc(100%-16px)] h-140 max-h-[calc(100%-20px)] rounded-3xl shadow-[0_20px_60px_-10px_rgba(0,0,0,0.24),0_0_0_1px_rgba(0,0,0,0.06)] bg-white overflow-hidden transition-all duration-300 origin-bottom-right mb-3 pointer-events-auto ${
                isOpen
                  ? 'opacity-100 translate-y-0 scale-100 block'
                  : 'opacity-0 translate-y-4 scale-95 hidden'
              }`}
            >
              <iframe
                key={`visitor-${visitorKey}`}
                ref={iframeRef}
                src="/chat?embed=1&tenant_code=wgetcloud_live"
                title="在线客服咨询"
                className="w-full h-full border-0 block overflow-hidden"
                allow="camera; microphone; autoplay"
              />
            </div>

            {/* Floating Avatar Launcher Button (James Avatar with Green Online Dot) */}
            <button
              type="button"
              onClick={() => setIsOpen((prev) => !prev)}
              className="w-13 h-13 rounded-full bg-white border-2 border-white shadow-[0_8px_24px_rgba(0,0,0,0.18),0_2px_6px_rgba(0,0,0,0.08)] cursor-pointer hover:scale-105 active:scale-95 transition-all flex items-center justify-center relative pointer-events-auto group"
              title={isOpen ? '点击最小化收起对话框' : '点击展开在线客服 (James)'}
            >
              <img
                src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80"
                alt="在线客服 James"
                className="w-full h-full rounded-full object-cover"
              />
              {/* Crisp Vivid Green Online Indicator Dot */}
              <span className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full bg-[#00c853] border-2 border-white shadow-xs" />

              {/* Hover Tooltip when collapsed */}
              {!isOpen && (
                <span className="absolute right-15 px-2.5 py-1 rounded-lg bg-[#0f172a] text-white text-[11px] font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition shadow-lg pointer-events-none">
                  与 James 在线咨询
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Right Screen: Agent Workbench (When Dual-View is Enabled) */}
        {isDualView && (
          <div className="w-full lg:w-1/2 h-full flex flex-col rounded-xl overflow-hidden border border-slate-800 bg-slate-900 shadow-2xl">
            {/* Right Top Sub-bar */}
            <div className="h-7 px-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-[11px] text-slate-300 shrink-0 select-none">
              <div className="flex items-center gap-1.5 font-medium">
                <Headphones className="w-3.5 h-3.5 text-blue-400" />
                <span>右侧：客服坐席工作台 (/agent/conversations)</span>
                <span className="text-[9px] bg-blue-950 text-blue-400 px-1.5 py-0.2 rounded border border-blue-800 ml-1">
                  实时同步
                </span>
              </div>
              <button
                type="button"
                onClick={reloadAgent}
                className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition cursor-pointer"
                title="重新加载坐席工作台"
              >
                <RotateCcw className="w-3 h-3" />
              </button>
            </div>

            {/* Agent Workbench Iframe */}
            <div className="flex-1 bg-white overflow-hidden">
              <iframe
                key={`agent-${agentKey}`}
                src="/agent/conversations"
                className="w-full h-full border-0 block"
                title="客服坐席工作台"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

