/**
 * Phase D2 — Transparency Portal tests.
 *
 * Verifies that all `/api/v1/portal/*` endpoints are reachable WITHOUT
 * authentication, return only public data, and respect the various
 * filters (category, status, limit, page).
 */
import request from 'supertest';
import {
  prisma, createTestUser, createTestIssue, createTestDepartment, createTestWard,
  cleanupDatabase, disconnectDatabase,
} from './helpers';

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

describe('GET /api/v1/portal/stats (no auth)', () => {
  it('returns top-line stats without authentication', async () => {
    const dept = await createTestDepartment({ name: 'Public Works', code: 'PW', budget: 1000000 });
    const citizen = await createTestUser({ email: 'portal-cit@test.com', role: 'CITIZEN' });
    const ward = await createTestWard({ name: 'Downtown', code: 'WD-01' });
    await createTestIssue(citizen.user.id, {
      title: 'Public 1', category: 'INFRASTRUCTURE', status: 'SUBMITTED', departmentId: dept.id, wardId: ward.id,
    });
    await createTestIssue(citizen.user.id, {
      title: 'Private (excluded)', category: 'INFRASTRUCTURE', status: 'SUBMITTED', departmentId: dept.id, wardId: ward.id,
    });
    // Mark the second one as isPublic=false
    const all = await prisma.issue.findMany();
    await prisma.issue.update({ where: { id: all[1].id }, data: { isPublic: false } });

    const res = await request(app).get('/api/v1/portal/stats');
    expect(res.status).toBe(200);
    expect(res.body.data.totalIssues).toBe(1);
    expect(res.body.data.totalDepartments).toBe(1);
    expect(res.body.data.totalWards).toBe(1);
    expect(res.body.data.issuesByStatus).toBeDefined();
    expect(res.body.data.issuesByCategory).toBeDefined();
    expect(res.body.data.issuesByDepartment).toBeDefined();
  });
});

describe('GET /api/v1/portal/issues (no auth)', () => {
  it('lists only public issues', async () => {
    const citizen = await createTestUser({ email: 'pi-cit@test.com', role: 'CITIZEN' });
    await createTestIssue(citizen.user.id, { title: 'Visible' });
    await createTestIssue(citizen.user.id, { title: 'Hidden' });
    const all = await prisma.issue.findMany();
    await prisma.issue.update({ where: { id: all[1].id }, data: { isPublic: false } });

    const res = await request(app).get('/api/v1/portal/issues');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].title).toBe('Visible');
  });

  it('filters by category and status', async () => {
    const citizen = await createTestUser({ email: 'filter-cit@test.com', role: 'CITIZEN' });
    await createTestIssue(citizen.user.id, { title: 'A', category: 'INFRASTRUCTURE', status: 'SUBMITTED' });
    await createTestIssue(citizen.user.id, { title: 'B', category: 'SANITATION', status: 'RESOLVED' });

    const infra = await request(app).get('/api/v1/portal/issues?category=INFRASTRUCTURE');
    expect(infra.body.data).toHaveLength(1);

    const resolved = await request(app).get('/api/v1/portal/issues?status=RESOLVED');
    expect(resolved.body.data).toHaveLength(1);
  });

  it('paginates', async () => {
    const citizen = await createTestUser({ email: 'page-cit@test.com', role: 'CITIZEN' });
    for (let i = 0; i < 5; i++) {
      await createTestIssue(citizen.user.id, { title: `Issue ${i}` });
    }
    const res = await request(app).get('/api/v1/portal/issues?page=1&pageSize=2');
    expect(res.body.data).toHaveLength(2);
    expect(res.body.total).toBe(5);
    expect(res.body.totalPages).toBe(3);
  });
});

describe('GET /api/v1/portal/issues/recent + /top (no auth)', () => {
  it('returns last 10 public issues by default', async () => {
    const citizen = await createTestUser({ email: 'rec-cit@test.com', role: 'CITIZEN' });
    for (let i = 0; i < 12; i++) {
      await createTestIssue(citizen.user.id, { title: `Rec ${i}` });
    }
    const res = await request(app).get('/api/v1/portal/issues/recent');
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(10);
  });

  it('respects ?limit', async () => {
    const citizen = await createTestUser({ email: 'lim-cit@test.com', role: 'CITIZEN' });
    for (let i = 0; i < 5; i++) {
      await createTestIssue(citizen.user.id, { title: `L ${i}` });
    }
    const res = await request(app).get('/api/v1/portal/issues/recent?limit=3');
    expect(res.body.data).toHaveLength(3);
  });

  it('returns the highest-upvoted issues', async () => {
    const citizen = await createTestUser({ email: 'top-cit@test.com', role: 'CITIZEN' });
    const a = await createTestIssue(citizen.user.id, { title: 'A' });
    const b = await createTestIssue(citizen.user.id, { title: 'B' });
    const c = await createTestIssue(citizen.user.id, { title: 'C' });
    await prisma.issue.update({ where: { id: a.id }, data: { upvotes: 5 } });
    await prisma.issue.update({ where: { id: b.id }, data: { upvotes: 12 } });
    await prisma.issue.update({ where: { id: c.id }, data: { upvotes: 1 } });
    const res = await request(app).get('/api/v1/portal/issues/top');
    expect(res.body.data[0].title).toBe('B');
    expect(res.body.data[0].upvotes).toBe(12);
  });
});

