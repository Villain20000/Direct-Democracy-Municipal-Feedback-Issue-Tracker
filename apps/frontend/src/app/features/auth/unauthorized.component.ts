import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-unauthorized',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="login-page">
      <div class="login-card" style="text-align: center;">
        <i class="material-icons-outlined" style="font-size: 64px; color: var(--danger);">block</i>
        <h1 style="margin: 16px 0 8px;">Access Denied</h1>
        <p style="color: var(--text-secondary); margin-bottom: 24px;">You don't have permission to access this page.</p>
        <a routerLink="/login" class="btn btn-primary">Back to Login</a>
      </div>
    </div>
  `,
})
export class UnauthorizedComponent {}
