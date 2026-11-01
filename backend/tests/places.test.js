import request from 'supertest';
import app from '../src/app.js';
import { isPlaceOpen } from '../src/services/openingHoursService.js';
import { buildOverpassQuery, normalizeOsmElement } from '../scripts/importOsm.js';

describe('Phase 2: Opening Hours Service', () => {
  it('should identify 24/7 places as always open', () => {
    const res1 = isPlaceOpen('24/7', false);
    expect(res1.isOpen).toBe(true);

    const res2 = isPlaceOpen(null, true);
    expect(res2.isOpen).toBe(true);
  });

  it('should correctly parse scheduled opening hours', () => {
    // Monday at 12:00 PM UTC (2026-11-02T12:00:00Z)
    const mondayNoon = new Date('2026-11-02T12:00:00Z');
    // Sunday at 12:00 PM UTC (2026-11-01T12:00:00Z)
    const sundayNoon = new Date('2026-11-01T12:00:00Z');

    const rule = 'Mo-Fr 09:00-18:00';
    expect(isPlaceOpen(rule, false, mondayNoon).isOpen).toBe(true);
    expect(isPlaceOpen(rule, false, sundayNoon).isOpen).toBe(false);
  });

  it('should safely handle invalid or unparseable opening_hours strings without throwing', () => {
    const res = isPlaceOpen('invalid-syntax-here', false);
    expect(res.isOpen).toBe(false);
    expect(res.isValid).toBe(false);

    // If tagged 24/7 as well, falls back to 24/7
    const res24 = isPlaceOpen('invalid-syntax-here', true);
    expect(res24.isOpen).toBe(true);
  });

  it('should return isOpen: false if hours are null/empty and not 24/7', () => {
    expect(isPlaceOpen(null, false).isOpen).toBe(false);
    expect(isPlaceOpen('', false).isOpen).toBe(false);
  });
});

describe('Phase 2: OSM Import Script helpers', () => {
  it('should build Overpass query with target amenities and NO lighting tags', () => {
    const q = buildOverpassQuery(51.5, -0.1, 51.6, 0.0);
    expect(q).toContain('amenity"="police"');
    expect(q).toContain('amenity"="hospital"');
    expect(q).toContain('amenity"="pharmacy"');
    expect(q).toContain('amenity"="fuel"');
    expect(q).toContain('amenity"="atm"');
    expect(q).toContain('shop"');
    expect(q).not.toContain('street_lamp');
    expect(q).not.toContain('lit');
  });

  it('should normalize OSM elements correctly', () => {
    const rawPoliceNode = {
      id: 9991,
      lat: 51.51,
      lon: -0.12,
      tags: {
        amenity: 'police',
        name: 'Charing Cross Police'
      }
    };
    const normalized = normalizeOsmElement(rawPoliceNode);
    expect(normalized).toEqual({
      osm_id: 9991,
      type: 'police',
      name: 'Charing Cross Police',
      lat: 51.51,
      lng: -0.12,
      opening_hours: null,
      is_24_7: false
    });
  });
});

describe('Phase 2: GET /api/places', () => {
  it('should return 400 when lat or lng is missing', async () => {
    const res = await request(app).get('/api/places');
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation failed');
  });

  it('should return 400 when lat or lng is invalid', async () => {
    const res = await request(app).get('/api/places?lat=95&lng=0');
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation failed');
  });

  it('should return 400 for unknown place types filter', async () => {
    const res = await request(app).get('/api/places?lat=51.5074&lng=-0.1278&types=police,casino');
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation failed');
  });

  it('should return nearby places with open/closed status for valid coordinates', async () => {
    const res = await request(app).get('/api/places?lat=51.5074&lng=-0.1278&radius=1000');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('count');
    expect(Array.isArray(res.body.places)).toBe(true);
    expect(res.body.places.length).toBeGreaterThan(0);

    const first = res.body.places[0];
    expect(first).toHaveProperty('id');
    expect(first).toHaveProperty('osm_id');
    expect(first).toHaveProperty('type');
    expect(first).toHaveProperty('name');
    expect(first).toHaveProperty('coordinates');
    expect(first).toHaveProperty('distance_meters');
    expect(first).toHaveProperty('is_open');
  });

  it('should filter by specific types (e.g. police,hospital)', async () => {
    const res = await request(app).get('/api/places?lat=51.5074&lng=-0.1278&radius=2000&types=police,hospital');
    expect(res.status).toBe(200);
    res.body.places.forEach(p => {
      expect(['police', 'hospital']).toContain(p.type);
    });
  });
});
