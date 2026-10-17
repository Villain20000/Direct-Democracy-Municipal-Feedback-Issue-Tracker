import { Component, OnInit, inject } from '@angular/core';
import { CommonModule, TitleCasePipe, DatePipe, CurrencyPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { LayoutComponent } from '../../shared/layout.component';
import { AuthService } from '../../core/services/auth.service';
import { ApiService, BudgetOverviewRow } from '../../core/services/api.service';
import { TranslationService } from '../../core/i18n/translation.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { DashboardStats, Issue } from '@dd/shared-types';
import { ActivityFeedComponent } from '../../shared/activity-feed.component';
import { CivicScoreComponent } from '../../shared/civic-score.component';
import { HeatMapPreviewComponent } from '../shared/heat-map-preview.component';
import { ChartComponent } from '../shared/chart.component';

interface TrendingIssue {
  id: string;
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

interface AiTrend {
  topic: string;
  frequency: number;
  ward: string;
  urgency: string;
}

@Component({
  selector: 'app-media-dashboard',
  standalone: true,
  imports: [CommonModule, LayoutComponent, TitleCasePipe, DatePipe, CurrencyPipe, RouterLink, TranslatePipe, ActivityFeedComponent, CivicScoreComponent, HeatMapPreviewComponent, ChartComponent],
  template: `
    <app-layout
      [pageTitle]="i18n.t('media.pageTitle')"
      [navItems]="navItems"
      (logout)="auth.logout()">

      <div style="background:linear-gradient(135deg,#4F46E5,#7C3AED);border-radius:var(--radius-xl);padding:28px;color:white;margin-bottom:24px;">
        <h2 style="font-size:22px;font-weight:800;">{{ 'media.heroTitle' | t }}</h2>
        <p style="opacity:0.8;font-size:13px;">{{ 'media.heroSubtitle' | t }}</p>
        <div style="display:flex;gap:24px;margin-top:16px;">
          <div><div style="font-size:28px;font-weight:800;">{{ totalIssues }}</div><div style="opacity:0.7;font-size:12px;">{{ 'media.totalIssues' | t }}</div></div>
          <div><div style="font-size:28px;font-weight:800;">{{ resolutionRate }}%</div><div style="opacity:0.7;font-size:12px;">{{ 'media.resolutionRate' | t }}</div></div>
          <div><div style="font-size:28px;font-weight:800;">{{ activeCitizens | number }}</div><div style="opacity:0.7;font-size:12px;">{{ 'media.activeCitizens' | t }}</div></div>
        </div>
      </div>

      <div class="content-grid">
        <app-activity-feed [limit]="6" />
        <app-civic-score [userId]="auth.user()?.id" />
      </div>

      <div class="card" style="margin-bottom:24px;" data-testid="media-ai-trends">
        <div class="card-header"><h3>{{ 'media.aiTrendsTitle' | t }}</h3></div>
        <div class="card-body">
          @if (aiTrendsLoading && !aiTrends.length) {
            <p style="font-size:13px;color:var(--text-muted);">{{ 'media.loadingTrends' | t }}</p>
          } @else if (aiTrends.length) {
            @for (trend of aiTrends; track trend.topic) {
              <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--border-light);">
                <div>
                  <div style="font-size:13px;font-weight:600;">{{ trend.topic }}</div>
                  <div style="font-size:11px;color:var(--text-muted);">{{ i18n.t('media.trendMeta', { n: trend.frequency, ward: trend.ward }) }}</div>
                </div>
                <span class="badge badge-amber">{{ trend.urgency }}</span>
              </div>
            }
          } @else {
            <p style="font-size:13px;color:var(--text-muted);">{{ 'media.noAiTrends' | t }}</p>
          }
        </div>
      </div>

      <div class="content-grid">
        <div class="card">
          <div class="card-header" style="display:flex;justify-content:space-between;align-items:center;">
            <h3>{{ 'media.trendingTitle' | t }}</h3>
            <a routerLink="/media/trending" class="btn btn-secondary btn-sm">{{ 'common.viewAll' | t }}</a>
          </div>
          <div class="card-body">
            @for (issue of trendingIssues; track issue.title; let i = $index) {
              <a [routerLink]="['/issues', issue.id]" style="display:flex;gap:12px;padding:12px 0;border-bottom:1px solid var(--border-light);text-decoration:none;color:inherit;transition:background 0.2s;">
                <div style="width:28px;height:28px;border-radius:50%;background:var(--bg-primary);display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:800;color:var(--primary);">{{ i + 1 }}</div>
                <div style="flex:1;">
                  <div style="font-size:13px;font-weight:600;">{{ issue.title }}</div>
                  <div style="font-size:11px;color:var(--text-muted);">{{ i18n.tCategory(issue.category) }} · {{ issue.votes }} {{ 'issues.upvotes' | t }} · {{ issue.views }} {{ 'detail.views' | t }}</div>
                </div>
                <span class="badge" [class]="issue.badge">{{ issue.trend }}</span>
              </a>
            } @empty {
              <div style="text-align:center;padding:32px;color:var(--text-muted);">{{ 'media.noTrending' | t }}</div>
            }
          </div>
        </div>
        <div class="card">
          <div class="card-header"><h3>{{ 'media.publicStats' | t }}</h3></div>
          <div class="card-body">
            @for (stat of publicStats; track stat.label) {
              <div style="display:flex;align-items:center;gap:12px;margin-bottom:14px;">
                <span style="font-size:13px;width:140px;color:var(--text-secondary);">{{ i18n.tCategory(stat.label) }}</span>
                <div style="flex:1;background:var(--bg-primary);border-radius:4px;height:8px;">
                  <div [style.width.%]="stat.pct" [style.background]="stat.color" style="height:100%;border-radius:4px;"></div>
                </div>
                <span style="font-size:13px;font-weight:700;width:60px;text-align:right;">{{ stat.value }}</span>
              </div>
            }
          </div>
        </div>
      </div>

      <div class="card" style="margin-bottom:24px;" data-testid="media-historical-comparison">
        <div class="card-header"><h3>{{ 'media.historicalComparison' | t }}</h3></div>
        <div class="card-body">
          @if (comparisonLabels.length) {
            <app-chart
              kind="bar"
              [labels]="comparisonLabels"
              [data]="comparisonCreated"
              [data2]="comparisonResolved"
              [datasetLabel]="i18n.t('media.comparisonCreated')"
              [datasetLabel2]="i18n.t('media.comparisonResolved')"
              [height]="220" />
          } @else {
            <p style="color:var(--text-muted);font-size:13px;">{{ 'media.historicalComparisonEmpty' | t }}</p>
          }
        </div>
      </div>

      <div class="card" style="margin-bottom:24px;" data-testid="media-minutes-archive">
        <div class="card-header"><h3>{{ 'media.minutesTitle' | t }}</h3></div>
        <div class="card-body">
          @if (minutesLoading && !meetingMinutes.length) {
            <p style="font-size:13px;color:var(--text-muted);">{{ 'media.loadingTrends' | t }}</p>
          } @else if (meetingMinutes.length) {
            @for (m of meetingMinutes; track m.id) {
              <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--border-light);">
                <div>
                  <div style="font-size:13px;font-weight:600;">{{ m.title }}</div>
                  <div style="font-size:11px;color:var(--text-muted);">{{ m.date | date:'mediumDate' }}@if (m.organizer) { · {{ i18n.t('media.minutesBy', { name: m.organizer }) }} }</div>
                </div>
                <span class="badge badge-blue">{{ i18n.t('media.minutesRsvps', { n: m.attendees }) }}</span>
              </div>
            }
          } @else {
            <p style="font-size:13px;color:var(--text-muted);">{{ 'media.minutesEmpty' | t }}</p>
          }
        </div>
      </div>

      <div class="card" style="margin-bottom:24px;" data-testid="media-api-rss">
        <div class="card-header"><h3>{{ 'media.apiRssTitle' | t }}</h3><a routerLink="/portal" class="btn btn-secondary btn-sm">{{ 'media.apiRssPortal' | t }}</a></div>
        <div class="card-body">
          <p style="font-size:13px;color:var(--text-secondary);margin-bottom:12px;">{{ 'media.apiRssDesc' | t }}</p>
          <ul style="font-size:12px;font-family:monospace;color:var(--text-secondary);margin:0 0 12px 18px;display:grid;gap:6px;">
            <li>GET /api/v1/portal/announcements</li>
            <li>GET /api/v1/portal/meetings</li>
            <li>GET /api/v1/portal/events/upcoming</li>
            <li>GET /api/v1/portal/issues/recent</li>
          </ul>
          <p style="font-size:12px;color:var(--text-muted);">{{ 'media.apiRssBulk' | t }}</p>
        </div>
      </div>

      <div class="card" style="margin-bottom:24px;" data-testid="media-budget-transparency">
        <div class="card-header" style="display:flex;justify-content:space-between;align-items:center;">
          <h3>{{ 'media.budgetTransparency' | t }}</h3>
          <button type="button" class="btn btn-secondary btn-sm" (click)="downloadExpensesCsv()" [disabled]="exporting">{{ 'media.csv' | t }}</button>
        </div>
        <div class="card-body">
          @if (budgetOverview.length) {
            <div style="display:flex;gap:24px;margin-bottom:12px;">
              <div><div style="font-size:20px;font-weight:800;">{{ budgetTotal | currency:'USD':'symbol':'1.0-0' }}</div><div style="font-size:12px;color:var(--text-muted);">{{ 'media.budgetAllocated' | t }}</div></div>
              <div><div style="font-size:20px;font-weight:800;">{{ budgetSpent | currency:'USD':'symbol':'1.0-0' }}</div><div style="font-size:12px;color:var(--text-muted);">{{ 'media.budgetSpent' | t }}</div></div>
            </div>
            @for (row of budgetOverview.slice(0, 5); track row.departmentId) {
              <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px;">
                <span style="font-size:13px;width:170px;color:var(--text-secondary);">{{ row.name }}</span>
                <div style="flex:1;background:var(--bg-primary);border-radius:4px;height:8px;">
                  <div [style.width.%]="row.pctUsed" style="height:100%;border-radius:4px;background:var(--primary);"></div>
                </div>
                <span style="font-size:13px;font-weight:700;width:110px;text-align:right;">{{ row.spent | currency:'USD':'symbol':'1.0-0' }}</span>
              </div>
            }
          } @else {
            <p style="color:var(--text-muted);font-size:13px;">{{ 'media.budgetEmpty' | t }}</p>
          }
        </div>
      </div>

      <div class="card" style="margin-bottom:24px;">
        <div class="card-header"><h3>{{ 'media.downloads' | t }}</h3></div>
        <div class="card-body">
          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;">
            @for (report of downloads; track report.titleKey) {
              <div style="padding:20px;border:1px solid var(--border);border-radius:var(--radius-lg);text-align:center;">
                <i class="material-icons-outlined" style="font-size:40px;color:var(--primary);">{{ report.icon }}</i>
                <div style="font-size:14px;font-weight:700;margin-top:12px;">{{ i18n.t(report.titleKey) }}</div>
                <div style="font-size:12px;color:var(--text-muted);margin:4px 0;">{{ i18n.t(report.descKey) }}</div>
                <div style="display:flex;gap:8px;justify-content:center;margin-top:12px;">
                  <button type="button" class="btn btn-secondary btn-sm" (click)="downloadReport(report.type, report.filename)" [disabled]="exporting">{{ 'media.csv' | t }}</button>
                  <button type="button" class="btn btn-secondary btn-sm" data-testid="media-report-pdf-btn" (click)="downloadReportPdf(report.filename)" [disabled]="exporting">{{ 'media.pdf' | t }}</button>
                </div>
              </div>
            }
          </div>
        </div>
      </div>

      <div class="content-grid">
        <div class="card">
          <div class="card-header" style="display:flex;justify-content:space-between;align-items:center;">
            <h3>{{ 'media.pressReleases' | t }}</h3>
            <a routerLink="/media/reports" class="btn btn-secondary btn-sm">{{ 'common.viewAll' | t }}</a>
          </div>
          <div class="card-body">
            @for (pr of pressReleases; track pr.title) {
              <a routerLink="/media/reports" style="display:block;padding:14px;border-bottom:1px solid var(--border-light);text-decoration:none;color:inherit;transition:background 0.2s;">
                <div style="display:flex;justify-content:space-between;">
                  <strong style="font-size:13px;">{{ pr.title }}</strong>
                  <span style="font-size:11px;color:var(--text-muted);">{{ pr.date | date:'mediumDate' }}</span>
                </div>
                <p style="font-size:12px;color:var(--text-secondary);margin-top:4px;">{{ pr.summary }}</p>
                <div style="font-size:11px;color:var(--primary);margin-top:4px;">{{ 'media.readMore' | t }}</div>
              </a>
            } @empty {
              <div style="text-align:center;padding:24px;color:var(--text-muted);">{{ 'media.noReleases' | t }}</div>
            }
          </div>
        </div>
        <div class="card">
          <div class="card-header">
            <h3>{{ 'media.geoTitle' | t }}</h3>
            <a routerLink="/media/map" class="btn btn-primary btn-sm">{{ 'media.openMap' | t }}</a>
          </div>
          <div class="card-body">
            <app-heat-map-preview linkRoute="/media/map" [height]="240" />
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
    { icon: 'assessment', titleKey: 'media.monthlyReport', descKey: 'media.monthlyDesc', type: 'issues' as const, filename: 'monthly-issues-report.csv' },
    { icon: 'account_balance', titleKey: 'media.budgetTransparency', descKey: 'media.budgetDesc', type: 'expenses' as const, filename: 'budget-transparency-expenses.csv' },
    { icon: 'groups', titleKey: 'media.community', descKey: 'media.communityDesc', type: 'issues' as const, filename: 'community-engagement-issues.csv' },
  ];
  /** P1-9 — real budget numbers for the Budget Transparency card. */
  budgetOverview: BudgetOverviewRow[] = [];
  budgetTotal = 0;
  budgetSpent = 0;
  pressReleases: Array<{ title: string; date: string; summary: string }> = [];
  aiTrends: AiTrend[] = [];
  aiTrendsLoading = false;
  exporting = false;
  /** Weekly created-vs-resolved series for the historical comparison chart. */
  comparisonLabels: string[] = [];
  comparisonCreated: number[] = [];
  comparisonResolved: number[] = [];
  /** P2-19 — meeting-minutes archive (past public council meetings / hearings). */
  meetingMinutes: Array<{ id: string; title: string; date: string; attendees: number; organizer: string }> = [];
  minutesLoading = false;
  navItems = [
    { icon: 'dashboard', label: 'nav.overview', route: '/media' },
    { icon: 'trending_up', label: 'nav.trending', route: '/media/trending' },
    { icon: 'analytics', label: 'nav.statistics', route: '/media/stats' },
    { icon: 'download', label: 'nav.reports', route: '/media/reports' },
    { icon: 'map', label: 'nav.map', route: '/media/map' },
  ] as any;

  private readonly categoryColors: Record<string, string> = {
    INFRASTRUCTURE: '#2563EB', PUBLIC_SAFETY: '#DC2626', SANITATION: '#16A34A',
    UTILITIES: '#7C3AED', HOUSING: '#D97706', ENVIRONMENT: '#059669',
    TRANSPORTATION: '#0891B2', EDUCATION: '#4F46E5', HEALTH: '#E11D48', OTHER: '#64748B',
  };

  auth = inject(AuthService);
  api = inject(ApiService);
  i18n = inject(TranslationService);

  ngOnInit() {
    this.loadAiTrends();
    this.loadBudgetOverview();
    this.loadMeetingMinutes();
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
    this.api.getIssueTrends(8).subscribe({
      next: (res) => {
        if (!res.success || !res.data?.length) return;
        this.comparisonLabels = res.data.map((b) => b.weekStart.slice(5)); // MM-DD
        this.comparisonCreated = res.data.map((b) => b.created);
        this.comparisonResolved = res.data.map((b) => b.resolved);
      },
      error: () => {},
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
          id: issue.id,
          title: issue.title,
          category: issue.category,
          votes: issue.upvotes,
          views: issue.viewCount,
          trend: issue.status === 'RESOLVED' || issue.status === 'VERIFIED' ? this.i18n.t('media.trendResolved') : i < 2 ? this.i18n.t('media.trendHot') : this.i18n.t('media.trendRising'),
          badge: issue.status === 'RESOLVED' || issue.status === 'VERIFIED' ? 'badge-green' : i < 2 ? 'badge-red' : 'badge-amber',
        }));
      }
    });
  }

  downloadReport(type: 'issues' | 'audit' | 'expenses', filename = 'issues-export.csv') {
    this.exporting = true;
    const request = type === 'audit' ? this.api.exportAuditCsv()
      : type === 'expenses' ? this.api.exportExpensesCsv()
      : this.api.exportIssuesCsv();
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

  /** P1-9 — real expenditure CSV for the Budget Transparency card. */
  downloadExpensesCsv() {
    this.downloadReport('expenses', 'budget-transparency-expenses.csv');
  }

  /** P1-9 — real cross-department plan-vs-spend numbers (replaces mock CSV). */
  loadBudgetOverview() {
    this.api.getBudgetOverview().subscribe({
      next: (res) => {
        if (!res.success || !Array.isArray(res.data)) return;
        this.budgetOverview = res.data;
        this.budgetTotal = res.data.reduce((s, r) => s + (r.budget || 0), 0);
        this.budgetSpent = res.data.reduce((s, r) => s + (r.spent || 0), 0);
      },
      error: () => {},
    });
  }

  /** P1-7 — branded issues-report PDF (CSV kept for raw data). */
  downloadReportPdf(filename = 'issues-export.csv') {
    this.exporting = true;
    this.api.exportIssuesPdf().subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename.replace(/\.csv$/, '.pdf');
        a.click();
        URL.revokeObjectURL(url);
        this.exporting = false;
      },
      error: () => { this.exporting = false; },
    });
  }

  /** P2-19 — past public meetings (Event COUNCIL_MEETING / PUBLIC_HEARING / TOWN_HALL). */
  loadMeetingMinutes() {
    this.minutesLoading = true;
    this.api.getPortalMeetings(6).subscribe({
      next: (res) => {
        const rows = res?.data || [];
        this.meetingMinutes = rows.map((m: any) => ({
          id: m.id,
          title: m.title,
          date: m.startTime,
          attendees: m._count?.rsvps ?? 0,
          organizer: m.creator ? `${m.creator.firstName} ${m.creator.lastName}` : '',
        }));
        this.minutesLoading = false;
      },
      error: () => { this.minutesLoading = false; },
    });
  }

  loadAiTrends() {
    this.aiTrendsLoading = true;
    this.api.getIssues({ pageSize: '30', sortBy: 'createdAt', sortOrder: 'desc' }).subscribe({
      next: (res: any) => {
        const issues = (res.data || []).map((i: Issue) => ({
          title: i.title,
          description: i.description,
          category: i.category,
        }));
        if (!issues.length) {
          this.aiTrends = [];
          this.aiTrendsLoading = false;
          return;
        }
        this.api.aiTrends(issues).subscribe({
          next: (trendRes) => {
            this.aiTrends = trendRes?.data?.trends || trendRes?.trends || [];
            this.aiTrendsLoading = false;
          },
          error: () => { this.aiTrends = []; this.aiTrendsLoading = false; },
        });
      },
      error: () => { this.aiTrendsLoading = false; },
    });
  }

  private buildPublicStats(stats: DashboardStats) {
    const entries = Object.entries(stats.issuesByCategory).filter(([, count]) => count > 0);
    const max = Math.max(...entries.map(([, count]) => count), 1);
    this.publicStats = entries.slice(0, 5).map(([cat, count]) => ({
      label: cat,
      pct: (count / max) * 100,
      value: String(count),
      color: this.categoryColors[cat] || '#64748B',
    }));
  }
}
