import { pool } from './pool.js';
import { env } from '../config/env.js';

// In-Memory User Store for MOCK_MODE
let inMemoryUsers = [];
let inMemoryPasswordResets = [];
let nextUserId = 1;
let nextResetId = 1;

/**
 * Creates a new user record in PostgreSQL or in-memory mock store.
 * @param {object} params
 * @param {string} params.fullName
 * @param {string} params.email
 * @param {string} [params.mobile]
 * @param {string} params.passwordHash
 * @returns {Promise<object>} The created user (without password hash)
 */
export async function createUser({ fullName, email, mobile = '', passwordHash }) {
  const normalizedEmail = email.trim().toLowerCase();

  if (pool && !env.MOCK_MODE) {
    // Check duplicate
    const checkQuery = `SELECT id FROM users WHERE LOWER(email) = $1 LIMIT 1;`;
    const checkRes = await pool.query(checkQuery, [normalizedEmail]);
    if (checkRes.rows.length > 0) {
      const err = new Error('An account with this email address already exists.');
      err.code = 'EMAIL_EXISTS';
      err.status = 409;
      throw err;
    }

    const insertQuery = `
      INSERT INTO users (full_name, email, mobile, password_hash, email_verified, created_at, updated_at)
      VALUES ($1, $2, $3, $4, FALSE, NOW(), NOW())
      RETURNING id, full_name, email, mobile, photo_url, email_verified, created_at;
    `;
    const res = await pool.query(insertQuery, [fullName.trim(), normalizedEmail, mobile.trim(), passwordHash]);
    const row = res.rows[0];
    return {
      id: String(row.id),
      fullName: row.full_name,
      email: row.email,
      mobile: row.mobile || '',
      photoUrl: row.photo_url || '',
      emailVerified: Boolean(row.email_verified),
      createdAt: row.created_at
    };
  }

  // In-Memory Mock Store
  const exists = inMemoryUsers.some(u => u.email.toLowerCase() === normalizedEmail);
  if (exists) {
    const err = new Error('An account with this email address already exists.');
    err.code = 'EMAIL_EXISTS';
    err.status = 409;
    throw err;
  }

  const user = {
    id: String(nextUserId++),
    fullName: fullName.trim(),
    email: normalizedEmail,
    mobile: mobile ? mobile.trim() : '',
    passwordHash,
    photoUrl: '',
    emailVerified: false,
    createdAt: new Date().toISOString()
  };

  inMemoryUsers.push(user);

  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    mobile: user.mobile,
    photoUrl: user.photoUrl,
    emailVerified: user.emailVerified,
    createdAt: user.createdAt
  };
}

/**
 * Finds a user by email, returning the password hash for authentication.
 * @param {string} email
 * @returns {Promise<object|null>} User with passwordHash, or null
 */
export async function findUserByEmail(email) {
  const normalizedEmail = email.trim().toLowerCase();

  if (pool && !env.MOCK_MODE) {
    const query = `
      SELECT id, full_name, email, mobile, password_hash, photo_url, email_verified, created_at
      FROM users
      WHERE LOWER(email) = $1
      LIMIT 1;
    `;
    const res = await pool.query(query, [normalizedEmail]);
    if (res.rows.length === 0) return null;
    const row = res.rows[0];
    return {
      id: String(row.id),
      fullName: row.full_name,
      email: row.email,
      mobile: row.mobile || '',
      passwordHash: row.password_hash,
      photoUrl: row.photo_url || '',
      emailVerified: Boolean(row.email_verified),
      createdAt: row.created_at
    };
  }

  const user = inMemoryUsers.find(u => u.email.toLowerCase() === normalizedEmail);
  if (!user) return null;
  return { ...user };
}

/**
 * Finds a user by ID, returning public fields (no password hash).
 * @param {string|number} id
 * @returns {Promise<object|null>} Safe user object or null
 */
export async function findUserById(id) {
  const userIdStr = String(id);

  if (pool && !env.MOCK_MODE) {
    const query = `
      SELECT id, full_name, email, mobile, photo_url, email_verified, created_at
      FROM users
      WHERE id = $1
      LIMIT 1;
    `;
    const res = await pool.query(query, [id]);
    if (res.rows.length === 0) return null;
    const row = res.rows[0];
    return {
      id: String(row.id),
      fullName: row.full_name,
      email: row.email,
      mobile: row.mobile || '',
      photoUrl: row.photo_url || '',
      emailVerified: Boolean(row.email_verified),
      createdAt: row.created_at
    };
  }

  const user = inMemoryUsers.find(u => u.id === userIdStr);
  if (!user) return null;
  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    mobile: user.mobile,
    photoUrl: user.photoUrl,
    emailVerified: user.emailVerified,
    createdAt: user.createdAt
  };
}

