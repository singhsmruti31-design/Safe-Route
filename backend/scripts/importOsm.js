#!/usr/bin/env node

/**
 * OpenStreetMap (Overpass API) Data Importer for Safe Route App
 * Fetches: amenity=police, amenity=hospital, amenity=pharmacy, amenity=fuel, amenity=atm,
 * and shop=* with opening_hours.
 * 
 * Usage:
 *   npm run import -- "City Name"
 *   node scripts/importOsm.js --bbox=minLat,minLng,maxLat,maxLng
 */

import { upsertPlaces } from '../src/db/placesRepo.js';
import { pool } from '../src/db/pool.js';
import { env } from '../src/config/env.js';

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter'
];

/**
 * Resolves a city name to a bounding box [minLat, minLng, maxLat, maxLng] via Nominatim
 */
async function getCityBoundingBox(cityName) {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(cityName)}&format=json&limit=1`;
  const response = await fetch(url, {
    headers: { 'User-Agent': 'SafeRouteBackend/1.0 (anti-gravity safe route importer)' }
  });

  if (!response.ok) {
    throw new Error(`Nominatim geocoding failed with status ${response.status}`);
  }

  const data = await response.json();
  if (!data || data.length === 0) {
    throw new Error(`City "${cityName}" not found.`);
  }

  // Nominatim returns [south, north, west, east]
  const [minLat, maxLat, minLng, maxLng] = data[0].boundingbox.map(parseFloat);
  return { minLat, minLng, maxLat, maxLng, displayName: data[0].display_name };
}

/**
 * Constructs the Overpass QL query string
 */
function buildOverpassQuery(minLat, minLng, maxLat, maxLng) {
  const bboxStr = `${minLat},${minLng},${maxLat},${maxLng}`;
  return `
    [out:json][timeout:60];
    (
      node["amenity"="police"](${bboxStr});
      way["amenity"="police"](${bboxStr});
      
      node["amenity"="hospital"](${bboxStr});
      way["amenity"="hospital"](${bboxStr});
      
      node["amenity"="pharmacy"](${bboxStr});
      way["amenity"="pharmacy"](${bboxStr});
      
      node["amenity"="fuel"](${bboxStr});
      way["amenity"="fuel"](${bboxStr});
      
      node["amenity"="atm"](${bboxStr});
      way["amenity"="atm"](${bboxStr});
      
      node["shop"]["opening_hours"](${bboxStr});
      way["shop"]["opening_hours"](${bboxStr});
    );
    out center;
  `;
}

/**
 * Executes the Overpass query with retry logic and fallback endpoints
 */
async function fetchOverpassData(query) {
  let lastError = null;

  for (const endpoint of OVERPASS_ENDPOINTS) {
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        console.log(`Querying Overpass mirror: ${endpoint} (Attempt ${attempt}/3)...`);
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: `data=${encodeURIComponent(query)}`
        });

        if (response.status === 429 || response.status === 504) {
          console.warn(`Mirror ${endpoint} returned status ${response.status}. Retrying in ${attempt * 2}s...`);
          await new Promise(r => setTimeout(r, attempt * 2000));
          continue;
        }

        if (!response.ok) {
          throw new Error(`Overpass error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        return data.elements || [];
      } catch (err) {
        lastError = err;
        console.warn(`Attempt ${attempt} on ${endpoint} failed: ${err.message}`);
        await new Promise(r => setTimeout(r, 1000 * attempt));
      }
    }
  }

  throw new Error(`All Overpass mirrors failed. Last error: ${lastError?.message}`);
}

/**
 * Normalizes raw OSM elements into our DB schema format
 */
function normalizeOsmElement(element) {
  const tags = element.tags || {};
  const lat = element.lat || element.center?.lat;
  const lng = element.lon || element.center?.lon;

  if (lat === undefined || lng === undefined) return null;

  let type = null;
  if (tags.amenity === 'police') type = 'police';
  else if (tags.amenity === 'hospital') type = 'hospital';
  else if (tags.amenity === 'pharmacy') type = 'pharmacy';
  else if (tags.amenity === 'fuel') type = 'fuel';
  else if (tags.amenity === 'atm') type = 'atm';
  else if (tags.shop) type = 'shop24';

  if (!type) return null;

  const openingHours = tags.opening_hours || null;
  const is24_7 = tags.opening_hours === '24/7' || tags['24/7'] === 'yes';

  return {
    osm_id: element.id,
    type,
    name: tags.name || tags.brand || `Unnamed ${type}`,
    lat,
    lng,
    opening_hours: openingHours,
    is_24_7: is24_7
  };
}

/**
 * Main import runner
 */
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error('Usage: npm run import -- "City Name"');
    console.error('   or: node scripts/importOsm.js --bbox=minLat,minLng,maxLat,maxLng');
    process.exit(1);
  }

  let bbox;
  let targetDesc;

  const bboxArg = args.find(a => a.startsWith('--bbox='));
  if (bboxArg) {
    const coords = bboxArg.replace('--bbox=', '').split(',').map(parseFloat);
    if (coords.length !== 4 || coords.some(isNaN)) {
      console.error('Invalid --bbox format. Expected --bbox=minLat,minLng,maxLat,maxLng');
      process.exit(1);
    }
    bbox = { minLat: coords[0], minLng: coords[1], maxLat: coords[2], maxLng: coords[3] };
    targetDesc = `Bounding Box: [${bbox.minLat}, ${bbox.minLng}, ${bbox.maxLat}, ${bbox.maxLng}]`;
  } else {
    const cityName = args.filter(a => !a.startsWith('--')).join(' ');
    console.log(`Resolving bounding box for "${cityName}" via Nominatim...`);
    const resolved = await getCityBoundingBox(cityName);
    bbox = resolved;
    targetDesc = `${cityName} (${resolved.displayName})`;
  }

  console.log(`Target: ${targetDesc}`);
  console.log(`Fetching help points from OpenStreetMap Overpass API...`);

  const query = buildOverpassQuery(bbox.minLat, bbox.minLng, bbox.maxLat, bbox.maxLng);
  const elements = await fetchOverpassData(query);

  console.log(`Received ${elements.length} raw OSM elements.`);

  const normalized = elements.map(normalizeOsmElement).filter(Boolean);
  console.log(`Normalized ${normalized.length} valid help places.`);

  // Group by type for summary logging
  const counts = normalized.reduce((acc, p) => {
    acc[p.type] = (acc[p.type] || 0) + 1;
    return acc;
  }, {});
  console.log('Breakdown by category:', counts);

  console.log('Upserting into database...');
  const result = await upsertPlaces(normalized);

  console.log(`Successfully stored ${result.count} places.`);
  if (env.MOCK_MODE) {
    console.log('[Notice] Imported into in-memory mock repository (MOCK_MODE=true).');
  }

  if (pool) {
    await pool.end();
  }
}

// Execute if run from CLI
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('importOsm.js')) {
  main().catch(err => {
    console.error('Import failed:', err.message);
    if (pool) pool.end();
    process.exit(1);
  });
}

export { buildOverpassQuery, normalizeOsmElement, getCityBoundingBox };
