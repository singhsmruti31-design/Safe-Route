/**
 * Places service — backend-first, Overpass fallback.
 *
 * Priority:
 *   1. Safe Route Backend (GET /api/places) — if VITE_API_BASE_URL is configured.
 *      Uses the backend's in-memory mock dataset in MOCK_MODE, or PostGIS with a live DB.
 *   2. Overpass API (OSM) — multi-server fallback with caching when backend is unavailable.
 *
 * Reliability Features:
 * - Backend-first routing avoids Overpass rate limits.
 * - Persistent 15-minute LRU caching in localStorage for Overpass results.
 * - In-flight deduplication prevents concurrent duplicate requests.
 * - Sensible timeouts (20s) with exponential backoff on HTTP 429.
 * - Proper AbortSignal lifecycle without spurious abort errors.
 *
 * Docs: https://wiki.openstreetmap.org/wiki/Overpass_API
 */

import { OVERPASS_URL } from '../data/scoringWeights.js';
import { getCachedPlaces, setCachedPlaces } from '../utils/storage.js';
import { haversine } from '../utils/distance.js';
import { isBackendConfigured, fetchBackendPlaces } from './backendApi.js';

/** Categories of places to fetch */
export const PLACE_CATEGORIES = {
  police:    { label: 'Police Station', icon: '🚔', query: 'amenity=police' },
  hospital:  { label: 'Hospital',       icon: '🏥', query: 'amenity=hospital' },
  clinic:    { label: 'Clinic/Doctors', icon: '🩺', query: 'amenity=clinic|amenity=doctors' },
  ambulance: { label: 'Ambulance',      icon: '🚑', query: 'emergency=ambulance|amenity=ambulance_station' },
  pharmacy:  { label: 'Pharmacy',       icon: '💊', query: 'amenity=pharmacy' },
  fuel:      { label: 'Petrol Pump',    icon: '⛽', query: 'amenity=fuel' },
  shop:      { label: 'Shop',           icon: '🛍️', query: 'shop' },
  shop24:    { label: '24/7 Shop',      icon: '🏪', query: 'shop' },   // Backend type — rendered in NearbyHelp/MapView
  atm:       { label: 'ATM',            icon: '🏧', query: 'amenity=atm' }, // Backend type
  restaurant:{ label: 'Restaurant',     icon: '🍽️', query: 'amenity=restaurant' },
  cafe:      { label: 'Café',           icon: '☕', query: 'amenity=cafe' },
};

/**
 * Public Overpass endpoints prioritized by reliability.
 * If the primary server is busy, rate-limited, or down, requests automatically failover.
 */
const DEFAULT_OVERPASS_ENDPOINTS = [
  import.meta.env?.VITE_OVERPASS_API_URL || OVERPASS_URL || 'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
].filter(Boolean);

export const OVERPASS_ENDPOINTS = Array.from(new Set(DEFAULT_OVERPASS_ENDPOINTS));

/** In-flight request promise cache to deduplicate simultaneous requests */
const inFlightRequests = new Map();

/**
 * Execute an Overpass QL query with:
 * - Multi-endpoint failover
 * - Exponential backoff on HTTP 429 (rate-limited)
 * - Sensible 20s per-endpoint timeout
 * - Clean integration with caller's AbortSignal
 *
 * @param {string} query
 * @param {object} [options]
 * @param {AbortSignal} [options.signal]
 * @param {number} [options.timeoutMs=20000]
 * @returns {Promise<Array>} Array of raw OSM elements
 */
