import request from 'supertest';
import app from '../src/app.js';

describe('Phase 5: GET /api/safe-spots/nearest', () => {
  it('should return 400 when lat or lng is missing', async () => {
    const res = await request(app).get('/api/safe-spots/nearest');
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation failed');
  });

  it('should return 400 when lat or lng is out of bounds', async () => {
    const res = await request(app).get('/api/safe-spots/nearest?lat=95&lng=0');
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation failed');
  });

  it('should return up to 3 nearest OPEN safe spots plus walking route to the closest', async () => {
    const res = await request(app).get('/api/safe-spots/nearest?lat=51.5074&lng=-0.1278');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('count');
    expect(res.body.count).toBeLessThanOrEqual(3);
    expect(Array.isArray(res.body.nearestSafeSpots)).toBe(true);
    expect(res.body.nearestSafeSpots.length).toBeGreaterThanOrEqual(1);

    const firstSpot = res.body.nearestSafeSpots[0];
    expect(firstSpot).toHaveProperty('id');
    expect(firstSpot).toHaveProperty('type');
    expect(['police', 'hospital', 'shop24', 'fuel']).toContain(firstSpot.type);
    expect(firstSpot).toHaveProperty('name');
    expect(firstSpot).toHaveProperty('coordinates');
    expect(firstSpot).toHaveProperty('distance_meters');
    expect(firstSpot.is_open).toBe(true);

    // Verify walking route to closest
    expect(res.body).toHaveProperty('routeToClosest');
    const route = res.body.routeToClosest;
    expect(route).toHaveProperty('target');
    expect(route).toHaveProperty('distance');
    expect(route).toHaveProperty('duration');
    expect(route).toHaveProperty('geometry');
    expect(route.geometry.type).toBe('LineString');
  });
});

describe('Phase 5: POST /api/sos/link', () => {
  it('should return 400 when coordinates are missing', async () => {
    const res = await request(app).post('/api/sos/link').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation failed');
  });

  it('should generate emergency links without saving data', async () => {
    const res = await request(app).post('/api/sos/link').send({
      lat: 51.5074,
      lng: -0.1278
    });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('message');
    expect(res.body.message).toContain('51.5074,-0.1278');
    expect(res.body).toHaveProperty('googleMapsLink', 'https://www.google.com/maps?q=51.5074,-0.1278');
    expect(res.body).toHaveProperty('whatsappLink');
    expect(res.body.whatsappLink).toContain('wa.me');
    expect(res.body.whatsappLink).toContain(encodeURIComponent('51.5074,-0.1278'));
    expect(res.body).toHaveProperty('smsLink');
    expect(res.body.smsLink).toContain('sms:?body=');
  });

  it('should include sender name and target phone number when provided', async () => {
    const res = await request(app).post('/api/sos/link').send({
      lat: 51.5074,
      lng: -0.1278,
      name: 'Alice',
      contactPhone: '+1-555-0199'
    });

    expect(res.status).toBe(200);
    expect(res.body.message).toContain('Alice needs help!');
    expect(res.body.whatsappLink).toContain('wa.me/15550199');
    expect(res.body.smsLink).toContain('sms:15550199?body=');
  });
});
