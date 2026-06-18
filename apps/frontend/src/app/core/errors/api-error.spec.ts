/**
 * Unit tests for the field-error helpers in `api-error.ts`.
 *
 * The helpers are pure functions, so the spec doesn't need TestBed /
 * an Angular runtime. We construct minimal `ApiError` objects
 * directly and assert on the returned `FieldError[]` / grouped map.
 *
 * The backend can send three different `details` shapes for a 4xx
 * error, and `getFieldErrors` must handle all three plus every path
 * edge case the ZodError issue shape can produce.
 */
import {
  ApiError,
  DomainErrorCode,
  FieldError,
  getFieldErrors,
  groupFieldErrorsByField,
} from './api-error';

/** Convenience helper to build a minimal `ApiError` with `details`. */
function apiErrWithDetails(
  details: Record<string, unknown> | undefined,
  message = 'Server error',
  code: DomainErrorCode = 'BAD_REQUEST',
  status = 400,
): ApiError {
  return { httpStatus: status, message, code, details };
}

describe('getFieldErrors', () => {
  // ===================================================================
  // Edge cases — no errors
  // ===================================================================
  describe('no errors', () => {
    it('returns [] for null apiErr', () => {
      expect(getFieldErrors(null)).toEqual([]);
    });

    it('returns [] for undefined apiErr', () => {
      expect(getFieldErrors(undefined)).toEqual([]);
    });

    it('returns [] when apiErr has no details field at all', () => {
      expect(getFieldErrors({ httpStatus: 400, message: 'Bad request' })).toEqual([]);
    });

    it('returns [] when details is an empty object', () => {
      expect(getFieldErrors(apiErrWithDetails({}))).toEqual([]);
    });

    it('returns [] when details has no recognized shape', () => {
      expect(getFieldErrors(apiErrWithDetails({ something: 'else', count: 3 }))).toEqual([]);
    });

    it('returns [] when issues is present but is an empty array', () => {
      expect(getFieldErrors(apiErrWithDetails({ issues: [] }))).toEqual([]);
    });

    it('returns [] when fieldErrors is present but is an empty array', () => {
      expect(getFieldErrors(apiErrWithDetails({ fieldErrors: [] }))).toEqual([]);
    });
  });

  // ===================================================================
  // Shape 1: ZodError — `details.issues`
  // ===================================================================
  describe('ZodError shape (details.issues)', () => {
    it('extracts a single issue with a 1-element string[] path', () => {
      const apiErr = apiErrWithDetails({
        issues: [{ path: ['title'], message: 'Title is required' }],
      });
      expect(getFieldErrors(apiErr)).toEqual([
        { field: 'title', message: 'Title is required', meta: {} },
      ]);
    });

    it('extracts multiple issues, preserving backend order', () => {
      const apiErr = apiErrWithDetails({
        issues: [
          { path: ['title'], message: 'Title is required' },
          { path: ['description'], message: 'Description is too short' },
          { path: ['location'], message: 'Location is required' },
        ],
      });
      expect(getFieldErrors(apiErr)).toEqual([
        { field: 'title', message: 'Title is required', meta: {} },
        { field: 'description', message: 'Description is too short', meta: {} },
        { field: 'location', message: 'Location is required', meta: {} },
      ]);
    });

    it('skips an issue with no `message` field', () => {
      const apiErr = apiErrWithDetails({
        issues: [
          { path: ['title'] }, // no message
          { path: ['description'], message: 'Required' },
        ],
      });
      expect(getFieldErrors(apiErr)).toEqual([
        { field: 'description', message: 'Required', meta: {} },
      ]);
    });

    it('skips an issue with a non-string `message`', () => {
      const apiErr = apiErrWithDetails({
        issues: [
          { path: ['title'], message: 42 },
          { path: ['description'], message: null },
          { path: ['location'], message: 'OK' },
        ],
      });
      expect(getFieldErrors(apiErr)).toEqual([
        { field: 'location', message: 'OK', meta: {} },
      ]);
    });

    it('skips an issue with an empty-string `message`', () => {
      const apiErr = apiErrWithDetails({
        issues: [
          { path: ['title'], message: '' },
          { path: ['description'], message: 'Required' },
        ],
      });
      expect(getFieldErrors(apiErr)).toEqual([
        { field: 'description', message: 'Required', meta: {} },
      ]);
    });

    it('handles a path that is a plain string (not an array)', () => {
      const apiErr = apiErrWithDetails({
        issues: [{ path: 'title', message: 'Bad' }],
      });
      expect(getFieldErrors(apiErr)).toEqual([
        { field: 'title', message: 'Bad', meta: {} },
      ]);
    });

    it('returns empty field for an issue with empty path array', () => {
      const apiErr = apiErrWithDetails({
        issues: [{ path: [], message: 'Form-level error' }],
      });
      expect(getFieldErrors(apiErr)).toEqual([
        { field: '', message: 'Form-level error', meta: {} },
      ]);
    });

    it('preserves extra meta fields (excluding `path` and `message`)', () => {
      const apiErr = apiErrWithDetails({
        issues: [
          {
            path: ['password'],
            message: 'Too short',
            code: 'too_small',
            minimum: 8,
            type: 'string',
            inclusive: true,
          },
        ],
      });
      expect(getFieldErrors(apiErr)).toEqual([
        {
          field: 'password',
          message: 'Too short',
          meta: { code: 'too_small', minimum: 8, type: 'string', inclusive: true },
        },
      ]);
    });

    it('always sets meta to {} when only path + message are set', () => {
      // The implementation always sets `meta = {}` (never undefined)
      // for ZodError issues — that way callers can read
      // `error.meta?.code` without a guard.
      const apiErr = apiErrWithDetails({
        issues: [{ path: ['email'], message: 'Invalid' }],
      });
      const result = getFieldErrors(apiErr);
      expect(result[0].field).toBe('email');
      expect(result[0].message).toBe('Invalid');
      expect(result[0].meta).toEqual({});
    });

    it('preserves multiple issues for the same field (does not dedupe)', () => {
      const apiErr = apiErrWithDetails({
        issues: [
          { path: ['password'], message: 'Too short', code: 'too_small' },
          { path: ['password'], message: 'Must contain a number', code: 'invalid_string' },
        ],
      });
      const result = getFieldErrors(apiErr);
      expect(result).toHaveSize(2);
      expect(result[0]).toEqual({
        field: 'password', message: 'Too short', meta: { code: 'too_small' },
      });
      expect(result[1]).toEqual({
        field: 'password', message: 'Must contain a number', meta: { code: 'invalid_string' },
      });
    });
  });

  // ===================================================================
  // Shape 2: BadRequestError with `details.field`
  // ===================================================================
  describe('BadRequestError shape (details.field)', () => {
    it('extracts the field and uses apiErr.message', () => {
      const apiErr = apiErrWithDetails(
        { field: 'newPassword' },
        'New password must be at least 8 characters',
        'BAD_REQUEST',
      );
      expect(getFieldErrors(apiErr)).toEqual([
        { field: 'newPassword', message: 'New password must be at least 8 characters' },
      ]);
    });

    it('preserves extra meta fields from the details bag', () => {
      const apiErr = apiErrWithDetails(
        { field: 'newPassword', minLength: 8 },
        'New password must be at least 8 characters',
        'BAD_REQUEST',
      );
      expect(getFieldErrors(apiErr)).toEqual([
        {
          field: 'newPassword',
          message: 'New password must be at least 8 characters',
          meta: { minLength: 8 },
        },
      ]);
    });

    it('omits meta (undefined) when no other fields are in the bag', () => {
      const apiErr = apiErrWithDetails(
        { field: 'title' },
        'Title required',
        'BAD_REQUEST',
      );
      const result = getFieldErrors(apiErr);
      expect(result[0].field).toBe('title');
      expect(result[0].message).toBe('Title required');
      expect(result[0].meta).toBeUndefined();
    });

    it('returns [] when details.field is a non-string value', () => {
      // `field: 42` is not a recognized shape — the helper should
      // fall through to the "no recognized shape" branch.
      const apiErr = apiErrWithDetails(
        { field: 42 },
        'Number field',
        'BAD_REQUEST',
      );
      expect(getFieldErrors(apiErr)).toEqual([]);
    });

    it('returns [] when details.field is an object', () => {
      const apiErr = apiErrWithDetails(
        { field: { nested: 'object' } },
        'Object field',
        'BAD_REQUEST',
      );
      expect(getFieldErrors(apiErr)).toEqual([]);
    });

    it('returns [] when details.field is null', () => {
      const apiErr = apiErrWithDetails(
        { field: null },
        'Null field',
        'BAD_REQUEST',
      );
      expect(getFieldErrors(apiErr)).toEqual([]);
    });

    it('returns [] when apiErr.message is empty (BadRequestError needs a message)', () => {
      // An empty `message` means the caller can\'t display anything
      // useful inline, so we drop the entry.
      const apiErr = apiErrWithDetails(
        { field: 'title' },
        '',
        'BAD_REQUEST',
      );
      expect(getFieldErrors(apiErr)).toEqual([]);
    });
  });

  // ===================================================================
  // Shape 3: explicit `details.fieldErrors` array
  // ===================================================================
  describe('explicit fieldErrors shape (details.fieldErrors)', () => {
    it('extracts from a {field, message}[] array', () => {
      const apiErr = apiErrWithDetails({
        fieldErrors: [
          { field: 'title', message: 'Required' },
          { field: 'description', message: 'Too short' },
        ],
      });
      expect(getFieldErrors(apiErr)).toEqual([
        { field: 'title', message: 'Required' },
        { field: 'description', message: 'Too short' },
      ]);
    });

    it('filters out entries missing field or message', () => {
      const apiErr = apiErrWithDetails({
        fieldErrors: [
          { field: 'title', message: 'Required' },
          { field: 'description' }, // no message
          { message: 'No field here' }, // no field
          { field: 'password', message: 'Weak' },
        ],
      });
      expect(getFieldErrors(apiErr)).toEqual([
        { field: 'title', message: 'Required' },
        { field: 'password', message: 'Weak' },
      ]);
    });

    it('filters out entries with non-string field or message', () => {
      const apiErr = apiErrWithDetails({
        fieldErrors: [
          { field: 42, message: 'Number field' },
          { field: 'title', message: 99 },
          { field: null, message: 'Null field' },
          { field: 'description', message: 'OK' },
        ],
      });
      expect(getFieldErrors(apiErr)).toEqual([
        { field: 'description', message: 'OK' },
      ]);
    });
  });

  // ===================================================================
  // Path joining edge cases (the ZodError `path` field is the tricky one)
  // ===================================================================
  describe('path joining edge cases', () => {
    it('joins a single-element path as the bare field name', () => {
      const apiErr = apiErrWithDetails({
        issues: [{ path: ['title'], message: 'Required' }],
      });
      expect(getFieldErrors(apiErr)[0].field).toBe('title');
    });

    it('joins a 2-element path with one dot', () => {
      const apiErr = apiErrWithDetails({
        issues: [{ path: ['address', 'city'], message: 'Required' }],
      });
      expect(getFieldErrors(apiErr)[0].field).toBe('address.city');
    });

    it('joins a 4-element path with three dots', () => {
      const apiErr = apiErrWithDetails({
        issues: [{ path: ['a', 'b', 'c', 'd'], message: 'Required' }],
      });
      expect(getFieldErrors(apiErr)[0].field).toBe('a.b.c.d');
    });

    it('returns "" for an empty path array', () => {
      const apiErr = apiErrWithDetails({
        issues: [{ path: [], message: 'Form-level' }],
      });
      expect(getFieldErrors(apiErr)[0].field).toBe('');
    });

    it('filters out `null` entries from a path', () => {
      const apiErr = apiErrWithDetails({
        issues: [{ path: ['address', null, 'city'], message: 'Required' }],
      });
      expect(getFieldErrors(apiErr)[0].field).toBe('address.city');
    });

    it('filters out `undefined` entries from a path', () => {
      const apiErr = apiErrWithDetails({
        issues: [{ path: ['address', undefined, 'city'], message: 'Required' }],
      });
      expect(getFieldErrors(apiErr)[0].field).toBe('address.city');
    });

    it('filters out empty-string entries from a path', () => {
      const apiErr = apiErrWithDetails({
        issues: [{ path: ['address', '', 'city'], message: 'Required' }],
      });
      expect(getFieldErrors(apiErr)[0].field).toBe('address.city');
    });

    it('returns "" when path has only null/undefined/empty entries', () => {
      const apiErr = apiErrWithDetails({
        issues: [
          { path: [null, null, null], message: 'All null' },
          { path: [undefined, undefined], message: 'All undefined' },
          { path: ['', ''], message: 'All empty' },
        ],
      });
      const result = getFieldErrors(apiErr);
      expect(result[0].field).toBe('');
      expect(result[1].field).toBe('');
      expect(result[2].field).toBe('');
    });

    it('handles a string path (not an array)', () => {
      const apiErr = apiErrWithDetails({
        issues: [{ path: 'title', message: 'Required' }],
      });
      expect(getFieldErrors(apiErr)[0].field).toBe('title');
    });

    it('handles an empty-string path (treated as bare field, not as join)', () => {
      // Edge case: a ZodError path can be the empty string in some
      // implementations. The helper returns it as-is.
      const apiErr = apiErrWithDetails({
        issues: [{ path: '', message: 'Required' }],
      });
      expect(getFieldErrors(apiErr)[0].field).toBe('');
    });

    it('handles a numeric path by returning "" (not a valid path type)', () => {
      const apiErr = apiErrWithDetails({
        issues: [{ path: 42, message: 'Number path' }],
      });
      expect(getFieldErrors(apiErr)[0].field).toBe('');
    });

    it('handles a boolean path by returning "" (not a valid path type)', () => {
      const apiErr = apiErrWithDetails({
        issues: [{ path: true, message: 'Boolean path' }],
      });
      expect(getFieldErrors(apiErr)[0].field).toBe('');
    });

    it('handles an object path by returning "" (not a valid path type)', () => {
      const apiErr = apiErrWithDetails({
        issues: [{ path: { complex: true }, message: 'Object path' }],
      });
      expect(getFieldErrors(apiErr)[0].field).toBe('');
    });

    it('handles a `null` path by returning ""', () => {
      const apiErr = apiErrWithDetails({
        issues: [{ path: null, message: 'Null path' }],
      });
      expect(getFieldErrors(apiErr)[0].field).toBe('');
    });

    it('preserves numeric/boolean entries in a path (only null/undefined/empty are filtered)', () => {
      // The implementation's filter is `p !== null && p !== undefined && p !== ''`,
      // which keeps numeric and boolean entries. `Array.prototype.join` then
      // stringifies them. This is intentional so ZodError paths for array-indexed
      // fields (e.g. `['items', 0, 'name']`) round-trip as `"items.0.name"`.
      // A future change that tightens the filter (e.g. adds `typeof p === 'string'`)
      // would silently break indexed array paths — this test guards against that.
      const apiErr = apiErrWithDetails({
        issues: [
          { path: ['items', 0, 'name'], message: 'Indexed' },
          { path: ['flags', true, 'enabled'], message: 'Boolean entry' },
        ],
      });
      const result = getFieldErrors(apiErr);
      expect(result[0].field).toBe('items.0.name');
      expect(result[1].field).toBe('flags.true.enabled');
    });
  });

  // ===================================================================
  // Shape precedence — the implementation checks issues > field > fieldErrors
  // ===================================================================
  describe('shape precedence', () => {
    it('prefers issues over field when both are present', () => {
      const apiErr = apiErrWithDetails(
        {
          issues: [{ path: ['a'], message: 'From issues' }],
          field: 'b',
        },
        'From field',
        'BAD_REQUEST',
      );
      expect(getFieldErrors(apiErr)).toEqual([
        { field: 'a', message: 'From issues', meta: {} },
      ]);
    });

    it('prefers field over fieldErrors when both are present', () => {
      const apiErr = apiErrWithDetails(
        {
          field: 'a',
          fieldErrors: [{ field: 'b', message: 'From fieldErrors' }],
        },
        'From field',
        'BAD_REQUEST',
      );
      expect(getFieldErrors(apiErr)).toEqual([
        { field: 'a', message: 'From field' },
      ]);
    });
  });
});

