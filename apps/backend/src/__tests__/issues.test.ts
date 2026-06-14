import request from 'supertest';
import { prisma, createTestUser, createTestIssue, createTestDepartment, cleanupDatabase, disconnectDatabase } from './helpers';

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

describe('Issue Endpoints', () => {
  describe('POST /api/v1/issues', () => {
    it('should create a new issue when authenticated', async () => {
      const testUser = await createTestUser({ email: 'reporter@test.com' });

      const res = await request(app)
        .post('/api/v1/issues')
        .set('Authorization', `Bearer ${testUser.accessToken}`)
        .send({
          title: 'Pothole on Main Street',
          description: 'Large pothole causing vehicle damage',
          category: 'INFRASTRUCTURE',
          location: '123 Main St',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.title).toBe('Pothole on Main Street');
      expect(res.body.data.category).toBe('INFRASTRUCTURE');
      expect(res.body.data.status).toBe('SUBMITTED');
      expect(res.body.data.reporterId).toBe(testUser.user.id);
    });

    it('should reject issue creation without authentication', async () => {
      const res = await request(app)
        .post('/api/v1/issues')
        .send({
          title: 'Pothole',
          description: 'Test',
          category: 'INFRASTRUCTURE',
          location: '123 Main St',
        });

      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/v1/issues', () => {
    it('should list issues with pagination', async () => {
      const testUser = await createTestUser({ email: 'list@test.com' });

      for (let i = 0; i < 5; i++) {
        await createTestIssue(testUser.user.id, { title: `Issue ${i}` });
      }

      const res = await request(app).get('/api/v1/issues?page=1&pageSize=3');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(3);
      expect(res.body.total).toBe(5);
      expect(res.body.totalPages).toBe(2);
    });

    it('should filter issues by status', async () => {
      const testUser = await createTestUser({ email: 'filter@test.com' });
      await createTestIssue(testUser.user.id, { status: 'SUBMITTED' });
      await createTestIssue(testUser.user.id, { status: 'RESOLVED' });
      await createTestIssue(testUser.user.id, { status: 'SUBMITTED' });

      const res = await request(app).get('/api/v1/issues?status=SUBMITTED');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
      res.body.data.forEach((issue: any) => {
        expect(issue.status).toBe('SUBMITTED');
      });
    });

    it('should search issues by title', async () => {
      const testUser = await createTestUser({ email: 'search@test.com' });
      await createTestIssue(testUser.user.id, { title: 'Pothole on Main Street' });
      await createTestIssue(testUser.user.id, { title: 'Broken streetlight' });

      const res = await request(app).get('/api/v1/issues?search=pothole');

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data[0].title).toContain('Pothole');
    });
  });

  describe('GET /api/v1/issues/:id', () => {
    it('should return issue detail with comments', async () => {
      const testUser = await createTestUser({ email: 'detail@test.com' });
      const issue = await createTestIssue(testUser.user.id, { title: 'Detail Test Issue' });

      const res = await request(app).get(`/api/v1/issues/${issue.id}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.title).toBe('Detail Test Issue');
      expect(res.body.data.comments).toBeDefined();
    });

    it('should return 404 for non-existent issue', async () => {
      const res = await request(app).get('/api/v1/issues/non-existent-id');
      expect(res.status).toBe(404);
    });
  });

  describe('PATCH /api/v1/issues/:id/status', () => {
    it('should update issue status for staff users', async () => {
      const reporter = await createTestUser({ email: 'issue-reporter@test.com', role: 'CITIZEN' });
      const staffUser = await createTestUser({ email: 'staff@test.com', role: 'STAFF' });
      const issue = await createTestIssue(reporter.user.id);

      const res = await request(app)
        .patch(`/api/v1/issues/${issue.id}/status`)
        .set('Authorization', `Bearer ${staffUser.accessToken}`)
        .send({ status: 'IN_PROGRESS', note: 'Starting work' });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('IN_PROGRESS');

      const notification = await prisma.notification.findFirst({
        where: { userId: reporter.user.id, type: 'ISSUE_STATUS_CHANGED' },
      });
      expect(notification).toBeTruthy();

      const audit = await prisma.auditLog.findFirst({
        where: { entityId: issue.id, action: 'UPDATE_STATUS' },
      });
      expect(audit).toBeTruthy();
    });

    it('should reject status update from citizens', async () => {
      const citizen = await createTestUser({ email: 'citizen@test.com', role: 'CITIZEN' });
      const issue = await createTestIssue(citizen.user.id);

      const res = await request(app)
        .patch(`/api/v1/issues/${issue.id}/status`)
        .set('Authorization', `Bearer ${citizen.accessToken}`)
        .send({ status: 'IN_PROGRESS' });

      expect(res.status).toBe(403);
    });
  });

  describe('POST /api/v1/issues/:id/upvote', () => {
    it('should upvote an issue', async () => {
      const voter = await createTestUser({ email: 'voter@test.com' });
      const reporter = await createTestUser({ email: 'reporter2@test.com' });
      const issue = await createTestIssue(reporter.user.id);

      const res = await request(app)
        .post(`/api/v1/issues/${issue.id}/upvote`)
        .set('Authorization', `Bearer ${voter.accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.voted).toBe(true);
    });

    it('should toggle upvote off when already voted', async () => {
      const voter = await createTestUser({ email: 'toggle@test.com' });
      const reporter = await createTestUser({ email: 'reporter3@test.com' });
      const issue = await createTestIssue(reporter.user.id);

      await prisma.vote.create({ data: { value: 1, userId: voter.user.id, issueId: issue.id } });

      const res = await request(app)
        .post(`/api/v1/issues/${issue.id}/upvote`)
        .set('Authorization', `Bearer ${voter.accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.voted).toBe(false);
    });
  });

  describe('GET /api/v1/issues/stats', () => {
    it('should return dashboard statistics', async () => {
      const admin = await createTestUser({ email: 'admin@test.com', role: 'SUPER_ADMIN' });
      const reporter = await createTestUser({ email: 'reporter4@test.com' });

      await createTestIssue(reporter.user.id, { status: 'SUBMITTED' });
      await createTestIssue(reporter.user.id, { status: 'RESOLVED' });
      await createTestIssue(reporter.user.id, { status: 'IN_PROGRESS' });

      const res = await request(app)
        .get('/api/v1/issues/stats')
        .set('Authorization', `Bearer ${admin.accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.totalIssues).toBe(3);
      expect(res.body.data.issuesByCategory).toBeDefined();
      expect(res.body.data.issuesByStatus).toBeDefined();
      expect(res.body.data.avgResolutionTimeDays).toBeDefined();
      expect(res.body.data.totalUsers).toBeGreaterThanOrEqual(2);
    });

    it('should reject invalid status on create', async () => {
      const testUser = await createTestUser({ email: 'invalid-create@test.com' });

      const res = await request(app)
        .post('/api/v1/issues')
        .set('Authorization', `Bearer ${testUser.accessToken}`)
        .send({
          title: 'Bad category issue',
          description: 'Test',
          category: 'INVALID',
          location: '123 Main St',
        });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/v1/issues/templates', () => {
    it('should return issue templates', async () => {
      const testUser = await createTestUser({ email: 'templates@test.com' });

      const res = await request(app)
        .get('/api/v1/issues/templates')
        .set('Authorization', `Bearer ${testUser.accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThan(0);
      expect(res.body.data[0].title).toBeDefined();
    });
  });

  describe('PATCH /api/v1/issues/bulk', () => {
    it('should bulk update issue statuses', async () => {
      const staff = await createTestUser({ email: 'bulk-staff@test.com', role: 'STAFF' });
      const issue1 = await createTestIssue(staff.user.id, { status: 'SUBMITTED' });
      const issue2 = await createTestIssue(staff.user.id, { status: 'SUBMITTED' });

      const res = await request(app)
        .patch('/api/v1/issues/bulk')
        .set('Authorization', `Bearer ${staff.accessToken}`)
        .send({ ids: [issue1.id, issue2.id], status: 'ACKNOWLEDGED' });

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.data[0].status).toBe('ACKNOWLEDGED');
    });
  });

  describe('Smart routing on create', () => {
    it('should auto-assign department based on category', async () => {
      const dept = await createTestDepartment({ code: 'PW', name: 'Public Works' });
      const testUser = await createTestUser({ email: 'routing@test.com' });

      const res = await request(app)
        .post('/api/v1/issues')
        .set('Authorization', `Bearer ${testUser.accessToken}`)
        .send({
          title: 'Pothole on Elm',
          description: 'Large pothole',
          category: 'INFRASTRUCTURE',
          location: 'Elm St',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.departmentId).toBe(dept.id);
    });
  });
});
