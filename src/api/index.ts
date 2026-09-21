/**
 * API Unified Switch and Configuration
 * IS_MOCK = false → real backend (REST + Socket.IO).
 * IS_MOCK = true  → legacy local mock (localStorage + BroadcastChannel).
 *
 * 生产环境默认「同源部署」：前端构建产物由后端公网域名托管，
 * REST / Socket / 上传文件全部走相对路径，无需任何环境变量。
 * 若前端使用独立域名，构建时注入 VITE_API_BASE_URL 指向后端公网地址。
 */
import { API_ORIGIN } from './http';

export const IS_MOCK = false;

export const BASE_API_URL = `${API_ORIGIN}/api/v1`;

// 实时通道地址：同源用当前域名；跨域部署时取 VITE_API_BASE_URL
export const WS_URL = API_ORIGIN || `${window.location.protocol}//${window.location.host}`;

// Import for side-effect: installs the bus → socket send router
import '../lib/real/socket-service';

export * from './http';
export * from './visitor-api';
export * from './agent-api';
