/**
 * Pedestrian walking-route service for Safe Route.
 *
 * Routing Providers:
 * 1. OpenRouteService (ORS) — genuine foot-walking profile via GeoJSON API.
 *    Supports dedicated pedestrian paths, walkways, stairs, and parks.
 *    Requires free API key (VITE_ORS_API_KEY).
 * 2. OpenStreetMap Routed-Foot (FOSSGIS / OSM Germany) — genuine OSRM pedestrian
 *    foot.lua profile. Completely open and free, zero setup required.
 * 3. OSRM Demo Server (fallback) — used as last resort if public services are unreachable.
 */

import { ORS_DIRECTIONS_URL, ORS_API_KEY, OSM_FOOT_URL, OSRM_URL } from '../data/scoringWeights.js';
import { walkingTimeMinutes } from '../utils/distance.js';

/**
 * Decode an OSRM polyline6 encoded string to [[lat, lon], ...].
 */
export function decodePolyline(encoded, precision = 6) {
  const factor = Math.pow(10, precision);
  const result = [];
  let index = 0, lat = 0, lng = 0;

  while (index < encoded.length) {
    let shift = 0, result_chunk = 0, b;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result_chunk |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    lat += result_chunk & 1 ? ~(result_chunk >> 1) : result_chunk >> 1;

    shift = 0;
    result_chunk = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result_chunk |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    lng += result_chunk & 1 ? ~(result_chunk >> 1) : result_chunk >> 1;

    result.push([lat / factor, lng / factor]);
  }

  return result;
}

/**
 * Fetch pedestrian walking routes from OpenRouteService (ORS).
 * Requires API key configured via VITE_ORS_API_KEY.
 */
