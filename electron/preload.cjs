/**
 * 预加载脚本（sandbox: true）：
 * 仅向渲染层暴露一组最小、安全的桌面能力。
 * 页面侧可通过 window.desktop 检测桌面环境（userAgent 中也带 Electron 标识）。
 */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktop', {
  isDesktop: true,
  platform: process.platform,
  versions: {
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
  },
  /** 在系统默认浏览器打开外链 */
  openExternal: (url) => ipcRenderer.invoke('desktop:openExternal', url),
});
