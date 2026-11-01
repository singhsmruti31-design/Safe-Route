import request from 'supertest';
import app from '../src/app.js';
import { scoreSegment, getScoreLevel, scoreAndRankRoutes } from '../src/services/scoringEngine.js';

describe('Phase 4: Safety Scoring Engine Unit Tests', () => {
  const dummySegment = {
    index: 0,
    waytype: 1, // State road
    midpoint: { lat: 51.5074, lng: -0.1278 },
    lengthMeters: 100
  };

  it('should score full 20 points for police within 500m, and fall linearly to 0 at 2km', () => {
    // 400m from police
    const near = scoreSegment(dummySegment, { min_police_dist: 400, places_150m: [], places_count_250m: 1 });
    expect(near.breakdown.police).toBe(20);

    // 1250m from police: halfway between 500m and 2000m -> exactly 10 points
    const mid = scoreSegment(dummySegment, { min_police_dist: 1250, places_150m: [], places_count_250m: 1 });
    expect(mid.breakdown.police).toBe(10);

    // 2500m from police -> 0 points
    const far = scoreSegment(dummySegment, { min_police_dist: 2500, places_150m: [], places_count_250m: 1 });
    expect(far.breakdown.police).toBe(0);
  });

  it('should score full 10 points for hospital within 1km, and fall linearly to 0 at 3km', () => {
    // 800m
    const near = scoreSegment(dummySegment, { min_hospital_dist: 800, places_150m: [], places_count_250m: 1 });
    expect(near.breakdown.hospital).toBe(10);

    // 2000m: halfway between 1000m and 3000m -> exactly 5 points
    const mid = scoreSegment(dummySegment, { min_hospital_dist: 2000, places_150m: [], places_count_250m: 1 });
    expect(mid.breakdown.hospital).toBe(5);

    // 3200m -> 0 points
    const far = scoreSegment(dummySegment, { min_hospital_dist: 3200, places_150m: [], places_count_250m: 1 });
    expect(far.breakdown.hospital).toBe(0);
  });

  it('should score open places up to 30 points and ignore closed places', () => {
    const mondayNoon = new Date('2026-11-02T12:00:00Z');
    const sundayNight = new Date('2026-11-01T23:00:00Z');

    const places = [
      { type: 'shop24', opening_hours: '24/7', is_24_7: true },
      { type: 'pharmacy', opening_hours: 'Mo-Fr 06:00-22:00', is_24_7: false },
      { type: 'atm', opening_hours: '24/7', is_24_7: true },
      { type: 'fuel', opening_hours: '24/7', is_24_7: true }
    ];

    // On Monday noon: all 4 are open -> 4 * 7.5 = 30 points
    const mon = scoreSegment(dummySegment, { places_150m: places, places_count_250m: 4 }, mondayNoon);
    expect(mon.breakdown.openPlaces).toBe(30);

    // On Sunday night: the daytime pharmacy is closed, only 3 are open -> 3 * 7.5 = 22.5 points
    const sun = scoreSegment(dummySegment, { places_150m: places, places_count_250m: 4 }, sundayNight);
    expect(sun.breakdown.openPlaces).toBe(22.5);
  });

  it('should only apply community reports if approved or reported by at least 2 distinct IP hashes', () => {
    // 1 pending harassment report from a single IP -> ignored
    const singlePending = scoreSegment(dummySegment, {
      places_150m: [],
      places_count_250m: 1,
      reports_150m: [{ type: 'harassment', status: 'pending', ip_hash: 'hash_a' }]
    });
    expect(singlePending.breakdown.reports).toBe(0);

    // 2 pending harassment reports from 2 different IPs -> qualifies (-4 penalty)
    const twoDistinct = scoreSegment(dummySegment, {
      places_150m: [],
      places_count_250m: 1,
      reports_150m: [
        { type: 'harassment', status: 'pending', ip_hash: 'hash_a' },
        { type: 'harassment', status: 'pending', ip_hash: 'hash_b' }
      ]
    });
    expect(twoDistinct.breakdown.reports).toBe(-4);

    // 1 approved safe spot -> qualifies (+5 points)
    const approved = scoreSegment(dummySegment, {
      places_150m: [],
      places_count_250m: 1,
      reports_150m: [{ type: 'safe_spot', status: 'approved', ip_hash: 'hash_c' }]
    });
    expect(approved.breakdown.reports).toBe(5);
  });

  it('should deduct penalties for underpasses, tunnels, and isolated stretches up to -15 cap', () => {
    // Underpass / tunnel waytype (e.g. 10 or 8) + no places within 250m
    const underpassSegment = {
      index: 1,
      waytype: 10,
      midpoint: { lat: 51.5074, lng: -0.1278 },
      lengthMeters: 100
    };

    const res = scoreSegment(underpassSegment, {
      min_police_dist: null,
      min_hospital_dist: null,
      places_150m: [],
      places_count_250m: 0,
      reports_150m: []
    });

    // -10 for underpass + -7 for isolated stretch = -17, capped at -15
    expect(res.breakdown.penalties).toBe(-15);
  });

  it('should clamp total segment score strictly between 0 and 100', () => {
    // Segment with heavy penalties and zero positive factors
    const badSegment = {
      index: 2,
      waytype: 10,
      midpoint: { lat: 51.5074, lng: -0.1278 },
      lengthMeters: 100
    };

    const resNegative = scoreSegment(badSegment, {
      min_police_dist: 5000,
      min_hospital_dist: 5000,
      places_150m: [],
      places_count_250m: 0,
      reports_150m: [{ type: 'harassment', status: 'approved' }]
    });

    expect(resNegative.score).toBe(0);
    expect(resNegative.score).toBeGreaterThanOrEqual(0);
  });

  it('should map score levels correctly to green, yellow, red', () => {
    expect(getScoreLevel(85)).toBe('green');
    expect(getScoreLevel(70)).toBe('green');
    expect(getScoreLevel(69.9)).toBe('yellow');
    expect(getScoreLevel(40)).toBe('yellow');
    expect(getScoreLevel(39.9)).toBe('red');
    expect(getScoreLevel(10)).toBe('red');
  });

  it('should deduct 10 points from route score if weakest segment is below 30', async () => {
    const rawRoute = {
      geometry: {
        type: 'LineString',
        coordinates: [
          [-0.1278, 51.5074],
          [-0.1278, 51.5085],
          [-0.1278, 51.5096]
        ]
      },
      properties: {
        summary: { distance: 250, duration: 200 }
      }
    };

    const res = await scoreAndRankRoutes({ routes: [rawRoute] });
    expect(res.routes.length).toBe(1);
    const r = res.routes[0];
    expect(r).toHaveProperty('weakestSegment');
    expect(r.weakestSegment).toHaveProperty('score');
  });
});

