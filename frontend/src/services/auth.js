/**
 * Authentication service.
 *
 * Login, registration, password reset and email verification are sent to the
 * backend only after VITE_API_BASE_URL and path env vars are set.
 *
 * This service does not:
 * - invent endpoints
 * - create a local fake session
 * - store passwords
 */

import { apiRequest, isApiConfigured } from './api.js';

export function authCapabilities() {
  return {
    login: isApiConfigured('VITE_AUTH_LOGIN_PATH'),
    signup: isApiConfigured('VITE_AUTH_SIGNUP_PATH'),
    logout: isApiConfigured('VITE_AUTH_LOGOUT_PATH'),
    forgotPassword: isApiConfigured('VITE_AUTH_FORGOT_PASSWORD_PATH'),
    resetPassword: isApiConfigured('VITE_AUTH_RESET_PASSWORD_PATH'),
    verifyEmail: isApiConfigured('VITE_AUTH_VERIFY_EMAIL_PATH'),
    changePassword: isApiConfigured('VITE_AUTH_CHANGE_PASSWORD_PATH'),
    me: isApiConfigured('VITE_AUTH_ME_PATH'),
  };
}

export function loginRequest({ email, password }) {
  return apiRequest('VITE_AUTH_LOGIN_PATH', {
    method: 'POST',
    feature: 'Sign in',
    body: { email, password },
  });
}

export function signupRequest(payload) {
  return apiRequest('VITE_AUTH_SIGNUP_PATH', {
    method: 'POST',
    feature: 'Create account',
    body: payload,
  });
}

export function logoutRequest(token) {
  return apiRequest('VITE_AUTH_LOGOUT_PATH', {
    method: 'POST',
    feature: 'Sign out',
    token,
    body: {},
  });
}

export function forgotPasswordRequest({ email }) {
  return apiRequest('VITE_AUTH_FORGOT_PASSWORD_PATH', {
    method: 'POST',
    feature: 'Password reset',
    body: { email },
  });
}

export function resetPasswordRequest({ token, password }) {
  return apiRequest('VITE_AUTH_RESET_PASSWORD_PATH', {
    method: 'POST',
    feature: 'Password reset',
    body: { token, password },
  });
}

export function verifyEmailRequest({ token }) {
  return apiRequest('VITE_AUTH_VERIFY_EMAIL_PATH', {
    method: 'POST',
    feature: 'Email verification',
    body: { token },
  });
}

export function changePasswordRequest({ token, currentPassword, newPassword }) {
  return apiRequest('VITE_AUTH_CHANGE_PASSWORD_PATH', {
    method: 'POST',
    feature: 'Change password',
    token,
    body: { currentPassword, newPassword },
  });
}

export function fetchCurrentUser(token) {
  return apiRequest('VITE_AUTH_ME_PATH', {
    method: 'GET',
    feature: 'Load account',
    token,
  });
}

const REMEMBER_EMAIL_KEY = 'saferoute_remembered_email';

export function getRememberedEmail() {
  try {
    return localStorage.getItem(REMEMBER_EMAIL_KEY) || '';
  } catch {
    return '';
  }
}

export function setRememberedEmail(email) {
  try {
    if (email) localStorage.setItem(REMEMBER_EMAIL_KEY, email);
    else localStorage.removeItem(REMEMBER_EMAIL_KEY);
  } catch {
    /* ignore */
  }
}
