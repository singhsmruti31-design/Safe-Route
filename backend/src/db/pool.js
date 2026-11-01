import pg from 'pg';
import { env } from '../config/env.js';

const { Pool } = pg;

let pool = null;

// Only initialize PostgreSQL pool if DATABASE_URL is configured
if (env.DATABASE_URL) {
  const isSupabaseOrRemote = env.DATABASE_URL.includes('supabase') || env.DATABASE_URL.includes('sslmode=require');
  
  pool = new Pool({
    connectionString: env.DATABASE_URL,
    ssl: isSupabaseOrRemote ? { rejectUnauthorized: false } : undefined,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000
  });

  pool.on('error', (err) => {
    console.error('Unexpected error on idle PostgreSQL client:', err.message);
  });
}

/**
 * Executes a SQL query against PostgreSQL, or throws if not configured
 * @param {string} text 
 * @param {Array} params 
 * @returns {Promise<pg.QueryResult>}
 */
export async function query(text, params) {
  if (!pool) {
    throw new Error('Database pool is not configured. Check DATABASE_URL or enable MOCK_MODE.');
  }
  return pool.query(text, params);
}

/**
 * Checks the database connection and PostGIS availability.
 * @returns {Promise<{ status: string, details?: any, mock: boolean }>}
 */
export async function checkDatabaseHealth() {
  if (env.MOCK_MODE && !pool) {
    return {
      status: 'mock',
      mock: true,
      message: 'Running in MOCK_MODE (No live database connected). Using in-memory mock datasets.'
    };
  }

  if (!pool) {
    return {
      status: 'disconnected',
      mock: false,
      message: 'DATABASE_URL is not set.'
    };
  }

  try {
    const start = Date.now();
    // Test both basic connection and PostGIS function
    const res = await pool.query(`
      SELECT 
        1 AS healthy,
        (SELECT default_version FROM pg_available_extensions WHERE name = 'postgis') AS postgis_available,
        (SELECT extversion FROM pg_extension WHERE extname = 'postgis') AS postgis_installed
    `);
    const duration = Date.now() - start;

    return {
      status: 'connected',
      mock: false,
      latencyMs: duration,
      postgisInstalled: !!res.rows[0]?.postgis_installed,
      postgisVersion: res.rows[0]?.postgis_installed || 'not_installed'
    };
  } catch (err) {
    return {
      status: 'error',
      mock: env.MOCK_MODE,
      error: err.message
    };
  }
}

export { pool };
