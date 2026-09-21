/*! LightChat widget loader v1 */
(function () {
  if (window.__lightchatLoaded) return;
  window.__lightchatLoaded = true;

  var script = document.currentScript;
  var tenant = script && script.getAttribute('data-tenant-id');
  if (!tenant) { console.error('[LightChat] 缺少 data-tenant-id 属性'); return; }

  // 默认按加载器自身地址（script.src）推导后端 origin，
  // 这样嵌入到任意外部站点时 iframe 始终指向后端 /chat，而不是客户网站的域名；
  // 仍可用 data-widget-base 显式覆盖
  var loaderOrigin = '';
  try { if (script && script.src) loaderOrigin = new URL(script.src).origin; } catch (e) {}
  var base = (script && script.getAttribute('data-widget-base'))
    || (loaderOrigin ? loaderOrigin + '/chat' : location.origin + '/chat');
  var src = base + (base.indexOf('?') > -1 ? '&' : '?')
    + 'tenant=' + encodeURIComponent(tenant)
    + '&parent_url=' + encodeURIComponent(location.href);

  var Z = 2147483000;
  var isMobile = function () { return window.innerWidth <= 768; };

  var css = document.createElement('style');
  css.textContent = [
    '#lc-bubble{position:fixed;right:24px;bottom:24px;width:60px;height:60px;border-radius:50%;',
    'background:#4f6ef7;border:none;cursor:pointer;box-shadow:0 6px 24px rgba(0,0,0,.25);z-index:' + Z + ';',
    'display:flex;align-items:center;justify-content:center;transition:transform .15s ease;}',
    '#lc-bubble:hover{transform:scale(1.06);}',
    '#lc-panel{position:fixed;right:24px;bottom:96px;width:380px;height:600px;max-height:calc(100vh - 120px);',
    'border:none;border-radius:24px;box-shadow:0 12px 48px rgba(0,0,0,.3);z-index:' + (Z + 1) + ';',
    'background:#fff;display:none;overflow:hidden;}',
    '#lc-panel.lc-open{display:block;}',
    '#lc-bubble.lc-hidden{display:none;}',
    '@media (max-width:768px){',
    '#lc-panel{right:0;bottom:0;width:100vw;height:100vh;max-height:100vh;border-radius:0;}',
    '}'
  ].join('');
  document.head.appendChild(css);

  var panel = document.createElement('iframe');
  panel.id = 'lc-panel';
  panel.src = src;
  panel.allow = 'microphone; camera';
  panel.setAttribute('title', '在线客服');

  var bubble = document.createElement('button');
  bubble.id = 'lc-bubble';
  bubble.setAttribute('aria-label', '打开在线客服');
  bubble.innerHTML = '<svg width="28" height="28" viewBox="0 0 24 24" fill="none">'
    + '<path d="M12 3C6.9 3 3 6.5 3 10.8c0 2.3 1.1 4.3 2.9 5.7-.1 1-.5 2.2-1.4 3.2 1.7-.1 3.2-.7 4.3-1.4 1 .3 2.1.4 3.2.4 5.1 0 9-3.5 9-7.9S17.1 3 12 3z" fill="#fff"/></svg>';

  function setOpen(open) {
    panel.classList.toggle('lc-open', open);
    bubble.classList.toggle('lc-hidden', isMobile() && open);
  }
  function toggle() { setOpen(!panel.classList.contains('lc-open')); }

  bubble.addEventListener('click', toggle);
  window.addEventListener('resize', function () {
    if (!isMobile()) bubble.classList.remove('lc-hidden');
  });

  // iframe 内访客页面 → 加载器：控制开关 + 企业配置（主题色/头像）同步
  window.addEventListener('message', function (e) {
    var t = e.data && e.data.type;
    if (t === 'livechat:toggle') toggle();
    else if (t === 'livechat:close') setOpen(false);
    else if (t === 'livechat:open') setOpen(true);
    else if (t === 'livechat:config' || t === 'LIVECHAT_CONFIG') {
      // 企管配置的悬浮球：品牌主题色 + 通用接待头像（与聊天窗一致）
      var cfg = e.data || {};
      if (cfg.themeColor) {
        bubble.style.background = cfg.themeColor;
        // 面板底色同步品牌色：双层圆角的亚像素缝隙不再露白
        panel.style.background = cfg.themeColor;
      }
      if (cfg.avatar) {
        var av = String(cfg.avatar).replace(/"/g, '&quot;');
        // 相对路径（如 /avatars/ai-default.png）→ 拼回加载器所在前端域名（文件在 dist 静态资源里）
        var rawAvatar = e.data.avatar || '';
        if (rawAvatar.charAt(0) === '/' && loaderOrigin) av = String(loaderOrigin + rawAvatar).replace(/"/g, '&quot;');
        bubble.innerHTML = '<img src="' + av + '" alt="在线客服" '
          + 'style="width:100%;height:100%;border-radius:50%;object-fit:cover;display:block;">'
          + '<span style="position:absolute;right:2px;bottom:2px;width:14px;height:14px;border-radius:50%;'
          + 'background:#00c853;border:2px solid #fff;box-sizing:border-box;"></span>';
      }
    }
  });

  function mount() {
    document.body.appendChild(panel);
    document.body.appendChild(bubble);
  }
  if (document.body) mount();
  else document.addEventListener('DOMContentLoaded', mount);
})();
