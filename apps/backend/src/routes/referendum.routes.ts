/**
 * Phase D1 — Referendum routes.
 *
 *   GET    /api/v1/referendums                  public list (paginated, ?status=)
 *   GET    /api/v1/referendums/:id              public detail
 *   GET    /api/v1/referendums/:id/my-vote      current user's vote (or null)
 *   GET    /api/v1/referendums/:id/votes        all votes (admin / mayor / creator)
 *   POST   /api/v1/referendums                  create (admin / mayor / council)
 *   PATCH  /api/v1/referendums/:id              edit (creator or admin, DRAFT only)
 *   PATCH  /api/v1/referendums/:id/status       status transition (admin / mayor / creator)
 *   POST   /api/v1/referendums/:id/vote         cast vote (any authenticated user)
 *   POST   /api/v1/referendums/:id/close        close + tally (admin / mayor)
 *   DELETE /api/v1/referendums/:id              delete (admin or creator, no votes)
 */
import { Router } from 'express';
import { z } from 'zod';
import { authenticate, AuthenticatedRequest } from '../middleware/auth.middleware';
import { authorize } from '../middleware/rbac.middleware';
import { validate } from '../middleware/validate.middleware';
import { sendDomainError } from '../errors/domain-errors';
import { parsePagination } from '../utils/pagination';
import { referendumService } from '../services/referendum.service';
import { UserRole } from '@prisma/client';
import {
  createReferendumSchema,
  updateReferendumSchema,
  referendumStatusSchema,
  castVoteSchema,
} from '../validators/referendum.validators';

const router = Router();

// Public list
router.get('/', async (req, res) => {
  try {
    const data = await referendumService.list({
      ...parsePagination(req.query as Record<string, unknown>, { defaultPageSize: 20 }),
      status: req.query.status as string,
    });
    res.json({ success: true, ...data });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get one
router.get('/:id', async (req, res) => {
  try {
    const ref = await referendumService.getById(req.params.id as string);
    res.json({ success: true, data: ref });
  } catch (error: any) {
    if (sendDomainError(res, error)) return;
    res.status(500).json({ error: error.message });
  }
});

// Current user's vote on a referendum
router.get('/:id/my-vote', authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const vote = await referendumService.getMyVote(req.params.id as string, req.user!.id);
    res.json({ success: true, data: vote });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// All votes for a referendum (admin / mayor / creator)
router.get(
  '/:id/votes',
  authenticate,
  async (req: AuthenticatedRequest, res) => {
    try {
      const ref = await referendumService.getById(req.params.id as string);
      const isAdmin = req.user!.role === 'SUPER_ADMIN' || req.user!.role === 'MAYOR';
      if (!isAdmin && ref.createdById !== req.user!.id) {
        res.status(403).json({ error: 'Only the creator or an admin can see all votes' });
        return;
      }
      const votes = await referendumService.listVotes(req.params.id as string);
      res.json({ success: true, data: votes });
    } catch (error: any) {
      if (sendDomainError(res, error)) return;
      res.status(500).json({ error: error.message });
    }
  },
);

// Create referendum
router.post(
  '/',
  authenticate,
  authorize('SUPER_ADMIN', 'MAYOR', 'COUNCIL_MEMBER'),
  validate(createReferendumSchema),
  async (req: AuthenticatedRequest, res) => {
    try {
      const body = req.body as z.infer<typeof createReferendumSchema>;
      const ref = await referendumService.create({
        title: body.title,
        description: body.description,
        body: body.body,
        opensAt: new Date(body.opensAt),
        closesAt: new Date(body.closesAt),
        passThreshold: body.passThreshold,
        minParticipation: body.minParticipation,
        eligibleRoles: body.eligibleRoles as UserRole[],
        createdById: req.user!.id,
      });
      res.status(201).json({ success: true, data: ref });
    } catch (error: any) {
      if (sendDomainError(res, error, { logger: console })) return;
      console.error('[referendums.create]', error);
      res.status(500).json({ error: error.message });
    }
  },
);

// Edit (DRAFT only)
router.patch(
  '/:id',
  authenticate,
  validate(updateReferendumSchema),
  async (req: AuthenticatedRequest, res) => {
    try {
      const body = req.body as z.infer<typeof updateReferendumSchema>;
      const data: any = { ...body };
      if (body.opensAt) data.opensAt = new Date(body.opensAt);
      if (body.closesAt) data.closesAt = new Date(body.closesAt);
      const ref = await referendumService.update(
        req.params.id as string,
        req.user!.id,
        req.user!.role as UserRole,
        data,
      );
      res.json({ success: true, data: ref });
    } catch (error: any) {
      if (sendDomainError(res, error, { logger: console })) return;
      console.error('[referendums.update]', error);
      res.status(500).json({ error: error.message });
    }
  },
);

// Status transition
router.patch(
  '/:id/status',
  authenticate,
  validate(referendumStatusSchema),
  async (req: AuthenticatedRequest, res) => {
    try {
      const { status } = req.body as { status: string };
      const ref = await referendumService.changeStatus(
        req.params.id as string,
        req.user!.id,
        req.user!.role as UserRole,
        status,
      );
      res.json({ success: true, data: ref });
    } catch (error: any) {
      if (sendDomainError(res, error, { logger: console })) return;
      console.error('[referendums.status]', error);
      res.status(500).json({ error: error.message });
    }
  },
);

// Cast a vote
router.post(
  '/:id/vote',
  authenticate,
  validate(castVoteSchema),
  async (req: AuthenticatedRequest, res) => {
    try {
      const { choice } = req.body as { choice: 'YES' | 'NO' | 'ABSTAIN' };
      const vote = await referendumService.castVote(
        req.params.id as string,
        req.user!.id,
        req.user!.role as UserRole,
        choice,
      );
      res.status(201).json({ success: true, data: vote });
    } catch (error: any) {
      if (sendDomainError(res, error, { logger: console })) return;
      console.error('[referendums.vote]', error);
      res.status(500).json({ error: error.message });
    }
  },
);

// Close + tally
router.post(
  '/:id/close',
  authenticate,
  authorize('SUPER_ADMIN', 'MAYOR'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const ref = await referendumService.close(
        req.params.id as string,
        req.user!.id,
        req.user!.role as UserRole,
      );
      res.json({ success: true, data: ref });
    } catch (error: any) {
      if (sendDomainError(res, error, { logger: console })) return;
      console.error('[referendums.close]', error);
      res.status(500).json({ error: error.message });
    }
  },
);

// Delete
router.delete(
  '/:id',
  authenticate,
  async (req: AuthenticatedRequest, res) => {
    try {
      const data = await referendumService.delete(
        req.params.id as string,
        req.user!.id,
        req.user!.role as UserRole,
      );
      res.json({ success: true, data });
    } catch (error: any) {
      if (sendDomainError(res, error, { logger: console })) return;
      console.error('[referendums.delete]', error);
      res.status(500).json({ error: error.message });
    }
  },
);

export default router;
