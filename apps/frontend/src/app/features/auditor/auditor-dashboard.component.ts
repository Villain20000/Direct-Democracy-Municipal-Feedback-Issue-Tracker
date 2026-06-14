import { Component, OnInit } from '@angular/core';
import { CommonModule, DatePipe, formatDate } from '@angular/common';
import { RouterLink } from '@angular/router';
import { LayoutComponent } from '../../shared/layout.component';
import { AuthService } from '../../core/services/auth.service';
import { ApiService } from '../../core/services/api.service';
import { AuditLog } from '@dd/shared-types';

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
}

interface DeptScore {
  dept: string;
  pct: number;
}

@Component({
  selector: 'app-auditor-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, LayoutComponent, DatePipe],
  template: `
    <app-layout
      pageTitle="Audit Center"
      [navItems]="navItems"
      (logout)="auth.logout()">

      <div class="stats-grid">
        <div class="stat-card"><div class="stat-icon slate" style="background:#F1F5F9;color:#475569;"><i class="material-icons-outlined">fact_check</i></div><div class="stat-info"><div class="stat-value">{{ auditTotal | number }}</div><div class="stat-label">Audit Trail Entries</div></div></div>
        <div class="stat-card"><div class="stat-icon red"><i class="material-icons-outlined">warning</i></div><div class="stat-info"><div class="stat-value">{{ anomalies.length }}</div><div class="stat-label">Anomalies Detected</div></div></div>
        <div class="stat-card"><div class="stat-icon green"><i class="material-icons-outlined">verified</i></div><div class="stat-info"><div class="stat-value">{{ complianceScore }}%</div><div class="stat-label">Compliance Score</div></div></div>
        <div class="stat-card"><div class="stat-icon blue"><i class="material-icons-outlined">description</i></div><div class="stat-info"><div class="stat-value">{{ resolvedIssues }}</div><div class="stat-label">Issues Resolved</div></div></div>
      </div>

      <div class="content-grid">
        <div class="card">
          <div class="card-header"><h3>🔍 Audit Log Explorer</h3><div class="card-actions">
            <a class="btn btn-secondary btn-sm" routerLink="/auditor/logs">View All</a>
            <button class="btn btn-primary btn-sm" (click)="exportAudit()" [disabled]="exporting">
              @if (exporting) { Exporting... } @else { <i class="material-icons-outlined" style="font-size:16px;">download</i> Export }
            </button>
          </div></div>
          <div class="card-body" style="padding:0;">
            <table class="data-table">
              <thead><tr><th>Timestamp</th><th>User</th><th>Action</th><th>Entity</th><th>Details</th></tr></thead>
              <tbody>
                @for (log of auditLogs; track log.id) {
                  <tr>
                    <td style="font-size:12px;color:var(--text-muted);">{{ log.timestamp }}</td>
                    <td><strong>{{ log.user }}</strong></td>
                    <td><span class="badge" [class]="log.actionBadge">{{ log.action }}</span></td>
                    <td>{{ log.entity }}</td>
                    <td style="font-size:12px;color:var(--text-secondary);max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">{{ log.details }}</td>
                  </tr>
                } @empty {
                  <tr><td colspan="5" style="text-align:center;padding:32px;color:var(--text-muted);">No audit logs found.</td></tr>
                }
              </tbody>
            </table>
          </div>
        </div>
        <div class="card">
          <div class="card-header"><h3>⚠️ Anomaly Detection</h3></div>
          <div class="card-body">
            @for (anomaly of anomalies; track anomaly.title) {
              <div style="padding:14px;border:1px solid var(--border);border-radius:var(--radius);margin-bottom:10px;border-left:4px solid var(--danger);">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
                  <strong style="font-size:13px;">{{ anomaly.title }}</strong>
                  <span class="badge badge-red">{{ anomaly.severity }}</span>
                </div>
                <p style="font-size:12px;color:var(--text-secondary);">{{ anomaly.desc }}</p>
                <div style="font-size:11px;color:var(--text-muted);margin-top:6px;">Detected: {{ anomaly.date | date:'mediumDate' }}</div>
              </div>
            } @empty {
              <div style="text-align:center;padding:24px;color:var(--text-muted);">No anomalies detected in the past 7 days.</div>
            }
            <div style="margin-top:16px;">
              <div style="font-size:13px;font-weight:600;margin-bottom:12px;">Resolution Quality Scores</div>
              @for (score of qualityScores; track score.dept) {
                <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
                  <span style="font-size:12px;width:100px;color:var(--text-secondary);">{{ score.dept }}</span>
                  <div style="flex:1;background:var(--bg-primary);border-radius:3px;height:6px;">
                    <div [style.width.%]="score.pct" [style.background]="score.pct >= 80 ? '#16A34A' : score.pct >= 60 ? '#D97706' : '#DC2626'" style="height:100%;border-radius:3px;"></div>
                  </div>
                  <span style="font-size:12px;font-weight:700;width:40px;text-align:right;">{{ score.pct }}%</span>
                </div>
              } @empty {
                <div style="font-size:12px;color:var(--text-muted);">No department data available.</div>
              }
            </div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-header"><h3>📊 Report Generator</h3></div>
        <div class="card-body">
          <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;">
            @for (report of reportTypes; track report.title) {
              <button type="button" class="btn btn-secondary" style="padding:20px;text-align:center;height:auto;" (click)="exportReport(report.type)" [disabled]="exporting">
                <i class="material-icons-outlined" style="font-size:32px;color:var(--primary);">{{ report.icon }}</i>
                <div style="font-size:13px;font-weight:600;margin-top:8px;">{{ report.title }}</div>
                <div style="font-size:11px;color:var(--text-muted);">{{ report.format }}</div>
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
  auditTotal = 0;
  anomalies: Anomaly[] = [];
  qualityScores: DeptScore[] = [];
  complianceScore = 0;
  resolvedIssues = 0;
  exporting = false;
  navItems = [
    { icon: 'dashboard', label: 'Overview', route: '/auditor' },
    { icon: 'fact_check', label: 'Audit Log', route: '/auditor/logs' },
    { icon: 'warning', label: 'Anomalies', route: '/auditor/anomalies' },
    { icon: 'description', label: 'Reports', route: '/auditor/reports' },
    { icon: 'verified', label: 'Compliance', route: '/auditor/compliance' },
  ];
  reportTypes = [
    { icon: 'assessment', title: 'Issue Summary', format: 'CSV', type: 'issues' as const },
    { icon: 'history', title: 'Audit Trail Export', format: 'CSV', type: 'audit' as const },
  ];

  private readonly locale = 'en-US';

  constructor(public auth: AuthService, private api: ApiService) {}

  ngOnInit() {
    this.api.getAuditLogs({ pageSize: '10' }).subscribe((res: any) => {
      const logs: AuditLog[] = res.data || [];
      this.auditTotal = res.total || logs.length;
      this.auditLogs = logs.map(log => this.mapAuditLog(log));
    });

    this.api.getAuditAnomalies().subscribe({
      next: (res) => { this.anomalies = res.data || []; },
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
  }

  exportAudit() { this.downloadCsv('audit-export.csv', () => this.api.exportAuditCsv()); }
  exportReport(type: 'issues' | 'audit') {
    if (type === 'issues') this.downloadCsv('issues-export.csv', () => this.api.exportIssuesCsv());
    else this.exportAudit();
  }

  private downloadCsv(filename: string, request: () => import('rxjs').Observable<Blob>) {
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