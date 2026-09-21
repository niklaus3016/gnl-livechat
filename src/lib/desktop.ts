/**
 * 桌面客户端（Electron）环境检测。
 *
 * Electron 主进程默认会在 userAgent 末尾追加 `Electron/<version>`，
 * 网页浏览器（含 Chrome/Edge/Safari）都不会包含该标识。
 *
 * 桌面版与网页版共用同一份构建产物时，用此标识做运行时分支：
 * - 桌面版：HashRouter + 仅坐席工作台路由
 * - 网页版：BrowserRouter + 全量路由（访客页/演示页/管理后台）
 */
export const IS_DESKTOP =
  typeof window !== 'undefined' && /\bElectron\/[\d.]+/.test(window.navigator.userAgent);
