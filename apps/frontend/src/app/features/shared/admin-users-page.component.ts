import { Component, OnInit, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LayoutComponent, NavItem } from '../../shared/layout.component';
import { AuthService } from '../../core/services/auth.service';
import { ApiService } from '../../core/services/api.service';
import { ToastService } from '../../core/services/toast.service';
import { TranslationService } from '../../core/i18n/translation.service';
import { User, UserRole } from '@dd/shared-types';

@Component({
  selector: 'app-admin-users-page',
  standalone: true,
  imports: [CommonModule, FormsModule, LayoutComponent, DatePipe],
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

        <div class="card" style="margin-bottom:16px;">
          <div class="card-body" style="display:flex;gap:12px;flex-wrap:wrap;align-items:center;">
            <input type="text" [(ngModel)]="searchQuery" (keyup.enter)="loadUsers()" placeholder="Search by name or email..." style="flex:1;min-width:220px;padding:10px 14px;border:1px solid var(--border);border-radius:var(--radius);font-size:13px;" />
            <select [(ngModel)]="roleFilter" (change)="loadUsers()" style="padding:10px 14px;border:1px solid var(--border);border-radius:var(--radius);font-size:13px;">
              <option value="">All Roles</option>
              @for (r of roleOptions; track r) { <option [value]="r">{{ i18n.tRole(r) }}</option> }
            </select>
            <button class="btn btn-primary" (click)="openCreateModal()"><i class="material-icons-outlined" style="font-size:18px;">person_add</i> Create User</button>
          </div>
        </div>

        @if (loading) {
          <div class="card"><div class="card-body" style="text-align:center;padding:48px;color:var(--text-muted);">Loading users...</div></div>
        } @else {
          <div class="card">
            <div class="card-header"><h3>👥 Users ({{ filteredUsers.length }})</h3></div>
            <div class="card-body" style="padding:0;">
              <table class="data-table">
                <thead>
                  <tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Joined</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  @for (user of filteredUsers; track user.id) {
                    <tr>
                      <td><strong>{{ user.firstName }} {{ user.lastName }}</strong></td>
                      <td style="font-size:12px;">{{ user.email }}</td>
                      <td><span class="badge badge-blue">{{ i18n.tRole(user.role) }}</span></td>
                      <td>
                        <span class="status-badge" [class]="user.isActive ? 'resolved' : 'rejected'">
                          {{ i18n.tUserStatus(user.isActive) }}
                        </span>
                      </td>
                      <td style="color:var(--text-muted);font-size:12px;">{{ user.createdAt | date:'mediumDate' }}</td>
                      <td>
                        <div style="display:flex;gap:6px;">
                          <button class="btn btn-sm" [class.btn-danger]="user.isActive" [class.btn-success]="!user.isActive"
                            [disabled]="togglingId === user.id" (click)="toggleActive(user)">
                            {{ togglingId === user.id ? '...' : (user.isActive ? i18n.t('userStatus.deactivate') : i18n.t('userStatus.activate')) }}
                          </button>
                          <button class="btn btn-secondary btn-sm" (click)="openRoleModal(user)">Role</button>
                        </div>
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

      <!-- Create User Modal -->
      @if (showCreateModal) {
        <div class="modal-backdrop" (click)="closeCreateModal()">
          <div class="modal" (click)="$event.stopPropagation()">
            <div class="modal-header">
              <h3>➕ Create New User</h3>
              <button class="modal-close" (click)="closeCreateModal()">×</button>
            </div>
            <div class="modal-body">
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
                <div class="form-group">
                  <label>First Name *</label>
                  <input type="text" [(ngModel)]="newUser.firstName" name="firstName" />
                </div>
                <div class="form-group">
                  <label>Last Name *</label>
                  <input type="text" [(ngModel)]="newUser.lastName" name="lastName" />
                </div>
              </div>
              <div class="form-group">
                <label>Email *</label>
                <input type="email" [(ngModel)]="newUser.email" name="email" />
              </div>
              <div class="form-group">
                <label>Password * (min 8 chars)</label>
                <input type="password" [(ngModel)]="newUser.password" name="password" minlength="8" />
              </div>
              <div class="form-group">
                <label>Phone (optional)</label>
                <input type="tel" [(ngModel)]="newUser.phone" name="phone" />
              </div>
              <div class="form-group">
                <label>Role *</label>
                <select [(ngModel)]="newUser.role" name="role">
                  @for (r of roleOptions; track r) { <option [value]="r">{{ i18n.tRole(r) }}</option> }
                </select>
              </div>
            </div>
            <div class="modal-footer">
              <button class="btn btn-secondary" (click)="closeCreateModal()">Cancel</button>
              <button class="btn btn-primary" (click)="createUser()" [disabled]="!isCreateValid() || creating">
                @if (creating) { Creating... } @else { Create User }
              </button>
            </div>
          </div>
        </div>
      }

      <!-- Edit Role Modal -->
      @if (showRoleModal && roleEditUser) {
        <div class="modal-backdrop" (click)="closeRoleModal()">
          <div class="modal" (click)="$event.stopPropagation()">
            <div class="modal-header">
              <h3>Change Role: {{ roleEditUser.firstName }} {{ roleEditUser.lastName }}</h3>
              <button class="modal-close" (click)="closeRoleModal()">×</button>
            </div>
            <div class="modal-body">
              <div class="form-group">
                <label>New Role</label>
                <select [(ngModel)]="newRole" name="newRole">
                  @for (r of roleOptions; track r) { <option [value]="r">{{ i18n.tRole(r) }}</option> }
                </select>
              </div>
            </div>
            <div class="modal-footer">
              <button class="btn btn-secondary" (click)="closeRoleModal()">Cancel</button>
              <button class="btn btn-primary" (click)="updateRole()" [disabled]="updatingRole">Update Role</button>
            </div>
          </div>
        </div>
      }
    </app-layout>
  `,
  styles: [`
    .modal-backdrop {
      position: fixed; inset: 0;
      background: rgba(15, 23, 42, 0.6);
      display: flex; align-items: center; justify-content: center;
      z-index: 2000; backdrop-filter: blur(4px);
      animation: fadeIn 0.2s ease;
    }
    .modal {
      background: var(--bg-card);
      border-radius: var(--radius-lg);
      width: 100%; max-width: 520px;
      box-shadow: var(--shadow-lg);
      max-height: 90vh; overflow-y: auto;
      animation: slideInUp 0.2s ease;
    }
    .modal-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 16px 20px; border-bottom: 1px solid var(--border);
    }
    .modal-header h3 { font-size: 15px; font-weight: 700; }
    .modal-close {
      background: none; border: none; font-size: 24px; cursor: pointer;
      color: var(--text-muted); padding: 0; width: 28px; height: 28px;
      border-radius: 50%; display: flex; align-items: center; justify-content: center;
    }
    .modal-close:hover { background: var(--bg-primary); color: var(--text-primary); }
    .modal-body { padding: 20px; }
    .modal-footer {
      display: flex; gap: 8px; justify-content: flex-end;
      padding: 14px 20px; border-top: 1px solid var(--border);
      background: var(--bg-primary);
    }
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
    @keyframes slideInUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
  `],
})
export class AdminUsersPageComponent implements OnInit {
  users: User[] = [];
  loading = true;
  error = '';
  authorized = false;
  togglingId = '';
  searchQuery = '';
  roleFilter = '';
  roleOptions = Object.values(UserRole);

  showCreateModal = false;
  creating = false;
  newUser = { firstName: '', lastName: '', email: '', password: '', phone: '', role: UserRole.CITIZEN };

  showRoleModal = false;
  roleEditUser: User | null = null;
  newRole: UserRole = UserRole.CITIZEN;
  updatingRole = false;

  navItems: NavItem[] = [];

  auth = inject(AuthService);
  api = inject(ApiService);
  toast = inject(ToastService);
  i18n = inject(TranslationService);

  constructor() {
    this.navItems = [
      { icon: 'dashboard', label: 'nav.dashboard', route: '/admin' },
      { icon: 'people', label: 'Users', route: '/admin/users' },
    ];
    this.authorized = this.auth.hasRole(UserRole.SUPER_ADMIN);
  }

  ngOnInit() {
    if (this.authorized) this.loadUsers();
    else this.loading = false;
  }

  get filteredUsers(): User[] {
    const q = this.searchQuery.toLowerCase();
    return this.users.filter(u => {
      const matchRole = !this.roleFilter || u.role === this.roleFilter;
      const matchSearch = !q || `${u.firstName} ${u.lastName} ${u.email}`.toLowerCase().includes(q);
      return matchRole && matchSearch;
    });
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
          this.toast.success(`${user.firstName} ${user.lastName} ${!user.isActive ? 'activated' : 'deactivated'}.`);
        }
        this.togglingId = '';
      },
      error: (err) => {
        this.toast.error(err.error?.error || 'Failed to update user.');
        this.togglingId = '';
      },
    });
  }

  openCreateModal() {
    this.newUser = { firstName: '', lastName: '', email: '', password: '', phone: '', role: UserRole.CITIZEN };
    this.showCreateModal = true;
  }

  closeCreateModal() {
    this.showCreateModal = false;
  }

  isCreateValid(): boolean {
    return !!(this.newUser.firstName && this.newUser.lastName && this.newUser.email && this.newUser.password.length >= 8);
  }

  createUser() {
    if (!this.isCreateValid()) {
      this.toast.warning('Please fill in all required fields. Password must be 8+ characters.');
      return;
    }
    this.creating = true;
    this.api.createUser(this.newUser).subscribe({
      next: (res: any) => {
        if (res.success) {
          this.users = [res.data, ...this.users];
          this.toast.success(`User ${res.data.firstName} ${res.data.lastName} created!`);
          this.closeCreateModal();
        }
        this.creating = false;
      },
      error: (err) => {
        this.toast.error(err.error?.error || 'Failed to create user.');
        this.creating = false;
      },
    });
  }

  openRoleModal(user: User) {
    this.roleEditUser = user;
    this.newRole = user.role;
    this.showRoleModal = true;
  }

  closeRoleModal() {
    this.showRoleModal = false;
    this.roleEditUser = null;
  }

  updateRole() {
    if (!this.roleEditUser) return;
    this.updatingRole = true;
    this.api.updateUser(this.roleEditUser.id, { role: this.newRole }).subscribe({
      next: (res: any) => {
        if (res.success) {
          const idx = this.users.findIndex(u => u.id === this.roleEditUser!.id);
          if (idx >= 0) this.users[idx] = { ...this.users[idx], ...res.data };
          this.toast.success(this.i18n.t('admin-users.roleUpdated', { role: this.i18n.tRole(this.newRole) }));
          this.closeRoleModal();
        }
        this.updatingRole = false;
      },
      error: (err) => {
        this.toast.error(err.error?.error || 'Failed to update role.');
        this.updatingRole = false;
      },
    });
  }
}
