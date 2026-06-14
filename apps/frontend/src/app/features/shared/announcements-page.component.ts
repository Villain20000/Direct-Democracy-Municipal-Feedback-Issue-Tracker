import { Component, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { LayoutComponent, NavItem } from '../../shared/layout.component';
import { AuthService } from '../../core/services/auth.service';
import { ApiService } from '../../core/services/api.service';
import { Announcement } from '@dd/shared-types';

@Component({
  selector: 'app-announcements-page',
  standalone: true,
  imports: [CommonModule, LayoutComponent, DatePipe],
  template: `
    <app-layout pageTitle="Announcements" [navItems]="navItems" (logout)="auth.logout()">
      @if (error) {
        <div class="card" style="margin-bottom:24px;border-color:var(--danger);">
          <div class="card-body" style="color:var(--danger);">{{ error }}</div>
        </div>
      }

      @if (loading) {
        <div class="card"><div class="card-body" style="text-align:center;padding:48px;color:var(--text-muted);">Loading announcements...</div></div>
      } @else {
        <div class="card">
          <div class="card-header"><h3>📢 Municipal Announcements</h3></div>
          <div class="card-body">
            @for (item of announcements; track item.id) {
              <div style="padding:16px;border:1px solid var(--border);border-radius:var(--radius);margin-bottom:12px;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                  <strong>{{ item.title }}</strong>
                  @if (item.isPinned) { <span class="badge badge-amber">Pinned</span> }
                </div>
                <p style="font-size:13px;color:var(--text-secondary);margin-bottom:8px;white-space:pre-wrap;">{{ item.content }}</p>
                <div style="font-size:11px;color:var(--text-muted);">
                  {{ item.publishedAt || item.createdAt | date:'medium' }}
                  @if (item.author) { · {{ item.author.firstName }} {{ item.author.lastName }} }
                </div>
              </div>
            } @empty {
              <div style="text-align:center;padding:48px;color:var(--text-muted);">No announcements available.</div>
            }
          </div>
        </div>
      }
    </app-layout>
  `,
})
export class AnnouncementsPageComponent implements OnInit {
  announcements: Announcement[] = [];
  loading = true;
  error = '';
  navItems: NavItem[] = [];

  constructor(public auth: AuthService, private api: ApiService) {
    this.navItems = [{ icon: 'dashboard', label: 'Dashboard', route: auth.getDashboardRoute() }];
  }

  ngOnInit() { this.loadAnnouncements(); }

  loadAnnouncements() {
    this.loading = true;
    this.error = '';
    this.api.getAnnouncements().subscribe({
      next: (res: any) => {
        this.announcements = res.data || [];
        this.loading = false;
      },
      error: (err) => {
        this.error = err.error?.error || 'Failed to load announcements.';
        this.loading = false;
      },
    });
  }
}