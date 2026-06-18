import { prisma } from '../db/client';
import type { Prisma } from '@prisma/client';
import { emailService } from './email.service';
import { NotFoundError } from '../errors/domain-errors';
import { notificationPreferenceService } from './notification-preference.service';

/** Map in-app notification types to preference-store keys. */
function toPreferenceType(notificationType: string): string {
  const map: Record<string, string> = {
    ISSUE_STATUS_CHANGED: 'ISSUE_UPDATE',
    ISSUE_ASSIGNED: 'ASSIGNMENT',
    ISSUE_COMMENT: 'COMMENT',
    ISSUE_MENTION: 'MENTION',
    ANNOUNCEMENT: 'ANNOUNCEMENT',
    EVENT: 'EVENT',
    VOTE_RECEIVED: 'VOTE',
  };
  return map[notificationType] || notificationType;
}

export const notificationService = {
  async create(
    userId: string,
    type: string,
    title: string,
    message: string,
    data?: Record<string, unknown>,
    options?: { sendEmail?: boolean },
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
