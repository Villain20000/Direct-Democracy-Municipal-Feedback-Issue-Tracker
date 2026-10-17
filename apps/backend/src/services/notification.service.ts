import { prisma } from '../db/client';
import type { Prisma } from '@prisma/client';
import { emailService } from './email.service';
import { NotFoundError } from '../errors/domain-errors';
import { notificationPreferenceService } from './notification-preference.service';

/**
 * Notification channel defaults (P1-13).
 *
 * Every emit goes through `create()`, which consults the user's
 * per-(channel, type) preferences:
 * - inApp: ON by default for every type (missing pref row => enabled).
 * - email: OFF by default (user must opt in); even when opted in,
 *   high-frequency types pass `emailThrottleMs` so repeated events
 *   (votes, RSVPs) send at most one email per window.
 * - push: OFF by default (no push transport wired yet).
 *
 * Channel matrix (type -> default email behaviour):
 * - ISSUE_STATUS_CHANGED / ISSUE_ASSIGNED / ISSUE_COMMENT: email when
 *   the recipient opted in (reporter/assignee fan-out, no throttle).
 * - ISSUE_MENTION: email when opted in (mention fan-out, no throttle).
 * - ISSUE_ESCALATED: email when opted in (dept head + mayor fan-out).
 * - ANNOUNCEMENT: broadcast to all active users; email when opted in,
 *   throttled per announcement (`throttleKey` = ANNOUNCEMENT:<id>).
 * - VOTE_RECEIVED: to the poll/resolution/referendum owner; email when
 *   opted in, throttled per entity per hour.
 * - EVENT: new-event broadcast + RSVP notices to the event creator;
 *   email when opted in, throttled per event per hour.
 */
function toPreferenceType(notificationType: string): string {
  const map: Record<string, string> = {
    ISSUE_STATUS_CHANGED: 'ISSUE_UPDATE',
    ISSUE_ASSIGNED: 'ASSIGNMENT',
    ISSUE_ESCALATED: 'ASSIGNMENT',
    ISSUE_COMMENT: 'COMMENT',
    ISSUE_MENTION: 'MENTION',
    ANNOUNCEMENT: 'ANNOUNCEMENT',
    EVENT: 'EVENT',
    VOTE_RECEIVED: 'VOTE',
  };
  return map[notificationType] || notificationType;
}

/**
 * In-memory email throttle: last sent timestamp per key.
 * Key is `${userId}:${throttleKey || type}`. Single-instance guard
 * against fan-out storms; in-app rows are never throttled.
 */
const emailThrottleLastSent = new Map<string, number>();

/** Test hook: clear the throttle map between cases. */
export function resetEmailThrottleForTests() {
  emailThrottleLastSent.clear();
}

export const notificationService = {
  async create(
    userId: string,
    type: string,
    title: string,
    message: string,
    data?: Record<string, unknown>,
    options?: { sendEmail?: boolean; emailThrottleMs?: number; throttleKey?: string },
  ) {
    const prefType = toPreferenceType(type);
    const inAppEnabled = await notificationPreferenceService.isEnabled(userId, 'inApp', prefType);
    let notification = null;
    if (inAppEnabled) {
      notification = await prisma.notification.create({
        data: { userId, type, title, message, data: (data || undefined) as Prisma.InputJsonValue | undefined },
      });
    }

    if (options?.sendEmail) {
      // Throttle high-frequency email fan-out (votes, RSVPs, event
      // broadcasts). The in-app row above is always written; only the
      // email is skipped when the same key fired inside the window.
      if (options.emailThrottleMs) {
        const key = `${userId}:${options.throttleKey || type}`;
        const last = emailThrottleLastSent.get(key) || 0;
        if (Date.now() - last < options.emailThrottleMs) return notification;
        emailThrottleLastSent.set(key, Date.now());
      }
      const emailEnabled = await notificationPreferenceService.isEnabled(userId, 'email', prefType);
      if (emailEnabled) {
        const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
        if (user?.email) {
          emailService.sendIssueNotification(user.email, title, message).catch(() => {});
        }
      }
    }

    return notification;
  },

  /**
   * Fan-out helper for broadcasts (announcements, new events).
   * Iterates recipient ids sequentially so a single failing row can't
   * abort the batch; each `create()` still honours per-user prefs.
   */
  async broadcast(
    userIds: string[],
    type: string,
    title: string,
    message: string,
    data?: Record<string, unknown>,
    options?: { sendEmail?: boolean; emailThrottleMs?: number; throttleKey?: string },
  ) {
    for (const userId of userIds) {
      try {
        await this.create(userId, type, title, message, data, options);
      } catch (err: any) {
        console.warn(`[notifications.broadcast] failed for ${userId}:`, err.message);
      }
    }
  },

  async getByUser(userId: string, params?: { page?: number; pageSize?: number; unreadOnly?: boolean }) {
    const { page = 1, pageSize = 20, unreadOnly = false } = params || {};
    const where: any = { userId };
    if (unreadOnly) where.isRead = false;

    const [data, total, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where, skip: (page - 1) * pageSize, take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.notification.count({ where }),
      prisma.notification.count({ where: { userId, isRead: false } }),
    ]);

    return { data, total, unreadCount, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  },

  async markAsRead(id: string, userId: string) {
    const result = await prisma.notification.updateMany({
      where: { id, userId },
      data: { isRead: true },
    });
    if (result.count === 0) throw new NotFoundError('Notification not found');
  },

  async markAllAsRead(userId: string) {
    await prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
  },

  async delete(id: string, userId: string) {
    const result = await prisma.notification.deleteMany({
      where: { id, userId },
    });
    if (result.count === 0) throw new NotFoundError('Notification not found');
  },
};
