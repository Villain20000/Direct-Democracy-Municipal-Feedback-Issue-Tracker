/**
 * Phase D1 — Referendums page (citizen + admin view).
 *
 * Distinct from the council-internal Resolutions page: this one is a
 * public ballot tracker. The same component serves citizens (read + cast
 * vote) and admins (create / open / close / tally).
 *
 *   Public  : list active + closed referendums, view detail + tallies
 *   Citizen : cast YES / NO / ABSTAIN (one-shot, no changes)
 *   Admin   : create draft, open, close, delete-empty
 */
import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { LayoutComponent } from '../../shared/layout.component';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { TranslationService } from '../../core/i18n/translation.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';

interface Referendum {
  id: string;
  title: string;
  description: string;
  body: string;
  status: 'DRAFT' | 'OPEN' | 'CLOSED' | 'PASSED' | 'REJECTED' | 'CANCELLED';
  createdById: string;
  createdBy?: { id: string; firstName: string; lastName: string };
  opensAt: string;
  closesAt: string;
  passThreshold: number;
  minParticipation: number;
  eligibleRoles: string[];
  yesCount: number;
  noCount: number;
  abstainCount: number;
  totalVotes: number;
  decidedAt?: string;
  createdAt: string;
}

@Component({
  selector: 'app-referendums-page',
  standalone: true,
  imports: [CommonModule, FormsModule, LayoutComponent, TranslatePipe, RouterLink],
  template: `
    <app-layout [pageTitle]="'referendums.title' | t">
      <div class="page-content" style="max-width:1100px;margin:0 auto;padding:24px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;flex-wrap:wrap;gap:12px;">
          <div>
            <h2 style="margin:0;font-size:22px;">{{ 'referendums.title' | t }}</h2>
            <p style="margin:4px 0 0;color:var(--text-muted);font-size:13px;">
              {{ 'referendums.subtitle' | t }}
            </p>
          </div>
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
            <select [(ngModel)]="statusFilter" (change)="loadReferendums()" style="padding:8px 12px;border:1px solid var(--border);border-radius:var(--radius);">
              <option value="">{{ 'referendums.allStatuses' | t }}</option>
              <option value="DRAFT">DRAFT</option>
              <option value="OPEN">OPEN</option>
              <option value="CLOSED">CLOSED</option>
              <option value="PASSED">PASSED</option>
              <option value="REJECTED">REJECTED</option>
              <option value="CANCELLED">CANCELLED</option>
            </select>
            @if (canCreate()) {
              <button class="btn btn-primary" (click)="toggleCreateForm()">
                <i class="material-icons-outlined" style="font-size:18px;vertical-align:middle;">add</i>
                {{ 'referendums.new' | t }}
              </button>
            }
          </div>
        </div>

        @if (showCreateForm()) {
          <div class="card" style="margin-bottom:24px;padding:20px;">
            <h3 style="margin-top:0;">{{ 'referendums.create' | t }}</h3>
            <div style="display:grid;gap:12px;">
              <input class="form-input" [(ngModel)]="newRef.title" [placeholder]="'referendums.titlePlaceholder' | t" />
              <input class="form-input" [(ngModel)]="newRef.description" [placeholder]="'referendums.descriptionPlaceholder' | t" />
              <textarea class="form-input" rows="4" [(ngModel)]="newRef.body" [placeholder]="'referendums.bodyPlaceholder' | t"></textarea>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
                <label style="font-size:12px;color:var(--text-muted);">
                  {{ 'referendums.opensAt' | t }}
                  <input type="datetime-local" class="form-input" [(ngModel)]="newRef.opensAt" />
                </label>
                <label style="font-size:12px;color:var(--text-muted);">
                  {{ 'referendums.closesAt' | t }}
                  <input type="datetime-local" class="form-input" [(ngModel)]="newRef.closesAt" />
                </label>
              </div>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
                <label style="font-size:12px;color:var(--text-muted);">
                  {{ 'referendums.passThreshold' | t }} (0.01 - 1.0)
                  <input type="number" min="0.01" max="1" step="0.01" class="form-input" [(ngModel)]="newRef.passThreshold" />
                </label>
                <label style="font-size:12px;color:var(--text-muted);">
                  {{ 'referendums.minParticipation' | t }}
                  <input type="number" min="0" step="1" class="form-input" [(ngModel)]="newRef.minParticipation" />
                </label>
              </div>
              <div style="display:flex;gap:8px;justify-content:flex-end;">
                <button class="btn btn-secondary" (click)="toggleCreateForm()">{{ 'common.cancel' | t }}</button>
                <button class="btn btn-primary" (click)="createReferendum()" [disabled]="creating()">
                  {{ (creating() ? 'common.creating' : 'referendums.createDraft') | t }}
                </button>
              </div>
            </div>
          </div>
        }

        @if (loading()) {
          <p style="color:var(--text-muted);">{{ 'common.loading' | t }}</p>
        } @else if (referendums().length === 0) {
          <div class="card" style="padding:48px;text-align:center;color:var(--text-muted);">
            {{ 'referendums.empty' | t }}
          </div>
        } @else {
          <div style="display:grid;gap:16px;">
            @for (ref of referendums(); track ref.id) {
              <div class="card" style="padding:18px;">
                <div style="display:flex;justify-content:space-between;align-items:start;gap:12px;flex-wrap:wrap;">
                  <div style="flex:1;min-width:200px;">
                    <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:6px;">
                      <span [class]="statusBadgeClass(ref.status)">{{ ref.status }}</span>
                      <span style="color:var(--text-muted);font-size:12px;">
                        {{ 'referendums.window' | t:{ opens: formatDate(ref.opensAt), closes: formatDate(ref.closesAt) } }}
                      </span>
                    </div>
                    <h3 style="margin:0 0 4px;font-size:16px;">{{ ref.title }}</h3>
                    <p style="margin:0 0 12px;color:var(--text-muted);font-size:13px;">{{ ref.description }}</p>
                    @if (ballotExplanations()[ref.id]) {
                      <div style="padding:10px;background:var(--bg-primary);border-radius:var(--radius);font-size:13px;margin-bottom:12px;border-left:3px solid var(--primary);">
                        {{ ballotExplanations()[ref.id] }}
                      </div>
                    }
                    <button type="button" class="btn btn-secondary btn-sm" style="margin-bottom:12px;" (click)="explainReferendum(ref)" [disabled]="explainingId() === ref.id">
                      {{ explainingId() === ref.id ? ('referendums.explaining' | t) : ('referendums.explainSimple' | t) }}
                    </button>
                    <div style="display:flex;gap:16px;flex-wrap:wrap;font-size:13px;">
                      <span><strong style="color:#16a34a;">{{ ref.yesCount }}</strong> {{ 'referendums.yes' | t }}</span>
                      <span><strong style="color:#dc2626;">{{ ref.noCount }}</strong> {{ 'referendums.no' | t }}</span>
                      <span><strong style="color:var(--text-muted);">{{ ref.abstainCount }}</strong> {{ 'referendums.abstain' | t }}</span>
                      <span style="color:var(--text-muted);">· {{ ref.totalVotes }} {{ 'referendums.totalVotes' | t }}</span>
                      <span style="color:var(--text-muted);">· {{ (ref.passThreshold * 100).toFixed(0) }}% {{ 'referendums.threshold' | t }}</span>
                      @if (ref.minParticipation > 0) {
                        <span style="color:var(--text-muted);">· {{ ref.minParticipation }} {{ 'referendums.quorum' | t }}</span>
                      }
                    </div>
                  </div>
                  <div style="display:flex;flex-direction:column;gap:6px;align-items:flex-end;min-width:180px;">
                    @if (ref.status === 'OPEN' && isAuthenticated()) {
                      @if (myVote()[ref.id]) {
                        <span style="padding:6px 12px;background:#f1f5f9;border-radius:var(--radius);font-size:12px;">
                          {{ 'referendums.youVoted' | t:{ choice: myVote()[ref.id].choice } }}
                        </span>
                      } @else {
                        <div style="display:flex;gap:6px;">
                          <button class="btn btn-sm" style="background:#16a34a;color:white;" (click)="vote(ref, 'YES')">{{ 'referendums.yes' | t }}</button>
                          <button class="btn btn-sm" style="background:#dc2626;color:white;" (click)="vote(ref, 'NO')">{{ 'referendums.no' | t }}</button>
                          <button class="btn btn-sm btn-secondary" (click)="vote(ref, 'ABSTAIN')">{{ 'referendums.abstain' | t }}</button>
                        </div>
                      }
                    }
                    @if (canManage()) {
                      <div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end;">
                        @if (ref.status === 'DRAFT') {
                          <button class="btn btn-sm btn-secondary" (click)="changeStatus(ref, 'OPEN')">{{ 'referendums.open' | t }}</button>
                          <button class="btn btn-sm btn-secondary" (click)="changeStatus(ref, 'CANCELLED')">{{ 'referendums.cancel' | t }}</button>
                        }
                        @if (ref.status === 'OPEN') {
                          <button class="btn btn-sm btn-primary" (click)="closeReferendum(ref)">{{ 'referendums.closeAndTally' | t }}</button>
                        }
                      </div>
                    }
                  </div>
                </div>
              </div>
            }
          </div>
        }
      </div>
    </app-layout>
  `,
})
export class ReferendumsPageComponent implements OnInit {
  private http = inject(HttpClient);
  private api = inject(ApiService);
  private auth = inject(AuthService);
  private i18n = inject(TranslationService);
  private router = inject(Router);

