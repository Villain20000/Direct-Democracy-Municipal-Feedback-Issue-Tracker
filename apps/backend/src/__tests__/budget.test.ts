/**
 * P1-9 — Budget management tests (PLAN §10 budget tracker / allocation vs
 * spending / expenditure audit trail).
 *
 * Covers BudgetLine + Expense CRUD via /api/v1/budget, the spend-vs-budget
 * summary hook, the expense CSV exports, and RBAC (dept-head scoping,
 * citizen forbidden, unauthenticated 401).
 */
import request from 'supertest';
import {
  prisma,
  createTestUser,
  createTestDepartment,
  cleanupDatabase,
  disconnectDatabase,
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

describe('P1-9 Budget management', () => {
  describe('BudgetLine CRUD (dept head + admin)', () => {
    it('dept head creates a budget line and the summary reflects plan vs spend', async () => {
      const dept = await createTestDepartment({ budget: 200000 });
      const head = await createTestUser({
        email: `head-${Date.now()}@test.com`,
        role: 'DEPARTMENT_HEAD',
        departmentId: dept.id,
      });

      const line = await request(app)
        .post(`/api/v1/budget/${dept.id}/lines`)
        .set('Authorization', `Bearer ${head.accessToken}`)
        .send({ category: 'repairs', amount: 120000 });
      expect(line.status).toBe(201);
      expect(line.body.data.category).toBe('repairs');

      const expense = await request(app)
        .post(`/api/v1/budget/${dept.id}/expenses`)
        .set('Authorization', `Bearer ${head.accessToken}`)
        .send({ category: 'repairs', amount: 30000, description: 'Pothole crew' });
      expect(expense.status).toBe(201);

      const summary = await request(app)
        .get(`/api/v1/budget/${dept.id}/summary`)
        .set('Authorization', `Bearer ${head.accessToken}`);
      expect(summary.status).toBe(200);
      expect(summary.body.data.totalPlanned).toBe(120000);
      expect(summary.body.data.totalSpent).toBe(30000);
      expect(summary.body.data.totalRemaining).toBe(90000);
      expect(summary.body.data.pctUsed).toBe(25);
      expect(summary.body.data.categories[0]).toMatchObject({
        category: 'repairs',
        planned: 120000,
        spent: 30000,
      });
    });

    it('upserts on duplicate year+category and deletes lines', async () => {
      const dept = await createTestDepartment({ budget: 100000 });
      const admin = await createTestUser({ email: `admin-${Date.now()}@test.com`, role: 'SUPER_ADMIN' });
      const auth = `Bearer ${admin.accessToken}`;

      await request(app).post(`/api/v1/budget/${dept.id}/lines`).set('Authorization', auth).send({ category: 'labor', amount: 50000 });
      const again = await request(app).post(`/api/v1/budget/${dept.id}/lines`).set('Authorization', auth).send({ category: 'labor', amount: 60000 });
      expect(again.status).toBe(201);

      const lines = await request(app).get(`/api/v1/budget/${dept.id}/lines`).set('Authorization', auth);
      const labor = lines.body.data.filter((l: any) => l.category === 'labor');
      expect(labor).toHaveLength(1);
      expect(Number(labor[0].amount)).toBe(60000);

      const del = await request(app)
        .delete(`/api/v1/budget/${dept.id}/lines/${labor[0].id}`)
        .set('Authorization', auth);
      expect(del.status).toBe(200);
      expect(del.body.data.deleted).toBe(true);
    });

    it('rejects invalid amounts and unknown departments', async () => {
      const admin = await createTestUser({ email: `admin-${Date.now()}@test.com`, role: 'SUPER_ADMIN' });
      const dept = await createTestDepartment({ budget: 50000 });

      const neg = await request(app)
        .post(`/api/v1/budget/${dept.id}/lines`)
        .set('Authorization', `Bearer ${admin.accessToken}`)
        .send({ category: 'repairs', amount: -10 });
      expect(neg.status).toBe(400);

      const missing = await request(app)
        .get('/api/v1/budget/00000000-0000-0000-0000-000000000000/summary')
        .set('Authorization', `Bearer ${admin.accessToken}`);
      expect(missing.status).toBe(404);
    });
  });

  describe('RBAC + dept-head scoping', () => {
    it('dept head cannot touch another department; citizen is forbidden; anon gets 401', async () => {
      const deptA = await createTestDepartment({ budget: 100000 });
      const deptB = await createTestDepartment({ budget: 100000 });
      const head = await createTestUser({
        email: `head-${Date.now()}@test.com`,
        role: 'DEPARTMENT_HEAD',
        departmentId: deptA.id,
      });
      const citizen = await createTestUser({ email: `cit-${Date.now()}@test.com`, role: 'CITIZEN' });

      const cross = await request(app)
        .get(`/api/v1/budget/${deptB.id}/summary`)
        .set('Authorization', `Bearer ${head.accessToken}`);
      expect(cross.status).toBe(403);

      const forbidden = await request(app)
        .get(`/api/v1/budget/${deptA.id}/summary`)
        .set('Authorization', `Bearer ${citizen.accessToken}`);
      expect(forbidden.status).toBe(403);

      const anon = await request(app).get(`/api/v1/budget/${deptA.id}/summary`);
      expect(anon.status).toBe(401);
    });
  });

  describe('Overview + expense CSV (auditor / media transparency)', () => {
    it('overview aggregates plan vs spend per department; auditor can read', async () => {
      const dept = await createTestDepartment({ budget: 400000 });
      const admin = await createTestUser({ email: `admin-${Date.now()}@test.com`, role: 'SUPER_ADMIN' });
      const auditor = await createTestUser({ email: `aud-${Date.now()}@test.com`, role: 'AUDITOR' });
      const auth = `Bearer ${admin.accessToken}`;

      await request(app).post(`/api/v1/budget/${dept.id}/lines`).set('Authorization', auth).send({ category: 'materials', amount: 100000 });
      await request(app).post(`/api/v1/budget/${dept.id}/expenses`).set('Authorization', auth).send({ category: 'materials', amount: 25000 });

      const overview = await request(app)
        .get('/api/v1/budget/overview')
        .set('Authorization', `Bearer ${auditor.accessToken}`);
      expect(overview.status).toBe(200);
      const row = overview.body.data.find((r: any) => r.departmentId === dept.id);
      expect(row).toBeDefined();
      expect(row.planned).toBe(100000);
      expect(row.spent).toBe(25000);
      expect(row.remaining).toBe(75000);
    });

    it('media can read the overview (Budget Transparency widget)', async () => {
      const media = await createTestUser({ email: `media-${Date.now()}@test.com`, role: 'MEDIA' });
      const res = await request(app)
        .get('/api/v1/budget/overview')
        .set('Authorization', `Bearer ${media.accessToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('expenses.csv lists recorded expenses for auditor + media; dept csv is scoped', async () => {
      const dept = await createTestDepartment({ budget: 90000 });
      const admin = await createTestUser({ email: `admin-${Date.now()}@test.com`, role: 'SUPER_ADMIN' });
      const auditor = await createTestUser({ email: `aud-${Date.now()}@test.com`, role: 'AUDITOR' });
      const media = await createTestUser({ email: `media-${Date.now()}@test.com`, role: 'MEDIA' });

      await request(app)
        .post(`/api/v1/budget/${dept.id}/expenses`)
        .set('Authorization', `Bearer ${admin.accessToken}`)
        .send({ category: 'equipment', amount: 1234.5, description: 'Meters, batch 7' });

      for (const user of [auditor, media]) {
        const csv = await request(app)
          .get('/api/v1/budget/expenses.csv')
          .set('Authorization', `Bearer ${user.accessToken}`);
        expect(csv.status).toBe(200);
        expect(csv.headers['content-type']).toMatch(/text\/csv/);
        expect(csv.text).toContain('id,department,deptCode,category,amount,description,incurredAt,budgetLine,recordedBy');
        expect(csv.text).toContain('equipment');
        expect(csv.text).toContain('1234.50');
      }

      const scoped = await request(app)
        .get(`/api/v1/budget/${dept.id}/expenses.csv`)
        .set('Authorization', `Bearer ${admin.accessToken}`);
      expect(scoped.status).toBe(200);
      expect(scoped.text).toContain('Meters, batch 7');

      const citizen = await createTestUser({ email: `cit-${Date.now()}@test.com`, role: 'CITIZEN' });
      const forbidden = await request(app)
        .get('/api/v1/budget/expenses.csv')
        .set('Authorization', `Bearer ${citizen.accessToken}`);
      expect(forbidden.status).toBe(403);
    });

    it('expense linked to a budget line shows the line reference in CSV', async () => {
      const dept = await createTestDepartment({ budget: 60000 });
      const admin = await createTestUser({ email: `admin-${Date.now()}@test.com`, role: 'SUPER_ADMIN' });
      const auth = `Bearer ${admin.accessToken}`;

      const line = await request(app)
        .post(`/api/v1/budget/${dept.id}/lines`)
        .set('Authorization', auth)
        .send({ category: 'labor', amount: 40000 });
      await request(app)
        .post(`/api/v1/budget/${dept.id}/expenses`)
        .set('Authorization', auth)
        .send({ category: 'labor', amount: 5000, budgetLineId: line.body.data.id });

      const csv = await request(app).get('/api/v1/budget/expenses.csv').set('Authorization', auth);
      expect(csv.text).toContain('labor (FY');
    });
  });

  describe('P2-21 detailed health (SUPER_ADMIN)', () => {
    it('returns p95 latency, queue, ollama, redis and db sections', async () => {
      const admin = await createTestUser({ email: `admin-${Date.now()}@test.com`, role: 'SUPER_ADMIN' });

      // Generate a latency sample first.
      await request(app).get('/api/v1/health');
      const res = await request(app)
        .get('/api/v1/health/detailed')
        .set('Authorization', `Bearer ${admin.accessToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const data = res.body.data;
      expect(data.http).toBeDefined();
      expect(typeof data.http.p95Ms).toBe('number');
      expect(data.database.status).toMatch(/up|down/);
      expect(data.redis.status).toMatch(/up|down|disabled/);
      expect(data.queue.status).toMatch(/up|down|disabled/);
      expect(data.ollama.status).toMatch(/up|down/);
    });

    it('rejects non-admin roles and anonymous callers', async () => {
      const citizen = await createTestUser({ email: `cit-${Date.now()}@test.com`, role: 'CITIZEN' });
      const forbidden = await request(app)
        .get('/api/v1/health/detailed')
        .set('Authorization', `Bearer ${citizen.accessToken}`);
      expect(forbidden.status).toBe(403);

      const anon = await request(app).get('/api/v1/health/detailed');
      expect(anon.status).toBe(401);
    });
  });

  // The legacy headline budget still seeds the tracker when no lines exist.
  it('falls back to Department.budget headline when no budget lines exist', async () => {
    const dept = await createTestDepartment({ budget: 777000 });
    const admin = await createTestUser({ email: `admin-${Date.now()}@test.com`, role: 'SUPER_ADMIN' });
    const res = await request(app)
      .get(`/api/v1/budget/${dept.id}/summary`)
      .set('Authorization', `Bearer ${admin.accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.totalBudget).toBe(777000);
    expect(res.body.data.categories).toEqual([]);
    await prisma.expense.deleteMany({ where: { departmentId: dept.id } });
  });
});
