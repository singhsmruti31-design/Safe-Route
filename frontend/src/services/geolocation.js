/**
 * Browser Geolocation service.
 * Wraps the Geolocation API with promises and clear error messages.
 *
 * Note: GPS access requires:
 * 1. User permission (browser prompt).
 * 2. A secure context: HTTPS or localhost.
 */

/**
 * Get the user's current GPS location once.
 * @returns {Promise<{lat: number, lon: number, accuracy: number}>}
 */
export function getCurrentLocation(options = {}) {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported by your browser.'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lon: position.coords.longitude,
          accuracy: position.coords.accuracy,
        });
      },
      (error) => {
        switch (error.code) {
          case error.PERMISSION_DENIED:
            reject(new Error('Location permission denied. Please allow location access in your browser settings.'));
            break;
          case error.POSITION_UNAVAILABLE:
            reject(new Error('Location information is unavailable. Please check your device GPS settings.'));
            break;
          case error.TIMEOUT:
            reject(new Error('Location request timed out. Please try again.'));
            break;
          default:
            reject(new Error('An unknown location error occurred.'));
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 30000,
        ...options,
      }
    );
  });
}

/**
 * Watch the user's location continuously.
 * Returns a watchId that can be used to stop watching.
 */
export function watchLocation(onSuccess, onError, options = {}) {
  if (!navigator.geolocation) {
    onError(new Error('Geolocation not supported.'));
    return null;
  }

  return navigator.geolocation.watchPosition(
    (pos) => onSuccess({
      lat: pos.coords.latitude,
      lon: pos.coords.longitude,
      accuracy: pos.coords.accuracy,
    }),
    (err) => onError(err),
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000, ...options }
  );
}

/** Stop watching position */
export function clearWatch(watchId) {
  if (watchId !== null && navigator.geolocation) {
    navigator.geolocation.clearWatch(watchId);
  }
}

/**
 * Generate a Google Maps location URL for the given coordinates.
 */
export function generateGoogleMapsLink(lat, lon) {
  return `https://www.google.com/maps?q=${lat},${lon}`;
}

/**
 * Generate a WhatsApp emergency sharing link.
 */
export function generateWhatsAppLink(lat, lon) {
  const mapsLink = generateGoogleMapsLink(lat, lon);
  const message = encodeURIComponent(
    `🆘 Emergency! I need help. My current location is:\n${mapsLink}\nPlease contact me immediately!`
  );
  return `https://wa.me/?text=${message}`;
}

/**
 * Generate a cross-platform SMS sharing link.
 * Android / RFC 5724 uses '?' separator: sms:<number>?body=<message>
 * iOS MobileSafari historically expects '&' separator: sms:<number>&body=<message>
 */
export function generateSMSLink(lat, lon, phoneNumber = '') {
  const mapsLink = generateGoogleMapsLink(lat, lon);
  const message = encodeURIComponent(
    `Emergency! I need help. My location: ${mapsLink}`
  );
  const digits = String(phoneNumber || '').replace(/[^\d+]/g, '');
  const isIOS = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent || '');
  const separator = isIOS ? '&' : '?';

  if (digits) {
    return `sms:${digits}${separator}body=${message}`;
  }
  return isIOS ? `sms:&body=${message}` : `sms:?body=${message}`;
}
