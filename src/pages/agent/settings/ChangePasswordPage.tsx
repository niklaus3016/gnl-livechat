import React, { useState } from 'react';
import { KeyRound, Lock, CheckCircle2 } from 'lucide-react';
import { changeTenantPassword } from '../../../api';

interface PasswordForm {
  old: string;
  next: string;
  confirm: string;
}

/**
 * 坐席修改登录密码
 * 走 PUT /admin/tenant/password（后端对本租户坐席开放：按当前登录账号操作，校验旧密码）
 */
export const ChangePasswordPage: React.FC = () => {
  const [pwdData, setPwdData] = useState<PasswordForm>({ old: '', next: '', confirm: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!pwdData.old) {
      setError('请填写当前密码');
      return;
    }
    if (pwdData.next.length < 6) {
      setError('新密码至少 6 位');
      return;
    }
    if (pwdData.next !== pwdData.confirm) {
      setError('两次输入的新密码不一致');
      return;
    }
    if (pwdData.next === pwdData.old) {
      setError('新密码不能与当前密码相同');
      return;
    }
    try {
      setSaving(true);
      await changeTenantPassword({ oldPassword: pwdData.old, newPassword: pwdData.next });
      setSuccess(true);
      setPwdData({ old: '', next: '', confirm: '' });
      setTimeout(() => setSuccess(false), 3500);
    } catch (err: any) {
      setError(err.message || '修改失败');
    } finally {
      setSaving(false);
    }
  };

  const inputCls =
    'w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition';

  return (
    <div className="h-full overflow-y-auto">
      <div className="min-h-full p-6 md:p-8 max-w-lg mx-auto flex flex-col justify-center">
        {/* Page Header */}
        <div className="mb-6 text-center">
          <h1 className="text-xl font-bold text-slate-900">修改登录密码</h1>
        </div>

        {/* Form Card */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 md:p-8">
            <div className="flex items-center gap-2.5 mb-6">
              <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
                <KeyRound className="w-4.5 h-4.5" />
              </div>
              <h2 className="text-base font-bold text-slate-900">更新登录密码</h2>
            </div>

            {success && (
              <div className="mb-4 flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-medium">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                登录密码已更新，下次登录请使用新密码
              </div>
            )}
            {error && (
              <div className="mb-4 px-3.5 py-2.5 rounded-xl bg-red-50 border border-red-200 text-red-600 text-xs font-medium">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">当前密码</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="password"
                    required
                    value={pwdData.old}
                    onChange={(e) => setPwdData({ ...pwdData, old: e.target.value })}
                    placeholder="请输入当前登录密码"
                    className={`${inputCls} pl-9`}
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">新密码</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={pwdData.next}
                    onChange={(e) => setPwdData({ ...pwdData, next: e.target.value })}
                    placeholder="至少 6 位，建议字母 + 数字组合"
                    className={`${inputCls} pl-9`}
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">确认新密码</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={pwdData.confirm}
                    onChange={(e) => setPwdData({ ...pwdData, confirm: e.target.value })}
                    placeholder="请再次输入新密码"
                    className={`${inputCls} pl-9`}
                  />
                </div>
              </div>

              <div className="pt-2 flex flex-col items-center gap-3">
                <p className="text-xs text-slate-400">修改成功后，下次登录请使用新密码。</p>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-8 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white text-sm font-medium transition cursor-pointer"
                >
                  {saving ? '保存中…' : '确认修改'}
                </button>
              </div>
            </form>
          </div>
      </div>
    </div>
  );
};
