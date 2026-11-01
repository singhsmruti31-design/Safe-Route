import { pool } from '../db/pool.js';
import { env } from '../config/env.js';
import { scoringConfig } from '../config/scoring.config.js';
import { isPlaceOpen } from './openingHoursService.js';
import { splitRouteIntoSegments } from './segmentSplitter.js';
import { defaultMockPlaces, calculateHaversineDistanceMeters } from '../db/mockPlacesData.js';

/**
 * Executes a single batched PostGIS query for an entire route's segments.
 * 
 * @param {Array<Object>} segments 
 * @returns {Promise<Array<Object>>}
 */
export async function fetchRouteBatchSpatialData(segments) {
  if (segments.length === 0) return [];

  if (pool && !env.MOCK_MODE) {
    const segmentsPayload = JSON.stringify(
      segments.map(s => ({
        index: s.index,
        lat: s.midpoint.lat,
        lng: s.midpoint.lng
      }))
    );

    const queryText = `
      WITH segs AS (
        SELECT 
          (val->>'index')::int AS seg_index,
          ST_SetSRID(ST_MakePoint((val->>'lng')::float, (val->>'lat')::float), 4326)::geography AS geom
        FROM json_array_elements($1::json) AS val
      )
      SELECT 
        s.seg_index,
        -- Min distance to police within 2000m
        (
          SELECT MIN(ST_Distance(s.geom, p.geom))
          FROM places p
          WHERE p.type = 'police' AND ST_DWithin(s.geom, p.geom, 2000)
        ) AS min_police_dist,
        -- Min distance to hospital within 3000m
        (
          SELECT MIN(ST_Distance(s.geom, p.geom))
          FROM places p
          WHERE p.type = 'hospital' AND ST_DWithin(s.geom, p.geom, 3000)
        ) AS min_hospital_dist,
        -- Places within 150m for open places & density
        (
          SELECT COALESCE(json_agg(json_build_object(
            'id', p.id,
            'type', p.type,
            'opening_hours', p.opening_hours,
            'is_24_7', p.is_24_7,
            'dist', ST_Distance(s.geom, p.geom)
          )), '[]'::json)
          FROM places p
          WHERE ST_DWithin(s.geom, p.geom, 150)
        ) AS places_150m,
        -- Count places within 250m for isolated stretch penalty check
        (
          SELECT COUNT(*)
          FROM places p
          WHERE ST_DWithin(s.geom, p.geom, 250)
        ) AS places_count_250m,
        -- User reports within 150m
        (
          SELECT COALESCE(json_agg(json_build_object(
            'type', r.type,
            'status', r.status,
            'ip_hash', r.ip_hash
          )), '[]'::json)
          FROM reports r
          WHERE ST_DWithin(s.geom, r.geom, 150)
        ) AS reports_150m
      FROM segs s
      ORDER BY s.seg_index ASC;
    `;

    const res = await pool.query(queryText, [segmentsPayload]);
    return res.rows.map(row => ({
      seg_index: parseInt(row.seg_index, 10),
      min_police_dist: row.min_police_dist !== null ? parseFloat(row.min_police_dist) : null,
      min_hospital_dist: row.min_hospital_dist !== null ? parseFloat(row.min_hospital_dist) : null,
      places_150m: Array.isArray(row.places_150m) ? row.places_150m : [],
      places_count_250m: parseInt(row.places_count_250m, 10) || 0,
      reports_150m: Array.isArray(row.reports_150m) ? row.reports_150m : []
    }));
  }

  // In-Memory Batched Mock Simulation
  return segments.map(seg => {
    let minPoliceDist = null;
    let minHospitalDist = null;
    const places150m = [];
    let placesCount250m = 0;

    for (const p of defaultMockPlaces) {
      const d = calculateHaversineDistanceMeters(seg.midpoint.lat, seg.midpoint.lng, p.lat, p.lng);
      if (p.type === 'police' && d <= 2000) {
        if (minPoliceDist === null || d < minPoliceDist) minPoliceDist = d;
      }
      if (p.type === 'hospital' && d <= 3000) {
        if (minHospitalDist === null || d < minHospitalDist) minHospitalDist = d;
      }
      if (d <= 150) {
        places150m.push({
          id: p.id,
          type: p.type,
          opening_hours: p.opening_hours,
          is_24_7: p.is_24_7,
          dist: d
        });
      }
      if (d <= 250) {
        placesCount250m++;
      }
    }

    return {
      seg_index: seg.index,
      min_police_dist: minPoliceDist,
      min_hospital_dist: minHospitalDist,
      places_150m: places150m,
      places_count_250m: placesCount250m,
      reports_150m: []
    };
  });
}

/**
 * Scores a single segment based on safety rules and spatial data
 */
