import { Component, OnInit } from '@angular/core';
import { CommonModule, formatDate } from '@angular/common';
import { RouterLink } from '@angular/router';
import { LayoutComponent } from '../../shared/layout.component';
import { AuthService } from '../../core/services/auth.service';
import { ApiService } from '../../core/services/api.service';
import { Event, Issue } from '@dd/shared-types';

interface VolunteerEvent {
  id: string;
  title: string;
  month: string;
  day: string;
  time: string;
  location: string;
  slots: string;
}

interface VolunteerProject {
  name: string;
  desc: string;
  status: string;
  badge: string;
  pct: number;
  issueId: string;
}

@Component({
  selector: 'app-volunteer-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, LayoutComponent],
  template: `
    <app-layout
      pageTitle="Volunteer Hub"
      [navItems]="navItems"
      (logout)="auth.logout()">

      <div style="background:linear-gradient(135deg,#D97706,#EA580C);border-radius:var(--radius-xl);padding:28px;color:white;margin-bottom:24px;">
        <h2 style="font-size:22px;font-weight:800;">🤝 Welcome back, Volunteer!</h2>
        <p style="opacity:0.8;font-size:13px;">Thank you for making our community better.</p>
        <div style="display:flex;gap:24px;margin-top:16px;">
          <div><div style="font-size:28px;font-weight:800;">{{ projects.length }}</div><div style="opacity:0.7;font-size:12px;">Active Projects</div></div>
          <div><div style="font-size:28px;font-weight:800;">{{ events.length }}</div><div style="opacity:0.7;font-size:12px;">Upcoming Events</div></div>
          <div><div style="font-size:28px;font-weight:800;">{{ recentIssues.length }}</div><div style="opacity:0.7;font-size:12px;">Issues Reported</div></div>
        </div>
      </div>

      <div class="stats-grid">
        <div class="stat-card"><div class="stat-icon amber" style="background:#FFFBEB;color:#D97706;"><i class="material-icons-outlined">volunteer_activism</i></div><div class="stat-info"><div class="stat-value">{{ projects.length }}</div><div class="stat-label">Active Projects</div></div></div>
        <div class="stat-card"><div class="stat-icon green"><i class="material-icons-outlined">event_available</i></div><div class="stat-info"><div class="stat-value">{{ events.length }}</div><div class="stat-label">Upcoming Events</div></div></div>
        <div class="stat-card"><div class="stat-icon blue"><i class="material-icons-outlined">emoji_events</i></div><div class="stat-info"><div class="stat-value">{{ resolvedCount }}</div><div class="stat-label">Issues Resolved</div></div></div>
        <div class="stat-card"><div class="stat-icon purple"><i class="material-icons-outlined">leaderboard</i></div><div class="stat-info"><div class="stat-value">{{ totalUpvotes }}</div><div class="stat-label">Community Upvotes</div></div></div>
      </div>

      <div class="content-grid">
        <div class="card">
          <div class="card-header"><h3>🏗 Community Projects</h3></div>
          <div class="card-body">
            @for (project of projects; track project.issueId) {
              <div style="padding:14px;border:1px solid var(--border);border-radius:var(--radius);margin-bottom:10px;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                  <strong>{{ project.name }}</strong>
                  <span class="badge" [class]="project.badge">{{ project.status }}</span>
                </div>
                <p style="font-size:12px;color:var(--text-secondary);margin-bottom:10px;">{{ project.desc }}</p>
                <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--text-muted);margin-bottom:6px;">
                  <span>Progress</span><span>{{ project.pct }}%</span>
                </div>
                <div style="background:var(--bg-primary);border-radius:3px;height:6px;">
                  <div [style.width.%]="project.pct" style="background:var(--primary);height:100%;border-radius:3px;"></div>
                </div>
                <div style="margin-top:10px;">
                  <a class="btn btn-ghost btn-sm" [routerLink]="['/issues', project.issueId]">View Details</a>
                </div>
              </div>
            } @empty {
              <div style="text-align:center;padding:32px;color:var(--text-muted);">No active community projects right now.</div>
            }
          </div>
        </div>
        <div class="card">
          <div class="card-header"><h3>📅 Upcoming Volunteer Events</h3></div>
          <div class="card-body">
            @for (evt of events; track evt.id) {
              <div style="display:flex;gap:16px;padding:14px;border-bottom:1px solid var(--border-light);align-items:center;">
                <div style="text-align:center;min-width:48px;">
                  <div style="font-size:22px;font-weight:800;color:var(--primary);">{{ evt.day }}</div>
                  <div style="font-size:10px;color:var(--text-muted);text-transform:uppercase;">{{ evt.month }}</div>
                </div>
                <div style="flex:1;">
                  <div style="font-size:14px;font-weight:600;">{{ evt.title }}</div>
                  <div style="font-size:12px;color:var(--text-muted);">{{ evt.time }} · {{ evt.location }}</div>
                  <div style="font-size:11px;color:var(--primary);margin-top:4px;">{{ evt.slots }}</div>
                </div>
                <button class="btn btn-primary btn-sm" (click)="rsvp(evt.id)" [disabled]="rsvpLoading === evt.id">
                  @if (rsvpLoading === evt.id) { ... } @else { RSVP }
                </button>
              </div>
            } @empty {
              <div style="text-align:center;padding:32px;color:var(--text-muted);">No upcoming volunteer events.</div>
            }
          </div>
        </div>
      </div>
    </app-layout>
  `,
})
export class VolunteerDashboardComponent implements OnInit {
  events: VolunteerEvent[] = [];
  recentIssues: Issue[] = [];
  projects: VolunteerProject[] = [];
  rsvpLoading = '';
  navItems = [
    { icon: 'dashboard', label: 'Overview', route: '/volunteer' },
    { icon: 'construction', label: 'Projects', route: '/volunteer/projects' },
    { icon: 'event', label: 'Events', route: '/volunteer/events' },
    { icon: 'ballot', label: 'Surveys', route: '/volunteer/surveys' },
    { icon: 'report_problem', label: 'Report', route: '/volunteer/report' },
  ];

