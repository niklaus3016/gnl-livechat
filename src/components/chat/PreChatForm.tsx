import React, { useState } from 'react';
import { User, Mail, MessageSquare } from 'lucide-react';

interface PreChatFormProps {
  themeColor: string;
  onSubmit: (data: { name: string; email: string; inquiry: string }) => void;
  onCancel?: () => void;
}

export const PreChatForm: React.FC<PreChatFormProps> = ({ themeColor, onSubmit }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [inquiry, setInquiry] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('请输入您的姓名或称谓');
      return;
    }
    if (email && !email.includes('@')) {
      setError('请输入有效的邮箱地址');
      return;
    }
    onSubmit({ name: name.trim(), email: email.trim(), inquiry: inquiry.trim() });
  };

  return (
    <div className="bg-white/95 backdrop-blur-xs p-6 rounded-2xl border border-slate-200/80 shadow-lg max-w-md mx-auto my-auto w-full">
      <div className="text-center mb-5">
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-3 text-white shadow-md"
          style={{ backgroundColor: themeColor }}
        >
          <MessageSquare className="w-6 h-6" />
        </div>
        <h3 className="text-lg font-bold text-slate-800">在开始咨询前</h3>
        <p className="text-xs text-slate-500 mt-1">请填写简要称谓与联系方式，以便专属客服更好地为您服务</p>
      </div>

      {error && (
        <div className="mb-4 p-2.5 bg-red-50 text-red-600 text-xs rounded-lg border border-red-200">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-3.5">
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">您的称呼 *</label>
          <div className="relative">
            <User className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              required
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError('');
              }}
              placeholder="例如：王先生 / 某公司采购部"
              className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">联系邮箱 (选填)</label>
          <div className="relative">
            <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setError('');
              }}
              placeholder="用于接收跟进解答或资料"
              className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">咨询主要诉求 (选填)</label>
          <textarea
            value={inquiry}
            onChange={(e) => setInquiry(e.target.value)}
            rows={2}
            placeholder="例如：了解私有化部署价格..."
            className="w-full p-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition resize-none"
          />
        </div>

        <button
          type="submit"
          className="w-full py-2.5 rounded-xl text-white font-medium text-sm shadow-md hover:opacity-95 active:scale-[0.99] transition cursor-pointer"
          style={{ backgroundColor: themeColor }}
        >
          开始在线咨询
        </button>
      </form>
    </div>
  );
};