/**
 * Updates a user's profile information.
 * @param {string|number} id
 * @param {object} updates
 * @returns {Promise<object>} Updated user object
 */
export async function updateUserProfile(id, { fullName, mobile, photoUrl }) {
  const userIdStr = String(id);

  if (pool && !env.MOCK_MODE) {
    const query = `
      UPDATE users
      SET full_name = COALESCE($2, full_name),
          mobile = COALESCE($3, mobile),
          photo_url = COALESCE($4, photo_url),
          updated_at = NOW()
      WHERE id = $1
      RETURNING id, full_name, email, mobile, photo_url, email_verified, created_at;
    `;
    const res = await pool.query(query, [id, fullName, mobile, photoUrl]);
    if (res.rows.length === 0) {
      const err = new Error('User not found.');
      err.status = 404;
      throw err;
    }
    const row = res.rows[0];
    return {
      id: String(row.id),
      fullName: row.full_name,
      email: row.email,
      mobile: row.mobile || '',
      photoUrl: row.photo_url || '',
      emailVerified: Boolean(row.email_verified),
      createdAt: row.created_at
    };
  }

  const user = inMemoryUsers.find(u => u.id === userIdStr);
  if (!user) {
    const err = new Error('User not found.');
    err.status = 404;
    throw err;
  }

  if (fullName !== undefined) user.fullName = fullName.trim();
  if (mobile !== undefined) user.mobile = mobile.trim();
  if (photoUrl !== undefined) user.photoUrl = photoUrl;
  user.updatedAt = new Date().toISOString();

  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    mobile: user.mobile,
    photoUrl: user.photoUrl,
    emailVerified: user.emailVerified,
    createdAt: user.createdAt
  };
}

/**
 * Creates a password reset record.
 * @param {string|number} userId
 * @param {string} tokenHash
 * @param {Date} expiresAt
 */
export async function createPasswordReset(userId, tokenHash, expiresAt) {
  if (pool && !env.MOCK_MODE) {
    const query = `
      INSERT INTO password_resets (user_id, token_hash, expires_at, used, created_at)
      VALUES ($1, $2, $3, FALSE, NOW())
      RETURNING id;
    `;
    await pool.query(query, [userId, tokenHash, expiresAt]);
    return;
  }

  inMemoryPasswordResets.push({
    id: String(nextResetId++),
    userId: String(userId),
    tokenHash,
    expiresAt,
    used: false,
    createdAt: new Date()
  });
}

/**
 * Finds a valid, unused password reset token.
 * @param {string} tokenHash
 * @returns {Promise<object|null>}
 */
export async function findValidPasswordReset(tokenHash) {
  const now = new Date();

  if (pool && !env.MOCK_MODE) {
    const query = `
      SELECT id, user_id, token_hash, expires_at, used
      FROM password_resets
      WHERE token_hash = $1 AND used = FALSE AND expires_at > NOW()
      ORDER BY id DESC
      LIMIT 1;
    `;
    const res = await pool.query(query, [tokenHash]);
    if (res.rows.length === 0) return null;
    const row = res.rows[0];
    return {
      id: row.id,
      userId: String(row.user_id),
      tokenHash: row.token_hash,
      expiresAt: row.expires_at,
      used: row.used
    };
  }

  const reset = inMemoryPasswordResets.find(
    r => r.tokenHash === tokenHash && !r.used && new Date(r.expiresAt) > now
  );
  return reset || null;
}

/**
 * Marks a password reset token as used and updates the user's password.
 * @param {string|number} resetId
 * @param {string|number} userId
 * @param {string} newPasswordHash
 */
export async function completePasswordReset(resetId, userId, newPasswordHash) {
  if (pool && !env.MOCK_MODE) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`UPDATE password_resets SET used = TRUE WHERE id = $1;`, [resetId]);
      await client.query(`UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2;`, [newPasswordHash, userId]);
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
    return;
  }

  const reset = inMemoryPasswordResets.find(r => String(r.id) === String(resetId));
  if (reset) reset.used = true;

  const user = inMemoryUsers.find(u => String(u.id) === String(userId));
  if (user) {
    user.passwordHash = newPasswordHash;
    user.updatedAt = new Date().toISOString();
  }
}

/**
 * Marks a user's email as verified.
 * @param {string|number} userId
 */
export async function setUserEmailVerified(userId) {
  if (pool && !env.MOCK_MODE) {
    await pool.query(`UPDATE users SET email_verified = TRUE, updated_at = NOW() WHERE id = $1;`, [userId]);
    return;
  }
  const user = inMemoryUsers.find(u => String(u.id) === String(userId));
  if (user) user.emailVerified = true;
}

/**
 * Clears in-memory users (for testing)
 */
export function clearMockUsers() {
  inMemoryUsers = [];
  inMemoryPasswordResets = [];
  nextUserId = 1;
  nextResetId = 1;
}

