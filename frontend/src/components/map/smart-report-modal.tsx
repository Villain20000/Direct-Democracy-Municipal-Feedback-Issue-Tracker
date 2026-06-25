"use client";

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Icons } from '@/components/icons';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useApp } from '@/lib/store/app-context';

interface SmartReportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SmartReportModal({ isOpen, onClose }: SmartReportModalProps) {
  const { addIssue, issues } = useApp();
  const [step, setStep] = useState(1);
  const [file, setFile] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [duplicateCheck, setDuplicateCheck] = useState<{ detected: boolean, issue?: any } | null>(null);

  const [form, setForm] = useState({
    title: '',
    description: '',
    category: '',
    severity: 3,
    lat: 37.9750,
    lng: 23.7250
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setFile(event.target?.result as string);
        runAIAnalysis();
      };
      reader.readAsDataURL(selectedFile);
    }
  };

  const runAIAnalysis = () => {
    setAnalyzing(true);
    setTimeout(() => {
      setForm(prev => ({
        ...prev,
        category: 'Potholes',
        severity: 4,
        title: 'New Pothole Detected'
      }));
      setAnalyzing(false);
      setStep(2);
    }, 2500);
  };

  const checkDuplicates = (lat: number, lng: number) => {
    // Simple 15m check in mock (approx 0.00015 degrees)
    const existing = issues.find(i =>
      Math.abs(i.lat - lat) < 0.0002 &&
      Math.abs(i.lng - lng) < 0.0002 &&
      i.status !== 'resolved'
    );

    if (existing) {
      setDuplicateCheck({ detected: true, issue: existing });
    } else {
      setDuplicateCheck(null);
    }
  };

  const handleSubmit = () => {
    addIssue({
      ...form,
      image_url: file || 'https://images.unsplash.com/photo-1544921589-b94f61f73602?auto=format&fit=crop&q=80&w=800',
    });
    onClose();
    setStep(1);
    setFile(null);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-6 backdrop-blur-xl bg-slate-900/40 overflow-hidden">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-white w-full max-w-2xl rounded-[40px] shadow-2xl flex flex-col overflow-hidden max-h-[85vh]"
      >
        <header className="p-8 pb-4 flex justify-between items-center border-b">
          <div>
            <h2 className="text-2xl font-black text-slate-900">Smart Reporting</h2>
            <div className="flex gap-2 mt-2">
              {[1, 2, 3].map(s => (
                <div key={s} className={cn("h-1.5 w-8 rounded-full transition-all", step >= s ? "bg-blue-600" : "bg-slate-100")} />
              ))}
            </div>
          </div>
          <button onClick={onClose} className="p-3 hover:bg-slate-100 rounded-2xl transition-colors">
            <Icons.close size={24} className="text-slate-400" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto">
          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="p-8 space-y-6"
              >
                <div className="text-center space-y-4">
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="aspect-video bg-slate-50 border-2 border-dashed border-slate-200 rounded-[32px] flex flex-col items-center justify-center cursor-pointer hover:bg-slate-100 hover:border-blue-300 transition-all group relative overflow-hidden"
                  >
                    {file ? (
                      <>
                        <img src={file} className="absolute inset-0 w-full h-full object-cover" alt="Uploaded issue" />
                        {analyzing && (
                          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px] flex flex-col items-center justify-center">
                            <motion.div
                              initial={{ top: '0%' }}
                              animate={{ top: '100%' }}
                              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                              className="absolute left-0 right-0 h-1 bg-cyan-400 shadow-[0_0_20px_#22d3ee] z-10"
                            />
                            <Icons.ai className="text-cyan-400 animate-pulse mb-2" size={40} />
                            <p className="text-white font-bold text-sm tracking-widest uppercase">AI Scanning...</p>
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        <div className="w-16 h-16 bg-white rounded-2xl shadow-sm flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                          <Icons.camera size={32} className="text-blue-600" />
                        </div>
                        <p className="font-bold text-slate-900">Upload Issue Photo</p>
                        <p className="text-xs text-slate-400 mt-1">Drag and drop or click to browse</p>
                      </>
                    )}
                  </div>
                  <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept="image/*" />
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="p-8 space-y-6"
              >
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Issue Category</label>
                    <div className="flex gap-2 flex-wrap">
                      {['Potholes', 'Streetlights', 'Illegal Dumping', 'Green Spaces'].map(cat => (
                        <button
                          key={cat}
                          onClick={() => setForm(f => ({ ...f, category: cat }))}
                          className={cn(
                            "px-4 py-2 rounded-xl text-xs font-bold border transition-all",
                            form.category === cat ? "bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-100" : "bg-white text-slate-600 hover:bg-slate-50"
                          )}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Urgency Rank</label>
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map(v => (
                        <button
                          key={v}
                          onClick={() => setForm(f => ({ ...f, severity: v }))}
                          className={cn(
                            "flex-1 h-10 rounded-xl flex items-center justify-center font-bold text-sm transition-all",
                            form.severity === v ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-400"
                          )}
                        >
                          {v}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Description</label>
                  <textarea
                    value={form.description}
                    onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
                    placeholder="Provide more details about the issue..."
                    className="w-full bg-slate-50 border rounded-[24px] p-4 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 h-32"
                  />
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="p-8 space-y-6"
              >
                <div className="aspect-video bg-slate-100 rounded-[32px] overflow-hidden relative border-4 border-white shadow-xl">
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                    <div className="w-12 h-12 border-2 border-blue-500 rounded-full flex items-center justify-center bg-white/80 backdrop-blur-sm">
                      <div className="w-2 h-2 bg-blue-500 rounded-full animate-ping" />
                    </div>
                  </div>
                  <img src="https://images.unsplash.com/photo-1526312426976-f4d754fa9bd6?auto=format&fit=crop&q=80&w=1000" className="w-full h-full object-cover opacity-60" alt="Map picker location" />
                  <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-white px-4 py-2 rounded-xl shadow-lg flex items-center gap-2">
                    <Icons.pin size={14} className="text-blue-600" />
                    <span className="text-xs font-bold">Athens, Greece (Current Location)</span>
                  </div>
                </div>

                <AnimatePresence>
                  {duplicateCheck?.detected && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="bg-amber-50 border border-amber-200 p-4 rounded-2xl flex gap-4"
                    >
                      <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center flex-shrink-0">
                        <Icons.urgent className="text-amber-600" size={20} />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-amber-900">Hey neighbor! Possible Duplicate.</p>
                        <p className="text-[10px] text-amber-700 mt-0.5">
                          "{duplicateCheck.issue.title}" was already reported within 15 meters.
                        </p>
                        <button className="mt-2 text-[10px] font-black text-amber-900 underline flex items-center gap-1">
                          View and Upvote instead
                          <Icons.arrowRight size={10} />
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <footer className="p-8 border-t flex justify-between bg-slate-50/50">
          <button
            disabled={step === 1}
            onClick={() => setStep(s => s - 1)}
            className="flex items-center gap-2 px-6 py-3 rounded-2xl text-sm font-bold text-slate-400 hover:text-slate-900 disabled:opacity-0 transition-all"
          >
            <Icons.chevronLeft size={18} />
            Back
          </button>

          <button
            onClick={() => {
              if (step < 3) {
                if (step === 2) checkDuplicates(form.lat, form.lng);
                setStep(s => s + 1);
              } else {
                handleSubmit();
              }
            }}
            disabled={step === 1 && !file}
            className="flex items-center gap-2 px-8 py-4 rounded-2xl text-sm font-bold bg-blue-600 text-white shadow-xl shadow-blue-200 hover:bg-blue-700 transition-all active:scale-95 disabled:bg-slate-200 disabled:shadow-none"
          >
            {step === 3 ? 'File Official Report' : 'Next Step'}
            <Icons.arrowRight size={18} />
          </button>
        </footer>
      </motion.div>
    </div>
  );
}
