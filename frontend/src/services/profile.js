/**
 * User profile service.
 * Account profile CRUD requires backend paths. A clearly labelled local draft
 * exists only so the UI can be tested before APIs are connected.
 *
 * Passwords are never written to storage.
 */

import { apiRequest, isApiConfigured } from './api.js';

const TEMP_PROFILE_KEY = 'saferoute_temp_profile_draft';

export function profileRequiresBackend() {
  return !isApiConfigured('VITE_PROFILE_PATH');
}

export function fetchProfile(token) {
  return apiRequest('VITE_PROFILE_PATH', {
    method: 'GET',
    feature: 'User profile',
    token,
  });
}

export function updateProfileRequest(token, payload) {
  return apiRequest('VITE_PROFILE_PATH', {
    method: 'PUT',
    feature: 'Update profile',
    token,
    body: payload,
  });
}

export function getTemporaryProfileDraft() {
  try {
    const raw = localStorage.getItem(TEMP_PROFILE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveTemporaryProfileDraft(draft) {
  const safe = {
    fullName: draft.fullName || '',
    email: draft.email || '',
    mobile: draft.mobile || '',
    photoDataUrl: draft.photoDataUrl || '',
    updatedAt: new Date().toISOString(),
    temporary: true,
  };
  localStorage.setItem(TEMP_PROFILE_KEY, JSON.stringify(safe));
  return safe;
}

export function clearTemporaryProfileDraft() {
  localStorage.removeItem(TEMP_PROFILE_KEY);
}
