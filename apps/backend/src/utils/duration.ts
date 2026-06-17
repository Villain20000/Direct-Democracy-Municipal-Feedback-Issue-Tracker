/**
 * Parse a short-form duration string like `"15m"`, `"1h"`, `"7d"`, or
 * `"30s"` into milliseconds. The format is `<positive-integer><unit>`
 * where unit is one of `s`, `m`, `h`, or `d` (the same suffixes
 * `jsonwebtoken`, `express-rate-limit`, and `cookie.maxAge` accept).
 *
 * Valid units and their milliseconds:
 *   - `s` → 1_000
 *   - `m` → 60_000
 *   - `h` → 3_600_000
 *   - `d` → 86_400_000
 *
 * Throws on:
 *   - non-string input
 *   - empty or unitless input
 *   - non-positive numeric component (`"0m"`, `"-1h"`)
 *   - unrecognized trailing unit character (`"5z"`)
 *
 * Why throw instead of return a default? This function used to live
 * inside `auth.service.ts` and silently fall through to a 7-day
 * expiry whenever it got a malformed input. That hid operator
 * mistakes — a typo like `REFRESH_TOKEN_EXPIRES_IN=15x` would
 * silently issue 7-day refresh tokens in production. Crashing at
 * startup with a clear "invalid duration" message is much better
 * diagnostic than serving the wrong TTL for months.
 */
const UNIT_TO_MS: Record<string, number> = {
  s: 1_000,
  m: 60 * 1_000,
  h: 60 * 60 * 1_000,
  d: 24 * 60 * 60 * 1_000,
};

const ALLOWED_UNITS = Object.keys(UNIT_TO_MS);
const ALLOWED_UNITS_DESC = ALLOWED_UNITS.map((u) => `'${u}' (${UNIT_TO_MS[u]} ms)`).join(', ');

export function parseExpiresIn(input: string): number {
  if (typeof input !== 'string' || input.length < 2) {
    throw new Error(
      `Invalid duration ${JSON.stringify(input)}. ` +
        `Expected '<positive-integer><unit>'; allowed units are ${ALLOWED_UNITS_DESC}.`,
    );
  }
  // Reject leading/trailing whitespace explicitly. `parseInt` would
  // silently strip it (" 15m" → 15), which is the kind of typo that
  // makes config debugging slow. Anything that isn't the canonical
  // tight `<number><unit>` shape is a typo and should crash loudly.
  if (input.trim() !== input || /\s/.test(input)) {
    throw new Error(
      `Invalid duration ${JSON.stringify(input)}: whitespace is not allowed. ` +
        `Expected '<positive-integer><unit>' with no surrounding spaces.`,
    );
  }
  const unit = input.slice(-1);
  const rawValue = input.slice(0, -1);
  // Reject any numeric portion that isn't a pure positive integer.
  // Using /^\d+$/ instead of `parseInt` (which silently coerces
  // "1.5" → 1, "1e3" → 1, " 15" → 15, "1_" → 1, leading "0xff" → 0,
  // etc.) means env typos like "JWT_EXPIRES_IN=1.5h" or "15x2.0m"
  // crash loudly rather than silently rounding-down to a wildly
  // wrong TTL.
  if (!/^\d+$/.test(rawValue)) {
    throw new Error(
      `Invalid duration ${JSON.stringify(input)}: numeric portion '${rawValue}' must be a positive integer.`,
    );
  }
  const value = Number(rawValue);
  if (value <= 0) {
    throw new Error(
      `Invalid duration ${JSON.stringify(input)}: numeric portion '${rawValue}' must be a positive integer.`,
    );
  }
  const ms = UNIT_TO_MS[unit];
  if (ms === undefined) {
    throw new Error(
      `Invalid duration ${JSON.stringify(input)}: unit '${unit}' is not recognized. ` +
        `Allowed units: ${ALLOWED_UNITS_DESC}.`,
    );
  }
  return value * ms;
}
