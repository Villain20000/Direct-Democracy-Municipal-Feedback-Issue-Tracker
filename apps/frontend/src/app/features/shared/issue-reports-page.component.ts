import { Component, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { LayoutComponent, NavItem } from '../../shared/layout.component';
import { AuthService } from '../../core/services/auth.service';
import { ApiService } from '../../core/services/api.service';
import { Issue } from '@dd/shared-types';
import { issueStatusClass, formatIssueStatus } from '../../core/utils/issue-ui';

@Component({
  selector: 'app-issue-reports-page',
  standalone: true,
  imports: [CommonModule, RouterLink, LayoutComponent, DatePipe],
  template: `
    <app-layout pageTitle="My Reports" [navItems]="navItems" (logout)="auth.logout()">
      @if (error) {
        <div class="card" style="margin-bottom:24px;border-color:var(--danger);">
          <div class="card-body" style="color:var(--danger);">{{ error }}</div>
        </div>
      }

      @if (loading) {
        <div class="card"><div class="card-body" style="text-align:center;padding:48px;color:var(--text-muted);">Loading your reports...</div></div>
      } @else {
        <div class="card">
          <div class="card-header">
            <h3>📋 My Reported Issues</h3>
            <button class="btn btn-primary btn-sm" routerLink="/issues/new">
              <i class="material-icons-outlined" style="font-size:16px;">add</i> New Report
            </button>
          </div>
          <div class="card-body" style="padding:0;">
            <table class="data-table">
              <thead>
                <tr><th>Title</th><th>Category</th><th>Status</th><th>Priority</th><th>Upvotes</th><th>Date</th></tr>
              </thead>
              <tbody>
                @for (issue of issues; track issue.id) {
                  <tr [routerLink]="['/issues', issue.id]" style="cursor:pointer;">
                    <td>
                      <strong>{{ issue.title }}</strong>
                      <br><span style="font-size:11px;color:var(--text-muted);">{{ issue.location }}</span>
                    </td>
                    <td><span class="badge badge-blue">{{ issue.category }}</span></td>
                    <td><span class="status-badge" [ngClass]="issueStatusClass(issue.status)">{{ formatIssueStatus(issue.status) }}</span></td>
                    <td><span class="priority-dot" [ngClass]="'p' + (issue.priority || 3)"></span> {{ issue.priority || '-' }}/5</td>
                    <td style="font-weight:700;">▲ {{ issue.upvotes }}</td>
                    <td style="color:var(--text-muted);font-size:12px;">{{ issue.createdAt | date:'mediumDate' }}</td>
                  </tr>
                } @empty {
                  <tr><td colspan="6" style="text-align:center;padding:48px;color:var(--text-muted);">
                    You haven't reported any issues yet.
                    <br><a routerLink="/issues/new" style="margin-top:8px;display:inline-block;">Report your first issue</a>
                  </td></tr>
                }
              </tbody>
            </table>
          </div>
        </div>
      }
    </app-layout>
  `,
})
export class IssueReportsPageComponent implements OnInit {
  issues: Issue[] = [];
  loading = true;
  error = '';
  navItems: NavItem[] = [];

  issueStatusClass = issueStatusClass;
  formatIssueStatus = formatIssueStatus;

  constructor(public auth: AuthService, private api: ApiService) {
    this.navItems = [
      { icon: 'dashboard', label: 'Dashboard', route: '/citizen' },
      { icon: 'my_reports', label: 'My Reports', route: '/citizen/reports' },
    ];
  }

  ngOnInit() { this.loadReports(); }

  loadReports() {
    const userId = this.auth.user()?.id;
    if (!userId) {
      this.error = 'User not authenticated.';
      this.loading = false;
      return;
    }

    this.loading = true;
    this.error = '';
    this.api.getIssues({ reporterId: userId }).subscribe({
      next: (res: any) => {
        this.issues = res.data || [];
        this.loading = false;
      },
      error: (err) => {
        this.error = err.error?.error || 'Failed to load reports.';
        this.loading = false;
      },
    });
  }
}