import { pool } from './pool.js';
import { env } from '../config/env.js';
import { calculateHaversineDistanceMeters } from './mockPlacesData.js';

let inMemoryReports = [
  {
    id: 1,
    lat: 51.5074,
    lng: -0.1278,
    type: 'safe_spot',
    note: 'Well lit security booth near station',
    status: 'approved',
    ip_hash: 'initial_seed_hash',
    created_at: new Date(Date.now() - 3600000).toISOString()
  }
];

/**
 * Checks if a report from the same hashed IP already exists within 50m in the last 24 hours.
 */
export async function isDuplicateReport({ lat, lng, ipHash }) {
  if (pool && !env.MOCK_MODE) {
    const queryText = `
      SELECT id FROM reports
      WHERE ip_hash = $1
        AND created_at > NOW() - INTERVAL '24 hours'
        AND ST_DWithin(geom, ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography, 50)
      LIMIT 1;
    `;
    const res = await pool.query(queryText, [ipHash, lng, lat]);
    return res.rows.length > 0;
  }

  // In-memory duplicate check
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  return inMemoryReports.some(r => {
    if (r.ip_hash !== ipHash) return false;
    const reportTime = new Date(r.created_at).getTime();
    if (now - reportTime > dayMs) return false;
    const distance = calculateHaversineDistanceMeters(lat, lng, r.lat, r.lng);
    return distance <= 50;
  });
}

/**
 * Creates a new report with status 'pending'
 */
export async function createReport({ lat, lng, type, note, ipHash, userId = null }) {
  const isDupe = await isDuplicateReport({ lat, lng, ipHash });
  if (isDupe) {
    const err = new Error('Spam prevention: A report within 50 meters was already submitted by your IP in the last 24 hours.');
    err.status = 409;
    throw err;
  }

  if (pool && !env.MOCK_MODE) {
    const queryText = `
      INSERT INTO reports (geom, type, note, status, ip_hash, user_id, created_at)
      VALUES (ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, $3, $4, 'pending', $5, $6, NOW())
      RETURNING 
        id,
        user_id,
        type,
        note,
        status,
        ST_Y(geom::geometry) AS lat,
        ST_X(geom::geometry) AS lng,
        created_at;
    `;
    const res = await pool.query(queryText, [lng, lat, type, note || null, ipHash, userId || null]);
    const row = res.rows[0];
    return {
      id: row.id,
      user_id: row.user_id,
      type: row.type,
      note: row.note,
      status: row.status,
      coordinates: { lat: parseFloat(row.lat), lng: parseFloat(row.lng) },
      created_at: row.created_at
    };
  }

  // In-memory mock storage
  const newReport = {
    id: inMemoryReports.length + 1,
    user_id: userId || null,
    lat,
    lng,
    type,
    note: note || null,
    status: 'pending',
    ip_hash: ipHash,
    created_at: new Date().toISOString()
  };
  inMemoryReports.push(newReport);

  return {
    id: newReport.id,
    user_id: newReport.user_id,
    type: newReport.type,
    note: newReport.note,
    status: newReport.status,
    coordinates: { lat: newReport.lat, lng: newReport.lng },
    created_at: newReport.created_at
  };
}

/**
 * Retrieves only APPROVED reports inside a bounding box
 */
export async function getApprovedReportsInBbox({ minLng, minLat, maxLng, maxLat }) {
  if (pool && !env.MOCK_MODE) {
    const queryText = `
      SELECT 
        id,
        user_id,
        type,
        note,
        status,
        ST_Y(geom::geometry) AS lat,
        ST_X(geom::geometry) AS lng,
        created_at
      FROM reports
      WHERE status = 'approved'
        AND geom && ST_MakeEnvelope($1, $2, $3, $4, 4326)
      ORDER BY created_at DESC
      LIMIT 200;
    `;
    const res = await pool.query(queryText, [minLng, minLat, maxLng, maxLat]);
    return res.rows.map(row => ({
      id: row.id,
      user_id: row.user_id,
      type: row.type,
      note: row.note,
      status: row.status,
      coordinates: { lat: parseFloat(row.lat), lng: parseFloat(row.lng) },
      created_at: row.created_at
    }));
  }

  // In-memory mock retrieval
  return inMemoryReports
    .filter(r => r.status === 'approved')
    .filter(r => r.lng >= minLng && r.lng <= maxLng && r.lat >= minLat && r.lat <= maxLat)
    .map(r => ({
      id: r.id,
      type: r.type,
      note: r.note,
      status: r.status,
      coordinates: { lat: r.lat, lng: r.lng },
      created_at: r.created_at
    }));
}

/**
 * Updates status of a report to 'approved' or 'rejected'
 */
export async function updateReportStatus(id, newStatus) {
  if (pool && !env.MOCK_MODE) {
    const queryText = `
      UPDATE reports
      SET status = $1
      WHERE id = $2
      RETURNING 
        id,
        user_id,
        type,
        note,
        status,
        ST_Y(geom::geometry) AS lat,
        ST_X(geom::geometry) AS lng,
        created_at;
    `;
    const res = await pool.query(queryText, [newStatus, id]);
    if (res.rows.length === 0) return null;
    const row = res.rows[0];
    return {
      id: row.id,
      user_id: row.user_id,
      type: row.type,
      note: row.note,
      status: row.status,
      coordinates: { lat: parseFloat(row.lat), lng: parseFloat(row.lng) },
      created_at: row.created_at
    };
  }

  // In-memory update
  const report = inMemoryReports.find(r => r.id === parseInt(id, 10));
  if (!report) return null;
  report.status = newStatus;
  return {
    id: report.id,
    user_id: report.user_id,
    type: report.type,
    note: report.note,
    status: report.status,
    coordinates: { lat: report.lat, lng: report.lng },
    created_at: report.created_at
  };
}

/**
 * Retrieves all reports submitted by a specific user.
 */
export async function getUserReports(userId) {
  if (pool && !env.MOCK_MODE) {
    const queryText = `
      SELECT
        id,
        user_id,
        type,
        note,
        status,
        ST_Y(geom::geometry) AS lat,
        ST_X(geom::geometry) AS lng,
        created_at
      FROM reports
      WHERE user_id = $1
      ORDER BY created_at DESC;
    `;
    const res = await pool.query(queryText, [userId]);
    return res.rows.map(row => ({
      id: row.id,
      user_id: row.user_id,
      type: row.type,
      note: row.note,
      status: row.status,
      coordinates: { lat: parseFloat(row.lat), lng: parseFloat(row.lng) },
      created_at: row.created_at
    }));
  }

  // In-memory retrieval
  return inMemoryReports
    .filter(r => r.user_id && String(r.user_id) === String(userId))
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .map(r => ({
      id: r.id,
      user_id: r.user_id,
      type: r.type,
      note: r.note,
      status: r.status,
      coordinates: { lat: r.lat, lng: r.lng },
      created_at: r.created_at
    }));
}

/**
 * Deletes a report belonging to a specific user.
 */
export async function deleteUserReport(id, userId) {
  if (pool && !env.MOCK_MODE) {
    const queryText = `
      DELETE FROM reports
      WHERE id = $1 AND user_id = $2
      RETURNING id;
    `;
    const res = await pool.query(queryText, [id, userId]);
    return res.rows.length > 0;
  }

  // In-memory deletion
  const idx = inMemoryReports.findIndex(r => String(r.id) === String(id) && String(r.user_id) === String(userId));
  if (idx === -1) return false;
  inMemoryReports.splice(idx, 1);
  return true;
}