export function scoreSegment(segment, spatialData, departAt = new Date()) {
  const cfg = scoringConfig;
  const breakdown = {
    openPlaces: 0,
    activity: 0,
    police: 0,
    hospital: 0,
    reports: 0,
    penalties: 0
  };

  // 1. Open Places (Max 30 points)
  // Filter for open places of eligible types: shop24, fuel, pharmacy, atm
  const openEligible = (spatialData.places_150m || []).filter(p => {
    if (!cfg.openPlaces.eligibleTypes.includes(p.type)) return false;
    const openStatus = isPlaceOpen(p.opening_hours, p.is_24_7, departAt);
    return openStatus.isOpen;
  });

  const openPlacesCount = Math.min(openEligible.length, cfg.openPlaces.maxPlaceCountForCap);
  breakdown.openPlaces = Math.round(openPlacesCount * cfg.openPlaces.pointsPerPlace * 10) / 10;

  // 2. Activity (Max 30 points)
  // Road type weight (max 18) + place density (max 12)
  const waytypeWeight = cfg.activity.waytypeWeights[segment.waytype] ?? cfg.activity.waytypeWeights.default;
  const roadScore = cfg.activity.roadTypeMaxPoints * waytypeWeight;

  const densityCount = Math.min((spatialData.places_150m || []).length, cfg.activity.densityCap);
  const densityScore = cfg.activity.densityMaxPoints * (densityCount / cfg.activity.densityCap);
  breakdown.activity = Math.round(Math.min(cfg.activity.maxPoints, roadScore + densityScore) * 10) / 10;

  // 3. Police Station Proximity (Max 20 points)
  // Full points <= 500m, falling linearly to 0 at 2km
  const pDist = spatialData.min_police_dist;
  if (pDist !== null && pDist !== undefined && pDist <= cfg.police.zeroPointsDistanceMeters) {
    if (pDist <= cfg.police.fullPointsDistanceMeters) {
      breakdown.police = cfg.police.maxPoints;
    } else {
      const range = cfg.police.zeroPointsDistanceMeters - cfg.police.fullPointsDistanceMeters;
      const progress = (cfg.police.zeroPointsDistanceMeters - pDist) / range;
      breakdown.police = Math.round(cfg.police.maxPoints * progress * 10) / 10;
    }
  }

  // 4. Hospital Proximity (Max 10 points)
  // Full points <= 1km, falling linearly to 0 at 3km
  const hDist = spatialData.min_hospital_dist;
  if (hDist !== null && hDist !== undefined && hDist <= cfg.hospital.zeroPointsDistanceMeters) {
    if (hDist <= cfg.hospital.fullPointsDistanceMeters) {
      breakdown.hospital = cfg.hospital.maxPoints;
    } else {
      const range = cfg.hospital.zeroPointsDistanceMeters - cfg.hospital.fullPointsDistanceMeters;
      const progress = (cfg.hospital.zeroPointsDistanceMeters - hDist) / range;
      breakdown.hospital = Math.round(cfg.hospital.maxPoints * progress * 10) / 10;
    }
  }

  // 5. User Reports (Max +/- 10 points)
  // A report affects scores only when at least 2 different hashed IPs reported near the same spot, or an admin approved it.
  const reports = spatialData.reports_150m || [];
  
  // Group reports by type
  const reportsByType = {};
  for (const r of reports) {
    if (!reportsByType[r.type]) {
      reportsByType[r.type] = {
        hasApproved: false,
        ipHashes: new Set()
      };
    }
    if (r.status === 'approved') {
      reportsByType[r.type].hasApproved = true;
    }
    if (r.ip_hash) {
      reportsByType[r.type].ipHashes.add(r.ip_hash);
    }
  }

  let positivePoints = 0;
  let negativePoints = 0;

  for (const [type, data] of Object.entries(reportsByType)) {
    const qualifies = data.hasApproved || data.ipHashes.size >= cfg.reports.minUnapprovedIpHashCount;
    if (qualifies) {
      if (type === 'safe_spot') {
        positivePoints += cfg.reports.safeSpotPositiveScore;
      } else {
        // 'isolated', 'felt_unsafe', 'dark', 'harassment'
        negativePoints += cfg.reports.negativeReportPenalty;
      }
    }
  }

  const netReports = Math.min(cfg.reports.maxPositiveCap, positivePoints) + Math.max(cfg.reports.maxNegativeCap, negativePoints);
  breakdown.reports = Math.max(-10, Math.min(10, netReports));

  // 6. Penalties (Up to -15 points)
  let penaltySum = 0;

  // Underpass / tunnel (ORS waytype or characteristics)
  if (segment.waytype === 8 || segment.waytype === 10) {
    // Alley / steps / underpass
    penaltySum += cfg.penalties.underpassOrTunnelPenalty;
  }

  // Isolated stretch: no places within 250m
  if ((spatialData.places_count_250m || 0) === 0) {
    penaltySum += cfg.penalties.isolatedStretchNoPlacesPenalty;
  }

  breakdown.penalties = Math.max(cfg.penalties.maxTotalPenalty, penaltySum);

  // Total Score clamped between 0 and 100
  const rawScore = breakdown.openPlaces + breakdown.activity + breakdown.police + breakdown.hospital + breakdown.reports + breakdown.penalties;
  const finalScore = Math.max(0, Math.min(100, Math.round(rawScore * 10) / 10));

  return {
    score: finalScore,
    breakdown
  };
}

