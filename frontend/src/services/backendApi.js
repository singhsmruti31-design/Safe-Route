/**
 * Safe Route — Backend API Client
 *
 * Centralized client for the Safe Route Express backend at VITE_API_BASE_URL.
 * All functions are strictly typed against the confirmed backend response shapes.
 *
 * Implemented endpoints:
 *   GET  /api/health
 *   GET  /api/places
 *   GET  /api/safe-spots/nearest
 *   POST /api/routes/safe
 *
 * Not yet implemented in the backend (use local fallbacks):
 *   Auth, User profiles, Emergency contacts, Saved routes
 */

/** Base URL from environment or production Render fallback. Trailing slash stripped. */
export function getBackendBaseUrl() {
  const envUrl = (import.meta.env.VITE_API_BASE_URL || '').trim();
  if (!envUrl || (import.meta.env.PROD && (envUrl.includes('localhost') || envUrl.includes('127.0.0.1')))) {
    return 'https://safe-route-backend-e5zu.onrender.com';
  }
  return envUrl.replace(/\/$/, '');
}

/** Default request timeout in milliseconds */
const DEFAULT_TIMEOUT_MS = 10000;

/**
 * Returns true if VITE_API_BASE_URL is configured.
 */
export function isBackendConfigured() {
  return Boolean(getBackendBaseUrl());
}

/**
 * Core fetch helper — adds timeout, JSON parsing, and structured errors.
 *
 * @param {string} path  Relative API path, e.g. '/api/health'
 * @param {object} options fetch options + optional timeoutMs
 * @returns {Promise<any>} Parsed JSON response body
 */
