import { Component, OnInit, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LayoutComponent, NavItem } from '../../shared/layout.component';
import { AuthService } from '../../core/services/auth.service';
import { ApiService } from '../../core/services/api.service';
import { ToastService } from '../../core/services/toast.service';
import { TranslationService } from '../../core/i18n/translation.service';
import { getFieldErrors, groupFieldErrorsByField, toApiError } from '../../core/errors/api-error';
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
                  <input type="password" [(ngModel)]="passwords.current" (ngModelChange)="clearFieldError('currentPassword')" name="current" required [class.input-error]="!!getFieldError('currentPassword')" />
                  @if (getFieldError('currentPassword')) { <div class="field-error">⚠ {{ getFieldError('currentPassword') }}</div> }
                </div>
                <div class="form-group">
                  <label>{{ i18n.t('settings.newPw') }}</label>
                  <input type="password" [(ngModel)]="passwords.new" (ngModelChange)="clearFieldError('newPassword')" name="new" required minlength="8" [class.input-error]="!!getFieldError('newPassword')" />
                  @if (getFieldError('newPassword')) { <div class="field-error">⚠ {{ getFieldError('newPassword') }}</div> }
                </div>
                <div class="form-group">
                  <label>{{ i18n.t('settings.confirmNewPw') }}</label>
                  <input type="password" [(ngModel)]="passwords.confirm" (ngModelChange)="clearFieldError('confirmPassword')" name="confirm" required [class.input-error]="!!getFieldError('confirmPassword')" />
                  @if (getFieldError('confirmPassword')) { <div class="field-error">⚠ {{ getFieldError('confirmPassword') }}</div> }
                </div>
                <button type="submit" class="btn btn-primary" [disabled]="changing || !isPasswordValid()">
                  @if (changing) { {{ i18n.t('settings.changing') }} } @else { {{ i18n.t('settings.updatePassword') }} }
                </button>
              </form>
            </div>
          </div>
        </div>

        <div class="card" style="margin-top:24px;">
          <div class="card-header">
            <h3>{{ i18n.t('settings.notifPrefsHeader') }}</h3>
          </div>
          <div class="card-body">
            <p style="font-size:13px;color:var(--text-muted);margin-bottom:16px;">{{ i18n.t('settings.notifPrefsDesc') }}</p>
            @if (notifPrefsLoading) {
              <div style="color:var(--text-muted);">{{ i18n.t('settings.loading') }}</div>
            } @else if (notifPrefsError) {
              <div style="color:var(--danger);">{{ notifPrefsError }}</div>
            } @else {
              <table class="data-table">
                <thead>
                  <tr>
                    <th>{{ i18n.t('settings.notifPrefsHeader') }}</th>
                    <th>{{ i18n.t('settings.notifChannelInApp') }}</th>
                    <th>{{ i18n.t('settings.notifChannelEmail') }}</th>
                  </tr>
                </thead>
                <tbody>
                  @for (type of notifTypes; track type) {
                    <tr>
                      <td>{{ formatNotifType(type) }}</td>
                      <td>
                        <input type="checkbox" [checked]="isPrefEnabled('inApp', type)" (change)="setPref('inApp', type, $any($event.target).checked)" />
                      </td>
                      <td>
                        <input type="checkbox" [checked]="isPrefEnabled('email', type)" (change)="setPref('email', type, $any($event.target).checked)" />
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
              <button class="btn btn-primary" style="margin-top:16px;" [disabled]="notifPrefsSaving" (click)="saveNotificationPrefs()">
                @if (notifPrefsSaving) { {{ i18n.t('settings.notifSaving') }} } @else { {{ i18n.t('settings.notifSave') }} }
              </button>
            }
          </div>
        </div>

        <div class="card" style="margin-top:24px;" data-testid="ai-health-card">
          <div class="card-header" style="display:flex;justify-content:space-between;align-items:center;">
            <h3>{{ i18n.t('settings.aiHealthHeader') }}</h3>
            <button type="button" class="btn btn-secondary btn-sm" (click)="loadAiHealth()" [disabled]="aiHealthLoading">
              {{ i18n.t('settings.aiHealthRefresh') }}
            </button>
          </div>
          <div class="card-body" style="font-size:13px;">
            @if (aiHealthLoading) {
              <p style="color:var(--text-muted);">{{ i18n.t('settings.aiHealthLoading') }}</p>
            } @else if (aiHealth) {
              <p><strong>{{ i18n.t('settings.aiHealthStatus') }}:</strong> {{ aiHealth.status }} · {{ i18n.t('settings.aiHealthTier') }}: {{ aiHealth.tier }}</p>
              @if (aiHealth.chatLatencyMs != null) {
                <p><strong>{{ i18n.t('settings.aiHealthLatency') }}:</strong> {{ aiHealth.chatLatencyMs }} ms</p>
              }
              <p style="margin-top:8px;"><strong>{{ i18n.t('settings.aiHealthCapabilities') }}:</strong>
                chat {{ aiHealth.capabilities.chat ? '✓' : '✗' }},
                embeddings {{ aiHealth.capabilities.embeddings ? '✓' : '✗' }},
                vision {{ aiHealth.capabilities.vision ? '✓' : '✗' }},
                voice {{ aiHealth.capabilities.voice ? '✓' : '✗' }},
                bilingual {{ aiHealth.capabilities.bilingual ? '✓' : '✗' }}
              </p>
              @if (aiHealth.pulledModels?.length) {
                <p style="margin-top:8px;"><strong>{{ i18n.t('settings.aiHealthModels') }}:</strong> {{ aiHealth.pulledModels.join(', ') }}</p>
              }
            }
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
  styles: [`
    .field-error {
      margin-top: 6px;
      font-size: 12px;
      color: #B91C1C;
      background: #FEF2F2;
      border-left: 3px solid #DC2626;
      padding: 6px 10px;
      border-radius: 4px;
    }
    .input-error {
      border-color: #DC2626 !important;
      background: #FFF5F5;
    }
  `],
})
export class SettingsPageComponent implements OnInit {
  profile: User | null = null;
  loading = true;
  error = '';
  changing = false;
  passwords = { current: '', new: '', confirm: '' };
  /**
   * Inline field-level errors populated from the backend's
   * `BadRequestError` (e.g. `{field: 'newPassword', minLength: 8}`).
   * Forms can read a single field's error via `getFieldError(name)`.
   */
  fieldErrors: Record<string, string> = {};
  notifPrefs: Array<{ channel: string; type: string; enabled: boolean }> = [];
  notifPrefsLoading = false;
  notifPrefsSaving = false;
  notifPrefsError = '';
  aiHealth: any = null;
  aiHealthLoading = false;
  readonly notifTypes = ['ISSUE_UPDATE', 'COMMENT', 'ANNOUNCEMENT', 'EVENT', 'MENTION', 'ASSIGNMENT', 'VOTE', 'SYSTEM'];
  navItems: NavItem[] = [];

