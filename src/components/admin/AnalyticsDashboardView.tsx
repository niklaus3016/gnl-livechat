import React, { useEffect, useMemo, useState } from 'react';
import { Download, Zap, Smile, MessagesSquare, Inbox, Timer, ShieldCheck, Compass, Star, Trophy, Info } from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { getAnalyticsOverview } from '../../api';
import type { AnalyticsOverview } from '../../api/agent-api';

const pad = (n: number) => String(n).padStart(2, '0');
const fmtDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const MSG_TYPE_NAMES: Record<string, string> = {
  text: '文本消息',
  image: '图片',
  file: '文件',
  voice: '语音',
  system: '系统消息',
};
const MSG_TYPE_COLORS = ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#ef4444', '#06b6d4'];

export const AnalyticsDashboardView: React.FC = () => {
  const [timeRange, setTimeRange] = useState<'today' | '7d' | '30d'>('today');
  const [data, setData] = useState<AnalyticsOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const now = new Date();
    const start = new Date(now);
    if (timeRange === '7d') start.setDate(now.getDate() - 6);
    if (timeRange === '30d') start.setDate(now.getDate() - 29);
    let cancelled = false;
    setLoading(true);
    setError('');
    getAnalyticsOverview(fmtDate(start), fmtDate(now))
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .catch((e) => {
        if (!cancelled) setError(e?.message || '统计数据加载失败');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [timeRange]);

  const trendData = useMemo(
    () =>
      (data?.daily_trend || []).map((d) => ({
        time: d.date.slice(5),
        会话量: d.conversations,
        消息量: d.messages,
      })),
    [data]
  );

  const typeData = useMemo(
    () =>
      Object.entries(data?.messages.by_type || {}).map(([k, v], i) => ({
        name: MSG_TYPE_NAMES[k] || k,
        value: v,
        color: MSG_TYPE_COLORS[i % MSG_TYPE_COLORS.length],
      })),
    [data]
  );

  const statusData = useMemo(() => {
    const c = data?.conversations;
    if (!c || c.total === 0) return [];
    return [
      { label: '已解决', value: c.resolved, cls: 'bg-emerald-500' },
      { label: '进行中', value: c.active, cls: 'bg-blue-500' },
      { label: '排队中', value: c.queued, cls: 'bg-amber-500' },
      { label: '离线留言', value: c.offline_lead, cls: 'bg-slate-500' },
    ];
  }, [data]);

  // P1 新增：渠道来源分布
  const sourceData = useMemo(() => {
    const list = data?.by_source || [];
    const total = list.reduce((s, i) => s + i.count, 0);
    const max = list.length ? Math.max(...list.map((i) => i.count)) : 0;
    return { list, total, max };
  }, [data]);

  // P1 新增：1~5 星评价分布
  const csatRows = useMemo(() => {
    const dist = data?.csat_distribution || {};
    return [5, 4, 3, 2, 1].map((star) => ({ star, count: dist[String(star)] ?? 0 }));
  }, [data]);

  const resolve = data?.resolution;
  const slaRate = resolve ? Math.round(((resolve.sla?.compliant_rate ?? 0) || 0) * 100) : 0;
  const ranking = data?.agent_ranking || [];

  const handleExportCSV = () => {
    if (!trendData.length) return;
    const csvContent =
      'data:text/csv;charset=utf-8,\ufeff' +
      '日期,会话量,消息量\n' +
      trendData.map((e) => `${e.time},${e.会话量},${e.消息量}`).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `客服运营报表_${timeRange}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const c = data?.conversations;
  const frt = data?.first_response;
  const msgs = data?.messages;

  return (
    <div className="space-y-6">
      {/* 顶部控制栏 */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-5 rounded-2xl bg-slate-800/60 border border-slate-700/60">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <span>服务质量与运营数据报表</span>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-medium">
              实时动态统计
            </span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            统计会话总量、首次响应时效 (FRT)、客户满意度 (CSAT) 与消息量趋势
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {/* 时间切换 */}
          <div className="flex items-center bg-slate-900 p-1 rounded-xl border border-slate-700 text-xs font-medium">
            <button
              type="button"
              onClick={() => setTimeRange('today')}
              className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                timeRange === 'today' ? 'bg-blue-600 text-white font-semibold' : 'text-slate-400 hover:text-white'
              }`}
            >
              今日实时
            </button>
            <button
              type="button"
              onClick={() => setTimeRange('7d')}
              className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                timeRange === '7d' ? 'bg-blue-600 text-white font-semibold' : 'text-slate-400 hover:text-white'
              }`}
            >
              近 7 天
            </button>
            <button
              type="button"
              onClick={() => setTimeRange('30d')}
              className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                timeRange === '30d' ? 'bg-blue-600 text-white font-semibold' : 'text-slate-400 hover:text-white'
              }`}
            >
              近 30 天
            </button>
          </div>

          {/* 导出报表按钮 */}
          <button
            type="button"
            onClick={handleExportCSV}
            disabled={!trendData.length}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed text-slate-200 text-xs font-semibold transition cursor-pointer border border-slate-600"
            title="导出当前周期的运营报表 (CSV)"
          >
            <Download className="w-3.5 h-3.5 text-blue-400" />
            <span>导出 CSV</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/30 text-sm text-red-400">{error}</div>
      )}

      {/* 统计口径与时区说明（后端 metric_note + period 回显） */}
      {data?.metric_note && (
        <div className="flex items-start gap-2 px-3.5 py-2.5 rounded-xl bg-slate-800/40 border border-slate-700/50 text-[11.5px] text-slate-400 leading-relaxed">
          <Info className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />
          <span>
            {data.metric_note}
            {data.period.tz && <span className="text-slate-500">（统计时区 {data.period.tz}）</span>}
          </span>
        </div>
      )}

      {loading && !data ? (
        <div className="p-12 rounded-2xl bg-slate-800/60 border border-slate-700/60 text-center text-sm text-slate-400">
          正在加载统计数据...
        </div>
      ) : error ? null : (
        data && (
          <>
            {/* 4 大核心运营 KPI 卡片 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* 会话总量 */}
              <div className="p-4 rounded-2xl bg-slate-800/60 border border-slate-700/60 relative overflow-hidden">
                <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
                  <span className="font-semibold flex items-center gap-1.5">
                    <Inbox className="w-3.5 h-3.5 text-blue-400" />
                    会话总量
                  </span>
                  <span className="text-[10.5px] text-slate-500">
                    {data.period.start_date} ~ {data.period.end_date}
                  </span>
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-3xl font-extrabold text-white font-mono">{c?.total ?? 0}</span>
                  <span className="text-xs text-slate-400 font-medium">
                    已解决 {c?.resolved ?? 0} / 排队 {c?.queued ?? 0}
                  </span>
                </div>
                <div className="text-[11px] text-slate-400 mt-2">
                  进行中 {c?.active ?? 0}，离线留言 {c?.offline_lead ?? 0}
                </div>
              </div>

              {/* FRT */}
              <div className="p-4 rounded-2xl bg-slate-800/60 border border-slate-700/60 relative overflow-hidden">
                <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
                  <span className="font-semibold flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-amber-400" />
                    首次响应时间 (FRT)
                  </span>
                  <span className="inline-flex items-center text-[10.5px] text-emerald-400">
                    已首响 {frt?.replied_count ?? 0} 个会话
                  </span>
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-3xl font-extrabold text-white font-mono">{frt?.avg_seconds ?? 0}</span>
                  <span className="text-xs text-slate-400 font-medium">秒 (行业标杆 &lt;30s)</span>
                </div>
                <div className="text-[11px] text-slate-400 mt-2">
                  {(frt?.avg_seconds ?? 0) <= 30 ? '首响时效达标' : '首响时效超出 30 秒标杆'}
                </div>
              </div>

              {/* CSAT */}
              <div className="p-4 rounded-2xl bg-slate-800/60 border border-slate-700/60 relative overflow-hidden">
                <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
                  <span className="font-semibold flex items-center gap-1.5">
                    <Smile className="w-3.5 h-3.5 text-emerald-400" />
                    客户满意度 (CSAT)
                  </span>
                  <span className="inline-flex items-center text-[10.5px] text-emerald-400">
                    {(c?.avg_rating ?? 0) >= 4 ? '评价良好' : '有待提升'}
                  </span>
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-3xl font-extrabold text-emerald-400 font-mono">
                    {(c?.avg_rating ?? 0).toFixed(1)}
                  </span>
                  <span className="text-xs text-slate-400 font-medium">均分 / 5.0</span>
                </div>
                <div className="text-[11px] text-slate-400 mt-2">基于 {c?.rated_count ?? 0} 条真实访客评价</div>
              </div>

              {/* 消息总量 */}
              <div className="p-4 rounded-2xl bg-slate-800/60 border border-slate-700/60 relative overflow-hidden">
                <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
                  <span className="font-semibold flex items-center gap-1.5">
                    <MessagesSquare className="w-3.5 h-3.5 text-indigo-400" />
                    消息总量
                  </span>
                  <span className="text-[10.5px] text-slate-500">
                    {Object.keys(msgs?.by_type || {}).length} 种类型
                  </span>
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-3xl font-extrabold text-indigo-300 font-mono">{msgs?.total ?? 0}</span>
                  <span className="text-xs text-slate-400 font-medium">条</span>
                </div>
                <div className="text-[11px] text-slate-400 mt-2">含访客、坐席与系统消息</div>
              </div>
            </div>

            {/* P1 新增：解决效能 KPI（ART + SLA） */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 rounded-2xl bg-slate-800/60 border border-slate-700/60 relative overflow-hidden">
                <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
                  <span className="font-semibold flex items-center gap-1.5">
                    <Timer className="w-3.5 h-3.5 text-cyan-400" />
                    平均解决时长 (ART)
                  </span>
                  <span className="text-[10.5px] text-slate-500">
                    基于 {resolve?.resolved_with_duration ?? 0} 个已解决会话
                  </span>
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-3xl font-extrabold text-cyan-300 font-mono">
                    {resolve?.avg_seconds ?? 0}
                  </span>
                  <span className="text-xs text-slate-400 font-medium">秒</span>
                </div>
                <div className="text-[11px] text-slate-400 mt-2">从会话创建到标记解决的耗时均值</div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-800/60 border border-slate-700/60 relative overflow-hidden">
                <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
                  <span className="font-semibold flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                    首响 SLA 达标率
                  </span>
                  <span className="text-[10.5px] text-slate-500">
                    目标 {resolve?.sla.target_seconds ?? 60}s · 已回复 {resolve?.sla.replied_count ?? 0}
                  </span>
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span
                    className={`text-3xl font-extrabold font-mono ${
                      slaRate >= 80 ? 'text-emerald-400' : slaRate >= 60 ? 'text-amber-400' : 'text-red-400'
                    }`}
                  >
                    {slaRate}%
                  </span>
                  <span className="text-xs text-slate-400 font-medium">
                    达标 {resolve?.sla.compliant_count ?? 0} 个会话
                  </span>
                </div>
                <div className="w-full bg-slate-700/70 h-2 rounded-full overflow-hidden mt-2.5">
                  <div
                    className={`h-full rounded-full ${slaRate >= 80 ? 'bg-emerald-500' : slaRate >= 60 ? 'bg-amber-500' : 'bg-red-500'}`}
                    style={{ width: `${slaRate}%` }}
                  />
                </div>
              </div>
            </div>

            {/* 主图表区：双图表展示 */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* 左侧 2/3：按天会话与消息趋势 */}
              <div className="lg:col-span-2 p-5 rounded-2xl bg-slate-800/60 border border-slate-700/60 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-white">会话量与消息量趋势</h3>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      按天统计（Asia/Shanghai 时区），深色面积为会话进线量
                    </p>
                  </div>
                  <div className="flex items-center gap-4 text-xs">
                    <span className="flex items-center gap-1.5 text-blue-400">
                      <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block" />
                      会话量
                    </span>
                    <span className="flex items-center gap-1.5 text-amber-400">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" />
                      消息量
                    </span>
                  </div>
                </div>

                <div className="h-72 w-full">
                  {trendData.length ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <defs>
                          <linearGradient id="colorSessions" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                        <XAxis dataKey="time" stroke="#94a3b8" fontSize={11} tickLine={false} />
                        <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} allowDecimals={false} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#0f172a',
                            borderColor: '#334155',
                            borderRadius: '0.75rem',
                            color: '#f8fafc',
                            fontSize: '12px',
                          }}
                        />
                        <Area
                          type="monotone"
                          dataKey="会话量"
                          stroke="#3b82f6"
                          strokeWidth={2.5}
                          fillOpacity={1}
                          fill="url(#colorSessions)"
                        />
                        <Area type="monotone" dataKey="消息量" stroke="#f59e0b" strokeWidth={2} fillOpacity={0} />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-xs text-slate-500">
                      当前周期暂无会话数据
                    </div>
                  )}
                </div>
              </div>

              {/* 右侧 1/3：消息类型分布环形图 */}
              <div className="p-5 rounded-2xl bg-slate-800/60 border border-slate-700/60 flex flex-col justify-between space-y-4">
                <div>
                  <h3 className="text-sm font-bold text-white">消息类型分布</h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">按消息类型统计占比</p>
                </div>

                <div className="h-52 w-full flex items-center justify-center">
                  {typeData.length ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={typeData}
                          cx="50%"
                          cy="50%"
                          innerRadius={55}
                          outerRadius={75}
                          paddingAngle={4}
                          dataKey="value"
                        >
                          {typeData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Legend wrapperStyle={{ fontSize: '11px' }} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#0f172a',
                            borderColor: '#334155',
                            borderRadius: '0.75rem',
                            color: '#f8fafc',
                            fontSize: '12px',
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="text-xs text-slate-500">暂无消息数据</div>
                  )}
                </div>

                <div className="space-y-2 text-xs">
                  {typeData.map((t) => (
                    <div key={t.name} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: t.color }} />
                        <span className="text-slate-300">{t.name}</span>
                      </div>
                      <span className="font-mono text-slate-400">{t.value} 条</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* 下方三列：会话状态 / 渠道来源 / 星级分布 */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* 会话状态分布 */}
              <div className="p-5 rounded-2xl bg-slate-800/60 border border-slate-700/60 space-y-4">
                <div>
                  <h3 className="text-sm font-bold text-white">会话状态分布</h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    共 {c?.total ?? 0} 个会话，其中 {c?.resolved ?? 0} 个已解决
                  </p>
                </div>

                {statusData.length ? (
                  <div className="space-y-3 pt-2">
                    {statusData.map((s) => {
                      const pct = c && c.total ? Math.round((s.value / c.total) * 100) : 0;
                      return (
                        <div key={s.label} className="space-y-1">
                          <div className="flex justify-between text-xs">
                            <span className="text-slate-300">{s.label}</span>
                            <span className="text-slate-400 font-mono">
                              {s.value} 个 ({pct}%)
                            </span>
                          </div>
                          <div className="w-full bg-slate-700/70 h-2 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${s.cls}`} style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-xs text-slate-500 pt-2">当前周期暂无会话</div>
                )}
              </div>

              {/* 渠道来源分布 */}
              <div className="p-5 rounded-2xl bg-slate-800/60 border border-slate-700/60 space-y-4">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                    <Compass className="w-4 h-4 text-blue-400" />
                    渠道来源分布
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">按访客来源域名聚合，无来源记为直接访问</p>
                </div>

                {sourceData.list.length ? (
                  <div className="space-y-3 pt-2">
                    {sourceData.list.map((s) => {
                      const pct = sourceData.total ? Math.round((s.count / sourceData.total) * 100) : 0;
                      return (
                        <div key={s.source} className="space-y-1">
                          <div className="flex justify-between text-xs">
                            <span className="text-slate-300 truncate max-w-40" title={s.source}>
                              {s.source}
                            </span>
                            <span className="text-slate-400 font-mono">
                              {s.count} ({pct}%)
                            </span>
                          </div>
                          <div className="w-full bg-slate-700/70 h-2 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full bg-blue-500"
                              style={{ width: `${sourceData.max ? (s.count / sourceData.max) * 100 : 0}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-xs text-slate-500 pt-2">当前周期暂无来源数据</div>
                )}
              </div>

              {/* CSAT 星级分布 */}
              <div className="p-5 rounded-2xl bg-slate-800/60 border border-slate-700/60 space-y-4">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                    <Star className="w-4 h-4 text-amber-400" />
                    满意度星级分布
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    共 {c?.rated_count ?? 0} 条评价，均分 {(c?.avg_rating ?? 0).toFixed(1)} 分
                  </p>
                </div>

                {c?.rated_count ? (
                  <div className="space-y-3 pt-2">
                    {csatRows.map((row) => {
                      const pct = c.rated_count ? Math.round((row.count / c.rated_count) * 100) : 0;
                      return (
                        <div key={row.star} className="space-y-1">
                          <div className="flex justify-between text-xs">
                            <span className="text-slate-300 flex items-center gap-1">
                              {row.star}
                              <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                            </span>
                            <span className="text-slate-400 font-mono">
                              {row.count} ({pct}%)
                            </span>
                          </div>
                          <div className="w-full bg-slate-700/70 h-2 rounded-full overflow-hidden">
                            <div className="h-full rounded-full bg-amber-400" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-xs text-slate-500 pt-2">当前周期暂无评价数据</div>
                )}
              </div>
            </div>

            {/* P1 新增：坐席效能排行 */}
            <div className="p-5 rounded-2xl bg-slate-800/60 border border-slate-700/60 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                    <Trophy className="w-4 h-4 text-amber-400" />
                    坐席效能排行
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">按接待会话数排序：接待数 / 解决数 / 平均首响 / CSAT</p>
                </div>
                <span className="text-[10.5px] text-slate-500">{ranking.length} 位坐席</span>
              </div>

              {ranking.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-900/80 border-b border-slate-700 text-slate-400 font-semibold uppercase tracking-wider">
                        <th className="py-2.5 px-3">排名</th>
                        <th className="py-2.5 px-3">坐席</th>
                        <th className="py-2.5 px-3">接待数</th>
                        <th className="py-2.5 px-3">解决数</th>
                        <th className="py-2.5 px-3">平均首响</th>
                        <th className="py-2.5 px-3">CSAT</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/80">
                      {ranking.map((a, idx) => (
                        <tr key={a.agent_id} className="hover:bg-slate-800/50 transition">
                          <td className="py-2.5 px-3">
                            <span
                              className={`inline-flex w-6 h-6 items-center justify-center rounded-full font-bold text-[11px] ${
                                idx === 0
                                  ? 'bg-amber-400/20 text-amber-300'
                                  : idx === 1
                                    ? 'bg-slate-400/20 text-slate-200'
                                    : idx === 2
                                      ? 'bg-orange-500/20 text-orange-300'
                                      : 'text-slate-500'
                              }`}
                            >
                              {idx + 1}
                            </span>
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="flex items-center gap-2">
                              {a.avatar_url ? (
                                <img src={a.avatar_url} alt="" className="w-6 h-6 rounded-full object-cover" />
                              ) : (
                                <div className="w-6 h-6 rounded-full bg-indigo-600/40 text-indigo-200 flex items-center justify-center text-[10px] font-bold">
                                  {(a.display_name || a.username || '?').slice(0, 1)}
                                </div>
                              )}
                              <div>
                                <div className="font-medium text-slate-200">{a.display_name || a.username}</div>
                                <div className="text-[10px] text-slate-500 font-mono">@{a.username}</div>
                              </div>
                            </div>
                          </td>
                          <td className="py-2.5 px-3 font-mono text-slate-200">{a.handled_count ?? 0}</td>
                          <td className="py-2.5 px-3 font-mono text-emerald-400">{a.resolved_count ?? 0}</td>
                          <td className="py-2.5 px-3 font-mono text-slate-300">{a.avg_first_response_seconds ?? 0}s</td>
                          <td className="py-2.5 px-3 font-mono text-amber-300">{(a.avg_rating ?? 0).toFixed(1)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-xs text-slate-500 pt-2">当前周期暂无坐席接待数据</div>
              )}
            </div>
          </>
        )
      )}
    </div>
  );
};
