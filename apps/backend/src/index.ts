import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { config } from './config';
import { errorHandler } from './middleware/error.middleware';
import { apiLimiter } from './middleware/rateLimit.middleware';
import authRoutes from './routes/auth.routes';
import issueRoutes from './routes/issue.routes';
import userRoutes from './routes/user.routes';
import notificationRoutes from './routes/notification.routes';
import departmentRoutes from './routes/department.routes';
import aiRoutes from './routes/ai.routes';
import eventRoutes from './routes/event.routes';
import announcementRoutes from './routes/announcement.routes';
import commentRoutes from './routes/comment.routes';
import pollRoutes from './routes/poll.routes';
import resolutionRoutes from './routes/resolution.routes';
import referendumRoutes from './routes/referendum.routes';
import messageRoutes from './routes/message.routes';
import auditRoutes from './routes/audit.routes';
import attachmentRoutes from './routes/attachment.routes';
import surveyRoutes from './routes/survey.routes';
import forumRoutes from './routes/forum.routes';
import reportsRoutes from './routes/reports.routes';
import adminDocumentRoutes from './routes/admin-documents.routes';
import spatialRoutes from './routes/spatial.routes';
import featureSweepRoutes, { _issueShareLinkServiceForPublicResolve } from './routes/feature-sweep.routes';
import weeklySummaryRoutes from './routes/weekly-summary.routes';
import portalRoutes from './routes/portal.routes';

const app = express();

// Trust the first proxy hop (required for Codespaces, reverse proxies, etc.)
app.set('trust proxy', 1);

// Security & parsing
app.use(helmet(config.nodeEnv === 'production' ? {} : {
  crossOriginOpenerPolicy: false,
  crossOriginResourcePolicy: false,
}));
app.use(cors({
  origin: config.nodeEnv === 'production' ? config.corsOrigin : true,
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser() as any);

// Health check (versioned under /api/v1 for consistency with the rest of the API)
app.get('/api/v1/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), version: '1.0.0' });
});

// Rate limiting (applied globally)
(app as any).use('/api/v1', apiLimiter);

// API v1 routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/issues', issueRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/notifications', notificationRoutes);
app.use('/api/v1/departments', departmentRoutes);
app.use('/api/v1/ai', aiRoutes);
app.use('/api/v1/events', eventRoutes);
app.use('/api/v1/announcements', announcementRoutes);
app.use('/api/v1', commentRoutes);
app.use('/api/v1/polls', pollRoutes);
app.use('/api/v1/resolutions', resolutionRoutes);
app.use('/api/v1/referendums', referendumRoutes);
app.use('/api/v1/messages', messageRoutes);
app.use('/api/v1/audit', auditRoutes);
app.use('/api/v1/surveys', surveyRoutes);
app.use('/api/v1/forums', forumRoutes);
app.use('/api/v1/reports', reportsRoutes);
app.use('/api/v1/admin/documents', adminDocumentRoutes);
app.use('/api/v1/spatial', spatialRoutes);
app.use('/api/v1', attachmentRoutes);
// Phase B: 10-feature sweep endpoints
app.use('/api/v1', featureSweepRoutes);
// Phase C: weekly executive briefings
app.use('/api/v1/weekly-summaries', weeklySummaryRoutes);
// Phase D2: public transparency portal (no auth)
app.use('/api/v1/portal', portalRoutes);

// Public share-link resolve endpoint (no auth — mounted at top level so
// /share/:token doesn't get swallowed by any other router)
app.get('/api/v1/share/:token', async (req, res) => {
  try {
    const link = await _issueShareLinkServiceForPublicResolve.resolve(req.params.token as string);
    res.json({ success: true, data: link });
  } catch (error: any) {
    res.status(error.statusCode || 404).json({ error: error.message });
  }
});

// Static uploads
app.use('/uploads', express.static('uploads'));

// Error handler (must be last)
app.use(errorHandler);

app.listen(config.port, () => {
  console.log(`🚀 Direct Democracy API running on http://localhost:${config.port}`);
  console.log(`📊 Environment: ${config.nodeEnv}`);
  console.log(`🤖 Ollama: ${config.ollama.baseUrl} (model: ${config.ollama.model})`);
});

export default app;
