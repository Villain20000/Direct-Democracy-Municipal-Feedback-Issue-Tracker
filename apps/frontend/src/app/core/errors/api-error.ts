/**
 * Frontend mirror of the backend's `DomainErrorCode` union. Keep in
 * sync with `apps/backend/src/errors/domain-errors.ts` — if a new code
 * is added server-side, add it here too (and a translation key).
 *
 * The backend surfaces typed errors with a body shape of:
 *   { error: string; code: DomainErrorCode; details?: Record<string, unknown> }
 *
 * This module gives the Angular side a typed way to extract that body
 * from an `HttpErrorResponse` and translate the `code` into a
 * user-friendly, i18n-aware message via the `TranslationService`.
 *
 * Usage:
 *
 *   import { toApiError, getErrorMessage } from '.../core/errors/api-error';
 *
 *   this.api.login(email, password).subscribe({
 *     next: ...,
 *     error: (err) => {
 *       const apiErr = toApiError(err);
 *       const message = getErrorMessage(apiErr, this.i18n);
 *       this.toast.error(message);
 *     },
 *   });
 *
 * If you want to branch on the code (e.g. show a specific inline form
 * error vs. a toast), inspect `apiErr.code` directly.
 */
import { HttpErrorResponse } from '@angular/common/http';
import { TranslationService } from '../i18n/translation.service';

/**
 * Typed error codes. The const tuple is the single source of truth —
 * the `DomainErrorCode` union is derived from it so adding a new code
 * here (and to the backend) automatically keeps the runtime allowlist
 * in `isDomainErrorCode` and the type union in sync. When you add a
 * code, also add a translation key under `errorCodes.<CODE>` in en.ts
 * and el.ts.
 */
export const KNOWN_DOMAIN_ERROR_CODES = [
  'VALIDATION_FAILED',
  'BAD_REQUEST',
  'UNAUTHENTICATED',
  'INVALID_CREDENTIALS',
  'INVALID_TOKEN',
  'TOKEN_EXPIRED',
  'FORBIDDEN',
  'NOT_FOUND',
  'CONFLICT',
  'ALREADY_EXISTS',
  'ALREADY_VOTED',
  'ALREADY_RESPONDED',
  'ALREADY_CLOSED',
  'UNPROCESSABLE',
] as const;

export type DomainErrorCode = typeof KNOWN_DOMAIN_ERROR_CODES[number];

/**
 * The shape of a typed error extracted from an HttpErrorResponse.
 * `httpStatus` is always set (from the HTTP response); the other fields
 * are populated if the backend surfaced a DomainError body.
 */
export interface ApiError {
  /** HTTP status code, always present. */
  httpStatus: number;
  /** Typed code from the backend; undefined for raw 5xx without a DomainError. */
  code?: DomainErrorCode;
  /** Human message from the backend (English). */
  message: string;
  /** Optional structured details (Zod issues, field errors, etc.). */
  details?: Record<string, unknown>;
}

/**
 * Body shape the backend's `sendDomainError` sends. We use a narrow
 * interface here so the extractor is resilient against extra fields.
 */
interface DomainErrorBody {
  error?: string;
  code?: string;
  details?: Record<string, unknown>;
}

/**
 * Extract an `ApiError` from an `HttpErrorResponse`. The body shape
 * varies by error type:
 *   - DomainError from sendDomainError: `{error, code, details?}`
 *   - ZodError from a route that parses manually: `{error, details: ZodIssue[]}`
 *   - Raw `Error('msg')` from a catch-all: `{error: 'msg'}` (no code)
 *   - Network failure (status 0): `{message: 'Http failure response for ...'}`
 *
 * We only trust the `code` field if it's a known DomainErrorCode; an
 * unknown string is dropped so callers always work with a typed value.
 */
