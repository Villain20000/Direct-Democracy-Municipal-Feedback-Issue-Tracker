import { Component, OnInit, inject } from '@angular/core';
import { CommonModule, DatePipe, formatDate } from '@angular/common';
import { RouterLink } from '@angular/router';
import { LayoutComponent } from '../../shared/layout.component';
import { AuthService } from '../../core/services/auth.service';
import { ApiService, BudgetOverviewRow } from '../../core/services/api.service';
import { TranslationService } from '../../core/i18n/translation.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { AuditLog } from '@dd/shared-types';
import { ActivityFeedComponent } from '../../shared/activity-feed.component';
import { CivicScoreComponent } from '../../shared/civic-score.component';
import { ChartComponent } from '../shared/chart.component';

interface AuditLogRow {
  id: string;
  timestamp: string;
  user: string;
  action: string;
  actionBadge: string;
  entity: string;
  details: string;
}

interface Anomaly {
  title: string;
  severity: string;
  desc: string;
  date: string;
  narrative?: string;
  recommendedAction?: string;
}

interface DeptScore {
  dept: string;
  pct: number;
}

@Component({
  selector: 'app-auditor-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, LayoutComponent, DatePipe, TranslatePipe, ActivityFeedComponent, CivicScoreComponent, ChartComponent],
  template: `
    <app-layout
      [pageTitle]="i18n.t('auditor.pageTitle')"
      [navItems]="navItems"
      (logout)="auth.logout()">

      <div class="stats-grid">
        <div class="stat-card"><div class="stat-icon slate" style="background:#F1F5F9;color:#475569;"><i class="material-icons-outlined">fact_check</i></div><div class="stat-info"><div class="stat-value">{{ auditTotal | number }}</div><div class="stat-label">{{ 'auditor.auditEntries' | t }}</div></div></div>
        <div class="stat-card"><div class="stat-icon red"><i class="material-icons-outlined">warning</i></div><div class="stat-info"><div class="stat-value">{{ anomalies.length }}</div><div class="stat-label">{{ 'auditor.anomalies' | t }}</div></div></div>
        <div class="stat-card"><div class="stat-icon green"><i class="material-icons-outlined">verified</i></div><div class="stat-info"><div class="stat-value">{{ complianceScore }}%</div><div class="stat-label">{{ 'auditor.compliance' | t }}</div></div></div>
        <div class="stat-card"><div class="stat-icon blue"><i class="material-icons-outlined">description</i></div><div class="stat-info"><div class="stat-value">{{ resolvedIssues }}</div><div class="stat-label">{{ 'auditor.issuesResolved' | t }}</div></div></div>
      </div>

      <div class="content-grid">
        <app-activity-feed [limit]="6" />
        <app-civic-score [userId]="auth.user()?.id" />
      </div>

      <div class="content-grid">
        <div class="card">
          <div class="card-header"><h3>{{ 'auditor.explorer' | t }}</h3><div class="card-actions">
            <a class="btn btn-secondary btn-sm" routerLink="/auditor/logs">{{ 'common.viewAll' | t }}</a>
            <button class="btn btn-primary btn-sm" (click)="exportAudit()" [disabled]="exporting">
              @if (exporting) { {{ 'auditor.exporting' | t }} } @else { <i class="material-icons-outlined" style="font-size:16px;">download</i> {{ 'auditor.export' | t }} }
            </button>
          </div></div>
          <div class="card-body" style="padding:0;">
            <table class="data-table">
              <thead><tr><th>{{ 'auditor.timestamp' | t }}</th><th>{{ 'auditor.user' | t }}</th><th>{{ 'auditor.action' | t }}</th><th>{{ 'auditor.entity' | t }}</th><th>{{ 'auditor.details' | t }}</th></tr></thead>
              <tbody>
                @for (log of auditLogs; track log.id) {
                  <tr style="cursor:pointer;" (click)="toggleLogDetails(log.id)">
                    <td style="font-size:12px;color:var(--text-muted);">{{ log.timestamp }}</td>
                    <td><strong>{{ log.user }}</strong></td>
                    <td><span class="badge" [class]="log.actionBadge">{{ log.action }}</span></td>
                    <td>{{ log.entity }}</td>
                    <td style="font-size:12px;color:var(--text-secondary);max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">{{ log.details }}</td>
                  </tr>
                  @if (expandedLogId === log.id) {
                    <tr>
                      <td colspan="5" style="background:var(--bg-primary);padding:12px 16px;font-size:12px;font-family:monospace;word-break:break-all;">{{ log.details }}</td>
                    </tr>
                  }
                } @empty {
                  <tr><td colspan="5" style="text-align:center;padding:32px;color:var(--text-muted);">{{ 'auditor.empty' | t }}</td></tr>
                }
              </tbody>
            </table>
          </div>
        </div>
        <div class="card">
          <div class="card-header"><h3>{{ 'auditor.anomalyTitle' | t }}</h3></div>
          <div class="card-body">
            @if (anomalySummary) {
              <p style="font-size:13px;color:var(--text-secondary);margin-bottom:12px;padding:10px;background:var(--bg-primary);border-radius:var(--radius);">{{ anomalySummary }}</p>
            }
            @for (anomaly of anomalies; track anomaly.title) {
              <div style="padding:14px;border:1px solid var(--border);border-radius:var(--radius);margin-bottom:10px;border-left:4px solid var(--danger);">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
                  <strong style="font-size:13px;">{{ anomaly.title }}</strong>
                  <span class="badge badge-red">{{ anomaly.severity }}</span>
                </div>
                <p style="font-size:12px;color:var(--text-secondary);">{{ anomaly.narrative || anomaly.desc }}</p>
                @if (anomaly.recommendedAction) {
                  <p style="font-size:12px;color:var(--primary);margin-top:6px;"><strong>{{ 'auditor.recommendedAction' | t }}:</strong> {{ anomaly.recommendedAction }}</p>
                }
                <div style="font-size:11px;color:var(--text-muted);margin-top:6px;">{{ i18n.t('auditor.detected', { date: (anomaly.date | date:'mediumDate') || '' }) }}</div>
              </div>
            } @empty {
              <div style="text-align:center;padding:24px;color:var(--text-muted);">{{ 'auditor.anomalyEmpty' | t }}</div>
            }
            <div style="margin-top:16px;">
              <div style="font-size:13px;font-weight:600;margin-bottom:12px;">{{ 'auditor.quality' | t }}</div>
              @for (score of qualityScores; track score.dept) {
                <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
                  <span style="font-size:12px;width:100px;color:var(--text-secondary);">{{ score.dept }}</span>
                  <div style="flex:1;background:var(--bg-primary);border-radius:3px;height:6px;">
                    <div [style.width.%]="score.pct" [style.background]="score.pct >= 80 ? '#16A34A' : score.pct >= 60 ? '#D97706' : '#DC2626'" style="height:100%;border-radius:3px;"></div>
                  </div>
                  <span style="font-size:12px;font-weight:700;width:40px;text-align:right;">{{ score.pct }}%</span>
                </div>
              } @empty {
                <div style="font-size:12px;color:var(--text-muted);">{{ 'auditor.noDeptData' | t }}</div>
              }
            </div>
          </div>
        </div>
      </div>

      <div class="card" style="margin-bottom:16px;" data-testid="auditor-resolution-timeline">
        <div class="card-header"><h3>{{ 'auditor.resolutionTimeline' | t }}</h3></div>
        <div class="card-body">
          @if (timelineLabels.length) {
            <app-chart
              kind="line"
              [labels]="timelineLabels"
              [data]="timelineCreated"
              [data2]="timelineResolved"
              [datasetLabel]="i18n.t('auditor.timelineCreated')"
              [datasetLabel2]="i18n.t('auditor.timelineResolved')"
              [height]="220" />
          } @else {
            <p style="color:var(--text-muted);font-size:13px;">{{ 'auditor.resolutionTimelineEmpty' | t }}</p>
          }
        </div>
      </div>

      <div class="card" style="margin-bottom:16px;" data-testid="auditor-er-graph">
        <div class="card-header"><h3>{{ 'auditor.erGraphTitle' | t }}</h3></div>
        <div class="card-body">
          <p style="font-size:12px;color:var(--text-muted);margin-bottom:12px;">{{ 'auditor.erGraphDesc' | t }}</p>
          <svg viewBox="0 0 900 340" width="100%" role="img" [attr.aria-label]="i18n.t('auditor.erGraphTitle')" style="max-width:900px;">
            @for (node of erNodes; track node.label) {
              <g>
                <rect [attr.x]="node.x" [attr.y]="node.y" width="150" height="52" rx="8"
                  fill="var(--bg-primary)" stroke="var(--primary)" stroke-width="1.5" />
                <text [attr.x]="node.x + 75" [attr.y]="node.y + 22" text-anchor="middle"
                  style="font-size:12px;font-weight:700;fill:var(--text-primary);">{{ node.label }}</text>
                <text [attr.x]="node.x + 75" [attr.y]="node.y + 39" text-anchor="middle"
                  style="font-size:10px;fill:var(--text-muted);">{{ node.sub }}</text>
              </g>
            }
            @for (edge of erEdges; track edge.label) {
              <g>
                <line [attr.x1]="edge.x1" [attr.y1]="edge.y1" [attr.x2]="edge.x2" [attr.y2]="edge.y2"
                  stroke="var(--border)" stroke-width="1.5" />
                <text [attr.x]="(edge.x1 + edge.x2) / 2" [attr.y]="(edge.y1 + edge.y2) / 2 - 5" text-anchor="middle"
                  style="font-size:10px;fill:var(--primary);">{{ edge.label }}</text>
              </g>
            }
          </svg>
        </div>
      </div>

      <div class="card" style="margin-bottom:16px;" data-testid="auditor-budget-trail">
        <div class="card-header" style="display:flex;justify-content:space-between;align-items:center;">
          <h3>{{ 'auditor.budgetTrailTitle' | t }}</h3>
          <button type="button" class="btn btn-secondary btn-sm" (click)="downloadCsv('expenses-export.csv', expensesRequest)" [disabled]="exporting">{{ 'auditor.budgetCsv' | t }}</button>
        </div>
        <div class="card-body">
          @if (budgetTrail.length) {
            <div style="display:flex;gap:24px;margin-bottom:12px;">
              <div><div style="font-size:20px;font-weight:800;">{{ budgetTrailAllocated | number }}</div><div style="font-size:12px;color:var(--text-muted);">{{ 'auditor.budgetAllocated' | t }}</div></div>
              <div><div style="font-size:20px;font-weight:800;">{{ budgetTrailSpent | number }}</div><div style="font-size:12px;color:var(--text-muted);">{{ 'auditor.budgetSpent' | t }}</div></div>
              <div><div style="font-size:20px;font-weight:800;">{{ budgetTrailAllocated - budgetTrailSpent | number }}</div><div style="font-size:12px;color:var(--text-muted);">{{ 'auditor.budgetRemaining' | t }}</div></div>
            </div>
            @for (row of budgetTrail.slice(0, 6); track row.departmentId) {
              <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px;">
                <span style="font-size:13px;width:170px;color:var(--text-secondary);">{{ row.name }}</span>
                <div style="flex:1;background:var(--bg-primary);border-radius:4px;height:8px;">
                  <div [style.width.%]="row.pctUsed" style="height:100%;border-radius:4px;background:var(--primary);"></div>
                </div>
                <span style="font-size:13px;font-weight:700;width:110px;text-align:right;">{{ row.spent | number }}</span>
              </div>
            }
          } @else {
            <p style="color:var(--text-muted);font-size:13px;">{{ 'auditor.budgetTrailEmpty' | t }}</p>
          }
        </div>
      </div>

      <div class="card">
        <div class="card-header"><h3>{{ 'auditor.reportGen' | t }}</h3></div>
        <div class="card-body">
          <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;">
            @for (report of reportTypes; track report.titleKey) {
              <button type="button" class="btn btn-secondary" style="padding:20px;text-align:center;height:auto;" (click)="exportReport(report.type)" [disabled]="exporting">
                <i class="material-icons-outlined" style="font-size:32px;color:var(--primary);">{{ report.icon }}</i>
                <div style="font-size:13px;font-weight:600;margin-top:8px;">{{ i18n.t(report.titleKey) }}</div>
                <div style="font-size:11px;color:var(--text-muted);">{{ 'auditor.csv' | t }}</div>
              </button>
            }
          </div>
        </div>
      </div>
    </app-layout>
  `,
})
export class AuditorDashboardComponent implements OnInit {
  auditLogs: AuditLogRow[] = [];
  expandedLogId = '';
  auditTotal = 0;
  anomalies: Anomaly[] = [];
  anomalySummary = '';
  qualityScores: DeptScore[] = [];
  complianceScore = 0;
  resolvedIssues = 0;
  exporting = false;
  /** Weekly created-vs-resolved series for the resolution timeline chart. */
  timelineLabels: string[] = [];
  timelineCreated: number[] = [];
  timelineResolved: number[] = [];
  /** P2-20 — budget expenditure audit trail (plan-vs-spend per department). */
  budgetTrail: BudgetOverviewRow[] = [];
  budgetTrailAllocated = 0;
  budgetTrailSpent = 0;
  /** P2-20 — schema-driven entity-relationship graph (Prisma model names). */
  erNodes = [
    { label: 'User', sub: 'reporter · staff', x: 20, y: 20 },
    { label: 'Department', sub: 'budget owner', x: 375, y: 20 },
    { label: 'Ward', sub: 'district', x: 730, y: 20 },
    { label: 'Issue', sub: 'core entity', x: 200, y: 144 },
    { label: 'Comment', sub: 'threaded', x: 555, y: 144 },
    { label: 'AuditLog', sub: 'immutable', x: 20, y: 268 },
    { label: 'BudgetLine', sub: 'plan', x: 375, y: 268 },
    { label: 'Expense', sub: 'spend', x: 730, y: 268 },
  ];
  erEdges = [
    { label: 'reports', x1: 95, y1: 72, x2: 230, y2: 144 },
    { label: 'owns', x1: 450, y1: 72, x2: 320, y2: 144 },
    { label: 'in', x1: 805, y1: 72, x2: 320, y2: 144 },
    { label: 'on', x1: 350, y1: 170, x2: 555, y2: 170 },
    { label: 'logs', x1: 200, y1: 196, x2: 95, y2: 268 },
    { label: 'plans', x1: 450, y1: 72, x2: 450, y2: 268 },
    { label: 'spends', x1: 525, y1: 294, x2: 730, y2: 294 },
    { label: 'audits', x1: 730, y1: 268, x2: 170, y2: 268 },
  ];
  navItems = [
    { icon: 'dashboard', label: 'nav.overview', route: '/auditor' },
    { icon: 'fact_check', label: 'nav.auditLog', route: '/auditor/logs' },
    { icon: 'warning', label: 'nav.anomalies', route: '/auditor/anomalies' },
    { icon: 'description', label: 'nav.reports', route: '/auditor/reports' },
    { icon: 'verified', label: 'nav.compliance', route: '/auditor/compliance' },
  ] as any;
  reportTypes = [
    { icon: 'assessment', titleKey: 'auditor.issueSummary', type: 'issues' as const },
    { icon: 'history', titleKey: 'auditor.auditExport', type: 'audit' as const },
    { icon: 'payments', titleKey: 'auditor.expenseExport', type: 'expenses' as const },
  ];

