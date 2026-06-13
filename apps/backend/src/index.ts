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
import messageRoutes from './routes/message.routes';
import auditRoutes from './routes/audit.routes';
import attachmentRoutes from './routes/attachment.routes';

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

// Health check
app.get('/health', (_req, res) => {
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
app.use('/api/v1/messages', messageRoutes);
app.use('/api/v1/audit', auditRoutes);
app.use('/api/v1', attachmentRoutes);

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