async function executeOverpassQuery(query, { signal, timeoutMs = 20000 } = {}) {
  if (signal?.aborted) {
    throw new DOMException('Request cancelled', 'AbortError');
  }

  let lastError = null;

  for (let i = 0; i < OVERPASS_ENDPOINTS.length; i++) {
    if (signal?.aborted) {
      throw new DOMException('Request cancelled', 'AbortError');
    }

    const endpoint = OVERPASS_ENDPOINTS[i];
    const internalController = new AbortController();
    let isTimeout = false;

    // Timeout timer for this individual server attempt
    const timeoutId = setTimeout(() => {
      isTimeout = true;
      internalController.abort(new DOMException(`Request timed out after ${timeoutMs}ms`, 'TimeoutError'));
    }, timeoutMs);

    // Forward parent abort event to internalController
    const onParentAbort = () => {
      clearTimeout(timeoutId);
      internalController.abort(signal.reason || new DOMException('Request cancelled', 'AbortError'));
    };

    if (signal) {
      signal.addEventListener('abort', onParentAbort, { once: true });
    }

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        body: `data=${encodeURIComponent(query)}`,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json',
        },
        signal: internalController.signal,
      });

      clearTimeout(timeoutId);
      if (signal) {
        signal.removeEventListener('abort', onParentAbort);
      }

      // Handle 429 Too Many Requests with exponential backoff before fallback
      if (response.status === 429) {
        console.warn(`Overpass mirror ${endpoint} rate-limited (HTTP 429). Trying fallback mirror...`);
        lastError = new Error(`Overpass service busy (HTTP 429 at ${endpoint})`);
        await new Promise((r) => setTimeout(r, Math.min(800 * Math.pow(2, i), 2500)));
        continue;
      }

      // Handle 5xx server errors
      if (response.status >= 500) {
        console.warn(`Overpass mirror ${endpoint} returned server error ${response.status}. Trying fallback...`);
        lastError = new Error(`Overpass server error (${response.status})`);
        continue;
      }

      if (!response.ok) {
        console.warn(`Overpass mirror ${endpoint} returned HTTP ${response.status}`);
        lastError = new Error(`Overpass server returned HTTP ${response.status}`);
        continue;
      }

      const text = await response.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (parseErr) {
        console.warn(`Malformed JSON from ${endpoint}:`, parseErr.message);
        lastError = new Error('Received malformed response from Overpass server');
        continue;
      }

      // Check for Overpass runtime remark errors inside 200 responses
      if (data.remark && (data.remark.includes('runtime error') || data.remark.includes('Query timed out'))) {
        console.warn(`Overpass runtime remark from ${endpoint}: ${data.remark}`);
        lastError = new Error(data.remark);
        continue;
      }

      return data.elements || [];
    } catch (err) {
      clearTimeout(timeoutId);
      if (signal) {
        signal.removeEventListener('abort', onParentAbort);
      }

      // If the caller cancelled the overall operation, do not attempt fallback servers
      if (signal?.aborted) {
        throw new DOMException('Request cancelled', 'AbortError');
      }

      if (isTimeout) {
        console.warn(`Overpass mirror ${endpoint} timed out after ${timeoutMs}ms. Trying fallback...`);
        lastError = new Error(`Request to ${endpoint} timed out`);
      } else {
        console.warn(`Overpass fetch failed for mirror ${endpoint}:`, err.message);
        lastError = err;
      }
    }
  }

  throw lastError || new Error('All OpenStreetMap Overpass servers are currently unreachable. Please try again.');
}

/**
 * Build an Overpass QL query to fetch multiple amenity categories for a single point.
 */
function buildQuery(lat, lon, radiusM, categories) {
  const amenities = categories.filter(c => c !== 'shop');
  const hasShop = categories.includes('shop');

  const nodeLines = amenities.flatMap(cat => {
    const cfg = PLACE_CATEGORIES[cat];
    if (!cfg) return [];
    if (cfg.query.includes('|')) {
      return cfg.query.split('|').map(q => `node[${q}](around:${radiusM},${lat},${lon});`);
    }
    return [`node[${cfg.query}](around:${radiusM},${lat},${lon});`];
  });

  const wayLines = amenities.flatMap(cat => {
    const cfg = PLACE_CATEGORIES[cat];
    if (!cfg) return [];
    if (cfg.query.includes('|')) {
      return cfg.query.split('|').map(q => `way[${q}](around:${radiusM},${lat},${lon});`);
    }
    return [`way[${cfg.query}](around:${radiusM},${lat},${lon});`];
  });

  const shopNode = hasShop ? `node[shop](around:${radiusM},${lat},${lon});` : '';
  const shopWay  = hasShop ? `way[shop](around:${radiusM},${lat},${lon});` : '';

  return `
[out:json][timeout:25];
(
  ${nodeLines.join('\n  ')}
  ${wayLines.join('\n  ')}
  ${shopNode}
  ${shopWay}
);
out center;
`.trim();
}

/**
 * Fetch nearby places around a single location.
 *
 * If VITE_API_BASE_URL is configured, tries the backend first (GET /api/places),
 * then falls back to Overpass API. Backend places are clearly marked with source:'backend'.
 *
 * @param {number} lat
 * @param {number} lon   Note: this function uses 'lon' (frontend convention)
 * @param {number} radiusM
 * @param {string[]} categories  Keys from PLACE_CATEGORIES
 * @param {object} [options]
 * @param {AbortSignal} [options.signal]
 * @param {number} [options.timeoutMs]
 * @param {boolean} [options.skipBackend]  Set true to force Overpass directly
 * @returns {Promise<Array>}
 */
