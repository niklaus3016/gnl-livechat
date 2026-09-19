import React, { useEffect, useRef, useState } from 'react';
import { getCurrentAgentToken, updateAgentProfile, getAgentList, IS_MOCK, updateStoredAgentProfile, getTenantConfig } from '../../../api';
import { mockWsBus } from '../../../lib/mock/mock-ws-bus';
import { realSocket } from '../../../lib/real/socket-service';
import { TENANT_KEY } from '../../../api/http';
import { AgentStatus, AgentUser, JwtTokenPayload } from '../../../types';
import {
  UserCheck,
  Shield,
  Mail,
  CheckCircle2,
  Save,
  Sparkles,
  ChevronDown,
  Info,
  BadgeCheck,
  ExternalLink,
  Image as ImageIcon,
  UploadCloud,
  Smile,
  Paperclip,
  Mic,
  Send,
  Minus,
  MoreVertical,
} from 'lucide-react';

// Curated professional avatar presets — one male, one female (local assets in public/avatars/)
const AGENT_AVATAR_PRESETS = [
  {
    label: '职场精英 · 男士',
    url: '/avatars/agent-male.png',
  },
  {
    label: '职场精英 · 女士',
    url: '/avatars/agent-female.png',
  },
];

export const ProfilePage: React.FC = () => {
  const [userToken, setUserToken] = useState<JwtTokenPayload | null>(getCurrentAgentToken());
  const [nickname, setNickname] = useState('');
  const [avatar, setAvatar] = useState(
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80'
  );
  const [title, setTitle] = useState('在线技术支持');
  const [bio, setBio] = useState(
    '欢迎咨询，我们将竭诚为您解答产品、计费与系统对接相关疑问。'
  );
  const [status, setStatus] = useState<AgentStatus>('online');
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [avatarError, setAvatarError] = useState('');
  const [tenantName, setTenantName] = useState('');
  const avatarFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getTenantConfig(TENANT_KEY)
      .then((c) => setTenantName(c.tenant_name || ''))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    const token = getCurrentAgentToken();
    if (token) {
      setUserToken(token);
      setNickname(token.nickname || '');
      if (token.avatar) setAvatar(token.avatar);
      if (token.title) setTitle(token.title);
      if (token.bio) setBio(token.bio);
    }

    // Also fetch the full agent record if available
    getAgentList()
      .then((agents) => {
        const found = agents.find((a) => a.userId === token?.userId);
        if (found) {
          if (found.nickname) setNickname(found.nickname);
          if (found.avatar) setAvatar(found.avatar);
          if (found.title) setTitle(found.title);
          if (found.bio) setBio(found.bio);
        }
      })
      .catch((err) => console.error(err));
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nickname.trim()) return;

    try {
      setLoading(true);
      const updatedAgent = await updateAgentProfile({
        nickname: nickname.trim(),
        avatar: avatar.trim(),
        title: title.trim(),
        bio: bio.trim(),
        status,
      });
      // Sync the locally cached JWT user so the sidebar avatar/name update
      // immediately without a page reload.
      updateStoredAgentProfile({
        avatar_url: avatar.trim(),
        display_name: nickname.trim(),
        title: title.trim(),
        bio: bio.trim(),
      });
      const updated = getCurrentAgentToken();
      setUserToken(updated);
      // Broadcast: same-browser visitor tabs update instantly (full profile rides
      // along); real backend relays agent_status so cross-browser visitors refetch.
      mockWsBus.send('agent_updated', updatedAgent);
      if (!IS_MOCK) realSocket.agentStatus(status);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3500);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="min-h-full p-6 md:p-8 max-w-6xl mx-auto space-y-6 flex flex-col justify-center">
      {/* Page Header */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-end">
        <div className="lg:col-span-7">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900">坐席个人接待资料与状态</h1>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-semibold border border-blue-200">
              坐席自主配置
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            配置您专属的对外接待形象、专业头衔与访客点击三角形展开时的个性化介绍卡片，提升服务专业度与信任感
          </p>
        </div>
        <div className="lg:col-span-5 flex items-center justify-between">
          <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-blue-600" />
            <span>访客端实际展示效果 1:1 实时预览</span>
          </span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200">
            实时渲染中
          </span>
        </div>
      </div>

      {savedSuccess && (
        <div className="p-3.5 bg-emerald-50 text-emerald-800 text-xs rounded-xl border border-emerald-200 flex items-center justify-between shadow-2xs animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-medium">
              个人头像、头衔标签与接待介绍已成功保存并实时生效！访客点击顶部三角即可查看最新卡片。
            </span>
          </div>
        </div>
      )}

      {/* Main 2-Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Form (7 Cols) */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 shadow-2xs p-6 space-y-6">
          <form onSubmit={handleSave} className="space-y-6">
            {/* 1. Avatar Configuration */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <span>1. 坐席专属对外头像</span>
                  <span className="text-red-500">*</span>
                </label>
              </div>

              <input
                ref={avatarFileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  // reset so selecting the same file again still triggers change
                  e.target.value = '';
                  if (!file) return;
                  const MAX_AVATAR_BYTES = 2 * 1024 * 1024; // 2 MB
                  if (!file.type.startsWith('image/')) {
                    setAvatarError('请选择图片文件（PNG / JPG / WEBP / GIF）');
                    return;
                  }
                  if (file.size > MAX_AVATAR_BYTES) {
                    setAvatarError(`图片大小不能超过 2MB（当前 ${(file.size / 1024 / 1024).toFixed(1)}MB）`);
                    return;
                  }
                  setAvatarError('');
                  const reader = new FileReader();
                  reader.onload = () => setAvatar(reader.result as string);
                  reader.readAsDataURL(file);
                }}
              />

              {/* Current Avatar + Presets Grid */}
              <div className="flex items-center gap-4 mb-3 p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                <div className="relative shrink-0">
                  <button
                    type="button"
                    onClick={() => avatarFileRef.current?.click()}
                    className="relative group cursor-pointer"
                    title="点击更换头像"
                  >
                    <img
                      src={avatar}
                      alt={nickname}
                      className="w-14 h-14 rounded-full object-cover border-2 border-white shadow-sm ring-2 ring-blue-500/20"
                    />
                    <div className="absolute inset-0 rounded-full bg-slate-900/0 group-hover:bg-slate-900/40 transition flex items-center justify-center">
                      <UploadCloud className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition" />
                    </div>
                  </button>
                  <span
                    className={`absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-white ${
                      status === 'online'
                        ? 'bg-[#00c853]'
                        : status === 'away'
                        ? 'bg-amber-500'
                        : 'bg-slate-400'
                    }`}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <span>当前展示头像</span>
                    <BadgeCheck className="w-3.5 h-3.5 text-blue-600" />
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    访客进线分配给您时，聊天头部与消息气泡将直接展示此头像。
                  </p>
                  <p className="text-[11px] text-blue-600 mt-0.5">
                    点击头像可进行自由替换（限 PNG/JPG/WEBP/GIF，≤ 2MB）
                  </p>
                  {avatarError && (
                    <p className="text-[11px] text-red-600 mt-0.5">{avatarError}</p>
                  )}
                </div>
              </div>

              {/* Presets */}
              <div>
                <span className="block text-[11px] text-slate-500 font-medium mb-1.5">
                  从职场形象库快捷选择：
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {AGENT_AVATAR_PRESETS.map((p) => (
                    <button
                      key={p.url}
                      type="button"
                      onClick={() => setAvatar(p.url)}
                      className={`flex items-center gap-2 p-2 rounded-xl border text-left transition cursor-pointer ${
                        avatar === p.url
                          ? 'bg-blue-50/80 border-blue-500 ring-1 ring-blue-500 text-blue-900 font-semibold'
                          : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <img
                        src={p.url}
                        alt={p.label}
                        className="w-7 h-7 rounded-full object-cover border border-slate-200 shrink-0"
                      />
                      <span className="text-[11px] truncate">{p.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* 2. Display Name & Title Tag */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1.5">
                  2. 对外展示称谓 (姓名) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder="例如：James / 架构顾问小王"
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1.5">
                  3. 专业头衔 / 岗位标签 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="例如：在线技术支持 / VIP专属顾问"
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
                />
              </div>
            </div>

            {/* 3. Bio / Introduction (点开三角形展开的介绍寄语) */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <span>4. 坐席欢迎介绍 (点开三角形展开展示)</span>
                  <span className="text-red-500">*</span>
                </label>
                <span className="text-[11px] text-slate-400">{bio.length} / 120 字</span>
              </div>
              <textarea
                rows={3}
                required
                maxLength={120}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="例如：欢迎咨询，我们将竭诚为您解答产品、计费与系统对接相关疑问。"
                className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition leading-relaxed"
              />
            </div>

            {/* 4. Reception Status */}
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-2">5. 当前接待状态</label>
              <div className="grid grid-cols-3 gap-3">
                <label
                  className={`flex items-center gap-2.5 p-3 rounded-xl border cursor-pointer transition ${
                    status === 'online'
                      ? 'bg-emerald-50/70 border-emerald-500 shadow-xs ring-1 ring-emerald-500/30'
                      : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="status"
                    value="online"
                    checked={status === 'online'}
                    onChange={() => setStatus('online')}
                    className="text-emerald-600 focus:ring-emerald-500"
                  />
                  <div>
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      <span>在线接待</span>
                    </div>
                    <div className="text-[10px] text-slate-400">自动接入新分配访客</div>
                  </div>
                </label>

                <label
                  className={`flex items-center gap-2.5 p-3 rounded-xl border cursor-pointer transition ${
                    status === 'away'
                      ? 'bg-amber-50/70 border-amber-500 shadow-xs ring-1 ring-amber-500/30'
                      : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="status"
                    value="away"
                    checked={status === 'away'}
                    onChange={() => setStatus('away')}
                    className="text-amber-600 focus:ring-amber-500"
                  />
                  <div>
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800">
                      <span className="w-2 h-2 rounded-full bg-amber-500" />
                      <span>暂时离开</span>
                    </div>
                    <div className="text-[10px] text-slate-400">临时忙碌或小憩</div>
                  </div>
                </label>

                <label
                  className={`flex items-center gap-2.5 p-3 rounded-xl border cursor-pointer transition ${
                    status === 'offline'
                      ? 'bg-slate-100 border-slate-500 shadow-xs ring-1 ring-slate-400'
                      : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="status"
                    value="offline"
                    checked={status === 'offline'}
                    onChange={() => setStatus('offline')}
                    className="text-slate-600 focus:ring-slate-500"
                  />
                  <div>
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800">
                      <span className="w-2 h-2 rounded-full bg-slate-400" />
                      <span>完全离线</span>
                    </div>
                    <div className="text-[10px] text-slate-400">停止接收新咨询</div>
                  </div>
                </label>
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
              <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-blue-500" />
                <span>保存后将立即同步给所有正在与您沟通的访客窗口</span>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-xs font-semibold rounded-xl shadow-md shadow-blue-600/25 transition disabled:opacity-40 cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>{loading ? '正在保存...' : '保存个人资料与接待配置'}</span>
              </button>
            </div>
          </form>
        </div>

        {/* Right Live Preview Card (5 Cols) */}
        <div className="lg:col-span-5 space-y-4 sticky top-6">

          {/* Crisp Chat Window Header Mockup — 1:1 复刻访客端 ChatHeader */}
          <div
            className="text-white rounded-t-[22px] shadow-md shrink-0"
            style={{ backgroundColor: '#1972f5' }}
          >
            {/* Top Row: [Minimize] [聊天 Pill] [More ⋮] */}
            <div className="px-3.5 pt-3 pb-2 flex items-center justify-between">
              <button
                type="button"
                className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white cursor-default"
              >
                <Minus className="w-4 h-4 stroke-[2.5]" />
              </button>

              <div
                className="p-0.5 rounded-full flex items-center"
                style={{
                  backgroundColor: 'rgba(0, 0, 0, 0.22)',
                  boxShadow: 'inset 0 1.5px 3px rgba(0,0,0,0.32)',
                }}
              >
                <div
                  className="px-4 py-1 rounded-full text-xs font-semibold text-white flex items-center gap-1.5 cursor-default select-none"
                  style={{
                    background:
                      'linear-gradient(180deg, rgba(255, 255, 255, 0.32) 0%, rgba(255, 255, 255, 0.05) 52%, rgba(0, 0, 0, 0.22) 100%), #1972f5',
                    boxShadow:
                      '0 2.5px 5px rgba(0, 0, 0, 0.32), inset 0 1px 1px rgba(255, 255, 255, 0.45), inset 0 -1px 1px rgba(0, 0, 0, 0.22)',
                    borderTop: '1px solid rgba(255, 255, 255, 0.42)',
                  }}
                >
                  <svg viewBox="0 0 20 20" width="13" height="13" fill="currentColor">
                    <path d="M18 10c0 3.866-3.582 7-8 7-1.077 0-2.096-.186-3.018-.521L3 17.5l.872-2.913C3.327 13.336 3 11.724 3 10c0-3.866 3.582-7 8-7s8 3.134 8 7z" />
                  </svg>
                  <span className="tracking-wide">聊天</span>
                </div>
              </div>

              <button
                type="button"
                className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white cursor-default"
              >
                <MoreVertical className="w-4 h-4" />
              </button>
            </div>

            {/* Second Row: Agent Status Bar */}
            <div className="px-4 pb-3 pt-0.5 flex items-center justify-center">
              <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-white/10 text-white text-xs font-medium">
                <div className="relative shrink-0">
                  <img
                    src={avatar}
                    alt={nickname}
                    className="w-6 h-6 rounded-full object-cover border border-white/80"
                  />
                  <span
                    className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[#1972f5] ${
                      status === 'online'
                        ? 'bg-[#00c853]'
                        : status === 'away'
                        ? 'bg-amber-400'
                        : 'bg-slate-400'
                    }`}
                  />
                </div>
                <span>
                  {nickname || '坐席姓名'} 来自 {tenantName || '企业服务'}
                </span>
                <div className="w-4 h-4 rounded bg-white/20 flex items-center justify-center">
                  <ChevronDown className="w-3 h-3 text-white" />
                </div>
              </div>
            </div>
          </div>

          {/* Opened Agent Card (Directly showing what the visitor sees when clicking the triangle!) */}
          <div className="bg-white rounded-b-[22px] border border-slate-200 border-t-0 p-4 shadow-lg space-y-3">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-blue-600 bg-blue-50/80 px-2.5 py-1 rounded-lg border border-blue-100">
              <ChevronDown className="w-3.5 h-3.5" />
              <span>👇 访客点击顶部三角形时展开的专属坐席卡片：</span>
            </div>

            {/* The Actual Dropdown Card */}
            <div className="bg-white rounded-2xl shadow-md border border-slate-200 p-4 text-xs">
              <div className="flex items-start gap-3">
                <div className="relative shrink-0">
                  <img
                    src={avatar}
                    alt={nickname}
                    className="w-11 h-11 rounded-full object-cover border border-slate-200 shadow-xs"
                  />
                  <span
                    className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white ${
                      status === 'online'
                        ? 'bg-[#00c853]'
                        : status === 'away'
                        ? 'bg-amber-500'
                        : 'bg-slate-400'
                    }`}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 font-bold text-slate-900 text-[13px] flex-wrap">
                    <span>{nickname || '您的昵称'}</span>
                    <span className="text-[11px] font-medium text-slate-500 px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200/80">
                      · {title || '在线技术支持'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-[11px] text-emerald-600 mt-1 font-medium">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>极速响应中 · 官方认证</span>
                  </div>
                  <p className="text-slate-600 text-[11.5px] mt-2 leading-relaxed bg-slate-50/80 p-2.5 rounded-xl border border-slate-100">
                    {bio || '欢迎咨询，我们将竭诚为您提供专业服务。'}
                  </p>
                </div>
              </div>
            </div>

            {/* Visitor-side message input (preview only) */}
            <div className="rounded-2xl border border-slate-200 bg-white p-2.5 shadow-xs mt-[215px]">
              <textarea
                readOnly
                placeholder="输入你的信息..."
                className="w-full resize-none bg-transparent text-xs text-slate-400 placeholder:text-slate-300 outline-hidden px-1 py-1 min-h-[44px]"
              />
              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center gap-3 text-slate-400">
                  <Smile className="w-4.5 h-4.5" />
                  <Paperclip className="w-4.5 h-4.5" />
                  <Mic className="w-4.5 h-4.5" />
                </div>
                <div className="w-7 h-7 rounded-full bg-blue-500 flex items-center justify-center text-white">
                  <Send className="w-3.5 h-3.5" />
                </div>
              </div>
            </div>
          </div>
      </div>
    </div>
    </div>
    </div>
  );
};
