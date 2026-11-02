/**
 * Distance utilities.
 * All distances are in metres unless stated otherwise.
 */

const R = 6371000; // Earth radius in metres

/** Convert degrees to radians */
const toRad = (deg) => (deg * Math.PI) / 180;

/**
 * Haversine distance between two [lat, lon] pairs (metres).
 */
export function haversine([lat1, lon1], [lat2, lon2]) {
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/**
 * Format metres to a human-readable string.
 * < 1000m → "450 m"; >= 1000m → "1.4 km"
 */
export function formatDistance(metres) {
  if (metres < 1000) return `${Math.round(metres)} m`;
  return `${(metres / 1000).toFixed(1)} km`;
}

/**
 * Format seconds into a human-readable duration.
 */
export function formatDuration(seconds) {
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins} min`;
  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;
  return rem > 0 ? `${hrs} hr ${rem} min` : `${hrs} hr`;
}

/**
 * Interpolate a polyline into equal-length segments of approx `segLen` metres.
 * Returns an array of {
 *   start: [lat,lon],
 *   end: [lat,lon],
 *   midpoint: [lat,lon],
 *   length: number,
 *   coordinates: [[lat,lon], ...]   ← full sub-array of original coords for this segment
 * }
 */
export function segmentPolyline(coords, segLen = 100) {
  if (!coords || coords.length < 2) return [];
  const segments = [];
  let segStart = coords[0];
  let segCoords = [coords[0]]; // accumulate actual coordinate points
  let accum = 0;

  for (let i = 1; i < coords.length; i++) {
    const prev = coords[i - 1];
    const curr = coords[i];
    const d = haversine(prev, curr);
    accum += d;
    segCoords.push(curr);

    if (accum >= segLen) {
      segments.push({
        start: segStart,
        end: curr,
        midpoint: midpoint(segStart, curr),
        length: accum,
        coordinates: segCoords,
      });
      segStart = curr;
      segCoords = [curr]; // next segment starts from this point
      accum = 0;
    }
  }

  // Push the remaining part
  if (accum > 0 && segStart !== coords[coords.length - 1]) {
    const last = coords[coords.length - 1];
    segments.push({
      start: segStart,
      end: last,
      midpoint: midpoint(segStart, last),
      length: accum,
      coordinates: segCoords,
    });
  }

  return segments;
}

/** Midpoint between two [lat, lon] pairs */
export function midpoint([lat1, lon1], [lat2, lon2]) {
  return [(lat1 + lat2) / 2, (lon1 + lon2) / 2];
}

/**
 * Walking time estimate.
 * Average walking speed: 5 km/h → 83.3 m/min
 */
export function walkingTimeMinutes(metres) {
  return Math.round(metres / 83.3);
}
