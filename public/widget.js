(function () {
  'use strict';

  // Prevent duplicate execution
  if (window.__LIVECHAT_WIDGET_LOADED__) return;
  window.__LIVECHAT_WIDGET_LOADED__ = true;

  // Determine host domain and script configurations
  var scripts = document.getElementsByTagName('script');
  var currentScript = document.currentScript || scripts[scripts.length - 1];
  var scriptSrc = currentScript ? currentScript.src : '';
  
  var origin = window.location.origin;
  if (scriptSrc && scriptSrc.indexOf('http') === 0) {
    var urlObj = new URL(scriptSrc);
    origin = urlObj.origin;
  }

  var tenantCode = (window.LiveChatConfig && window.LiveChatConfig.tenant_code) ||
    (currentScript && currentScript.getAttribute('data-tenant')) ||
    'wgetcloud_live';

  // 宿主显式传 auto_popup_delay 时使用宿主值；默认 0（不自行计时），
  // 弹窗时机以 iframe 内租户配置（enable_auto_popup / auto_popup_delay_sec）为准，
  // iframe 到点会 postMessage LIVECHAT_AUTO_OPEN 通知宿主。
  var autoPopupDelay = typeof (window.LiveChatConfig && window.LiveChatConfig.auto_popup_delay) === 'number'
    ? window.LiveChatConfig.auto_popup_delay
    : 0;
  var themeColor = (window.LiveChatConfig && window.LiveChatConfig.theme_color) || '#1972f5';
  var agentAvatar = (window.LiveChatConfig && window.LiveChatConfig.agent_avatar) ||
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80';

  // Storage key to prevent annoying repeat popups in same session
  var DISMISS_KEY = 'lc_widget_dismissed_' + tenantCode;

  // Build DOM Structure
  var widgetContainer = document.createElement('div');
  widgetContainer.id = 'livechat-widget-root';
  widgetContainer.style.position = 'fixed';
  widgetContainer.style.bottom = '24px';
  widgetContainer.style.right = '24px';
  widgetContainer.style.zIndex = '2147483640';
  widgetContainer.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

  // 1. Chat Iframe Container
  var iframeContainer = document.createElement('div');
  iframeContainer.id = 'livechat-iframe-container';
  iframeContainer.style.position = 'absolute';
  iframeContainer.style.bottom = '80px';
  iframeContainer.style.right = '0px';
  iframeContainer.style.width = '385px';
  iframeContainer.style.maxWidth = 'calc(100vw - 32px)';
  iframeContainer.style.height = '660px';
  iframeContainer.style.maxHeight = 'calc(100vh - 110px)';
  iframeContainer.style.backgroundColor = '#ffffff';
  iframeContainer.style.borderRadius = '24px';
  iframeContainer.style.boxShadow = '0 20px 60px -10px rgba(0,0,0,0.22), 0 0 0 1px rgba(0,0,0,0.06)';
  iframeContainer.style.overflow = 'hidden';
  iframeContainer.style.display = 'none';
  iframeContainer.style.opacity = '0';
  iframeContainer.style.transform = 'translateY(16px) scale(0.96)';
  iframeContainer.style.transition = 'opacity 0.28s cubic-bezier(0.16, 1, 0.3, 1), transform 0.28s cubic-bezier(0.16, 1, 0.3, 1)';
  iframeContainer.style.border = 'none';

  var iframe = document.createElement('iframe');
  iframe.src = origin + '/chat?embed=1&tenant_code=' + encodeURIComponent(tenantCode);
  iframe.title = '在线客服咨询';
  iframe.style.width = '100%';
  iframe.style.height = '100%';
  iframe.style.border = 'none';
  iframe.style.margin = '0';
  iframe.style.padding = '0';
  iframe.style.display = 'block';
  iframe.style.overflow = 'hidden';
  iframe.setAttribute('scrolling', 'no');
  iframe.allow = 'camera; microphone; autoplay';

  iframeContainer.appendChild(iframe);

  // 2. Floating Avatar Toggle Button (Exact Crisp 1:1 replica)
  var toggleBtn = document.createElement('button');
  toggleBtn.id = 'livechat-toggle-btn';
  toggleBtn.type = 'button';
  toggleBtn.setAttribute('aria-label', '打开或收起在线客服');
  toggleBtn.style.width = '56px';
  toggleBtn.style.height = '56px';
  toggleBtn.style.borderRadius = '50%';
  toggleBtn.style.backgroundColor = '#ffffff';
  toggleBtn.style.border = '2px solid #ffffff';
  toggleBtn.style.outline = 'none';
  toggleBtn.style.cursor = 'pointer';
  toggleBtn.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.16), 0 2px 6px rgba(0, 0, 0, 0.08)';
  toggleBtn.style.display = 'flex';
  toggleBtn.style.alignItems = 'center';
  toggleBtn.style.justifyContent = 'center';
  toggleBtn.style.transition = 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.2s ease';
  toggleBtn.style.position = 'relative';
  toggleBtn.style.padding = '0';

  // Agent Avatar Image
  var avatarImg = document.createElement('img');
  avatarImg.src = agentAvatar;
  avatarImg.alt = '在线客服 James';
  avatarImg.style.width = '100%';
  avatarImg.style.height = '100%';
  avatarImg.style.borderRadius = '50%';
  avatarImg.style.objectFit = 'cover';
  avatarImg.style.display = 'block';
  toggleBtn.appendChild(avatarImg);

  // Green Online Status Indicator Dot
  var statusBadge = document.createElement('span');
  statusBadge.id = 'livechat-status-badge';
  statusBadge.style.position = 'absolute';
  statusBadge.style.bottom = '1px';
  statusBadge.style.right = '1px';
  statusBadge.style.width = '13.5px';
  statusBadge.style.height = '13.5px';
  statusBadge.style.borderRadius = '50%';
  statusBadge.style.backgroundColor = '#00c853';
  statusBadge.style.border = '2.5px solid #ffffff';
  statusBadge.style.boxShadow = '0 1px 3px rgba(0,0,0,0.2)';
  toggleBtn.appendChild(statusBadge);

  // Hover animations
  toggleBtn.addEventListener('mouseenter', function () {
    toggleBtn.style.transform = 'scale(1.06)';
    toggleBtn.style.boxShadow = '0 12px 30px rgba(0, 0, 0, 0.22), 0 4px 10px rgba(0, 0, 0, 0.12)';
  });
  toggleBtn.addEventListener('mouseleave', function () {
    toggleBtn.style.transform = 'scale(1)';
    toggleBtn.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.16), 0 2px 6px rgba(0, 0, 0, 0.08)';
  });

  widgetContainer.appendChild(iframeContainer);
  widgetContainer.appendChild(toggleBtn);
  document.body.appendChild(widgetContainer);

  var isOpen = false;

  function openWidget() {
    isOpen = true;
    iframeContainer.style.display = 'block';
    setTimeout(function () {
      iframeContainer.style.opacity = '1';
      iframeContainer.style.transform = 'translateY(0) scale(1)';
      try {
        if (iframe.contentWindow) {
          iframe.contentWindow.postMessage({ type: 'LIVECHAT_WIDGET_OPENED' }, '*');
        }
      } catch (e) {}
    }, 10);
    toggleBtn.setAttribute('aria-label', '收起在线客服');
  }

  function closeWidget(userInitiated) {
    isOpen = false;
    iframeContainer.style.opacity = '0';
    iframeContainer.style.transform = 'translateY(16px) scale(0.96)';
    setTimeout(function () {
      iframeContainer.style.display = 'none';
    }, 280);
    toggleBtn.setAttribute('aria-label', '打开在线客服');

    if (userInitiated) {
      try {
        sessionStorage.setItem(DISMISS_KEY, 'true');
      } catch (e) {}
    }
  }

  toggleBtn.addEventListener('click', function () {
    if (isOpen) {
      closeWidget(true);
    } else {
      openWidget();
    }
  });

  // Auto popup logic after N seconds (Default 3.5s)
  var isDismissed = false;
  try {
    isDismissed = sessionStorage.getItem(DISMISS_KEY) === 'true';
  } catch (e) {}

  if (!isDismissed && autoPopupDelay > 0) {
    setTimeout(function () {
      if (!isOpen && !sessionStorage.getItem(DISMISS_KEY)) {
        openWidget();
      }
    }, autoPopupDelay * 1000);
  }

  // Handle postMessage from embedded chat iframe
  window.addEventListener('message', function (e) {
    if (!e.data) return;
    // iframe 内按租户配置到点请求自动弹窗（访客手动关闭过则不再弹）
    if (e.data.type === 'LIVECHAT_AUTO_OPEN') {
      var dismissedAuto = false;
      try { dismissedAuto = sessionStorage.getItem(DISMISS_KEY) === 'true'; } catch (err2) {}
      if (!isOpen && !dismissedAuto) openWidget();
      return;
    }
    if (e.data.type === 'LIVECHAT_CLOSE' || e.data.type === 'LIVECHAT_MINIMIZE') {
      closeWidget(true);
    }
  });

  // Expose global controller for easy host page control
  window.$LiveChat = {
    open: openWidget,
    close: function () { closeWidget(true); },
    toggle: function () {
      if (isOpen) closeWidget(true);
      else openWidget();
    },
    resetPopup: function () {
      try {
        sessionStorage.removeItem(DISMISS_KEY);
      } catch (e) {}
      setTimeout(openWidget, 500);
    }
  };
})();
