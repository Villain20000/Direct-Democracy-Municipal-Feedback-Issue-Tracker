import { Component, OnInit } from '@angular/core';
import { CommonModule, TitleCasePipe, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { LayoutComponent } from '../../shared/layout.component';
import { AuthService } from '../../core/services/auth.service';
import { ApiService } from '../../core/services/api.service';
import { DashboardStats, Issue } from '@dd/shared-types';

interface TrendingIssue {
  title: string;
  category: string;
  votes: number;
  views: number;
  trend: string;
  badge: string;
}

interface PublicStat {
  label: string;
  pct: number;
  value: string;
  color: string;
}

@Component({
  selector: 'app-media-dashboard',
  standalone: true,
  imports: [CommonModule, LayoutComponent, TitleCasePipe, DatePipe, RouterLink],
  template: `
    <app-layout
      pageTitle="Press Center"
      [navItems]="navItems"
      (logout)="auth.logout()">

      <div style="background:linear-gradient(135deg,#4F46E5,#7C3AED);border-radius:var(--radius-xl);padding:28px;color:white;margin-bottom:24px;">
        <h2 style="font-size:22px;font-weight:800;">📰 Media & Press Dashboard</h2>
        <p style="opacity:0.8;font-size:13px;">Public statistics, trending issues, and downloadable reports for journalists</p>
        <div style="display:flex;gap:24px;margin-top:16px;">
          <div><div style="font-size:28px;font-weight:800;">{{ totalIssues }}</div><div style="opacity:0.7;font-size:12px;">Total Issues</div></div>
          <div><div style="font-size:28px;font-weight:800;">{{ resolutionRate }}%</div><div style="opacity:0.7;font-size:12px;">Resolution Rate</div></div>
          <div><div style="font-size:28px;font-weight:800;">{{ activeCitizens | number }}</div><div style="opacity:0.7;font-size:12px;">Active Citizens</div></div>
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
            } @empty {
              <div style="text-align:center;padding:32px;color:var(--text-muted);">No trending issues found.</div>
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
                  <button type="button" class="btn btn-secondary btn-sm" (click)="downloadReport(report.type, report.filename)" [disabled]="exporting">📊 CSV</button>
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
                  <span style="font-size:11px;color:var(--text-muted);">{{ pr.date | date:'mediumDate' }}</span>
                </div>
                <p style="font-size:12px;color:var(--text-secondary);margin-top:4px;">{{ pr.summary }}</p>
              </div>
            }
          </div>
        </div>
        <div class="card">
          <div class="card-header">
            <h3>🗺 Geographic Overview</h3>
            <a routerLink="/media/map" class="btn btn-primary btn-sm">Open Map</a>
          </div>
          <div class="card-body">
            <div style="height:240px;background:linear-gradient(135deg,#EEF2FF,#E0E7FF);border-radius:var(--radius);display:flex;align-items:center;justify-content:center;">
              <div style="text-align:center;background:rgba(255,255,255,0.9);padding:16px;border-radius:var(--radius-lg);">
                <i class="material-icons-outlined" style="font-size:48px;color:#4F46E5;">map</i>
                <div style="font-size:13px;font-weight:600;margin-top:8px;">Issue Heat Map</div>
                <div style="font-size:11px;color:var(--text-muted);">{{ totalIssues }} issues tracked</div>
                <a routerLink="/media/map" class="btn btn-secondary btn-sm" style="margin-top:12px;">View Full Map</a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </app-layout>
  `,
})
export class MediaDashboardComponent implements OnInit {
  totalIssues = 0;
  resolutionRate = 0;
  activeCitizens = 0;
  trendingIssues: TrendingIssue[] = [];
  publicStats: PublicStat[] = [];
  downloads = [
    { icon: 'assessment', title: 'Monthly Issue Report', desc: 'Complete issue summary for the month', type: 'issues' as const, filename: 'monthly-issues-report.csv' },
    { icon: 'account_balance', title: 'Budget Transparency', desc: 'Department spending and allocations', type: 'issues' as const, filename: 'budget-transparency-issues.csv' },
    { icon: 'groups', title: 'Community Engagement', desc: 'Citizen participation statistics', type: 'issues' as const, filename: 'community-engagement-issues.csv' },
  ];
  pressReleases: Array<{ title: string; date: string; summary: string }> = [];
  exporting = false;
  navItems = [
    { icon: 'dashboard', label: 'Overview', route: '/media' },
    { icon: 'trending_up', label: 'Trending', route: '/media/trending' },
    { icon: 'analytics', label: 'Statistics', route: '/media/stats' },
    { icon: 'download', label: 'Reports', route: '/media/reports' },
    { icon: 'map', label: 'Geographic', route: '/media/map' },
  ];

  private readonly categoryColors: Record<string, string> = {
    INFRASTRUCTURE: '#2563EB', PUBLIC_SAFETY: '#DC2626', SANITATION: '#16A34A',
    UTILITIES: '#7C3AED', HOUSING: '#D97706', ENVIRONMENT: '#059669',
    TRANSPORTATION: '#0891B2', EDUCATION: '#4F46E5', HEALTH: '#E11D48', OTHER: '#64748B',
  };

  constructor(public auth: AuthService, private api: ApiService) {}

  ngOnInit() {
    this.api.getIssueStats().subscribe(res => {
      if (res.success) {
        const stats = res.data;
        this.totalIssues = stats.totalIssues;
        this.activeCitizens = stats.totalUsers;
        this.resolutionRate = stats.totalIssues > 0
          ? Math.round((stats.resolvedIssues / stats.totalIssues) * 100)
          : 0;
        this.buildPublicStats(stats);
      }
    });
    this.api.getAnnouncements({ pageSize: '5' }).subscribe((res: any) => {
      this.pressReleases = (res.data || []).map((a: any) => ({
        title: a.title,
        date: a.publishedAt || a.createdAt,
        summary: a.content?.slice(0, 120) + (a.content?.length > 120 ? '...' : ''),
      }));
    });

    this.api.getIssues({ sortBy: 'upvotes', pageSize: '5' }).subscribe((res: any) => {
      if (res.data) {
        this.trendingIssues = (res.data as Issue[]).map((issue, i) => ({
          title: issue.title,
          category: issue.category,
          votes: issue.upvotes,
          views: issue.viewCount,
          trend: issue.status === 'RESOLVED' || issue.status === 'VERIFIED' ? '✓ Resolved' : i < 2 ? '↑ Hot' : '↑ Rising',
          badge: issue.status === 'RESOLVED' || issue.status === 'VERIFIED' ? 'badge-green' : i < 2 ? 'badge-red' : 'badge-amber',
        }));
      }
    });
  }

  downloadReport(type: 'issues' | 'audit', filename = 'issues-export.csv') {
    this.exporting = true;
    const request = type === 'audit' ? this.api.exportAuditCsv() : this.api.exportIssuesCsv();
    request.subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
        this.exporting = false;
      },
      error: () => { this.exporting = false; },
    });
  }

  private buildPublicStats(stats: DashboardStats) {
    const entries = Object.entries(stats.issuesByCategory).filter(([, count]) => count > 0);
    const max = Math.max(...entries.map(([, count]) => count), 1);
    this.publicStats = entries.slice(0, 5).map(([cat, count]) => ({
      label: cat.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase()),
      pct: (count / max) * 100,
      value: String(count),
      color: this.categoryColors[cat] || '#64748B',
    }));
  }
}