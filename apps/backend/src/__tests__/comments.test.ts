import request from 'supertest';
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

describe('Comment Endpoints', () => {
  it('should create a comment and notify issue reporter', async () => {
    const reporter = await createTestUser({ email: 'reporter-comment@test.com', role: 'CITIZEN' });
    const commenter = await createTestUser({ email: 'commenter@test.com', role: 'STAFF' });
    const issue = await createTestIssue(reporter.user.id, { title: 'Comment Test Issue' });

    const res = await request(app)
      .post(`/api/v1/issues/${issue.id}/comments`)
      .set('Authorization', `Bearer ${commenter.accessToken}`)
      .send({ content: 'We are looking into this issue.' });

    expect(res.status).toBe(201);
    expect(res.body.data.content).toContain('looking into');

    const notification = await prisma.notification.findFirst({
      where: { userId: reporter.user.id, type: 'ISSUE_COMMENT' },
    });
    expect(notification).toBeTruthy();

    const audit = await prisma.auditLog.findFirst({
      where: { entity: 'Comment', action: 'CREATE' },
    });
    expect(audit).toBeTruthy();
  });

  it('should list comments for an issue', async () => {
    const user = await createTestUser({ email: 'list-comments@test.com' });
    const issue = await createTestIssue(user.user.id);

    await request(app)
      .post(`/api/v1/issues/${issue.id}/comments`)
      .set('Authorization', `Bearer ${user.accessToken}`)
      .send({ content: 'First comment' });

    const res = await request(app).get(`/api/v1/issues/${issue.id}/comments`);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
  });
});