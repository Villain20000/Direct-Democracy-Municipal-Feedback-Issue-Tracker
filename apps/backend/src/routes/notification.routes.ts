import { Router } from 'express';
import { authenticate, AuthenticatedRequest } from '../middleware/auth.middleware';
import { notificationService } from '../services/notification.service';
import { notificationsLimiter } from '../middleware/rateLimit.middleware';
import { sendDomainError } from '../errors/domain-errors';
import { parsePagination } from '../utils/pagination';

const router = Router();

// The bell dropdown in the layout header can call this endpoint many
// times per minute (open/close, page nav, polling for the unread
// badge). Wrap every route with the dedicated, higher-cap
// `notificationsLimiter` so it cannot trip under normal use — the
// global `apiLimiter` still applies and remains the binding cap.
//
// We attach the limiter per-route (matching the auth.routes.ts and
// ai.routes.ts pattern) because `express-rate-limit`'s return type
// doesn't satisfy `RequestHandler` strictly in this tsconfig and
// `router.use(limiter)` at the top fails overload resolution. The
// `as any` cast is the same workaround those files use.

// List notifications (bell dropdown)
router.get('/', authenticate, notificationsLimiter as any, async (req: AuthenticatedRequest, res) => {
  try {
    const result = await notificationService.getByUser(req.user!.id, {
      ...parsePagination(req.query as Record<string, unknown>, { defaultPageSize: 20 }),
      unreadOnly: req.query.unreadOnly === 'true',
    });
    res.json({ success: true, ...result });
  } catch (error: any) {
    // The bell-dropdown endpoint reads — there were no service throws
    // classified as client errors here, but using sendDomainError keeps
    // the pattern uniform across the file.
    if (sendDomainError(res, error, { logger: console })) return;
    console.error('[notifications.list]', error);
    res.status(500).json({ error: error.message });
  }
});

// Mark a single notification as read
router.patch('/:id/read', authenticate, notificationsLimiter as any, async (req: AuthenticatedRequest, res) => {
  try {
    await notificationService.markAsRead(req.params.id as string, req.user!.id);
    res.json({ success: true });
  } catch (error: any) {
    // The service now throws NotFoundError when the id isn't owned by
    // this user / doesn't exist, which maps to 404.
    if (sendDomainError(res, error, { logger: console })) return;
    console.error('[notifications.markRead]', error);
    res.status(500).json({ error: error.message });
  }
});

// Mark every notification as read
router.patch('/read-all', authenticate, notificationsLimiter as any, async (req: AuthenticatedRequest, res) => {
  try {
    await notificationService.markAllAsRead(req.user!.id);
    res.json({ success: true });
  } catch (error: any) {
    if (sendDomainError(res, error, { logger: console })) return;
    console.error('[notifications.readAll]', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete a notification
router.delete('/:id', authenticate, notificationsLimiter as any, async (req: AuthenticatedRequest, res) => {
  try {
    await notificationService.delete(req.params.id as string, req.user!.id);
    res.json({ success: true });
  } catch (error: any) {
    // NotFoundError → 404 when the id isn't owned / doesn't exist.
    if (sendDomainError(res, error, { logger: console })) return;
    console.error('[notifications.delete]', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
