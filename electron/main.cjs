/**
 * 在线客服工作台 · Electron 桌面客户端主进程
 *
 * 设计要点：
 * 1. 通过自定义特权协议 app:// 加载本地构建产物（dist-desktop），
 *    规避 file:// 下 ES Module/CORS 等限制；
 * 2. 麦克风/通知等权限默认放行（坐席语音消息依赖）；
 * 3. 单实例锁：重复点击图标聚焦已有窗口；
 * 4. 记忆窗口大小与位置；
 * 5. 外部链接一律交给系统浏览器，不在应用内打开；
 * 6. 未配置签名证书时照常出未签名包，签名/公证由 CI 环境变量自动激活。
 */
const {
  app,
  BrowserWindow,
  Menu,
  shell,
  session,
  protocol,
  ipcMain,
} = require('electron');
const path = require('path');
const fs = require('fs');

// 必须在 app ready 之前注册
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'app',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true,
      corsEnabled: true,
    },
  },
]);

/** 打包后 __dirname 位于 app.asar/electron，开发时位于项目 electron/ */
const DIST_DIR = path.join(__dirname, '..', 'dist-desktop');
const PRELOAD = path.join(__dirname, 'preload.cjs');
const ICON = path.join(__dirname, '..', 'build', 'icon-win.png');
const STATE_FILE = path.join(app.getPath('userData'), 'window-state.json');

const APP_HOST = 'desktop';
const DEFAULT_BOUNDS = { width: 1440, height: 900 };
const MIN_SIZE = { width: 1180, height: 720 };

/** @type {BrowserWindow | null} */
let mainWindow = null;

function loadWindowState() {
  try {
    const raw = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    if (
      Number.isFinite(raw.width) &&
      Number.isFinite(raw.height) &&
      raw.width >= MIN_SIZE.width &&
      raw.height >= MIN_SIZE.height
    ) {
      return raw;
    }
  } catch {
    /* 首次运行或文件损坏，用默认值 */
  }
  return null;
}

function saveWindowState() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  try {
    const bounds = mainWindow.getBounds();
    const data = {
      ...bounds,
      maximized: mainWindow.isMaximized(),
    };
    fs.writeFileSync(STATE_FILE, JSON.stringify(data), 'utf8');
  } catch {
    /* 忽略保存失败 */
  }
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.txt': 'text/plain; charset=utf-8',
};

/** 注册 app:// 协议，托管 dist-desktop 静态资源 */
function registerAppProtocol() {
  protocol.handle('app', async (request) => {
    const url = new URL(request.url);
    let pathname = decodeURIComponent(url.pathname);
    if (pathname === '/' || pathname === '') pathname = '/index.html';

    // 防目录穿越
    const filePath = path.normalize(path.join(DIST_DIR, pathname));
    if (!filePath.startsWith(DIST_DIR)) {
      return new Response('Forbidden', { status: 403 });
    }

    try {
      const body = fs.promises.readFile(filePath);
      const ext = path.extname(filePath).toLowerCase();
      const headers = {
        'Content-Type': MIME[ext] || 'application/octet-stream',
        // 允许连接远程后端、WebSocket、blob/data 媒体与内联样式（Tailwind 运行时注入）
        'Content-Security-Policy': [
          "default-src 'self'",
          "script-src 'self'",
          "style-src 'self' 'unsafe-inline'",
          "img-src 'self' blob: data: https:",
          "media-src 'self' blob: data: https:",
          "font-src 'self' data:",
          'connect-src ' + "'self' https: wss: ws:",
          "worker-src 'self' blob:",
          "frame-src 'self' https:",
          "object-src 'none'",
        ].join('; '),
      };
      return new Response(await body, { status: 200, headers });
    } catch {
      return new Response('Not Found', { status: 404 });
    }
  });
}

function isAllowedPermission(permission) {
  return [
    'media', // 麦克风/扬声器（语音消息）
    'audioCapture',
    'videoCapture',
    'notifications',
    'clipboard-read',
    'clipboard-sanitized-write',
    'fullscreen',
  ].includes(permission);
}

function configureSession() {
  const ses = session.defaultSession;

  // 主动授权弹窗：直接放行所需权限（不弹系统式询问栏；OS 层麦克风授权仍由系统管）
  ses.setPermissionRequestHandler((_wc, permission, callback) => {
    callback(isAllowedPermission(permission));
  });
  ses.setPermissionCheckHandler((_wc, permission) => isAllowedPermission(permission));
}

function buildMenu() {
  const template = [
    ...(process.platform === 'darwin'
      ? [
          {
            label: app.name,
            submenu: [
              { role: 'about', label: '关于' },
              { type: 'separator' },
              { role: 'hide', label: '隐藏' },
              { role: 'hideOthers', label: '隐藏其他' },
              { type: 'separator' },
              { role: 'quit', label: '退出' },
            ],
          },
        ]
      : []),
    {
      label: '编辑',
      submenu: [
        { role: 'undo', label: '撤销' },
        { role: 'redo', label: '重做' },
        { type: 'separator' },
        { role: 'cut', label: '剪切' },
        { role: 'copy', label: '复制' },
        { role: 'paste', label: '粘贴' },
        { role: 'selectAll', label: '全选' },
      ],
    },
    {
      label: '视图',
      submenu: [
        { role: 'reload', label: '重新加载' },
        { role: 'forceReload', label: '强制重新加载' },
        { role: 'toggleDevTools', label: '开发者工具' },
        { type: 'separator' },
        { role: 'resetZoom', label: '重置缩放' },
        { role: 'zoomIn', label: '放大' },
        { role: 'zoomOut', label: '缩小' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: '全屏' },
      ],
    },
    {
      label: '窗口',
      submenu: [
        { role: 'minimize', label: '最小化' },
        { role: 'close', label: '关闭窗口' },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function createWindow() {
  const saved = loadWindowState();

  mainWindow = new BrowserWindow({
    width: saved?.width || DEFAULT_BOUNDS.width,
    height: saved?.height || DEFAULT_BOUNDS.height,
    x: saved?.x,
    y: saved?.y,
    minWidth: MIN_SIZE.width,
    minHeight: MIN_SIZE.height,
    show: false,
    title: '在线客服工作台',
    backgroundColor: '#f1f5f9',
    icon: fs.existsSync(ICON) ? ICON : undefined,
    autoHideMenuBar: process.platform === 'win32',
    webPreferences: {
      preload: PRELOAD,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
    },
  });

  if (saved?.maximized) mainWindow.maximize();

  mainWindow.once('ready-to-show', () => mainWindow?.show());

  mainWindow.loadURL(`app://${APP_HOST}/index.html`);

  // 应用内导航只允许留在 app://，其他协议交给系统浏览器
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith(`app://${APP_HOST}`)) {
      event.preventDefault();
      if (/^https?:\/\//i.test(url)) shell.openExternal(url);
    }
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });

  const persist = () => saveWindowState();
  mainWindow.on('resize', persist);
  mainWindow.on('move', persist);
  mainWindow.on('maximize', persist);
  mainWindow.on('unmaximize', persist);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// 单实例锁
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  });

  app.whenReady().then(() => {
    registerAppProtocol();
    configureSession();
    buildMenu();
    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on('window-all-closed', () => {
    saveWindowState();
    if (process.platform !== 'darwin') app.quit();
  });

  // 渲染进程请求打开外部链接（预留能力）
  ipcMain.handle('desktop:openExternal', (_evt, url) => {
    if (typeof url === 'string' && /^https?:\/\//i.test(url)) {
      return shell.openExternal(url);
    }
    return null;
  });
}
