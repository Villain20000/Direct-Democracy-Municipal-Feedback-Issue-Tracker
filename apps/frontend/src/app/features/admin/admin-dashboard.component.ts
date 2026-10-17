import { Component, OnInit, inject } from '@angular/core';
import { CommonModule, TitleCasePipe, DatePipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { LayoutComponent } from '../../shared/layout.component';
import { AuthService } from '../../core/services/auth.service';
import { ApiService, SystemHealth } from '../../core/services/api.service';
import { TranslationService } from '../../core/i18n/translation.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { DashboardStats, User, Issue } from '@dd/shared-types';
import { ActivityFeedComponent } from '../../shared/activity-feed.component';
import { ChartComponent } from '../shared/chart.component';
import { CivicScoreComponent } from '../../shared/civic-score.component';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, LayoutComponent, TitleCasePipe, DatePipe, TranslatePipe, ActivityFeedComponent, CivicScoreComponent, ChartComponent],
  template: `
    <app-layout
      [pageTitle]="i18n.t('admin.pageTitle')"
      [navItems]="navItems"
      (logout)="auth.logout()">
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-icon blue"><i class="material-icons-outlined">report_problem</i></div>
          <div class="stat-info">
            <div class="stat-value">{{ stats?.totalIssues || 0 }}</div>
            <div class="stat-label">{{ 'admin.totalIssues' | t }}</div>

          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon amber"><i class="material-icons-outlined">pending_actions</i></div>
          <div class="stat-info">
            <div class="stat-value">{{ stats?.openIssues || 0 }}</div>
            <div class="stat-label">{{ 'admin.openIssues' | t }}</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon green"><i class="material-icons-outlined">check_circle</i></div>
          <div class="stat-info">
            <div class="stat-value">{{ stats?.resolvedIssues || 0 }}</div>
            <div class="stat-label">{{ 'admin.resolved' | t }}</div>

          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon purple"><i class="material-icons-outlined">people</i></div>
          <div class="stat-info">
            <div class="stat-value">{{ userStats?.total || 0 }}</div>
            <div class="stat-label">{{ 'admin.totalUsers' | t }}</div>
          </div>
        </div>
        <div class="stat-card" routerLink="/sla-breaches" style="cursor:pointer;" [title]="'admin.slaBreached' | t">
          <div class="stat-icon red"><i class="material-icons-outlined">timer_off</i></div>
          <div class="stat-info">
            <div class="stat-value">{{ slaBreachedCount }}</div>
            <div class="stat-label">{{ 'admin.slaBreached' | t }}</div>
          </div>
        </div>
      </div>

      <div class="content-grid">
        <app-activity-feed [limit]="6" />
        <app-civic-score [userId]="auth.user()?.id" />
      </div>

      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:16px;margin-bottom:16px;">
        <div class="card">
          <div class="card-header"><h3>{{ 'admin.deptPerformance' | t }}</h3></div>
          <div class="card-body">
            @if (deptLabels.length) {
              <app-chart kind="bar" [labels]="deptLabels" [data]="deptPcts" [height]="240" [showLegend]="false" />
            } @else {
              <p style="color:var(--text-muted);font-size:13px;">{{ 'admin.deptPerformanceEmpty' | t }}</p>
            }
          </div>
        </div>
        <div class="card">
          <div class="card-header"><h3>{{ 'admin.wardDistribution' | t }}</h3></div>
          <div class="card-body">
            @if (wardLabels.length) {
              <app-chart kind="pie" [labels]="wardLabels" [data]="wardCounts" [height]="240" />
            } @else {
              <p style="color:var(--text-muted);font-size:13px;">{{ 'admin.wardDistributionEmpty' | t }}</p>
            }
          </div>
        </div>
      </div>

      <div class="content-grid">
        <div class="card">
          <div class="card-header">
            <h3>{{ 'admin.issuesByCategory' | t }}</h3>
          </div>
          <div class="card-body">
            @for (entry of categoryEntries; track entry[0]) {
              <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
                <span style="font-size: 13px; width: 140px; color: var(--text-secondary);">{{ entry[0] | titlecase }}</span>
                <div style="flex: 1; background: var(--bg-primary); border-radius: 4px; height: 8px;">
                  <div [style.width.%]="getBarWidth(entry[1])" style="background: var(--primary); height: 100%; border-radius: 4px; transition: width 0.5s ease;"></div>
                </div>
                <span style="font-size: 13px; font-weight: 700; width: 40px; text-align: right;">{{ entry[1] }}</span>
              </div>
            }
          </div>
        </div>
        <div class="card">
          <div class="card-header">
            <h3>{{ 'admin.userByRole' | t }}</h3>
          </div>
          <div class="card-body">
            @for (entry of roleEntries; track entry[0]) {
              <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
                <span style="font-size: 13px; width: 140px; color: var(--text-secondary);">{{ i18n.tEnum('roles', entry[0]) }}</span>
                <div style="flex: 1; background: var(--bg-primary); border-radius: 4px; height: 8px;">
                  <div [style.width.%]="getRoleBarWidth(entry[1])" [style.background]="getRoleColor(entry[0])" style="height: 100%; border-radius: 4px; transition: width 0.5s ease;"></div>
                </div>
                <span style="font-size: 13px; font-weight: 700; width: 40px; text-align: right;">{{ entry[1] }}</span>
              </div>
            }
          </div>
        </div>
      </div>

      <div class="content-grid">
        <div class="card">
          <div class="card-header">
            <h3>{{ 'admin.recentIssues' | t }}</h3>
            <button class="btn btn-secondary btn-sm" routerLink="/issues">{{ 'common.viewAll' | t }}</button>
          </div>
          <div class="card-body" style="padding: 0;">
            <table class="data-table">
              <thead>
                <tr><th>{{ 'admin.title' | t }}</th><th>{{ 'admin.status' | t }}</th><th>{{ 'admin.priority' | t }}</th><th>{{ 'admin.date' | t }}</th></tr>
              </thead>
              <tbody>
                @for (issue of recentIssues; track issue.id) {
                  <tr style="cursor: pointer;" [routerLink]="['/issues', issue.id]">
                    <td><strong>{{ issue.title }}</strong></td>
                    <td><span class="status-badge" [ngClass]="statusClass(issue.status)">{{ formatStatus(issue.status) }}</span></td>
                    <td><span class="priority-dot" [ngClass]="'p' + (issue.priority || 3)"></span> {{ issue.priority || '-' }}</td>
                    <td style="color: var(--text-muted);">{{ issue.createdAt | date:'short' }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>
        <div class="card">
          <div class="card-header">
            <h3>{{ 'admin.systemHealth' | t }}</h3>
          </div>
          <div class="card-body">
            @if (sysHealth) {
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
                <div style="text-align: center; padding: 16px; background: var(--bg-primary); border-radius: var(--radius);">
                  <i class="material-icons-outlined" style="font-size: 32px; color: var(--success);">check_circle</i>
                  <div style="font-size: 13px; font-weight: 600; margin-top: 8px;">{{ 'admin.apiServer' | t }}</div>
                  <div style="font-size: 11px;" [style.color]="apiHealthy ? 'var(--success)' : 'var(--danger)'">{{ apiHealthy ? i18n.t('admin.operational') : i18n.t('admin.unreachable') }}</div>
                  <div style="font-size: 11px; color: var(--text-muted);">p95 {{ sysHealth.http.p95Ms }} ms · p50 {{ sysHealth.http.p50Ms }} ms</div>
                </div>
                <div style="text-align: center; padding: 16px; background: var(--bg-primary); border-radius: var(--radius);">
                  <i class="material-icons-outlined" style="font-size: 32px;" [style.color]="sysHealth.database.status === 'up' ? 'var(--success)' : 'var(--danger)'">storage</i>
                  <div style="font-size: 13px; font-weight: 600; margin-top: 8px;">{{ 'admin.database' | t }}</div>
                  <div style="font-size: 11px;" [style.color]="sysHealth.database.status === 'up' ? 'var(--success)' : 'var(--danger)'">{{ sysHealth.database.status === 'up' ? i18n.t('admin.connected') + (sysHealth.database.latencyMs != null ? ' · ' + sysHealth.database.latencyMs + ' ms' : '') : i18n.t('admin.unreachable') }}</div>
                </div>
                <div style="text-align: center; padding: 16px; background: var(--bg-primary); border-radius: var(--radius);">
                  <i class="material-icons-outlined" style="font-size: 32px;" [style.color]="sysHealth.queue.status === 'up' ? 'var(--success)' : 'var(--warning)'">hub</i>
                  <div style="font-size: 13px; font-weight: 600; margin-top: 8px;">{{ 'admin.embedQueue' | t }}</div>
                  <div style="font-size: 11px; color: var(--text-muted);">{{ i18n.t('admin.queueDepth', { waiting: sysHealth.queue.waiting, active: sysHealth.queue.active, failed: sysHealth.queue.failed }) }}</div>
                </div>
                <div style="text-align: center; padding: 16px; background: var(--bg-primary); border-radius: var(--radius);">
                  <i class="material-icons-outlined" style="font-size: 32px;" [style.color]="sysHealth.ollama.status === 'up' ? 'var(--success)' : 'var(--danger)'">smart_toy</i>
                  <div style="font-size: 13px; font-weight: 600; margin-top: 8px;">{{ 'admin.aiEngine' | t }}</div>
                  <div style="font-size: 11px; color: var(--text-muted);">{{ i18n.t('admin.ollamaDetail', { status: sysHealth.ollama.status, models: sysHealth.ollama.models }) }}</div>
                </div>
                <div style="text-align: center; padding: 16px; background: var(--bg-primary); border-radius: var(--radius);">
                  <i class="material-icons-outlined" style="font-size: 32px;" [style.color]="sysHealth.redis.status === 'up' ? 'var(--success)' : 'var(--warning)'">cached</i>
                  <div style="font-size: 13px; font-weight: 600; margin-top: 8px;">{{ 'admin.redisCache' | t }}</div>
                  <div style="font-size: 11px; color: var(--text-muted);">{{ i18n.t('admin.redisDetail', { status: sysHealth.redis.status }) }}</div>
                </div>
                <div style="text-align: center; padding: 16px; background: var(--bg-primary); border-radius: var(--radius);">
                  <i class="material-icons-outlined" style="font-size: 32px; color: var(--success);">security</i>
                  <div style="font-size: 13px; font-weight: 600; margin-top: 8px;">{{ 'admin.security' | t }}</div>
                  <div style="font-size: 11px; color: var(--success);">{{ 'admin.allClear' | t }}</div>
                </div>
              </div>
            } @else {
              <p style="color: var(--text-muted); font-size: 13px;">{{ 'admin.healthLoading' | t }}</p>
            }
          </div>
        </div>
      </div>
    </app-layout>
  `,
})
export class AdminDashboardComponent implements OnInit {
  stats: DashboardStats | null = null;
  userStats: any = null;
  recentIssues: Issue[] = [];
  categoryEntries: [string, number][] = [];
  roleEntries: [string, number][] = [];
  apiHealthy = true;
  /** P2-21 — live system health (p95 latency, queue depth, Ollama, Redis). */
  sysHealth: SystemHealth | null = null;

