import express from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { env } from '../config/env.js';
import { authLimiter } from '../middleware/rateLimiter.js';
import { generateToken, requireAuth } from '../middleware/auth.js';
import {
  createUser,
  findUserByEmail,
  findUserById,
  createPasswordReset,
  findValidPasswordReset,
  completePasswordReset,
  setUserEmailVerified
} from '../db/usersRepo.js';

const router = express.Router();

// Apply auth rate limiting to all auth endpoints
router.use(authLimiter);

// ── Validation Schemas ────────────────────────────────────────────────────────

const signupSchema = z.object({
  fullName: z.string().trim().min(1, 'Full name is required.').max(150, 'Full name is too long.'),
  email: z.string().trim().email('Enter a valid email address.').max(255),
  mobile: z.string().trim().max(30).optional().default(''),
  password: z.string().min(8, 'Password must be at least 8 characters long.').max(100)
});

const loginSchema = z.object({
  email: z.string().trim().email('Enter a valid email address.'),
  password: z.string().min(1, 'Password is required.')
});

const forgotPasswordSchema = z.object({
  email: z.string().trim().email('Enter a valid email address.')
});

const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Reset token is required.'),
  password: z.string().min(8, 'Password must be at least 8 characters long.').max(100)
});

const verifyEmailSchema = z.object({
  token: z.string().min(1, 'Verification token is required.')
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required.'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters long.').max(100)
});

// ── Endpoints ─────────────────────────────────────────────────────────────────

/**
 * POST /api/auth/signup
 * Register a new user account.
 */
router.post('/signup', async (req, res, next) => {
  try {
    const validated = signupSchema.parse(req.body);

    // Hash password with bcrypt work factor 10
    const passwordHash = await bcrypt.hash(validated.password, 10);

    const user = await createUser({
      fullName: validated.fullName,
      email: validated.email,
      mobile: validated.mobile,
      passwordHash
    });

    const token = generateToken(user);

    res.status(201).json({
      token,
      user,
      message: 'Account created successfully.'
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.errors[0]?.message || 'Validation error' });
    }
    next(err);
  }
});

/**
 * POST /api/auth/login
 * Authenticate existing user with email and password.
 */
router.post('/login', async (req, res, next) => {
  try {
    const validated = loginSchema.parse(req.body);

    const user = await findUserByEmail(validated.email);
    if (!user) {
      return res.status(401).json({
        error: 'Invalid email or password.'
      });
    }

    const passwordMatch = await bcrypt.compare(validated.password, user.passwordHash);
    if (!passwordMatch) {
      return res.status(401).json({
        error: 'Invalid email or password.'
      });
    }

    const safeUser = {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      mobile: user.mobile,
      photoUrl: user.photoUrl,
      emailVerified: user.emailVerified
    };

    const token = generateToken(safeUser);

    res.json({
      token,
      user: safeUser,
      message: 'Sign in successful.'
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.errors[0]?.message || 'Validation error' });
    }
    next(err);
  }
});

/**
 * GET /api/auth/me
 * Protected endpoint — return current authenticated user session.
 */
router.get('/me', requireAuth, (req, res) => {
  res.json({
    user: req.user
  });
});

/**
 * POST /api/auth/logout
 * Stateless token logout acknowledgment.
 */
router.post('/logout', (req, res) => {
  res.json({
    success: true,
    message: 'Signed out successfully.'
  });
});

/**
 * POST /api/auth/forgot-password
 * Requests password reset instructions.
 * Never leaks whether email exists (anti-enumeration).
 */
router.post('/forgot-password', async (req, res, next) => {
  try {
    const validated = forgotPasswordSchema.parse(req.body);

    const user = await findUserByEmail(validated.email);
    let devResetToken = null;

    if (user) {
      // Generate 32-byte cryptographically secure random token
      const rawToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour expiry

      await createPasswordReset(user.id, tokenHash, expiresAt);

      // In mock/development mode, expose token for easy testing
      if (env.MOCK_MODE || env.NODE_ENV === 'development') {
        devResetToken = rawToken;
        console.log(`[AUTH] Password reset requested for ${user.email}. Dev reset token: ${rawToken}`);
      }
    }

    res.json({
      message: 'If an account exists with that email address, password reset instructions have been sent.',
      devResetToken: devResetToken || undefined
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.errors[0]?.message || 'Validation error' });
    }
    next(err);
  }
});

/**
 * POST /api/auth/reset-password
 * Complete password reset using token.
 */
router.post('/reset-password', async (req, res, next) => {
  try {
    const validated = resetPasswordSchema.parse(req.body);

    const tokenHash = crypto.createHash('sha256').update(validated.token).digest('hex');
    const reset = await findValidPasswordReset(tokenHash);

    if (!reset) {
      return res.status(400).json({
        error: 'Invalid or expired password reset link. Please request a new one.'
      });
    }

    const newPasswordHash = await bcrypt.hash(validated.password, 10);
    await completePasswordReset(reset.id, reset.userId, newPasswordHash);

    res.json({
      message: 'Password has been reset successfully. You may now sign in with your new password.'
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.errors[0]?.message || 'Validation error' });
    }
    next(err);
  }
});

/**
 * POST /api/auth/verify-email
 * Verifies email address using token.
 */
router.post('/verify-email', async (req, res, next) => {
  try {
    const validated = verifyEmailSchema.parse(req.body);

    // Tokens can be user ID or random hash
    await setUserEmailVerified(validated.token);

    res.json({
      message: 'Email address verified successfully.'
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.errors[0]?.message || 'Validation error' });
    }
    next(err);
  }
});

/**
 * POST /api/auth/change-password
 * Change password for currently authenticated user.
 */
router.post('/change-password', requireAuth, async (req, res, next) => {
  try {
    const validated = changePasswordSchema.parse(req.body);

    const userWithHash = await findUserByEmail(req.user.email);
    if (!userWithHash) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const isMatch = await bcrypt.compare(validated.currentPassword, userWithHash.passwordHash);
    if (!isMatch) {
      return res.status(400).json({ error: 'Current password is incorrect.' });
    }

    const newPasswordHash = await bcrypt.hash(validated.newPassword, 10);
    await completePasswordReset(0, req.user.id, newPasswordHash);

    res.json({
      message: 'Password changed successfully.'
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.errors[0]?.message || 'Validation error' });
    }
    next(err);
  }
});

export default router;

