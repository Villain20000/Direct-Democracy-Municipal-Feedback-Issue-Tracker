import { Router } from 'express';
import { authenticate, AuthenticatedRequest } from '../middleware/auth.middleware';
import multer from 'multer';
import { prisma } from '../db/client';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, path.join(__dirname, '../../uploads')),
    filename: (_req, file, cb) => cb(null, `${uuidv4()}${path.extname(file.originalname)}`),
  }),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|pdf|doc|docx|txt|csv/;
    const ext = allowed.test(path.extname(file.originalname).toLowerCase());
    const mime = allowed.test(file.mimetype);
    cb(null, ext && mime);
  },
});

const router = Router();

// Upload attachment to an issue
router.post('/:issueId/attachments', authenticate, upload.single('file') as any, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.file) { res.status(400).json({ error: 'No file uploaded' }); return; }

    const attachment = await prisma.attachment.create({
      data: {
        fileName: req.file.originalname,
        fileUrl: `/uploads/${req.file.filename}`,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
        issueId: req.params.issueId as string,
        uploadedBy: req.user!.id,
      },
    });

    res.status(201).json({ success: true, data: attachment });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Get attachments for an issue
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

// Delete attachment
router.delete('/attachments/:id', authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    await prisma.attachment.delete({ where: { id: req.params.id as string } });
    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

export default router;
