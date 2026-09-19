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
      // 允许集群内主机名访问（自动化浏览器经 livechat-qd.ns-tlwyfho9:3001 访问本服务）
      allowedHosts: ['livechat-qd.ns-tlwyfho9', 'livechat-qd.ns-tlwyfho9.svc.cluster.local'],
      proxy: {
        // 后端内网服务（浏览器只访问同源，由 dev server 代理转发）
        '/api': {
          target: 'http://livechat-hd.ns-tlwyfho9:3003',
          changeOrigin: true,
        },
        '/uploads': {
          target: 'http://livechat-hd.ns-tlwyfho9:3003',
          changeOrigin: true,
        },
        '/socket.io': {
          target: 'http://livechat-hd.ns-tlwyfho9:3003',
          changeOrigin: true,
          ws: true,
        },
      },
    },
  };
});
