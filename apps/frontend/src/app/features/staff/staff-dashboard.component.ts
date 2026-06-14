import { Component, OnInit, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { LayoutComponent } from '../../shared/layout.component';
import { AuthService } from '../../core/services/auth.service';
import { ApiService } from '../../core/services/api.service';
import { ToastService } from '../../core/services/toast.service';
import { TranslationService } from '../../core/i18n/translation.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { Issue, IssueStatus } from '@dd/shared-types';

@Component({
  selector: 'app-staff-dashboard',
  standalone: true,
  imports: [CommonModule, LayoutComponent, DatePipe, RouterLink, TranslatePipe],
  template: `
    <app-layout
      [pageTitle]="i18n.t('staff.pageTitle')"
      [navItems]="navItems"
      (logout)="auth.logout()">

      @if (error) {
        <div class="card" style="margin-bottom:16px;border-color:var(--danger);">
          <div class="card-body" style="color:var(--danger);font-size:13px;">{{ error }}</div>
        </div>
      }
      @if (successMessage) {
        <div class="card" style="margin-bottom:16px;border-color:var(--success);">
          <div class="card-body" style="color:var(--success);font-size:13px;">{{ successMessage }}</div>
        </div>
      }

      <div class="stats-grid">
        <div class="stat-card"><div class="stat-icon orange" style="background:#FFF7ED;color:#EA580C;"><i class="material-icons-outlined">assignment_ind</i></div><div class="stat-info"><div class="stat-value">{{ activeIssues.length }}</div><div class="stat-label">{{ 'staff.myAssigned' | t }}</div></div></div>
        <div class="stat-card"><div class="stat-icon amber"><i class="material-icons-outlined">pending</i></div><div class="stat-info"><div class="stat-value">{{ inProgressCount }}</div><div class="stat-label">{{ 'staff.inProgress' | t }}</div></div></div>
        <div class="stat-card"><div class="stat-icon green"><i class="material-icons-outlined">task_alt</i></div><div class="stat-info"><div class="stat-value">{{ completedTodayCount }}</div><div class="stat-label">{{ 'staff.completedToday' | t }}</div></div></div>
        <div class="stat-card"><div class="stat-icon red"><i class="material-icons-outlined">priority_high</i></div><div class="stat-info"><div class="stat-value">{{ highPriorityCount }}</div><div class="stat-label">{{ 'staff.highPriority' | t }}</div></div></div>
      </div>

      <div class="card" style="margin-bottom: 24px;">
        <div class="card-header">
          <h3>{{ 'staff.taskQueue' | t }}</h3>
          <div class="card-actions">
            <button type="button" class="btn btn-secondary btn-sm" (click)="toggleFilter()">
              {{ showFilter ? i18n.t('staff.hideFilter') : i18n.t('staff.filter') }}
            </button>
            <button type="button" class="btn btn-primary btn-sm" (click)="toggleSort()">
              {{ sortByPriority ? i18n.t('staff.defaultOrder') : i18n.t('staff.sortByPriority') }}
            </button>
            <a routerLink="/staff/tasks" class="btn btn-ghost btn-sm">{{ 'staff.viewAllTasks' | t }} →</a>
          </div>
        </div>
        @if (showFilter) {
          <div style="padding:12px 24px;border-bottom:1px solid var(--border);display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
            <span style="font-size:12px;font-weight:600;color:var(--text-muted);">{{ 'staff.statusLabel' | t }}</span>
            @for (opt of statusFilterOptions; track opt.value) {
              <button
                type="button"
                class="btn btn-sm"
                [class.btn-primary]="statusFilter === opt.value"
                [class.btn-secondary]="statusFilter !== opt.value"
                (click)="setStatusFilter(opt.value)"
              >{{ formatFilterLabel(opt.label) }}</button>
            }
          </div>
        }
        <div class="card-body" style="padding:0;">
          @if (loading) {
            <div style="text-align:center;padding:32px;color:var(--text-muted);">{{ 'common.loading' | t }}</div>
          } @else {
            <table class="data-table">
              <thead><tr><th>{{ 'staff.title' | t }}</th><th>{{ 'staff.actions' ? '' : '' }}{{ 'citizen.tableStatus' | t }}</th><th>{{ 'staff.priority' | t }}</th><th>{{ 'staff.reporter' | t }}</th><th>{{ 'staff.date' | t }}</th><th>{{ 'staff.actions' | t }}</th></tr></thead>
              <tbody>
                @for (issue of displayedIssues; track issue.id) {
                  <tr>
                    <td>
                      <a [routerLink]="['/issues', issue.id]" style="font-weight:600;">{{ issue.title }}</a>
                      <br><span style="font-size:11px;color:var(--text-muted);">{{ issue.location }}</span>
                    </td>
                    <td><span class="status-badge" [ngClass]="statusClass(issue.status)">{{ formatStatus(issue.status) }}</span></td>
                    <td><span class="priority-dot" [ngClass]="'p' + (issue.priority || 3)"></span> {{ issue.priority || '-' }}/5</td>
                    <td>{{ issue.reporter?.firstName || 'Anonymous' }} {{ issue.reporter?.lastName || '' }}</td>
                    <td style="color:var(--text-muted);">{{ issue.createdAt | date:'mediumDate' }}</td>
                    <td>
                      <div style="display:flex;gap:4px;flex-wrap:wrap;">
                        <button
                          type="button"
                          class="btn btn-primary btn-sm"
                          [disabled]="updatingId === issue.id || issue.status === 'IN_PROGRESS'"
                          (click)="updateStatus(issue, 'IN_PROGRESS')"
                        >{{ 'staff.start' | t }}</button>
                        <button
                          type="button"
                          class="btn btn-secondary btn-sm"
                          [disabled]="updatingId === issue.id"
                          (click)="updateStatus(issue, 'PENDING_REVIEW')"
                        >{{ 'staff.review' | t }}</button>
                        <button
                          type="button"
                          class="btn btn-success btn-sm"
                          [disabled]="updatingId === issue.id || issue.status === 'RESOLVED'"
                          (click)="updateStatus(issue, 'RESOLVED')"
                        >{{ 'staff.done' | t }}</button>
                      </div>
                    </td>
                  </tr>
                } @empty {
                  <tr><td colspan="6" style="text-align:center;padding:32px;color:var(--text-muted);">{{ 'staff.empty' | t }}</td></tr>
                }
              </tbody>
            </table>
          }
        </div>
      </div>

      <div class="content-grid">
        <div class="card">
          <div class="card-header"><h3>{{ 'staff.todayActivity' | t }}</h3></div>
          <div class="card-body">
            @for (activity of todayActivity; track activity.time) {
              <div style="display:flex;gap:12px;padding:10px 0;border-bottom:1px solid var(--border-light);">
                <div style="min-width:50px;font-size:12px;color:var(--text-muted);">{{ activity.time }}</div>
                <div><div style="font-size:13px;font-weight:500;">{{ i18n.t(activity.textKey) }}</div><div style="font-size:11px;color:var(--text-muted);">{{ i18n.t(activity.noteKey) }}</div></div>
              </div>
            }
          </div>
        </div>
        <div class="card">
          <div class="card-header"><h3>{{ 'staff.announcements' | t }}</h3></div>
          <div class="card-body">
            <div style="padding:14px;background:#FFFBEB;border-radius:var(--radius);border-left:4px solid #D97706;margin-bottom:12px;">
              <div style="font-size:13px;font-weight:700;">{{ 'staff.safetyTitle' | t }}</div>
              <div style="font-size:12px;color:var(--text-secondary);margin-top:4px;">{{ 'staff.safetyBody' | t }}</div>
            </div>
            <div style="padding:14px;background:#EFF6FF;border-radius:var(--radius);border-left:4px solid #2563EB;">
              <div style="font-size:13px;font-weight:700;">{{ 'staff.reportingTitle' | t }}</div>
              <div style="font-size:12px;color:var(--text-secondary);margin-top:4px;">{{ 'staff.reportingBody' | t }}</div>
            </div>
          </div>
        </div>
      </div>
    </app-layout>
  `,
})
export class StaffDashboardComponent implements OnInit {
  myIssues: Issue[] = [];
  loading = true;
  error = '';
  successMessage = '';
  updatingId = '';
  showFilter = false;
  statusFilter = '';
  sortByPriority = false;

  statusFilterOptions = [
    { value: '', label: 'staff.allActive' },
    { value: IssueStatus.SUBMITTED, label: 'status.SUBMITTED' },
    { value: IssueStatus.ACKNOWLEDGED, label: 'status.ACKNOWLEDGED' },
    { value: IssueStatus.IN_PROGRESS, label: 'status.IN_PROGRESS' },
    { value: IssueStatus.PENDING_REVIEW, label: 'status.PENDING_REVIEW' },
  ];

  todayActivity = [
    { time: '9:15 AM', textKey: 'staff.activity.1.text', noteKey: 'staff.activity.1.note' },
    { time: '10:30 AM', textKey: 'staff.activity.2.text', noteKey: 'staff.activity.2.note' },
    { time: '11:00 AM', textKey: 'staff.activity.3.text', noteKey: 'staff.activity.3.note' },
    { time: '1:45 PM', textKey: 'staff.activity.4.text', noteKey: 'staff.activity.4.note' },
  ] as Array<{ time: string; textKey: string; noteKey: string }>;

  navItems = [
    { icon: 'dashboard', label: 'nav.overview', route: '/staff' },
    { icon: 'assignment', label: 'nav.tasks', route: '/staff/tasks' },
    { icon: 'task_alt', label: 'nav.completed', route: '/staff/completed' },
    { icon: 'note_add', label: 'nav.notes', route: '/staff/notes' },
  ] as any;

  auth = inject(AuthService);
  api = inject(ApiService);
  toast = inject(ToastService);
  i18n = inject(TranslationService);

  get activeIssues(): Issue[] {
    return this.myIssues.filter(i => !['RESOLVED', 'VERIFIED'].includes(i.status));
  }

  get displayedIssues(): Issue[] {
    let list = this.statusFilter
      ? this.myIssues.filter(i => i.status === this.statusFilter)
      : this.activeIssues;

    if (this.sortByPriority) {
      list = [...list].sort((a, b) => (b.priority || 0) - (a.priority || 0));
    }
    return list;
  }

  get inProgressCount(): number {
    return this.myIssues.filter(i => i.status === IssueStatus.IN_PROGRESS).length;
  }

  get completedTodayCount(): number {
    const today = new Date().toDateString();
    return this.myIssues.filter(i => {
      if (!i.resolvedAt) return false;
      return new Date(i.resolvedAt).toDateString() === today;
    }).length;
  }

  get highPriorityCount(): number {
    return this.activeIssues.filter(i => (i.priority || 0) >= 4).length;
  }

  ngOnInit() {
    this.loadIssues();
  }

  loadIssues() {
    const userId = this.auth.user()?.id;
    if (!userId) {
      this.error = this.i18n.t('staff.notSignedIn');
      this.loading = false;
      return;
    }

    this.loading = true;
    this.error = '';
    this.api.getIssues({ assigneeId: userId, pageSize: '50' }).subscribe({
      next: (res: any) => {
        this.myIssues = res.data || [];
        this.loading = false;
        if (this.myIssues.length > 0) {
          this.toast.info(this.i18n.t('staff.loaded', { n: this.myIssues.length }));
        }
      },
      error: (err) => {
        this.error = err.error?.error || this.i18n.t('staff.loadFailed');
        this.toast.error(this.error);
        this.loading = false;
      },
    });
  }

  toggleFilter() {
    this.showFilter = !this.showFilter;
  }

  toggleSort() {
    this.sortByPriority = !this.sortByPriority;
  }

  setStatusFilter(value: string) {
    this.statusFilter = value;
  }

  statusClass(status: string): string {
    return status.toLowerCase().replace(/_/g, '-');
  }

  formatStatus(status: string): string {
    return this.i18n.tEnum('status', status);
  }

  formatFilterLabel(key: string): string {
    if (key === 'staff.allActive') return this.i18n.t(key);
    const suffix = key.split('.')[1];
    return this.i18n.tEnum('status', suffix);
  }

  updateStatus(issue: Issue, status: string) {
    this.updatingId = issue.id;
    this.error = '';
    this.successMessage = '';

    this.api.updateIssueStatus(issue.id, status).subscribe({
      next: (res) => {
        if (res.success) {
          const idx = this.myIssues.findIndex(i => i.id === issue.id);
          if (idx >= 0) {
            this.myIssues[idx] = res.data;
            this.myIssues = [...this.myIssues];
          }
          this.successMessage = this.i18n.t('staff.marked', { title: issue.title, status: this.formatStatus(status) });
          this.toast.success(this.successMessage);
          setTimeout(() => { this.successMessage = ''; }, 4000);
        }
        this.updatingId = '';
      },
      error: (err) => {
        this.error = err.error?.error || this.i18n.t('staff.updateFailed');
        this.toast.error(this.error);
        this.updatingId = '';
      },
    });
  }
}
