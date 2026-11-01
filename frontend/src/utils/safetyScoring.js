/**
 * Safety Scoring System.
 *
 * Calculates a 0-100 safety score for each route segment using
 * nearby OSM place data, local reports and time of day.
 *
 * IMPORTANT:
 * - Missing data does NOT automatically mean unsafe.
 * - Scores are ESTIMATES based on available geographical data.
 * - Never invent or fabricate place or light data.
 * - Confidence score reflects how much real data backed the score.
 */

import { SCORING_WEIGHTS, ISOLATION_PENALTY, SAFETY_THRESHOLDS, MIN_CONFIDENCE } from '../data/scoringWeights.js';
import { haversine, segmentPolyline } from './distance.js';
import { isOpenAt } from './openingHours.js';
import { getReports } from './storage.js';

/**
 * Determine safety category from score.
 * @returns {'good'|'moderate'|'poor'}
 */
export function safetyCategory(score) {
  if (score >= SAFETY_THRESHOLDS.good) return 'good';
  if (score >= SAFETY_THRESHOLDS.moderate) return 'moderate';
  return 'poor';
}

export function safetyCategoryLabel(cat) {
  if (cat === 'good') return 'Relatively Better';
  if (cat === 'moderate') return 'Stay Alert';
  return 'Potentially Concerning';
}

export function safetyCategoryColor(cat) {
  if (cat === 'good') return '#16A34A';
  if (cat === 'moderate') return '#EAB308';
  return '#DC2626';
}

export function safetyCategoryBg(cat) {
  if (cat === 'good') return '#DCFCE7';
  if (cat === 'moderate') return '#FEF9C3';
  return '#FEE2E2';
}

/**
 * Score a single segment given available nearby places and time.
 *
 * @param {object} params
 * @param {[number,number]} params.midpoint   [lat, lon]
 * @param {Array}  params.nearbyPlaces        OSM nearby places array
 * @param {Date}   params.departureTime       Time of travel
 * @param {Array}  params.localReports        Local device reports
 * @param {number} params.searchRadiusM       Radius used for nearby search
 * @returns {{ score: number, confidence: number, factors: object, category: string }}
 */
export function scoreSegment({ midpoint, nearbyPlaces = [], departureTime = new Date(), localReports = [], searchRadiusM = 300 }) {
  const factors = {
    streetLighting: null,   // unknown
    openPlaces: null,
    policeStations: null,
    publicActivity: null,
    hospitals: null,
    userReports: null,
  };

  let totalWeight = 0;
  let weightedScore = 0;
  let dataPoints = 0;

  // ── Police stations ────────────────────────────────────────────
  const police = nearbyPlaces.filter(p =>
    p.tags?.amenity === 'police' ||
    p.tags?.name?.toLowerCase().includes('police')
  );
  const closestPolice = closestPlace(midpoint, police);
  if (closestPolice !== null) {
    const pts = closestPolice < 200 ? 15 : closestPolice < 400 ? 10 : 5;
    factors.policeStations = pts;
    weightedScore += (pts / 15) * SCORING_WEIGHTS.policeStations;
    totalWeight += SCORING_WEIGHTS.policeStations;
    dataPoints++;
  }

  // ── Hospitals ─────────────────────────────────────────────────
  const hospitals = nearbyPlaces.filter(p =>
    p.tags?.amenity === 'hospital' ||
    p.tags?.amenity === 'clinic' ||
    p.tags?.amenity === 'doctors'
  );
  const closestHospital = closestPlace(midpoint, hospitals);
  if (closestHospital !== null) {
    const pts = closestHospital < 200 ? 10 : closestHospital < 400 ? 7 : 4;
    factors.hospitals = pts;
    weightedScore += (pts / 10) * SCORING_WEIGHTS.hospitals;
    totalWeight += SCORING_WEIGHTS.hospitals;
    dataPoints++;
  }

  // ── Open places / shops ────────────────────────────────────────
  const shops = nearbyPlaces.filter(p =>
    p.tags?.shop ||
    p.tags?.amenity === 'restaurant' ||
    p.tags?.amenity === 'cafe' ||
    p.tags?.amenity === 'convenience' ||
    p.tags?.amenity === 'pharmacy' ||
    p.tags?.amenity === 'fuel'
  );

  const openShops = shops.filter(p => {
    const status = isOpenAt(p.tags?.opening_hours, departureTime);
    return status === 'open' || status === 'unknown'; // unknown = may be open
  });

  if (shops.length > 0) {
    const openRatio = openShops.length / shops.length;
    const pts = openRatio;
    factors.openPlaces = Math.round(openRatio * 25);
    weightedScore += openRatio * SCORING_WEIGHTS.openPlaces;
    totalWeight += SCORING_WEIGHTS.openPlaces;
    dataPoints++;
  }

  // ── Street lighting (estimated from OSM highway tags) ─────────
  const litWays = nearbyPlaces.filter(p => p.tags?.lit === 'yes');
  const unlitWays = nearbyPlaces.filter(p => p.tags?.lit === 'no');
  if (litWays.length > 0 || unlitWays.length > 0) {
    const ratio = litWays.length / (litWays.length + unlitWays.length);
    // Adjust for time of day: lighting matters more at night
    const hour = departureTime.getHours();
    const isNight = hour < 6 || hour >= 20;
    const timeMultiplier = isNight ? 1.0 : 0.7;
    factors.streetLighting = Math.round(ratio * 30 * timeMultiplier);
    weightedScore += ratio * timeMultiplier * SCORING_WEIGHTS.streetLighting;
    totalWeight += SCORING_WEIGHTS.streetLighting;
    dataPoints++;
  } else {
    // Lit data unavailable — use a neutral estimate based on time
    const hour = departureTime.getHours();
    const isDaytime = hour >= 7 && hour < 19;
    if (isDaytime) {
      // Daytime: lighting irrelevant, partial credit
      const pts = 0.5;
      factors.streetLighting = Math.round(pts * 30);
      weightedScore += pts * SCORING_WEIGHTS.streetLighting;
      totalWeight += SCORING_WEIGHTS.streetLighting;
    }
    // Nighttime with no data: don't penalise, but don't reward
  }

  // ── Public activity (proxy: density of amenities) ─────────────
  const publicAmenities = nearbyPlaces.filter(p =>
    p.tags?.amenity && p.tags.amenity !== 'parking'
  );
  if (publicAmenities.length > 0) {
    const density = Math.min(publicAmenities.length / 10, 1); // 10+ = max
    factors.publicActivity = Math.round(density * 15);
    weightedScore += density * SCORING_WEIGHTS.publicActivity;
    totalWeight += SCORING_WEIGHTS.publicActivity;
    dataPoints++;
  }

  // ── User reports (local device only) ──────────────────────────
  const localRpts = localReports.filter(r => {
    if (!r.lat || !r.lon) return false;
    return haversine(midpoint, [r.lat, r.lon]) <= searchRadiusM;
  });
  if (localRpts.length > 0) {
    // More reports = worse score for this segment
    const penalty = Math.min(localRpts.length * 2, 5);
    factors.userReports = SCORING_WEIGHTS.userReports - penalty;
    weightedScore += ((SCORING_WEIGHTS.userReports - penalty) / SCORING_WEIGHTS.userReports) * SCORING_WEIGHTS.userReports;
    totalWeight += SCORING_WEIGHTS.userReports;
    dataPoints++;
  }

  // ── Isolation penalty ─────────────────────────────────────────
  const totalAmenities = nearbyPlaces.filter(p => p.tags?.amenity || p.tags?.shop).length;
  let isolationPenalty = 0;
  if (totalAmenities === 0 && nearbyPlaces.length === 0) {
    isolationPenalty = ISOLATION_PENALTY * 0.5; // only half penalty — missing data ≠ unsafe
  }

  // ── Final score ───────────────────────────────────────────────
  let rawScore;
  if (totalWeight === 0) {
    // No data at all — neutral score
    rawScore = 55;
  } else {
    rawScore = (weightedScore / totalWeight) * 100;
  }

  const score = Math.max(0, Math.min(100, rawScore - isolationPenalty));
  const confidence = dataPoints === 0 ? 0 : Math.min(dataPoints / 4, 1);
  const category = safetyCategory(score);

  return { score: Math.round(score), confidence, factors, category };
}

