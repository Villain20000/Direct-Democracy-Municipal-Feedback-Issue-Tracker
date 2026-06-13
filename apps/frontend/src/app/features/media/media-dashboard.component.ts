import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LayoutComponent } from '../../shared/layout.component';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-media-dashboard',
  standalone: true,
  imports: [CommonModule, LayoutComponent],
  template: `
    <app-layout
      pageTitle="Press Center"
      [navItems]="navItems"
      [notifCount]="0"
      (logout)="auth.logout()">

      <div style="background:linear-gradient(135deg,#4F46E5,#7C3AED);border-radius:var(--radius-xl);padding:28px;color:white;margin-bottom:24px;">
        <h2 style="font-size:22px;font-weight:800;">📰 Media & Press Dashboard</h2>
        <p style="opacity:0.8;font-size:13px;">Public statistics, trending issues, and downloadable reports for journalists</p>
        <div style="display:flex;gap:24px;margin-top:16px;">
          <div><div style="font-size:28px;font-weight:800;">{{ totalIssues }}</div><div style="opacity:0.7;font-size:12px;">Total Issues</div></div>
          <div><div style="font-size:28px;font-weight:800;">67%</div><div style="opacity:0.7;font-size:12px;">Resolution Rate</div></div>
          <div><div style="font-size:28px;font-weight:800;">2,340</div><div style="opacity:0.7;font-size:12px;">Active Citizens</div></div>
        </div>
      </div>

      <div class="content-grid">
        <div class="card">
          <div class="card-header"><h3>🔥 Trending Issues</h3></div>
          <div class="card-body">
            @for (issue of trendingIssues; track issue.title; let i = $index) {
              <div style="display:flex;gap:12px;padding:12px 0;border-bottom:1px solid var(--border-light);">
                <div style="width:28px;height:28px;border-radius:50%;background:var(--bg-primary);display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:800;color:var(--primary);">{{ i + 1 }}</div>
                <div style="flex:1;">
                  <div style="font-size:13px;font-weight:600;">{{ issue.title }}</div>
                  <div style="font-size:11px;color:var(--text-muted);">{{ issue.category }} · {{ issue.votes }} upvotes · {{ issue.views }} views</div>
                </div>
                <span class="badge" [class]="issue.badge">{{ issue.trend }}</span>
              </div>
            }
          </div>
        </div>
        <div class="card">
          <div class="card-header"><h3>📊 Public Statistics</h3></div>
          <div class="card-body">
            @for (stat of publicStats; track stat.label) {
              <div style="display:flex;align-items:center;gap:12px;margin-bottom:14px;">
                <span style="font-size:13px;width:140px;color:var(--text-secondary);">{{ stat.label }}</span>
                <div style="flex:1;background:var(--bg-primary);border-radius:4px;height:8px;">
                  <div [style.width.%]="stat.pct" [style.background]="stat.color" style="height:100%;border-radius:4px;"></div>
                </div>
                <span style="font-size:13px;font-weight:700;width:60px;text-align:right;">{{ stat.value }}</span>
              </div>
            }
          </div>
        </div>
      </div>

      <div class="card" style="margin-bottom:24px;">
        <div class="card-header"><h3>📥 Downloadable Reports</h3></div>
        <div class="card-body">
          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;">
            @for (report of downloads; track report.title) {
              <div style="padding:20px;border:1px solid var(--border);border-radius:var(--radius-lg);text-align:center;">
                <i class="material-icons-outlined" style="font-size:40px;color:var(--primary);">{{ report.icon }}</i>
                <div style="font-size:14px;font-weight:700;margin-top:12px;">{{ report.title }}</div>
                <div style="font-size:12px;color:var(--text-muted);margin:4px 0;">{{ report.desc }}</div>
                <div style="display:flex;gap:8px;justify-content:center;margin-top:12px;">
                  <button class="btn btn-primary btn-sm">📄 PDF</button>
                  <button class="btn btn-secondary btn-sm">📊 CSV</button>
                </div>
              </div>
            }
          </div>
        </div>
      </div>

      <div class="content-grid">
        <div class="card">
          <div class="card-header"><h3>📋 Press Releases</h3></div>
          <div class="card-body">
            @for (pr of pressReleases; track pr.title) {
              <div style="padding:14px;border-bottom:1px solid var(--border-light);">
                <div style="display:flex;justify-content:space-between;">
                  <strong style="font-size:13px;">{{ pr.title }}</strong>
                  <span style="font-size:11px;color:var(--text-muted);">{{ pr.date }}</span>
                </div>
                <p style="font-size:12px;color:var(--text-secondary);margin-top:4px;">{{ pr.summary }}</p>
              </div>
            }
          </div>
        </div>
        <div class="card">
          <div class="card-header"><h3>🗺 Geographic Overview</h3></div>
          <div class="card-body">
            <div style="height:240px;background:linear-gradient(135deg,#EEF2FF,#E0E7FF);border-radius:var(--radius);display:flex;align-items:center;justify-content:center;">
              <div style="text-align:center;background:rgba(255,255,255,0.9);padding:16px;border-radius:var(--radius-lg);">
                <i class="material-icons-outlined" style="font-size:48px;color:#4F46E5;">map</i>
                <div style="font-size:13px;font-weight:600;margin-top:8px;">Issue Heat Map</div>
                <div style="font-size:11px;color:var(--text-muted);">6 wards · 128 issues</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </app-layout>
  `,
})
export class MediaDashboardComponent {
  totalIssues = 128;
  trendingIssues = [
    { title: 'Water main break on Cedar Lane', category: 'Utilities', votes: 42, views: 312, trend: '↑ Hot', badge: 'badge-red' },
    { title: 'Large pothole on Main Street', category: 'Infrastructure', votes: 24, views: 156, trend: '↑ Rising', badge: 'badge-amber' },
    { title: 'Missing manhole cover', category: 'Infrastructure', votes: 38, views: 267, trend: '✓ Resolved', badge: 'badge-green' },
    { title: 'Illegal dumping in Riverside Park', category: 'Sanitation', votes: 8, views: 45, trend: '→ Stable', badge: 'badge-slate' },
    { title: 'Tree blocking sidewalk', category: 'Parks', votes: 19, views: 98, trend: '↑ Rising', badge: 'badge-amber' },
  ];
  publicStats = [
    { label: 'Infrastructure', pct: 75, value: '45', color: '#2563EB' },
    { label: 'Public Safety', pct: 50, value: '30', color: '#DC2626' },
    { label: 'Sanitation', pct: 40, value: '24', color: '#16A34A' },
    { label: 'Utilities', pct: 35, value: '21', color: '#7C3AED' },
    { label: 'Other', pct: 15, value: '8', color: '#64748B' },
  ];
  downloads = [
    { icon: 'assessment', title: 'Monthly Issue Report', desc: 'Complete issue summary for the month' },
    { icon: 'account_balance', title: 'Budget Transparency', desc: 'Department spending and allocations' },
    { icon: 'groups', title: 'Community Engagement', desc: 'Citizen participation statistics' },
  ];
  pressReleases = [
    { title: 'Emergency Water Main Repair Completed', date: 'Jun 12', summary: 'City crews successfully repaired the water main break on Cedar Lane. Service fully restored.' },
    { title: 'Summer Road Repair Program Begins', date: 'Jun 10', summary: 'DPW announces the start of the annual summer road repair program covering 15 miles.' },
    { title: 'Record Citizen Engagement in Q2', date: 'Jun 8', summary: 'Municipal platform sees 34% increase in citizen reports and feedback submissions.' },
  ];
  navItems = [
    { icon: 'dashboard', label: 'Overview', route: '/media' },
    { icon: 'trending_up', label: 'Trending', route: '/media/trending' },
    { icon: 'analytics', label: 'Statistics', route: '/media/stats' },
    { icon: 'download', label: 'Reports', route: '/media/reports' },
    { icon: 'map', label: 'Geographic', route: '/media/map' },
  ];
  constructor(public auth: AuthService) {}
}
