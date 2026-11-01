import { haversine } from './distance.js';

/**
 * LocalStorage utilities for Safe Route.
 * Only stores user preferences and local reports — no sensitive location data persisted.
 */

const KEYS = {
  REPORTS: 'saferoute_reports',
  PREFERENCES: 'saferoute_preferences',
  SEARCH_CACHE: 'saferoute_search_cache',
  PLACE_CACHE: 'saferoute_place_cache',
};

// ─── Reports ────────────────────────────────────────────────────────────────

/** Get all locally saved reports */
export function getReports() {
  try {
    const raw = localStorage.getItem(KEYS.REPORTS);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/** Save a new report */
export function saveReport(report) {
  const reports = getReports();
  const newReport = {
    ...report,
    id: `rpt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    createdAt: new Date().toISOString(),
    source: 'local_device',
    verified: false,
  };
  reports.unshift(newReport);
  // Keep only the last 100 reports
  const trimmed = reports.slice(0, 100);
  localStorage.setItem(KEYS.REPORTS, JSON.stringify(trimmed));
  return newReport;
}

/** Delete a report by id */
export function deleteReport(id) {
  const reports = getReports().filter((r) => r.id !== id);
  localStorage.setItem(KEYS.REPORTS, JSON.stringify(reports));
}

/** Get reports near a location [lat, lon] within radiusM metres */
export function getReportsNear(lat, lon, radiusM = 300) {
  return getReports().filter((r) => {
    if (!r.lat || !r.lon) return false;
    return haversine([lat, lon], [r.lat, r.lon]) <= radiusM;
  });
}

// ─── Preferences ────────────────────────────────────────────────────────────

export function getPreferences() {
  try {
    const raw = localStorage.getItem(KEYS.PREFERENCES);
    return raw
      ? JSON.parse(raw)
      : { showPolice: true, showHospitals: true, showPharmacies: false, showPetrol: false, showShops: false };
  } catch {
    return {};
  }
}

export function savePreferences(prefs) {
  const existing = getPreferences();
  localStorage.setItem(KEYS.PREFERENCES, JSON.stringify({ ...existing, ...prefs }));
}

// ─── Search cache ────────────────────────────────────────────────────────────

const SEARCH_TTL = 10 * 60 * 1000; // 10 minutes

export function getCachedSearch(query) {
  try {
    const raw = localStorage.getItem(KEYS.SEARCH_CACHE);
    const cache = raw ? JSON.parse(raw) : {};
    const entry = cache[query.toLowerCase().trim()];
    if (!entry) return null;
    if (Date.now() - entry.ts > SEARCH_TTL) return null;
    return entry.results;
  } catch {
    return null;
  }
}

export function setCachedSearch(query, results) {
  try {
    const raw = localStorage.getItem(KEYS.SEARCH_CACHE);
    const cache = raw ? JSON.parse(raw) : {};
    cache[query.toLowerCase().trim()] = { results, ts: Date.now() };
    // Keep only the last 50 entries
    const keys = Object.keys(cache);
    if (keys.length > 50) {
      const oldest = keys.sort((a, b) => cache[a].ts - cache[b].ts)[0];
      delete cache[oldest];
    }
    localStorage.setItem(KEYS.SEARCH_CACHE, JSON.stringify(cache));
  } catch {
    // Ignore storage errors
  }
}

// ─── Place cache ─────────────────────────────────────────────────────────────

const PLACE_TTL = 15 * 60 * 1000; // 15 minutes

export function getCachedPlaces(key) {
  try {
    const raw = localStorage.getItem(KEYS.PLACE_CACHE);
    const cache = raw ? JSON.parse(raw) : {};
    const entry = cache[key];
    if (!entry) return null;
    if (Date.now() - entry.ts > PLACE_TTL) return null;
    return entry.data;
  } catch {
    return null;
  }
}

export function setCachedPlaces(key, data) {
  try {
    const raw = localStorage.getItem(KEYS.PLACE_CACHE);
    const cache = raw ? JSON.parse(raw) : {};
    cache[key] = { data, ts: Date.now() };
    // Keep only 20 area caches
    const keys = Object.keys(cache);
    if (keys.length > 20) {
      const oldest = keys.sort((a, b) => cache[a].ts - cache[b].ts)[0];
      delete cache[oldest];
    }
    localStorage.setItem(KEYS.PLACE_CACHE, JSON.stringify(cache));
  } catch {
    // Ignore
  }
}
