import express from 'express';
import crypto from 'crypto';
import { z } from 'zod';
import { createReport, getApprovedReportsInBbox, getUserReports, deleteUserReport } from '../db/reportsRepo.js';
import { reportsLimiter } from '../middleware/rateLimiter.js';
import { optionalAuth, requireAuth } from '../middleware/auth.js';

const router = express.Router();

const REPORT_TYPES = [
  'isolated',
  'felt_unsafe',
  'dark',
  'harassment',
  'safe_spot',
  'no_lighting',
  'poor_lighting',
  'poor_road',
  'suspicious_activity',
  'isolated_area',
  'other'
];

const TYPE_MAP = {
  no_lighting: 'dark',
  poor_lighting: 'dark',
  suspicious_activity: 'felt_unsafe',
  isolated_area: 'isolated'
};

const createReportSchema = z.object({
  lat: z.coerce.number().min(-90, 'lat must be >= -90').max(90, 'lat must be <= 90'),
  lng: z.coerce.number().min(-180, 'lng must be >= -180').max(180, 'lng must be <= 180'),
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
 * Submits a community safety report.
 * Hashes client IP for spam prevention.
 * If user is authenticated, associates report with their account.
 */
router.post('/', reportsLimiter, optionalAuth, async (req, res, next) => {
  try {
    const validated = createReportSchema.parse(req.body);
    const ipHash = hashClientIp(req);
    const normalizedType = TYPE_MAP[validated.type] || validated.type;

    const report = await createReport({
      lat: validated.lat,
      lng: validated.lng,
      type: normalizedType,
      note: validated.note,
      ipHash,
      userId: req.user?.id || null
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
 * GET /api/reports
 * Dual-mode retrieval:
 * 1. GET /api/reports?bbox=minLng,minLat,maxLng,maxLat
 *    Returns verified/approved community reports within the bounding box.
 * 2. GET /api/reports?mine=true (or with Authorization header and without bbox)
 *    Returns reports submitted by the authenticated user.
 */
router.get('/', optionalAuth, async (req, res, next) => {
  try {
    if (req.query.bbox) {
      const validated = getReportsQuerySchema.parse(req.query);
      const [minLng, minLat, maxLng, maxLat] = validated.bbox.split(',').map(Number);
      const reports = await getApprovedReportsInBbox({ minLng, minLat, maxLng, maxLat });

      return res.json({
        count: reports.length,
        bbox: [minLng, minLat, maxLng, maxLat],
        reports
      });
    }

    if (req.query.mine === 'true' || req.user) {
      if (!req.user) {
        return res.status(401).json({
          error: 'Unauthorized: Authentication required to view submitted reports.'
        });
      }

      const reports = await getUserReports(req.user.id);
      return res.json({
        count: reports.length,
        reports
      });
    }

    return res.status(400).json({
      error: 'Missing required query parameter: bbox (minLng,minLat,maxLng,maxLat) or authenticate to view submitted reports.'
    });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/reports/:id or DELETE /api/reports (with { id })
 * Deletes a report owned by the authenticated user.
 */
const handleDeleteReport = async (req, res, next) => {
  try {
    const id = req.params.id || req.body?.id;
    if (!id) {
      return res.status(400).json({ error: 'Report ID is required for deletion.' });
    }
    const deleted = await deleteUserReport(id, req.user.id);
    if (!deleted) {
      return res.status(404).json({
        error: 'Report not found or not owned by you.'
      });
    }
    res.json({
      message: 'Report deleted successfully',
      id
    });
  } catch (err) {
    next(err);
  }
};

router.delete('/:id', requireAuth, handleDeleteReport);
router.delete('/', requireAuth, handleDeleteReport);

export default router;