  private readonly locale = 'en-US';

  auth = inject(AuthService);
  api = inject(ApiService);
  i18n = inject(TranslationService);

  ngOnInit() {
    this.api.getAuditLogs({ pageSize: '10' }).subscribe((res: any) => {
      const logs: AuditLog[] = res.data || [];
      this.auditTotal = res.total || logs.length;
      this.auditLogs = logs.map(log => this.mapAuditLog(log));
    });

    this.api.getAuditAnomalies().subscribe({
      next: (res) => {
        const data = res.data;
        this.anomalySummary = data?.summary || '';
        this.anomalies = (data?.items || data?.anomalies || []).map((a: any) => ({
          title: a.title,
          severity: a.severity,
          desc: a.desc || a.narrative || '',
          date: a.date || new Date().toISOString(),
          narrative: a.narrative,
          recommendedAction: a.recommendedAction,
        }));
      },
    });

    this.api.getDepartmentResolutionRates().subscribe({
      next: (res) => {
        this.qualityScores = (res.data || []).map(d => ({ dept: d.department, pct: d.pct }));
      },
    });

    this.api.getIssueStats().subscribe({
      next: (res) => {
        if (res.data) {
          const { totalIssues, resolvedIssues } = res.data;
          this.resolvedIssues = resolvedIssues;
          this.complianceScore = totalIssues
            ? Math.round((resolvedIssues / totalIssues) * 100)
            : 0;
        }
      },
    });

    this.api.getIssueTrends(12).subscribe({
      next: (res) => {
        if (!res.success || !res.data?.length) return;
        this.timelineLabels = res.data.map((b) => b.weekStart.slice(5)); // MM-DD
        this.timelineCreated = res.data.map((b) => b.created);
        this.timelineResolved = res.data.map((b) => b.resolved);
      },
      error: () => {},
    });

    this.loadBudgetTrail();
  }

