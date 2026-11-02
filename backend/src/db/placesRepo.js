import { pool } from './pool.js';
import { env } from '../config/env.js';

/**
 * Save only real places to the database.
 */
export async function upsertPlaces(places) {
  if (!places || places.length === 0) {
    return { inserted: 0, updated: 0 };
  }

  if (!pool || env.MOCK_MODE) {
    throw new Error('Live places database is unavailable.');
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    let count = 0;

    for (const place of places) {
      const queryText = `
        INSERT INTO places (
          osm_id, type, name, geom,
          opening_hours, is_24_7, updated_at
        )
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
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Find nearby places using real PostGIS database records only.
 */
export async function findNearbyPlaces({
  lat,
  lng,
  radiusMeters = 1000,
  types = []
}) {
  if (!pool || env.MOCK_MODE) {
    return [];
  }

  const typesFilter = types.length > 0 ? types : null;

  const queryText = `
    SELECT
      id,
      osm_id,
      type,
      name,
      ST_Y(geom::geometry) AS lat,
      ST_X(geom::geometry) AS lng,
      ROUND(
        ST_Distance(
          geom,
          ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
        )::numeric, 1
      ) AS distance_meters,
      opening_hours,
      is_24_7
    FROM places
    WHERE ST_DWithin(
      geom,
      ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
      $3
    )
    AND ($4::text[] IS NULL OR type = ANY($4::text[]))
    ORDER BY distance_meters ASC
    LIMIT 100;
  `;

  const result = await pool.query(queryText, [
    lng,
    lat,
    radiusMeters,
    typesFilter
  ]);

  return result.rows.map(row => ({
    ...row,
    lat: Number(row.lat),
    lng: Number(row.lng),
    distance_meters: Number(row.distance_meters),
    is_24_7: Boolean(row.is_24_7)
  }));
}