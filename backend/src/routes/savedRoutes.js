import express from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import {
  findSavedRoutesByUserId,
  createSavedRoute,
  deleteSavedRoute
} from '../db/savedRoutesRepo.js';

const router = express.Router();

// All saved routes endpoints require authenticated user JWT
router.use(requireAuth);

const saveRouteSchema = z.object({
  name: z.string().trim().max(255).optional().default('Saved Route'),
  summary: z.string().trim().max(255).optional().default(''),
  distance: z.coerce.number().optional().default(0),
  duration: z.coerce.number().optional().default(0),
  provider: z.string().trim().max(100).optional().default(''),
  safetyScore: z.coerce.number().nullable().optional(),
  coordinates: z.array(z.any()).optional().default([])
});

/**
 * GET /api/saved-routes
 * List all saved routes for the authenticated user.
 */
router.get('/', async (req, res, next) => {
  try {
    const routes = await findSavedRoutesByUserId(req.user.id);
    res.json({ routes });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/saved-routes
 * Save a route to the authenticated user's account.
 */
router.post('/', async (req, res, next) => {
  try {
    const validated = saveRouteSchema.parse(req.body);
    const route = await createSavedRoute(req.user.id, validated);
    const routes = await findSavedRoutesByUserId(req.user.id);

    res.status(201).json({
      route,
      routes,
      message: 'Route saved successfully.'
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.errors[0]?.message || 'Validation error' });
    }
    next(err);
  }
});

/**
 * DELETE /api/saved-routes or DELETE /api/saved-routes/:id
 * Remove a saved route.
 */
const handleDelete = async (req, res, next) => {
  try {
    const id = req.params.id || req.body.id;
    if (!id) {
      return res.status(400).json({ error: 'Route ID is required for deletion.' });
    }

    await deleteSavedRoute(req.user.id, id);
    const routes = await findSavedRoutesByUserId(req.user.id);

    res.json({
      ok: true,
      message: 'Saved route deleted successfully.',
      routes
    });
  } catch (err) {
    next(err);
  }
};

router.delete('/:id', handleDelete);
router.delete('/', handleDelete);

export default router;

