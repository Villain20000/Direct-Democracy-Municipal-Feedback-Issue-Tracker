import { prisma } from '../db/client';

export const eventService = {
  async create(data: {
    title: string; description?: string; location?: string;
    startTime: string; endTime: string; type: string;
    creatorId: string; isPublic?: boolean;
  }) {
    return prisma.event.create({
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
    if (!event) throw new Error('Event not found');
    return event;
  },

  async update(id: string, data: {
    title?: string; description?: string; location?: string;
    startTime?: string; endTime?: string; type?: string; isPublic?: boolean;
  }) {
    const event = await prisma.event.findUnique({ where: { id } });
    if (!event) throw new Error('Event not found');

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
    if (!event) throw new Error('Event not found');
    return prisma.event.delete({ where: { id } });
  },

  async rsvp(eventId: string, userId: string, status: string) {
    const event = await prisma.event.findUnique({ where: { id: eventId } });
    if (!event) throw new Error('Event not found');

    const existing = await prisma.eventRSVP.findUnique({
      where: { eventId_userId: { eventId, userId } },
    });

    if (existing) {
      return prisma.eventRSVP.update({
        where: { id: existing.id },
        data: { status },
        include: { user: { select: { id: true, firstName: true, lastName: true } } },
      });
    }

    return prisma.eventRSVP.create({
      data: { eventId, userId, status },
      include: { user: { select: { id: true, firstName: true, lastName: true } } },
    });
  },

  async cancelRsvp(eventId: string, userId: string) {
    const existing = await prisma.eventRSVP.findUnique({
      where: { eventId_userId: { eventId, userId } },
    });
    if (!existing) throw new Error('RSVP not found');
    return prisma.eventRSVP.delete({ where: { id: existing.id } });
  },
};
