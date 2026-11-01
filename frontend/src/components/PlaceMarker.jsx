import { MapPin, ExternalLink, Clock, Phone } from 'lucide-react';
import { PLACE_CATEGORIES } from '../services/places.js';
import { formatDistance, walkingTimeMinutes, haversine } from '../utils/distance.js';
import { isOpenAt, openStatusLabel } from '../utils/openingHours.js';

/**
 * PlaceMarker card — used in the Nearby Help list view.
 *
 * Props:
 *   place         OSM place object
 *   userLocation  { lat, lon } | null
 *   departureTime Date
 *   onFocus       () => void   — fly to this place on the map
 */
export default function PlaceCard({ place, userLocation, departureTime = new Date(), onFocus }) {
  const cat = PLACE_CATEGORIES[place.category] || { label: 'Place', icon: '📍' };
  const openStatus = isOpenAt(place.tags?.opening_hours, departureTime);
  const statusLabel = openStatusLabel(openStatus);

  const distance = userLocation
    ? haversine([userLocation.lat, userLocation.lon], [place.lat, place.lon])
    : null;

  const walkTime = distance != null ? walkingTimeMinutes(distance) : null;

  return (
    <div className="card p-3 flex items-start gap-3 hover:shadow-md transition-shadow cursor-pointer group" onClick={onFocus}>
      <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0 text-lg">
        {cat.icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-text-dark truncate group-hover:text-primary transition-colors">
          {place.name || cat.label}
        </p>
        <p className="text-xs text-text-muted mt-0.5">{cat.label}</p>
        <div className="flex items-center gap-3 mt-1.5 flex-wrap">
          {distance != null && (
            <span className="flex items-center gap-1 text-xs text-text-muted">
              <MapPin className="w-3 h-3" />
              {formatDistance(distance)}
            </span>
          )}
          {walkTime != null && (
            <span className="flex items-center gap-1 text-xs text-text-muted">
              <Clock className="w-3 h-3" />
              ~{walkTime} min walk
            </span>
          )}
          <span className={`text-xs font-medium ${
            openStatus === 'open' ? 'text-success' :
            openStatus === 'closed' ? 'text-danger' : 'text-text-muted'
          }`}>
            {statusLabel}
          </span>
        </div>
        {place.tags?.phone && (
          <p className="flex items-center gap-1 text-xs text-text-muted mt-1">
            <Phone className="w-3 h-3" />
            {place.tags.phone}
          </p>
        )}
      </div>
    </div>
  );
}
