import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
      // 允许集群内主机名访问（自动化浏览器经 livechat-qd.ns-tlwyfho9:3005 访问本服务）
      allowedHosts: ['livechat-qd.ns-tlwyfho9', 'livechat-qd.ns-tlwyfho9.svc.cluster.local'],
      proxy: {
        // 本地 dev 统一走生产公网后端（2026-09-20 后端容器重建后内网 livechat-hd:3005
        // 已 ECONNREFUSED，公网域名经 Sealos 网关始终可达，本地开发不再依赖内网拓扑）。
        // 若后端恢复内网直连，把 target 换回 http://livechat-hd.ns-tlwyfho9:<端口> 即可。
        '/api': {
          target: 'https://dzdqdodqktpq.sealoshzh.site',
          changeOrigin: true,
        },
        '/uploads': {
          target: 'https://dzdqdodqktpq.sealoshzh.site',
          changeOrigin: true,
        },
        '/socket.io': {
          target: 'https://dzdqdodqktpq.sealoshzh.site',
          changeOrigin: true,
          ws: true,
        },
      },
    },
  };
});
