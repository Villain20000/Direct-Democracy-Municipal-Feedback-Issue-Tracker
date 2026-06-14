import { Component, OnInit, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LayoutComponent, NavItem } from '../../shared/layout.component';
import { AuthService } from '../../core/services/auth.service';
import { ApiService } from '../../core/services/api.service';
import { ToastService } from '../../core/services/toast.service';
import { TranslationService } from '../../core/i18n/translation.service';
import { Poll, UserRole } from '@dd/shared-types';

@Component({
  selector: 'app-polls-page',
  standalone: true,
  imports: [CommonModule, FormsModule, LayoutComponent, DatePipe],
  template: `
    <app-layout [pageTitle]="i18n.t('polls.pageTitle')" [navItems]="navItems" (logout)="auth.logout()">
      @if (error) {
        <div class="card" style="margin-bottom:24px;border-color:var(--danger);">
          <div class="card-body" style="color:var(--danger);">{{ error }}</div>
        </div>
      }

      <div style="display:flex;gap:12px;margin-bottom:16px;flex-wrap:wrap;align-items:center;">
        <div style="display:flex;gap:6px;background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius);padding:4px;">
          <button class="btn btn-sm" [class.btn-primary]="showActive" [class.btn-ghost]="!showActive" (click)="setView(true)">{{ i18n.t('polls.activeTab') }}</button>
          <button class="btn btn-sm" [class.btn-primary]="!showActive" [class.btn-ghost]="showActive" (click)="setView(false)">{{ i18n.t('polls.closedTab') }}</button>
        </div>
        @if (canCreate) {
          <button class="btn btn-primary" (click)="openCreateModal()"><i class="material-icons-outlined" style="font-size:18px;">add</i> {{ i18n.t('polls.createBtn') }}</button>
        }
      </div>

      @if (loading) {
        <div class="card"><div class="card-body" style="text-align:center;padding:48px;color:var(--text-muted);">{{ i18n.t('polls.loading') }}</div></div>
      } @else {
        <div class="card">
          <div class="card-header"><h3>{{ showActive ? i18n.t('polls.activeHeader') : i18n.t('polls.closedHeader') }}</h3></div>
          <div class="card-body">
            @for (poll of polls; track poll.id) {
              <div style="padding:16px;border:1px solid var(--border);border-radius:var(--radius);margin-bottom:12px;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
                  <strong>{{ poll.title }}</strong>
                  <span class="badge" [class]="poll.isActive ? 'badge-green' : 'badge-slate'">{{ i18n.tPollState(poll.isActive) }}</span>
                </div>
                @if (poll.description) {
                  <p style="font-size:13px;color:var(--text-secondary);margin:8px 0;">{{ poll.description }}</p>
                }
                @if (poll.closesAt) {
                  <p style="font-size:12px;color:var(--text-muted);margin-bottom:12px;">{{ i18n.t('polls.closes', { date: poll.closesAt | date:'mediumDate' }) }}</p>
                }
                @for (opt of poll.options || []; track opt.id) {
                  <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
                    <input type="radio" [name]="'poll-' + poll.id" [value]="opt.id" [(ngModel)]="selectedOptions[poll.id]" style="width:16px;height:16px;" [disabled]="!poll.isActive" />
                    <span style="font-size:13px;flex:1;">{{ opt.text }}</span>
                    <span style="font-size:13px;font-weight:700;">{{ opt.votes }}</span>
                    <div style="width:80px;background:var(--bg-primary);border-radius:3px;height:6px;">
                      <div [style.width.%]="getVotePct(opt.votes, poll)" style="background:var(--primary);height:100%;border-radius:3px;"></div>
                    </div>
                  </div>
                }
                @if (poll.isActive) {
                  <button class="btn btn-primary btn-sm" style="margin-top:8px;" [disabled]="!selectedOptions[poll.id] || votingPollId === poll.id" (click)="submitVote(poll)">
                    {{ votingPollId === poll.id ? i18n.t('polls.submitting') : i18n.t('polls.submitVote') }}
                  </button>
                }
                @if (canManage() && poll.isActive) {
                  <button class="btn btn-secondary btn-sm" style="margin-top:8px;margin-left:8px;" (click)="closePoll(poll)" [disabled]="closingPollId === poll.id">
                    {{ closingPollId === poll.id ? i18n.t('polls.closing') : i18n.t('polls.closePoll') }}
                  </button>
                }
              </div>
            } @empty {
              <div style="text-align:center;padding:48px;color:var(--text-muted);">{{ showActive ? i18n.t('polls.noActive') : i18n.t('polls.noClosed') }}</div>
            }
          </div>
        </div>
      }

      <!-- Create Poll Modal -->
      @if (showCreateModal) {
        <div class="modal-backdrop" (click)="closeCreateModal()">
          <div class="modal" (click)="$event.stopPropagation()">
            <div class="modal-header">
              <h3>{{ i18n.t('polls.createNew') }}</h3>
              <button class="modal-close" (click)="closeCreateModal()">×</button>
            </div>
            <div class="modal-body">
              <div class="form-group">
                <label>{{ i18n.t('polls.titleField') }}</label>
                <input type="text" [(ngModel)]="newPoll.title" name="title" />
              </div>
              <div class="form-group">
                <label>{{ i18n.t('polls.description') }}</label>
                <textarea [(ngModel)]="newPoll.description" name="description" rows="2"></textarea>
              </div>
              <div class="form-group">
                <label>{{ i18n.t('polls.optionsField') }}</label>
                @for (opt of newPoll.options; track $index; let i = $index) {
                  <div style="display:flex;gap:6px;margin-bottom:6px;">
                    <input type="text" [(ngModel)]="newPoll.options[i]" [name]="'opt' + i" [placeholder]="i18n.t('polls.optionPlaceholder', { n: i + 1 })" style="flex:1;padding:8px 12px;border:1px solid var(--border);border-radius:var(--radius);font-size:13px;" />
                    @if (newPoll.options.length > 2) {
                      <button class="btn btn-ghost btn-sm" (click)="removeOption(i)">×</button>
                    }
                  </div>
                }
                <button class="btn btn-secondary btn-sm" (click)="addOption()">{{ i18n.t('polls.addOption') }}</button>
              </div>
              <div class="form-group">
                <label>{{ i18n.t('polls.closesAt') }}</label>
                <input type="datetime-local" [(ngModel)]="newPoll.closesAt" name="closesAt" />
              </div>
            </div>
            <div class="modal-footer">
              <button class="btn btn-secondary" (click)="closeCreateModal()">{{ i18n.t('common.cancel') }}</button>
              <button class="btn btn-primary" (click)="createPoll()" [disabled]="!isPollValid() || creating">
                @if (creating) { {{ i18n.t('polls.creating') }} } @else { {{ i18n.t('polls.createBtn') }} }
              </button>
            </div>
          </div>
        </div>
      }
    </app-layout>
  `,
  styles: [`
    .modal-backdrop { position: fixed; inset: 0; background: rgba(15,23,42,0.6); display: flex; align-items: center; justify-content: center; z-index: 2000; backdrop-filter: blur(4px); }
    .modal { background: var(--bg-card); border-radius: var(--radius-lg); width: 100%; max-width: 520px; box-shadow: var(--shadow-lg); max-height: 90vh; overflow-y: auto; }
    .modal-header { display: flex; align-items: center; justify-content: space-between; padding: 16px 20px; border-bottom: 1px solid var(--border); }
    .modal-header h3 { font-size: 15px; font-weight: 700; }
    .modal-close { background: none; border: none; font-size: 24px; cursor: pointer; color: var(--text-muted); width: 28px; height: 28px; border-radius: 50%; }
    .modal-close:hover { background: var(--bg-primary); color: var(--text-primary); }
    .modal-body { padding: 20px; }
    .modal-footer { display: flex; gap: 8px; justify-content: flex-end; padding: 14px 20px; border-top: 1px solid var(--border); background: var(--bg-primary); }
  `],
})
export class PollsPageComponent implements OnInit {
  polls: Poll[] = [];
  selectedOptions: Record<string, string> = {};
  loading = true;
  error = '';
  votingPollId = '';
  closingPollId = '';
  showActive = true;
  canCreate = false;

