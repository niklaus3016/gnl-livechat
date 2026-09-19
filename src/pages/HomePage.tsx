import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  Headphones,
  Laptop,
  Sparkles,
  Zap,
  ShieldCheck,
  Building2,
  ExternalLink,
  ArrowRight,
  Code2,
  BarChart3,
} from 'lucide-react';

export const HomePage: React.FC = () => {
  return (
    <div className="h-screen overflow-y-auto bg-linear-to-br from-slate-900 via-slate-800 to-indigo-950 text-white flex flex-col justify-between p-6 sm:p-12 font-sans">
      <div className="max-w-5xl mx-auto w-full">
        {/* Brand Header */}
        <div className="flex items-center justify-between mb-12">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/30">
              <Headphones className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">光年跃迁 · 全渠道在线客服系统</h1>
              <p className="text-xs text-slate-400">Visitor Chat & Agent Workbench Solution</p>
            </div>
          </div>
          <span className="text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-3 py-1 rounded-full font-medium">
            ● 纯前端 Mock 状态就绪
          </span>
        </div>

        {/* Hero Pitch */}
        <div className="mb-10">
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight max-w-2xl leading-tight">
            企业级在线客服交互架构
            <span className="block text-transparent bg-clip-text bg-linear-to-r from-blue-400 to-teal-300">
              访客草稿预知 · 内部备注协同 · 多端嵌入
            </span>
          </h2>
          <p className="mt-3 text-sm text-slate-300 max-w-2xl leading-relaxed">
            基于统一 API Hooks 与内存 WebSocket 事件总线驱动，实现了访客端打字实时草稿预知、已读回执、快捷回复模板库、坐席会话转接及租户全局外观配置。
          </p>
        </div>

        {/* Entry Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-10">
          {/* Card 0: Admin Console (/admin) */}
          <NavLink
            to="/admin"
            className="group p-5 rounded-2xl bg-linear-to-b from-indigo-900/40 to-slate-900/80 border border-indigo-500/40 hover:border-indigo-400 hover:shadow-2xl hover:shadow-indigo-500/20 transition flex flex-col justify-between"
          >
            <div>
              <div className="inline-flex p-2.5 rounded-xl bg-indigo-600/30 text-indigo-300 mb-3">
                <Building2 className="w-5 h-5" />
              </div>
              <div className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider mb-1">
                🏢 企业主管理
              </div>
              <h3 className="text-sm font-bold text-white mb-1.5 group-hover:text-indigo-200">
                /admin 企业管理控制台
              </h3>
              <p className="text-[11.5px] text-slate-300 leading-relaxed">
                面向企业主：SLA 数据报表、访客聊天窗外观配置与坐席团队统一管理。
              </p>
              <div className="mt-2 text-[10.5px] text-indigo-400/90 flex items-center gap-1">
                <span>企业主请访问</span>
                <span className="underline hover:text-white">/admin/login 登录页</span>
              </div>
            </div>
            <div className="mt-4 flex items-center gap-1 text-xs font-semibold text-indigo-300 group-hover:translate-x-1 transition">
              <span>进入管理后台</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </NavLink>

          {/* Card: Service Quality & SLA Report */}
          <NavLink
            to="/agent/analytics"
            className="group p-5 rounded-2xl bg-linear-to-b from-emerald-950/50 to-slate-900/80 border border-emerald-500/40 hover:border-emerald-400 hover:shadow-2xl hover:shadow-emerald-500/20 transition flex flex-col justify-between"
          >
            <div>
              <div className="inline-flex p-2.5 rounded-xl bg-emerald-600/30 text-emerald-300 mb-3">
                <BarChart3 className="w-5 h-5" />
              </div>
              <div className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider mb-1">
                📊 数据可视化报表
              </div>
              <h3 className="text-sm font-bold text-white mb-1.5 group-hover:text-emerald-200">
                服务质量与 SLA 报表
              </h3>
              <p className="text-[11.5px] text-slate-300 leading-relaxed">
                首次响应耗时(FRT)、解决时长(ART)、全渠道咨询波峰、满意度星级与坐席排行榜。
              </p>
            </div>
            <div className="mt-4 flex items-center gap-1 text-xs font-semibold text-emerald-300 group-hover:translate-x-1 transition">
              <span>查看数据报表看板</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </NavLink>

          {/* Card 1: WgetCloud User Center Host Demo (Auto popup + Avatar) */}
          <NavLink
            to="/demo"
            className="group p-5 rounded-2xl bg-linear-to-b from-blue-900/40 to-slate-900/80 border border-blue-500/40 hover:border-blue-400 hover:shadow-2xl hover:shadow-blue-500/20 transition flex flex-col justify-between"
          >
            <div>
              <div className="inline-flex p-2.5 rounded-xl bg-blue-600/30 text-blue-300 mb-3">
                <Sparkles className="w-5 h-5" />
              </div>
              <div className="text-[10px] font-bold text-blue-400 uppercase tracking-wider mb-1">
                ⭐ 宿主站点体验
              </div>
              <h3 className="text-sm font-bold text-white mb-1.5 group-hover:text-blue-200">
                用户中心浮窗演示
              </h3>
              <p className="text-[11.5px] text-slate-300 leading-relaxed">
                进站 3 秒自动弹窗；右上角最小化收缩为右下角客服头像；点击头像展开。
              </p>
            </div>
            <div className="mt-4 flex items-center gap-1 text-xs font-semibold text-blue-300 group-hover:translate-x-1 transition">
              <span>进入宿主体验</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </NavLink>

          {/* Card 2: Dual View Tester (Recommended) */}
          <NavLink
            to="/tester"
            className="group p-5 rounded-2xl bg-linear-to-b from-purple-900/40 to-slate-900/80 border border-purple-500/30 hover:border-purple-400 hover:shadow-2xl hover:shadow-purple-500/20 transition flex flex-col justify-between"
          >
            <div>
              <div className="inline-flex p-2.5 rounded-xl bg-purple-600/30 text-purple-300 mb-3">
                <Zap className="w-5 h-5" />
              </div>
              <div className="text-[10px] font-bold text-purple-400 uppercase tracking-wider mb-1">
                双端联动测试
              </div>
              <h3 className="text-sm font-bold text-white mb-1.5 group-hover:text-purple-200">
                双屏实时联动视窗
              </h3>
              <p className="text-[11.5px] text-slate-300 leading-relaxed">
                同屏左右分屏对比：左侧访客打字，右侧客服实时感知草稿与消息交互。
              </p>
            </div>
            <div className="mt-4 flex items-center gap-1 text-xs font-semibold text-purple-300 group-hover:translate-x-1 transition">
              <span>同屏联动视窗</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </NavLink>

          {/* Card 3: Visitor Chat */}
          <NavLink
            to="/chat"
            className="group p-5 rounded-2xl bg-slate-800/60 border border-slate-700/80 hover:border-blue-500 hover:shadow-xl transition flex flex-col justify-between"
          >
            <div>
              <div className="inline-flex p-2.5 rounded-xl bg-blue-600/20 text-blue-400 mb-3">
                <Laptop className="w-5 h-5" />
              </div>
              <div className="text-[10px] font-bold text-blue-400 uppercase tracking-wider mb-1">
                独立视窗
              </div>
              <h3 className="text-sm font-bold text-white mb-1.5 group-hover:text-blue-200">
                /chat 访客聊天窗口
              </h3>
              <p className="text-[11.5px] text-slate-300 leading-relaxed">
                Crisp 1:1 复刻设计、微信式按住说话语音录制 HUD、圆角阴影呼吸发光。
              </p>
            </div>
            <div className="mt-4 flex items-center gap-1 text-xs font-semibold text-blue-400 group-hover:translate-x-1 transition">
              <span>进入访客端</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </NavLink>

          {/* Card 4: Agent Workbench */}
          <NavLink
            to="/agent/conversations"
            className="group p-5 rounded-2xl bg-slate-800/60 border border-slate-700/80 hover:border-emerald-500 hover:shadow-xl transition flex flex-col justify-between"
          >
            <div>
              <div className="inline-flex p-2.5 rounded-xl bg-emerald-600/20 text-emerald-400 mb-3">
                <Headphones className="w-5 h-5" />
              </div>
              <div className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider mb-1">
                客服坐席运营
              </div>
              <h3 className="text-sm font-bold text-white mb-1.5 group-hover:text-emerald-200">
                /agent/* 客服工作台
              </h3>
              <p className="text-[11.5px] text-slate-300 leading-relaxed">
                会话接待、实时草稿侦测、快捷回复模板库、会话转接及租户管理。
              </p>
            </div>
            <div className="mt-4 flex items-center gap-1 text-xs font-semibold text-emerald-400 group-hover:translate-x-1 transition">
              <span>进入客服工作台</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </NavLink>
        </div>

        {/* Integration Script Code Box */}
        <div className="bg-slate-950/60 rounded-2xl border border-slate-800 p-5 backdrop-blur-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
              <Code2 className="w-4 h-4 text-blue-400" />
              <span>客户网站嵌入脚本 (public/widget.js)</span>
            </div>
            <a
              href="/widget-demo.html"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs text-cyan-400 hover:underline"
            >
              <span>查看静态网站嵌入演示 (widget-demo.html)</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>

          <div className="p-3 bg-slate-900 rounded-xl font-mono text-xs text-slate-300 overflow-x-auto border border-slate-800/80">
            <code>
              {`<script src="https://your-domain.com/widget.js" data-tenant-id="tenant_aurora_01" async></script>`}
            </code>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="max-w-5xl mx-auto w-full pt-8 text-center text-xs text-slate-500 border-t border-slate-800/80 mt-12">
        <span>光年跃迁在线客服系统 · TypeScript + React 18 + Tailwind CSS + Mock EventBus</span>
      </footer>
    </div>
  );
};
