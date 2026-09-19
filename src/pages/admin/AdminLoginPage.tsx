import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { loginAgent, logoutAgent, getCurrentAgentToken } from '../../api';
import {
  ShieldCheck,
  Building2,
  Lock,
  Mail,
  ArrowRight,
  Headphones,
  Sliders,
  Globe,
  Users,
  Server,
  Gauge,
  LayoutGrid,
} from 'lucide-react';

type Variant = 'tenant' | 'super';

interface VariantConfig {
  badge: string;
  badgeEn: string;
  title: string;
  accountLabel: string;
  defaultAccount: string;
  acceptRole: 'tenant_admin' | 'super_admin';
  /** 角色不匹配时的拒绝文案（按误入角色细分） */
  reject: { agent: string; other: string };
  cta: string;
  heroTitle: [string, string];
  heroDesc: string;
  features: { icon: React.ReactNode; title: string; desc: string }[];
  // 完整类名（Tailwind 不支持动态拼接）
  accent: {
    gradient: string;
    iconBg: string;
    button: string;
    ring: string;
    text: string;
    chip: string;
    glow: string;
  };
  showAgentEntry: boolean;
}

const TENANT_CONFIG: VariantConfig = {
  badge: '企业管理控制台',
  badgeEn: 'Enterprise Admin Portal',
  title: '企业主 · 管理中心登录',
  accountLabel: '管理员账号',
  defaultAccount: 'admin',
  acceptRole: 'tenant_admin',
  reject: {
    agent: '此账号为普通在线客服坐席，无企业管理权限，请前往坐席工作台登录。',
    other: '此账号不是企业主/租户管理员账号，无法在此登录。',
  },
  cta: '进入企业管理中心',
  heroTitle: ['打造企业专属在线接待中心', '与全渠道客户服务矩阵'],
  heroDesc: '统一调度坐席团队、定制访客端聊天小部件外观、设置营业时间并全景监控实时接待情况。',
  features: [
    {
      icon: <Sliders className="w-4 h-4" />,
      title: '品牌与欢迎语自配置',
      desc: '主题色无级拾色、欢迎语与营业时间灵活设限。',
    },
    {
      icon: <Users className="w-4 h-4" />,
      title: '坐席席位协同分级',
      desc: '主管权限与普通客服无缝衔接，会话转接高效协同。',
    },
    {
      icon: <Globe className="w-4 h-4" />,
      title: 'JS 一键嵌入',
      desc: '自包含嵌入代码，任意官网一行 script 即可生效。',
    },
    {
      icon: <LayoutGrid className="w-4 h-4" />,
      title: '接待数据实时洞察',
      desc: '会话量、响应时长与满意度看板实时掌握。',
    },
  ],
  accent: {
    gradient: 'from-blue-600 to-indigo-600',
    iconBg: 'bg-blue-500/20 text-blue-400',
    button: 'bg-blue-600 hover:bg-blue-500 shadow-blue-500/20',
    ring: 'focus:border-blue-500 focus:ring-blue-500',
    text: 'text-blue-400',
    chip: 'bg-blue-500/10 border-blue-500/30 text-blue-400',
    glow: 'bg-blue-600/15',
  },
  showAgentEntry: true,
};

const SUPER_CONFIG: VariantConfig = {
  badge: '平台运营后台',
  badgeEn: 'Platform Operations Console',
  title: '平台超级管理员登录',
  accountLabel: '平台超管账号',
  defaultAccount: 'super',
  acceptRole: 'super_admin',
  reject: {
    agent: '此账号为普通坐席账号，无平台运营权限，请勿在此登录。',
    other: '此账号不是平台超级管理员账号，无法在此登录。',
  },
  cta: '进入平台运营后台',
  heroTitle: ['全平台多租户运营', '与系统资源管控中心'],
  heroDesc: '面向平台运营团队：租户开通与封禁、SaaS 套餐计费、全网 WebSocket 流量与系统健康度监控。',
  features: [
    {
      icon: <Building2 className="w-4 h-4" />,
      title: '多租户全生命周期',
      desc: '企业租户一键开通、封禁与资源配额调整。',
    },
    {
      icon: <Server className="w-4 h-4" />,
      title: 'SaaS 套餐与计费',
      desc: '套餐版本、坐席配额与计费策略统一管理。',
    },
    {
      icon: <Gauge className="w-4 h-4" />,
      title: '全网并发监控',
      desc: 'WebSocket 连接数、消息吞吐与节点健康洞察。',
    },
    {
      icon: <ShieldCheck className="w-4 h-4" />,
      title: '平台级权限管控',
      desc: '超管操作独立审计，与租户数据边界严格隔离。',
    },
  ],
  accent: {
    gradient: 'from-purple-600 to-fuchsia-600',
    iconBg: 'bg-purple-500/20 text-purple-400',
    button: 'bg-purple-600 hover:bg-purple-500 shadow-purple-500/20',
    ring: 'focus:border-purple-500 focus:ring-purple-500',
    text: 'text-purple-400',
    chip: 'bg-purple-500/10 border-purple-500/30 text-purple-400',
    glow: 'bg-purple-600/15',
  },
  showAgentEntry: false,
};

