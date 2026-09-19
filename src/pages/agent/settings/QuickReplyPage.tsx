import React, { useEffect, useState } from 'react';
import {
  getQuickReplies,
  createQuickReply,
  updateQuickReply,
  deleteQuickReply,
  getCurrentAgentToken,
  ApiError,
} from '../../../api';
import { QuickReplyItem } from '../../../types';
import {
  Plus,
  Zap,
  Edit2,
  Trash2,
  Search,
  X,
  CheckCircle2,
  AlertCircle,
  Tag,
  Tags,
  Check,
  ChevronDown,
} from 'lucide-react';

// Custom (empty) categories live in localStorage, scoped per agent account
// (key includes userId) so agents sharing a browser never see each other's
// tags. A category backed only by templates disappears when its last template
// leaves, hence this local persistence for user-created empty ones.
const LEGACY_CATEGORIES_KEY = 'quick_reply_custom_categories';

function customCategoriesKey(): string {
  const uid = getCurrentAgentToken()?.userId || 'unknown';
  return `quick_reply_custom_categories:${uid}`;
}

function loadCustomCategories(): string[] {
  try {
    let raw = localStorage.getItem(customCategoriesKey());
    // One-time migration from the legacy shared key
    if (raw === null) {
      const legacy = localStorage.getItem(LEGACY_CATEGORIES_KEY);
      if (legacy !== null) {
        localStorage.setItem(customCategoriesKey(), legacy);
        raw = legacy;
      }
    }
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.filter((c: unknown) => typeof c === 'string' && c.trim()) : [];
  } catch {
    return [];
  }
}

