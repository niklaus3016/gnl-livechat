import React from 'react';
import { ConversationSidebar } from '../../components/agent/ConversationSidebar';
import { MessageSquareDashed, ArrowLeft, Zap, LayoutTemplate } from 'lucide-react';

export const ConversationsPage: React.FC = () => {
  return (
    <div className="h-full w-full flex overflow-hidden">
      {/* Left Conversations Sidebar */}
      <ConversationSidebar />

      {/* Right Blank Welcome State */}
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-slate-50/70 text-center select-none">
        <div className="w-16 h-16 rounded-3xl bg-blue-100/60 text-blue-600 flex items-center justify-center mb-4 border border-blue-200/60 shadow-xs">
          <MessageSquareDashed className="w-8 h-8" />
        </div>

        <h3 className="text-lg font-bold text-slate-800 mb-1">未选中任何接待会话</h3>
        <p className="text-xs text-slate-500 max-w-sm mb-6 leading-relaxed">
          请在左侧会话列表中点击一条进行中的咨询会话，即可展开实时聊天面板、查看访客画像与输入草稿。
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-md w-full text-left">
          <div className="p-3 bg-white rounded-xl border border-slate-200/80 shadow-2xs">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800 mb-1">
              <Zap className="w-4 h-4 text-amber-500" />
              <span>访客草稿实时预知</span>
            </div>
            <p className="text-[11px] text-slate-500">
              访客在输入框打字时，即使未点击发送，坐席端也能实时捕获草稿内容，提前构思，精准答复，提升成交率与满意度。
            </p>
          </div>

          <div className="p-3 bg-white rounded-xl border border-slate-200/80 shadow-2xs">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800 mb-1">
              <LayoutTemplate className="w-4 h-4 text-emerald-500" />
              <span>快捷模板一键回复</span>
            </div>
            <p className="text-[11px] text-slate-500">
              在坐席偏好中维护专属快捷回复模板，会话中一键选中即可填充话术发送，大幅提升响应效率。
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