  referendums = signal<Referendum[]>([]);
  loading = signal(true);
  showCreateForm = signal(false);
  creating = signal(false);
  statusFilter = '';
  myVote = signal<Record<string, { choice: string } | null>>({});
  ballotExplanations = signal<Record<string, string>>({});
  explainingId = signal('');

  newRef = {
    title: '',
    description: '',
    body: '',
    opensAt: this.toLocalDateTimeInput(new Date(Date.now() + 24 * 60 * 60 * 1000)),
    closesAt: this.toLocalDateTimeInput(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)),
    passThreshold: 0.5,
    minParticipation: 0,
  };

  ngOnInit() {
    this.loadReferendums();
  }

  isAuthenticated(): boolean {
    return this.auth.isAuthenticated();
  }

  canCreate(): boolean {
    const role = this.auth.userRole();
    return role === 'SUPER_ADMIN' || role === 'MAYOR' || role === 'COUNCIL_MEMBER';
  }

  canManage(): boolean {
    const role = this.auth.userRole();
    return role === 'SUPER_ADMIN' || role === 'MAYOR';
  }

  toggleCreateForm() {
    this.showCreateForm.set(!this.showCreateForm());
  }

  explainReferendum(ref: Referendum) {
    this.explainingId.set(ref.id);
    this.api.aiExplainBallot({
      title: ref.title,
      description: ref.description,
      body: ref.body,
      type: 'referendum',
      locale: this.i18n.currentLanguage().code,
    }).subscribe({
      next: (res) => {
        this.ballotExplanations.update((m) => ({ ...m, [ref.id]: res.data?.explanation || '' }));
        this.explainingId.set('');
      },
      error: () => this.explainingId.set(''),
    });
  }

  async loadReferendums() {
    this.loading.set(true);
    try {
      const params: Record<string, string> = {};
      if (this.statusFilter) params['status'] = this.statusFilter;
      const res = await firstValueFrom(this.api.getReferendums(params));
      this.referendums.set(res.data || []);
      if (this.isAuthenticated()) {
        // Pre-load my votes so the "you voted X" badge renders correctly
        const map: Record<string, { choice: string } | null> = {};
        for (const ref of this.referendums()) {
          try {
            const mine = await firstValueFrom(this.api.getMyReferendumVote(ref.id));
            map[ref.id] = mine.data;
          } catch {
            map[ref.id] = null;
          }
        }
        this.myVote.set(map);
      }
    } catch (err) {
      console.error('[referendums] load failed', err);
    } finally {
      this.loading.set(false);
    }
  }

  async createReferendum() {
    if (!this.newRef.title || !this.newRef.body) return;
    this.creating.set(true);
    try {
      await firstValueFrom(
        this.api.createReferendum({
          ...this.newRef,
          opensAt: new Date(this.newRef.opensAt).toISOString(),
          closesAt: new Date(this.newRef.closesAt).toISOString(),
        }),
      );
      this.showCreateForm.set(false);
      this.loadReferendums();
    } catch (err: any) {
      console.error('[referendums] create failed', err);
      alert(err?.error?.error || 'Create failed');
    } finally {
      this.creating.set(false);
    }
  }

  async vote(ref: Referendum, choice: 'YES' | 'NO' | 'ABSTAIN') {
    try {
      await firstValueFrom(this.api.voteReferendum(ref.id, choice));
      this.loadReferendums();
    } catch (err: any) {
      alert(err?.error?.error || 'Vote failed');
    }
  }

  async changeStatus(ref: Referendum, status: string) {
    try {
      await firstValueFrom(this.api.updateReferendumStatus(ref.id, status));
      this.loadReferendums();
    } catch (err: any) {
      alert(err?.error?.error || 'Status change failed');
    }
  }

  async closeReferendum(ref: Referendum) {
    if (!confirm(`Close "${ref.title}" and tally? This cannot be undone.`)) return;
    try {
      await firstValueFrom(this.api.closeReferendum(ref.id));
      this.loadReferendums();
    } catch (err: any) {
      alert(err?.error?.error || 'Close failed');
    }
  }

  statusBadgeClass(status: string): string {
    const base = 'status-badge';
    switch (status) {
      case 'OPEN': return `${base} status-open`;
      case 'DRAFT': return `${base} status-draft`;
      case 'PASSED': return `${base} status-passed`;
      case 'REJECTED': return `${base} status-rejected`;
      case 'CLOSED': return `${base} status-closed`;
      case 'CANCELLED': return `${base} status-cancelled`;
      default: return base;
    }
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString();
  }

  private toLocalDateTimeInput(d: Date): string {
    // <input type="datetime-local"> wants "YYYY-MM-DDTHH:mm" in *local* time.
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
}
