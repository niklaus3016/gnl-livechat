import React, { useState } from 'react';
import { Smile, ThumbsUp, Heart, Sparkles, Send, X } from 'lucide-react';

export interface EmojiPickerProps {
  onSelectEmoji: (emoji: string) => void;
  onQuickSendEmoji?: (emoji: string) => void;
  onClose: () => void;
}

interface EmojiCategory {
  id: string;
  name: string;
  icon: React.ReactNode;
  emojis: string[];
}

const EMOJI_CATEGORIES: EmojiCategory[] = [
  {
    id: 'recent',
    name: '常用',
    icon: <Sparkles className="w-3.5 h-3.5" />,
    emojis: [
      '😊', '👍', '👏', '❤️', '🙏', '🎉', '🔥', '✨', 
      '🤔', '😄', '🤣', '😍', '👌', '🤝', '💯', '🚀',
      '😅', '🙌', '💪', '🥰', '😘', '🥺', '😭', '😎'
    ],
  },
  {
    id: 'smileys',
    name: '表情',
    icon: <Smile className="w-3.5 h-3.5" />,
    emojis: [
      '😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', 
      '🙂', '🙃', '😉', '😊', '😇', '🥰', '😍', '🤩', 
      '😘', '😗', '😚', '😙', '😋', '😛', '😜', '🤪', 
      '😝', '🤑', '🤗', '🤭', '🤫', '🤔', '🤐', '🤨', 
      '😐', '😑', '😶', '😏', '😒', '🙄', '😬', '🤥', 
      '😌', '😔', '😪', '🤤', '😴', '😷', '🤒', '🤕', 
      '🤢', '🤮', '🤧', '🥵', '🥶', '🥴', '😵', '🤯', 
      '🤠', '🥳', '😎', '🤓', '🧐', '🥺', '😭', '😤', 
      '😡', '😠', '🤬', '💩', '🤡', '👻', '💀', '👽'
    ],
  },
  {
    id: 'gestures',
    name: '手势',
    icon: <ThumbsUp className="w-3.5 h-3.5" />,
    emojis: [
      '👍', '👎', '👏', '🙌', '👐', '🤲', '🤝', '🙏', 
      '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆', 
      '🖕', '👇', '☝️', '✋', '🤚', '🖐️', '🖖', '👋', 
      '🤙', '💪', '🦾', '✍️', '🤳', '💅', '👀', '👁️', 
      '👄', '💋', '🧠', '🫀', '🫁', '👂', '👃', '🦶'
    ],
  },
  {
    id: 'hearts',
    name: '爱心庆祝',
    icon: <Heart className="w-3.5 h-3.5" />,
    emojis: [
      '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', 
      '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', 
      '💘', '💝', '💟', '💯', '💢', '💥', '💫', '💦', 
      '🎉', '🎊', '🎈', '🎁', '🏆', '🥇', '🥈', '🥉', 
      '🎫', '🎟️', '🌺', '🌸', '🌹', '🌻', '🍀', '✨'
    ],
  },
  {
    id: 'objects',
    name: '符号生活',
    icon: <Sparkles className="w-3.5 h-3.5" />,
    emojis: [
      '🔥', '✨', '⭐', '🌟', '⚡', '💡', '📌', '📍', 
      '🔔', '🔕', '🚀', '🎯', '☕', '🍵', '🍺', '🍻', 
      '🥂', '🍷', '🍕', '🍔', '🍟', '🍦', '🍰', '🎂', 
      '🍫', '🍿', '🍩', '🍪', '☀️', '🌙', '☁️', '🌈',
      '🔒', '🔑', '🛡️', '⚙️', '⏰', '⏳', '💻', '📱'
    ],
  },
];

export const EmojiPicker: React.FC<EmojiPickerProps> = ({
  onSelectEmoji,
  onQuickSendEmoji,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<string>('recent');
  const [lastClickedEmoji, setLastClickedEmoji] = useState<string | null>(null);

  const currentCategory =
    EMOJI_CATEGORIES.find((c) => c.id === activeTab) || EMOJI_CATEGORIES[0];

  const handleEmojiClick = (emoji: string) => {
    setLastClickedEmoji(emoji);
    onSelectEmoji(emoji);
  };

  const handleQuickSend = () => {
    if (lastClickedEmoji && onQuickSendEmoji) {
      onQuickSendEmoji(lastClickedEmoji);
      onClose();
    }
  };

  return (
    <>
      {/* Invisible backdrop to dismiss on click outside */}
      <div className="fixed inset-0 z-20" onClick={onClose} />

      {/* Crisp-Styled Emoji Popover Card */}
      <div
        onMouseDown={(e) => e.preventDefault()}
        className="absolute bottom-full left-0 mb-2.5 w-77.5 bg-white rounded-2xl shadow-[0_10px_35px_rgba(0,0,0,0.14),0_2px_8px_rgba(0,0,0,0.06)] border border-[#e2e8f0] z-30 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150 select-none"
      >
        {/* Header Tabs */}
        <div className="flex items-center justify-between px-2.5 pt-2 pb-1.5 border-b border-slate-100 bg-[#f8fafc]/80">
          <div className="flex items-center gap-1">
            {EMOJI_CATEGORIES.map((cat) => {
              const isActive = cat.id === activeTab;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => setActiveTab(cat.id)}
                  className={`px-2 py-1 rounded-md text-xs font-medium flex items-center gap-1 transition-all cursor-pointer ${
                    isActive
                      ? 'bg-white text-blue-600 shadow-xs'
                      : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200/50'
                  }`}
                  title={cat.name}
                >
                  {cat.icon}
                  <span>{cat.name}</span>
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 rounded-md hover:bg-slate-200/50 transition cursor-pointer"
            title="关闭"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Emoji Grid Scroll Area */}
        <div className="p-2.5 max-h-52.5 overflow-y-auto overscroll-contain grid grid-cols-8 gap-1 scrollbar-thin">
          {currentCategory.emojis.map((emoji, idx) => (
            <button
              key={`${emoji}-${idx}`}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleEmojiClick(emoji)}
              onDoubleClick={() => {
                if (onQuickSendEmoji) {
                  onQuickSendEmoji(emoji);
                  onClose();
                }
              }}
              className={`w-8 h-8 flex items-center justify-center text-[19px] rounded-lg transition-transform active:scale-125 hover:bg-slate-100 cursor-pointer ${
                lastClickedEmoji === emoji ? 'bg-blue-50 ring-1 ring-blue-300' : ''
              }`}
              title={`${emoji} (点击插入，双击单发)`}
            >
              {emoji}
            </button>
          ))}
        </div>

        {/* Bottom Hint / Quick Action Footer */}
        <div className="px-3 py-2 border-t border-slate-100 bg-slate-50/90 flex items-center justify-between text-[11px] text-slate-500">
          <span className="truncate">
            {lastClickedEmoji ? (
              <span className="text-slate-700 font-medium">已选: {lastClickedEmoji} (可连续点击选多个)</span>
            ) : (
              '点击选入，双击可直接发送单个'
            )}
          </span>

          {onQuickSendEmoji && lastClickedEmoji && (
            <button
              type="button"
              onClick={handleQuickSend}
              className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-blue-600 text-white hover:bg-blue-700 active:scale-95 transition cursor-pointer"
            >
              <span>发送</span>
              <Send className="w-2.5 h-2.5" />
            </button>
          )}
        </div>
      </div>
    </>
  );
};
