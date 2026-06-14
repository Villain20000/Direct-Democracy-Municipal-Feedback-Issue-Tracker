import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { TranslationService } from '../../core/i18n/translation.service';
import { getFieldErrors, groupFieldErrorsByField, toApiError } from '../../core/errors/api-error';

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
              <input type="text" [(ngModel)]="firstName" (ngModelChange)="clearFieldError('firstName')" name="firstName" required [class.input-error]="!!getFieldError('firstName')" />
              @if (getFieldError('firstName')) { <div class="field-error">⚠ {{ getFieldError('firstName') }}</div> }
            </div>
            <div class="form-group">
              <label>{{ i18n.t('auth.lastName') }}</label>
              <input type="text" [(ngModel)]="lastName" (ngModelChange)="clearFieldError('lastName')" name="lastName" required [class.input-error]="!!getFieldError('lastName')" />
              @if (getFieldError('lastName')) { <div class="field-error">⚠ {{ getFieldError('lastName') }}</div> }
            </div>
          </div>
          <div class="form-group">
            <label>{{ i18n.t('auth.email') }}</label>
            <input type="email" [(ngModel)]="email" (ngModelChange)="clearFieldError('email')" name="email" required [class.input-error]="!!getFieldError('email')" />
            @if (getFieldError('email')) { <div class="field-error">⚠ {{ getFieldError('email') }}</div> }
          </div>
          <div class="form-group">
            <label>{{ i18n.t('auth.password') }}</label>
            <input type="password" [(ngModel)]="password" (ngModelChange)="clearFieldError('password')" name="password" required minlength="8" [class.input-error]="!!getFieldError('password')" />
            @if (getFieldError('password')) { <div class="field-error">⚠ {{ getFieldError('password') }}</div> }
          </div>
          <div class="form-group">
            <label>{{ i18n.t('auth.phone') }}</label>
            <input type="tel" [(ngModel)]="phone" (ngModelChange)="clearFieldError('phone')" name="phone" [class.input-error]="!!getFieldError('phone')" />
            @if (getFieldError('phone')) { <div class="field-error">⚠ {{ getFieldError('phone') }}</div> }
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
export class RegisterComponent {
  firstName = ''; lastName = ''; email = ''; password = ''; phone = '';
  loading = false; error = '';
  /**
   * Inline field-level errors populated from the backend's
   * ZodError / BadRequestError `details` bag. Forms can read a
   * single field's error via `getFieldError(name)`.
   */
  fieldErrors: Record<string, string> = {};

  i18n = inject(TranslationService);

  constructor(private auth: AuthService, private router: Router) {}

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

  onSubmit() {
    this.loading = true; this.error = ''; this.fieldErrors = {};
    this.auth.register({ firstName: this.firstName, lastName: this.lastName, email: this.email, password: this.password, phone: this.phone || undefined }).subscribe({
      next: (res) => { this.loading = false; if (res.success) this.router.navigate([this.auth.getDashboardRoute()]); },
      error: (err) => {
        this.loading = false;
        const apiErr = toApiError(err);
        // Surface field-level issues (Zod / BadRequestError) inline
        // next to the matching inputs. Anything else (network, 5xx)
        // stays at the form level + can be translated via
        // `errorCodes.<CODE>` by callers that opt in.
        const fieldErrs = getFieldErrors(apiErr);
        this.fieldErrors = groupFieldErrorsByField(fieldErrs);
        if (fieldErrs.length === 0) {
          this.error = this.i18n.t('auth.loginFailed');
        }
      },
    });
  }
}
