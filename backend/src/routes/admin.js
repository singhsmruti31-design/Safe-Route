import express from 'express';
import { z } from 'zod';
import { updateReportStatus } from '../db/reportsRepo.js';
import { requireAdmin } from '../middleware/auth.js';

const router = express.Router();

const updateReportStatusSchema = z.object({
  status: z.enum(['approved', 'rejected'], {
    errorMap: () => ({ message: 'status must be either "approved" or "rejected"' })
  })
});

/**
 * PATCH /api/admin/reports/:id
 * Sets status of a community report to "approved" or "rejected".
 * Requires valid x-admin-token header.
 */
router.patch('/reports/:id', requireAdmin, async (req, res, next) => {
  try {
    const validated = updateReportStatusSchema.parse(req.body);
    const reportId = req.params.id;

    const updated = await updateReportStatus(reportId, validated.status);

    if (!updated) {
      return res.status(404).json({
        error: `Report with id ${reportId} not found.`
      });
    }

    res.json({
      message: `Report ${reportId} status updated to ${validated.status}.`,
      report: updated
    });
  } catch (err) {
    next(err);
  }
});

export default router;