  showCreateModal = false;
  creating = false;
  newPoll = { title: '', description: '', options: ['', ''] as string[], closesAt: '' };

  navItems: NavItem[] = [];

  auth = inject(AuthService);
  api = inject(ApiService);
  toast = inject(ToastService);
  i18n = inject(TranslationService);

  constructor() {
    this.navItems = [{ icon: 'dashboard', label: 'nav.dashboard', route: this.auth.getDashboardRoute() }];
    this.canCreate = this.auth.hasRole(UserRole.SUPER_ADMIN, UserRole.MAYOR, UserRole.COUNCIL_MEMBER);
  }

  ngOnInit() { this.loadPolls(); }

  setView(active: boolean) {
    this.showActive = active;
    this.loadPolls();
  }

  loadPolls() {
    this.loading = true;
    this.error = '';
    this.api.getPolls({ activeOnly: String(this.showActive) }).subscribe({
      next: (res: any) => {
        this.polls = res.data || [];
        this.loading = false;
      },
      error: (err) => {
        this.error = err.error?.error || this.i18n.t('polls.loadFailed');
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
          this.toast.success(this.i18n.t('polls.voteSubmitted'));
        }
        this.votingPollId = '';
      },
      error: (err) => {
        this.toast.error(err.error?.error || this.i18n.t('polls.voteFailed'));
        this.votingPollId = '';
      },
    });
  }

  canManage(): boolean {
    return this.auth.hasRole(UserRole.SUPER_ADMIN, UserRole.MAYOR, UserRole.COUNCIL_MEMBER);
  }

  closePoll(poll: Poll) {
    if (!confirm(this.i18n.t('polls.closeConfirm', { title: poll.title }))) return;
    this.closingPollId = poll.id;
    this.api.closePoll(poll.id).subscribe({
      next: () => {
        this.closingPollId = '';
        this.toast.success(this.i18n.t('polls.pollClosed'));
        this.loadPolls();
      },
      error: (err) => {
        this.toast.error(err.error?.error || this.i18n.t('polls.closeFailed'));
        this.closingPollId = '';
      },
    });
  }

  openCreateModal() {
    this.newPoll = { title: '', description: '', options: ['', ''], closesAt: '' };
    this.showCreateModal = true;
  }

  closeCreateModal() {
    this.showCreateModal = false;
  }

  addOption() {
    this.newPoll.options.push('');
  }

  removeOption(i: number) {
    if (this.newPoll.options.length > 2) {
      this.newPoll.options.splice(i, 1);
    }
  }

  isPollValid(): boolean {
    const validOptions = this.newPoll.options.filter(o => o.trim()).length;
    return !!(this.newPoll.title.trim() && validOptions >= 2);
  }

  createPoll() {
    if (!this.isPollValid()) {
      this.toast.warning(this.i18n.t('polls.validationFailed'));
      return;
    }
    this.creating = true;
    const payload: any = {
      title: this.newPoll.title.trim(),
      description: this.newPoll.description.trim() || undefined,
      options: this.newPoll.options.map(o => o.trim()).filter(o => o),
    };
    if (this.newPoll.closesAt) payload.closesAt = new Date(this.newPoll.closesAt).toISOString();

    this.api.createPoll(payload).subscribe({
      next: (res: any) => {
        this.creating = false;
        if (res.success) {
          this.toast.success(this.i18n.t('polls.pollCreated'));
          this.closeCreateModal();
          this.loadPolls();
        }
      },
      error: (err) => {
        this.toast.error(err.error?.error || this.i18n.t('polls.createFailed'));
        this.creating = false;
      },
    });
  }
}
