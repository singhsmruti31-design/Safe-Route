/**
 * Geocoding service using Nominatim (OpenStreetMap).
 *
 * Usage policy:
 * - Max 1 request/second (we use debouncing in components).
 * - Include a descriptive User-Agent.
 * - Do not use for bulk geocoding.
 * - Results are cached in sessionStorage for this session.
 *
 * Docs: https://nominatim.org/release-docs/latest/api/Search/
 */

import { NOMINATIM_URL, SEARCH_DEBOUNCE_MS } from '../data/scoringWeights.js';
import { getCachedSearch, setCachedSearch } from '../utils/storage.js';

const USER_AGENT = 'SafeRouteApp/1.0 (educational safety navigation; contact: saferoute@example.com)';

/**
 * Search for locations by text query.
 * @param {string} query
 * @param {object} [options]
 * @param {string} [options.countrycodes='in'] ISO country code to bias results
 * @param {number} [options.limit=8]
 * @returns {Promise<Array>}
 */
export async function searchLocation(query, { countrycodes = 'in', limit = 8 } = {}) {
  if (!query || query.trim().length < 2) return [];

  const cacheKey = `${query.trim().toLowerCase()}_${countrycodes}`;
  const cached = getCachedSearch(cacheKey);
  if (cached) return cached;

  const params = new URLSearchParams({
    q: query.trim(),
    format: 'json',
    addressdetails: '1',
    limit: String(limit),
    countrycodes,
    'accept-language': 'en',
  });

  const response = await fetch(`${NOMINATIM_URL}/search?${params}`, {
    headers: { 'User-Agent': USER_AGENT },
  });

  if (!response.ok) {
    throw new Error(`Geocoding failed: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();

  const results = data.map((item) => ({
    id: item.place_id,
    displayName: item.display_name,
    shortName: buildShortName(item),
    lat: parseFloat(item.lat),
    lon: parseFloat(item.lon),
    type: item.type,
    category: item.category,
    boundingBox: item.boundingbox?.map(Number),
  }));

  setCachedSearch(cacheKey, results);
  return results;
}

/**
 * Reverse geocode a [lat, lon] to a human-readable address.
 */
export async function reverseGeocode(lat, lon) {
  const params = new URLSearchParams({
    lat: String(lat),
    lon: String(lon),
    format: 'json',
    'accept-language': 'en',
    addressdetails: '1',
  });

  const response = await fetch(`${NOMINATIM_URL}/reverse?${params}`, {
    headers: { 'User-Agent': USER_AGENT },
  });

  if (!response.ok) throw new Error('Reverse geocoding failed');

  const data = await response.json();

  return {
    displayName: data.display_name,
    shortName: buildShortName(data),
    lat: parseFloat(data.lat),
    lon: parseFloat(data.lon),
    address: data.address,
  };
}

function buildShortName(item) {
  const addr = item.address || {};
  const parts = [
    item.name || addr.amenity || addr.building || addr.road,
    addr.suburb || addr.neighbourhood || addr.village || addr.town || addr.city,
    addr.state,
  ].filter(Boolean);
  return parts.slice(0, 3).join(', ') || item.display_name?.split(',')[0] || 'Location';
}
