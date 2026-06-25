"use client";

import { useApp } from "@/lib/store/app-context";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Icons } from "@/components/icons";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

export function WorkerPortal() {
  const { issues } = useApp();
  const [selected, setSelected] = useState<any>(null);
  const [isResolving, setIsResolving] = useState(false);
  const [resolutionStep, setResolutionStep] = useState(1);

  const columns = [
    { id: 'pending', title: 'Pending', icon: Icons.pending, color: 'text-rose-600', bg: 'bg-rose-50' },
    { id: 'in-progress', title: 'Dispatched', icon: Icons.activity, color: 'text-amber-600', bg: 'bg-amber-50' },
    { id: 'in-review', title: 'In Review', icon: Icons.search, color: 'text-blue-600', bg: 'bg-blue-50' },
    { id: 'resolved', title: 'Completed', icon: Icons.resolved, color: 'text-emerald-600', bg: 'bg-emerald-50' },
  ];

  return (
    <div className="h-full flex overflow-hidden bg-slate-50 relative">
      <div className="flex-1 p-8 flex gap-6 overflow-x-auto pb-12">
        {columns.map(col => (
          <div key={col.id} className="min-w-[300px] w-[300px] flex flex-col gap-4">
            <div className="flex items-center justify-between px-3">
              <div className="flex items-center gap-2.5">
                <div className={cn("w-8 h-8 rounded-xl flex items-center justify-center shadow-sm", col.bg)}>
                  <col.icon size={16} className={col.color} />
                </div>
                <h3 className="font-bold text-slate-900 tracking-tight">{col.title}</h3>
                <span className="bg-slate-200 text-slate-600 text-[10px] px-2 py-0.5 rounded-full font-black">
                  {issues.filter(i => i.status === col.id).length}
                </span>
              </div>
              <button className="p-1.5 hover:bg-slate-200 rounded-lg transition-colors">
                <Icons.filter size={14} className="text-slate-400" />
              </button>
            </div>

            <ScrollArea className="flex-1">
              <div className="space-y-4 pr-4 pb-4">
                {issues.filter(i => i.status === col.id).map((issue, idx) => (
                  <motion.div
                    key={issue.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    onClick={() => setSelected(issue)}
                    className={cn(
                      "bg-white p-5 rounded-[24px] border border-slate-200 shadow-sm cursor-pointer transition-all hover:border-blue-400 hover:shadow-lg active:scale-[0.98] group",
                      selected?.id === issue.id && "border-blue-500 ring-4 ring-blue-50 shadow-xl"
                    )}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <Badge variant="outline" className="text-[10px] font-black px-2 py-0 bg-slate-50 text-slate-500 border-slate-100 uppercase tracking-tighter">
                        {issue.category}
                      </Badge>
                      <div className="flex -space-x-2">
                        {[1, 2].map(i => (
                          <div key={i} className="w-6 h-6 rounded-full border-2 border-white bg-slate-200 flex items-center justify-center overflow-hidden">
                            <Icons.user size={10} className="text-slate-400" />
                          </div>
                        ))}
                      </div>
                    </div>
                    <h4 className="font-bold text-slate-900 text-sm leading-tight group-hover:text-blue-600 transition-colors">{issue.title}</h4>
                    <p className="text-[11px] text-slate-500 mt-2 line-clamp-2 leading-relaxed font-medium">{issue.description}</p>

                    <div className="mt-4 pt-4 border-t border-slate-50 flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-rose-500 font-bold text-[10px] bg-rose-50 px-2 py-0.5 rounded-full">
                        <Icons.urgent size={10} />
                        P{6 - issue.severity}
                      </div>
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{new Date(issue.created_at).toLocaleDateString()}</span>
                    </div>
                  </motion.div>
                ))}
              </div>
            </ScrollArea>
          </div>
        ))}
      </div>

      <aside className="w-[450px] border-l bg-white flex flex-col h-full shadow-2xl relative z-10">
        <div className="p-8 border-b bg-slate-50/50 flex items-center justify-between">
          <div>
            <h3 className="font-black text-xl flex items-center gap-2 text-slate-900">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <Icons.map size={18} className="text-white" />
              </div>
              Field Ops
            </h3>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Route Optimizer v2.4</p>
          </div>
          <div className="flex gap-2">
            <button className="p-2.5 bg-white border rounded-xl hover:bg-slate-50 transition-all shadow-sm">
              <Icons.layers size={18} className="text-slate-600" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="p-8 space-y-8">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-[11px] uppercase font-black text-slate-400 tracking-widest">Active Dispatch Route</p>
                <Badge variant="success" className="text-[9px]">Optimal</Badge>
              </div>
              <div className="space-y-3 relative">
                <div className="absolute left-6 top-6 bottom-6 w-0.5 bg-slate-100" />
                {issues.filter(i => i.status !== 'resolved').slice(0, 3).map((issue, idx) => (
                  <div key={issue.id} className="relative p-4 bg-slate-50 border border-slate-200 rounded-2xl flex items-center gap-4 hover:bg-white hover:border-blue-300 transition-all cursor-pointer">
                    <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center justify-center text-xs font-black text-slate-900 z-10">
                      {idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-black text-slate-900 truncate">{issue.title}</p>
                      <p className="text-[10px] font-bold text-slate-400 mt-0.5">{0.5 + idx * 1.2} km away • Priority High</p>
                    </div>
                    <Icons.chevronRight size={14} className="text-slate-300" />
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-8 border-t">
              {selected ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="space-y-6"
                >
                  <div className="relative group">
                    <img src={selected.image_url} className="rounded-[32px] aspect-video object-cover shadow-2xl border-4 border-slate-50" alt={`Issue detail: ${selected.title}`} />
                    <div className="absolute inset-0 bg-slate-900/40 rounded-[32px] opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <button className="bg-white p-3 rounded-full shadow-xl">
                        <Icons.search className="text-slate-900" size={20} />
                      </button>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="warning">{selected.status}</Badge>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Ticket #{selected.id}</span>
                    </div>
                    <h4 className="font-black text-2xl text-slate-900 leading-tight">{selected.title}</h4>
                    <p className="text-sm text-slate-500 mt-4 leading-relaxed font-medium">{selected.description}</p>
                  </div>

                  {selected.status !== 'resolved' && (
                    <div className="pt-4 grid grid-cols-2 gap-4">
                      <button className="py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-slate-800 transition-all shadow-xl">
                        <Icons.activity size={16} />
                        Dispatch Team
                      </button>
                      <button
                        onClick={() => setIsResolving(true)}
                        className="py-4 bg-emerald-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-100"
                      >
                        <Icons.resolved size={16} />
                        Resolve
                      </button>
                    </div>
                  )}
                </motion.div>
              ) : (
                <div className="py-20 text-center space-y-4">
                  <div className="w-20 h-20 bg-slate-50 rounded-[32px] flex items-center justify-center mx-auto border-2 border-dashed border-slate-200">
                    <Icons.search className="text-slate-300" size={40} />
                  </div>
                  <div>
                    <p className="text-sm text-slate-900 font-black uppercase tracking-widest">Awaiting Selection</p>
                    <p className="text-[11px] text-slate-400 mt-1 font-medium italic">Select a ticket from the board to access<br/>field tools and dispatch controls.</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </aside>

      {/* Resolution Modal Overlay */}
      <AnimatePresence>
        {isResolving && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[3000] bg-slate-900/60 backdrop-blur-xl flex items-center justify-center p-6"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-white w-full max-w-lg rounded-[40px] shadow-2xl overflow-hidden"
            >
              <div className="p-8 pb-4 flex justify-between items-center border-b">
                <h3 className="text-2xl font-black">Resolve Ticket</h3>
                <button onClick={() => setIsResolving(false)} className="p-3 hover:bg-slate-100 rounded-2xl">
                  <Icons.close size={24} className="text-slate-400" />
                </button>
              </div>

              <div className="p-8 space-y-8">
                {resolutionStep === 1 ? (
                  <div className="space-y-6">
                    <div className="aspect-video bg-slate-50 border-2 border-dashed border-slate-200 rounded-[32px] flex flex-col items-center justify-center cursor-pointer hover:bg-slate-100 hover:border-emerald-300 transition-all group">
                      <div className="w-16 h-16 bg-white rounded-2xl shadow-sm flex items-center justify-center mb-4">
                        <Icons.camera size={32} className="text-emerald-600" />
                      </div>
                      <p className="font-bold text-slate-900 uppercase text-xs tracking-widest">Upload "After" Photo</p>
                      <p className="text-[10px] text-slate-400 mt-1">Required to close the loop</p>
                    </div>
                    <div className="space-y-4">
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Material Costs (€)</label>
                       <input type="number" placeholder="0.00" className="w-full bg-slate-50 border rounded-2xl p-4 text-sm font-bold outline-none" />
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12 space-y-4">
                    <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto text-emerald-600">
                      <Icons.resolved size={40} className="animate-bounce" />
                    </div>
                    <h4 className="text-xl font-black">Ticket Resolved!</h4>
                    <p className="text-sm text-slate-500">The citizen has been notified and the data is now live on the Transparency Dashboard.</p>
                  </div>
                )}
              </div>

              <div className="p-8 border-t bg-slate-50/50 flex justify-end">
                {resolutionStep === 1 ? (
                  <button
                    onClick={() => setResolutionStep(2)}
                    className="px-10 py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl"
                  >
                    Complete Closure
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      setIsResolving(false);
                      setResolutionStep(1);
                      setSelected(null);
                    }}
                    className="px-10 py-4 bg-emerald-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl"
                  >
                    Return to Board
                  </button>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
