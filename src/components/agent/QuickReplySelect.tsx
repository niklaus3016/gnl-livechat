import React, { useEffect, useState } from 'react';
import { getQuickReplies } from '../../api';
import { QuickReplyItem } from '../../types';
import { Zap, Search, ChevronRight, X } from 'lucide-react';

interface QuickReplySelectProps {
  onSelect: (content: string) => void;
  onClose: () => void;
}

export const QuickReplySelect: React.FC<QuickReplySelectProps> = ({ onSelect, onClose }) => {
  const [replies, setReplies] = useState<QuickReplyItem[]>([]);
  const [keyword, setKeyword] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  useEffect(() => {
    getQuickReplies().then(setReplies).catch(console.error);
  }, []);

  const categories = ['all', ...Array.from(new Set(replies.map((r) => r.category || '通用')))];

  const filtered = replies.filter((item) => {
    const matchCat = selectedCategory === 'all' || (item.category || '通用') === selectedCategory;
    const matchKw =
      !keyword ||
      item.title.toLowerCase().includes(keyword.toLowerCase()) ||
      item.content.toLowerCase().includes(keyword.toLowerCase()) ||
      (item.shortcut && item.shortcut.toLowerCase().includes(keyword.toLowerCase()));
    return matchCat && matchKw;
  });

  return (
    <div className="absolute bottom-full left-0 mb-2 w-96 max-w-[calc(100vw-32px)] bg-white rounded-2xl shadow-2xl border border-slate-200 z-50 overflow-hidden flex flex-col max-h-96">
      {/* Search & Header */}
      <div className="p-3 border-b border-slate-100 bg-slate-50/70">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
            <Zap className="w-3.5 h-3.5 text-amber-500" />
            <span>我的快捷回复</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 rounded-md cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
          <input
            type="text"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="搜索快捷语、标题或指令(如 /hi)..."
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-hidden focus:border-blue-500"
          />
        </div>

        {/* Categories Bar */}
        <div className="flex gap-1.5 mt-2 overflow-x-auto pb-0.5">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`px-2 py-0.5 rounded-md text-[11px] whitespace-nowrap transition cursor-pointer ${
                selectedCategory === cat
                  ? 'bg-blue-600 text-white font-medium'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {cat === 'all' ? '全部' : cat}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
        {filtered.map((item) => (
          <div
            key={item.id}
            onClick={() => {
              onSelect(item.content);
              onClose();
            }}
            className="p-2.5 rounded-xl hover:bg-blue-50/60 border border-transparent hover:border-blue-200 transition cursor-pointer group"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold text-slate-800 group-hover:text-blue-700">
                {item.title}
              </span>
              {item.shortcut && (
                <span className="text-[10px] font-mono bg-slate-100 group-hover:bg-blue-100 text-slate-600 px-1.5 py-0.5 rounded">
                  {item.shortcut}
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">
              {item.content}
            </p>
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="text-center py-8 text-xs text-slate-400">未找到匹配的快捷回复</div>
        )}
      </div>
    </div>
  );
};
