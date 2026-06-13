import { prisma } from '../db/client';

export const auditService = {
  async log(data: { userId: string; action: string; entity: string; entityId: string; oldValues?: any; newValues?: any; ipAddress?: string }) {
    return prisma.auditLog.create({ data });
  },

  async getAll(params: { page?: number; pageSize?: number; userId?: string; entity?: string; action?: string }) {
    const { page = 1, pageSize = 20, userId, entity, action } = params;
    const where: any = {};
    if (userId) where.userId = userId;
    if (entity) where.entity = entity;
    if (action) where.action = action;

    const [data, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } },
      }),
      prisma.auditLog.count({ where }),
    ]);

    return { data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  },

  async getByEntity(entity: string, entityId: string) {
    return prisma.auditLog.findMany({
      where: { entity, entityId },
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { id: true, firstName: true, lastName: true } } },
    });
  },
};
