import { prisma } from '../db/client';
import { NotFoundError } from '../errors/domain-errors';
import { notificationService } from './notification.service';

export const eventService = {
  async create(data: {
    title: string; description?: string; location?: string;
    startTime: string; endTime: string; type: string;
    creatorId: string; isPublic?: boolean;
  }) {
    const event = await prisma.event.create({
      data: {
        ...data,
        startTime: new Date(data.startTime),
        endTime: new Date(data.endTime),
        isPublic: data.isPublic ?? true,
      },
      include: {
        creator: { select: { id: true, firstName: true, lastName: true } },
        _count: { select: { rsvps: true } },
      },
    });

    // P1-13: a new public event notifies all active users (EVENT,
    // email throttled per event). Fire-and-forget.
    if (event.isPublic) {
      void (async () => {
        try {
          const recipients = await prisma.user.findMany({
            where: { isActive: true, id: { not: data.creatorId } },
            select: { id: true },
            take: 2000,
          });
          await notificationService.broadcast(
            recipients.map(r => r.id),
            'EVENT',
            'New community event',
            `"${event.title}" — ${new Date(data.startTime).toLocaleDateString()}`,
            { eventId: event.id },
            {
              sendEmail: true,
              emailThrottleMs: 24 * 60 * 60 * 1000,
              throttleKey: `EVENT:${event.id}`,
            },
          );
        } catch (err: any) {
          console.warn(`[event.create] fan-out failed for ${event.id}:`, err.message);
        }
      })();
    }

    return event;
  },

  async getAll(params: {
    page?: number; pageSize?: number; type?: string;
    search?: string; upcoming?: boolean;
  }) {
    const { page = 1, pageSize = 20, type, search, upcoming } = params;
    const where: any = { isPublic: true };

    if (type) where.type = type;
    if (upcoming) where.startTime = { gte: new Date() };
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      prisma.event.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { startTime: 'asc' },
        include: {
          creator: { select: { id: true, firstName: true, lastName: true } },
          _count: { select: { rsvps: true } },
        },
      }),
      prisma.event.count({ where }),
    ]);

    return { data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  },

  async getById(id: string) {
    const event = await prisma.event.findUnique({
      where: { id },
      include: {
        creator: { select: { id: true, firstName: true, lastName: true } },
        rsvps: {
          include: { user: { select: { id: true, firstName: true, lastName: true } } },
        },
        _count: { select: { rsvps: true } },
      },
    });
    if (!event) throw new NotFoundError('Event not found');
    return event;
  },

  async update(id: string, data: {
    title?: string; description?: string; location?: string;
    startTime?: string; endTime?: string; type?: string; isPublic?: boolean;
  }) {
    const event = await prisma.event.findUnique({ where: { id } });
    if (!event) throw new NotFoundError('Event not found');

    return prisma.event.update({
      where: { id },
      data: {
        ...data,
        startTime: data.startTime ? new Date(data.startTime) : undefined,
        endTime: data.endTime ? new Date(data.endTime) : undefined,
      },
      include: {
        creator: { select: { id: true, firstName: true, lastName: true } },
        _count: { select: { rsvps: true } },
      },
    });
  },

  async delete(id: string) {
    const event = await prisma.event.findUnique({ where: { id } });
    if (!event) throw new NotFoundError('Event not found');
    return prisma.event.delete({ where: { id } });
  },

  async rsvp(eventId: string, userId: string, status: string) {
    const event = await prisma.event.findUnique({ where: { id: eventId } });
    if (!event) throw new NotFoundError('Event not found');

    const existing = await prisma.eventRSVP.findUnique({
      where: { eventId_userId: { eventId, userId } },
    });

    const rsvp = existing
      ? await prisma.eventRSVP.update({
        where: { id: existing.id },
        data: { status },
        include: { user: { select: { id: true, firstName: true, lastName: true } } },
      })
      : await prisma.eventRSVP.create({
        data: { eventId, userId, status },
        include: { user: { select: { id: true, firstName: true, lastName: true } } },
      });

    // P1-13: an RSVP change notifies the event creator (EVENT, email
    // throttled per event per hour). Fire-and-forget.
    if (event.creatorId !== userId) {
      void notificationService
        .create(
          event.creatorId,
          'EVENT',
          'New RSVP for your event',
          `${rsvp.user.firstName} ${rsvp.user.lastName} RSVP'd ${status} to "${event.title}"`,
          { eventId },
          { sendEmail: true, emailThrottleMs: 60 * 60 * 1000, throttleKey: `EVENT:rsvp:${eventId}` },
        )
        .catch((err: any) => {
          console.warn(`[event.rsvp] notify failed for ${eventId}:`, err.message);
        });
    }

    return rsvp;
  },

  async cancelRsvp(eventId: string, userId: string) {
    const existing = await prisma.eventRSVP.findUnique({
      where: { eventId_userId: { eventId, userId } },
    });
    if (!existing) throw new NotFoundError('RSVP not found');
    return prisma.eventRSVP.delete({ where: { id: existing.id } });
  },
};
