import { Component, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { LayoutComponent, NavItem } from '../../shared/layout.component';
import { AuthService } from '../../core/services/auth.service';
import { User } from '@dd/shared-types';

@Component({
  selector: 'app-settings-page',
  standalone: true,
  imports: [CommonModule, LayoutComponent, DatePipe],
  template: `
    <app-layout pageTitle="Settings" [navItems]="navItems" (logout)="auth.logout()">
      @if (error) {
        <div class="card" style="margin-bottom:24px;border-color:var(--danger);">
          <div class="card-body" style="color:var(--danger);">{{ error }}</div>
        </div>
      }

      @if (loading) {
        <div class="card"><div class="card-body" style="text-align:center;padding:48px;color:var(--text-muted);">Loading profile...</div></div>
      } @else if (profile) {
        <div class="card" style="max-width:640px;">
          <div class="card-header"><h3>⚙️ Profile Settings</h3></div>
          <div class="card-body">
            <div style="display:flex;align-items:center;gap:16px;margin-bottom:24px;">
              <div class="user-avatar" style="width:64px;height:64px;font-size:24px;">{{ profile.firstName[0] }}{{ profile.lastName[0] }}</div>
              <div>
                <div style="font-size:18px;font-weight:700;">{{ profile.firstName }} {{ profile.lastName }}</div>
                <div style="font-size:13px;color:var(--text-muted);">{{ profile.role.replace('_', ' ') }}</div>
              </div>
            </div>

            <table class="data-table">
              <tbody>
                <tr><td style="font-weight:600;width:140px;">Email</td><td>{{ profile.email }}</td></tr>
                <tr><td style="font-weight:600;">Phone</td><td>{{ profile.phone || '-' }}</td></tr>
                <tr><td style="font-weight:600;">Status</td><td>
                  <span class="status-badge" [class]="profile.isActive ? 'resolved' : 'rejected'">
                    {{ profile.isActive ? 'Active' : 'Inactive' }}
                  </span>
                </td></tr>
                <tr><td style="font-weight:600;">Verified</td><td>{{ profile.isVerified ? 'Yes' : 'No' }}</td></tr>
                <tr><td style="font-weight:600;">Member Since</td><td>{{ profile.createdAt | date:'mediumDate' }}</td></tr>
                @if (profile.lastLoginAt) {
                  <tr><td style="font-weight:600;">Last Login</td><td>{{ profile.lastLoginAt | date:'medium' }}</td></tr>
                }
              </tbody>
            </table>

            <div style="margin-top:24px;padding-top:24px;border-top:1px solid var(--border);">
              <button class="btn btn-danger" (click)="auth.logout()">
                <i class="material-icons-outlined" style="font-size:18px;">logout</i> Log Out
              </button>
            </div>
          </div>
        </div>
      }
    </app-layout>
  `,
})
export class SettingsPageComponent implements OnInit {
  profile: User | null = null;
  loading = true;
  error = '';
  navItems: NavItem[] = [];

  constructor(public auth: AuthService) {
    this.navItems = [{ icon: 'dashboard', label: 'Dashboard', route: auth.getDashboardRoute() }];
  }

  ngOnInit() { this.loadProfile(); }

  loadProfile() {
    this.loading = true;
    this.error = '';
    this.auth.getProfile().subscribe({
      next: (res) => {
        if (res.success) this.profile = res.data;
        this.loading = false;
      },
      error: (err) => {
        this.error = err.error?.error || 'Failed to load profile.';
        this.profile = this.auth.user();
        this.loading = false;
      },
    });
  }
}