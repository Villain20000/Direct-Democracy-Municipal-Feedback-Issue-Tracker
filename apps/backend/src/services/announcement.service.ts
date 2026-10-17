import { prisma } from '../db/client';
import { NotFoundError } from '../errors/domain-errors';
import { notificationService } from './notification.service';

export const announcementService = {
  async create(data: {
    title: string; content: string; authorId: string;
    isPinned?: boolean; publishedAt?: string;
  }) {
    return prisma.announcement.create({
      data: {
        ...data,
        publishedAt: data.publishedAt ? new Date(data.publishedAt) : new Date(),
      },
      include: {
        author: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  },

  /**
   * P1-13: publishing an announcement notifies every active user
   * (except the author). In-app rows honour per-user prefs; email
   * goes out only to users who opted in, throttled per announcement.
   */
  async fanOutPublished(announcementId: string) {
    const announcement = await prisma.announcement.findUnique({
      where: { id: announcementId },
      select: { id: true, title: true, authorId: true },
    });
    if (!announcement) return;
    const recipients = await prisma.user.findMany({
      where: { isActive: true, id: { not: announcement.authorId } },
      select: { id: true },
      take: 2000,
    });
    await notificationService.broadcast(
      recipients.map(r => r.id),
      'ANNOUNCEMENT',
      'New announcement',
      announcement.title,
      { announcementId: announcement.id },
      {
        sendEmail: true,
        emailThrottleMs: 24 * 60 * 60 * 1000,
        throttleKey: `ANNOUNCEMENT:${announcement.id}`,
      },
    );
  },

  async getAll(params: {
    page?: number; pageSize?: number; search?: string;
  }) {
    const { page = 1, pageSize = 20, search } = params;
    const where: any = {};

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { content: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      prisma.announcement.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
        include: {
          author: { select: { id: true, firstName: true, lastName: true } },
        },
      }),
      prisma.announcement.count({ where }),
    ]);

    return { data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  },

  async getById(id: string) {
    const announcement = await prisma.announcement.findUnique({
      where: { id },
      include: {
        author: { select: { id: true, firstName: true, lastName: true } },
      },
    });
    if (!announcement) throw new NotFoundError('Announcement not found');
    return announcement;
  },

  async update(id: string, data: {
    title?: string; content?: string; isPinned?: boolean;
  }) {
    const announcement = await prisma.announcement.findUnique({ where: { id } });
    if (!announcement) throw new NotFoundError('Announcement not found');

    return prisma.announcement.update({
      where: { id },
      data,
      include: {
        author: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  },

  async delete(id: string) {
    const announcement = await prisma.announcement.findUnique({ where: { id } });
    if (!announcement) throw new NotFoundError('Announcement not found');
    return prisma.announcement.delete({ where: { id } });
  },
};
