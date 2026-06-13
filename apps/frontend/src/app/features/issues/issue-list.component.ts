import { Component, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { LayoutComponent } from '../../shared/layout.component';
import { AuthService } from '../../core/services/auth.service';
import { ApiService } from '../../core/services/api.service';
import { Issue, IssueStatus, IssueCategory } from '@dd/shared-types';

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
                  <td><span class="status-badge" [class]="issue.status.toLowerCase()">{{ issue.status }}</span></td>
                  <td><span class="priority-dot" [class]="'p' + (issue.priority || 3)"></span> {{ issue.priority || '-' }}/5</td>
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

  constructor(public auth: AuthService, private api: ApiService) {}

  ngOnInit() { this.loadIssues(); }

  loadIssues() {
    this.api.getIssues({
      page: String(this.page),
      search: this.search,
      status: this.filterStatus,
      category: this.filterCategory,
    }).subscribe((res: any) => {
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
}
