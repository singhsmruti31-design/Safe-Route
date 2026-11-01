import express from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { findUserById, updateUserProfile } from '../db/usersRepo.js';

const router = express.Router();

// All profile routes require authentication
router.use(requireAuth);

const updateProfileSchema = z.object({
  fullName: z.string().trim().min(1, 'Full name cannot be empty.').max(150).optional(),
  mobile: z.string().trim().max(30).optional(),
  photoDataUrl: z.string().max(600 * 1024, 'Photo data size exceeds limit.').optional()
});

/**
 * GET /api/profile
 * Get current authenticated user profile.
 */
router.get('/', async (req, res, next) => {
  try {
    const user = await findUserById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }
    res.json({
      user,
      profile: user
    });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/profile
 * Update current authenticated user profile.
 */
router.put('/', async (req, res, next) => {
  try {
    const validated = updateProfileSchema.parse(req.body);

    const updated = await updateUserProfile(req.user.id, {
      fullName: validated.fullName,
      mobile: validated.mobile,
      photoUrl: validated.photoDataUrl
    });

    res.json({
      user: updated,
      profile: updated,
      message: 'Profile updated successfully.'
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.errors[0]?.message || 'Validation error' });
    }
    next(err);
  }
});

export default router;

