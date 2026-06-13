import { Component } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { LayoutComponent } from '../../shared/layout.component';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-citizen-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, LayoutComponent, DatePipe],
  template: `
    <app-layout
      pageTitle="My Dashboard"
      [navItems]="navItems"
      [notifCount]="1"
      (logout)="auth.logout()">

      <div style="display:flex;gap:16px;margin-bottom:24px;">
        <button class="btn btn-primary btn-lg" style="flex:1;" routerLink="/issues/new">
          <i class="material-icons-outlined">add_circle</i> Report New Issue
        </button>
        <button class="btn btn-secondary btn-lg">
          <i class="material-icons-outlined">poll</i> Vote on Polls
        </button>
      </div>

      <div class="stats-grid">
        <div class="stat-card"><div class="stat-icon blue"><i class="material-icons-outlined">my_reports</i></div><div class="stat-info"><div class="stat-value">{{ myIssues.length }}</div><div class="stat-label">My Reports</div></div></div>
        <div class="stat-card"><div class="stat-icon green"><i class="material-icons-outlined">check_circle</i></div><div class="stat-info"><div class="stat-value">2</div><div class="stat-label">Resolved</div></div></div>
        <div class="stat-card"><div class="stat-icon amber"><i class="material-icons-outlined">how_to_vote</i></div><div class="stat-info"><div class="stat-value">5</div><div class="stat-label">Votes Cast</div></div></div>
        <div class="stat-card"><div class="stat-icon teal"><i class="material-icons-outlined">near_me</i></div><div class="stat-info"><div class="stat-value">{{ nearbyIssues.length }}</div><div class="stat-label">Nearby Issues</div></div></div>
      </div>

      <div class="content-grid">
        <div class="card">
          <div class="card-header"><h3>📋 My Reported Issues</h3></div>
          <div class="card-body" style="padding:0;">
            <table class="data-table">
              <thead><tr><th>Title</th><th>Status</th><th>Date</th></tr></thead>
              <tbody>
                @for (issue of myIssues; track issue.id) {
                  <tr>
                    <td><strong>{{ issue.title }}</strong></td>
                    <td><span class="status-badge" [class]="issue.status.toLowerCase()">{{ issue.status }}</span></td>
                    <td style="color:var(--text-muted);">{{ issue.date }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>
        <div class="card">
          <div class="card-header"><h3>📍 Nearby Issues</h3></div>
          <div class="card-body">
            @for (issue of nearbyIssues; track issue.id) {
              <div style="display:flex;gap:12px;padding:10px 0;border-bottom:1px solid var(--border-light);">
                <div style="width:8px;height:8px;border-radius:50;margin-top:6px;" [style.background]="issue.color"></div>
                <div style="flex:1;">
                  <div style="font-size:13px;font-weight:600;">{{ issue.title }}</div>
                  <div style="font-size:11px;color:var(--text-muted);">{{ issue.distance }} · {{ issue.votes }} votes</div>
                </div>
                <button class="btn btn-ghost btn-sm">▲</button>
              </div>
            }
          </div>
        </div>
      </div>

      <div class="card" style="margin-bottom:24px;">
        <div class="card-header"><h3>🗳 Active Polls</h3></div>
        <div class="card-body">
          <div style="padding:16px;border:1px solid var(--border);border-radius:var(--radius);margin-bottom:12px;">
            <strong>What should be our top infrastructure priority?</strong>
            <p style="font-size:12px;color:var(--text-muted);margin:8px 0;">Closes July 31, 2026</p>
            @for (opt of pollOptions; track opt.text) {
              <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
                <input type="radio" name="poll" style="width:16px;height:16px;" />
                <span style="font-size:13px;flex:1;">{{ opt.text }}</span>
                <span style="font-size:13px;font-weight:700;">{{ opt.votes }}</span>
                <div style="width:80px;background:var(--bg-primary);border-radius:3px;height:6px;"><div [style.width.%]="opt.pct" style="background:var(--primary);height:100%;border-radius:3px;"></div></div>
              </div>
            }
            <button class="btn btn-primary btn-sm" style="margin-top:8px;">Submit Vote</button>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-header"><h3>🤖 CivicAssist Chatbot</h3></div>
        <div class="card-body">
          <div style="background:var(--bg-primary);border-radius:var(--radius-lg);padding:20px;min-height:160px;">
            <div style="display:flex;gap:10px;margin-bottom:16px;">
              <div style="width:32px;height:32px;border-radius:50%;background:var(--primary);color:white;display:flex;align-items:center;justify-content:center;font-size:14px;">🤖</div>
              <div style="background:white;padding:12px 16px;border-radius:var(--radius-lg);font-size:13px;max-width:80%;box-shadow:var(--shadow-sm);">
                Hello! I'm CivicAssist, your municipal AI helper. I can help you report issues, find city services, or answer questions about your neighborhood. How can I help today?
              </div>
            </div>
          </div>
          <div style="display:flex;gap:8px;margin-top:12px;">
            <input type="text" placeholder="Type your question..." style="flex:1;padding:10px 16px;border:1px solid var(--border);border-radius:var(--radius);font-size:13px;" />
            <button class="btn btn-primary"><i class="material-icons-outlined" style="font-size:18px;">send</i></button>
          </div>
        </div>
      </div>
    </app-layout>
  `,
})
export class CitizenDashboardComponent {
  myIssues = [
    { id: '1', title: 'Pothole on Main Street', status: 'IN_PROGRESS', date: 'Jun 8' },
    { id: '2', title: 'Streetlight out on Oak Ave', status: 'ACKNOWLEDGED', date: 'Jun 11' },
    { id: '3', title: 'Illegal dumping in park', status: 'SUBMITTED', date: 'Jun 12' },
  ];
  nearbyIssues = [
    { id: '1', title: 'Broken sidewalk tile', distance: '0.2 mi', votes: 14, color: '#2563EB' },
    { id: '2', title: 'Loud construction noise', distance: '0.3 mi', votes: 8, color: '#D97706' },
    { id: '3', title: 'Stray dog near school', distance: '0.5 mi', votes: 22, color: '#DC2626' },
    { id: '4', title: 'Park bench needs repair', distance: '0.1 mi', votes: 5, color: '#16A34A' },
  ];
  pollOptions = [
    { text: 'Road Repairs & Potholes', votes: 156, pct: 78 },
    { text: 'Bridge Maintenance', votes: 89, pct: 44 },
    { text: 'Water System Upgrades', votes: 203, pct: 100 },
    { text: 'Pedestrian Safety', votes: 134, pct: 67 },
  ];
  navItems = [
    { icon: 'dashboard', label: 'Overview', route: '/citizen' },
    { icon: 'my_reports', label: 'My Reports', route: '/citizen/reports' },
    { icon: 'near_me', label: 'Nearby', route: '/citizen/nearby' },
    { icon: 'how_to_vote', label: 'Polls & Voting', route: '/citizen/polls' },
    { icon: 'forum', label: 'Forums', route: '/citizen/forums' },
    { icon: 'event', label: 'Events', route: '/citizen/events' },
  ];
  constructor(public auth: AuthService) {}
}
