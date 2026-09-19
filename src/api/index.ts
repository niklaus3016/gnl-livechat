/**
 * API Unified Switch and Configuration
 * IS_MOCK = false → real backend (REST + Socket.IO via same-origin vite proxy).
 * IS_MOCK = true  → legacy local mock (localStorage + BroadcastChannel).
 */
export const IS_MOCK = false;

export const BASE_API_URL = '/api/v1';

// Real-time channel connects same-origin; vite proxies /socket.io → backend
export const WS_URL = `${window.location.protocol}//${window.location.host}`;

// Import for side-effect: installs the bus → socket send router
import '../lib/real/socket-service';

export * from './http';
export * from './visitor-api';
export * from './agent-api';
