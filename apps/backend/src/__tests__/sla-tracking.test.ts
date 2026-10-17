import { prisma, createTestUser, cleanupDatabase, disconnectDatabase } from './helpers';
import { issueService } from '../services/issue.service';
import { slaTrackingService } from '../services/sla-tracking.service';

afterAll(async () => {
  await cleanupDatabase();
  await disconnectDatabase();
});

beforeEach(async () => {
  await cleanupDatabase();
});

// P0-1 acceptance: creating an issue initialises its SLA row, and the
// periodic breach scan flips `breached` once the deadline passes.
describe('P0-1 — SLA tracking initialisation + breach scan', () => {
  it('creates an SlaTracking row with the correct dueAt on issue create', async () => {
    const { user } = await createTestUser({ email: 'sla-create@test.com' });
    const before = Date.now();

    const issue = await issueService.create({
      title: 'SLA wire-up probe',
      description: 'Creating this issue must initialise an SLA row',
      category: 'INFRASTRUCTURE',
      location: '123 Test Street',
      reporterId: user.id,
    });

    // The SLA upsert on the create path is fire-and-forget, so poll
    // briefly for the row instead of asserting synchronously.
    let row = null;
    for (let i = 0; i < 50 && !row; i++) {
      row = await prisma.slaTracking.findUnique({ where: { issueId: issue.id } });
      if (!row) await new Promise((r) => setTimeout(r, 100));
    }

    expect(row).not.toBeNull();
    expect(row!.priority).toBe('3');
    expect(row!.breached).toBe(false);
    // Default priority 3 → 72 h from creation (2 min tolerance for
    // the fire-and-forget delay + clock skew).
    const expectedDue = before + 72 * 60 * 60 * 1000;
    expect(Math.abs(new Date(row!.dueAt).getTime() - expectedDue)).toBeLessThan(2 * 60 * 1000);
  });

  it('scanForBreaches flips breached on an overdue row', async () => {
    const { user } = await createTestUser({ email: 'sla-scan@test.com' });
    const issue = await issueService.create({
      title: 'SLA breach probe',
      description: 'This SLA will be backdated past its deadline',
      category: 'INFRASTRUCTURE',
      location: '123 Test Street',
      reporterId: user.id,
    });

    // Wait for the fire-and-forget upsert, then force the row overdue.
    let row = null;
    for (let i = 0; i < 50 && !row; i++) {
      row = await prisma.slaTracking.findUnique({ where: { issueId: issue.id } });
      if (!row) await new Promise((r) => setTimeout(r, 100));
    }
    expect(row).not.toBeNull();
    await prisma.slaTracking.update({
      where: { issueId: issue.id },
      data: { dueAt: new Date(Date.now() - 60 * 60 * 1000) },
    });

    const result = await slaTrackingService.scanForBreaches();
    expect(result.breached).toBeGreaterThanOrEqual(1);

    const flipped = await prisma.slaTracking.findUnique({ where: { issueId: issue.id } });
    expect(flipped?.breached).toBe(true);
  });
});