  // Chart data (PLAN §10 — dept performance bar + ward distribution pie)
  deptLabels: string[] = [];
  deptPcts: number[] = [];
  wardLabels: string[] = [];
  wardCounts: number[] = [];
  /** P0-1 — live count of breached SLAs (GET /sla/breached). */
  slaBreachedCount = 0;

  navItems = [
    { icon: 'dashboard', label: 'nav.overview', route: '/admin' },
    { icon: 'people', label: 'nav.users', route: '/admin/users' },
    { icon: 'apartment', label: 'nav.departments', route: '/admin/departments' },
    { icon: 'map', label: 'nav.wards', route: '/admin/wards' },
    { icon: 'library_books', label: 'nav.documents', route: '/admin/documents' },
    { icon: 'settings', label: 'nav.settings', route: '/admin/settings' },
  ] as any;

  auth = inject(AuthService);
  api = inject(ApiService);
  i18n = inject(TranslationService);
  router = inject(Router);

  ngOnInit() {
    fetch('/api/v1/health').then(r => { this.apiHealthy = r.ok; }).catch(() => { this.apiHealthy = false; });
    // P2-21 — detailed health replaces the old single-toggle card.
    this.api.getSystemHealth().subscribe({
      next: (res) => { if (res.success) this.sysHealth = res.data; },
      error: () => {},
    });

    this.api.getIssueStats().subscribe(res => {
      if (res.success) {
        this.stats = res.data;
        this.categoryEntries = Object.entries(res.data.issuesByCategory);
        this.recentIssues = res.data.recentIssues;
      }
    });
    this.api.getUserStats().subscribe(res => {
      if (res.success) {
        this.userStats = res.data;
        this.roleEntries = Object.entries(res.data.byRole);
      }
    });
    // Department performance comparison (resolved % per department)
    this.api.getDepartmentResolutionRates().subscribe({
      next: (res) => {
        if (res.success && res.data.length) {
          this.deptLabels = res.data.map(d => d.department);
          this.deptPcts = res.data.map(d => d.pct);
        }
      },
      error: () => {},
    });
    // Ward issue distribution (public counts per ward)
    this.api.getPortalWards().subscribe({
      next: (res) => {
        if (res.success && Array.isArray(res.data)) {
          const withIssues = (res.data as any[]).filter(w => (w.issueCount ?? w._count?.issues ?? 0) > 0);
          this.wardLabels = withIssues.map(w => w.name);
          this.wardCounts = withIssues.map(w => w.issueCount ?? w._count?.issues ?? 0);
        }
      },
      error: () => {},
    });
    // P0-1 — breached SLA counter; the stat card links to /sla-breaches.
    this.api.getSlaBreaches().subscribe({
      next: (res) => { if (res.success) this.slaBreachedCount = res.data.length; },
      error: () => {},
    });
  }

  getBarWidth(count: number): number {
    const max = Math.max(...this.categoryEntries.map(e => e[1]), 1);
    return (count / max) * 100;
  }

  getRoleBarWidth(count: number): number {
    const max = Math.max(...this.roleEntries.map(e => e[1]), 1);
    return (count / max) * 100;
  }

  statusClass(status: string): string {
    return status.toLowerCase().replace(/_/g, '-');
  }

  formatStatus(status: string): string {
    return this.i18n.tEnum('status', status);
  }

  getRoleColor(role: string): string {
    const colors: Record<string, string> = {
      SUPER_ADMIN: '#DC2626', MAYOR: '#2563EB', DEPARTMENT_HEAD: '#16A34A',
      COUNCIL_MEMBER: '#7C3AED', STAFF: '#EA580C', WARD_REP: '#0D9488',
      CITIZEN: '#0284C7', VOLUNTEER: '#D97706', AUDITOR: '#475569', MEDIA: '#4F46E5',
    };
    return colors[role] || '#64748B';
  }
}
