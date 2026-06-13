import request from 'supertest';
import { prisma, createTestUser, cleanupDatabase, disconnectDatabase } from './helpers';

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

async function createTestAnnouncement(authorId: string, overrides: { title?: string; isPinned?: boolean } = {}) {
  return prisma.announcement.create({
    data: {
      title: overrides.title || `Announcement ${Date.now()}`,
      content: 'Test announcement content for testing',
      authorId,
      isPinned: overrides.isPinned ?? false,
      publishedAt: new Date(),
    },
  });
}

describe('Announcement Endpoints', () => {
  describe('GET /api/v1/announcements', () => {
    it('should list announcements publicly', async () => {
      const author = await createTestUser({ email: 'author@test.com', role: 'STAFF' });
      await createTestAnnouncement(author.user.id, { title: 'First' });
      await createTestAnnouncement(author.user.id, { title: 'Second' });

      const res = await request(app).get('/api/v1/announcements');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.total).toBe(2);
    });

    it('should return pinned announcements first', async () => {
      const author = await createTestUser({ email: 'author@test.com', role: 'STAFF' });
      await createTestAnnouncement(author.user.id, { title: 'Regular', isPinned: false });
      await createTestAnnouncement(author.user.id, { title: 'Pinned', isPinned: true });

      const res = await request(app).get('/api/v1/announcements');

      expect(res.status).toBe(200);
      expect(res.body.data[0].title).toBe('Pinned');
      expect(res.body.data[0].isPinned).toBe(true);
      expect(res.body.data[1].title).toBe('Regular');
    });

    it('should paginate announcements', async () => {
      const author = await createTestUser({ email: 'author@test.com', role: 'STAFF' });
      for (let i = 0; i < 5; i++) {
        await createTestAnnouncement(author.user.id, { title: `Announcement ${i}` });
      }

      const res = await request(app).get('/api/v1/announcements?page=1&pageSize=2');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.total).toBe(5);
      expect(res.body.totalPages).toBe(3);
    });

    it('should search announcements by title', async () => {
      const author = await createTestUser({ email: 'author@test.com', role: 'STAFF' });
      await createTestAnnouncement(author.user.id, { title: 'Road Closure Notice' });
      await createTestAnnouncement(author.user.id, { title: 'Budget Update' });

      const res = await request(app).get('/api/v1/announcements?search=road');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].title).toContain('Road');
    });

    it('should search announcements by content', async () => {
      const author = await createTestUser({ email: 'author@test.com', role: 'STAFF' });
      await createTestAnnouncement(author.user.id, { title: 'Update' });

      const res = await request(app).get('/api/v1/announcements?search=testing');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
    });
  });

  describe('GET /api/v1/announcements/:id', () => {
    it('should return announcement detail', async () => {
      const author = await createTestUser({ email: 'author@test.com', role: 'STAFF' });
      const announcement = await createTestAnnouncement(author.user.id, { title: 'Detail Test' });

      const res = await request(app).get(`/api/v1/announcements/${announcement.id}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.title).toBe('Detail Test');
      expect(res.body.data.author).toBeDefined();
      expect(res.body.data.content).toBeDefined();
    });

    it('should return 404 for non-existent announcement', async () => {
      const res = await request(app).get('/api/v1/announcements/non-existent-id');
      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/v1/announcements', () => {
    it('should create announcement as staff', async () => {
      const staff = await createTestUser({ email: 'staff@test.com', role: 'STAFF' });

      const res = await request(app)
        .post('/api/v1/announcements')
        .set('Authorization', `Bearer ${staff.accessToken}`)
        .send({ title: 'New Announcement', content: 'Important update for citizens' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.title).toBe('New Announcement');
      expect(res.body.data.content).toBe('Important update for citizens');
      expect(res.body.data.authorId).toBe(staff.user.id);
      expect(res.body.data.publishedAt).toBeDefined();
    });

    it('should create pinned announcement as admin', async () => {
      const admin = await createTestUser({ email: 'admin@test.com', role: 'SUPER_ADMIN' });

      const res = await request(app)
        .post('/api/v1/announcements')
        .set('Authorization', `Bearer ${admin.accessToken}`)
        .send({ title: 'Pinned Notice', content: 'Critical update', isPinned: true });

      expect(res.status).toBe(201);
      expect(res.body.data.isPinned).toBe(true);
    });

    it('should reject announcement creation from citizens', async () => {
      const citizen = await createTestUser({ email: 'citizen@test.com', role: 'CITIZEN' });

      const res = await request(app)
        .post('/api/v1/announcements')
        .set('Authorization', `Bearer ${citizen.accessToken}`)
        .send({ title: 'Citizen Post', content: 'Should not work' });

      expect(res.status).toBe(403);
    });

    it('should reject without authentication', async () => {
      const res = await request(app)
        .post('/api/v1/announcements')
        .send({ title: 'No Auth', content: 'Nope' });

      expect(res.status).toBe(401);
    });
  });

  describe('PATCH /api/v1/announcements/:id', () => {
    it('should update announcement as author', async () => {
      const author = await createTestUser({ email: 'author@test.com', role: 'STAFF' });
      const announcement = await createTestAnnouncement(author.user.id);

      const res = await request(app)
        .patch(`/api/v1/announcements/${announcement.id}`)
        .set('Authorization', `Bearer ${author.accessToken}`)
        .send({ title: 'Updated Title' });

      expect(res.status).toBe(200);
      expect(res.body.data.title).toBe('Updated Title');
    });

    it('should update announcement as super admin', async () => {
      const admin = await createTestUser({ email: 'admin@test.com', role: 'SUPER_ADMIN' });
      const author = await createTestUser({ email: 'author@test.com', role: 'STAFF' });
      const announcement = await createTestAnnouncement(author.user.id);

      const res = await request(app)
        .patch(`/api/v1/announcements/${announcement.id}`)
        .set('Authorization', `Bearer ${admin.accessToken}`)
        .send({ isPinned: true });

      expect(res.status).toBe(200);
      expect(res.body.data.isPinned).toBe(true);
    });

    it('should reject update from non-author non-admin', async () => {
      const author = await createTestUser({ email: 'author@test.com', role: 'STAFF' });
      const other = await createTestUser({ email: 'other@test.com', role: 'STAFF' });
      const announcement = await createTestAnnouncement(author.user.id);

      const res = await request(app)
        .patch(`/api/v1/announcements/${announcement.id}`)
        .set('Authorization', `Bearer ${other.accessToken}`)
        .send({ title: 'Hijacked' });

      expect(res.status).toBe(403);
    });

    it('should reject without authentication', async () => {
      const res = await request(app)
        .patch('/api/v1/announcements/fake-id')
        .send({ title: 'No Auth' });

      expect(res.status).toBe(401);
    });
  });

  describe('DELETE /api/v1/announcements/:id', () => {
    it('should delete announcement as author', async () => {
      const author = await createTestUser({ email: 'author@test.com', role: 'STAFF' });
      const announcement = await createTestAnnouncement(author.user.id);

      const res = await request(app)
        .delete(`/api/v1/announcements/${announcement.id}`)
        .set('Authorization', `Bearer ${author.accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const deleted = await prisma.announcement.findUnique({ where: { id: announcement.id } });
      expect(deleted).toBeNull();
    });

    it('should delete announcement as super admin', async () => {
      const admin = await createTestUser({ email: 'admin@test.com', role: 'SUPER_ADMIN' });
      const author = await createTestUser({ email: 'author@test.com', role: 'STAFF' });
      const announcement = await createTestAnnouncement(author.user.id);

      const res = await request(app)
        .delete(`/api/v1/announcements/${announcement.id}`)
        .set('Authorization', `Bearer ${admin.accessToken}`);

      expect(res.status).toBe(200);
    });

    it('should reject delete from non-author non-admin', async () => {
      const author = await createTestUser({ email: 'author@test.com', role: 'STAFF' });
      const other = await createTestUser({ email: 'other@test.com', role: 'STAFF' });
      const announcement = await createTestAnnouncement(author.user.id);

      const res = await request(app)
        .delete(`/api/v1/announcements/${announcement.id}`)
        .set('Authorization', `Bearer ${other.accessToken}`);

      expect(res.status).toBe(403);
    });

    it('should return 400 for non-existent announcement', async () => {
      const admin = await createTestUser({ email: 'admin@test.com', role: 'SUPER_ADMIN' });

      const res = await request(app)
        .delete('/api/v1/announcements/non-existent-id')
        .set('Authorization', `Bearer ${admin.accessToken}`);

      expect(res.status).toBeGreaterThanOrEqual(400);
    });
  });
});
