import { Component, OnInit, inject } from '@angular/core';
import { CommonModule, formatDate } from '@angular/common';
import { RouterLink } from '@angular/router';
import { LayoutComponent } from '../../shared/layout.component';
import { AuthService } from '../../core/services/auth.service';
import { ApiService } from '../../core/services/api.service';
import { TranslationService } from '../../core/i18n/translation.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { Event } from '@dd/shared-types';

interface CouncilMeeting {
  title: string;
  day: string;
  month: string;
  time: string;
  location: string;
}

@Component({
  selector: 'app-council-dashboard',
  standalone: true,
  imports: [CommonModule, LayoutComponent, RouterLink, TranslatePipe],
  template: `
    <app-layout [pageTitle]="i18n.t('council.pageTitle')" [navItems]="navItems" (logout)="auth.logout()">

      @if (voteMessage) {
        <div class="card" style="margin-bottom:16px;border-color:var(--success);">
          <div class="card-body" style="color:var(--success);font-size:13px;">{{ voteMessage }}</div>
        </div>
      }
      @if (voteError) {
        <div class="card" style="margin-bottom:16px;border-color:var(--danger);">
          <div class="card-body" style="color:var(--danger);font-size:13px;">{{ voteError }}</div>
        </div>
      }

      <div class="stats-grid">
        <div class="stat-card"><div class="stat-icon purple"><i class="material-icons-outlined">how_to_vote</i></div><div class="stat-info"><div class="stat-value">{{ pendingResolutions }}</div><div class="stat-label">{{ 'council.pending' | t }}</div></div></div>
        <div class="stat-card"><div class="stat-icon blue"><i class="material-icons-outlined">groups</i></div><div class="stat-info"><div class="stat-value">{{ constituentIssues }}</div><div class="stat-label">{{ 'council.constituents' | t }}</div></div></div>
        <div class="stat-card"><div class="stat-icon green"><i class="material-icons-outlined">thumb_up</i></div><div class="stat-info"><div class="stat-value">{{ resolutionRate }}%</div><div class="stat-label">{{ 'council.resolutionRate' | t }}</div></div></div>
        <div class="stat-card"><div class="stat-icon amber"><i class="material-icons-outlined">event</i></div><div class="stat-info"><div class="stat-value">{{ meetings.length }}</div><div class="stat-label">{{ 'council.upcoming' | t }}</div></div></div>
      </div>

      <div class="content-grid">
        <div class="card">
          <div class="card-header"><h3>{{ 'council.voteQueue' | t }}</h3></div>
          <div class="card-body">
            @for (res of resolutions; track res.id) {
              <div style="padding:16px;border:1px solid var(--border);border-radius:var(--radius);margin-bottom:12px;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                  <strong>{{ res.title }}</strong>
                  <span class="badge" [class]="res.status === 'VOTING' ? 'badge-amber' : 'badge-green'">{{ i18n.tResolutionStatus(res.status) }}</span>
                </div>
                <p style="font-size:13px;color:var(--text-secondary);margin-bottom:12px;">{{ res.description }}</p>
                <div style="display:flex;gap:12px;align-items:center;">
                  <div style="display:flex;gap:8px;">
                    <button type="button" class="btn btn-success btn-sm" [disabled]="votingId === res.id" (click)="voteOnResolution(res, true)">{{ i18n.t('council.for', { n: res.votesFor }) }}</button>
                    <button type="button" class="btn btn-danger btn-sm" [disabled]="votingId === res.id" (click)="voteOnResolution(res, false)">{{ i18n.t('council.against', { n: res.votesAgainst }) }}</button>
                  </div>
                </div>
              </div>
            } @empty {
              <div style="text-align:center;padding:32px;color:var(--text-muted);">{{ 'council.noResolutions' | t }}</div>
            }
          </div>
        </div>
        <div class="card">
          <div class="card-header" style="display:flex;justify-content:space-between;align-items:center;">
            <h3>{{ 'council.upcomingTitle' | t }}</h3>
            <a routerLink="/council/calendar" class="btn btn-secondary btn-sm">{{ 'common.viewAll' | t }}</a>
          </div>
          <div class="card-body">
            @for (meeting of meetings; track meeting.title) {
              <a routerLink="/council/calendar" style="display:flex;gap:16px;padding:14px;border-bottom:1px solid var(--border-light);text-decoration:none;color:inherit;transition:background 0.2s;">
                <div style="text-align:center;min-width:48px;">
                  <div style="font-size:22px;font-weight:800;color:var(--primary);">{{ meeting.day }}</div>
                  <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;">{{ meeting.month }}</div>
                </div>
                <div>
                  <div style="font-size:14px;font-weight:600;">{{ meeting.title }}</div>
                  <div style="font-size:12px;color:var(--text-muted);">{{ meeting.time }} · {{ meeting.location }} · {{ 'common.viewAll' | t }} →</div>
                </div>
              </a>
            } @empty {
              <div style="text-align:center;padding:32px;color:var(--text-muted);">{{ 'council.noMeetings' | t }}</div>
            }
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-header"><h3>{{ 'council.overview' | t }}</h3></div>
        <div class="card-body">
          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;">
            <div style="text-align:center;padding:24px;background:#F0FDF4;border-radius:var(--radius-lg);">
              <div style="font-size:36px;font-weight:800;color:var(--success);">{{ sentimentPositive }}%</div>
              <div style="font-size:13px;font-weight:600;color:var(--success);">{{ 'council.resolved' | t }}</div>
            </div>
            <div style="text-align:center;padding:24px;background:#F1F5F9;border-radius:var(--radius-lg);">
              <div style="font-size:36px;font-weight:800;color:var(--secondary);">{{ sentimentNeutral }}%</div>
              <div style="font-size:13px;font-weight:600;color:var(--secondary);">{{ 'council.inProgress' | t }}</div>
            </div>
            <div style="text-align:center;padding:24px;background:#FEF2F2;border-radius:var(--radius-lg);">
              <div style="font-size:36px;font-weight:800;color:var(--danger);">{{ sentimentNegative }}%</div>
              <div style="font-size:13px;font-weight:600;color:var(--danger);">{{ 'council.rejected' | t }}</div>
            </div>
          </div>
        </div>
      </div>
    </app-layout>
  `,
})
export class CouncilDashboardComponent implements OnInit {
  resolutions: any[] = [];
  meetings: CouncilMeeting[] = [];
  constituentIssues = 0;
  resolutionRate = 0;
  sentimentPositive = 0;
  sentimentNeutral = 0;
  sentimentNegative = 0;
  votingId = '';
  voteMessage = '';
  voteError = '';
  navItems = [
    { icon: 'dashboard', label: 'nav.overview', route: '/council' },
    { icon: 'how_to_vote', label: 'nav.resolutions', route: '/council/resolutions' },
    { icon: 'groups', label: 'nav.constituents', route: '/council/constituents' },
    { icon: 'forum', label: 'nav.forums', route: '/council/forums' },
    { icon: 'event', label: 'nav.calendar', route: '/council/calendar' },
  ] as any;

