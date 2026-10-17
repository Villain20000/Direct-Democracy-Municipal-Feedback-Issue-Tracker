import { Component, OnInit, inject } from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { LayoutComponent } from '../../shared/layout.component';
import { AuthService } from '../../core/services/auth.service';
import { ApiService } from '../../core/services/api.service';
import { ToastService } from '../../core/services/toast.service';
import { TranslationService } from '../../core/i18n/translation.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { getFieldErrors, groupFieldErrorsByField, toApiError } from '../../core/errors/api-error';
import { Issue, User, UserRole } from '@dd/shared-types';
import { issueStatusClass, formatIssueStatus as formatStatusI18n } from '../../core/utils/issue-ui';

@Component({
  selector: 'app-issue-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, LayoutComponent, DatePipe, DecimalPipe, TranslatePipe],
  styles: [`
    /* === Status stepper — GSAP-style satisfying transitions === */

    .stepper {
      list-style: none;
      padding: 0;
      margin: 0;
      display: flex;
      flex-direction: column;
      gap: 0;
    }
    .stepper-item {
      position: relative;
      display: grid;
      grid-template-columns: 32px 1fr;
      align-items: center;
      padding: 6px 0;
      opacity: 0;
      transform: translateX(-6px);
      animation: stepper-in 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards;
      animation-delay: calc(var(--stagger, 0) * 60ms);
    }
    .stepper-dot {
      position: relative;
      width: 28px;
      height: 28px;
      border-radius: 50%;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      font-weight: 700;
      background: var(--border-light, #E2E8F0);
      color: var(--text-muted);
      transition: background 250ms ease, color 250ms ease, transform 250ms cubic-bezier(0.34, 1.56, 0.64, 1);
      flex-shrink: 0;
      justify-self: center;
    }
    .stepper-past .stepper-dot {
      background: linear-gradient(135deg, #10B981, #047857);
      color: white;
      animation: stepper-pop 420ms cubic-bezier(0.34, 1.56, 0.64, 1);
    }
    .stepper-current .stepper-dot {
      background: linear-gradient(135deg, #2563EB, #4F46E5);
      color: white;
      box-shadow: 0 0 0 0 rgba(37, 99, 235, 0.45);
      animation: stepper-pulse 2s ease-out infinite;
    }
    .stepper-future .stepper-dot {
      background: var(--bg-primary);
      color: var(--text-muted);
    }
    .stepper-dot-inner { display: inline-block; line-height: 1; }
    .stepper-dot-inner.muted { opacity: 0.5; }
    .stepper-check {
      display: inline-block;
      animation: stepper-check-draw 380ms cubic-bezier(0.65, 0, 0.35, 1);
    }

    /* Connecting line between dots */
    .stepper-line {
      position: absolute;
      left: 50%;
      top: 28px;
      width: 2px;
      height: calc(100% - 28px + 12px);
      background: var(--border-light, #E2E8F0);
      transform: translateX(-50%);
      transition: background 250ms ease;
    }
    .stepper-line.filled {
      background: linear-gradient(180deg, #10B981, #2563EB);
    }

    /* Label */
    .stepper-label {
      font-size: 13px;
      padding-left: 12px;
      color: var(--text-secondary);
      transition: color 250ms ease, font-weight 250ms ease;
    }
    .stepper-label.current { color: var(--primary); font-weight: 700; }
    .stepper-label.muted   { color: var(--text-muted); }

    @keyframes stepper-in {
      from { opacity: 0; transform: translateX(-6px); }
      to   { opacity: 1; transform: translateX(0); }
    }
    @keyframes stepper-pop {
      0%   { transform: scale(0.6); }
      60%  { transform: scale(1.18); }
      100% { transform: scale(1); }
    }
    @keyframes stepper-pulse {
      0%   { box-shadow: 0 0 0 0 rgba(37, 99, 235, 0.45); }
      70%  { box-shadow: 0 0 0 10px rgba(37, 99, 235, 0); }
      100% { box-shadow: 0 0 0 0 rgba(37, 99, 235, 0); }
    }
    @keyframes stepper-check-draw {
      0%   { transform: scale(0) rotate(-45deg); opacity: 0; }
      70%  { transform: scale(1.2) rotate(0); opacity: 1; }
      100% { transform: scale(1) rotate(0); }
    }

    /* Honor the user's reduced-motion preference */
    @media (prefers-reduced-motion: reduce) {
      .stepper-item, .stepper-past .stepper-dot, .stepper-check {
        animation: none;
        opacity: 1;
        transform: none;
      }
      .stepper-current .stepper-dot { animation: none; }
    }

    .field-error {
      margin-top: 6px;
      font-size: 12px;
      color: #B91C1C;
      background: #FEF2F2;
      border-left: 3px solid #DC2626;
      padding: 6px 10px;
      border-radius: 4px;
    }
    .input-error {
      border-color: #DC2626 !important;
      background: #FFF5F5;
    }
  `],
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
                      @if (issue.escalatedAt) {
                        <span class="badge badge-red" [title]="issue.escalationReason || ''">
                          ⚠ {{ 'issues.escalated' | t }}
                        </span>
                      }
                      @if (canEditPriority) {
                        <span style="display:inline-flex;align-items:center;gap:4px;">
                          <select
                            data-testid="issue-priority-select"
                            [ngModel]="issue.priority || 3"
                            (ngModelChange)="savePriority($event)"
                            [disabled]="prioritySaving"
                            style="padding:4px 8px;border:1px solid var(--border);border-radius:var(--radius);font-size:12px;">
                            @for (p of [1, 2, 3, 4, 5]; track p) {
                              <option [value]="p">{{ 'issues.priority' | t }} {{ p }}/5</option>
                            }
                          </select>
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
                  <div style="display:flex;gap:8px;flex-wrap:wrap;">
                    <button class="btn btn-primary btn-sm" (click)="upvote()">{{ 'issues.voteUp' | t }} ({{ issue.upvotes }})</button>
                    @if (auth.isAuthenticated()) {
                      <button
                        class="btn btn-secondary btn-sm"
                        data-testid="issue-subscribe-btn"
                        [disabled]="subscribeLoading"
                        (click)="toggleSubscribe()">
                        <i class="material-icons-outlined" style="font-size:16px;">{{ isSubscribed ? 'notifications_off' : 'notifications' }}</i>
                        {{ isSubscribed ? ('issues.unsubscribe' | t) : ('issues.subscribe' | t) }}
                      </button>
                      @if (subscriberCount !== null) {
                        <span class="badge badge-slate" data-testid="issue-subscriber-count" [title]="i18n.t('issues.subscriberCountHint')">👥 {{ i18n.t('issues.subscriberCount', { n: subscriberCount }) }}</span>
                      }
                    }
                    <button class="btn btn-secondary btn-sm" (click)="share()"><i class="material-icons-outlined" style="font-size:16px;">share</i> {{ 'issues.share' | t }}</button>
                    <button class="btn btn-secondary btn-sm" (click)="print()" [title]="'issues.print' | t"><i class="material-icons-outlined" style="font-size:16px;">print</i></button>
                    @if (canUpdateStatus && !issue.escalatedAt) {
                      @if (!showEscalateForm) {
                        <button class="btn btn-secondary btn-sm" data-testid="issue-escalate-btn" (click)="showEscalateForm = true"><i class="material-icons-outlined" style="font-size:16px;">warning</i> {{ 'issues.escalate' | t }}</button>
                      } @else {
                        <span style="display:inline-flex;gap:4px;align-items:center;">
                          <input
                            data-testid="issue-escalate-reason"
                            [(ngModel)]="escalateReason"
                            [placeholder]="i18n.t('issues.escalationReason')"
                            style="padding:6px 10px;border:1px solid var(--border);border-radius:var(--radius);font-size:12px;min-width:180px;" />
                          <button class="btn btn-primary btn-sm" data-testid="issue-escalate-confirm" [disabled]="escalating" (click)="submitEscalation()">{{ 'issues.escalate' | t }}</button>
                          <button class="btn btn-ghost btn-sm" (click)="showEscalateForm = false">{{ 'common.cancel' | t }}</button>
                        </span>
                      }
                    }
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
              <div class="card-header"><h3>{{ i18n.t('detail.comments', { n: totalComments }) }}</h3></div>
              <div class="card-body">
                @for (comment of threadedComments; track comment.id) {
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
                      @if (auth.isAuthenticated()) {
                        <button class="btn btn-ghost btn-sm" [attr.data-testid]="'comment-reply-' + comment.id" (click)="startReply(comment)">{{ 'issues.reply' | t }}</button>
                      }
                      @if (replyTo?.id === comment.id) {
                        <div style="margin-top:8px;display:flex;gap:8px;">
                          <input #replyInput type="text" [placeholder]="i18n.t('issues.replyTo', { name: replyTo?.name || '' })" style="flex:1;padding:8px 12px;border:1px solid var(--border);border-radius:var(--radius);font-size:13px;" />
                          <button class="btn btn-primary btn-sm" [disabled]="replyLoading" (click)="postReply(replyInput)">{{ 'issues.post' | t }}</button>
                          <button class="btn btn-ghost btn-sm" (click)="cancelReply()">{{ 'common.cancel' | t }}</button>
                        </div>
                      }
                      @for (child of comment.children || []; track child.id) {
                        <div style="display:flex;gap:10px;padding:10px 0 10px 16px;margin-top:8px;border-left:2px solid var(--border-light);">
                          <div style="width:28px;height:28px;border-radius:50%;background:var(--bg-primary);color:var(--text-secondary);border:1px solid var(--border);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;flex-shrink:0;">
                            {{ child.user?.firstName?.[0] }}{{ child.user?.lastName?.[0] }}
                          </div>
                          <div style="flex:1;">
                            <div style="display:flex;justify-content:space-between;">
                              <strong style="font-size:12px;">{{ child.user?.firstName }} {{ child.user?.lastName }}</strong>
                              <span style="font-size:11px;color:var(--text-muted);">{{ child.createdAt | date:'medium' }}</span>
                            </div>
                            <p style="font-size:13px;color:var(--text-secondary);margin-top:4px;">{{ child.content }}</p>
                          </div>
                        </div>
                      }
                    </div>
                  </div>
                }
                @if (!threadedComments.length && (issue.comments?.length || 0) > 0) {
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
                }
                <div style="margin-top:16px;display:flex;gap:8px;">
                  <input #commentInput type="text" [placeholder]="i18n.t('issues.addComment')" (input)="clearFieldError('comment.content')" [class.input-error]="!!getFieldError('comment.content')" style="flex:1;padding:10px 16px;border:1px solid var(--border);border-radius:var(--radius);font-size:13px;" />
                  <button class="btn btn-primary" (click)="postComment(commentInput)">{{ 'issues.post' | t }}</button>
                </div>
                <div style="font-size:11px;color:var(--text-muted);margin-top:6px;">{{ 'issues.mentionHint' | t }}</div>
                @if (getFieldError('comment.content')) { <div class="field-error">⚠ {{ getFieldError('comment.content') }}</div> }
              </div>
            </div>
          </div>

          <div style="flex:1;min-width:280px;">
            @if (canAssign) {
              <div class="card" style="margin-bottom:24px;">
                <div class="card-header"><h3>{{ 'detail.assignIssue' | t }}</h3></div>
                <div class="card-body">
                  <select
                    data-testid="issue-assign-select"
                    [(ngModel)]="selectedAssigneeId"
                    style="width:100%;padding:10px 12px;border:1px solid var(--border);border-radius:var(--radius);font-size:13px;margin-bottom:10px;">
                    <option value="">{{ 'detail.selectAssignee' | t }}</option>
                    @for (member of staffMembers; track member.id) {
                      <option [value]="member.id">{{ member.firstName }} {{ member.lastName }}</option>
                    }
                  </select>
                  <button
                    type="button"
                    class="btn btn-primary btn-sm"
                    data-testid="issue-assign-btn"
                    style="width:100%;"
                    [disabled]="!selectedAssigneeId || assignLoading"
                    (click)="assignIssue()">
                    @if (assignLoading) { {{ 'detail.assigning' | t }} } @else { {{ 'detail.assignBtn' | t }} }
                  </button>
                </div>
              </div>
            }

            @if (canUpdateStatus) {
              <div class="card" style="margin-bottom:24px;">
                <div class="card-header"><h3>{{ 'detail.updateStatus' | t }}</h3></div>
                <div class="card-body">
                  @if (statusError) {
                    <div style="color:var(--danger);font-size:13px;margin-bottom:12px;">{{ statusError }}</div>
                  }
                  @if (!pendingStatus) {
                    <div style="display:flex;gap:8px;flex-wrap:wrap;">
                      <button type="button" class="btn btn-primary btn-sm" [disabled]="statusUpdating || issue.status === 'IN_PROGRESS'" (click)="prepareStatusUpdate('IN_PROGRESS')">{{ 'status.start' | t }}</button>
                      <button type="button" class="btn btn-secondary btn-sm" [disabled]="statusUpdating" (click)="prepareStatusUpdate('PENDING_REVIEW')">{{ 'status.review' | t }}</button>
                      <button type="button" class="btn btn-success btn-sm" [disabled]="statusUpdating || issue.status === 'RESOLVED'" (click)="prepareStatusUpdate('RESOLVED')">{{ 'status.resolve' | t }}</button>
                    </div>
                  } @else {
                    <p style="font-size:12px;color:var(--text-secondary);margin-bottom:8px;">{{ 'detail.statusDraftHint' | t }}</p>
                    @if (draftLoading) {
                      <p style="font-size:13px;color:var(--text-muted);">{{ 'detail.draftingMessage' | t }}</p>
                    }
                    @if (pendingStatus === 'RESOLVED') {
                      <textarea
                        [(ngModel)]="resolutionNote"
                        rows="3"
                        style="width:100%;padding:10px;border:1px solid var(--border);border-radius:var(--radius);font-size:13px;margin-bottom:8px;"
                        [placeholder]="'detail.resolutionNotePlaceholder' | t"
                      ></textarea>
                      @if (resolutionScore !== null) {
                        <div style="font-size:12px;margin-bottom:8px;padding:8px;background:var(--bg-primary);border-radius:var(--radius);"
                             [style.color]="resolutionScore < 60 ? 'var(--danger)' : 'var(--text-secondary)'">
                          {{ 'detail.resolutionScore' | t }}: {{ resolutionScore }}/100
                          @if (resolutionGaps.length) {
                            <ul style="margin:6px 0 0 16px;padding:0;">
                              @for (gap of resolutionGaps; track gap) { <li>{{ gap }}</li> }
                            </ul>
                          }
                        </div>
                      }
                      <button type="button" class="btn btn-secondary btn-sm" style="margin-bottom:12px;" (click)="scoreResolution()" [disabled]="scoringResolution || !resolutionNote.trim()">
                        {{ scoringResolution ? ('detail.scoringResolution' | t) : ('detail.scoreResolution' | t) }}
                      </button>
                    }
                    <textarea
                      [(ngModel)]="statusDraft"
                      rows="4"
                      style="width:100%;padding:10px;border:1px solid var(--border);border-radius:var(--radius);font-size:13px;margin-bottom:12px;"
                      [placeholder]="'detail.statusDraftPlaceholder' | t"
                    ></textarea>
                    <div style="display:flex;gap:8px;flex-wrap:wrap;">
                      <button type="button" class="btn btn-primary btn-sm" [disabled]="statusUpdating || !statusDraft.trim()" (click)="confirmStatusUpdate()">
                        {{ 'detail.sendStatusUpdate' | t }}
                      </button>
                      <button type="button" class="btn btn-secondary btn-sm" [disabled]="statusUpdating" (click)="cancelStatusUpdate()">{{ 'common.cancel' | t }}</button>
                      <button type="button" class="btn btn-secondary btn-sm" [disabled]="draftLoading" (click)="regenerateStatusDraft()">
                        <i class="material-icons-outlined" style="font-size:16px;vertical-align:middle;">auto_awesome</i>
                        {{ 'detail.regenerateDraft' | t }}
                      </button>
                    </div>
                  }
                </div>
              </div>
            }

            <div class="card" style="margin-bottom:24px;">
              <div class="card-header"><h3>{{ 'detail.statusTimeline' | t }}</h3></div>
              <div class="card-body">
                <ol class="stepper" [attr.data-issue-id]="issue.id">
                  @for (status of statusFlow; track status; let i = $index, last = $last) {
                    <li class="stepper-item"
                        [class.stepper-current]="status === issue.status"
                        [class.stepper-past]="isPastStatus(status)"
                        [class.stepper-future]="!isPastStatus(status) && status !== issue.status"
                        [style.--stagger]="i">
                      <span class="stepper-dot" aria-hidden="true">
                        @if (isPastStatus(status)) { <span class="stepper-check">✓</span> }
                        @else if (status === issue.status) { <span class="stepper-dot-inner">●</span> }
                        @else { <span class="stepper-dot-inner muted">○</span> }
                      </span>
                      @if (!last) { <span class="stepper-line" [class.filled]="isPastStatus(status)" aria-hidden="true"></span> }
                      <span class="stepper-label"
                            [class.current]="status === issue.status"
                            [class.muted]="!isPastStatus(status) && status !== issue.status">
                        {{ i18n.tEnum('status', status) }}
                      </span>
                    </li>
                  }
                </ol>
              </div>
            </div>

            <div class="card" style="margin-bottom:24px;">
              <div class="card-header"><h3>{{ 'detail.details' | t }}</h3></div>
              <div class="card-body">
                <div style="font-size:13px;margin-bottom:12px;"><span style="color:var(--text-muted);">{{ 'detail.department' | t }}</span> <strong>{{ issue.department?.name || i18n.t('common.none') }}</strong></div>                  <div style="font-size:13px;margin-bottom:12px;"><span style="color:var(--text-muted);">{{ 'detail.ward' | t }}</span> <strong>{{ issue.ward?.name || i18n.t('detail.na') }}</strong></div>
                <div style="font-size:13px;margin-bottom:12px;"><span style="color:var(--text-muted);">{{ 'detail.assignedTo' | t }}</span> <strong>{{ issue.assignee?.firstName || i18n.t('common.none') }}</strong></div>
                @if (sla) {
                  <div style="font-size:13px;margin-bottom:12px;">
                    <span style="color:var(--text-muted);">{{ 'detail.slaDue' | t }}</span>
                    <strong [style.color]="sla.breached ? 'var(--danger)' : 'var(--success)'">
                      {{ sla.breached ? ('detail.slaBreached' | t) : ('detail.slaOnTrack' | t) }}
                      — {{ sla.dueAt | date:'medium' }}
                    </strong>
                  </div>
                }
                @if (issue.resolvedAt) {
                  <div style="font-size:13px;"><span style="color:var(--text-muted);">{{ 'detail.resolved' | t }}</span> <strong>{{ issue.resolvedAt | date:'medium' }}</strong></div>
                }
              </div>
            </div>

            @if (canUpdateStatus) {
              <div class="card" style="margin-bottom:24px;">
                <div class="card-header"><h3>{{ 'detail.internalNotes' | t }}</h3></div>
                <div class="card-body">
                  @if (internalNotes.length === 0) {
                    <p style="font-size:13px;color:var(--text-muted);">{{ 'detail.noInternalNotes' | t }}</p>
                  }
                  @for (note of internalNotes; track note.id) {
                    <div style="padding:10px 0;border-bottom:1px solid var(--border-light);">
                      <div style="font-size:12px;color:var(--text-muted);margin-bottom:4px;">
                        {{ note.author?.firstName }} {{ note.author?.lastName }} · {{ note.createdAt | date:'short' }}
                      </div>
                      <p style="font-size:13px;margin:0;">{{ note.content }}</p>
                    </div>
                  }
                  <div style="margin-top:12px;display:flex;gap:8px;">
                    <input #noteInput type="text" [placeholder]="i18n.t('detail.internalNotesPlaceholder')" style="flex:1;padding:10px 16px;border:1px solid var(--border);border-radius:var(--radius);font-size:13px;" />
                    <button class="btn btn-primary btn-sm" [disabled]="noteLoading" (click)="addInternalNote(noteInput)">{{ 'detail.addNote' | t }}</button>
                  </div>
                </div>
              </div>

            @if (canUpdateStatus) {
              <div class="card" style="margin-bottom:24px;">
                <div class="card-header"><h3>{{ "detail.shareLinks" | t }}</h3></div>
                <div class="card-body">
                  <div style="margin-bottom:12px;display:flex;gap:8px;align-items:center;">
                    <input type="number" [(ngModel)]="shareLinkExpiresInDays" [placeholder]="'detail.shareExpiresInDays' | t" style="width:120px;padding:8px 12px;border:1px solid var(--border);border-radius:var(--radius);font-size:13px;" />
                    <button class="btn btn-primary btn-sm" [disabled]="shareLinksLoading" (click)="createShareLink()">{{ "detail.createShareLink" | t }}</button>
                  </div>
                  @if (shareLinks.length === 0) {
                    <p style="font-size:13px;color:var(--text-muted);">{{ "detail.noShareLinks" | t }}</p>
                  } @else {
                    <table class="data-table">
                      <thead><tr><th>Token</th><th>Expires</th><th>Created</th><th></th></tr></thead>
                      <tbody>
                        @for (link of shareLinks; track link.id) {
                          <tr>
                            <td><code>{{ link.token }}</code></td>
                            <td>{{ link.expiresAt ? (link.expiresAt | date:'short') : '-' }}</td>
                            <td>{{ link.createdAt | date:'short' }}</td>
                            <td><button class="btn btn-secondary btn-sm" (click)="revokeShareLink(link.id)">{{ "detail.revoke" | t }}</button></td>
                          </tr>
                        }
                      </tbody>
                    </table>
                  }
                </div>
              </div>

              <div class="card" style="margin-bottom:24px;">
                <div class="card-header"><h3>{{ "detail.assignmentHistory" | t }}</h3></div>
                <div class="card-body">
                  @if (assignmentHistory.length === 0) {
                    <p style="font-size:13px;color:var(--text-muted);">{{ "detail.noAssignmentHistory" | t }}</p>
                  } @else {
                    <table class="data-table">
                      <thead><tr><th>Assignee</th><th>Assigned By</th><th>Assigned</th><th>Unassigned</th></tr></thead>
                      <tbody>
                        @for (h of assignmentHistory; track h.id) {
                          <tr>
                            <td>{{ h.assignee?.firstName }} {{ h.assignee?.lastName }}</td>
                            <td>{{ h.assignedBy?.firstName }} {{ h.assignedBy?.lastName }}</td>
                            <td>{{ h.assignedAt | date:'short' }}</td>
                            <td>{{ h.unassignedAt ? (h.unassignedAt | date:'short') : '-' }}</td>
                          </tr>
                        }
                      </tbody>
                    </table>
                  }
                </div>
              </div>
            }
            }

            <div class="card" style="margin-bottom:24px;" data-testid="related-impact-panel">
              <div class="card-header"><h3>{{ 'detail.relatedImpact' | t }}</h3></div>
              <div class="card-body">
                @if (!relatedImpact) {
                  <button type="button" class="btn btn-secondary btn-sm" (click)="loadRelatedImpact()" [disabled]="relatedImpactLoading">
                    {{ relatedImpactLoading ? ('detail.relatedImpactLoading' | t) : ('detail.relatedImpactBtn' | t) }}
                  </button>
                } @else {
                  <div style="font-size:12px;margin-bottom:10px;">
                    <div style="font-weight:700;color:var(--text-muted);text-transform:uppercase;font-size:11px;">{{ 'detail.rootCause' | t }}</div>
                    <p style="margin:4px 0 0;">{{ relatedImpact.analysis.rootCause }}</p>
                  </div>
                  <div style="font-size:12px;margin-bottom:10px;">
                    <div style="font-weight:700;color:var(--text-muted);text-transform:uppercase;font-size:11px;">{{ 'detail.communityImpact' | t }}</div>
                    <p style="margin:4px 0 0;">{{ relatedImpact.analysis.impact }}</p>
                  </div>
                  @if (relatedImpact.analysis.recommendations?.length) {
                    <div style="font-size:12px;margin-bottom:10px;">
                      <div style="font-weight:700;color:var(--text-muted);text-transform:uppercase;font-size:11px;">{{ 'detail.recommendations' | t }}</div>
                      <ul style="margin:4px 0 0 16px;padding:0;">
                        @for (rec of relatedImpact.analysis.recommendations; track rec) {
                          <li>{{ rec }}</li>
                        }
                      </ul>
                    </div>
                  }
                  @if (relatedImpact.semanticNeighbors?.length) {
                    <div style="font-size:11px;color:var(--text-muted);margin-bottom:4px;">{{ 'detail.semanticNeighbors' | t }}</div>
                    @for (n of relatedImpact.semanticNeighbors; track n.id) {
                      <a [routerLink]="['/issues', n.id]" style="display:block;font-size:12px;padding:4px 0;">{{ n.title }}</a>
                    }
                  }
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
  pendingStatus = '';
  statusDraft = '';
  draftLoading = false;
  resolutionNote = '';
  resolutionScore: number | null = null;
  resolutionGaps: string[] = [];
  scoringResolution = false;
  relatedImpactLoading = false;
  relatedImpact: {
    semanticNeighbors: Array<{ id: string; title: string }>;
    spatialNeighbors: Array<{ id: string; title: string }>;
    analysis: { rootCause: string; impact: string; recommendations: string[] };
  } | null = null;
  /**
   * Inline field-level errors. Currently used only for the
   * `comment.content` field (the comment post is the one input on
   * this page that takes free text; the status update is
   * button-driven and gets the top-of-card `statusError` treatment).
   */
  fieldErrors: Record<string, string> = {};
  isSubscribed = false;
  subscribeLoading = false;
  /** P2-24 — staff-visible subscriber count (null = not loaded / no access). */
  subscriberCount: number | null = null;
  internalNotes: Array<{ id: string; content: string; createdAt: string; author?: { firstName: string; lastName: string } }> = [];
  noteLoading = false;
  shareLinks: Array<{ id: string; token: string; expiresAt?: string; createdAt: string }> = [];
  shareLinksLoading = false;
  assignmentHistory: Array<any> = [];
  assignmentHistoryLoading = false;
  shareLinkExpiresInDays: number | null = null;
  sla: { priority: string; dueAt: string; breached: boolean } | null = null;
  staffMembers: User[] = [];
  selectedAssigneeId = '';
  assignLoading = false;
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

  get canAssign(): boolean {
    return this.canUpdateStatus;
  }

  /**
   * Manual priority override (PLAN feature 4). Mirrors the backend
   * authorize() list on PATCH /issues/:id.
   */
  get canEditPriority(): boolean {
    return this.auth.hasRole(
      UserRole.SUPER_ADMIN, UserRole.MAYOR, UserRole.DEPARTMENT_HEAD,
      UserRole.STAFF, UserRole.COUNCIL_MEMBER, UserRole.AUDITOR,
    );
  }

  prioritySaving = false;
  savePriority(value: number | string) {
    const priority = Number(value);
    if (!this.issue || !Number.isInteger(priority) || priority < 1 || priority > 5) return;
    this.prioritySaving = true;
    this.api.updateIssue(this.issue.id, { priority }).subscribe({
      next: (res) => {
        this.prioritySaving = false;
        if (res.data) this.issue = res.data;
        this.toast.success(this.i18n.t('issues.prioritySaved'));
        // SLA deadline changed — reload the SLA row if it's shown.
        this.loadSla();
      },
      error: () => {
        this.prioritySaving = false;
        this.toast.error(this.i18n.t('issues.prioritySaveFailed'));
      },
    });
  }

  ngOnInit() {
    if (this.canAssign) this.loadStaffMembers();
    this.reloadIssue();
  }

  loadStaffMembers() {
    this.api.getUsers({ role: 'STAFF', pageSize: '50' }).subscribe({
      next: (res: any) => {
        if (res.data) this.staffMembers = res.data;
      },
    });
  }

  reloadIssue() {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) return;
    this.loadError = '';
    this.api.getIssue(id).subscribe({
      next: (res) => {
        if (res.success) {
          this.issue = res.data;
          this.attachments = (res.data as any).attachments || [];
          this.loadSubscriptionState();
          this.loadThreadedComments();
          this.selectedAssigneeId = res.data.assigneeId || res.data.assignee?.id || '';
          if (this.canUpdateStatus) {
            this.loadInternalNotes();
            this.loadSla();
          }
        }
      },
      error: (err) => { this.loadError = err.error?.error || this.i18n.t('issues.issueNotLoaded'); },
    });
  }

  loadSubscriptionState() {
    if (!this.issue || !this.auth.isAuthenticated()) return;
    this.api.getMySubscriptions().subscribe({
      next: (res) => {
        if (res.success) {
          this.isSubscribed = res.data.some((s) => s.issueId === this.issue!.id);
        }
      },
    });
  }

  toggleSubscribe() {
    if (!this.issue || this.subscribeLoading) return;
    this.subscribeLoading = true;
    const bumpCount = (delta: number) => {
      if (this.subscriberCount !== null) this.subscriberCount = Math.max(0, this.subscriberCount + delta);
    };
    const onDone = () => {
      this.subscribeLoading = false;
      this.toast.success(this.isSubscribed ? this.i18n.t('issues.subscribed') : this.i18n.t('issues.unsubscribed'));
    };
    const onError = () => {
      this.subscribeLoading = false;
      this.toast.error(this.i18n.t('issues.subscribeFailed'));
    };
    if (this.isSubscribed) {
      this.api.unsubscribeFromIssue(this.issue.id).subscribe({
        next: (res) => { if (res.success) { this.isSubscribed = false; bumpCount(-1); onDone(); } },
        error: onError,
      });
    } else {
      this.api.subscribeToIssue(this.issue.id).subscribe({
        next: (res) => { if (res.success) { this.isSubscribed = true; bumpCount(1); onDone(); } },
        error: onError,
      });
    }
  }

  loadInternalNotes() {
    if (!this.issue) return;
    this.api.getInternalNotes(this.issue.id).subscribe({
      next: (res) => { if (res.success) this.internalNotes = res.data; },
    });
    if (this.canUpdateStatus) {
      this.api.getIssueSubscribers(this.issue.id).subscribe({
        next: (res) => { if (res.success) this.subscriberCount = (res.data || []).length; },
        error: () => { this.subscriberCount = null; },
      });
      this.api.getShareLinks(this.issue.id).subscribe({
        next: (res) => { if (res.success) this.shareLinks = res.data; },
        error: () => { /* ignore */ },
      });
      this.api.getIssueAssignmentHistory(this.issue.id).subscribe({
        next: (res) => { if (res.success) this.assignmentHistory = res.data; },
        error: () => { /* ignore */ },
      });
    }
  }

  addInternalNote(input: HTMLInputElement) {
    if (!this.issue || this.noteLoading) return;
    const content = input.value.trim();
    if (!content) return;
    this.noteLoading = true;
    this.api.addInternalNote(this.issue.id, content).subscribe({
      next: (res) => {
        this.noteLoading = false;
        if (res.success) {
          input.value = '';
          this.loadInternalNotes();
          this.toast.success(this.i18n.t('detail.addNote'));
        }
      },
      error: () => {
        this.noteLoading = false;
        this.toast.error(this.i18n.t('issues.createFailed'));
      },
    });
  }

  loadSla() {
    if (!this.issue) return;
    this.api.getIssueSla(this.issue.id).subscribe({
      next: (res) => { if (res.success) this.sla = res.data; },
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
    const copyUrl = (url: string) => {
      if (navigator.share) {
        navigator.share({ title: this.issue!.title, text: this.issue!.description?.slice(0, 120), url })
          .then(() => this.toast.success(this.i18n.t('issues.shared')))
          .catch(() => {});
      } else {
        navigator.clipboard.writeText(url).then(() => this.toast.success(this.i18n.t('issues.linkCopied')))
          .catch(() => this.toast.error(this.i18n.t('issues.shareFailed')));
      }
    };
    if (this.canUpdateStatus) {
      this.api.createShareLink(this.issue.id, 30).subscribe({
        next: (res) => {
          if (res.success && res.data?.token) {
            copyUrl(`${window.location.origin}/share/${res.data.token}`);
          } else {
            copyUrl(window.location.href);
          }
        },
        error: () => copyUrl(window.location.href),
      });
      return;
    }
    copyUrl(window.location.href);
  }

  assignIssue() {
    if (!this.issue || !this.selectedAssigneeId || this.assignLoading) return;
    this.assignLoading = true;
    this.api.assignIssue(this.issue.id, this.selectedAssigneeId, this.issue.departmentId).subscribe({
      next: (res) => {
        this.assignLoading = false;
        if (res.success) {
          this.issue = { ...this.issue!, ...res.data };
          this.toast.success(this.i18n.t('detail.assignSuccess'));
        }
      },
      error: () => {
        this.assignLoading = false;
        this.toast.error(this.i18n.t('detail.assignFailed'));
      },
    });
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

  prepareStatusUpdate(status: string) {
    if (!this.issue || this.statusUpdating) return;
    this.pendingStatus = status;
    this.statusError = '';
    this.regenerateStatusDraft();
  }

  regenerateStatusDraft() {
    if (!this.issue || !this.pendingStatus) return;
    this.draftLoading = true;
    this.api.aiDraftStatusUpdate({
      title: this.issue.title,
      oldStatus: this.issue.status,
      newStatus: this.pendingStatus,
      locale: this.i18n.currentLanguage().code,
    }).subscribe({
      next: (res) => {
        this.statusDraft = res.data?.draft || '';
        this.draftLoading = false;
      },
      error: () => {
        this.statusDraft = `"${this.issue!.title}" is now ${this.pendingStatus.replace(/_/g, ' ').toLowerCase()}.`;
        this.draftLoading = false;
      },
    });
  }

  cancelStatusUpdate() {
    this.pendingStatus = '';
    this.statusDraft = '';
    this.statusError = '';
    this.resolutionNote = '';
    this.resolutionScore = null;
    this.resolutionGaps = [];
  }

  loadRelatedImpact() {
    if (!this.issue) return;
    this.relatedImpactLoading = true;
    this.api.aiRelatedImpact(this.issue.id).subscribe({
      next: (res) => {
        this.relatedImpact = res.data;
        this.relatedImpactLoading = false;
      },
      error: () => { this.relatedImpactLoading = false; },
    });
  }

  scoreResolution() {
    if (!this.issue || !this.resolutionNote.trim()) return;
    this.scoringResolution = true;
    this.api.aiScoreResolution({
      title: this.issue.title,
      description: this.issue.description,
      resolutionNote: this.resolutionNote.trim(),
      category: this.issue.category,
    }).subscribe({
      next: (res) => {
        this.resolutionScore = res.data?.score ?? null;
        this.resolutionGaps = res.data?.gaps || [];
        this.scoringResolution = false;
      },
      error: () => { this.scoringResolution = false; },
    });
  }

  confirmStatusUpdate() {
    if (!this.issue || !this.pendingStatus || this.statusUpdating) return;
    this.statusUpdating = true;
    this.statusError = '';
    const note = this.pendingStatus === 'RESOLVED' && this.resolutionNote.trim()
      ? this.resolutionNote.trim()
      : undefined;
    this.api.updateIssueStatus(this.issue.id, this.pendingStatus, note, this.statusDraft.trim()).subscribe({
      next: (res) => {
        if (res.success) {
          this.issue = { ...this.issue!, ...res.data };
          this.toast.success(this.i18n.t('issues.statusUpdateSuccess', { status: this.formatIssueStatus(this.pendingStatus) }));
          this.cancelStatusUpdate();
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

  /** P1-12: threaded comments (two levels) loaded with children. */
  threadedComments: Array<{ id: string; content: string; createdAt: string; user?: { firstName: string; lastName: string }; children?: Array<{ id: string; content: string; createdAt: string; user?: { firstName: string; lastName: string } }> }> = [];
  replyTo: { id: string; name: string } | null = null;
  replyLoading = false;

  /** P1-10 escalation form state. */
  showEscalateForm = false;
  escalateReason = '';
  escalating = false;

  get totalComments(): number {
    const threaded = this.threadedComments.reduce((n, c) => n + 1 + (c.children?.length || 0), 0);
    return threaded || this.issue?.comments?.length || 0;
  }

  loadThreadedComments() {
    if (!this.issue) return;
    this.api.getComments(this.issue.id).subscribe({
      next: (res: any) => {
        if (res.success) this.threadedComments = res.data || [];
      },
      error: () => { /* fall back to issue.comments */ },
    });
  }

  startReply(comment: { id: string; user?: { firstName: string; lastName: string } }) {
    this.replyTo = { id: comment.id, name: `${comment.user?.firstName || ''} ${comment.user?.lastName || ''}`.trim() };
  }

  cancelReply() {
    this.replyTo = null;
  }

  postReply(input: HTMLInputElement) {
    if (!this.issue || !this.replyTo || !input.value.trim() || this.replyLoading) return;
    this.replyLoading = true;
    this.api.createComment(this.issue.id, { content: input.value, parentId: this.replyTo.id }).subscribe({
      next: (res: any) => {
        this.replyLoading = false;
        if (res.success) {
          input.value = '';
          this.replyTo = null;
          this.toast.success(this.i18n.t('issues.commentPosted'));
          this.loadThreadedComments();
        }
      },
      error: (err) => {
        this.replyLoading = false;
        this.toast.error(err.error?.error || this.i18n.t('issues.commentPostedError'));
      },
    });
  }

  submitEscalation() {
    if (!this.issue || this.escalating) return;
    this.escalating = true;
    this.api.escalateIssue(this.issue.id, { reason: this.escalateReason.trim() || undefined }).subscribe({
      next: (res) => {
        this.escalating = false;
        if (res.success) {
          this.issue = { ...this.issue!, ...res.data };
          this.showEscalateForm = false;
          this.escalateReason = '';
          this.toast.success(this.i18n.t('issues.escalateSuccess'));
        }
      },
      error: (err) => {
        this.escalating = false;
        this.toast.error(err.error?.error || this.i18n.t('issues.escalateFailed'));
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
          this.fieldErrors = {};
          this.reloadIssue();
          this.loadThreadedComments();
        }
      },
      error: (err) => {
        // Surface ZodError issues inline under the comment input.
        // Anything else (network, 5xx) keeps the toast.
        const apiErr = toApiError(err);
        const fieldErrs = getFieldErrors(apiErr);
        const grouped = groupFieldErrorsByField(fieldErrs);
        // ZodError paths for the comment are 'content' or
        // 'content.min' etc. — map them all to 'content' for the
        // single-input form.
        if (grouped['content']) {
          this.fieldErrors['comment.content'] = grouped['content'];
        } else {
          this.fieldErrors['comment.content'] = apiErr.message;
        }
      },
    });
  }

  /**
   * Inline field-error accessor used by the template. Tries
   * `errorFields.<field>` first, then falls back to the raw
   * backend message. Returns '' when no error is set.
   */

  createShareLink() {
    if (!this.issue) return;
    const expires = this.shareLinkExpiresInDays;
    this.shareLinksLoading = true;
    this.api.createShareLink(this.issue.id, expires ?? undefined).subscribe({
      next: (res) => {
        this.shareLinksLoading = false;
        if (res.success) {
          this.toast.success(this.i18n.t('detail.shareLinkCreated'));
          this.loadInternalNotes();
        }
      },
      error: () => {
        this.shareLinksLoading = false;
        this.toast.error(this.i18n.t('detail.shareLinkFailed'));
      },
    });
  }

  revokeShareLink(linkId: string) {
    if (!this.issue) return;
    this.api.revokeShareLink(this.issue.id, linkId).subscribe({
      next: (res) => {
        if (res.success) {
          this.toast.success(this.i18n.t('detail.shareLinkRevoked'));
          this.loadInternalNotes();
        }
      },
      error: () => {
        this.toast.error(this.i18n.t('detail.shareLinkFailed'));
      },
    });
  }
  getFieldError(field: string): string {
    const raw = this.fieldErrors[field];
    if (!raw) return '';
    const key = `errorFields.${field}` as any;
    const translated = this.i18n.t(key);
    if (translated && translated !== key) return translated;
    return raw;
  }

  /**
   * Drop the inline error for `field` (called from the comment
   * input's `ngModelChange`).
   */
  clearFieldError(field: string) {
    if (this.fieldErrors[field]) {
      delete this.fieldErrors[field];
    }
  }
}
