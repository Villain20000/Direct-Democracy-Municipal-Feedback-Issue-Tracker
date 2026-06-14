import request from 'supertest';
import path from 'path';
import fs from 'fs';
import { prisma, createTestUser, createTestIssue, cleanupDatabase, disconnectDatabase } from './helpers';

let app: any;

beforeAll(async () => {
  const appModule = await import('../index');
  app = appModule.default;
});

afterAll(async () => {
  await cleanupDatabase();
  await disconnectDatabase();
});

beforeEach(async () => {
  await cleanupDatabase();
});

describe('Attachment Endpoints', () => {
  describe('POST /api/v1/issues/:issueId/attachments', () => {
    it('should reject upload for non-existent issue', async () => {
      const testUser = await createTestUser({ email: 'upload@test.com' });
      const filePath = path.join(__dirname, 'fixtures', 'test.txt');

      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, 'test file content');

      const res = await request(app)
        .post('/api/v1/issues/non-existent-id/attachments')
        .set('Authorization', `Bearer ${testUser.accessToken}`)
        .attach('file', filePath);

      expect(res.status).toBe(404);
      fs.unlinkSync(filePath);
    });
  });

  describe('DELETE /api/v1/attachments/:id', () => {
    it('should reject delete from unauthorized user', async () => {
      const reporter = await createTestUser({ email: 'reporter-att@test.com' });
      const other = await createTestUser({ email: 'other-att@test.com' });
      const issue = await createTestIssue(reporter.user.id);

      const attachment = await prisma.attachment.create({
        data: {
          fileName: 'photo.jpg',
          fileUrl: '/uploads/test-photo.jpg',
          fileSize: 1024,
          mimeType: 'image/jpeg',
          issueId: issue.id,
          uploadedBy: reporter.user.id,
        },
      });

      const res = await request(app)
        .delete(`/api/v1/attachments/${attachment.id}`)
        .set('Authorization', `Bearer ${other.accessToken}`);

      expect(res.status).toBe(403);

      const stillExists = await prisma.attachment.findUnique({ where: { id: attachment.id } });
      expect(stillExists).not.toBeNull();
    });

    it('should allow uploader to delete attachment', async () => {
      const reporter = await createTestUser({ email: 'uploader-att@test.com' });
      const issue = await createTestIssue(reporter.user.id);

      const attachment = await prisma.attachment.create({
        data: {
          fileName: 'doc.pdf',
          fileUrl: '/uploads/test-doc.pdf',
          fileSize: 2048,
          mimeType: 'application/pdf',
          issueId: issue.id,
          uploadedBy: reporter.user.id,
        },
      });

      const res = await request(app)
        .delete(`/api/v1/attachments/${attachment.id}`)
        .set('Authorization', `Bearer ${reporter.accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const deleted = await prisma.attachment.findUnique({ where: { id: attachment.id } });
      expect(deleted).toBeNull();
    });
  });
});