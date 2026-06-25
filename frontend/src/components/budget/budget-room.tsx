"use client";

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Icons } from '@/components/icons';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

const BUDGET_CEILING = 500000;

interface BudgetCategory {
  id: string;
  name: string;
  description: string;
  icon: any;
  color: string;
  allocation: number;
}

export default function ParticipatoryBudgetingRoom() {
  const [categories, setCategories] = useState<BudgetCategory[]>([
    { id: 'roads', name: 'Road Improvements', description: 'Pothole repair, repaving, and bike lanes.', icon: Icons.map, color: 'bg-blue-500', allocation: 150000 },
    { id: 'green', name: 'Public Parks & Greenery', description: 'Tree planting, park maintenance, and irrigation.', icon: Icons.activity, color: 'bg-emerald-500', allocation: 100000 },
    { id: 'infra', name: 'EV & Smart Infrastructure', description: 'Charging stations and smart lighting.', icon: Icons.zap, color: 'bg-indigo-500', allocation: 100000 },
    { id: 'safety', name: 'Public Safety', description: 'Improved lighting and pedestrian crossings.', icon: Icons.shieldCheck, color: 'bg-amber-500', allocation: 100000 },
    { id: 'waste', name: 'Waste Management', description: 'Smart bins and collection optimization.', icon: Icons.database, color: 'bg-rose-500', allocation: 50000 },
  ]);

  const totalAllocated = categories.reduce((sum, cat) => sum + cat.allocation, 0);
  const remaining = BUDGET_CEILING - totalAllocated;
  const isOverBudget = remaining < 0;

  const handleSliderChange = (id: string, value: number) => {
    setCategories(prev => prev.map(cat => {
      if (cat.id === id) return { ...cat, allocation: value };
      return cat;
    }));
  };

  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = () => {
    if (isOverBudget) return;
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 3000);
  };

  return (
    <div className="h-full flex flex-col bg-slate-50 overflow-hidden">
      <header className="p-8 pb-4">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Participatory Budgeting</h1>
            <p className="text-slate-500 mt-1 font-medium italic">Shape the future of our municipality together.</p>
          </div>
          <div className="bg-slate-900 rounded-2xl p-4 shadow-xl flex items-center gap-6 text-white min-w-[300px]">
            <div className="flex-1">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Budget Pool</p>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black">€{remaining.toLocaleString()}</span>
                <span className="text-xs text-slate-400">remaining</span>
              </div>
            </div>
            <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center">
              <Icons.euro className="text-white" size={24} />
            </div>
          </div>
        </div>

        <div className="h-4 bg-slate-200 rounded-full overflow-hidden flex shadow-inner">
          {categories.map(cat => (
            <motion.div
              key={cat.id}
              initial={false}
              animate={{ width: `${(cat.allocation / BUDGET_CEILING) * 100}%` }}
              className={cn("h-full", cat.color)}
            />
          ))}
          {remaining > 0 && <div className="h-full bg-white flex-1" />}
        </div>
      </header>

      <ScrollArea className="flex-1 px-8 pb-8 mt-4">
        <div className="max-w-4xl mx-auto space-y-4">
          {categories.map((category, idx) => (
            <motion.div
              key={category.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.1 }}
              className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-all group"
            >
              <div className="flex items-center gap-6">
                <div className={cn("w-16 h-16 rounded-2xl flex items-center justify-center text-white shadow-lg", category.color)}>
                  <category.icon size={28} />
                </div>
                <div className="flex-1">
                  <div className="flex justify-between items-start mb-1">
                    <h4 className="font-bold text-lg text-slate-900">{category.name}</h4>
                    <span className="font-black text-xl text-slate-900">€{category.allocation.toLocaleString()}</span>
                  </div>
                  <p className="text-sm text-slate-500 mb-6">{category.description}</p>

                  <div className="relative pt-1">
                    <input
                      type="range"
                      min="0"
                      max={BUDGET_CEILING}
                      step="5000"
                      value={category.allocation}
                      onChange={(e) => handleSliderChange(category.id, parseInt(e.target.value))}
                      className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-slate-900"
                    />
                    <div className="flex justify-between mt-2">
                      <span className="text-[10px] font-bold text-slate-400">€0</span>
                      <span className="text-[10px] font-bold text-slate-400">€{BUDGET_CEILING.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </ScrollArea>

      <footer className="p-8 border-t bg-white flex items-center justify-between">
        <div className="flex items-center gap-4 text-sm text-slate-500 font-medium">
          <Icons.users size={18} className="text-slate-400" />
          <span>1,429 citizens have voted so far</span>
        </div>

        <button
          onClick={handleSubmit}
          disabled={isOverBudget || submitted}
          className={cn(
            "px-10 py-4 rounded-2xl font-bold text-white shadow-xl transition-all active:scale-95 flex items-center gap-3",
            isOverBudget ? "bg-rose-500 opacity-50 cursor-not-allowed" :
            submitted ? "bg-emerald-500" : "bg-slate-900 hover:bg-slate-800"
          )}
        >
          {submitted ? (
            <>
              <Icons.resolved size={20} />
              Vote Submitted!
            </>
          ) : isOverBudget ? (
            <>
              <Icons.urgent size={20} />
              Over Budget Limit
            </>
          ) : (
            <>
              <Icons.arrowRight size={20} />
              Submit My Budget Vote
            </>
          )}
        </button>
      </footer>
    </div>
  );
}
