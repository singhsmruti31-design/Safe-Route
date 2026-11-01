import request from 'supertest';
import app from '../src/app.js';
import { env } from '../src/config/env.js';

describe('Phase 6: Community Reports & Spam Protection', () => {
  const testAdminToken = env.ADMIN_TOKEN || 'test-admin-secret-token';

  it('should return 400 when report body is invalid', async () => {
    const res = await request(app).post('/api/reports').send({
      lat: 51.5074,
      lng: -0.1278,
      type: 'invalid_hazard_type'
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation failed');
  });

  it('should return 400 when note is longer than 200 characters', async () => {
    const longNote = 'A'.repeat(201);
    const res = await request(app).post('/api/reports').send({
      lat: 51.5074,
      lng: -0.1278,
      type: 'isolated',
      note: longNote
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation failed');
  });

  it('should submit an anonymous report with status "pending"', async () => {
    const res = await request(app)
      .post('/api/reports')
      .set('x-forwarded-for', '192.168.1.100')
      .send({
        lat: 51.5200,
        lng: -0.1400,
        type: 'felt_unsafe',
        note: 'Dimly lit pathway near underpass'
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('report');
    expect(res.body.report.status).toBe('pending');
    expect(res.body.report.type).toBe('felt_unsafe');
    expect(res.body.report.coordinates.lat).toBe(51.5200);
    expect(res.body.report.coordinates.lng).toBe(-0.1400);

    // Ensure IP / hash is NOT leaked in the response
    expect(res.body.report).not.toHaveProperty('ip_hash');
    expect(res.body.report).not.toHaveProperty('ip');
  });

  it('should reject duplicate report within 50m from same IP within 24 hours (Anti-spam)', async () => {
    const ip = '192.168.1.101';
    // First report
    const res1 = await request(app)
      .post('/api/reports')
      .set('x-forwarded-for', ip)
      .send({
        lat: 51.5300,
        lng: -0.1500,
        type: 'dark',
        note: 'Broken lights along sidewalk'
      });
    expect(res1.status).toBe(201);

    // Duplicate report ~15m away by same IP
    const res2 = await request(app)
      .post('/api/reports')
      .set('x-forwarded-for', ip)
      .send({
        lat: 51.5301,
        lng: -0.1501,
        type: 'dark',
        note: 'Spam duplicate submission'
      });

    expect(res2.status).toBe(409);
    expect(res2.body.error).toContain('Spam prevention');
  });

  it('should return ONLY approved reports on GET /api/reports?bbox=', async () => {
    const res = await request(app)
      .get('/api/reports?bbox=-0.2,51.4,-0.1,51.6');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('reports');
    expect(Array.isArray(res.body.reports)).toBe(true);

    // Every returned report must have status === 'approved'
    res.body.reports.forEach(r => {
      expect(r.status).toBe('approved');
      expect(r).not.toHaveProperty('ip_hash');
    });
  });
});

describe('Phase 6: Admin Moderation (PATCH /api/admin/reports/:id)', () => {
  const testAdminToken = env.ADMIN_TOKEN || 'test-admin-secret-token';

  it('should return 403 when x-admin-token header is missing or invalid', async () => {
    const res = await request(app)
      .patch('/api/admin/reports/1')
      .send({ status: 'approved' });

    expect(res.status).toBe(403);
    expect(res.body.error).toContain('Forbidden');
  });

  it('should return 400 when new status is neither approved nor rejected', async () => {
    const res = await request(app)
      .patch('/api/admin/reports/1')
      .set('x-admin-token', testAdminToken)
      .send({ status: 'archived' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation failed');
  });

  it('should successfully update report status to approved when authenticated', async () => {
    // First create a pending report
    const created = await request(app)
      .post('/api/reports')
      .set('x-forwarded-for', '10.0.0.50')
      .send({
        lat: 51.5400,
        lng: -0.1600,
        type: 'safe_spot',
        note: 'Active 24/7 lobby'
      });

    const reportId = created.body.report.id;

    // Approve via admin
    const patchRes = await request(app)
      .patch(`/api/admin/reports/${reportId}`)
      .set('x-admin-token', testAdminToken)
      .send({ status: 'approved' });

    expect(patchRes.status).toBe(200);
    expect(patchRes.body.report.id).toBe(reportId);
    expect(patchRes.body.report.status).toBe('approved');

    // Confirm it now appears in GET /api/reports?bbox
    const bboxRes = await request(app)
      .get('/api/reports?bbox=-0.2,51.4,-0.1,51.6');

    const found = bboxRes.body.reports.find(r => r.id === reportId);
    expect(found).toBeDefined();
    expect(found.status).toBe('approved');
  });
});
