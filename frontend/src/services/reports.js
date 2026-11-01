/**
 * Safety reports.
 * Device-only reports already exist in localStorage (see utils/storage.js).
 * Account-synced reports require a backend path.
 */

import { apiRequest, isApiConfigured } from './api.js';
import { getReports } from '../utils/storage.js';

export function reportsRequireBackend() {
  return !isApiConfigured('VITE_REPORTS_PATH');
}

export async function listAccountReports(token) {
  if (reportsRequireBackend()) {
    return { reports: getReports(), storage: 'device_only' };
  }
  return apiRequest('VITE_REPORTS_PATH', {
    method: 'GET',
    feature: 'Reports',
    token,
  });
}