async function fetchORSPedestrianRoutes(start, end, apiKey) {
  const [sLat, sLon] = start;
  const [eLat, eLon] = end;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 7000);

  try {
    const response = await fetch(ORS_DIRECTIONS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': apiKey,
      },
      body: JSON.stringify({
        coordinates: [
          [sLon, sLat],
          [eLon, eLat],
        ],
        alternative_routes: {
          target_count: 2,
          weight_factor: 1.4,
          share_factor: 0.6,
        },
        instructions: false,
        preference: 'recommended',
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.status === 401 || response.status === 403) {
      throw new Error('OpenRouteService API key is invalid or unauthorized.');
    }
    if (response.status === 429) {
      throw new Error('OpenRouteService quota exceeded (2,000 requests/day limit reached).');
    }
    if (!response.ok) {
      throw new Error(`OpenRouteService HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    const features = data.features || [];
    if (features.length === 0) {
      throw new Error('No walking route returned by OpenRouteService.');
    }

    return features.map((feature, idx) => {
      // GeoJSON LineString coordinates are [lon, lat] -> convert to Leaflet [lat, lon]
      const rawCoords = feature.geometry?.coordinates || [];
      const coordinates = rawCoords.map(([lon, lat]) => [lat, lon]);
      const summary = feature.properties?.summary || {};

      return {
        id: `ors_route_${idx}`,
        index: idx,
        distance: Math.round(summary.distance || 0), // metres
        duration: Math.round(summary.duration || 0), // real walking seconds
        coordinates,
        provider: 'OpenRouteService (foot-walking)',
        profile: 'pedestrian',
      };
    });
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}

/**
 * Fetch genuine pedestrian walking routes from OpenStreetMap Routed-Foot.
 * Hosted by OSM Germany / FOSSGIS running the OSRM foot.lua pedestrian profile.
 * Free public endpoint, no API key required.
 */
async function fetchOSMPedestrianRoutes(start, end) {
  const [sLat, sLon] = start;
  const [eLat, eLon] = end;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 6000);

  const url = `${OSM_FOOT_URL}/${sLon},${sLat};${eLon},${eLat}?alternatives=true&geometries=polyline6&overview=full&steps=false&annotations=false`;

  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`OSM Pedestrian routing error: ${response.status}`);
    }

    const data = await response.json();
    if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
      throw new Error(`OSM Pedestrian routing returned code: ${data.code || 'None'}`);
    }

    return data.routes.map((route, idx) => ({
      id: `osm_foot_route_${idx}`,
      index: idx,
      distance: Math.round(route.distance), // metres
      duration: Math.round(route.duration), // real walking seconds (~4.5 km/h)
      coordinates: decodePolyline(route.geometry),
      provider: 'OpenStreetMap (routed-foot)',
      profile: 'pedestrian',
    }));
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}

/**
 * Fallback to public OSRM demo server if dedicated foot servers fail.
 * Recalculates duration using genuine pedestrian walking velocity (~4.8 km/h)
 * instead of car driving velocity.
 */
async function fetchOSRMWithWalkingVelocity(start, end) {
  const [sLat, sLon] = start;
  const [eLat, eLon] = end;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  const url = `${OSRM_URL}/${sLon},${sLat};${eLon},${eLat}?alternatives=true&geometries=polyline6&overview=full&steps=false&annotations=false`;

  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`OSRM demo server error: ${response.status}`);
    }

    const data = await response.json();
    if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
      throw new Error('No route found on fallback service.');
    }

    return data.routes.map((route, idx) => {
      const distance = Math.round(route.distance);
      // Average pedestrian walking speed: 4.8 km/h -> 80 m/min -> 1.33 m/s
      const walkingDurationSec = Math.round(walkingTimeMinutes(distance) * 60);

      return {
        id: `osrm_route_${idx}`,
        index: idx,
        distance,
        duration: walkingDurationSec, // Corrected pedestrian duration
        coordinates: decodePolyline(route.geometry),
        provider: 'OSRM (fallback, pedestrian duration)',
        profile: 'pedestrian',
      };
    });
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}

/**
 * Fetch genuine pedestrian walking routes.
 *
 * Selection priority:
 * 1. OpenRouteService foot-walking (if VITE_ORS_API_KEY is configured)
 * 2. OpenStreetMap routed-foot (public genuine pedestrian profile)
 * 3. OSRM fallback with pedestrian duration recalculation
 *
 * @param {[number,number]} start [lat, lon]
 * @param {[number,number]} end   [lat, lon]
 * @returns {Promise<Array>} Array of route objects
 */
export async function getWalkingRoutes(start, end) {
  let errors = [];

  // 1. Try OpenRouteService if API key is provided
  if (ORS_API_KEY) {
    try {
      const orsRoutes = await fetchORSPedestrianRoutes(start, end, ORS_API_KEY);
      if (orsRoutes && orsRoutes.length > 0) {
        return orsRoutes;
      }
    } catch (orsErr) {
      console.warn('OpenRouteService failed, falling back to OSM Foot:', orsErr.message);
      errors.push(`ORS: ${orsErr.message}`);
    }
  }

  // 2. Try OpenStreetMap genuine routed-foot pedestrian engine
  try {
    const osmFootRoutes = await fetchOSMPedestrianRoutes(start, end);
    if (osmFootRoutes && osmFootRoutes.length > 0) {
      return osmFootRoutes;
    }
  } catch (osmErr) {
    console.warn('OSM routed-foot failed, trying fallback OSRM:', osmErr.message);
    errors.push(`OSM Foot: ${osmErr.message}`);
  }

  // 3. Fallback to OSRM with pedestrian velocity recalculation
  try {
    const fallbackRoutes = await fetchOSRMWithWalkingVelocity(start, end);
    if (fallbackRoutes && fallbackRoutes.length > 0) {
      return fallbackRoutes;
    }
  } catch (fallbackErr) {
    errors.push(`OSRM: ${fallbackErr.message}`);
  }

  throw new Error(`Unable to find walking route: ${errors.join('; ')}`);
}

/**
 * Get a walking route to a specific nearby place (for nearest safe spot feature).
 */
export async function getRouteToPlace(start, destination) {
  return getWalkingRoutes(start, destination);
}
