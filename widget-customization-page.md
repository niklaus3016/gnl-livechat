# 访客端聊天小部件外观与交互定制 —— 完整代码

> 来源文件：`src/pages/admin/AdminConsolePage.tsx`（第 1378–2078 行，共 701 行）
> 这是租户管理员视图下 `tenantAdminTab === 'widget'` 时渲染的定制化页面，左侧为配置表单，右侧为访客端挂件的实时预览。

```tsx
              {tenantAdminTab === 'widget' && tenantConfig && (
                <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-stretch min-h-[calc(100vh-140px)] pb-6">
                  {/* Left Form: Customization Parameters */}
                  <form
                    onSubmit={handleSaveTenantAppearance}
                    className="xl:col-span-7 bg-slate-800/40 p-6 md:p-8 rounded-2xl border border-slate-800 shadow-sm flex flex-col justify-between space-y-6"
                  >
                    <div className="space-y-6">
                      {/* Title Header */}
                      <div className="border-b border-slate-800 pb-4">
                        <h2 className="text-base font-bold text-white flex items-center gap-2">
                          <Palette className="w-5 h-5 text-indigo-400" />
                          <span>访客端聊天小部件外观与交互定制</span>
                        </h2>
                        <p className="text-xs text-slate-400 mt-1">
                          实时定制嵌入在网站和应用上的悬浮客服组件视觉风格、主动问候时机与交互策略
                        </p>
                      </div>

                      {/* Section 1: Brand & Theme Color */}
                      <div className="space-y-4">
                        <div className="text-sm font-bold text-indigo-300 uppercase tracking-wider flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                          <span>1. 品牌身份与视觉主调</span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                          {/* Brand/Bot Name */}
                          <div>
                            <label className="block text-xs font-semibold text-slate-300 mb-1.5">品牌名称/公司简称（访客端展示）</label>
                            <input
                              type="text"
                              value={tenantConfig.brand_name || tenantConfig.tenant_name}
                              onChange={(e) => setTenantConfig({ ...tenantConfig, brand_name: e.target.value })}
                              className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
                              placeholder="例如：丰佰瑞科技"
                            />
                          </div>

                          {/* Theme Color Picker */}
                          <div>
                            <label className="block text-xs font-semibold text-slate-300 mb-1.5">品牌主色调 (Brand Color)</label>
                            <div className="flex items-center gap-2.5">
                              <input
                                type="color"
                                value={tenantConfig.theme_color}
                                onChange={(e) => setTenantConfig({ ...tenantConfig, theme_color: e.target.value })}
                                className="w-9 h-9 rounded-lg cursor-pointer bg-transparent border-0"
                              />
                              <input
                                type="text"
                                value={tenantConfig.theme_color}
                                onChange={(e) => setTenantConfig({ ...tenantConfig, theme_color: e.target.value })}
                                className="w-24 px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs font-mono text-white"
                              />
                              {/* Preset color chips */}
                              <div className="flex items-center gap-1.5">
                                {['#1972f5', '#059669', '#7c3aed', '#ea580c', '#0f172a', '#e11d48'].map((c) => (
                                  <button
                                    key={c}
                                    type="button"
                                    onClick={() => setTenantConfig({ ...tenantConfig, theme_color: c })}
                                    className={`w-5 h-5 rounded-full cursor-pointer transition hover:scale-110 border-2 ${
                                      tenantConfig.theme_color === c ? 'border-white scale-110' : 'border-slate-700'
                                    }`}
                                    style={{ backgroundColor: c }}
                                  />
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Enterprise Default / Bot Avatar */}
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <label className="text-xs font-semibold text-slate-300 flex items-center gap-2">
                              <span>企业通用默认接待 / AI 机器人头像 (全局兜底)</span>
                            </label>
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                          <button
                            type="button"
                            onClick={() => setSelectedAvatarWithSync(AI_DEFAULT_AVATAR)}
                            className={`flex items-center gap-2 p-2 rounded-xl border text-left transition cursor-pointer ${
                              selectedAvatar === AI_DEFAULT_AVATAR
                                ? 'bg-indigo-600/20 border-indigo-500 text-white'
                                : 'bg-slate-900/60 border-slate-700 text-slate-300 hover:border-slate-600'
                            }`}
                          >
                            <img
                              src={AI_DEFAULT_AVATAR}
                              alt="AI 助理"
                              className="w-7 h-7 rounded-full object-cover shrink-0 border border-slate-600"
                            />
                            <div className="min-w-0">
                              <div className="text-[11px] truncate font-medium">AI 助理</div>
                              <div className="text-[9.5px] text-slate-400 truncate">默认机器人形象</div>
                            </div>
                          </button>

                          {/* 自定义上传头像（点选后立即上传，替换默认机器人头像） */}
                          <label className="flex items-center gap-2 p-2 rounded-xl border border-dashed border-slate-600 bg-slate-900/40 text-slate-400 hover:text-indigo-300 hover:border-indigo-500/60 hover:bg-slate-900/60 transition cursor-pointer">
                            <div className="w-7 h-7 rounded-full border border-slate-600 flex items-center justify-center shrink-0 overflow-hidden bg-slate-800">
                              {customAvatarPreview ? (
                                <img
                                  src={customAvatarPreview}
                                  alt="自定义"
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <UploadCloud className="w-3.5 h-3.5" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <div className="text-[11px] truncate font-medium">
                                {uploadingAvatar ? '上传中…' : '自定义上传'}
                              </div>
                              <div className="text-[9.5px] text-slate-500 truncate">点击替换为企业图片</div>
                            </div>
                            <input
                              type="file"
                              accept="image/png,image/jpeg,image/gif,image/webp"
                              className="hidden"
                              disabled={uploadingAvatar}
                              onChange={handleCustomAvatarUpload}
                            />
                          </label>

                          {/* 说明折叠按钮：紧跟自定义上传卡片 */}
                          <button
                            type="button"
                            onClick={() => setShowAvatarHelp((v) => !v)}
                            className="flex items-center gap-1.5 p-2 rounded-xl text-slate-400 hover:text-indigo-300 hover:bg-slate-900/60 transition cursor-pointer"
                          >
                            <Info className="w-3.5 h-3.5 shrink-0" />
                            <span className="text-[11px] font-medium">说明</span>
                            <ChevronRight
                              className={`w-3 h-3 transition-transform ${showAvatarHelp ? 'rotate-90' : ''}`}
                            />
                          </button>
                        </div>

                        {showAvatarHelp && (
                          <div className="mt-2.5 p-3 rounded-xl bg-slate-900/60 border border-slate-800 text-xs text-slate-400 leading-relaxed">
                            <span className="text-slate-200 font-semibold">💡 为什么企业管理员只保留一个通用默认头像？</span>
                            <p className="mt-1 text-[11px] text-slate-400">
                              此处为全企业的统一接待形象（在访客未分配具体人工或由 AI 机器人服务时展示）。
                              具体的客服人员拥有各自的坐席端账号，其真实头像、专业头衔与个性化介绍，完全由坐席在【个人设置与接待状态】中自主配置与更新！管理员也可以在【坐席人员与权限】中进行统一协助管理。
                            </p>
                          </div>
                        )}
                        </div>
                      </div>

                      {/* Section 2: Welcome Greeting & Quick Suggestions */}
                      <div className="space-y-4 pt-2 border-t border-slate-800">
                        <div className="text-sm font-bold text-indigo-300 uppercase tracking-wider flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                          <span>2. 迎宾文案与快捷引导词</span>
                        </div>

                        {/* Welcome Greeting */}
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <label className="text-xs font-semibold text-slate-300">访客首句问候语 (欢迎接待词)</label>
                          </div>
                          <textarea
                            rows={4}
                            value={tenantConfig.welcome_msg}
                            onChange={(e) => setTenantConfig({ ...tenantConfig, welcome_msg: e.target.value })}
                            className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500 leading-relaxed resize-none"
                            placeholder="新访客打开咨询窗口时系统自动播发的首句迎宾词..."
                          />
                        </div>

                        {/* Guide Options Toggle & Customizer */}
                        <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="text-xs font-semibold text-white flex items-center gap-2">
                                <span>迎宾语下方自动展示引导选项</span>
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-normal">
                                  快捷引导
                                </span>
                              </div>
                              <div className="text-[11px] text-slate-400 mt-0.5">
                                开启后，访客咨询首句欢迎语下方将展示可点击的快捷咨询选项
                              </div>
                            </div>
                            <input
                              type="checkbox"
                              checked={tenantConfig.enable_guide_options ?? true}
                              onChange={(e) =>
                                setTenantConfig({
                                  ...tenantConfig,
                                  enable_guide_options: e.target.checked,
                                  guide_options: tenantConfig.guide_options || [
                                    '了解产品功能与特性',
                                    '获取方案报价与私有化部署',
                                    '联系人工客服支持',
                                  ],
                                })
                              }
                              className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
                            />
                          </div>

                          {(tenantConfig.enable_guide_options ?? true) && (
                            <div className="pt-3 border-t border-slate-800 space-y-2.5">
                              <div className="flex items-center justify-between text-[11px]">
                                <span className="text-slate-300 font-medium">自定义引导选项内容：</span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setTenantConfig({
                                      ...tenantConfig,
                                      guide_options: [
                                        '了解产品功能与特性',
                                        '获取方案报价与私有化部署',
                                        '联系人工客服支持',
                                      ],
                                    })
                                  }
                                  className="text-[10.5px] text-indigo-400 hover:text-indigo-300 transition cursor-pointer"
                                >
                                  恢复预设
                                </button>
                              </div>

                              {/* Options List */}
                              <div className="flex flex-wrap items-center gap-1.5">
                                {(tenantConfig.guide_options && tenantConfig.guide_options.length > 0
                                  ? tenantConfig.guide_options
                                  : ['了解产品功能与特性', '获取方案报价与私有化部署', '联系人工客服支持']
                                ).map((opt, idx) => (
                                  <div
                                    key={idx}
                                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800/90 border border-slate-700 text-[11.5px] text-slate-200 group hover:border-slate-600 transition"
                                  >
                                    <span>{opt}</span>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const currentList =
                                          tenantConfig.guide_options && tenantConfig.guide_options.length > 0
                                            ? tenantConfig.guide_options
                                            : [
                                                '了解产品功能与特性',
                                                '获取方案报价与私有化部署',
                                                '联系人工客服支持',
                                              ];
                                        const updated = currentList.filter((_, i) => i !== idx);
                                        setTenantConfig({ ...tenantConfig, guide_options: updated });
                                      }}
                                      className="text-slate-400 hover:text-rose-400 ml-0.5 text-xs transition cursor-pointer"
                                      title="删除此选项"
                                    >
                                      ×
                                    </button>
                                  </div>
                                ))}

                                {tenantConfig.guide_options && tenantConfig.guide_options.length === 0 && (
                                  <span className="text-[11px] text-slate-500 py-1">
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
                                          tenantConfig.guide_options && tenantConfig.guide_options.length > 0
                                            ? tenantConfig.guide_options
                                            : [
                                                '了解产品功能与特性',
                                                '获取方案报价与私有化部署',
                                                '联系人工客服支持',
                                              ];
                                        setTenantConfig({
                                          ...tenantConfig,
                                          guide_options: [...currentList, newGuideOptionInput.trim()],
                                        });
                                        setNewGuideOptionInput('');
                                      }
                                    }
                                  }}
                                  placeholder="输入自定义引导选项，例如：预约技术顾问演示"
                                  className="flex-1 px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (newGuideOptionInput.trim()) {
                                      const currentList =
                                        tenantConfig.guide_options && tenantConfig.guide_options.length > 0
                                          ? tenantConfig.guide_options
                                          : [
                                              '了解产品功能与特性',
                                              '获取方案报价与私有化部署',
                                              '联系人工客服支持',
                                            ];
                                      setTenantConfig({
                                        ...tenantConfig,
                                        guide_options: [...currentList, newGuideOptionInput.trim()],
                                      });
                                      setNewGuideOptionInput('');
                                    }
                                  }}
                                  disabled={!newGuideOptionInput.trim()}
                                  className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-medium text-white transition cursor-pointer shrink-0"
                                >
                                  + 添加
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Section 3: Proactive Interaction & Leads */}
                      <div className="space-y-3 pt-2 border-t border-slate-800">
                        <div className="text-sm font-bold text-indigo-300 uppercase tracking-wider flex items-center gap-1.5 mb-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                          <span>3. 进线策略与交互增强</span>
                        </div>

                        {/* Auto-popup Toggle */}
                        <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2.5">
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="text-xs font-semibold text-white">进线自动弹窗主动招呼</div>
                              <div className="text-[11px] text-slate-400">访客浏览网站达到指定时长后，右下角自动展开问候气泡提示</div>
                            </div>
                            <input
                              type="checkbox"
                              checked={tenantConfig.enable_auto_popup}
                              onChange={(e) => setTenantConfig({ ...tenantConfig, enable_auto_popup: e.target.checked })}
                              className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
                            />
                          </div>
                          {tenantConfig.enable_auto_popup && (
                            <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-300">
                              <span>弹窗触发延迟：</span>
                              <div className="flex items-center gap-1.5 flex-wrap justify-end">
                                {[
                                  { label: '5秒 (推荐)', sec: 5 },
                                  { label: '10秒', sec: 10 },
                                  { label: '15秒', sec: 15 },
                                ].map((delay) => {
                                  const isSelected =
                                    !isCustomDelay &&
                                    [5, 10, 15].includes(tenantConfig.auto_popup_delay_sec || 5) &&
                                    (tenantConfig.auto_popup_delay_sec || 5) === delay.sec;
                                  return (
                                    <button
                                      key={delay.sec}
                                      type="button"
                                      onClick={() => {
                                        setIsCustomDelay(false);
                                        setTenantConfig({ ...tenantConfig, auto_popup_delay_sec: delay.sec });
                                      }}
                                      className={`px-2.5 py-1 rounded transition text-[10.5px] cursor-pointer ${
                                        isSelected
                                          ? 'bg-indigo-600 text-white font-medium shadow-sm'
                                          : 'bg-slate-800 text-slate-400 hover:text-white'
                                      }`}
                                    >
                                      {delay.label}
                                    </button>
                                  );
                                })}

                                {/* 自定义选项 */}
                                {isCustomDelay || ![5, 10, 15].includes(tenantConfig.auto_popup_delay_sec || 5) ? (
                                  <div className="flex items-center gap-1 bg-indigo-600/20 border border-indigo-500/50 rounded-lg px-2 py-0.5">
                                    <span className="text-indigo-300 text-[10.5px] font-medium">自定义:</span>
                                    <input
                                      type="number"
                                      min={1}
                                      max={300}
                                      value={tenantConfig.auto_popup_delay_sec || ''}
                                      onChange={(e) => {
                                        const val = e.target.value === '' ? 0 : parseInt(e.target.value, 10);
                                        setTenantConfig({
                                          ...tenantConfig,
                                          auto_popup_delay_sec: isNaN(val) ? 0 : Math.max(1, Math.min(300, val)),
                                        });
                                      }}
                                      placeholder="秒数"
                                      className="w-12 px-1 py-0.5 text-center bg-slate-900 border border-slate-700 rounded text-[10.5px] text-white focus:outline-none focus:border-indigo-400 font-mono"
                                      autoFocus
                                    />
                                    <span className="text-slate-400 text-[10.5px]">秒</span>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setIsCustomDelay(true);
                                      if ([5, 10, 15].includes(tenantConfig.auto_popup_delay_sec || 5)) {
                                        setTenantConfig({ ...tenantConfig, auto_popup_delay_sec: 20 });
                                      }
                                    }}
                                    className="px-2.5 py-1 rounded transition text-[10.5px] bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
                                  >
                                    自定义
                                  </button>
                                )}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Pre-Chat Form Toggle —— 第一版暂不开放，后续放开时去掉 false && */}
                        {false && (
                        <label className="flex items-center justify-between p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 cursor-pointer hover:border-slate-700 transition">
                          <div>
                            <div className="text-xs font-semibold text-white flex items-center gap-1.5">
                              <span>进线前填表留资 (Pre-Chat Lead Form)</span>
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20 font-normal">
                                请慎重开启
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-400">开始咨询前强制要求访客留下姓名与联系电话/邮箱</div>
                          </div>
                          <input
                            type="checkbox"
                            checked={tenantConfig.enable_prechat_form}
                            onChange={(e) => setTenantConfig({ ...tenantConfig, enable_prechat_form: e.target.checked })}
                            className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
                          />
                        </label>
                        )}
                      </div>
                    </div>

                    {/* Submit Button (At bottom of stretched card) */}
                    <div className="pt-4 border-t border-slate-800/80">
                      <button
                        type="submit"
                        className="w-full py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition shadow-md shadow-indigo-500/20 cursor-pointer flex items-center justify-center gap-2"
                      >
                        <Check className="w-4 h-4" />
                        <span>保存并实时同步至所有嵌入站点</span>
                      </button>
                      <p className="text-[11px] text-slate-500 text-center mt-2">
                        无需重新发布嵌入代码，已接入的站点将在保存后毫秒级静默热更新生效
                      </p>
                    </div>
                  </form>

                  {/* Right: Live Interactive Mockup Preview (Stretched & Expanded to Match) */}
                  <div className="xl:col-span-5 bg-slate-800/40 p-5 md:p-6 rounded-2xl border border-slate-800 shadow-sm flex flex-col justify-between">
                    {/* Preview Bar Controls */}
                    <div>
                      <div className="flex flex-wrap items-center justify-between gap-2.5 mb-4">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                            <Eye className="w-4 h-4 text-indigo-400" />
                            <span>访客端挂件实时效果预览</span>
                          </span>
                          <span className="text-[10.5px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full font-medium">
                            实时渲染中
                          </span>
                        </div>
                      </div>

                      {/* Finalized Visitor Chat Widget Container (Exact 1:1 Replica, Taller & Roomier) */}
                      {/* 展开/折叠共用同一布局骨架：折叠时聊天窗向底部头像方向缩放淡出，高度恒定页面不晃动 */}
                      <div className="w-full max-w-98.75 mx-auto space-y-2 relative">
                        {/* 折叠态底板 + 提示（纯覆盖层不参与布局，避免高度跳变） */}
                        <div className={`absolute inset-0 z-0 rounded-2xl bg-slate-900/40 border border-slate-700/70 transition-opacity duration-300 ease-out ${previewWidgetMode === 'minimized' ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} />
                        <div className={`absolute top-4 left-4 z-10 text-xs text-slate-400 transition-all duration-300 ease-out ${previewWidgetMode === 'minimized' ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-1 pointer-events-none'}`}>
                          <p className="font-semibold text-slate-300">网页{widgetPosition === 'right' ? '右下角' : '左下角'}折叠挂件状态</p>
                          <p className="text-[11px] text-slate-500 mt-0.5">访客未展开或点击「—」最小化时展示悬浮头像</p>
                        </div>
                          {/* Preview Persona Switcher */}
                          <div className={`relative z-10 flex items-center gap-1 bg-slate-900/90 p-1 rounded-xl border border-slate-700/60 shadow-xs transition-all duration-300 ease-out ${previewWidgetMode === 'minimized' ? 'opacity-0 -translate-y-1 scale-[0.98] pointer-events-none' : 'opacity-100'}`}>
                            <button
                              type="button"
                              onClick={() => setPreviewPersona('bot')}
                              className={`flex-1 py-1.5 px-2 rounded-lg text-[11px] font-medium transition cursor-pointer flex items-center justify-center gap-1 ${
                                previewPersona === 'bot'
                                  ? 'bg-indigo-600 text-white shadow-xs'
                                  : 'text-slate-400 hover:text-slate-200'
                              }`}
                            >
                              <span>🤖 默认企业/AI接待</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setPreviewPersona('agent')}
                              className={`flex-1 py-1.5 px-2 rounded-lg text-[11px] font-medium transition cursor-pointer flex items-center justify-center gap-1 ${
                                previewPersona === 'agent'
                                  ? 'bg-indigo-600 text-white shadow-xs'
                                  : 'text-slate-400 hover:text-slate-200'
                              }`}
                            >
                              <span>👤 模拟具体坐席</span>
                            </button>
                          </div>

                          <div
                            className={`relative z-10 bg-white rounded-3xl shadow-[0_20px_60px_-10px_rgba(0,0,0,0.24),0_0_0_1px_rgba(0,0,0,0.06)] overflow-hidden flex flex-col text-slate-800 border border-slate-200/80 min-h-160 transition-all duration-300 ease-out ${previewWidgetMode === 'minimized' ? 'opacity-0 scale-[0.82] translate-y-12 pointer-events-none' : 'opacity-100 scale-100 translate-y-0'}`}
                            style={{ transformOrigin: widgetPosition === 'right' ? '100% 100%' : '0% 100%' }}
                          >
                            {/* 1. Finalized ChatHeader */}
                            <ChatHeader
                              tenantName={previewBrandName}
                              themeColor={tenantConfig.theme_color || '#1972f5'}
                              agentName={previewPersona === 'agent' ? '小布丁' : 'AI 助手'}
                              agentAvatar={
                                previewPersona === 'agent'
                                  ? '/avatars/agent-male.png'
                                  : selectedAvatar
                              }
                              agentTitle={previewPersona === 'agent' ? '在线技术支持' : '智能在线客服'}
                              agentBio={
                                previewPersona === 'agent'
                                  ? `欢迎咨询 ${previewBrandName}，我们将竭诚为您解答产品、计费与系统对接相关疑问。`
                                  : `您好！我是企业智能客服助手，7x24 小时随时为您解答常见问题，如需人工支持可随时发起转接。`
                              }
                              isWorkingHours={true}
                              onClose={() => setPreviewWidgetMode('minimized')}
                            />

                            {/* 2. Chat Body Area: PreChatForm OR Live Conversation */}
                            {previewWidgetMode === 'prechat' ? (
                              <div className="flex-1 p-4 bg-slate-50 flex items-center justify-center overflow-y-auto min-h-115">
                                <PreChatForm
                                  themeColor={tenantConfig.theme_color || '#1972f5'}
                                  onSubmit={() => setPreviewWidgetMode('chat')}
                                />
                              </div>
                            ) : (
                              <div className="flex-1 p-4.5 bg-[#f8fafc] space-y-4 text-xs overflow-y-auto min-h-115">
                                {/* Timestamp Divider */}
                                <div className="flex justify-center my-1">
                                  <span className="text-[10.5px] text-slate-400 bg-slate-200/60 px-2.5 py-0.5 rounded-full">
                                    今天 14:30
                                  </span>
                                </div>

                                {/* Agent Welcome Message with Avatar and Official Badge */}
                                <div className="flex items-start gap-2.5">
                                  <img
                                    src={
                                      previewPersona === 'agent'
                                        ? '/avatars/agent-male.png'
                                        : selectedAvatar
                                    }
                                    alt={previewBrandName}
                                    className="w-8 h-8 rounded-full object-cover border border-slate-200 shadow-xs shrink-0"
                                  />
                                  <div className="flex-1 min-w-0 max-w-[85%]">
                                    <div className="flex items-center gap-1.5 mb-1 ml-0.5">
                                      <span className="text-[12px] font-normal text-slate-500">
                                        {previewPersona === 'agent' ? '小布丁' : 'AI 助手'}
                                      </span>
                                    </div>
                                    <div className="bg-white p-3.5 rounded-2xl border border-slate-200/90 shadow-2xs text-slate-800 leading-relaxed text-[13px]">
                                      {tenantConfig.welcome_msg || `您好！欢迎咨询${previewBrandName}，我们随时为您提供专业的产品与技术支持。请问有什么可以帮您？`}
                                    </div>

                                  {/* Suggested Quick Reply Chips */}
                                  {(tenantConfig.enable_guide_options ?? true) && (
                                    <div className="flex flex-wrap gap-1.5 mt-2.5">
                                      {(tenantConfig.guide_options && tenantConfig.guide_options.length > 0
                                        ? tenantConfig.guide_options
                                        : ['了解产品功能与特性', '获取方案报价与私有化部署', '联系人工客服支持']
                                      ).map((chip, idx) => (
                                        <span
                                          key={idx}
                                          className="text-[11px] px-2.5 py-1 rounded-full bg-white border border-slate-200 text-slate-600 hover:border-blue-400 hover:text-blue-600 transition shadow-2xs cursor-pointer select-none"
                                        >
                                          {chip}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Visitor WeChat-Style 4" Voice Bubble */}
                              <div className="flex justify-end">
                                <div
                                  className="relative flex items-center gap-3 px-3.5 py-2.5 rounded-[14px] text-white shadow-2xs select-none"
                                  style={{ backgroundColor: tenantConfig.theme_color || '#1972f5' }}
                                >
                                  <span
                                    className="absolute -right-1.25 top-3 w-0 h-0 border-t-[5px] border-t-transparent border-b-[5px] border-b-transparent border-l-[5px]"
                                    style={{ borderLeftColor: tenantConfig.theme_color || '#1972f5' }}
                                  />
                                  <span className="text-[13.5px] font-medium tracking-tight text-white">4"</span>
                                  <div className="scale-x-[-1] flex items-center shrink-0 text-white">
                                    <svg
                                      className="w-4 h-4"
                                      viewBox="0 0 24 24"
                                      fill="none"
                                      stroke="currentColor"
                                      strokeWidth="2.3"
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                    >
                                      <path d="M6 10.5 A 2 2 0 0 1 6 13.5" strokeWidth="2.8" />
                                      <path d="M10.5 7.5 A 6 6 0 0 1 10.5 16.5" />
                                      <path d="M15 4.5 A 10.5 10.5 0 0 1 15 19.5" />
                                    </svg>
                                  </div>
                                </div>
                              </div>

                              {/* Agent Follow-up Message */}
                              <div className="flex items-start gap-2.5">
                                <img
                                  src={selectedAvatar}
                                  alt="客服顾问"
                                  className="w-8 h-8 rounded-full object-cover border border-slate-200 shadow-xs shrink-0"
                                />
                                <div className="bg-white p-3.5 rounded-2xl border border-slate-200/90 shadow-2xs max-w-[85%] text-slate-800 leading-relaxed text-[13px]">
                                  已收到您的语音咨询！专属技术客服顾问已就绪，请随时交流。
                                </div>
                              </div>
                            </div>
                          )}

                          {/* 3. Finalized Replicated Crisp Input Bar */}
                          <div className="p-3 bg-white border-t border-slate-100 shrink-0">
                            <div
                              className="border-[1.8px] rounded-[22px] bg-white px-3.5 pt-2.5 pb-2 transition-all duration-200 shadow-2xs"
                              style={{
                                borderColor: tenantConfig.theme_color || '#1972f5',
                                boxShadow: `0 0 0 3px ${(tenantConfig.theme_color || '#1972f5')}18`,
                              }}
                            >
                              <div className="text-[13.5px] text-slate-400 select-none pb-1.5 font-normal min-h-9.5 leading-relaxed">
                                输入你的信息...
                              </div>
                              <div className="flex items-center justify-between text-slate-500">
                                <div className="flex items-center gap-2 text-[#64748b]">
                                  <button type="button" className="p-1 rounded-md hover:text-slate-800 transition cursor-pointer" title="插入表情">
                                    <Smile className="w-4 h-4" />
                                  </button>
                                  <button type="button" className="p-1 rounded-md hover:text-slate-800 transition cursor-pointer" title="添加附件或图片">
                                    <Paperclip className="w-4 h-4 rotate-45" />
                                  </button>
                                  <button type="button" className="p-1 rounded-md hover:text-slate-800 transition cursor-pointer" title="切换为按住说话语音模式">
                                    <svg viewBox="0 0 20 20" width="16" height="16" fill="currentColor">
                                      <rect x="2.5" y="6" width="2" height="8" rx="1" />
                                      <rect x="7" y="3" width="2" height="14" rx="1" />
                                      <rect x="11.5" y="5" width="2" height="10" rx="1" />
                                      <rect x="16" y="8" width="2" height="4" rx="1" />
                                    </svg>
                                  </button>
                                </div>
                                <button
                                  type="button"
                                  className="p-1.5 transition select-none cursor-pointer hover:opacity-80 active:scale-95"
                                  style={{ color: tenantConfig.theme_color || '#1972f5' }}
                                  title="发送信息 (Enter)"
                                >
                                  <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                                    <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                                   </svg>
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Floating Launcher Avatar OUTSIDE the conversation window at bottom-right */}
                        <div className="relative z-10 flex items-center justify-end pr-1 pt-2">
                          <button
                            type="button"
                            onClick={() => setPreviewWidgetMode(previewWidgetMode === 'minimized' ? 'chat' : 'minimized')}
                            className="w-13 h-13 rounded-full bg-white border-2 border-white shadow-[0_8px_24px_rgba(0,0,0,0.28)] flex items-center justify-center relative hover:scale-105 active:scale-95 transition cursor-pointer group"
                            title={previewWidgetMode === 'minimized' ? '点击展开会话窗口' : '点击收起会话窗口 (右下角挂件)'}
                          >
                            <img
                              src={selectedAvatar}
                              alt="在线客服"
                              className="w-full h-full rounded-full object-cover"
                            />
                            <span className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full bg-[#00c853] border-2 border-white shadow-xs" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
```

## 说明

- 该片段是 `AdminConsolePage` 组件的一部分，依赖以下在组件内定义的状态和函数：`tenantConfig` / `setTenantConfig`、`selectedAvatar` / `setSelectedAvatarWithSync`、`customAvatarPreview` / `handleCustomAvatarUpload` / `uploadingAvatar`、`showAvatarHelp` / `setShowAvatarHelp`、`newGuideOptionInput` / `setNewGuideOptionInput`、`isCustomDelay` / `setIsCustomDelay`、`handleSaveTenantAppearance`、`previewWidgetMode` / `setPreviewWidgetMode`、`previewPersona` / `setPreviewPersona`、`previewBrandName`、`widgetPosition`。
- 用到的外部组件/常量：`ChatHeader`（`src/components/chat/ChatHeader`）、`PreChatForm`（`src/components/chat/PreChatForm`）、`AI_DEFAULT_AVATAR`（`src/constants/avatars`），以及来自 `lucide-react` 的图标。
