import bcrypt from 'bcryptjs';
import { prisma } from '../db/client';

export const userService = {
  async getAll(params: { page?: number; pageSize?: number; role?: string; search?: string }) {
    const { page = 1, pageSize = 20, role, search } = params;
    const where: any = {};
    if (role) where.role = role;
    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, email: true, firstName: true, lastName: true,
          phone: true, avatarUrl: true, role: true, isActive: true,
          isVerified: true, lastLoginAt: true, createdAt: true,
        },
      }),
      prisma.user.count({ where }),
    ]);

    return { data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  },

  async getById(id: string) {
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true, email: true, firstName: true, lastName: true,
        phone: true, avatarUrl: true, role: true, isActive: true,
        isVerified: true, lastLoginAt: true, createdAt: true, updatedAt: true,
        wardId: true, departmentId: true,
      },
    });
    if (!user) throw new Error('User not found');
    return user;
  },

  async update(id: string, data: { firstName?: string; lastName?: string; phone?: string; role?: string; isActive?: boolean; wardId?: string; departmentId?: string }) {
    const user = await prisma.user.update({
      where: { id },
      data: {
        ...data,
        role: data.role ? (data.role as any) : undefined,
      },
      select: {
        id: true, email: true, firstName: true, lastName: true,
        phone: true, avatarUrl: true, role: true, isActive: true,
      },
    });
    return user;
  },

  async changePassword(id: string, currentPassword: string, newPassword: string) {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) throw new Error('User not found');
    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) throw new Error('Current password is incorrect');
    const hash = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({ where: { id }, data: { passwordHash: hash } });
  },

  async getStats() {
    const [total, byRole, active, recentlyJoined] = await Promise.all([
      prisma.user.count(),
      prisma.user.groupBy({ by: ['role'], _count: true }),
      prisma.user.count({ where: { isActive: true } }),
      prisma.user.findMany({ take: 5, orderBy: { createdAt: 'desc' }, select: { id: true, firstName: true, lastName: true, role: true, createdAt: true } }),
    ]);
    return { total, active, byRole: Object.fromEntries(byRole.map(r => [r.role, r._count])), recentlyJoined };
  },

  async create(data: {
    email: string; password: string; firstName: string; lastName: string;
    phone?: string; role?: string; wardId?: string; departmentId?: string;
  }) {
    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing) throw new Error('Email already in use');
    const passwordHash = await bcrypt.hash(data.password, 12);
    const user = await prisma.user.create({
      data: {
        email: data.email,
        passwordHash,
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone,
        role: (data.role as any) || 'CITIZEN',
        wardId: data.wardId,
        departmentId: data.departmentId,
        isActive: true,
        isVerified: true,
      },
      select: {
        id: true, email: true, firstName: true, lastName: true,
        phone: true, avatarUrl: true, role: true, isActive: true, createdAt: true,
      },
    });
    return user;
  },

  async changeOwnPassword(id: string, currentPassword: string, newPassword: string) {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) throw new Error('User not found');
    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) throw new Error('Current password is incorrect');
    if (newPassword.length < 8) throw new Error('New password must be at least 8 characters');
    const hash = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({ where: { id }, data: { passwordHash: hash } });
  },
};