  auth = inject(AuthService);
  api = inject(ApiService);
  toast = inject(ToastService);
  i18n = inject(TranslationService);

  constructor() {
    this.navItems = [{ icon: 'dashboard', label: 'nav.dashboard', route: this.auth.getDashboardRoute() }];
  }

  ngOnInit() {
    this.loadProfile();
    this.loadNotificationPrefs();
    this.loadAiHealth();
  }

  loadAiHealth() {
    this.aiHealthLoading = true;
    this.api.aiHealth().subscribe({
      next: (res) => {
        this.aiHealth = res.data;
        this.aiHealthLoading = false;
      },
      error: () => {
        this.aiHealthLoading = false;
      },
    });
  }

  formatNotifType(type: string): string {
    return type.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
  }

  isPrefEnabled(channel: string, type: string): boolean {
    const row = this.notifPrefs.find((p) => p.channel === channel && p.type === type);
    if (!row) return channel === 'inApp';
    return row.enabled;
  }

  setPref(channel: string, type: string, enabled: boolean) {
    const idx = this.notifPrefs.findIndex((p) => p.channel === channel && p.type === type);
    if (idx >= 0) {
      this.notifPrefs[idx] = { ...this.notifPrefs[idx], enabled };
    } else {
      this.notifPrefs.push({ channel, type, enabled });
    }
  }

