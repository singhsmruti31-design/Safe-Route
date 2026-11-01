import { pool } from './pool.js';
import { env } from '../config/env.js';

// In-Memory Contacts Store for MOCK_MODE
let inMemoryContacts = [];
let nextContactId = 1;

/**
 * Normalizes contact record from DB or in-memory store.
 */
function normalizeContact(row) {
  return {
    id: String(row.id),
    name: row.name,
    phone: row.phone,
    relationship: row.relationship || 'Other',
    isPrimary: Boolean(row.is_primary ?? row.isPrimary),
    createdAt: row.created_at || row.createdAt
  };
}

/**
 * List all contacts belonging to the authenticated user.
 * @param {string|number} userId
 * @returns {Promise<Array>} Array of contact objects
 */
export async function findContactsByUserId(userId) {
  const uid = String(userId);

  if (pool && !env.MOCK_MODE) {
    const query = `
      SELECT id, name, phone, relationship, is_primary, created_at
      FROM emergency_contacts
      WHERE user_id = $1
      ORDER BY is_primary DESC, created_at ASC;
    `;
    const res = await pool.query(query, [userId]);
    return res.rows.map(normalizeContact);
  }

  return inMemoryContacts
    .filter(c => c.userId === uid)
    .sort((a, b) => (b.isPrimary ? 1 : 0) - (a.isPrimary ? 1 : 0))
    .map(normalizeContact);
}

/**
 * Create a new emergency contact for the authenticated user.
 * @param {string|number} userId
 * @param {object} contact
 * @returns {Promise<object>} Created contact
 */
export async function createContact(userId, { name, phone, relationship = 'Other', isPrimary = false }) {
  const uid = String(userId);

  if (pool && !env.MOCK_MODE) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // If set as primary, unset any existing primary for this user
      if (isPrimary) {
        await client.query(
          `UPDATE emergency_contacts SET is_primary = FALSE WHERE user_id = $1;`,
          [userId]
        );
      }

      // If this is the user's first contact, make it primary automatically
      const countRes = await client.query(
        `SELECT COUNT(*) FROM emergency_contacts WHERE user_id = $1;`,
        [userId]
      );
      const isFirst = parseInt(countRes.rows[0].count, 10) === 0;
      const finalPrimary = isPrimary || isFirst;

      const insertQuery = `
        INSERT INTO emergency_contacts (user_id, name, phone, relationship, is_primary, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
        RETURNING id, name, phone, relationship, is_primary, created_at;
      `;
      const res = await client.query(insertQuery, [userId, name.trim(), phone.trim(), relationship, finalPrimary]);
      await client.query('COMMIT');
      return normalizeContact(res.rows[0]);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  // In-Memory Mock Store
  const userContacts = inMemoryContacts.filter(c => c.userId === uid);
  const isFirst = userContacts.length === 0;
  const finalPrimary = Boolean(isPrimary || isFirst);

  if (finalPrimary) {
    userContacts.forEach(c => { c.isPrimary = false; });
  }

  const newContact = {
    id: String(nextContactId++),
    userId: uid,
    name: name.trim(),
    phone: phone.trim(),
    relationship: relationship || 'Other',
    isPrimary: finalPrimary,
    createdAt: new Date().toISOString()
  };

  inMemoryContacts.push(newContact);
  return normalizeContact(newContact);
}

/**
 * Update an existing contact belonging to the authenticated user.
 * @param {string|number} userId
 * @param {string|number} contactId
 * @param {object} updates
 * @returns {Promise<object>} Updated contact
 */
