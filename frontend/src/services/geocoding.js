/**
 * Geocoding service using Nominatim (OpenStreetMap).
 *
 * Usage policy:
 * - Max 1 request/second (debounced in components).
 * - Descriptive User-Agent for server-side environments.
 * - Results cached in session/localStorage cache.
 *
 * Docs: https://nominatim.org/release-docs/latest/api/Search/
 */

import { NOMINATIM_URL, SEARCH_DEBOUNCE_MS } from '../data/scoringWeights.js';
import { getCachedSearch, setCachedSearch } from '../utils/storage.js';

const USER_AGENT = 'SafeRouteApp/1.0 (educational safety navigation; contact: saferoute@example.com)';

async function executeNominatimFetch(params) {
  const headers = typeof window === 'undefined' ? { 'User-Agent': USER_AGENT } : {};
  const response = await fetch(`${NOMINATIM_URL}/search?${params}`, { headers });
  if (!response.ok) return [];
  const data = await response.json();
  if (!Array.isArray(data)) return [];

  return data.map((item) => ({
    id: item.place_id,
    displayName: item.display_name,
    shortName: buildShortName(item),
    lat: parseFloat(item.lat),
    lon: parseFloat(item.lon),
    type: item.type,
    category: item.category,
    boundingBox: item.boundingbox?.map(Number),
  }));
}

/**
 * Search for locations by text query.
 * Biases to countrycodes if provided, but automatically falls back to global search
 * if country-filtered results are empty.
 *
 * @param {string} query
 * @param {object} [options]
 * @param {string} [options.countrycodes='in'] ISO country code to bias results
 * @param {number} [options.limit=8]
 * @returns {Promise<Array>}
 */
export async function searchLocation(query, { countrycodes = 'in', limit = 8 } = {}) {
  if (!query || query.trim().length < 2) return [];

  const cacheKey = `${query.trim().toLowerCase()}_${countrycodes || 'global'}`;
  const cached = getCachedSearch(cacheKey);
  if (cached) return cached;

  try {
    const params = new URLSearchParams({
      q: query.trim(),
      format: 'json',
      addressdetails: '1',
      limit: String(limit),
      'accept-language': 'en',
    });

    if (countrycodes) {
      params.set('countrycodes', countrycodes);
    }

    let results = await executeNominatimFetch(params);

    // If country filter yielded 0 results, retry globally without country filter
    if ((!results || results.length === 0) && countrycodes) {
      params.delete('countrycodes');
      results = await executeNominatimFetch(params);
    }

    setCachedSearch(cacheKey, results || []);
    return results || [];
  } catch (err) {
    console.warn('[geocoding] Search query failed:', err.message);
    return [];
  }
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

  const headers = typeof window === 'undefined' ? { 'User-Agent': USER_AGENT } : {};
  const response = await fetch(`${NOMINATIM_URL}/reverse?${params}`, { headers });

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
  ].filter(Boolean);

  if (parts.length > 0) {
    return parts.slice(0, 2).join(', ');
  }

  return (item.display_name || '').split(',').slice(0, 2).join(', ').trim() || 'Selected Location';
}