  /** P2-20 — real plan-vs-spend numbers for the expenditure audit trail. */
  loadBudgetTrail() {
    this.api.getBudgetOverview().subscribe({
      next: (res) => {
        if (!res.success || !Array.isArray(res.data)) return;
        this.budgetTrail = res.data;
        this.budgetTrailAllocated = res.data.reduce((s, r) => s + (r.budget || 0), 0);
        this.budgetTrailSpent = res.data.reduce((s, r) => s + (r.spent || 0), 0);
      },
      error: () => {},
    });
  }

  /** CSV request factory for the budget-trail export button. */
  expensesRequest = () => this.api.exportExpensesCsv();

  exportAudit() { this.downloadCsv('audit-export.csv', () => this.api.exportAuditCsv()); }
  toggleLogDetails(id: string) {
    this.expandedLogId = this.expandedLogId === id ? '' : id;
  }
  exportReport(type: 'issues' | 'audit' | 'expenses') {
    if (type === 'issues') this.downloadCsv('issues-export.csv', () => this.api.exportIssuesCsv());
    else if (type === 'expenses') this.downloadCsv('expenses-export.csv', () => this.api.exportExpensesCsv());
    else this.exportAudit();
  }

  downloadCsv(filename: string, request: () => import('rxjs').Observable<Blob>) {
    this.exporting = true;
    request().subscribe({
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

  private mapAuditLog(log: AuditLog): AuditLogRow {
    const user = log.user ? `${log.user.firstName} ${log.user.lastName}` : log.userId;
    const details = log.newValues ? JSON.stringify(log.newValues) : log.oldValues ? JSON.stringify(log.oldValues) : `${log.action} on ${log.entity}`;
    return {
      id: log.id,
      timestamp: formatDate(log.createdAt, 'medium', this.locale),
      user,
      action: log.action,
      actionBadge: this.getActionBadge(log.action),
      entity: `${log.entity} #${log.entityId.slice(0, 8)}`,
      details,
    };
  }

  private getActionBadge(action: string): string {
    const upper = action.toUpperCase();
    if (upper.includes('CREATE')) return 'badge-green';
    if (upper.includes('UPDATE') || upper.includes('BULK')) return 'badge-blue';
    if (upper.includes('ASSIGN')) return 'badge-purple';
    if (upper.includes('RESOLVE') || upper.includes('VERIFY')) return 'badge-green';
    if (upper.includes('DELETE')) return 'badge-red';
    return 'badge-slate';
  }
}
