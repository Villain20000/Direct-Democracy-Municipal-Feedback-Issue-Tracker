import request from 'supertest';
import { createTestUser, cleanupDatabase, disconnectDatabase } from './helpers';

let app: any;
let adminToken: string;
let citizenToken: string;

beforeAll(async () => {
  const appModule = await import('../index');
  app = appModule.default;
  const admin = await createTestUser({ email: 'survey-admin@test.com', role: 'MAYOR' });
  const citizen = await createTestUser({ email: 'survey-citizen@test.com', role: 'CITIZEN' });
  adminToken = admin.accessToken;
  citizenToken = citizen.accessToken;
});

afterAll(async () => {
  await cleanupDatabase();
  await disconnectDatabase();
});

beforeEach(async () => {
  await cleanupDatabase();
  const admin = await createTestUser({ email: 'survey-admin@test.com', role: 'MAYOR' });
  const citizen = await createTestUser({ email: 'survey-citizen@test.com', role: 'CITIZEN' });
  adminToken = admin.accessToken;
  citizenToken = citizen.accessToken;
});

describe('Survey Endpoints', () => {
  it('should create a survey with questions', async () => {
    const res = await request(app)
      .post('/api/v1/surveys')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Community Satisfaction Survey',
        description: 'Tell us how we are doing',
        questions: [
          { text: 'How satisfied are you?', type: 'RATING', order: 1 },
          { text: 'Any comments?', type: 'TEXT', order: 2 },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body.data.title).toBe('Community Satisfaction Survey');
    expect(res.body.data.questions).toHaveLength(2);
  });

  it('should list surveys', async () => {
    await request(app)
      .post('/api/v1/surveys')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Test Survey',
        questions: [{ text: 'Q1', type: 'TEXT', order: 1 }],
      });

    const res = await request(app).get('/api/v1/surveys');
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
  });

  it('should submit a survey response', async () => {
    const createRes = await request(app)
      .post('/api/v1/surveys')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Response Test',
        questions: [{ text: 'Favorite service?', type: 'TEXT', order: 1 }],
      });

    const surveyId = createRes.body.data.id;
    const res = await request(app)
      .post(`/api/v1/surveys/${surveyId}/respond`)
      .set('Authorization', `Bearer ${citizenToken}`)
      .send({ answers: { q1: 'Parks' } });

    expect(res.status).toBe(201);
    expect(res.body.data.answers).toEqual({ q1: 'Parks' });
  });

  it('should reject duplicate survey response', async () => {
    const createRes = await request(app)
      .post('/api/v1/surveys')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Dup Test',
        questions: [{ text: 'Q?', type: 'TEXT', order: 1 }],
      });

    const surveyId = createRes.body.data.id;
    await request(app)
      .post(`/api/v1/surveys/${surveyId}/respond`)
      .set('Authorization', `Bearer ${citizenToken}`)
      .send({ answers: { q1: 'yes' } });

    const res = await request(app)
      .post(`/api/v1/surveys/${surveyId}/respond`)
      .set('Authorization', `Bearer ${citizenToken}`)
      .send({ answers: { q1: 'no' } });

    // 409 Conflict is the correct REST status when the same user has
    // already responded to the survey — the unique (surveyId, userId)
    // index throws P2002 which the service maps to ConflictError.
    // Old assertion of 400 was underspecified.
    expect(res.status).toBe(409);
  });
});