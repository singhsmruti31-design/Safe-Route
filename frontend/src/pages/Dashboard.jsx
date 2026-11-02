import { useState, useCallback, useEffect, useRef } from 'react';
import {
  Navigation, MapPin, Crosshair, Clock, Layers, Shield,
  AlertTriangle, RefreshCw, ChevronDown, ChevronUp, Info, Loader2
} from 'lucide-react';
import { Link } from 'react-router-dom';

import MapView from '../components/MapView.jsx';
import SearchBox from '../components/SearchBox.jsx';
import RouteCard from '../components/RouteCard.jsx';
import SafetyScore from '../components/SafetyScore.jsx';
import SOSButton from '../components/SOSButton.jsx';
import BackendStatus from '../components/BackendStatus.jsx';

import { useGeolocation } from '../hooks/useGeolocation.js';
import { useRoutes } from '../hooks/useRoutes.js';
import { fetchNearbyPlaces, PLACE_CATEGORIES, sortByDistance, findNearestSafePlace } from '../services/places.js';
import { reverseGeocode } from '../services/geocoding.js';
import { getRouteToPlace } from '../services/routing.js';
import { haversine, formatDistance, walkingTimeMinutes } from '../utils/distance.js';
import { getPreferences, savePreferences } from '../utils/storage.js';
import { useAuth } from '../context/AuthContext.jsx';
import { saveRoute, savedRoutesRequireBackend } from '../services/savedRoutes.js';
import { isBackendConfigured, fetchBackendNearestSafeSpots } from '../services/backendApi.js';

const LAYER_OPTIONS = [
  { key: 'police',    label: 'Police',    icon: '🚔' },
  { key: 'hospital',  label: 'Hospitals', icon: '🏥' },
  { key: 'ambulance', label: 'Ambulance', icon: '🚑' },
  { key: 'pharmacy',  label: 'Pharmacy',  icon: '💊' },
  { key: 'fuel',      label: 'Petrol',    icon: '⛽' },
  { key: 'shop',      label: 'Shops',     icon: '🛍️' },
  { key: 'cafe',      label: 'Cafés',     icon: '☕' },
];

