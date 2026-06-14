import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { TranslationService } from '../../core/i18n/translation.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="login-page">
      <div class="login-card" style="max-width: 500px;">
        <div class="login-header">
          <div class="logo-circle"><span>DD</span></div>
          <h1>{{ i18n.t('auth.register') }}</h1>
          <p>{{ i18n.t('auth.registerTagline') }}</p>
        </div>
        @if (error) { <div class="error-msg">{{ error }}</div> }
        <form (ngSubmit)="onSubmit()">
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
            <div class="form-group">
              <label>{{ i18n.t('auth.firstName') }}</label>
              <input type="text" [(ngModel)]="firstName" name="firstName" required />
            </div>
            <div class="form-group">
              <label>{{ i18n.t('auth.lastName') }}</label>
              <input type="text" [(ngModel)]="lastName" name="lastName" required />
            </div>
          </div>
          <div class="form-group">
            <label>{{ i18n.t('auth.email') }}</label>
            <input type="email" [(ngModel)]="email" name="email" required />
          </div>
          <div class="form-group">
            <label>{{ i18n.t('auth.password') }}</label>
            <input type="password" [(ngModel)]="password" name="password" required minlength="8" />
          </div>
          <div class="form-group">
            <label>{{ i18n.t('auth.phone') }}</label>
            <input type="tel" [(ngModel)]="phone" name="phone" />
          </div>
          <button type="submit" class="btn btn-primary" [disabled]="loading">
            @if (loading) { {{ i18n.t('auth.creating') }} }
            @else { {{ i18n.t('auth.register') }} }
          </button>
        </form>
        <div class="login-footer">
          {{ i18n.t('auth.signInPrompt') }} <a routerLink="/login">{{ i18n.t('auth.signInLink') }}</a>
        </div>
      </div>
    </div>
  `,
})
export class RegisterComponent {
  firstName = ''; lastName = ''; email = ''; password = ''; phone = '';
  loading = false; error = '';

  i18n = inject(TranslationService);

  constructor(private auth: AuthService, private router: Router) {}

  onSubmit() {
    this.loading = true; this.error = '';
    this.auth.register({ firstName: this.firstName, lastName: this.lastName, email: this.email, password: this.password, phone: this.phone || undefined }).subscribe({
      next: (res) => { this.loading = false; if (res.success) this.router.navigate([this.auth.getDashboardRoute()]); },
      error: (err) => { this.loading = false; this.error = err.error?.error || this.i18n.t('auth.loginFailed'); },
    });
  }
}
