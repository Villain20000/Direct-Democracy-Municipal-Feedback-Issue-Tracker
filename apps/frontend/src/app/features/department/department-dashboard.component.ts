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
import { DashboardStats, Issue, User } from '@dd/shared-types';
import { BudgetSummary } from '../../core/services/api.service';
import { ActivityFeedComponent } from '../../shared/activity-feed.component';
import { CivicScoreComponent } from '../../shared/civic-score.component';
import { ChartComponent } from '../shared/chart.component';

@Component({
  selector: 'app-department-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, LayoutComponent, CurrencyPipe, TranslatePipe, ActivityFeedComponent, CivicScoreComponent, ChartComponent],
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
        <div class="stat-card" routerLink="/sla-breaches" style="cursor:pointer;" [title]="'department.slaBreached' | t"><div class="stat-icon red"><i class="material-icons-outlined">timer_off</i></div><div class="stat-info"><div class="stat-value">{{ slaBreachedCount }}</div><div class="stat-label">{{ 'department.slaBreached' | t }}</div></div></div>
      </div>

      <div class="content-grid">
        <app-activity-feed [limit]="6" />
        <app-civic-score [userId]="auth.user()?.id" />
      </div>

      <div class="content-grid">
        <div class="card">
          <div class="card-header"><h3>{{ 'department.staffWorkload' | t }}</h3></div>
          <div class="card-body">
            @if (workloadLabels.length) {
              <div style="margin-bottom:16px;">
                <app-chart kind="bar" [labels]="workloadLabels" [data]="workloadCounts" [height]="180" [showLegend]="false" />
              </div>
            }
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
            @if (budgetSummary) {
              <div style="margin-bottom: 20px;">
                <div style="display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 6px;">
                  <span>{{ 'department.totalBudget' | t }}</span>
                  <strong>{{ budgetSummary.totalBudget | currency:'USD':'symbol':'1.0-0' }}</strong>
                </div>
                <div style="background: var(--bg-primary); border-radius: 4px; height: 12px;"><div [style.width.%]="budgetSummary.pctUsed" style="background: var(--primary); height: 100%; border-radius: 4px;"></div></div>
                <div style="display: flex; justify-content: space-between; font-size: 11px; color: var(--text-muted); margin-top: 4px;">
                  <span>{{ 'department.spent' | t: { pct: budgetSummary.pctUsed, spent: (budgetSummary.totalSpent | currency:'USD':'symbol':'1.0-0') } }}</span>
                  <span>{{ 'department.remaining' | t: { pct: 100 - budgetSummary.pctUsed, remaining: (budgetSummary.totalRemaining | currency:'USD':'symbol':'1.0-0') } }}</span>
                </div>
              </div>
              @if (budgetSummary.categories.length) {
                <div style="font-size: 13px; font-weight: 600; margin-bottom: 12px;">{{ 'department.spendingByCategory' | t }}</div>
                @for (cat of budgetSummary.categories; track cat.category) {
                  <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px;">
                    <span style="font-size: 12px; width: 100px; color: var(--text-secondary);">{{ cat.category }}</span>
                    <div style="flex: 1; background: var(--bg-primary); border-radius: 3px; height: 6px;">
                      <div [style.width.%]="cat.pctUsed || 0" style="background: var(--primary); height: 100%; border-radius: 3px;"></div>
                    </div>
                    <span style="font-size: 12px; font-weight: 600;">{{ cat.spent | currency:'USD':'symbol':'1.0-0' }}</span>
                  </div>
                }
              }
              <a routerLink="/department/budget" class="btn btn-secondary btn-sm" style="width:100%;margin-top:8px;">{{ 'department.manageBudget' | t }}</a>
            } @else {
              <p style="color: var(--text-muted); font-size: 13px;">{{ 'department.budgetLoading' | t }}</p>
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
                <tr>
                  <td style="font-weight: 700; color: var(--text-muted);">{{ i + 1 }}</td>
                  <td>
                    <a [routerLink]="['/issues', issue.id]" style="font-weight:600;color:inherit;">{{ issue.title }}</a>
                    @if (slaRiskMap[issue.id]) {
                      <span class="badge" [class]="slaRiskBadge(slaRiskMap[issue.id].risk)" style="margin-left:6px;font-size:10px;" [title]="slaRiskMap[issue.id].justification">
                        SLA {{ slaRiskMap[issue.id].risk }}
                      </span>
                    }
                  </td>
                  <td><span class="status-badge" [ngClass]="statusClass(issue.status)">{{ formatStatus(issue.status) }}</span></td>
                  <td><span class="priority-dot" [ngClass]="'p' + (issue.priority || 3)"></span> {{ issue.priority || 'N/A' }}/5</td>
                  <td (click)="$event.stopPropagation()">
                    <select
                      [attr.data-testid]="'dept-assign-' + issue.id"
                      [value]="issue.assigneeId || issue.assignee?.id || ''"
                      (change)="quickAssign(issue, $event)"
                      style="padding:6px 8px;border:1px solid var(--border);border-radius:var(--radius);font-size:12px;max-width:140px;">
                      <option value="">{{ i18n.t('common.none') }}</option>
                      @for (member of staffMembers; track member.id) {
                        <option [value]="member.id">{{ member.firstName }} {{ member.lastName }}</option>
                      }
                    </select>
                  </td>
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
  slaRiskMap: Record<string, { risk: string; justification: string }> = {};
  staffMembers: User[] = [];
  /** Real workload: open issues assigned per staff member (PLAN §10). */
  staffWorkload: Array<{ name: string; initials: string; active: number; capacity: number }> = [];
  workloadLabels: string[] = [];
  workloadCounts: number[] = [];
  private workloadIssues: Issue[] = [];
  private workloadIssuesLoaded = false;
  private staffLoaded = false;
  budgetSummary: BudgetSummary | null = null;
  /** P0-1 — live count of breached SLAs (GET /sla/breached). */
  slaBreachedCount = 0;

  navItems = [
    { icon: 'dashboard', label: 'nav.overview', route: '/department' },
    { icon: 'assignment', label: 'nav.issues', route: '/department/issues' },
    { icon: 'people', label: 'nav.staff', route: '/department/staff' },
    { icon: 'account_balance_wallet', label: 'nav.budget', route: '/department/budget' },
    { icon: 'assessment', label: 'nav.reports', route: '/department/reports' },
    { icon: 'library_books', label: 'nav.documents', route: '/admin/documents' },
  ] as any;

  auth = inject(AuthService);
  api = inject(ApiService);
  toast = inject(ToastService);
  i18n = inject(TranslationService);

  get inProgressCount(): number {
    return this.stats?.issuesByStatus?.IN_PROGRESS || 0;
  }

  /**
   * P1-10: real escalation counter from the stats endpoint
   * (issues with `escalatedAt` set). Falls back to the loaded page
   * when stats are unavailable.
   */
  get escalatedCount(): number {
    if (typeof this.stats?.escalatedCount === 'number') return this.stats.escalatedCount;
    return this.issues.filter(i => !!(i as Issue).escalatedAt).length;
  }

  ngOnInit() {
    const departmentId = this.auth.user()?.departmentId;
    if (!departmentId) return;
    this.api.getUsers({ role: 'STAFF', pageSize: '50' }).subscribe({
      next: (res: any) => {
        if (res.data) {
          this.staffMembers = res.data;
          this.staffLoaded = true;
          this.computeWorkload();
        }
      },
    });
    // Open (non-terminal) issues for this department — used to count
    // real per-staff workload instead of the old hardcoded array.
    this.api.getIssues({ departmentId, pageSize: '200' }).subscribe({
      next: (res: any) => {
        this.workloadIssues = res.data || [];
        this.workloadIssuesLoaded = true;
        this.computeWorkload();
      },
      error: () => {},
    });
    this.api.getIssues({ departmentId, pageSize: '8' }).subscribe((res: any) => {
      if (res.data) {
        this.issues = res.data;
        this.loadSlaRisks();
      }
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
    // Real budget tracker data (P1-9 — replaces the old hardcoded
    // $5,000,000 / fixed category array).
    this.api.getBudgetSummary(departmentId).subscribe({
      next: (res) => { if (res.success) this.budgetSummary = res.data; },
      error: () => {},
    });
    // P0-1 — breached SLA counter; the stat card links to /sla-breaches.
    this.api.getSlaBreaches().subscribe({
      next: (res) => { if (res.success) this.slaBreachedCount = res.data.length; },
      error: () => {},
    });
  }

  getStars(count: number): number[] { return Array(Math.max(0, count)); }

  /**
   * Build the workload list + chart datasets from real data:
   * staff roster (getUsers) × open issues assigned to each of them.
   * Capacity defaults to 12 (the visual scale used by the star meter).
   */
  private computeWorkload() {
    if (!this.staffLoaded || !this.workloadIssuesLoaded) return;
    const terminal = new Set(['RESOLVED', 'VERIFIED', 'REJECTED']);
    const openByAssignee: Record<string, number> = {};
    for (const issue of this.workloadIssues) {
      if (!issue.assigneeId || terminal.has(issue.status)) continue;
      openByAssignee[issue.assigneeId] = (openByAssignee[issue.assigneeId] || 0) + 1;
    }
    this.staffWorkload = this.staffMembers.map((s) => ({
      name: `${s.firstName} ${s.lastName}`,
      initials: `${s.firstName?.[0] || ''}${s.lastName?.[0] || ''}`.toUpperCase(),
      active: openByAssignee[s.id] || 0,
      capacity: 12,
    }));
    // Chart dataset (PLAN §10 — "Staff workload distribution chart")
    this.workloadLabels = this.staffWorkload.map((s) => s.name);
    this.workloadCounts = this.staffWorkload.map((s) => s.active);
  }

  statusClass(status: string): string {
    return status.toLowerCase().replace(/_/g, '-');
  }

  formatStatus(status: string): string {
    return this.i18n.tEnum('status', status);
  }

  quickAssign(issue: Issue, event: Event) {
    const assigneeId = (event.target as HTMLSelectElement).value;
    if (!assigneeId) return;
    this.api.assignIssue(issue.id, assigneeId, issue.departmentId).subscribe({
      next: (res) => {
        if (res.success) {
          const idx = this.issues.findIndex((i) => i.id === issue.id);
          if (idx >= 0) this.issues[idx] = { ...this.issues[idx], ...res.data };
          this.toast.success(this.i18n.t('detail.assignSuccess'));
        }
      },
      error: () => this.toast.error(this.i18n.t('detail.assignFailed')),
    });
  }

  loadSlaRisks() {
    if (!this.issues.length) return;
    this.api.aiSlaRisk(this.issues.map((i) => i.id)).subscribe({
      next: (res) => {
        const map: Record<string, { risk: string; justification: string }> = {};
        for (const row of res.data || []) {
          map[row.issueId] = { risk: row.risk, justification: row.justification };
        }
        this.slaRiskMap = map;
      },
    });
  }

  slaRiskBadge(risk: string): string {
    const r = (risk || '').toLowerCase();
    if (r === 'high') return 'badge-red';
    if (r === 'medium') return 'badge-amber';
    return 'badge-green';
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
