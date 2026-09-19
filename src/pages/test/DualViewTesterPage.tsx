import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  ExternalLink,
  Laptop,
  Headphones,
  RotateCcw,
  Sparkles,
  Zap,
  Info,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';

export const DualViewTesterPage: React.FC = () => {
  const [visitorKey, setVisitorKey] = useState(1);
  const [agentKey, setAgentKey] = useState(1);
  const [leftMode, setLeftMode] = useState<'host' | 'chat'>('host'); // 'host' = 光年跃迁 Demo, 'chat' = Standalone Chat
  const [embedMode, setEmbedMode] = useState(false);

  const reloadVisitor = () => setVisitorKey((k) => k + 1);
  const reloadAgent = () => setAgentKey((k) => k + 1);

  return (
    <div className="h-screen w-screen flex flex-col bg-slate-900 text-slate-100 overflow-hidden font-sans">
      {/* Top Test Navigation Bar */}
      <header className="px-5 py-2.5 bg-slate-950 border-b border-slate-800 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-purple-600 flex items-center justify-center text-white shadow-md shadow-purple-600/30 font-bold text-sm">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-white flex items-center gap-2">
              <span>光年跃迁 · 在线客服双端联调工作台</span>
              <span className="text-[10px] bg-emerald-900/60 text-emerald-300 font-normal px-2 py-0.5 rounded-full border border-emerald-500/20 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                工作时间状态 (接待在线)
              </span>
            </h1>
            <p className="text-[11px] text-slate-400">
              左侧：{leftMode === 'host' ? '光年跃迁 真实网站宿主 (自动弹出 & 头像最小化)' : '外部网站访客聊天视角'} ｜ 右侧：客服坐席工作台接待视角（实时感知访客草稿与已读）
            </p>
          </div>
        </div>

        {/* Right quick actions */}
        <div className="flex items-center gap-2.5 text-xs">
          {/* Left Mode Selector */}
          <div className="flex items-center bg-slate-800/90 p-0.5 rounded-xl border border-slate-700">
            <button
              type="button"
              onClick={() => setLeftMode('host')}
              className={`px-2.5 py-1 rounded-lg transition font-medium cursor-pointer ${
                leftMode === 'host'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              宿主网站模式 (推荐)
            </button>
            <button
              type="button"
              onClick={() => setLeftMode('chat')}
              className={`px-2.5 py-1 rounded-lg transition font-medium cursor-pointer ${
                leftMode === 'chat'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              纯聊天窗口模式
            </button>
          </div>

          {leftMode === 'chat' && (
            <label className="flex items-center gap-1.5 bg-slate-800/80 px-2.5 py-1 rounded-xl border border-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={embedMode}
                onChange={(e) => setEmbedMode(e.target.checked)}
                className="rounded text-purple-600 focus:ring-purple-500"
              />
              <span className="text-slate-300">嵌入模式 (?embed=1)</span>
            </label>
          )}

          <NavLink
            to="/agent/conversations"
            target="_blank"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition font-medium"
          >
            <Headphones className="w-3.5 h-3.5" />
            <span>全屏坐席工作台</span>
          </NavLink>

          <a
            href="/widget-demo.html"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl transition"
          >
            <ExternalLink className="w-3.5 h-3.5 text-cyan-400" />
            <span>原生 HTML</span>
          </a>
        </div>
      </header>

      {/* Split Dual-Screen Containers */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-12 overflow-hidden bg-slate-950 p-2.5 gap-2.5">
        {/* Left: Visitor Chat / Host Site Preview (5 or 6 cols depending on mode) */}
        <div
          className={`${
            leftMode === 'host' ? 'md:col-span-6 lg:col-span-6' : 'md:col-span-4 lg:col-span-4'
          } flex flex-col rounded-2xl overflow-hidden border border-slate-800 bg-slate-900 shadow-xl transition-all duration-300`}
        >
          <div className="px-4 py-2 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <Laptop className="w-4 h-4 text-emerald-400" />
              <span className="font-semibold text-slate-200">
                {leftMode === 'host' ? '光年跃迁 宿主网站 (/demo?dual=0)' : '访客端聊天窗 (/chat)'}
              </span>
              <span className="text-[10px] bg-emerald-950 text-emerald-400 px-1.5 py-0.2 rounded border border-emerald-800">
                {leftMode === 'host' ? '自动弹出 + 头像收起' : '实时总线'}
              </span>
            </div>
            <button
              type="button"
              onClick={reloadVisitor}
              className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition cursor-pointer"
              title="重载访客窗"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex-1 bg-slate-100 overflow-hidden">
            <iframe
              key={`visitor-${visitorKey}-${leftMode}-${embedMode}`}
              src={leftMode === 'host' ? '/demo?dual=0' : embedMode ? '/chat?embed=1' : '/chat'}
              className="w-full h-full border-0 block"
              title="Visitor View"
            />
          </div>
        </div>

        {/* Right: Agent Workbench Preview (6 or 8 cols) */}
        <div
          className={`${
            leftMode === 'host' ? 'md:col-span-6 lg:col-span-6' : 'md:col-span-8 lg:col-span-8'
          } flex flex-col rounded-2xl overflow-hidden border border-slate-800 bg-slate-900 shadow-xl transition-all duration-300`}
        >
          <div className="px-4 py-2 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <Headphones className="w-4 h-4 text-blue-400" />
              <span className="font-semibold text-slate-200">
                客服坐席工作台 (/agent/conversations)
              </span>
              <span className="text-[10px] bg-blue-950 text-blue-400 px-1.5 py-0.2 rounded border border-blue-800">
                实时草稿感知
              </span>
            </div>
            <button
              type="button"
              onClick={reloadAgent}
              className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition cursor-pointer"
              title="重载工作台"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex-1 bg-white overflow-hidden">
            <iframe
              key={`agent-${agentKey}`}
              src="/agent/conversations"
              className="w-full h-full border-0 block"
              title="Agent Workbench"
            />
          </div>
        </div>
      </div>

      {/* Bottom Testing Tips Banner */}
      <footer className="px-5 py-2 bg-slate-950 border-t border-slate-800 text-[11px] text-slate-400 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5 text-slate-300 font-medium">
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span>核心交互联调验证步骤：</span>
          </span>
          <span>1. 在左侧访客输入框打字（不要发送），观察右侧输入栏上方立即显示实时草稿提示！</span>
          <span>2. 在右侧客服端发送文字、图片、语音或演示视频，验证双向即时同步！</span>
          <span>3. 测试快捷回复与会话转接功能。</span>
        </div>
      </footer>
    </div>
  );
};
