import { Component, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { LayoutComponent } from '../../shared/layout.component';
import { AuthService } from '../../core/services/auth.service';
import { ApiService } from '../../core/services/api.service';
import { Event, Issue } from '@dd/shared-types';

interface VolunteerEvent {
  title: string;
  month: string;
  day: string;
  time: string;
  location: string;
  slots: string;
}

@Component({
  selector: 'app-volunteer-dashboard',
  standalone: true,
  imports: [CommonModule, LayoutComponent, DatePipe],
  template: `
    <app-layout
      pageTitle="Volunteer Hub"
      [navItems]="navItems"
      (logout)="auth.logout()">

      <div style="background:linear-gradient(135deg,#D97706,#EA580C);border-radius:var(--radius-xl);padding:28px;color:white;margin-bottom:24px;">
        <h2 style="font-size:22px;font-weight:800;">🤝 Welcome back, Volunteer!</h2>
        <p style="opacity:0.8;font-size:13px;">Thank you for making our community better. Here's your impact this month.</p>
        <div style="display:flex;gap:24px;margin-top:16px;">
          <div><div style="font-size:28px;font-weight:800;">47</div><div style="opacity:0.7;font-size:12px;">Hours Volunteered</div></div>
          <div><div style="font-size:28px;font-weight:800;">{{ events.length }}</div><div style="opacity:0.7;font-size:12px;">Upcoming Events</div></div>
          <div><div style="font-size:28px;font-weight:800;">{{ recentIssues.length }}</div><div style="opacity:0.7;font-size:12px;">Issues Reported</div></div>
        </div>
      </div>

      <div class="stats-grid">
        <div class="stat-card"><div class="stat-icon amber" style="background:#FFFBEB;color:#D97706;"><i class="material-icons-outlined">volunteer_activism</i></div><div class="stat-info"><div class="stat-value">3</div><div class="stat-label">Active Projects</div></div></div>
        <div class="stat-card"><div class="stat-icon green"><i class="material-icons-outlined">event_available</i></div><div class="stat-info"><div class="stat-value">{{ events.length }}</div><div class="stat-label">Upcoming Events</div></div></div>
        <div class="stat-card"><div class="stat-icon blue"><i class="material-icons-outlined">emoji_events</i></div><div class="stat-info"><div class="stat-value">5</div><div class="stat-label">Badges Earned</div></div></div>
        <div class="stat-card"><div class="stat-icon purple"><i class="material-icons-outlined">leaderboard</i></div><div class="stat-info"><div class="stat-value">#3</div><div class="stat-label">Community Rank</div></div></div>
      </div>

      <div class="content-grid">
        <div class="card">
          <div class="card-header"><h3>🏗 Active Projects</h3></div>
          <div class="card-body">
            @for (project of projects; track project.name) {
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
                <div style="display:flex;gap:8px;margin-top:10px;">
                  <button class="btn btn-primary btn-sm">Join</button>
                  <button class="btn btn-ghost btn-sm">Details</button>
                </div>
              </div>
            }
          </div>
        </div>
        <div class="card">
          <div class="card-header"><h3>📅 Upcoming Volunteer Events</h3></div>
          <div class="card-body">
            @for (evt of events; track evt.title) {
              <div style="display:flex;gap:16px;padding:14px;border-bottom:1px solid var(--border-light);">
                <div style="text-align:center;min-width:48px;">
                  <div style="font-size:22px;font-weight:800;color:var(--primary);">{{ evt.day }}</div>
                  <div style="font-size:10px;color:var(--text-muted);text-transform:uppercase;">{{ evt.month }}</div>
                </div>
                <div style="flex:1;">
                  <div style="font-size:14px;font-weight:600;">{{ evt.title }}</div>
                  <div style="font-size:12px;color:var(--text-muted);">{{ evt.time }} · {{ evt.location }}</div>
                  <div style="font-size:11px;color:var(--primary);margin-top:4px;">{{ evt.slots }}</div>
                </div>
                <button class="btn btn-primary btn-sm">RSVP</button>
              </div>
            } @empty {
              <div style="text-align:center;padding:32px;color:var(--text-muted);">No upcoming volunteer events.</div>
            }
            <div style="margin-top:16px;">
              <div style="font-size:13px;font-weight:600;margin-bottom:12px;">🏆 Achievement Badges</div>
              <div style="display:flex;gap:8px;flex-wrap:wrap;">
                @for (badge of badges; track badge) {
                  <span style="padding:6px 12px;background:var(--bg-primary);border-radius:20px;font-size:12px;">{{ badge }}</span>
                }
              </div>
            </div>
          </div>
        </div>
      </div>
    </app-layout>
  `,
})
export class VolunteerDashboardComponent implements OnInit {
  events: VolunteerEvent[] = [];
  recentIssues: Issue[] = [];
  projects = [
    { name: 'Riverside Park Cleanup', desc: 'Monthly cleanup of riverside trails and picnic areas', status: 'Active', badge: 'badge-green', pct: 65 },
    { name: 'Community Garden Build', desc: 'Building raised garden beds at Westfield Community Center', status: 'In Progress', badge: 'badge-amber', pct: 40 },
    { name: 'Neighborhood Watch Patrol', desc: 'Weekly evening patrols in the Southgate district', status: 'Ongoing', badge: 'badge-blue', pct: 80 },
  ];
  badges = ['🌿 Green Warrior', '🎯 Issue Spotter', '🏅 Top Reporter', '🤝 Team Player', '⭐ Star Volunteer'];
  navItems = [
    { icon: 'dashboard', label: 'Overview', route: '/volunteer' },
    { icon: 'construction', label: 'Projects', route: '/volunteer/projects' },
    { icon: 'event', label: 'Events', route: '/volunteer/events' },
    { icon: 'report_problem', label: 'Report', route: '/volunteer/report' },
  ];

  constructor(public auth: AuthService, private api: ApiService, private datePipe: DatePipe) {}

  ngOnInit() {
    this.api.getEvents({ upcoming: 'true' }).subscribe((res: any) => {
      const evts: Event[] = res.data || [];
      this.events = evts.map(e => this.mapEvent(e));
    });
    this.api.getIssues({ pageSize: '5' }).subscribe((res: any) => {
      if (res.data) this.recentIssues = res.data;
    });
  }

  private mapEvent(event: Event): VolunteerEvent {
    const start = new Date(event.startTime);
    return {
      title: event.title,
      month: this.datePipe.transform(start, 'MMM') || '',
      day: this.datePipe.transform(start, 'd') || '',
      time: this.datePipe.transform(start, 'shortTime') || '',
      location: event.location || 'TBD',
      slots: 'Open registration',
    };
  }
}