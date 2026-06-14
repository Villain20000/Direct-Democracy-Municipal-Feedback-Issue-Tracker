import { prisma } from '../db/client';

function escapeCsv(value: unknown): string {
  const str = value == null ? '' : String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export const reportsService = {
  async exportIssuesCsv(filters?: { status?: string; departmentId?: string; wardId?: string }) {
    const where: any = {};
    if (filters?.status) where.status = filters.status;
    if (filters?.departmentId) where.departmentId = filters.departmentId;
    if (filters?.wardId) where.wardId = filters.wardId;

    const issues = await prisma.issue.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        reporter: { select: { email: true, firstName: true, lastName: true } },
        department: { select: { name: true, code: true } },
        ward: { select: { name: true, code: true } },
      },
    });

    const headers = ['id', 'title', 'category', 'status', 'priority', 'location', 'reporter', 'department', 'ward', 'upvotes', 'createdAt', 'resolvedAt'];
    const rows = issues.map(i => [
      i.id, i.title, i.category, i.status, i.priority ?? '',
      i.location,
      i.reporter ? `${i.reporter.firstName} ${i.reporter.lastName} <${i.reporter.email}>` : '',
      i.department?.name ?? '', i.ward?.name ?? '',
      i.upvotes, i.createdAt.toISOString(), i.resolvedAt?.toISOString() ?? '',
    ].map(escapeCsv).join(','));

    return [headers.join(','), ...rows].join('\n');
  },

  async exportAuditCsv(filters?: { userId?: string; entity?: string; action?: string }) {
    const where: any = {};
    if (filters?.userId) where.userId = filters.userId;
    if (filters?.entity) where.entity = filters.entity;
    if (filters?.action) where.action = filters.action;

    const logs = await prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { email: true, firstName: true, lastName: true } } },
    });

    const headers = ['id', 'timestamp', 'user', 'action', 'entity', 'entityId', 'ipAddress'];
    const rows = logs.map(l => [
      l.id, l.createdAt.toISOString(),
      l.user ? `${l.user.firstName} ${l.user.lastName} <${l.user.email}>` : l.userId,
      l.action, l.entity, l.entityId, l.ipAddress ?? '',
    ].map(escapeCsv).join(','));

    return [headers.join(','), ...rows].join('\n');
  },
};