export default function Dashboard() {
  const { token } = useAuth();
  const { location: currentLocation, loading: gpsLoading, error: gpsError, getLocation, setLocation } = useGeolocation();
  const { routes, scoredRoutes, selectedRouteIdx, setSelectedRouteIdx, selectedRoute, selectedScore,
          safestRouteIdx, fastestRouteIdx, routeLoading, safetyLoading, searchState,
          routeError, safetyError, nearbyPlaces,
          searchRoutes, rescoreRoutes, clearRoutes } = useRoutes();

  const [startLocation, setStartLocation] = useState(null);
  const [endLocation, setEndLocation] = useState(null);
  // mapCenter / mapZoom used only for GPS fly-to; route fitting is handled by RoutesFitter in MapView
  const [mapCenter, setMapCenter] = useState(null);
  const [mapZoom, setMapZoom] = useState(13);

  // Departure time
  const [departureMode, setDepartureMode] = useState('now'); // 'now' | 'custom'
  const [customTime, setCustomTime] = useState(() => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
  });
  const [departureTime, setDepartureTime] = useState(new Date());

  // Layers
  const [visibleLayers, setVisibleLayers] = useState(() => {
    const prefs = getPreferences();
    const active = new Set();
    if (prefs.showPolice !== false) active.add('police');
    if (prefs.showHospitals !== false) active.add('hospital');
    if (prefs.showPharmacies) active.add('pharmacy');
    if (prefs.showPetrol) active.add('fuel');
    if (prefs.showShops) active.add('shop');
    return active;
  });
  const [showLayers, setShowLayers] = useState(false);
  const [allNearbyPlaces, setAllNearbyPlaces] = useState([]);
  const [placesLoading, setPlacesLoading] = useState(false);
  const [placesError, setPlacesError] = useState(null);

  // Nearest safe spot
  const [nearestSafePlace, setNearestSafePlace] = useState(null);
  const [routeToSafePlace, setRouteToSafePlace] = useState([]);
  const [safeSpotLoading, setSafeSpotLoading] = useState(false);
  const [safeSpotError, setSafeSpotError] = useState(null);

  // Sidebar collapse on mobile
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [saveStatus, setSaveStatus] = useState(''); // '' | 'saving' | 'saved' | 'error'

  // ── Get current GPS location ────────────────────────────────
  const handleGetLocation = async () => {
    const loc = await getLocation();
    if (loc) {
      setMapCenter([loc.lat, loc.lon]);
      setMapZoom(15);
      // Reverse geocode for display
      try {
        const addr = await reverseGeocode(loc.lat, loc.lon);
        setStartLocation({ ...addr, lat: loc.lat, lon: loc.lon });
      } catch {
        setStartLocation({ lat: loc.lat, lon: loc.lon, shortName: 'My Location', displayName: 'Current Location' });
      }
    }
  };

  // ── Departure time ──────────────────────────────────────────
  const handleDepartureModeChange = (mode) => {
    setDepartureMode(mode);
    const dt = mode === 'now' ? new Date() : buildCustomDate(customTime);
    setDepartureTime(dt);
    if (routes.length > 0) rescoreRoutes(dt);
  };

  const handleCustomTimeChange = (t) => {
    setCustomTime(t);
    const dt = buildCustomDate(t);
    setDepartureTime(dt);
    if (routes.length > 0) rescoreRoutes(dt);
  };

  const buildCustomDate = (timeStr) => {
    const [h, m] = timeStr.split(':').map(Number);
    const d = new Date();
    d.setHours(h, m, 0, 0);
    return d;
  };

  // ── Search routes ───────────────────────────────────────────
  const handleSearch = async () => {
    if (!startLocation || !endLocation) return;
    setNearestSafePlace(null);
    setRouteToSafePlace([]);
    try {
      // RoutesFitter in MapView automatically calls fitBounds when routes change,
      // so we no longer need to manually set mapCenter / mapZoom here.
      await searchRoutes(startLocation, endLocation, departureTime);
    } catch (err) {
      console.error('[Dashboard] handleSearch error:', err);
    }
  };

  // ── Load nearby places ──────────────────────────────────────
  const handleLoadNearbyPlaces = async () => {
    const refLoc = currentLocation || startLocation;
    if (!refLoc) {
      setPlacesError('Please detect your location or enter a start location first.');
      return;
    }
    setPlacesLoading(true);
    setPlacesError(null);
    try {
      const categories = Array.from(visibleLayers);
      const places = await fetchNearbyPlaces(refLoc.lat, refLoc.lon, 800, categories);
      setAllNearbyPlaces(places);
    } catch (err) {
      if (err.name === 'AbortError') return;
      setPlacesError(`Could not load nearby places: ${err.message}`);
    } finally {
      setPlacesLoading(false);
    }
  };

  // ── Toggle layer visibility ─────────────────────────────────
  const toggleLayer = (key) => {
    setVisibleLayers(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      // Save prefs
      savePreferences({
        showPolice: next.has('police'),
        showHospitals: next.has('hospital'),
        showPharmacies: next.has('pharmacy'),
        showPetrol: next.has('fuel'),
        showShops: next.has('shop'),
      });
      return next;
    });
  };

  // ── Find nearest safe spot ──────────────────────────────────
  const handleFindNearestSafe = async () => {
    const refLoc = currentLocation || startLocation;
    if (!refLoc) {
      setSafeSpotError('Please detect your GPS location first using the "Use my location" button.');
      return;
    }
    setSafeSpotLoading(true);
    setSafeSpotError(null);
    setNearestSafePlace(null);
    setRouteToSafePlace([]);
    try {
      // ── Backend path: GET /api/safe-spots/nearest ─────────────────────
      if (isBackendConfigured()) {
        try {
          const result = await fetchBackendNearestSafeSpots({
            lat: refLoc.lat,
            lng: refLoc.lon,
            departAt: departureTime instanceof Date ? departureTime.toISOString() : departureTime,
          });

          if (result.count === 0 || result.nearestSafeSpots.length === 0) {
            setSafeSpotError('No nearby open safe spots found within 10km (mock data).');
            return;
          }

          const nearest = result.nearestSafeSpots[0];
          const dist = nearest.distance_meters || haversine([refLoc.lat, refLoc.lon], [nearest.lat, nearest.lon]);
          const walkTime = walkingTimeMinutes(dist);
          setNearestSafePlace({ ...nearest, distance: dist, walkTime });

          // Use walking route geometry from backend if available
          if (result.routeToClosest?.geometry?.coordinates) {
            // Backend geometry is GeoJSON [lng, lat] — flip to Leaflet [lat, lon]
            const leafletCoords = result.routeToClosest.geometry.coordinates.map(([lng, lat]) => [lat, lng]);
            setRouteToSafePlace(leafletCoords);
          } else {
            // Fall back to client-side routing for the route line
            try {
              const routeRes = await getRouteToPlace([refLoc.lat, refLoc.lon], [nearest.lat, nearest.lon]);
              if (routeRes && routeRes.length > 0) setRouteToSafePlace(routeRes[0].coordinates);
            } catch { /* non-critical — marker still shows */ }
          }

          setMapCenter([nearest.lat, nearest.lon]);
          setMapZoom(15);
          return;
        } catch (backendErr) {
          if (backendErr.name === 'AbortError') return;
          console.warn('[Dashboard] Backend safe-spots failed, falling back to client-side:', backendErr.message);
          // Fall through to Overpass path
        }
      }

      // ── Client-side fallback: Overpass ────────────────────────────────
      let places = allNearbyPlaces;
      if (places.length === 0) {
        places = await fetchNearbyPlaces(refLoc.lat, refLoc.lon, 1000, ['police', 'hospital', 'clinic']);
        setAllNearbyPlaces(places);
      }
      const nearest = findNearestSafePlace(places, refLoc.lat, refLoc.lon);
      if (!nearest) {
        setSafeSpotError('No nearby police stations or hospitals found within 1km. Try expanding your search area.');
        return;
      }
      const dist = haversine([refLoc.lat, refLoc.lon], [nearest.lat, nearest.lon]);
      const walkTime = walkingTimeMinutes(dist);
      const safePlace = { ...nearest, distance: dist, walkTime };
      setNearestSafePlace(safePlace);

      // Get route to it
      const routeRes = await getRouteToPlace([refLoc.lat, refLoc.lon], [nearest.lat, nearest.lon]);
      if (routeRes && routeRes.length > 0) {
        setRouteToSafePlace(routeRes[0].coordinates);
      }

      setMapCenter([nearest.lat, nearest.lon]);
      setMapZoom(15);
    } catch (err) {
      if (err.name === 'AbortError') return;
      setSafeSpotError(`Could not find nearest safe spot: ${err.message}`);
    } finally {
      setSafeSpotLoading(false);
    }
  };

  const handleSaveRoute = async () => {
    if (!selectedRoute) return;
    setSaveStatus('saving');
    try {
      await saveRoute(token, {
        name: `${startLocation?.shortName || 'Start'} → ${endLocation?.shortName || 'End'}`,
        summary: `${formatDistance(selectedRoute.distance)} · ${Math.round(selectedRoute.duration / 60)} min walk`,
        distance: selectedRoute.distance,
        duration: selectedRoute.duration,
        provider: selectedRoute.provider || '',
        safetyScore: selectedScore?.overall?.score ?? null,
        coordinates: selectedRoute.coordinates,
      });
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus(''), 3000);
    } catch {
      setSaveStatus('error');
      setTimeout(() => setSaveStatus(''), 3000);
    }
  };

  // ── Combined places for map ─────────────────────────────────
  const mapPlaces = [
    ...nearbyPlaces,
    ...allNearbyPlaces.filter(p => !nearbyPlaces.find(q => q.id === p.id)),
  ];

  return (
    // Outer container fills viewport minus the sticky 64px navbar.
    // Using 100dvh (dynamic viewport height) prevents the grey strip caused by
    // the Android browser address bar showing/hiding during scroll.
    <div className="flex flex-col" style={{ height: 'calc(100dvh - 64px)' }}>
      {/* Mobile: toggle sidebar */}
      <div className="md:hidden flex items-center justify-between px-4 py-2 bg-white border-b border-border">
        <span className="text-sm font-semibold text-text-dark">Route Finder</span>
        <div className="flex items-center gap-2">
          <BackendStatus />
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="text-text-muted p-1">
            {sidebarOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/*
        Inner layout:
        - Mobile: flex-col — sidebar stacks ABOVE map so map always gets remaining height.
        - Desktop (md+): flex-row — sidebar is a fixed-width panel on the left.
      */}
      <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
        {/*
          Sidebar:
          - Mobile: when open, it shows as a scrollable panel with a capped height (~50% of
            remaining space) so the map is always visible below it. When closed, hidden.
          - Desktop: fixed 384px wide column (md:w-96), full height, always visible.
        */}
        <aside className={`${sidebarOpen ? 'flex' : 'hidden'} md:flex flex-col w-full md:w-96 bg-white border-b md:border-b-0 md:border-r border-border overflow-y-auto max-h-[50vh] md:max-h-full`}>
          <div className="p-4 space-y-4 flex-1">
            {/* Backend status indicator (desktop) */}
            <div className="hidden md:flex justify-end">
              <BackendStatus />
            </div>
            {/* Location search */}
            <div className="space-y-2">
              <SearchBox
                label="From"
                placeholder="Start location"
                value={startLocation}
                onChange={setStartLocation}
                onUseCurrentLocation={handleGetLocation}
                icon={Navigation}
              />
              <SearchBox
                label="To"
                placeholder="Destination"
                value={endLocation}
                onChange={setEndLocation}
                icon={MapPin}
              />
            </div>

            {/* GPS status */}
            {gpsLoading && (
              <div className="flex items-center gap-2 text-sm text-primary">
                <Loader2 className="w-4 h-4 animate-spin" /> Detecting location…
              </div>
            )}
            {gpsError && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-danger">
                {gpsError}
              </div>
            )}
            {currentLocation && !gpsLoading && (
              <div className="flex items-center gap-2 text-xs text-success bg-green-50 border border-green-200 rounded-xl px-3 py-2">
                <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
                GPS: ±{Math.round(currentLocation.accuracy || 0)} m accuracy
              </div>
            )}

            {/* Departure time */}
            <div className="card p-3 space-y-2">
              <p className="text-xs font-semibold text-text-muted uppercase tracking-wide flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" /> Departure Time
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => handleDepartureModeChange('now')}
                  className={`flex-1 text-xs font-medium py-1.5 rounded-lg border transition-all ${
                    departureMode === 'now' ? 'bg-primary text-white border-primary' : 'border-border text-text-muted hover:border-primary'
                  }`}
                >
                  Leave Now
                </button>
                <button
                  onClick={() => handleDepartureModeChange('custom')}
                  className={`flex-1 text-xs font-medium py-1.5 rounded-lg border transition-all ${
                    departureMode === 'custom' ? 'bg-primary text-white border-primary' : 'border-border text-text-muted hover:border-primary'
                  }`}
                >
                  Leave At
                </button>
              </div>
              {departureMode === 'custom' && (
                <input
                  type="time"
                  value={customTime}
                  onChange={e => handleCustomTimeChange(e.target.value)}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm text-text-dark outline-none focus:border-primary"
                />
              )}
            </div>

            {/* Search button */}
            <button
              onClick={handleSearch}
              disabled={!startLocation || !endLocation || routeLoading}
              className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              id="find-route-btn"
            >
              {routeLoading ? (
                <><span className="spinner" /> Finding walking routes…</>
              ) : (
                <><Navigation className="w-4 h-4" /> Find Safe Routes</>
              )}
            </button>

            {/* Route error */}
            {routeError && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-danger">
                {routeError}
              </div>
            )}

            {/* Safety loading status banner (Non-blocking) */}
            {safetyLoading && (
              <div className="bg-blue-50/80 border border-blue-100 rounded-xl px-3 py-2 text-xs text-primary flex items-center gap-2 animate-pulse">
                <Loader2 className="w-3.5 h-3.5 animate-spin flex-shrink-0" />
                <span>
                  {searchState === 'loading_places'
                    ? 'Loading geographical information (police, hospitals, open shops)…'
                    : 'Calculating safety scores…'}
                </span>
              </div>
            )}

            {/* Safety error fallback banner */}
            {safetyError && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-xs text-amber-800 flex items-center gap-2">
                <Info className="w-3.5 h-3.5 flex-shrink-0 text-amber-600" />
                <span>{safetyError}</span>
              </div>
            )}

            {/* Route cards */}
            {routes.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-text-muted uppercase tracking-wide">
                    {routes.length} walking route{routes.length > 1 ? 's' : ''} found
                  </p>
                  {safetyLoading && (
                    <span className="text-[11px] text-primary flex items-center gap-1 font-medium">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary animate-ping" />
                      Scoring in progress
                    </span>
                  )}
                  {routes[0]?.source === 'backend' && (
                    <span className="text-[11px] text-amber-600 font-medium">Mock routes</span>
                  )}
                </div>
                {routes.map((r, idx) => {
                  let badge, badgeColor;
                  if (idx === safestRouteIdx && idx === fastestRouteIdx) {
                    badge = 'Safest & Fastest'; badgeColor = '#16A34A';
                  } else if (idx === safestRouteIdx) {
                    badge = 'Safest Route'; badgeColor = '#16A34A';
                  } else if (idx === fastestRouteIdx) {
                    badge = 'Fastest Route'; badgeColor = '#2563EB';
                  }
    return (
  <RouteCard
    key={r.id}
    route={r}
    score={scoredRoutes[idx]}
    selected={selectedRouteIdx === idx}
    onSelect={() => {
      setSelectedRouteIdx(idx);
      setSidebarOpen(false);
    }}
    badge={badge}
    badgeColor={badgeColor}
  />
);
})}
</div>
)}

