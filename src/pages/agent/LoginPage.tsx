import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { loginAgent } from '../../api';
import { getRememberedLogin, saveRememberedLogin, clearRememberedLogin } from '../../utils/remembered-login';
import { Lock, User, ArrowRight } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as any)?.from || '/agent/conversations';

  // 默认空白：仅当坐席上次勾选「记住登录凭据」时才回填
  const remembered = getRememberedLogin('agent');
  const [account, setAccount] = useState(remembered?.account || '');
  const [password, setPassword] = useState(remembered?.password || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [rememberMe, setRememberMe] = useState(!!remembered);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await loginAgent(account, password);
      // 勾选「记住登录凭据」才落库，下次打开自动回填；不勾则清除旧记录
      if (rememberMe) {
        saveRememberedLogin('agent', { account: account.trim(), password });
      } else {
        clearRememberedLogin('agent');
      }
      navigate(from, { replace: true });
    } catch (err: any) {
      setError(err.message || '登录失败，请检查账号密码');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-900 via-slate-800 to-indigo-950 flex items-center justify-center p-4 relative">
      <div className="max-w-md w-full">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <img
            src="/brand-logo.png"
            alt="光年龙·超级客服"
            className="block w-20 h-20 mb-3 mx-auto drop-shadow-[0_8px_20px_rgba(0,0,0,0.45)]"
          />
          <h1 className="text-4xl font-black tracking-tight text-transparent bg-clip-text bg-linear-to-r from-blue-400 via-indigo-300 to-purple-400">
            光年龙·超级客服
          </h1>
        </div>

        {/* Login Box */}
        <div className="bg-white/95 backdrop-blur-md rounded-2xl p-7 shadow-2xl border border-slate-200">
          <div className="mb-6">
            <h2 className="text-lg font-bold text-slate-900">客服坐席登录</h2>
            <p className="text-xs text-slate-500 mt-0.5">请输入您的专属坐席账号以接入实时对话</p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 text-red-700 text-xs rounded-xl border border-red-200 flex items-center gap-2">
              <span className="font-semibold">提示：</span>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">坐席账号</label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
                <input
                  type="text"
                  required
                  value={account}
                  onChange={(e) => setAccount(e.target.value)}
                  placeholder="请输入登录账号"
                  className="w-full pl-9 pr-3 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">登录密码</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="请输入登录密码"
                  className="w-full pl-9 pr-3 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
                />
              </div>
            </div>

            <div className="text-xs">
              <label className="flex items-center gap-2 text-slate-500 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-3.5 h-3.5 accent-blue-600 rounded border-slate-300"
                />
                <span>记住登录凭据</span>
              </label>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white font-medium text-sm rounded-xl shadow-md transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <span>正在验证登录状态...</span>
              ) : (
                <>
                  <span>进入工作台</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </div>
      </div>

      {/* Copyright footer pinned near page bottom */}
      <div className="absolute bottom-9 left-0 right-0 text-center text-[11px] text-slate-500 select-none">
        © 2026 光年跃迁（温州）科技有限公司 版权所有｜在线客服系统
      </div>
    </div>
  );
};
