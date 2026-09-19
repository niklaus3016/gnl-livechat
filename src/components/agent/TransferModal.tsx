import React, { useEffect, useState } from 'react';
import { getAgentList, transferConversation } from '../../api';
import { AgentUser } from '../../types';
import { UserCheck, X, ArrowRight, ShieldCheck } from 'lucide-react';

interface TransferModalProps {
  conversationId: string;
  currentAssignedId?: string | null;
  onClose: () => void;
  onSuccess: (targetAgent: AgentUser) => void;
}

export const TransferModal: React.FC<TransferModalProps> = ({
  conversationId,
  currentAssignedId,
  onClose,
  onSuccess,
}) => {
  const [agents, setAgents] = useState<AgentUser[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchAgents = async () => {
      try {
        const list = await getAgentList();
        // filter out disabled agents
        const available = list.filter((a) => a.enabled && a.userId !== currentAssignedId);
        setAgents(available);
        if (available.length > 0) {
          setSelectedAgentId(available[0].userId);
        }
      } catch (err: any) {
        setError(err.message || '获取坐席列表失败');
      }
    };
    fetchAgents();
  }, [currentAssignedId]);

  const handleConfirmTransfer = async () => {
    if (!selectedAgentId) return;
    try {
      setLoading(true);
      await transferConversation(conversationId, selectedAgentId);
      const target = agents.find((a) => a.userId === selectedAgentId);
      if (target) onSuccess(target);
      onClose();
    } catch (err: any) {
      setError(err.message || '转接失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2 text-slate-800 font-bold text-base">
            <UserCheck className="w-5 h-5 text-blue-600" />
            <span>会话转接给同租户其他坐席</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mt-4 p-3 bg-red-50 text-red-600 text-xs rounded-xl border border-red-200">
            {error}
          </div>
        )}

        <div className="py-5 space-y-4">
          <p className="text-xs text-slate-600 leading-relaxed">
            选择接收该会话的目标坐席。转接后，该会话将自动同步分配给目标坐席，并在聊天对话中插入转接系统通知。
          </p>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-2">选择目标坐席：</label>
            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {agents.map((agent) => (
                <label
                  key={agent.userId}
                  className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition ${
                    selectedAgentId === agent.userId
                      ? 'border-blue-600 bg-blue-50/50 shadow-xs'
                      : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="radio"
                      name="targetAgent"
                      checked={selectedAgentId === agent.userId}
                      onChange={() => setSelectedAgentId(agent.userId)}
                      className="text-blue-600 focus:ring-blue-500"
                    />
                    <div>
                      <div className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                        <span>{agent.nickname}</span>
                        {agent.role === 'tenant_admin' && (
                          <span className="text-[10px] bg-indigo-100 text-indigo-700 px-1.5 py-0.2 rounded font-normal">
                            主管
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400">{agent.account}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 text-[11px]">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        agent.status === 'online'
                          ? 'bg-emerald-500'
                          : agent.status === 'away'
                          ? 'bg-amber-500'
                          : 'bg-slate-400'
                      }`}
                    />
                    <span className="text-slate-500 capitalize">
                      {agent.status === 'online' ? '在线' : agent.status === 'away' ? '离开' : '离线'}
                    </span>
                  </div>
                </label>
              ))}

              {agents.length === 0 && (
                <div className="text-center py-6 text-xs text-slate-400">
                  暂无其他可转接的在线坐席
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
          >
            取消
          </button>
          <button
            type="button"
            disabled={!selectedAgentId || loading}
            onClick={handleConfirmTransfer}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-xs font-medium rounded-xl shadow-md transition disabled:opacity-40 cursor-pointer"
          >
            <span>{loading ? '正在转接...' : '确认转接'}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
