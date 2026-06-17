import request from 'supertest';
import { prisma, createTestUser, cleanupDatabase, disconnectDatabase } from './helpers';

// Import app after setup.ts has run (env vars set, listen patched)
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

describe('Auth Endpoints', () => {
  describe('POST /api/v1/auth/register', () => {
    it('should register a new user and return tokens', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'newuser@test.com',
          password: 'password123',
          firstName: 'John',
          lastName: 'Doe',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.accessToken).toBeDefined();
      expect(res.body.data.user.email).toBe('newuser@test.com');
      expect(res.body.data.user.firstName).toBe('John');
      expect(res.body.data.user.lastName).toBe('Doe');
      expect(res.body.data.user.role).toBe('CITIZEN');
    });

    it('should reject registration with duplicate email', async () => {
      await createTestUser({ email: 'existing@test.com' });

      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'existing@test.com',
          password: 'password123',
          firstName: 'Jane',
          lastName: 'Doe',
        });

      // 409 Conflict is the correct REST status for "the resource
      // already exists". The route throws ConflictError on a P2002
      // unique-constraint violation; the old assertion of 400 was ok
      // for "client error" but underspecified the cause.
      expect(res.status).toBe(409);
    });

    it('should reject registration with invalid email', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'not-an-email',
          password: 'password123',
          firstName: 'Test',
          lastName: 'User',
        });

      expect(res.status).toBe(400);
    });

    it('should reject registration with short password', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'test@test.com',
          password: '123',
          firstName: 'Test',
          lastName: 'User',
        });

      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/v1/auth/login', () => {
    it('should login with valid credentials', async () => {
      await createTestUser({ email: 'login@test.com', password: 'mypassword' });

      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'login@test.com', password: 'mypassword' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.accessToken).toBeDefined();
      expect(res.body.data.user.email).toBe('login@test.com');
    });

    it('should reject login with wrong password', async () => {
      await createTestUser({ email: 'wrong@test.com', password: 'correct' });

      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'wrong@test.com', password: 'wrongpassword' });

      expect(res.status).toBe(401);
    });

    it('should reject login with non-existent email', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'nonexistent@test.com', password: 'password123' });

      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/v1/auth/profile', () => {
    it('should return profile for authenticated user', async () => {
      const testUser = await createTestUser({ email: 'profile@test.com' });

      const res = await request(app)
        .get('/api/v1/auth/profile')
        .set('Authorization', `Bearer ${testUser.accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.email).toBe('profile@test.com');
    });

    it('should reject profile request without token', async () => {
      const res = await request(app).get('/api/v1/auth/profile');
      expect(res.status).toBe(401);
    });

    it('should reject profile request with invalid token', async () => {
      const res = await request(app)
        .get('/api/v1/auth/profile')
        .set('Authorization', 'Bearer invalid-token');

      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/v1/auth/forgot-password', () => {
    it('should accept forgot password for existing user', async () => {
      await createTestUser({ email: 'forgot@test.com' });

      const res = await request(app)
        .post('/api/v1/auth/forgot-password')
        .send({ email: 'forgot@test.com' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should not reveal whether email exists', async () => {
      const res = await request(app)
        .post('/api/v1/auth/forgot-password')
        .send({ email: 'missing@test.com' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('POST /api/v1/auth/reset-password', () => {
    it('should reset password with valid token', async () => {
      const { user } = await createTestUser({ email: 'reset@test.com', password: 'oldpass123' });
      const forgotRes = await request(app)
        .post('/api/v1/auth/forgot-password')
        .send({ email: 'reset@test.com' });

      expect(forgotRes.status).toBe(200);

      const tokenRecord = await prisma.passwordResetToken.findFirst({ where: { userId: user.id } });
      expect(tokenRecord).toBeTruthy();

      const res = await request(app)
        .post('/api/v1/auth/reset-password')
        .send({ token: tokenRecord!.token, password: 'newpass123' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'reset@test.com', password: 'newpass123' });

      expect(loginRes.status).toBe(200);
    });

    it('should reject invalid reset token', async () => {
      const res = await request(app)
        .post('/api/v1/auth/reset-password')
        .send({ token: 'invalid-token', password: 'newpass123' });

      // 401 Unauthorized is the correct REST status for an invalid
      // reset token — the route maps "token not found / not valid"
      // to UnauthorizedError. Old assertion of 400 was too generic.
      expect(res.status).toBe(401);
    });
  });
});