export const AdminLoginPage: React.FC<{ variant?: Variant }> = ({ variant: variantProp }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as any)?.from || '/admin';

  // 路由驱动：/super/login 为超管入口，其余 /admin/login 为企业主入口
  const variant: Variant = variantProp || (location.pathname.startsWith('/super') ? 'super' : 'tenant');
  const cfg = variant === 'super' ? SUPER_CONFIG : TENANT_CONFIG;
  const loginPath = variant === 'super' ? '/super/login' : '/admin/login';

  const [account, setAccount] = useState(cfg.defaultAccount);
  const [password, setPassword] = useState('admin123456');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [rememberMe, setRememberMe] = useState(true);

  const currentToken = getCurrentAgentToken();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const user = await loginAgent(account, password);
      // 入口级角色强校验：企业主页只放行 tenant_admin，超管页只放行 super_admin。
      // （后端接口另有 RBAC 兜底，这里保证不发生"进错门"。）
      if (user.role !== cfg.acceptRole) {
        if (user.role === 'agent') throw new Error(cfg.reject.agent);
        throw new Error(cfg.reject.other);
      }
      navigate(from, { replace: true });
    } catch (err: any) {
      setError(err.message || '登录失败，请检查账号与密码');
    } finally {
      setLoading(false);
    }
  };

  // 已登录态：不直接吞掉登录页，明示当前身份，避免"换人登录无感知"
  if (currentToken) {
    const matched = currentToken.role === cfg.acceptRole;
    const roleLabel =
      currentToken.role === 'super_admin'
        ? '平台超级管理员'
        : currentToken.role === 'tenant_admin'
          ? '企业主/租户管理员'
          : '在线客服坐席';
    return (
      <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center p-6">
        <div className="max-w-sm w-full bg-slate-950/80 border border-slate-800 rounded-2xl p-8 text-center shadow-2xl">
          <div className={`w-12 h-12 rounded-xl bg-linear-to-tr ${cfg.accent.gradient} flex items-center justify-center mx-auto mb-4`}>
            {variant === 'super' ? (
              <ShieldCheck className="w-6 h-6 text-white" />
            ) : (
              <Building2 className="w-6 h-6 text-white" />
            )}
          </div>
          <h2 className="text-base font-bold text-white mb-1.5">
            {matched ? '您已登录' : '当前登录身份与本入口不符'}
          </h2>
          <p className="text-xs text-slate-400 mb-6 leading-relaxed">
            当前账号 <span className="text-slate-200 font-medium">{currentToken.account}</span>（{roleLabel}）
            {matched ? `，无需重复登录。` : '，无法从该入口进入，请退出后使用对应账号登录。'}
          </p>
          <div className="flex flex-col gap-2.5">
            {matched && (
              <a
                href="/admin"
                className={`w-full py-2.5 rounded-xl text-white text-xs font-medium bg-linear-to-r ${cfg.accent.gradient} hover:opacity-90 transition`}
              >
                进入控制台
              </a>
            )}
            <button
              type="button"
              onClick={() => {
                logoutAgent();
                window.location.href = loginPath;
              }}
              className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition cursor-pointer"
            >
              退出当前账号
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col justify-between font-sans selection:bg-blue-600 selection:text-white relative overflow-hidden">
      {/* Background Decorative Lighting Gradients */}
      <div className={`absolute -top-40 -left-40 w-96 h-96 ${cfg.accent.glow} rounded-full blur-3xl pointer-events-none`} />
      <div className="absolute top-1/3 -right-40 w-120 h-120 bg-indigo-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 left-1/3 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Top Navbar */}
      <header className="h-16 border-b border-slate-800/80 px-6 sm:px-10 flex items-center justify-between z-10 backdrop-blur-md bg-slate-950/40">
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-xl bg-linear-to-tr ${cfg.accent.gradient} flex items-center justify-center text-white shadow-md`}>
            {variant === 'super' ? <ShieldCheck className="w-5 h-5" /> : <Building2 className="w-5 h-5" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-white tracking-tight text-sm sm:text-base">光年跃迁</span>
              <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold border ${cfg.accent.chip}`}>
                {cfg.badge}
              </span>
            </div>
            <p className="text-[10px] text-slate-400">{cfg.badgeEn}</p>
          </div>
        </div>

        {cfg.showAgentEntry && (
          <a
            href="/agent/login"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition border border-slate-700/60"
          >
            <Headphones className="w-3.5 h-3.5 text-blue-400" />
            <span>前往坐席登录</span>
          </a>
        )}
      </header>

      {/* Main Container */}
      <main className="flex-1 flex items-center justify-center px-4 py-8 sm:px-8 z-10">
        <div className="max-w-5xl w-full grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          {/* Left Column: Branding & Features */}
          <div className="lg:col-span-6 space-y-6 hidden lg:block pr-4">
            <h2 className="text-3xl font-extrabold text-white tracking-tight leading-tight">
              {cfg.heroTitle[0]}
              <span className="block text-transparent bg-clip-text bg-linear-to-r from-blue-400 via-indigo-300 to-purple-400">
                {cfg.heroTitle[1]}
              </span>
            </h2>

            <p className="text-sm text-slate-300 leading-relaxed">{cfg.heroDesc}</p>

            <div className="grid grid-cols-2 gap-3.5 pt-2">
              {cfg.features.map((f) => (
                <div key={f.title} className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700/70">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-2.5 ${cfg.accent.iconBg}`}>
                    {f.icon}
                  </div>
                  <h4 className="text-xs font-bold text-white mb-1">{f.title}</h4>
                  <p className="text-[11px] text-slate-400 leading-normal">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Right Column: Login Card */}
          <div className="lg:col-span-6 w-full max-w-md mx-auto">
            <div className="bg-slate-950/80 backdrop-blur-xl rounded-2xl p-7 sm:p-8 shadow-2xl border border-slate-800/90">
              {/* Title */}
              <div className="mb-6">
                <h3 className="text-lg font-bold text-white">{cfg.title}</h3>
              </div>

              {/* Error Message */}
              {error && (
                <div className="mb-4 p-3 bg-red-500/10 text-red-400 text-xs rounded-xl border border-red-500/20 flex items-start gap-2">
                  <span className="font-bold shrink-0">提示：</span>
                  <span>{error}</span>
                </div>
              )}

              {/* Login Form */}
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">{cfg.accountLabel}</label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      value={account}
                      onChange={(e) => setAccount(e.target.value)}
                      placeholder={cfg.defaultAccount}
                      className={`w-full pl-10.5 pr-3.5 py-3.5 text-sm bg-slate-900 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-1 transition ${cfg.accent.ring}`}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">密码</label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className={`w-full pl-10.5 pr-3.5 py-3.5 text-sm bg-slate-900 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-1 transition ${cfg.accent.ring}`}
                    />
                  </div>
                </div>

                <div className="text-xs pt-0.5">
                  <label className="flex items-center gap-2 text-slate-400 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="w-3.5 h-3.5 accent-blue-600 rounded bg-slate-900 border-slate-700"
                    />
                    <span>记住登录凭据</span>
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className={`w-full py-3.5 px-4 text-white font-medium text-sm rounded-xl shadow-md transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 bg-linear-to-r ${cfg.accent.button}`}
                >
                  {loading ? (
                    <span>正在校验身份权限...</span>
                  ) : (
                    <>
                      <span>{cfg.cta}</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-4 border-t border-slate-800/60 text-center text-xs text-slate-500 z-10">
        <span>
          {variant === 'super'
            ? '光年跃迁 · 平台运营管理后台（内部入口）'
            : '光年跃迁企业在线客服系统 · 企业管理控制台'}
        </span>
      </footer>
    </div>
  );
};
