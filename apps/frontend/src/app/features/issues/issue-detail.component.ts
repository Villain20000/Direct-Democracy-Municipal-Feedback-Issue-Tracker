import { Component, OnInit, inject } from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { LayoutComponent } from '../../shared/layout.component';
import { AuthService } from '../../core/services/auth.service';
import { ApiService } from '../../core/services/api.service';
import { ToastService } from '../../core/services/toast.service';
import { TranslationService } from '../../core/i18n/translation.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { Issue, UserRole } from '@dd/shared-types';
import { issueStatusClass, formatIssueStatus as formatStatusI18n } from '../../core/utils/issue-ui';

@Component({
  selector: 'app-issue-detail',
  standalone: true,
  imports: [CommonModule, RouterLink, LayoutComponent, DatePipe, DecimalPipe, TranslatePipe],
  template: `
    <app-layout
      [pageTitle]="issue?.title || i18n.t('issues.issueDetail')"
      [navItems]="navItems"
      (logout)="auth.logout()">

      @if (issue) {
        <div style="display:flex;gap:24px;flex-wrap:wrap;">
          <div style="flex:2;min-width:320px;">
            <div class="card" style="margin-bottom:24px;">
              <div class="card-body">
                <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px;flex-wrap:wrap;gap:12px;">
                  <div>
                    <h2 style="font-size:22px;font-weight:800;margin-bottom:8px;">{{ issue.title }}</h2>
                    <div style="display:flex;gap:8px;flex-wrap:wrap;">
                      <span class="badge badge-blue">{{ i18n.tCategory(issue.category) }}</span>
                      <span class="status-badge" [ngClass]="issueStatusClass(issue.status)">{{ formatIssueStatus(issue.status) }}</span>
                      @if (issue.priority) {
                        <span class="badge" [class]="issue.priority >= 4 ? 'badge-red' : issue.priority >= 3 ? 'badge-amber' : 'badge-green'">
                          {{ 'issues.priority' | t }}: {{ issue.priority }}/5
                        </span>
                      }
                      @if (predictedDays) {
                        <span class="badge badge-teal">⏱ {{ i18n.t('ai.days', { n: predictedDays }) }}</span>
                      }
                    </div>
                    @if (aiTags.length > 0) {
                      <div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap;">
                        @for (tag of aiTags; track tag) {
                          <span class="badge badge-slate">#{{ tag }}</span>
                        }
                      </div>
                    }
                  </div>
                  <div style="display:flex;gap:8px;">
                    <button class="btn btn-primary btn-sm" (click)="upvote()">{{ 'issues.voteUp' | t }} ({{ issue.upvotes }})</button>
                    <button class="btn btn-secondary btn-sm" (click)="share()"><i class="material-icons-outlined" style="font-size:16px;">share</i> {{ 'issues.share' | t }}</button>
                    <button class="btn btn-secondary btn-sm" (click)="print()" [title]="'issues.print' | t"><i class="material-icons-outlined" style="font-size:16px;">print</i></button>
                  </div>
                </div>
                <p style="font-size:14px;color:var(--text-secondary);line-height:1.8;margin-bottom:16px;">{{ issue.description }}</p>
                <div style="display:flex;gap:24px;font-size:13px;color:var(--text-muted);flex-wrap:wrap;">
                  <span>📍 {{ issue.location }}</span>
                  <span>👤 {{ issue.reporter?.firstName }} {{ issue.reporter?.lastName }}</span>
                  <span>📅 {{ issue.createdAt | date:'medium' }}</span>
                  <span>👁 {{ issue.viewCount }} views</span>
                </div>
              </div>
            </div>

            @if (resolutionPlan) {
              <div class="card" style="margin-bottom:24px;border-left:4px solid #16A34A;">
                <div class="card-header">
                  <h3>🛠️ {{ 'issues.suggestResolution' | t }}</h3>
                  <button class="btn btn-ghost btn-sm" (click)="resolutionPlan = ''">{{ 'issues.resolutionDismiss' | t }}</button>
                </div>
                <div class="card-body" style="font-size:13px;line-height:1.7;white-space:pre-line;">{{ resolutionPlan }}</div>
              </div>
            }

            @if (attachments.length) {
              <div class="card" style="margin-bottom:24px;">
                <div class="card-header"><h3>{{ i18n.t('detail.attachments', { n: attachments.length }) }}</h3></div>
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
              <div class="card-header"><h3>{{ i18n.t('detail.comments', { n: issue.comments?.length || 0 }) }}</h3></div>
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
                  <input #commentInput type="text" [placeholder]="i18n.t('issues.addComment')" style="flex:1;padding:10px 16px;border:1px solid var(--border);border-radius:var(--radius);font-size:13px;" />
                  <button class="btn btn-primary" (click)="postComment(commentInput)">{{ 'issues.post' | t }}</button>
                </div>
              </div>
            </div>
          </div>

          <div style="flex:1;min-width:280px;">
            @if (canUpdateStatus) {
              <div class="card" style="margin-bottom:24px;">
                <div class="card-header"><h3>{{ 'detail.updateStatus' | t }}</h3></div>
                <div class="card-body">
                  @if (statusError) {
                    <div style="color:var(--danger);font-size:13px;margin-bottom:12px;">{{ statusError }}</div>
                  }
                  <div style="display:flex;gap:8px;flex-wrap:wrap;">
                    <button type="button" class="btn btn-primary btn-sm" [disabled]="statusUpdating || issue.status === 'IN_PROGRESS'" (click)="updateStatus('IN_PROGRESS')">{{ 'status.start' | t }}</button>
                    <button type="button" class="btn btn-secondary btn-sm" [disabled]="statusUpdating" (click)="updateStatus('PENDING_REVIEW')">{{ 'status.review' | t }}</button>
                    <button type="button" class="btn btn-success btn-sm" [disabled]="statusUpdating || issue.status === 'RESOLVED'" (click)="updateStatus('RESOLVED')">{{ 'status.resolve' | t }}</button>
                  </div>
                </div>
              </div>
            }

            <div class="card" style="margin-bottom:24px;">
              <div class="card-header"><h3>{{ 'detail.statusTimeline' | t }}</h3></div>
              <div class="card-body">
                @for (status of statusFlow; track status) {
                  <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">
                    <div style="width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;"
                      [style.background]="status === issue.status ? 'var(--primary)' : isPastStatus(status) ? 'var(--success)' : 'var(--border)'"
                      [style.color]="status === issue.status || isPastStatus(status) ? 'white' : 'var(--text-muted)'">
                      @if (isPastStatus(status)) { ✓ } @else if (status === issue.status) { ● } @else { ○ }
                    </div>
                    <span style="font-size:13px;" [style.font-weight]="status === issue.status ? '700' : '400'"
                      [style.color]="status === issue.status ? 'var(--primary)' : 'var(--text-muted)'">{{ i18n.tEnum('status', status) }}</span>
                  </div>
                }
              </div>
            </div>

            <div class="card" style="margin-bottom:24px;">
              <div class="card-header"><h3>{{ 'detail.details' | t }}</h3></div>
              <div class="card-body">
                <div style="font-size:13px;margin-bottom:12px;"><span style="color:var(--text-muted);">{{ 'detail.department' | t }}</span> <strong>{{ issue.department?.name || i18n.t('common.none') }}</strong></div>                  <div style="font-size:13px;margin-bottom:12px;"><span style="color:var(--text-muted);">{{ 'detail.ward' | t }}</span> <strong>{{ issue.ward?.name || i18n.t('detail.na') }}</strong></div>
                <div style="font-size:13px;margin-bottom:12px;"><span style="color:var(--text-muted);">{{ 'detail.assignedTo' | t }}</span> <strong>{{ issue.assignee?.firstName || i18n.t('common.none') }}</strong></div>
                @if (issue.resolvedAt) {
                  <div style="font-size:13px;"><span style="color:var(--text-muted);">{{ 'detail.resolved' | t }}</span> <strong>{{ issue.resolvedAt | date:'medium' }}</strong></div>
                }
              </div>
            </div>

            <div class="card">
              <div class="card-header"><h3>{{ 'detail.aiAnalysis' | t }}</h3></div>
              <div class="card-body">
                <div style="padding:12px;background:var(--bg-primary);border-radius:var(--radius);margin-bottom:10px;">
                  <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;">{{ 'detail.aiCategory' | t }}</div>
                  <div style="font-size:14px;font-weight:600;">{{ aiCategory || issue.aiCategory || i18n.t('detail.pending') }}</div>
                </div>
                <div style="padding:12px;background:var(--bg-primary);border-radius:var(--radius);margin-bottom:10px;">
                  <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;">{{ 'detail.sentiment' | t }}</div>
                  <div style="font-size:14px;font-weight:600;">{{ aiSentiment || issue.aiSentiment || i18n.t('detail.pending') }}</div>
                </div>
                @if (aiSummary) {
                  <div style="padding:12px;background:var(--bg-primary);border-radius:var(--radius);margin-bottom:10px;font-size:13px;">{{ aiSummary }}</div>
                }
                <button class="btn btn-secondary btn-sm" style="width:100%;margin-bottom:8px;" (click)="runAiAnalysis()" [disabled]="aiLoading">
                  <i class="material-icons-outlined" style="font-size:16px;">auto_awesome</i>
                  @if (aiLoading) { {{ 'issues.analyzing' | t }} } @else { {{ 'issues.runAiAnalysis' | t }} }
                </button>
                <button class="btn btn-success btn-sm" style="width:100%;margin-bottom:8px;" (click)="suggestResolution()" [disabled]="resolutionLoading">
                  <i class="material-icons-outlined" style="font-size:16px;">build</i>
                  @if (resolutionLoading) { {{ 'issues.drafting' | t }} } @else { {{ 'issues.suggestResolution' | t }} }
                </button>
                <button class="btn btn-secondary btn-sm" style="width:100%;" (click)="predictResolutionTime()" [disabled]="predictionLoading">
                  <i class="material-icons-outlined" style="font-size:16px;">schedule</i>
                  @if (predictionLoading) { {{ 'issues.predicting' | t }} } @else { {{ 'issues.predictResolution' | t }} }
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
  aiTags: string[] = [];
  predictedDays: number | null = null;
  resolutionPlan = '';
  resolutionLoading = false;
  predictionLoading = false;
  statusUpdating = false;
  statusError = '';
  statusFlow = ['SUBMITTED', 'ACKNOWLEDGED', 'IN_PROGRESS', 'PENDING_REVIEW', 'RESOLVED', 'VERIFIED'];
  navItems = [{ icon: 'arrow_back', label: 'nav.backToIssues', route: '/issues' }] as any;

  issueStatusClass = issueStatusClass;
  formatIssueStatus(status: string) { return formatStatusI18n(status, this.i18n); }

  auth = inject(AuthService);
  api = inject(ApiService);
  toast = inject(ToastService);
  route = inject(ActivatedRoute);
  i18n = inject(TranslationService);

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
      error: (err) => { this.loadError = err.error?.error || this.i18n.t('issues.issueNotLoaded'); },
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
                if (sum.success) this.aiSummary = sum.data?.summary || '';
                this.api.aiExtractTags(text).subscribe({
                  next: (tags: any) => {
                    this.aiLoading = false;
                    if (tags.success && tags.data?.tags) {
                      this.aiTags = tags.data.tags;
                    }
                    this.toast.success(this.i18n.t('ai.analysisComplete'));
                  },
                  error: () => { this.aiLoading = false; },
                });
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

  suggestResolution() {
    if (!this.issue) return;
    this.resolutionLoading = true;
    const text = `${this.issue.title}. ${this.issue.description}`;
    this.api.aiSuggestResolution(text, this.issue.category).subscribe({
      next: (res: any) => {
        this.resolutionLoading = false;
        if (res.success && res.data?.plan) {
          this.resolutionPlan = res.data.plan;
          this.toast.success(this.i18n.t('ai.resolutionGenerated'));
        }
      },
      error: () => {
        this.resolutionLoading = false;
        this.toast.error(this.i18n.t('issues.draftResolution'));
      },
    });
  }

  predictResolutionTime() {
    if (!this.issue) return;
    this.predictionLoading = true;
    const text = `${this.issue.title}. ${this.issue.description}`;
    this.api.aiResolutionTime(text, this.issue.category).subscribe({
      next: (res: any) => {
        this.predictionLoading = false;
        if (res.success && res.data?.days) {
          this.predictedDays = res.data.days;
          this.toast.info(this.i18n.t('ai.predicted', { n: res.data.days }));
        }
      },
      error: () => {
        this.predictionLoading = false;
        this.toast.error(this.i18n.t('issues.predictionFailed'));
      },
    });
  }

  upvote() {
    if (!this.issue) return;
    this.api.upvoteIssue(this.issue.id).subscribe(res => {
      if (res.success && this.issue) {
        this.issue.upvotes += res.data.voted ? 1 : -1;
        this.toast.success(res.data.voted ? this.i18n.t('issues.upvoteSuccess') : this.i18n.t('issues.voteRemoved'));
      }
    });
  }

  share() {
    if (!this.issue) return;
    const url = window.location.href;
    if (navigator.share) {
      navigator.share({ title: this.issue.title, text: this.issue.description?.slice(0, 120), url })
        .then(() => this.toast.success(this.i18n.t('issues.shared')))
        .catch(() => {});
    } else {
      navigator.clipboard.writeText(url).then(() => this.toast.success(this.i18n.t('issues.linkCopied')))
        .catch(() => this.toast.error(this.i18n.t('issues.shareFailed')));
    }
  }

  print() {
    window.print();
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
    this.api.updateIssueStatus(this.issue.id, status).subscribe({
      next: (res) => {
        if (res.success) {
          this.issue = { ...this.issue!, ...res.data };
          this.toast.success(this.i18n.t('issues.statusUpdateSuccess', { status: this.formatIssueStatus(status) }));
        }
        this.statusUpdating = false;
      },
      error: (err) => {
        this.statusError = err.error?.error || this.i18n.t('staff.updateFailed');
        this.toast.error(this.statusError);
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
          this.toast.success(this.i18n.t('issues.commentPosted'));
          this.reloadIssue();
        }
      },
      error: () => {
        this.toast.error(this.i18n.t('issues.commentPostedError'));
      },
    });
  }
}
