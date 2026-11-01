/**
 * Saved walking routes (account feature).
 * Listing and saving require backend paths for account sync.
 * Until then, routes are saved to a clearly-labelled localStorage store.
 */

import { apiRequest, isApiConfigured } from './api.js';

const TEMP_SAVED_ROUTES_KEY = 'saferoute_temp_saved_routes';
const MAX_LOCAL_SAVED = 20;

export function savedRoutesRequireBackend() {
  return !isApiConfigured('VITE_SAVED_ROUTES_PATH');
}

/** List saved routes — backend if configured, otherwise localStorage. */
export async function listSavedRoutes(token) {
  if (!savedRoutesRequireBackend() && token) {
    return apiRequest('VITE_SAVED_ROUTES_PATH', {
      method: 'GET',
      feature: 'Saved routes',
      token,
    });
  }
  return { routes: readLocalSavedRoutes(), storage: 'temporary_device' };
}

/** Save a route locally (or to backend when configured). */
export async function saveRoute(token, routeData) {
  if (!savedRoutesRequireBackend() && token) {
    return apiRequest('VITE_SAVED_ROUTES_PATH', {
      method: 'POST',
      feature: 'Save route',
      token,
      body: routeData,
    });
  }
  const routes = readLocalSavedRoutes();
  const entry = {
    id: `tmp_route_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    name: routeData.name || `Route ${routes.length + 1}`,
    summary: routeData.summary || '',
    distance: routeData.distance,
    duration: routeData.duration,
    provider: routeData.provider || '',
    safetyScore: routeData.safetyScore ?? null,
    coordinates: routeData.coordinates || [],
    savedAt: new Date().toISOString(),
    temporary: true,
  };
  const next = [entry, ...routes].slice(0, MAX_LOCAL_SAVED);
  writeLocalSavedRoutes(next);
  return { route: entry, storage: 'temporary_device' };
}

/** Delete a saved route by id. */
export async function deleteSavedRoute(token, id) {
  if (!savedRoutesRequireBackend() && token) {
    return apiRequest('VITE_SAVED_ROUTES_PATH', {
      method: 'DELETE',
      feature: 'Delete saved route',
      token,
      body: { id },
    });
  }
  const routes = readLocalSavedRoutes().filter((r) => r.id !== id);
  writeLocalSavedRoutes(routes);
  return { ok: true, storage: 'temporary_device' };
}

function readLocalSavedRoutes() {
  try {
    const raw = localStorage.getItem(TEMP_SAVED_ROUTES_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocalSavedRoutes(routes) {
  try {
    localStorage.setItem(TEMP_SAVED_ROUTES_KEY, JSON.stringify(routes));
  } catch { /* ignore quota errors */ }
}
