import express from 'express';
import crypto from 'crypto';
import { z } from 'zod';
import { createReport, getApprovedReportsInBbox } from '../db/reportsRepo.js';
import { reportsLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

const REPORT_TYPES = ['isolated', 'felt_unsafe', 'dark', 'harassment', 'safe_spot'];

const createReportSchema = z.object({
  lat: z.number().min(-90, 'lat must be >= -90').max(90, 'lat must be <= 90'),
  lng: z.number().min(-180, 'lng must be >= -180').max(180, 'lng must be <= 180'),
  type: z.enum(REPORT_TYPES, {
    errorMap: () => ({ message: `type must be one of: ${REPORT_TYPES.join(', ')}` })
  }),
  note: z.string().trim().max(200, 'note cannot exceed 200 characters').optional()
});

const getReportsQuerySchema = z.object({
  bbox: z.string().refine(val => {
    const parts = val.split(',').map(Number);
    return parts.length === 4 && parts.every(n => !isNaN(n));
  }, { message: 'bbox must be 4 comma-separated numbers: minLng,minLat,maxLng,maxLat' })
});

/**
 * Computes an anonymous, one-way SHA-256 hash of the client's IP address.
 */
function hashClientIp(req) {
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || '127.0.0.1';
  return crypto.createHash('sha256').update(ip + '_safe_route_salt').digest('hex');
}

/**
 * POST /api/reports
 * Submits an anonymous community safety report.
 * Strictly anonymous: hashes IP with SHA-256; does not store raw IP.
 * Enforces rate limiting and 50m / 24-hr duplicate spam prevention.
 */
router.post('/', reportsLimiter, async (req, res, next) => {
  try {
    const validated = createReportSchema.parse(req.body);
    const ipHash = hashClientIp(req);

    const report = await createReport({
      lat: validated.lat,
      lng: validated.lng,
      type: validated.type,
      note: validated.note,
      ipHash
    });

    res.status(201).json({
      message: 'Report submitted successfully. It is pending community verification or moderation.',
      report
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/reports?bbox=minLng,minLat,maxLng,maxLat
 * Returns ONLY verified/approved community reports within a bounding box.
 */
router.get('/', async (req, res, next) => {
  try {
    const validated = getReportsQuerySchema.parse(req.query);
    const [minLng, minLat, maxLng, maxLat] = validated.bbox.split(',').map(Number);

    const reports = await getApprovedReportsInBbox({ minLng, minLat, maxLng, maxLat });

    res.json({
      count: reports.length,
      bbox: [minLng, minLat, maxLng, maxLat],
      reports
    });
  } catch (err) {
    next(err);
  }
});

export default router;
