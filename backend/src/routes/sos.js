import express from 'express';
import { z } from 'zod';

const router = express.Router();

const sosBodySchema = z.object({
  lat: z.number().min(-90, 'lat must be >= -90').max(90, 'lat must be <= 90'),
  lng: z.number().min(-180, 'lng must be >= -180').max(180, 'lng must be <= 180'),
  name: z.string().trim().max(100).optional(),
  contactPhone: z.string().trim().regex(/^[+0-9\s\-()]+$/, 'contactPhone contains invalid phone number characters').optional()
});

/**
 * POST /api/sos/link
 * Generates emergency contact links (Google Maps, WhatsApp, and SMS) with prefilled live location.
 * Stateless: Strictly DOES NOT store or log user coordinates or locations.
 */
router.post('/link', (req, res, next) => {
  try {
    const validated = sosBodySchema.parse(req.body);

    const lat = validated.lat;
    const lng = validated.lng;
    const senderName = validated.name ? validated.name.trim() : null;

    // Clean phone number (strip whitespace, hyphens, parentheses, retain digits and leading +)
    let cleanPhone = '';
    if (validated.contactPhone) {
      cleanPhone = validated.contactPhone.replace(/[^\d+]/g, '');
      // If starts with +, strip + for wa.me link as WhatsApp uses digits only
      cleanPhone = cleanPhone.replace(/^\+/, '');
    }

    // Google Maps link
    const googleMapsLink = `https://www.google.com/maps?q=${lat},${lng}`;

    // Prefilled distress message
    const message = senderName
      ? `EMERGENCY: ${senderName} needs help! My live location: ${googleMapsLink}`
      : `I need help. My live location: ${googleMapsLink}`;

    const encodedMessage = encodeURIComponent(message);

    // WhatsApp link (supports optional direct contact number)
    const whatsappLink = cleanPhone
      ? `https://wa.me/${cleanPhone}?text=${encodedMessage}`
      : `https://wa.me/?text=${encodedMessage}`;

    // SMS link (sms:phone?body=message)
    const smsLink = cleanPhone
      ? `sms:${cleanPhone}?body=${encodedMessage}`
      : `sms:?body=${encodedMessage}`;

    res.json({
      message,
      googleMapsLink,
      whatsappLink,
      smsLink
    });
  } catch (err) {
    next(err);
  }
});

export default router;
