import request from 'supertest';

let app: any;

beforeAll(async () => {
  const appModule = await import('../index');
  app = appModule.default;
});

describe('Health Check', () => {
  it('should return status ok', async () => {
    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.timestamp).toBeDefined();
    expect(res.body.version).toBe('1.0.0');
  });
});
