import { Component, input, output, OnInit } from '@angular/core';
import { CommonModule, formatDate } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../core/services/auth.service';
import { NotificationService } from '../core/services/notification.service';
import { Notification } from '@dd/shared-types';

export interface NavItem {
  icon: string;
  label: string;
  route: string;
  badge?: number;
}

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, RouterLinkActive],
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
            @for (item of navItems(); track item.route) {
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
          <div class="page-title">{{ pageTitle() }}</div>
          <div class="top-bar-actions">
            <div class="search-box">
              <i class="material-icons-outlined">search</i>
              <input
                type="text"
                placeholder="Search issues, users..."
                [(ngModel)]="searchQuery"
                (keydown.enter)="onSearch()"
              />
            </div>
            <div class="notification-wrapper">
              <button class="notification-btn" (click)="toggleNotifications($event)">
                <i class="material-icons-outlined">notifications</i>
                @if (displayNotifCount > 0) {
                  <span class="notif-badge">{{ displayNotifCount }}</span>
                }
              </button>
              @if (showNotifications) {
                <div class="notification-panel" (click)="$event.stopPropagation()">
                  <div class="notification-panel-header">
                    <span>Notifications</span>
                    @if (displayNotifCount > 0) {
                      <button class="mark-all-btn" (click)="markAllRead()">Mark all read</button>
                    }
                  </div>
                  <div class="notification-list">
                    @for (notif of notifications.notifications(); track notif.id) {
                      <div
                        class="notification-item"
                        [class.unread]="!notif.isRead"
                        (click)="onNotificationClick(notif)"
                      >
                        <div class="notification-title">{{ notif.title }}</div>
                        <div class="notification-message">{{ notif.message }}</div>
                        <div class="notification-time">{{ formatDateTime(notif.createdAt) }}</div>
                      </div>
                    } @empty {
                      <div class="notification-empty">No notifications</div>
                    }
                  </div>
                </div>
              }
            </div>
          </div>
        </header>
        <div class="page-content fade-in">
          <ng-content />
        </div>
      </main>
    </div>
  `,
  styles: [`
    .notification-wrapper {
      position: relative;
    }

    .notification-panel {
      position: absolute;
      top: calc(100% + 8px);
      right: 0;
      width: 360px;
      max-height: 420px;
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-lg);
      z-index: 200;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .notification-panel-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 14px 16px;
      border-bottom: 1px solid var(--border);
      font-size: 14px;
      font-weight: 600;
      color: var(--text-primary);
    }

    .mark-all-btn {
      background: none;
      border: none;
      color: var(--primary);
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      padding: 4px 8px;
      border-radius: var(--radius);
    }

    .mark-all-btn:hover {
      background: var(--border-light);
    }

    .notification-list {
      overflow-y: auto;
      max-height: 360px;
    }

    .notification-item {
      padding: 12px 16px;
      border-bottom: 1px solid var(--border-light);
      cursor: pointer;
      transition: background var(--transition);
    }

    .notification-item:hover {
      background: var(--bg-primary);
    }

    .notification-item.unread {
      background: #EFF6FF;
    }

    .notification-item.unread:hover {
      background: #DBEAFE;
    }

    .notification-title {
      font-size: 13px;
      font-weight: 600;
      color: var(--text-primary);
      margin-bottom: 4px;
    }

    .notification-message {
      font-size: 12px;
      color: var(--text-secondary);
      line-height: 1.4;
      margin-bottom: 4px;
    }

    .notification-time {
      font-size: 11px;
      color: var(--text-muted);
    }

    .notification-empty {
      padding: 32px 16px;
      text-align: center;
      font-size: 13px;
      color: var(--text-muted);
    }
  `],
  host: {
    '(document:click)': 'closeNotifications()',
  },
})
export class LayoutComponent implements OnInit {
  pageTitle = input('');
  navItems = input<NavItem[]>([]);
  notifCount = input<number | undefined>(undefined);
  logout = output<void>();

  searchQuery = '';
  showNotifications = false;

  constructor(
    private auth: AuthService,
    public notifications: NotificationService,
    private router: Router
  ) {}

  ngOnInit(): void {
    if (this.auth.isAuthenticated()) {
      this.notifications.load();
    }
  }

  get displayNotifCount(): number {
    return this.notifCount() ?? this.notifications.unreadCount();
  }

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

  onSearch(): void {
    const query = this.searchQuery.trim();
    if (query) {
      this.router.navigate(['/issues'], { queryParams: { search: query } });
    } else {
      this.router.navigate(['/issues']);
    }
  }

  toggleNotifications(event: Event): void {
    event.stopPropagation();
    this.showNotifications = !this.showNotifications;
    if (this.showNotifications) {
      this.notifications.load();
    }
  }

  closeNotifications(): void {
    this.showNotifications = false;
  }

  onNotificationClick(notif: Notification): void {
    if (!notif.isRead) {
      this.notifications.markRead(notif.id);
    }
    const issueId = notif.data?.['issueId'] as string | undefined;
    if (issueId) {
      this.showNotifications = false;
      this.router.navigate(['/issues', issueId]);
    }
  }

  markAllRead(): void {
    this.notifications.markAllRead();
  }

  formatDateTime(value: string): string {
    return formatDate(value, 'short', 'en-US');
  }
}