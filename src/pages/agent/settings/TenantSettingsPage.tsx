import React, { useEffect, useState } from 'react';
import { getTenantSetting, updateTenantSetting } from '../../../api';
import { TenantConfig } from '../../../types';
import {
  Building2,
  Palette,
  Clock,
  MessageSquare,
  Sparkles,
  Save,
  CheckCircle2,
  ShieldCheck,
  Bell,
  Calendar,
} from 'lucide-react';

export const TenantSettingsPage: React.FC = () => {
  const [config, setConfig] = useState<TenantConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const [newGuideOptionInput, setNewGuideOptionInput] = useState('');

  // Preset theme colors
  const THEME_PRESETS = [
    { label: '极光蓝 (Aurora Blue)', value: '#2563eb' },
    { label: '翡翠绿 (Emerald)', value: '#059669' },
    { label: '深紫罗兰 (Violet)', value: '#7c3aed' },
    { label: '炽焰橙 (Sunset)', value: '#ea580c' },
    { label: '石墨黑 (Obsidian)', value: '#0f172a' },
    { label: '玫红 (Rose)', value: '#e11d48' },
  ];

  useEffect(() => {
    getTenantSetting().then(setConfig).catch(console.error);
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!config) return;

    try {
      setLoading(true);
      const updated = await updateTenantSetting(config);
      setConfig(updated);
      setToastMsg('租户全局配置已成功保存生效！');
      setTimeout(() => setToastMsg(''), 3500);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  if (!config) {
    return <div className="p-8 text-xs text-slate-400">正在加载租户配置...</div>;
  }

  return (
    <div className="h-full overflow-y-auto p-8 max-w-4xl">
      {/* Top Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900">租户全局系统配置</h1>
            <span className="text-[11px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-semibold border border-blue-200">
              仅租户管理员可见
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            定义访客端聊天窗口视觉主题、欢迎接待语、服务工作周期及接入弹窗规则
          </p>
        </div>

        <a
          href="/agent/analytics"
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-sm transition"
        >
          <span>查看 SLA 数据报表</span>
          <span>→</span>
        </a>
      </div>

      {toastMsg && (
        <div className="mb-6 p-3 bg-emerald-50 text-emerald-800 text-xs rounded-xl border border-emerald-200 flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>{toastMsg}</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* 1. Appearance & Theme */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-6 space-y-4">
          <div className="flex items-center gap-2 font-bold text-sm text-slate-800 border-b border-slate-100 pb-3">
            <Palette className="w-4 h-4 text-blue-600" />
            <span>聊天窗口外观与品牌定制</span>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-2">
              聊天窗口主色调 (Theme Color)
            </label>
            <div className="flex flex-wrap items-center gap-3">
              {THEME_PRESETS.map((preset) => (
                <button
                  key={preset.value}
                  type="button"
                  onClick={() => setConfig({ ...config, theme_color: preset.value })}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-medium transition cursor-pointer ${
                    config.theme_color === preset.value
                      ? 'border-slate-900 ring-2 ring-slate-900/10 bg-slate-50'
                      : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <span
                    className="w-4 h-4 rounded-full shadow-xs border border-white"
                    style={{ backgroundColor: preset.value }}
                  />
                  <span>{preset.label}</span>
                </button>
              ))}

              <div className="flex items-center gap-2 pl-2">
                <span className="text-xs text-slate-400">自定义:</span>
                <input
                  type="color"
                  value={config.theme_color}
                  onChange={(e) => setConfig({ ...config, theme_color: e.target.value })}
                  className="w-8 h-8 rounded-lg cursor-pointer border border-slate-200"
                />
                <span className="text-xs font-mono text-slate-600 uppercase">
                  {config.theme_color}
                </span>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              访客接入欢迎语 (Welcome Message)
            </label>
            <textarea
              rows={3}
              required
              value={config.welcome_msg}
              onChange={(e) => setConfig({ ...config, welcome_msg: e.target.value })}
              className="w-full p-3 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:bg-white focus:border-blue-500 resize-none leading-relaxed"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              新访客点击展开聊天窗口时，系统自动发送的第一条接待指引问候。
            </p>

            {/* Guide Options Toggle & Customizer */}
            <div className="mt-4 p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold text-slate-800 flex items-center gap-2">
                    <span>迎宾语下方自动展示引导选项</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 font-normal">
                      快捷引导
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    开启后，访客进入咨询后欢迎接待词下方将展示可点击的快捷咨询选项
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.enable_guide_options ?? true}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        enable_guide_options: e.target.checked,
                        guide_options: config.guide_options || [
                          '了解产品功能与特性',
                          '获取方案报价与私有化部署',
                          '联系人工客服支持',
                        ],
                      })
                    }
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-300 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>

              {(config.enable_guide_options ?? true) && (
                <div className="pt-3 border-t border-slate-200 space-y-2.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-700 font-medium">自定义引导选项内容：</span>
                    <button
                      type="button"
                      onClick={() =>
                        setConfig({
                          ...config,
                          guide_options: [
                            '了解产品功能与特性',
                            '获取方案报价与私有化部署',
                            '联系人工客服支持',
                          ],
                        })
                      }
                      className="text-[10.5px] text-blue-600 hover:text-blue-700 transition cursor-pointer"
                    >
                      恢复预设选项
                    </button>
                  </div>

                  {/* Options List */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    {(config.guide_options && config.guide_options.length > 0
                      ? config.guide_options
                      : ['了解产品功能与特性', '获取方案报价与私有化部署', '联系人工客服支持']
                    ).map((opt, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-[11.5px] text-slate-700 shadow-2xs hover:border-slate-300 transition"
                      >
                        <span>{opt}</span>
                        <button
                          type="button"
                          onClick={() => {
                            const currentList =
                              config.guide_options && config.guide_options.length > 0
                                ? config.guide_options
                                : [
                                    '了解产品功能与特性',
                                    '获取方案报价与私有化部署',
                                    '联系人工客服支持',
                                  ];
                            const updated = currentList.filter((_, i) => i !== idx);
                            setConfig({ ...config, guide_options: updated });
                          }}
                          className="text-slate-400 hover:text-rose-500 ml-0.5 text-xs transition cursor-pointer"
                          title="删除此选项"
                        >
                          ×
                        </button>
                      </div>
                    ))}

                    {config.guide_options && config.guide_options.length === 0 && (
                      <span className="text-[11px] text-slate-400 py-1">
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
                              config.guide_options && config.guide_options.length > 0
                                ? config.guide_options
                                : [
                                    '了解产品功能与特性',
                                    '获取方案报价与私有化部署',
                                    '联系人工客服支持',
                                  ];
                            setConfig({
                              ...config,
                              guide_options: [...currentList, newGuideOptionInput.trim()],
                            });
                            setNewGuideOptionInput('');
                          }
                        }
                      }}
                      placeholder="输入自定义引导选项，例如：预约技术专家演示"
                      className="flex-1 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (newGuideOptionInput.trim()) {
                          const currentList =
                            config.guide_options && config.guide_options.length > 0
                              ? config.guide_options
                              : [
                                  '了解产品功能与特性',
                                  '获取方案报价与私有化部署',
                                  '联系人工客服支持',
                                ];
                          setConfig({
                            ...config,
                            guide_options: [...currentList, newGuideOptionInput.trim()],
                          });
                          setNewGuideOptionInput('');
                        }
                      }}
                      disabled={!newGuideOptionInput.trim()}
                      className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-medium text-white transition cursor-pointer shrink-0"
                    >
                      + 添加
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 2. Service Schedule & Hours */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-6 space-y-4">
          <div className="flex items-center gap-2 font-bold text-sm text-slate-800 border-b border-slate-100 pb-3">
            <Clock className="w-4 h-4 text-amber-500" />
            <span>客服在线服务时间与非工作状态</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                每日开始营业时间 (HH:mm)
              </label>
              <input
                type="time"
                value={config.work_start_time}
                onChange={(e) => setConfig({ ...config, work_start_time: e.target.value })}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:bg-white focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                每日营业截止时间 (HH:mm)
              </label>
              <input
                type="time"
                value={config.work_end_time}
                onChange={(e) => setConfig({ ...config, work_end_time: e.target.value })}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:bg-white focus:border-blue-500"
              />
            </div>
          </div>
          <p className="text-[11px] text-slate-400">
            非工作时间内，访客端聊天界面将自动切换为【离线留言表单】，访客提交的信息将妥善存入备忘录。
          </p>
        </div>

        {/* 3. Interactive Features & Rules */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-6 space-y-4">
          <div className="flex items-center gap-2 font-bold text-sm text-slate-800 border-b border-slate-100 pb-3">
            <Bell className="w-4 h-4 text-emerald-600" />
            <span>接入引导与自动化规则</span>
          </div>

          <div className="space-y-4">
            {/* Pre-chat Form Toggle */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200/80">
              <div>
                <div className="text-xs font-semibold text-slate-800">
                  开启咨询前信息采集表单 (Pre-chat Form)
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  要求访客在开始对话前必须先填写姓名与联系邮箱
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.enable_prechat_form}
                  onChange={(e) =>
                    setConfig({ ...config, enable_prechat_form: e.target.checked })
                  }
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-300 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>

            {/* Auto Popup */}
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold text-slate-800">
                    网页进入 N 秒后自动弹出咨询窗口 (Auto Popup)
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    由 widget.js 脚本驱动，访客关闭后在会话周期内不重复打扰
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.enable_auto_popup}
                    onChange={(e) =>
                      setConfig({ ...config, enable_auto_popup: e.target.checked })
                    }
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-300 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>

              {config.enable_auto_popup && (
                <div className="flex items-center justify-between gap-3 pt-2 border-t border-slate-200/60 text-xs">
                  <label className="text-slate-600">自动弹窗延迟时间：</label>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {[
                      { label: '5秒 (推荐)', sec: 5 },
                      { label: '10秒', sec: 10 },
                      { label: '15秒', sec: 15 },
                    ].map((delay) => {
                      const isSelected = config.auto_popup_delay_sec === delay.sec;
                      return (
                        <button
                          key={delay.sec}
                          type="button"
                          onClick={() => setConfig({ ...config, auto_popup_delay_sec: delay.sec })}
                          className={`px-2.5 py-1 rounded-md transition text-xs font-medium cursor-pointer ${
                            isSelected
                              ? 'bg-blue-600 text-white shadow-xs'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          {delay.label}
                        </button>
                      );
                    })}
                    <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-md px-2 py-0.5">
                      <span className="text-slate-500 text-xs">自定义:</span>
                      <input
                        type="number"
                        min={1}
                        max={300}
                        value={config.auto_popup_delay_sec}
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            auto_popup_delay_sec: Number(e.target.value) || 5,
                          })
                        }
                        className="w-12 px-1 py-0.5 text-center bg-white border border-slate-200 rounded text-xs font-mono text-slate-800 focus:outline-hidden focus:border-blue-500"
                      />
                      <span className="text-slate-500 text-xs">秒</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Auto close days */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200/80">
              <div>
                <div className="text-xs font-semibold text-slate-800">
                  离线不活跃会话自动归档天数
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  无应答会话将在达到天数后自动归档
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={config.auto_close_days}
                  onChange={(e) =>
                    setConfig({ ...config, auto_close_days: Number(e.target.value) || 7 })
                  }
                  className="w-20 px-2.5 py-1 text-xs bg-white border border-slate-200 rounded-lg focus:outline-hidden focus:border-blue-500"
                />
                <span className="text-xs text-slate-500">天</span>
              </div>
            </div>
          </div>
        </div>

        {/* Save button */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-xs font-medium rounded-xl shadow-md transition disabled:opacity-40 cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>{loading ? '正在保存...' : '保存租户配置'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
