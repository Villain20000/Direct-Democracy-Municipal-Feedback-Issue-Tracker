import { parseExpiresIn } from '../utils/duration';

describe('parseExpiresIn', () => {
  describe('valid inputs', () => {
    it('parses seconds', () => {
      expect(parseExpiresIn('30s')).toBe(30_000);
      expect(parseExpiresIn('1s')).toBe(1_000);
    });

    it('parses minutes', () => {
      expect(parseExpiresIn('15m')).toBe(15 * 60_000);
      expect(parseExpiresIn('1m')).toBe(60_000);
    });

    it('parses hours', () => {
      expect(parseExpiresIn('1h')).toBe(3_600_000);
      expect(parseExpiresIn('24h')).toBe(24 * 3_600_000);
    });

    it('parses days', () => {
      expect(parseExpiresIn('7d')).toBe(7 * 86_400_000);
      expect(parseExpiresIn('1d')).toBe(86_400_000);
    });

    it('parses single-digit values', () => {
      expect(parseExpiresIn('1m')).toBe(60_000);
      expect(parseExpiresIn('2h')).toBe(7_200_000);
      expect(parseExpiresIn('3d')).toBe(3 * 86_400_000);
    });

    it('parses multi-digit values', () => {
      expect(parseExpiresIn('90m')).toBe(90 * 60_000);
      expect(parseExpiresIn('365d')).toBe(365 * 86_400_000);
    });
  });

  describe('invalid inputs', () => {
    it('throws on empty string', () => {
      expect(() => parseExpiresIn('')).toThrow(/Invalid duration/);
    });

    it('throws on unitless numeric string', () => {
      // "15" has no unit; the old version of parseExpiresIn would
      // have happily fallen through to a 7-day default, which is
      // exactly the bug we're guarding against here.
      expect(() => parseExpiresIn('15')).toThrow(/Invalid duration/);
    });

    it('throws on zero', () => {
      expect(() => parseExpiresIn('0m')).toThrow(/numeric portion.*positive integer/);
      expect(() => parseExpiresIn('0h')).toThrow(/numeric portion.*positive integer/);
    });

    it('throws on negative duration', () => {
      expect(() => parseExpiresIn('-1h')).toThrow(/numeric portion.*positive integer/);
      expect(() => parseExpiresIn('-15m')).toThrow(/numeric portion.*positive integer/);
    });

    it('throws on unrecognized unit', () => {
      expect(() => parseExpiresIn('5z')).toThrow(/unit 'z' is not recognized/);
      expect(() => parseExpiresIn('15x')).toThrow(/unit 'x' is not recognized/);
    });

    it('throws on non-numeric value', () => {
      expect(() => parseExpiresIn('abcm')).toThrow(/numeric portion.*positive integer/);
    });

    it('throws on decimal numeric portion', () => {
      // parseInt('1.5', 10) silently returns 1, which would round
      // down '1.5h' to '1h' — a TTL typo hiding in plain sight.
      // The new validator regex requires pure digits so this crashes.
      expect(() => parseExpiresIn('1.5h')).toThrow(/numeric portion.*positive integer/);
      expect(() => parseExpiresIn('0.5m')).toThrow(/numeric portion.*positive integer/);
    });

    it('throws on exponent / hex / numeric suffixes', () => {
      // Other parseInt-quiet coercions.
      expect(() => parseExpiresIn('1e2m')).toThrow(/numeric portion.*positive integer/);
      expect(() => parseExpiresIn('0xffm')).toThrow(/numeric portion.*positive integer/);
    });

    it('throws on bare unit', () => {
      expect(() => parseExpiresIn('m')).toThrow(/Invalid duration/);
      expect(() => parseExpiresIn('h')).toThrow(/Invalid duration/);
    });

    it('throws on whitespace', () => {
      // `parseInt` accepts leading whitespace, so " 15m" would
      // accidentally round-trip to 15. Treat that as a typo.
      expect(() => parseExpiresIn(' 15m')).toThrow(/Invalid duration/);
    });
  });

  describe('non-string inputs', () => {
    // The function is typed as string-only, but runtime callers
    // sometimes pass garbage from a misconfigured env var. We want
    // a loud crash either way, not a silent 7-day fallback.
    it.each([
      ['undefined', undefined],
      ['null', null],
      ['number', 15],
      ['boolean', true],
    ] as const)('throws on %s', (_label, value) => {
      // Cast to silence the TS error from intentional misuse;
      // we want to confirm runtime behaviour, not type-check.
      expect(() => parseExpiresIn(value as any)).toThrow(/Invalid duration/);
    });
  });

  describe('does not silently fall back to 7 days', () => {
    // This is the regression test for the original bug: the old
    // implementation returned 7 * 24 * 60 * 60 * 1000 for any
    // malformed unit, hiding operator mistakes.
    const sevenDays = 7 * 86_400_000;
    it.each([
      ['empty string', ''],
      ['unit typo', '15x'],
      ['no unit', '15'],
      ['negative', '-1h'],
      ['zero', '0m'],
    ] as const)('rejects %s rather than returning %d', (_label, input) => {
      expect(() => parseExpiresIn(input)).toThrow();
      // Defensive: ensure the throw happened BEFORE we could have
      // quietly returned sevenDays.
    });
    // Sanity: confirm 7d still parses correctly (avoids an accidental
    // false-positive where the function now throws on everything).
    expect(parseExpiresIn('7d')).toBe(sevenDays);
  });
});