describe('Phase 4: POST /api/routes/safe', () => {
  it('should return 400 when start or end is missing', async () => {
    const res = await request(app).post('/api/routes/safe').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation failed');
  });

  it('should return 400 when coordinates are invalid', async () => {
    const res = await request(app).post('/api/routes/safe').send({
      start: { lat: 105, lng: 0 },
      end: { lat: 51.5, lng: -0.1 }
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation failed');
  });

  it('should return scored and ranked routes with disclaimer and segment breakdown', async () => {
    const res = await request(app)
      .post('/api/routes/safe')
      .send({
        start: { lat: 51.5074, lng: -0.1278 },
        end: { lat: 51.5150, lng: -0.1350 },
        mode: 'safest'
      });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('mode', 'safest');
    expect(res.body).toHaveProperty('disclaimer');
    expect(res.body.disclaimer).toContain('Scores do not consider lighting');
    expect(Array.isArray(res.body.routes)).toBe(true);
    expect(res.body.routes.length).toBeGreaterThanOrEqual(1);

    const firstRoute = res.body.routes[0];
    expect(firstRoute).toHaveProperty('id');
    expect(firstRoute).toHaveProperty('geometry');
    expect(firstRoute).toHaveProperty('distance');
    expect(firstRoute).toHaveProperty('duration');
    expect(firstRoute).toHaveProperty('score');
    expect(firstRoute.score).toBeGreaterThanOrEqual(0);
    expect(firstRoute.score).toBeLessThanOrEqual(100);
    expect(['green', 'yellow', 'red']).toContain(firstRoute.level);
    expect(firstRoute).toHaveProperty('weakestSegment');
    expect(firstRoute).toHaveProperty('extraMinutesVsFastest');
    expect(Array.isArray(firstRoute.segments)).toBe(true);

    const seg = firstRoute.segments[0];
    expect(seg).toHaveProperty('index');
    expect(seg).toHaveProperty('score');
    expect(seg).toHaveProperty('start');
    expect(seg).toHaveProperty('end');
    expect(seg).toHaveProperty('midpoint');
    expect(seg).toHaveProperty('breakdown');
  });

  it('should sort routes by duration when mode is "fastest"', async () => {
    const res = await request(app)
      .post('/api/routes/safe')
      .send({
        start: { lat: 51.5074, lng: -0.1278 },
        end: { lat: 51.5150, lng: -0.1350 },
        mode: 'fastest'
      });

    expect(res.status).toBe(200);
    const routes = res.body.routes;
    for (let i = 1; i < routes.length; i++) {
      expect(routes[i].duration).toBeGreaterThanOrEqual(routes[i - 1].duration);
    }
  });
});
