/**
 * P1-10 escalation + P1-12 threading/@mentions + P1-13 notification
 * fan-out (ANNOUNCEMENT / VOTE_RECEIVED / EVENT, prefs + throttle).
 */
import request from 'supertest';
import {
  prisma,
  createTestUser,
  createTestIssue,
  createTestDepartment,
  cleanupDatabase,
  disconnectDatabase,
} from './helpers';
import { notificationService } from '../services/notification.service';
import { notificationPreferenceService } from '../services/notification-preference.service';
import { resetEmailThrottleForTests } from '../services/notification.service';

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
  resetEmailThrottleForTests();
});

/** Fire-and-forget fan-outs resolve after the HTTP response; poll briefly. */
async function waitFor(
  fn: () => Promise<unknown>,
  timeoutMs = 5000,
): Promise<unknown> {
  const start = Date.now();
  let last: unknown = null;
  for (;;) {
    last = await fn();
    if (last) return last;
    if (Date.now() - start > timeoutMs) return null;
    await new Promise(r => setTimeout(r, 100));
  }
}

describe('P1-10 issue escalation', () => {
  it('rejects unauthenticated and citizen escalations, 404s unknown issues', async () => {
    const reporter = await createTestUser({ email: 'esc-reporter@test.com' });
    const citizen = await createTestUser({ email: 'esc-citizen@test.com', role: 'CITIZEN' });
    const issue = await createTestIssue(reporter.user.id);

    const anon = await request(app).post(`/api/v1/issues/${issue.id}/escalate`).send({ reason: 'urgent' });
    expect([401, 403]).toContain(anon.status);

    const forbidden = await request(app)
      .post(`/api/v1/issues/${issue.id}/escalate`)
      .set('Authorization', `Bearer ${citizen.accessToken}`)
      .send({ reason: 'urgent' });
    expect(forbidden.status).toBe(403);

    const staff = await createTestUser({ email: 'esc-staff@test.com', role: 'STAFF' });
    const missing = await request(app)
      .post('/api/v1/issues/00000000-0000-0000-0000-000000000000/escalate')
      .set('Authorization', `Bearer ${staff.accessToken}`)
      .send({ reason: 'urgent' });
    expect(missing.status).toBe(404);
  });

  it('escalates: stamps fields, writes audit, notifies dept head + mayor', async () => {
    const dept = await createTestDepartment({ name: 'Esc Dept', code: 'ESCD' });
    const reporter = await createTestUser({ email: 'esc-rep2@test.com' });
    const staff = await createTestUser({ email: 'esc-staff2@test.com', role: 'STAFF' });
    const head = await createTestUser({
      email: 'esc-head@test.com', role: 'DEPARTMENT_HEAD', departmentId: dept.id,
    });
    const mayor = await createTestUser({ email: 'esc-mayor@test.com', role: 'MAYOR' });
    const issue = await createTestIssue(reporter.user.id, { departmentId: dept.id });

    const res = await request(app)
      .post(`/api/v1/issues/${issue.id}/escalate`)
      .set('Authorization', `Bearer ${staff.accessToken}`)
      .send({ reason: 'Needs leadership sign-off' });

    expect(res.status).toBe(200);
    expect(res.body.data.escalatedAt).toBeTruthy();
    expect(res.body.data.escalationReason).toContain('sign-off');

    const audit = await prisma.auditLog.findFirst({
      where: { entity: 'Issue', entityId: issue.id, action: 'ESCALATE' },
    });
    expect(audit).toBeTruthy();

    const headNotif = await waitFor(() =>
      prisma.notification.findFirst({
        where: { userId: head.user.id, type: 'ISSUE_ESCALATED' },
      }),
    );
    expect(headNotif).toBeTruthy();
    const mayorNotif = await waitFor(() =>
      prisma.notification.findFirst({
        where: { userId: mayor.user.id, type: 'ISSUE_ESCALATED' },
      }),
    );
    expect(mayorNotif).toBeTruthy();

    // Escalation queue filter + real stats counter.
    const queue = await request(app)
      .get('/api/v1/issues?escalated=true')
      .set('Authorization', `Bearer ${staff.accessToken}`);
    expect(queue.body.data.map((i: any) => i.id)).toContain(issue.id);

    const stats = await request(app)
      .get(`/api/v1/issues/stats?departmentId=${dept.id}`)
      .set('Authorization', `Bearer ${staff.accessToken}`);
    expect(stats.body.data.escalatedCount).toBe(1);
  });
});

