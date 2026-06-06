"use client";

import React from 'react';
import { useApp } from '@/lib/store/app-context';
import { Icons } from '@/components/icons';
import { cn } from '@/lib/utils';

export default function Sidebar() {
  const { role, setRole, currentView, setCurrentView } = useApp();

  const navItems = [
    { id: 'map', label: 'Live Map', icon: Icons.map },
    { id: 'transparency', label: 'Transparency', icon: Icons.transparency },
    { id: 'budgeting', label: 'Budgeting Room', icon: Icons.budget },
  ];

  return (
    <div className="w-64 border-r bg-white flex flex-col h-screen sticky top-0">
      <div className="p-6 flex items-center gap-2">
        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
          <Icons.activity className="text-white" size={18} />
        </div>
        <span className="font-bold text-xl tracking-tight text-slate-900">CivicPulse</span>
      </div>

      <nav className="flex-1 px-4 space-y-1 mt-4">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => {
              setCurrentView(item.id as any);
              if (role === 'worker') setRole('citizen'); // Switch back to citizen when navigating away from portal
            }}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-200",
              currentView === item.id
                ? "bg-blue-50 text-blue-700 shadow-sm"
                : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            )}
          >
            <item.icon size={18} className={cn(currentView === item.id ? "text-blue-600" : "text-slate-400")} />
            {item.label}
          </button>
        ))}
      </nav>

      <div className="p-4 mt-auto border-t space-y-2">
        <div className="px-3 py-2 bg-slate-50 rounded-xl border border-slate-100 mb-2">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Active Role</p>
          <p className="text-xs font-bold text-slate-900 capitalize">{role}</p>
        </div>
        <button
          onClick={() => setRole(role === 'citizen' ? 'worker' : 'citizen')}
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all",
            role === 'citizen' ? "bg-slate-900 text-white hover:bg-slate-800" : "bg-emerald-600 text-white hover:bg-emerald-700"
          )}
        >
          <Icons.worker size={18} />
          {role === 'citizen' ? 'Switch to Worker' : 'Worker Portal'}
        </button>
      </div>
    </div>
  );
}
