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

describe('User Endpoints', () => {
  describe('GET /api/v1/users', () => {
    it('should list all users for super admin', async () => {
      const admin = await createTestUser({ email: 'admin@test.com', role: 'SUPER_ADMIN' });
      await createTestUser({ email: 'citizen1@test.com', firstName: 'Alice' });
      await createTestUser({ email: 'citizen2@test.com', firstName: 'Bob' });

      const res = await request(app)
        .get('/api/v1/users')
        .set('Authorization', `Bearer ${admin.accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(3);
      expect(res.body.total).toBeGreaterThanOrEqual(3);
    });

    it('should list all users for auditor', async () => {
      const auditor = await createTestUser({ email: 'auditor@test.com', role: 'AUDITOR' });
      await createTestUser({ email: 'citizen3@test.com' });

      const res = await request(app)
        .get('/api/v1/users')
        .set('Authorization', `Bearer ${auditor.accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should reject listing users from non-admin roles', async () => {
      const citizen = await createTestUser({ email: 'citizen@test.com', role: 'CITIZEN' });

      const res = await request(app)
        .get('/api/v1/users')
        .set('Authorization', `Bearer ${citizen.accessToken}`);

      expect(res.status).toBe(403);
    });

    it('should filter users by role', async () => {
      const admin = await createTestUser({ email: 'admin@test.com', role: 'SUPER_ADMIN' });
      await createTestUser({ email: 'staff@test.com', role: 'STAFF' });
      await createTestUser({ email: 'citizen@test.com', role: 'CITIZEN' });

      const res = await request(app)
        .get('/api/v1/users?role=STAFF')
        .set('Authorization', `Bearer ${admin.accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].role).toBe('STAFF');
    });

    it('should search users by name', async () => {
      const admin = await createTestUser({ email: 'admin@test.com', role: 'SUPER_ADMIN' });
      await createTestUser({ email: 'john@test.com', firstName: 'John', lastName: 'Smith' });
      await createTestUser({ email: 'jane@test.com', firstName: 'Jane', lastName: 'Doe' });

      const res = await request(app)
        .get('/api/v1/users?search=John')
        .set('Authorization', `Bearer ${admin.accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].firstName).toBe('John');
    });

    it('should paginate users', async () => {
      const admin = await createTestUser({ email: 'admin@test.com', role: 'SUPER_ADMIN' });
      for (let i = 0; i < 5; i++) {
        await createTestUser({ email: `user${i}@test.com` });
      }

      const res = await request(app)
        .get('/api/v1/users?page=1&pageSize=3')
        .set('Authorization', `Bearer ${admin.accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(3);
      expect(res.body.total).toBeGreaterThanOrEqual(6);
    });

    it('should reject without authentication', async () => {
      const res = await request(app).get('/api/v1/users');
      expect(res.status).toBe(401);
    });

    it('should not expose passwordHash in results', async () => {
      const admin = await createTestUser({ email: 'admin@test.com', role: 'SUPER_ADMIN' });

      const res = await request(app)
        .get('/api/v1/users')
        .set('Authorization', `Bearer ${admin.accessToken}`);

      expect(res.status).toBe(200);
      res.body.data.forEach((u: any) => {
        expect(u.passwordHash).toBeUndefined();
      });
    });
  });

  describe('GET /api/v1/users/stats', () => {
    it('should return user statistics for super admin', async () => {
      const admin = await createTestUser({ email: 'admin@test.com', role: 'SUPER_ADMIN' });
      await createTestUser({ email: 'staff@test.com', role: 'STAFF' });
      await createTestUser({ email: 'citizen@test.com', role: 'CITIZEN' });

      const res = await request(app)
        .get('/api/v1/users/stats')
        .set('Authorization', `Bearer ${admin.accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.total).toBeGreaterThanOrEqual(3);
      expect(res.body.data.active).toBeGreaterThanOrEqual(3);
      expect(res.body.data.byRole).toBeDefined();
      expect(res.body.data.recentlyJoined).toBeDefined();
    });

    it('should reject stats from non-admin users', async () => {
      const citizen = await createTestUser({ email: 'citizen@test.com', role: 'CITIZEN' });

      const res = await request(app)
        .get('/api/v1/users/stats')
        .set('Authorization', `Bearer ${citizen.accessToken}`);

      expect(res.status).toBe(403);
    });

    it('should reject stats from auditor (admin-only endpoint)', async () => {
      const auditor = await createTestUser({ email: 'auditor@test.com', role: 'AUDITOR' });

      const res = await request(app)
        .get('/api/v1/users/stats')
        .set('Authorization', `Bearer ${auditor.accessToken}`);

      expect(res.status).toBe(403);
    });

    it('should reject without authentication', async () => {
      const res = await request(app).get('/api/v1/users/stats');
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/v1/users/:id', () => {
    it('should return user details for authenticated user', async () => {
      const admin = await createTestUser({ email: 'admin@test.com', role: 'SUPER_ADMIN' });
      const target = await createTestUser({ email: 'target@test.com', firstName: 'Target' });

      const res = await request(app)
        .get(`/api/v1/users/${target.user.id}`)
        .set('Authorization', `Bearer ${admin.accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.email).toBe('target@test.com');
      expect(res.body.data.firstName).toBe('Target');
      expect(res.body.data.passwordHash).toBeUndefined();
    });

    it('should return 404 for non-existent user', async () => {
      const admin = await createTestUser({ email: 'admin@test.com', role: 'SUPER_ADMIN' });

      const res = await request(app)
        .get('/api/v1/users/non-existent-id')
        .set('Authorization', `Bearer ${admin.accessToken}`);

      expect(res.status).toBe(404);
    });

    it('should reject without authentication', async () => {
      const res = await request(app).get('/api/v1/users/some-id');
      expect(res.status).toBe(401);
    });
  });

  describe('PATCH /api/v1/users/:id', () => {
    it('should update user as super admin', async () => {
      const admin = await createTestUser({ email: 'admin@test.com', role: 'SUPER_ADMIN' });
      const target = await createTestUser({ email: 'update@test.com', firstName: 'Old' });

      const res = await request(app)
        .patch(`/api/v1/users/${target.user.id}`)
        .set('Authorization', `Bearer ${admin.accessToken}`)
        .send({ firstName: 'New', role: 'STAFF' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.firstName).toBe('New');
      expect(res.body.data.role).toBe('STAFF');
    });

    it('should reject update from non-admin users', async () => {
      const citizen = await createTestUser({ email: 'citizen@test.com', role: 'CITIZEN' });
      const target = await createTestUser({ email: 'target@test.com' });

      const res = await request(app)
        .patch(`/api/v1/users/${target.user.id}`)
        .set('Authorization', `Bearer ${citizen.accessToken}`)
        .send({ firstName: 'Hacked' });

      expect(res.status).toBe(403);
    });

    it('should toggle user active status', async () => {
      const admin = await createTestUser({ email: 'admin@test.com', role: 'SUPER_ADMIN' });
      const target = await createTestUser({ email: 'toggle@test.com' });

      const res = await request(app)
        .patch(`/api/v1/users/${target.user.id}`)
        .set('Authorization', `Bearer ${admin.accessToken}`)
        .send({ isActive: false });

      expect(res.status).toBe(200);
      expect(res.body.data.isActive).toBe(false);
    });    it('should reject update from auditor (admin-only endpoint)', async () => {
      const auditor = await createTestUser({ email: 'auditor@test.com', role: 'AUDITOR' });
      const target = await createTestUser({ email: 'target@test.com' });

      const res = await request(app)
        .patch(`/api/v1/users/${target.user.id}`)
        .set('Authorization', `Bearer ${auditor.accessToken}`)
        .send({ firstName: 'Hacked' });

      expect(res.status).toBe(403);
    });

    it('should return 400/404 for non-existent user', async () => {
      const admin = await createTestUser({ email: 'admin@test.com', role: 'SUPER_ADMIN' });

      const res = await request(app)
        .patch('/api/v1/users/non-existent-id')
        .set('Authorization', `Bearer ${admin.accessToken}`)
        .send({ firstName: 'Ghost' });

      expect(res.status).toBeGreaterThanOrEqual(400);
    });

    it('should reject without authentication', async () => {
      const res = await request(app).patch('/api/v1/users/some-id').send({ firstName: 'NoAuth' });
      expect(res.status).toBe(401);
    });
  });
});
