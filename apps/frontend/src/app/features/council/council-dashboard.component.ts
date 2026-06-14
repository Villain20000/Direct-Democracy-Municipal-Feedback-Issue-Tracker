import { Component, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { LayoutComponent } from '../../shared/layout.component';
import { AuthService } from '../../core/services/auth.service';
import { ApiService } from '../../core/services/api.service';
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
  imports: [CommonModule, LayoutComponent, DatePipe],
  template: `
    <app-layout pageTitle="Council Dashboard" [navItems]="navItems" (logout)="auth.logout()">

      <div class="stats-grid">
        <div class="stat-card"><div class="stat-icon purple"><i class="material-icons-outlined">how_to_vote</i></div><div class="stat-info"><div class="stat-value">{{ pendingResolutions }}</div><div class="stat-label">Pending Resolutions</div></div></div>
        <div class="stat-card"><div class="stat-icon blue"><i class="material-icons-outlined">groups</i></div><div class="stat-info"><div class="stat-value">{{ constituentIssues }}</div><div class="stat-label">Constituent Issues</div></div></div>
        <div class="stat-card"><div class="stat-icon green"><i class="material-icons-outlined">thumb_up</i></div><div class="stat-info"><div class="stat-value">{{ resolutionRate }}%</div><div class="stat-label">Resolution Rate</div></div></div>
        <div class="stat-card"><div class="stat-icon amber"><i class="material-icons-outlined">event</i></div><div class="stat-info"><div class="stat-value">{{ meetings.length }}</div><div class="stat-label">Upcoming Meetings</div></div></div>
      </div>

      <div class="content-grid">
        <div class="card">
          <div class="card-header"><h3>🗳 Resolution Voting Queue</h3></div>
          <div class="card-body">
            @for (res of resolutions; track res.id) {
              <div style="padding:16px;border:1px solid var(--border);border-radius:var(--radius);margin-bottom:12px;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                  <strong>{{ res.title }}</strong>
                  <span class="badge" [class]="res.status === 'VOTING' ? 'badge-amber' : 'badge-green'">{{ res.status }}</span>
                </div>
                <p style="font-size:13px;color:var(--text-secondary);margin-bottom:12px;">{{ res.description }}</p>
                <div style="display:flex;gap:12px;align-items:center;">
                  <div style="display:flex;gap:8px;">
                    <button class="btn btn-success btn-sm" (click)="voteOnResolution(res, true)">👍 For ({{ res.votesFor }})</button>
                    <button class="btn btn-danger btn-sm" (click)="voteOnResolution(res, false)">👎 Against ({{ res.votesAgainst }})</button>
                  </div>
                </div>
              </div>
            } @empty {
              <div style="text-align:center;padding:32px;color:var(--text-muted);">No resolutions in queue.</div>
            }
          </div>
        </div>
        <div class="card">
          <div class="card-header"><h3>📅 Upcoming Meetings</h3></div>
          <div class="card-body">
            @for (meeting of meetings; track meeting.title) {
              <div style="display:flex;gap:16px;padding:14px;border-bottom:1px solid var(--border-light);">
                <div style="text-align:center;min-width:48px;">
                  <div style="font-size:22px;font-weight:800;color:var(--primary);">{{ meeting.day }}</div>
                  <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;">{{ meeting.month }}</div>
                </div>
                <div>
                  <div style="font-size:14px;font-weight:600;">{{ meeting.title }}</div>
                  <div style="font-size:12px;color:var(--text-muted);">{{ meeting.time }} · {{ meeting.location }}</div>
                </div>
              </div>
            } @empty {
              <div style="text-align:center;padding:32px;color:var(--text-muted);">No upcoming meetings.</div>
            }
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-header"><h3>📊 Issue Status Overview</h3></div>
        <div class="card-body">
          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;">
            <div style="text-align:center;padding:24px;background:#F0FDF4;border-radius:var(--radius-lg);">
              <div style="font-size:36px;font-weight:800;color:var(--success);">{{ sentimentPositive }}%</div>
              <div style="font-size:13px;font-weight:600;color:var(--success);">✓ Resolved / Verified</div>
            </div>
            <div style="text-align:center;padding:24px;background:#F1F5F9;border-radius:var(--radius-lg);">
              <div style="font-size:36px;font-weight:800;color:var(--secondary);">{{ sentimentNeutral }}%</div>
              <div style="font-size:13px;font-weight:600;color:var(--secondary);">⏳ In Progress</div>
            </div>
            <div style="text-align:center;padding:24px;background:#FEF2F2;border-radius:var(--radius-lg);">
              <div style="font-size:36px;font-weight:800;color:var(--danger);">{{ sentimentNegative }}%</div>
              <div style="font-size:13px;font-weight:600;color:var(--danger);">✗ Rejected</div>
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
  navItems = [
    { icon: 'dashboard', label: 'Overview', route: '/council' },
    { icon: 'how_to_vote', label: 'Resolutions', route: '/council/resolutions' },
    { icon: 'groups', label: 'Constituents', route: '/council/constituents' },
    { icon: 'forum', label: 'Forums', route: '/council/forums' },
    { icon: 'event', label: 'Calendar', route: '/council/calendar' },
  ];

  constructor(public auth: AuthService, private api: ApiService, private datePipe: DatePipe) {}

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
    this.api.voteResolution(resolution.id, voteFor).subscribe({
      next: (res: any) => { if (res.success) this.loadResolutions(); },
    });
  }

  private mapMeeting(event: Event): CouncilMeeting {
    const start = new Date(event.startTime);
    return {
      title: event.title,
      day: this.datePipe.transform(start, 'd') || '',
      month: this.datePipe.transform(start, 'MMM') || '',
      time: this.datePipe.transform(start, 'shortTime') || '',
      location: event.location || 'TBD',
    };
  }
}