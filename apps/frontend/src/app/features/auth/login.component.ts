import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { TranslationService } from '../../core/i18n/translation.service';
import { LanguageSwitcherComponent } from '../../shared/language-switcher.component';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, LanguageSwitcherComponent],
  template: `
    <div class="login-page">
      <div class="login-card">
        <div style="position:absolute;top:16px;right:16px;">
          <app-language-switcher />
        </div>
        <div class="login-header">
          <div class="logo-circle"><span>DD</span></div>
          <h1>{{ i18n.t('app.name') }}</h1>
          <p>{{ i18n.t('app.tagline') }}</p>
        </div>

        @if (error) {
          <div class="error-msg">{{ error }}</div>
        }

        <form (ngSubmit)="onSubmit()">
          <div class="form-group">
            <label>{{ i18n.t('auth.email') }}</label>
            <input type="email" [(ngModel)]="email" name="email" [placeholder]="i18n.t('auth.email')" required />
          </div>
          <div class="form-group">
            <label>{{ i18n.t('auth.password') }}</label>
            <input type="password" [(ngModel)]="password" name="password" [placeholder]="i18n.t('auth.password')" required />
            <div style="text-align:right;margin-top:6px;">
              <a routerLink="/forgot-password" style="font-size:12px;">{{ i18n.t('auth.forgotPassword') }}</a>
            </div>
          </div>
          <button type="submit" class="btn btn-primary" [disabled]="loading">
            @if (loading) { <i class="material-icons-outlined" style="font-size:18px">hourglass_top</i> {{ i18n.t('auth.loggingIn') }} }
            @else { <i class="material-icons-outlined" style="font-size:18px">login</i> {{ i18n.t('auth.login') }} }
          </button>
        </form>

        <div class="login-footer">
          {{ i18n.t('auth.noAccount') }} <a routerLink="/register">{{ i18n.t('auth.registerHere') }}</a>
        </div>

        <div style="margin-top: 20px; padding-top: 16px; border-top: 1px solid var(--border);">
          <p style="font-size: 11px; color: var(--text-muted); text-align: center; margin-bottom: 8px;">{{ i18n.t('auth.demoAccounts') }}</p>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px;">
            @for (account of demoAccounts; track account.email) {
              <button class="btn btn-secondary btn-sm" style="font-size: 11px; padding: 6px 8px;" (click)="fillDemo(account)">
                {{ account.label }}
              </button>
            }
          </div>
        </div>
      </div>
    </div>
  `,
})
export class LoginComponent {
  email = '';
  password = '';
  loading = false;
  error = '';

  demoAccounts = [
    { email: 'admin@city.gov', password: 'password123', label: '🏛 Super Admin' },
    { email: 'mayor@city.gov', password: 'password123', label: '👔 Mayor' },
    { email: 'pw.head@city.gov', password: 'password123', label: '🔧 Dept Head' },
    { email: 'council1@city.gov', password: 'password123', label: '🗳 Council' },
    { email: 'staff1@city.gov', password: 'password123', label: '👷 Staff' },
    { email: 'citizen1@email.com', password: 'password123', label: '👤 Citizen' },
    { email: 'wardrep1@city.gov', password: 'password123', label: '🏘 Ward Rep' },
    { email: 'volunteer1@email.com', password: 'password123', label: '🤝 Volunteer' },
    { email: 'auditor@city.gov', password: 'password123', label: '📋 Auditor' },
    { email: 'press@herald.com', password: 'password123', label: '📰 Media' },
  ];

  i18n = inject(TranslationService);

  constructor(private auth: AuthService, private router: Router) {}

  fillDemo(account: { email: string; password: string }) {
    this.email = account.email;
    this.password = account.password;
  }

  onSubmit() {
    this.loading = true;
    this.error = '';
    this.auth.login(this.email, this.password).subscribe({
      next: (res) => {
        this.loading = false;
        if (res.success) {
          this.router.navigate([this.auth.getDashboardRoute()]);
        } else {
          this.error = this.i18n.t('auth.loginFailed');
        }
      },
      error: (err) => {
        this.loading = false;
        this.error = err.error?.error || this.i18n.t('auth.loginFailed');
      },
    });
  }
}
