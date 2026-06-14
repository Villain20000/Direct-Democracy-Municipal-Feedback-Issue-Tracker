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

  async detectAnomalies() {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const logs = await prisma.auditLog.findMany({
      where: { createdAt: { gte: since } },
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { firstName: true, lastName: true } } },
    });

    const anomalies: Array<{ title: string; severity: string; desc: string; date: string }> = [];

    const bulkByUser: Record<string, number> = {};
    for (const log of logs) {
      if (log.action === 'BULK_UPDATE' || log.action === 'UPDATE_STATUS') {
        bulkByUser[log.userId] = (bulkByUser[log.userId] || 0) + 1;
      }
    }
    for (const [userId, count] of Object.entries(bulkByUser)) {
      if (count >= 5) {
        const user = logs.find(l => l.userId === userId)?.user;
        const name = user ? `${user.firstName} ${user.lastName}` : userId;
        anomalies.push({
          title: 'High volume of status changes',
          severity: count >= 10 ? 'HIGH' : 'MEDIUM',
          desc: `${name} changed ${count} issue statuses in the past 7 days.`,
          date: new Date().toISOString(),
        });
      }
    }

    const offHours = logs.filter(log => {
      const hour = log.createdAt.getHours();
      return log.action.includes('DELETE') && (hour < 7 || hour >= 18);
    });
    if (offHours.length) {
      anomalies.push({
        title: 'Off-hours administrative action',
        severity: 'LOW',
        desc: `${offHours.length} delete action(s) occurred outside business hours (7 AM – 6 PM).`,
        date: offHours[0].createdAt.toISOString(),
      });
    }

    return anomalies.slice(0, 5);
  },
};
