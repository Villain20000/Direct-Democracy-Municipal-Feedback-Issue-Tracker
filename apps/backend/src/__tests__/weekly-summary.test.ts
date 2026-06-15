/**
 * Phase C — Weekly summary tests.
 *
 * Exercises the ISO-week math, the route auth/role gating, and the
 * Ollama-fallback path. The full AI call is skipped in this suite
 * because it requires a running Ollama; we stub `aiService.chat` to
 * return a deterministic string so the test stays offline.
 */
import request from 'supertest';
import { prisma, createTestUser, createTestIssue, cleanupDatabase, disconnectDatabase } from './helpers';

// Stub aiService.chat BEFORE the app is imported (the service is loaded
// transitively by weekly-summary.service → ollama.service).
jest.mock('../ai/ollama.service', () => ({
  aiService: {
    chat: jest.fn(async (messages: any[]) => {
      // Detect which call we're in by sniffing the prompt
      const prompt = messages[messages.length - 1]?.content || '';
      if (prompt.includes('Friday executive briefing')) {
        return 'This week 5 issues were reported and 3 resolved. Public Works handled the majority.';
      }
      if (prompt.includes('highlight cards')) {
        return JSON.stringify({
          highlights: [
            { title: 'Pothole spike', body: 'Six pothole reports concentrated on Main St.' },
            { title: 'Streetlights repaired', body: 'Four out of seven broken streetlights fixed.' },
            { title: 'Budget watch', body: 'Sanitation overran by 12% vs last week.' },
          ],
        });
      }
      return 'fallback';
    }),
  },
}));

import { weeklySummaryService } from '../services/weekly-summary.service';

let app: any;
let mayorToken: string;
let citizenToken: string;
let mayorUserId: string;

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
  const mayor = await createTestUser({ email: 'mayor-ws@test.com', role: 'MAYOR' });
  const citizen = await createTestUser({ email: 'citizen-ws@test.com', role: 'CITIZEN' });
  mayorToken = mayor.accessToken;
  mayorUserId = mayor.user.id;
  citizenToken = citizen.accessToken;
});

describe('weeklySummaryService — week math', () => {
  it('returns a weekKey matching YYYY-Www', () => {
    const key = weeklySummaryService.getCurrentWeekKey(new Date('2026-06-15T12:00:00Z'));
    expect(key).toMatch(/^\d{4}-W\d{2}$/);
  });

  it('returns the same weekKey for Mon-Sun of the same ISO week', () => {
    const mon = weeklySummaryService.getCurrentWeekKey(new Date('2026-06-15T00:00:00Z')); // Mon
    const sun = weeklySummaryService.getCurrentWeekKey(new Date('2026-06-21T23:59:00Z')); // Sun
    expect(mon).toBe(sun);
  });

  it('shifts the weekKey across a Sunday→Monday boundary', () => {
    const sun = weeklySummaryService.getCurrentWeekKey(new Date('2026-06-21T23:59:00Z'));
    const mon = weeklySummaryService.getCurrentWeekKey(new Date('2026-06-22T00:00:01Z'));
    expect(sun).not.toBe(mon);
  });

  it('round-trips a weekKey back to the same Mon-Sun range', () => {
    const original = weeklySummaryService.getCurrentWeekKey(new Date('2026-06-15T12:00:00Z'));
    const { weekStart, weekEnd } = weeklySummaryService.parseWeekKey(original);
    const recomputed = weeklySummaryService.getCurrentWeekKey(weekStart);
    expect(recomputed).toBe(original);
    // weekEnd is exclusive (next Monday)
    expect(weekEnd.getTime() - weekStart.getTime()).toBe(7 * 24 * 60 * 60 * 1000);
  });
});

