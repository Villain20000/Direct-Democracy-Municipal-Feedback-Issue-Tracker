import { Component, OnInit, inject } from '@angular/core';
import { CommonModule, TitleCasePipe } from '@angular/common';
import { LayoutComponent } from '../../shared/layout.component';
import { AuthService } from '../../core/services/auth.service';
import { ApiService } from '../../core/services/api.service';
import { TranslationService } from '../../core/i18n/translation.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { ChartComponent } from './chart.component';
import { DashboardStats, IssueCategory, IssueStatus } from '@dd/shared-types';

@Component({
  selector: 'app-analytics-page',
  standalone: true,
  imports: [CommonModule, LayoutComponent, TitleCasePipe, ChartComponent, TranslatePipe],
  template: `
    <app-layout [pageTitle]="i18n.t('analytics.pageTitle')" [navItems]="navItems" (logout)="auth.logout()">
      <div class="card" style="margin-bottom:16px;">
        <div class="card-header" style="display:flex;justify-content:space-between;align-items:center;">
          <h3>{{ i18n.t('analytics.exportsTitle') }}</h3>
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            <button class="btn btn-secondary btn-sm" data-testid="analytics-export-csv-btn" (click)="exportCsv()" [disabled]="exporting">{{ i18n.t('analytics.exportCsv') }}</button>
            <button class="btn btn-secondary btn-sm" data-testid="analytics-export-pdf-btn" (click)="exportPdf()" [disabled]="exporting">{{ i18n.t('analytics.exportPdf') }}</button>
            <button class="btn btn-secondary btn-sm" data-testid="analytics-export-briefing-btn" (click)="exportBriefing()" [disabled]="exporting">{{ i18n.t('analytics.exportBriefing') }}</button>
          </div>
        </div>
        @if (exportError) {
          <div class="card-body" style="color:var(--danger);font-size:13px;">{{ exportError }}</div>
        }
      </div>
      @if (stats) {
        <div class="stats-grid">
          <div class="stat-card"><div class="stat-icon blue"><i class="material-icons-outlined">report_problem</i></div><div class="stat-info"><div class="stat-value">{{ stats.totalIssues }}</div><div class="stat-label">{{ i18n.t('analytics.totalIssues') }}</div></div></div>
          <div class="stat-card"><div class="stat-icon amber"><i class="material-icons-outlined">pending</i></div><div class="stat-info"><div class="stat-value">{{ stats.openIssues }}</div><div class="stat-label">{{ i18n.t('analytics.open') }}</div></div></div>
          <div class="stat-card"><div class="stat-icon green"><i class="material-icons-outlined">check_circle</i></div><div class="stat-info"><div class="stat-value">{{ stats.resolvedIssues }}</div><div class="stat-label">{{ i18n.t('analytics.resolved') }}</div></div></div>
          <div class="stat-card"><div class="stat-icon purple"><i class="material-icons-outlined">schedule</i></div><div class="stat-info"><div class="stat-value">{{ stats.avgResolutionTimeDays }}</div><div class="stat-label">{{ i18n.t('analytics.avgDays') }}</div></div></div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:16px;margin-bottom:16px;">
          <div class="card">
            <div class="card-header"><h3>{{ i18n.t('analytics.issuesByCategory') }}</h3></div>
            <div class="card-body">
              <app-chart
                kind="doughnut"
                [labels]="categoryLabels"
                [data]="categoryCounts"
                [height]="260" />
            </div>
          </div>
          <div class="card">
            <div class="card-header"><h3>{{ 'analytics.issuesByStatus' | t }}</h3></div>
            <div class="card-body">
              <app-chart
                kind="bar"
                [labels]="statusLabels"
                [data]="statusCounts"
                [height]="260"
                [showLegend]="false" />
            </div>
          </div>
        </div>
        <div class="card" style="margin-bottom:16px;" data-testid="analytics-resolution-trend">
          <div class="card-header"><h3>{{ i18n.t('analytics.resolutionTrend') }}</h3></div>
          <div class="card-body">
            @if (trendLabels.length) {
              <app-chart
                kind="line"
                [labels]="trendLabels"
                [data]="trendCreated"
                [data2]="trendResolved"
                [datasetLabel]="i18n.t('analytics.trendCreated')"
                [datasetLabel2]="i18n.t('analytics.trendResolved')"
                [height]="220" />
            } @else {
              <p style="color:var(--text-muted);font-size:13px;">{{ i18n.t('analytics.resolutionTrendEmpty') }}</p>
            }
          </div>
        </div>
        <div class="card">
          <div class="card-header"><h3>{{ i18n.t('analytics.issuesByCategory') }}</h3></div>
          <div class="card-body">
            @for (entry of categoryEntries; track entry[0]) {
              <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;">
                <span style="font-size:13px;width:140px;color:var(--text-secondary);">{{ i18n.tCategory(entry[0]) }}</span>
                <div style="flex:1;background:var(--bg-primary);border-radius:4px;height:8px;">
                  <div [style.width.%]="barWidth(entry[1])" style="background:var(--primary);height:100%;border-radius:4px;"></div>
                </div>
                <span style="font-size:13px;font-weight:700;width:40px;text-align:right;">{{ entry[1] }}</span>
              </div>
            }
          </div>
        </div>
      } @else if (loading) {
        <div class="card"><div class="card-body" style="padding:48px;text-align:center;color:var(--text-muted);">{{ i18n.t('analytics.loading') }}</div></div>
      }
    </app-layout>
  `,
})
export class AnalyticsPageComponent implements OnInit {
  stats: DashboardStats | null = null;
  categoryEntries: [string, number][] = [];
  loading = true;
  exporting = false;
  exportError = '';
  navItems = [{ icon: 'arrow_back', label: 'common.back', route: '/mayor' }];

