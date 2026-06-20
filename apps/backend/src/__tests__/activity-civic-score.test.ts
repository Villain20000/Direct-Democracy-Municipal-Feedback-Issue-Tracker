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

describe('Activity Feed — GET /api/v1/activity', () => {
  it('should reject without authentication', async () => {
    const res = await request(app).get('/api/v1/activity');
    expect(res.status).toBe(401);
  });

  it('should return an empty feed when there is no activity', async () => {
    const user = await createTestUser({ email: 'activity-empty@test.com', role: 'CITIZEN' });
    const res = await request(app)
      .get('/api/v1/activity')
      .set('Authorization', `Bearer ${user.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBe(0);
  });

  it('should include issue_created events for reported issues', async () => {
    const user = await createTestUser({ email: 'activity-reporter@test.com', role: 'CITIZEN' });
    await prisma.issue.create({
      data: {
        title: 'Pothole on 5th Ave',
        description: 'Big pothole',
        category: 'INFRASTRUCTURE',
        status: 'SUBMITTED',
        location: '5th Ave',
        reporterId: user.user.id,
      },
    });

    const res = await request(app)
      .get('/api/v1/activity')
      .set('Authorization', `Bearer ${user.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    const created = res.body.data.find((d: any) => d.type === 'issue_created');
    expect(created).toBeDefined();
    expect(created.issueTitle).toBe('Pothole on 5th Ave');
  });

  it('should respect the limit param and clamp to 50', async () => {
    const user = await createTestUser({ email: 'activity-limit@test.com', role: 'CITIZEN' });
    const res = await request(app)
      .get('/api/v1/activity?limit=999')
      .set('Authorization', `Bearer ${user.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeLessThanOrEqual(50);
  });
});

describe('Civic Score — GET /api/v1/civic-score/:userId', () => {
  it('should reject without authentication', async () => {
    const res = await request(app).get('/api/v1/civic-score/some-id');
    expect(res.status).toBe(401);
  });

  it('should 404 for an unknown user', async () => {
    const user = await createTestUser({ email: 'civic-404@test.com', role: 'CITIZEN' });
    const res = await request(app)
      .get('/api/v1/civic-score/nonexistent-user-id')
      .set('Authorization', `Bearer ${user.accessToken}`);

    expect(res.status).toBe(404);
  });

  it('should compute a score and tier for a new user (Newcomer)', async () => {
    const user = await createTestUser({ email: 'civic-new@test.com', role: 'CITIZEN' });
    const res = await request(app)
      .get(`/api/v1/civic-score/${user.user.id}`)
      .set('Authorization', `Bearer ${user.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.points).toBe(0);
    expect(res.body.data.tier.name).toBe('Newcomer');
    expect(res.body.data.breakdown).toBeDefined();
    expect(res.body.data.breakdown.issuesReported.count).toBe(0);
  });

  it('should award points for reported issues and reach Bronze', async () => {
    const user = await createTestUser({ email: 'civic-bronze@test.com', role: 'CITIZEN' });
    // 6 issues = 30 points → Bronze (>=25)
    for (let i = 0; i < 6; i++) {
      await prisma.issue.create({
        data: {
          title: `Issue ${i}`,
          description: 'desc',
          category: 'OTHER',
          status: 'SUBMITTED',
          location: 'loc',
          reporterId: user.user.id,
        },
      });
    }

    const res = await request(app)
      .get(`/api/v1/civic-score/${user.user.id}`)
      .set('Authorization', `Bearer ${user.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.points).toBe(30);
    expect(res.body.data.tier.name).toBe('Bronze');
    expect(res.body.data.breakdown.issuesReported.count).toBe(6);
    expect(res.body.data.nextTier).not.toBeNull();
    expect(res.body.data.progressToNext).toBeGreaterThanOrEqual(0);
    expect(res.body.data.progressToNext).toBeLessThanOrEqual(100);
  });
});
