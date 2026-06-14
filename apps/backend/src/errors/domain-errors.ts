/**
 * Typed domain errors for the API.
 *
 * Services throw these to signal a known client-facing condition
 * (wrong password, already voted, email taken, etc.). The route layer
 * maps them to HTTP status codes via `mapDomainErrorToResponse` instead
 * of inspecting error messages with regex.
 *
 * Anything that is NOT a `DomainError` is treated as a true server-side
 * failure and surfaced as 500 with a console.error for diagnostics.
 *
 * Design notes:
 *   - All errors carry a stable, machine-readable `code` so clients can
 *     branch on it (e.g. show "Invalid credentials" vs "Email taken"
 *     without parsing the human message).
 *   - `httpStatus` is the suggested status code; routes still get to
 *     override if they need to (e.g. some teams prefer 422 for validation).
 *   - We extend `Error` so existing `try { ... } catch (e: any)` blocks
 *     keep working — callers that don't know about the typed hierarchy
 *     still see `e.message` and `e.name` as before.
 *   - `details` is an optional bag for structured error info (Zod issues,
 *     field-level errors, etc.).
 */

/**
 * Stable, machine-readable error codes. Add new codes here as features
 * are introduced; never re-use a code with different semantics.
 */
export type DomainErrorCode =
  // 400
  | 'VALIDATION_FAILED'
  | 'BAD_REQUEST'
  // 401
  | 'UNAUTHENTICATED'
  | 'INVALID_CREDENTIALS'
  | 'INVALID_TOKEN'
  | 'TOKEN_EXPIRED'
  // 403
  | 'FORBIDDEN'
  // 404
  | 'NOT_FOUND'
  // 409
  | 'CONFLICT'
  | 'ALREADY_EXISTS'
  | 'ALREADY_VOTED'
  | 'ALREADY_RESPONDED'
  | 'ALREADY_CLOSED'
  // 422
  | 'UNPROCESSABLE';

export interface DomainErrorOptions {
  code: DomainErrorCode;
  message: string;
  httpStatus?: number;
  details?: Record<string, unknown> | undefined;
}

export class DomainError extends Error {
  public readonly code: DomainErrorCode;
  public readonly httpStatus: number;
  public readonly details?: Record<string, unknown>;

  constructor(opts: DomainErrorOptions) {
    super(opts.message);
    this.name = new.target.name;
    this.code = opts.code;
    this.httpStatus = opts.httpStatus ?? 400;
    this.details = opts.details;
    // Maintains proper stack trace in V8.
    if (typeof (Error as any).captureStackTrace === 'function') {
      (Error as any).captureStackTrace(this, new.target);
    }
  }

  /** Type guard. Use this instead of `instanceof` across module boundaries. */
  static isDomainError(value: unknown): value is DomainError {
    return value instanceof DomainError;
  }
}

// ----- 400 family ------------------------------------------------------------

export class ValidationError extends DomainError {
  constructor(message = 'Validation failed', details?: Record<string, unknown>) {
    super({ code: 'VALIDATION_FAILED', message, httpStatus: 400, details });
  }
}

export class BadRequestError extends DomainError {
  constructor(message: string, code: DomainErrorCode = 'BAD_REQUEST', details?: Record<string, unknown>) {
    super({ code, message, httpStatus: 400, details });
  }
}

// ----- 401 family ------------------------------------------------------------

export class AuthError extends DomainError {
  constructor(message = 'Unauthenticated', code: DomainErrorCode = 'UNAUTHENTICATED', details?: Record<string, unknown>) {
    super({ code, message, httpStatus: 401, details });
  }
}

export class InvalidCredentialsError extends AuthError {
  constructor(message = 'Invalid credentials') {
    super(message, 'INVALID_CREDENTIALS');
  }
}

export class InvalidTokenError extends AuthError {
  constructor(message = 'Invalid token') {
    super(message, 'INVALID_TOKEN');
  }
}

export class TokenExpiredError extends AuthError {
  constructor(message = 'Token expired') {
    super(message, 'TOKEN_EXPIRED');
  }
}

// ----- 403 family ------------------------------------------------------------

export class ForbiddenError extends DomainError {
  constructor(message = 'Forbidden', details?: Record<string, unknown>) {
    super({ code: 'FORBIDDEN', message, httpStatus: 403, details });
  }
}

// ----- 404 family ------------------------------------------------------------

export class NotFoundError extends DomainError {
  constructor(message = 'Resource not found', details?: Record<string, unknown>) {
    super({ code: 'NOT_FOUND', message, httpStatus: 404, details });
  }
}

// ----- 409 family ------------------------------------------------------------

export class ConflictError extends DomainError {
  constructor(message: string, code: DomainErrorCode = 'CONFLICT', details?: Record<string, unknown>) {
    super({ code, message, httpStatus: 409, details });
  }
}

export class AlreadyExistsError extends ConflictError {
  constructor(message = 'Resource already exists', details?: Record<string, unknown>) {
    super(message, 'ALREADY_EXISTS', details);
  }
}

export class AlreadyVotedError extends ConflictError {
  constructor(message = 'You have already voted on this item', details?: Record<string, unknown>) {
    super(message, 'ALREADY_VOTED', details);
  }
}

export class AlreadyRespondedError extends ConflictError {
  constructor(message = 'You have already responded to this survey', details?: Record<string, unknown>) {
    super(message, 'ALREADY_RESPONDED', details);
  }
}

export class AlreadyClosedError extends ConflictError {
  constructor(message = 'This item is already closed', details?: Record<string, unknown>) {
    super(message, 'ALREADY_CLOSED', details);
  }
}

// ----- Express helper --------------------------------------------------------

/**
 * Map a `DomainError` to an Express response. Returns `true` if the error
 * was handled (i.e. is a DomainError), `false` otherwise so the caller
 * can fall through to 500 handling.
 *
 * Usage in a route catch block:
 *
 *   } catch (error: any) {
 *     if (sendDomainError(res, error)) return;
 *     console.error('[myRoute]', error);
 *     res.status(500).json({ error: error.message });
 *   }
 *
 * The `safe` option (default false) omits the message from the response
 * body for 5xx errors. Routes that want the full message to reach the
 * client should pass `safe: false`.
 */
export function sendDomainError(
  res: { status: (code: number) => any; json: (body: unknown) => any },
  error: unknown,
  options: { safe?: boolean; logger?: { error: (label: string, err: unknown) => void } } = {},
): boolean {
  if (!DomainError.isDomainError(error)) return false;
  const { safe = false, logger } = options;
  const body: Record<string, unknown> = {
    error: error.message,
    code: error.code,
  };
  if (error.details) body['details'] = error.details;
  if (!safe || error.httpStatus < 500) {
    res.status(error.httpStatus).json(body);
  } else {
    // For 5xx domain errors, the route usually also wants to log.
    if (logger) logger.error(`[domain:${error.code}]`, error);
    res.status(error.httpStatus).json({ error: 'Internal server error', code: error.code });
  }
  return true;
}