/**
 * Score an entire route.
 *
 * @param {object} params
 * @param {Array} params.coordinates   [[lat,lon], ...] decoded polyline
 * @param {Array} params.nearbyPlaces  All fetched nearby places
 * @param {Date}  params.departureTime
 * @param {number} params.segmentLengthM
 * @returns {object}
 */
export function scoreRoute({ coordinates, nearbyPlaces = [], departureTime = new Date(), segmentLengthM = 100 }) {
  if (!coordinates || coordinates.length === 0) {
    return {
      overall: { score: 50, confidence: 0, category: 'moderate' },
      segments: [],
      weakestSegment: null,
      insufficient: true,
    };
  }

  const localReports = getReports();
  const segments = segmentPolyline(coordinates, segmentLengthM);

  if (segments.length === 0) {
    return {
      overall: { score: 55, confidence: 0, category: 'moderate' },
      segments: [],
      weakestSegment: null,
      insufficient: true,
    };
  }

  const scoredSegments = segments.map((seg) => {
    // Only use places within 300m of the segment midpoint
    const localPlaces = nearbyPlaces.filter(p => {
      const pLat = p.lat || (p.center && p.center.lat);
      const pLon = p.lon || (p.center && p.center.lon);
      if (!pLat || !pLon) return false;
      return haversine(seg.midpoint, [pLat, pLon]) <= 300;
    });

    const result = scoreSegment({
      midpoint: seg.midpoint,
      nearbyPlaces: localPlaces,
      departureTime,
      localReports,
      searchRadiusM: 300,
    });

    return { ...seg, ...result };
  });

  // Overall score = weighted average by segment length
  const totalLen = scoredSegments.reduce((s, seg) => s + (seg.length || 1), 0);
  const weightedSum = scoredSegments.reduce((s, seg) => s + seg.score * (seg.length || 1), 0);
  const overallScore = Math.round(weightedSum / totalLen);
  const avgConfidence = scoredSegments.reduce((s, seg) => s + seg.confidence, 0) / scoredSegments.length;

  const weakestSegment = scoredSegments.reduce((min, seg) => seg.score < min.score ? seg : min, scoredSegments[0]);

  const sufficient = avgConfidence >= MIN_CONFIDENCE;

  return {
    overall: {
      score: overallScore,
      confidence: Math.round(avgConfidence * 100),
      category: safetyCategory(overallScore),
      label: safetyCategoryLabel(safetyCategory(overallScore)),
      color: safetyCategoryColor(safetyCategory(overallScore)),
      bg: safetyCategoryBg(safetyCategory(overallScore)),
    },
    segments: scoredSegments,
    weakestSegment,
    insufficient: !sufficient,
  };
}

/** Returns the closest place distance (metres) or null if no places. */
function closestPlace(midpoint, places) {
  if (!places || places.length === 0) return null;
  let min = Infinity;
  for (const p of places) {
    const lat = p.lat || (p.center && p.center.lat);
    const lon = p.lon || (p.center && p.center.lon);
    if (!lat || !lon) continue;
    const d = haversine(midpoint, [lat, lon]);
    if (d < min) min = d;
  }
  return min === Infinity ? null : min;
}
