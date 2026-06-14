import { Component, OnInit, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { LayoutComponent } from '../../shared/layout.component';
import { AuthService } from '../../core/services/auth.service';
import { ApiService } from '../../core/services/api.service';
import { TranslationService } from '../../core/i18n/translation.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { Issue, IssueStatus, IssueCategory, UserRole } from '@dd/shared-types';
import { issueStatusClass, formatIssueStatus as formatStatusI18n } from '../../core/utils/issue-ui';

@Component({
  selector: 'app-issue-list',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, LayoutComponent, DatePipe, TranslatePipe],
  template: `
    <app-layout
      [pageTitle]="i18n.t('issues.allIssues')"
      [navItems]="navItems"
      (logout)="auth.logout()">

      <div style="display:flex;gap:12px;margin-bottom:24px;flex-wrap:wrap;align-items:center;">
        <div style="flex:1;min-width:200px;position:relative;">
          <i class="material-icons-outlined" style="position:absolute;left:12px;top:50%;transform:translateY(-50%);color:var(--text-muted);font-size:18px;pointer-events:none;">{{ searchSmart ? 'travel_explore' : 'search' }}</i>
          <input
            type="text"
            [(ngModel)]="search"
            (ngModelChange)="onSearchChange()"
            [placeholder]="i18n.t('issues.searchPlaceholder')"
            style="width:100%;padding:10px 16px 10px 40px;padding-right:90px;border:1px solid var(--border);border-radius:var(--radius);font-size:13px;"
          />
          @if (searching) {
            <span style="position:absolute;right:80px;top:50%;transform:translateY(-50%);font-size:11px;color:var(--text-muted);">
              <i class="material-icons-outlined" style="font-size:14px;vertical-align:middle;animation:spin 1s linear infinite;">progress_activity</i>
            </span>
          }
          @if (searchMode && search.trim().length >= 3) {
            <span
              [class.semantic-badge-on]="searchMode === 'semantic'"
              [class.semantic-badge-fallback]="searchMode === 'text-fallback'"
              [class.semantic-badge-empty]="searchMode === 'text-empty'"
              [title]="searchMode === 'semantic' ? i18n.t('issues.semanticOn') : (searchMode === 'text-fallback' ? i18n.t('issues.semanticFallback') : i18n.t('issues.semanticEmpty'))"
              style="position:absolute;right:12px;top:50%;transform:translateY(-50%);font-size:10px;font-weight:700;padding:2px 8px;border-radius:999px;text-transform:uppercase;letter-spacing:0.4px;display:flex;align-items:center;gap:3px;">
              {{ searchMode === 'semantic' ? i18n.t('issues.semanticBadge') : i18n.t('issues.textBadge') }}
            </span>
          }
        </div>
        <select [(ngModel)]="filterStatus" (ngModelChange)="loadIssues()" style="padding:10px 14px;border:1px solid var(--border);border-radius:var(--radius);font-size:13px;">
          <option value="">{{ i18n.t('issues.allStatuses') }}</option>
          @for (s of statuses; track s) { <option [value]="s">{{ i18n.tEnum('status', s) }}</option> }
        </select>
        <select [(ngModel)]="filterCategory" (ngModelChange)="loadIssues()" style="padding:10px 14px;border:1px solid var(--border);border-radius:var(--radius);font-size:13px;">
          <option value="">{{ i18n.t('issues.allCategories') }}</option>
          @for (c of categories; track c) { <option [value]="c">{{ i18n.tCategory(c) }}</option> }
        </select>
        <button class="btn btn-primary" routerLink="/issues/new"><i class="material-icons-outlined" style="font-size:16px;">add</i> {{ 'issues.newIssue' | t }}</button>
        @if (canBulkUpdate) {
          <select [(ngModel)]="bulkStatus" style="padding:10px 14px;border:1px solid var(--border);border-radius:var(--radius);font-size:13px;">
            <option value="">{{ i18n.t('issues.bulkStatus') }}</option>
            @for (s of statuses; track s) { <option [value]="s">{{ i18n.tEnum('status', s) }}</option> }
          </select>
          <button class="btn btn-secondary btn-sm" (click)="bulkUpdate()" [disabled]="!bulkStatus || bulkLoading">{{ 'issues.applyToPage' | t }}</button>
        }
        @if (canExport) {
          <button class="btn btn-secondary btn-sm" (click)="exportCsv()" [disabled]="exporting">{{ 'issues.export' | t }}</button>
        }
      </div>

      <div class="card">
        <div class="card-body" style="padding:0;">
          <table class="data-table">
            <thead>
              <tr>
                <th>{{ 'admin.title' | t }}</th><th>{{ 'issues.category' | t }}</th><th>{{ 'citizen.tableStatus' | t }}</th><th>{{ 'issues.priority' | t }}</th>
                <th>{{ 'issues.upvotes' | t }}</th><th>{{ 'issues.reporter' | t }}</th><th>{{ 'issues.date' | t }}</th>
              </tr>
            </thead>
            <tbody>
              @for (issue of issues; track issue.id) {
                <tr [routerLink]="['/issues', issue.id]" style="cursor:pointer;">
                  <td>
                    <strong>{{ issue.title }}</strong>
                    @if (issue.score !== undefined) {
                      <span [style.background]="scoreColor(issue.score)" [style.color]="'#fff'" style="display:inline-block;margin-left:6px;padding:1px 6px;border-radius:999px;font-size:10px;font-weight:700;vertical-align:middle;" [title]="'similarity'">
                        {{ (issue.score * 100).toFixed(0) }}%
                      </span>
                    }
                    <br><span style="font-size:11px;color:var(--text-muted);">{{ issue.location }}</span>
                  </td>
                  <td><span class="badge badge-blue">{{ i18n.tCategory(issue.category) }}</span></td>
                  <td><span class="status-badge" [ngClass]="issueStatusClass(issue.status)">{{ formatIssueStatus(issue.status) }}</span></td>
                  <td><span class="priority-dot" [ngClass]="'p' + (issue.priority || 3)"></span> {{ issue.priority || '-' }}/5</td>
                  <td style="font-weight:700;">▲ {{ issue.upvotes }}</td>
                  <td style="font-size:12px;">{{ issue.reporter?.firstName || i18n.t('detail.anonymous') }}</td>
                  <td style="color:var(--text-muted);font-size:12px;">{{ issue.createdAt | date:'mediumDate' }}</td>
                </tr>
              } @empty {
                <tr><td colspan="7" style="text-align:center;padding:48px;color:var(--text-muted);">{{ 'issues.noIssues' | t }}</td></tr>
              }
            </tbody>
          </table>
        </div>
      </div>

      <div style="display:flex;justify-content:space-between;align-items:center;margin-top:16px;flex-wrap:wrap;gap:8px;">
        <div style="font-size:13px;color:var(--text-muted);display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
          <span>{{ i18n.t('issues.showingOf', { shown: issues.length, total: total }) }}</span>
          @if (filteredOutCount > 0) {
            <span style="background:#FEF3C7;color:#92400E;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:600;">
              {{ i18n.t('issues.filteredOut', { n: filteredOutCount }) }}
            </span>
          }
        </div>
        <div style="display:flex;gap:8px;">
          <button class="btn btn-secondary btn-sm" [disabled]="page <= 1" (click)="prevPage()">← {{ 'common.previous' | t }}</button>
          <button class="btn btn-secondary btn-sm" [disabled]="page >= totalPages" (click)="nextPage()">{{ 'common.next' | t }} →</button>
        </div>
      </div>
    </app-layout>
  `,
  styles: [`
    @keyframes spin {
      from { transform: translateY(-50%) rotate(0deg); }
      to   { transform: translateY(-50%) rotate(360deg); }
    }
    .semantic-badge-on {
      background: #DCFCE7;
      color: #166534;
    }
    .semantic-badge-fallback {
      background: #FEF3C7;
      color: #92400E;
    }
    .semantic-badge-empty {
      background: var(--bg-primary);
      color: var(--text-muted);
    }
  `],
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
    { icon: 'report_problem', label: 'nav.issues', route: '/issues' },
  ] as any;

  bulkStatus = '';
  bulkLoading = false;
  exporting = false;
  canBulkUpdate = false;
  canExport = false;
  // Smart search state.
  searching = false;
  searchMode: 'semantic' | 'text-fallback' | 'text-empty' | null = null;
  searchSmart = true; // when true, the search bar hits /issues/search-similar first
  filteredOutCount = 0; // when > 0, the smart search hit N rows but status/category filters excluded all of them
  private searchSeq = 0;
  private searchDebounce: ReturnType<typeof setTimeout> | null = null;
  private sortBy = '';
  private departmentId = '';
  private wardId = '';

  issueStatusClass = issueStatusClass;
  formatIssueStatus(status: string) { return formatStatusI18n(status, this.i18n); }

  auth = inject(AuthService);
  api = inject(ApiService);
  i18n = inject(TranslationService);
  route = inject(ActivatedRoute);
  router = inject(Router);

  constructor() {
    this.canBulkUpdate = this.auth.hasRole(UserRole.SUPER_ADMIN, UserRole.MAYOR, UserRole.DEPARTMENT_HEAD, UserRole.STAFF);
    this.canExport = this.auth.hasRole(UserRole.SUPER_ADMIN, UserRole.MAYOR, UserRole.AUDITOR, UserRole.DEPARTMENT_HEAD);
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

  /**
   * Smart search bar handler. Two-mode behavior:
   *   - `search.trim().length >= 3` and `searchSmart` is on: hit the
   *     semantic search endpoint (`/issues/search-similar`). The backend
   *     falls back to text matching if Ollama is down, and surfaces that
   *     via `mode: 'text-fallback'`, which the UI shows as an amber
   *     badge so the user knows what's happening.
   *   - Otherwise (short query, or no smart search): the regular
   *     paginated text search runs.
   *
   * Debounced 350ms so we don't fire a request on every keystroke.
   * Sequence-countered to drop stale responses from earlier in-flight
   * requests (a fast typist can outpace the response).
   */
  onSearchChange() {
    if (this.searchDebounce) clearTimeout(this.searchDebounce);
    const q = this.search.trim();
    if (q.length >= 3 && this.searchSmart) {
      this.searchDebounce = setTimeout(() => this.runSmartSearch(q), 350);
    } else {
      this.searchDebounce = setTimeout(() => this.loadIssues(), 350);
    }
  }

  private runSmartSearch(q: string) {
    this.searching = true;
    const seq = ++this.searchSeq;
    this.api.searchSimilarIssues(q, 20, 0.2).subscribe({
      next: (res) => {
        if (seq !== this.searchSeq) return; // stale response
        this.searching = false;
        this.searchMode = res.mode;
        const raw = res.data || [];
        const rawCount = raw.length;
        this.issues = raw;
        this.total = res.total || 0;
        this.page = 1;
        this.totalPages = 1;
        // Filters (status/category) can't be applied server-side on the
        // semantic result, so filter the client-side result if both
        // filters and a query are active.
        if (this.filterStatus || this.filterCategory) {
          this.issues = this.issues.filter((i) => {
            if (this.filterStatus && i.status !== this.filterStatus) return false;
            if (this.filterCategory && i.category !== this.filterCategory) return false;
            return true;
          });
          this.total = this.issues.length;
        }
        // UX guard: if the semantic search found rows but the filters
        // excluded all of them, surface that to the user with a
        // dedicated hint so the "Smart" badge doesn't sit on an empty
        // list looking broken.
        this.filteredOutCount = (this.filterStatus || this.filterCategory) && this.issues.length === 0 && rawCount > 0
          ? rawCount
          : 0;
      },
      error: () => {
        if (seq !== this.searchSeq) return;
        this.searching = false;
        this.searchMode = 'text-fallback';
        this.loadIssues();
      },
    });
  }

  loadIssues() {
    // If a smart search is currently active, a filter change should
    // re-filter the in-memory result client-side rather than losing the
    // similarity ranking by falling back to paginated text search.
    if (this.search.trim().length >= 3 && this.searchSmart && this.searchMode === 'semantic' && this.issues.length > 0) {
      this.runSmartSearch(this.search.trim());
      return;
    }

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

    this.searching = true;
    const seq = ++this.searchSeq;
    this.api.getIssues(params).subscribe((res: any) => {
      if (seq !== this.searchSeq) return; // stale response
      this.searching = false;
      this.searchMode = null;
      this.filteredOutCount = 0;
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

  private scoreColor(score: number): string {
    if (score >= 0.7) return '#16A34A';
    if (score >= 0.5) return '#D97706';
    return '#DC2626';
  }
}
