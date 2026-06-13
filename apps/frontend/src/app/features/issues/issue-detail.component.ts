import { Component, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { LayoutComponent } from '../../shared/layout.component';
import { AuthService } from '../../core/services/auth.service';
import { ApiService } from '../../core/services/api.service';
import { Issue } from '@dd/shared-types';

@Component({
  selector: 'app-issue-detail',
  standalone: true,
  imports: [CommonModule, RouterLink, LayoutComponent, DatePipe],
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
                      <span class="status-badge" [class]="issue.status.toLowerCase()">{{ issue.status }}</span>
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
                  <div style="font-size:14px;font-weight:600;">{{ issue.aiCategory || 'Pending analysis...' }}</div>
                </div>
                <div style="padding:12px;background:var(--bg-primary);border-radius:var(--radius);margin-bottom:10px;">
                  <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;">Sentiment</div>
                  <div style="font-size:14px;font-weight:600;">{{ issue.aiSentiment || 'Pending analysis...' }}</div>
                </div>
                <button class="btn btn-secondary btn-sm" style="width:100%;"><i class="material-icons-outlined" style="font-size:16px;">auto_awesome</i> Run AI Analysis</button>
              </div>
            </div>
          </div>
        </div>
      }
    </app-layout>
  `,
})
export class IssueDetailComponent implements OnInit {
  issue: Issue | null = null;
  statusFlow = ['SUBMITTED', 'ACKNOWLEDGED', 'IN_PROGRESS', 'PENDING_REVIEW', 'RESOLVED', 'VERIFIED'];
  navItems = [{ icon: 'arrow_back', label: 'Back to Issues', route: '/issues' }];

  constructor(public auth: AuthService, private api: ApiService, private route: ActivatedRoute) {}

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.api.getIssue(id).subscribe(res => {
        if (res.success) this.issue = res.data;
      });
    }
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

  postComment(input: HTMLInputElement) {
    if (!this.issue || !input.value.trim()) return;
    this.api.createComment(this.issue.id, { content: input.value }).subscribe({
      next: (res: any) => {
        if (res.success) {
          input.value = '';
          this.ngOnInit(); // Reload to get new comment
        }
      },
    });
  }
}
