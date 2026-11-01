import { pool } from './pool.js';
import { env } from '../config/env.js';
import { defaultMockPlaces, calculateHaversineDistanceMeters } from './mockPlacesData.js';

let inMemoryPlaces = [...defaultMockPlaces];

/**
 * Inserts or updates places into the database (or in-memory mock store)
 * @param {Array<Object>} places 
 */
export async function upsertPlaces(places) {
  if (!places || places.length === 0) return { inserted: 0, updated: 0 };

  if (pool && !env.MOCK_MODE) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      let count = 0;
      for (const place of places) {
        const queryText = `
          INSERT INTO places (osm_id, type, name, geom, opening_hours, is_24_7, updated_at)
          VALUES (
            $1, $2, $3,
            ST_SetSRID(ST_MakePoint($4, $5), 4326)::geography,
            $6, $7, NOW()
          )
          ON CONFLICT (osm_id) DO UPDATE SET
            type = EXCLUDED.type,
            name = EXCLUDED.name,
            geom = EXCLUDED.geom,
            opening_hours = EXCLUDED.opening_hours,
            is_24_7 = EXCLUDED.is_24_7,
            updated_at = NOW();
        `;
        await client.query(queryText, [
          place.osm_id,
          place.type,
          place.name || null,
          place.lng,
          place.lat,
          place.opening_hours || null,
          Boolean(place.is_24_7)
        ]);
        count++;
      }
      await client.query('COMMIT');
      return { count };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } else {
    // In-memory update for mock mode
    for (const place of places) {
      const idx = inMemoryPlaces.findIndex(p => p.osm_id === place.osm_id);
      if (idx >= 0) {
        inMemoryPlaces[idx] = { ...inMemoryPlaces[idx], ...place };
      } else {
        inMemoryPlaces.push({
          id: inMemoryPlaces.length + 1,
          ...place
        });
      }
    }
    return { count: places.length };
  }
}

/**
 * Queries nearby places within a radius using PostGIS ST_DWithin or in-memory Haversine distance
 * @param {Object} params
 * @param {number} params.lat
 * @param {number} params.lng
 * @param {number} params.radiusMeters
 * @param {Array<string>} [params.types]
 * @returns {Promise<Array<Object>>}
 */
export async function findNearbyPlaces({ lat, lng, radiusMeters = 1000, types = [] }) {
  if (pool && !env.MOCK_MODE) {
    const typesFilter = types && types.length > 0 ? types : null;
    const queryText = `
      SELECT 
        id,
        osm_id,
        type,
        name,
        ST_Y(geom::geometry) AS lat,
        ST_X(geom::geometry) AS lng,
        ROUND(ST_Distance(geom, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography)::numeric, 1) AS distance_meters,
        opening_hours,
        is_24_7
      FROM places
      WHERE ST_DWithin(geom, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, $3)
        AND ($4::text[] IS NULL OR type = ANY($4::text[]))
      ORDER BY distance_meters ASC
      LIMIT 100;
    `;
    const res = await pool.query(queryText, [lng, lat, radiusMeters, typesFilter]);
    return res.rows.map(row => ({
      id: row.id,
      osm_id: row.osm_id,
      type: row.type,
      name: row.name,
      lat: parseFloat(row.lat),
      lng: parseFloat(row.lng),
      distance_meters: parseFloat(row.distance_meters),
      opening_hours: row.opening_hours,
      is_24_7: Boolean(row.is_24_7)
    }));
  }

  // Fallback in-memory mock search
  let placesToSearch = [...inMemoryPlaces];

  // If queried point is far away from mock data, generate contextual sample points nearby
  const closestExisting = placesToSearch
    .map(p => calculateHaversineDistanceMeters(lat, lng, p.lat, p.lng))
    .sort((a, b) => a - b)[0];

  if (closestExisting === undefined || closestExisting > 50000) {
    // Generate simulated nearby points around requested coordinate for mock testing
    placesToSearch = [
      { id: 101, osm_id: 2001, type: 'police', name: 'District Police Post', lat: lat + 0.002, lng: lng + 0.002, opening_hours: '24/7', is_24_7: true },
      { id: 102, osm_id: 2002, type: 'hospital', name: 'Community Medical Center', lat: lat + 0.005, lng: lng - 0.003, opening_hours: '24/7', is_24_7: true },
      { id: 103, osm_id: 2003, type: 'pharmacy', name: '24hr Care Pharmacy', lat: lat + 0.001, lng: lng - 0.001, opening_hours: '24/7', is_24_7: true },
      { id: 104, osm_id: 2004, type: 'fuel', name: 'Express Fuel & Convenience', lat: lat - 0.002, lng: lng + 0.001, opening_hours: '24/7', is_24_7: true },
      { id: 105, osm_id: 2005, type: 'shop24', name: 'All-Night Mart', lat: lat - 0.001, lng: lng - 0.002, opening_hours: '24/7', is_24_7: true },
      { id: 106, osm_id: 2006, type: 'atm', name: '24hr Secure ATM', lat: lat + 0.0008, lng: lng + 0.0009, opening_hours: '24/7', is_24_7: true },
      { id: 107, osm_id: 2007, type: 'pharmacy', name: 'Daytime Clinic & Dispensary', lat: lat + 0.0015, lng: lng + 0.001, opening_hours: 'Mo-Fr 09:00-18:00', is_24_7: false }
    ];
  }

  const results = placesToSearch
    .map(p => {
      const distance = calculateHaversineDistanceMeters(lat, lng, p.lat, p.lng);
      return {
        ...p,
        distance_meters: Math.round(distance * 10) / 10
      };
    })
    .filter(p => p.distance_meters <= radiusMeters)
    .filter(p => (types.length === 0 || types.includes(p.type)))
    .sort((a, b) => a.distance_meters - b.distance_meters);

  return results;
}
