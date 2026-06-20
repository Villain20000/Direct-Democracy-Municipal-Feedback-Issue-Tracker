import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { LayoutComponent } from '../../shared/layout.component';
import { AuthService } from '../../core/services/auth.service';
import { ApiService, CivicScoreData } from '../../core/services/api.service';
import { TranslationService } from '../../core/i18n/translation.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { Issue, Poll } from '@dd/shared-types';
import { SkeletonComponent } from '../../shared/skeleton.component';
import { CountUpDirective } from '../../shared/count-up.directive';
import { ActivityFeedComponent } from '../../shared/activity-feed.component';

@Component({
  selector: 'app-citizen-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, LayoutComponent, DatePipe, TranslatePipe, SkeletonComponent, CountUpDirective, ActivityFeedComponent],
  template: `
    <app-layout
      [pageTitle]="i18n.t('citizen.pageTitle')"
      [navItems]="navItems"
      (logout)="auth.logout()">

      <div style="display:flex;gap:16px;margin-bottom:24px;">
        <button class="btn btn-primary btn-lg" style="flex:1;" routerLink="/issues/new">
          <i class="material-icons-outlined">add_circle</i> {{ 'citizen.reportNew' | t }}
        </button>
        <button class="btn btn-secondary btn-lg" routerLink="/citizen/polls">
          <i class="material-icons-outlined">poll</i> {{ 'citizen.votePolls' | t }}
        </button>
      </div>

      <div class="stats-grid">
        <div class="stat-card"><div class="stat-icon blue"><i class="material-icons-outlined">my_reports</i></div><div class="stat-info"><div class="stat-value" [countUp]="myIssues.length">0</div><div class="stat-label">{{ 'citizen.myReports' | t }}</div></div></div>
        <div class="stat-card"><div class="stat-icon green"><i class="material-icons-outlined">check_circle</i></div><div class="stat-info"><div class="stat-value" [countUp]="resolvedCount">0</div><div class="stat-label">{{ 'citizen.resolved' | t }}</div></div></div>
        <div class="stat-card"><div class="stat-icon amber"><i class="material-icons-outlined">how_to_vote</i></div><div class="stat-info"><div class="stat-value" [countUp]="votesCast">0</div><div class="stat-label">{{ 'citizen.votesCast' | t }}</div></div></div>
        <div class="stat-card"><div class="stat-icon teal"><i class="material-icons-outlined">near_me</i></div><div class="stat-info"><div class="stat-value" [countUp]="nearbyIssues.length">0</div><div class="stat-label">{{ 'citizen.nearbyIssues' | t }}</div></div></div>
      </div>

      <div class="content-grid">
        <app-activity-feed [limit]="6" />
        @if (civicScore()) {
          <div class="civic-score-card">
            <div class="civic-tier-badge" [style.background]="civicScore()!.tier.color + '22'" [style.color]="civicScore()!.tier.color">
              <i class="material-icons-outlined">{{ civicScore()!.tier.icon }}</i>
              {{ civicScore()!.tier.name }}
            </div>
            <div class="civic-points" [countUp]="civicScore()!.points">0</div>
            <div class="civic-points-label">{{ i18n.t('civicScore.points') }}</div>
            @if (civicScore()!.nextTier) {
              <div class="civic-progress">
                <div class="civic-progress-fill" [style.width.%]="civicScore()!.progressToNext"></div>
              </div>
              <div class="civic-next-tier">{{ i18n.t('civicScore.progressToNext', { tier: civicScore()!.nextTier.name }) }}</div>
            }
            <div class="civic-breakdown">
              <div class="civic-breakdown-item">
                <div class="label">{{ i18n.t('civicScore.issuesReported') }}</div>
                <div class="value">{{ civicScore()!.breakdown.issuesReported.count }}</div>
              </div>
              <div class="civic-breakdown-item">
                <div class="label">{{ i18n.t('civicScore.upvotesReceived') }}</div>
                <div class="value">{{ civicScore()!.breakdown.upvotesReceived.count }}</div>
              </div>
              <div class="civic-breakdown-item">
                <div class="label">{{ i18n.t('civicScore.votesCast') }}</div>
                <div class="value">{{ civicScore()!.breakdown.votesCast.count }}</div>
              </div>
              <div class="civic-breakdown-item">
                <div class="label">{{ i18n.t('civicScore.issuesResolved') }}</div>
                <div class="value">{{ civicScore()!.breakdown.issuesResolved.count }}</div>
              </div>
            </div>
          </div>
        } @else {
          <div class="civic-score-card">
            <div class="skeleton skeleton-circle" style="margin:0 auto 12px;"></div>
            <div class="skeleton skeleton-title" style="margin:0 auto 12px;width:120px;height:36px;"></div>
            <div class="skeleton skeleton-text" style="width:40%;margin:0 auto;"></div>
            <div class="skeleton skeleton-block" style="margin-top:16px;height:6px;"></div>
          </div>
        }
      </div>

      <div class="content-grid">
        <div class="card">
          <div class="card-header"><h3>{{ 'citizen.tableTitle' | t }}</h3></div>
          <div class="card-body" style="padding:0;">
            <table class="data-table">
              <thead><tr><th>{{ 'issues.titleField' | t }}</th><th>{{ 'citizen.tableStatus' | t }}</th><th>{{ 'citizen.tableDate' | t }}</th></tr></thead>
              <tbody>
                @for (issue of myIssues; track issue.id) {
                  <tr [routerLink]="['/issues', issue.id]" style="cursor:pointer;">
                    <td><strong>{{ issue.title }}</strong></td>
                    <td><span class="status-badge" [ngClass]="statusClass(issue.status)">{{ formatStatus(issue.status) }}</span></td>
                    <td style="color:var(--text-muted);">{{ issue.createdAt | date:'mediumDate' }}</td>
                  </tr>
                } @empty {
                  <tr><td colspan="3" style="text-align:center;padding:32px;color:var(--text-muted);">{{ 'citizen.empty' | t }}</td></tr>
                }
              </tbody>
            </table>
          </div>
        </div>
        <div class="card">
          <div class="card-header"><h3>📍 {{ 'citizen.nearbyIssues' | t }}</h3></div>
          <div class="card-body">
            @for (issue of nearbyIssues; track issue.id) {
              <div style="display:flex;gap:12px;padding:10px 0;border-bottom:1px solid var(--border-light);align-items:flex-start;">
                <div style="width:8px;height:8px;border-radius:50%;margin-top:6px;" [style.background]="getCategoryColor(issue.category)"></div>
                <a [routerLink]="['/issues', issue.id]" style="flex:1;text-decoration:none;color:inherit;">
                  <div style="font-size:13px;font-weight:600;">{{ issue.title }}</div>
                  <div style="font-size:11px;color:var(--text-muted);">{{ issue.location }} · {{ issue.upvotes }} {{ 'issues.upvotes' | t }}</div>
                </a>
                <button type="button" class="btn btn-ghost btn-sm" [disabled]="upvotingId === issue.id" (click)="upvoteIssue(issue, $event)">
                  @if (upvotingId === issue.id) { ... } @else { ▲ }
                </button>
              </div>
            } @empty {
              <div style="text-align:center;padding:32px;color:var(--text-muted);">{{ 'citizen.empty' | t }}</div>
            }
          </div>
        </div>
      </div>

      <div class="card" style="margin-bottom:24px;">
        <div class="card-header"><h3>{{ 'citizen.activePolls' | t }}</h3></div>
        <div class="card-body">
          @if (activePoll) {
            <div style="padding:16px;border:1px solid var(--border);border-radius:var(--radius);margin-bottom:12px;">
              <strong>{{ activePoll.title }}</strong>
              @if (activePoll.closesAt) {
                <p style="font-size:12px;color:var(--text-muted);margin:8px 0;">{{ i18n.t('citizen.closes', { date: (activePoll.closesAt | date:'mediumDate') || '' }) }}</p>
              }
              @for (opt of activePoll.options || []; track opt.id) {
                <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
                  <input type="radio" name="poll" [value]="opt.id" [(ngModel)]="selectedOptionId" style="width:16px;height:16px;" />
                  <span style="font-size:13px;flex:1;">{{ opt.text }}</span>
                  <span style="font-size:13px;font-weight:700;">{{ opt.votes }}</span>
                  <div style="width:80px;background:var(--bg-primary);border-radius:3px;height:6px;"><div [style.width.%]="getVotePct(opt.votes)" style="background:var(--primary);height:100%;border-radius:3px;"></div></div>
                </div>
              }
              <button class="btn btn-primary btn-sm" style="margin-top:8px;" [disabled]="!selectedOptionId" (click)="submitVote()">{{ 'citizen.submitVote' | t }}</button>
            </div>
          } @else {
            <div style="text-align:center;padding:32px;color:var(--text-muted);">{{ 'citizen.noPolls' | t }}</div>
          }
        </div>
      </div>

      <div class="card">
        <div class="card-header"><h3>{{ 'citizen.chatbot' | t }}</h3></div>
        <div class="card-body">
          <div style="background:var(--bg-primary);border-radius:var(--radius-lg);padding:20px;min-height:160px;">
            @for (msg of chatMessages; track $index) {
              <div style="display:flex;gap:10px;margin-bottom:16px;" [style.flex-direction]="msg.role === 'user' ? 'row-reverse' : 'row'">
                <div style="width:32px;height:32px;border-radius:50%;background:var(--primary);color:white;display:flex;align-items:center;justify-content:center;font-size:14px;">{{ msg.role === 'user' ? '👤' : '🤖' }}</div>
                <div style="background:white;padding:12px 16px;border-radius:var(--radius-lg);font-size:13px;max-width:80%;box-shadow:var(--shadow-sm);">
                  {{ msg.content }}
                </div>
              </div>
            }
            @if (chatSending) {
              <div style="font-size:12px;color:var(--text-muted);">{{ 'citizen.thinking' | t }}</div>
            }
          </div>
          <div style="display:flex;gap:8px;margin-top:12px;">
            <input type="text" [(ngModel)]="chatInput" (keyup.enter)="sendChat()" [placeholder]="i18n.t('citizen.chatPlaceholder')" style="flex:1;padding:10px 16px;border:1px solid var(--border);border-radius:var(--radius);font-size:13px;" />
            <button class="btn btn-primary" [disabled]="!chatInput.trim() || chatSending" (click)="sendChat()"><i class="material-icons-outlined" style="font-size:18px;">{{ 'citizen.send' | t }}</i></button>
          </div>
        </div>
      </div>
    </app-layout>
  `,
})
export class CitizenDashboardComponent implements OnInit {
  myIssues: Issue[] = [];
  nearbyIssues: Issue[] = [];
  activePoll: Poll | null = null;
  selectedOptionId = '';
  votesCast = 0;
  chatInput = '';
  chatSending = false;
  upvotingId = '';
  chatMessages: { role: string; content: string }[] = [];
  civicScore = signal<CivicScoreData | null>(null);
  navItems = [
    { icon: 'dashboard', label: 'nav.overview', route: '/citizen', i18nKey: 'nav.overview' },
    { icon: 'my_reports', label: 'nav.myReports', route: '/citizen/reports', i18nKey: 'nav.myReports' },
    { icon: 'near_me', label: 'nav.nearby', route: '/citizen/nearby', i18nKey: 'nav.nearby' },
    { icon: 'how_to_vote', label: 'nav.polls', route: '/citizen/polls', i18nKey: 'nav.polls' },
    { icon: 'ballot', label: 'nav.surveys', route: '/citizen/surveys', i18nKey: 'nav.surveys' },
    { icon: 'forum', label: 'nav.forums', route: '/citizen/forums', i18nKey: 'nav.forums' },
    { icon: 'event', label: 'nav.events', route: '/citizen/events', i18nKey: 'nav.events' },
  ] as any;

