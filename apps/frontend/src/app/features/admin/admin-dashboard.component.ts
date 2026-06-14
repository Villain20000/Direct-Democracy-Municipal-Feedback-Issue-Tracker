import { Component, OnInit } from '@angular/core';
import { CommonModule, TitleCasePipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { LayoutComponent } from '../../shared/layout.component';
import { AuthService } from '../../core/services/auth.service';
import { ApiService } from '../../core/services/api.service';
import { DashboardStats, User, Issue } from '@dd/shared-types';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, LayoutComponent, TitleCasePipe],
  template: `
    <app-layout
      pageTitle="Super Admin Dashboard"
      [navItems]="navItems"
      (logout)="auth.logout()">
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-icon blue"><i class="material-icons-outlined">report_problem</i></div>
          <div class="stat-info">
            <div class="stat-value">{{ stats?.totalIssues || 0 }}</div>
            <div class="stat-label">Total Issues</div>

          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon amber"><i class="material-icons-outlined">pending_actions</i></div>
          <div class="stat-info">
            <div class="stat-value">{{ stats?.openIssues || 0 }}</div>
            <div class="stat-label">Open Issues</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon green"><i class="material-icons-outlined">check_circle</i></div>
          <div class="stat-info">
            <div class="stat-value">{{ stats?.resolvedIssues || 0 }}</div>
            <div class="stat-label">Resolved</div>

          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon purple"><i class="material-icons-outlined">people</i></div>
          <div class="stat-info">
            <div class="stat-value">{{ userStats?.total || 0 }}</div>
            <div class="stat-label">Total Users</div>
          </div>
        </div>
      </div>

      <div class="content-grid">
        <div class="card">
          <div class="card-header">
            <h3>Issues by Category</h3>
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
            <h3>User Distribution by Role</h3>
          </div>
          <div class="card-body">
            @for (entry of roleEntries; track entry[0]) {
              <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
                <span style="font-size: 13px; width: 140px; color: var(--text-secondary);">{{ entry[0] | titlecase }}</span>
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
            <h3>Recent Issues</h3>
            <button class="btn btn-secondary btn-sm" routerLink="/issues">View All</button>
          </div>
          <div class="card-body" style="padding: 0;">
            <table class="data-table">
              <thead>
                <tr><th>Title</th><th>Status</th><th>Priority</th><th>Date</th></tr>
              </thead>
              <tbody>
                @for (issue of recentIssues; track issue.id) {
                  <tr style="cursor: pointer;" [routerLink]="['/issues', issue.id]">
                    <td><strong>{{ issue.title }}</strong></td>
                    <td><span class="status-badge" [class]="issue.status.toLowerCase()">{{ issue.status }}</span></td>
                    <td><span class="priority-dot" [class]="'p' + (issue.priority || 3)"></span> {{ issue.priority || '-' }}</td>
                    <td style="color: var(--text-muted);">{{ issue.createdAt | date:'short' }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>
        <div class="card">
          <div class="card-header">
            <h3>System Health</h3>
          </div>
          <div class="card-body">
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
              <div style="text-align: center; padding: 16px; background: var(--bg-primary); border-radius: var(--radius);">
                <i class="material-icons-outlined" style="font-size: 32px; color: var(--success);">check_circle</i>
                <div style="font-size: 13px; font-weight: 600; margin-top: 8px;">API Server</div>
                <div style="font-size: 11px;" [style.color]="apiHealthy ? 'var(--success)' : 'var(--danger)'">{{ apiHealthy ? 'Operational' : 'Unreachable' }}</div>
              </div>
              <div style="text-align: center; padding: 16px; background: var(--bg-primary); border-radius: var(--radius);">
                <i class="material-icons-outlined" style="font-size: 32px; color: var(--success);">storage</i>
                <div style="font-size: 13px; font-weight: 600; margin-top: 8px;">Database</div>
                <div style="font-size: 11px; color: var(--success);">Connected</div>
              </div>
              <div style="text-align: center; padding: 16px; background: var(--bg-primary); border-radius: var(--radius);">
                <i class="material-icons-outlined" style="font-size: 32px; color: var(--warning);">smart_toy</i>
                <div style="font-size: 13px; font-weight: 600; margin-top: 8px;">AI Engine</div>
                <div style="font-size: 11px; color: var(--warning);">Gemma 2B</div>
              </div>
              <div style="text-align: center; padding: 16px; background: var(--bg-primary); border-radius: var(--radius);">
                <i class="material-icons-outlined" style="font-size: 32px; color: var(--success);">security</i>
                <div style="font-size: 13px; font-weight: 600; margin-top: 8px;">Security</div>
                <div style="font-size: 11px; color: var(--success);">All Clear</div>
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
    { icon: 'dashboard', label: 'Overview', route: '/admin' },
    { icon: 'people', label: 'Users', route: '/admin/users' },
    { icon: 'apartment', label: 'Departments', route: '/admin/departments' },
    { icon: 'map', label: 'Wards', route: '/admin/wards' },
    { icon: 'settings', label: 'Settings', route: '/admin/settings' },
  ];

  constructor(public auth: AuthService, private api: ApiService, private router: Router) {}

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

  getRoleColor(role: string): string {
    const colors: Record<string, string> = {
      SUPER_ADMIN: '#DC2626', MAYOR: '#2563EB', DEPARTMENT_HEAD: '#16A34A',
      COUNCIL_MEMBER: '#7C3AED', STAFF: '#EA580C', WARD_REP: '#0D9488',
      CITIZEN: '#0284C7', VOLUNTEER: '#D97706', AUDITOR: '#475569', MEDIA: '#4F46E5',
    };
    return colors[role] || '#64748B';
  }
}