export async function updateContact(userId, contactId, { name, phone, relationship, isPrimary }) {
  const uid = String(userId);
  const cid = String(contactId);

  if (pool && !env.MOCK_MODE) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Verify ownership
      const checkRes = await client.query(
        `SELECT id FROM emergency_contacts WHERE id = $1 AND user_id = $2;`,
        [contactId, userId]
      );
      if (checkRes.rows.length === 0) {
        const err = new Error('Contact not found or does not belong to you.');
        err.status = 404;
        throw err;
      }

      if (isPrimary) {
        await client.query(
          `UPDATE emergency_contacts SET is_primary = FALSE WHERE user_id = $1;`,
          [userId]
        );
      }

      const updateQuery = `
        UPDATE emergency_contacts
        SET name = COALESCE($3, name),
            phone = COALESCE($4, phone),
            relationship = COALESCE($5, relationship),
            is_primary = COALESCE($6, is_primary),
            updated_at = NOW()
        WHERE id = $1 AND user_id = $2
        RETURNING id, name, phone, relationship, is_primary, created_at;
      `;
      const res = await client.query(updateQuery, [contactId, userId, name?.trim(), phone?.trim(), relationship, isPrimary]);
      await client.query('COMMIT');
      return normalizeContact(res.rows[0]);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  // In-Memory Mock Store
  const contact = inMemoryContacts.find(c => c.id === cid && c.userId === uid);
  if (!contact) {
    const err = new Error('Contact not found or does not belong to you.');
    err.status = 404;
    throw err;
  }

  if (isPrimary) {
    inMemoryContacts
      .filter(c => c.userId === uid)
      .forEach(c => { c.isPrimary = false; });
  }

  if (name !== undefined) contact.name = name.trim();
  if (phone !== undefined) contact.phone = phone.trim();
  if (relationship !== undefined) contact.relationship = relationship;
  if (isPrimary !== undefined) contact.isPrimary = Boolean(isPrimary);
  contact.updatedAt = new Date().toISOString();

  return normalizeContact(contact);
}

/**
 * Delete a contact belonging to the authenticated user.
 * @param {string|number} userId
 * @param {string|number} contactId
 * @returns {Promise<boolean>}
 */
export async function deleteContact(userId, contactId) {
  const uid = String(userId);
  const cid = String(contactId);

  if (pool && !env.MOCK_MODE) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const checkRes = await client.query(
        `SELECT id, is_primary FROM emergency_contacts WHERE id = $1 AND user_id = $2;`,
        [contactId, userId]
      );
      if (checkRes.rows.length === 0) {
        const err = new Error('Contact not found or does not belong to you.');
        err.status = 404;
        throw err;
      }
      const wasPrimary = Boolean(checkRes.rows[0].is_primary);

      await client.query(
        `DELETE FROM emergency_contacts WHERE id = $1 AND user_id = $2;`,
        [contactId, userId]
      );

      // If the deleted contact was primary, designate the next remaining contact as primary
      if (wasPrimary) {
        await client.query(`
          UPDATE emergency_contacts
          SET is_primary = TRUE
          WHERE id = (
            SELECT id FROM emergency_contacts WHERE user_id = $1 ORDER BY created_at ASC LIMIT 1
          );
        `, [userId]);
      }

      await client.query('COMMIT');
      return true;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  // In-Memory Mock Store
  const idx = inMemoryContacts.findIndex(c => c.id === cid && c.userId === uid);
  if (idx === -1) {
    const err = new Error('Contact not found or does not belong to you.');
    err.status = 404;
    throw err;
  }

  const wasPrimary = inMemoryContacts[idx].isPrimary;
  inMemoryContacts.splice(idx, 1);

  if (wasPrimary) {
    const remaining = inMemoryContacts.filter(c => c.userId === uid);
    if (remaining.length > 0) {
      remaining[0].isPrimary = true;
    }
  }

  return true;
}

/**
 * Set a contact as primary for the authenticated user.
 * @param {string|number} userId
 * @param {string|number} contactId
 * @returns {Promise<Array>} All updated contacts for this user
 */
export async function setPrimaryContact(userId, contactId) {
  const uid = String(userId);
  const cid = String(contactId);

  if (pool && !env.MOCK_MODE) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const checkRes = await client.query(
        `SELECT id FROM emergency_contacts WHERE id = $1 AND user_id = $2;`,
        [contactId, userId]
      );
      if (checkRes.rows.length === 0) {
        const err = new Error('Contact not found or does not belong to you.');
        err.status = 404;
        throw err;
      }

      await client.query(`UPDATE emergency_contacts SET is_primary = FALSE WHERE user_id = $1;`, [userId]);
      await client.query(`UPDATE emergency_contacts SET is_primary = TRUE WHERE id = $1 AND user_id = $2;`, [contactId, userId]);
      await client.query('COMMIT');

      return findContactsByUserId(userId);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  // In-Memory Mock Store
  const contact = inMemoryContacts.find(c => c.id === cid && c.userId === uid);
  if (!contact) {
    const err = new Error('Contact not found or does not belong to you.');
    err.status = 404;
    throw err;
  }

  inMemoryContacts
    .filter(c => c.userId === uid)
    .forEach(c => { c.isPrimary = c.id === cid; });

  return findContactsByUserId(userId);
}

