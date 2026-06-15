/**
 * Phase D1 — Referendum tests.
 *
 * Exercises:
 *  - Status state machine (DRAFT -> OPEN -> CLOSED -> PASSED|REJECTED)
 *  - Vote uniqueness (the @@unique DB index + service-level check)
 *  - Time-window enforcement (can't vote before opensAt / after closesAt)
 *  - Eligibility filter (eligibleRoles gating)
 *  - Pass-threshold + min-participation logic in close()
 *  - 401 / 403 / 404 / 400 negative paths
 */
import request from 'supertest';
import { prisma, createTestUser, cleanupDatabase, disconnectDatabase } from './helpers';

let app: any;
let mayorToken: string;
let mayorId: string;
let councilToken: string;
let councilId: string;
let citizenToken: string;
let citizenId: string;

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
  const mayor = await createTestUser({ email: 'mayor-ref@test.com', role: 'MAYOR' });
  const council = await createTestUser({ email: 'council-ref@test.com', role: 'COUNCIL_MEMBER' });
  const citizen = await createTestUser({ email: 'citizen-ref@test.com', role: 'CITIZEN' });
  mayorToken = mayor.accessToken; mayorId = mayor.user.id;
  councilToken = council.accessToken; councilId = council.user.id;
  citizenToken = citizen.accessToken; citizenId = citizen.user.id;
});

const isoIn = (hours: number) => new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
// `isoInPast` is the same helper but with a negative offset — we need this
// in every test that creates a referendum, patches it to OPEN, and then
// immediately tries to cast a vote. The service's castVote enforces a
// time-window check (`now < opensAt` rejects with 400), so any test that
// flips to OPEN in real time needs `opensAt` already in the past.
const isoInPast = (hours: number) => new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

