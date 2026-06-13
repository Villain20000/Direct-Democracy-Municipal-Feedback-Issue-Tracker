import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../core/services/auth.service';

export interface NavItem {
  icon: string;
  label: string;
  route: string;
  badge?: number;
}

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  template: `
    <div class="dashboard-layout">
      <aside class="sidebar">
        <div class="sidebar-header">
          <div class="logo">DD</div>
          <div class="brand">
            Direct Democracy
            <span>Municipal Platform</span>
          </div>
        </div>
        <nav class="sidebar-nav">
          <div class="nav-section">
            <div class="nav-section-title">{{ dashboardTitle }}</div>
            @for (item of navItems; track item.route) {
              <a class="nav-item" [routerLink]="item.route" routerLinkActive="active">
                <i class="material-icons-outlined">{{ item.icon }}</i>
                {{ item.label }}
                @if (item.badge) { <span class="badge">{{ item.badge }}</span> }
              </a>
            }
          </div>
          <div class="nav-section">
            <div class="nav-section-title">General</div>
            <a class="nav-item" routerLink="/issues" routerLinkActive="active">
              <i class="material-icons-outlined">report_problem</i> All Issues
            </a>
          </div>
        </nav>
        <div class="sidebar-footer">
          <div class="user-avatar">{{ userInitials }}</div>
          <div class="user-info">
            <div class="name">{{ userName }}</div>
            <div class="role">{{ userRoleDisplay }}</div>
          </div>
          <button class="logout-btn" (click)="logout.emit()">
            <i class="material-icons-outlined">logout</i>
          </button>
        </div>
      </aside>
      <main class="main-content">
        <header class="top-bar">
          <div class="page-title">{{ pageTitle }}</div>
          <div class="top-bar-actions">
            <div class="search-box">
              <i class="material-icons-outlined">search</i>
              <input type="text" placeholder="Search issues, users..." />
            </div>
            <button class="notification-btn">
              <i class="material-icons-outlined">notifications</i>
              @if (notifCount > 0) { <span class="notif-badge">{{ notifCount }}</span> }
            </button>
          </div>
        </header>
        <div class="page-content fade-in">
          <ng-content />
        </div>
      </main>
    </div>
  `,
  inputs: ['pageTitle', 'navItems', 'notifCount'],
})
export class LayoutComponent {
  pageTitle = '';
  navItems: NavItem[] = [];
  notifCount = 0;
  logout = output<void>();

  constructor(private auth: AuthService) {}

  get userName(): string {
    const u = this.auth.user();
    return u ? `${u.firstName} ${u.lastName}` : '';
  }
  get userInitials(): string {
    const u = this.auth.user();
    return u ? `${u.firstName[0]}${u.lastName[0]}` : '';
  }
  get userRoleDisplay(): string {
    return (this.auth.user()?.role || '').replace(/_/g, ' ');
  }
  get dashboardTitle(): string {
    const role = this.auth.user()?.role || '';
    const titles: Record<string, string> = {
      SUPER_ADMIN: 'Admin Panel', MAYOR: 'Mayor Dashboard',
      DEPARTMENT_HEAD: 'Department Panel', COUNCIL_MEMBER: 'Council Dashboard',
      STAFF: 'Staff Panel', WARD_REP: 'Ward Dashboard',
      CITIZEN: 'My Dashboard', VOLUNTEER: 'Volunteer Hub',
      AUDITOR: 'Audit Center', MEDIA: 'Press Center',
    };
    return titles[role] || 'Dashboard';
  }
}
