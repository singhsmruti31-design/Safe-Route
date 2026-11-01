/**
 * Safety scoring weights configuration.
 * Adjust these values to change how each factor influences the score.
 */
export const SCORING_WEIGHTS = {
  streetLighting: 30,      // Street lighting availability (0-30 pts)
  openPlaces: 25,          // Open shops / public places nearby (0-25 pts)
  policeStations: 15,      // Nearby police stations (0-15 pts)
  publicActivity: 15,      // Public activity / foot traffic estimate (0-15 pts)
  hospitals: 10,           // Nearby hospitals (0-10 pts)
  userReports: 5,          // Local user reports (0-5 pts)
};

/** Maximum penalty for isolation / dead-end segments */
export const ISOLATION_PENALTY = 15;

/** Segment length in metres for route segmentation */
export const SEGMENT_LENGTH_M = 100;

/** Safety category thresholds */
export const SAFETY_THRESHOLDS = {
  good: 70,      // >= 70 → Green
  moderate: 40,  // 40-69 → Yellow
  // < 40 → Red
};

/** Radius in metres for nearby-place queries */
export const NEARBY_RADIUS_M = 500;

/** Minimum confidence threshold (0-1) to show a score */
export const MIN_CONFIDENCE = 0.3;

/** Overpass API endpoint */
export const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

/** OpenRouteService foot-walking endpoint */
export const ORS_DIRECTIONS_URL = 'https://api.openrouteservice.org/v2/directions/foot-walking/geojson';
export const ORS_API_KEY = import.meta.env?.VITE_ORS_API_KEY || '';

/** Genuine OpenStreetMap Pedestrian Foot routing endpoint (FOSSGIS / OSM Germany routed-foot) */
export const OSM_FOOT_URL = 'https://routing.openstreetmap.de/routed-foot/route/v1/driving';

/** Legacy OSRM fallback endpoint */
export const OSRM_URL = 'https://router.project-osrm.org/route/v1/foot';

/** Nominatim geocoding endpoint */
export const NOMINATIM_URL = 'https://nominatim.openstreetmap.org';

/** Default map centre (India) */
export const DEFAULT_MAP_CENTER = [20.5937, 78.9629];
export const DEFAULT_MAP_ZOOM = 5;

/** Debounce delay for search inputs in ms */
export const SEARCH_DEBOUNCE_MS = 500;
