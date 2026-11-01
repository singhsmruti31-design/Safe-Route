/**
 * Mock Places Dataset for offline development and testing.
 * Realistic help points: Police, Hospitals, Pharmacies, Fuel stations, 24/7 Shops, ATMs.
 */

export const defaultMockPlaces = [
  {
    id: 1,
    osm_id: 1001,
    type: 'police',
    name: 'Central Police Station',
    lat: 51.5074,
    lng: -0.1278,
    opening_hours: '24/7',
    is_24_7: true
  },
  {
    id: 2,
    osm_id: 1002,
    type: 'hospital',
    name: "St. Thomas' Emergency Hospital",
    lat: 51.5005,
    lng: -0.1185,
    opening_hours: '24/7',
    is_24_7: true
  },
  {
    id: 3,
    osm_id: 1003,
    type: 'pharmacy',
    name: 'Day-Night Boots Pharmacy',
    lat: 51.5085,
    lng: -0.1265,
    opening_hours: 'Mo-Su 00:00-24:00',
    is_24_7: true
  },
  {
    id: 4,
    osm_id: 1004,
    type: 'fuel',
    name: 'Shell Express Fuel & Kiosk',
    lat: 51.5060,
    lng: -0.1300,
    opening_hours: '24/7',
    is_24_7: true
  },
  {
    id: 5,
    osm_id: 1005,
    type: 'shop24',
    name: 'Tesco Express 24/7',
    lat: 51.5090,
    lng: -0.1250,
    opening_hours: '24/7',
    is_24_7: true
  },
  {
    id: 6,
    osm_id: 1006,
    type: 'atm',
    name: 'HSBC Illuminated ATM',
    lat: 51.5078,
    lng: -0.1270,
    opening_hours: '24/7',
    is_24_7: true
  },
  {
    id: 7,
    osm_id: 1007,
    type: 'pharmacy',
    name: 'Neighborhood Day Pharmacy',
    lat: 51.5050,
    lng: -0.1240,
    opening_hours: 'Mo-Fr 09:00-18:00',
    is_24_7: false
  },
  {
    id: 8,
    osm_id: 1008,
    type: 'shop24',
    name: 'Corner Grocery Store',
    lat: 51.5040,
    lng: -0.1290,
    opening_hours: 'Mo-Sa 08:00-20:00; Su 10:00-16:00',
    is_24_7: false
  }
];

/**
 * Calculates Haversine distance in meters between two lat/lng coordinates.
 */
export function calculateHaversineDistanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Earth's radius in meters
  const toRad = deg => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
