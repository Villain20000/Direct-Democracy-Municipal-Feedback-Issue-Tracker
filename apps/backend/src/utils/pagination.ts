/**
 * Tiny pagination helper. Two responsibilities:
 *
 *   1. **Clamp `?pageSize` so a malicious caller can't ask Prisma to
 *      load ten million rows with `?pageSize=999999999`.** Without
 *      this cap the global rate limiter can do nothing — a single
 *      request can OOM the server.
 *   2. **Floor `?page` to a positive integer so we don't pass a
 *      negative offset to Prisma** (which would silently match no
 *      rows *or* throw, depending on the version).
 *
 * Both numbers are returned as plain JS numbers — no stringification,
 * no per-page tags, no fancy `Link` headers. The service layer is
 * responsible for honouring them.
 *
 * Defaults are conservative: page=1, pageSize=20. The max cap
 * defaults to 100 (matches `portal.routes.ts`); routes that need a
 * higher cap for legitimate reasons (e.g. an export endpoint) can
 * pass it explicitly.
 */
export interface PaginationParams {
  page: number;
  pageSize: number;
}

export interface ParsePaginationOptions {
  defaultPageSize?: number;
  maxPageSize?: number;
}

/**
 * Parse `?page` / `?pageSize` from a query object with safe defaults.
 * Returns *clamped* numbers, not the user-supplied strings.
 */
export function parsePagination(
  query: Record<string, unknown>,
  options: ParsePaginationOptions = {},
): PaginationParams {
  const { defaultPageSize = 20, maxPageSize = 100 } = options;

  // parseInt guards against NaN: if the caller passed `?page=foo`
  // we fall back to the default. `|| defaultPageSize` after parseInt
  // catches NaN (NaN is falsy) AND `0` (a user passing ?pageSize=0
  // is probably a typo too).
  const rawPage = parseInt(String(query.page ?? ''), 10);
  const rawPageSize = parseInt(String(query.pageSize ?? ''), 10);

  const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1;
  const pageSize =
    Number.isFinite(rawPageSize) && rawPageSize > 0
      ? Math.min(rawPageSize, maxPageSize)
      : defaultPageSize;

  return { page, pageSize };
}
