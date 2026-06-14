import { Router } from 'express';
import { authenticate, AuthenticatedRequest } from '../middleware/auth.middleware';
import multer from 'multer';
import { prisma } from '../db/client';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';

const uploadDir = path.join(__dirname, '../../uploads');

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadDir),
    filename: (_req, file, cb) => cb(null, `${uuidv4()}${path.extname(file.originalname)}`),
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|pdf|doc|docx|txt|csv/;
    const ext = allowed.test(path.extname(file.originalname).toLowerCase());
    const mime = allowed.test(file.mimetype);
    cb(null, ext && mime);
  },
});

const ADMIN_ROLES = new Set(['SUPER_ADMIN', 'MAYOR', 'DEPARTMENT_HEAD']);

const router = Router();

router.post('/:issueId/attachments', authenticate, upload.single('file') as any, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.file) { res.status(400).json({ error: 'No file uploaded' }); return; }

    const issue = await prisma.issue.findUnique({ where: { id: req.params.issueId as string } });
    if (!issue) {
      fs.unlink(req.file.path, () => {});
      res.status(404).json({ error: 'Issue not found' });
      return;
    }

    const attachment = await prisma.attachment.create({
      data: {
        fileName: req.file.originalname,
        fileUrl: `/uploads/${req.file.filename}`,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
        issueId: issue.id,
        uploadedBy: req.user!.id,
      },
    });

    res.status(201).json({ success: true, data: attachment });
  } catch (error: any) {
    if (req.file) fs.unlink(req.file.path, () => {});
    res.status(400).json({ error: error.message });
  }
});

router.get('/:issueId/attachments', async (req, res) => {
  try {
    const attachments = await prisma.attachment.findMany({
      where: { issueId: req.params.issueId as string },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data: attachments });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/attachments/:id', authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const attachment = await prisma.attachment.findUnique({
      where: { id: req.params.id as string },
      include: { issue: { select: { reporterId: true } } },
    });
    if (!attachment) {
      res.status(404).json({ error: 'Attachment not found' });
      return;
    }

    const userId = req.user!.id;
    const canDelete =
      attachment.uploadedBy === userId ||
      attachment.issue.reporterId === userId ||
      ADMIN_ROLES.has(req.user!.role);

    if (!canDelete) {
      res.status(403).json({ error: 'Not authorized to delete this attachment' });
      return;
    }

    await prisma.attachment.delete({ where: { id: attachment.id } });

    const filePath = path.join(uploadDir, path.basename(attachment.fileUrl));
    fs.unlink(filePath, () => {});

    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

export default router;