import { Component, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { LayoutComponent } from '../../shared/layout.component';
import { AuthService } from '../../core/services/auth.service';
import { ApiService } from '../../core/services/api.service';
import { Issue, IssueStatus } from '@dd/shared-types';

@Component({
  selector: 'app-staff-dashboard',
  standalone: true,
  imports: [CommonModule, LayoutComponent, DatePipe, RouterLink],
  template: `
    <app-layout
      pageTitle="Staff Dashboard"
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
        <div class="stat-card"><div class="stat-icon orange" style="background:#FFF7ED;color:#EA580C;"><i class="material-icons-outlined">assignment_ind</i></div><div class="stat-info"><div class="stat-value">{{ activeIssues.length }}</div><div class="stat-label">My Assigned Issues</div></div></div>
        <div class="stat-card"><div class="stat-icon amber"><i class="material-icons-outlined">pending</i></div><div class="stat-info"><div class="stat-value">{{ inProgressCount }}</div><div class="stat-label">In Progress</div></div></div>
        <div class="stat-card"><div class="stat-icon green"><i class="material-icons-outlined">task_alt</i></div><div class="stat-info"><div class="stat-value">{{ completedTodayCount }}</div><div class="stat-label">Completed Today</div></div></div>
        <div class="stat-card"><div class="stat-icon red"><i class="material-icons-outlined">priority_high</i></div><div class="stat-info"><div class="stat-value">{{ highPriorityCount }}</div><div class="stat-label">High Priority</div></div></div>
      </div>

      <div class="card" style="margin-bottom: 24px;">
        <div class="card-header">
          <h3>My Task Queue</h3>
          <div class="card-actions">
            <button type="button" class="btn btn-secondary btn-sm" (click)="toggleFilter()">
              {{ showFilter ? 'Hide Filter' : 'Filter' }}
            </button>
            <button type="button" class="btn btn-primary btn-sm" (click)="toggleSort()">
              {{ sortByPriority ? 'Default Order' : 'Sort by Priority' }}
            </button>
            <a routerLink="/staff/tasks" class="btn btn-ghost btn-sm">View All Tasks →</a>
          </div>
        </div>
        @if (showFilter) {
          <div style="padding:12px 24px;border-bottom:1px solid var(--border);display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
            <span style="font-size:12px;font-weight:600;color:var(--text-muted);">Status:</span>
            @for (opt of statusFilterOptions; track opt.value) {
              <button
                type="button"
                class="btn btn-sm"
                [class.btn-primary]="statusFilter === opt.value"
                [class.btn-secondary]="statusFilter !== opt.value"
                (click)="setStatusFilter(opt.value)"
              >{{ opt.label }}</button>
            }
          </div>
        }
        <div class="card-body" style="padding:0;">
          @if (loading) {
            <div style="text-align:center;padding:32px;color:var(--text-muted);">Loading tasks...</div>
          } @else {
            <table class="data-table">
              <thead><tr><th>Title</th><th>Status</th><th>Priority</th><th>Reporter</th><th>Date</th><th>Actions</th></tr></thead>
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
                        >▶ Start</button>
                        <button
                          type="button"
                          class="btn btn-secondary btn-sm"
                          [disabled]="updatingId === issue.id"
                          (click)="updateStatus(issue, 'PENDING_REVIEW')"
                        >Review</button>
                        <button
                          type="button"
                          class="btn btn-success btn-sm"
                          [disabled]="updatingId === issue.id || issue.status === 'RESOLVED'"
                          (click)="updateStatus(issue, 'RESOLVED')"
                        >✓ Done</button>
                      </div>
                    </td>
                  </tr>
                } @empty {
                  <tr><td colspan="6" style="text-align:center;padding:32px;color:var(--text-muted);">No assigned issues match your filter.</td></tr>
                }
              </tbody>
            </table>
          }
        </div>
      </div>

      <div class="content-grid">
        <div class="card">
          <div class="card-header"><h3>Today's Activity</h3></div>
          <div class="card-body">
            @for (activity of todayActivity; track activity.time) {
              <div style="display:flex;gap:12px;padding:10px 0;border-bottom:1px solid var(--border-light);">
                <div style="min-width:50px;font-size:12px;color:var(--text-muted);">{{ activity.time }}</div>
                <div><div style="font-size:13px;font-weight:500;">{{ activity.text }}</div><div style="font-size:11px;color:var(--text-muted);">{{ activity.note }}</div></div>
              </div>
            }
          </div>
        </div>
        <div class="card">
          <div class="card-header"><h3>Department Announcements</h3></div>
          <div class="card-body">
            <div style="padding:14px;background:#FFFBEB;border-radius:var(--radius);border-left:4px solid #D97706;margin-bottom:12px;">
              <div style="font-size:13px;font-weight:700;">⚠️ Safety Notice</div>
              <div style="font-size:12px;color:var(--text-secondary);margin-top:4px;">Wear high-vis vests at all construction sites. New PPE requirements effective immediately.</div>
            </div>
            <div style="padding:14px;background:#EFF6FF;border-radius:var(--radius);border-left:4px solid #2563EB;">
              <div style="font-size:13px;font-weight:700;">📋 New Reporting Format</div>
              <div style="font-size:12px;color:var(--text-secondary);margin-top:4px;">Starting next week, all field reports should include photo documentation.</div>
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
    { value: '', label: 'All Active' },
    { value: IssueStatus.SUBMITTED, label: 'Submitted' },
    { value: IssueStatus.ACKNOWLEDGED, label: 'Acknowledged' },
    { value: IssueStatus.IN_PROGRESS, label: 'In Progress' },
    { value: IssueStatus.PENDING_REVIEW, label: 'Pending Review' },
  ];

  todayActivity = [
    { time: '9:15 AM', text: 'Resolved pothole repair on Main St', note: 'Completed ahead of schedule' },
    { time: '10:30 AM', text: 'Started work on broken streetlight', note: 'Oak Avenue - awaiting parts' },
    { time: '11:00 AM', text: 'New issue assigned: Tree blocking sidewalk', note: 'Maple Drive - moderate priority' },
    { time: '1:45 PM', text: 'Updated water main break status', note: 'Emergency crew on site' },
  ];

  navItems = [
    { icon: 'dashboard', label: 'Overview', route: '/staff' },
    { icon: 'assignment', label: 'My Tasks', route: '/staff/tasks' },
    { icon: 'task_alt', label: 'Completed', route: '/staff/completed' },
    { icon: 'note_add', label: 'Field Notes', route: '/staff/notes' },
  ];

  constructor(public auth: AuthService, private api: ApiService) {}

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
      this.error = 'Not signed in.';
      this.loading = false;
      return;
    }

    this.loading = true;
    this.error = '';
    this.api.getIssues({ assigneeId: userId, pageSize: '50' }).subscribe({
      next: (res: any) => {
        this.myIssues = res.data || [];
        this.loading = false;
      },
      error: (err) => {
        this.error = err.error?.error || 'Failed to load tasks.';
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
    return status.replace(/_/g, ' ');
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
          this.successMessage = `"${issue.title}" marked as ${this.formatStatus(status)}.`;
          setTimeout(() => { this.successMessage = ''; }, 4000);
        }
        this.updatingId = '';
      },
      error: (err) => {
        this.error = err.error?.error || 'Failed to update status.';
        this.updatingId = '';
      },
    });
  }
}