async function backendFetch(path, { timeoutMs = DEFAULT_TIMEOUT_MS, signal: callerSignal, ...fetchOptions } = {}) {
  const baseUrl = getBackendBaseUrl();
  if (!baseUrl) {
    const err = new Error('Backend API is not configured. Set VITE_API_BASE_URL in your .env file.');
    err.code = 'BACKEND_NOT_CONFIGURED';
    throw err;
  }

  const controller = new AbortController();

  // Forward caller abort signal
  if (callerSignal) {
    if (callerSignal.aborted) throw new DOMException('Request cancelled', 'AbortError');
    const onParentAbort = () => controller.abort(callerSignal.reason);
    callerSignal.addEventListener('abort', onParentAbort, { once: true });
  }

  const timeoutId = setTimeout(() => controller.abort(new DOMException('Request timed out', 'TimeoutError')), timeoutMs);

  try {
    const response = await fetch(`${baseUrl}${path}`, {
      ...fetchOptions,
      headers: {
        Accept: 'application/json',
        ...(fetchOptions.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(fetchOptions.headers || {}),
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    // Parse body
    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error(`Backend returned non-JSON response (HTTP ${response.status}).`);
    }

    if (!response.ok) {
      const msg = data?.error || data?.message || `Backend error (HTTP ${response.status})`;
      const err = new Error(msg);
      err.status = response.status;
      err.details = data;
      throw err;
    }

    return data;
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}

// ─── Normalisation helpers ────────────────────────────────────────────────────

/**
 * Normalise a backend place object to the shape the frontend expects.
 *
 * Backend shape:  { id, osm_id, type, name, coordinates:{lat,lng}, distance_meters, is_24_7, is_open, opening_hours }
 * Frontend shape: { id, osmId, category, name, lat, lon, distance, tags:{opening_hours, phone}, is_24_7, is_open }
 *
 * Type mapping: backend 'shop24' → frontend 'shop'; 'atm' → 'atm' (kept as-is but no frontend icon — will render as 'other')
 */
export function normalisePlaceFromBackend(place) {
  const BACKEND_TO_FRONTEND_TYPE = {
    police:   'police',
    hospital: 'hospital',
    pharmacy: 'pharmacy',
    fuel:     'fuel',
    shop24:   'shop',
    atm:      'atm',
  };

  const category = BACKEND_TO_FRONTEND_TYPE[place.type] || place.type || 'other';

  return {
    // Identity
    id:          `backend_${place.id}`,          // Prefix to avoid ID collisions with Overpass results
    osmId:       place.osm_id || null,
    backendId:   place.id,
    // Location (frontend uses lat/lon with 'n', not 'ng')
    lat:         place.coordinates?.lat ?? null,
    lon:         place.coordinates?.lng ?? null,  // Backend uses 'lng', frontend uses 'lon'
    // Categorisation
    category,
    type:        place.type,                      // Original backend type
    name:        place.name || `Unnamed ${category}`,
    // Status
    distance_meters: place.distance_meters || 0,
    is_24_7:     Boolean(place.is_24_7),
    is_open:     Boolean(place.is_open),
    // Compatibility: build a minimal `tags` object so MapView/NearbyHelp render correctly
    tags: {
      opening_hours: place.opening_hours || (place.is_24_7 ? '24/7' : null),
    },
    // Data source marker
    source: 'backend',
  };
}

/**
 * Normalise a backend route to the shape frontend hooks / components expect.
 *
 * Backend geometry coordinates are [lng, lat] (GeoJSON) → convert to [lat, lon] (Leaflet).
 * Backend provides a pre-calculated `score` and `level` → synthesise a `scoredRoute` object.
 */
export function normaliseRouteFromBackend(route, index) {
  // GeoJSON coordinates are [longitude, latitude] — flip to [latitude, longitude] for Leaflet
  const coordinates = (route.geometry?.coordinates || []).map(([lng, lat]) => [lat, lng]);

  const score = typeof route.score === 'number' ? route.score : null;

  // Map backend level ('green'|'yellow'|'red') to frontend safetyCategory format
  const LEVEL_TO_CATEGORY = { green: 'high', yellow: 'medium', red: 'low' };

  const scoredRoute = score !== null
    ? {
       overall: {
  score,
  confidence: 0,
  level: LEVEL_TO_CATEGORY[route.level] || 'medium',
},
insufficient: true,
        source: 'backend',
        disclaimer: route.disclaimer,
        weakestSegment: route.weakestSegment || null,
        // Expose raw segments for advanced UI if needed
        segments: route.segments || [],
      }
    : null;

  return {
    // Routing fields
    id:           `backend_route_${route.id || index}`,
    index,
    distance:     route.distance || 0,   // metres
    duration:     route.duration || 0,   // seconds (already pedestrian-corrected by backend)
    coordinates,
    provider:     'Safe Route Backend (mock routes)',
    profile:      'pedestrian',
    // Backend extras
    backendId:    route.id,
    extraMinutesVsFastest: route.extraMinutesVsFastest || 0,
    // Attach pre-calculated score (used to skip Overpass safety phase)
    _backendScore: scoredRoute,
    source:       'backend',
  };
}

// ─── API Functions ────────────────────────────────────────────────────────────

/**
 * GET /api/health
 * Check backend server status, database connectivity, and feature flags.
 *
 * @returns {Promise<{ status: string, mockMode: boolean, database: object, features: object }>}
 */
export async function checkBackendHealth() {
  return backendFetch('/api/health', { timeoutMs: 15000 });
}

/**
 * GET /api/places
 * Fetch nearby safety-relevant places from the backend.
 *
 * @param {object} params
 * @param {number} params.lat
 * @param {number} params.lng  Note: backend uses 'lng', not 'lon'
 * @param {number} [params.radius=1000]  Radius in metres (10–25000)
 * @param {string[]} [params.types=[]]   Allowed: ['police','hospital','pharmacy','fuel','shop24','atm']
 * @param {string} [params.at]           ISO-8601 datetime for opening-hours evaluation
 * @param {AbortSignal} [params.signal]
 * @returns {Promise<Array>} Array of normalised place objects
 */
export async function fetchBackendPlaces({ lat, lng, radius = 1000, types = [], at, signal } = {}) {
  const params = new URLSearchParams({ lat, lng, radius });
  if (types && types.length > 0) {
    // Backend only supports: police, hospital, pharmacy, fuel, shop24, atm
    const BACKEND_SUPPORTED_TYPES = ['police', 'hospital', 'pharmacy', 'fuel', 'shop24', 'atm'];
    // Map frontend type 'shop' → 'shop24'
    const mappedTypes = types
      .map(t => (t === 'shop' ? 'shop24' : t))
      .filter(t => BACKEND_SUPPORTED_TYPES.includes(t));
    if (mappedTypes.length > 0) params.set('types', mappedTypes.join(','));
  }
  if (at) params.set('at', at);

  const data = await backendFetch(`/api/places?${params}`, { signal });
  const places = (data.places || []).map(normalisePlaceFromBackend);

  return {
    places,
    count: data.count || places.length,
    evaluatedAt: data.evaluatedAt,
    isMock: true, // Currently always mock — update when live DB connected
  };
}

/**
 * GET /api/safe-spots/nearest
 * Find the nearest open safe spots (police, hospital, 24/7 shop, fuel) and a walking route to the closest.
 *
 * @param {object} params
 * @param {number} params.lat
 * @param {number} params.lng
 * @param {string} [params.departAt]  ISO-8601 datetime
 * @param {AbortSignal} [params.signal]
 * @returns {Promise<{ nearestSafeSpots: Array, routeToClosest: object|null, evaluatedAt: string, count: number }>}
 */
export async function fetchBackendNearestSafeSpots({ lat, lng, departAt, signal } = {}) {
  const params = new URLSearchParams({ lat, lng });
  if (departAt) params.set('departAt', departAt);

  const data = await backendFetch(`/api/safe-spots/nearest?${params}`, { signal });

  return {
    nearestSafeSpots: (data.nearestSafeSpots || []).map(normalisePlaceFromBackend),
    routeToClosest: data.routeToClosest || null,
    evaluatedAt: data.evaluatedAt,
    count: data.count || 0,
  };
}

/**
 * POST /api/routes/safe
 * Calculate and score alternative pedestrian walking routes via the backend.
 *
 * With MOCK_MODE=true and no ORS_API_KEY configured, the backend generates
 * geometrically simplified mock routes with in-memory safety scoring.
 *
 * @param {object} params
 * @param {{ lat: number, lng: number }} params.start
 * @param {{ lat: number, lng: number }} params.end
 * @param {string} [params.departAt]  ISO-8601 datetime
 * @param {'safest'|'fastest'} [params.mode='safest']
 * @param {AbortSignal} [params.signal]
 * @returns {Promise<{ routes: Array, scoredRoutes: Array, mode: string, disclaimer: string, isMock: boolean }>}
 */
export async function fetchBackendSafeRoutes({ start, end, departAt, mode = 'safest', signal } = {}) {
  const body = {
    start: { lat: start.lat, lng: start.lng ?? start.lon },
    end:   { lat: end.lat,   lng: end.lng   ?? end.lon   },
    mode,
  };
  if (departAt) body.departAt = departAt instanceof Date ? departAt.toISOString() : departAt;

  const data = await backendFetch('/api/routes/safe', {
    method: 'POST',
    body:   JSON.stringify(body),
    signal,
    timeoutMs: 15000,
  });

  const routes = (data.routes || []).map((r, i) => normaliseRouteFromBackend(r, i));
  // Extract pre-scored routes (each route carries its _backendScore)
  const scoredRoutes = routes.map(r => r._backendScore);

  return {
    routes,
    scoredRoutes,
    mode: data.mode || mode,
    disclaimer: data.disclaimer || '',
    routesCount: data.routesCount || routes.length,
    evaluatedAt: data.evaluatedAt,
    isMock: true, // MOCK_MODE=true — update when ORS key is set
  };
}