/**
 * Calculates safety level category from a score
 * @param {number} score 
 * @returns {'green' | 'yellow' | 'red'}
 */
export function getScoreLevel(score) {
  if (score >= scoringConfig.routeLevels.green.min) return 'green';
  if (score >= scoringConfig.routeLevels.yellow.min) return 'yellow';
  return 'red';
}

/**
 * Evaluates, scores, and ranks alternative walking routes.
 * 
 * @param {Object} params
 * @param {Array<Object>} params.routes GeoJSON routes from ORS
 * @param {Date|string} [params.departAt]
 * @param {'safest' | 'fastest'} [params.mode]
 * @returns {Promise<Object>} Formatted routes with scores, weakest segments, extra minutes
 */
export async function scoreAndRankRoutes({ routes, departAt = new Date(), mode = 'safest' }) {
  const evaluatedTime = departAt instanceof Date ? departAt : new Date(departAt);
  const cfg = scoringConfig;

  if (!routes || routes.length === 0) {
    return { routes: [], disclaimer: cfg.disclaimer };
  }

  // 1. Process and score each route
  const scoredRoutes = [];

  for (let rIdx = 0; rIdx < routes.length; rIdx++) {
    const rawRoute = routes[rIdx];
    const coords = rawRoute.geometry?.coordinates || [];
    const waytypes = rawRoute.properties?.extra_info?.waytype?.values || [];
    const summary = rawRoute.properties?.summary || {};

    // Split route into ~100m segments
    const segments = splitRouteIntoSegments(coords, waytypes, cfg.segmentLengthMeters);

    // Run ONE single batched PostGIS query for all segments in this route
    const batchData = await fetchRouteBatchSpatialData(segments);

    // Score every segment
    const scoredSegments = segments.map(seg => {
      const spatial = batchData.find(b => b.seg_index === seg.index) || {
        min_police_dist: null,
        min_hospital_dist: null,
        places_150m: [],
        places_count_250m: 0,
        reports_150m: []
      };

      const { score, breakdown } = scoreSegment(seg, spatial, evaluatedTime);
      return {
        index: seg.index,
        score,
        start: seg.start,
        end: seg.end,
        midpoint: seg.midpoint,
        lengthMeters: seg.lengthMeters,
        waytype: seg.waytype,
        breakdown
      };
    });

    // Route Score Calculation:
    // Route score = average of segment scores.
    // If the weakest segment is below 30, lower the route score by 10.
    let avgScore = 0;
    let weakestSegment = null;

    if (scoredSegments.length > 0) {
      const sum = scoredSegments.reduce((acc, s) => acc + s.score, 0);
      avgScore = sum / scoredSegments.length;

      // Find weakest segment
      weakestSegment = scoredSegments.reduce((min, s) => (s.score < min.score ? s : min), scoredSegments[0]);

      if (weakestSegment.score < cfg.routeLevels.weakestSegmentPenaltyThreshold) {
        avgScore = Math.max(0, avgScore - cfg.routeLevels.weakestSegmentDeduction);
      }
    }

    const finalRouteScore = Math.round(avgScore * 10) / 10;

    scoredRoutes.push({
      id: rIdx + 1,
      geometry: rawRoute.geometry,
      distance: summary.distance || 0,
      duration: summary.duration || 0,
      score: finalRouteScore,
      level: getScoreLevel(finalRouteScore),
      weakestSegment: weakestSegment ? {
        index: weakestSegment.index,
        score: weakestSegment.score,
        midpoint: weakestSegment.midpoint,
        lengthMeters: weakestSegment.lengthMeters,
        breakdown: weakestSegment.breakdown
      } : null,
      segments: scoredSegments
    });
  }

  // 2. Compute fastest duration and extraMinutesVsFastest
  const minDuration = Math.min(...scoredRoutes.map(r => r.duration));
  for (const r of scoredRoutes) {
    const extraSeconds = Math.max(0, r.duration - minDuration);
    r.extraMinutesVsFastest = Math.round((extraSeconds / 60) * 10) / 10;
  }

  // 3. Sort routes
  // Sort by score if mode is "safest", by duration if "fastest"
  if (mode === 'fastest') {
    scoredRoutes.sort((a, b) => a.duration - b.duration);
  } else {
    // Default to safest
    scoredRoutes.sort((a, b) => b.score - a.score);
  }

  return {
    mode,
    evaluatedAt: evaluatedTime.toISOString(),
    routesCount: scoredRoutes.length,
    routes: scoredRoutes,
    disclaimer: cfg.disclaimer
  };
}
