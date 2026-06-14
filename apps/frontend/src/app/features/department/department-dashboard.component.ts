import { Component, OnInit, inject } from '@angular/core';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { LayoutComponent } from '../../shared/layout.component';
import { AuthService } from '../../core/services/auth.service';
import { ApiService } from '../../core/services/api.service';
import { ToastService } from '../../core/services/toast.service';
import { TranslationService } from '../../core/i18n/translation.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { DashboardStats, Issue } from '@dd/shared-types';

@Component({
  selector: 'app-department-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, LayoutComponent, CurrencyPipe, TranslatePipe],
  template: `
    <app-layout
      [pageTitle]="i18n.t('department.pageTitle')"
      [navItems]="navItems"
      (logout)="auth.logout()">

      <div class="stats-grid">
        <div class="stat-card"><div class="stat-icon blue"><i class="material-icons-outlined">assignment</i></div><div class="stat-info"><div class="stat-value">{{ stats?.totalIssues || 0 }}</div><div class="stat-label">{{ 'department.totalIssues' | t }}</div></div></div>
        <div class="stat-card"><div class="stat-icon amber"><i class="material-icons-outlined">pending</i></div><div class="stat-info"><div class="stat-value">{{ inProgressCount }}</div><div class="stat-label">{{ 'department.inProgress' | t }}</div></div></div>
        <div class="stat-card"><div class="stat-icon green"><i class="material-icons-outlined">task_alt</i></div><div class="stat-info"><div class="stat-value">{{ stats?.resolvedIssues || 0 }}</div><div class="stat-label">{{ 'department.resolved' | t }}</div></div></div>
        <div class="stat-card"><div class="stat-icon red"><i class="material-icons-outlined">warning</i></div><div class="stat-info"><div class="stat-value">{{ escalatedCount }}</div><div class="stat-label">{{ 'department.escalated' | t }}</div></div></div>
      </div>

      <div class="content-grid">
        <div class="card">
          <div class="card-header"><h3>{{ 'department.staffWorkload' | t }}</h3></div>
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
                <div style="text-align: right;"><div style="font-size: 18px; font-weight: 800;">{{ staff.active }}</div><div style="font-size: 11px; color: var(--text-muted);">{{ 'department.activeTasks' | t }}</div></div>
              </div>
            }
          </div>
        </div>
        <div class="card">
          <div class="card-header"><h3>{{ 'department.budgetTracker' | t }}</h3></div>
          <div class="card-body">
            <div style="margin-bottom: 20px;">
              <div style="display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 6px;"><span>{{ 'department.totalBudget' | t }}</span><strong>$5,000,000</strong></div>
              <div style="background: var(--bg-primary); border-radius: 4px; height: 12px;"><div style="width: 68%; background: var(--primary); height: 100%; border-radius: 4px;"></div></div>
              <div style="display: flex; justify-content: space-between; font-size: 11px; color: var(--text-muted); margin-top: 4px;"><span>{{ 'department.spent' | t: { pct: 68, spent: '$3.4M' } }}</span><span>{{ 'department.remaining' | t: { pct: 32, remaining: '$1.6M' } }}</span></div>
            </div>
            <div style="font-size: 13px; font-weight: 600; margin-bottom: 12px;">{{ 'department.spendingByCategory' | t }}</div>
            @for (cat of budgetCategories; track cat.key) {
              <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px;">
                <span style="font-size: 12px; width: 100px; color: var(--text-secondary);">{{ i18n.t(cat.key) }}</span>
                <div style="flex: 1; background: var(--bg-primary); border-radius: 3px; height: 6px;">
                  <div [style.width.%]="cat.pct" [style.background]="cat.color" style="height: 100%; border-radius: 3px;"></div>
                </div>
                <span style="font-size: 12px; font-weight: 600;">{{ cat.amount }}</span>
              </div>
            }
          </div>
        </div>
      </div>

      @if (rerankMessage) {
        <div class="card" style="margin-bottom:16px;border-color:var(--success);">
          <div class="card-body" style="color:var(--success);font-size:13px;">{{ rerankMessage }}</div>
        </div>
      }
      @if (rerankError) {
        <div class="card" style="margin-bottom:16px;border-color:var(--danger);">
          <div class="card-body" style="color:var(--danger);font-size:13px;">{{ rerankError }}</div>
        </div>
      }

      <div class="card">
        <div class="card-header">
          <h3>{{ 'department.aiTitle' | t }}</h3>
          <button type="button" class="btn btn-primary btn-sm" (click)="rerankWithAi()" [disabled]="reranking || !issues.length">
            <i class="material-icons-outlined" style="font-size:16px;">auto_awesome</i>
            @if (reranking) { {{ 'department.ranking' | t }} } @else { {{ 'department.rerank' | t }} }
          </button>
        </div>
        <div class="card-body" style="padding: 0;">
          <table class="data-table">
            <thead><tr><th>{{ 'department.rankCol' | t }}</th><th>{{ 'department.titleCol' | t }}</th><th>{{ 'department.statusCol' | t }}</th><th>{{ 'department.priorityCol' | t }}</th><th>{{ 'department.assignedCol' | t }}</th><th>{{ 'department.upvotesCol' | t }}</th></tr></thead>
            <tbody>
              @for (issue of issues; track issue.id; let i = $index) {
                <tr [routerLink]="['/issues', issue.id]" style="cursor: pointer;">
                  <td style="font-weight: 700; color: var(--text-muted);">{{ i + 1 }}</td>
                  <td><strong>{{ issue.title }}</strong></td>
                  <td><span class="status-badge" [ngClass]="statusClass(issue.status)">{{ formatStatus(issue.status) }}</span></td>
                  <td><span class="priority-dot" [ngClass]="'p' + (issue.priority || 3)"></span> {{ issue.priority || 'N/A' }}/5</td>
                  <td>{{ issue.assignee?.firstName || i18n.t('common.none') }}</td>
                  <td>▲ {{ issue.upvotes }}</td>
                </tr>
              } @empty {
                <tr><td colspan="6" style="text-align:center;padding:32px;color:var(--text-muted);">{{ 'department.empty' | t }}</td></tr>
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
  stats: DashboardStats | null = null;
  reranking = false;
  rerankMessage = '';
  rerankError = '';
  staffWorkload = [
    { name: 'Tom Wilson', initials: 'TW', active: 8, capacity: 12 },
    { name: 'Sarah Adams', initials: 'SA', active: 6, capacity: 12 },
    { name: 'Mike Chen', initials: 'MC', active: 11, capacity: 12 },
    { name: 'Lisa Park', initials: 'LP', active: 4, capacity: 12 },
  ];
  budgetCategories = [
    { key: 'department.repairs', amount: '$1.2M', pct: 60, color: '#2563EB' },
    { key: 'department.materials', amount: '$800K', pct: 40, color: '#16A34A' },
    { key: 'department.labor', amount: '$1.1M', pct: 55, color: '#7C3AED' },
    { key: 'department.equipment', amount: '$300K', pct: 15, color: '#D97706' },
  ];

  navItems = [
    { icon: 'dashboard', label: 'nav.overview', route: '/department' },
    { icon: 'assignment', label: 'nav.issues', route: '/department/issues' },
    { icon: 'people', label: 'nav.staff', route: '/department/staff' },
    { icon: 'account_balance_wallet', label: 'nav.budget', route: '/department/budget' },
    { icon: 'assessment', label: 'nav.reports', route: '/department/reports' },
  ] as any;

  auth = inject(AuthService);
  api = inject(ApiService);
  toast = inject(ToastService);
  i18n = inject(TranslationService);

  get inProgressCount(): number {
    return this.stats?.issuesByStatus?.IN_PROGRESS || 0;
  }

  get escalatedCount(): number {
    return this.issues.filter(i => (i.priority || 0) >= 4).length;
  }

  ngOnInit() {
    const departmentId = this.auth.user()?.departmentId;
    if (!departmentId) return;
    this.api.getIssues({ departmentId, pageSize: '8' }).subscribe((res: any) => {
      if (res.data) this.issues = res.data;
    });
    this.api.getIssueStats({ departmentId }).subscribe({
      next: res => {
        if (res.success) {
          this.stats = res.data;
          this.toast.info(this.i18n.t('department.loaded', { n: this.stats?.totalIssues || 0 }));
        }
      },
      error: () => this.toast.error(this.i18n.t('department.statsFailed')),
    });
  }

  getStars(count: number): number[] { return Array(Math.max(0, count)); }

  statusClass(status: string): string {
    return status.toLowerCase().replace(/_/g, '-');
  }

  formatStatus(status: string): string {
    return this.i18n.tEnum('status', status);
  }

  rerankWithAi() {
    if (!this.issues.length || this.reranking) return;
    this.reranking = true;
    this.rerankMessage = '';
    this.rerankError = '';

    const requests = this.issues.map(issue =>
      this.api.aiPrioritize(`${issue.title}. ${issue.description}`, issue.category)
    );

    forkJoin(requests).subscribe({
      next: (results: any[]) => {
        this.issues = this.issues.map((issue, i) => ({
          ...issue,
          priority: results[i]?.data?.score ?? results[i]?.score ?? issue.priority,
        }));
        this.issues = [...this.issues].sort((a, b) => (b.priority || 0) - (a.priority || 0));
        this.rerankMessage = this.i18n.t('department.rerankSuccess');
        this.toast.success(this.i18n.t('department.rerankComplete'));
        this.reranking = false;
        setTimeout(() => { this.rerankMessage = ''; }, 4000);
      },
      error: () => {
        this.issues = [...this.issues].sort((a, b) => (b.priority || 0) - (a.priority || 0));
        this.rerankError = this.i18n.t('department.rerankFallback');
        this.toast.warning(this.i18n.t('department.rerankFailed'));
        this.reranking = false;
      },
    });
  }
}
