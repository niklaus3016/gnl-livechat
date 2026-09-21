/**
 * 生产环境静态文件服务器（Sealos DevBox 部署用）
 * - 托管 vite build 产物 dist/
 * - SPA 深链回退（非文件请求统一返回 index.html）
 * - 监听 0.0.0.0:PORT（Sealos 要求）
 */
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3005;

const distDir = path.join(__dirname, 'dist');

// 静态资源
app.use(express.static(distDir, {
  maxAge: '1y',
  index: false,
}));

// 以下路径不应被 SPA fallback 吞掉：独立域名部署下这些路由属于后端
const SPA_EXCLUDED_PREFIXES = ['/api/', '/socket.io/', '/uploads/'];

// SPA fallback：非排除路径的 GET 请求回退到 index.html
app.get('*', (req, res) => {
  if (req.method === 'GET' && SPA_EXCLUDED_PREFIXES.some((p) => req.path.startsWith(p))) {
    res.status(404).json({ code: 404, message: `前端服务不存在该路径：${req.path}` });
    return;
  }
  res.sendFile(path.join(distDir, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`前端生产服务已启动: http://0.0.0.0:${PORT}`);
});
