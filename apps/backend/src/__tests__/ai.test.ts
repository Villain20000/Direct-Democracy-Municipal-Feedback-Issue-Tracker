import request from 'supertest';
import { createTestUser, cleanupDatabase, disconnectDatabase } from './helpers';

let app: any;
let authToken: string;

beforeAll(async () => {
  const appModule = await import('../index');
  app = appModule.default;
  const user = await createTestUser({ email: 'ai-tester@test.com', role: 'SUPER_ADMIN' });
  authToken = user.accessToken;
});

afterAll(async () => {
  await cleanupDatabase();
  await disconnectDatabase();
});

describe('AI Endpoints', () => {
  // AI endpoints hit Ollama which can be slow or unavailable in CI/test envs
  jest.setTimeout(30000);
  describe('POST /api/v1/ai/categorize', () => {
    it('should categorize issue text', async () => {
      const res = await request(app)
        .post('/api/v1/ai/categorize')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ text: 'There is a large pothole on Main Street causing car damage' });

      // AI may be unavailable in test env
      if (res.status === 200) {
        expect(res.body.success).toBe(true);
        expect(res.body.data.category).toBeDefined();
      } else {
        expect(res.status).toBe(503);
      }
    });

    it('should reject without text', async () => {
      const res = await request(app)
        .post('/api/v1/ai/categorize')
        .set('Authorization', `Bearer ${authToken}`)
        .send({});

      expect(res.status).toBe(400);
    });

    it('should reject without authentication', async () => {
      const res = await request(app)
        .post('/api/v1/ai/categorize')
        .send({ text: 'test' });

      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/v1/ai/priority', () => {
    it('should score priority of issue text', async () => {
      const res = await request(app)
        .post('/api/v1/ai/priority')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ text: 'Water main break flooding the street', category: 'UTILITIES' });

      if (res.status === 200) {
        expect(res.body.success).toBe(true);
        expect(res.body.data.score).toBeDefined();
        expect(res.body.data.justification).toBeDefined();
      } else {
        expect(res.status).toBe(503);
      }
    });
  });

  describe('POST /api/v1/ai/sentiment', () => {
    it('should analyze sentiment', async () => {
      const res = await request(app)
        .post('/api/v1/ai/sentiment')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ text: 'The new park is wonderful! Great job city council!' });

      if (res.status === 200) {
        expect(res.body.success).toBe(true);
        expect(['POSITIVE', 'NEUTRAL', 'NEGATIVE']).toContain(res.body.data.sentiment);
      } else {
        expect(res.status).toBe(503);
      }
    });
  });

  describe('POST /api/v1/ai/summary', () => {
    it('should generate summary', async () => {
      const res = await request(app)
        .post('/api/v1/ai/summary')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ text: 'A large pothole has been growing on Main Street for weeks. Multiple residents have reported vehicle damage.' });

      if (res.status === 200) {
        expect(res.body.success).toBe(true);
        expect(typeof res.body.data.summary).toBe('string');
      } else {
        expect(res.status).toBe(503);
      }
    });
  });

  describe('POST /api/v1/ai/trends', () => {
    it('should detect trends from issues', async () => {
      const res = await request(app)
        .post('/api/v1/ai/trends')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          issues: [
            { title: 'Pothole on Main', description: 'Large pothole', category: 'INFRASTRUCTURE' },
            { title: 'Broken streetlight', description: 'No light for weeks', category: 'INFRASTRUCTURE' },
          ],
        });

      if (res.status === 200) {
        expect(res.body.success).toBe(true);
        expect(res.body.data.trends).toBeDefined();
      } else {
        expect(res.status).toBe(503);
      }
    });

    it('should reject without issues array', async () => {
      const res = await request(app)
        .post('/api/v1/ai/trends')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ issues: 'not-an-array' });

      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/v1/ai/chat', () => {
    it('should respond to chat messages', async () => {
      const res = await request(app)
        .post('/api/v1/ai/chat')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          messages: [{ role: 'user', content: 'How do I report a pothole?' }],
        });

      if (res.status === 200) {
        expect(res.body.success).toBe(true);
        expect(res.body.data.answer).toBeDefined();
        expect(Array.isArray(res.body.data.citations)).toBe(true);
        expect(typeof res.body.data.ragUsed).toBe('boolean');
      } else {
        expect(res.status).toBe(503);
      }
    });

    it('should reject without messages', async () => {
      const res = await request(app)
        .post('/api/v1/ai/chat')
        .set('Authorization', `Bearer ${authToken}`)
        .send({});

      expect(res.status).toBe(400);
    });
  });
});
