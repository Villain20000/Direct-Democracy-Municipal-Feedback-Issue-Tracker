import { Component, OnInit, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { LayoutComponent, NavItem } from '../../shared/layout.component';
import { AuthService } from '../../core/services/auth.service';
import { ApiService } from '../../core/services/api.service';
import { TranslationService } from '../../core/i18n/translation.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { Issue, IssueStatus } from '@dd/shared-types';

/**
 * P1-14 — Staff Kanban board. Columns follow the status pipeline
 * (Submitted → Acknowledged → In Progress → Pending Review → Resolved)
 * and every move reuses `updateIssueStatus`, so status history,
 * notifications, and SLA side effects behave exactly like the detail
 * page buttons. Moves are optimistic with revert on failure; cards are
 * native drag sources AND expose prev/next buttons so keyboard and
 * mobile users get the same moves without a pointer drag.
 */
const KANBAN_COLUMNS: IssueStatus[] = [
  IssueStatus.SUBMITTED,
  IssueStatus.ACKNOWLEDGED,
  IssueStatus.IN_PROGRESS,
  IssueStatus.PENDING_REVIEW,
  IssueStatus.RESOLVED,
];
type KanbanStatus = IssueStatus;

@Component({
  selector: 'app-staff-tasks-page',
  standalone: true,
  imports: [CommonModule, RouterLink, LayoutComponent, DatePipe, TranslatePipe],
  styles: [`
    .kanban-board {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: 12px;
      align-items: start;
    }
    .kanban-column {
      background: var(--bg-primary);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      min-height: 180px;
      transition: border-color 150ms ease, box-shadow 150ms ease;
    }
    .kanban-column.drop-target {
      border-color: var(--primary);
      box-shadow: 0 0 0 2px color-mix(in srgb, var(--primary) 30%, transparent);
    }
    .kanban-column-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 10px 12px;
      border-bottom: 1px solid var(--border);
      font-size: 13px;
      font-weight: 700;
    }
    .kanban-wip {
      font-size: 11px;
      font-weight: 700;
      background: var(--bg-secondary, #EEF2FF);
      border-radius: 999px;
      padding: 2px 8px;
      color: var(--text-secondary);
    }
    .kanban-wip.over {
      background: #FEF2F2;
      color: var(--danger);
    }
    .kanban-cards {
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 10px;
      min-height: 120px;
    }
    .kanban-card {
      background: var(--card-bg, #fff);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 10px 12px;
      cursor: grab;
      transition: box-shadow 150ms ease, opacity 150ms ease;
    }
    .kanban-card:active { cursor: grabbing; }
    .kanban-card.dragging { opacity: 0.5; }
    .kanban-card.pending { opacity: 0.65; }
    .kanban-card:focus-visible {
      outline: 2px solid var(--primary);
      outline-offset: 2px;
    }
    .kanban-card-title {
      font-size: 13px;
      font-weight: 600;
      margin-bottom: 4px;
    }
    .kanban-card-meta {
      font-size: 11px;
      color: var(--text-muted);
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      margin-bottom: 8px;
    }
    .kanban-card-moves {
      display: flex;
      gap: 4px;
    }
    .kanban-empty {
      font-size: 12px;
      color: var(--text-muted);
      text-align: center;
      padding: 16px 8px;
      border: 1px dashed var(--border);
      border-radius: var(--radius);
    }
    @media (prefers-reduced-motion: reduce) {
      .kanban-column, .kanban-card { transition: none; }
    }
  `],
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
        <div class="kanban-board" data-testid="kanban-board" role="list" [attr.aria-label]="i18n.t('staffTasks.header')">
          @for (col of columns; track col) {
            <section
              class="kanban-column"
              [class.drop-target]="dropColumn === col"
              data-testid="kanban-column"
              [attr.data-status]="col"
              role="listitem"
              [attr.aria-label]="columnLabel(col)"
              (dragover)="onDragOver($event, col)"
              (dragleave)="onDragLeave(col)"
              (drop)="onDrop($event, col)">
              <div class="kanban-column-header">
                <span>{{ columnLabel(col) }}</span>
                <span
                  class="kanban-wip"
                  [class.over]="isOverWip(col)"
                  [title]="i18n.t('staffTasks.wipHint')"
                  data-testid="kanban-wip"
                  [attr.data-status]="col">{{ columnIssues(col).length }}</span>
              </div>
              <div class="kanban-cards">
                @for (issue of columnIssues(col); track issue.id) {
                  <article
                    class="kanban-card"
                    [class.dragging]="dragIssueId === issue.id"
                    [class.pending]="updatingId === issue.id"
                    draggable="true"
                    tabindex="0"
                    data-testid="kanban-card"
                    [attr.data-issue-id]="issue.id"
                    [attr.aria-label]="issue.title"
                    (dragstart)="onDragStart($event, issue)"
                    (dragend)="onDragEnd()"
                    (keydown.enter)="focusMove(issue, 1)"
                    (keydown.arrowRight)="focusMove(issue, 1)"
                    (keydown.arrowLeft)="focusMove(issue, -1)">
                    <div class="kanban-card-title">
                      <a [routerLink]="['/issues', issue.id]">{{ issue.title }}</a>
                    </div>
                    <div class="kanban-card-meta">
                      <span><span class="priority-dot" [ngClass]="'p' + (issue.priority || 3)"></span> {{ issue.priority || '-' }}/5</span>
                      <span>{{ issue.location }}</span>
                      <span>{{ issue.createdAt | date:'mediumDate' }}</span>
                    </div>
                    <div class="kanban-card-moves">
                      <button
                        type="button"
                        class="btn btn-ghost btn-sm"
                        [disabled]="updatingId === issue.id || columnIndex(issue.status) <= 0"
                        (click)="moveByStep(issue, -1)"
                        [attr.aria-label]="i18n.t('staffTasks.moveBack', { title: issue.title })"
                        [title]="i18n.t('staffTasks.moveBackHint')">‹</button>
                      <button
                        type="button"
                        class="btn btn-ghost btn-sm"
                        [disabled]="updatingId === issue.id || columnIndex(issue.status) >= columns.length - 1"
                        (click)="moveByStep(issue, 1)"
                        [attr.aria-label]="i18n.t('staffTasks.moveForward', { title: issue.title })"
                        [title]="i18n.t('staffTasks.moveForwardHint')">›</button>
                    </div>
                  </article>
                } @empty {
                  <div class="kanban-empty">{{ i18n.t('staffTasks.emptyColumn') }}</div>
                }
              </div>
            </section>
          }
        </div>
        @if (!issues.length) {
          <div class="card" style="margin-top:12px;"><div class="card-body" style="text-align:center;padding:24px;color:var(--text-muted);">{{ i18n.t('staffTasks.noTasks') }}</div></div>
        }
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

  columns: KanbanStatus[] = [...KANBAN_COLUMNS];
  dragIssueId: string | null = null;
  dropColumn: KanbanStatus | null = null;

  /** Soft WIP signal: IN_PROGRESS above this count highlights the counter. */
  readonly wipSoftLimit = 5;

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
    // /staff/completed pins the board to the RESOLVED column only.
    if (this.statusFilter && (KANBAN_COLUMNS as readonly string[]).includes(this.statusFilter)) {
      this.columns = [this.statusFilter as KanbanStatus];
    }
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
        // Overflow: any status outside the five pipeline columns (e.g.
        // VERIFIED) gets its own column so no assigned card is ever hidden.
        const extras = [...new Set(this.issues.map((i) => i.status))].filter(
          (s) => !this.columns.includes(s as KanbanStatus),
        ) as KanbanStatus[];
        if (extras.length) this.columns = [...this.columns, ...extras];
        this.loading = false;
      },
      error: (err) => {
        this.error = err.error?.error || this.i18n.t('staffTasks.loadFailed');
        this.loading = false;
      },
    });
  }

  columnIssues(status: string): Issue[] {
    return this.issues.filter((i) => i.status === status);
  }

  columnIndex(status: string): number {
    return this.columns.indexOf(status as KanbanStatus);
  }

  columnLabel(status: string): string {
    return this.i18n.tStatus(status);
  }

  isOverWip(col: KanbanStatus): boolean {
    return col === 'IN_PROGRESS' && this.columnIssues(col).length > this.wipSoftLimit;
  }

  statusClass(status: string): string {
    return status.toLowerCase().replace(/_/g, '-');
  }

  // -----------------------------------------------------------------
  // Drag & drop (native HTML5 — no extra deps, works with the
  // keyboard/move-button path below sharing one moveIssue core).
  // -----------------------------------------------------------------
  onDragStart(event: DragEvent, issue: Issue) {
    this.dragIssueId = issue.id;
    event.dataTransfer?.setData('text/plain', issue.id);
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
  }

  onDragOver(event: DragEvent, col: KanbanStatus) {
    if (!this.dragIssueId) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
    this.dropColumn = col;
  }

  onDragLeave(col: KanbanStatus) {
    if (this.dropColumn === col) this.dropColumn = null;
  }

  onDragEnd() {
    this.dragIssueId = null;
    this.dropColumn = null;
  }

  onDrop(event: DragEvent, col: KanbanStatus) {
    event.preventDefault();
    const id = event.dataTransfer?.getData('text/plain') || this.dragIssueId;
    this.dropColumn = null;
    this.dragIssueId = null;
    if (!id) return;
    const issue = this.issues.find((i) => i.id === id);
    if (issue && issue.status !== col) this.moveIssue(issue, col);
  }

  // -----------------------------------------------------------------
  // Keyboard / touch path: ‹ › buttons and arrow keys on a focused
  // card move one pipeline step. Same optimistic core as drop.
  // -----------------------------------------------------------------
  moveByStep(issue: Issue, delta: -1 | 1) {
    const idx = this.columnIndex(issue.status);
    const target = this.columns[idx + delta];
    if (!target || target === issue.status) return;
    this.moveIssue(issue, target);
  }

  focusMove(issue: Issue, delta: -1 | 1) {
    this.moveByStep(issue, delta);
  }

  /** Back-compat for any template still calling the flat-list action. */
  updateStatus(issue: Issue, status: string) {
    if ((KANBAN_COLUMNS as readonly string[]).includes(status)) {
      this.moveIssue(issue, status as KanbanStatus);
    }
  }

  /**
   * Optimistic status move reusing `updateIssueStatus` (the same
   * endpoint as the detail page, so history + notifications fire).
   * The card jumps immediately; a failure rolls it back in place.
   */
  moveIssue(issue: Issue, status: KanbanStatus) {
    if (this.updatingId || issue.status === status) return;
    const previous = issue.status;
    this.updatingId = issue.id;
    this.error = '';
    issue.status = status;
    this.issues = [...this.issues];
    this.api.updateIssueStatus(issue.id, status).subscribe({
      next: (res: any) => {
        if (res.success && res.data) {
          const idx = this.issues.findIndex((i) => i.id === issue.id);
          if (idx >= 0) {
            this.issues[idx] = res.data;
            this.issues = [...this.issues];
          }
        } else {
          this.revertMove(issue.id, previous);
        }
        this.updatingId = '';
      },
      error: (err) => {
        this.revertMove(issue.id, previous);
        this.error = err.error?.error || this.i18n.t('staffTasks.updateFailed');
        this.updatingId = '';
      },
    });
  }

  private revertMove(id: string, previous: KanbanStatus) {
    const issue = this.issues.find((i) => i.id === id);
    if (issue) {
      issue.status = previous;
      this.issues = [...this.issues];
    }
  }
}
