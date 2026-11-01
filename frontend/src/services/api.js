/**
 * Generic API client for future backend integration.
 *
 * No endpoints are assumed. Paths must be provided through environment
 * variables once the backend contract is available.
 *
 * This module never stores passwords. Tokens are kept in memory by AuthContext
 * and are only accepted from a successful backend response.
 */

export class ApiNotConfiguredError extends Error {
  constructor(feature = 'This feature') {
    super(
      `${feature} needs the backend API. Add VITE_API_BASE_URL and the matching path in .env when those endpoints are ready.`
    );
    this.name = 'ApiNotConfiguredError';
    this.code = 'API_NOT_CONFIGURED';
  }
}

export class ApiRequestError extends Error {
  constructor(message, status = 0, details = null) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
    this.details = details;
  }
}

export function getApiBaseUrl() {
  const envUrl = (import.meta.env.VITE_API_BASE_URL || '').trim();
  // If deployed in production or remote host, prevent accidental localhost requests
  if (!envUrl || (import.meta.env.PROD && (envUrl.includes('localhost') || envUrl.includes('127.0.0.1')))) {
    return 'https://safe-route-backend-e5zu.onrender.com';
  }
  return envUrl.replace(/\/$/, '');
}

export function getApiPath(envKey) {
  const value = import.meta.env[envKey];
  return typeof value === 'string' ? value.trim() : '';
}

export function isApiConfigured(envKey) {
  return Boolean(getApiBaseUrl() && getApiPath(envKey));
}

/**
 * Perform a JSON request against a configured backend path.
 * @param {string} envKey  Vite env key holding the path (e.g. VITE_AUTH_LOGIN_PATH)
 * @param {object} options
 */
export async function apiRequest(envKey, { method = 'GET', body, token, feature = 'This request' } = {}) {
  const base = getApiBaseUrl();
  const path = getApiPath(envKey);

  if (!base || !path) {
    throw new ApiNotConfiguredError(feature);
  }

  const url = path.startsWith('http') ? path : `${base}${path.startsWith('/') ? '' : '/'}${path}`;
  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  let data = null;
  const text = await response.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }
  }

  if (!response.ok) {
    const message =
      data?.message || data?.error || `Request failed (${response.status}). Check the backend response.`;
    throw new ApiRequestError(message, response.status, data);
  }

  return data;
}
