"use client";

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import 'leaflet/dist/leaflet.css';
import { useApp } from '@/lib/store/app-context';
import { Icons } from '@/components/icons';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

// Lazy load map to avoid SSR issues
const MapContainer = dynamic(() => import('react-leaflet').then(mod => mod.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import('react-leaflet').then(mod => mod.TileLayer), { ssr: false });
const Marker = dynamic(() => import('react-leaflet').then(mod => mod.Marker), { ssr: false });

export default function LiveMap() {
  const { issues, upvoteIssue } = useApp();
  const [selected, setSelected] = useState<any>(null);
  const [L, setL] = useState<any>(null);

  useEffect(() => {
    import('leaflet').then(leaflet => {
      // Fix default marker icon issues in Next.js
      delete (leaflet.Icon.Default.prototype as any)._getIconUrl;
      leaflet.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
      });
      setL(leaflet);
    });
  }, []);

  if (!L) return (
    <div className="h-full w-full bg-slate-50 flex items-center justify-center">
       <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Initializing Map...</p>
       </div>
    </div>
  );

  const customIcon = (status: string) => {
    const color = status === 'resolved' ? '#10b981' : status === 'in-progress' ? '#f59e0b' : '#ef4444';
    return L.divIcon({
      className: 'custom-pin',
      html: `<div style="background-color: ${color}; width: 16px; height: 16px; border-radius: 50%; border: 3px solid white; box-shadow: 0 4px 12px rgba(0,0,0,0.3); transition: all 0.2s transform: scale(1);" onmouseover="this.style.transform='scale(1.2)'" onmouseout="this.style.transform='scale(1)'"></div>`,
      iconSize: [16, 16],
      iconAnchor: [8, 8],
    });
  };

  return (
    <div className="relative h-full w-full overflow-hidden flex">
      <div className="flex-1 relative">
        <MapContainer
          center={[37.9765, 23.7257]}
          zoom={15}
          className="h-full w-full z-0"
          zoomControl={false}
        >
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          />
          {issues.map(issue => (
            <Marker
              key={issue.id}
              position={[issue.lat, issue.lng]}
              icon={customIcon(issue.status)}
              eventHandlers={{
                click: () => setSelected(issue),
              }}
            />
          ))}
        </MapContainer>

        <div className="absolute top-8 left-8 z-10 flex flex-col gap-4">
          <div className="bg-white/80 backdrop-blur-xl border border-slate-200/50 p-1.5 rounded-[20px] flex gap-1 shadow-2xl">
            {['All', 'Potholes', 'Lighting', 'Waste', 'Safety'].map(cat => (
              <button key={cat} className="px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-white hover:shadow-md transition-all active:scale-95 text-slate-600 hover:text-slate-900">
                {cat}
              </button>
            ))}
          </div>

          <div className="flex gap-2">
            <div className="bg-white/80 backdrop-blur-xl border border-slate-200/50 p-3 rounded-2xl shadow-xl flex items-center gap-3">
               <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
               <span className="text-[10px] font-black uppercase tracking-tighter text-slate-900">Live Sync Active</span>
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {selected && (
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="w-[450px] border-l bg-white flex flex-col h-full shadow-2xl relative z-20"
          >
            <div className="p-8 border-b flex justify-between items-center bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center text-white">
                  <Icons.pin size={20} />
                </div>
                <div>
                  <h3 className="font-black text-xl text-slate-900">Issue Detail</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Ticket #{selected.id}</p>
                </div>
              </div>
              <button onClick={() => setSelected(null)} className="p-3 hover:bg-slate-100 rounded-2xl transition-colors">
                <Icons.close size={24} className="text-slate-400" />
              </button>
            </div>

            <ScrollArea className="flex-1">
              <div className="p-8 space-y-8">
                <div className="relative group">
                   <img src={selected.image_url} alt={`Photo of ${selected.title}`} className="w-full aspect-video object-cover rounded-[32px] shadow-2xl border-4 border-slate-50 transition-transform group-hover:scale-[1.02]" />
                   <div className="absolute top-4 right-4">
                      <Badge variant="outline" className="bg-white/90 backdrop-blur-md shadow-lg border-0 py-1.5 px-4 font-black text-slate-900 uppercase tracking-widest text-[10px]">
                        {selected.category}
                      </Badge>
                   </div>
                </div>

                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-blue-600 font-black text-[11px] bg-blue-50 px-4 py-1.5 rounded-full uppercase tracking-widest">
                      <Icons.ai size={14} />
                      AI Severity: {selected.severity}/5
                    </div>
                    <span className="text-xs font-bold text-slate-400">{new Date(selected.created_at).toLocaleDateString()}</span>
                  </div>

                  <div>
                    <h2 className="text-3xl font-black text-slate-900 leading-[1.1]">{selected.title}</h2>
                    <p className="text-slate-500 mt-4 leading-relaxed font-medium text-sm">{selected.description}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-5 bg-slate-50 rounded-[24px] border border-slate-100">
                      <p className="text-[10px] uppercase font-black text-slate-400 tracking-widest mb-1">Status</p>
                      <div className="flex items-center gap-2">
                         <div className={cn(
                           "w-2 h-2 rounded-full",
                           selected.status === 'resolved' ? "bg-emerald-500" : selected.status === 'in-progress' ? "bg-amber-500" : "bg-rose-500"
                         )} />
                         <p className="text-xs font-black text-slate-900 uppercase tracking-tight">{selected.status.replace('-', ' ')}</p>
                      </div>
                    </div>
                    <div className="p-5 bg-slate-50 rounded-[24px] border border-slate-100">
                      <p className="text-[10px] uppercase font-black text-slate-400 tracking-widest mb-1">Department</p>
                      <p className="text-xs font-black text-slate-900 uppercase tracking-tight">{selected.department}</p>
                    </div>
                  </div>
                </div>
              </div>
            </ScrollArea>

            <div className="p-8 border-t bg-slate-50/50 flex flex-col gap-4">
              <div className="flex gap-4">
                <button
                  onClick={() => upvoteIssue(selected.id)}
                  className="flex-1 py-4 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 shadow-xl shadow-blue-200 hover:bg-blue-700 transition-all active:scale-95"
                >
                  Upvote Awareness
                  <span className="bg-blue-500 px-3 py-1 rounded-lg text-[10px] font-black">{selected.upvotes}</span>
                </button>
                <button className="w-16 h-16 bg-white border border-slate-200 rounded-2xl flex items-center justify-center text-slate-400 hover:text-slate-900 transition-colors shadow-sm">
                   <Icons.shieldCheck size={24} />
                </button>
              </div>
              <button className="w-full py-4 bg-white border-2 border-slate-200 text-slate-900 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-slate-50 transition-all active:scale-95">
                <Icons.pending size={16} />
                Subscribe to Updates
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
