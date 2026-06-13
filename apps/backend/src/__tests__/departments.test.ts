import request from 'supertest';
import { prisma, createTestUser, createTestDepartment, createTestWard, cleanupDatabase, disconnectDatabase } from './helpers';

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
});
