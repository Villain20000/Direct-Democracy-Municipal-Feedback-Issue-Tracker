import rateLimit from 'express-rate-limit';

// General API rate limiter: 300 requests per 15 minutes per IP.
// Generous headroom for SPAs that fan out several small requests per
// page (autocomplete, polls, dropdowns), but still protective against
// runaway loops. Previously 100 — too tight once the admin dashboard
// started making ~10 parallel requests per navigation.
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});

// Notifications are polled aggressively by the bell dropdown in the
// header (open/close, page navigation, etc.). 600 / 15min ≈ 40/min
// which covers normal user behaviour with two orders of magnitude
// to spare. This sits alongside `apiLimiter` on the route — both
// increment the per-IP counter, so the more restrictive cap wins.
export const notificationsLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 600,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});

// Strict limiter for auth endpoints: 20 requests per 15 minutes per IP
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many authentication attempts, please try again later.' },
});

// AI endpoint limiter: 30 requests per 15 minutes (AI is CPU-intensive)
export const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'AI request limit reached, please try again later.' },
});