export const QuickReplyPage: React.FC = () => {
  const [replies, setReplies] = useState<QuickReplyItem[]>([]);
  const [keyword, setKeyword] = useState('');
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<QuickReplyItem | null>(null);

  // Form states
  const [formTitle, setFormTitle] = useState('');
  const [formContent, setFormContent] = useState('');
  const [formCategory, setFormCategory] = useState('通用问候');
  const [formShortcut, setFormShortcut] = useState('');
  const [toastMsg, setToastMsg] = useState('');
  const [toastIsError, setToastIsError] = useState(false);
  // Category tag module
  const [customCategories, setCustomCategories] = useState<string[]>(loadCustomCategories);
  const [activeCategory, setActiveCategory] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [renamingCategory, setRenamingCategory] = useState('');
  const [renameValue, setRenameValue] = useState('');

  const loadReplies = async () => {
    try {
      setLoading(true);
      const data = await getQuickReplies();
      setReplies(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReplies();
  }, []);

  const openCreateModal = () => {
    setEditingItem(null);
    setFormTitle('');
    setFormContent('');
    setFormCategory('通用问候');
    setFormShortcut('');
    setModalOpen(true);
  };

  const openEditModal = (item: QuickReplyItem) => {
    setEditingItem(item);
    setFormTitle(item.title);
    setFormContent(item.content);
    setFormCategory(item.category || '通用问候');
    setFormShortcut(item.shortcut || '');
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim() || !formContent.trim()) return;

    try {
      if (editingItem) {
        await updateQuickReply(editingItem.id, {
          title: formTitle.trim(),
          content: formContent.trim(),
          category: formCategory.trim(),
          shortcut: formShortcut.trim(),
        });
        setToastMsg('快捷回复模板已更新');
      } else {
        await createQuickReply({
          title: formTitle.trim(),
          content: formContent.trim(),
          category: formCategory.trim(),
          shortcut: formShortcut.trim(),
        });
        setToastMsg('新快捷回复模板创建成功');
      }
      setModalOpen(false);
      await loadReplies();
      setTimeout(() => setToastMsg(''), 3000);
    } catch (err) {
      console.error(err);
      showToast(describeError(err, '保存失败，请稍后重试'), true);
    }
  };

  const handleDelete = async (id: string, title: string) => {
    if (!window.confirm(`确定要删除快捷回复【${title}】吗？`)) return;
    try {
      await deleteQuickReply(id);
      setToastMsg('已删除快捷回复');
      await loadReplies();
      setTimeout(() => setToastMsg(''), 3000);
    } catch (err) {
      console.error(err);
      showToast(describeError(err, '删除失败，请稍后重试'), true);
    }
  };

  // Category → template count; display fallback '通用' matches the table and the
  // workbench popup (QuickReplySelect)
  const categoryCounts = replies.reduce<Record<string, number>>((acc, r) => {
    const c = r.category?.trim() || '通用';
    acc[c] = (acc[c] || 0) + 1;
    return acc;
  }, {});
  const allCategories = Array.from(
    new Set([...Object.keys(categoryCounts), ...customCategories])
  );

  // Dropdown options for the template modal — always include the current value
  const categoryOptions =
    formCategory && !allCategories.includes(formCategory)
      ? [formCategory, ...allCategories]
      : allCategories;

  const filtered = replies.filter((r) => {
    const cat = r.category?.trim() || '通用';
    if (activeCategory && cat !== activeCategory) return false;
    return (
      r.title.toLowerCase().includes(keyword.toLowerCase()) ||
      r.content.toLowerCase().includes(keyword.toLowerCase()) ||
      (r.shortcut && r.shortcut.toLowerCase().includes(keyword.toLowerCase()))
    );
  });

  const showToast = (msg: string, isError = false) => {
    setToastMsg(msg);
    setToastIsError(isError);
    setTimeout(() => setToastMsg(''), 3000);
  };

  // Per-agent isolation: backend returns 403 when the record is not owned by the
  // current agent (including already-deleted), so advise refreshing the list.
  const describeError = (err: unknown, fallback: string): string => {
    if (err instanceof ApiError) {
      if (err.code === 403) return '无权操作该模板（可能已删除或归属其他坐席），请刷新列表';
      return err.message || fallback;
    }
    return fallback;
  };

  const persistCustomCategories = (cats: string[]) => {
    setCustomCategories(cats);
    localStorage.setItem(customCategoriesKey(), JSON.stringify(cats));
  };

  const handleAddCategory = () => {
    const name = newCategory.trim();
    if (!name) return;
    if (allCategories.includes(name)) {
      showToast('该分类已存在');
      return;
    }
    persistCustomCategories([...customCategories, name]);
    setNewCategory('');
    showToast(`分类「${name}」已创建`);
  };

  const handleRenameCategory = async () => {
    const oldName = renamingCategory.trim();
    const newName = renameValue.trim();
    if (!oldName || !newName || oldName === newName) {
      setRenamingCategory('');
      return;
    }
    if (allCategories.includes(newName)) {
      showToast('目标分类已存在');
      return;
    }
    try {
      const items = replies.filter((r) => (r.category?.trim() || '通用') === oldName);
      await Promise.all(items.map((i) => updateQuickReply(i.id, { category: newName })));
      persistCustomCategories(customCategories.map((c) => (c === oldName ? newName : c)));
      setRenamingCategory('');
      showToast(`分类已重命名为「${newName}」`);
      await loadReplies();
    } catch (err) {
      console.error(err);
      showToast(describeError(err, '重命名失败，请稍后重试'), true);
    }
  };

  const handleDeleteCategory = async (cat: string) => {
    const count = categoryCounts[cat] || 0;
    if (cat === '通用' && count > 0) {
      showToast('「通用」是默认分类，请先移走其中的模板');
      return;
    }
    const msg =
      count > 0
        ? `删除分类「${cat}」？该分类下的 ${count} 个模板将归入「通用」`
        : `确定删除分类「${cat}」吗？`;
    if (!window.confirm(msg)) return;
    try {
      if (count > 0) {
        const items = replies.filter((r) => (r.category?.trim() || '通用') === cat);
        await Promise.all(items.map((i) => updateQuickReply(i.id, { category: '通用' })));
      }
      persistCustomCategories(customCategories.filter((c) => c !== cat));
      if (activeCategory === cat) setActiveCategory('');
      showToast(`分类「${cat}」已删除`);
      await loadReplies();
    } catch (err) {
      console.error(err);
      showToast(describeError(err, '删除分类失败，请稍后重试'), true);
    }
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="min-h-full p-6 md:p-8 max-w-5xl mx-auto flex flex-col justify-center">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900">快捷回复管理</h1>
          <p className="text-xs text-slate-500 mt-1">
            配置您专属的高频解答模板（仅自己可见和维护），在会话工作台中可一键选中填充发送
          </p>
        </div>

        <button
          type="button"
          onClick={openCreateModal}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-xs font-medium rounded-xl shadow-md transition cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>新建快捷回复</span>
        </button>
      </div>

      {toastMsg && (
        <div
          className={`mb-4 p-3 text-xs rounded-xl border flex items-center gap-2 ${
            toastIsError
              ? 'bg-red-50 text-red-700 border-red-200'
              : 'bg-emerald-50 text-emerald-800 border-emerald-200'
          }`}
        >
          {toastIsError ? (
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          )}
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
          placeholder="按标题、内容或指令搜索快捷语..."
          className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
        />
      </div>

      {/* Table Container — body capped at ~6 rows, scrolls internally with sticky header */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="max-h-105 overflow-y-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="sticky top-0 z-10">
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 font-semibold">
                <th className="py-3 px-4">标题与快捷键</th>
                <th className="py-3 px-4">分类</th>
                <th className="py-3 px-4">回复话术内容</th>
                <th className="py-3 px-4 text-right">操作</th>
              </tr>
            </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map((item) => (
              <tr key={item.id} className="hover:bg-slate-50/70 transition">
                <td className="py-3 px-4 align-top">
                  <div className="font-semibold text-slate-800">{item.title}</div>
                  {item.shortcut && (
                    <span className="inline-block mt-0.5 text-[10px] font-mono text-blue-600 bg-blue-50 px-1.5 py-0.2 rounded border border-blue-200">
                      {item.shortcut}
                    </span>
                  )}
                </td>
                <td className="py-3 px-4 align-top text-slate-600">
                  <span className="inline-flex items-center gap-1 text-[11px] bg-slate-100 px-2 py-0.5 rounded-full text-slate-600">
                    <Tag className="w-3 h-3 text-slate-400" />
                    {item.category || '通用'}
                  </span>
                </td>
                <td className="py-3 px-4 align-top text-slate-600 max-w-md">
                  <p className="line-clamp-2 leading-relaxed whitespace-pre-wrap">{item.content}</p>
                </td>
                <td className="py-3 px-4 align-top text-right">
                  <div className="inline-flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => openEditModal(item)}
                      className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition cursor-pointer"
                      title="编辑模板"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(item.id, item.title)}
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition cursor-pointer"
                      title="删除"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}

            {filtered.length === 0 && (
              <tr>
                <td colSpan={4} className="py-12 text-center text-slate-400">
                  <Zap className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <span>暂无符合条件的快捷回复模板</span>
                </td>
              </tr>
            )}
          </tbody>
          </table>
        </div>
      </div>

      {/* Category Tag Module — overview + add / rename / delete / click-to-filter */}
      <div className="mt-6 bg-white rounded-2xl border border-slate-200 shadow-2xs p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <Tags className="w-4 h-4 text-blue-500" />
            <span className="font-bold text-slate-800 text-sm">分类标签</span>
            <span className="text-[11px] text-slate-400">
              共 {allCategories.length} 个 · 点击标签筛选模板
            </span>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddCategory();
                }
              }}
              placeholder="输入新分类名称"
              className="w-44 px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:bg-white focus:border-blue-500"
            />
            <button
              type="button"
              onClick={handleAddCategory}
              className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-xs font-medium rounded-xl transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>新增分类</span>
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {allCategories.map((cat) => {
            const count = categoryCounts[cat] || 0;
            const isActive = activeCategory === cat;

            // Inline rename editor for this tag
            if (renamingCategory === cat) {
              return (
                <span
                  key={cat}
                  className="inline-flex items-center gap-1 pl-2 pr-1 py-1 rounded-full bg-blue-50 border border-blue-300"
                >
                  <input
                    autoFocus
                    type="text"
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleRenameCategory();
                      }
                      if (e.key === 'Escape') setRenamingCategory('');
                    }}
                    className="w-24 text-xs bg-white border border-blue-300 rounded-full px-2 py-0.5 focus:outline-hidden focus:border-blue-500"
                  />
                  <button
                    type="button"
                    onClick={handleRenameCategory}
                    className="p-0.5 text-emerald-600 hover:bg-emerald-50 rounded-full transition cursor-pointer"
                    title="确认重命名"
                  >
                    <Check className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setRenamingCategory('')}
                    className="p-0.5 text-slate-400 hover:bg-slate-100 rounded-full transition cursor-pointer"
                    title="取消"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </span>
              );
            }

            return (
              <span
                key={cat}
                className={`group inline-flex items-center gap-0.5 pl-2.5 pr-1.5 py-1 rounded-full border text-xs transition ${
                  isActive
                    ? 'bg-blue-600 border-blue-600 text-white font-medium'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-blue-300 hover:bg-blue-50'
                }`}
              >
                <span
                  onClick={() => setActiveCategory(isActive ? '' : cat)}
                  className="inline-flex items-center gap-1 cursor-pointer select-none"
                  title={isActive ? '取消筛选' : `筛选「${cat}」分类模板`}
                >
                  <Tag className={`w-3 h-3 ${isActive ? 'text-blue-100' : 'text-slate-400'}`} />
                  <span>{cat}</span>
                  <span className={`text-[10px] ${isActive ? 'text-blue-100' : 'text-slate-400'}`}>
                    ({count})
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setRenamingCategory(cat);
                    setRenameValue(cat);
                  }}
                  className={`p-0.5 rounded-full transition cursor-pointer ${
                    isActive
                      ? 'text-blue-100 hover:bg-blue-500'
                      : 'text-slate-300 hover:text-blue-600 hover:bg-white'
                  }`}
                  title="重命名分类"
                >
                  <Edit2 className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteCategory(cat)}
                  className={`p-0.5 rounded-full transition cursor-pointer ${
                    isActive
                      ? 'text-blue-100 hover:bg-blue-500'
                      : 'text-slate-300 hover:text-red-600 hover:bg-white'
                  }`}
                  title="删除分类"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </span>
            );
          })}

          {allCategories.length === 0 && (
            <span className="text-xs text-slate-400 py-2">
              暂无分类，在右上方输入名称即可创建第一个分类
            </span>
          )}
        </div>
      </div>

      {/* Add / Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2 text-slate-800 font-bold text-base">
                <Zap className="w-5 h-5 text-amber-500" />
                <span>{editingItem ? '编辑快捷回复模板' : '新增快捷回复模板'}</span>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="py-4 space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">模板标题 *</label>
                <input
                  type="text"
                  required
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="例如：标准问候语 / 售后退款流程"
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:bg-white focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">所属分类</label>
                  <div className="relative">
                    <select
                      value={formCategory}
                      onChange={(e) => setFormCategory(e.target.value)}
                      className="w-full appearance-none px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:bg-white focus:border-blue-500 cursor-pointer"
                    >
                      {categoryOptions.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    快捷指令 (选填)
                  </label>
                  <input
                    type="text"
                    value={formShortcut}
                    onChange={(e) => setFormShortcut(e.target.value)}
                    placeholder="例如: /hi 或 /help"
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:bg-white focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">回复话术内容 *</label>
                <textarea
                  required
                  rows={4}
                  value={formContent}
                  onChange={(e) => setFormContent(e.target.value)}
                  placeholder="请在此输入客服将一键发送的话术详细内容..."
                  className="w-full p-3 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:bg-white focus:border-blue-500 resize-none leading-relaxed"
                />
              </div>

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
                  {editingItem ? '保存修改' : '确认新增'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      </div>
    </div>
  );
};
