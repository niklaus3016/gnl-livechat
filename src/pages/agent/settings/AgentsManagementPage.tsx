import React, { useEffect, useState } from 'react';
import {
  getTenantAgents,
  createTenantAgent,
  updateTenantAgent,
} from '../../../api';
import { AgentUser } from '../../../types';
import {
  Users,
  UserPlus,
  Edit2,
  ShieldCheck,
  CheckCircle2,
  X,
  Lock,
  Headphones,
  Search,
} from 'lucide-react';

export const AgentsManagementPage: React.FC = () => {
  const [agents, setAgents] = useState<AgentUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState<AgentUser | null>(null);

  // Form states
  const [formAccount, setFormAccount] = useState('');
  const [formNickname, setFormNickname] = useState('');
  const [formRole, setFormRole] = useState<'agent' | 'tenant_admin'>('agent');
  const [toastMsg, setToastMsg] = useState('');
  const [formError, setFormError] = useState('');

  const loadAgents = async () => {
    try {
      setLoading(true);
      const data = await getTenantAgents();
      setAgents(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAgents();
  }, []);

  const openCreateModal = () => {
    setEditingAgent(null);
    setFormAccount('');
    setFormNickname('');
    setFormRole('agent');
    setFormError('');
    setModalOpen(true);
  };

  const openEditModal = (agent: AgentUser) => {
    setEditingAgent(agent);
    setFormAccount(agent.account);
    setFormNickname(agent.nickname);
    setFormRole(agent.role === 'super_admin' ? 'tenant_admin' : agent.role);
    setFormError('');
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!formNickname.trim()) {
      setFormError('请输入坐席昵称');
      return;
    }

    try {
      if (editingAgent) {
        await updateTenantAgent(editingAgent.userId, {
          nickname: formNickname.trim(),
          role: formRole,
        });
        setToastMsg('坐席信息已更新');
      } else {
        if (!formAccount.trim() || !formAccount.includes('@')) {
          setFormError('请输入有效的登录邮箱账号');
          return;
        }
        await createTenantAgent({
          account: formAccount.trim(),
          nickname: formNickname.trim(),
          role: formRole,
        });
        setToastMsg('新客服坐席已创建，初始默认密码为 123456');
      }
      setModalOpen(false);
      await loadAgents();
      setTimeout(() => setToastMsg(''), 3500);
    } catch (err: any) {
      setFormError(err.message || '操作失败');
    }
  };

  const handleToggleStatus = async (agent: AgentUser) => {
    try {
      await updateTenantAgent(agent.userId, { enabled: !agent.enabled });
      setToastMsg(`坐席【${agent.nickname}】已${!agent.enabled ? '启用' : '禁用'}`);
      await loadAgents();
      setTimeout(() => setToastMsg(''), 3000);
    } catch (e) {
      console.error(e);
    }
  };

  const filtered = agents.filter(
    (a) =>
      a.account.toLowerCase().includes(keyword.toLowerCase()) ||
      a.nickname.toLowerCase().includes(keyword.toLowerCase())
  );

  return (
    <div className="h-full overflow-y-auto p-8 max-w-5xl">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900">租户坐席账号管理</h1>
            <span className="text-[11px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-semibold border border-blue-200">
              仅租户管理员可见
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            配置本租户旗下的客服人员、分配主管与普通坐席权限并控制账号启停
          </p>
        </div>

        <button
          type="button"
          onClick={openCreateModal}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-xs font-medium rounded-xl shadow-md transition cursor-pointer self-start sm:self-auto"
        >
          <UserPlus className="w-4 h-4" />
          <span>添加新坐席</span>
        </button>
      </div>

      {toastMsg && (
        <div className="mb-4 p-3 bg-emerald-50 text-emerald-800 text-xs rounded-xl border border-emerald-200 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Filter search */}
      <div className="mb-4 max-w-sm relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
        <input
          type="text"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="搜索坐席账号邮箱或姓名..."
          className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
        />
      </div>

      {/* Agents Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/80 text-slate-500 font-semibold">
              <th className="py-3 px-4">坐席信息</th>
              <th className="py-3 px-4">角色权限</th>
              <th className="py-3 px-4">实时在线状态</th>
              <th className="py-3 px-4">账号启用状态</th>
              <th className="py-3 px-4 text-right">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map((agent) => (
              <tr key={agent.userId} className="hover:bg-slate-50/70 transition">
                <td className="py-3 px-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-xs">
                      {agent.nickname.substring(0, 1)}
                    </div>
                    <div>
                      <div className="font-semibold text-slate-800">{agent.nickname}</div>
                      <div className="text-[11px] text-slate-400">{agent.account}</div>
                    </div>
                  </div>
                </td>

                <td className="py-3 px-4">
                  {agent.role === 'tenant_admin' ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full border border-indigo-200">
                      <ShieldCheck className="w-3 h-3" />
                      <span>租户管理员</span>
                    </span>
                  ) : agent.role === 'super_admin' ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-red-50 text-red-700 px-2 py-0.5 rounded-full border border-red-200">
                      <span>平台超管</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full">
                      <Headphones className="w-3 h-3 text-slate-400" />
                      <span>普通客服坐席</span>
                    </span>
                  )}
                </td>

                <td className="py-3 px-4">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        agent.status === 'online'
                          ? 'bg-emerald-500'
                          : agent.status === 'away'
                          ? 'bg-amber-500'
                          : 'bg-slate-400'
                      }`}
                    />
                    <span className="text-slate-600 capitalize">
                      {agent.status === 'online' ? '在线' : agent.status === 'away' ? '离开' : '离线'}
                    </span>
                  </div>
                </td>

                <td className="py-3 px-4">
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={agent.enabled}
                      onChange={() => handleToggleStatus(agent)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
                    <span className="ml-2 text-xs font-medium text-slate-600">
                      {agent.enabled ? '已启用' : '已禁用'}
                    </span>
                  </label>
                </td>

                <td className="py-3 px-4 text-right">
                  <button
                    type="button"
                    onClick={() => openEditModal(agent)}
                    className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition cursor-pointer"
                    title="编辑坐席"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add / Edit Agent Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2 text-slate-800 font-bold text-base">
                <Users className="w-5 h-5 text-blue-600" />
                <span>{editingAgent ? '编辑坐席信息' : '添加新客服坐席'}</span>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="mt-4 p-2.5 bg-red-50 text-red-600 text-xs rounded-xl border border-red-200">
                {formError}
              </div>
            )}

            <form onSubmit={handleSave} className="py-4 space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  账号邮箱 (作为登录账号) *
                </label>
                <input
                  type="email"
                  required
                  disabled={!!editingAgent}
                  value={formAccount}
                  onChange={(e) => setFormAccount(e.target.value)}
                  placeholder="agent@aurora.com"
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:bg-white focus:border-blue-500 disabled:bg-slate-100 disabled:text-slate-400"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  对外展示昵称 *
                </label>
                <input
                  type="text"
                  required
                  value={formNickname}
                  onChange={(e) => setFormNickname(e.target.value)}
                  placeholder="例如：技术支持小王"
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:bg-white focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">坐席角色类型</label>
                <select
                  value={formRole}
                  onChange={(e) => setFormRole(e.target.value as any)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:bg-white focus:border-blue-500"
                >
                  <option value="agent">普通客服坐席 (仅接待会话与快捷回复)</option>
                  <option value="tenant_admin">租户管理员 (拥有租户全局设置与人员管理)</option>
                </select>
              </div>

              {!editingAgent && (
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-500">
                  <span>💡 默认初始化登录密码为：<strong>123456</strong></span>
                </div>
              )}

              <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 text-xs text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-xs font-medium rounded-xl shadow-md transition cursor-pointer"
                >
                  {editingAgent ? '保存修改' : '确认添加'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
