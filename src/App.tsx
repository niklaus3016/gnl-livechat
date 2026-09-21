/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { BrowserRouter, HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { RouteGuard } from './components/common/RouteGuard';
import { AgentLayout } from './components/agent/AgentLayout';
import { IS_DESKTOP } from './lib/desktop';

// Visitor Page
import { ChatPage } from './pages/chat/ChatPage';

// Agent Pages
import { LoginPage } from './pages/agent/LoginPage';
import { ConversationsPage } from './pages/agent/ConversationsPage';
import { ConversationDetailPage } from './pages/agent/ConversationDetailPage';
import { ProfilePage } from './pages/agent/settings/ProfilePage';
import { QuickReplyPage } from './pages/agent/settings/QuickReplyPage';
import { ChangePasswordPage } from './pages/agent/settings/ChangePasswordPage';
import { TenantSettingsPage } from './pages/agent/settings/TenantSettingsPage';
import { AgentsManagementPage } from './pages/agent/settings/AgentsManagementPage';
import { AnalyticsReportPage } from './pages/agent/settings/AnalyticsReportPage';

// Testing & Showcase（网页版专用，桌面客户端不注册）
import { DualViewTesterPage } from './pages/test/DualViewTesterPage';
import { HomePage } from './pages/HomePage';
import { WgetCloudDemoPage } from './pages/demo/WgetCloudDemoPage';
import { AdminConsolePage } from './pages/admin/AdminConsolePage';
import { AdminLoginPage } from './pages/admin/AdminLoginPage';

/**
 * 坐席工作台路由集合 —— 网页版与桌面版共用。
 * 桌面版（Electron）只挂载这些路由，访客页/演示页/管理后台均不开放。
 * 注意：必须是 JSX 常量而不是组件——<Routes> 的直接子节点只允许 <Route> 或
 * <React.Fragment>，写成自定义组件会抛 "[x] is not a <Route> component" 并白屏。
 */
const AGENT_ROUTES = (
  <>
    {/* Agent Login */}
    <Route path="/agent/login" element={<LoginPage />} />

    {/* Agent Workbench Protected Routes */}
    <Route
      path="/agent/conversations"
      element={
        <RouteGuard allowedRoles={['agent', 'tenant_admin']}>
          <AgentLayout>
            <ConversationsPage />
          </AgentLayout>
        </RouteGuard>
      }
    />

    <Route
      path="/agent/conversations/:id"
      element={
        <RouteGuard allowedRoles={['agent', 'tenant_admin']}>
          <AgentLayout>
            <ConversationDetailPage />
          </AgentLayout>
        </RouteGuard>
      }
    />

    <Route
      path="/agent/settings/profile"
      element={
        <RouteGuard allowedRoles={['agent', 'tenant_admin']}>
          <AgentLayout>
            <ProfilePage />
          </AgentLayout>
        </RouteGuard>
      }
    />

    <Route
      path="/agent/settings/quick-reply"
      element={
        <RouteGuard allowedRoles={['agent', 'tenant_admin']}>
          <AgentLayout>
            <QuickReplyPage />
          </AgentLayout>
        </RouteGuard>
      }
    />

    <Route
      path="/agent/settings/password"
      element={
        <RouteGuard allowedRoles={['agent', 'tenant_admin']}>
          <AgentLayout>
            <ChangePasswordPage />
          </AgentLayout>
        </RouteGuard>
      }
    />

    {/* Tenant Admin Only Restricted Routes */}
    <Route
      path="/agent/settings/tenant"
      element={
        <RouteGuard allowedRoles={['tenant_admin']}>
          <AgentLayout>
            <TenantSettingsPage />
          </AgentLayout>
        </RouteGuard>
      }
    />

    <Route
      path="/agent/settings/agents"
      element={
        <RouteGuard allowedRoles={['tenant_admin']}>
          <AgentLayout>
            <AgentsManagementPage />
          </AgentLayout>
        </RouteGuard>
      }
    />

    {/* Data Report & SLA Analytics Route */}
    <Route
      path="/agent/analytics"
      element={
        <RouteGuard allowedRoles={['agent', 'tenant_admin']}>
          <AgentLayout>
            <AnalyticsReportPage />
          </AgentLayout>
        </RouteGuard>
      }
    />
  </>
);

/**
 * 桌面客户端（Electron）：
 * - file:// 协议加载本地文件，必须用 HashRouter（深链不会 404/白屏）
 * - 仅坐席工作台，入口与任何未知路径一律落到坐席登录页
 */
const DesktopApp: React.FC = () => (
  <HashRouter>
    <Routes>
      <Route path="/" element={<Navigate to="/agent/login" replace />} />
      {AGENT_ROUTES}
      <Route path="*" element={<Navigate to="/agent/login" replace />} />
    </Routes>
  </HashRouter>
);

/**
 * 网页版：BrowserRouter + 全量路由（访客/演示/管理后台/坐席）
 */
const WebApp: React.FC = () => (
  <BrowserRouter>
    <Routes>
      {/* Entry Landing Launcher */}
      <Route path="/" element={<HomePage />} />

      {/* WgetCloud User Center Live Host Demo (Auto-popup & Avatar Minimize) */}
      <Route path="/demo" element={<WgetCloudDemoPage />} />
      <Route path="/user-center" element={<WgetCloudDemoPage />} />

      {/* Dual-View Live Tester */}
      <Route path="/tester" element={<DualViewTesterPage />} />

      {/* Admin Login */}
      <Route path="/admin/login" element={<AdminLoginPage />} />
      {/* Platform super-admin login (internal entry, separated from tenant admin) */}
      <Route path="/super/login" element={<AdminLoginPage />} />

      {/* Dual-Role Admin Console (/admin) */}
      <Route
        path="/admin"
        element={
          <RouteGuard allowedRoles={['super_admin', 'tenant_admin']}>
            <AdminConsolePage />
          </RouteGuard>
        }
      />

      {/* Visitor Chat Page */}
      <Route path="/chat" element={<ChatPage />} />

      {/* Agent workbench */}
      {AGENT_ROUTES}

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  </BrowserRouter>
);

export default function App() {
  return IS_DESKTOP ? <DesktopApp /> : <WebApp />;
}
