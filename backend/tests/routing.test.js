import { splitRouteIntoSegments, getDistanceMeters, resolveWaytype } from '../src/services/segmentSplitter.js';
import { getWalkingRoutes, clearOrsCache } from '../src/services/orsService.js';

describe('Phase 3: Segment Splitter', () => {
  it('should split a 350m straight line into ~100m segments', () => {
    // 0.001 deg lat ~ 111 meters
    // 0.00315 deg lat ~ 350 meters
    const start = [-0.1278, 51.5000];
    const end = [-0.1278, 51.50315];
    const totalDist = getDistanceMeters(start, end);
    expect(totalDist).toBeGreaterThan(340);
    expect(totalDist).toBeLessThan(360);

    const waytypes = [
      [0, 1, 1] // State Road
    ];

    const segments = splitRouteIntoSegments([start, end], waytypes, 100);

    // Expect 4 segments (100m, 100m, 100m, ~50m)
    expect(segments.length).toBe(4);

    segments.forEach((seg, idx) => {
      expect(seg.index).toBe(idx);
      expect(seg).toHaveProperty('start.lat');
      expect(seg).toHaveProperty('start.lng');
      expect(seg).toHaveProperty('end.lat');
      expect(seg).toHaveProperty('end.lng');
      expect(seg).toHaveProperty('midpoint.lat');
      expect(seg).toHaveProperty('midpoint.lng');
      expect(seg.lengthMeters).toBeGreaterThan(0);
      expect(seg.waytype).toBe(1);
    });

    // Check that segments roughly sum up to total length
    const sumLengths = segments.reduce((sum, s) => sum + s.lengthMeters, 0);
    expect(Math.abs(sumLengths - totalDist)).toBeLessThan(5);
  });

  it('should map waytype ranges from ORS extra_info properly', () => {
    const waytypes = [
      [0, 2, 1], // Primary road
      [3, 5, 4]  // Residential street
    ];

    expect(resolveWaytype(0, waytypes)).toBe(1);
    expect(resolveWaytype(1, waytypes)).toBe(1);
    expect(resolveWaytype(2, waytypes)).toBe(1);
    expect(resolveWaytype(4, waytypes)).toBe(4);
  });

  it('should return empty array for empty or single-point coordinates', () => {
    expect(splitRouteIntoSegments([])).toEqual([]);
    expect(splitRouteIntoSegments([[-0.1, 51.5]])).toEqual([]);
  });
});

describe('Phase 3: OpenRouteService Client & Cache', () => {
  beforeEach(() => {
    clearOrsCache();
  });

  it('should return alternative walking routes with geometries and durations', async () => {
    const start = { lat: 51.5074, lng: -0.1278 };
    const end = { lat: 51.5150, lng: -0.1350 };

    const routes = await getWalkingRoutes(start, end);

    expect(Array.isArray(routes)).toBe(true);
    expect(routes.length).toBeGreaterThanOrEqual(2);

    const route = routes[0];
    expect(route.type).toBe('Feature');
    expect(route.geometry.type).toBe('LineString');
    expect(route.geometry.coordinates.length).toBeGreaterThanOrEqual(2);
    expect(route.properties.summary.distance).toBeGreaterThan(0);
    expect(route.properties.summary.duration).toBeGreaterThan(0);
  });

  it('should serve repeated requests from in-memory cache', async () => {
    const start = { lat: 51.5074, lng: -0.1278 };
    const end = { lat: 51.5150, lng: -0.1350 };

    const firstCall = await getWalkingRoutes(start, end);
    const secondCall = await getWalkingRoutes(start, end);

    // Exact same reference returned from memory cache
    expect(secondCall).toBe(firstCall);
  });
});