describe('P1-12 threading + mentions', () => {
  it('nests a reply two levels and rejects a third level', async () => {
    const user = await createTestUser({ email: 'thread@test.com' });
    const issue = await createTestIssue(user.user.id);

    const parent = await request(app)
      .post(`/api/v1/issues/${issue.id}/comments`)
      .set('Authorization', `Bearer ${user.accessToken}`)
      .send({ content: 'Top-level comment' });
    expect(parent.status).toBe(201);

    const reply = await request(app)
      .post(`/api/v1/issues/${issue.id}/comments`)
      .set('Authorization', `Bearer ${user.accessToken}`)
      .send({ content: 'A reply', parentId: parent.body.data.id });
    expect(reply.status).toBe(201);

    const third = await request(app)
      .post(`/api/v1/issues/${issue.id}/comments`)
      .set('Authorization', `Bearer ${user.accessToken}`)
      .send({ content: 'Too deep', parentId: reply.body.data.id });
    expect(third.status).toBe(400);

    const listed = await request(app).get(`/api/v1/issues/${issue.id}/comments`);
    const top = listed.body.data.find((c: any) => c.id === parent.body.data.id);
    expect(top.children.map((c: any) => c.id)).toContain(reply.body.data.id);
  });

  it('emits ISSUE_MENTION for @-mentioned users and honours prefs', async () => {
    const author = await createTestUser({ email: 'mention-author@test.com', firstName: 'Author', lastName: 'One' });
    const mentioned = await createTestUser({ email: 'zebedee@test.com', firstName: 'Zebedee', lastName: 'Two' });
    const issue = await createTestIssue(author.user.id);

    const res = await request(app)
      .post(`/api/v1/issues/${issue.id}/comments`)
      .set('Authorization', `Bearer ${author.accessToken}`)
      .send({ content: 'Hello @zebedee please take a look' });
    expect(res.status).toBe(201);

    const notif = await waitFor(() =>
      prisma.notification.findFirst({
        where: { userId: mentioned.user.id, type: 'ISSUE_MENTION' },
      }),
    );
    expect(notif).toBeTruthy();

    // The author is never notified of their own mention.
    const selfMention = await prisma.notification.findFirst({
      where: { userId: author.user.id, type: 'ISSUE_MENTION' },
    });
    expect(selfMention).toBeNull();

    // Opting out of in-app MENTION suppresses the row.
    await notificationPreferenceService.set(mentioned.user.id, 'inApp', 'MENTION', false);
    await request(app)
      .post(`/api/v1/issues/${issue.id}/comments`)
      .set('Authorization', `Bearer ${author.accessToken}`)
      .send({ content: 'Again @zebedee, second try' });
    await new Promise(r => setTimeout(r, 500));
    const count = await prisma.notification.count({
      where: { userId: mentioned.user.id, type: 'ISSUE_MENTION' },
    });
    expect(count).toBe(1);
  });
});

