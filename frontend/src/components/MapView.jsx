import { useEffect, useRef } from 'react';
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
  useMap,
  ZoomControl,
  Circle,
} from 'react-leaflet';
import L from 'leaflet';
import { PLACE_CATEGORIES } from '../services/places.js';
import { formatDistance, walkingTimeMinutes } from '../utils/distance.js';
import { safetyCategoryColor } from '../utils/safetyScoring.js';
import { isOpenAt, openStatusLabel } from '../utils/openingHours.js';
import { useState } from 'react';

// Fix default Leaflet marker icon issue with Vite
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// ── Custom marker icons ──────────────────────────────────────────────────────
const createIcon = (color, emoji, size = 32) => L.divIcon({
  className: '',
  html: `<div style="
    width:${size}px;height:${size}px;background:${color};
    border-radius:50% 50% 50% 0;transform:rotate(-45deg);
    border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.25);
    display:flex;align-items:center;justify-content:center;
  "><span style="transform:rotate(45deg);font-size:${size * 0.45}px;line-height:1;">${emoji}</span></div>`,
  iconSize: [size, size],
  iconAnchor: [size / 2, size],
  popupAnchor: [0, -size],
});

const ICONS = {
  current:  createIcon('#2563EB', '📍', 34),
  start:    createIcon('#16A34A', '🚶', 32),
  end:      createIcon('#DC2626', '🏁', 32),
  police:   createIcon('#1D4ED8', '🚔', 28),
  hospital: createIcon('#16A34A', '🏥', 28),
  ambulance: createIcon('#DC2626', '🚑', 28),
  clinic:   createIcon('#0D9488', '🩺', 26),
  pharmacy: createIcon('#7C3AED', '💊', 26),
  fuel:     createIcon('#EA580C', '⛽', 26),
  shop:     createIcon('#0891B2', '🛍️', 24),
  shop24:   createIcon('#0891B2', '🏪', 24),
  atm:      createIcon('#0369A1', '🏧', 24),
  restaurant: createIcon('#B45309', '🍽️', 24),
  cafe:     createIcon('#92400E', '☕', 24),
  other:    createIcon('#64748B', '📍', 24),
  safe:     createIcon('#16A34A', '✅', 30),
};

// ── Sub-component: fly to a location when it changes ────────────────────────
function MapController({ center, zoom }) {
  const map = useMap();
  useEffect(() => {
    if (center) {
      map.flyTo(center, zoom || map.getZoom(), { duration: 1.2 });
    }
  }, [center, zoom, map]);
  return null;
}

// ── Sub-component: fit map bounds to the selected route ──────────────────────
//
// Fires whenever `routes` or `selectedRouteIdx` changes.
// Uses fitBounds with padding so origin + destination markers stay visible.
// Respects user manual zoom/drag — only auto-fits when a new route is loaded
// (tracked via a route-ID key so switching selections also re-fits).
function RoutesFitter({ routes, selectedRouteIdx }) {
  const map = useMap();
  const lastFitKey = useRef(null);

  useEffect(() => {
    if (!routes || routes.length === 0) return;

    const route = routes[selectedRouteIdx] ?? routes[0];
    if (!route?.coordinates?.length) return;

    // Build a stable key: route id + selected index
    const fitKey = `${route.id ?? selectedRouteIdx}`;
    if (fitKey === lastFitKey.current) return; // don't re-fit if nothing changed
    lastFitKey.current = fitKey;

    try {
      const bounds = L.latLngBounds(route.coordinates);
      if (!bounds.isValid()) return;

      // Use tighter padding on small screens (mobile), more generous on desktop
      const isMobile = window.innerWidth < 768;
      const pad = isMobile ? [32, 32] : [60, 60];

      map.fitBounds(bounds, {
        padding: pad,
        maxZoom: 16,
        animate: true,
        duration: 0.8,
      });
    } catch { /* non-critical — ignore */ }
  }, [routes, selectedRouteIdx, map]);

  return null;
}

// ── Sub-component: invalidateSize when sidebar opens/closes or container resizes ─
//
// Listens to the map container via ResizeObserver (handles orientation changes,
// browser-chrome show/hide on Android, and sidebar toggle).
// Also fires once on mount to fix dimensions after lazy loading.
function MapResizeHandler({ resizeTrigger }) {
  const map = useMap();
  const timerRef = useRef(null);

  // Helper: schedule a debounced invalidateSize
  const scheduleInvalidate = () => {
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      try { map.invalidateSize({ animate: false }); } catch { /* ignore */ }
    }, 120);
  };

  // 1) Fire whenever the external trigger (sidebarOpen) changes
  useEffect(() => {
    scheduleInvalidate();
  }, [resizeTrigger]); // eslint-disable-line react-hooks/exhaustive-deps

  // 2) Fire on mount (handles lazy-loaded container)
  useEffect(() => {
    scheduleInvalidate();
    return () => clearTimeout(timerRef.current);
  }, [map]); // eslint-disable-line react-hooks/exhaustive-deps

  // 3) ResizeObserver: handles orientation changes and dynamic height changes
  useEffect(() => {
    const container = map.getContainer();
    if (!container || typeof ResizeObserver === 'undefined') return;

    const observer = new ResizeObserver(() => scheduleInvalidate());
    observer.observe(container);

    return () => {
      observer.disconnect();
      clearTimeout(timerRef.current);
    };
  }, [map]); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}

