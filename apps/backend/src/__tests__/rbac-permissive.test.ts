import request from 'supertest';
import { createTestUser, createTestIssue, cleanupDatabase, disconnectDatabase } from './helpers';

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

// P2-16 / P2-17 / P2-18 — permissive RBAC alignment. The backend was
// widened to match the PLAN §5 matrix (never narrowed); these tests
// pin the widened surface plus the pre-existing permissive grants.
describe('Permissive RBAC alignment (P2-16/17/18)', () => {
  describe('POST /api/v1/polls (P2-16: WARD_REP added)', () => {
    const pollBody = () => ({
      title: `Ward poll ${Date.now()}`,
      description: 'Should the park get new benches?',
      options: ['Yes', 'No'],
    });

    it('should allow a ward rep to create a poll', async () => {
      const rep = await createTestUser({ email: 'rep@test.com', role: 'WARD_REP' });

      const res = await request(app)
        .post('/api/v1/polls')
        .set('Authorization', `Bearer ${rep.accessToken}`)
        .send(pollBody());

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.title).toContain('Ward poll');
      expect(res.body.data.options).toHaveLength(2);
    });

    it('should still allow council members to create polls', async () => {
      const council = await createTestUser({ email: 'council@test.com', role: 'COUNCIL_MEMBER' });

      const res = await request(app)
        .post('/api/v1/polls')
        .set('Authorization', `Bearer ${council.accessToken}`)
        .send(pollBody());

      expect(res.status).toBe(201);
    });

    it('should still reject citizens', async () => {
      const citizen = await createTestUser({ email: 'citizen@test.com', role: 'CITIZEN' });

      const res = await request(app)
        .post('/api/v1/polls')
        .set('Authorization', `Bearer ${citizen.accessToken}`)
        .send(pollBody());

      expect(res.status).toBe(403);
    });

    it('should still reject unauthenticated callers', async () => {
      const res = await request(app).post('/api/v1/polls').send(pollBody());

      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/v1/announcements (P2-17: MEDIA added)', () => {
    const annBody = () => ({
      title: `Press notice ${Date.now()}`,
      content: 'Coverage update for citizens',
    });

    it('should allow media to publish an announcement', async () => {
      const media = await createTestUser({ email: 'press@test.com', role: 'MEDIA' });

      const res = await request(app)
        .post('/api/v1/announcements')
        .set('Authorization', `Bearer ${media.accessToken}`)
        .send(annBody());

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.title).toContain('Press notice');
    });

    it('should still allow staff to publish announcements', async () => {
      const staff = await createTestUser({ email: 'staff@test.com', role: 'STAFF' });

      const res = await request(app)
        .post('/api/v1/announcements')
        .set('Authorization', `Bearer ${staff.accessToken}`)
        .send(annBody());

      expect(res.status).toBe(201);
    });

    it('should still reject citizens', async () => {
      const citizen = await createTestUser({ email: 'citizen@test.com', role: 'CITIZEN' });

      const res = await request(app)
        .post('/api/v1/announcements')
        .set('Authorization', `Bearer ${citizen.accessToken}`)
        .send(annBody());

      expect(res.status).toBe(403);
    });
  });

  describe('PATCH /api/v1/issues/bulk (P2-18: STAFF + MAYOR kept)', () => {
    it('should allow staff to bulk-update status', async () => {
      const reporter = await createTestUser({ email: 'rep@test.com', role: 'CITIZEN' });
      const staff = await createTestUser({ email: 'staff@test.com', role: 'STAFF' });
      const issue = await createTestIssue(reporter.user.id, {});

      const res = await request(app)
        .patch('/api/v1/issues/bulk')
        .set('Authorization', `Bearer ${staff.accessToken}`)
        .send({ ids: [issue.id], status: 'ACKNOWLEDGED' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should allow the mayor to bulk-update status', async () => {
      const reporter = await createTestUser({ email: 'rep@test.com', role: 'CITIZEN' });
      const mayor = await createTestUser({ email: 'mayor@test.com', role: 'MAYOR' });
      const issue = await createTestIssue(reporter.user.id, {});

      const res = await request(app)
        .patch('/api/v1/issues/bulk')
        .set('Authorization', `Bearer ${mayor.accessToken}`)
        .send({ ids: [issue.id], status: 'ACKNOWLEDGED' });

      expect(res.status).toBe(200);
    });

    it('should reject citizens', async () => {
      const reporter = await createTestUser({ email: 'rep@test.com', role: 'CITIZEN' });
      const issue = await createTestIssue(reporter.user.id, {});

      const res = await request(app)
        .patch('/api/v1/issues/bulk')
        .set('Authorization', `Bearer ${reporter.accessToken}`)
        .send({ ids: [issue.id], status: 'ACKNOWLEDGED' });

      expect(res.status).toBe(403);
    });
  });
});
