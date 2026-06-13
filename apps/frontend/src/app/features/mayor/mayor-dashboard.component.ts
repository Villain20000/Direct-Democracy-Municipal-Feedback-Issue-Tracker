import { Component, OnInit } from '@angular/core';
import { CommonModule, DecimalPipe, CurrencyPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { LayoutComponent } from '../../shared/layout.component';
import { AuthService } from '../../core/services/auth.service';
import { ApiService } from '../../core/services/api.service';
import { DashboardStats, Issue } from '@dd/shared-types';

@Component({
  selector: 'app-mayor-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, LayoutComponent, DecimalPipe, CurrencyPipe],
  template: `
    <app-layout
      pageTitle="Mayor Dashboard"
      [navItems]="navItems"
      [notifCount]="5"
      (logout)="auth.logout()">

      <div style="background: linear-gradient(135deg, #1E40AF, #7C3AED); border-radius: var(--radius-xl); padding: 32px; color: white; margin-bottom: 24px;">
        <h2 style="font-size: 24px; font-weight: 800; margin-bottom: 4px;">City of Springfield Dashboard</h2>
        <p style="opacity: 0.8;">Real-time overview of municipal services and citizen engagement</p>
        <div style="display: flex; gap: 32px; margin-top: 20px;">
          <div><div style="font-size: 36px; font-weight: 800;">{{ stats?.totalIssues || 0 }}</div><div style="opacity: 0.7; font-size: 13px;">Total Issues</div></div>
          <div><div style="font-size: 36px; font-weight: 800;">{{ ((stats?.resolvedIssues || 0) / (stats?.totalIssues || 1) * 100) | number:'1.0-0' }}%</div><div style="opacity: 0.7; font-size: 13px;">Resolution Rate</div></div>
          <div><div style="font-size: 36px; font-weight: 800;">4.2</div><div style="opacity: 0.7; font-size: 13px;">Avg Days to Resolve</div></div>
        </div>
      </div>

      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-icon blue"><i class="material-icons-outlined">report_problem</i></div>
          <div class="stat-info"><div class="stat-value">{{ stats?.openIssues || 0 }}</div><div class="stat-label">Open Issues</div></div>
        </div>
        <div class="stat-card">
          <div class="stat-icon green"><i class="material-icons-outlined">check_circle</i></div>
          <div class="stat-info"><div class="stat-value">{{ stats?.resolvedIssues || 0 }}</div><div class="stat-label">Resolved Issues</div></div>
        </div>
        <div class="stat-card">
          <div class="stat-icon amber"><i class="material-icons-outlined">trending_up</i></div>
          <div class="stat-info"><div class="stat-value">+18%</div><div class="stat-label">Engagement This Month</div></div>
        </div>
        <div class="stat-card">
          <div class="stat-icon teal"><i class="material-icons-outlined">sentiment_satisfied</i></div>
          <div class="stat-info"><div class="stat-value">72%</div><div class="stat-label">Positive Sentiment</div></div>
        </div>
      </div>

      <div class="content-grid">
        <div class="card">
          <div class="card-header"><h3>🤖 AI Weekly Briefing</h3></div>
          <div class="card-body">
            <p style="font-size: 14px; color: var(--text-secondary); line-height: 1.8;">
              This week, <strong>{{ stats?.openIssues || 0 }} issues</strong> remain open across all departments.
              The <strong>Public Works</strong> department has the highest workload with the most infrastructure reports.
              Citizen sentiment is trending <strong>positive</strong> with a 72% approval rating on recent resolutions.
              Top concerns: road maintenance, water infrastructure, and public safety lighting.
            </p>
            <button class="btn btn-primary btn-sm" style="margin-top: 12px;">
              <i class="material-icons-outlined" style="font-size: 16px;">auto_awesome</i> Generate Full Report
            </button>
          </div>
        </div>
        <div class="card">
          <div class="card-header"><h3>Department Performance</h3></div>
          <div class="card-body">
            @for (dept of departments; track dept.name) {
              <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px; padding: 10px; background: var(--bg-primary); border-radius: var(--radius);">
                <div style="width: 40px; height: 40px; border-radius: var(--radius); background: var(--primary); color: white; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 12px;">{{ dept.code }}</div>
                <div style="flex: 1;">
                  <div style="font-size: 13px; font-weight: 600;">{{ dept.name }}</div>
                  <div style="font-size: 11px; color: var(--text-muted);">Budget: {{ dept.budget | currency:'USD':'symbol':'1.0-0' }}</div>
                </div>
                <div style="text-align: right;">
                  <div style="font-size: 18px; font-weight: 800;">{{ dept.issueCount || 0 }}</div>
                  <div style="font-size: 11px; color: var(--text-muted);">issues</div>
                </div>
              </div>
            }
          </div>
        </div>
      </div>

      <div class="card" style="margin-bottom: 24px;">
        <div class="card-header"><h3>Priority Issues Requiring Attention</h3></div>
        <div class="card-body" style="padding: 0;">
          <table class="data-table">
            <thead><tr><th>Title</th><th>Category</th><th>Status</th><th>Priority</th><th>Upvotes</th><th>Date</th></tr></thead>
            <tbody>
              @for (issue of criticalIssues; track issue.id) {
                <tr [routerLink]="['/issues', issue.id]" style="cursor: pointer;">
                  <td><strong>{{ issue.title }}</strong><br><span style="font-size: 11px; color: var(--text-muted);">{{ issue.location }}</span></td>
                  <td><span class="badge badge-blue">{{ issue.category }}</span></td>
                  <td><span class="status-badge" [class]="issue.status.toLowerCase()">{{ issue.status }}</span></td>
                  <td><span class="priority-dot" [class]="'p' + (issue.priority || 1)"></span> {{ issue.priority }}/5</td>
                  <td style="font-weight: 700;">▲ {{ issue.upvotes }}</td>
                  <td style="color: var(--text-muted);">{{ issue.createdAt | date:'short' }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>
    </app-layout>
  `,
})
export class MayorDashboardComponent implements OnInit {
  stats: DashboardStats | null = null;
  criticalIssues: Issue[] = [];
  departments = [
    { name: 'Public Works', code: 'PW', budget: 5000000, issueCount: 12 },
    { name: 'Sanitation', code: 'SAN', budget: 3000000, issueCount: 8 },
    { name: 'Public Safety', code: 'PS', budget: 12000000, issueCount: 15 },
    { name: 'Utilities', code: 'UT', budget: 8000000, issueCount: 6 },
    { name: 'Housing', code: 'HO', budget: 6000000, issueCount: 4 },
    { name: 'Parks & Rec', code: 'PR', budget: 2500000, issueCount: 7 },
  ];

  navItems = [
    { icon: 'dashboard', label: 'Overview', route: '/mayor' },
    { icon: 'analytics', label: 'Analytics', route: '/mayor/analytics' },
    { icon: 'campaign', label: 'Resolutions', route: '/mayor/resolutions' },
    { icon: 'campaign', label: 'Polls', route: '/mayor/polls' },
    { icon: 'calendar_month', label: 'Calendar', route: '/mayor/calendar' },
    { icon: 'campaign', label: 'Announcements', route: '/mayor/announcements' },
  ];

  constructor(public auth: AuthService, private api: ApiService) {}

  ngOnInit() {
    this.api.getIssueStats().subscribe(res => {
      if (res.success) { this.stats = res.data; this.criticalIssues = res.data.recentIssues.slice(0, 5); }
    });
  }
}
