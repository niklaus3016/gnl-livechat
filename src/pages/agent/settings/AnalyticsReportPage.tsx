import React from 'react';
import { AnalyticsDashboardView } from '../../../components/admin/AnalyticsDashboardView';

export const AnalyticsReportPage: React.FC = () => {
  return (
    <div className="flex-1 overflow-y-auto p-6 bg-slate-900 min-h-full">
      <div className="max-w-7xl mx-auto space-y-6">
        <AnalyticsDashboardView />
      </div>
    </div>
  );
};
