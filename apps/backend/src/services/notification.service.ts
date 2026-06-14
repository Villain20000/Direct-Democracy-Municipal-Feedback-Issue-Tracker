import { prisma } from '../db/client';
import type { Prisma } from '@prisma/client';

export const notificationService = {
  async create(userId: string, type: string, title: string, message: string, data?: Record<string, unknown>) {
    return prisma.notification.create({
      data: { userId, type, title, message, data: (data || undefined) as Prisma.InputJsonValue | undefined },
    });
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
    if (result.count === 0) throw new Error('Notification not found');
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
    if (result.count === 0) throw new Error('Notification not found');
  },
};
