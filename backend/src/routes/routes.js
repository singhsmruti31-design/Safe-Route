import express from 'express';
import { z } from 'zod';
import { getWalkingRoutes } from '../services/orsService.js';
import { scoreAndRankRoutes } from '../services/scoringEngine.js';

const router = express.Router();

const coordinateSchema = z.object({
  lat: z.number().min(-90, 'lat must be >= -90').max(90, 'lat must be <= 90'),
  lng: z.number().min(-180, 'lng must be >= -180').max(180, 'lng must be <= 180')
});

const safeRouteBodySchema = z.object({
  start: coordinateSchema,
  end: coordinateSchema,
  departAt: z.string().optional().refine(val => {
    if (!val) return true;
    return !isNaN(Date.parse(val));
  }, { message: 'departAt must be a valid ISO-8601 timestamp' }),
  mode: z.enum(['safest', 'fastest']).default('safest')
});

/**
 * POST /api/routes/safe
 * Calculates alternative walking routes, splits them into ~100m segments,
 * batch-scores them against PostGIS safety factors, and ranks them by safety or duration.
 */
router.post('/safe', async (req, res, next) => {
  try {
    const validated = safeRouteBodySchema.parse(req.body);

    const departAt = validated.departAt ? new Date(validated.departAt) : new Date();

    // 1. Fetch 2 to 3 alternative walking routes from ORS
    const rawRoutes = await getWalkingRoutes(validated.start, validated.end);

    if (!rawRoutes || rawRoutes.length === 0) {
      return res.status(404).json({
        error: 'No walking routes found between the specified coordinates.'
      });
    }

    // 2. Split, batch-query PostGIS, score, and rank routes
    const result = await scoreAndRankRoutes({
      routes: rawRoutes,
      departAt,
      mode: validated.mode
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