  private readonly locale = 'en-US';

  constructor(public auth: AuthService, private api: ApiService) {}

  get resolvedCount(): number {
    return this.recentIssues.filter(i => i.status === 'RESOLVED' || i.status === 'VERIFIED').length;
  }

  get totalUpvotes(): number {
    return this.recentIssues.reduce((sum, i) => sum + (i.upvotes || 0), 0);
  }

  ngOnInit() {
    this.api.getEvents({ upcoming: 'true' }).subscribe((res: any) => {
      const evts: Event[] = (res.data || []).filter((e: Event) => e.type === 'VOLUNTEER_EVENT' || e.isPublic);
      this.events = evts.map(e => this.mapEvent(e));
    });

    const userId = this.auth.user()?.id;
    const issueParams: Record<string, string> = { pageSize: '10', status: 'IN_PROGRESS' };
    if (userId) issueParams['reporterId'] = userId;

    this.api.getIssues(issueParams).subscribe((res: any) => {
      const issues: Issue[] = res.data || [];
      this.recentIssues = issues;
      this.projects = issues
        .filter(i => ['ENVIRONMENT', 'SANITATION', 'OTHER'].includes(i.category))
        .slice(0, 5)
        .map(i => this.mapProject(i));
    });
  }

  rsvp(eventId: string) {
    this.rsvpLoading = eventId;
    this.api.rsvpEvent(eventId, 'ATTENDING').subscribe({
      next: () => {
        this.rsvpLoading = '';
        const evt = this.events.find(e => e.id === eventId);
        if (evt) evt.slots = 'You are registered';
      },
      error: () => { this.rsvpLoading = ''; },
    });
  }

  private mapEvent(event: Event): VolunteerEvent {
    const start = new Date(event.startTime);
    return {
      id: event.id,
      title: event.title,
      month: formatDate(start, 'MMM', this.locale),
      day: formatDate(start, 'd', this.locale),
      time: formatDate(start, 'shortTime', this.locale),
      location: event.location || 'TBD',
      slots: 'Open registration',
    };
  }

  private mapProject(issue: Issue): VolunteerProject {
    const statusMap: Record<string, { label: string; badge: string; pct: number }> = {
      SUBMITTED: { label: 'Submitted', badge: 'badge-slate', pct: 10 },
      ACKNOWLEDGED: { label: 'Acknowledged', badge: 'badge-blue', pct: 25 },
      IN_PROGRESS: { label: 'In Progress', badge: 'badge-amber', pct: 60 },
      PENDING_REVIEW: { label: 'Review', badge: 'badge-purple', pct: 85 },
      RESOLVED: { label: 'Resolved', badge: 'badge-green', pct: 100 },
    };
    const s = statusMap[issue.status] || { label: issue.status, badge: 'badge-slate', pct: 30 };
    return {
      name: issue.title,
      desc: issue.description?.slice(0, 120) + (issue.description && issue.description.length > 120 ? '...' : '') || issue.location,
      status: s.label,
      badge: s.badge,
      pct: s.pct,
      issueId: issue.id,
    };
  }
}