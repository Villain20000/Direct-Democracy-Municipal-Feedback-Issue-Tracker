import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../db/client';
import { config } from '../config';
import { AuthUser } from '../middleware/auth.middleware';
import { emailService } from './email.service';
import {
  AlreadyExistsError,
  InvalidCredentialsError,
  InvalidTokenError,
  NotFoundError,
  TokenExpiredError,
} from '../errors/domain-errors';

const SALT_ROUNDS = 12;

function generateAccessToken(user: AuthUser): string {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role, firstName: user.firstName, lastName: user.lastName },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn } as jwt.SignOptions
  );
}

function toAuthResponse(user: {
  id: string; email: string; role: string;
  firstName: string; lastName: string;
  departmentId?: string | null; wardId?: string | null;
}) {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    firstName: user.firstName,
    lastName: user.lastName,
    departmentId: user.departmentId ?? undefined,
    wardId: user.wardId ?? undefined,
  };
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
    if (existing) throw new AlreadyExistsError('Email already registered');

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

    return { accessToken, refreshToken, user: toAuthResponse(user) };
  },

  async login(email: string, password: string) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.isActive) throw new InvalidCredentialsError();

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) throw new InvalidCredentialsError();

    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

    const authUser: AuthUser = {
      id: user.id, email: user.email, role: user.role,
      firstName: user.firstName, lastName: user.lastName,
    };

    const accessToken = generateAccessToken(authUser);
    const refreshToken = await this.createRefreshToken(user.id);

    return { accessToken, refreshToken, user: toAuthResponse(user) };
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
      // Both "we've never seen this token" (InvalidToken) and "we did
      // but it's past its expiry" (TokenExpiredError) are 401, but the
      // machine-readable code lets the client decide whether to send
      // the user back to the login screen vs. silently refresh.
      throw record ? new TokenExpiredError() : new InvalidTokenError('Invalid refresh token');
    }

    // Rotate: delete old, issue new
    await prisma.refreshToken.delete({ where: { id: record.id } });

    const authUser: AuthUser = {
      id: record.user.id, email: record.user.email, role: record.user.role,
      firstName: record.user.firstName, lastName: record.user.lastName,
    };

    const accessToken = generateAccessToken(authUser);
    const newRefreshToken = await this.createRefreshToken(record.user.id);

    return { accessToken, refreshToken: newRefreshToken, user: toAuthResponse(record.user) };
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
    if (!user) throw new NotFoundError('User not found');
    return user;
  },

  async forgotPassword(email: string) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return { message: 'If that email exists, a reset link has been sent.' };

    await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });

    const token = uuidv4();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
    await prisma.passwordResetToken.create({ data: { token, userId: user.id, expiresAt } });
    await emailService.sendPasswordReset(user.email, token);

    return { message: 'If that email exists, a reset link has been sent.' };
  },

  async resetPassword(token: string, newPassword: string) {
    const record = await prisma.passwordResetToken.findUnique({
      where: { token },
      include: { user: true },
    });
    if (!record || record.expiresAt < new Date()) {
      // Same distinction as refresh: unknown token vs. expired token.
      // The client can react differently (re-request reset vs. tell
      // the user to try again).
      throw record ? new TokenExpiredError() : new InvalidTokenError('Invalid reset token');
    }

    const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await prisma.$transaction([
      prisma.user.update({ where: { id: record.userId }, data: { passwordHash } }),
      prisma.passwordResetToken.delete({ where: { id: record.id } }),
      prisma.refreshToken.deleteMany({ where: { userId: record.userId } }),
    ]);

    return { message: 'Password reset successfully' };
  },
};
