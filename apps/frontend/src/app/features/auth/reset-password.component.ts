import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="login-page">
      <div class="login-card">
        <div class="login-header">
          <div class="logo-circle"><span>DD</span></div>
          <h1>Set New Password</h1>
          <p>Choose a new password for your account</p>
        </div>

        @if (error) { <div class="error-msg">{{ error }}</div> }
        @if (message) { <div style="padding:12px;background:var(--success-bg,#e8f5e9);color:var(--success,#2e7d32);border-radius:var(--radius);margin-bottom:16px;font-size:13px;">{{ message }}</div> }

        @if (token) {
          <form (ngSubmit)="onSubmit()">
            <div class="form-group">
              <label>New Password</label>
              <input type="password" [(ngModel)]="password" name="password" placeholder="At least 8 characters" required minlength="8" />
            </div>
            <div class="form-group">
              <label>Confirm Password</label>
              <input type="password" [(ngModel)]="confirmPassword" name="confirmPassword" required />
            </div>
            <button type="submit" class="btn btn-primary" [disabled]="loading">
              @if (loading) { Resetting... } @else { Reset Password }
            </button>
          </form>
        } @else {
          <div class="error-msg">Invalid or missing reset token.</div>
        }

        <div class="login-footer" style="margin-top:16px;">
          <a routerLink="/login">← Back to Sign In</a>
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

  constructor(private auth: AuthService, private route: ActivatedRoute, private router: Router) {}

  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      this.token = params['token'] || '';
    });
  }

  onSubmit() {
    if (this.password !== this.confirmPassword) {
      this.error = 'Passwords do not match.';
      return;
    }
    if (this.password.length < 8) {
      this.error = 'Password must be at least 8 characters.';
      return;
    }

    this.loading = true;
    this.error = '';
    this.auth.resetPassword(this.token, this.password).subscribe({
      next: (res) => {
        this.loading = false;
        this.message = res.message || 'Password reset successfully. You can now sign in.';
        setTimeout(() => this.router.navigate(['/login']), 2000);
      },
      error: (err) => {
        this.loading = false;
        this.error = err.error?.error || 'Failed to reset password.';
      },
    });
  }
}