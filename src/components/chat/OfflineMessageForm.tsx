import React, { useState } from 'react';
import { Clock, Send, CheckCircle2 } from 'lucide-react';
import { submitOfflineMessage } from '../../api';

interface OfflineMessageFormProps {
  themeColor: string;
  tenantCode: string;
  visitorToken: string;
  workStartTime: string;
  workEndTime: string;
}

export const OfflineMessageForm: React.FC<OfflineMessageFormProps> = ({
  themeColor,
  tenantCode,
  visitorToken,
  workStartTime,
  workEndTime,
}) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !content.trim()) {
      setError('请完整填写姓名和留言内容');
      return;
    }
    if (!email.trim() && !phone.trim()) {
      setError('请至少填写邮箱或手机号中的一项');
      return;
    }

    try {
      setSubmitting(true);
      await submitOfflineMessage({
        tenantCode,
        visitorToken,
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        content: content.trim(),
      });
      setSubmitted(true);
    } catch (err: any) {
      setError(err.message || '提交失败，请稍后重试');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="p-6 bg-slate-50 border-t border-slate-200 text-center">
        <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-3">
          <CheckCircle2 className="w-6 h-6" />
        </div>
        <h4 className="text-base font-bold text-slate-800">留言已成功提交</h4>
        <p className="text-xs text-slate-600 mt-1 max-w-sm mx-auto">
          当前为客服非工作时间（服务时间：{workStartTime} - {workEndTime}）。我们的坐席上班后会第一时间回复您！
        </p>
        <button
          type="button"
          onClick={() => {
            setSubmitted(false);
            setContent('');
          }}
          className="mt-4 px-4 py-1.5 text-xs text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition"
        >
          再次提交留言
        </button>
      </div>
    );
  }

  return (
    <div className="p-4 bg-slate-50/90 border-t border-slate-200">
      <div className="flex items-center gap-2 mb-3 px-1 text-slate-600">
        <Clock className="w-4 h-4 text-amber-500" />
        <span className="text-xs font-medium">
          当前为非工作时间（服务时间：{workStartTime} ~ {workEndTime}），欢迎留下信息：
        </span>
      </div>

      {error && (
        <div className="mb-3 p-2 text-xs bg-red-50 text-red-600 rounded-lg border border-red-200">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-2.5">
        <div className="grid grid-cols-2 gap-2">
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="您的姓名 *"
            className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-hidden focus:border-blue-500"
          />
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="邮箱 (如: user@mail.com)"
            className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-hidden focus:border-blue-500"
          />
        </div>

        <textarea
          required
          rows={2}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="请在此描述您的问题或需求，客服上线后会第一时间跟进..."
          className="w-full p-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-hidden focus:border-blue-500 resize-none"
        />

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white rounded-lg shadow-xs hover:opacity-95 transition disabled:opacity-50 cursor-pointer"
            style={{ backgroundColor: themeColor }}
          >
            <Send className="w-3.5 h-3.5" />
            {submitting ? '提交中...' : '提交留言'}
          </button>
        </div>
      </form>
    </div>
  );
};