  auth = inject(AuthService);
  api = inject(ApiService);
  i18n = inject(TranslationService);

  get resolvedCount(): number {
    return this.myIssues.filter(i => i.status === 'RESOLVED' || i.status === 'VERIFIED').length;
  }

  ngOnInit() {
    this.chatMessages = [{ role: 'assistant', content: this.i18n.t('citizen.welcomeMsg') }];
    const userId = this.auth.user()?.id;
    if (userId) {
      this.api.getIssues({ reporterId: userId, pageSize: '5' }).subscribe((res: any) => {
        if (res.data) this.myIssues = res.data;
      });
      this.api.getCivicScore(userId).subscribe((res: any) => {
        if (res.success) this.civicScore.set(res.data);
      });
    }
    this.api.getIssues({ pageSize: '4', sortBy: 'upvotes' }).subscribe((res: any) => {
      if (res.data) this.nearbyIssues = res.data;
    });
    this.api.getPolls({ activeOnly: 'true' }).subscribe((res: any) => {
      const polls: Poll[] = res.data || [];
      if (polls.length) this.activePoll = polls[0];
    });
  }

  getCategoryColor(category: string): string {
    const colors: Record<string, string> = {
      INFRASTRUCTURE: '#2563EB', PUBLIC_SAFETY: '#DC2626', SANITATION: '#16A34A',
      UTILITIES: '#7C3AED', HOUSING: '#D97706', ENVIRONMENT: '#059669',
      TRANSPORTATION: '#0891B2', EDUCATION: '#4F46E5', HEALTH: '#E11D48', OTHER: '#64748B',
    };
    return colors[category] || '#64748B';
  }

