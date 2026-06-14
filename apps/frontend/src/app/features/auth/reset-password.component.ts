import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { TranslationService } from '../../core/i18n/translation.service';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="login-page">
      <div class="login-card">
        <div class="login-header">
          <div class="logo-circle"><span>DD</span></div>
          <h1>{{ i18n.t('auth.setNewPassword') }}</h1>
          <p>{{ i18n.t('auth.setNewPasswordDesc') }}</p>
        </div>

        @if (error) { <div class="error-msg">{{ error }}</div> }
        @if (message) { <div style="padding:12px;background:var(--success-bg,#e8f5e9);color:var(--success,#2e7d32);border-radius:var(--radius);margin-bottom:16px;font-size:13px;">{{ message }}</div> }

        @if (token) {
          <form (ngSubmit)="onSubmit()">
            <div class="form-group">
              <label>{{ i18n.t('auth.newPassword') }}</label>
              <input type="password" [(ngModel)]="password" name="password" [placeholder]="i18n.t('auth.passwordMinLength')" required minlength="8" />
            </div>
            <div class="form-group">
              <label>{{ i18n.t('auth.confirmPassword') }}</label>
              <input type="password" [(ngModel)]="confirmPassword" name="confirmPassword" required />
            </div>
            <button type="submit" class="btn btn-primary" [disabled]="loading">
              @if (loading) { {{ i18n.t('auth.resetting') }} } @else { {{ i18n.t('auth.resetPassword') }} }
            </button>
          </form>
        } @else {
          <div class="error-msg">{{ i18n.t('auth.invalidResetToken') }}</div>
        }

        <div class="login-footer" style="margin-top:16px;">
          <a routerLink="/login">{{ i18n.t('auth.backToLogin') }}</a>
        </div>
      </div>
    </div>
  `,
})
export class ResetPasswordComponent implements OnInit {
  token = '';
  password = '';
  confirmPassword = '';
  loading = false;
  error = '';
  message = '';

  i18n = inject(TranslationService);

  constructor(private auth: AuthService, private route: ActivatedRoute, private router: Router) {}

  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      this.token = params['token'] || '';
    });
  }

  onSubmit() {
    if (this.password !== this.confirmPassword) {
      this.error = this.i18n.t('auth.passwordsNoMatch');
      return;
    }
    if (this.password.length < 8) {
      this.error = this.i18n.t('auth.passwordTooShort');
      return;
    }

    this.loading = true;
    this.error = '';
    this.auth.resetPassword(this.token, this.password).subscribe({
      next: (res) => {
        this.loading = false;
        this.message = res.message || this.i18n.t('auth.passwordResetSuccess');
        setTimeout(() => this.router.navigate(['/login']), 2000);
      },
      error: (err) => {
        this.loading = false;
        this.error = err.error?.error || this.i18n.t('auth.resetFailed');
      },
    });
  }
}