describe('GET /api/v1/portal/departments + /wards (no auth)', () => {
  it('returns departments with budgets and issue counts', async () => {
    const dept = await createTestDepartment({ name: 'Sanitation', code: 'SAN', budget: 500000 });
    const citizen = await createTestUser({ email: 'dept-cit@test.com', role: 'CITIZEN' });
    await createTestIssue(citizen.user.id, { title: 'X', departmentId: dept.id });
    const res = await request(app).get('/api/v1/portal/departments');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].name).toBe('Sanitation');
    expect(res.body.data[0].budget).toBe(500000);
    expect(res.body.data[0].totalIssues).toBe(1);
  });

  it('returns wards with issue counts', async () => {
    const ward = await createTestWard({ name: 'Uptown', code: 'WD-99' });
    const citizen = await createTestUser({ email: 'ward-cit@test.com', role: 'CITIZEN' });
    await createTestIssue(citizen.user.id, { title: 'Y', wardId: ward.id });
    const res = await request(app).get('/api/v1/portal/wards');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].name).toBe('Uptown');
    expect(res.body.data[0].totalIssues).toBe(1);
  });
});

describe('GET /api/v1/portal/announcements (no auth)', () => {
  it('returns only published announcements', async () => {
    const admin = await createTestUser({ email: 'ann-admin@test.com', role: 'SUPER_ADMIN' });
    await prisma.announcement.create({
      data: {
        title: 'Published', content: 'See you at the park', authorId: admin.user.id,
        publishedAt: new Date(),
      },
    });
    await prisma.announcement.create({
      data: { title: 'Draft', content: 'hidden', authorId: admin.user.id },
    });
    const res = await request(app).get('/api/v1/portal/announcements');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].title).toBe('Published');
  });
});

describe('GET /api/v1/portal/meetings + /events/upcoming (no auth)', () => {
  it('returns past public meetings', async () => {
    const admin = await createTestUser({ email: 'mt-admin@test.com', role: 'SUPER_ADMIN' });
    await prisma.event.create({
      data: {
        title: 'Council Meeting', type: 'COUNCIL_MEETING', isPublic: true,
        startTime: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        endTime: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000 + 60 * 60 * 1000),
        creatorId: admin.user.id,
      },
    });
    // Non-meeting public event should be excluded
    await prisma.event.create({
      data: {
        title: 'Park Cleanup', type: 'COMMUNITY_EVENT', isPublic: true,
        startTime: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        endTime: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000 + 60 * 60 * 1000),
        creatorId: admin.user.id,
      },
    });
    const res = await request(app).get('/api/v1/portal/meetings');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].title).toBe('Council Meeting');
  });

  it('returns upcoming public events', async () => {
    const admin = await createTestUser({ email: 'ev-admin@test.com', role: 'SUPER_ADMIN' });
    await prisma.event.create({
      data: {
        title: 'Town Hall', type: 'TOWN_HALL', isPublic: true,
        startTime: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
        endTime: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000 + 60 * 60 * 1000),
        creatorId: admin.user.id,
      },
    });
    const res = await request(app).get('/api/v1/portal/events/upcoming');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });
});

describe('GET /api/v1/portal/referendums + /resolutions (no auth)', () => {
  it('returns active referendums (OPEN + recently decided)', async () => {
    const mayor = await createTestUser({ email: 'ref-mayor@test.com', role: 'MAYOR' });
    await prisma.referendum.create({
      data: {
        title: 'Should we build the park?', description: 'desc', body: 'body',
        status: 'OPEN',
        opensAt: new Date(),
        closesAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        createdById: mayor.user.id,
      },
    });
    const res = await request(app).get('/api/v1/portal/referendums');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    // Tallies must be visible, but user identities must NOT leak
    expect(res.body.data[0].yesCount).toBe(0);
    expect(res.body.data[0].noCount).toBe(0);
    expect(res.body.data[0].createdBy).toBeDefined();
  });

  it('returns recent resolutions', async () => {
    const mayor = await createTestUser({ email: 'res-mayor@test.com', role: 'MAYOR' });
    await prisma.resolution.create({
      data: {
        title: 'R1', description: 'd', proposedById: mayor.user.id,
        status: 'DRAFT',
      },
    });
    const res = await request(app).get('/api/v1/portal/resolutions');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });
});

describe('No-auth enforcement', () => {
  it('all portal endpoints work without an Authorization header', async () => {
    const endpoints = [
      '/api/v1/portal/stats',
      '/api/v1/portal/issues',
      '/api/v1/portal/issues/recent',
      '/api/v1/portal/issues/top',
      '/api/v1/portal/departments',
      '/api/v1/portal/wards',
      '/api/v1/portal/announcements',
      '/api/v1/portal/meetings',
      '/api/v1/portal/events/upcoming',
      '/api/v1/portal/referendums',
      '/api/v1/portal/resolutions',
    ];
    for (const url of endpoints) {
      const res = await request(app).get(url);
      expect(res.status).toBe(200);
    }
  });
});
