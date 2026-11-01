import { useState, useEffect, useRef } from 'react';
import { MapPin, Search, Filter, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { Suspense, lazy } from 'react';

import { useGeolocation } from '../hooks/useGeolocation.js';
import { fetchNearbyPlaces, PLACE_CATEGORIES, sortByDistance, getOsmPhone, getPlaceAddress, googleDirectionsUrl } from '../services/places.js';
import { haversine, formatDistance, walkingTimeMinutes } from '../utils/distance.js';
import { isOpenAt, openStatusLabel } from '../utils/openingHours.js';

const MapView = lazy(() => import('../components/MapView.jsx'));

const ALL_CATEGORIES = Object.keys(PLACE_CATEGORIES);

export default function NearbyHelp() {
  const { location, loading: gpsLoading, error: gpsError, getLocation } = useGeolocation();
  const [places, setPlaces] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeCategory, setActiveCategory] = useState('all');
  const [mapCenter, setMapCenter] = useState(null);
  const [departureTime] = useState(new Date());
  const [visibleLayers, setVisibleLayers] = useState(new Set(ALL_CATEGORIES));

  const abortControllerRef = useRef(null);
  const isMountedRef = useRef(true);

  const fetchPlaces = async (loc) => {
    if (!loc) return;

    // Abort any ongoing request before starting a new one
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setLoading(true);
    setError(null);
    try {
      const results = await fetchNearbyPlaces(loc.lat, loc.lon, 1000, ALL_CATEGORIES, {
        signal: controller.signal,
      });

      if (!isMountedRef.current || controller.signal.aborted) return;

      const sorted = sortByDistance(results, loc.lat, loc.lon);
      setPlaces(sorted);
    } catch (err) {
      // Outdated, superseded, or unmounted requests should never display an error
      if (!isMountedRef.current || controller.signal.aborted || err.name === 'AbortError') {
        return;
      }
      setError(err.message || 'Failed to load places from OpenStreetMap. Please try again.');
    } finally {
      if (isMountedRef.current && abortControllerRef.current === controller) {
        setLoading(false);
      }
    }
  };

  const handleDetectLocation = async () => {
    const loc = await getLocation();
    if (loc) {
      setMapCenter([loc.lat, loc.lon]);
      fetchPlaces(loc);
    }
  };

  useEffect(() => {
    isMountedRef.current = true;
    if (location) {
      fetchPlaces(location);
    }
    return () => {
      isMountedRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const filtered = activeCategory === 'all'
    ? places
    : places.filter(p => p.category === activeCategory);

  return (
    <div className="min-h-screen bg-bg-base">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-text-dark mb-1">Nearby Help</h1>
          <p className="text-text-muted text-sm">
            Find police stations, hospitals, ambulance listings and pharmacies from OpenStreetMap. Call buttons appear only when OSM includes a phone tag — numbers are not invented or marked as independently verified.
          </p>
        </div>

        {/* Location bar */}
        <div className="card p-4 mb-6 flex flex-wrap items-center gap-3">
          {location ? (
            <div className="flex items-center gap-2 text-sm text-success">
              <div className="w-2 h-2 rounded-full bg-success" />
              GPS: {location.lat.toFixed(4)}, {location.lon.toFixed(4)}
            </div>
          ) : (
            <p className="text-sm text-text-muted">Location not detected yet.</p>
          )}
          <button
            onClick={handleDetectLocation}
            disabled={gpsLoading || loading}
            className="btn-primary flex items-center gap-2 text-sm py-2 px-4 ml-auto"
            id="nearby-detect-btn"
          >
            {gpsLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <MapPin className="w-4 h-4" />}
            {location ? 'Refresh Location' : 'Detect My Location'}
          </button>
        </div>

        {gpsError && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4 text-sm text-danger">
            {gpsError}
          </div>
        )}

        <div className="grid lg:grid-cols-5 gap-6">
          {/* Left: List */}
          <div className="lg:col-span-2 space-y-4">
            {/* Category filter */}
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
              <button
                onClick={() => setActiveCategory('all')}
                className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                  activeCategory === 'all' ? 'bg-primary text-white border-primary' : 'border-border text-text-muted hover:border-primary'
                }`}
              >
                All ({places.length})
              </button>
              {Object.entries(PLACE_CATEGORIES).map(([key, cat]) => {
                const count = places.filter(p => p.category === key).length;
                if (count === 0) return null;
                return (
                  <button
                    key={key}
                    onClick={() => setActiveCategory(key)}
                    className={`flex-shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                      activeCategory === key ? 'bg-primary text-white border-primary' : 'border-border text-text-muted hover:border-primary'
                    }`}
                  >
                    {cat.icon} {cat.label} ({count})
                  </button>
                );
              })}
            </div>

            {/* Loading */}
            {loading && (
              <div className="card p-8 flex flex-col items-center gap-3 text-text-muted">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
                <p className="text-sm">Loading places from OpenStreetMap…</p>
              </div>
            )}

            {/* Error */}
            {error && !loading && (
              <div className="card p-4">
                <div className="flex items-center gap-2 text-danger mb-2">
                  <AlertCircle className="w-4 h-4" />
                  <span className="font-semibold text-sm">Could not load places</span>
                </div>
                <p className="text-xs text-text-muted">{error}</p>
                <button onClick={() => location && fetchPlaces(location)} className="mt-3 btn-secondary text-xs py-2 flex items-center gap-2">
                  <RefreshCw className="w-3.5 h-3.5" /> Try Again
                </button>
              </div>
            )}

            {/* Empty state */}
            {!loading && !error && places.length === 0 && (
              <div className="card p-8 flex flex-col items-center gap-3 text-text-muted text-center">
                <Search className="w-8 h-8" />
                <p className="text-sm">Detect your location to find nearby assistance places.</p>
              </div>
            )}

            {/* Places list */}
            {!loading && filtered.length > 0 && (
              <div className="space-y-2">
                {filtered.map(p => {
                  const cat = PLACE_CATEGORIES[p.category] || { label: 'Place', icon: '📍' };
                  const openStatus = isOpenAt(p.tags?.opening_hours, departureTime);
                  const distance = location ? haversine([location.lat, location.lon], [p.lat, p.lon]) : null;
                  const walkTime = distance != null ? walkingTimeMinutes(distance) : null;
                  const osmPhone = getOsmPhone(p);
                  const address = getPlaceAddress(p);
                  return (
                    <div
                      key={p.id}
                      className="card p-3 flex items-start gap-3 hover:shadow-md transition-shadow hover:border-primary"
                    >
                      <button
                        type="button"
                        className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0 text-lg"
                        onClick={() => setMapCenter([p.lat, p.lon])}
                        aria-label={`Focus map on ${p.name || cat.label}`}
                      >
                        {cat.icon}
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-text-dark truncate">{p.name || cat.label}</p>
                        <p className="text-xs text-text-muted">{cat.label}</p>
                        {address && <p className="text-xs text-text-muted mt-0.5 truncate">{address}</p>}
                        <div className="flex items-center gap-3 mt-1 flex-wrap">
                          {distance != null && (
                            <span className="text-xs text-text-muted">📍 {formatDistance(distance)}</span>
                          )}
                          {walkTime != null && (
                            <span className="text-xs text-text-muted">🚶 ~{walkTime} min</span>
                          )}
                          <span className={`text-xs font-medium ${
                            openStatus === 'open' ? 'text-success' :
                            openStatus === 'closed' ? 'text-danger' : 'text-text-muted'
                          }`}>
                            {openStatusLabel(openStatus)}
                          </span>
                        </div>
                        {osmPhone ? (
                          <p className="text-[11px] text-text-muted mt-1">OSM-listed number: {osmPhone} (not independently verified)</p>
                        ) : (
                          <p className="text-[11px] text-text-muted mt-1">No phone listed in OpenStreetMap</p>
                        )}
                        <div className="flex flex-wrap gap-2 mt-2">
                          <a
                            href={googleDirectionsUrl(p.lat, p.lon)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn-secondary text-xs py-2 px-3 min-h-[40px] inline-flex items-center"
                          >
                            Directions
                          </a>
                          {osmPhone && (
                            <a href={`tel:${osmPhone.replace(/\s/g, '')}`} className="btn-danger text-xs py-2 px-3 min-h-[40px] inline-flex items-center">
                              Call
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right: Map */}
          <div className="lg:col-span-3">
            <div className="card overflow-hidden" style={{ height: '520px' }}>
              <Suspense fallback={<div className="w-full h-full flex items-center justify-center text-text-muted">Loading map…</div>}>
                <MapView
                  center={mapCenter || (location ? [location.lat, location.lon] : [20.5937, 78.9629])}
                  zoom={mapCenter ? 15 : 5}
                  currentLocation={location}
                  nearbyPlaces={places}
                  visibleLayers={new Set(activeCategory === 'all' ? ALL_CATEGORIES : [activeCategory])}
                  departureTime={departureTime}
                />
              </Suspense>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
