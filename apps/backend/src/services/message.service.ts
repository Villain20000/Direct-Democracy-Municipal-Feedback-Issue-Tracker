import { prisma } from '../db/client';
import { NotFoundError, ForbiddenError } from '../errors/domain-errors';

export const messageService = {
  async send(data: { senderId: string; receiverId: string; content: string }) {
    return prisma.message.create({
      data,
      include: {
        sender: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
        receiver: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  },

  async getConversation(userId: string, otherUserId: string, params?: { page?: number; pageSize?: number }) {
    const { page = 1, pageSize = 50 } = params || {};

    const [data, total] = await Promise.all([
      prisma.message.findMany({
        where: {
          OR: [
            { senderId: userId, receiverId: otherUserId },
            { senderId: otherUserId, receiverId: userId },
          ],
        },
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'asc' },
        include: {
          sender: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
        },
      }),
      prisma.message.count({
        where: {
          OR: [
            { senderId: userId, receiverId: otherUserId },
            { senderId: otherUserId, receiverId: userId },
          ],
        },
      }),
    ]);

    return { data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  },

  async getConversations(userId: string) {
    // Get all unique conversation partners
    const sent = await prisma.message.findMany({
      where: { senderId: userId },
      select: { receiverId: true },
      distinct: ['receiverId'],
    });
    const received = await prisma.message.findMany({
      where: { receiverId: userId },
      select: { senderId: true },
      distinct: ['senderId'],
    });

    const partnerIds = [...new Set([...sent.map(m => m.receiverId), ...received.map(m => m.senderId)])];

    const conversations = await Promise.all(
      partnerIds.map(async (partnerId) => {
        const lastMessage = await prisma.message.findFirst({
          where: {
            OR: [
              { senderId: userId, receiverId: partnerId },
              { senderId: partnerId, receiverId: userId },
            ],
          },
          orderBy: { createdAt: 'desc' },
          include: { sender: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } } },
        });
        const unreadCount = await prisma.message.count({
          where: { senderId: partnerId, receiverId: userId, isRead: false },
        });
        return { partnerId, lastMessage, unreadCount };
      })
    );

    return conversations.sort((a, b) => {
      const aTime = a.lastMessage?.createdAt?.getTime() || 0;
      const bTime = b.lastMessage?.createdAt?.getTime() || 0;
      return bTime - aTime;
    });
  },

  async markAsRead(id: string, userId: string) {
    return prisma.message.update({
      where: { id },
      data: { isRead: true },
    });
  },

  async markConversationRead(userId: string, senderId: string) {
    await prisma.message.updateMany({
      where: { senderId, receiverId: userId, isRead: false },
      data: { isRead: true },
    });
  },

  async delete(id: string, userId: string) {
    const message = await prisma.message.findUnique({ where: { id } });
    if (!message) throw new NotFoundError('Message not found');
    if (message.senderId !== userId && message.receiverId !== userId) {
      throw new ForbiddenError('Not authorized to delete this message');
    }
    return prisma.message.delete({ where: { id } });
  },
};
