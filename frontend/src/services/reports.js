/**
 * Safety reports service.
 * Supports dual-mode:
 * 1. Backend mode: POST/GET/DELETE /api/reports via VITE_REPORTS_PATH.
 * 2. Device-only fallback when backend is not configured or offline.
 */

import { apiRequest, isApiConfigured, getApiBaseUrl, getApiPath } from './api.js';
import { getReports, saveReport, deleteReport } from '../utils/storage.js';

export function reportsRequireBackend() {
  return !isApiConfigured('VITE_REPORTS_PATH');
}

/**
 * Normalizes report objects from backend or local storage into a consistent shape.
 */
export function normalizeReport(r) {
  if (!r) return null;
  const lat = Number(r.coordinates?.lat ?? r.lat);
  const lon = Number(r.coordinates?.lng ?? r.lng ?? r.lon);
  const category = r.type || r.category || 'other';
  const description = r.note || r.description || '';
  const createdAt = r.created_at || r.createdAt || new Date().toISOString();
  const status = r.status || 'pending';

  return {
    ...r,
    id: r.id,
    lat,
    lon,
    lng: lon,
    category,
    type: category,
    description,
    note: description,
    status,
    createdAt,
    created_at: createdAt
  };
}

/**
 * Submits a community report.
 * Uses backend API if configured, otherwise falls back to device storage.
 */
export async function submitReport(reportData, token = null) {
  if (reportsRequireBackend()) {
    const localReport = saveReport({
      lat: Number(reportData.lat),
      lon: Number(reportData.lon ?? reportData.lng),
      category: reportData.category || reportData.type,
      description: (reportData.description || reportData.note || '').trim(),
    });
    return {
      report: normalizeReport(localReport),
      storage: 'device_only',
      message: 'Report saved to your device.'
    };
  }

  const payload = {
    lat: Number(reportData.lat),
    lng: Number(reportData.lon ?? reportData.lng),
    type: reportData.category || reportData.type || 'other',
    note: (reportData.description || reportData.note || '').trim() || undefined,
  };

  const res = await apiRequest('VITE_REPORTS_PATH', {
    method: 'POST',
    feature: 'Submit Report',
    token: token || undefined,
    body: payload,
  });

  return {
    report: normalizeReport(res.report),
    storage: 'backend',
    message: res.message || 'Report submitted successfully. It is pending community verification.'
  };
}

/**
 * Retrieves verified community reports inside a bounding box.
 * @param {string|Array<number>} bbox [minLng, minLat, maxLng, maxLat] or comma-separated string
 */
export async function fetchReportsInBbox(bbox) {
  const bboxStr = Array.isArray(bbox) ? bbox.join(',') : String(bbox || '');
  const base = getApiBaseUrl();
  const path = getApiPath('VITE_REPORTS_PATH') || '/api/reports';
  const url = `${base}${path.startsWith('/') ? '' : '/'}${path}?bbox=${encodeURIComponent(bboxStr)}`;

  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.message || errData.error || `Failed to fetch reports (${res.status})`);
  }
  const data = await res.json();
  return {
    count: data.count || 0,
    bbox: data.bbox || bbox,
    reports: (data.reports || []).map(normalizeReport),
  };
}

/**
 * Lists reports submitted by the authenticated user (or local reports if offline/unauthenticated).
 */
export async function listAccountReports(token) {
  if (reportsRequireBackend() || !token) {
    return {
      reports: getReports().map(normalizeReport),
      storage: 'device_only'
    };
  }

  const data = await apiRequest('VITE_REPORTS_PATH', {
    method: 'GET',
    feature: 'Reports',
    token,
  });

  return {
    count: data.count || 0,
    reports: (data.reports || []).map(normalizeReport),
    storage: 'backend'
  };
}

/**
 * Deletes a submitted report by ID.
 */
export async function deleteAccountReport(token, id) {
  if (reportsRequireBackend() || !token) {
    deleteReport(id);
    return { ok: true, storage: 'device_only' };
  }

  await apiRequest('VITE_REPORTS_PATH', {
    method: 'DELETE',
    feature: 'Delete report',
    token,
    body: { id },
  });

  return { ok: true, storage: 'backend' };
}
