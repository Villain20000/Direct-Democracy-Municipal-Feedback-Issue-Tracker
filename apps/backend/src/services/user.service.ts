import bcrypt from 'bcryptjs';
import { prisma } from '../db/client';
import {
  AlreadyExistsError,
  BadRequestError,
  InvalidCredentialsError,
  NotFoundError,
} from '../errors/domain-errors';

export const userService = {
  async getAll(params: { page?: number; pageSize?: number; role?: string; search?: string; departmentId?: string }) {
    const { page = 1, pageSize = 20, role, search, departmentId } = params;
    const where: any = {};
    if (role) where.role = role;
    if (departmentId) where.departmentId = departmentId;
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
    if (!user) throw new NotFoundError('User not found');
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
    if (!user) throw new NotFoundError('User not found');
    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    // Wrong current password is an auth failure (401), not a validation
    // error — the user typed a valid password, just not the *right* one.
    if (!valid) throw new InvalidCredentialsError('Current password is incorrect');
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
    if (existing) throw new AlreadyExistsError('Email already in use');
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
    if (!user) throw new NotFoundError('User not found');
    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    // 401: the user *tried* to authenticate with a password, it just
    // wasn't the right one.
    if (!valid) throw new InvalidCredentialsError('Current password is incorrect');
    // 400: the new password itself is the problem.
    if (newPassword.length < 8) {
      throw new BadRequestError('New password must be at least 8 characters', 'BAD_REQUEST', {
        field: 'newPassword',
        minLength: 8,
      });
    }
    const hash = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({ where: { id }, data: { passwordHash: hash } });
  },
};
