import request from 'supertest';
import { prisma, createTestUser, createTestDepartment, createTestWard, createTestIssue, cleanupDatabase, disconnectDatabase } from './helpers';

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

describe('Department Endpoints', () => {
  describe('GET /api/v1/departments', () => {
    it('should list all departments', async () => {
      await createTestDepartment({ name: 'Public Works', code: 'PW' });
      await createTestDepartment({ name: 'Sanitation', code: 'SAN' });

      const res = await request(app).get('/api/v1/departments');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.data[0].name).toBe('Public Works');
    });

    it('should include department head info', async () => {
      const head = await createTestUser({ email: 'head@test.com', role: 'DEPARTMENT_HEAD' });
      const dept = await createTestDepartment({ name: 'Test Dept', code: 'TD' });
      await prisma.department.update({ where: { id: dept.id }, data: { headId: head.user.id } });

      const res = await request(app).get('/api/v1/departments');

      expect(res.status).toBe(200);
      expect(res.body.data[0].head).toBeDefined();
      expect(res.body.data[0].head.firstName).toBe('Test');
    });
  });

  describe('POST /api/v1/departments', () => {
    it('should create a department as admin', async () => {
      const admin = await createTestUser({ email: 'admin@test.com', role: 'SUPER_ADMIN' });

      const res = await request(app)
        .post('/api/v1/departments')
        .set('Authorization', `Bearer ${admin.accessToken}`)
        .send({
          name: 'New Department',
          code: 'ND',
          description: 'A new department for testing',
          budget: 500000,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('New Department');
      expect(res.body.data.code).toBe('ND');
    });

    it('should reject creation with invalid code format', async () => {
      const admin = await createTestUser({ email: 'admin@test.com', role: 'SUPER_ADMIN' });

      const res = await request(app)
        .post('/api/v1/departments')
        .set('Authorization', `Bearer ${admin.accessToken}`)
        .send({
          name: 'Bad Department',
          code: 'lowercase',
          budget: 500000,
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation failed');
    });

    it('should reject creation with missing name', async () => {
      const admin = await createTestUser({ email: 'admin@test.com', role: 'SUPER_ADMIN' });

      const res = await request(app)
        .post('/api/v1/departments')
        .set('Authorization', `Bearer ${admin.accessToken}`)
        .send({
          code: 'XD',
          budget: 500000,
        });

      expect(res.status).toBe(400);
    });

    it('should reject creation with negative budget', async () => {
      const admin = await createTestUser({ email: 'admin@test.com', role: 'SUPER_ADMIN' });

      const res = await request(app)
        .post('/api/v1/departments')
        .set('Authorization', `Bearer ${admin.accessToken}`)
        .send({
          name: 'Negative Budget',
          code: 'NB',
          budget: -1000,
        });

      expect(res.status).toBe(400);
    });

    it('should reject creation by non-admin users', async () => {
      const citizen = await createTestUser({ email: 'citizen@test.com', role: 'CITIZEN' });

      const res = await request(app)
        .post('/api/v1/departments')
        .set('Authorization', `Bearer ${citizen.accessToken}`)
        .send({
          name: 'Citizen Department',
          code: 'CD',
          budget: 100000,
        });

      expect(res.status).toBe(403);
    });
  });

  describe('GET /api/v1/departments/wards', () => {
    it('should list all wards', async () => {
      await createTestWard({ name: 'Downtown', code: 'WD-01' });
      await createTestWard({ name: 'Northside', code: 'WD-02' });

      const res = await request(app).get('/api/v1/departments/wards');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(2);
    });
  });

  describe('POST /api/v1/departments/wards', () => {
    it('should create a ward as admin', async () => {
      const admin = await createTestUser({ email: 'admin@test.com', role: 'SUPER_ADMIN' });

      const res = await request(app)
        .post('/api/v1/departments/wards')
        .set('Authorization', `Bearer ${admin.accessToken}`)
        .send({
          name: 'New Ward',
          code: 'WD-99',
          description: 'A new ward for testing',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('New Ward');
      expect(res.body.data.code).toBe('WD-99');
    });

    it('should reject ward creation with invalid code format', async () => {
      const admin = await createTestUser({ email: 'admin@test.com', role: 'SUPER_ADMIN' });

      const res = await request(app)
        .post('/api/v1/departments/wards')
        .set('Authorization', `Bearer ${admin.accessToken}`)
        .send({
          name: 'Bad Ward',
          code: 'INVALID',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation failed');
    });
  });

  // P2-15 — department update / delete with reassignment guards.
  describe('PATCH /api/v1/departments/:id', () => {
    it('should update name and description as admin', async () => {
      const admin = await createTestUser({ email: 'admin@test.com', role: 'SUPER_ADMIN' });
      const dept = await createTestDepartment({ name: 'Old Name', code: 'ON' });

      const res = await request(app)
        .patch(`/api/v1/departments/${dept.id}`)
        .set('Authorization', `Bearer ${admin.accessToken}`)
        .send({ name: 'New Name', description: 'Updated' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('New Name');
      expect(res.body.data.description).toBe('Updated');
      expect(res.body.data.code).toBe('ON');
    });

    it('should return 404 for an unknown department', async () => {
      const admin = await createTestUser({ email: 'admin@test.com', role: 'SUPER_ADMIN' });

      const res = await request(app)
        .patch('/api/v1/departments/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${admin.accessToken}`)
        .send({ name: 'Ghost' });

      expect(res.status).toBe(404);
    });

    it('should reject updates by non-admin users', async () => {
      const head = await createTestUser({ email: 'head@test.com', role: 'DEPARTMENT_HEAD' });
      const dept = await createTestDepartment({ name: 'Dept', code: 'DD' });

      const res = await request(app)
        .patch(`/api/v1/departments/${dept.id}`)
        .set('Authorization', `Bearer ${head.accessToken}`)
        .send({ name: 'Hijacked' });

      expect(res.status).toBe(403);
    });

    it('should reject an empty body', async () => {
      const admin = await createTestUser({ email: 'admin@test.com', role: 'SUPER_ADMIN' });
      const dept = await createTestDepartment({ name: 'Dept', code: 'DD' });

      const res = await request(app)
        .patch(`/api/v1/departments/${dept.id}`)
        .set('Authorization', `Bearer ${admin.accessToken}`)
        .send({});

      expect(res.status).toBe(400);
    });

    it('should reject an invalid code format', async () => {
      const admin = await createTestUser({ email: 'admin@test.com', role: 'SUPER_ADMIN' });
      const dept = await createTestDepartment({ name: 'Dept', code: 'DD' });

      const res = await request(app)
        .patch(`/api/v1/departments/${dept.id}`)
        .set('Authorization', `Bearer ${admin.accessToken}`)
        .send({ code: 'lowercase' });

      expect(res.status).toBe(400);
    });

    it('should return 409 on duplicate code', async () => {
      const admin = await createTestUser({ email: 'admin@test.com', role: 'SUPER_ADMIN' });
      await createTestDepartment({ name: 'First', code: 'AA' });
      const second = await createTestDepartment({ name: 'Second', code: 'BB' });

      const res = await request(app)
        .patch(`/api/v1/departments/${second.id}`)
        .set('Authorization', `Bearer ${admin.accessToken}`)
        .send({ code: 'AA' });

      expect(res.status).toBe(409);
    });

    it('should return 404 when the head user does not exist', async () => {
      const admin = await createTestUser({ email: 'admin@test.com', role: 'SUPER_ADMIN' });
      const dept = await createTestDepartment({ name: 'Dept', code: 'DD' });

      const res = await request(app)
        .patch(`/api/v1/departments/${dept.id}`)
        .set('Authorization', `Bearer ${admin.accessToken}`)
        .send({ headId: '00000000-0000-0000-0000-000000000000' });

      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/v1/departments/:id', () => {
    it('should delete an empty department as admin', async () => {
      const admin = await createTestUser({ email: 'admin@test.com', role: 'SUPER_ADMIN' });
      const dept = await createTestDepartment({ name: 'Temp', code: 'TD' });

      const res = await request(app)
        .delete(`/api/v1/departments/${dept.id}`)
        .set('Authorization', `Bearer ${admin.accessToken}`)
        .send({});

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.removed).toBe(true);
      await expect(prisma.department.findUnique({ where: { id: dept.id } })).resolves.toBeNull();
    });

    it('should return 404 for an unknown department', async () => {
      const admin = await createTestUser({ email: 'admin@test.com', role: 'SUPER_ADMIN' });

      const res = await request(app)
        .delete('/api/v1/departments/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${admin.accessToken}`)
        .send({});

      expect(res.status).toBe(404);
    });

    it('should reject deletes by non-admin users', async () => {
      const staff = await createTestUser({ email: 'staff@test.com', role: 'STAFF' });
      const dept = await createTestDepartment({ name: 'Dept', code: 'DD' });

      const res = await request(app)
        .delete(`/api/v1/departments/${dept.id}`)
        .set('Authorization', `Bearer ${staff.accessToken}`)
        .send({});

      expect(res.status).toBe(403);
    });

    it('should return 409 with blockers when issues exist and no reassignment is given', async () => {
      const admin = await createTestUser({ email: 'admin@test.com', role: 'SUPER_ADMIN' });
      const reporter = await createTestUser({ email: 'rep@test.com', role: 'CITIZEN' });
      const dept = await createTestDepartment({ name: 'Busy', code: 'BD' });
      await createTestIssue(reporter.user.id, { departmentId: dept.id });

      const res = await request(app)
        .delete(`/api/v1/departments/${dept.id}`)
        .set('Authorization', `Bearer ${admin.accessToken}`)
        .send({});

      expect(res.status).toBe(409);
      expect(res.body.blockers.join(' ')).toMatch(/issue/);
      // Nothing was deleted.
      await expect(prisma.department.findUnique({ where: { id: dept.id } })).resolves.not.toBeNull();
    });

    it('should move issues to the reassignment target and delete', async () => {
      const admin = await createTestUser({ email: 'admin@test.com', role: 'SUPER_ADMIN' });
      const reporter = await createTestUser({ email: 'rep@test.com', role: 'CITIZEN' });
      const source = await createTestDepartment({ name: 'Source', code: 'SD' });
      const target = await createTestDepartment({ name: 'Target', code: 'TG' });
      const issue = await createTestIssue(reporter.user.id, { departmentId: source.id });

      const res = await request(app)
        .delete(`/api/v1/departments/${source.id}`)
        .set('Authorization', `Bearer ${admin.accessToken}`)
        .send({ reassignDepartmentId: target.id });

      expect(res.status).toBe(200);
      expect(res.body.data.removed).toBe(true);
      expect(res.body.data.reassigned).toBe(1);
      await expect(prisma.issue.findUnique({ where: { id: issue.id } })).resolves.toMatchObject({ departmentId: target.id });
    });

    it('should reject reassignment to itself', async () => {
      const admin = await createTestUser({ email: 'admin@test.com', role: 'SUPER_ADMIN' });
      const reporter = await createTestUser({ email: 'rep@test.com', role: 'CITIZEN' });
      const dept = await createTestDepartment({ name: 'Self', code: 'SD' });
      await createTestIssue(reporter.user.id, { departmentId: dept.id });

      const res = await request(app)
        .delete(`/api/v1/departments/${dept.id}`)
        .set('Authorization', `Bearer ${admin.accessToken}`)
        .send({ reassignDepartmentId: dept.id });

      expect(res.status).toBe(400);
    });

    it('should return 404 for an unknown reassignment target', async () => {
      const admin = await createTestUser({ email: 'admin@test.com', role: 'SUPER_ADMIN' });
      const reporter = await createTestUser({ email: 'rep@test.com', role: 'CITIZEN' });
      const dept = await createTestDepartment({ name: 'Dept', code: 'DD' });
      await createTestIssue(reporter.user.id, { departmentId: dept.id });

      const res = await request(app)
        .delete(`/api/v1/departments/${dept.id}`)
        .set('Authorization', `Bearer ${admin.accessToken}`)
        .send({ reassignDepartmentId: '00000000-0000-0000-0000-000000000000' });

      expect(res.status).toBe(404);
    });

    it('should return 409 when staff members belong to the department', async () => {
      const admin = await createTestUser({ email: 'admin@test.com', role: 'SUPER_ADMIN' });
      const dept = await createTestDepartment({ name: 'Staffed', code: 'SF' });
      await createTestUser({ email: 'member@test.com', role: 'STAFF', departmentId: dept.id });

      const res = await request(app)
        .delete(`/api/v1/departments/${dept.id}`)
        .set('Authorization', `Bearer ${admin.accessToken}`)
        .send({});

      expect(res.status).toBe(409);
      expect(res.body.blockers.join(' ')).toMatch(/staff/);
    });

    it('should return 409 when a head is assigned', async () => {
      const admin = await createTestUser({ email: 'admin@test.com', role: 'SUPER_ADMIN' });
      const head = await createTestUser({ email: 'head@test.com', role: 'DEPARTMENT_HEAD' });
      const dept = await createTestDepartment({ name: 'Headed', code: 'HD' });
      await prisma.department.update({ where: { id: dept.id }, data: { headId: head.user.id } });

      const res = await request(app)
        .delete(`/api/v1/departments/${dept.id}`)
        .set('Authorization', `Bearer ${admin.accessToken}`)
        .send({});

      expect(res.status).toBe(409);
      expect(res.body.blockers.join(' ')).toMatch(/head/);
    });

    it('should return 409 when ward assignments reference the department', async () => {
      const admin = await createTestUser({ email: 'admin@test.com', role: 'SUPER_ADMIN' });
      const dept = await createTestDepartment({ name: 'Assigned', code: 'AD' });
      const ward = await createTestWard({ name: 'Ward', code: 'WD-01' });
      await prisma.departmentWard.create({ data: { departmentId: dept.id, wardId: ward.id } });

      const res = await request(app)
        .delete(`/api/v1/departments/${dept.id}`)
        .set('Authorization', `Bearer ${admin.accessToken}`)
        .send({});

      expect(res.status).toBe(409);
      expect(res.body.blockers.join(' ')).toMatch(/ward/);
    });

    it('should return 409 when budget records reference the department', async () => {
      const admin = await createTestUser({ email: 'admin@test.com', role: 'SUPER_ADMIN' });
      const dept = await createTestDepartment({ name: 'Funded', code: 'FD' });
      await prisma.budgetLine.create({
        data: { departmentId: dept.id, fiscalYear: 2026, category: 'Operations', amount: 1000 },
      });

      const res = await request(app)
        .delete(`/api/v1/departments/${dept.id}`)
        .set('Authorization', `Bearer ${admin.accessToken}`)
        .send({});

      expect(res.status).toBe(409);
      expect(res.body.blockers.join(' ')).toMatch(/budget/);
    });
  });

  // P2-15 — ward delete with reassignment guards.
  describe('DELETE /api/v1/departments/wards/:id', () => {
    it('should delete an empty ward as admin', async () => {
      const admin = await createTestUser({ email: 'admin@test.com', role: 'SUPER_ADMIN' });
      const ward = await createTestWard({ name: 'Temp', code: 'WD-55' });

      const res = await request(app)
        .delete(`/api/v1/departments/wards/${ward.id}`)
        .set('Authorization', `Bearer ${admin.accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      await expect(prisma.ward.findUnique({ where: { id: ward.id } })).resolves.toBeNull();
    });

    it('should cascade ward assignments on delete', async () => {
      const admin = await createTestUser({ email: 'admin@test.com', role: 'SUPER_ADMIN' });
      const ward = await createTestWard({ name: 'Served', code: 'WD-56' });
      const dept = await createTestDepartment({ name: 'Dept', code: 'DD' });
      await prisma.departmentWard.create({ data: { departmentId: dept.id, wardId: ward.id } });

      const res = await request(app)
        .delete(`/api/v1/departments/wards/${ward.id}`)
        .set('Authorization', `Bearer ${admin.accessToken}`);

      expect(res.status).toBe(200);
      await expect(prisma.departmentWard.count({ where: { wardId: ward.id } })).resolves.toBe(0);
      // The department itself survives.
      await expect(prisma.department.findUnique({ where: { id: dept.id } })).resolves.not.toBeNull();
    });

    it('should return 404 for an unknown ward', async () => {
      const admin = await createTestUser({ email: 'admin@test.com', role: 'SUPER_ADMIN' });

      const res = await request(app)
        .delete('/api/v1/departments/wards/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${admin.accessToken}`);

      expect(res.status).toBe(404);
    });

    it('should reject deletes by non-admin users', async () => {
      const citizen = await createTestUser({ email: 'citizen@test.com', role: 'CITIZEN' });
      const ward = await createTestWard({ name: 'Ward', code: 'WD-57' });

      const res = await request(app)
        .delete(`/api/v1/departments/wards/${ward.id}`)
        .set('Authorization', `Bearer ${citizen.accessToken}`);

      expect(res.status).toBe(403);
    });

    it('should return 409 when issues belong to the ward', async () => {
      const admin = await createTestUser({ email: 'admin@test.com', role: 'SUPER_ADMIN' });
      const reporter = await createTestUser({ email: 'rep@test.com', role: 'CITIZEN' });
      const ward = await createTestWard({ name: 'Busy', code: 'WD-58' });
      await createTestIssue(reporter.user.id, { wardId: ward.id });

      const res = await request(app)
        .delete(`/api/v1/departments/wards/${ward.id}`)
        .set('Authorization', `Bearer ${admin.accessToken}`);

      expect(res.status).toBe(409);
      expect(res.body.blockers.join(' ')).toMatch(/issue/);
    });

    it('should return 409 when resident users belong to the ward', async () => {
      const admin = await createTestUser({ email: 'admin@test.com', role: 'SUPER_ADMIN' });
      const ward = await createTestWard({ name: 'Lived', code: 'WD-59' });
      await createTestUser({ email: 'resident@test.com', role: 'CITIZEN', wardId: ward.id });

      const res = await request(app)
        .delete(`/api/v1/departments/wards/${ward.id}`)
        .set('Authorization', `Bearer ${admin.accessToken}`);

      expect(res.status).toBe(409);
      expect(res.body.blockers.join(' ')).toMatch(/resident/);
    });
  });
});