describe('Phase D1 — Referendum lifecycle', () => {
  it('mayor creates a referendum in DRAFT', async () => {
    const res = await request(app)
      .post('/api/v1/referendums')
      .set('Authorization', `Bearer ${mayorToken}`)
      .send({
        title: 'New park by the river?',
        description: 'Should the city build a park on the riverside lot?',
        body: 'Allocate €2M from the 2027 budget to construct a 1.5-hectare public park.',
        opensAt: isoIn(24),
        closesAt: isoIn(24 * 8),
        passThreshold: 0.5,
        minParticipation: 10,
      });
    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('DRAFT');
    expect(res.body.data.createdById).toBe(mayorId);
    expect(res.body.data.yesCount).toBe(0);
  });

  it('citizen cannot create a referendum', async () => {
    const res = await request(app)
      .post('/api/v1/referendums')
      .set('Authorization', `Bearer ${citizenToken}`)
      .send({
        title: 'X', description: 'Y', body: 'Z',
        opensAt: isoIn(1), closesAt: isoIn(2),
      });
    expect(res.status).toBe(403);
  });

  it('rejects closesAt <= opensAt', async () => {
    const res = await request(app)
      .post('/api/v1/referendums')
      .set('Authorization', `Bearer ${mayorToken}`)
      .send({
        title: 'Bad window', description: 'X', body: 'Y',
        opensAt: isoIn(2), closesAt: isoIn(1),
      });
    expect(res.status).toBe(400);
  });

  it('happy path: DRAFT -> OPEN -> votes -> close -> PASSED', async () => {
    const create = await request(app)
      .post('/api/v1/referendums')
      .set('Authorization', `Bearer ${mayorToken}`)
      .send({
        title: 'R1', description: 'd', body: 'b',
        opensAt: isoInPast(0.1), closesAt: isoIn(24),
        minParticipation: 2,
      });
    const id = create.body.data.id;

    // Open the vote
    const open = await request(app)
      .patch(`/api/v1/referendums/${id}/status`)
      .set('Authorization', `Bearer ${mayorToken}`)
      .send({ status: 'OPEN' });
    expect(open.status).toBe(200);
    expect(open.body.data.status).toBe('OPEN');

    // Cast 3 YES, 1 NO
    const yesVoters = await Promise.all(
      [1, 2, 3].map((n) =>
        createTestUser({ email: `yes-${n}-ref@test.com`, role: 'CITIZEN' }),
      ),
    );
    const noVoter = await createTestUser({ email: 'no-ref@test.com', role: 'CITIZEN' });
    for (const v of yesVoters) {
      const r = await request(app)
        .post(`/api/v1/referendums/${id}/vote`)
        .set('Authorization', `Bearer ${v.accessToken}`)
        .send({ choice: 'YES' });
      expect(r.status).toBe(201);
    }
    const noRes = await request(app)
      .post(`/api/v1/referendums/${id}/vote`)
      .set('Authorization', `Bearer ${noVoter.accessToken}`)
      .send({ choice: 'NO' });
    expect(noRes.status).toBe(201);

    // Tally should now be 3/1/0
    const after = await prisma.referendum.findUnique({ where: { id } });
    expect(after?.yesCount).toBe(3);
    expect(after?.noCount).toBe(1);
    expect(after?.totalVotes).toBe(4);

    // Close + tally
    const closed = await request(app)
      .post(`/api/v1/referendums/${id}/close`)
      .set('Authorization', `Bearer ${mayorToken}`);
    expect(closed.status).toBe(200);
    expect(closed.body.data.status).toBe('PASSED');
    expect(closed.body.data.decidedAt).toBeTruthy();
  });

  it('REJECTED when yes-ratio < passThreshold', async () => {
    const create = await request(app)
      .post('/api/v1/referendums')
      .set('Authorization', `Bearer ${mayorToken}`)
      .send({
        title: 'R-reject', description: 'd', body: 'b',
        opensAt: isoInPast(0.1), closesAt: isoIn(24),
        passThreshold: 0.6, // needs 60% YES
        minParticipation: 1,
      });
    const id = create.body.data.id;
    await request(app)
      .patch(`/api/v1/referendums/${id}/status`)
      .set('Authorization', `Bearer ${mayorToken}`)
      .send({ status: 'OPEN' });

    // 1 YES, 2 NO  -> 33% YES, below 60% threshold
    const yes = await createTestUser({ email: 'rej-yes@test.com', role: 'CITIZEN' });
    const no1 = await createTestUser({ email: 'rej-no1@test.com', role: 'CITIZEN' });
    const no2 = await createTestUser({ email: 'rej-no2@test.com', role: 'CITIZEN' });
    await request(app).post(`/api/v1/referendums/${id}/vote`).set('Authorization', `Bearer ${yes.accessToken}`).send({ choice: 'YES' });
    await request(app).post(`/api/v1/referendums/${id}/vote`).set('Authorization', `Bearer ${no1.accessToken}`).send({ choice: 'NO' });
    await request(app).post(`/api/v1/referendums/${id}/vote`).set('Authorization', `Bearer ${no2.accessToken}`).send({ choice: 'NO' });

    const closed = await request(app)
      .post(`/api/v1/referendums/${id}/close`)
      .set('Authorization', `Bearer ${mayorToken}`);
    expect(closed.body.data.status).toBe('REJECTED');
  });

  it('REJECTED when below minParticipation even if yes-ratio passes', async () => {
    const create = await request(app)
      .post('/api/v1/referendums')
      .set('Authorization', `Bearer ${mayorToken}`)
      .send({
        title: 'R-quorum', description: 'd', body: 'b',
        opensAt: isoInPast(0.1), closesAt: isoIn(24),
        passThreshold: 0.5,
        minParticipation: 100, // very high
      });
    const id = create.body.data.id;
    await request(app)
      .patch(`/api/v1/referendums/${id}/status`)
      .set('Authorization', `Bearer ${mayorToken}`)
      .send({ status: 'OPEN' });

    const v1 = await createTestUser({ email: 'quorum-1@test.com', role: 'CITIZEN' });
    await request(app).post(`/api/v1/referendums/${id}/vote`).set('Authorization', `Bearer ${v1.accessToken}`).send({ choice: 'YES' });

    const closed = await request(app)
      .post(`/api/v1/referendums/${id}/close`)
      .set('Authorization', `Bearer ${mayorToken}`);
    expect(closed.body.data.status).toBe('REJECTED'); // failed quorum
  });

  it('rejects double-vote with 409', async () => {
    const create = await request(app)
      .post('/api/v1/referendums')
      .set('Authorization', `Bearer ${mayorToken}`)
      .send({
        title: 'R-double', description: 'd', body: 'b',
        opensAt: isoInPast(0.1), closesAt: isoIn(24),
      });
    const id = create.body.data.id;
    await request(app)
      .patch(`/api/v1/referendums/${id}/status`)
      .set('Authorization', `Bearer ${mayorToken}`)
      .send({ status: 'OPEN' });

    const v = await createTestUser({ email: 'double@test.com', role: 'CITIZEN' });
    const first = await request(app)
      .post(`/api/v1/referendums/${id}/vote`)
      .set('Authorization', `Bearer ${v.accessToken}`)
      .send({ choice: 'YES' });
    expect(first.status).toBe(201);
    const second = await request(app)
      .post(`/api/v1/referendums/${id}/vote`)
      .set('Authorization', `Bearer ${v.accessToken}`)
      .send({ choice: 'NO' });
    expect(second.status).toBe(409);
  });

  it('rejects vote on non-OPEN referendum', async () => {
    const create = await request(app)
      .post('/api/v1/referendums')
      .set('Authorization', `Bearer ${mayorToken}`)
      .send({
        title: 'R-draft-vote', description: 'd', body: 'b',
        opensAt: isoIn(0.1), closesAt: isoIn(24),
      });
    const id = create.body.data.id;
    const v = await createTestUser({ email: 'draft-vote@test.com', role: 'CITIZEN' });
    const res = await request(app)
      .post(`/api/v1/referendums/${id}/vote`)
      .set('Authorization', `Bearer ${v.accessToken}`)
      .send({ choice: 'YES' });
    expect(res.status).toBe(400);
  });

  it('respects eligibleRoles filter', async () => {
    const create = await request(app)
      .post('/api/v1/referendums')
      .set('Authorization', `Bearer ${mayorToken}`)
      .send({
        title: 'R-council-only', description: 'd', body: 'b',
        opensAt: isoInPast(0.1), closesAt: isoIn(24),
        eligibleRoles: ['COUNCIL_MEMBER'],
      });
    const id = create.body.data.id;
    await request(app)
      .patch(`/api/v1/referendums/${id}/status`)
      .set('Authorization', `Bearer ${mayorToken}`)
      .send({ status: 'OPEN' });

    const citizen = await createTestUser({ email: 'no-elig@test.com', role: 'CITIZEN' });
    const blocked = await request(app)
      .post(`/api/v1/referendums/${id}/vote`)
      .set('Authorization', `Bearer ${citizen.accessToken}`)
      .send({ choice: 'YES' });
    expect(blocked.status).toBe(403);

    const allowed = await request(app)
      .post(`/api/v1/referendums/${id}/vote`)
      .set('Authorization', `Bearer ${councilToken}`)
      .send({ choice: 'YES' });
    expect(allowed.status).toBe(201);
  });

  it('rejects invalid status transition', async () => {
    const create = await request(app)
      .post('/api/v1/referendums')
      .set('Authorization', `Bearer ${mayorToken}`)
      .send({
        title: 'R-bad-transition', description: 'd', body: 'b',
        opensAt: isoIn(0.1), closesAt: isoIn(24),
      });
    const id = create.body.data.id;
    // DRAFT -> PASSED is not allowed
    const res = await request(app)
      .patch(`/api/v1/referendums/${id}/status`)
      .set('Authorization', `Bearer ${mayorToken}`)
      .send({ status: 'PASSED' });
    expect(res.status).toBe(400);
  });

  it('lists referendums publicly and supports status filter', async () => {
    await request(app).post('/api/v1/referendums').set('Authorization', `Bearer ${mayorToken}`).send({
      title: 'A', description: 'd', body: 'b',
      opensAt: isoIn(24), closesAt: isoIn(48),
    });
    const res = await request(app).get('/api/v1/referendums?status=DRAFT');
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(1);
  });

  it('returns 404 for unknown referendum', async () => {
    const res = await request(app).get('/api/v1/referendums/00000000-0000-0000-0000-000000000000');
    expect(res.status).toBe(404);
  });

  it('GET /:id/my-vote returns the current vote or null', async () => {
    const create = await request(app).post('/api/v1/referendums').set('Authorization', `Bearer ${mayorToken}`).send({
      title: 'A', description: 'd', body: 'b',
      opensAt: isoInPast(0.1), closesAt: isoIn(24),
    });
    const id = create.body.data.id;
    await request(app)
      .patch(`/api/v1/referendums/${id}/status`)
      .set('Authorization', `Bearer ${mayorToken}`)
      .send({ status: 'OPEN' });

    const before = await request(app)
      .get(`/api/v1/referendums/${id}/my-vote`)
      .set('Authorization', `Bearer ${citizenToken}`);
    expect(before.status).toBe(200);
    expect(before.body.data).toBeNull();

    await request(app).post(`/api/v1/referendums/${id}/vote`).set('Authorization', `Bearer ${citizenToken}`).send({ choice: 'ABSTAIN' });
    const after = await request(app)
      .get(`/api/v1/referendums/${id}/my-vote`)
      .set('Authorization', `Bearer ${citizenToken}`);
    expect(after.body.data.choice).toBe('ABSTAIN');
  });

  it('forbids delete when votes exist', async () => {
    const create = await request(app).post('/api/v1/referendums').set('Authorization', `Bearer ${mayorToken}`).send({
      title: 'A', description: 'd', body: 'b',
      opensAt: isoInPast(0.1), closesAt: isoIn(24),
    });
    const id = create.body.data.id;
    await request(app)
      .patch(`/api/v1/referendums/${id}/status`)
      .set('Authorization', `Bearer ${mayorToken}`)
      .send({ status: 'OPEN' });
    const v = await createTestUser({ email: 'forbid-del@test.com', role: 'CITIZEN' });
    await request(app).post(`/api/v1/referendums/${id}/vote`).set('Authorization', `Bearer ${v.accessToken}`).send({ choice: 'YES' });

    const del = await request(app)
      .delete(`/api/v1/referendums/${id}`)
      .set('Authorization', `Bearer ${mayorToken}`);
    expect(del.status).toBe(400);
  });
});
