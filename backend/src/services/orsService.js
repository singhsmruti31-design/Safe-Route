import { env } from '../config/env.js';
import { calculateHaversineDistanceMeters } from '../db/mockPlacesData.js';

// 5-minute in-memory cache to conserve ORS rate limits
const cache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Builds a deterministic cache key for a route request
 */
function getCacheKey(start, end) {
  return `${Number(start.lat).toFixed(5)},${Number(start.lng).toFixed(5)}->${Number(end.lat).toFixed(5)},${Number(end.lng).toFixed(5)}`;
}

/**
 * Clears the in-memory cache (primarily for unit tests)
 */
export function clearOrsCache() {
  cache.clear();
}

/**
 * Generates realistic mock alternative walking routes between start and end
 */
function generateMockRoutes(start, end) {
  const directDistMeters = calculateHaversineDistanceMeters(start.lat, start.lng, end.lat, end.lng);
  // Average walking speed: 1.3 m/s (~4.7 km/h)
  const walkingSpeed = 1.3;

  // Midpoints with slight lateral offsets to create 2-3 distinct paths
  const dLat = end.lat - start.lat;
  const dLng = end.lng - start.lng;

  // Route 1: Direct along main street (waytype 1 = State Road / Primary, 3 = Street)
  const route1Coords = [
    [start.lng, start.lat],
    [start.lng + dLng * 0.25, start.lat + dLat * 0.25],
    [start.lng + dLng * 0.5, start.lat + dLat * 0.5],
    [start.lng + dLng * 0.75, start.lat + dLat * 0.75],
    [end.lng, end.lat]
  ];
  const dist1 = Math.round(directDistMeters * 1.1);

  // Route 2: Slightly curved through residential street (waytype 4 = Residential)
  const route2Coords = [
    [start.lng, start.lat],
    [start.lng + dLng * 0.2 - dLat * 0.15, start.lat + dLat * 0.2 + dLng * 0.15],
    [start.lng + dLng * 0.5 - dLat * 0.2, start.lat + dLat * 0.5 + dLng * 0.2],
    [start.lng + dLng * 0.8 - dLat * 0.1, start.lat + dLat * 0.8 + dLng * 0.1],
    [end.lng, end.lat]
  ];
  const dist2 = Math.round(directDistMeters * 1.25);

  // Route 3: Pedestrian zone & footway path (waytype 6 = Pedestrian, 7 = Footway)
  const route3Coords = [
    [start.lng, start.lat],
    [start.lng + dLng * 0.3 + dLat * 0.15, start.lat + dLat * 0.3 - dLng * 0.15],
    [start.lng + dLng * 0.6 + dLat * 0.18, start.lat + dLat * 0.6 - dLng * 0.18],
    [end.lng, end.lat]
  ];
  const dist3 = Math.round(directDistMeters * 1.35);

  return [
    {
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: route1Coords },
      properties: {
        summary: { distance: dist1, duration: Math.round(dist1 / walkingSpeed) },
        extra_info: {
          waytype: {
            values: [
              [0, 2, 1], // Start to middle: Primary road
              [2, 4, 3]  // Middle to end: Street
            ]
          }
        }
      }
    },
    {
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: route2Coords },
      properties: {
        summary: { distance: dist2, duration: Math.round(dist2 / walkingSpeed) },
        extra_info: {
          waytype: {
            values: [
              [0, 4, 4] // Residential throughout
            ]
          }
        }
      }
    },
    {
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: route3Coords },
      properties: {
        summary: { distance: dist3, duration: Math.round(dist3 / walkingSpeed) },
        extra_info: {
          values: [
            [0, 2, 6], // Pedestrian zone
            [2, 3, 7]  // Footway
          ]
        }
      }
    }
  ];
}

/**
 * Fetches walking routes between start and end using OpenRouteService API.
 * Uses 5-minute in-memory caching and mock fallback when MOCK_MODE=true.
 * 
 * @param {{ lat: number, lng: number }} start 
 * @param {{ lat: number, lng: number }} end 
 * @returns {Promise<Array<Object>>} Array of GeoJSON Feature route objects
 */
export async function getWalkingRoutes(start, end) {
  const cacheKey = getCacheKey(start, end);
  const now = Date.now();

  // Check in-memory cache
  if (cache.has(cacheKey)) {
    const cachedEntry = cache.get(cacheKey);
    if (now - cachedEntry.timestamp < CACHE_TTL_MS) {
      return cachedEntry.data;
    }
    cache.delete(cacheKey);
  }

  // If ORS_API_KEY is not configured
  if (!env.ORS_API_KEY) {
    if (env.MOCK_MODE) {
      const mockRoutes = generateMockRoutes(start, end);
      cache.set(cacheKey, { timestamp: now, data: mockRoutes });
      return mockRoutes;
    }
    const err = new Error('OpenRouteService API key is missing. Set ORS_API_KEY in .env or set MOCK_MODE=true.');
    err.status = 503;
    throw err;
  }

  // Live OpenRouteService API request
  const url = 'https://api.openrouteservice.org/v2/directions/foot-walking/geojson';
  const bodyPayload = {
    coordinates: [
      [start.lng, start.lat],
      [end.lng, end.lat]
    ],
    alternative_routes: {
      target_count: 3,
      weight_factor: 1.4,
      share_factor: 0.6
    },
    extra_info: ['waytype']
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': env.ORS_API_KEY,
        'Content-Type': 'application/json',
        'Accept': 'application/json, application/geo+json'
      },
      body: JSON.stringify(bodyPayload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`ORS API error [${response.status}]:`, errorText);
      const err = new Error(`OpenRouteService routing error: ${response.statusText}`);
      err.status = response.status >= 500 ? 502 : 400;
      throw err;
    }

    const geojson = await response.json();
    const routes = geojson.features || [];

    // Cache results for 5 minutes
    cache.set(cacheKey, { timestamp: now, data: routes });

    return routes;
  } catch (err) {
    // If live call fails and MOCK_MODE is enabled as fallback
    if (env.MOCK_MODE) {
      console.warn(`ORS request failed (${err.message}). Falling back to mock routes.`);
      const mockRoutes = generateMockRoutes(start, end);
      cache.set(cacheKey, { timestamp: now, data: mockRoutes });
      return mockRoutes;
    }
    throw err;
  }
}
