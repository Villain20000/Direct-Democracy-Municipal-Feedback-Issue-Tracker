import { Injectable, signal } from '@angular/core';
import { Notification } from '@dd/shared-types';
import { ApiService } from './api.service';

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private _notifications = signal<Notification[]>([]);
  private _unreadCount = signal(0);

  notifications = this._notifications.asReadonly();
  unreadCount = this._unreadCount.asReadonly();

  constructor(private api: ApiService) {}

  load(params: Record<string, string> = {}): void {
    this.api.getNotifications(params).subscribe((res: any) => {
      if (res.data) {
        this._notifications.set(res.data);
        this._unreadCount.set(res.unreadCount ?? res.data.filter((n: Notification) => !n.isRead).length);
      }
    });
  }

  markRead(id: string): void {
    this.api.markNotificationRead(id).subscribe(() => {
      this._notifications.update((list) =>
        list.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      );
      this._unreadCount.update((count) => Math.max(0, count - 1));
    });
  }

  markAllRead(): void {
    this.api.markAllNotificationsRead().subscribe(() => {
      this._notifications.update((list) => list.map((n) => ({ ...n, isRead: true })));
      this._unreadCount.set(0);
    });
  }
}