/** Client-side form validation. Does not replace backend verification. */

export function isValidEmail(email) {
  if (!email || typeof email !== 'string') return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
}

/**
 * Accepts E.164 (+9198…) or a 10-digit Indian mobile number.
 */
export function normalizePhone(input, defaultCountry = '+91') {
  if (!input) return '';
  const raw = String(input).trim();
  const hasPlus = raw.startsWith('+');
  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';
  if (hasPlus) return `+${digits}`;
  if (digits.length === 10) return `${defaultCountry}${digits}`;
  if (digits.length === 12 && digits.startsWith('91')) return `+${digits}`;
  if (digits.length > 10) return `+${digits}`;
  return `${defaultCountry}${digits}`;
}

export function isValidMobile(input) {
  const normalized = normalizePhone(input);
  const digits = normalized.replace(/\D/g, '');
  return digits.length >= 10 && digits.length <= 15;
}

export function passwordIssues(password) {
  const issues = [];
  if (!password || password.length < 8) issues.push('Use at least 8 characters.');
  if (password && !/[A-Za-z]/.test(password)) issues.push('Include at least one letter.');
  if (password && !/\d/.test(password)) issues.push('Include at least one number.');
  return issues;
}

export function isValidName(name) {
  return typeof name === 'string' && name.trim().length >= 2;
}

export function telHref(number) {
  const digits = String(number || '').replace(/[^\d+]/g, '');
  return digits ? `tel:${digits}` : null;
}
