import express from 'express';
import { z } from 'zod';
import { findNearbyPlaces } from '../db/placesRepo.js';
import { isPlaceOpen } from '../services/openingHoursService.js';
import { getWalkingRoutes } from '../services/orsService.js';

const router = express.Router();

const TARGET_TYPES = ['police', 'hospital', 'shop24', 'fuel'];

const nearestSafeSpotsQuerySchema = z.object({
  lat: z.coerce.number().min(-90, 'lat must be >= -90').max(90, 'lat must be <= 90'),
  lng: z.coerce.number().min(-180, 'lng must be >= -180').max(180, 'lng must be <= 180'),
  departAt: z.string().optional().refine(val => {
    if (!val) return true;
    return !isNaN(Date.parse(val));
  }, { message: 'departAt must be a valid ISO-8601 date string' })
});

/**
 * GET /api/safe-spots/nearest
 * Finds the nearest OPEN police station, hospital, 24/7 shop or petrol pump right now.
 * Returns the top 3 with distance, plus a walking route to the closest one from ORS.
 */
router.get('/nearest', async (req, res, next) => {
  try {
    const validated = nearestSafeSpotsQuerySchema.parse(req.query);
    const targetTime = validated.departAt ? new Date(validated.departAt) : new Date();

    // 1. Find help places within up to 10km radius
    const candidates = await findNearbyPlaces({
      lat: validated.lat,
      lng: validated.lng,
      radiusMeters: 10000,
      types: TARGET_TYPES
    });

    // 2. Filter strictly for places that are OPEN at targetTime
    const openSafeSpots = [];
    for (const place of candidates) {
      const openStatus = isPlaceOpen(place.opening_hours, place.is_24_7, targetTime);
      if (openStatus.isOpen) {
        openSafeSpots.push({
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
          is_open: true
        });
      }
    }

    // 3. Take the top 3 closest open safe spots
    const top3 = openSafeSpots.slice(0, 3);

    // 4. Fetch walking route to the closest (#1) safe spot
    let routeToClosest = null;
    if (top3.length > 0) {
      const closest = top3[0];
      try {
        const routes = await getWalkingRoutes(
          { lat: validated.lat, lng: validated.lng },
          { lat: closest.coordinates.lat, lng: closest.coordinates.lng }
        );

        if (routes && routes.length > 0) {
          const directRoute = routes[0];
          routeToClosest = {
            target: {
              id: closest.id,
              name: closest.name,
              type: closest.type,
              coordinates: closest.coordinates
            },
            distance: directRoute.properties?.summary?.distance || closest.distance_meters,
            duration: directRoute.properties?.summary?.duration || Math.round(closest.distance_meters / 1.3),
            geometry: directRoute.geometry
          };
        }
      } catch (err) {
        console.warn('Could not generate ORS walking route to closest safe spot:', err.message);
      }
    }

    res.json({
      evaluatedAt: targetTime.toISOString(),
      count: top3.length,
      nearestSafeSpots: top3,
      routeToClosest
    });
  } catch (err) {
    next(err);
  }
});

export default router;
