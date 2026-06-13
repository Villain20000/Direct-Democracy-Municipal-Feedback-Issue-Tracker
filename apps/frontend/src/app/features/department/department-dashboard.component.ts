import { Component, OnInit } from '@angular/core';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { LayoutComponent } from '../../shared/layout.component';
import { AuthService } from '../../core/services/auth.service';
import { ApiService } from '../../core/services/api.service';
import { Issue } from '@dd/shared-types';

@Component({
  selector: 'app-department-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, LayoutComponent, CurrencyPipe],
  template: `
    <app-layout
      pageTitle="Department Dashboard"
      [navItems]="navItems"
      [notifCount]="3"
      (logout)="auth.logout()">

      <div class="stats-grid">
        <div class="stat-card"><div class="stat-icon blue"><i class="material-icons-outlined">assignment</i></div><div class="stat-info"><div class="stat-value">42</div><div class="stat-label">Department Issues</div></div></div>
        <div class="stat-card"><div class="stat-icon amber"><i class="material-icons-outlined">pending</i></div><div class="stat-info"><div class="stat-value">18</div><div class="stat-label">In Progress</div></div></div>
        <div class="stat-card"><div class="stat-icon green"><i class="material-icons-outlined">task_alt</i></div><div class="stat-info"><div class="stat-value">21</div><div class="stat-label">Resolved</div><div class="stat-change up">↑ 15% vs last month</div></div></div>
        <div class="stat-card"><div class="stat-icon red"><i class="material-icons-outlined">warning</i></div><div class="stat-info"><div class="stat-value">3</div><div class="stat-label">Escalated</div></div></div>
      </div>

      <div class="content-grid">
        <div class="card">
          <div class="card-header"><h3>Staff Workload</h3></div>
          <div class="card-body">
            @for (staff of staffWorkload; track staff.name) {
              <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 14px;">
                <div style="width: 36px; height: 36px; border-radius: 50%; background: var(--primary); color: white; display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 700;">{{ staff.initials }}</div>
                <div style="flex: 1;">
                  <div style="font-size: 13px; font-weight: 600;">{{ staff.name }}</div>
                  <div style="display: flex; gap: 4px; margin-top: 4px;">
                    @for (i of getStars(staff.active); track i) {
                      <div style="width: 12px; height: 12px; border-radius: 3px; background: var(--primary);"></div>
                    }
                    @for (i of getStars(staff.capacity - staff.active); track i) {
                      <div style="width: 12px; height: 12px; border-radius: 3px; background: var(--border);"></div>
                    }
                  </div>
                </div>
                <div style="text-align: right;"><div style="font-size: 18px; font-weight: 800;">{{ staff.active }}</div><div style="font-size: 11px; color: var(--text-muted);">active tasks</div></div>
              </div>
            }
          </div>
        </div>
        <div class="card">
          <div class="card-header"><h3>Budget Tracker</h3></div>
          <div class="card-body">
            <div style="margin-bottom: 20px;">
              <div style="display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 6px;"><span>Total Budget</span><strong>$5,000,000</strong></div>
              <div style="background: var(--bg-primary); border-radius: 4px; height: 12px;"><div style="width: 68%; background: var(--primary); height: 100%; border-radius: 4px;"></div></div>
              <div style="display: flex; justify-content: space-between; font-size: 11px; color: var(--text-muted); margin-top: 4px;"><span>68% spent ($3.4M)</span><span>32% remaining ($1.6M)</span></div>
            </div>
            <div style="font-size: 13px; font-weight: 600; margin-bottom: 12px;">Spending by Category</div>
            @for (cat of budgetCategories; track cat.name) {
              <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px;">
                <span style="font-size: 12px; width: 100px; color: var(--text-secondary);">{{ cat.name }}</span>
                <div style="flex: 1; background: var(--bg-primary); border-radius: 3px; height: 6px;">
                  <div [style.width.%]="cat.pct" [style.background]="cat.color" style="height: 100%; border-radius: 3px;"></div>
                </div>
                <span style="font-size: 12px; font-weight: 600;">{{ cat.amount }}</span>
              </div>
            }
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-header"><h3>AI Priority-Ranked Issues</h3><button class="btn btn-primary btn-sm"><i class="material-icons-outlined" style="font-size:16px;">auto_awesome</i> Re-rank with AI</button></div>
        <div class="card-body" style="padding: 0;">
          <table class="data-table">
            <thead><tr><th>#</th><th>Title</th><th>Status</th><th>AI Priority</th><th>Assigned To</th><th>Upvotes</th></tr></thead>
            <tbody>
              @for (issue of issues; track issue.id; let i = $index) {
                <tr [routerLink]="['/issues', issue.id]" style="cursor: pointer;">
                  <td style="font-weight: 700; color: var(--text-muted);">{{ i + 1 }}</td>
                  <td><strong>{{ issue.title }}</strong></td>
                  <td><span class="status-badge" [class]="issue.status.toLowerCase()">{{ issue.status }}</span></td>
                  <td><span class="priority-dot" [class]="'p' + (issue.priority || 3)"></span> {{ issue.priority || 'N/A' }}/5</td>
                  <td>{{ issue.assignee?.firstName || 'Unassigned' }}</td>
                  <td>▲ {{ issue.upvotes }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>
    </app-layout>
  `,
})
export class DepartmentDashboardComponent implements OnInit {
  issues: Issue[] = [];
  staffWorkload = [
    { name: 'Tom Wilson', initials: 'TW', active: 8, capacity: 12 },
    { name: 'Sarah Adams', initials: 'SA', active: 6, capacity: 12 },
    { name: 'Mike Chen', initials: 'MC', active: 11, capacity: 12 },
    { name: 'Lisa Park', initials: 'LP', active: 4, capacity: 12 },
  ];
  budgetCategories = [
    { name: 'Repairs', amount: '$1.2M', pct: 60, color: '#2563EB' },
    { name: 'Materials', amount: '$800K', pct: 40, color: '#16A34A' },
    { name: 'Labor', amount: '$1.1M', pct: 55, color: '#7C3AED' },
    { name: 'Equipment', amount: '$300K', pct: 15, color: '#D97706' },
  ];

  navItems = [
    { icon: 'dashboard', label: 'Overview', route: '/department' },
    { icon: 'assignment', label: 'Issues', route: '/department/issues' },
    { icon: 'people', label: 'Staff', route: '/department/staff' },
    { icon: 'account_balance_wallet', label: 'Budget', route: '/department/budget' },
    { icon: 'assessment', label: 'Reports', route: '/department/reports' },
  ];

  constructor(public auth: AuthService, private api: ApiService) {}
  ngOnInit() { this.api.getIssues({ departmentId: '', pageSize: '8' }).subscribe((res: any) => { if (res.data) this.issues = res.data; }); }
  getStars(count: number): number[] { return Array(Math.max(0, count)); }
}
