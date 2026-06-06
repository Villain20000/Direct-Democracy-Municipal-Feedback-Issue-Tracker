"use client";

import React, { useState } from 'react';
import Sidebar from '@/components/sidebar';
import LiveMap from '@/components/map/live-map';
import TransparencyDashboard from '@/components/dashboard/transparency-dashboard';
import ParticipatoryBudgetingRoom from '@/components/budget/budget-room';
import { WorkerPortal } from '@/components/worker/worker-portal';
import { useApp } from '@/lib/store/app-context';
import { Icons } from '@/components/icons';
import SmartReportModal from '@/components/map/smart-report-modal';

export default function Home() {
  const { role, currentView } = useApp();
  const [reportModalOpen, setReportModalOpen] = useState(false);

  const renderView = () => {
    if (role === 'worker') return <WorkerPortal />;

    switch (currentView) {
      case 'map': return <LiveMap />;
      case 'transparency': return <TransparencyDashboard />;
      case 'budgeting': return <ParticipatoryBudgetingRoom />;
      default: return <LiveMap />;
    }
  };

  return (
    <main className="flex h-screen bg-slate-50 overflow-hidden font-sans">
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0 relative">
        <header className="h-20 border-b bg-white/80 backdrop-blur-md flex items-center justify-between px-8 z-20">
          <div className="flex items-center gap-4 bg-slate-100/50 px-4 py-2.5 rounded-2xl border border-slate-200 w-[400px]">
            <Icons.search size={16} className="text-slate-400" />
            <input
              type="text"
              placeholder="Search by area, issue, or ID..."
              className="bg-transparent border-none outline-none text-sm w-full text-slate-900 placeholder:text-slate-500 font-medium"
            />
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={() => setReportModalOpen(true)}
              className="flex items-center gap-2 px-6 py-2.5 rounded-2xl bg-blue-600 text-white font-bold text-sm shadow-xl shadow-blue-200 hover:bg-blue-700 transition-all active:scale-95"
            >
              <Icons.add size={18} />
              Report Issue
            </button>
            <div className="w-10 h-10 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 font-bold text-sm shadow-sm">
              JD
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-hidden relative">
          {renderView()}
        </div>
      </div>

      <SmartReportModal
        isOpen={reportModalOpen}
        onClose={() => setReportModalOpen(false)}
      />
    </main>
  );
}