// ── Sub-component: click on map to pick a location ─────────────────────────
function MapClickHandler({ onMapClick }) {
  const map = useMap();
  useEffect(() => {
    if (!onMapClick) return;
    const handler = (e) => onMapClick(e.latlng);
    map.on('click', handler);
    return () => map.off('click', handler);
  }, [map, onMapClick]);
  return null;
}

/**
 * MapView — the main interactive map component.
 *
 * Props:
 *   center         [lat, lon]        — controls map fly-to
 *   zoom           number
 *   currentLocation { lat, lon }     — blue dot + accuracy circle
 *   startLocation  { lat, lon, shortName }
 *   endLocation    { lat, lon, shortName }
 *   routes         Array             — all routes
 *   scoredRoutes   Array             — matching scored route objects
 *   selectedRouteIdx number
 *   onSelectRoute  (idx) => void
 *   nearbyPlaces   Array             — OSM places
 *   visibleLayers  Set<string>       — which place categories to show
 *   onMapClick     (latlng) => void  — for picking report/destination on map
 *   nearestSafePlace object | null
 *   routeToSafePlace Array           — coordinates of route to safe place
 *   departureTime  Date
 *   resizeTrigger  any               — change this value to trigger invalidateSize
 */
export default function MapView({
  center,
  zoom = 13,
  currentLocation,
  startLocation,
  endLocation,
  routes = [],
  scoredRoutes = [],
  selectedRouteIdx = 0,
  onSelectRoute,
  nearbyPlaces = [],
  visibleLayers = new Set(['police', 'hospital']),
  onMapClick,
  nearestSafePlace = null,
  routeToSafePlace = [],
  departureTime = new Date(),
  resizeTrigger,
}) {
  const [selectedSegment, setSelectedSegment] = useState(null);

  const mapCenter = center ||
    (currentLocation ? [currentLocation.lat, currentLocation.lon] : [20.5937, 78.9629]);

  return (
    <MapContainer
      center={mapCenter}
      zoom={zoom}
      zoomControl={false}
      className="w-full h-full"
      style={{ minHeight: '300px', minWidth: '100px' }}
    >
      {/* OSM Tile layer */}
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        maxZoom={19}
      />

      <ZoomControl position="bottomright" />

      {/* Sub-components that communicate with the Leaflet map instance */}
      <MapController center={center} zoom={zoom} />
      <MapResizeHandler resizeTrigger={resizeTrigger} />
      <RoutesFitter routes={routes} selectedRouteIdx={selectedRouteIdx} />
      {onMapClick && <MapClickHandler onMapClick={onMapClick} />}

      {/* Current location marker + accuracy circle */}
      {currentLocation && (
        <>
          <Circle
            center={[currentLocation.lat, currentLocation.lon]}
            radius={currentLocation.accuracy || 20}
            pathOptions={{ color: '#2563EB', fillColor: '#2563EB', fillOpacity: 0.1, weight: 1 }}
          />
          <Marker position={[currentLocation.lat, currentLocation.lon]} icon={ICONS.current}>
            <Popup>
              <div className="safe-popup">
                <h4>📍 Your Location</h4>
                <p>Accuracy: ±{Math.round(currentLocation.accuracy || 0)} m</p>
              </div>
            </Popup>
          </Marker>
        </>
      )}

      {/* Start marker */}
      {startLocation && (
        <Marker position={[startLocation.lat, startLocation.lon]} icon={ICONS.start}>
          <Popup>
            <div className="safe-popup">
              <h4>🚶 Start</h4>
              <p>{startLocation.shortName || 'Starting point'}</p>
            </div>
          </Popup>
        </Marker>
      )}

      {/* End marker */}
      {endLocation && (
        <Marker position={[endLocation.lat, endLocation.lon]} icon={ICONS.end}>
          <Popup>
            <div className="safe-popup">
              <h4>🏁 Destination</h4>
              <p>{endLocation.shortName || 'Destination'}</p>
            </div>
          </Popup>
        </Marker>
      )}

      {/* Route polylines */}
      {routes.map((route, idx) => {
        const isSelected = idx === selectedRouteIdx;
        const scored = scoredRoutes[idx];

        if (!isSelected) {
          // Non-selected routes: thin grey dashed line
          return (
            <Polyline
              key={route.id}
              positions={route.coordinates}
              pathOptions={{
                color: '#94A3B8',
                weight: 4,
                opacity: 0.5,
                dashArray: '6 4',
              }}
              eventHandlers={{ click: () => onSelectRoute && onSelectRoute(idx) }}
            />
          );
        }

        // Selected route: show coloured segments if scored
        if (scored && scored.segments && scored.segments.length > 0) {
          return scored.segments.map((seg, si) => {
            // Use the actual polyline coordinates for this segment so the coloured
            // overlay follows real road curves instead of drawing a straight line
            // between seg.start and seg.end.
            const segPositions =
              seg.coordinates && seg.coordinates.length > 1
                ? seg.coordinates
                : [seg.start, seg.end];

            return (
              <Polyline
                key={`${route.id}_seg_${si}`}
                positions={segPositions}
                pathOptions={{
                  color: safetyCategoryColor(seg.category),
                  weight: 6,
                  opacity: 0.85,
                  lineCap: 'round',
                  lineJoin: 'round',
                }}
                eventHandlers={{
                  click: () => setSelectedSegment(seg),
                }}
              />
            );
          });
        }

        // Selected route without segments: single blue line
        return (
          <Polyline
            key={route.id}
            positions={route.coordinates}
            pathOptions={{
              color: '#2563EB',
              weight: 6,
              opacity: 0.85,
            }}
          />
        );
      })}

      {/* Segment info popup */}
      {selectedSegment && (
        <Marker
          position={selectedSegment.midpoint}
          icon={L.divIcon({ className: '', html: '', iconSize: [0, 0] })}
        >
          <Popup onClose={() => setSelectedSegment(null)} autoPan>
            <div className="safe-popup">
              <h4>Segment Safety Info</h4>
              <p>Score: <strong>{selectedSegment.score}/100</strong></p>
              <p>Category: {selectedSegment.category}</p>
              {selectedSegment.factors && (
                <>
                  <p style={{ marginTop: 6, fontWeight: 600 }}>Factors:</p>
                  {Object.entries(selectedSegment.factors).map(([k, v]) => (
                    <p key={k} style={{ textTransform: 'capitalize' }}>
                      {k.replace(/([A-Z])/g, ' $1')}: {v !== null ? v : 'No data'}
                    </p>
                  ))}
                </>
              )}
              <span
                className="badge"
                style={{
                  background: safetyCategoryColor(selectedSegment.category),
                  color: 'white',
                }}
              >
                {selectedSegment.category === 'good' ? 'Relatively Better' :
                 selectedSegment.category === 'moderate' ? 'Stay Alert' : 'Potentially Concerning'}
              </span>
            </div>
          </Popup>
        </Marker>
      )}

      {/* Nearby place markers */}
      {nearbyPlaces
        .filter(p => visibleLayers.has(p.category))
        .map(p => {
          const icon = ICONS[p.category] || ICONS.other;
          const cat = PLACE_CATEGORIES[p.category] || {};
          const openStatus = isOpenAt(p.tags?.opening_hours, departureTime);
          const statusLabel = openStatusLabel(openStatus);

          return (
            <Marker key={p.id} position={[p.lat, p.lon]} icon={icon}>
              <Popup>
                <div className="safe-popup">
                  <h4>{cat.icon} {p.name || cat.label}</h4>
                  {p.tags?.['addr:street'] && <p>📍 {p.tags['addr:street']}</p>}
                  {p.tags?.phone && <p>📞 {p.tags.phone}</p>}
                  <p>
                    Status:{' '}
                    <span style={{
                      color: openStatus === 'open' ? '#16A34A' : openStatus === 'closed' ? '#DC2626' : '#64748B',
                      fontWeight: 600,
                    }}>
                      {statusLabel}
                    </span>
                  </p>
                  {p.tags?.opening_hours && <p>🕐 {p.tags.opening_hours}</p>}
                  <span className="badge" style={{ background: '#EFF6FF', color: '#1D4ED8' }}>
                    {cat.label}
                  </span>
                </div>
              </Popup>
            </Marker>
          );
        })}

      {/* Route to nearest safe place */}
      {routeToSafePlace.length > 0 && (
        <Polyline
          positions={routeToSafePlace}
          pathOptions={{ color: '#16A34A', weight: 5, dashArray: '8 4', opacity: 0.9 }}
        />
      )}

      {/* Nearest safe place marker */}
      {nearestSafePlace && (
        <Marker position={[nearestSafePlace.lat, nearestSafePlace.lon]} icon={ICONS.safe}>
          <Popup>
            <div className="safe-popup">
              <h4>✅ Nearest Assistance</h4>
              <p>{nearestSafePlace.name}</p>
              {nearestSafePlace.distance && (
                <p>Distance: {formatDistance(nearestSafePlace.distance)}</p>
              )}
              {nearestSafePlace.walkTime && (
                <p>~{nearestSafePlace.walkTime} min walk</p>
              )}
              <span className="badge" style={{ background: '#DCFCE7', color: '#16A34A' }}>
                {PLACE_CATEGORIES[nearestSafePlace.category]?.label || 'Safe Location'}
              </span>
              <p style={{ fontSize: 11, color: '#64748B', marginTop: 6 }}>
                ⚠️ Nearby assistance — not a guarantee of safety.
              </p>
            </div>
          </Popup>
        </Marker>
      )}
    </MapContainer>
  );
}
