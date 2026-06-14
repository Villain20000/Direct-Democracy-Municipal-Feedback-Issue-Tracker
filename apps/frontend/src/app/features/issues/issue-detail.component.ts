import { Component, OnInit } from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { LayoutComponent } from '../../shared/layout.component';
import { AuthService } from '../../core/services/auth.service';
import { ApiService } from '../../core/services/api.service';
import { Issue, UserRole } from '@dd/shared-types';
import { issueStatusClass, formatIssueStatus } from '../../core/utils/issue-ui';

@Component({
  selector: 'app-issue-detail',
  standalone: true,
  imports: [CommonModule, RouterLink, LayoutComponent, DatePipe, DecimalPipe],
  template: `
    <app-layout
      [pageTitle]="issue?.title || 'Issue Detail'"
      [navItems]="navItems"
      (logout)="auth.logout()">

      @if (issue) {
        <div style="display:flex;gap:24px;">
          <div style="flex:2;">
            <div class="card" style="margin-bottom:24px;">
              <div class="card-body">
                <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px;">
                  <div>
                    <h2 style="font-size:22px;font-weight:800;margin-bottom:8px;">{{ issue.title }}</h2>
                    <div style="display:flex;gap:8px;flex-wrap:wrap;">
                      <span class="badge badge-blue">{{ issue.category }}</span>
                      <span class="status-badge" [ngClass]="issueStatusClass(issue.status)">{{ formatIssueStatus(issue.status) }}</span>
                      @if (issue.priority) {
                        <span class="badge" [class]="issue.priority >= 4 ? 'badge-red' : issue.priority >= 3 ? 'badge-amber' : 'badge-green'">
                          Priority: {{ issue.priority }}/5
                        </span>
                      }
                    </div>
                  </div>
                  <div style="display:flex;gap:8px;">
                    <button class="btn btn-primary btn-sm" (click)="upvote()">▲ Upvote ({{ issue.upvotes }})</button>
                  </div>
                </div>
                <p style="font-size:14px;color:var(--text-secondary);line-height:1.8;margin-bottom:16px;">{{ issue.description }}</p>
                <div style="display:flex;gap:24px;font-size:13px;color:var(--text-muted);">
                  <span>📍 {{ issue.location }}</span>
                  <span>👤 {{ issue.reporter?.firstName }} {{ issue.reporter?.lastName }}</span>
                  <span>📅 {{ issue.createdAt | date:'medium' }}</span>
                  <span>👁 {{ issue.viewCount }} views</span>
                </div>
              </div>
            </div>

            @if (attachments.length) {
              <div class="card" style="margin-bottom:24px;">
                <div class="card-header"><h3>Attachments ({{ attachments.length }})</h3></div>
                <div class="card-body">
                  @for (att of attachments; track att.id) {
                    <div style="display:flex;align-items:center;gap:12px;padding:8px 0;border-bottom:1px solid var(--border-light);">
                      <i class="material-icons-outlined">attach_file</i>
                      <a [href]="att.fileUrl" target="_blank" style="flex:1;font-size:13px;">{{ att.fileName }}</a>
                      <span style="font-size:11px;color:var(--text-muted);">{{ (att.fileSize / 1024) | number:'1.0-0' }} KB</span>
                    </div>
                  }
                </div>
              </div>
            }

            <div class="card" style="margin-bottom:24px;">
              <div class="card-header"><h3>Comments ({{ issue.comments?.length || 0 }})</h3></div>
              <div class="card-body">
                @for (comment of issue.comments; track comment.id) {
                  <div style="display:flex;gap:12px;padding:14px 0;border-bottom:1px solid var(--border-light);">
                    <div style="width:36px;height:36px;border-radius:50%;background:var(--primary);color:white;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;">
                      {{ comment.user?.firstName?.[0] }}{{ comment.user?.lastName?.[0] }}
                    </div>
                    <div style="flex:1;">
                      <div style="display:flex;justify-content:space-between;">
                        <strong style="font-size:13px;">{{ comment.user?.firstName }} {{ comment.user?.lastName }}</strong>
                        <span style="font-size:11px;color:var(--text-muted);">{{ comment.createdAt | date:'medium' }}</span>
                      </div>
                      <p style="font-size:13px;color:var(--text-secondary);margin-top:6px;">{{ comment.content }}</p>
                    </div>
                  </div>
                }
                <div style="margin-top:16px;display:flex;gap:8px;">
                  <input #commentInput type="text" placeholder="Add a comment..." style="flex:1;padding:10px 16px;border:1px solid var(--border);border-radius:var(--radius);font-size:13px;" />
                  <button class="btn btn-primary" (click)="postComment(commentInput)">Post</button>
                </div>
              </div>
            </div>
          </div>

          <div style="flex:1;">
            @if (canUpdateStatus) {
              <div class="card" style="margin-bottom:24px;">
                <div class="card-header"><h3>Update Status</h3></div>
                <div class="card-body">
                  @if (statusError) {
                    <div style="color:var(--danger);font-size:13px;margin-bottom:12px;">{{ statusError }}</div>
                  }
                  @if (statusMessage) {
                    <div style="color:var(--success);font-size:13px;margin-bottom:12px;">{{ statusMessage }}</div>
                  }
                  <div style="display:flex;gap:8px;flex-wrap:wrap;">
                    <button type="button" class="btn btn-primary btn-sm" [disabled]="statusUpdating || issue.status === 'IN_PROGRESS'" (click)="updateStatus('IN_PROGRESS')">▶ Start</button>
                    <button type="button" class="btn btn-secondary btn-sm" [disabled]="statusUpdating" (click)="updateStatus('PENDING_REVIEW')">Review</button>
                    <button type="button" class="btn btn-success btn-sm" [disabled]="statusUpdating || issue.status === 'RESOLVED'" (click)="updateStatus('RESOLVED')">✓ Resolve</button>
                  </div>
                </div>
              </div>
            }

            <div class="card" style="margin-bottom:24px;">
              <div class="card-header"><h3>Status</h3></div>
              <div class="card-body">
                @for (status of statusFlow; track status) {
                  <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">
                    <div style="width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;"
                      [style.background]="status === issue.status ? 'var(--primary)' : isPastStatus(status) ? 'var(--success)' : 'var(--border)'"
                      [style.color]="status === issue.status || isPastStatus(status) ? 'white' : 'var(--text-muted)'">
                      @if (isPastStatus(status)) { ✓ } @else if (status === issue.status) { ● } @else { ○ }
                    </div>
                    <span style="font-size:13px;" [style.font-weight]="status === issue.status ? '700' : '400'"
                      [style.color]="status === issue.status ? 'var(--primary)' : 'var(--text-muted)'">{{ status }}</span>
                  </div>
                }
              </div>
            </div>

            <div class="card" style="margin-bottom:24px;">
              <div class="card-header"><h3>Details</h3></div>
              <div class="card-body">
                <div style="font-size:13px;margin-bottom:12px;"><span style="color:var(--text-muted);">Department:</span> <strong>{{ issue.department?.name || 'Unassigned' }}</strong></div>
                <div style="font-size:13px;margin-bottom:12px;"><span style="color:var(--text-muted);">Ward:</span> <strong>{{ issue.ward?.name || 'N/A' }}</strong></div>
                <div style="font-size:13px;margin-bottom:12px;"><span style="color:var(--text-muted);">Assigned to:</span> <strong>{{ issue.assignee?.firstName || 'Unassigned' }}</strong></div>
                @if (issue.resolvedAt) {
                  <div style="font-size:13px;"><span style="color:var(--text-muted);">Resolved:</span> <strong>{{ issue.resolvedAt | date:'medium' }}</strong></div>
                }
              </div>
            </div>

            <div class="card">
              <div class="card-header"><h3>🤖 AI Analysis</h3></div>
              <div class="card-body">
                <div style="padding:12px;background:var(--bg-primary);border-radius:var(--radius);margin-bottom:10px;">
                  <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;">AI Category</div>
                  <div style="font-size:14px;font-weight:600;">{{ aiCategory || issue.aiCategory || 'Pending analysis...' }}</div>
                </div>
                <div style="padding:12px;background:var(--bg-primary);border-radius:var(--radius);margin-bottom:10px;">
                  <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;">Sentiment</div>
                  <div style="font-size:14px;font-weight:600;">{{ aiSentiment || issue.aiSentiment || 'Pending analysis...' }}</div>
                </div>
                @if (aiSummary) {
                  <div style="padding:12px;background:var(--bg-primary);border-radius:var(--radius);margin-bottom:10px;font-size:13px;">{{ aiSummary }}</div>
                }
                <button class="btn btn-secondary btn-sm" style="width:100%;" (click)="runAiAnalysis()" [disabled]="aiLoading">
                  <i class="material-icons-outlined" style="font-size:16px;">auto_awesome</i>
                  @if (aiLoading) { Analyzing... } @else { Run AI Analysis }
                </button>
              </div>
            </div>
          </div>
        </div>
      } @else if (loadError) {
        <div class="card"><div class="card-body" style="color:var(--danger);">{{ loadError }}</div></div>
      }
    </app-layout>
  `,
})
export class IssueDetailComponent implements OnInit {
  issue: Issue | null = null;
  attachments: { id: string; fileName: string; fileUrl: string; fileSize: number }[] = [];
  loadError = '';
  aiLoading = false;
  aiSummary = '';
  aiCategory = '';
  aiSentiment = '';
  statusUpdating = false;
  statusError = '';
  statusMessage = '';
  statusFlow = ['SUBMITTED', 'ACKNOWLEDGED', 'IN_PROGRESS', 'PENDING_REVIEW', 'RESOLVED', 'VERIFIED'];
  navItems = [{ icon: 'arrow_back', label: 'Back to Issues', route: '/issues' }];

