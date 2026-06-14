import { Component, OnInit, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { LayoutComponent, NavItem } from '../../shared/layout.component';
import { AuthService } from '../../core/services/auth.service';
import { ApiService } from '../../core/services/api.service';
import { TranslationService } from '../../core/i18n/translation.service';
import { Resolution } from '@dd/shared-types';

@Component({
  selector: 'app-resolutions-page',
  standalone: true,
  imports: [CommonModule, LayoutComponent, DatePipe],
  template: `
    <app-layout [pageTitle]="i18n.t('resolutions.pageTitle')" [navItems]="navItems" (logout)="auth.logout()">
      @if (error) {
        <div class="card" style="margin-bottom:24px;border-color:var(--danger);">
          <div class="card-body" style="color:var(--danger);">{{ error }}</div>
        </div>
      }

      @if (loading) {
        <div class="card"><div class="card-body" style="text-align:center;padding:48px;color:var(--text-muted);">{{ i18n.t('resolutions.loading') }}</div></div>
      } @else {
        <div class="card">
          <div class="card-header"><h3>{{ i18n.t('resolutions.header') }}</h3></div>
          <div class="card-body">
            @for (res of resolutions; track res.id) {
              <div style="padding:16px;border:1px solid var(--border);border-radius:var(--radius);margin-bottom:12px;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                  <strong>{{ res.title }}</strong>
                  <span class="badge" [class]="res.status === 'VOTING' ? 'badge-amber' : 'badge-green'">{{ i18n.tResolutionStatus(res.status) }}</span>
                </div>
                <p style="font-size:13px;color:var(--text-secondary);margin-bottom:12px;">{{ res.description }}</p>
                <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;">
                  <button class="btn btn-success btn-sm" [disabled]="votingId === res.id || hasVoted(res)" (click)="vote(res, true)">
                    {{ i18n.t('resolutions.for', { n: res.votesFor }) }}
                  </button>
                  <button class="btn btn-danger btn-sm" [disabled]="votingId === res.id || hasVoted(res)" (click)="vote(res, false)">
                    {{ i18n.t('resolutions.against', { n: res.votesAgainst }) }}
                  </button>
                  <span style="font-size:12px;color:var(--text-muted);">{{ i18n.t('resolutions.created', { date: res.createdAt | date:'mediumDate' }) }}</span>
                </div>
              </div>
            } @empty {
              <div style="text-align:center;padding:48px;color:var(--text-muted);">{{ i18n.t('resolutions.noResolutions') }}</div>
            }
          </div>
        </div>
      }
    </app-layout>
  `,
})
export class ResolutionsPageComponent implements OnInit {
  resolutions: Resolution[] = [];
  loading = true;
  error = '';
  votingId = '';
  navItems: NavItem[] = [];

  i18n = inject(TranslationService);

  constructor(public auth: AuthService, private api: ApiService) {
    this.navItems = [{ icon: 'dashboard', label: 'nav.dashboard', route: auth.getDashboardRoute() }];
  }

  ngOnInit() { this.loadResolutions(); }

  loadResolutions() {
    this.loading = true;
    this.error = '';
    this.api.getResolutions().subscribe({
      next: (res: any) => {
        if (res.success) this.resolutions = res.data || [];
        this.loading = false;
      },
      error: (err) => {
        this.error = err.error?.error || this.i18n.t('resolutions.loadFailed');
        this.loading = false;
      },
    });
  }

  hasVoted(resolution: Resolution): boolean {
    const userId = this.auth.user()?.id;
    return !!userId && resolution.votedByIds?.includes(userId);
  }

  vote(resolution: Resolution, voteFor: boolean) {
    this.votingId = resolution.id;
    this.api.voteResolution(resolution.id, voteFor).subscribe({
      next: (res: any) => {
        if (res.success) this.loadResolutions();
        this.votingId = '';
      },
      error: (err) => {
        this.error = err.error?.error || this.i18n.t('resolutions.voteFailed');
        this.votingId = '';
      },
    });
  }
}
