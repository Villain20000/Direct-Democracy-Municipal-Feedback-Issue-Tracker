import { Router } from 'express';
import { authenticate, AuthenticatedRequest } from '../middleware/auth.middleware';
import { authorize } from '../middleware/rbac.middleware';
import { reportsService } from '../services/reports.service';

const router = Router();

router.get('/issues.csv', authenticate, authorize('SUPER_ADMIN', 'MAYOR', 'AUDITOR', 'DEPARTMENT_HEAD', 'MEDIA', 'COUNCIL_MEMBER'), async (req: AuthenticatedRequest, res) => {
  try {
    const csv = await reportsService.exportIssuesCsv({
      status: req.query.status as string,
      departmentId: req.query.departmentId as string,
      wardId: req.query.wardId as string,
    });
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="issues-export.csv"');
    res.send(csv);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/audit.csv', authenticate, authorize('SUPER_ADMIN', 'AUDITOR'), async (req: AuthenticatedRequest, res) => {
  try {
    const csv = await reportsService.exportAuditCsv({
      userId: req.query.userId as string,
      entity: req.query.entity as string,
      action: req.query.action as string,
    });
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="audit-export.csv"');
    res.send(csv);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// P1-7 — PDF variants of the same reports (PLAN feature 23
// "Report Export (PDF/CSV)"). Same RBAC as their CSV siblings.
router.get('/issues.pdf', authenticate, authorize('SUPER_ADMIN', 'MAYOR', 'AUDITOR', 'DEPARTMENT_HEAD', 'MEDIA', 'COUNCIL_MEMBER'), async (req: AuthenticatedRequest, res) => {
  try {
    const pdf = await reportsService.exportIssuesPdf({
      status: req.query.status as string,
      departmentId: req.query.departmentId as string,
      wardId: req.query.wardId as string,
    });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="issues-report.pdf"');
    res.send(pdf);
  } catch (error: any) {
    console.error('[reports.issues.pdf]', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/audit.pdf', authenticate, authorize('SUPER_ADMIN', 'AUDITOR'), async (req: AuthenticatedRequest, res) => {
  try {
    const pdf = await reportsService.exportAuditPdf({
      userId: req.query.userId as string,
      entity: req.query.entity as string,
      action: req.query.action as string,
    });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="audit-report.pdf"');
    res.send(pdf);
  } catch (error: any) {
    console.error('[reports.audit.pdf]', error);
    res.status(500).json({ error: error.message });
  }
});

// P1-7 — Weekly executive briefing PDF (latest stored WeeklySummary,
// or ?weekKey=2026-W24). Executive + auditor roles.
router.get('/briefing.pdf', authenticate, authorize('SUPER_ADMIN', 'MAYOR', 'DEPARTMENT_HEAD', 'AUDITOR', 'COUNCIL_MEMBER'), async (req: AuthenticatedRequest, res) => {
  try {
    const pdf = await reportsService.exportBriefingPdf(req.query.weekKey as string | undefined);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="weekly-briefing.pdf"');
    res.send(pdf);
  } catch (error: any) {
    console.error('[reports.briefing.pdf]', error);
    res.status(error.httpStatus || 500).json({ error: error.message });
  }
});

// P1-7 — Per-issue resolution dossier PDF (detail + status timeline +
// comments + audit trail). Same RBAC as the issues report.
router.get('/issues/:id/dossier.pdf', authenticate, authorize('SUPER_ADMIN', 'MAYOR', 'AUDITOR', 'DEPARTMENT_HEAD', 'MEDIA', 'COUNCIL_MEMBER'), async (req: AuthenticatedRequest, res) => {
  try {
    const issueId = req.params.id as string;
    const pdf = await reportsService.exportDossierPdf(issueId);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="dossier-${issueId.slice(0, 8)}.pdf"`);
    res.send(pdf);
  } catch (error: any) {
    console.error('[reports.dossier.pdf]', error);
    res.status(error.httpStatus || 500).json({ error: error.message });
  }
});

export default router;