import { Component, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { LayoutComponent } from '../../shared/layout.component';
import { AuthService } from '../../core/services/auth.service';
import { ApiService } from '../../core/services/api.service';
import { Issue, IssueStatus, IssueCategory, UserRole } from '@dd/shared-types';
import { issueStatusClass, formatIssueStatus } from '../../core/utils/issue-ui';

@Component({
  selector: 'app-issue-list',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, LayoutComponent, DatePipe],
  template: `
    <app-layout
      pageTitle="All Issues"
      [navItems]="navItems"
      (logout)="auth.logout()">

      <div style="display:flex;gap:12px;margin-bottom:24px;flex-wrap:wrap;align-items:center;">
        <div style="flex:1;min-width:200px;">
          <input type="text" [(ngModel)]="search" (ngModelChange)="loadIssues()" placeholder="Search issues..." style="width:100%;padding:10px 16px;border:1px solid var(--border);border-radius:var(--radius);font-size:13px;" />
        </div>
        <select [(ngModel)]="filterStatus" (ngModelChange)="loadIssues()" style="padding:10px 14px;border:1px solid var(--border);border-radius:var(--radius);font-size:13px;">
          <option value="">All Statuses</option>
          @for (s of statuses; track s) { <option [value]="s">{{ s }}</option> }
        </select>
        <select [(ngModel)]="filterCategory" (ngModelChange)="loadIssues()" style="padding:10px 14px;border:1px solid var(--border);border-radius:var(--radius);font-size:13px;">
          <option value="">All Categories</option>
          @for (c of categories; track c) { <option [value]="c">{{ c }}</option> }
        </select>
        <button class="btn btn-primary" routerLink="/issues/new"><i class="material-icons-outlined" style="font-size:16px;">add</i> New Issue</button>
        @if (canBulkUpdate) {
          <select [(ngModel)]="bulkStatus" style="padding:10px 14px;border:1px solid var(--border);border-radius:var(--radius);font-size:13px;">
            <option value="">Bulk status...</option>
            @for (s of statuses; track s) { <option [value]="s">{{ s }}</option> }
          </select>
          <button class="btn btn-secondary btn-sm" (click)="bulkUpdate()" [disabled]="!bulkStatus || bulkLoading">Apply to page</button>
        }
        @if (canExport) {
          <button class="btn btn-secondary btn-sm" (click)="exportCsv()" [disabled]="exporting">⬇ Export</button>
        }
      </div>

      <div class="card">
        <div class="card-body" style="padding:0;">
          <table class="data-table">
            <thead>
              <tr>
                <th>Title</th><th>Category</th><th>Status</th><th>Priority</th>
                <th>Upvotes</th><th>Reporter</th><th>Date</th>
              </tr>
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
                  <td style="font-size:12px;">{{ issue.reporter?.firstName || 'Anonymous' }}</td>
                  <td style="color:var(--text-muted);font-size:12px;">{{ issue.createdAt | date:'mediumDate' }}</td>
                </tr>
              } @empty {
                <tr><td colspan="7" style="text-align:center;padding:48px;color:var(--text-muted);">No issues found</td></tr>
              }
            </tbody>
          </table>
        </div>
      </div>

      <div style="display:flex;justify-content:space-between;align-items:center;margin-top:16px;">
        <span style="font-size:13px;color:var(--text-muted);">Showing {{ issues.length }} of {{ total }} issues</span>
        <div style="display:flex;gap:8px;">
          <button class="btn btn-secondary btn-sm" [disabled]="page <= 1" (click)="prevPage()">← Previous</button>
          <button class="btn btn-secondary btn-sm" [disabled]="page >= totalPages" (click)="nextPage()">Next →</button>
        </div>
      </div>
    </app-layout>
  `,
})
export class IssueListComponent implements OnInit {
  issues: Issue[] = [];
  total = 0;
  page = 1;
  totalPages = 1;
  search = '';
  filterStatus = '';
  filterCategory = '';
  statuses = ['SUBMITTED', 'ACKNOWLEDGED', 'IN_PROGRESS', 'PENDING_REVIEW', 'RESOLVED', 'VERIFIED', 'REJECTED'];
  categories = ['INFRASTRUCTURE', 'PUBLIC_SAFETY', 'SANITATION', 'UTILITIES', 'HOUSING', 'ENVIRONMENT', 'TRANSPORTATION', 'EDUCATION', 'HEALTH', 'OTHER'];
  navItems = [
    { icon: 'report_problem', label: 'All Issues', route: '/issues' },
  ];

