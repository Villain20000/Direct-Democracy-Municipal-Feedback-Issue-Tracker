import request from 'supertest';
import { prisma, createTestUser, cleanupDatabase, disconnectDatabase } from './helpers';

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

async function createTestEvent(creatorId: string, overrides: { title?: string; type?: string; startTime?: Date; endTime?: Date } = {}) {
  const now = new Date();
  const start = overrides.startTime || new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const end = overrides.endTime || new Date(now.getTime() + 26 * 60 * 60 * 1000);

  return prisma.event.create({
    data: {
      title: overrides.title || `Event ${Date.now()}`,
      description: 'Test event description',
      location: 'City Hall',
      startTime: start,
      endTime: end,
      type: overrides.type || 'TOWN_HALL',
      creatorId,
    },
  });
}

describe('Event Endpoints', () => {
  describe('GET /api/v1/events', () => {
    it('should list events publicly', async () => {
      const creator = await createTestUser({ email: 'creator@test.com', role: 'STAFF' });
      await createTestEvent(creator.user.id, { title: 'Town Hall' });
      await createTestEvent(creator.user.id, { title: 'Cleanup Day' });

      const res = await request(app).get('/api/v1/events');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.total).toBe(2);
    });

    it('should paginate events', async () => {
      const creator = await createTestUser({ email: 'creator@test.com', role: 'STAFF' });
      for (let i = 0; i < 5; i++) {
        await createTestEvent(creator.user.id, { title: `Event ${i}` });
      }

      const res = await request(app).get('/api/v1/events?page=1&pageSize=3');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(3);
      expect(res.body.total).toBe(5);
      expect(res.body.totalPages).toBe(2);
    });

    it('should filter events by type', async () => {
      const creator = await createTestUser({ email: 'creator@test.com', role: 'STAFF' });
      await createTestEvent(creator.user.id, { type: 'TOWN_HALL' });
      await createTestEvent(creator.user.id, { type: 'CLEANUP' });
      await createTestEvent(creator.user.id, { type: 'TOWN_HALL' });

      const res = await request(app).get('/api/v1/events?type=TOWN_HALL');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
      res.body.data.forEach((e: any) => expect(e.type).toBe('TOWN_HALL'));
    });

    it('should search events by title', async () => {
      const creator = await createTestUser({ email: 'creator@test.com', role: 'STAFF' });
      await createTestEvent(creator.user.id, { title: 'Spring Cleanup Drive' });
      await createTestEvent(creator.user.id, { title: 'Budget Meeting' });

      const res = await request(app).get('/api/v1/events?search=cleanup');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].title).toContain('Cleanup');
    });

    it('should filter upcoming events only', async () => {
      const creator = await createTestUser({ email: 'creator@test.com', role: 'STAFF' });
      const now = new Date();
      // Future event
      await createTestEvent(creator.user.id, {
        title: 'Future Event',
        startTime: new Date(now.getTime() + 48 * 60 * 60 * 1000),
        endTime: new Date(now.getTime() + 50 * 60 * 60 * 1000),
      });
      // Past event
      await createTestEvent(creator.user.id, {
        title: 'Past Event',
        startTime: new Date(now.getTime() - 48 * 60 * 60 * 1000),
        endTime: new Date(now.getTime() - 46 * 60 * 60 * 1000),
      });

      const res = await request(app).get('/api/v1/events?upcoming=true');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].title).toBe('Future Event');
    });
  });

  describe('GET /api/v1/events/:id', () => {
    it('should return event detail with RSVPs', async () => {
      const creator = await createTestUser({ email: 'creator@test.com', role: 'STAFF' });
      const event = await createTestEvent(creator.user.id, { title: 'Detail Event' });

      const res = await request(app).get(`/api/v1/events/${event.id}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.title).toBe('Detail Event');
      expect(res.body.data.rsvps).toBeDefined();
      expect(res.body.data.creator).toBeDefined();
    });

    it('should return 404 for non-existent event', async () => {
      const res = await request(app).get('/api/v1/events/non-existent-id');
      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/v1/events', () => {
    it('should create an event as staff', async () => {
      const staff = await createTestUser({ email: 'staff@test.com', role: 'STAFF' });
      const now = new Date();

      const res = await request(app)
        .post('/api/v1/events')
        .set('Authorization', `Bearer ${staff.accessToken}`)
        .send({
          title: 'New Event',
          description: 'A new community event',
          location: 'Community Center',
          startTime: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(),
          endTime: new Date(now.getTime() + 26 * 60 * 60 * 1000).toISOString(),
          type: 'COMMUNITY',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.title).toBe('New Event');
      expect(res.body.data.type).toBe('COMMUNITY');
      expect(res.body.data.creatorId).toBe(staff.user.id);
    });

    it('should create event as ward rep', async () => {
      const rep = await createTestUser({ email: 'rep@test.com', role: 'WARD_REP' });
      const now = new Date();

      const res = await request(app)
        .post('/api/v1/events')
        .set('Authorization', `Bearer ${rep.accessToken}`)
        .send({
          title: 'Ward Meeting',
          startTime: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(),
          endTime: new Date(now.getTime() + 26 * 60 * 60 * 1000).toISOString(),
          type: 'TOWN_HALL',
        });

      expect(res.status).toBe(201);
    });

    it('should reject event creation from citizens', async () => {
      const citizen = await createTestUser({ email: 'citizen@test.com', role: 'CITIZEN' });
      const now = new Date();

      const res = await request(app)
        .post('/api/v1/events')
        .set('Authorization', `Bearer ${citizen.accessToken}`)
        .send({
          title: 'Citizen Event',
          startTime: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(),
          endTime: new Date(now.getTime() + 26 * 60 * 60 * 1000).toISOString(),
          type: 'COMMUNITY',
        });

      expect(res.status).toBe(403);
    });

    it('should reject without authentication', async () => {
      const res = await request(app)
        .post('/api/v1/events')
        .send({ title: 'No Auth', startTime: new Date().toISOString(), endTime: new Date().toISOString(), type: 'COMMUNITY' });

      expect(res.status).toBe(401);
    });
  });

  describe('PATCH /api/v1/events/:id', () => {
    it('should update event as creator', async () => {
      const creator = await createTestUser({ email: 'creator@test.com', role: 'STAFF' });
      const event = await createTestEvent(creator.user.id);

      const res = await request(app)
        .patch(`/api/v1/events/${event.id}`)
        .set('Authorization', `Bearer ${creator.accessToken}`)
        .send({ title: 'Updated Event' });

      expect(res.status).toBe(200);
      expect(res.body.data.title).toBe('Updated Event');
    });

    it('should update event as super admin', async () => {
      const admin = await createTestUser({ email: 'admin@test.com', role: 'SUPER_ADMIN' });
      const creator = await createTestUser({ email: 'creator@test.com', role: 'STAFF' });
      const event = await createTestEvent(creator.user.id);

      const res = await request(app)
        .patch(`/api/v1/events/${event.id}`)
        .set('Authorization', `Bearer ${admin.accessToken}`)
        .send({ title: 'Admin Updated' });

      expect(res.status).toBe(200);
      expect(res.body.data.title).toBe('Admin Updated');
    });

    it('should reject update from non-creator non-admin', async () => {
      const creator = await createTestUser({ email: 'creator@test.com', role: 'STAFF' });
      const other = await createTestUser({ email: 'other@test.com', role: 'STAFF' });
      const event = await createTestEvent(creator.user.id);

      const res = await request(app)
        .patch(`/api/v1/events/${event.id}`)
        .set('Authorization', `Bearer ${other.accessToken}`)
        .send({ title: 'Hijacked' });

      expect(res.status).toBe(403);
    });
  });

  describe('DELETE /api/v1/events/:id', () => {
    it('should delete event as creator', async () => {
      const creator = await createTestUser({ email: 'creator@test.com', role: 'STAFF' });
      const event = await createTestEvent(creator.user.id);

      const res = await request(app)
        .delete(`/api/v1/events/${event.id}`)
        .set('Authorization', `Bearer ${creator.accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const deleted = await prisma.event.findUnique({ where: { id: event.id } });
      expect(deleted).toBeNull();
    });

    it('should reject delete from non-creator non-admin', async () => {
      const creator = await createTestUser({ email: 'creator@test.com', role: 'STAFF' });
      const other = await createTestUser({ email: 'other@test.com', role: 'STAFF' });
      const event = await createTestEvent(creator.user.id);

      const res = await request(app)
        .delete(`/api/v1/events/${event.id}`)
        .set('Authorization', `Bearer ${other.accessToken}`);

      expect(res.status).toBe(403);
    });
  });

  describe('POST /api/v1/events/:id/rsvp', () => {
    it('should RSVP to an event', async () => {
      const creator = await createTestUser({ email: 'creator@test.com', role: 'STAFF' });
      const attendee = await createTestUser({ email: 'attendee@test.com' });
      const event = await createTestEvent(creator.user.id);

      const res = await request(app)
        .post(`/api/v1/events/${event.id}/rsvp`)
        .set('Authorization', `Bearer ${attendee.accessToken}`)
        .send({ status: 'GOING' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('GOING');
    });

    it('should update RSVP status on re-RSVP', async () => {
      const creator = await createTestUser({ email: 'creator@test.com', role: 'STAFF' });
      const attendee = await createTestUser({ email: 'attendee@test.com' });
      const event = await createTestEvent(creator.user.id);

      await request(app)
        .post(`/api/v1/events/${event.id}/rsvp`)
        .set('Authorization', `Bearer ${attendee.accessToken}`)
        .send({ status: 'GOING' });

      const res = await request(app)
        .post(`/api/v1/events/${event.id}/rsvp`)
        .set('Authorization', `Bearer ${attendee.accessToken}`)
        .send({ status: 'MAYBE' });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('MAYBE');
    });

    it('should reject RSVP without status', async () => {
      const creator = await createTestUser({ email: 'creator@test.com', role: 'STAFF' });
      const attendee = await createTestUser({ email: 'attendee@test.com' });
      const event = await createTestEvent(creator.user.id);

      const res = await request(app)
        .post(`/api/v1/events/${event.id}/rsvp`)
        .set('Authorization', `Bearer ${attendee.accessToken}`)
        .send({});

      expect(res.status).toBe(400);
    });

    it('should reject RSVP without authentication', async () => {
      const res = await request(app)
        .post('/api/v1/events/fake-id/rsvp')
        .send({ status: 'GOING' });

      expect(res.status).toBe(401);
    });
  });

  describe('DELETE /api/v1/events/:id/rsvp', () => {
    it('should cancel RSVP', async () => {
      const creator = await createTestUser({ email: 'creator@test.com', role: 'STAFF' });
      const attendee = await createTestUser({ email: 'attendee@test.com' });
      const event = await createTestEvent(creator.user.id);

      await request(app)
        .post(`/api/v1/events/${event.id}/rsvp`)
        .set('Authorization', `Bearer ${attendee.accessToken}`)
        .send({ status: 'GOING' });

      const res = await request(app)
        .delete(`/api/v1/events/${event.id}/rsvp`)
        .set('Authorization', `Bearer ${attendee.accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should fail to cancel non-existent RSVP', async () => {
      const attendee = await createTestUser({ email: 'attendee@test.com' });

      const res = await request(app)
        .delete('/api/v1/events/non-existent-id/rsvp')
        .set('Authorization', `Bearer ${attendee.accessToken}`);

      // 404 is the correct REST status for "resource not found" (event
      // doesn't exist). The route returns 404 via the domain-errors
      // NotFoundError throw; the old assertion of 400 was wrong.
      expect(res.status).toBe(404);
    });
  });
});
