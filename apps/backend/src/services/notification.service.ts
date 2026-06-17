import { prisma } from '../db/client';
import type { Prisma } from '@prisma/client';
import { emailService } from './email.service';
import { NotFoundError } from '../errors/domain-errors';

export const notificationService = {
  async create(
    userId: string,
    type: string,
    title: string,
    message: string,
    data?: Record<string, unknown>,
    options?: { sendEmail?: boolean },
  ) {
    const notification = await prisma.notification.create({
      data: { userId, type, title, message, data: (data || undefined) as Prisma.InputJsonValue | undefined },
    });

    if (options?.sendEmail) {
      const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
      if (user?.email) {
        emailService.sendIssueNotification(user.email, title, message).catch(() => {});
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
