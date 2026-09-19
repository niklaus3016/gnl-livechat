import React, { useEffect, useState } from 'react';
import {
  getPlatformTenants,
  createPlatformTenant,
  updatePlatformTenant,
  renewPlatformTenant,
  getPlatformMetrics,
  getCurrentAgentToken,
  logoutAgent,
  getTenantSetting,
  updateTenantSetting,
  changeTenantPassword,
  getTenantAgents,
  createTenantAgent,
  updateTenantAgent,
  deleteTenantAgent,
  updateAgentProfile,
  agentUploadFile,
  getWidgetEmbed,
} from '../../api';
import { AgentUser, Role, TenantConfig, TenantItem } from '../../types';
import { AnalyticsDashboardView } from '../../components/admin/AnalyticsDashboardView';
import { ConversationMonitorView } from '../../components/admin/ConversationMonitorView';

// 默认机器人头像（访客未分配坐席、由 AI 接待时展示的企业统一形象）
const AI_DEFAULT_AVATAR =
  'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=150&auto=format&fit=crop&q=80';

/** 日期格式化为本地 YYYY-MM-DD（date input 用，避免 toISOString 的 UTC 错位） */
function fmtLocalDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** 基准日期顺延 n 个月（用于开通/续费快捷时长） */
function addMonths(base: Date, months: number): Date {
  const d = new Date(base);
  d.setMonth(d.getMonth() + months);
  return d;
}

/** 租户服务到期状态：'none' 不限期 | 'expired' 已过期 | 'soon' 30 天内到期 | 'ok' 正常 */
function expireState(expireAt: string): { kind: 'none' | 'expired' | 'soon' | 'ok'; days: number } {
  if (!expireAt || expireAt === '—') return { kind: 'none', days: 0 };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.ceil((new Date(`${expireAt}T00:00:00`).getTime() - today.getTime()) / 86400000);
  if (days < 0) return { kind: 'expired', days };
  if (days <= 30) return { kind: 'soon', days };
  return { kind: 'ok', days };
}
import { ChatHeader } from '../../components/chat/ChatHeader';
import { PreChatForm } from '../../components/chat/PreChatForm';
import {
  Building2,
  Shield,
  Users,
  Palette,
  Layers,
  Sparkles,
  BarChart3,
  Search,
  Plus,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Lock,
  Sliders,
  LogOut,
  RefreshCw,
  Code2,
  Clock,
  MessageSquare,
  ChevronRight,
  ChevronLeft,
  Eye,
  Key,
  Copy,
  Check,
  Smile,
  Paperclip,
  Info,
  UploadCloud,
  Trash2,
} from 'lucide-react';