  private readonly locale = 'en-US';

  auth = inject(AuthService);
  api = inject(ApiService);
  i18n = inject(TranslationService);

  get pendingResolutions(): number {
    return this.resolutions.filter(r => r.status === 'VOTING' || r.status === 'PROPOSED').length;
  }

  ngOnInit() {
    this.loadResolutions();

    const wardId = this.auth.user()?.wardId;
    const issueParams: Record<string, string> = { pageSize: '1' };
    if (wardId) issueParams['wardId'] = wardId;
    this.api.getIssues(issueParams).subscribe((res: any) => {
      this.constituentIssues = res.total || 0;
    });

    this.api.getIssueStats(wardId ? { wardId } : undefined).subscribe(res => {
      if (!res.success) return;
      const { totalIssues, resolvedIssues, issuesByStatus } = res.data;
      this.resolutionRate = totalIssues ? Math.round((resolvedIssues / totalIssues) * 100) : 0;
      const status = issuesByStatus as Record<string, number>;
      const positive = (status['RESOLVED'] || 0) + (status['VERIFIED'] || 0);
      const neutral = (status['SUBMITTED'] || 0) + (status['ACKNOWLEDGED'] || 0) + (status['IN_PROGRESS'] || 0) + (status['PENDING_REVIEW'] || 0) + (status['REOPENED'] || 0);
      const negative = status['REJECTED'] || 0;
      const total = positive + neutral + negative || 1;
      this.sentimentPositive = Math.round((positive / total) * 100);
      this.sentimentNeutral = Math.round((neutral / total) * 100);
      this.sentimentNegative = Math.round((negative / total) * 100);
    });

    this.api.getEvents({ upcoming: 'true', pageSize: '10' }).subscribe((res: any) => {
      const evts: Event[] = (res.data || []).filter((e: Event) =>
        e.type === 'COUNCIL_MEETING' || e.type === 'PUBLIC_HEARING' || e.type === 'TOWN_HALL'
      );
      this.meetings = evts.slice(0, 5).map(e => this.mapMeeting(e));
    });
  }

  loadResolutions() {
    this.api.getResolutions().subscribe({
      next: (res: any) => { if (res.success) this.resolutions = res.data || []; },
      error: () => { this.resolutions = []; },
    });
  }

  voteOnResolution(resolution: any, voteFor: boolean) {
    this.votingId = resolution.id;
    this.voteMessage = '';
    this.voteError = '';
    this.api.voteResolution(resolution.id, voteFor).subscribe({
      next: (res: any) => {
        if (res.success) {
          this.loadResolutions();
          this.voteMessage = this.i18n.t('council.voteRecorded', { title: resolution.title });
          setTimeout(() => { this.voteMessage = ''; }, 4000);
        }
        this.votingId = '';
      },
      error: (err) => {
        this.voteError = err.error?.error || this.i18n.t('council.voteFailed');
        this.votingId = '';
      },
    });
  }

  private mapMeeting(event: Event): CouncilMeeting {
    const start = new Date(event.startTime);
    return {
      title: event.title,
      day: formatDate(start, 'd', this.locale),
      month: formatDate(start, 'MMM', this.locale),
      time: formatDate(start, 'shortTime', this.locale),
      location: event.location || 'TBD',
    };
  }
}
