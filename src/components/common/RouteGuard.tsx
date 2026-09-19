import React, { useEffect, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { getCurrentAgentToken, loginAgent } from '../../api';
import { Role } from '../../types';
import { AlertCircle, ShieldAlert, ArrowLeft, ShieldCheck, Building2, UserCheck } from 'lucide-react';

interface RouteGuardProps {
  children: React.ReactNode;
  allowedRoles?: Role[];
}

export const RouteGuard: React.FC<RouteGuardProps> = ({ children, allowedRoles }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [token, setToken] = useState(getCurrentAgentToken());
  const [isSwitching, setIsSwitching] = useState(false);

  useEffect(() => {
    // Re-check token on route change
    setToken(getCurrentAgentToken());
  }, [location.pathname]);

  const handleQuickSwitch = async (account: string) => {
    try {
      setIsSwitching(true);
      await loginAgent(account, 'admin123456');
      setToken(getCurrentAgentToken());
      // Refresh to current route or target route
      navigate(location.pathname, { replace: true });
    } catch (e: any) {
      alert(e.message || '角色切换失败');
    } finally {
      setIsSwitching(false);
    }
  };

  if (!token) {
    // 独立登录入口：平台超管走 /super/login（内部入口），企业主走 /admin/login，坐席走 /agent/login
    const loginTarget = location.pathname.startsWith('/super')
      ? '/super/login'
      : location.pathname.startsWith('/admin')
        ? '/admin/login'
        : '/agent/login';
    return <Navigate to={loginTarget} state={{ from: location.pathname }} replace />;
  }

  // Super admin accessing agent workbench: redirect or allow
  if (token.role === 'super_admin' && !allowedRoles?.includes('super_admin')) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-2xl p-8 border border-red-200 shadow-sm text-center">
          <div className="w-14 h-14 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <ShieldAlert className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">超级管理员专区</h2>
          <p className="text-sm text-slate-600 mb-6">
            系统检测到当前身份为<strong>平台超级管理员 (super_admin)</strong>。
            客服坐席工作台为企业日常接待区，请前往全平台多租户管理后台。
          </p>
          <div className="flex gap-3 justify-center">
            <a
              href="/admin"
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition"
            >
              前往全平台管理后台 (/admin)
            </a>
            <a
              href="/agent/login"
              className="px-4 py-2 bg-slate-100 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-200 transition"
            >
              切换坐席登录
            </a>
          </div>
        </div>
      </div>
    );
  }

  // Role permission check (e.g. tenant settings / agents / admin)
  if (allowedRoles && !allowedRoles.includes(token.role)) {
    const isAccessingAdmin = location.pathname.startsWith('/admin');

    return (
      <div className="min-h-screen bg-slate-900/95 flex items-center justify-center p-6">
        <div className="max-w-lg w-full bg-slate-800 rounded-2xl p-8 border border-slate-700 shadow-2xl text-center">
          <div className="w-14 h-14 bg-amber-500/10 text-amber-400 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-amber-500/20">
            <AlertCircle className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-bold text-white mb-1.5">403 权限不足</h2>
          <p className="text-sm text-slate-300 mb-4">
            您当前登录的账号为 <span className="text-amber-400 font-semibold">{token.nickname}</span> (普通坐席角色：<code className="text-xs bg-slate-900 px-1.5 py-0.5 rounded text-slate-400">agent</code>)。
          </p>

          <div className="bg-slate-900/80 rounded-xl p-4 border border-slate-700/60 mb-6 text-left">
            <div className="text-xs font-semibold text-slate-300 mb-2 flex items-center gap-1.5">
              <span>🎯 页面访问限制说明：</span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              {isAccessingAdmin ? (
                <>
                  <code className="text-indigo-400 font-mono">/admin</code> 管理控制台仅向<strong>平台超级管理员</strong> (<code className="text-purple-400">super_admin</code>) 或 <strong>企业主租户管理员</strong> (<code className="text-blue-400">tenant_admin</code>) 开放。
                </>
              ) : (
                <>
                  该配置页面仅向<strong>租户管理员</strong> (<code className="text-blue-400">tenant_admin</code>) 开放。
                </>
              )}
            </p>
          </div>

          {/* One-click fast role switch for seamless testing */}
          <div className="mb-6 text-left">
            <div className="text-xs font-medium text-slate-400 mb-2">⚡ 快速切换至管理权限账号：</div>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                disabled={isSwitching}
                onClick={() => handleQuickSwitch('admin')}
                className="flex items-center gap-2.5 p-3 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/40 text-left transition cursor-pointer text-white disabled:opacity-50"
              >
                <div className="w-8 h-8 rounded-lg bg-purple-600/40 flex items-center justify-center text-purple-300 shrink-0">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-purple-200 truncate">租户管理员 admin</div>
                  <div className="text-[10px] text-purple-300/70 truncate">配置外观/坐席团队</div>
                </div>
              </button>

              <button
                type="button"
                disabled={isSwitching}
                onClick={() => handleQuickSwitch('agent01')}
                className="flex items-center gap-2.5 p-3 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/40 text-left transition cursor-pointer text-white disabled:opacity-50"
              >
                <div className="w-8 h-8 rounded-lg bg-blue-600/40 flex items-center justify-center text-blue-300 shrink-0">
                  <Building2 className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-blue-200 truncate">在线坐席 agent01</div>
                  <div className="text-[10px] text-blue-300/70 truncate">客服会话接待</div>
                </div>
              </button>
            </div>
          </div>

          <div className="flex items-center justify-center gap-3 pt-2 border-t border-slate-700/60">
            <a
              href="/agent/conversations"
              className="inline-flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-medium rounded-lg transition"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              返回客服会话工作台
            </a>
            <a
              href="/admin/login"
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium rounded-lg transition shadow-sm"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              前往管理控制台登录
            </a>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