// =====================================================================
// groupFieldErrorsByField
// =====================================================================
describe('groupFieldErrorsByField', () => {
  it('returns {} for an empty array', () => {
    expect(groupFieldErrorsByField([])).toEqual({});
  });

  it('groups a single field', () => {
    expect(groupFieldErrorsByField([{ field: 'title', message: 'Required' }])).toEqual({
      title: 'Required',
    });
  });

  it('groups multiple distinct fields', () => {
    expect(
      groupFieldErrorsByField([
        { field: 'title', message: 'Required' },
        { field: 'description', message: 'Too short' },
      ]),
    ).toEqual({
      title: 'Required',
      description: 'Too short',
    });
  });

  it('keeps only the first error per field (subsequent errors are dropped)', () => {
    expect(
      groupFieldErrorsByField([
        { field: 'password', message: 'Too short' },
        { field: 'password', message: 'Must contain a number' },
      ]),
    ).toEqual({
      password: 'Too short',
    });
  });

  it('skips errors with empty field (form-level errors are not in the map)', () => {
    expect(
      groupFieldErrorsByField([
        { field: '', message: 'Form-level' },
        { field: 'title', message: 'Required' },
      ]),
    ).toEqual({
      title: 'Required',
    });
  });

  it('returns {} when only form-level errors are present', () => {
    // Callers should read apiErr.message or iterate the raw array
    // to render form-level errors — the grouped map intentionally
    // omits them.
    expect(
      groupFieldErrorsByField([{ field: '', message: 'Form-level' }]),
    ).toEqual({});
  });

  it('preserves the order of first-seen fields', () => {
    expect(
      groupFieldErrorsByField([
        { field: 'a', message: 'A' },
        { field: 'b', message: 'B' },
        { field: 'a', message: 'A duplicate' }, // ignored
        { field: 'c', message: 'C' },
      ]),
    ).toEqual({
      a: 'A',
      b: 'B',
      c: 'C',
    });
  });

  it('preserves dotted paths verbatim (no extra splitting)', () => {
    expect(
      groupFieldErrorsByField([
        { field: 'address.city', message: 'Required' },
        { field: 'address.zip', message: 'Invalid format' },
      ]),
    ).toEqual({
      'address.city': 'Required',
      'address.zip': 'Invalid format',
    });
  });

  it('handles a mix of field-level and form-level errors', () => {
    // The grouped map only contains the field-level ones.
    const result = groupFieldErrorsByField([
      { field: '', message: 'Form-level' },
      { field: 'title', message: 'Required' },
      { field: '', message: 'Another form-level' },
    ]);
    expect(result).toEqual({ title: 'Required' });
  });
});
