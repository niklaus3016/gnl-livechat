import React, { useState, useEffect, useRef } from 'react';
import { Conversation, VisitorInfo, ChannelType } from '../../types';
import { updateVisitorBasicInfo } from '../../api';
import { formatConversationTime } from '../../utils/format';
import {
  Globe,
  MapPin,
  Clock,
  ExternalLink,
  Mail,
  User,
  Phone,
  FileText,
  Check,
  Loader2,
  Share2,
} from 'lucide-react';

interface VisitorInfoPanelProps {
  conversationId: string;
  visitorInfo: VisitorInfo;
  visitorName: string;
  channel?: ChannelType;
  /** 真实在线状态：null = 未知（ack/广播未到达，含 mock 模式）— 按在线展示 */
  online?: boolean | null;
  onUpdateVisitorInfo?: (updatedConv: Conversation) => void;
  onClose?: () => void;
  /** 只读模式（企业主会话监控）：输入禁用、不触发自动保存 */
  readOnly?: boolean;
  /** 暗色主题（企业主会话监控深蓝配色） */
  dark?: boolean;
}

export const VisitorInfoPanel: React.FC<VisitorInfoPanelProps> = ({
  conversationId,
  visitorInfo,
  visitorName,
  channel = 'web',
  online = null,
  onUpdateVisitorInfo,
  readOnly = false,
  dark = false,
}) => {
  const [name, setName] = useState(visitorInfo.name || visitorName || '');
  const [phone, setPhone] = useState(visitorInfo.phone || '');
  const [email, setEmail] = useState(visitorInfo.email || '');
  const [notes, setNotes] = useState(visitorInfo.notes || '');

  // 基本信息自动保存状态
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const debounceTimerRef = useRef<number | null>(null);
  const statusResetTimerRef = useRef<number | null>(null);

  // Sync state when switching conversations or when visitorInfo changes externally
  useEffect(() => {
    setName(visitorInfo.name || visitorName || '');
    setPhone(visitorInfo.phone || '');
    setEmail(visitorInfo.email || '');
    setNotes(visitorInfo.notes || '');
    setSaveStatus('idle');
  }, [conversationId, visitorInfo, visitorName]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      if (statusResetTimerRef.current) clearTimeout(statusResetTimerRef.current);
    };
  }, []);

  const saveChanges = async (updatedFields: {
    name?: string;
    phone?: string;
    email?: string;
    notes?: string;
  }) => {
    if (!conversationId) return;

    try {
      setSaveStatus('saving');
      const updated = await updateVisitorBasicInfo(conversationId, {
        name: updatedFields.name !== undefined ? updatedFields.name : name,
        phone: updatedFields.phone !== undefined ? updatedFields.phone : phone,
        email: updatedFields.email !== undefined ? updatedFields.email : email,
        notes: updatedFields.notes !== undefined ? updatedFields.notes : notes,
      });

      setSaveStatus('saved');
      onUpdateVisitorInfo?.(updated);

      if (statusResetTimerRef.current) clearTimeout(statusResetTimerRef.current);
      statusResetTimerRef.current = window.setTimeout(() => {
        setSaveStatus('idle');
      }, 2500);
    } catch (err) {
      console.error('Failed to auto-save visitor basic info:', err);
      setSaveStatus('error');
    }
  };

  const triggerDebouncedSave = (newFields: {
    name?: string;
    phone?: string;
    email?: string;
    notes?: string;
  }) => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = window.setTimeout(() => {
      saveChanges(newFields);
    }, 600);
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (readOnly) return;
    const val = e.target.value;
    setName(val);
    triggerDebouncedSave({ name: val });
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (readOnly) return;
    const val = e.target.value;
    setPhone(val);
    triggerDebouncedSave({ phone: val });
  };

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (readOnly) return;
    const val = e.target.value;
    setEmail(val);
    triggerDebouncedSave({ email: val });
  };

  const handleNotesChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (readOnly) return;
    const val = e.target.value;
    setNotes(val);
    triggerDebouncedSave({ notes: val });
  };

  const handleBlur = () => {
    if (readOnly) return;
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    saveChanges({ name, phone, email, notes });
  };

  return (
    <div className={`w-72 xl:w-80 ${dark ? 'bg-slate-900 border-l border-slate-800' : 'bg-slate-50 border-l border-slate-200'} h-full flex flex-col shrink-0 overflow-y-auto`}>
      {/* Header */}
      <div className={`p-4 border-b ${dark ? 'border-slate-800 bg-slate-900' : 'border-slate-200 bg-white'}`}>
        <h3 className={`text-xs font-bold ${dark ? 'text-slate-400' : 'text-slate-500'} uppercase tracking-wider mb-2`}>
          访客画像与网络元信息
        </h3>
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-full ${dark ? 'bg-indigo-500/15 text-indigo-300' : 'bg-blue-100 text-blue-700'} flex items-center justify-center font-bold text-sm shrink-0`}>
            {(name || visitorName || '访').substring(0, 1)}
          </div>
          <div className="min-w-0 flex-1">
            <h4 className={`text-sm font-semibold truncate ${dark ? 'text-slate-100' : 'text-slate-800'}`}>
              {name || visitorName || '在线访客'}
            </h4>
            <span
              className={`inline-flex items-center gap-1 text-[11px] font-medium ${
                online === false ? 'text-slate-400' : dark ? 'text-emerald-400' : 'text-emerald-600'
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${online === false ? 'bg-slate-300' : 'bg-emerald-500'}`}
              />
              {online === false ? '离线' : '当前在线'}
            </span>
          </div>
        </div>
      </div>

      {/* Info Items List */}
      <div className="p-4 space-y-4 text-xs">
        {/* Contact Info (Editable with Auto-Save) */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className={`font-semibold ${dark ? 'text-slate-400' : 'text-slate-500'} text-[11px] uppercase tracking-wider block`}>
              基本联系信息
            </span>
            <div className="flex items-center gap-1">
              {saveStatus === 'saving' && (
                <span className="text-[10px] text-blue-600 flex items-center gap-1 font-medium animate-pulse">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  保存中...
                </span>
              )}
              {saveStatus === 'saved' && (
                <span className="text-[10px] text-emerald-600 flex items-center gap-1 font-medium">
                  <Check className="w-3 h-3 text-emerald-500" />
                  已自动保存
                </span>
              )}
              {saveStatus === 'error' && (
                <span className="text-[10px] text-red-500 font-medium">
                  保存失败
                </span>
              )}
              {saveStatus === 'idle' && (
                <span className="text-[10px] text-slate-400">
                  修改后自动保存
                </span>
              )}
            </div>
          </div>

          {/* 1. 访客称谓 */}
          <div className={`p-2.5 rounded-xl ${dark ? 'bg-slate-800/60 border border-slate-700' : 'bg-white border border-slate-200/80 shadow-2xs'} transition-colors focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-500/10`}>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                <User className="w-3.5 h-3.5 text-slate-400" />
                <span>访客称谓</span>
              </div>
              {!readOnly && <span className="text-[10px] text-slate-400">可编辑</span>}
            </div>
            <input
              type="text"
              value={name}
              onChange={handleNameChange}
              onBlur={handleBlur}
              disabled={readOnly}
              placeholder="请填写访客称谓或姓名..."
              className={`w-full text-xs font-semibold ${dark ? 'text-slate-100 placeholder:text-slate-500' : 'text-slate-800 placeholder:text-slate-300'} bg-transparent border-none outline-hidden p-0 placeholder:font-normal`}
            />
          </div>

          {/* 2. 手机号码 (电子邮箱上面) */}
          <div className={`p-2.5 rounded-xl ${dark ? 'bg-slate-800/60 border border-slate-700' : 'bg-white border border-slate-200/80 shadow-2xs'} transition-colors focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-500/10`}>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                <Phone className="w-3.5 h-3.5 text-slate-400" />
                <span>手机号码</span>
              </div>
              {!readOnly && <span className="text-[10px] text-slate-400">可编辑</span>}
            </div>
            <input
              type="tel"
              value={phone}
              onChange={handlePhoneChange}
              onBlur={handleBlur}
              disabled={readOnly}
              placeholder="请填写手机号或联系电话..."
              className={`w-full text-xs font-medium ${dark ? 'text-slate-100 placeholder:text-slate-500' : 'text-slate-800 placeholder:text-slate-300'} bg-transparent border-none outline-hidden p-0 placeholder:font-normal font-mono`}
            />
          </div>

          {/* 3. 电子邮箱 */}
          <div className={`p-2.5 rounded-xl ${dark ? 'bg-slate-800/60 border border-slate-700' : 'bg-white border border-slate-200/80 shadow-2xs'} transition-colors focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-500/10`}>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                <Mail className="w-3.5 h-3.5 text-slate-400" />
                <span>电子邮箱</span>
              </div>
              {!readOnly && <span className="text-[10px] text-slate-400">可编辑</span>}
            </div>
            <input
              type="email"
              value={email}
              onChange={handleEmailChange}
              onBlur={handleBlur}
              disabled={readOnly}
              placeholder="请填写电子邮箱..."
              className={`w-full text-xs font-medium ${dark ? 'text-slate-100 placeholder:text-slate-500' : 'text-slate-800 placeholder:text-slate-300'} bg-transparent border-none outline-hidden p-0 placeholder:font-normal`}
            />
          </div>

          {/* 4. 客户备注栏 (电子邮箱下面) */}
          <div className={`p-2.5 rounded-xl ${dark ? 'bg-slate-800/60 border border-slate-700' : 'bg-white border border-slate-200/80 shadow-2xs'} transition-colors focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-500/10`}>
            <div className="flex items-center justify-between mb-1.5">
              <div className={`flex items-center gap-1.5 text-[11px] font-medium ${dark ? 'text-amber-300' : 'text-amber-700'}`}>
                <FileText className="w-3.5 h-3.5 text-amber-600" />
                <span>客服备注栏</span>
              </div>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium ${dark ? 'text-amber-300 bg-amber-500/10' : 'text-amber-700 bg-amber-50'}`}>
                客服可见
              </span>
            </div>
            <textarea
              rows={3}
              value={notes}
              onChange={handleNotesChange}
              onBlur={handleBlur}
              disabled={readOnly}
              placeholder="添加客户意向、特殊要求或跟进备注，离开或输入后自动保存..."
              className={`w-full text-xs ${dark ? 'text-slate-100 bg-slate-800/60 hover:bg-slate-800 focus:bg-slate-800 border border-slate-700 focus:border-indigo-500 placeholder:text-slate-500' : 'text-slate-700 bg-slate-50/60 hover:bg-slate-50 focus:bg-white border border-slate-200/60 focus:border-blue-400 placeholder:text-slate-400'} rounded-lg p-2 outline-hidden resize-none leading-relaxed transition`}
            />
          </div>
        </div>

        {/* Network & Geography */}
        <div className="space-y-2">
          <span className="font-semibold text-slate-500 text-[11px] uppercase tracking-wider block">
            网络环境与归属地
          </span>

          <div className={`flex items-start gap-2.5 p-2.5 rounded-xl ${dark ? 'bg-slate-800/60 border border-slate-700' : 'bg-white border border-slate-200/80 shadow-2xs'}`}>
            <MapPin className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
              <div className="text-[11px] text-slate-400">地理位置</div>
              <div className={`font-medium wrap-break-word ${dark ? 'text-slate-200' : 'text-slate-700'}`}>{visitorInfo.location || '未知'}</div>
            </div>
          </div>

          <div className={`flex items-start gap-2.5 p-2.5 rounded-xl ${dark ? 'bg-slate-800/60 border border-slate-700' : 'bg-white border border-slate-200/80 shadow-2xs'}`}>
            <Globe className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
              <div className="text-[11px] text-slate-400">访客真实 IP</div>
              <div className={`font-medium font-mono ${dark ? 'text-slate-200' : 'text-slate-700'}`}>{visitorInfo.ip || '未知'}</div>
            </div>
          </div>
        </div>

        {/* Track & Referer */}
        <div className="space-y-2">
          <span className="font-semibold text-slate-500 text-[11px] uppercase tracking-wider block">
            访问轨迹与设备
          </span>

          {/* 渠道接入来源 */}
          <div className={`p-2.5 rounded-xl ${dark ? 'bg-slate-800/60 border border-slate-700' : 'bg-white border border-slate-200/80 shadow-2xs'} space-y-1.5`}>
            <div className={`flex items-center gap-1.5 text-[11px] font-medium ${dark ? 'text-slate-400' : 'text-slate-500'}`}>
              <Share2 className="w-3.5 h-3.5 text-slate-400" />
              <span>渠道接入来源</span>
            </div>
            <div className={`font-semibold text-xs ${dark ? 'text-slate-100' : 'text-slate-800'}`}>
              {channel === 'wecom' && '企业微信 (WeCom) 客服'}
              {channel === 'wechat' && '微信公众号 (WeChat Official)'}
              {channel === 'feishu' && '飞书开放平台 (Feishu OpenBot)'}
              {channel === 'dingtalk' && '阿里钉钉开放平台 (DingTalk)'}
              {(!channel || channel === 'web') && 'Web 官网在线咨询窗口'}
            </div>
          </div>

          <div className={`p-2.5 rounded-xl ${dark ? 'bg-slate-800/60 border border-slate-700' : 'bg-white border border-slate-200/80 shadow-2xs'} space-y-1`}>
            <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
              <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
              <span>来源页面 (Referer)</span>
            </div>
            <a
              href={visitorInfo.referer}
              target="_blank"
              rel="noreferrer"
              className={`${dark ? 'text-blue-400' : 'text-blue-600'} hover:underline break-all block text-[11px] font-medium`}
            >
              {visitorInfo.referer || '直接访问 / 嵌入代码'}
            </a>
          </div>

          <div className={`flex items-center gap-2 p-2.5 rounded-xl ${dark ? 'bg-slate-800/60 border border-slate-700' : 'bg-white border border-slate-200/80 shadow-2xs'}`}>
            <Clock className="w-4 h-4 text-slate-400 shrink-0" />
            <div>
              <div className="text-[11px] text-slate-400">首次接入时间</div>
              <div className={`font-medium ${dark ? 'text-slate-200' : 'text-slate-700'}`}>{formatConversationTime(visitorInfo.firstVisitAt) || '今天'}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
