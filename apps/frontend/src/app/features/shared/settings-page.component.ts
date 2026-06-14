import { Component, OnInit, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LayoutComponent, NavItem } from '../../shared/layout.component';
import { AuthService } from '../../core/services/auth.service';
import { ApiService } from '../../core/services/api.service';
import { ToastService } from '../../core/services/toast.service';
import { TranslationService } from '../../core/i18n/translation.service';
import { User } from '@dd/shared-types';

@Component({
  selector: 'app-settings-page',
  standalone: true,
  imports: [CommonModule, FormsModule, LayoutComponent, DatePipe],
  template: `
    <app-layout [pageTitle]="i18n.t('settings.pageTitle')" [navItems]="navItems" (logout)="auth.logout()">
      @if (error) {
        <div class="card" style="margin-bottom:24px;border-color:var(--danger);">
          <div class="card-body" style="color:var(--danger);">{{ error }}</div>
        </div>
      }

      @if (loading) {
        <div class="card"><div class="card-body" style="text-align:center;padding:48px;color:var(--text-muted);">{{ i18n.t('settings.loading') }}</div></div>
      } @else if (profile) {
        <div class="content-grid">
          <div class="card">
            <div class="card-header" style="display:flex;justify-content:space-between;align-items:center;">
              <h3>{{ i18n.t('settings.header') }}</h3>
              <button class="btn btn-secondary btn-sm" (click)="loadProfile()"><i class="material-icons-outlined" style="font-size:16px;">refresh</i> {{ i18n.t('settings.refresh') }}</button>
            </div>
            <div class="card-body">
              <div style="display:flex;align-items:center;gap:16px;margin-bottom:24px;">
                <div class="user-avatar" style="width:64px;height:64px;font-size:24px;">{{ profile.firstName[0] }}{{ profile.lastName[0] }}</div>
                <div>
                  <div style="font-size:18px;font-weight:700;">{{ profile.firstName }} {{ profile.lastName }}</div>
                  <div style="font-size:13px;color:var(--text-muted);">{{ i18n.tRole(profile.role) }}</div>
                </div>
              </div>

              <table class="data-table">
                <tbody>
                  <tr><td style="font-weight:600;width:140px;">{{ i18n.t('settings.colEmail') }}</td><td>{{ profile.email }}</td></tr>
                  <tr><td style="font-weight:600;">{{ i18n.t('settings.colPhone') }}</td><td>{{ profile.phone || '-' }}</td></tr>
                  <tr><td style="font-weight:600;">{{ i18n.t('settings.colStatus') }}</td><td>
                    <span class="status-badge" [class]="profile.isActive ? 'resolved' : 'rejected'">
                      {{ i18n.tUserStatus(profile.isActive) }}
                    </span>
                  </td></tr>
                  <tr><td style="font-weight:600;">{{ i18n.t('settings.colVerified') }}</td><td>{{ profile.isVerified ? i18n.t('settings.yes') : i18n.t('settings.no') }}</td></tr>
                  <tr><td style="font-weight:600;">{{ i18n.t('settings.colMemberSince') }}</td><td>{{ profile.createdAt | date:'mediumDate' }}</td></tr>
                  @if (profile.lastLoginAt) {
                    <tr><td style="font-weight:600;">{{ i18n.t('settings.colLastLogin') }}</td><td>{{ profile.lastLoginAt | date:'medium' }}</td></tr>
                  }
                </tbody>
              </table>
            </div>
          </div>

          <div class="card">
            <div class="card-header"><h3>{{ i18n.t('settings.passwordHeader') }}</h3></div>
            <div class="card-body">
              <form (ngSubmit)="changePassword()" #pwForm="ngForm">
                <div class="form-group">
                  <label>{{ i18n.t('settings.currentPw') }}</label>
                  <input type="password" [(ngModel)]="passwords.current" name="current" required />
                </div>
                <div class="form-group">
                  <label>{{ i18n.t('settings.newPw') }}</label>
                  <input type="password" [(ngModel)]="passwords.new" name="new" required minlength="8" />
                </div>
                <div class="form-group">
                  <label>{{ i18n.t('settings.confirmNewPw') }}</label>
                  <input type="password" [(ngModel)]="passwords.confirm" name="confirm" required />
                </div>
                <button type="submit" class="btn btn-primary" [disabled]="changing || !isPasswordValid()">
                  @if (changing) { {{ i18n.t('settings.changing') }} } @else { {{ i18n.t('settings.updatePassword') }} }
                </button>
              </form>
            </div>
          </div>
        </div>

        <div class="card" style="margin-top:24px;border-color:var(--danger);">
          <div class="card-header"><h3 style="color:var(--danger);">{{ i18n.t('settings.dangerZone') }}</h3></div>
          <div class="card-body" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;">
            <div>
              <div style="font-size:13px;font-weight:600;">{{ i18n.t('settings.signOutTitle') }}</div>
              <div style="font-size:12px;color:var(--text-muted);">{{ i18n.t('settings.signOutBody') }}</div>
            </div>
            <button class="btn btn-danger" (click)="auth.logout()">
              <i class="material-icons-outlined" style="font-size:18px;">logout</i> {{ i18n.t('settings.signOutBtn') }}
            </button>
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
  changing = false;
  passwords = { current: '', new: '', confirm: '' };
  navItems: NavItem[] = [];

  auth = inject(AuthService);
  api = inject(ApiService);
  toast = inject(ToastService);
  i18n = inject(TranslationService);

  constructor() {
    this.navItems = [{ icon: 'dashboard', label: 'nav.dashboard', route: this.auth.getDashboardRoute() }];
  }

  ngOnInit() { this.loadProfile(); }

  isPasswordValid(): boolean {
    return this.passwords.current.length > 0
      && this.passwords.new.length >= 8
      && this.passwords.new === this.passwords.confirm;
  }

  changePassword() {
    if (!this.isPasswordValid()) {
      if (this.passwords.new !== this.passwords.confirm) {
        this.toast.error(this.i18n.t('settings.pwMismatch'));
      } else {
        this.toast.warning(this.i18n.t('settings.pwFieldsRequired'));
      }
      return;
    }
    this.changing = true;
    this.api.changePassword(this.passwords.current, this.passwords.new).subscribe({
      next: (res: any) => {
        this.changing = false;
        this.toast.success(res?.message || this.i18n.t('settings.pwChanged'));
        this.passwords = { current: '', new: '', confirm: '' };
      },
      error: (err) => {
        this.changing = false;
        this.toast.error(err.error?.error || this.i18n.t('settings.pwChangeFailed'));
      },
    });
  }

  loadProfile() {
    this.loading = true;
    this.error = '';
    this.auth.getProfile().subscribe({
      next: (res) => {
        if (res.success) this.profile = res.data;
        this.loading = false;
      },
      error: (err) => {
        this.error = err.error?.error || this.i18n.t('settings.loadFailed');
        this.profile = this.auth.user();
        this.loading = false;
      },
    });
  }
}
