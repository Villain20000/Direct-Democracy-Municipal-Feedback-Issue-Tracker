import { Component, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { LayoutComponent } from '../../shared/layout.component';
import { AuthService } from '../../core/services/auth.service';
import { ApiService } from '../../core/services/api.service';
import { Issue, Poll } from '@dd/shared-types';

@Component({
  selector: 'app-citizen-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, LayoutComponent, DatePipe],
  template: `
    <app-layout
      pageTitle="My Dashboard"
      [navItems]="navItems"
      (logout)="auth.logout()">

      <div style="display:flex;gap:16px;margin-bottom:24px;">
        <button class="btn btn-primary btn-lg" style="flex:1;" routerLink="/issues/new">
          <i class="material-icons-outlined">add_circle</i> Report New Issue
        </button>
        <button class="btn btn-secondary btn-lg" routerLink="/citizen/polls">
          <i class="material-icons-outlined">poll</i> Vote on Polls
        </button>
      </div>

      <div class="stats-grid">
        <div class="stat-card"><div class="stat-icon blue"><i class="material-icons-outlined">my_reports</i></div><div class="stat-info"><div class="stat-value">{{ myIssues.length }}</div><div class="stat-label">My Reports</div></div></div>
        <div class="stat-card"><div class="stat-icon green"><i class="material-icons-outlined">check_circle</i></div><div class="stat-info"><div class="stat-value">{{ resolvedCount }}</div><div class="stat-label">Resolved</div></div></div>
        <div class="stat-card"><div class="stat-icon amber"><i class="material-icons-outlined">how_to_vote</i></div><div class="stat-info"><div class="stat-value">{{ votesCast }}</div><div class="stat-label">Votes Cast</div></div></div>
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
                  <tr [routerLink]="['/issues', issue.id]" style="cursor:pointer;">
                    <td><strong>{{ issue.title }}</strong></td>
                    <td><span class="status-badge" [ngClass]="statusClass(issue.status)">{{ formatStatus(issue.status) }}</span></td>
                    <td style="color:var(--text-muted);">{{ issue.createdAt | date:'mediumDate' }}</td>
                  </tr>
                } @empty {
                  <tr><td colspan="3" style="text-align:center;padding:32px;color:var(--text-muted);">No reported issues yet.</td></tr>
                }
              </tbody>
            </table>
          </div>
        </div>
        <div class="card">
          <div class="card-header"><h3>📍 Nearby Issues</h3></div>
          <div class="card-body">
            @for (issue of nearbyIssues; track issue.id) {
              <div style="display:flex;gap:12px;padding:10px 0;border-bottom:1px solid var(--border-light);align-items:flex-start;">
                <div style="width:8px;height:8px;border-radius:50%;margin-top:6px;" [style.background]="getCategoryColor(issue.category)"></div>
                <a [routerLink]="['/issues', issue.id]" style="flex:1;text-decoration:none;color:inherit;">
                  <div style="font-size:13px;font-weight:600;">{{ issue.title }}</div>
                  <div style="font-size:11px;color:var(--text-muted);">{{ issue.location }} · {{ issue.upvotes }} votes</div>
                </a>
                <button type="button" class="btn btn-ghost btn-sm" [disabled]="upvotingId === issue.id" (click)="upvoteIssue(issue, $event)">
                  @if (upvotingId === issue.id) { ... } @else { ▲ }
                </button>
              </div>
            } @empty {
              <div style="text-align:center;padding:32px;color:var(--text-muted);">No nearby issues found.</div>
            }
          </div>
        </div>
      </div>

      <div class="card" style="margin-bottom:24px;">
        <div class="card-header"><h3>🗳 Active Polls</h3></div>
        <div class="card-body">
          @if (activePoll) {
            <div style="padding:16px;border:1px solid var(--border);border-radius:var(--radius);margin-bottom:12px;">
              <strong>{{ activePoll.title }}</strong>
              @if (activePoll.closesAt) {
                <p style="font-size:12px;color:var(--text-muted);margin:8px 0;">Closes {{ activePoll.closesAt | date:'mediumDate' }}</p>
              }
              @for (opt of activePoll.options || []; track opt.id) {
                <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
                  <input type="radio" name="poll" [value]="opt.id" [(ngModel)]="selectedOptionId" style="width:16px;height:16px;" />
                  <span style="font-size:13px;flex:1;">{{ opt.text }}</span>
                  <span style="font-size:13px;font-weight:700;">{{ opt.votes }}</span>
                  <div style="width:80px;background:var(--bg-primary);border-radius:3px;height:6px;"><div [style.width.%]="getVotePct(opt.votes)" style="background:var(--primary);height:100%;border-radius:3px;"></div></div>
                </div>
              }
              <button class="btn btn-primary btn-sm" style="margin-top:8px;" [disabled]="!selectedOptionId" (click)="submitVote()">Submit Vote</button>
            </div>
          } @else {
            <div style="text-align:center;padding:32px;color:var(--text-muted);">No active polls at this time.</div>
          }
        </div>
      </div>

      <div class="card">
        <div class="card-header"><h3>🤖 CivicAssist Chatbot</h3></div>
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
              <div style="font-size:12px;color:var(--text-muted);">Thinking...</div>
            }
          </div>
          <div style="display:flex;gap:8px;margin-top:12px;">
            <input type="text" [(ngModel)]="chatInput" (keyup.enter)="sendChat()" placeholder="Type your question..." style="flex:1;padding:10px 16px;border:1px solid var(--border);border-radius:var(--radius);font-size:13px;" />
            <button class="btn btn-primary" [disabled]="!chatInput.trim() || chatSending" (click)="sendChat()"><i class="material-icons-outlined" style="font-size:18px;">send</i></button>
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
  chatMessages: { role: string; content: string }[] = [
    { role: 'assistant', content: "Hello! I'm CivicAssist, your municipal AI helper. I can help you report issues, find city services, or answer questions about your neighborhood. How can I help today?" },
  ];
  navItems = [
    { icon: 'dashboard', label: 'Overview', route: '/citizen' },
    { icon: 'my_reports', label: 'My Reports', route: '/citizen/reports' },
    { icon: 'near_me', label: 'Nearby', route: '/citizen/nearby' },
    { icon: 'how_to_vote', label: 'Polls & Voting', route: '/citizen/polls' },
    { icon: 'ballot', label: 'Surveys', route: '/citizen/surveys' },
    { icon: 'forum', label: 'Forums', route: '/citizen/forums' },
    { icon: 'event', label: 'Events', route: '/citizen/events' },
  ];

  constructor(public auth: AuthService, private api: ApiService) {}

  get resolvedCount(): number {
    return this.myIssues.filter(i => i.status === 'RESOLVED' || i.status === 'VERIFIED').length;
  }

  ngOnInit() {
    const userId = this.auth.user()?.id;
    if (userId) {
      this.api.getIssues({ reporterId: userId, pageSize: '5' }).subscribe((res: any) => {
        if (res.data) this.myIssues = res.data;
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
    return status.replace(/_/g, ' ');
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
    this.api.aiChat(this.chatMessages).subscribe({
      next: (res: any) => {
        const reply = res.data?.response || res.data?.message || 'Sorry, I could not process that request.';
        this.chatMessages.push({ role: 'assistant', content: reply });
        this.chatSending = false;
      },
      error: () => {
        this.chatMessages.push({ role: 'assistant', content: 'Sorry, the chatbot is temporarily unavailable. Please try again later.' });
        this.chatSending = false;
      },
    });
  }
}