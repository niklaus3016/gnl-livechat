import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { loginAgent, getTenantConfig } from '../../api';
import { TENANT_KEY } from '../../api/http';
import { Headphones, Lock, Mail, ArrowRight } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as any)?.from || '/agent/conversations';

  const [account, setAccount] = useState('agent01');
  const [password, setPassword] = useState('admin123456');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  // Brand name driven by the same tenant_name field as the visitor widget header
  const [tenantName, setTenantName] = useState('');

  useEffect(() => {
    getTenantConfig(TENANT_KEY)
      .then((c) => setTenantName(c.tenant_name || ''))
      .catch(() => undefined);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await loginAgent(account, password);
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
          <div className="inline-flex p-3 rounded-2xl bg-blue-600/20 border border-blue-500/30 text-blue-400 mb-3 shadow-lg shadow-blue-500/10">
            <Headphones className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            {tenantName ? `${tenantName} · 坐席工作台` : '坐席工作台'}
          </h1>
          <p className="text-sm text-slate-400 mt-1">企业在线客服与接待中心</p>
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
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
                <input
                  type="text"
                  required
                  value={account}
                  onChange={(e) => setAccount(e.target.value)}
                  placeholder="agent01"
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
                  placeholder="••••••••"
                  className="w-full pl-9 pr-3 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
                />
              </div>
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
        © 2026 光年跃迁（温州）科技有限公司 版权所有
      </div>
    </div>
  );
};
