import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { findUserById } from '../db/usersRepo.js';

/**
 * Middleware protecting admin routes.
 * Checks header 'x-admin-token' against ADMIN_TOKEN.
 */
export function requireAdmin(req, res, next) {
  const token = req.headers['x-admin-token'];

  if (!env.ADMIN_TOKEN) {
    return res.status(503).json({
      error: 'ADMIN_TOKEN is not configured on the server.'
    });
  }

  if (!token || token !== env.ADMIN_TOKEN) {
    return res.status(403).json({
      error: 'Forbidden: Invalid or missing x-admin-token header.'
    });
  }

  next();
}

/**
 * Generates a signed JWT for an authenticated user.
 * @param {object} user { id, email }
 * @returns {string} JWT token
 */
export function generateToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email },
    env.JWT_SECRET,
    { expiresIn: env.JWT_EXPIRES_IN }
  );
}

/**
 * Middleware protecting authenticated user routes.
 * Reads 'Authorization: Bearer <token>', verifies JWT, and attaches req.user.
 */
export async function requireAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) {
    return res.status(401).json({
      error: 'Unauthorized: Authentication token is required.'
    });
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
    return res.status(401).json({
      error: 'Unauthorized: Invalid authorization format. Expected Bearer <token>.'
    });
  }

  const token = parts[1];

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET);
    const user = await findUserById(decoded.id);

    if (!user) {
      return res.status(401).json({
        error: 'Unauthorized: User account no longer exists.'
      });
    }

    req.user = user;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: 'Unauthorized: Your session has expired. Please sign in again.'
      });
    }
    return res.status(401).json({
      error: 'Unauthorized: Invalid authentication token.'
    });
  }
}

/**
 * Optional authentication middleware.
 * If Authorization Bearer header is present and valid, attaches req.user.
 * Otherwise proceeds without failing.
 */
export async function optionalAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) {
    return next();
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
    return next();
  }

  try {
    const decoded = jwt.verify(parts[1], env.JWT_SECRET);
    const user = await findUserById(decoded.id);
    if (user) {
      req.user = user;
    }
  } catch {
    // Proceed without req.user if token is invalid or expired
  }

  next();
}