export function toApiError(err: HttpErrorResponse | unknown): ApiError {
  // Already-converted (e.g. component called toApiError on a value that
  // came from elsewhere). Pass through.
  if (err && typeof err === 'object' && 'httpStatus' in (err as any) && 'message' in (err as any)) {
    return err as ApiError;
  }

  if (err instanceof HttpErrorResponse) {
    const body = err.error as DomainErrorBody | string | null | undefined;
    if (body && typeof body === 'object') {
      const code = isDomainErrorCode(body.code) ? body.code : undefined;
      return {
        httpStatus: err.status,
        code,
        // Prefer the backend's English message; for network errors
        // (status 0) or when the backend omitted `error`, fall back to
        // the status default so the user sees "Network error..." rather
        // than "Http failure response for /api/v1/...".
        message: body.error || defaultMessageFor(err.status),
        details: body.details,
      };
    }
    // Plain-text body or no body. Use the body string if present,
    // otherwise the status default (NOT the raw HttpErrorResponse
    // message, which is something like "Http failure response for
    // https://..." and not user-friendly).
    return {
      httpStatus: err.status,
      message: typeof body === 'string' && body ? body : defaultMessageFor(err.status),
    };
  }

  // Not even an HttpErrorResponse (rare — e.g. RxJS error). Best effort.
  const e = err as { message?: string; status?: number } | null;
  return {
    httpStatus: e?.status ?? 0,
    message: e?.message ?? 'Unknown error',
  };
}

function isDomainErrorCode(value: unknown): value is DomainErrorCode {
  return typeof value === 'string'
    && (KNOWN_DOMAIN_ERROR_CODES as ReadonlyArray<string>).includes(value);
}

function defaultMessageFor(status: number): string {
  if (status === 0) return 'Network error — please check your connection and try again.';
  if (status === 401) return 'Your session has expired. Please sign in again.';
  if (status === 403) return "You don't have permission to perform this action.";
  if (status === 404) return 'The requested resource was not found.';
  if (status === 409) return 'This action conflicts with the current state of the resource.';
  if (status >= 500) return 'The server encountered an error. Please try again in a moment.';
  return 'The request failed. Please try again.';
}

/**
 * Map a typed code to the i18n key under `errorCodes.<CODE>` in the
 * translation dictionary. Returns the key (never null) so a missing
 * translation falls back gracefully to the backend message.
 */
function i18nKeyForCode(code: DomainErrorCode): string {
  return `errorCodes.${code}`;
}

/**
 * Translate an `ApiError` to a user-friendly message.
 *
 *   1. If the error has a known `code`, look up `errorCodes.<CODE>` in
 *      the translation dictionary.
 *   2. If the key is missing (or the translation fell back to the key
 *      string), return the backend's `message` instead.
 *   3. If the error has no code, return the default message for the
 *      HTTP status.
 *
 * This is a pure function — no side effects, no toast calls. Use
 * `toastFromApiError` if you also want to fire a toast.
 */
export function getErrorMessage(apiErr: ApiError, t: TranslationService): string {
  if (apiErr.code) {
    const key = i18nKeyForCode(apiErr.code);
    const translated = t.t(key);
    // The translation service returns the key itself when a key is
    // missing, so we can detect that and fall back to the backend
    // message or default.
    if (translated && translated !== key) {
      return translated;
    }
  }
  // Fall back to the backend's English message if it's present and
  // non-empty, otherwise to the status-code default.
  return apiErr.message || defaultMessageFor(apiErr.httpStatus);
}

/**
 * Map an `ApiError` to the appropriate toast kind. 4xx errors are
 * shown as warnings (the user did something wrong, not the server);
 * 5xx and network errors are shown as errors.
 */
export function toastKindForApiError(apiErr: ApiError): 'error' | 'warning' {
  return apiErr.httpStatus >= 500 || apiErr.httpStatus === 0 ? 'error' : 'warning';
}

/**
 * One field-level error extracted from an `ApiError`'s `details`. Forms
 * can iterate this and render an inline error next to the matching
 * `<input>`.
 *
 *   { field: 'title',        message: 'Title is required' }
 *   { field: 'address.city', message: 'City is too short' }
 *   { field: '',             message: 'General form error' }   // no specific field
 */