// 格式化加入时间：ISO 字符串 → YYYY-MM-DD HH:mm
const formatJoinTime = (iso?: string): string => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export const AdminConsolePage: React.FC = () => {
  // 当前视图角色固定跟随真实登录身份（独立入口登录，不再支持页面内切换）
  const currentUser = getCurrentAgentToken();
  const activeRole: 'super_admin' | 'tenant_admin' =
    currentUser?.role === 'super_admin' ? 'super_admin' : 'tenant_admin';

  // Navigation tab
  const [superAdminTab, setSuperAdminTab] = useState<'tenants' | 'metrics' | 'global_settings'>('tenants');
  const [tenantAdminTab, setTenantAdminTab] = useState<'analytics' | 'widget' | 'agents' | 'conversations' | 'hours' | 'embed'>('conversations');
  const [previewWidgetMode, setPreviewWidgetMode] = useState<'chat' | 'prechat' | 'minimized'>('chat');
  const [previewPersona, setPreviewPersona] = useState<'bot' | 'agent'>('bot');
  const [editingAgent, setEditingAgent] = useState<AgentUser | null>(null);
  const [showEditAgentModal, setShowEditAgentModal] = useState<boolean>(false);
  const [showResetPwd, setShowResetPwd] = useState(false);
  const [resetPwd, setResetPwd] = useState('');
  const [resetPwdConfirm, setResetPwdConfirm] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState<string>(AI_DEFAULT_AVATAR);
  const [uploadingAvatar, setUploadingAvatar] = useState<boolean>(false);
  const [showAvatarHelp, setShowAvatarHelp] = useState<boolean>(false);
  // 当前选中的头像若不是默认机器人图，则显示为自定义头像预览
  const customAvatarPreview = selectedAvatar && selectedAvatar !== AI_DEFAULT_AVATAR ? selectedAvatar : '';

  const [widgetPosition, setWidgetPosition] = useState<'right' | 'left'>('right');

  // Persistent sidebar collapsed state (matching AgentLayout exactly)
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('admin_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });
  const [isHovered, setIsHovered] = useState<boolean>(false);

  const toggleCollapse = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('admin_sidebar_collapsed', String(next));
      } catch {}
      return next;
    });
    setIsHovered(false);
  };

  const isExpanded = !isCollapsed || isHovered;

  // Super admin state
  const [tenants, setTenants] = useState<TenantItem[]>([]);
  const [metrics, setMetrics] = useState<any>(null);
  const [tenantSearch, setTenantSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [planFilter, setPlanFilter] = useState('all');
  const [loading, setLoading] = useState(false);
  const [showCreateTenantModal, setShowCreateTenantModal] = useState(false);
  const [newTenantData, setNewTenantData] = useState({
    name: '',
    adminEmail: '',
    ownerName: '',
    ownerContact: '',
    username: '',
    password: '',
    maxSeats: 5,
    /** 服务到期日 YYYY-MM-DD，空 = 不限期 */
    expireAt: '',
    /** 本次支付费用（元），字符串态便于输入框留空 */
    paymentAmount: '',
    domain: '',
  });

  // 续费弹窗
  const [renewTenant, setRenewTenant] = useState<TenantItem | null>(null);
  const [renewData, setRenewData] = useState({ expireAt: '', paymentAmount: '' });
  /** 续费顺延基准日（YYYY-MM-DD）：未到期取当前到期日，否则取今天；快捷按钮始终基于它计算 */
  const [renewBase, setRenewBase] = useState('');

  // 修改登录密码（企业主）
  const [pwdData, setPwdData] = useState({ old: '', next: '', confirm: '' });
  const [pwdSaving, setPwdSaving] = useState(false);

  // Tenant Admin state
  const [tenantConfig, setTenantConfig] = useState<TenantConfig | null>(null);
  const [tenantAgents, setTenantAgents] = useState<AgentUser[]>([]);
  const [showAddAgentModal, setShowAddAgentModal] = useState(false);
  const [newAgentData, setNewAgentData] = useState({
    account: '',
    nickname: '',
    role: 'agent' as 'agent' | 'tenant_admin',
    password: '',
  });
  const [newAgentConfirmPwd, setNewAgentConfirmPwd] = useState('');
  const [isCustomDelay, setIsCustomDelay] = useState(false);
  const [newGuideOptionInput, setNewGuideOptionInput] = useState('');

  // Notification Toast
  const [toastMsg, setToastMsg] = useState<{ text: string; type: 'success' | 'info' } | null>(null);
  const [copiedScript, setCopiedScript] = useState(false);
  // 后端下发的 widget 嵌入代码（GET /admin/widget/embed），失败时回退本地拼接
  const [embedSnippet, setEmbedSnippet] = useState('');

  const showToast = (text: string, type: 'success' | 'info' = 'success') => {
    setToastMsg({ text, type });
    setTimeout(() => setToastMsg(null), 3000);
  };

  // Fetch Super Admin Data
  const fetchSuperAdminData = async () => {
    setLoading(true);
    try {
      const [tenantsRes, metricsRes] = await Promise.all([
        getPlatformTenants({ keyword: tenantSearch, status: statusFilter, plan: planFilter }),
        getPlatformMetrics(),
      ]);
      setTenants(tenantsRes.list);
      setMetrics(metricsRes);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // Fetch Tenant Admin Data
  const fetchTenantAdminData = async () => {
    setLoading(true);
    try {
      const [cfg, agents, embed] = await Promise.all([
        getTenantSetting(),
        getTenantAgents(),
        // 嵌入代码由后端统一生成；接口失败不阻塞面板，回退本地拼接
        getWidgetEmbed(window.location.origin).catch(() => null),
      ]);
      setTenantConfig(cfg);
      setEmbedSnippet(
        embed?.snippet ||
          `<script src="${window.location.origin}/widget.js" data-tenant-id="${
            cfg?.tenant_code || 'wgetcloud_live'
          }" async></script>`
      );
      // 排序：一级 启用(enabled=true)在前，停用在后；二级 每组内按创建时间倒序
      const sorted = [...agents].sort((a, b) => {
        if (a.enabled !== b.enabled) return a.enabled ? -1 : 1;
        const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return tb - ta;
      });
      setTenantAgents(sorted);
      // 初始化机器人头像：用后端配置的 default_avatar，没有则用默认
      setSelectedAvatar(cfg.default_avatar && cfg.default_avatar !== AI_DEFAULT_AVATAR
        ? cfg.default_avatar
        : AI_DEFAULT_AVATAR);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeRole === 'super_admin') {
      fetchSuperAdminData();
    } else {
      fetchTenantAdminData();
    }
  }, [activeRole, tenantSearch, statusFilter, planFilter]);

  // Handle Create Tenant
  const handleCreateTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTenantData.name.trim()) {
      alert('请填写企业全称');
      return;
    }
    if (!newTenantData.username.trim()) {
      alert('请填写企业主登录账号');
      return;
    }
    if (newTenantData.password.length < 6) {
      alert('登录密码至少 6 位');
      return;
    }
    try {
      const created = await createPlatformTenant({
        ...newTenantData,
        paymentAmount:
          newTenantData.paymentAmount.trim() === '' ? undefined : Number(newTenantData.paymentAmount),
      });
      setShowCreateTenantModal(false);
      setNewTenantData({
        name: '',
        adminEmail: '',
        ownerName: '',
        ownerContact: '',
        username: '',
        password: '',
        maxSeats: 5,
        expireAt: '',
        paymentAmount: '',
        domain: '',
      });
      showToast(`已成功开通企业租户：${newTenantData.name}（租户标识 ${created.tenantCode}，嵌入代码将使用该标识）`);
      fetchSuperAdminData();
    } catch (err: any) {
      alert(err.message || '开通失败');
    }
  };

  // 打开续费弹窗：基准 = 当前到期日（未过期）或今天；默认展示基准顺延一年
  const openRenewModal = (t: TenantItem) => {
    const cur = t.expireAt && t.expireAt !== '—' ? new Date(`${t.expireAt}T00:00:00`) : null;
    const base = cur && cur > new Date() ? cur : new Date();
    const baseISO = fmtLocalDate(base);
    setRenewBase(baseISO);
    setRenewData({ expireAt: fmtLocalDate(addMonths(base, 12)), paymentAmount: '' });
    setRenewTenant(t);
  };

  // 提交续费：更新到期日 + 记录本次续费金额
  const handleRenewTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!renewTenant) return;
    if (!renewData.expireAt) {
      alert('请选择新的服务到期日');
      return;
    }
    try {
      await renewPlatformTenant(renewTenant.id, {
        expireAt: renewData.expireAt,
        paymentAmount:
          renewData.paymentAmount.trim() === '' ? undefined : Number(renewData.paymentAmount),
      });
      showToast(`已为【${renewTenant.name}】完成续费，服务期至 ${renewData.expireAt}`);
      setRenewTenant(null);
      fetchSuperAdminData();
    } catch (err: any) {
      alert(err.message || '续费失败');
    }
  };

  // 提交修改登录密码（企业主）
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pwdData.old) {
      alert('请填写当前密码');
      return;
    }
    if (pwdData.next.length < 6) {
      alert('新密码至少 6 位');
      return;
    }
    if (pwdData.next !== pwdData.confirm) {
      alert('两次输入的新密码不一致');
      return;
    }
    if (pwdData.next === pwdData.old) {
      alert('新密码不能与当前密码相同');
      return;
    }
    try {
      setPwdSaving(true);
      await changeTenantPassword({ oldPassword: pwdData.old, newPassword: pwdData.next });
      showToast('登录密码已更新，下次登录请使用新密码');
      setPwdData({ old: '', next: '', confirm: '' });
    } catch (err: any) {
      alert(err.message || '修改失败');
    } finally {
      setPwdSaving(false);
    }
  };

  // Handle Toggle Tenant Status
  const handleToggleTenantStatus = async (tenant: TenantItem) => {
    const nextStatus = tenant.status === 'active' ? 'suspended' : 'active';
    try {
      await updatePlatformTenant(tenant.id, { status: nextStatus });
      showToast(`已更新企业【${tenant.name}】状态为：${nextStatus === 'active' ? '正常运营' : '已停用'}`);
      fetchSuperAdminData();
    } catch (err: any) {
      alert(err.message || '操作失败');
    }
  };

  // 选中头像时同步写入 tenantConfig.default_avatar（保存时才真正落库）
  const setSelectedAvatarWithSync = (url: string) => {
    setSelectedAvatar(url);
    setTenantConfig((prev) => (prev ? { ...prev, default_avatar: url } : prev));
  };

  // 自定义上传企业机器人头像
  const handleCustomAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('请选择图片文件（png/jpg/gif/webp）');
      e.target.value = '';
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert('图片大小不能超过 5MB');
      e.target.value = '';
      return;
    }
    setUploadingAvatar(true);
    try {
      const { url } = await agentUploadFile(file, { type: 'image' });
      setSelectedAvatarWithSync(url);
      showToast('企业机器人头像已更新，保存后生效');
    } catch (err: any) {
      alert(err?.message || '头像上传失败');
    } finally {
      setUploadingAvatar(false);
      e.target.value = '';
    }
  };

  // Handle Save Tenant Appearance
  const handleSaveTenantAppearance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantConfig) return;
    try {
      const updated = await updateTenantSetting(tenantConfig);
      setTenantConfig(updated);
      showToast('小部件外观与欢迎语已保存生效，所有已嵌入站点实时同步！');
    } catch (e) {
      console.error(e);
    }
  };

  // Handle Add Agent
  const handleAddAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAgentData.account.trim() || !newAgentData.nickname.trim()) {
      alert('请完整填写客服邮箱与昵称');
      return;
    }
    if (!newAgentData.password) {
      alert('请设置登录密码');
      return;
    }
    if (newAgentData.password.length < 6) {
      alert('密码长度不能少于 6 位');
      return;
    }
    if (newAgentData.password !== newAgentConfirmPwd) {
      alert('两次输入的密码不一致');
      return;
    }
    try {
      await createTenantAgent(newAgentData);
      setShowAddAgentModal(false);
      setNewAgentData({ account: '', nickname: '', role: 'agent', password: '' });
      setNewAgentConfirmPwd('');
      showToast(`新客服坐席【${newAgentData.nickname}】创建成功！`);
      fetchTenantAdminData();
    } catch (err: any) {
      alert(err.message || '添加失败');
    }
  };

  // Handle Toggle Agent Status
  const handleToggleAgentEnabled = async (agent: AgentUser) => {
    try {
      await updateTenantAgent(agent.userId, { enabled: !agent.enabled });
      showToast(`已${!agent.enabled ? '启用' : '禁用'}坐席：${agent.nickname}`);
      fetchTenantAdminData();
    } catch (e: any) {
      alert(e.message || '更新失败');
    }
  };

  // Handle Delete Agent (only for disabled accounts)
  const handleDeleteAgent = async (agent: AgentUser) => {
    if (!window.confirm(`确定要永久删除坐席「${agent.nickname}」吗？此操作不可恢复。`)) return;
    try {
      await deleteTenantAgent(agent.userId);
      showToast(`已删除坐席：${agent.nickname}`);
      fetchTenantAdminData();
    } catch (e: any) {
      alert(e.message || '删除失败');
    }
  };

  // Handle Save Agent Profile (Admin assisting or inspecting)
  const handleSaveAgentProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAgent) return;
    let password: string | undefined;
    if (showResetPwd) {
      if (!resetPwd) {
        alert('请输入新密码');
        return;
      }
      if (resetPwd.length < 6) {
        alert('密码长度不能少于 6 位');
        return;
      }
      if (resetPwd !== resetPwdConfirm) {
        alert('两次输入的密码不一致');
        return;
      }
      password = resetPwd;
    }
    try {
      await updateAgentProfile({
        targetUserId: editingAgent.userId,
        nickname: editingAgent.nickname,
        title: editingAgent.title,
        bio: editingAgent.bio,
        avatar: editingAgent.avatar,
        password,
      });
      showToast(`已更新客服「${editingAgent.nickname}」的资料`);
      setShowEditAgentModal(false);
      setShowResetPwd(false);
      setResetPwd('');
      setResetPwdConfirm('');
      fetchTenantAdminData();
    } catch (err: any) {
      alert(err.message || '更新失败');
    }
  };

  // Copy widget embed script (snippet 由后端 /admin/widget/embed 下发)
  const handleCopyScript = () => {
    navigator.clipboard.writeText(embedSnippet);
    setCopiedScript(true);
    showToast('嵌入 JS 代码已成功复制到剪贴板！');
    setTimeout(() => setCopiedScript(false), 2000);
  };

  return (
    <div className="h-screen w-screen bg-slate-900 text-slate-100 flex flex-col font-sans overflow-hidden">
      {/* Main Admin Body: Full-width Workbench Architecture matching AgentLayout */}
      <div className="flex-1 min-h-0 flex overflow-hidden w-full relative">
        {/* Primary Left Navigation Bar with Collapsible & Hover-Expand Capability (Identical to Agent Workbench) */}
        <div
          className="shrink-0 h-full relative z-30 select-none transition-[width] duration-200 ease-in-out"
          style={{ width: isCollapsed ? 70 : 280 }}
          onMouseEnter={() => {
            if (isCollapsed) setIsHovered(true);
          }}
          onMouseLeave={() => {
            if (isCollapsed) {
              setIsHovered(false);
            }
          }}
        >
          <aside
            className={`h-full bg-slate-900 text-slate-300 flex flex-col border-r border-slate-800 transition-[width,box-shadow] duration-200 ease-in-out overflow-hidden ${
              isCollapsed && isHovered
                ? 'absolute top-0 bottom-0 left-0 w-70 shadow-2xl z-40 border-slate-700 ring-1 ring-black/40'
                : 'relative w-full'
            }`}
          >
            {/* Top Section Header with Round Toggle Button (< or >) matching AgentLayout */}
            <div className="p-3.5 border-b border-slate-800/80 flex items-center justify-between min-h-16.5 shrink-0">
              {isExpanded ? (
                <>
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold shadow-md shrink-0 ${
                        activeRole === 'super_admin'
                          ? 'bg-blue-600 shadow-blue-600/30'
                          : 'bg-indigo-600 shadow-indigo-600/30'
                      }`}
                    >
                      {activeRole === 'super_admin' ? (
                        <Shield className="w-5 h-5" />
                      ) : (
                        <Building2 className="w-5 h-5" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <h2 className="font-bold text-sm text-white leading-tight tracking-tight truncate">
                        {activeRole === 'super_admin' ? '全网运营控制台' : '企业管理中心'}
                      </h2>
                      <p className="text-xs text-slate-400 mt-0.5 truncate">
                        {activeRole === 'super_admin' ? '平台多租户治理中心' : '光年跃迁租户系统'}
                      </p>
                    </div>
                  </div>

                  {/* Round Toggle Button (< or >) matching AgentLayout */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleCollapse();
                    }}
                    title={isCollapsed ? '点击固定显示侧边栏' : '点击收起侧边栏 (悬停时自动显示)'}
                    className="w-7 h-7 rounded-full bg-white text-indigo-600 hover:bg-indigo-50 hover:shadow-lg shadow-md flex items-center justify-center transition-all cursor-pointer border border-slate-200 shrink-0 ml-1 group"
                  >
                    {isCollapsed ? (
                      <ChevronRight className="w-4 h-4 stroke-[2.5] text-indigo-600 group-hover:translate-x-0.5 transition-transform" />
                    ) : (
                      <ChevronLeft className="w-4 h-4 stroke-[2.5] text-indigo-600 group-hover:-translate-x-0.5 transition-transform" />
                    )}
                  </button>
                </>
              ) : (
                <div className="w-full flex items-center justify-center">
                  <button
                    type="button"
                    onClick={toggleCollapse}
                    title="点击展开固定侧边栏"
                    className={`w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold shadow-md cursor-pointer transition ${
                      activeRole === 'super_admin'
                        ? 'bg-blue-600 hover:bg-blue-500 shadow-blue-600/30'
                        : 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-600/30'
                    }`}
                  >
                    {activeRole === 'super_admin' ? (
                      <Shield className="w-5 h-5" />
                    ) : (
                      <Building2 className="w-5 h-5" />
                    )}
                  </button>
                </div>
              )}
            </div>

            {/* 当前登录用户卡片（真实 JWT 身份；展开态显示资料，收起态显示首字） */}
            {isExpanded ? (
              <div className="mx-3 mt-3 p-3 rounded-xl bg-slate-800/60 border border-slate-700/70 flex items-center gap-2.5 min-w-0">
                <div
                  className={`w-9 h-9 rounded-lg flex items-center justify-center text-white text-sm font-bold shrink-0 ${
                    activeRole === 'super_admin' ? 'bg-blue-600' : 'bg-indigo-600'
                  }`}
                >
                  {(currentUser?.nickname || currentUser?.account || '管').trim().charAt(0)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold text-white truncate">
                    {currentUser?.nickname || currentUser?.account || '管理员'}
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span
                      className={`text-[10px] px-1.5 py-px rounded font-medium ${
                        activeRole === 'super_admin'
                          ? 'bg-blue-500/15 text-blue-300'
                          : 'bg-indigo-500/15 text-indigo-300'
                      }`}
                    >
                      {activeRole === 'super_admin' ? '平台超管' : '企业主'}
                    </span>
                    <span className="text-[10px] text-slate-400 truncate">@{currentUser?.account}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex justify-center mt-3 shrink-0">
                <div
                  className={`w-9 h-9 rounded-lg flex items-center justify-center text-white text-sm font-bold ${
                    activeRole === 'super_admin' ? 'bg-blue-600' : 'bg-indigo-600'
                  }`}
                  title={`${currentUser?.nickname || ''} @${currentUser?.account || ''}`}
                >
                  {(currentUser?.nickname || currentUser?.account || '管').trim().charAt(0)}
                </div>
              </div>
            )}

            {/* Role Navigation Menu (Larger Font, Spacious Layout like reference) */}
            <div className="flex-1 min-h-0 overflow-y-auto py-3 px-2 space-y-1">
              {activeRole === 'super_admin' ? (
                <nav className="space-y-1.5">
                  {isExpanded && (
                    <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-3 py-2">
                      平台超管控制菜单
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => setSuperAdminTab('tenants')}
                    title={!isExpanded ? '企业租户管理' : undefined}
                    className={`flex items-center ${
                      isExpanded
                        ? 'w-full justify-between px-3.5 py-3 rounded-xl'
                        : 'justify-center w-11 h-11 mx-auto rounded-xl'
                    } text-sm font-medium transition cursor-pointer ${
                      superAdminTab === 'tenants'
                        ? 'bg-blue-600 text-white font-semibold shadow-sm'
                        : 'text-slate-200 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    {isExpanded ? (
                      <>
                        <div className="flex items-center gap-3.5 min-w-0">
                          <Layers className="w-5 h-5 shrink-0" />
                          <span className="truncate">企业租户管理</span>
                        </div>
                        <span className="text-xs bg-slate-800/90 text-slate-300 font-semibold px-2 py-0.5 rounded-full border border-slate-700/50">
                          {tenants.length}
                        </span>
                      </>
                    ) : (
                      <Layers className="w-5 h-5 shrink-0" />
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setSuperAdminTab('metrics')}
                    title={!isExpanded ? '全网运营概览' : undefined}
                    className={`flex items-center ${
                      isExpanded
                        ? 'w-full gap-3.5 px-3.5 py-3 rounded-xl'
                        : 'justify-center w-11 h-11 mx-auto rounded-xl'
                    } text-sm font-medium transition cursor-pointer ${
                      superAdminTab === 'metrics'
                        ? 'bg-blue-600 text-white font-semibold shadow-sm'
                        : 'text-slate-200 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    <BarChart3 className="w-5 h-5 shrink-0" />
                    {isExpanded && <span className="truncate">全网运营概览</span>}
                  </button>

                  <button
                    type="button"
                    onClick={() => setSuperAdminTab('global_settings')}
                    title={!isExpanded ? 'SaaS 套餐计费规则' : undefined}
                    className={`flex items-center ${
                      isExpanded
                        ? 'w-full gap-3.5 px-3.5 py-3 rounded-xl'
                        : 'justify-center w-11 h-11 mx-auto rounded-xl'
                    } text-sm font-medium transition cursor-pointer ${
                      superAdminTab === 'global_settings'
                        ? 'bg-blue-600 text-white font-semibold shadow-sm'
                        : 'text-slate-200 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    <Sliders className="w-5 h-5 shrink-0" />
                    {isExpanded && <span className="truncate">SaaS 套餐计费规则</span>}
                  </button>
                </nav>
              ) : (
                <nav className="space-y-1.5">
                  {isExpanded && (
                    <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-3 py-2">
                      企业管理控制菜单
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => setTenantAdminTab('conversations')}
                    title={!isExpanded ? '坐席会话监控' : undefined}
                    className={`flex items-center ${
                      isExpanded
                        ? 'w-full gap-3.5 px-3.5 py-3 rounded-xl'
                        : 'justify-center w-11 h-11 mx-auto rounded-xl'
                    } text-sm font-medium transition cursor-pointer ${
                      tenantAdminTab === 'conversations'
                        ? 'bg-indigo-600 text-white font-semibold shadow-sm'
                        : 'text-slate-200 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    <Eye className="w-5 h-5 shrink-0" />
                    {isExpanded && <span className="truncate">坐席会话监控</span>}
                  </button>

                  <button
                    type="button"
                    onClick={() => setTenantAdminTab('widget')}
                    title={!isExpanded ? '访客端外观定制' : undefined}
                    className={`flex items-center ${
                      isExpanded
                        ? 'w-full gap-3.5 px-3.5 py-3 rounded-xl'
                        : 'justify-center w-11 h-11 mx-auto rounded-xl'
                    } text-sm font-medium transition cursor-pointer ${
                      tenantAdminTab === 'widget'
                        ? 'bg-indigo-600 text-white font-semibold shadow-sm'
                        : 'text-slate-200 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    <Palette className="w-5 h-5 shrink-0" />
                    {isExpanded && <span className="truncate">访客端外观定制</span>}
                  </button>

                  <button
                    type="button"
                    onClick={() => setTenantAdminTab('agents')}
                    title={!isExpanded ? '坐席人员与权限' : undefined}
                    className={`flex items-center ${
                      isExpanded
                        ? 'w-full justify-between px-3.5 py-3 rounded-xl'
                        : 'justify-center w-11 h-11 mx-auto rounded-xl'
                    } text-sm font-medium transition cursor-pointer ${
                      tenantAdminTab === 'agents'
                        ? 'bg-indigo-600 text-white font-semibold shadow-sm'
                        : 'text-slate-200 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    {isExpanded ? (
                      <>
                        <div className="flex items-center gap-3.5 min-w-0">
                          <Users className="w-5 h-5 shrink-0" />
                          <span className="truncate">坐席人员与权限</span>
                        </div>
                        <span className="text-xs bg-slate-800/90 text-slate-300 font-semibold px-2 py-0.5 rounded-full border border-slate-700/50">
                          {tenantAgents.filter((a) => a.role === 'agent').length}
                        </span>
                      </>
                    ) : (
                      <Users className="w-5 h-5 shrink-0" />
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setTenantAdminTab('hours')}
                    title={!isExpanded ? '营业时间与排队' : undefined}
                    className={`flex items-center ${
                      isExpanded
                        ? 'w-full gap-3.5 px-3.5 py-3 rounded-xl'
                        : 'justify-center w-11 h-11 mx-auto rounded-xl'
                    } text-sm font-medium transition cursor-pointer ${
                      tenantAdminTab === 'hours'
                        ? 'bg-indigo-600 text-white font-semibold shadow-sm'
                        : 'text-slate-200 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    <Clock className="w-5 h-5 shrink-0" />
                    {isExpanded && <span className="truncate">营业时间与排队</span>}
                  </button>

                  <button
                    type="button"
                    onClick={() => setTenantAdminTab('analytics')}
                    title={!isExpanded ? '服务质量与 SLA 报表' : undefined}
                    className={`flex items-center ${
                      isExpanded
                        ? 'w-full justify-between px-3.5 py-3 rounded-xl'
                        : 'justify-center w-11 h-11 mx-auto rounded-xl'
                    } text-sm font-medium transition cursor-pointer ${
                      tenantAdminTab === 'analytics'
                        ? 'bg-indigo-600 text-white font-semibold shadow-sm'
                        : 'text-slate-200 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    {isExpanded ? (
                      <>
                        <div className="flex items-center gap-3.5 min-w-0">
                          <BarChart3 className="w-5 h-5 shrink-0" />
                          <span className="truncate">服务质量与 SLA 报表</span>
                        </div>
                      </>
                    ) : (
                      <BarChart3 className="w-5 h-5 shrink-0" />
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setTenantAdminTab('embed')}
                    title={!isExpanded ? '安装嵌入代码' : undefined}
                    className={`flex items-center ${
                      isExpanded
                        ? 'w-full gap-3.5 px-3.5 py-3 rounded-xl'
                        : 'justify-center w-11 h-11 mx-auto rounded-xl'
                    } text-sm font-medium transition cursor-pointer ${
                      tenantAdminTab === 'embed'
                        ? 'bg-indigo-600 text-white font-semibold shadow-sm'
                        : 'text-slate-200 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    <Code2 className="w-5 h-5 shrink-0" />
                    {isExpanded && <span className="truncate">安装嵌入代码</span>}
                  </button>

                  <button
                    type="button"
                    onClick={() => setTenantAdminTab('password')}
                    title={!isExpanded ? '修改登录密码' : undefined}
                    className={`flex items-center ${
                      isExpanded
                        ? 'w-full gap-3.5 px-3.5 py-3 rounded-xl'
                        : 'justify-center w-11 h-11 mx-auto rounded-xl'
                    } text-sm font-medium transition cursor-pointer ${
                      tenantAdminTab === 'password'
                        ? 'bg-indigo-600 text-white font-semibold shadow-sm'
                        : 'text-slate-200 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    <Key className="w-5 h-5 shrink-0" />
                    {isExpanded && <span className="truncate">修改登录密码</span>}
                  </button>
                </nav>
              )}
            </div>

            {/* 有效期：位于分隔线上方，与退出登录隔离 */}
            {activeRole === 'tenant_admin' && (
              <div
                title={
                  !isExpanded
                    ? tenantConfig?.expires_at
                      ? `订阅有效期至 ${tenantConfig.expires_at}`
                      : '订阅有效期：不限期'
                    : undefined
                }
                className="px-3 pb-3 shrink-0"
              >
                <div
                  className={`rounded-xl bg-slate-800/40 border border-slate-800 ${
                    isExpanded ? 'px-3 py-2.5' : 'w-11 h-11 mx-auto flex items-center justify-center'
                  }`}
                >
                  {(() => {
                    const exp = tenantConfig?.expires_at || '';
                    const st = expireState(exp);
                    const color =
                      st.kind === 'expired'
                        ? 'text-red-400'
                        : st.kind === 'soon'
                        ? 'text-amber-400'
                        : 'text-slate-200';
                    if (!isExpanded) {
                      return (
                        <span
                          className={`w-2 h-2 rounded-full ${
                            st.kind === 'expired'
                              ? 'bg-red-500'
                              : st.kind === 'soon'
                              ? 'bg-amber-500'
                              : 'bg-emerald-500'
                          }`}
                        />
                      );
                    }
                    return (
                      <>
                        <div className="text-[11px] text-slate-500 mb-0.5 flex items-center gap-1.5">
                          <Clock className="w-3 h-3" />
                          订阅有效期
                        </div>
                        <div className={`text-[11px] text-center ${color}`}>
                          {st.kind === 'none' ? (
                            '不限期'
                          ) : st.kind === 'expired' ? (
                            <>已过期 · {exp}</>
                          ) : st.kind === 'soon' ? (
                            <>
                              {exp}
                              <span className="text-[10.5px] font-normal ml-1">({st.days} 天后到期)</span>
                            </>
                          ) : (
                            exp
                          )}
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>
            )}

            {/* Bottom: 退出 */}
            <div className="p-3 border-t border-slate-800/80 shrink-0">
              <button
                type="button"
                onClick={() => {
                  logoutAgent();
                  // 按角色回到各自的独立登录入口（超管 /super/login，企业主 /admin/login）
                  window.location.href = currentUser?.role === 'super_admin' ? '/super/login' : '/admin/login';
                }}
                title={!isExpanded ? '退出管理登录' : undefined}
                className={`w-full flex items-center ${
                  isExpanded ? 'justify-center gap-2.5 px-3.5 py-2.5' : 'justify-center w-11 h-11 mx-auto'
                } text-sm text-slate-400 hover:text-red-400 hover:bg-slate-800/60 rounded-xl transition cursor-pointer`}
              >
                <LogOut className="w-5 h-5 shrink-0" />
                {isExpanded && <span>退出管理登录</span>}
              </button>
            </div>
          </aside>
        </div>

        {/* Right Main Content Area: Workbench Expansive View */}
        <main className="flex-1 min-w-0 h-full overflow-y-auto p-6 md:p-8 bg-slate-900/60">
          {/* ========================================================
              VIEW 1: PLATFORM SUPER ADMIN (超管视图)
             ======================================================== */}
          {activeRole === 'super_admin' && (
            <div className="space-y-6">
              {/* Tab 1: Tenants Management */}
              {superAdminTab === 'tenants' && (
                <div className="space-y-6">
                  {/* Top Metric Strip */}
                  <div className="grid grid-cols-4 gap-4">
                    <div className="p-4 rounded-2xl bg-slate-800/60 border border-slate-700/60">
                      <div className="text-xs text-slate-400 mb-1">企业租户总数</div>
                      <div className="text-2xl font-bold text-white">{metrics?.totalTenants || tenants.length}</div>
                      <div className="text-[11px] text-emerald-400 mt-1">● 正常运行 {metrics?.activeTenants || 3} 家</div>
                    </div>
                    <div className="p-4 rounded-2xl bg-slate-800/60 border border-slate-700/60">
                      <div className="text-xs text-slate-400 mb-1">全网开通席位</div>
                      <div className="text-2xl font-bold text-white">{metrics?.totalAgents || 35}</div>
                      <div className="text-[11px] text-blue-400 mt-1">● 当前在线接待 {metrics?.onlineAgents || 6} 位</div>
                    </div>
                    <div className="p-4 rounded-2xl bg-slate-800/60 border border-slate-700/60">
                      <div className="text-xs text-slate-400 mb-1">今日活跃咨询会话</div>
                      <div className="text-2xl font-bold text-white">{metrics?.activeConversations || 8}</div>
                      <div className="text-[11px] text-indigo-400 mt-1">全网多租户正在接入</div>
                    </div>
                    <div className="p-4 rounded-2xl bg-slate-800/60 border border-slate-700/60">
                      <div className="text-xs text-slate-400 mb-1">今日消息吞吐量</div>
                      <div className="text-2xl font-bold text-white">{metrics?.todayMessages || 1894}</div>
                      <div className="text-[11px] text-slate-400 mt-1">实时 WebSocket 流转</div>
                    </div>
                  </div>

                  {/* Filter & Action Toolbar */}
                  <div className="flex items-center justify-between gap-4 bg-slate-800/40 p-4 rounded-2xl border border-slate-800">
                    <div className="flex items-center gap-3 flex-1">
                      <div className="relative flex-1 max-w-sm">
                        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          value={tenantSearch}
                          onChange={(e) => setTenantSearch(e.target.value)}
                          placeholder="搜索租户名称、租户代码或管理员邮箱..."
                          className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                        />
                      </div>

                      <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-blue-500"
                      >
                        <option value="all">所有状态</option>
                        <option value="active">正常运营 (Active)</option>
                        <option value="trial">试用期 (Trial)</option>
                        <option value="suspended">已封禁/停用 (Suspended)</option>
                      </select>

                      <select
                        value={planFilter}
                        onChange={(e) => setPlanFilter(e.target.value)}
                        className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-blue-500"
                      >
                        <option value="all">所有套餐版本</option>
                        <option value="enterprise">旗舰版 (Enterprise)</option>
                        <option value="standard">专业版 (Standard)</option>
                        <option value="free">免费体验版 (Free)</option>
                      </select>
                    </div>

                    <button
                      type="button"
                      onClick={() => setShowCreateTenantModal(true)}
                      className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold shadow-md shadow-blue-500/20 transition cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      <span>开通新企业租户</span>
                    </button>
                  </div>

                  {/* Tenants Table */}
                  <div className="bg-slate-800/40 border border-slate-800 rounded-2xl overflow-hidden">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-900/80 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider">
                          <th className="py-3.5 px-4">企业信息 / 租户 Code</th>
                          <th className="py-3.5 px-4">套餐规格</th>
                          <th className="py-3.5 px-4">坐席席位配额</th>
                          <th className="py-3.5 px-4">状态</th>
                          <th className="py-3.5 px-4">累计会话</th>
                          <th className="py-3.5 px-4">有效期至</th>
                          <th className="py-3.5 px-4 text-right">操作管理</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/80">
                        {tenants.map((t) => (
                          <tr key={t.id} className="hover:bg-slate-800/50 transition">
                            <td className="py-3.5 px-4">
                              <div className="font-semibold text-white text-sm">{t.name}</div>
                              <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                                <span className="font-mono text-blue-400">{t.tenantCode}</span>
                                <span>·</span>
                                <span>{t.adminEmail}</span>
                              </div>
                            </td>
                            <td className="py-3.5 px-4">
                              <span
                                className={`px-2 py-0.5 rounded-full font-semibold text-[10.5px] ${
                                  t.plan === 'enterprise'
                                    ? 'bg-purple-500/10 text-purple-400 border border-purple-500/30'
                                    : t.plan === 'standard'
                                    ? 'bg-blue-500/10 text-blue-400 border border-blue-500/30'
                                    : 'bg-slate-700 text-slate-300'
                                }`}
                              >
                                {t.plan === 'enterprise' ? '旗舰商业版' : t.plan === 'standard' ? '标准专业版' : '免费试用版'}
                              </span>
                            </td>
                            <td className="py-3.5 px-4">
                              <div className="font-medium text-slate-200">
                                {t.usedSeats} / {t.maxSeats} 席位
                              </div>
                              <div className="w-24 bg-slate-700 h-1.5 rounded-full mt-1.5 overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${
                                    t.usedSeats / t.maxSeats > 0.8 ? 'bg-amber-500' : 'bg-blue-500'
                                  }`}
                                  style={{ width: `${Math.min(100, (t.usedSeats / t.maxSeats) * 100)}%` }}
                                />
                              </div>
                            </td>
                            <td className="py-3.5 px-4">
                              <span
                                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-semibold text-[10.5px] ${
                                  t.status === 'active'
                                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                                    : t.status === 'trial'
                                    ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                                    : 'bg-red-500/10 text-red-400 border border-red-500/30'
                                }`}
                              >
                                {t.status === 'active' ? '正常运营' : t.status === 'trial' ? '试用中' : '已停用'}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 text-slate-300 font-mono">
                              {t.activeChatsCount.toLocaleString()} 个
                            </td>
                            <td className="py-3.5 px-4">
                                {(() => {
                                  const st = expireState(t.expireAt);
                                  if (st.kind === 'none')
                                    return <span className="text-slate-500">不限期</span>;
                                  if (st.kind === 'expired')
                                    return (
                                      <span className="text-red-400 font-semibold">
                                        已过期 · {t.expireAt}
                                      </span>
                                    );
                                  if (st.kind === 'soon')
                                    return (
                                      <span className="text-amber-400 font-medium">
                                        {t.expireAt}
                                        <span className="text-[10.5px] ml-1">({st.days} 天后到期)</span>
                                      </span>
                                    );
                                  return <span className="text-slate-300">{t.expireAt}</span>;
                                })()}
                              </td>
                              <td className="py-3.5 px-4 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() => openRenewModal(t)}
                                  className="px-2.5 py-1 rounded-lg text-xs font-medium transition cursor-pointer bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 border border-blue-500/30"
                                >
                                  续费
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleToggleTenantStatus(t)}
                                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition cursor-pointer ${
                                    t.status === 'active'
                                      ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/30'
                                      : 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/30'
                                  }`}
                                >
                                  {t.status === 'active' ? '停用' : '激活'}
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Tab 2: Metrics */}
              {superAdminTab === 'metrics' && (
                <div className="space-y-6">
                  <div className="bg-slate-800/40 p-6 rounded-2xl border border-slate-800">
                    <h2 className="text-base font-bold text-white mb-2">全网实时并发监控指标</h2>
                    <p className="text-xs text-slate-400 mb-6">
                      监控当前多租户集群实例状态、WebSocket 实时长连接数与会话分配队列
                    </p>

                    <div className="grid grid-cols-3 gap-6">
                      <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800">
                        <div className="text-xs text-slate-400 mb-1">WebSocket 连接池活跃数</div>
                        <div className="text-3xl font-extrabold text-blue-400 font-mono">1,428</div>
                        <p className="text-[11px] text-slate-500 mt-2">包含全网各客户端访客与坐席长连接</p>
                      </div>

                      <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800">
                        <div className="text-xs text-slate-400 mb-1">排队中等待接入</div>
                        <div className="text-3xl font-extrabold text-amber-400 font-mono">2</div>
                        <p className="text-[11px] text-slate-500 mt-2">平均排队响应等待时长: 14 秒</p>
                      </div>

                      <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800">
                        <div className="text-xs text-slate-400 mb-1">全网满意度均分</div>
                        <div className="text-3xl font-extrabold text-emerald-400 font-mono">4.92 / 5.0</div>
                        <p className="text-[11px] text-slate-500 mt-2">基于今日 318 条访客结单评分统计</p>
                      </div>
                    </div>
                  </div>

                  {/* 嵌入丰富的数据报表看板 */}
                  <AnalyticsDashboardView />
                </div>
              )}

              {/* Tab 3: Global SaaS Plan Settings */}
              {superAdminTab === 'global_settings' && (
                <div className="bg-slate-800/40 p-6 rounded-2xl border border-slate-800 space-y-6">
                  <div>
                    <h2 className="text-base font-bold text-white">SaaS 客户套餐规格策略</h2>
                    <p className="text-xs text-slate-400 mt-1">设置平台对不同订阅等级企业所开放的坐席席位数及特性权限</p>
                  </div>

                  <div className="grid grid-cols-3 gap-5">
                    <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-700/80 flex flex-col justify-between">
                      <div>
                        <div className="text-xs font-bold text-slate-400 uppercase mb-2">免费体验版 (Free)</div>
                        <div className="text-xl font-bold text-white mb-3">¥0 / 月</div>
                        <ul className="space-y-2 text-xs text-slate-300 mb-6">
                          <li className="flex items-center gap-1.5">
                            <Check className="w-3.5 h-3.5 text-blue-400" />
                            <span>最大支持 2 个坐席席位</span>
                          </li>
                          <li className="flex items-center gap-1.5">
                            <Check className="w-3.5 h-3.5 text-blue-400" />
                            <span>基础访客文本与图片聊天</span>
                          </li>
                          <li className="flex items-center gap-1.5 text-slate-500">
                            <span>✕ 仿微信按住说话语音消息</span>
                          </li>
                        </ul>
                      </div>
                      <span className="text-[11px] text-slate-500 text-center">系统默认初始试用规格</span>
                    </div>

                    <div className="p-5 rounded-2xl bg-slate-900/80 border border-blue-500/50 shadow-xl shadow-blue-500/10 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-bold text-blue-400 uppercase">标准专业版 (Standard)</span>
                          <span className="text-[10px] bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-full font-bold">主流推荐</span>
                        </div>
                        <div className="text-xl font-bold text-white mb-3">¥399 / 月</div>
                        <ul className="space-y-2 text-xs text-slate-300 mb-6">
                          <li className="flex items-center gap-1.5">
                            <Check className="w-3.5 h-3.5 text-blue-400" />
                            <span>最大支持 10 个坐席席位</span>
                          </li>
                          <li className="flex items-center gap-1.5">
                            <Check className="w-3.5 h-3.5 text-blue-400" />
                            <span>支持访客端与坐席端高清语音录制</span>
                          </li>
                          <li className="flex items-center gap-1.5">
                            <Check className="w-3.5 h-3.5 text-blue-400" />
                            <span>自建域名嵌入与外观无限制定制</span>
                          </li>
                        </ul>
                      </div>
                      <span className="text-[11px] text-blue-400 text-center font-medium">中型电商与在线教育首选</span>
                    </div>

                    <div className="p-5 rounded-2xl bg-slate-900/80 border border-purple-500/50 flex flex-col justify-between">
                      <div>
                        <div className="text-xs font-bold text-purple-400 uppercase mb-2">旗舰商业版 (Enterprise)</div>
                        <div className="text-xl font-bold text-white mb-3">¥1,299 / 月</div>
                        <ul className="space-y-2 text-xs text-slate-300 mb-6">
                          <li className="flex items-center gap-1.5">
                            <Check className="w-3.5 h-3.5 text-purple-400" />
                            <span>不限坐席席位与消息并发</span>
                          </li>
                          <li className="flex items-center gap-1.5">
                            <Check className="w-3.5 h-3.5 text-purple-400" />
                            <span>提供专属私有化部署支持与 Webhook</span>
                          </li>
                          <li className="flex items-center gap-1.5">
                            <Check className="w-3.5 h-3.5 text-purple-400" />
                            <span>7x24 小时专属架构师技术支持</span>
                          </li>
                        </ul>
                      </div>
                      <span className="text-[11px] text-purple-400 text-center font-medium">大型集团级客户定制</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ========================================================
              VIEW 2: TENANT ADMIN (企业主 / 租户管理员视图)
             ======================================================== */}
          {activeRole === 'tenant_admin' && (
            <div className="space-y-6">
              {/* Tab 0: Service Quality & SLA Analytics Report (服务质量与数据报表) */}
              {tenantAdminTab === 'analytics' && (
                <AnalyticsDashboardView />
              )}

              {/* Tab 0.5: Conversation Monitor (企业主全租户会话监控，坐席工作台界面 1:1 只读回放) */}
              {tenantAdminTab === 'conversations' && (
                <ConversationMonitorView
                  themeColor={tenantConfig?.theme_color}
                  botAvatar={tenantConfig?.default_avatar}
                />
              )}

              {/* Tab 1: Widget Customizer (访客端外观定制与实时预览) */}
              {tenantAdminTab === 'widget' && tenantConfig && (
                <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-stretch min-h-[calc(100vh-140px)] pb-6">
                  {/* Left Form: Customization Parameters */}
                  <form
                    onSubmit={handleSaveTenantAppearance}
                    className="xl:col-span-7 bg-slate-800/40 p-6 md:p-8 rounded-2xl border border-slate-800 shadow-sm flex flex-col justify-between space-y-6"
                  >
                    <div className="space-y-6">
                      {/* Title Header */}
                      <div className="border-b border-slate-800 pb-4">
                        <h2 className="text-base font-bold text-white flex items-center gap-2">
                          <Palette className="w-5 h-5 text-indigo-400" />
                          <span>访客端聊天小部件外观与交互定制</span>
                        </h2>
                        <p className="text-xs text-slate-400 mt-1">
                          实时定制嵌入在您企业官方网站上的悬浮客服组件视觉风格、主动问候时机与交互策略
                        </p>
                      </div>

                      {/* Section 1: Brand & Theme Color */}
                      <div className="space-y-4">
                        <div className="text-sm font-bold text-indigo-300 uppercase tracking-wider flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                          <span>1. 品牌身份与视觉主调</span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                          {/* Brand/Bot Name */}
                          <div>
                            <label className="block text-xs font-semibold text-slate-300 mb-1.5">品牌名称/公司简称</label>
                            <input
                              type="text"
                              value={tenantConfig.tenant_name}
                              onChange={(e) => setTenantConfig({ ...tenantConfig, tenant_name: e.target.value })}
                              className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
                              placeholder="例如：James 来自光年跃迁"
                            />
                          </div>

                          {/* Theme Color Picker */}
                          <div>
                            <label className="block text-xs font-semibold text-slate-300 mb-1.5">品牌主色调 (Brand Color)</label>
                            <div className="flex items-center gap-2.5">
                              <input
                                type="color"
                                value={tenantConfig.theme_color}
                                onChange={(e) => setTenantConfig({ ...tenantConfig, theme_color: e.target.value })}
                                className="w-9 h-9 rounded-lg cursor-pointer bg-transparent border-0"
                              />
                              <input
                                type="text"
                                value={tenantConfig.theme_color}
                                onChange={(e) => setTenantConfig({ ...tenantConfig, theme_color: e.target.value })}
                                className="w-24 px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs font-mono text-white"
                              />
                              {/* Preset color chips */}
                              <div className="flex items-center gap-1.5">
                                {['#1972f5', '#059669', '#7c3aed', '#ea580c', '#0f172a', '#e11d48'].map((c) => (
                                  <button
                                    key={c}
                                    type="button"
                                    onClick={() => setTenantConfig({ ...tenantConfig, theme_color: c })}
                                    className={`w-5 h-5 rounded-full cursor-pointer transition hover:scale-110 border-2 ${
                                      tenantConfig.theme_color === c ? 'border-white scale-110' : 'border-slate-700'
                                    }`}
                                    style={{ backgroundColor: c }}
                                  />
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Enterprise Default / Bot Avatar */}
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <label className="text-xs font-semibold text-slate-300 flex items-center gap-2">
                              <span>企业通用默认接待 / AI 机器人头像 (全局兜底)</span>
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-normal">
                                企业通用
                              </span>
                            </label>
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                          <button
                            type="button"
                            onClick={() => setSelectedAvatarWithSync(AI_DEFAULT_AVATAR)}
                            className={`flex items-center gap-2 p-2 rounded-xl border text-left transition cursor-pointer ${
                              selectedAvatar === AI_DEFAULT_AVATAR
                                ? 'bg-indigo-600/20 border-indigo-500 text-white'
                                : 'bg-slate-900/60 border-slate-700 text-slate-300 hover:border-slate-600'
                            }`}
                          >
                            <img
                              src={AI_DEFAULT_AVATAR}
                              alt="AI 助理"
                              className="w-7 h-7 rounded-full object-cover shrink-0 border border-slate-600"
                            />
                            <div className="min-w-0">
                              <div className="text-[11px] truncate font-medium">AI 助理</div>
                              <div className="text-[9.5px] text-slate-400 truncate">默认机器人形象</div>
                            </div>
                          </button>

                          {/* 自定义上传头像（点选后立即上传，替换默认机器人头像） */}
                          <label className="flex items-center gap-2 p-2 rounded-xl border border-dashed border-slate-600 bg-slate-900/40 text-slate-400 hover:text-indigo-300 hover:border-indigo-500/60 hover:bg-slate-900/60 transition cursor-pointer">
                            <div className="w-7 h-7 rounded-full border border-slate-600 flex items-center justify-center shrink-0 overflow-hidden bg-slate-800">
                              {customAvatarPreview ? (
                                <img
                                  src={customAvatarPreview}
                                  alt="自定义"
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <UploadCloud className="w-3.5 h-3.5" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <div className="text-[11px] truncate font-medium">
                                {uploadingAvatar ? '上传中…' : '自定义上传'}
                              </div>
                              <div className="text-[9.5px] text-slate-500 truncate">点击替换为企业图片</div>
                            </div>
                            <input
                              type="file"
                              accept="image/png,image/jpeg,image/gif,image/webp"
                              className="hidden"
                              disabled={uploadingAvatar}
                              onChange={handleCustomAvatarUpload}
                            />
                          </label>

                          {/* 说明折叠按钮：紧跟自定义上传卡片 */}
                          <button
                            type="button"
                            onClick={() => setShowAvatarHelp((v) => !v)}
                            className="flex items-center gap-1.5 p-2 rounded-xl text-slate-400 hover:text-indigo-300 hover:bg-slate-900/60 transition cursor-pointer"
                          >
                            <Info className="w-3.5 h-3.5 shrink-0" />
                            <span className="text-[11px] font-medium">说明</span>
                            <ChevronRight
                              className={`w-3 h-3 transition-transform ${showAvatarHelp ? 'rotate-90' : ''}`}
                            />
                          </button>
                        </div>

                        {showAvatarHelp && (
                          <div className="mt-2.5 p-3 rounded-xl bg-slate-900/60 border border-slate-800 text-xs text-slate-400 leading-relaxed">
                            <span className="text-slate-200 font-semibold">💡 为什么企业管理员只保留一个通用默认头像？</span>
                            <p className="mt-1 text-[11px] text-slate-400">
                              此处为全企业的统一接待形象（在访客未分配具体人工或由 AI 机器人服务时展示）。
                              具体的客服人员拥有各自的坐席端账号，其真实头像、专业头衔与个性化介绍，完全由坐席在【个人设置与接待状态】中自主配置与更新！管理员也可以在【坐席人员与权限】中进行统一协助管理。
                            </p>
                          </div>
                        )}
                        </div>
                      </div>

                      {/* Section 2: Welcome Greeting & Quick Suggestions */}
                      <div className="space-y-4 pt-2 border-t border-slate-800">
                        <div className="text-sm font-bold text-indigo-300 uppercase tracking-wider flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                          <span>2. 迎宾文案与快捷引导词</span>
                        </div>

                        {/* Welcome Greeting */}
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <label className="text-xs font-semibold text-slate-300">访客首句问候语 (欢迎接待词)</label>
                            <span className="text-[11px] text-slate-500">支持自动解析多行</span>
                          </div>
                          <textarea
                            rows={4}
                            value={tenantConfig.welcome_msg}
                            onChange={(e) => setTenantConfig({ ...tenantConfig, welcome_msg: e.target.value })}
                            className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500 leading-relaxed resize-none"
                            placeholder="新访客打开咨询窗口时系统自动播发的首句迎宾词..."
                          />
                        </div>

                        {/* Guide Options Toggle & Customizer */}
                        <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="text-xs font-semibold text-white flex items-center gap-2">
                                <span>迎宾语下方自动展示引导选项</span>
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-normal">
                                  快捷引导
                                </span>
                              </div>
                              <div className="text-[11px] text-slate-400 mt-0.5">
                                开启后，访客咨询首句欢迎语下方将展示可点击的快捷咨询选项
                              </div>
                            </div>
                            <input
                              type="checkbox"
                              checked={tenantConfig.enable_guide_options ?? true}
                              onChange={(e) =>
                                setTenantConfig({
                                  ...tenantConfig,
                                  enable_guide_options: e.target.checked,
                                  guide_options: tenantConfig.guide_options || [
                                    '了解产品功能与特性',
                                    '获取方案报价与私有化部署',
                                    '联系人工客服支持',
                                  ],
                                })
                              }
                              className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
                            />
                          </div>

                          {(tenantConfig.enable_guide_options ?? true) && (
                            <div className="pt-3 border-t border-slate-800 space-y-2.5">
                              <div className="flex items-center justify-between text-[11px]">
                                <span className="text-slate-300 font-medium">自定义引导选项内容：</span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setTenantConfig({
                                      ...tenantConfig,
                                      guide_options: [
                                        '了解产品功能与特性',
                                        '获取方案报价与私有化部署',
                                        '联系人工客服支持',
                                      ],
                                    })
                                  }
                                  className="text-[10.5px] text-indigo-400 hover:text-indigo-300 transition cursor-pointer"
                                >
                                  恢复预设
                                </button>
                              </div>

                              {/* Options List */}
                              <div className="flex flex-wrap items-center gap-1.5">
                                {(tenantConfig.guide_options && tenantConfig.guide_options.length > 0
                                  ? tenantConfig.guide_options
                                  : ['了解产品功能与特性', '获取方案报价与私有化部署', '联系人工客服支持']
                                ).map((opt, idx) => (
                                  <div
                                    key={idx}
                                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800/90 border border-slate-700 text-[11.5px] text-slate-200 group hover:border-slate-600 transition"
                                  >
                                    <span>{opt}</span>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const currentList =
                                          tenantConfig.guide_options && tenantConfig.guide_options.length > 0
                                            ? tenantConfig.guide_options
                                            : [
                                                '了解产品功能与特性',
                                                '获取方案报价与私有化部署',
                                                '联系人工客服支持',
                                              ];
                                        const updated = currentList.filter((_, i) => i !== idx);
                                        setTenantConfig({ ...tenantConfig, guide_options: updated });
                                      }}
                                      className="text-slate-400 hover:text-rose-400 ml-0.5 text-xs transition cursor-pointer"
                                      title="删除此选项"
                                    >
                                      ×
                                    </button>
                                  </div>
                                ))}

                                {tenantConfig.guide_options && tenantConfig.guide_options.length === 0 && (
                                  <span className="text-[11px] text-slate-500 py-1">
                                    暂无引导选项，请在下方输入并添加
                                  </span>
                                )}
                              </div>

                              {/* Add Option Input */}
                              <div className="flex items-center gap-2 pt-1">
                                <input
                                  type="text"
                                  value={newGuideOptionInput}
                                  onChange={(e) => setNewGuideOptionInput(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault();
                                      if (newGuideOptionInput.trim()) {
                                        const currentList =
                                          tenantConfig.guide_options && tenantConfig.guide_options.length > 0
                                            ? tenantConfig.guide_options
                                            : [
                                                '了解产品功能与特性',
                                                '获取方案报价与私有化部署',
                                                '联系人工客服支持',
                                              ];
                                        setTenantConfig({
                                          ...tenantConfig,
                                          guide_options: [...currentList, newGuideOptionInput.trim()],
                                        });
                                        setNewGuideOptionInput('');
                                      }
                                    }
                                  }}
                                  placeholder="输入自定义引导选项，例如：预约技术顾问演示"
                                  className="flex-1 px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (newGuideOptionInput.trim()) {
                                      const currentList =
                                        tenantConfig.guide_options && tenantConfig.guide_options.length > 0
                                          ? tenantConfig.guide_options
                                          : [
                                              '了解产品功能与特性',
                                              '获取方案报价与私有化部署',
                                              '联系人工客服支持',
                                            ];
                                      setTenantConfig({
                                        ...tenantConfig,
                                        guide_options: [...currentList, newGuideOptionInput.trim()],
                                      });
                                      setNewGuideOptionInput('');
                                    }
                                  }}
                                  disabled={!newGuideOptionInput.trim()}
                                  className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-medium text-white transition cursor-pointer shrink-0"
                                >
                                  + 添加
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Section 3: Proactive Interaction & Leads */}
                      <div className="space-y-3 pt-2 border-t border-slate-800">
                        <div className="text-sm font-bold text-indigo-300 uppercase tracking-wider flex items-center gap-1.5 mb-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                          <span>3. 进线策略与交互增强</span>
                        </div>

                        {/* Auto-popup Toggle */}
                        <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2.5">
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="text-xs font-semibold text-white">进线自动弹窗主动招呼</div>
                              <div className="text-[11px] text-slate-400">访客浏览网站达到指定时长后，右下角自动展开问候气泡提示</div>
                            </div>
                            <input
                              type="checkbox"
                              checked={tenantConfig.enable_auto_popup}
                              onChange={(e) => setTenantConfig({ ...tenantConfig, enable_auto_popup: e.target.checked })}
                              className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
                            />
                          </div>
                          {tenantConfig.enable_auto_popup && (
                            <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-300">
                              <span>弹窗触发延迟：</span>
                              <div className="flex items-center gap-1.5 flex-wrap justify-end">
                                {[
                                  { label: '5秒 (推荐)', sec: 5 },
                                  { label: '10秒', sec: 10 },
                                  { label: '15秒', sec: 15 },
                                ].map((delay) => {
                                  const isSelected =
                                    !isCustomDelay &&
                                    [5, 10, 15].includes(tenantConfig.auto_popup_delay_sec || 5) &&
                                    (tenantConfig.auto_popup_delay_sec || 5) === delay.sec;
                                  return (
                                    <button
                                      key={delay.sec}
                                      type="button"
                                      onClick={() => {
                                        setIsCustomDelay(false);
                                        setTenantConfig({ ...tenantConfig, auto_popup_delay_sec: delay.sec });
                                      }}
                                      className={`px-2.5 py-1 rounded transition text-[10.5px] cursor-pointer ${
                                        isSelected
                                          ? 'bg-indigo-600 text-white font-medium shadow-sm'
                                          : 'bg-slate-800 text-slate-400 hover:text-white'
                                      }`}
                                    >
                                      {delay.label}
                                    </button>
                                  );
                                })}

                                {/* 自定义选项 */}
                                {isCustomDelay || ![5, 10, 15].includes(tenantConfig.auto_popup_delay_sec || 5) ? (
                                  <div className="flex items-center gap-1 bg-indigo-600/20 border border-indigo-500/50 rounded-lg px-2 py-0.5">
                                    <span className="text-indigo-300 text-[10.5px] font-medium">自定义:</span>
                                    <input
                                      type="number"
                                      min={1}
                                      max={300}
                                      value={tenantConfig.auto_popup_delay_sec || ''}
                                      onChange={(e) => {
                                        const val = e.target.value === '' ? 0 : parseInt(e.target.value, 10);
                                        setTenantConfig({
                                          ...tenantConfig,
                                          auto_popup_delay_sec: isNaN(val) ? 0 : Math.max(1, Math.min(300, val)),
                                        });
                                      }}
                                      placeholder="秒数"
                                      className="w-12 px-1 py-0.5 text-center bg-slate-900 border border-slate-700 rounded text-[10.5px] text-white focus:outline-none focus:border-indigo-400 font-mono"
                                      autoFocus
                                    />
                                    <span className="text-slate-400 text-[10.5px]">秒</span>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setIsCustomDelay(true);
                                      if ([5, 10, 15].includes(tenantConfig.auto_popup_delay_sec || 5)) {
                                        setTenantConfig({ ...tenantConfig, auto_popup_delay_sec: 20 });
                                      }
                                    }}
                                    className="px-2.5 py-1 rounded transition text-[10.5px] bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
                                  >
                                    自定义
                                  </button>
                                )}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Pre-Chat Form Toggle —— 第一版暂不开放，后续放开时去掉 false && */}
                        {false && (
                        <label className="flex items-center justify-between p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 cursor-pointer hover:border-slate-700 transition">
                          <div>
                            <div className="text-xs font-semibold text-white flex items-center gap-1.5">
                              <span>进线前填表留资 (Pre-Chat Lead Form)</span>
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20 font-normal">
                                请慎重开启
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-400">开始咨询前强制要求访客留下姓名与联系电话/邮箱</div>
                          </div>
                          <input
                            type="checkbox"
                            checked={tenantConfig.enable_prechat_form}
                            onChange={(e) => setTenantConfig({ ...tenantConfig, enable_prechat_form: e.target.checked })}
                            className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
                          />
                        </label>
                        )}
                      </div>
                    </div>

                    {/* Submit Button (At bottom of stretched card) */}
                    <div className="pt-4 border-t border-slate-800/80">
                      <button
                        type="submit"
                        className="w-full py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition shadow-md shadow-indigo-500/20 cursor-pointer flex items-center justify-center gap-2"
                      >
                        <Check className="w-4 h-4" />
                        <span>保存并实时同步至所有嵌入站点</span>
                      </button>
                      <p className="text-[11px] text-slate-500 text-center mt-2">
                        无需重新发布嵌入代码，已接入的站点将在保存后毫秒级静默热更新生效
                      </p>
                    </div>
                  </form>

                  {/* Right: Live Interactive Mockup Preview (Stretched & Expanded to Match) */}
                  <div className="xl:col-span-5 bg-slate-800/40 p-5 md:p-6 rounded-2xl border border-slate-800 shadow-sm flex flex-col justify-between">
                    {/* Preview Bar Controls */}
                    <div>
                      <div className="flex flex-wrap items-center justify-between gap-2.5 mb-4">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                            <Eye className="w-4 h-4 text-indigo-400" />
                            <span>访客端挂件实时效果预览</span>
                          </span>
                          <span className="text-[10.5px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full font-medium">
                            实时渲染中
                          </span>
                        </div>
                      </div>

                      {/* Finalized Visitor Chat Widget Container (Exact 1:1 Replica, Taller & Roomier) */}
                      {previewWidgetMode === 'minimized' ? (
                        /* 最小化态：在预览区内右下角展示悬浮头像，点击展开（不跳到独立演示页） */
                        <div className="w-full max-w-98.75 mx-auto relative bg-slate-900/40 rounded-2xl border border-slate-700/70 min-h-145 my-2">
                          <div className="absolute top-4 left-4 text-xs text-slate-400">
                            <p className="font-semibold text-slate-300">网页{widgetPosition === 'right' ? '右下角' : '左下角'}折叠挂件状态</p>
                            <p className="text-[11px] text-slate-500 mt-0.5">访客未展开或点击「—」最小化时展示悬浮头像</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setPreviewWidgetMode('chat')}
                            className={`absolute ${widgetPosition === 'right' ? 'bottom-5 right-5' : 'bottom-5 left-5'} w-14 h-14 rounded-full bg-white border-2 border-white shadow-[0_8px_24px_rgba(0,0,0,0.22)] flex items-center justify-center hover:scale-105 transition active:scale-95 cursor-pointer`}
                            title="点击展开会话窗口"
                          >
                            <img
                              src={selectedAvatar}
                              alt="在线客服"
                              className="w-full h-full rounded-full object-cover"
                            />
                            <span className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full bg-[#00c853] border-2 border-white shadow-xs" />
                          </button>
                        </div>
                      ) : (
                        /* Expanded Chat Dialog Container (660px Height Matching widget.js & ChatPage 1:1) */
                        <div className="w-full max-w-98.75 mx-auto space-y-2">
                          {/* Preview Persona Switcher */}
                          <div className="flex items-center gap-1 bg-slate-900/90 p-1 rounded-xl border border-slate-700/60 shadow-xs">
                            <button
                              type="button"
                              onClick={() => setPreviewPersona('bot')}
                              className={`flex-1 py-1.5 px-2 rounded-lg text-[11px] font-medium transition cursor-pointer flex items-center justify-center gap-1 ${
                                previewPersona === 'bot'
                                  ? 'bg-indigo-600 text-white shadow-xs'
                                  : 'text-slate-400 hover:text-slate-200'
                              }`}
                            >
                              <span>🤖 默认企业/AI接待</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setPreviewPersona('agent')}
                              className={`flex-1 py-1.5 px-2 rounded-lg text-[11px] font-medium transition cursor-pointer flex items-center justify-center gap-1 ${
                                previewPersona === 'agent'
                                  ? 'bg-indigo-600 text-white shadow-xs'
                                  : 'text-slate-400 hover:text-slate-200'
                              }`}
                            >
                              <span>👤 模拟具体坐席</span>
                            </button>
                          </div>

                          <div className="bg-white rounded-3xl shadow-[0_20px_60px_-10px_rgba(0,0,0,0.24),0_0_0_1px_rgba(0,0,0,0.06)] overflow-hidden flex flex-col text-slate-800 border border-slate-200/80 min-h-160">
                            {/* 1. Finalized ChatHeader */}
                            <ChatHeader
                              tenantName={tenantConfig.tenant_name || '光年跃迁'}
                              themeColor={tenantConfig.theme_color || '#1972f5'}
                              agentName={previewPersona === 'agent' ? '小布丁' : 'AI 助手'}
                              agentAvatar={
                                previewPersona === 'agent'
                                  ? '/avatars/agent-male.png'
                                  : selectedAvatar
                              }
                              agentTitle={previewPersona === 'agent' ? '在线技术支持' : '智能在线客服'}
                              agentBio={
                                previewPersona === 'agent'
                                  ? `欢迎咨询 ${tenantConfig.tenant_name || '光年跃迁'}，我们将竭诚为您解答产品、计费与系统对接相关疑问。`
                                  : `您好！我是企业智能客服助手，7x24 小时随时为您解答常见问题，如需人工支持可随时发起转接。`
                              }
                              isWorkingHours={true}
                              onClose={() => setPreviewWidgetMode('minimized')}
                            />

                            {/* 2. Chat Body Area: PreChatForm OR Live Conversation */}
                            {previewWidgetMode === 'prechat' ? (
                              <div className="flex-1 p-4 bg-slate-50 flex items-center justify-center overflow-y-auto min-h-115">
                                <PreChatForm
                                  themeColor={tenantConfig.theme_color || '#1972f5'}
                                  onSubmit={() => setPreviewWidgetMode('chat')}
                                />
                              </div>
                            ) : (
                              <div className="flex-1 p-4.5 bg-[#f8fafc] space-y-4 text-xs overflow-y-auto min-h-115">
                                {/* Timestamp Divider */}
                                <div className="flex justify-center my-1">
                                  <span className="text-[10.5px] text-slate-400 bg-slate-200/60 px-2.5 py-0.5 rounded-full">
                                    今天 14:30
                                  </span>
                                </div>

                                {/* Agent Welcome Message with Avatar and Official Badge */}
                                <div className="flex items-start gap-2.5">
                                  <img
                                    src={
                                      previewPersona === 'agent'
                                        ? '/avatars/agent-male.png'
                                        : selectedAvatar
                                    }
                                    alt={tenantConfig.tenant_name || '光年跃迁'}
                                    className="w-8 h-8 rounded-full object-cover border border-slate-200 shadow-xs shrink-0"
                                  />
                                  <div className="flex-1 min-w-0 max-w-[85%]">
                                    <div className="flex items-center gap-1.5 mb-1 ml-0.5">
                                      <span className="text-[12px] font-normal text-slate-500">
                                        {previewPersona === 'agent' ? '小布丁' : 'AI 助手'}
                                      </span>
                                    </div>
                                    <div className="bg-white p-3.5 rounded-2xl border border-slate-200/90 shadow-2xs text-slate-800 leading-relaxed text-[13px]">
                                      {tenantConfig.welcome_msg || '您好！欢迎咨询光年跃迁，我们随时为您提供专业的产品与技术支持。请问有什么可以帮您？'}
                                    </div>

                                  {/* Suggested Quick Reply Chips */}
                                  {(tenantConfig.enable_guide_options ?? true) && (
                                    <div className="flex flex-wrap gap-1.5 mt-2.5">
                                      {(tenantConfig.guide_options && tenantConfig.guide_options.length > 0
                                        ? tenantConfig.guide_options
                                        : ['了解产品功能与特性', '获取方案报价与私有化部署', '联系人工客服支持']
                                      ).map((chip, idx) => (
                                        <span
                                          key={idx}
                                          className="text-[11px] px-2.5 py-1 rounded-full bg-white border border-slate-200 text-slate-600 hover:border-blue-400 hover:text-blue-600 transition shadow-2xs cursor-pointer select-none"
                                        >
                                          {chip}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Visitor WeChat-Style 4" Voice Bubble */}
                              <div className="flex justify-end">
                                <div
                                  className="relative flex items-center gap-3 px-3.5 py-2.5 rounded-[14px] text-white shadow-2xs select-none"
                                  style={{ backgroundColor: tenantConfig.theme_color || '#1972f5' }}
                                >
                                  <span
                                    className="absolute -right-1.25 top-3 w-0 h-0 border-t-[5px] border-t-transparent border-b-[5px] border-b-transparent border-l-[5px]"
                                    style={{ borderLeftColor: tenantConfig.theme_color || '#1972f5' }}
                                  />
                                  <span className="text-[13.5px] font-medium tracking-tight text-white">4"</span>
                                  <div className="scale-x-[-1] flex items-center shrink-0 text-white">
                                    <svg
                                      className="w-4 h-4"
                                      viewBox="0 0 24 24"
                                      fill="none"
                                      stroke="currentColor"
                                      strokeWidth="2.3"
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                    >
                                      <path d="M6 10.5 A 2 2 0 0 1 6 13.5" strokeWidth="2.8" />
                                      <path d="M10.5 7.5 A 6 6 0 0 1 10.5 16.5" />
                                      <path d="M15 4.5 A 10.5 10.5 0 0 1 15 19.5" />
                                    </svg>
                                  </div>
                                </div>
                              </div>

                              {/* Agent Follow-up Message */}
                              <div className="flex items-start gap-2.5">
                                <img
                                  src={selectedAvatar}
                                  alt="客服顾问"
                                  className="w-8 h-8 rounded-full object-cover border border-slate-200 shadow-xs shrink-0"
                                />
                                <div className="bg-white p-3.5 rounded-2xl border border-slate-200/90 shadow-2xs max-w-[85%] text-slate-800 leading-relaxed text-[13px]">
                                  已收到您的语音咨询！专属技术客服顾问已就绪，请随时交流。
                                </div>
                              </div>

                              {/* Reassurance pill */}
                              <div className="flex justify-center pt-1">
                                <span className="text-[10.5px] text-slate-400 bg-white border border-slate-200/80 px-2.5 py-0.5 rounded-full shadow-2xs">
                                  企业级会话已建立 · 实时加密保障
                                </span>
                              </div>
                            </div>
                          )}

                          {/* 3. Finalized Replicated Crisp Input Bar */}
                          <div className="p-3 bg-white border-t border-slate-100 shrink-0">
                            <div
                              className="border-[1.8px] rounded-[22px] bg-white px-3.5 pt-2.5 pb-2 transition-all duration-200 shadow-2xs"
                              style={{
                                borderColor: tenantConfig.theme_color || '#1972f5',
                                boxShadow: `0 0 0 3px ${(tenantConfig.theme_color || '#1972f5')}18`,
                              }}
                            >
                              <div className="text-[13.5px] text-slate-400 select-none pb-1.5 font-normal min-h-9.5 leading-relaxed">
                                输入你的信息...
                              </div>
                              <div className="flex items-center justify-between text-slate-500">
                                <div className="flex items-center gap-2 text-[#64748b]">
                                  <button type="button" className="p-1 rounded-md hover:text-slate-800 transition cursor-pointer" title="插入表情">
                                    <Smile className="w-4 h-4" />
                                  </button>
                                  <button type="button" className="p-1 rounded-md hover:text-slate-800 transition cursor-pointer" title="添加附件或图片">
                                    <Paperclip className="w-4 h-4 rotate-45" />
                                  </button>
                                  <button type="button" className="p-1 rounded-md hover:text-slate-800 transition cursor-pointer" title="切换为按住说话语音模式">
                                    <svg viewBox="0 0 20 20" width="16" height="16" fill="currentColor">
                                      <rect x="2.5" y="6" width="2" height="8" rx="1" />
                                      <rect x="7" y="3" width="2" height="14" rx="1" />
                                      <rect x="11.5" y="5" width="2" height="10" rx="1" />
                                      <rect x="16" y="8" width="2" height="4" rx="1" />
                                    </svg>
                                  </button>
                                </div>
                                <button
                                  type="button"
                                  className="p-1.5 transition select-none cursor-pointer hover:opacity-80 active:scale-95"
                                  style={{ color: tenantConfig.theme_color || '#1972f5' }}
                                  title="发送信息 (Enter)"
                                >
                                  <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                                    <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                                   </svg>
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Floating Launcher Avatar OUTSIDE the conversation window at bottom-right */}
                        <div className="flex items-center justify-end pr-1 pt-2">
                          <button
                            type="button"
                            onClick={() => setPreviewWidgetMode('minimized')}
                            className="w-13 h-13 rounded-full bg-white border-2 border-white shadow-[0_8px_24px_rgba(0,0,0,0.28)] flex items-center justify-center relative hover:scale-105 active:scale-95 transition cursor-pointer group"
                            title="点击收起会话窗口 (右下角挂件)"
                          >
                            <img
                              src={selectedAvatar}
                              alt="在线客服"
                              className="w-full h-full rounded-full object-cover"
                            />
                            <span className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full bg-[#00c853] border-2 border-white shadow-xs" />
                          </button>
                        </div>
                      </div>
                    )}
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 2: Agents Management */}
              {tenantAdminTab === 'agents' && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-base font-bold text-white">客服团队成员管理</h2>
                      <p className="text-xs text-slate-400 mt-0.5">添加或停用坐席账号，编辑坐席基础信息</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowAddAgentModal(true)}
                      className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-md shadow-indigo-500/20 transition cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      <span>添加客服坐席</span>
                    </button>
                  </div>

                  <div className="bg-slate-800/40 border border-slate-800 rounded-2xl overflow-hidden">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-900/80 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider">
                          <th className="py-3.5 px-4">坐席姓名</th>
                          <th className="py-3.5 px-4">系统权限角色</th>
                          <th className="py-3.5 px-4">在线接待状态</th>
                          <th className="py-3.5 px-4">账号可用性</th>
                          <th className="py-3.5 px-4">加入时间</th>
                          <th className="py-3.5 px-4 text-center">操作</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/80">
                        {tenantAgents
                          .filter((a) => a.role === 'agent')
                          .map((a) => (
                            <tr key={a.userId} className="hover:bg-slate-800/50 transition">
                              <td className="py-3.5 px-4">
                                <div className="flex items-center gap-3">
                                  <div className="relative shrink-0">
                                    <img
                                      src={a.avatar || tenantConfig?.default_avatar || '/avatars/agent-female.png'}
                                      alt={a.nickname}
                                      className="w-9 h-9 rounded-full object-cover border border-slate-700 shadow-xs"
                                    />
                                    <span
                                      className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-slate-900 ${
                                        a.status === 'online'
                                          ? 'bg-emerald-400'
                                          : a.status === 'away'
                                          ? 'bg-amber-400'
                                          : 'bg-slate-500'
                                      }`}
                                    />
                                  </div>
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-1.5">
                                      <span className="font-semibold text-white text-sm">{a.nickname}</span>
                                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                                        {a.title || '在线客服'}
                                      </span>
                                    </div>
                                    <div className="text-[11px] text-slate-400 font-mono mt-0.5">{a.account}</div>
                                    {a.bio && (
                                      <div className="text-[10.5px] text-slate-400/80 truncate max-w-55 mt-0.5" title={a.bio}>
                                        💬 {a.bio}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </td>
                              <td className="py-3.5 px-4">
                                <span
                                  className={`px-2 py-0.5 rounded-full font-semibold text-[10.5px] ${
                                    a.role === 'tenant_admin'
                                      ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/30'
                                      : 'bg-slate-700 text-slate-300'
                                  }`}
                                >
                                  {a.role === 'tenant_admin' ? '租户主管管理员' : '普通客服坐席'}
                                </span>
                              </td>
                              <td className="py-3.5 px-4">
                                <span
                                  className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10.5px] font-medium ${
                                    a.status === 'online'
                                      ? 'text-emerald-400 bg-emerald-500/10'
                                      : a.status === 'away'
                                      ? 'text-amber-400 bg-amber-500/10'
                                      : 'text-slate-400 bg-slate-800'
                                  }`}
                                >
                                  <span
                                    className={`w-1.5 h-1.5 rounded-full ${
                                      a.status === 'online'
                                        ? 'bg-emerald-400'
                                        : a.status === 'away'
                                        ? 'bg-amber-400'
                                        : 'bg-slate-500'
                                    }`}
                                  />
                                  <span>{a.status === 'online' ? '在线' : a.status === 'away' ? '暂离' : '离线'}</span>
                                </span>
                              </td>
                              <td className="py-3.5 px-4">
                                <span
                                  className={`px-2 py-0.5 rounded text-[10.5px] font-semibold ${
                                    a.enabled ? 'text-emerald-400' : 'text-red-400'
                                  }`}
                                >
                                  {a.enabled ? '正常可用' : '已停用'}
                                </span>
                              </td>
                              <td className="py-3.5 px-4 text-slate-400">{formatJoinTime(a.createdAt)}</td>
                              <td className="py-3.5 px-4">
                                <div className="flex items-center justify-center gap-2">
                                {!a.enabled && (
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteAgent(a)}
                                    title="删除坐席"
                                    className="px-2.5 py-1 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/30 transition cursor-pointer inline-flex items-center justify-center"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingAgent({ ...a });
                                    setShowResetPwd(false);
                                    setResetPwd('');
                                    setResetPwdConfirm('');
                                    setShowEditAgentModal(true);
                                  }}
                                  className="px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-indigo-300 hover:text-indigo-200 border border-slate-700 transition cursor-pointer"
                                >
                                  编辑资料
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleToggleAgentEnabled(a)}
                                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition cursor-pointer ${
                                    a.enabled
                                      ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/30'
                                      : 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/30'
                                  }`}
                                >
                                  {a.enabled ? '停用' : '启用'}
                                </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Tab 3: Business Hours & Routing */}
              {tenantAdminTab === 'hours' && tenantConfig && (
                <div className="bg-slate-800/40 p-6 rounded-2xl border border-slate-800 space-y-6">
                  <div>
                    <h2 className="text-base font-bold text-white">客服营业时间与无人值守规则</h2>
                    <p className="text-xs text-slate-400 mt-1">设置客服工作时间。非工作时间访客进线将自动进入离线留言模式</p>
                  </div>

                  <div className="grid grid-cols-2 gap-5">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1.5">每日开始接待时间</label>
                      <input
                        type="time"
                        value={tenantConfig.work_start_time}
                        onChange={(e) => setTenantConfig({ ...tenantConfig, work_start_time: e.target.value })}
                        className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1.5">每日结束接待时间</label>
                      <input
                        type="time"
                        value={tenantConfig.work_end_time}
                        onChange={(e) => setTenantConfig({ ...tenantConfig, work_end_time: e.target.value })}
                        className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
                      />
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
                    <div className="text-xs font-semibold text-white mb-1">当前工作时间状态</div>
                    <p className="text-xs text-emerald-400">
                      ● 目前配置为全天候服务（00:00 - 23:59），任何时刻访客进线均自动接通在线客服。
                    </p>
                  </div>
                </div>
              )}

              {/* Tab: 修改登录密码（内容区水平垂直居中） */}
              {tenantAdminTab === 'password' && (
                <div className="min-h-[calc(100vh-140px)] flex items-center justify-center">
                  <div className="w-full max-w-lg bg-slate-800/40 p-6 rounded-2xl border border-slate-800">
                    <h2 className="text-base font-bold text-white mb-2">修改登录密码</h2>
                    <p className="text-xs text-slate-400 mb-6">
                      定期更换密码可以保障企业账号安全。修改成功后，下次登录请使用新密码。
                    </p>
                    <form onSubmit={handleChangePassword} className="space-y-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1.5">当前密码</label>
                        <input
                          type="password"
                          required
                          value={pwdData.old}
                          onChange={(e) => setPwdData({ ...pwdData, old: e.target.value })}
                          placeholder="请输入当前登录密码"
                          className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1.5">新密码</label>
                        <input
                          type="password"
                          required
                          minLength={6}
                          value={pwdData.next}
                          onChange={(e) => setPwdData({ ...pwdData, next: e.target.value })}
                          placeholder="至少 6 位，建议字母 + 数字组合"
                          className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1.5">确认新密码</label>
                        <input
                          type="password"
                          required
                          minLength={6}
                          value={pwdData.confirm}
                          onChange={(e) => setPwdData({ ...pwdData, confirm: e.target.value })}
                          placeholder="再次输入新密码"
                          className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
                        />
                      </div>
                      <div className="flex justify-end pt-2">
                        <button
                          type="submit"
                          disabled={pwdSaving}
                          className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-xs font-semibold text-white transition shadow-md shadow-indigo-500/20 cursor-pointer"
                        >
                          {pwdSaving ? '提交中...' : '确认修改'}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}

              {tenantAdminTab === 'embed' && (
                <div className="bg-slate-800/40 p-6 rounded-2xl border border-slate-800 space-y-6">
                  <div>
                    <h2 className="text-base font-bold text-white">网站安装嵌入代码 (JavaScript Snippet)</h2>
                    <p className="text-xs text-slate-400 mt-1">
                      将以下代码复制粘贴到您公司官方网站 HTML 模板的 <code>&lt;/body&gt;</code> 标签之前即可完成集成。
                    </p>
                  </div>

                  <div className="relative bg-slate-950 p-4 rounded-2xl border border-slate-800 font-mono text-xs text-blue-300">
                    <code>{embedSnippet}</code>
                    <button
                      type="button"
                      onClick={handleCopyScript}
                      className="absolute right-3 top-3 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 transition cursor-pointer shadow"
                    >
                      {copiedScript ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedScript ? '已复制' : '一键复制'}</span>
                    </button>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2 text-xs text-slate-300">
                    <div className="font-semibold text-white">集成与兼容性说明：</div>
                    <ul className="list-disc list-inside space-y-1 text-slate-400">
                      <li>支持 Vue、React、WordPress、Shopify、静态 HTML 等任何前端框架。</li>
                      <li>自适应桌面端（右下角悬浮展开）与移动端（全屏安全抽屉）。</li>
                      <li>内置防白屏与异步加载，完全不阻塞宿主网站的首屏加载性能。</li>
                    </ul>
                  </div>
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* Modal: Create Platform Tenant (Super Admin Only) */}
      {showCreateTenantModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateTenant}
            className="max-w-md w-full bg-slate-900 border border-slate-700 rounded-2xl p-6 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Building2 className="w-4 h-4 text-blue-400" />
                <span>开通新企业租户 (SaaS Tenant)</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowCreateTenantModal(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">企业全称</label>
              <input
                type="text"
                required
                value={newTenantData.name}
                onChange={(e) => setNewTenantData({ ...newTenantData, name: e.target.value })}
                placeholder="例如：极光跃动科技有限公司"
                className="w-full px-3.5 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">管理员联系邮箱（选填）</label>
              <input
                type="email"
                value={newTenantData.adminEmail}
                onChange={(e) => setNewTenantData({ ...newTenantData, adminEmail: e.target.value })}
                placeholder="例如：boss@company.com"
                className="w-full px-3.5 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">公司负责人（选填）</label>
                <input
                  type="text"
                  value={newTenantData.ownerName}
                  onChange={(e) => setNewTenantData({ ...newTenantData, ownerName: e.target.value })}
                  placeholder="例如：张经理"
                  className="w-full px-3.5 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">负责人联系方式（选填）</label>
                <input
                  type="text"
                  value={newTenantData.ownerContact}
                  onChange={(e) => setNewTenantData({ ...newTenantData, ownerContact: e.target.value })}
                  placeholder="手机 / 微信 / 邮箱"
                  className="w-full px-3.5 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">企业主登录账号</label>
              <input
                type="text"
                required
                value={newTenantData.username}
                onChange={(e) => setNewTenantData({ ...newTenantData, username: e.target.value })}
                placeholder="例如：jiguang-admin"
                className="w-full px-3.5 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">企业主登录密码</label>
              <input
                type="text"
                required
                minLength={6}
                value={newTenantData.password}
                onChange={(e) => setNewTenantData({ ...newTenantData, password: e.target.value })}
                placeholder="至少 6 位，创建后请转告企业主"
                className="w-full px-3.5 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">初始授权坐席席位数</label>
              <input
                type="number"
                min={1}
                max={100}
                value={newTenantData.maxSeats}
                onChange={(e) => setNewTenantData({ ...newTenantData, maxSeats: Number(e.target.value) })}
                className="w-full px-3.5 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                开通时限（服务到期日，留空 = 不限期）
              </label>
              <div className="flex items-center gap-1.5 mb-2">
                {[3, 6, 12].map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() =>
                      setNewTenantData({ ...newTenantData, expireAt: fmtLocalDate(addMonths(new Date(), m)) })
                    }
                    className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-[11px] font-medium text-slate-300 transition cursor-pointer"
                  >
                    {m === 12 ? '1 年' : `${m} 个月`}
                  </button>
                ))}
              </div>
              <input
                type="date"
                value={newTenantData.expireAt}
                onChange={(e) => setNewTenantData({ ...newTenantData, expireAt: e.target.value })}
                className="w-full px-3.5 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white scheme-dark"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">本次支付费用（元，选填）</label>
              <input
                type="number"
                min={0}
                step="0.01"
                value={newTenantData.paymentAmount}
                onChange={(e) => setNewTenantData({ ...newTenantData, paymentAmount: e.target.value })}
                placeholder="例如：399"
                className="w-full px-3.5 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white"
              />
            </div>

            <div className="flex justify-end gap-2.5 pt-3">
              <button
                type="button"
                onClick={() => setShowCreateTenantModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-300 transition"
              >
                取消
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white transition shadow-md shadow-blue-500/20"
              >
                确认创建
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: Renew Platform Tenant (Super Admin Only) */}
      {renewTenant && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleRenewTenant}
            className="max-w-md w-full bg-slate-900 border border-slate-700 rounded-2xl p-6 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <RefreshCw className="w-4 h-4 text-blue-400" />
                <span>企业续费</span>
              </h3>
              <button
                type="button"
                onClick={() => setRenewTenant(null)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="text-xs text-slate-300 bg-slate-800/60 border border-slate-800 rounded-xl px-3.5 py-2.5">
              <div className="font-semibold text-white text-sm">{renewTenant.name}</div>
              <div className="mt-1 text-slate-400">
                当前到期：
                {(() => {
                  const st = expireState(renewTenant.expireAt);
                  if (st.kind === 'none') return <span className="text-slate-300">不限期</span>;
                  if (st.kind === 'expired')
                    return <span className="text-red-400 font-semibold">已过期（{renewTenant.expireAt}）</span>;
                  return <span className="text-slate-200">{renewTenant.expireAt}</span>;
                })()}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                新的服务到期日
              </label>
              <div className="flex items-center gap-1.5 mb-2">
                {[3, 6, 12].map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() =>
                      setRenewData((prev) => ({
                        ...prev,
                        // 始终基于「续费基准日」直接顺延（未到期=当前到期日，否则=今天），而非在输入框值上累加
                        expireAt: fmtLocalDate(addMonths(new Date(`${renewBase}T00:00:00`), m)),
                      }))
                    }
                    className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-[11px] font-medium text-slate-300 transition cursor-pointer"
                  >
                    顺延 {m === 12 ? '1 年' : `${m} 个月`}
                  </button>
                ))}
              </div>
              <input
                type="date"
                required
                value={renewData.expireAt}
                onChange={(e) => setRenewData((prev) => ({ ...prev, expireAt: e.target.value }))}
                className="w-full px-3.5 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white scheme-dark"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">本次续费金额（元，选填）</label>
              <input
                type="number"
                min={0}
                step="0.01"
                value={renewData.paymentAmount}
                onChange={(e) => setRenewData((prev) => ({ ...prev, paymentAmount: e.target.value }))}
                placeholder="例如：399"
                className="w-full px-3.5 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white"
              />
            </div>

            <div className="flex justify-end gap-2.5 pt-3">
              <button
                type="button"
                onClick={() => setRenewTenant(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-300 transition"
              >
                取消
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white transition shadow-md shadow-blue-500/20"
              >
                确认续费
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: Add Agent (Tenant Admin Only) */}
      {showAddAgentModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleAddAgent}
            className="max-w-md w-full bg-slate-900 border border-slate-700 rounded-2xl p-6 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-indigo-400" />
                <span>新增客服坐席</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowAddAgentModal(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">坐席昵称</label>
              <input
                type="text"
                required
                value={newAgentData.nickname}
                onChange={(e) => setNewAgentData({ ...newAgentData, nickname: e.target.value })}
                placeholder="例如：客服小萱"
                className="w-full px-3.5 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">登录账号</label>
              <input
                type="text"
                required
                value={newAgentData.account}
                onChange={(e) => setNewAgentData({ ...newAgentData, account: e.target.value })}
                placeholder="例如：xuan"
                className="w-full px-3.5 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">登录密码</label>
              <input
                type="password"
                required
                value={newAgentData.password}
                onChange={(e) => setNewAgentData({ ...newAgentData, password: e.target.value })}
                placeholder="至少 6 位"
                className="w-full px-3.5 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">确认密码</label>
              <input
                type="password"
                required
                value={newAgentConfirmPwd}
                onChange={(e) => setNewAgentConfirmPwd(e.target.value)}
                placeholder="再次输入密码"
                className="w-full px-3.5 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white"
              />
            </div>

            <div className="flex justify-end gap-2.5 pt-3">
              <button
                type="button"
                onClick={() => setShowAddAgentModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-300 transition"
              >
                取消
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white transition shadow-md shadow-indigo-500/20"
              >
                确认添加
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: Edit Agent Profile (Admin assisting or inspecting) */}
      {showEditAgentModal && editingAgent && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveAgentProfile}
            className="max-w-md w-full bg-slate-900 border border-slate-700 rounded-2xl p-6 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-indigo-400" />
                <span>编辑坐席资料（{editingAgent.nickname}）</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowEditAgentModal(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Current Avatar & Presets */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-2">坐席接待头像</label>
              <div className="flex items-center gap-3 mb-3">
                <img
                  src={editingAgent.avatar || tenantConfig?.default_avatar || '/avatars/agent-female.png'}
                  alt={editingAgent.nickname}
                  className="w-12 h-12 rounded-full object-cover border-2 border-indigo-500 shadow-md"
                />
                <div className="text-xs text-slate-400">
                  <div className="text-white font-medium">当前头像预览</div>
                  <div className="text-[11px] text-slate-500">坐席端亦可在个人中心随时修改</div>
                </div>
              </div>
              <div className="grid grid-cols-4 gap-2 mb-2">
                {[
                  '/avatars/agent-male.png',
                  '/avatars/agent-female.png',
                ].map((url) => (
                  <button
                    key={url}
                    type="button"
                    onClick={() => setEditingAgent({ ...editingAgent, avatar: url })}
                    className={`p-1 rounded-xl border transition cursor-pointer flex justify-center ${
                      editingAgent.avatar === url
                        ? 'border-indigo-500 bg-indigo-500/20'
                        : 'border-slate-700 hover:border-slate-500'
                    }`}
                  >
                    <img src={url} alt="avatar option" className="w-8 h-8 rounded-full object-cover" />
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">登录账号</label>
              <input
                type="text"
                readOnly
                value={editingAgent.account || ''}
                className="w-full px-3.5 py-2 bg-slate-800/50 border border-slate-700 rounded-xl text-xs text-slate-400 cursor-not-allowed"
              />
            </div>

            <div>
              {!showResetPwd ? (
                <button
                  type="button"
                  onClick={() => setShowResetPwd(true)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-amber-300 hover:text-amber-200 border border-slate-700 transition cursor-pointer"
                >
                  重置密码
                </button>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">新密码</label>
                    <input
                      type="password"
                      value={resetPwd}
                      onChange={(e) => setResetPwd(e.target.value)}
                      placeholder="至少 6 位"
                      className="w-full px-3.5 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">确认新密码</label>
                    <input
                      type="password"
                      value={resetPwdConfirm}
                      onChange={(e) => setResetPwdConfirm(e.target.value)}
                      placeholder="再次输入新密码"
                      className="w-full px-3.5 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setShowResetPwd(false);
                      setResetPwd('');
                      setResetPwdConfirm('');
                    }}
                    className="text-xs text-slate-400 hover:text-slate-300 cursor-pointer"
                  >
                    取消重置
                  </button>
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">坐席对外昵称</label>
              <input
                type="text"
                required
                value={editingAgent.nickname}
                onChange={(e) => setEditingAgent({ ...editingAgent, nickname: e.target.value })}
                className="w-full px-3.5 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">对外服务头衔</label>
              <input
                type="text"
                value={editingAgent.title || ''}
                onChange={(e) => setEditingAgent({ ...editingAgent, title: e.target.value })}
                placeholder="例如：在线技术支持 / 资深解决方案架构师"
                className="w-full px-3.5 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                点击三角形展开的个人接待介绍
              </label>
              <textarea
                rows={3}
                value={editingAgent.bio || ''}
                onChange={(e) => setEditingAgent({ ...editingAgent, bio: e.target.value })}
                placeholder="例如：欢迎咨询光年跃迁，我们将竭诚为您解答产品、计费与系统对接相关疑问。"
                className="w-full px-3.5 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white leading-relaxed resize-none"
              />
            </div>

            <div className="flex justify-end gap-2.5 pt-3">
              <button
                type="button"
                onClick={() => setShowEditAgentModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-300 transition"
              >
                取消
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white transition shadow-md shadow-indigo-500/20"
              >
                保存资料
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Toast Popup Notification */}
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 animate-bounce">
          <div className="px-4 py-3 rounded-xl bg-slate-800 text-white text-xs font-medium shadow-2xl border border-slate-700 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>{toastMsg.text}</span>
          </div>
        </div>
      )}
    </div>
  );
};