  getVotePct(votes: number): number {
    const total = (this.activePoll?.options || []).reduce((sum, o) => sum + o.votes, 0);
    return total > 0 ? (votes / total) * 100 : 0;
  }

  statusClass(status: string): string {
    return status.toLowerCase().replace(/_/g, '-');
  }

  formatStatus(status: string): string {
    return this.i18n.tEnum('status', status);
  }

  upvoteIssue(issue: Issue, event: Event) {
    event.stopPropagation();
    this.upvotingId = issue.id;
    this.api.upvoteIssue(issue.id).subscribe({
      next: (res) => {
        if (res.success) {
          issue.upvotes = res.data.voted ? issue.upvotes + 1 : Math.max(0, issue.upvotes - 1);
        }
        this.upvotingId = '';
      },
      error: () => { this.upvotingId = ''; },
    });
  }

  submitVote() {
    if (!this.activePoll || !this.selectedOptionId) return;
    this.api.votePoll(this.activePoll.id, this.selectedOptionId).subscribe({
      next: (res: any) => {
        if (res.success && res.data) {
          this.activePoll = res.data;
          this.votesCast++;
        }
      },
    });
  }

  sendChat() {
    const text = this.chatInput.trim();
    if (!text || this.chatSending) return;
    this.chatMessages.push({ role: 'user', content: text });
    this.chatInput = '';
    this.chatSending = true;
    // Append an empty assistant message to populate chunk-by-chunk
    const assistantIndex = this.chatMessages.length;
    this.chatMessages.push({ role: 'assistant', content: '' });

    this.api.aiChatStream(
      this.chatMessages.slice(0, -1),
      true,
      (chunk) => {
        this.chatMessages = this.chatMessages.map((m, idx) => {
          if (idx === assistantIndex) {
            return { ...m, content: m.content + chunk };
          }
          return m;
        });
      }
    ).then(() => {
      this.chatSending = false;
    }).catch(() => {
      this.chatMessages = this.chatMessages.map((m, idx) => {
        if (idx === assistantIndex) {
          return { ...m, content: this.i18n.t('citizen.chatError') };
        }
        return m;
      });
      this.chatSending = false;
    });
  }
}
