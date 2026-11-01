import express from 'express';
import { checkDatabaseHealth } from '../db/pool.js';
import { env } from '../config/env.js';

const router = express.Router();

const startTime = Date.now();

/**
 * GET /api/health
 * Returns server operational status and database connection state
 */
router.get('/', async (req, res, next) => {
  try {
    const dbHealth = await checkDatabaseHealth();
    const uptimeSeconds = Math.floor((Date.now() - startTime) / 1000);

    const isHealthy = dbHealth.status === 'connected' || dbHealth.status === 'mock';

    res.status(isHealthy ? 200 : 503).json({
      status: isHealthy ? 'ok' : 'degraded',
      service: 'safe-route-backend',
      timestamp: new Date().toISOString(),
      uptimeSeconds,
      environment: env.NODE_ENV,
      mockMode: env.MOCK_MODE,
      database: dbHealth,
      features: {
        openRouteServiceConfigured: Boolean(env.ORS_API_KEY),
        adminTokenConfigured: Boolean(env.ADMIN_TOKEN)
      }
    });
  } catch (err) {
    next(err);
  }
});

export default router;
