/**
 * Emergency location sharing helpers.
 * Opening WhatsApp or SMS does not send the message — the user must press Send.
 */

import {
  getCurrentLocation,
  generateGoogleMapsLink,
  generateWhatsAppLink,
  generateSMSLink,
} from './geolocation.js';

export function buildEmergencyMessage(lat, lon) {
  const maps = generateGoogleMapsLink(lat, lon);
  return `EMERGENCY: I need help. My current location: ${maps} (Lat: ${lat.toFixed(5)}, Lon: ${lon.toFixed(5)})`;
}

export async function captureShareLocation() {
  const loc = await getCurrentLocation();
  const mapsLink = generateGoogleMapsLink(loc.lat, loc.lon);
  const message = buildEmergencyMessage(loc.lat, loc.lon);
  return {
    ...loc,
    mapsLink,
    message,
    whatsappLink: generateWhatsAppLink(loc.lat, loc.lon),
    smsLink: generateSMSLink(loc.lat, loc.lon),
  };
}

export function whatsappLinkForNumber(phone, lat, lon) {
  const digits = String(phone || '').replace(/\D/g, '');
  const text = encodeURIComponent(buildEmergencyMessage(lat, lon));
  if (!digits) return generateWhatsAppLink(lat, lon);
  return `https://wa.me/${digits}?text=${text}`;
}

export function smsLinkForNumber(phone, lat, lon) {
  return generateSMSLink(lat, lon, phone || '');
}
