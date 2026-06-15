/**
 * Phase B — 10-feature sweep tests.
 *
 * Exercises all seven features end-to-end: create, fetch, and the most
 * important auth/role negative paths. The patterns follow the
 * existing notifications.test.ts / forums.test.ts files.
 */
import request from 'supertest';
import {
  prisma, createTestUser, createTestIssue, cleanupDatabase, disconnectDatabase,
} from './helpers';

let app: any;
let staffToken: string;
let staffUserId: string;
let citizenToken: string;
let citizenUserId: string;
let testIssueId: string;

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
  const staff = await createTestUser({ email: 'staff-fs@test.com', role: 'STAFF' });
  const citizen = await createTestUser({ email: 'citizen-fs@test.com', role: 'CITIZEN' });
  staffToken = staff.accessToken;
  staffUserId = staff.user.id;
  citizenToken = citizen.accessToken;
  citizenUserId = citizen.user.id;
  const issue = await createTestIssue(citizenUserId, { title: 'Phase B test issue' });
  testIssueId = issue.id;
});

// =====================================================================
// B1 — Issue subscriptions
// =====================================================================

describe('B1 — Issue subscriptions', () => {
  it('subscribes the current user to an issue', async () => {
    const res = await request(app)
      .post(`/api/v1/issues/${testIssueId}/subscribe`)
      .set('Authorization', `Bearer ${citizenToken}`);
    expect(res.status).toBe(201);
    expect(res.body.data.userId).toBe(citizenUserId);
    expect(res.body.data.issueId).toBe(testIssueId);
  });

  it('subscribe is idempotent', async () => {
    await request(app).post(`/api/v1/issues/${testIssueId}/subscribe`).set('Authorization', `Bearer ${citizenToken}`);
    const res = await request(app).post(`/api/v1/issues/${testIssueId}/subscribe`).set('Authorization', `Bearer ${citizenToken}`);
    expect(res.status).toBe(201);
    const count = await prisma.issueSubscription.count({ where: { issueId: testIssueId, userId: citizenUserId } });
    expect(count).toBe(1);
  });

  it('unsubscribes', async () => {
    await request(app).post(`/api/v1/issues/${testIssueId}/subscribe`).set('Authorization', `Bearer ${citizenToken}`);
    const res = await request(app)
      .delete(`/api/v1/issues/${testIssueId}/subscribe`)
      .set('Authorization', `Bearer ${citizenToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.removed).toBe(1);
  });

  it('lists my subscriptions', async () => {
    await request(app).post(`/api/v1/issues/${testIssueId}/subscribe`).set('Authorization', `Bearer ${citizenToken}`);
    const res = await request(app)
      .get('/api/v1/users/me/subscriptions')
      .set('Authorization', `Bearer ${citizenToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].issueId).toBe(testIssueId);
  });

  it('lists subscribers (staff+)', async () => {
    await request(app).post(`/api/v1/issues/${testIssueId}/subscribe`).set('Authorization', `Bearer ${citizenToken}`);
    const res = await request(app)
      .get(`/api/v1/issues/${testIssueId}/subscribers`)
      .set('Authorization', `Bearer ${staffToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });

  it('rejects unauthenticated subscribe', async () => {
    const res = await request(app).post(`/api/v1/issues/${testIssueId}/subscribe`);
    expect(res.status).toBe(401);
  });
});

// =====================================================================
// B2 — Issue share links
// =====================================================================

describe('B2 — Issue share links', () => {
  it('staff mints a share link', async () => {
    const res = await request(app)
      .post(`/api/v1/issues/${testIssueId}/share-link`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ expiresInDays: 7 });
    expect(res.status).toBe(201);
    expect(res.body.data.token).toBeDefined();
    expect(new Date(res.body.data.expiresAt).getTime()).toBeGreaterThan(Date.now());
  });

  it('public /share/:token resolves without auth', async () => {
    const create = await request(app)
      .post(`/api/v1/issues/${testIssueId}/share-link`)
      .set('Authorization', `Bearer ${staffToken}`);
    const token = create.body.data.token;
    const res = await request(app).get(`/api/v1/share/${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.issue.id).toBe(testIssueId);
  });

  it('rejects unknown token', async () => {
    const res = await request(app).get('/api/v1/share/this-token-does-not-exist');
    expect(res.status).toBe(404);
  });

  it('citizen cannot mint a share link', async () => {
    const res = await request(app)
      .post(`/api/v1/issues/${testIssueId}/share-link`)
      .set('Authorization', `Bearer ${citizenToken}`)
      .send({});
    expect(res.status).toBe(403);
  });
});

// =====================================================================
// B3 — Saved searches
// =====================================================================

describe('B3 — Saved searches', () => {
  it('creates a saved search', async () => {
    const res = await request(app)
      .post('/api/v1/users/me/saved-searches')
      .set('Authorization', `Bearer ${citizenToken}`)
      .send({ name: 'My open issues', filters: { status: 'SUBMITTED', category: 'INFRASTRUCTURE' } });
    expect(res.status).toBe(201);
    expect(res.body.data.name).toBe('My open issues');
  });

  it('lists my saved searches', async () => {
    await request(app)
      .post('/api/v1/users/me/saved-searches')
      .set('Authorization', `Bearer ${citizenToken}`)
      .send({ name: 'One', filters: { status: 'SUBMITTED' } });
    const res = await request(app)
      .get('/api/v1/users/me/saved-searches')
      .set('Authorization', `Bearer ${citizenToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });

  it('cannot read another user saved search', async () => {
    const create = await request(app)
      .post('/api/v1/users/me/saved-searches')
      .set('Authorization', `Bearer ${citizenToken}`)
      .send({ name: 'Private', filters: {} });
    const id = create.body.data.id;
    const res = await request(app)
      .patch(`/api/v1/users/me/saved-searches/${id}`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ name: 'Hijack' });
    expect(res.status).toBe(403);
  });

  it('validates required fields', async () => {
    const res = await request(app)
      .post('/api/v1/users/me/saved-searches')
      .set('Authorization', `Bearer ${citizenToken}`)
      .send({ filters: {} });
    expect(res.status).toBe(400);
  });
});

// =====================================================================
// B4 — Notification preferences
// =====================================================================

describe('B4 — Notification preferences', () => {
  it('lazily seeds defaults for a new user', async () => {
    const res = await request(app)
      .get('/api/v1/users/me/notification-prefs')
      .set('Authorization', `Bearer ${citizenToken}`);
    expect(res.status).toBe(200);
    // 3 channels * 8 types = 24
    expect(res.body.data.length).toBe(24);
    const inApp = res.body.data.filter((p: any) => p.channel === 'inApp');
    expect(inApp.every((p: any) => p.enabled === true)).toBe(true);
  });

  it('updates a preference', async () => {
    const res = await request(app)
      .put('/api/v1/users/me/notification-prefs')
      .set('Authorization', `Bearer ${citizenToken}`)
      .send({ preferences: [{ channel: 'email', type: 'ISSUE_UPDATE', enabled: true }] });
    expect(res.status).toBe(200);
    const updated = await prisma.notificationPreference.findFirst({
      where: { userId: citizenUserId, channel: 'email', type: 'ISSUE_UPDATE' },
    });
    expect(updated?.enabled).toBe(true);
  });

  it('rejects empty preferences array', async () => {
    const res = await request(app)
      .put('/api/v1/users/me/notification-prefs')
      .set('Authorization', `Bearer ${citizenToken}`)
      .send({ preferences: [] });
    expect(res.status).toBe(400);
  });
});

// =====================================================================
// B5 — Internal notes
// =====================================================================

describe('B5 — Internal notes', () => {
  it('staff can add a note', async () => {
    const res = await request(app)
      .post(`/api/v1/issues/${testIssueId}/internal-notes`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ content: 'Spoke with reporter on the phone, awaiting photos.' });
    expect(res.status).toBe(201);
    expect(res.body.data.content).toContain('Spoke with reporter');
  });

  it('citizen cannot add a note', async () => {
    const res = await request(app)
      .post(`/api/v1/issues/${testIssueId}/internal-notes`)
      .set('Authorization', `Bearer ${citizenToken}`)
      .send({ content: 'Trying to peek' });
    expect(res.status).toBe(403);
  });

  it('staff can list notes for an issue', async () => {
    await request(app)
      .post(`/api/v1/issues/${testIssueId}/internal-notes`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ content: 'Note 1' });
    const res = await request(app)
      .get(`/api/v1/issues/${testIssueId}/internal-notes`)
      .set('Authorization', `Bearer ${staffToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });
});

// =====================================================================
// B6 — SLA tracking
// =====================================================================

describe('B6 — SLA tracking', () => {
  it('creates an SLA for a priority-3 issue', async () => {
    const { slaTrackingService } = await import('../services/sla-tracking.service');
    const sla = await slaTrackingService.upsertForIssue(testIssueId, 3);
    expect(sla.priority).toBe('3');
    expect(sla.breached).toBe(false);
  });

  it('higher priority = earlier dueAt', async () => {
    const { slaTrackingService } = await import('../services/sla-tracking.service');
    const low = await slaTrackingService.upsertForIssue(testIssueId, 1);
    const high = await slaTrackingService.upsertForIssue(testIssueId, 5);
    expect(new Date(high.dueAt).getTime()).toBeLessThan(new Date(low.dueAt).getTime());
  });

  it('marks first response', async () => {
    const { slaTrackingService } = await import('../services/sla-tracking.service');
    await slaTrackingService.upsertForIssue(testIssueId, 3);
    await slaTrackingService.markFirstResponse(testIssueId);
    const row = await prisma.slaTracking.findUnique({ where: { issueId: testIssueId } });
    expect(row?.firstResponseAt).not.toBeNull();
  });

  it('scans for breaches', async () => {
    const { slaTrackingService } = await import('../services/sla-tracking.service');
    // Insert a past-due row
    await prisma.slaTracking.create({
      data: {
        issueId: testIssueId, priority: '5',
        dueAt: new Date(Date.now() - 1000 * 60 * 60),
      },
    });
    const result = await slaTrackingService.scanForBreaches();
    expect(result.breached).toBeGreaterThanOrEqual(1);
  });
});

// =====================================================================
// B7 — Issue assignment history
// =====================================================================

describe('B7 — Issue assignment history', () => {
  it('records an assignment when PATCH /assign is called', async () => {
    const res = await request(app)
      .patch(`/api/v1/issues/${testIssueId}/assign`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ assigneeId: staffUserId });
    expect(res.status).toBe(200);
    // The recordAssignChange call is fire-and-forget, so give it a beat
    await new Promise((r) => setTimeout(r, 50));
    const history = await prisma.issueAssignment.findMany({ where: { issueId: testIssueId } });
    expect(history).toHaveLength(1);
    expect(history[0].assigneeId).toBe(staffUserId);
    expect(history[0].assignedById).toBe(staffUserId);
  });

  it('staff can view assignment history', async () => {
    await prisma.issueAssignment.create({
      data: { issueId: testIssueId, assigneeId: staffUserId, assignedById: citizenUserId },
    });
    const res = await request(app)
      .get(`/api/v1/issues/${testIssueId}/assignment-history`)
      .set('Authorization', `Bearer ${staffToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });

  it('citizen cannot view assignment history', async () => {
    const res = await request(app)
      .get(`/api/v1/issues/${testIssueId}/assignment-history`)
      .set('Authorization', `Bearer ${citizenToken}`);
    expect(res.status).toBe(403);
  });
});
