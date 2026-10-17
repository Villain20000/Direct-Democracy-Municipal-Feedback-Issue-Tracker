/**
 * P1-7 — PDF report export tests (PLAN feature 23 "Report Export (PDF/CSV)").
 *
 * Covers all four PDF endpoints:
 *   GET /api/v1/reports/issues.pdf
 *   GET /api/v1/reports/audit.pdf
 *   GET /api/v1/reports/briefing.pdf
 *   GET /api/v1/reports/issues/:id/dossier.pdf
 *
 * For each endpoint: CSV sibling still works, the PDF returns a non-empty
 * `application/pdf` body starting with the `%PDF` magic bytes, RBAC allows
 * the documented roles (403 otherwise), and unauthenticated calls get 401.
 */
import request from 'supertest';
import {
  prisma,
  createTestUser,
  createTestIssue,
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

function expectPdf(res: request.Response) {
  expect(res.headers['content-type']).toMatch(/application\/pdf/);
  const body: Buffer = res.body as unknown as Buffer;
  expect(Buffer.isBuffer(body) || typeof body === 'object').toBe(true);
  const buf = Buffer.isBuffer(body) ? body : Buffer.from(body as any);
  expect(buf.length).toBeGreaterThan(500);
  expect(buf.subarray(0, 4).toString()).toBe('%PDF');
}

describe('P1-7 PDF report exports', () => {
  describe('GET /api/v1/reports/issues.pdf', () => {
    it('returns a branded PDF for an allowed role (MAYOR)', async () => {
      const mayor = await createTestUser({ email: 'mayor-pdf@test.com', role: 'MAYOR' });
      await createTestIssue(mayor.user.id, { title: 'PDF export sample issue' });

      const res = await request(app)
        .get('/api/v1/reports/issues.pdf')
        .set('Authorization', `Bearer ${mayor.accessToken}`)
        .buffer(true)
        .parse((r, cb) => {
          const chunks: Buffer[] = [];
          r.on('data', (c: Buffer) => chunks.push(c));
          r.on('end', () => cb(null, Buffer.concat(chunks)));
        });

      expect(res.status).toBe(200);
      expectPdf(res);
    });

    it('keeps the CSV sibling working', async () => {
      const mayor = await createTestUser({ email: 'mayor-csv@test.com', role: 'MAYOR' });
      const res = await request(app)
        .get('/api/v1/reports/issues.csv')
        .set('Authorization', `Bearer ${mayor.accessToken}`);
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/text\/csv/);
      expect(res.text).toMatch(/^id,title,category,status/);
    });

    it('rejects unauthenticated requests with 401', async () => {
      const res = await request(app).get('/api/v1/reports/issues.pdf');
      expect(res.status).toBe(401);
    });

    it('rejects CITIZEN with 403', async () => {
      const citizen = await createTestUser({ email: 'citizen-pdf@test.com', role: 'CITIZEN' });
      const res = await request(app)
        .get('/api/v1/reports/issues.pdf')
        .set('Authorization', `Bearer ${citizen.accessToken}`);
      expect(res.status).toBe(403);
    });

    it('allows MEDIA (press) role', async () => {
      const media = await createTestUser({ email: 'media-pdf@test.com', role: 'MEDIA' });
      const res = await request(app)
        .get('/api/v1/reports/issues.pdf')
        .set('Authorization', `Bearer ${media.accessToken}`)
        .buffer(true)
        .parse((r, cb) => {
          const chunks: Buffer[] = [];
          r.on('data', (c: Buffer) => chunks.push(c));
          r.on('end', () => cb(null, Buffer.concat(chunks)));
        });
      expect(res.status).toBe(200);
      expectPdf(res);
    });
  });

  describe('GET /api/v1/reports/audit.pdf', () => {
    it('returns an audit-trail PDF for AUDITOR and keeps audit.csv', async () => {
      const auditor = await createTestUser({ email: 'auditor-pdf@test.com', role: 'AUDITOR' });

      const pdf = await request(app)
        .get('/api/v1/reports/audit.pdf')
        .set('Authorization', `Bearer ${auditor.accessToken}`)
        .buffer(true)
        .parse((r, cb) => {
          const chunks: Buffer[] = [];
          r.on('data', (c: Buffer) => chunks.push(c));
          r.on('end', () => cb(null, Buffer.concat(chunks)));
        });
      expect(pdf.status).toBe(200);
      expectPdf(pdf);

      const csv = await request(app)
        .get('/api/v1/reports/audit.csv')
        .set('Authorization', `Bearer ${auditor.accessToken}`);
      expect(csv.status).toBe(200);
      expect(csv.headers['content-type']).toMatch(/text\/csv/);
    });

    it('rejects MAYOR with 403 (auditor/admin only)', async () => {
      const mayor = await createTestUser({ email: 'mayor-audit-pdf@test.com', role: 'MAYOR' });
      const res = await request(app)
        .get('/api/v1/reports/audit.pdf')
        .set('Authorization', `Bearer ${mayor.accessToken}`);
      expect(res.status).toBe(403);
    });

    it('rejects unauthenticated requests with 401', async () => {
      const res = await request(app).get('/api/v1/reports/audit.pdf');
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/v1/reports/briefing.pdf', () => {
    async function seedBriefing() {
      const now = new Date();
      await prisma.weeklySummary.create({
        data: {
          weekKey: '2026-W42',
          weekStart: now,
          weekEnd: now,
          stats: { newCount: 5, resolvedCount: 3, averageResolutionDays: 2.5, byCategory: { INFRASTRUCTURE: 4 }, byDepartment: {} },
          highlights: [{ title: 'Pothole spike', body: 'Six reports on Main St.' }],
          body: 'Executive summary body for the test week.',
          issueIds: [],
          source: 'MANUAL',
        },
      });
    }

    it('returns the weekly briefing PDF for MAYOR', async () => {
      const mayor = await createTestUser({ email: 'mayor-brief@test.com', role: 'MAYOR' });
      await seedBriefing();
      const res = await request(app)
        .get('/api/v1/reports/briefing.pdf')
        .set('Authorization', `Bearer ${mayor.accessToken}`)
        .buffer(true)
        .parse((r, cb) => {
          const chunks: Buffer[] = [];
          r.on('data', (c: Buffer) => chunks.push(c));
          r.on('end', () => cb(null, Buffer.concat(chunks)));
        });
      expect(res.status).toBe(200);
      expectPdf(res);
    });

    it('returns 404 when no briefing exists yet', async () => {
      const mayor = await createTestUser({ email: 'mayor-brief404@test.com', role: 'MAYOR' });
      const res = await request(app)
        .get('/api/v1/reports/briefing.pdf')
        .set('Authorization', `Bearer ${mayor.accessToken}`);
      expect(res.status).toBe(404);
    });

    it('rejects CITIZEN with 403 and anonymous with 401', async () => {
      const citizen = await createTestUser({ email: 'citizen-brief@test.com', role: 'CITIZEN' });
      const forbidden = await request(app)
        .get('/api/v1/reports/briefing.pdf')
        .set('Authorization', `Bearer ${citizen.accessToken}`);
      expect(forbidden.status).toBe(403);
      const anon = await request(app).get('/api/v1/reports/briefing.pdf');
      expect(anon.status).toBe(401);
    });
  });

  describe('GET /api/v1/reports/issues/:id/dossier.pdf', () => {
    it('returns a resolution dossier PDF for a real issue', async () => {
      const mayor = await createTestUser({ email: 'mayor-dos@test.com', role: 'MAYOR' });
      const issue = await createTestIssue(mayor.user.id, { title: 'Dossier sample issue' });

      const res = await request(app)
        .get(`/api/v1/reports/issues/${issue.id}/dossier.pdf`)
        .set('Authorization', `Bearer ${mayor.accessToken}`)
        .buffer(true)
        .parse((r, cb) => {
          const chunks: Buffer[] = [];
          r.on('data', (c: Buffer) => chunks.push(c));
          r.on('end', () => cb(null, Buffer.concat(chunks)));
        });
      expect(res.status).toBe(200);
      expectPdf(res);
    });

    it('returns 404 for an unknown issue id', async () => {
      const admin = await createTestUser({ email: 'admin-dos@test.com', role: 'SUPER_ADMIN' });
      const res = await request(app)
        .get('/api/v1/reports/issues/00000000-0000-0000-0000-000000000000/dossier.pdf')
        .set('Authorization', `Bearer ${admin.accessToken}`);
      expect(res.status).toBe(404);
    });

    it('rejects CITIZEN with 403 and anonymous with 401', async () => {
      const reporter = await createTestUser({ email: 'rep-dos@test.com', role: 'CITIZEN' });
      const issue = await createTestIssue(reporter.user.id, { title: 'Dossier RBAC issue' });
      const forbidden = await request(app)
        .get(`/api/v1/reports/issues/${issue.id}/dossier.pdf`)
        .set('Authorization', `Bearer ${reporter.accessToken}`);
      expect(forbidden.status).toBe(403);
      const anon = await request(app).get(`/api/v1/reports/issues/${issue.id}/dossier.pdf`);
      expect(anon.status).toBe(401);
    });
  });
});