export async function fetchNearbyPlaces(
  lat,
  lon,
  radiusM = 500,
  categories = ['police', 'hospital', 'pharmacy', 'fuel'],
  options = {}
) {
  // ── Backend-first path ────────────────────────────────────────────────────
  if (isBackendConfigured() && !options.skipBackend) {
    try {
      const result = await fetchBackendPlaces({
        lat,
        lng: lon, // backend uses 'lng'
        radius: Math.min(Math.max(radiusM, 10), 25000),
        types: categories,
        signal: options.signal,
      });
      // If backend returned places, use them. Empty array is still a valid result.
      return result.places;
    } catch (err) {
      // Never suppress AbortError — the caller cancelled the request
      if (err.name === 'AbortError' || options.signal?.aborted) throw err;
      // Backend unavailable — fall through to Overpass
      console.warn('[places] Backend unavailable, falling back to Overpass:', err.message);
    }
  }
  const roundedLat = Math.round(lat * 100) / 100;
  const roundedLon = Math.round(lon * 100) / 100;
  const sortedCats = [...categories].sort().join(',');
  const cacheKey = `${roundedLat}_${roundedLon}_${radiusM}_${sortedCats}`;

  // 1. Check persistent localStorage cache
  const cached = getCachedPlaces(cacheKey);
  if (cached && Array.isArray(cached) && cached.length >= 0) {
    return cached;
  }

  // 2. Check in-flight promise cache to avoid duplicate concurrent requests
  if (inFlightRequests.has(cacheKey)) {
    return inFlightRequests.get(cacheKey);
  }

  // 3. Initiate new query
  const query = buildQuery(lat, lon, radiusM, categories);
  const promise = (async () => {
    try {
      const elements = await executeOverpassQuery(query, {
        signal: options.signal,
        timeoutMs: options.timeoutMs || 20000,
      });

      const places = elements
        .map((el) => {
          const pLat = el.lat || el.center?.lat;
          const pLon = el.lon || el.center?.lon;
          return {
            id: `${el.type}_${el.id}`,
            osmId: el.id,
            osmType: el.type,
            lat: pLat,
            lon: pLon,
            tags: el.tags || {},
            category: detectCategory(el.tags || {}),
            name: el.tags?.name || el.tags?.['name:en'] || categoryLabel(el.tags || {}),
          };
        })
        .filter((p) => p.lat && p.lon);

      setCachedPlaces(cacheKey, places);
      return places;
    } finally {
      inFlightRequests.delete(cacheKey);
    }
  })();

  inFlightRequests.set(cacheKey, promise);
  return promise;
}

/**
 * Fetch places for safety scoring along a route using a SINGLE Bounding Box (BBOX) query.
 * Replaces 5 sequential overlapping requests with 1 deduplicated, fast spatial query.
 *
 * @param {Array<[number,number]>} coordinates Route coordinates [[lat, lon], ...]
 * @param {number} bufferM Safety corridor buffer in metres around the route (default 400m)
 * @param {object} [options]
 * @param {AbortSignal} [options.signal]
 * @returns {Promise<Array>} Array of unique place objects along the route
 */
