import { Component, OnInit, inject } from '@angular/core';
import { CommonModule, TitleCasePipe, DatePipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { LayoutComponent } from '../../shared/layout.component';
import { AuthService } from '../../core/services/auth.service';
import { ApiService } from '../../core/services/api.service';
import { TranslationService } from '../../core/i18n/translation.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { DashboardStats, User, Issue } from '@dd/shared-types';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, LayoutComponent, TitleCasePipe, DatePipe, TranslatePipe],
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
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
              <div style="text-align: center; padding: 16px; background: var(--bg-primary); border-radius: var(--radius);">
                <i class="material-icons-outlined" style="font-size: 32px; color: var(--success);">check_circle</i>
                <div style="font-size: 13px; font-weight: 600; margin-top: 8px;">{{ 'admin.apiServer' | t }}</div>
                <div style="font-size: 11px;" [style.color]="apiHealthy ? 'var(--success)' : 'var(--danger)'">{{ apiHealthy ? i18n.t('admin.operational') : i18n.t('admin.unreachable') }}</div>
              </div>
              <div style="text-align: center; padding: 16px; background: var(--bg-primary); border-radius: var(--radius);">
                <i class="material-icons-outlined" style="font-size: 32px; color: var(--success);">storage</i>
                <div style="font-size: 13px; font-weight: 600; margin-top: 8px;">{{ 'admin.database' | t }}</div>
                <div style="font-size: 11px; color: var(--success);">{{ 'admin.connected' | t }}</div>
              </div>
              <div style="text-align: center; padding: 16px; background: var(--bg-primary); border-radius: var(--radius);">
                <i class="material-icons-outlined" style="font-size: 32px; color: var(--warning);">smart_toy</i>
                <div style="font-size: 13px; font-weight: 600; margin-top: 8px;">{{ 'admin.aiEngine' | t }}</div>
                <div style="font-size: 11px; color: var(--warning);">{{ 'admin.aiEngineModel' | t }}</div>
              </div>
              <div style="text-align: center; padding: 16px; background: var(--bg-primary); border-radius: var(--radius);">
                <i class="material-icons-outlined" style="font-size: 32px; color: var(--success);">security</i>
                <div style="font-size: 13px; font-weight: 600; margin-top: 8px;">{{ 'admin.security' | t }}</div>
                <div style="font-size: 11px; color: var(--success);">{{ 'admin.allClear' | t }}</div>
              </div>
            </div>
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

  navItems = [
    { icon: 'dashboard', label: 'nav.overview', route: '/admin' },
    { icon: 'people', label: 'nav.users', route: '/admin/users' },
    { icon: 'apartment', label: 'nav.departments', route: '/admin/departments' },
    { icon: 'map', label: 'nav.wards', route: '/admin/wards' },
    { icon: 'settings', label: 'nav.settings', route: '/admin/settings' },
  ] as any;

  auth = inject(AuthService);
  api = inject(ApiService);
  i18n = inject(TranslationService);
  router = inject(Router);

  ngOnInit() {
    fetch('/health').then(r => { this.apiHealthy = r.ok; }).catch(() => { this.apiHealthy = false; });

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
