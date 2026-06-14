import { Component, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LayoutComponent, NavItem } from '../../shared/layout.component';
import { AuthService } from '../../core/services/auth.service';
import { ApiService } from '../../core/services/api.service';
import { Poll } from '@dd/shared-types';

@Component({
  selector: 'app-polls-page',
  standalone: true,
  imports: [CommonModule, FormsModule, LayoutComponent, DatePipe],
  template: `
    <app-layout pageTitle="Polls & Voting" [navItems]="navItems" (logout)="auth.logout()">
      @if (error) {
        <div class="card" style="margin-bottom:24px;border-color:var(--danger);">
          <div class="card-body" style="color:var(--danger);">{{ error }}</div>
        </div>
      }

      @if (loading) {
        <div class="card"><div class="card-body" style="text-align:center;padding:48px;color:var(--text-muted);">Loading polls...</div></div>
      } @else {
        <div class="card">
          <div class="card-header"><h3>🗳 Active Polls</h3></div>
          <div class="card-body">
            @for (poll of polls; track poll.id) {
              <div style="padding:16px;border:1px solid var(--border);border-radius:var(--radius);margin-bottom:12px;">
                <strong>{{ poll.title }}</strong>
                @if (poll.description) {
                  <p style="font-size:13px;color:var(--text-secondary);margin:8px 0;">{{ poll.description }}</p>
                }
                @if (poll.closesAt) {
                  <p style="font-size:12px;color:var(--text-muted);margin-bottom:12px;">Closes {{ poll.closesAt | date:'mediumDate' }}</p>
                }
                @for (opt of poll.options || []; track opt.id) {
                  <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
                    <input type="radio" [name]="'poll-' + poll.id" [value]="opt.id" [(ngModel)]="selectedOptions[poll.id]" style="width:16px;height:16px;" />
                    <span style="font-size:13px;flex:1;">{{ opt.text }}</span>
                    <span style="font-size:13px;font-weight:700;">{{ opt.votes }}</span>
                    <div style="width:80px;background:var(--bg-primary);border-radius:3px;height:6px;">
                      <div [style.width.%]="getVotePct(opt.votes, poll)" style="background:var(--primary);height:100%;border-radius:3px;"></div>
                    </div>
                  </div>
                }
                <button class="btn btn-primary btn-sm" style="margin-top:8px;" [disabled]="!selectedOptions[poll.id] || votingPollId === poll.id" (click)="submitVote(poll)">
                  {{ votingPollId === poll.id ? 'Submitting...' : 'Submit Vote' }}
                </button>
              </div>
            } @empty {
              <div style="text-align:center;padding:48px;color:var(--text-muted);">No active polls at this time.</div>
            }
          </div>
        </div>
      }
    </app-layout>
  `,
})
export class PollsPageComponent implements OnInit {
  polls: Poll[] = [];
  selectedOptions: Record<string, string> = {};
  loading = true;
  error = '';
  votingPollId = '';
  navItems: NavItem[] = [];

  constructor(public auth: AuthService, private api: ApiService) {
    this.navItems = [{ icon: 'dashboard', label: 'Dashboard', route: auth.getDashboardRoute() }];
  }

  ngOnInit() { this.loadPolls(); }

  loadPolls() {
    this.loading = true;
    this.error = '';
    this.api.getPolls({ activeOnly: 'true' }).subscribe({
      next: (res: any) => {
        this.polls = res.data || [];
        this.loading = false;
      },
      error: (err) => {
        this.error = err.error?.error || 'Failed to load polls.';
        this.loading = false;
      },
    });
  }

  getVotePct(votes: number, poll: Poll): number {
    const total = (poll.options || []).reduce((sum, o) => sum + o.votes, 0);
    return total > 0 ? (votes / total) * 100 : 0;
  }

  submitVote(poll: Poll) {
    const optionId = this.selectedOptions[poll.id];
    if (!optionId) return;
    this.votingPollId = poll.id;
    this.api.votePoll(poll.id, optionId).subscribe({
      next: (res: any) => {
        if (res.success) {
          const updated = res.data;
          const idx = this.polls.findIndex(p => p.id === poll.id);
          if (idx >= 0 && updated) this.polls[idx] = updated;
        }
        this.votingPollId = '';
      },
      error: (err) => {
        this.error = err.error?.error || 'Failed to submit vote.';
        this.votingPollId = '';
      },
    });
  }
}