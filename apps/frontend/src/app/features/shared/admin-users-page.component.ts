import { Component, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { LayoutComponent, NavItem } from '../../shared/layout.component';
import { AuthService } from '../../core/services/auth.service';
import { ApiService } from '../../core/services/api.service';
import { User, UserRole } from '@dd/shared-types';

@Component({
  selector: 'app-admin-users-page',
  standalone: true,
  imports: [CommonModule, LayoutComponent, DatePipe],
  template: `
    <app-layout pageTitle="User Management" [navItems]="navItems" (logout)="auth.logout()">
      @if (!authorized) {
        <div class="card">
          <div class="card-body" style="text-align:center;padding:48px;color:var(--danger);">
            Access denied. User management is available to administrators only.
          </div>
        </div>
      } @else {
        @if (error) {
          <div class="card" style="margin-bottom:24px;border-color:var(--danger);">
            <div class="card-body" style="color:var(--danger);">{{ error }}</div>
          </div>
        }

        @if (loading) {
          <div class="card"><div class="card-body" style="text-align:center;padding:48px;color:var(--text-muted);">Loading users...</div></div>
        } @else {
          <div class="card">
            <div class="card-header"><h3>👥 Users</h3></div>
            <div class="card-body" style="padding:0;">
              <table class="data-table">
                <thead>
                  <tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Joined</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  @for (user of users; track user.id) {
                    <tr>
                      <td><strong>{{ user.firstName }} {{ user.lastName }}</strong></td>
                      <td style="font-size:12px;">{{ user.email }}</td>
                      <td><span class="badge badge-blue">{{ user.role }}</span></td>
                      <td>
                        <span class="status-badge" [class]="user.isActive ? 'resolved' : 'rejected'">
                          {{ user.isActive ? 'Active' : 'Inactive' }}
                        </span>
                      </td>
                      <td style="color:var(--text-muted);font-size:12px;">{{ user.createdAt | date:'mediumDate' }}</td>
                      <td>
                        <button class="btn btn-sm" [class.btn-danger]="user.isActive" [class.btn-success]="!user.isActive"
                          [disabled]="togglingId === user.id" (click)="toggleActive(user)">
                          {{ togglingId === user.id ? 'Updating...' : (user.isActive ? 'Deactivate' : 'Activate') }}
                        </button>
                      </td>
                    </tr>
                  } @empty {
                    <tr><td colspan="6" style="text-align:center;padding:48px;color:var(--text-muted);">No users found.</td></tr>
                  }
                </tbody>
              </table>
            </div>
          </div>
        }
      }
    </app-layout>
  `,
})
export class AdminUsersPageComponent implements OnInit {
  users: User[] = [];
  loading = true;
  error = '';
  authorized = false;
  togglingId = '';
  navItems: NavItem[] = [];

  constructor(public auth: AuthService, private api: ApiService) {
    this.navItems = [
      { icon: 'dashboard', label: 'Dashboard', route: '/admin' },
      { icon: 'people', label: 'Users', route: '/admin/users' },
    ];
    this.authorized = auth.hasRole(UserRole.SUPER_ADMIN);
  }

  ngOnInit() {
    if (this.authorized) this.loadUsers();
    else this.loading = false;
  }

  loadUsers() {
    this.loading = true;
    this.error = '';
    this.api.getUsers().subscribe({
      next: (res: any) => {
        this.users = res.data || [];
        this.loading = false;
      },
      error: (err) => {
        this.error = err.error?.error || 'Failed to load users.';
        this.loading = false;
      },
    });
  }

  toggleActive(user: User) {
    this.togglingId = user.id;
    this.api.updateUser(user.id, { isActive: !user.isActive }).subscribe({
      next: (res: any) => {
        if (res.success) {
          const idx = this.users.findIndex(u => u.id === user.id);
          if (idx >= 0) this.users[idx] = res.data;
        }
        this.togglingId = '';
      },
      error: (err) => {
        this.error = err.error?.error || 'Failed to update user.';
        this.togglingId = '';
      },
    });
  }
}