  bulkStatus = '';
  bulkLoading = false;
  exporting = false;
  canBulkUpdate = false;
  canExport = false;
  private sortBy = '';
  private departmentId = '';
  private wardId = '';

  issueStatusClass = issueStatusClass;
  formatIssueStatus = formatIssueStatus;

  constructor(public auth: AuthService, private api: ApiService, private route: ActivatedRoute, private router: Router) {
    this.canBulkUpdate = auth.hasRole(UserRole.SUPER_ADMIN, UserRole.MAYOR, UserRole.DEPARTMENT_HEAD, UserRole.STAFF);
    this.canExport = auth.hasRole(UserRole.SUPER_ADMIN, UserRole.MAYOR, UserRole.AUDITOR, UserRole.DEPARTMENT_HEAD);
  }

  ngOnInit() {
    const data = this.route.snapshot.data;
    if (data['sortBy']) this.sortBy = data['sortBy'];
    this.route.queryParams.subscribe(params => {
      if (params['search']) this.search = params['search'];
      if (params['status']) this.filterStatus = params['status'];
      if (params['departmentId']) this.departmentId = params['departmentId'];
      if (params['wardId']) this.wardId = params['wardId'];
      this.page = 1;
      this.loadIssues();
    });
  }

  loadIssues() {
    const params: Record<string, string> = {
      page: String(this.page),
      search: this.search,
      status: this.filterStatus,
      category: this.filterCategory,
    };
    if (this.sortBy) { params['sortBy'] = this.sortBy; params['sortOrder'] = 'desc'; }
    if (this.departmentId) params['departmentId'] = this.departmentId;
    else if (this.router.url.includes('/department/')) {
      const deptId = this.auth.user()?.departmentId;
      if (deptId) params['departmentId'] = deptId;
    }
    if (this.wardId) params['wardId'] = this.wardId;
    else if (this.router.url.includes('/citizen/nearby') || this.router.url.includes('/ward/')) {
      const wardId = this.auth.user()?.wardId;
      if (wardId) params['wardId'] = wardId;
    }

    this.api.getIssues(params).subscribe((res: any) => {
      if (res.data) {
        this.issues = res.data;
        this.total = res.total || 0;
        this.totalPages = res.totalPages || 1;
      }
    });
  }

  prevPage() {
    if (this.page > 1) { this.page--; this.loadIssues(); }
  }

  nextPage() {
    if (this.page < this.totalPages) { this.page++; this.loadIssues(); }
  }

  bulkUpdate() {
    if (!this.bulkStatus || !this.issues.length) return;
    this.bulkLoading = true;
    this.api.bulkUpdateIssues(this.issues.map(i => i.id), { status: this.bulkStatus }).subscribe({
      next: () => { this.bulkLoading = false; this.bulkStatus = ''; this.loadIssues(); },
      error: () => { this.bulkLoading = false; },
    });
  }

  exportCsv() {
    this.exporting = true;
    const params: Record<string, string> = {};
    if (this.filterStatus) params['status'] = this.filterStatus;
    if (this.departmentId) params['departmentId'] = this.departmentId;
    this.api.exportIssuesCsv(params).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'issues-export.csv';
        a.click();
        URL.revokeObjectURL(url);
        this.exporting = false;
      },
      error: () => { this.exporting = false; },
    });
  }
}