{/* Backend disclaimer or source label */}
{routes[0]?.source === 'backend' && (
  <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
    ⚠️ Showing mock routes. Geometry is illustrative only. Safety data is insufficient for a reliable score.
  </p>
)}

            {/* Map layers toggle */}
            <div className="card">
              <button
                onClick={() => setShowLayers(!showLayers)}
                className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-text-dark"
                aria-expanded={showLayers}
              >
                <span className="flex items-center gap-2"><Layers className="w-4 h-4 text-primary" /> Map Layers</span>
                {showLayers ? <ChevronUp className="w-4 h-4 text-text-muted" /> : <ChevronDown className="w-4 h-4 text-text-muted" />}
              </button>
              {showLayers && (
                <div className="px-4 pb-3 border-t border-border pt-3">
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    {LAYER_OPTIONS.map(({ key, label, icon }) => (
                      <button
                        key={key}
                        onClick={() => toggleLayer(key)}
                        className={`flex flex-col items-center gap-1 py-2 px-1 rounded-xl border text-xs font-medium transition-all ${
                          visibleLayers.has(key)
                            ? 'border-primary bg-blue-50 text-primary'
                            : 'border-border text-text-muted hover:border-primary'
                        }`}
                        aria-pressed={visibleLayers.has(key)}
                      >
                        <span>{icon}</span>
                        <span>{label}</span>
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={handleLoadNearbyPlaces}
                    disabled={placesLoading}
                    className="btn-secondary w-full text-xs py-2 flex items-center justify-center gap-2"
                    id="load-nearby-btn"
                  >
                    {placesLoading ? <><span className="spinner spinner-blue" /> Loading…</> : <><RefreshCw className="w-3.5 h-3.5" /> Load Nearby Places</>}
                  </button>
                  {placesError && <p className="text-xs text-danger mt-2">{placesError}</p>}
                  {allNearbyPlaces.length > 0 && (
                    <p className="text-xs text-success mt-2">✓ {allNearbyPlaces.length} places loaded</p>
                  )}
                </div>
              )}
            </div>

            {/* Nearest safe spot */}
            <button
              onClick={handleFindNearestSafe}
              disabled={safeSpotLoading}
              className="btn-secondary w-full flex items-center justify-center gap-2 text-sm"
              id="nearest-safe-btn"
            >
              {safeSpotLoading ? (
                <><span className="spinner spinner-blue" /> Searching…</>
              ) : (
                <><Shield className="w-4 h-4 text-success" /> Find Nearest Safe Spot</>
              )}
            </button>

            {safeSpotError && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-danger">
                {safeSpotError}
              </div>
            )}

            {nearestSafePlace && (
              <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-sm">
                <p className="font-semibold text-success mb-1">✅ Nearest Assistance Found</p>
                <p className="text-text-dark">{nearestSafePlace.name}</p>
                <p className="text-text-muted text-xs mt-1">
                  {formatDistance(nearestSafePlace.distance)} · ~{nearestSafePlace.walkTime} min walk
                </p>
                <p className="text-xs text-yellow-700 bg-yellow-50 rounded-lg px-2 py-1 mt-2">
                  ⚠️ Nearby assistance only. Not a guarantee of personal safety.
                </p>
              </div>
            )}

            {/* SOS */}
            <div className="pt-2 pb-4">
              <SOSButton className="w-full justify-center" />
            </div>
          </div>

          {/* Disclaimer */}
          <div className="border-t border-border px-4 py-3 bg-yellow-50 flex items-start gap-2">
            <Info className="w-3.5 h-3.5 text-yellow-700 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-yellow-800 leading-relaxed">
              Safe Route provides <strong>estimated</strong> safety information based on available geographical data. It cannot guarantee personal safety.
            </p>
          </div>
        </aside>

        {/* ── Map ─────────────────────────────────────────────── */}
        <main className="flex-1 relative min-h-0">
          <MapView
            center={mapCenter}
            zoom={mapZoom}
            currentLocation={currentLocation}
            startLocation={startLocation}
            endLocation={endLocation}
            routes={routes}
            scoredRoutes={scoredRoutes}
            selectedRouteIdx={selectedRouteIdx}
            onSelectRoute={(idx) => { setSelectedRouteIdx(idx); }}
            nearbyPlaces={mapPlaces}
            visibleLayers={visibleLayers}
            nearestSafePlace={nearestSafePlace}
            routeToSafePlace={routeToSafePlace}
            departureTime={departureTime}
            resizeTrigger={sidebarOpen}
          />

          {/* Mobile: show sidebar toggle if map is visible */}
          {!sidebarOpen && (
            <button
              onClick={() => setSidebarOpen(true)}
              className="absolute top-3 left-3 z-[400] bg-white shadow-lg border border-border rounded-xl px-3 py-2 text-sm font-semibold text-text-dark flex items-center gap-2 md:hidden"
            >
              <Navigation className="w-4 h-4 text-primary" /> Routes
            </button>
          )}

          {/* Route details panel — shows when a route is selected */}
          {selectedScore && !routeLoading && (
            <div className="absolute bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-72 z-[400]">
              <div className="card p-4 shadow-xl animate-slide-up">
                <p className="text-xs font-bold text-text-muted uppercase tracking-wide mb-2">Selected Route Score</p>
                <SafetyScore
                  score={selectedScore.overall.score}
                  confidence={selectedScore.overall.confidence}
                  insufficient={selectedScore.insufficient}
                />
                {selectedScore.weakestSegment && !selectedScore.insufficient && (
                  <div className="mt-2 bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2">
                    <p className="text-xs text-yellow-800">
                      ⚠️ <strong>Weakest stretch:</strong> Score {selectedScore.weakestSegment.score}/100 — click the coloured route segments on the map for details.
                    </p>
                  </div>
                )}
                <div className="flex gap-2 mt-3 flex-wrap">
                  <button
                    onClick={handleSaveRoute}
                    disabled={saveStatus === 'saving' || saveStatus === 'saved'}
                    className="flex-1 btn-primary text-xs py-2 flex items-center justify-center gap-1 disabled:opacity-60"
                  >
                    {saveStatus === 'saving' && <Loader2 className="w-3 h-3 animate-spin" />}
                    {saveStatus === 'saved' ? '✓ Saved' : saveStatus === 'error' ? 'Save Failed' : 'Save Route'}
                  </button>
                  <Link to="/report" className="flex-1 btn-secondary text-xs text-center py-2">
                    Report Issue
                  </Link>
                  <button onClick={() => { setSelectedRouteIdx(0); clearRoutes(); setSaveStatus(''); }} className="flex-1 btn-secondary text-xs py-2">
                    Clear
                  </button>
                </div>
                {savedRoutesRequireBackend() && saveStatus === 'saved' && (
                  <p className="text-[10px] text-amber-700 mt-1 text-center">Saved to this device only. Sync needs backend.</p>
                )}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
