import { Component, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { LayoutComponent } from '../../shared/layout.component';
import { AuthService } from '../../core/services/auth.service';
import { ApiService } from '../../core/services/api.service';
import { Issue, Resolution } from '@dd/shared-types';

@Component({
  selector: 'app-council-dashboard',
  standalone: true,
  imports: [CommonModule, LayoutComponent, DatePipe],
  template: `
    <app-layout
      pageTitle="Council Dashboard"
      [navItems]="navItems"
      [notifCount]="4"
      (logout)="auth.logout()">

      <div class="stats-grid">
        <div class="stat-card"><div class="stat-icon purple"><i class="material-icons-outlined">how_to_vote</i></div><div class="stat-info"><div class="stat-value">{{ resolutions.length }}</div><div class="stat-label">Pending Resolutions</div></div></div>
        <div class="stat-card"><div class="stat-icon blue"><i class="material-icons-outlined">groups</i></div><div class="stat-info"><div class="stat-value">67</div><div class="stat-label">Constituent Issues</div></div></div>
        <div class="stat-card"><div class="stat-icon green"><i class="material-icons-outlined">thumb_up</i></div><div class="stat-info"><div class="stat-value">72%</div><div class="stat-label">Positive Sentiment</div></div></div>
        <div class="stat-card"><div class="stat-icon amber"><i class="material-icons-outlined">event</i></div><div class="stat-info"><div class="stat-value">3</div><div class="stat-label">Upcoming Meetings</div></div></div>
      </div>

      <div class="content-grid">
        <div class="card">
          <div class="card-header"><h3>🗳 Resolution Voting Queue</h3></div>
          <div class="card-body">
            @for (res of resolutions; track res.id) {
              <div style="padding: 16px; border: 1px solid var(--border); border-radius: var(--radius); margin-bottom: 12px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                  <strong>{{ res.title }}</strong>
                  <span class="badge" [class]="res.status === 'VOTING' ? 'badge-amber' : 'badge-green'">{{ res.status }}</span>
                </div>
                <p style="font-size: 13px; color: var(--text-secondary); margin-bottom: 12px;">{{ res.description }}</p>
                <div style="display: flex; gap: 12px; align-items: center;">
                  <div style="display: flex; gap: 8px;">
                    <button class="btn btn-success btn-sm" (click)="voteOnResolution(res, true)">👍 For ({{ res.votesFor }})</button>
                    <button class="btn btn-danger btn-sm" (click)="voteOnResolution(res, false)">👎 Against ({{ res.votesAgainst }})</button>
                  </div>
                  <span style="font-size: 12px; color: var(--text-muted);">By {{ res.proposedByName }}</span>
                </div>
              </div>
            }
          </div>
        </div>
        <div class="card">
          <div class="card-header"><h3>📅 Upcoming Meetings</h3></div>
          <div class="card-body">
            @for (meeting of meetings; track meeting.title) {
              <div style="display: flex; gap: 16px; padding: 14px; border-bottom: 1px solid var(--border-light);">
                <div style="text-align: center; min-width: 48px;">
                  <div style="font-size: 22px; font-weight: 800; color: var(--primary);">{{ meeting.day }}</div>
                  <div style="font-size: 11px; color: var(--text-muted); text-transform: uppercase;">{{ meeting.month }}</div>
                </div>
                <div>
                  <div style="font-size: 14px; font-weight: 600;">{{ meeting.title }}</div>
                  <div style="font-size: 12px; color: var(--text-muted);">{{ meeting.time }} · {{ meeting.location }}</div>
                </div>
              </div>
            }
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-header"><h3>🤖 AI Sentiment Overview</h3></div>
        <div class="card-body">
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px;">
            <div style="text-align: center; padding: 24px; background: #F0FDF4; border-radius: var(--radius-lg);">
              <div style="font-size: 36px; font-weight: 800; color: var(--success);">72%</div>
              <div style="font-size: 13px; font-weight: 600; color: var(--success);">😊 Positive</div>
            </div>
            <div style="text-align: center; padding: 24px; background: #F1F5F9; border-radius: var(--radius-lg);">
              <div style="font-size: 36px; font-weight: 800; color: var(--secondary);">18%</div>
              <div style="font-size: 13px; font-weight: 600; color: var(--secondary);">😐 Neutral</div>
            </div>
            <div style="text-align: center; padding: 24px; background: #FEF2F2; border-radius: var(--radius-lg);">
              <div style="font-size: 36px; font-weight: 800; color: var(--danger);">10%</div>
              <div style="font-size: 13px; font-weight: 600; color: var(--danger);">😟 Negative</div>
            </div>
          </div>
        </div>
      </div>
    </app-layout>
  `,
})
export class CouncilDashboardComponent implements OnInit {
  resolutions: any[] = [];
  meetings = [
    { title: 'City Council Meeting', day: '20', month: 'Jun', time: '7:00 PM', location: 'Council Chamber' },
    { title: 'Budget Public Hearing', day: '25', month: 'Jun', time: '6:00 PM', location: 'Community Center' },
    { title: 'Infrastructure Town Hall', day: '10', month: 'Jul', time: '7:00 PM', location: 'Library Auditorium' },
  ];
  navItems = [
    { icon: 'dashboard', label: 'Overview', route: '/council' },
    { icon: 'how_to_vote', label: 'Resolutions', route: '/council/resolutions' },
    { icon: 'groups', label: 'Constituents', route: '/council/constituents' },
    { icon: 'forum', label: 'Forums', route: '/council/forums' },
    { icon: 'event', label: 'Calendar', route: '/council/calendar' },
  ];

  constructor(public auth: AuthService, private api: ApiService) {}

  ngOnInit() {
    this.loadResolutions();
  }

  loadResolutions() {
    this.api.getResolutions().subscribe((res: any) => {
      if (res.success) {
        this.resolutions = res.data || [];
      }
    });
    // Fallback demo data if API fails
    this.resolutions = [
      { id: '1', title: 'Allocate Emergency Funds for Water Main Repair', description: 'Resolution to allocate $150,000 from the emergency infrastructure fund.', status: 'VOTING', votesFor: 5, votesAgainst: 1, proposedByName: 'David Chen' },
      { id: '2', title: 'Expand Community Center Hours', description: 'Extend Westfield Community Center operating hours to 9 PM on weekdays.', status: 'PROPOSED', votesFor: 2, votesAgainst: 0, proposedByName: 'Lisa Thompson' },
    ];
  }

  voteOnResolution(resolution: any, voteFor: boolean) {
    this.api.voteResolution(resolution.id, voteFor).subscribe({
      next: (res: any) => {
        if (res.success) {
          this.loadResolutions();
        }
      },
    });
  }
}
