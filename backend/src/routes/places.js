import express from 'express';
import { z } from 'zod';
import { findNearbyPlaces } from '../db/placesRepo.js';
import { isPlaceOpen } from '../services/openingHoursService.js';

const router = express.Router();

const ALLOWED_TYPES = ['police', 'hospital', 'pharmacy', 'fuel', 'shop24', 'atm'];

const placesQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90, 'lat must be between -90 and 90'),
  lng: z.coerce.number().min(-180).max(180, 'lng must be between -180 and 180'),
  radius: z.coerce.number().min(10).max(25000).default(1000),
  types: z.string().optional().transform(val => {
    if (!val || !val.trim()) return [];
    return val.split(',').map(t => t.trim().toLowerCase()).filter(Boolean);
  }).refine(types => {
    return types.every(t => ALLOWED_TYPES.includes(t));
  }, {
    message: `types must be a comma-separated list of valid categories: ${ALLOWED_TYPES.join(', ')}`
  }),
  at: z.string().optional().refine(val => {
    if (!val) return true;
    return !isNaN(Date.parse(val));
  }, { message: 'at must be a valid ISO-8601 date string' })
});

/**
 * GET /api/places
 * Query nearby help points (police, hospital, pharmacy, fuel, shop24, atm)
 */
router.get('/', async (req, res, next) => {
  try {
    const validated = placesQuerySchema.parse(req.query);
    const targetTime = validated.at ? new Date(validated.at) : new Date();

    const rawPlaces = await findNearbyPlaces({
      lat: validated.lat,
      lng: validated.lng,
      radiusMeters: validated.radius,
      types: validated.types
    });

    // Evaluate open/closed status for each place at target time
    const places = rawPlaces.map(place => {
      const openStatus = isPlaceOpen(place.opening_hours, place.is_24_7, targetTime);
      return {
        id: place.id,
        osm_id: place.osm_id,
        type: place.type,
        name: place.name || `Unnamed ${place.type}`,
        coordinates: {
          lat: place.lat,
          lng: place.lng
        },
        distance_meters: place.distance_meters,
        opening_hours: place.opening_hours || null,
        is_24_7: Boolean(place.is_24_7),
        is_open: openStatus.isOpen
      };
    });

    res.json({
      count: places.length,
      evaluatedAt: targetTime.toISOString(),
      places
    });
  } catch (err) {
    next(err);
  }
});

export default router;
