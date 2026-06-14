import request from 'supertest';
import { createTestUser, cleanupDatabase, disconnectDatabase } from './helpers';

let app: any;
let councilToken: string;
let citizenToken: string;

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
  const council = await createTestUser({ email: 'forum-council@test.com', role: 'COUNCIL_MEMBER' });
  const citizen = await createTestUser({ email: 'forum-citizen@test.com', role: 'CITIZEN' });
  councilToken = council.accessToken;
  citizenToken = citizen.accessToken;
});

describe('Forum Endpoints', () => {
  it('should create a forum', async () => {
    const res = await request(app)
      .post('/api/v1/forums')
      .set('Authorization', `Bearer ${councilToken}`)
      .send({ title: 'Downtown Development', description: 'Discuss downtown plans' });

    expect(res.status).toBe(201);
    expect(res.body.data.title).toBe('Downtown Development');
  });

  it('should list forums', async () => {
    await request(app)
      .post('/api/v1/forums')
      .set('Authorization', `Bearer ${councilToken}`)
      .send({ title: 'List Test Forum' });

    const res = await request(app).get('/api/v1/forums');
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
  });

  it('should add a post to a forum', async () => {
    const createRes = await request(app)
      .post('/api/v1/forums')
      .set('Authorization', `Bearer ${councilToken}`)
      .send({ title: 'Post Test Forum' });

    const forumId = createRes.body.data.id;
    const res = await request(app)
      .post(`/api/v1/forums/${forumId}/posts`)
      .set('Authorization', `Bearer ${citizenToken}`)
      .send({ content: 'I support the new park proposal.' });

    expect(res.status).toBe(201);
    expect(res.body.data.content).toContain('park proposal');
  });

  it('should get forum with posts', async () => {
    const createRes = await request(app)
      .post('/api/v1/forums')
      .set('Authorization', `Bearer ${councilToken}`)
      .send({ title: 'Detail Test' });

    const forumId = createRes.body.data.id;
    await request(app)
      .post(`/api/v1/forums/${forumId}/posts`)
      .set('Authorization', `Bearer ${citizenToken}`)
      .send({ content: 'Hello forum!' });

    const res = await request(app).get(`/api/v1/forums/${forumId}`);
    expect(res.status).toBe(200);
    expect(res.body.data.posts).toHaveLength(1);
  });
});