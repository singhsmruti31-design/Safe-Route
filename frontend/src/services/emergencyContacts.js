/**
 * Emergency contact management.
 *
 * Secure, account-linked storage requires the backend.
 * Until then, contacts may be kept in a TEMPORARY device store that is
 * labelled in the UI and must not be treated as secure account storage.
 */

import { apiRequest, isApiConfigured } from './api.js';
import { normalizePhone } from '../utils/validation.js';

export const TEMP_CONTACTS_KEY = 'saferoute_temp_emergency_contacts';

export function contactsRequireBackend() {
  return !isApiConfigured('VITE_EMERGENCY_CONTACTS_PATH');
}

export async function listContacts(token) {
  if (!contactsRequireBackend() && token) {
    return apiRequest('VITE_EMERGENCY_CONTACTS_PATH', {
      method: 'GET',
      feature: 'Emergency contacts',
      token,
    });
  }
  return { contacts: readTemporaryContacts(), storage: 'temporary_device' };
}

export async function createContact(token, contact) {
  const payload = sanitizeContact(contact);
  if (!contactsRequireBackend() && token) {
    return apiRequest('VITE_EMERGENCY_CONTACTS_PATH', {
      method: 'POST',
      feature: 'Add emergency contact',
      token,
      body: payload,
    });
  }
  const contacts = readTemporaryContacts();
  const next = {
    ...payload,
    id: `tmp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    createdAt: new Date().toISOString(),
    temporary: true,
  };
  if (next.isPrimary) {
    contacts.forEach((c) => { c.isPrimary = false; });
  }
  if (contacts.length === 0) next.isPrimary = true;
  contacts.push(next);
  writeTemporaryContacts(contacts);
  return { contact: next, storage: 'temporary_device' };
}

export async function updateContact(token, id, contact) {
  const payload = sanitizeContact(contact);
  if (!contactsRequireBackend() && token) {
    return apiRequest('VITE_EMERGENCY_CONTACTS_PATH', {
      method: 'PUT',
      feature: 'Update emergency contact',
      token,
      body: { id, ...payload },
    });
  }
  const contacts = readTemporaryContacts();
  const idx = contacts.findIndex((c) => c.id === id);
  if (idx === -1) throw new Error('Contact not found.');
  const next = { ...contacts[idx], ...payload, id, temporary: true };
  if (next.isPrimary) {
    contacts.forEach((c) => { c.isPrimary = c.id === id; });
  }
  contacts[idx] = next;
  writeTemporaryContacts(contacts);
  return { contact: next, storage: 'temporary_device' };
}

export async function deleteContact(token, id) {
  if (!contactsRequireBackend() && token) {
    return apiRequest('VITE_EMERGENCY_CONTACTS_PATH', {
      method: 'DELETE',
      feature: 'Delete emergency contact',
      token,
      body: { id },
    });
  }
  let contacts = readTemporaryContacts().filter((c) => c.id !== id);
  if (contacts.length && !contacts.some((c) => c.isPrimary)) {
    contacts[0].isPrimary = true;
  }
  writeTemporaryContacts(contacts);
  return { ok: true, storage: 'temporary_device' };
}

export async function setPrimaryContact(token, id) {
  if (!contactsRequireBackend() && token) {
    return apiRequest('VITE_EMERGENCY_CONTACTS_PATH', {
      method: 'PATCH',
      feature: 'Set primary emergency contact',
      token,
      body: { id, isPrimary: true },
    });
  }
  const contacts = readTemporaryContacts().map((c) => ({
    ...c,
    isPrimary: c.id === id,
  }));
  writeTemporaryContacts(contacts);
  return { contacts, storage: 'temporary_device' };
}

export function getPrimaryContact() {
  const contacts = readTemporaryContacts();
  return contacts.find((c) => c.isPrimary) || contacts[0] || null;
}

export function clearTemporaryContacts() {
  localStorage.removeItem(TEMP_CONTACTS_KEY);
}

function sanitizeContact(contact) {
  return {
    name: String(contact.name || '').trim(),
    phone: normalizePhone(contact.phone),
    relationship: contact.relationship || 'Other',
    isPrimary: Boolean(contact.isPrimary),
  };
}

function readTemporaryContacts() {
  try {
    const raw = localStorage.getItem(TEMP_CONTACTS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeTemporaryContacts(contacts) {
  localStorage.setItem(TEMP_CONTACTS_KEY, JSON.stringify(contacts));
}
