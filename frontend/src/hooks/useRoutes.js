import { useState, useCallback, useRef } from 'react';
import { getWalkingRoutes } from '../services/routing.js';
import { fetchPlacesForRoute } from '../services/places.js';
import { scoreRoute } from '../utils/safetyScoring.js';
import { isBackendConfigured, fetchBackendSafeRoutes } from '../services/backendApi.js';

/**
 * Hook to manage route search, safety scoring, independent loading states, and route selection.
 *
 * Execution flow:
 *
 * ── With backend configured (VITE_API_BASE_URL set) ──────────────────────────
 * 1. Call POST /api/routes/safe — backend fetches ORS routes + runs PostGIS safety scoring.
 * 2. Immediately display scored routes. No Overpass phase needed.
 * 3. If backend fails, fall through to the client-side path below.
 *
 * ── Client-side fallback (no backend / backend unavailable) ──────────────────
 * 1. Fetch pedestrian routes via ORS / OSM Routed-Foot / OSRM.
 * 2. Immediately display route geometry so the map renders at once.
 * 3. Fetch safety data (Overpass) in the background without blocking the map.
 * 4. Calculate safety scores progressively when data arrives.
 * 5. If safety data fails, routes remain fully visible with baseline scores.
 */
export function useRoutes() {
  const [routes, setRoutes] = useState([]);
  const [scoredRoutes, setScoredRoutes] = useState([]);
  const [selectedRouteIdx, setSelectedRouteIdx] = useState(0);

  // Separate fine-grained loading states
  const [routeLoading, setRouteLoading] = useState(false);
  const [safetyLoading, setSafetyLoading] = useState(false);
  const [searchState, setSearchState] = useState('idle');
  // searchState: 'idle' | 'finding_routes' | 'loading_places' | 'calculating_scores' | 'complete' | 'safety_failed'

  const [routeError, setRouteError] = useState(null);
  const [safetyError, setSafetyError] = useState(null);
  const [nearbyPlaces, setNearbyPlaces] = useState([]);

  // Track which route disclaimer came from
  const [routeDisclaimer, setRouteDisclaimer] = useState(null);

  const activeSearchIdRef = useRef(0);
  const safetyAbortControllerRef = useRef(null);

  /**
   * Search for walking routes and score them.
   */
  const searchRoutes = useCallback(async (start, end, departureTime = new Date()) => {
    if (!start || !end) return null;

    const currentSearchId = ++activeSearchIdRef.current;

    // Abort any in-flight safety query
    if (safetyAbortControllerRef.current) {
      safetyAbortControllerRef.current.abort();
    }
    const safetyController = new AbortController();
    safetyAbortControllerRef.current = safetyController;

    // Reset state
    setRouteLoading(true);
    setSafetyLoading(false);
    setSearchState('finding_routes');
    setRouteError(null);
    setSafetyError(null);
    setRoutes([]);
    setScoredRoutes([]);
    setNearbyPlaces([]);
    setRouteDisclaimer(null);

    // ── BACKEND PATH: Try backend safe-route endpoint first ────────────────
    if (isBackendConfigured()) {
      try {
        const departAt = departureTime instanceof Date ? departureTime.toISOString() : departureTime;
        const result = await fetchBackendSafeRoutes({
          start: { lat: start.lat, lng: start.lon ?? start.lng },
          end:   { lat: end.lat,   lng: end.lon   ?? end.lng   },
          departAt,
          mode: 'safest',
          signal: safetyController.signal,
        });

        if (currentSearchId !== activeSearchIdRef.current) return null;

        if (!result.routes || result.routes.length === 0) {
          throw new Error('No routes returned by the backend.');
        }

        // Backend already scored all routes — display immediately, no Overpass phase
        setRoutes(result.routes);
        setScoredRoutes(result.scoredRoutes);
        setSelectedRouteIdx(0);
        setRouteDisclaimer(result.disclaimer || null);
        setRouteLoading(false);
        setSearchState('complete');

        return { routes: result.routes, source: 'backend' };
      } catch (backendErr) {
        if (currentSearchId !== activeSearchIdRef.current) return null;
        if (backendErr.name === 'AbortError' || safetyController.signal.aborted) return null;

        // Backend failed — log and fall through to client-side routing
        console.warn('[useRoutes] Backend route calculation failed, falling back to client-side routing:', backendErr.message);
        // Don't set routeError yet — give client-side a chance
      }
    }

    // ── CLIENT-SIDE FALLBACK PATH ──────────────────────────────────────────
    let rawRoutes = [];

    // Phase 1: Fetch routes (~200-400ms)
    try {
      rawRoutes = await getWalkingRoutes(
        [start.lat, start.lon],
        [end.lat, end.lon]
      );

      if (currentSearchId !== activeSearchIdRef.current) return null;

      if (!rawRoutes || rawRoutes.length === 0) {
        throw new Error('No walking routes found between these locations.');
      }

      // Display routes immediately — don't wait for safety data
      setRoutes(rawRoutes);
      setSelectedRouteIdx(0);
      setRouteLoading(false);
      setSearchState('loading_places');
      setSafetyLoading(true);
    } catch (err) {
      if (currentSearchId !== activeSearchIdRef.current) return null;
      setRouteError(err.message || 'Could not find a walking route. Please check your start and destination.');
      setRouteLoading(false);
      setSearchState('idle');
      return null;
    }

    // Phase 2: Fetch safety data in background (non-blocking)
    try {
      const allCoords = rawRoutes.flatMap(r => r.coordinates || []);
      const places = await fetchPlacesForRoute(
        allCoords.length > 0 ? allCoords : rawRoutes[0].coordinates,
        400,
        { signal: safetyController.signal }
      );

      if (currentSearchId !== activeSearchIdRef.current || safetyController.signal.aborted) {
        return null;
      }

      setNearbyPlaces(places);
      setSearchState('calculating_scores');

      // Phase 3: Calculate safety scores
      const scored = rawRoutes.map((route) =>
        scoreRoute({
          coordinates: route.coordinates,
          nearbyPlaces: places,
          departureTime,
        })
      );

      if (currentSearchId !== activeSearchIdRef.current || safetyController.signal.aborted) {
        return null;
      }

      setScoredRoutes(scored);
      setSafetyLoading(false);
      setSearchState('complete');
    } catch (placeErr) {
      if (currentSearchId !== activeSearchIdRef.current || safetyController.signal.aborted || placeErr.name === 'AbortError') {
        return null;
      }

      console.warn('Safety data retrieval failed or timed out:', placeErr.message);

      // Graceful fallback: score with empty places dataset
      const fallbackScored = rawRoutes.map((route) =>
        scoreRoute({
          coordinates: route.coordinates,
          nearbyPlaces: [],
          departureTime,
        })
      );

      setScoredRoutes(fallbackScored);
      setSafetyError('Live safety data unavailable (Overpass service busy). Showing route geometry.');
      setSafetyLoading(false);
      setSearchState('safety_failed');
    }

    return { routes: rawRoutes, source: 'client' };
  }, []);

  /**
   * Re-score existing routes in-memory when departure time changes.
   * Only applies to client-side scored routes (backend scores are fixed at request time).
   */
  const rescoreRoutes = useCallback((departureTime) => {
    if (routes.length === 0) return;
    // Don't re-score backend routes — they're already authoritative
    if (routes[0]?.source === 'backend') return;
    const scored = routes.map((route) =>
      scoreRoute({
        coordinates: route.coordinates,
        nearbyPlaces,
        departureTime,
      })
    );
    setScoredRoutes(scored);
  }, [routes, nearbyPlaces]);

  /** Safest route index (highest safety score) */
  const safestRouteIdx = scoredRoutes.length > 0
    ? scoredRoutes.reduce((best, r, i) => (r?.overall?.score || 0) > (scoredRoutes[best]?.overall?.score || 0) ? i : best, 0)
    : 0;

  /** Fastest route index (lowest walking duration) */
  const fastestRouteIdx = routes.length > 0
    ? routes.reduce((best, r, i) => r.duration < routes[best].duration ? i : best, 0)
    : 0;

  const selectedRoute = routes[selectedRouteIdx] || null;
  const selectedScore = scoredRoutes[selectedRouteIdx] || null;

  return {
    routes,
    scoredRoutes,
    selectedRouteIdx,
    setSelectedRouteIdx,
    selectedRoute,
    selectedScore,
    safestRouteIdx,
    fastestRouteIdx,
    // Loading states
    loading: routeLoading, // Backward-compatibility alias
    routeLoading,
    safetyLoading,
    searchState,
    // Errors
    error: routeError,
    routeError,
    safetyError,
    // Data
    nearbyPlaces,
    routeDisclaimer,
    // Actions
    searchRoutes,
    rescoreRoutes,
    clearRoutes: () => {
      activeSearchIdRef.current++;
      if (safetyAbortControllerRef.current) {
        safetyAbortControllerRef.current.abort();
      }
      setRoutes([]);
      setScoredRoutes([]);
      setRouteError(null);
      setSafetyError(null);
      setRouteDisclaimer(null);
      setSearchState('idle');
    },
  };
}
