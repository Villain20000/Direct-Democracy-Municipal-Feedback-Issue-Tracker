import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LayoutComponent } from '../../shared/layout.component';
import { AuthService } from '../../core/services/auth.service';
import { Issue } from '@dd/shared-types';

@Component({
  selector: 'app-ward-dashboard',
  standalone: true,
  imports: [CommonModule, LayoutComponent],
  template: `
    <app-layout
      pageTitle="Ward Dashboard"
      [navItems]="navItems"
      [notifCount]="2"
      (logout)="auth.logout()">

      <div style="background:linear-gradient(135deg,#0D9488,#0891B2);border-radius:var(--radius-xl);padding:28px;color:white;margin-bottom:24px;">
        <h2 style="font-size:22px;font-weight:800;">Ward 4 — Southgate District</h2>
        <p style="opacity:0.8;font-size:13px;">Representing 12,400 residents across 6 neighborhoods</p>
        <div style="display:flex;gap:24px;margin-top:16px;">
          <div><div style="font-size:28px;font-weight:800;">23</div><div style="opacity:0.7;font-size:12px;">Active Issues</div></div>
          <div><div style="font-size:28px;font-weight:800;">156</div><div style="opacity:0.7;font-size:12px;">Residents Engaged</div></div>
          <div><div style="font-size:28px;font-weight:800;">89%</div><div style="opacity:0.7;font-size:12px;">Response Rate</div></div>
        </div>
      </div>

      <div class="content-grid">
        <div class="card">
          <div class="card-header"><h3>🗺 Neighborhood Issues Map</h3></div>
          <div class="card-body">
            <div style="height:280px;background:linear-gradient(135deg,#E0F2FE,#DBEAFE);border-radius:var(--radius);display:flex;align-items:center;justify-content:center;position:relative;overflow:hidden;">
              <div style="position:absolute;inset:0;opacity:0.3;">
                @for (pin of mapPins; track pin.x) {
                  <div [style.left.%]="pin.x" [style.top.%]="pin.y" [style.background]="pin.color" style="position:absolute;width:12px;height:12px;border-radius:50%;border:2px solid white;box-shadow:0 2px 4px rgba(0,0,0,0.2);"></div>
                }
              </div>
              <div style="text-align:center;z-index:1;background:rgba(255,255,255,0.9);padding:16px 24px;border-radius:var(--radius-lg);">
                <i class="material-icons-outlined" style="font-size:48px;color:var(--primary);">map</i>
                <div style="font-size:13px;font-weight:600;margin-top:8px;">Interactive Heat Map</div>
                <div style="font-size:11px;color:var(--text-muted);">23 issues · 6 neighborhoods</div>
              </div>
            </div>
          </div>
        </div>
        <div class="card">
          <div class="card-header"><h3>📊 Issue Categories in Ward</h3></div>
          <div class="card-body">
            @for (cat of wardCategories; track cat.name) {
              <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;">
                <span style="font-size:13px;width:120px;color:var(--text-secondary);">{{ cat.name }}</span>
                <div style="flex:1;background:var(--bg-primary);border-radius:4px;height:8px;">
                  <div [style.width.%]="cat.pct" [style.background]="cat.color" style="height:100%;border-radius:4px;"></div>
                </div>
                <span style="font-size:13px;font-weight:700;width:30px;text-align:right;">{{ cat.count }}</span>
              </div>
            }
          </div>
        </div>
      </div>

      <div class="card" style="margin-bottom:24px;">
        <div class="card-header"><h3>Community Feedback Feed</h3></div>
        <div class="card-body">
          @for (fb of feedback; track fb.id) {
            <div style="display:flex;gap:12px;padding:14px;border:1px solid var(--border);border-radius:var(--radius);margin-bottom:10px;">
              <div style="width:36px;height:36px;border-radius:50%;background:var(--primary);color:white;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;">{{ fb.initials }}</div>
              <div style="flex:1;">
                <div style="display:flex;justify-content:space-between;">
                  <strong style="font-size:13px;">{{ fb.name }}</strong>
                  <span style="font-size:11px;color:var(--text-muted);">{{ fb.time }}</span>
                </div>
                <p style="font-size:13px;color:var(--text-secondary);margin-top:4px;">{{ fb.text }}</p>
                <div style="display:flex;gap:8px;margin-top:8px;"><span class="badge" [class]="fb.sentimentBadge">{{ fb.sentiment }}</span><span class="badge badge-slate">{{ fb.category }}</span></div>
              </div>
            </div>
          }
        </div>
      </div>

      <div class="card">
        <div class="card-header"><h3>🤝 Upcoming Community Events</h3></div>
        <div class="card-body">
          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;">
            @for (evt of events; track evt.title) {
              <div style="padding:16px;background:var(--bg-primary);border-radius:var(--radius);text-align:center;">
                <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;">{{ evt.month }}</div>
                <div style="font-size:24px;font-weight:800;color:var(--primary);">{{ evt.day }}</div>
                <div style="font-size:13px;font-weight:600;margin-top:4px;">{{ evt.title }}</div>
                <div style="font-size:11px;color:var(--text-muted);">{{ evt.time }}</div>
              </div>
            }
          </div>
        </div>
      </div>
    </app-layout>
  `,
})
export class WardDashboardComponent {
  mapPins = [
    { x: 20, y: 30, color: '#DC2626' }, { x: 45, y: 60, color: '#D97706' },
    { x: 70, y: 25, color: '#2563EB' }, { x: 30, y: 75, color: '#16A34A' },
    { x: 80, y: 50, color: '#DC2626' }, { x: 55, y: 40, color: '#D97706' },
  ];
  wardCategories = [
    { name: 'Infrastructure', count: 8, pct: 80, color: '#2563EB' },
    { name: 'Sanitation', count: 6, pct: 60, color: '#16A34A' },
    { name: 'Safety', count: 4, pct: 40, color: '#DC2626' },
    { name: 'Utilities', count: 3, pct: 30, color: '#7C3AED' },
    { name: 'Other', count: 2, pct: 20, color: '#64748B' },
  ];
  feedback = [
    { id: '1', name: 'Maria Gonzalez', initials: 'MG', time: '2h ago', text: 'The new crosswalk on 5th Street is much safer. Thank you for listening!', sentiment: 'Positive', sentimentBadge: 'badge-green', category: 'Infrastructure' },
    { id: '2', name: 'James Park', initials: 'JP', time: '5h ago', text: 'Still waiting on the recycling pickup for our block. It has been 3 weeks now.', sentiment: 'Negative', sentimentBadge: 'badge-red', category: 'Sanitation' },
    { id: '3', name: 'Angela Torres', initials: 'AT', time: '1d ago', text: 'Would love to see more lighting in the park area near the playground.', sentiment: 'Neutral', sentimentBadge: 'badge-slate', category: 'Safety' },
  ];
  events = [
    { title: 'Cleanup Day', month: 'Jul', day: '4', time: '8:00 AM' },
    { title: 'Town Hall', month: 'Jul', day: '10', time: '7:00 PM' },
    { title: 'Block Party', month: 'Jul', day: '18', time: '2:00 PM' },
  ];
  navItems = [
    { icon: 'dashboard', label: 'Overview', route: '/ward' },
    { icon: 'map', label: 'Ward Map', route: '/ward/map' },
    { icon: 'forum', label: 'Feedback', route: '/ward/feedback' },
    { icon: 'groups', label: 'Residents', route: '/ward/residents' },
    { icon: 'event', label: 'Events', route: '/ward/events' },
  ];
  constructor(public auth: AuthService) {}
}
