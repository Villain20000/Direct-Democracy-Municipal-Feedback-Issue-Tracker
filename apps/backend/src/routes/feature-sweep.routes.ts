/**
 * Phase B — 10-feature sweep routes.
 *
 * One router mounts the seven feature families. The patterns are
 * grouped (subscriptions, share, saved searches, prefs, internal notes,
 * SLA, assignment history) so each section is small and easy to audit.
 *
 *   Subscriptions (B1)         POST/DELETE /issues/:id/subscribe
 *                              GET    /users/me/subscriptions
 *                              GET    /issues/:id/subscribers            [staff+]
 *   Share links (B2)           POST   /issues/:id/share-link            [staff+]
 *                              GET    /issues/:id/share-links           [staff+]
 *                              DELETE /issues/:id/share-link/:id        [staff+]
 *                              GET    /share/:token                      (public)
 *   Saved searches (B3)        GET    /users/me/saved-searches
 *                              POST   /users/me/saved-searches
 *                              PATCH  /users/me/saved-searches/:id
 *                              DELETE /users/me/saved-searches/:id
 *   Notification prefs (B4)    GET    /users/me/notification-prefs
 *                              PUT    /users/me/notification-prefs
 *   Internal notes (B5)        GET    /issues/:id/internal-notes         [staff+]
 *                              POST   /issues/:id/internal-notes         [staff+]
 *                              DELETE /issues/:id/internal-notes/:id     [staff+]
 *   SLA tracking (B6)          GET    /issues/:id/sla                    [staff+]
 *                              GET    /sla/breached                      [staff+]
 *                              POST   /sla/scan-breaches                 [admin]
 *   Assignment history (B7)    GET    /issues/:id/assignment-history     [staff+]
 */
import { Router } from 'express';
import { z } from 'zod';
import { authenticate, AuthenticatedRequest } from '../middleware/auth.middleware';
import { authorize } from '../middleware/rbac.middleware';
import { validate } from '../middleware/validate.middleware';
import {
  createShareLinkSchema,
  createSavedSearchSchema,
  updateSavedSearchSchema,
  bulkUpdateNotificationPreferencesSchema,
  createInternalNoteSchema,
} from '../validators/feature-sweep.validators';
import { issueSubscriptionService } from '../services/issue-subscription.service';
import { issueShareLinkService } from '../services/issue-share-link.service';
import { savedSearchService } from '../services/saved-search.service';
import { notificationPreferenceService } from '../services/notification-preference.service';
import { internalNoteService } from '../services/internal-note.service';
import { slaTrackingService } from '../services/sla-tracking.service';
import { issueAssignmentService } from '../services/issue-assignment.service';

const router = Router();

// =====================================================================
// B1 — Issue subscriptions
// =====================================================================

router.post('/issues/:id/subscribe', authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const sub = await issueSubscriptionService.subscribe(req.params.id as string, req.user!.id);
    res.status(201).json({ success: true, data: sub });
  } catch (error: any) {
    res.status(error.httpStatus || 500).json({ error: error.message });
  }
});

router.delete('/issues/:id/subscribe', authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const result = await issueSubscriptionService.unsubscribe(req.params.id as string, req.user!.id);
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(error.httpStatus || 500).json({ error: error.message });
  }
});

router.get('/users/me/subscriptions', authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const data = await issueSubscriptionService.listMine(req.user!.id);
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get(
  '/issues/:id/subscribers',
  authenticate,
  authorize('SUPER_ADMIN', 'MAYOR', 'DEPARTMENT_HEAD', 'STAFF'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const data = await issueSubscriptionService.listSubscribers(req.params.id as string);
      res.json({ success: true, data });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },
);

// =====================================================================
// B2 — Issue share links (public resolve endpoint is mounted separately
// at /api/v1/share/:token — see index.ts)
// =====================================================================

router.post(
  '/issues/:id/share-link',
  authenticate,
  authorize('SUPER_ADMIN', 'MAYOR', 'DEPARTMENT_HEAD', 'STAFF'),
  validate(createShareLinkSchema),
  async (req: AuthenticatedRequest, res) => {
    try {
      // The body is optional (all fields are optional in the schema), so
      // default to {} when the client sends nothing.
      const data = (req.body || {}) as { expiresInDays?: number };
      const link = await issueShareLinkService.create(
        req.params.id as string,
        req.user!.id,
        data.expiresInDays,
      );
      res.status(201).json({ success: true, data: link });
    } catch (error: any) {
      res.status(error.httpStatus || 500).json({ error: error.message });
    }
  },
);

router.get(
  '/issues/:id/share-links',
  authenticate,
  authorize('SUPER_ADMIN', 'MAYOR', 'DEPARTMENT_HEAD', 'STAFF'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const data = await issueShareLinkService.listForIssue(req.params.id as string);
      res.json({ success: true, data });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },
);

router.delete(
  '/issues/:id/share-link/:shareId',
  authenticate,
  authorize('SUPER_ADMIN', 'MAYOR', 'DEPARTMENT_HEAD'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const data = await issueShareLinkService.revoke(req.params.shareId as string);
      res.json({ success: true, data });
    } catch (error: any) {
      res.status(error.httpStatus || 500).json({ error: error.message });
    }
  },
);

