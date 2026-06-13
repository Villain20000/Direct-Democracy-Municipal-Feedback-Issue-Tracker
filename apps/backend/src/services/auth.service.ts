import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../db/client';
import { config } from '../config';
import { AuthUser } from '../middleware/auth.middleware';

const SALT_ROUNDS = 12;

function generateAccessToken(user: AuthUser): string {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role, firstName: user.firstName, lastName: user.lastName },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn } as jwt.SignOptions
  );
}

function parseExpiresIn(ms: string): number {
  const unit = ms.slice(-1);
  const value = parseInt(ms.slice(0, -1), 10);
  switch (unit) {
    case 'm': return value * 60 * 1000;
    case 'h': return value * 60 * 60 * 1000;
    case 'd': return value * 24 * 60 * 60 * 1000;
    default: return 7 * 24 * 60 * 60 * 1000;
  }
}

export const authService = {
  async register(data: { email: string; password: string; firstName: string; lastName: string; phone?: string; role?: string }) {
    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing) throw new Error('Email already registered');

    const passwordHash = await bcrypt.hash(data.password, SALT_ROUNDS);
    const user = await prisma.user.create({
      data: {
        email: data.email,
        passwordHash,
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone,
        role: (data.role as any) || 'CITIZEN',
      },
    });

    const authUser: AuthUser = {
      id: user.id, email: user.email, role: user.role,
      firstName: user.firstName, lastName: user.lastName,
    };

    const accessToken = generateAccessToken(authUser);
    const refreshToken = await this.createRefreshToken(user.id);

    return { accessToken, refreshToken, user: { ...authUser, id: user.id } };
  },

  async login(email: string, password: string) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.isActive) throw new Error('Invalid credentials');

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) throw new Error('Invalid credentials');

    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

    const authUser: AuthUser = {
      id: user.id, email: user.email, role: user.role,
      firstName: user.firstName, lastName: user.lastName,
    };

    const accessToken = generateAccessToken(authUser);
    const refreshToken = await this.createRefreshToken(user.id);

    return { accessToken, refreshToken, user: authUser };
  },

  async createRefreshToken(userId: string) {
    const token = uuidv4();
    const expiresAt = new Date(Date.now() + parseExpiresIn(config.jwt.refreshExpiresIn));
    await prisma.refreshToken.create({ data: { token, userId, expiresAt } });
    return token;
  },

  async refresh(refreshToken: string) {
    const record = await prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      include: { user: true },
    });
    if (!record || record.expiresAt < new Date()) {
      throw new Error('Invalid or expired refresh token');
    }

    // Rotate: delete old, issue new
    await prisma.refreshToken.delete({ where: { id: record.id } });

    const authUser: AuthUser = {
      id: record.user.id, email: record.user.email, role: record.user.role,
      firstName: record.user.firstName, lastName: record.user.lastName,
    };

    const accessToken = generateAccessToken(authUser);
    const newRefreshToken = await this.createRefreshToken(record.user.id);

    return { accessToken, refreshToken: newRefreshToken, user: authUser };
  },

  async logout(refreshToken: string) {
    await prisma.refreshToken.deleteMany({ where: { token: refreshToken } });
  },

  async getProfile(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
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
};
