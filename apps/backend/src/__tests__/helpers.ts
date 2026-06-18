import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

const JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

export { prisma };

export async function createTestUser(overrides: {
  email?: string;
  password?: string;
  firstName?: string;
  lastName?: string;
  role?: string;
  wardId?: string;
  departmentId?: string;
} = {}) {
  const password = overrides.password || 'testpass123';
  const passwordHash = await bcrypt.hash(password, 4);

  const user = await prisma.user.create({
    data: {
      email: overrides.email || `test-${Date.now()}@example.com`,
      passwordHash,
      firstName: overrides.firstName || 'Test',
      lastName: overrides.lastName || 'User',
      role: (overrides.role as any) || 'CITIZEN',
      wardId: overrides.wardId,
      departmentId: overrides.departmentId,
    },
  });

  const accessToken = jwt.sign(
    { id: user.id, email: user.email, role: user.role, firstName: user.firstName, lastName: user.lastName },
    JWT_SECRET,
    { expiresIn: '15m' }
  );

  return { user, accessToken, password };
}

export async function createTestDepartment(overrides: { name?: string; code?: string; budget?: number } = {}) {
  return prisma.department.create({
    data: {
      name: overrides.name || `Dept ${Date.now()}`,
      code: overrides.code || `TD${String.fromCharCode(65 + Math.floor(Math.random() * 26))}`,
      budget: overrides.budget || 1000000,
    },
  });
}

export async function createTestWard(overrides: { name?: string; code?: string } = {}) {
  return prisma.ward.create({
    data: {
      name: overrides.name || `Ward ${Date.now()}`,
      code: overrides.code || `WD-${String(Math.floor(Math.random() * 100)).padStart(2, '0')}`,
    },
  });
}

export async function createTestIssue(reporterId: string, overrides: { title?: string; category?: string; status?: string; departmentId?: string; wardId?: string } = {}) {
  return prisma.issue.create({
    data: {
      title: overrides.title || `Issue ${Date.now()}`,
      description: 'Test issue description for automated testing',
      category: (overrides.category as any) || 'INFRASTRUCTURE',
      status: (overrides.status as any) || 'SUBMITTED',
      location: '123 Test Street',
      reporterId,
      departmentId: overrides.departmentId,
      wardId: overrides.wardId,
    },
  });
}

export async function createTestNotification(userId: string, overrides: { type?: string; title?: string; message?: string; isRead?: boolean } = {}) {
  return prisma.notification.create({
    data: {
      userId,
      type: overrides.type || 'ISSUE_UPDATE',
      title: overrides.title || 'Test Notification',
      message: overrides.message || 'This is a test notification',
      isRead: overrides.isRead ?? false,
    },
  });
}

export async function cleanupDatabase() {
  await prisma.statusHistory.deleteMany();
  await prisma.issueTag.deleteMany();
  await prisma.comment.deleteMany();
  await prisma.vote.deleteMany();
  await prisma.attachment.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.message.deleteMany();
  await prisma.resolution.deleteMany();
  // Phase D1 — referendum tracker (vote rows first because of FK CASCADE)
  await prisma.referendumVote.deleteMany();
  await prisma.referendum.deleteMany();
  await prisma.eventRSVP.deleteMany();
  await prisma.event.deleteMany();
  await prisma.announcement.deleteMany();
  await prisma.forumPost.deleteMany();
  await prisma.forum.deleteMany();
  await prisma.passwordResetToken.deleteMany();
  await prisma.surveyResponse.deleteMany();
  await prisma.surveyQuestion.deleteMany();
  await prisma.survey.deleteMany();
  await prisma.pollOption.deleteMany();
  await prisma.poll.deleteMany();
  // Phase B — 10-feature sweep tables
  await prisma.issueAssignment.deleteMany();
  await prisma.slaTracking.deleteMany();
  await prisma.internalNote.deleteMany();
  await prisma.issueShareLink.deleteMany();
  await prisma.issueSubscription.deleteMany();
  await prisma.savedSearchAlert.deleteMany();
  await prisma.savedSearchEmbedding.deleteMany();
  await prisma.savedSearch.deleteMany();
  await prisma.faqChunk.deleteMany();
  await prisma.faqEntry.deleteMany();
  await prisma.notificationPreference.deleteMany();
  await prisma.documentChunk.deleteMany();
  await prisma.document.deleteMany();
  await prisma.issueEmbedding.deleteMany();
  // Phase C — weekly executive briefings
  await prisma.weeklySummary.deleteMany();
  await prisma.issue.deleteMany();
  await prisma.departmentWard.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.user.deleteMany();
  await prisma.department.deleteMany();
  await prisma.ward.deleteMany();
}

export async function disconnectDatabase() {
  await prisma.$disconnect();
}
