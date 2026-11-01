import { pool } from './pool.js';
import { env } from '../config/env.js';

// In-Memory Saved Routes Store for MOCK_MODE
let inMemorySavedRoutes = [];
let nextRouteId = 1;

/**
 * Normalizes route record from DB or in-memory store.
 */
function normalizeRoute(row) {
  return {
    id: String(row.id),
    name: row.name,
    summary: row.summary || '',
    distance: row.distance !== null ? Number(row.distance) : 0,
    duration: row.duration !== null ? Number(row.duration) : 0,
    provider: row.provider || '',
    safetyScore: row.safety_score !== null ? Number(row.safety_score) : null,
    coordinates: Array.isArray(row.coordinates) ? row.coordinates : (typeof row.coordinates === 'string' ? JSON.parse(row.coordinates) : []),
    savedAt: row.created_at || row.savedAt
  };
}

/**
 * List all saved routes belonging to the authenticated user.
 * @param {string|number} userId
 * @returns {Promise<Array>}
 */
export async function findSavedRoutesByUserId(userId) {
  const uid = String(userId);

  if (pool && !env.MOCK_MODE) {
    const query = `
      SELECT id, name, summary, distance, duration, provider, safety_score, coordinates, created_at
      FROM saved_routes
      WHERE user_id = $1
      ORDER BY created_at DESC;
    `;
    const res = await pool.query(query, [userId]);
    return res.rows.map(normalizeRoute);
  }

  return inMemorySavedRoutes
    .filter(r => r.userId === uid)
    .sort((a, b) => new Date(b.savedAt) - new Date(a.savedAt))
    .map(normalizeRoute);
}

/**
 * Save a new route for the authenticated user.
 * @param {string|number} userId
 * @param {object} routeData
 * @returns {Promise<object>}
 */
export async function createSavedRoute(userId, { name, summary, distance, duration, provider, safetyScore, coordinates }) {
  const uid = String(userId);

  if (pool && !env.MOCK_MODE) {
    const query = `
      INSERT INTO saved_routes (user_id, name, summary, distance, duration, provider, safety_score, coordinates, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
      RETURNING id, name, summary, distance, duration, provider, safety_score, coordinates, created_at;
    `;
    const res = await pool.query(query, [
      userId,
      (name || 'Saved Route').trim(),
      summary || '',
      distance || 0,
      duration || 0,
      provider || '',
      safetyScore !== undefined && safetyScore !== null ? Number(safetyScore) : null,
      JSON.stringify(coordinates || [])
    ]);
    return normalizeRoute(res.rows[0]);
  }

  const newRoute = {
    id: String(nextRouteId++),
    userId: uid,
    name: (name || 'Saved Route').trim(),
    summary: summary || '',
    distance: distance || 0,
    duration: duration || 0,
    provider: provider || '',
    safetyScore: safetyScore !== undefined && safetyScore !== null ? Number(safetyScore) : null,
    coordinates: coordinates || [],
    savedAt: new Date().toISOString()
  };

  inMemorySavedRoutes.push(newRoute);
  return normalizeRoute(newRoute);
}

/**
 * Delete a saved route belonging to the authenticated user.
 * @param {string|number} userId
 * @param {string|number} routeId
 * @returns {Promise<boolean>}
 */
export async function deleteSavedRoute(userId, routeId) {
  const uid = String(userId);
  const rid = String(routeId);

  if (pool && !env.MOCK_MODE) {
    const query = `
      DELETE FROM saved_routes
      WHERE id = $1 AND user_id = $2
      RETURNING id;
    `;
    const res = await pool.query(query, [routeId, userId]);
    if (res.rows.length === 0) {
      const err = new Error('Saved route not found or does not belong to you.');
      err.status = 404;
      throw err;
    }
    return true;
  }

  const idx = inMemorySavedRoutes.findIndex(r => r.id === rid && r.userId === uid);
  if (idx === -1) {
    const err = new Error('Saved route not found or does not belong to you.');
    err.status = 404;
    throw err;
  }

  inMemorySavedRoutes.splice(idx, 1);
  return true;
}