  issueStatusClass = issueStatusClass;
  formatIssueStatus = formatIssueStatus;

  constructor(public auth: AuthService, private api: ApiService, private route: ActivatedRoute) {}

  get canUpdateStatus(): boolean {
    return this.auth.hasRole(
      UserRole.SUPER_ADMIN, UserRole.MAYOR, UserRole.DEPARTMENT_HEAD, UserRole.STAFF
    );
  }

  ngOnInit() { this.reloadIssue(); }

  reloadIssue() {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) return;
    this.loadError = '';
    this.api.getIssue(id).subscribe({
      next: (res) => {
        if (res.success) {
          this.issue = res.data;
          this.attachments = (res.data as any).attachments || [];
        }
      },
      error: (err) => { this.loadError = err.error?.error || 'Failed to load issue.'; },
    });
  }

  runAiAnalysis() {
    if (!this.issue) return;
    this.aiLoading = true;
    const text = `${this.issue.title}. ${this.issue.description}`;
    this.api.aiCategorize(text).subscribe({
      next: (cat: any) => {
        if (cat.success) this.aiCategory = cat.data?.category || '';
        this.api.aiSentiment(text).subscribe({
          next: (sent: any) => {
            if (sent.success) this.aiSentiment = sent.data?.sentiment || '';
            this.api.aiSummarize(text, 200).subscribe({
              next: (sum: any) => {
                this.aiLoading = false;
                if (sum.success) this.aiSummary = sum.data?.summary || '';
              },
              error: () => { this.aiLoading = false; },
            });
          },
          error: () => { this.aiLoading = false; },
        });
      },
      error: () => { this.aiLoading = false; },
    });
  }

  upvote() {
    if (!this.issue) return;
    this.api.upvoteIssue(this.issue.id).subscribe(res => {
      if (res.success && this.issue) {
        this.issue.upvotes += res.data.voted ? 1 : -1;
      }
    });
  }

  isPastStatus(status: string): boolean {
    if (!this.issue) return false;
    const idx = this.statusFlow.indexOf(status);
    const currentIdx = this.statusFlow.indexOf(this.issue.status);
    return idx < currentIdx;
  }

  updateStatus(status: string) {
    if (!this.issue || this.statusUpdating) return;
    this.statusUpdating = true;
    this.statusError = '';
    this.statusMessage = '';
    this.api.updateIssueStatus(this.issue.id, status).subscribe({
      next: (res) => {
        if (res.success) {
          this.issue = { ...this.issue!, ...res.data };
          this.statusMessage = `Status updated to ${formatIssueStatus(status)}.`;
          setTimeout(() => { this.statusMessage = ''; }, 4000);
        }
        this.statusUpdating = false;
      },
      error: (err) => {
        this.statusError = err.error?.error || 'Failed to update status.';
        this.statusUpdating = false;
      },
    });
  }

  postComment(input: HTMLInputElement) {
    if (!this.issue || !input.value.trim()) return;
    this.api.createComment(this.issue.id, { content: input.value }).subscribe({
      next: (res: any) => {
        if (res.success) {
          input.value = '';
          this.reloadIssue();
        }
      },
    });
  }
}
