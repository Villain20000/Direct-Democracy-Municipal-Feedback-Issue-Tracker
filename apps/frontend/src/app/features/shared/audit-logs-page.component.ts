import { Component, OnInit, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { LayoutComponent, NavItem } from '../../shared/layout.component';
import { AuthService } from '../../core/services/auth.service';
import { ApiService } from '../../core/services/api.service';
import { TranslationService } from '../../core/i18n/translation.service';
import { AuditLog, UserRole } from '@dd/shared-types';

@Component({
  selector: 'app-audit-logs-page',
  standalone: true,
  imports: [CommonModule, LayoutComponent, DatePipe],
  template: `
    <app-layout [pageTitle]="i18n.t('auditLogs.pageTitle')" [navItems]="navItems" (logout)="auth.logout()">
      @if (!authorized) {
        <div class="card">
          <div class="card-body" style="text-align:center;padding:48px;color:var(--danger);">
            {{ i18n.t('auditLogs.accessDenied') }}
          </div>
        </div>
      } @else {
        @if (error) {
          <div class="card" style="margin-bottom:24px;border-color:var(--danger);">
            <div class="card-body" style="color:var(--danger);">{{ error }}</div>
          </div>
        }

        @if (loading) {
          <div class="card"><div class="card-body" style="text-align:center;padding:48px;color:var(--text-muted);">{{ i18n.t('auditLogs.loading') }}</div></div>
        } @else {
          <div class="card">
            <div class="card-header" style="display:flex;justify-content:space-between;align-items:center;">
              <h3>{{ i18n.t('auditLogs.header') }}</h3>
              <button class="btn btn-secondary btn-sm" (click)="exportCsv()" [disabled]="exporting">
                @if (exporting) { {{ i18n.t('auditLogs.exporting') }} } @else { {{ i18n.t('auditLogs.exportCsv') }} }
              </button>
            </div>
            <div class="card-body" style="padding:0;">
              <table class="data-table">
                <thead>
                  <tr><th>{{ i18n.t('auditLogs.colTimestamp') }}</th><th>{{ i18n.t('auditLogs.colUser') }}</th><th>{{ i18n.t('auditLogs.colAction') }}</th><th>{{ i18n.t('auditLogs.colEntity') }}</th><th>{{ i18n.t('auditLogs.colEntityId') }}</th><th>{{ i18n.t('auditLogs.colIp') }}</th></tr>
                </thead>
                <tbody>
                  @for (log of logs; track log.id) {
                    <tr>
                      <td style="color:var(--text-muted);font-size:12px;">{{ log.createdAt | date:'medium' }}</td>
                      <td style="font-size:12px;">
                        @if (log.user) {
                          {{ log.user.firstName }} {{ log.user.lastName }}
                        } @else {
                          {{ log.userId }}
                        }
                      </td>
                      <td><span class="badge badge-blue">{{ log.action }}</span></td>
                      <td>{{ log.entity }}</td>
                      <td style="font-size:11px;color:var(--text-muted);">{{ log.entityId }}</td>
                      <td style="font-size:11px;color:var(--text-muted);">{{ log.ipAddress || '-' }}</td>
                    </tr>
                  } @empty {
                    <tr><td colspan="6" style="text-align:center;padding:48px;color:var(--text-muted);">{{ i18n.t('auditLogs.noLogs') }}</td></tr>
                  }
                </tbody>
              </table>
            </div>
          </div>
        }
      }
    </app-layout>
  `,
})
export class AuditLogsPageComponent implements OnInit {
  logs: AuditLog[] = [];
  loading = true;
  exporting = false;
  error = '';
  authorized = false;
  navItems: NavItem[] = [];

  i18n = inject(TranslationService);

  constructor(public auth: AuthService, private api: ApiService) {
    this.navItems = [{ icon: 'dashboard', label: 'nav.dashboard', route: auth.getDashboardRoute() }];
    this.authorized = auth.hasRole(UserRole.SUPER_ADMIN, UserRole.AUDITOR);
  }

  ngOnInit() {
    if (this.authorized) this.loadLogs();
    else this.loading = false;
  }

  loadLogs() {
    this.loading = true;
    this.error = '';
    this.api.getAuditLogs().subscribe({
      next: (res: any) => {
        this.logs = res.data || [];
        this.loading = false;
      },
      error: (err) => {
        this.error = err.error?.error || this.i18n.t('auditLogs.loadFailed');
        this.loading = false;
      },
    });
  }

  exportCsv() {
    this.exporting = true;
    this.api.exportAuditCsv().subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'audit-export.csv';
        a.click();
        URL.revokeObjectURL(url);
        this.exporting = false;
      },
      error: () => {
        this.error = this.i18n.t('auditLogs.exportFailed');
        this.exporting = false;
      },
    });
  }
}
