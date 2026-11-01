import opening_hours from 'opening_hours';

/**
 * Evaluates whether a place is open at a given date/time.
 * 
 * Rules:
 * - If tagged is_24_7 or opening_hours is '24/7', always open.
 * - Parses opening_hours string with `opening_hours` library.
 * - If parsing fails, count only places explicitly tagged 24/7.
 * - Closed places or unparsable non-24/7 return isOpen: false.
 * 
 * @param {string|null} openingHoursStr 
 * @param {boolean} is24_7 
 * @param {Date|string|number} atTime 
 * @returns {{ isOpen: boolean, isValid: boolean, is24_7: boolean }}
 */
export function isPlaceOpen(openingHoursStr, is24_7 = false, atTime = new Date()) {
  const targetDate = atTime instanceof Date ? atTime : new Date(atTime);

  // Fallback to current time if targetDate is invalid
  const validDate = isNaN(targetDate.getTime()) ? new Date() : targetDate;

  // Fast path for 24/7
  if (is24_7 || openingHoursStr?.trim() === '24/7') {
    return {
      isOpen: true,
      isValid: true,
      is24_7: true
    };
  }

  // If no opening hours and not 24/7, cannot verify as open
  if (!openingHoursStr || typeof openingHoursStr !== 'string' || !openingHoursStr.trim()) {
    return {
      isOpen: false,
      isValid: false,
      is24_7: false
    };
  }

  try {
    const oh = new opening_hours(openingHoursStr.trim());
    const isOpen = Boolean(oh.getState(validDate));
    return {
      isOpen,
      isValid: true,
      is24_7: false
    };
  } catch (err) {
    // If parsing fails, count only places tagged 24/7
    return {
      isOpen: Boolean(is24_7),
      isValid: false,
      is24_7: Boolean(is24_7)
    };
  }
}
