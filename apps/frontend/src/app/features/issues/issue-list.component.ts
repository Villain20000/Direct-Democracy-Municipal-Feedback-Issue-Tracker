import { Component, OnInit, inject } from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { LayoutComponent } from '../../shared/layout.component';
import { AuthService } from '../../core/services/auth.service';
import { ApiService } from '../../core/services/api.service';
import { TranslationService } from '../../core/i18n/translation.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { Issue, IssueStatus, IssueCategory, UserRole } from '@dd/shared-types';
import { issueStatusClass, formatIssueStatus as formatStatusI18n } from '../../core/utils/issue-ui';

type IssueWithScore = Issue & { score?: number; rankReason?: string };

@Component({
  selector: 'app-issue-list',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, LayoutComponent, DatePipe, DecimalPipe, TranslatePipe],
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
        @if (canManageDuplicates) {
          <button class="btn btn-secondary btn-sm" (click)="toggleDuplicateQueue()">
            <i class="material-icons-outlined" style="font-size:16px;">content_copy</i>
            {{ showDuplicateQueue ? ('issues.hideDuplicates' | t) : ('issues.showDuplicates' | t) }}
          </button>
        }
      </div>

      @if (showDuplicateQueue) {
        <div class="card" style="margin-bottom:16px;border-left:4px solid #D97706;" data-testid="duplicate-queue">
          <div class="card-header" style="display:flex;justify-content:space-between;align-items:center;">
            <h3>{{ 'issues.duplicateQueueTitle' | t }}</h3>
            <button class="btn btn-secondary btn-sm" (click)="loadDuplicateCandidates()" [disabled]="duplicateLoading">
              {{ duplicateLoading ? ('issues.loadingDuplicates' | t) : ('issues.refreshDuplicates' | t) }}
            </button>
          </div>
          <div class="card-body">
            @for (pair of duplicatePairs; track pair.issueA.id + pair.issueB.id) {
              <div style="padding:12px;border:1px solid var(--border);border-radius:var(--radius);margin-bottom:10px;">
                <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap;">
                  <div style="flex:1;min-width:200px;">
                    <div style="font-size:12px;color:var(--text-muted);margin-bottom:4px;">{{ 'issues.duplicateCandidateA' | t }}</div>
                    <a [routerLink]="['/issues', pair.issueA.id]" style="font-weight:600;font-size:13px;">{{ pair.issueA.title }}</a>
                  </div>
                  <div style="flex:1;min-width:200px;">
                    <div style="font-size:12px;color:var(--text-muted);margin-bottom:4px;">{{ 'issues.duplicateCandidateB' | t }}</div>
                    <a [routerLink]="['/issues', pair.issueB.id]" style="font-weight:600;font-size:13px;">{{ pair.issueB.title }}</a>
                  </div>
                  <div style="text-align:right;">
                    <span class="badge badge-amber">{{ i18n.t('issues.matchPct', { pct: ((pair.score * 100) | number:'1.0-0') }) }}</span>
                    <button class="btn btn-primary btn-sm" style="display:block;margin-top:8px;" (click)="linkDuplicate(pair.issueA.id, pair.issueB.id)" [disabled]="linkingId === pair.issueA.id">
                      {{ 'issues.linkAsDuplicate' | t }}
                    </button>
                  </div>
                </div>
                @if (pair.reason) {
                  <p style="font-size:12px;color:var(--text-secondary);margin-top:8px;">{{ pair.reason }}</p>
                }
              </div>
            } @empty {
              <p style="text-align:center;padding:24px;color:var(--text-muted);font-size:13px;">{{ 'issues.noDuplicateCandidates' | t }}</p>
            }
          </div>
        </div>
      }

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
  issues: IssueWithScore[] = [];
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
  canManageDuplicates = false;
  showDuplicateQueue = false;
  duplicatePairs: any[] = [];
  duplicateLoading = false;
  linkingId = '';
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
    this.canManageDuplicates = this.auth.hasRole(UserRole.SUPER_ADMIN, UserRole.MAYOR, UserRole.DEPARTMENT_HEAD);
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
        if (seq !== this.searchSeq) return;
        const raw = res.data || [];
        if (raw.length === 0 || res.mode !== 'semantic') {
          this.finishSmartSearch(seq, res.mode, raw, res.total || 0);
          return;
        }
        const candidates = raw.map((i: Issue) => ({
          id: i.id,
          title: i.title,
          description: i.description,
          category: i.category,
        }));
        this.api.aiSmartSearch(q, candidates).subscribe({
          next: (rankRes) => {
            if (seq !== this.searchSeq) return;
            const ranked = rankRes?.data?.results || rankRes?.results || [];
            const byId = new Map(raw.map((i: Issue) => [i.id, i]));
            const merged: IssueWithScore[] = ranked
              .map((r: any) => {
                const issue = byId.get(r.id);
                if (!issue) return null;
                return { ...issue, score: r.score ?? (issue as IssueWithScore).score, rankReason: r.reason };
              })
              .filter(Boolean) as IssueWithScore[];
            const rankedIds = new Set(merged.map((i) => i.id));
            for (const issue of raw) {
              if (!rankedIds.has(issue.id)) merged.push(issue);
            }
            this.finishSmartSearch(seq, 'semantic', merged, merged.length);
          },
          error: () => this.finishSmartSearch(seq, res.mode, raw, res.total || 0),
        });
      },
      error: () => {
        if (seq !== this.searchSeq) return;
        this.searching = false;
        this.searchMode = 'text-fallback';
        this.loadIssues();
      },
    });
  }

  private finishSmartSearch(seq: number, mode: typeof this.searchMode, raw: IssueWithScore[], total: number) {
    if (seq !== this.searchSeq) return;
    this.searching = false;
    this.searchMode = mode;
    const rawCount = raw.length;
    this.issues = raw;
    this.total = total;
    this.page = 1;
    this.totalPages = 1;
    if (this.filterStatus || this.filterCategory) {
      this.issues = this.issues.filter((i) => {
        if (this.filterStatus && i.status !== this.filterStatus) return false;
        if (this.filterCategory && i.category !== this.filterCategory) return false;
        return true;
      });
      this.total = this.issues.length;
    }
    this.filteredOutCount = (this.filterStatus || this.filterCategory) && this.issues.length === 0 && rawCount > 0
      ? rawCount
      : 0;
  }

  toggleDuplicateQueue() {
    this.showDuplicateQueue = !this.showDuplicateQueue;
    if (this.showDuplicateQueue && !this.duplicatePairs.length) {
      this.loadDuplicateCandidates();
    }
  }

  loadDuplicateCandidates() {
    this.duplicateLoading = true;
    this.api.getDuplicateCandidates(15).subscribe({
      next: (res) => {
        this.duplicatePairs = res.data || [];
        this.duplicateLoading = false;
      },
      error: () => { this.duplicatePairs = []; this.duplicateLoading = false; },
    });
  }

  linkDuplicate(duplicateId: string, canonicalId: string) {
    this.linkingId = duplicateId;
    this.api.linkIssueDuplicate(duplicateId, canonicalId).subscribe({
      next: () => {
        this.duplicatePairs = this.duplicatePairs.filter(
          (p) => p.issueA.id !== duplicateId && p.issueB.id !== duplicateId,
        );
        this.linkingId = '';
      },
      error: () => { this.linkingId = ''; },
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
