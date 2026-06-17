import request from 'supertest';
import { prisma, createTestUser, createTestNotification, cleanupDatabase, disconnectDatabase } from './helpers';

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

describe('Notification Endpoints', () => {
  describe('GET /api/v1/notifications', () => {
    it('should list notifications for authenticated user', async () => {
      const testUser = await createTestUser({ email: 'notif-user@test.com' });
      await createTestNotification(testUser.user.id, { title: 'First' });
      await createTestNotification(testUser.user.id, { title: 'Second' });

      const res = await request(app)
        .get('/api/v1/notifications')
        .set('Authorization', `Bearer ${testUser.accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.total).toBe(2);
      expect(res.body.unreadCount).toBe(2);
    });

    it('should paginate notifications', async () => {
      const testUser = await createTestUser({ email: 'paginate@test.com' });
      for (let i = 0; i < 5; i++) {
        await createTestNotification(testUser.user.id, { title: `Notif ${i}` });
      }

      const res = await request(app)
        .get('/api/v1/notifications?page=1&pageSize=2')
        .set('Authorization', `Bearer ${testUser.accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.total).toBe(5);
      expect(res.body.totalPages).toBe(3);
    });

    it('should filter unread notifications only', async () => {
      const testUser = await createTestUser({ email: 'unread@test.com' });
      await createTestNotification(testUser.user.id, { title: 'Read', isRead: true });
      await createTestNotification(testUser.user.id, { title: 'Unread 1', isRead: false });
      await createTestNotification(testUser.user.id, { title: 'Unread 2', isRead: false });

      const res = await request(app)
        .get('/api/v1/notifications?unreadOnly=true')
        .set('Authorization', `Bearer ${testUser.accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.unreadCount).toBe(2);
      res.body.data.forEach((n: any) => {
        expect(n.isRead).toBe(false);
      });
    });

    it('should only return own notifications, not other users', async () => {
      const user1 = await createTestUser({ email: 'user1@test.com' });
      const user2 = await createTestUser({ email: 'user2@test.com' });
      await createTestNotification(user1.user.id, { title: 'User1 notif' });
      await createTestNotification(user2.user.id, { title: 'User2 notif' });

      const res = await request(app)
        .get('/api/v1/notifications')
        .set('Authorization', `Bearer ${user1.accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].title).toBe('User1 notif');
    });

    it('should reject without authentication', async () => {
      const res = await request(app).get('/api/v1/notifications');
      expect(res.status).toBe(401);
    });

    it('should return empty list for user with no notifications', async () => {
      const testUser = await createTestUser({ email: 'empty@test.com' });

      const res = await request(app)
        .get('/api/v1/notifications')
        .set('Authorization', `Bearer ${testUser.accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(0);
      expect(res.body.total).toBe(0);
      expect(res.body.unreadCount).toBe(0);
    });
  });

  describe('PATCH /api/v1/notifications/:id/read', () => {
    it('should mark a notification as read', async () => {
      const testUser = await createTestUser({ email: 'markread@test.com' });
      const notif = await createTestNotification(testUser.user.id, { isRead: false });

      const res = await request(app)
        .patch(`/api/v1/notifications/${notif.id}/read`)
        .set('Authorization', `Bearer ${testUser.accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const updated = await prisma.notification.findUnique({ where: { id: notif.id } });
      expect(updated!.isRead).toBe(true);
    });

    it('should handle already-read notification gracefully', async () => {
      const testUser = await createTestUser({ email: 'alreadyread@test.com' });
      const notif = await createTestNotification(testUser.user.id, { isRead: true });

      const res = await request(app)
        .patch(`/api/v1/notifications/${notif.id}/read`)
        .set('Authorization', `Bearer ${testUser.accessToken}`);

      expect(res.status).toBe(200);
    });

    it('should return 404 for a missing notification id', async () => {
      // Mirrors the DELETE missing-id test below. Without this, a
      // regression in `sendDomainError` wiring on `markAsRead` would
      // be silently masked by the > 400 assertions elsewhere in this
      // file (or by the already-read happy path).
      const testUser = await createTestUser({ email: 'patch-notfound@test.com' });

      const res = await request(app)
        .patch('/api/v1/notifications/non-existent-id/read')
        .set('Authorization', `Bearer ${testUser.accessToken}`);

      // Same `markAsRead` → `updateMany({ id, userId })` → `count === 0`
      // → `NotFoundError` → `sendDomainError` → 404 path as the
      // DELETE endpoint, just on the PATCH verb.
      expect(res.status).toBe(404);
      expect(res.body.code).toBe('NOT_FOUND');
      expect(res.body.error).toBe('Notification not found');
    });

    it('should reject without authentication', async () => {
      const res = await request(app).patch('/api/v1/notifications/fake-id/read');
      expect(res.status).toBe(401);
    });

    it('should reject marking another user notification as read', async () => {
      const owner = await createTestUser({ email: 'owner-read@test.com' });
      const other = await createTestUser({ email: 'other-read@test.com' });
      const notif = await createTestNotification(owner.user.id, { isRead: false });

      const res = await request(app)
        .patch(`/api/v1/notifications/${notif.id}/read`)
        .set('Authorization', `Bearer ${other.accessToken}`);

      // PATCH `/:id/read` on a notification owned by someone else:
      // the service's `updateMany({ id, userId })` returns
      // `count === 0`, the service throws `NotFoundError`, and the
      // route's `sendDomainError` maps that to 404. Same regression
      // lock-in as the missing-id case below — a > 400 would have
      // masked 500 mode.
      expect(res.status).toBe(404);
      expect(res.body.code).toBe('NOT_FOUND');

      const unchanged = await prisma.notification.findUnique({ where: { id: notif.id } });
      expect(unchanged!.isRead).toBe(false);
    });
  });

  describe('PATCH /api/v1/notifications/read-all', () => {
    it('should mark all notifications as read', async () => {
      const testUser = await createTestUser({ email: 'readall@test.com' });
      await createTestNotification(testUser.user.id, { title: 'N1', isRead: false });
      await createTestNotification(testUser.user.id, { title: 'N2', isRead: false });
      await createTestNotification(testUser.user.id, { title: 'N3', isRead: true });

      const res = await request(app)
        .patch('/api/v1/notifications/read-all')
        .set('Authorization', `Bearer ${testUser.accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const unreadCount = await prisma.notification.count({
        where: { userId: testUser.user.id, isRead: false },
      });
      expect(unreadCount).toBe(0);
    });

    it('should reject without authentication', async () => {
      const res = await request(app).patch('/api/v1/notifications/read-all');
      expect(res.status).toBe(401);
    });
  });

  describe('DELETE /api/v1/notifications/:id', () => {
    it('should delete a notification', async () => {
      const testUser = await createTestUser({ email: 'delete@test.com' });
      const notif = await createTestNotification(testUser.user.id);

      const res = await request(app)
        .delete(`/api/v1/notifications/${notif.id}`)
        .set('Authorization', `Bearer ${testUser.accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const deleted = await prisma.notification.findUnique({ where: { id: notif.id } });
      expect(deleted).toBeNull();
    });

    it('should return 404 for a non-existent notification id', async () => {
      const testUser = await createTestUser({ email: 'del-notfound@test.com' });

      const res = await request(app)
        .delete('/api/v1/notifications/non-existent-id')
        .set('Authorization', `Bearer ${testUser.accessToken}`);

      // The previous assertion (`toBeGreaterThanOrEqual(400)`) was
      // accurate but underspecified — it would have hidden a
      // regression where delete-on-missing silently returned 500
      // (the message falls through to the bare 500 catch when
      // `sendDomainError` isn't called in the route). The service
      // now throws `NotFoundError` and the route delegates via
      // `sendDomainError`, so the answer is firmly 404.
      expect(res.status).toBe(404);
      // Lock in the machine-readable error code so the frontend can
      // branch on it without parsing the human message. We don't
      // assert the exact human string \u2014 a cosmetic copy tweak
      // shouldn't break the test.
      expect(res.body.code).toBe('NOT_FOUND');
      expect(res.body.error).toMatch(/not found/i);
    });

    it('should reject without authentication', async () => {
      const res = await request(app).delete('/api/v1/notifications/fake-id');
      expect(res.status).toBe(401);
    });

    it('should reject deleting another user notification', async () => {
      const owner = await createTestUser({ email: 'owner-del@test.com' });
      const other = await createTestUser({ email: 'other-del@test.com' });
      const notif = await createTestNotification(owner.user.id);

      const res = await request(app)
        .delete(`/api/v1/notifications/${notif.id}`)
        .set('Authorization', `Bearer ${other.accessToken}`);

      // Cross-user delete: same code path as delete-on-missing -
      // the service's `deleteMany({ id, userId })` returns
      // `count === 0` and throws `NotFoundError`. The route's
      // `sendDomainError` then maps to 404. (We *could* arguably
      // expose 403 vs. 404 here to avoid leaking the existence of
      // another user's notification, but that's a separate security
      // fix; the current behavior matches the other related tests in
      // this file.)
      expect(res.status).toBe(404);
      expect(res.body.code).toBe('NOT_FOUND');

      const stillExists = await prisma.notification.findUnique({ where: { id: notif.id } });
      expect(stillExists).not.toBeNull();
    });
  });
});