export interface FieldError {
  /**
   * Dotted path to the field. For ZodError issues, this is the joined
   * `path` array (e.g. `['address', 'city']` -> `"address.city"`).
   * For BadRequestError with `details.field`, this is the raw field
   * name. Empty string means the error is form-level, not attached to
   * any one field.
   */
  field: string;
  /**
   * Human message. For ZodError issues, this is the issue's `message`
   * (English from the backend). For BadRequestError, it's the error's
   * `message`. The caller can pass a `TranslationService` to `t` to
   * translate the message via the `errorFields.<key>` dictionary.
   */
  message: string;
  /**
   * Optional structured info from the backend (e.g. `{ minLength: 8 }`
   * from a BadRequestError details bag, or `{ code: 'too_small' }`
   * from a Zod issue). The shape is intentionally loose — the
   * backend may add new fields without breaking the frontend.
   */
  meta?: Record<string, unknown>;
}

/**
 * Extract field-level errors from an `ApiError`. Handles the three
 * shapes the backend may send in `details`:
 *
 *   1. `details.issues` — ZodError (from `validate.middleware.ts` and
 *      routes that `parse()` manually). Each entry has
 *      `{ path: string[], message: string, code?, ... }`. We join the
 *      `path` with dots and keep the message verbatim.
 *
 *   2. `details.field` (string) — `BadRequestError` thrown with an
 *      explicit `{field, ...meta}` bag (e.g. change-password
 *      `'newPassword' too short`). The `apiErr.message` becomes the
 *      field message, and the rest of the bag goes into `meta`.
 *
 *   3. `details.fieldErrors` (array) — a custom `{field, message}[]`
 *      bag for callers that want a pre-flattened shape.
 *
 * Returns `[]` for any other shape (or no `details`), so the caller
 * can always iterate without a guard.
 */
export function getFieldErrors(apiErr: ApiError | null | undefined): FieldError[] {
  if (!apiErr || !apiErr.details) return [];
  const details = apiErr.details as Record<string, unknown>;

  // Shape 1: ZodError -> details.issues
  if (Array.isArray(details['issues'])) {
    const issues = details['issues'] as Array<Record<string, unknown>>;
    const out: FieldError[] = [];
    for (const i of issues) {
      if (typeof i['message'] !== 'string' || !i['message']) continue;
      const field = pathToString(i['path']);
      const meta: Record<string, unknown> = {};
      for (const k of Object.keys(i)) {
        if (k !== 'path' && k !== 'message') meta[k] = i[k];
      }
      out.push({ field, message: i['message'], meta });
    }
    return out;
  }

  // Shape 2: BadRequestError with details.field
  if (typeof details['field'] === 'string' && apiErr.message) {
    const field = details['field'] as string;
    const metaBag = { ...details };
    delete metaBag['field'];
    delete metaBag['fieldErrors'];
    delete metaBag['issues'];
    const meta = Object.keys(metaBag).length > 0 ? metaBag : undefined;
    const entry: FieldError = { field, message: apiErr.message };
    if (meta) entry.meta = meta;
    return [entry];
  }

  // Shape 3: explicit fieldErrors array
  if (Array.isArray(details['fieldErrors'])) {
    const arr = details['fieldErrors'] as Array<Record<string, unknown>>;
    return arr
      .filter((f) => typeof f['field'] === 'string' && typeof f['message'] === 'string')
      .map((f) => ({ field: f['field'] as string, message: f['message'] as string }));
  }

  return [];
}

/**
 * Group `FieldError[]` into a `{ [field]: message }` map, suitable
 * for direct binding in a form. If multiple errors exist for the
 * same field, the first one wins (the backend's `issues` array is
 * ordered, and that's the order the user should see).
 */
export function groupFieldErrorsByField(
  errors: FieldError[],
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const e of errors) {
    if (!e.field) continue;
    if (!(e.field in out)) out[e.field] = e.message;
  }
  return out;
}

/** Join a ZodError `path` (which may be a string[] or string) with dots. */
function pathToString(path: unknown): string {
  if (Array.isArray(path)) {
    return path.filter((p) => p !== null && p !== undefined && p !== '').join('.');
  }
  if (typeof path === 'string') return path;
  return '';
}
