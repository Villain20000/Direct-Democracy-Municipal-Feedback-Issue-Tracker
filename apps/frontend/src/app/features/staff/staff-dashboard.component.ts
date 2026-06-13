import { Component, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { LayoutComponent } from '../../shared/layout.component';
import { AuthService } from '../../core/services/auth.service';
import { ApiService } from '../../core/services/api.service';
import { Issue } from '@dd/shared-types';

@Component({
  selector: 'app-staff-dashboard',
  standalone: true,
  imports: [CommonModule, LayoutComponent, DatePipe],
  template: `
    <app-layout
      pageTitle="Staff Dashboard"
      [navItems]="navItems"
      [notifCount]="2"
      (logout)="auth.logout()">

      <div class="stats-grid">
        <div class="stat-card"><div class="stat-icon orange" style="background:#FFF7ED;color:#EA580C;"><i class="material-icons-outlined">assignment_ind</i></div><div class="stat-info"><div class="stat-value">8</div><div class="stat-label">My Assigned Issues</div></div></div>
        <div class="stat-card"><div class="stat-icon amber"><i class="material-icons-outlined">pending</i></div><div class="stat-info"><div class="stat-value">5</div><div class="stat-label">In Progress</div></div></div>
        <div class="stat-card"><div class="stat-icon green"><i class="material-icons-outlined">task_alt</i></div><div class="stat-info"><div class="stat-value">3</div><div class="stat-label">Completed Today</div></div></div>
        <div class="stat-card"><div class="stat-icon red"><i class="material-icons-outlined">priority_high</i></div><div class="stat-info"><div class="stat-value">1</div><div class="stat-label">High Priority</div></div></div>
      </div>

      <div class="card" style="margin-bottom: 24px;">
        <div class="card-header"><h3>My Task Queue</h3><div class="card-actions">
          <button class="btn btn-secondary btn-sm">Filter</button>
          <button class="btn btn-primary btn-sm">Sort by Priority</button>
        </div></div>
        <div class="card-body" style="padding:0;">
          <table class="data-table">
            <thead><tr><th>Title</th><th>Status</th><th>Priority</th><th>Reporter</th><th>Date</th><th>Actions</th></tr></thead>
            <tbody>
              @for (issue of myIssues; track issue.id) {
                <tr>
                  <td><strong>{{ issue.title }}</strong><br><span style="font-size:11px;color:var(--text-muted);">{{ issue.location }}</span></td>
                  <td><span class="status-badge" [class]="issue.status.toLowerCase()">{{ issue.status }}</span></td>
                  <td><span class="priority-dot" [class]="'p' + (issue.priority || 3)"></span> {{ issue.priority }}/5</td>
                  <td>{{ issue.reporter }}</td>
                  <td style="color:var(--text-muted);">{{ issue.date }}</td>
                  <td>
                    <div style="display:flex;gap:4px;">
                      <button class="btn btn-primary btn-sm" (click)="updateStatus(issue, 'IN_PROGRESS')">▶ Start</button>
                      <button class="btn btn-success btn-sm" (click)="updateStatus(issue, 'RESOLVED')">✓ Done</button>
                    </div>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>

      <div class="content-grid">
        <div class="card">
          <div class="card-header"><h3>Today's Activity</h3></div>
          <div class="card-body">
            @for (activity of todayActivity; track activity.time) {
              <div style="display:flex;gap:12px;padding:10px 0;border-bottom:1px solid var(--border-light);">
                <div style="min-width:50px;font-size:12px;color:var(--text-muted);">{{ activity.time }}</div>
                <div><div style="font-size:13px;font-weight:500;">{{ activity.text }}</div><div style="font-size:11px;color:var(--text-muted);">{{ activity.note }}</div></div>
              </div>
            }
          </div>
        </div>
        <div class="card">
          <div class="card-header"><h3>Department Announcements</h3></div>
          <div class="card-body">
            <div style="padding:14px;background:#FFFBEB;border-radius:var(--radius);border-left:4px solid #D97706;margin-bottom:12px;">
              <div style="font-size:13px;font-weight:700;">⚠️ Safety Notice</div>
              <div style="font-size:12px;color:var(--text-secondary);margin-top:4px;">Wear high-vis vests at all construction sites. New PPE requirements effective immediately.</div>
            </div>
            <div style="padding:14px;background:#EFF6FF;border-radius:var(--radius);border-left:4px solid #2563EB;">
              <div style="font-size:13px;font-weight:700;">📋 New Reporting Format</div>
              <div style="font-size:12px;color:var(--text-secondary);margin-top:4px;">Starting next week, all field reports should include photo documentation.</div>
            </div>
          </div>
        </div>
      </div>
    </app-layout>
  `,
})
export class StaffDashboardComponent implements OnInit {
  myIssues: any[] = [];
  todayActivity = [
    { time: '9:15 AM', text: 'Resolved pothole repair on Main St', note: 'Completed ahead of schedule' },
    { time: '10:30 AM', text: 'Started work on broken streetlight', note: 'Oak Avenue - awaiting parts' },
    { time: '11:00 AM', text: 'New issue assigned: Tree blocking sidewalk', note: 'Maple Drive - moderate priority' },
    { time: '1:45 PM', text: 'Updated water main break status', note: 'Emergency crew on site' },
  ];
  navItems = [
    { icon: 'dashboard', label: 'Overview', route: '/staff' },
    { icon: 'assignment', label: 'My Tasks', route: '/staff/tasks' },
    { icon: 'task_alt', label: 'Completed', route: '/staff/completed' },
    { icon: 'note_add', label: 'Field Notes', route: '/staff/notes' },
  ];

  constructor(public auth: AuthService, private api: ApiService) {}

  ngOnInit() {
    this.myIssues = [
      { id: '1', title: 'Large pothole on Main Street', location: 'Main St & 5th Ave', status: 'IN_PROGRESS', priority: 4, reporter: 'John Smith', date: 'Jun 10' },
      { id: '2', title: 'Broken streetlight on Oak Ave', location: '1234 Oak Avenue', status: 'ACKNOWLEDGED', priority: 3, reporter: 'Jane Doe', date: 'Jun 11' },
      { id: '3', title: 'Tree blocking sidewalk', location: '456 Maple Drive', status: 'SUBMITTED', priority: 3, reporter: 'Mike Brown', date: 'Jun 12' },
      { id: '4', title: 'Graffiti on community center', location: 'Westfield Community Center', status: 'SUBMITTED', priority: 1, reporter: 'Patricia Wilson', date: 'Jun 12' },
    ];
  }

  updateStatus(issue: any, status: string) { issue.status = status; }
}
