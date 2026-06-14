import { Router } from 'express';
import { AuthenticatedRequest, authenticate } from '../middleware/auth.middleware';
import { authService } from '../services/auth.service';
import { authLimiter } from '../middleware/rateLimit.middleware';
import { sendDomainError } from '../errors/domain-errors';
import { z } from 'zod';

const router = Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  phone: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

router.post('/register', authLimiter as any, async (req, res) => {
  try {
    const data = registerSchema.parse(req.body);
    const result = await authService.register(data);
    res.cookie('refreshToken', result.refreshToken, {
      httpOnly: true, secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict', maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    res.status(201).json({ success: true, data: { accessToken: result.accessToken, user: result.user } });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: error.issues });
      return;
    }
    if (sendDomainError(res, error, { logger: console })) return;
    console.error('[auth.register]', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/login', authLimiter as any, async (req, res) => {
  try {
    const { email, password } = loginSchema.parse(req.body);
    const result = await authService.login(email, password);
    res.cookie('refreshToken', result.refreshToken, {
      httpOnly: true, secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict', maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    res.json({ success: true, data: { accessToken: result.accessToken, user: result.user } });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: error.issues });
      return;
    }
    // Typed errors (InvalidCredentials, NotFound, etc.) carry their own
    // status code via sendDomainError. Anything else is a true server
    // failure and gets the 500 treatment.
    if (sendDomainError(res, error, { logger: console })) return;
    console.error('[auth.login]', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/refresh', authLimiter as any, async (req, res) => {
  try {
    const token = req.cookies?.refreshToken || req.body.refreshToken;
    if (!token) { res.status(401).json({ error: 'No refresh token' }); return; }
    const result = await authService.refresh(token);
    res.cookie('refreshToken', result.refreshToken, {
      httpOnly: true, secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict', maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    res.json({ success: true, data: { accessToken: result.accessToken, user: result.user } });
  } catch (error: any) {
    if (sendDomainError(res, error, { logger: console })) return;
    console.error('[auth.refresh]', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/logout', authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const token = req.cookies?.refreshToken || req.body.refreshToken;
    if (token) await authService.logout(token);
    res.clearCookie('refreshToken');
    res.json({ success: true, message: 'Logged out' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/profile', authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const profile = await authService.getProfile(req.user!.id);
    res.json({ success: true, data: profile });
  } catch (error: any) {
    res.status(404).json({ error: error.message });
  }
});

const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8),
});

router.post('/forgot-password', authLimiter as any, async (req, res) => {
  try {
    const { email } = forgotPasswordSchema.parse(req.body);
    const result = await authService.forgotPassword(email);
    res.json({ success: true, message: result.message });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: error.issues });
      return;
    }
    if (sendDomainError(res, error, { logger: console })) return;
    console.error('[auth.forgotPassword]', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/reset-password', authLimiter as any, async (req, res) => {
  try {
    const { token, password } = resetPasswordSchema.parse(req.body);
    const result = await authService.resetPassword(token, password);
    res.json({ success: true, message: result.message });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: error.issues });
      return;
    }
    if (sendDomainError(res, error, { logger: console })) return;
    console.error('[auth.resetPassword]', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
