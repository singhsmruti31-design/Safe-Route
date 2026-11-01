import { calculateHaversineDistanceMeters } from '../db/mockPlacesData.js';
import { scoringConfig } from '../config/scoring.config.js';

/**
 * Calculates distance in meters between two [lng, lat] coordinate pairs.
 * @param {[number, number]} p1 [lng, lat]
 * @param {[number, number]} p2 [lng, lat]
 * @returns {number} Distance in meters
 */
export function getDistanceMeters(p1, p2) {
  return calculateHaversineDistanceMeters(p1[1], p1[0], p2[1], p2[0]);
}

/**
 * Linearly interpolates between two [lng, lat] points by a fraction (0 to 1).
 * @param {[number, number]} p1 
 * @param {[number, number]} p2 
 * @param {number} fraction 
 * @returns {[number, number]} Interpolated [lng, lat]
 */
export function interpolate(p1, p2, fraction) {
  const lng = p1[0] + (p2[0] - p1[0]) * fraction;
  const lat = p1[1] + (p2[1] - p1[1]) * fraction;
  return [lng, lat];
}

/**
 * Finds the ORS waytype for a given coordinate index along the original route.
 * ORS extra_info.waytype.values is in format: [[fromIndex, toIndex, waytypeValue], ...]
 * @param {number} vertexIndex 
 * @param {Array<[number, number, number]>} waytypeValues 
 * @returns {number}
 */
export function resolveWaytype(vertexIndex, waytypeValues = []) {
  if (!waytypeValues || waytypeValues.length === 0) return 4; // default street/residential
  for (const [fromIdx, toIdx, val] of waytypeValues) {
    if (vertexIndex >= fromIdx && vertexIndex <= toIdx) {
      return val;
    }
  }
  return waytypeValues[0]?.[2] || 4;
}

/**
 * Splits a GeoJSON LineString coordinates array into segments of ~100m each.
 * 
 * @param {Array<[number, number]>} coords Array of [lng, lat]
 * @param {Array<[number, number, number]>} waytypeValues ORS extra_info waytype ranges
 * @param {number} targetLength Target segment length in meters (default 100)
 * @returns {Array<Object>} List of scored segments
 */
export function splitRouteIntoSegments(coords, waytypeValues = [], targetLength = scoringConfig.segmentLengthMeters || 100) {
  if (!coords || coords.length < 2) {
    return [];
  }

  const segments = [];
  let currentSegmentCoords = [coords[0]];
  let currentSegmentDistance = 0;
  let currentSegmentStartWaytype = resolveWaytype(0, waytypeValues);

  let prevPoint = coords[0];
  let segmentIndex = 0;

  for (let i = 1; i < coords.length; i++) {
    const nextPoint = coords[i];
    const originalVertexIndex = i;
    let distToNext = getDistanceMeters(prevPoint, nextPoint);

    // If step distance is essentially 0 (duplicate points), skip
    if (distToNext < 0.1) continue;

    let pCurrent = prevPoint;

    while (currentSegmentDistance + distToNext >= targetLength) {
      const remainingNeeded = targetLength - currentSegmentDistance;
      const fraction = remainingNeeded / distToNext;
      const splitPoint = interpolate(pCurrent, nextPoint, fraction);

      currentSegmentCoords.push(splitPoint);
      currentSegmentDistance += remainingNeeded;

      // Finalize this segment
      const startCoord = currentSegmentCoords[0];
      const endCoord = currentSegmentCoords[currentSegmentCoords.length - 1];
      const midpointCoord = interpolate(startCoord, endCoord, 0.5);

      segments.push({
        index: segmentIndex++,
        start: { lat: startCoord[1], lng: startCoord[0] },
        end: { lat: endCoord[1], lng: endCoord[0] },
        midpoint: { lat: midpointCoord[1], lng: midpointCoord[0] },
        lengthMeters: Math.round(currentSegmentDistance * 10) / 10,
        waytype: currentSegmentStartWaytype,
        coordinates: currentSegmentCoords
      });

      // Reset for next segment
      currentSegmentCoords = [splitPoint];
      currentSegmentDistance = 0;
      currentSegmentStartWaytype = resolveWaytype(originalVertexIndex, waytypeValues);
      pCurrent = splitPoint;
      distToNext = getDistanceMeters(splitPoint, nextPoint);
    }

    if (distToNext > 0) {
      currentSegmentCoords.push(nextPoint);
      currentSegmentDistance += distToNext;
      prevPoint = nextPoint;
    }
  }

  // Handle remaining stretch (if > 15m, add as segment; else attach to previous segment if exists)
  if (currentSegmentDistance > 0 && currentSegmentCoords.length >= 2) {
    if (currentSegmentDistance < 15 && segments.length > 0) {
      // Append to previous segment
      const lastSeg = segments[segments.length - 1];
      lastSeg.coordinates.push(...currentSegmentCoords.slice(1));
      const endCoord = currentSegmentCoords[currentSegmentCoords.length - 1];
      lastSeg.end = { lat: endCoord[1], lng: endCoord[0] };
      lastSeg.lengthMeters = Math.round((lastSeg.lengthMeters + currentSegmentDistance) * 10) / 10;
      lastSeg.midpoint = {
        lat: (lastSeg.start.lat + lastSeg.end.lat) / 2,
        lng: (lastSeg.start.lng + lastSeg.end.lng) / 2
      };
    } else {
      const startCoord = currentSegmentCoords[0];
      const endCoord = currentSegmentCoords[currentSegmentCoords.length - 1];
      const midpointCoord = interpolate(startCoord, endCoord, 0.5);

      segments.push({
        index: segmentIndex++,
        start: { lat: startCoord[1], lng: startCoord[0] },
        end: { lat: endCoord[1], lng: endCoord[0] },
        midpoint: { lat: midpointCoord[1], lng: midpointCoord[0] },
        lengthMeters: Math.round(currentSegmentDistance * 10) / 10,
        waytype: currentSegmentStartWaytype,
        coordinates: currentSegmentCoords
      });
    }
  }

  return segments;
}
