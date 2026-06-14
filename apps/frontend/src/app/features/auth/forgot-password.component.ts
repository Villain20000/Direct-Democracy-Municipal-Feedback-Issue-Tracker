import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { TranslationService } from '../../core/i18n/translation.service';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="login-page">
      <div class="login-card">
        <div class="login-header">
          <div class="logo-circle"><span>DD</span></div>
          <h1>{{ i18n.t('auth.forgotPasswordTitle') }}</h1>
          <p>{{ i18n.t('auth.forgotPasswordDesc') }}</p>
        </div>

        @if (error) { <div class="error-msg">{{ error }}</div> }
        @if (message) { <div style="padding:12px;background:var(--success-bg,#e8f5e9);color:var(--success,#2e7d32);border-radius:var(--radius);margin-bottom:16px;font-size:13px;">{{ message }}</div> }

        <form (ngSubmit)="onSubmit()">
          <div class="form-group">
            <label>{{ i18n.t('auth.email') }}</label>
            <input type="email" [(ngModel)]="email" name="email" [placeholder]="i18n.t('auth.emailPlaceholder')" required />
          </div>
          <button type="submit" class="btn btn-primary" [disabled]="loading">
            @if (loading) { {{ i18n.t('auth.sending') }} } @else { {{ i18n.t('auth.sendResetLink') }} }
          </button>
        </form>

        <div class="login-footer" style="margin-top:16px;">
          <a routerLink="/login">{{ i18n.t('auth.backToLogin') }}</a>
        </div>
      </div>
    </div>
  `,
})
export class ForgotPasswordComponent {
  email = '';
  loading = false;
  error = '';
  message = '';

  i18n = inject(TranslationService);

  constructor(private auth: AuthService) {}

  onSubmit() {
    this.loading = true;
    this.error = '';
    this.message = '';
    this.auth.forgotPassword(this.email).subscribe({
      next: (res) => {
        this.loading = false;
        this.message = res.message || this.i18n.t('auth.resetLinkSent');
      },
      error: (err) => {
        this.loading = false;
        this.error = err.error?.error || this.i18n.t('auth.sendResetLinkError');
      },
    });
  }
}