  loadNotificationPrefs() {
    this.notifPrefsLoading = true;
    this.notifPrefsError = '';
    this.api.getNotificationPrefs().subscribe({
      next: (res) => {
        this.notifPrefsLoading = false;
        if (res.success) this.notifPrefs = res.data;
      },
      error: () => {
        this.notifPrefsLoading = false;
        this.notifPrefsError = this.i18n.t('settings.notifLoadFailed');
      },
    });
  }

  saveNotificationPrefs() {
    this.notifPrefsSaving = true;
    const preferences = this.notifTypes.flatMap((type) =>
      (['inApp', 'email'] as const).map((channel) => ({
        channel,
        type,
        enabled: this.isPrefEnabled(channel, type),
      })),
    );
    this.api.updateNotificationPrefs(preferences).subscribe({
      next: (res) => {
        this.notifPrefsSaving = false;
        if (res.success) {
          this.notifPrefs = res.data;
          this.toast.success(this.i18n.t('settings.notifSaved'));
        }
      },
      error: () => {
        this.notifPrefsSaving = false;
        this.toast.error(this.i18n.t('settings.notifSaveFailed'));
      },
    });
  }

  isPasswordValid(): boolean {
    return this.passwords.current.length > 0
      && this.passwords.new.length >= 8
      && this.passwords.new === this.passwords.confirm;
  }

  /**
   * Inline field-error accessor used by the template. Tries
   * `errorFields.<field>` first, then falls back to the raw
   * backend message. Returns '' when no error is set.
   */
  getFieldError(field: string): string {
    const raw = this.fieldErrors[field];
    if (!raw) return '';
    const key = `errorFields.${field}` as any;
    const translated = this.i18n.t(key);
    if (translated && translated !== key) return translated;
    return raw;
  }

  /**
   * Drop the inline error for `field` (called from each input's
   * `ngModelChange`).
   */
  clearFieldError(field: string) {
    if (this.fieldErrors[field]) {
      delete this.fieldErrors[field];
    }
  }

  changePassword() {
    // Local validation first — surface as inline field errors so the
    // user sees the failure next to the offending input (not just
    // as a toast they might miss).
    this.fieldErrors = {};
    if (this.passwords.new !== this.passwords.confirm) {
      this.fieldErrors['confirmPassword'] = this.i18n.t('settings.pwMismatch');
    } else if (!this.isPasswordValid()) {
      this.fieldErrors['newPassword'] = this.i18n.t('settings.pwFieldsRequired');
    }
    if (Object.keys(this.fieldErrors).length > 0) return;

    this.changing = true;
    this.api.changePassword(this.passwords.current, this.passwords.new).subscribe({
      next: (res: any) => {
        this.changing = false;
        this.toast.success(res?.message || this.i18n.t('settings.pwChanged'));
        this.passwords = { current: '', new: '', confirm: '' };
      },
      error: (err) => {
        this.changing = false;
        const apiErr = toApiError(err);
        // Backend BadRequestError carries `{field: 'newPassword', minLength: 8}`
        // for the too-short case. Wrong current password comes back as
        // InvalidCredentialsError (401) with no `details`, so the
        // inline map stays empty and the user sees the form-level error
        // (mapped to `errorFields.currentPassword` for translation).
        const fieldErrs = getFieldErrors(apiErr);
        this.fieldErrors = groupFieldErrorsByField(fieldErrs);
        if (fieldErrs.length === 0) {
          this.fieldErrors['currentPassword'] = apiErr.message;
          this.toast.error(apiErr.message);
        }
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
