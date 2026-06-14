import { Component, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { LayoutComponent, NavItem } from '../../shared/layout.component';
import { AuthService } from '../../core/services/auth.service';
import { ApiService } from '../../core/services/api.service';
import { Event } from '@dd/shared-types';

@Component({
  selector: 'app-events-page',
  standalone: true,
  imports: [CommonModule, LayoutComponent, DatePipe],
  template: `
    <app-layout pageTitle="Upcoming Events" [navItems]="navItems" (logout)="auth.logout()">
      @if (error) {
        <div class="card" style="margin-bottom:24px;border-color:var(--danger);">
          <div class="card-body" style="color:var(--danger);">{{ error }}</div>
        </div>
      }

      @if (loading) {
        <div class="card"><div class="card-body" style="text-align:center;padding:48px;color:var(--text-muted);">Loading events...</div></div>
      } @else {
        <div class="card">
          <div class="card-header"><h3>📅 Upcoming Events</h3></div>
          <div class="card-body" style="padding:0;">
            <table class="data-table">
              <thead>
                <tr><th>Event</th><th>Date</th><th>Location</th><th>Type</th><th>Actions</th></tr>
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
                    <td style="font-size:12px;">{{ event.location || 'TBD' }}</td>
                    <td><span class="badge badge-blue">{{ event.type }}</span></td>
                    <td>
                      <button class="btn btn-primary btn-sm" [disabled]="rsvpingId === event.id || rsvpedIds.has(event.id)" (click)="rsvp(event)">
                        {{ rsvpedIds.has(event.id) ? 'RSVP Sent' : (rsvpingId === event.id ? 'RSVPing...' : 'RSVP Going') }}
                      </button>
                    </td>
                  </tr>
                } @empty {
                  <tr><td colspan="5" style="text-align:center;padding:48px;color:var(--text-muted);">No upcoming events scheduled.</td></tr>
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

  constructor(public auth: AuthService, private api: ApiService) {
    this.navItems = [{ icon: 'dashboard', label: 'Dashboard', route: auth.getDashboardRoute() }];
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
        this.error = err.error?.error || 'Failed to load events.';
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
        this.error = err.error?.error || 'Failed to RSVP.';
        this.rsvpingId = '';
      },
    });
  }
}