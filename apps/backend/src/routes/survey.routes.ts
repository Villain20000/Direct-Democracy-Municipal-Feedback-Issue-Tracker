import { Router } from 'express';
import { authenticate, AuthenticatedRequest } from '../middleware/auth.middleware';
import { authorize } from '../middleware/rbac.middleware';
import { surveyService } from '../services/survey.service';
import { sendDomainError } from '../errors/domain-errors';
import { parsePagination } from '../utils/pagination';


const router = Router();

router.get('/', async (req, res) => {
  try {
    const result = await surveyService.getAll({
      ...parsePagination(req.query as Record<string, unknown>, { defaultPageSize: 20 }),
      activeOnly: req.query.activeOnly === 'true',
    });
    res.json({ success: true, ...result });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const survey = await surveyService.getById(req.params.id as string);
    res.json({ success: true, data: survey });
  } catch (error: any) {
    res.status(404).json({ error: error.message });
  }
});

router.post('/', authenticate, authorize('SUPER_ADMIN', 'MAYOR', 'COUNCIL_MEMBER'), async (req: AuthenticatedRequest, res) => {
  try {
    const { questions, ...rest } = req.body;
    if (!questions || !Array.isArray(questions) || questions.length === 0) {
      res.status(400).json({ error: 'At least one question is required' });
      return;
    }
    const survey = await surveyService.create({ ...rest, questions, creatorId: req.user!.id });
    res.status(201).json({ success: true, data: survey });
  } catch (error: any) {
    if (sendDomainError(res, error, { logger: console })) return;
    console.error('[surveys.create]', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/:id/respond', authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const { answers } = req.body;
    if (!answers) { res.status(400).json({ error: 'Answers are required' }); return; }
    const response = await surveyService.submitResponse(req.params.id as string, req.user!.id, answers);
    res.status(201).json({ success: true, data: response });
  } catch (error: any) {
    // service throws AlreadyClosedError (409), AlreadyRespondedError (409),
    // NotFoundError (404); all mapped via sendDomainError.
    if (sendDomainError(res, error, { logger: console })) return;
    console.error('[surveys.respond]', error);
    res.status(500).json({ error: error.message });
  }
});

router.patch('/:id/close', authenticate, authorize('SUPER_ADMIN', 'MAYOR', 'COUNCIL_MEMBER'), async (req: AuthenticatedRequest, res) => {
  try {
    const survey = await surveyService.close(req.params.id as string);
    res.json({ success: true, data: survey });
  } catch (error: any) {
    if (sendDomainError(res, error, { logger: console })) return;
    console.error('[surveys.close]', error);
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:id', authenticate, authorize('SUPER_ADMIN'), async (req: AuthenticatedRequest, res) => {
  try {
    await surveyService.delete(req.params.id as string);
    res.json({ success: true });
  } catch (error: any) {
    if (sendDomainError(res, error, { logger: console })) return;
    console.error('[surveys.delete]', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;