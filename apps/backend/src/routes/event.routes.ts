import { Router } from 'express';
import { authenticate, AuthenticatedRequest } from '../middleware/auth.middleware';
import { authorize } from '../middleware/rbac.middleware';
import { eventService } from '../services/event.service';
import { sendDomainError } from '../errors/domain-errors';

const router = Router();

// Public listing
router.get('/', async (req, res) => {
  try {
    const result = await eventService.getAll({
      ...parsePagination(req.query as Record<string, unknown>, { defaultPageSize: 20 }),
      type: req.query.type as string,
      search: req.query.search as string,
      upcoming: req.query.upcoming === 'true',
    });
    res.json({ success: true, ...result });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get single event
router.get('/:id', async (req, res) => {
  try {
    const event = await eventService.getById(req.params.id as string);
    res.json({ success: true, data: event });
  } catch (error: any) {
    res.status(404).json({ error: error.message });
  }
});

// Create event (staff+ only)
router.post('/', authenticate, authorize('SUPER_ADMIN', 'MAYOR', 'DEPARTMENT_HEAD', 'STAFF', 'WARD_REP'), async (req: AuthenticatedRequest, res) => {
  try {
    const event = await eventService.create({ ...req.body, creatorId: req.user!.id });
    res.status(201).json({ success: true, data: event });
  } catch (error: any) {
    if (sendDomainError(res, error, { logger: console })) return;
    console.error('[events.create]', error);
    res.status(500).json({ error: error.message });
  }
});

// Update event (creator or admin)
router.patch('/:id', authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const event = await eventService.getById(req.params.id as string);
    if (event.creatorId !== req.user!.id && req.user!.role !== 'SUPER_ADMIN' && req.user!.role !== 'MAYOR') {
      res.status(403).json({ error: 'Not authorized to update this event' });
      return;
    }
    const updated = await eventService.update(req.params.id as string, req.body);
    res.json({ success: true, data: updated });
  } catch (error: any) {
    if (sendDomainError(res, error, { logger: console })) return;
    console.error('[events.update]', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete event (creator or admin)
router.delete('/:id', authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const event = await eventService.getById(req.params.id as string);
    if (event.creatorId !== req.user!.id && req.user!.role !== 'SUPER_ADMIN' && req.user!.role !== 'MAYOR') {
      res.status(403).json({ error: 'Not authorized to delete this event' });
      return;
    }
    await eventService.delete(req.params.id as string);
    res.json({ success: true });
  } catch (error: any) {
    if (sendDomainError(res, error, { logger: console })) return;
    console.error('[events.delete]', error);
    res.status(500).json({ error: error.message });
  }
});

// RSVP to event
router.post('/:id/rsvp', authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['GOING', 'MAYBE', 'NOT_GOING'];
    if (!status || !validStatuses.includes(status)) { res.status(400).json({ error: `Status must be one of: ${validStatuses.join(', ')}` }); return; }
    const rsvp = await eventService.rsvp(req.params.id as string, req.user!.id, status);
    res.json({ success: true, data: rsvp });
  } catch (error: any) {
    // service throws NotFoundError if the event doesn't exist;
    // mapped to 404 via sendDomainError.
    if (sendDomainError(res, error, { logger: console })) return;
    console.error('[events.rsvp]', error);
    res.status(500).json({ error: error.message });
  }
});

// Cancel RSVP
router.delete('/:id/rsvp', authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    await eventService.cancelRsvp(req.params.id as string, req.user!.id);
    res.json({ success: true });
  } catch (error: any) {
    if (sendDomainError(res, error, { logger: console })) return;
    console.error('[events.cancelRsvp]', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
