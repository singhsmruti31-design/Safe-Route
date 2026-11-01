import request from 'supertest';
import app from '../src/app.js';

describe('GET /api/health (Phase 1)', () => {
  it('should return 200 OK and health status payload', async () => {
    const res = await request(app).get('/api/health');
    
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('status', 'ok');
    expect(res.body).toHaveProperty('service', 'safe-route-backend');
    expect(res.body).toHaveProperty('timestamp');
    expect(res.body).toHaveProperty('uptimeSeconds');
    expect(res.body).toHaveProperty('database');
    expect(res.body.database).toHaveProperty('status');
  });

  it('should return 404 for unknown route', async () => {
    const res = await request(app).get('/api/non-existent');
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error', 'Endpoint not found');
  });
});
