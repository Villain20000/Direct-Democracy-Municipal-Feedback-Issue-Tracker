import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslationService } from '../../core/i18n/translation.service';

@Component({
  selector: 'app-unauthorized',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="login-page">
      <div class="login-card" style="text-align: center;">
        <i class="material-icons-outlined" style="font-size: 64px; color: var(--danger);">block</i>
        <h1 style="margin: 16px 0 8px;">{{ i18n.t('auth.unauthorizedTitle') }}</h1>
        <p style="color: var(--text-secondary); margin-bottom: 24px;">{{ i18n.t('auth.unauthorizedBody') }}</p>
        <a routerLink="/login" class="btn btn-primary">{{ i18n.t('auth.backToLoginBtn') }}</a>
      </div>
    </div>
  `,
})
export class UnauthorizedComponent {
  i18n = inject(TranslationService);
}
