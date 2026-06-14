import { Component, OnInit, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { LayoutComponent, NavItem } from '../../shared/layout.component';
import { AuthService } from '../../core/services/auth.service';
import { ApiService } from '../../core/services/api.service';
import { TranslationService } from '../../core/i18n/translation.service';
import { Event } from '@dd/shared-types';

@Component({
  selector: 'app-events-page',
  standalone: true,
  imports: [CommonModule, LayoutComponent, DatePipe],
  template: `
    <app-layout [pageTitle]="i18n.t('events.pageTitle')" [navItems]="navItems" (logout)="auth.logout()">
      @if (error) {
        <div class="card" style="margin-bottom:24px;border-color:var(--danger);">
          <div class="card-body" style="color:var(--danger);">{{ error }}</div>
        </div>
      }

      @if (loading) {
        <div class="card"><div class="card-body" style="text-align:center;padding:48px;color:var(--text-muted);">{{ i18n.t('events.loading') }}</div></div>
      } @else {
        <div class="card">
          <div class="card-header"><h3>{{ i18n.t('events.header') }}</h3></div>
          <div class="card-body" style="padding:0;">
            <table class="data-table">
              <thead>
                <tr><th>{{ i18n.t('events.colEvent') }}</th><th>{{ i18n.t('events.colDate') }}</th><th>{{ i18n.t('events.colLocation') }}</th><th>{{ i18n.t('events.colType') }}</th><th>{{ i18n.t('events.colActions') }}</th></tr>
              </thead>
              <tbody>
                @for (event of events; track event.id) {
                  <tr>
                    <td>
                      <strong>{{ event.title }}</strong>
                      @if (event.description) {
                        <br><span style="font-size:11px;color:var(--text-muted);">{{ event.description }}</span>
                      }
                    </td>
                    <td style="color:var(--text-muted);font-size:12px;">
                      {{ event.startTime | date:'mediumDate' }}<br>
                      {{ event.startTime | date:'shortTime' }} – {{ event.endTime | date:'shortTime' }}
                    </td>
                    <td style="font-size:12px;">{{ event.location || i18n.t('events.tbd') }}</td>
                    <td><span class="badge badge-blue">{{ i18n.tEventType(event.type) }}</span></td>
                    <td>
                      <button class="btn btn-primary btn-sm" [disabled]="rsvpingId === event.id || rsvpedIds.has(event.id)" (click)="rsvp(event)">
                        {{ rsvpedIds.has(event.id) ? i18n.t('events.rsvpSent') : (rsvpingId === event.id ? i18n.t('events.rsvping') : i18n.t('events.rsvpGoing')) }}
                      </button>
                    </td>
                  </tr>
                } @empty {
                  <tr><td colspan="5" style="text-align:center;padding:48px;color:var(--text-muted);">{{ i18n.t('events.noEvents') }}</td></tr>
                }
              </tbody>
            </table>
          </div>
        </div>
      }
    </app-layout>
  `,
})
export class EventsPageComponent implements OnInit {
  events: Event[] = [];
  loading = true;
  error = '';
  rsvpingId = '';
  rsvpedIds = new Set<string>();
  navItems: NavItem[] = [];

  i18n = inject(TranslationService);

  constructor(public auth: AuthService, private api: ApiService) {
    this.navItems = [{ icon: 'dashboard', label: 'nav.dashboard', route: auth.getDashboardRoute() }];
  }

  ngOnInit() { this.loadEvents(); }

  loadEvents() {
    this.loading = true;
    this.error = '';
    this.api.getEvents({ upcoming: 'true' }).subscribe({
      next: (res: any) => {
        this.events = res.data || [];
        this.loading = false;
      },
      error: (err) => {
        this.error = err.error?.error || this.i18n.t('events.loadFailed');
        this.loading = false;
      },
    });
  }

  rsvp(event: Event) {
    this.rsvpingId = event.id;
    this.api.rsvpEvent(event.id, 'GOING').subscribe({
      next: (res: any) => {
        if (res.success) this.rsvpedIds.add(event.id);
        this.rsvpingId = '';
      },
      error: (err) => {
        this.error = err.error?.error || this.i18n.t('events.rsvpFailed');
        this.rsvpingId = '';
      },
    });
  }
}
