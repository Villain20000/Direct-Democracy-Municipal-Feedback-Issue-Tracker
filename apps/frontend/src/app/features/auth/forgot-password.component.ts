import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="login-page">
      <div class="login-card">
        <div class="login-header">
          <div class="logo-circle"><span>DD</span></div>
          <h1>Reset Password</h1>
          <p>Enter your email to receive a reset link</p>
        </div>

        @if (error) { <div class="error-msg">{{ error }}</div> }
        @if (message) { <div style="padding:12px;background:var(--success-bg,#e8f5e9);color:var(--success,#2e7d32);border-radius:var(--radius);margin-bottom:16px;font-size:13px;">{{ message }}</div> }

        <form (ngSubmit)="onSubmit()">
          <div class="form-group">
            <label>Email</label>
            <input type="email" [(ngModel)]="email" name="email" placeholder="your@email.com" required />
          </div>
          <button type="submit" class="btn btn-primary" [disabled]="loading">
            @if (loading) { Sending... } @else { Send Reset Link }
          </button>
        </form>

        <div class="login-footer" style="margin-top:16px;">
          <a routerLink="/login">← Back to Sign In</a>
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

  constructor(private auth: AuthService) {}

  onSubmit() {
    this.loading = true;
    this.error = '';
    this.message = '';
    this.auth.forgotPassword(this.email).subscribe({
      next: (res) => {
        this.loading = false;
        this.message = res.message || 'If that email exists, a reset link has been sent.';
      },
      error: (err) => {
        this.loading = false;
        this.error = err.error?.error || 'Failed to send reset link.';
      },
    });
  }
}