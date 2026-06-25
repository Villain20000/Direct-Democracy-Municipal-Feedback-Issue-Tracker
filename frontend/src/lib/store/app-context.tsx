"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';

export type IssueStatus = 'pending' | 'in-progress' | 'in-review' | 'resolved';

export interface Issue {
  id: string;
  title: string;
  description: string;
  category: string;
  status: IssueStatus;
  lat: number;
  lng: number;
  image_url: string;
  severity: number;
  upvotes: number;
  created_at: string;
  department: string;
  after_image_url?: string;
  resolution_time?: string; // in days
  cost?: number;
  team_size?: number;
  materials?: string[];
}

interface AppContextType {
  issues: Issue[];
  addIssue: (issue: Partial<Issue>) => void;
  upvoteIssue: (id: string) => void;
  role: 'citizen' | 'worker';
  setRole: (role: 'citizen' | 'worker') => void;
  currentView: 'map' | 'transparency' | 'budgeting';
  setCurrentView: (view: 'map' | 'transparency' | 'budgeting') => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [role, setRole] = useState<'citizen' | 'worker'>('citizen');
  const [currentView, setCurrentView] = useState<'map' | 'transparency' | 'budgeting'>('map');

  useEffect(() => {
    // Initial Seed Data
    const seed: Issue[] = [
      {
        id: '1',
        title: 'Deep Pothole on Ermou',
        description: 'Large pothole causing traffic slowdowns and potential bike accidents.',
        category: 'Potholes',
        status: 'pending',
        lat: 37.9765,
        lng: 23.7257,
        image_url: 'https://images.unsplash.com/photo-1544921589-b94f61f73602?auto=format&fit=crop&q=80&w=800',
        severity: 4,
        upvotes: 12,
        created_at: new Date().toISOString(),
        department: 'Infrastructure'
      },
      {
        id: '2',
        title: 'Flickering Streetlight',
        description: 'Streetlight has been flickering for 3 days near Monastiraki square.',
        category: 'Streetlights',
        status: 'in-progress',
        lat: 37.9761,
        lng: 23.7262,
        image_url: 'https://images.unsplash.com/photo-1517646287270-a5a9ca602e5c?auto=format&fit=crop&q=80&w=800',
        severity: 2,
        upvotes: 5,
        created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
        department: 'Public Lighting'
      },
      {
        id: '3',
        title: 'Overgrown park bushes',
        description: 'Bushes in the small park are blocking the sidewalk.',
        category: 'Green Spaces',
        status: 'in-review',
        lat: 37.9780,
        lng: 23.7230,
        image_url: 'https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?auto=format&fit=crop&q=80&w=800',
        after_image_url: 'https://images.unsplash.com/photo-1598902108854-10e335adac99?auto=format&fit=crop&q=80&w=800',
        severity: 1,
        upvotes: 2,
        created_at: new Date(Date.now() - 86400000 * 10).toISOString(),
        department: 'Parks & Recreation',
        resolution_time: '2 days',
        cost: 450,
        team_size: 3,
        materials: ['Asphalt Patch', 'Safety Cones']
      },
      {
        id: '4',
        title: 'Illegal Dumping near Omonia',
        description: 'Large amount of construction waste dumped on the pavement.',
        category: 'Illegal Dumping',
        status: 'resolved',
        lat: 37.9840,
        lng: 23.7280,
        image_url: 'https://images.unsplash.com/photo-1611284446314-60a58ac0deb9?auto=format&fit=crop&q=80&w=800',
        after_image_url: 'https://images.unsplash.com/photo-1532996122724-e3c354a0b15b?auto=format&fit=crop&q=80&w=800',
        severity: 5,
        upvotes: 45,
        created_at: new Date(Date.now() - 86400000 * 15).toISOString(),
        department: 'Sanitation',
        resolution_time: '3 days',
        cost: 1200,
        team_size: 5,
        materials: ['Heavy Duty Loader', 'Disposal Fees']
      }
    ];
    setIssues(seed);
  }, []);

  const addIssue = (issue: Partial<Issue>) => {
    const newIssue: Issue = {
      id: Math.random().toString(36).substr(2, 9),
      title: issue.title || 'New Issue',
      description: issue.description || '',
      category: issue.category || 'Other',
      status: 'pending',
      lat: issue.lat || 37.975,
      lng: issue.lng || 23.725,
      image_url: issue.image_url || '',
      severity: issue.severity || 1,
      upvotes: 0,
      created_at: new Date().toISOString(),
      department: 'General Services',
      ...issue
    };
    setIssues(prev => [newIssue, ...prev]);
  };

  const upvoteIssue = (id: string) => {
    setIssues(prev => prev.map(i => i.id === id ? { ...i, upvotes: i.upvotes + 1 } : i));
  };

  return (
    <AppContext.Provider value={{ issues, addIssue, upvoteIssue, role, setRole, currentView, setCurrentView }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
};