// =====================================================================
// B3 — Saved searches
// =====================================================================

router.get('/users/me/saved-searches', authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const data = await savedSearchService.listMine(req.user!.id);
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post(
  '/users/me/saved-searches',
  authenticate,
  validate(createSavedSearchSchema),
  async (req: AuthenticatedRequest, res) => {
    try {
      const data = await savedSearchService.create(req.user!.id, req.body);
      res.status(201).json({ success: true, data });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },
);

router.patch(
  '/users/me/saved-searches/:id',
  authenticate,
  validate(updateSavedSearchSchema),
  async (req: AuthenticatedRequest, res) => {
    try {
      const data = await savedSearchService.update(
        req.params.id as string,
        req.user!.id,
        req.body,
      );
      res.json({ success: true, data });
    } catch (error: any) {
      res.status(error.httpStatus || 500).json({ error: error.message });
    }
  },
);

router.delete('/users/me/saved-searches/:id', authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const data = await savedSearchService.delete(req.params.id as string, req.user!.id);
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(error.httpStatus || 500).json({ error: error.message });
  }
});

// =====================================================================
// B4 — Notification preferences
// =====================================================================

router.get('/users/me/notification-prefs', authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const data = await notificationPreferenceService.getMine(req.user!.id);
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.put(
  '/users/me/notification-prefs',
  authenticate,
  validate(bulkUpdateNotificationPreferencesSchema),
  async (req: AuthenticatedRequest, res) => {
    try {
      const { preferences } = req.body as { preferences: { channel: 'inApp' | 'email' | 'push'; type: string; enabled: boolean }[] };
      const data = await notificationPreferenceService.setMany(req.user!.id, preferences);
      res.json({ success: true, data });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },
);

// =====================================================================
// B5 — Internal notes (staff+ only)
// =====================================================================

router.get(
  '/issues/:id/internal-notes',
  authenticate,
  authorize('SUPER_ADMIN', 'MAYOR', 'DEPARTMENT_HEAD', 'STAFF'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const data = await internalNoteService.listForIssue(req.params.id as string);
      res.json({ success: true, data });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },
);

router.post(
  '/issues/:id/internal-notes',
  authenticate,
  authorize('SUPER_ADMIN', 'MAYOR', 'DEPARTMENT_HEAD', 'STAFF'),
  validate(createInternalNoteSchema),
  async (req: AuthenticatedRequest, res) => {
    try {
      const { content } = req.body as { content: string };
      const data = await internalNoteService.create(req.params.id as string, req.user!.id, content);
      res.status(201).json({ success: true, data });
    } catch (error: any) {
      res.status(error.httpStatus || 500).json({ error: error.message });
    }
  },
);

router.delete(
  '/issues/:id/internal-notes/:noteId',
  authenticate,
  authorize('SUPER_ADMIN', 'MAYOR', 'DEPARTMENT_HEAD'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const data = await internalNoteService.delete(req.params.noteId as string, req.user!.id);
      res.json({ success: true, data });
    } catch (error: any) {
      res.status(error.httpStatus || 500).json({ error: error.message });
    }
  },
);

// =====================================================================
// B6 — SLA tracking
// =====================================================================

router.get(
  '/issues/:id/sla',
  authenticate,
  authorize('SUPER_ADMIN', 'MAYOR', 'DEPARTMENT_HEAD', 'STAFF'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const data = await slaTrackingService.getForIssue(req.params.id as string);
      res.json({ success: true, data });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },
);

router.get(
  '/sla/breached',
  authenticate,
  authorize('SUPER_ADMIN', 'MAYOR', 'DEPARTMENT_HEAD'),
  async (_req: AuthenticatedRequest, res) => {
    try {
      const data = await slaTrackingService.listBreached();
      res.json({ success: true, data });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },
);

router.post(
  '/sla/scan-breaches',
  authenticate,
  authorize('SUPER_ADMIN'),
  async (_req: AuthenticatedRequest, res) => {
    try {
      const data = await slaTrackingService.scanForBreaches();
      res.json({ success: true, data });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },
);

// =====================================================================
// B7 — Assignment history
// =====================================================================

router.get(
  '/issues/:id/assignment-history',
  authenticate,
  authorize('SUPER_ADMIN', 'MAYOR', 'DEPARTMENT_HEAD', 'STAFF'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const data = await issueAssignmentService.listForIssue(req.params.id as string);
      res.json({ success: true, data });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },
);

export { issueShareLinkService as _issueShareLinkServiceForPublicResolve } from '../services/issue-share-link.service';
export default router;
