/**
 * 会话时间格式化：后端返回 UTC ISO 串（2026-09-15T15:48:50.428Z），
 * 列表展示规则——今天 HH:mm；昨天「昨天 HH:mm」；今年 MM-DD；更早 YYYY-MM-DD。
 * 非 ISO 串（如 mock 预置的「10:07」「昨天 17:10」）原样返回。
 */
export function formatConversationTime(raw?: string): string {
  if (!raw || !/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw || '';
  const d = new Date(raw);
  if (isNaN(d.getTime())) return raw;
  const pad = (n: number) => String(n).padStart(2, '0');
  const hm = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const dayDiff = Math.round((startOfDay(new Date()) - startOfDay(d)) / 86400000);
  if (dayDiff === 0) return hm;
  if (dayDiff === 1) return `昨天 ${hm}`;
  if (d.getFullYear() === new Date().getFullYear()) return `${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
