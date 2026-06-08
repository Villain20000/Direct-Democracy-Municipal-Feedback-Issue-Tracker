"use client";

import React, { useState } from 'react';
import { useApp } from '@/lib/store/app-context';
import { Icons } from '@/components/icons';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

export default function TransparencyDashboard() {
  const { issues } = useApp();
  const [search, setSearch] = useState('');

  const stats = [
    { label: 'Total Issues', value: issues.length, icon: Icons.activity, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Avg Resolution', value: '3.2 Days', icon: Icons.pending, color: 'text-amber-600', bg: 'bg-amber-50' },
    { label: 'Active Citizens', value: '1,284', icon: Icons.users, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Monthly Budget', value: '€2.4M', icon: Icons.euro, color: 'text-indigo-600', bg: 'bg-indigo-50' },
  ];

  const resolvedIssues = issues.filter(i => i.status === 'resolved' && i.after_image_url);

  return (
    <div className="h-full flex flex-col bg-slate-50 overflow-hidden">
      <header className="p-8 pb-0">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Municipal Transparency</h1>
            <p className="text-slate-500 mt-1 font-medium">Real-time accountability and operational metrics.</p>
          </div>
          <div className="flex gap-3">
            <button className="flex items-center gap-2 px-4 py-2 bg-white border rounded-xl text-sm font-bold shadow-sm hover:bg-slate-50 transition-all">
              <Icons.fileJson size={16} />
              Export JSON
            </button>
            <button className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl text-sm font-bold shadow-lg hover:bg-slate-800 transition-all">
              <Icons.fileSpreadsheet size={16} />
              Export CSV
            </button>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-6 mb-8">
          {stats.map((stat, idx) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm"
            >
              <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center mb-4", stat.bg)}>
                <stat.icon className={stat.color} size={24} />
              </div>
              <p className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">{stat.label}</p>
              <p className="text-2xl font-black text-slate-900 mt-1">{stat.value}</p>
            </motion.div>
          ))}
        </div>
      </header>

      <ScrollArea className="flex-1 px-8 pb-8">
        <div className="grid grid-cols-12 gap-8">
          {/* Before vs After Section */}
          <div className="col-span-8 space-y-6">
            <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <Icons.trendingUp size={20} className="text-emerald-600" />
              Recent Successes (Before & After)
            </h3>
            <div className="grid grid-cols-2 gap-6">
              {resolvedIssues.map((issue) => (
                <BeforeAfterCard key={issue.id} issue={issue} />
              ))}
            </div>

            {/* Data Feed */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden mt-8">
              <div className="p-6 border-b flex items-center justify-between bg-slate-50/50">
                <h3 className="font-bold text-slate-900">Open Data Feed</h3>
                <div className="relative w-64">
                  <Icons.search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                  <input
                    type="text"
                    placeholder="Search tickets..."
                    className="w-full pl-9 pr-4 py-2 bg-white border rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500/20"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/50">
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Issue ID</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Category</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Cost</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {issues.filter(i => i.title.toLowerCase().includes(search.toLowerCase())).map(issue => (
                      <tr key={issue.id} className="hover:bg-slate-50/50 transition-colors cursor-pointer group">
                        <td className="px-6 py-4">
                          <p className="text-xs font-bold text-slate-900 group-hover:text-blue-600 transition-colors">#{issue.id}</p>
                          <p className="text-[10px] text-slate-500 font-medium truncate w-32">{issue.title}</p>
                        </td>
                        <td className="px-6 py-4">
                          <Badge variant="outline" className="text-[10px] font-bold bg-slate-50 border-slate-200">
                            {issue.category}
                          </Badge>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-1.5">
                            <div className={cn(
                              "w-1.5 h-1.5 rounded-full",
                              issue.status === 'resolved' ? "bg-emerald-500" : issue.status === 'in-progress' ? "bg-amber-500" : "bg-rose-500"
                            )} />
                            <span className="text-xs font-bold capitalize text-slate-700">{issue.status.replace('-', ' ')}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 font-mono text-xs font-bold text-slate-600">
                          {issue.cost ? `€${issue.cost}` : '—'}
                        </td>
                        <td className="px-6 py-4 text-[10px] font-medium text-slate-400">
                          {new Date(issue.created_at).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Right Sidebar Stats */}
          <div className="col-span-4 space-y-6">
            <div className="bg-slate-900 rounded-3xl p-6 text-white shadow-xl relative overflow-hidden">
              <Icons.shieldCheck className="absolute -right-4 -bottom-4 text-white/5" size={120} />
              <h4 className="font-bold text-lg mb-4 flex items-center gap-2">
                <Icons.ai className="text-cyan-400" size={18} />
                SLA Performance
              </h4>
              <div className="space-y-4 relative z-10">
                <div>
                  <div className="flex justify-between text-[10px] font-bold uppercase mb-1.5 text-slate-400">
                    <span>Target Resolution</span>
                    <span>92%</span>
                  </div>
                  <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <div className="h-full bg-cyan-400 w-[92%]" />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-[10px] font-bold uppercase mb-1.5 text-slate-400">
                    <span>Citizen Satisfaction</span>
                    <span>4.8/5.0</span>
                  </div>
                  <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-400 w-[96%]" />
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm">
              <h4 className="font-bold text-slate-900 mb-4">Top Departments</h4>
              <div className="space-y-4">
                {[
                  { name: 'Infrastructure', count: 42, color: 'bg-blue-500' },
                  { name: 'Sanitation', count: 38, color: 'bg-emerald-500' },
                  { name: 'Public Lighting', count: 24, color: 'bg-amber-500' },
                ].map(dept => (
                  <div key={dept.name} className="flex items-center gap-3">
                    <div className={cn("w-2 h-2 rounded-full", dept.color)} />
                    <span className="flex-1 text-xs font-bold text-slate-700">{dept.name}</span>
                    <span className="text-xs font-black text-slate-900">{dept.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}

function BeforeAfterCard({ issue }: { issue: any }) {
  const [sliderPos, setSliderPos] = useState(50);

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    setSliderPos(Math.min(100, Math.max(0, x)));
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden group">
      <div
        className="relative aspect-video cursor-ew-resize overflow-hidden"
        onMouseMove={handleMouseMove}
      >
        <img src={issue.after_image_url} className="absolute inset-0 w-full h-full object-cover" alt={`After resolution: ${issue.title}`} />
        <div
          className="absolute inset-0 w-full h-full overflow-hidden border-r-2 border-white/50 shadow-2xl"
          style={{ width: `${sliderPos}%` }}
        >
          <img src={issue.image_url} className="absolute inset-0 w-[200%] h-full object-cover" alt={`Before resolution: ${issue.title}`}
               style={{ width: `${100 * (100 / sliderPos)}%` }} />
        </div>

        {/* Slider Line */}
        <div
          className="absolute inset-y-0 w-0.5 bg-white shadow-xl z-10"
          style={{ left: `${sliderPos}%` }}
        >
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-white rounded-full shadow-2xl flex items-center justify-center">
            <Icons.chevronLeft size={12} className="text-slate-400" />
            <Icons.chevronRight size={12} className="text-slate-400" />
          </div>
        </div>

        <div className="absolute top-4 left-4 z-20">
          <Badge variant="error" className="shadow-lg backdrop-blur-md bg-rose-500/80 text-white border-0">BEFORE</Badge>
        </div>
        <div className="absolute top-4 right-4 z-20">
          <Badge variant="success" className="shadow-lg backdrop-blur-md bg-emerald-500/80 text-white border-0">AFTER</Badge>
        </div>
      </div>

      <div className="p-4">
        <h4 className="font-bold text-slate-900 text-sm truncate">{issue.title}</h4>
        <div className="flex items-center justify-between mt-2">
          <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
            <Icons.clock size={10} />
            Resolved in {issue.resolution_time}
          </span>
          <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
            €{issue.cost}
          </span>
        </div>
        <div className="mt-3 pt-3 border-t border-slate-50 flex items-center justify-between">
           <div className="flex items-center gap-2">
              <Icons.users size={12} className="text-slate-400" />
              <span className="text-[10px] font-bold text-slate-500">{issue.team_size} members</span>
           </div>
           <div className="flex items-center gap-1">
              {issue.materials?.slice(0, 1).map((m: string) => (
                <Badge key={m} variant="outline" className="text-[8px] py-0 px-1.5 opacity-60 uppercase">{m}</Badge>
              ))}
           </div>
        </div>
      </div>
    </div>
  );
}