describe('weeklySummaryService — generation', () => {
  it('creates a row for an empty week (idempotent on second call)', async () => {
    const weekKey = '2099-W01';
    const first = await weeklySummaryService.generate(weekKey, { source: 'MANUAL' });
    expect(first.created).toBe(true);
    expect(first.row.weekKey).toBe(weekKey);
    expect(first.row.body).toContain('5 issues'); // from our stub
    const second = await weeklySummaryService.generate(weekKey, { source: 'MANUAL' });
    expect(second.created).toBe(false);
    expect(second.row.id).toBe(first.row.id);
  });

  it('force: true regenerates even when a row exists', async () => {
    const weekKey = '2099-W02';
    const first = await weeklySummaryService.generate(weekKey, { source: 'MANUAL' });
    const firstUpdatedAt = first.row.generatedAt.getTime();
    // Force regen after a tiny delay
    await new Promise((r) => setTimeout(r, 20));
    const second = await weeklySummaryService.generate(weekKey, { source: 'MANUAL', force: true });
    expect(second.created).toBe(true);
    expect(second.row.id).toBe(first.row.id);
    expect(second.row.generatedAt.getTime()).toBeGreaterThanOrEqual(firstUpdatedAt);
  });

  it('rejects an invalid weekKey', async () => {
    await expect(weeklySummaryService.generate('not-a-week')).rejects.toThrow(/Invalid weekKey/);
  });

  it('aggregates stats for the current week', async () => {
    const { weekStart, weekEnd } = weeklySummaryService.getWeekRange();
    // Create 3 issues in-window, 1 out-of-window
    const citizen = await createTestUser({ email: 'ws-cit@test.com', role: 'CITIZEN' });
    await createTestIssue(citizen.user.id, { title: 'In-window 1' });
    await createTestIssue(citizen.user.id, { title: 'In-window 2' });
    await createTestIssue(citizen.user.id, { title: 'In-window 3' });
    // Mark one resolved within the window
    const inWindow = await prisma.issue.findFirst({ where: { title: 'In-window 1' } });
    if (inWindow) {
      await prisma.issue.update({
        where: { id: inWindow.id },
        data: { resolvedAt: new Date(), status: 'RESOLVED' },
      });
    }
    const stats = await weeklySummaryService.aggregateStats(weekStart, weekEnd);
    expect(stats.newCount).toBeGreaterThanOrEqual(3);
    expect(stats.resolvedCount).toBeGreaterThanOrEqual(1);
  });
});

describe('POST /api/v1/weekly-summaries', () => {
  it('mayor can trigger a generation for the current week', async () => {
    const res = await request(app)
      .post('/api/v1/weekly-summaries')
      .set('Authorization', `Bearer ${mayorToken}`)
      .send({});
    expect(res.status).toBe(201);
    expect(res.body.data.weekKey).toMatch(/^\d{4}-W\d{2}$/);
  });

  it('returns 200 on the second call (idempotent)', async () => {
    await request(app).post('/api/v1/weekly-summaries').set('Authorization', `Bearer ${mayorToken}`).send({});
    const res = await request(app).post('/api/v1/weekly-summaries').set('Authorization', `Bearer ${mayorToken}`).send({});
    expect(res.status).toBe(200);
    expect(res.body.created).toBe(false);
  });

  it('citizen cannot trigger a generation', async () => {
    const res = await request(app).post('/api/v1/weekly-summaries').set('Authorization', `Bearer ${citizenToken}`).send({});
    expect(res.status).toBe(403);
  });

  it('validates weekKey format', async () => {
    const res = await request(app)
      .post('/api/v1/weekly-summaries')
      .set('Authorization', `Bearer ${mayorToken}`)
      .send({ weekKey: '2026-24' });
    expect(res.status).toBe(400);
  });
});

describe('GET /api/v1/weekly-summaries', () => {
  beforeEach(async () => {
    await request(app).post('/api/v1/weekly-summaries').set('Authorization', `Bearer ${mayorToken}`).send({});
  });

  it('lists summaries', async () => {
    const res = await request(app).get('/api/v1/weekly-summaries').set('Authorization', `Bearer ${mayorToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
  });

  it('returns the latest row', async () => {
    const res = await request(app).get('/api/v1/weekly-summaries/latest').set('Authorization', `Bearer ${mayorToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.weekKey).toMatch(/^\d{4}-W\d{2}$/);
  });

  it('looks up by weekKey', async () => {
    const key = weeklySummaryService.getCurrentWeekKey();
    const res = await request(app).get(`/api/v1/weekly-summaries/${key}`).set('Authorization', `Bearer ${mayorToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.weekKey).toBe(key);
  });

  it('returns 404 for unknown weekKey', async () => {
    const res = await request(app).get('/api/v1/weekly-summaries/1999-W01').set('Authorization', `Bearer ${mayorToken}`);
    expect(res.status).toBe(404);
  });
});