describe('P1-13 notification fan-out', () => {
  it('publishing an announcement notifies other users; opt-out is honoured', async () => {
    const author = await createTestUser({ email: 'ann-author@test.com', role: 'STAFF' });
    const reader = await createTestUser({ email: 'ann-reader@test.com', role: 'CITIZEN' });
    const optedOut = await createTestUser({ email: 'ann-optout@test.com', role: 'CITIZEN' });
    await notificationPreferenceService.set(optedOut.user.id, 'inApp', 'ANNOUNCEMENT', false);

    const res = await request(app)
      .post('/api/v1/announcements')
      .set('Authorization', `Bearer ${author.accessToken}`)
      .send({ title: 'Town hall Friday', content: 'All welcome' });
    expect(res.status).toBe(201);

    const got = await waitFor(() =>
      prisma.notification.findFirst({
        where: { userId: reader.user.id, type: 'ANNOUNCEMENT' },
      }),
    );
    expect(got).toBeTruthy();

    await new Promise(r => setTimeout(r, 500));
    const skipped = await prisma.notification.findFirst({
      where: { userId: optedOut.user.id, type: 'ANNOUNCEMENT' },
    });
    expect(skipped).toBeNull();

    // The author is not notified of their own announcement.
    const self = await prisma.notification.findFirst({
      where: { userId: author.user.id, type: 'ANNOUNCEMENT' },
    });
    expect(self).toBeNull();
  });

  it('a poll vote notifies the poll creator', async () => {
    const creator = await createTestUser({ email: 'poll-creator@test.com', role: 'MAYOR' });
    const voter = await createTestUser({ email: 'poll-voter@test.com', role: 'CITIZEN' });

    const created = await request(app)
      .post('/api/v1/polls')
      .set('Authorization', `Bearer ${creator.accessToken}`)
      .send({ title: 'Park hours?', options: ['Yes', 'No'] });
    expect(created.status).toBe(201);
    const optionId = created.body.data.options[0].id;

    const vote = await request(app)
      .post(`/api/v1/polls/${created.body.data.id}/vote`)
      .set('Authorization', `Bearer ${voter.accessToken}`)
      .send({ optionId });
    expect(vote.status).toBe(200);

    const notif = await waitFor(() =>
      prisma.notification.findFirst({
        where: { userId: creator.user.id, type: 'VOTE_RECEIVED' },
      }),
    );
    expect(notif).toBeTruthy();
    expect(JSON.stringify(notif)).toContain(created.body.data.id);
  });

  it('a resolution vote notifies the proposer', async () => {
    const proposer = await createTestUser({ email: 'res-prop@test.com', role: 'MAYOR' });
    const council = await createTestUser({ email: 'res-council@test.com', role: 'COUNCIL_MEMBER' });

    const created = await request(app)
      .post('/api/v1/resolutions')
      .set('Authorization', `Bearer ${proposer.accessToken}`)
      .send({ title: 'Fix Main St', description: 'Repave it' });
    expect(created.status).toBe(201);

    const toVoting = await request(app)
      .patch(`/api/v1/resolutions/${created.body.data.id}/status`)
      .set('Authorization', `Bearer ${proposer.accessToken}`)
      .send({ status: 'VOTING' });
    expect(toVoting.status).toBe(200);

    const vote = await request(app)
      .post(`/api/v1/resolutions/${created.body.data.id}/vote`)
      .set('Authorization', `Bearer ${council.accessToken}`)
      .send({ voteFor: true });
    expect(vote.status).toBe(200);

    const notif = await waitFor(() =>
      prisma.notification.findFirst({
        where: { userId: proposer.user.id, type: 'VOTE_RECEIVED' },
      }),
    );
    expect(notif).toBeTruthy();
  });

  it('a referendum vote notifies the creator', async () => {
    const creator = await createTestUser({ email: 'ref-creator@test.com', role: 'MAYOR' });
    const voter = await createTestUser({ email: 'ref-voter@test.com', role: 'CITIZEN' });
    const now = new Date();
    const opensAt = new Date(now.getTime() - 60_000).toISOString();
    const closesAt = new Date(now.getTime() + 86_400_000).toISOString();

    const created = await request(app)
      .post('/api/v1/referendums')
      .set('Authorization', `Bearer ${creator.accessToken}`)
      .send({
        title: 'New library?', description: 'Fund it', body: 'Full text',
        opensAt, closesAt,
      });
    expect(created.status).toBe(201);

    const opened = await request(app)
      .patch(`/api/v1/referendums/${created.body.data.id}/status`)
      .set('Authorization', `Bearer ${creator.accessToken}`)
      .send({ status: 'OPEN' });
    expect(opened.status).toBe(200);

    const vote = await request(app)
      .post(`/api/v1/referendums/${created.body.data.id}/vote`)
      .set('Authorization', `Bearer ${voter.accessToken}`)
      .send({ choice: 'YES' });
    expect(vote.status).toBe(201);

    const notif = await waitFor(() =>
      prisma.notification.findFirst({
        where: { userId: creator.user.id, type: 'VOTE_RECEIVED' },
      }),
    );
    expect(notif).toBeTruthy();
  });

  it('a new event broadcasts EVENT and an RSVP notifies the creator', async () => {
    const creator = await createTestUser({ email: 'evt-creator@test.com', role: 'STAFF' });
    const citizen = await createTestUser({ email: 'evt-citizen@test.com', role: 'CITIZEN' });
    const now = new Date();

    const created = await request(app)
      .post('/api/v1/events')
      .set('Authorization', `Bearer ${creator.accessToken}`)
      .send({
        title: 'Cleanup day', type: 'VOLUNTEER',
        startTime: new Date(now.getTime() + 86_400_000).toISOString(),
        endTime: new Date(now.getTime() + 90_000_000).toISOString(),
      });
    expect(created.status).toBe(201);

    const broadcast = await waitFor(() =>
      prisma.notification.findFirst({
        where: { userId: citizen.user.id, type: 'EVENT' },
      }),
    );
    expect(broadcast).toBeTruthy();

    const rsvp = await request(app)
      .post(`/api/v1/events/${created.body.data.id}/rsvp`)
      .set('Authorization', `Bearer ${citizen.accessToken}`)
      .send({ status: 'GOING' });
    expect(rsvp.status).toBe(200);

    const creatorNotif = await waitFor(() =>
      prisma.notification.findFirst({
        where: { userId: creator.user.id, type: 'EVENT' },
      }),
    );
    expect(creatorNotif).toBeTruthy();
    expect(creatorNotif && (creatorNotif as any).message).toContain('GOING');
  });

  it('throttled emails still write every in-app row', async () => {
    const user = await createTestUser({ email: 'throttle@test.com' });
    await notificationService.create(user.user.id, 'VOTE_RECEIVED', 't1', 'm1', { a: 1 },
      { sendEmail: true, emailThrottleMs: 3_600_000, throttleKey: 'k1' });
    await notificationService.create(user.user.id, 'VOTE_RECEIVED', 't2', 'm2', { a: 2 },
      { sendEmail: true, emailThrottleMs: 3_600_000, throttleKey: 'k1' });
    const count = await prisma.notification.count({ where: { userId: user.user.id } });
    expect(count).toBe(2);
  });
});
