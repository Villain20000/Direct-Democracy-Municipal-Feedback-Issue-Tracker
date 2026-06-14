import { Component, OnInit, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { LayoutComponent, NavItem } from '../../shared/layout.component';
import { AuthService } from '../../core/services/auth.service';
import { ApiService } from '../../core/services/api.service';
import { TranslationService } from '../../core/i18n/translation.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { Issue } from '@dd/shared-types';

@Component({
  selector: 'app-staff-tasks-page',
  standalone: true,
  imports: [CommonModule, RouterLink, LayoutComponent, DatePipe, TranslatePipe],
  template: `
    <app-layout [pageTitle]="i18n.t('staffTasks.pageTitle')" [navItems]="navItems" (logout)="auth.logout()">
      @if (error) {
        <div class="card" style="margin-bottom:24px;border-color:var(--danger);">
          <div class="card-body" style="color:var(--danger);">{{ error }}</div>
        </div>
      }

      @if (loading) {
        <div class="card"><div class="card-body" style="text-align:center;padding:48px;color:var(--text-muted);">{{ i18n.t('staffTasks.loading') }}</div></div>
      } @else {
        <div class="card">
          <div class="card-header"><h3>{{ i18n.t('staffTasks.header') }}</h3></div>
          <div class="card-body" style="padding:0;">
            <table class="data-table">
              <thead>
                <tr><th>{{ i18n.t('staffTasks.colTitle') }}</th><th>{{ i18n.t('staffTasks.colStatus') }}</th><th>{{ i18n.t('staffTasks.colPriority') }}</th><th>{{ i18n.t('staffTasks.colReporter') }}</th><th>{{ i18n.t('staffTasks.colDate') }}</th><th>{{ i18n.t('staffTasks.colActions') }}</th></tr>
              </thead>
              <tbody>
                @for (issue of issues; track issue.id) {
                  <tr>
                    <td>
                      <a [routerLink]="['/issues', issue.id]" style="font-weight:600;">{{ issue.title }}</a>
                      <br><span style="font-size:11px;color:var(--text-muted);">{{ issue.location }}</span>
                    </td>
                    <td><span class="status-badge" [ngClass]="statusClass(issue.status)">{{ i18n.tStatus(issue.status) }}</span></td>
                    <td><span class="priority-dot" [ngClass]="'p' + (issue.priority || 3)"></span> {{ issue.priority || '-' }}/5</td>
                    <td style="font-size:12px;">{{ issue.reporter?.firstName || i18n.t('detail.anonymous') }}</td>
                    <td style="color:var(--text-muted);font-size:12px;">{{ issue.createdAt | date:'mediumDate' }}</td>
                    <td>
                      <div style="display:flex;gap:4px;flex-wrap:wrap;">
                        <button type="button" class="btn btn-primary btn-sm" [disabled]="updatingId === issue.id || issue.status === 'IN_PROGRESS'" (click)="updateStatus(issue, 'IN_PROGRESS')">{{ 'status.start' | t }}</button>
                        <button type="button" class="btn btn-secondary btn-sm" [disabled]="updatingId === issue.id" (click)="updateStatus(issue, 'PENDING_REVIEW')">{{ 'status.review' | t }}</button>
                        <button type="button" class="btn btn-success btn-sm" [disabled]="updatingId === issue.id || issue.status === 'RESOLVED'" (click)="updateStatus(issue, 'RESOLVED')">{{ 'status.done' | t }}</button>
                      </div>
                    </td>
                  </tr>
                } @empty {
                  <tr><td colspan="6" style="text-align:center;padding:48px;color:var(--text-muted);">{{ i18n.t('staffTasks.noTasks') }}</td></tr>
                }
              </tbody>
            </table>
          </div>
        </div>
      }
    </app-layout>
  `,
})
export class StaffTasksPageComponent implements OnInit {
  issues: Issue[] = [];
  loading = true;
  error = '';
  updatingId = '';
  navItems: NavItem[] = [];

  private statusFilter = '';

  i18n = inject(TranslationService);

  constructor(public auth: AuthService, private api: ApiService, private route: ActivatedRoute) {
    this.navItems = [
      { icon: 'dashboard', label: 'nav.overview', route: '/staff' },
      { icon: 'assignment', label: 'nav.tasks', route: '/staff/tasks' },
      { icon: 'task_alt', label: 'nav.completed', route: '/staff/completed' },
      { icon: 'note_add', label: 'nav.notes', route: '/staff/notes' },
    ];
  }

  ngOnInit() {
    this.statusFilter = this.route.snapshot.data['statusFilter'] || '';
    this.loadTasks();
  }

  loadTasks() {
    const userId = this.auth.user()?.id;
    if (!userId) {
      this.error = this.i18n.t('staffTasks.notAuthenticated');
      this.loading = false;
      return;
    }

    this.loading = true;
    this.error = '';
    const params: Record<string, string> = { assigneeId: userId, pageSize: '50' };
    if (this.statusFilter) params['status'] = this.statusFilter;

    this.api.getIssues(params).subscribe({
      next: (res: any) => {
        this.issues = res.data || [];
        this.loading = false;
      },
      error: (err) => {
        this.error = err.error?.error || this.i18n.t('staffTasks.loadFailed');
        this.loading = false;
      },
    });
  }

  statusClass(status: string): string {
    return status.toLowerCase().replace(/_/g, '-');
  }

  updateStatus(issue: Issue, status: string) {
    this.updatingId = issue.id;
    this.error = '';
    this.api.updateIssueStatus(issue.id, status).subscribe({
      next: (res: any) => {
        if (res.success) {
          const idx = this.issues.findIndex(i => i.id === issue.id);
          if (idx >= 0) {
            this.issues[idx] = res.data;
            this.issues = [...this.issues];
          }
        }
        this.updatingId = '';
      },
      error: (err) => {
        this.error = err.error?.error || this.i18n.t('staffTasks.updateFailed');
        this.updatingId = '';
      },
    });
  }
}
