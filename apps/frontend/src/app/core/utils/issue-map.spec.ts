import { statusColors, StatusColors } from './issue-map';

describe('statusColors()', () => {
  // ---------------------------------------------------------------
  // Open / action-needed states → red
  // ---------------------------------------------------------------
  describe('open states', () => {
    const openStatuses = ['SUBMITTED', 'ACKNOWLEDGED', 'PENDING_REVIEW', 'REOPENED'];

    for (const status of openStatuses) {
      it(`returns red for "${status}"`, () => {
        const c = statusColors(status);
        expect(c.fill).toBe('#DC2626');
        expect(c.stroke).toBe('#991B1B');
      });
    }
  });

  // ---------------------------------------------------------------
  // In progress → amber
  // ---------------------------------------------------------------
  describe('in-progress state', () => {
    it('returns amber for IN_PROGRESS', () => {
      const c = statusColors('IN_PROGRESS');
      expect(c.fill).toBe('#F59E0B');
      expect(c.stroke).toBe('#B45309');
    });
  });

  // ---------------------------------------------------------------
  // Resolved / verified → green
  // ---------------------------------------------------------------
  describe('resolved states', () => {
    it('returns green for RESOLVED', () => {
      const c = statusColors('RESOLVED');
      expect(c.fill).toBe('#10B981');
      expect(c.stroke).toBe('#047857');
    });

    it('returns green for VERIFIED', () => {
      const c = statusColors('VERIFIED');
      expect(c.fill).toBe('#10B981');
      expect(c.stroke).toBe('#047857');
    });
  });

  // ---------------------------------------------------------------
  // Rejected → slate
  // ---------------------------------------------------------------
  describe('rejected state', () => {
    it('returns slate for REJECTED', () => {
      const c = statusColors('REJECTED');
      expect(c.fill).toBe('#64748B');
      expect(c.stroke).toBe('#334155');
    });
  });

  // ---------------------------------------------------------------
  // Defensive defaults — never return undefined / transparent
  // ---------------------------------------------------------------
  describe('defensive defaults', () => {
    it('falls back to red for an unknown status string', () => {
      // Defensive: if a new status enum value is added to the backend
      // before the frontend is updated, the pin must still be visible.
      const c = statusColors('SOMETHING_NEW_FROM_THE_FUTURE');
      expect(c.fill).toBe('#DC2626');
      expect(c.stroke).toBe('#991B1B');
    });

    it('falls back to red for null', () => {
      const c = statusColors(null);
      expect(c.fill).toBe('#DC2626');
    });

    it('falls back to red for undefined', () => {
      const c = statusColors(undefined);
      expect(c.fill).toBe('#DC2626');
    });

    it('falls back to red for an empty string', () => {
      const c = statusColors('');
      expect(c.fill).toBe('#DC2626');
    });
  });

  // ---------------------------------------------------------------
  // Return shape — every call returns a valid {fill, stroke} pair
  // ---------------------------------------------------------------
  describe('return shape', () => {
    it('always returns an object with `fill` and `stroke` string fields', () => {
      const inputs = [
        'SUBMITTED', 'IN_PROGRESS', 'RESOLVED', 'REJECTED', 'VERIFIED',
        'FUTURE_STATUS', '', null, undefined,
      ];
      for (const input of inputs) {
        const c: StatusColors = statusColors(input as string);
        expect(typeof c.fill).toBe('string');
        expect(typeof c.stroke).toBe('string');
        // Hex colors start with '#' and are 4 or 7 chars long
        expect(c.fill).toMatch(/^#[0-9A-Fa-f]{3,6}$/);
        expect(c.stroke).toMatch(/^#[0-9A-Fa-f]{3,6}$/);
      }
    });
  });
});