export async function fetchPlacesForRoute(coordinates, bufferM = 400, options = {}) {
  if (!coordinates || coordinates.length === 0) return [];

  // Calculate route bounding box
  let minLat = 90, maxLat = -90;
  let minLon = 180, maxLon = -180;
  for (const [lat, lon] of coordinates) {
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
    if (lon < minLon) minLon = lon;
    if (lon > maxLon) maxLon = lon;
  }

  // Convert buffer metres to degrees (~111,000m per degree latitude)
  const latBuffer = bufferM / 111000;
  const lonBuffer = bufferM / (111000 * Math.cos(((minLat + maxLat) / 2) * (Math.PI / 180)) || 1);

  const s = (minLat - latBuffer).toFixed(4);
  const w = (minLon - lonBuffer).toFixed(4);
  const n = (maxLat + latBuffer).toFixed(4);
  const e = (maxLon + lonBuffer).toFixed(4);

  const cacheKey = `route_bbox_${s}_${w}_${n}_${e}`;
  const cached = getCachedPlaces(cacheKey);
  if (cached && Array.isArray(cached)) return cached;

  if (inFlightRequests.has(cacheKey)) {
    return inFlightRequests.get(cacheKey);
  }

  // Single fast BBOX query targeting safety-relevant amenities and commercial shops
  const query = `
[out:json][timeout:25];
(
  node["amenity"~"police|hospital|clinic|doctors|pharmacy|fuel|restaurant|cafe|ambulance_station"](${s},${w},${n},${e});
  way["amenity"~"police|hospital|clinic|doctors|pharmacy|fuel|restaurant|cafe|ambulance_station"](${s},${w},${n},${e});
  node["emergency"="ambulance"](${s},${w},${n},${e});
  way["emergency"="ambulance"](${s},${w},${n},${e});
  node["shop"](${s},${w},${n},${e});
  way["shop"](${s},${w},${n},${e});
);
out center;
`.trim();

  const promise = (async () => {
    try {
      const elements = await executeOverpassQuery(query, {
        signal: options.signal,
        timeoutMs: options.timeoutMs || 22000,
      });

      const places = elements
        .map((el) => {
          const pLat = el.lat || el.center?.lat;
          const pLon = el.lon || el.center?.lon;
          return {
            id: `${el.type}_${el.id}`,
            osmId: el.id,
            osmType: el.type,
            lat: pLat,
            lon: pLon,
            tags: el.tags || {},
            category: detectCategory(el.tags || {}),
            name: el.tags?.name || el.tags?.['name:en'] || categoryLabel(el.tags || {}),
          };
        })
        .filter((p) => p.lat && p.lon);

      setCachedPlaces(cacheKey, places);
      return places;
    } catch (err) {
      if (options.signal?.aborted || err.name === 'AbortError') {
        throw err;
      }
      console.warn('Overpass fetch failed for route bbox:', err.message);
      return [];
    } finally {
      inFlightRequests.delete(cacheKey);
    }
  })();

  inFlightRequests.set(cacheKey, promise);
  return promise;
}

function detectCategory(tags) {
  if (tags.amenity === 'police') return 'police';
  if (tags.amenity === 'hospital') return 'hospital';
  if (tags.amenity === 'clinic' || tags.amenity === 'doctors') return 'clinic';
  if (tags.emergency === 'ambulance' || tags.amenity === 'ambulance_station') return 'ambulance';
  if (tags.amenity === 'pharmacy') return 'pharmacy';
  if (tags.amenity === 'fuel') return 'fuel';
  if (tags.amenity === 'restaurant') return 'restaurant';
  if (tags.amenity === 'cafe') return 'cafe';
  if (tags.shop) return 'shop';
  return 'other';
}

/**
 * OSM-listed phone only. Never invent a number.
 * Presence of a tag is not independent verification.
 */
export function getOsmPhone(place) {
  const tags = place?.tags || {};
  const raw = tags.phone || tags['contact:phone'] || tags['emergency:phone'] || tags['contact:mobile'];
  if (!raw || typeof raw !== 'string') return null;
  const cleaned = raw.trim();
  return cleaned || null;
}

export function getPlaceAddress(place) {
  const tags = place?.tags || {};
  if (tags['addr:full']) return tags['addr:full'];
  const parts = [
    tags['addr:housenumber'],
    tags['addr:street'],
    tags['addr:suburb'] || tags['addr:neighbourhood'],
    tags['addr:city'] || tags['addr:town'] || tags['addr:village'],
  ].filter(Boolean);
  return parts.length ? parts.join(', ') : null;
}

export function googleDirectionsUrl(lat, lon) {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}&travelmode=walking`;
}

function categoryLabel(tags) {
  const cat = detectCategory(tags);
  return PLACE_CATEGORIES[cat]?.label || 'Place';
}

/**
 * Sort places by distance from a point.
 */
export function sortByDistance(places, lat, lon) {
  return [...places].sort((a, b) => {
    const da = haversine([lat, lon], [a.lat, a.lon]);
    const db = haversine([lat, lon], [b.lat, b.lon]);
    return da - db;
  });
}

/**
 * Find the nearest police station or hospital.
 */
export function findNearestSafePlace(places, lat, lon) {
  const priority = places.filter(p => p.category === 'police' || p.category === 'hospital' || p.category === 'clinic');
  if (priority.length === 0) return null;
  return sortByDistance(priority, lat, lon)[0];
}
