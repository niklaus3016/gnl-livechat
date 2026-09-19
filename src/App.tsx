/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { RouteGuard } from './components/common/RouteGuard';
import { AgentLayout } from './components/agent/AgentLayout';

// Visitor Page
import { ChatPage } from './pages/chat/ChatPage';

// Agent Pages
import { LoginPage } from './pages/agent/LoginPage';
import { ConversationsPage } from './pages/agent/ConversationsPage';
import { ConversationDetailPage } from './pages/agent/ConversationDetailPage';
import { ProfilePage } from './pages/agent/settings/ProfilePage';
import { QuickReplyPage } from './pages/agent/settings/QuickReplyPage';
import { TenantSettingsPage } from './pages/agent/settings/TenantSettingsPage';
import { AgentsManagementPage } from './pages/agent/settings/AgentsManagementPage';
import { AnalyticsReportPage } from './pages/agent/settings/AnalyticsReportPage';

// Testing & Showcase
import { DualViewTesterPage } from './pages/test/DualViewTesterPage';
import { HomePage } from './pages/HomePage';
import { WgetCloudDemoPage } from './pages/demo/WgetCloudDemoPage';
import { AdminConsolePage } from './pages/admin/AdminConsolePage';
import { AdminLoginPage } from './pages/admin/AdminLoginPage';

export default function App() {
  return (
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

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
