import request from 'supertest';
import { prisma, createTestUser, createTestDepartment, createTestWard, cleanupDatabase, disconnectDatabase } from './helpers';
import { routingService } from '../services/routing.service';

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

const demoBoundary = (code: string) => ({
  type: 'Feature',
  properties: { code },
  geometry: {
    type: 'Polygon',
    coordinates: [[
      [-74.012, 40.709], [-74.002, 40.709], [-74.002, 40.718],
      [-74.012, 40.718], [-74.012, 40.709],
    ]],
  },
});

describe('Ward boundaries (P1-11)', () => {
  describe('PATCH /api/v1/departments/wards/:id', () => {
    it('should persist a GeoJSON boundary as admin', async () => {
      const admin = await createTestUser({ email: 'admin@test.com', role: 'SUPER_ADMIN' });
      const ward = await createTestWard({ name: 'Downtown', code: 'WD-01' });

      const res = await request(app)
        .patch(`/api/v1/departments/wards/${ward.id}`)
        .set('Authorization', `Bearer ${admin.accessToken}`)
        .send({ boundary: demoBoundary('WD-01') });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.boundary.type).toBe('Feature');
      expect(res.body.data.boundary.geometry.type).toBe('Polygon');

      const stored = await prisma.ward.findUnique({ where: { id: ward.id } });
      expect((stored?.boundary as any)?.geometry?.coordinates[0]).toHaveLength(5);
    });

    it('should surface the boundary on GET /wards', async () => {
      const ward = await createTestWard({ name: 'Downtown', code: 'WD-01' });
      await prisma.ward.update({ where: { id: ward.id }, data: { boundary: demoBoundary('WD-01') as any } });

      const res = await request(app).get('/api/v1/departments/wards');

      expect(res.status).toBe(200);
      const row = res.body.data.find((w: any) => w.id === ward.id);
      expect(row.boundary.geometry.type).toBe('Polygon');
    });

    it('should clear the boundary with null', async () => {
      const admin = await createTestUser({ email: 'admin@test.com', role: 'SUPER_ADMIN' });
      const ward = await createTestWard({ name: 'Downtown', code: 'WD-01' });
      await prisma.ward.update({ where: { id: ward.id }, data: { boundary: demoBoundary('WD-01') as any } });

      const res = await request(app)
        .patch(`/api/v1/departments/wards/${ward.id}`)
        .set('Authorization', `Bearer ${admin.accessToken}`)
        .send({ boundary: null });

      expect(res.status).toBe(200);
      const stored = await prisma.ward.findUnique({ where: { id: ward.id } });
      expect(stored?.boundary).toBeNull();
    });

    it('should reject a non-Feature boundary with 400', async () => {
      const admin = await createTestUser({ email: 'admin@test.com', role: 'SUPER_ADMIN' });
      const ward = await createTestWard({ name: 'Downtown', code: 'WD-01' });

      const res = await request(app)
        .patch(`/api/v1/departments/wards/${ward.id}`)
        .set('Authorization', `Bearer ${admin.accessToken}`)
        .send({ boundary: { type: 'Point', coordinates: [1, 2] } });

      expect(res.status).toBe(400);
    });

    it('should reject an unclosed ring with 400', async () => {
      const admin = await createTestUser({ email: 'admin@test.com', role: 'SUPER_ADMIN' });
      const ward = await createTestWard({ name: 'Downtown', code: 'WD-01' });
      const open = demoBoundary('WD-01') as any;
      open.geometry.coordinates[0] = [[-74.012, 40.709], [-74.002, 40.709], [-74.002, 40.718]];

      const res = await request(app)
        .patch(`/api/v1/departments/wards/${ward.id}`)
        .set('Authorization', `Bearer ${admin.accessToken}`)
        .send({ boundary: open });

      expect(res.status).toBe(400);
    });

    it('should reject edits by non-admins with 403', async () => {
      const citizen = await createTestUser({ email: 'citizen@test.com', role: 'CITIZEN' });
      const ward = await createTestWard({ name: 'Downtown', code: 'WD-01' });

      const res = await request(app)
        .patch(`/api/v1/departments/wards/${ward.id}`)
        .set('Authorization', `Bearer ${citizen.accessToken}`)
        .send({ name: 'Hijacked' });

      expect(res.status).toBe(403);
    });

    it('should 404 for an unknown ward', async () => {
      const admin = await createTestUser({ email: 'admin@test.com', role: 'SUPER_ADMIN' });

      const res = await request(app)
        .patch('/api/v1/departments/wards/00000000-0000-4000-8000-000000000000')
        .set('Authorization', `Bearer ${admin.accessToken}`)
        .send({ name: 'Ghost' });

      expect(res.status).toBe(404);
    });
  });

  describe('Department↔Ward assignments', () => {
    it('should assign, list, and unassign departments as admin', async () => {
      const admin = await createTestUser({ email: 'admin@test.com', role: 'SUPER_ADMIN' });
      const ward = await createTestWard({ name: 'Downtown', code: 'WD-01' });
      const dept = await createTestDepartment({ name: 'Public Works', code: 'PW' });

      const assign = await request(app)
        .post(`/api/v1/departments/wards/${ward.id}/departments`)
        .set('Authorization', `Bearer ${admin.accessToken}`)
        .send({ departmentId: dept.id });

      expect(assign.status).toBe(201);
      expect(assign.body.data.department.code).toBe('PW');

      // Duplicate assign is idempotent (upsert, still exactly one row).
      const again = await request(app)
        .post(`/api/v1/departments/wards/${ward.id}/departments`)
        .set('Authorization', `Bearer ${admin.accessToken}`)
        .send({ departmentId: dept.id });
      expect(again.status).toBe(201);
      expect(await prisma.departmentWard.count({ where: { wardId: ward.id } })).toBe(1);

      const list = await request(app).get(`/api/v1/departments/wards/${ward.id}/departments`);
      expect(list.status).toBe(200);
      expect(list.body.data).toHaveLength(1);

      const remove = await request(app)
        .delete(`/api/v1/departments/wards/${ward.id}/departments/${dept.id}`)
        .set('Authorization', `Bearer ${admin.accessToken}`);
      expect(remove.status).toBe(200);
      expect(await prisma.departmentWard.count({ where: { wardId: ward.id } })).toBe(0);
    });

    it('should 404 when assigning an unknown department or ward', async () => {
      const admin = await createTestUser({ email: 'admin@test.com', role: 'SUPER_ADMIN' });
      const ward = await createTestWard({ name: 'Downtown', code: 'WD-01' });

      const badDept = await request(app)
        .post(`/api/v1/departments/wards/${ward.id}/departments`)
        .set('Authorization', `Bearer ${admin.accessToken}`)
        .send({ departmentId: '00000000-0000-4000-8000-000000000000' });
      expect(badDept.status).toBe(404);

      const badWard = await request(app)
        .post('/api/v1/departments/wards/00000000-0000-4000-8000-000000000000/departments')
        .set('Authorization', `Bearer ${admin.accessToken}`)
        .send({ departmentId: ward.id });
      expect(badWard.status).toBe(404);
    });

    it('should reject assignment edits by non-admins', async () => {
      const citizen = await createTestUser({ email: 'citizen@test.com', role: 'CITIZEN' });
      const ward = await createTestWard({ name: 'Downtown', code: 'WD-01' });
      const dept = await createTestDepartment({ name: 'Public Works', code: 'PW' });

      const res = await request(app)
        .post(`/api/v1/departments/wards/${ward.id}/departments`)
        .set('Authorization', `Bearer ${citizen.accessToken}`)
        .send({ departmentId: dept.id });
      expect(res.status).toBe(403);
    });
  });

  describe('Ward-aware routing', () => {
    it('should route through the ward hierarchy before the category fallback', async () => {
      const wardDept = await createTestDepartment({ name: 'Ward Crew', code: 'WC' });
      const ward = await createTestWard({ name: 'Downtown', code: 'WD-01' });
      await prisma.departmentWard.create({ data: { departmentId: wardDept.id, wardId: ward.id } });

      // Category UTILITIES maps to UT, but the ward hierarchy wins.
      const routed = await routingService.resolveDepartmentId('UTILITIES', ward.id);
      expect(routed).toBe(wardDept.id);
    });

    it('should prefer the category-matching department within a multi-dept ward', async () => {
      const pw = await createTestDepartment({ name: 'Public Works', code: 'PW' });
      const ut = await createTestDepartment({ name: 'Utilities', code: 'UT' });
      const ward = await createTestWard({ name: 'Downtown', code: 'WD-01' });
      await prisma.departmentWard.create({ data: { departmentId: pw.id, wardId: ward.id } });
      await prisma.departmentWard.create({ data: { departmentId: ut.id, wardId: ward.id } });

      await expect(routingService.resolveDepartmentId('UTILITIES', ward.id)).resolves.toBe(ut.id);
      await expect(routingService.resolveDepartmentId('INFRASTRUCTURE', ward.id)).resolves.toBe(pw.id);
    });

    it('should fall back to the category mapping when the ward has no assignments', async () => {
      const pw = await createTestDepartment({ name: 'Public Works', code: 'PW' });
      const ward = await createTestWard({ name: 'Downtown', code: 'WD-01' });

      await expect(routingService.resolveDepartmentId('INFRASTRUCTURE', ward.id)).resolves.toBe(pw.id);
      await expect(routingService.resolveDepartmentId('INFRASTRUCTURE')).resolves.toBe(pw.id);
    });

    it('should route newly created issues in a ward to the ward department', async () => {
      const wardDept = await createTestDepartment({ name: 'Ward Crew', code: 'WC' });
      await createTestDepartment({ name: 'Utilities', code: 'UT' });
      const ward = await createTestWard({ name: 'Downtown', code: 'WD-01' });
      await prisma.departmentWard.create({ data: { departmentId: wardDept.id, wardId: ward.id } });
      const reporter = await createTestUser({ email: 'reporter@test.com' });

      const res = await request(app)
        .post('/api/v1/issues')
        .set('Authorization', `Bearer ${reporter.accessToken}`)
        .send({
          title: 'Water main break on Cedar Lane',
          description: 'Water is gushing from a broken main and flooding the street.',
          category: 'UTILITIES',
          location: 'Cedar Lane near School',
          wardId: ward.id,
        });

      expect(res.status).toBe(202);
      expect(res.body.data.departmentId).toBe(wardDept.id);
    });
  });
});