  // Chart datasets (PLAN feature 21 — real API data, not CSS bars)
  categoryLabels: string[] = [];
  categoryCounts: number[] = [];
  statusLabels: string[] = [];
  statusCounts: number[] = [];
  /** Weekly created-vs-resolved series for the resolution trend line. */
  trendLabels: string[] = [];
  trendCreated: number[] = [];
  trendResolved: number[] = [];

  i18n = inject(TranslationService);

  constructor(public auth: AuthService, private api: ApiService) {}

  ngOnInit() {
    this.api.getIssueStats().subscribe({
      next: (res) => {
        this.loading = false;
        if (res.success) {
          this.stats = res.data;
          this.categoryEntries = Object.entries(res.data.issuesByCategory);
          // Chart datasets: skip zero-count categories to keep the
          // donut readable, keep every status (pipeline order).
          this.categoryLabels = this.categoryEntries
            .filter(([, n]) => n > 0)
            .map(([cat]) => this.i18n.tCategory(cat as IssueCategory));
          this.categoryCounts = this.categoryEntries
            .filter(([, n]) => n > 0)
            .map(([, n]) => n);
          const statusEntries = Object.entries(res.data.issuesByStatus || {})
            .filter(([, n]) => n > 0) as [IssueStatus, number][];
          this.statusLabels = statusEntries.map(([s]) => s.replace(/_/g, ' ').toLowerCase());
          this.statusCounts = statusEntries.map(([, n]) => n);
        }
      },
      error: () => { this.loading = false; },
    });
    this.api.getIssueTrends(6).subscribe({
      next: (res) => {
        if (!res.success || !res.data?.length) return;
        this.trendLabels = res.data.map((b) => b.weekStart.slice(5)); // MM-DD
        this.trendCreated = res.data.map((b) => b.created);
        this.trendResolved = res.data.map((b) => b.resolved);
      },
      error: () => {},
    });
  }

  barWidth(count: number): number {
    const max = Math.max(...this.categoryEntries.map(e => e[1]), 1);
    return (count / max) * 100;
  }

  /** P1-7 — report downloads (CSV kept for raw data, PDFs are branded). */
  private downloadBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  exportCsv() {
    this.exporting = true;
    this.exportError = '';
    this.api.exportIssuesCsv().subscribe({
      next: (blob) => { this.downloadBlob(blob, 'issues-export.csv'); this.exporting = false; },
      error: () => { this.exportError = this.i18n.t('analytics.exportFailed'); this.exporting = false; },
    });
  }

  exportPdf() {
    this.exporting = true;
    this.exportError = '';
    this.api.exportIssuesPdf().subscribe({
      next: (blob) => { this.downloadBlob(blob, 'issues-report.pdf'); this.exporting = false; },
      error: () => { this.exportError = this.i18n.t('analytics.exportFailed'); this.exporting = false; },
    });
  }

  exportBriefing() {
    this.exporting = true;
    this.exportError = '';
    this.api.exportBriefingPdf().subscribe({
      next: (blob) => { this.downloadBlob(blob, 'weekly-briefing.pdf'); this.exporting = false; },
      error: () => { this.exportError = this.i18n.t('analytics.exportFailed'); this.exporting = false; },
    });
  }
}
